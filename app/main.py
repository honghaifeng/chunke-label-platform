"""春科数据标注平台 - FastAPI 入口。"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import auth, db, prelabel

BASE_DIR = db.BASE_DIR
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")

app = FastAPI(title="春科数据标注平台", version="1.0.0")


@app.on_event("startup")
def _startup() -> None:
    db.init_db()


def me(request: Request) -> dict:
    return auth.current_user(request)


# ---------------------------------------------------------------------------
# 页面与静态资源
# ---------------------------------------------------------------------------

@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/health")
def health():
    return {"ok": True, "time": db.now()}


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/media/{name}")
def media(name: str, user: dict = Depends(me)):
    path = os.path.join(db.MEDIA_DIR, os.path.basename(name))
    if not os.path.exists(path):
        raise HTTPException(404, "文件不存在")
    return FileResponse(path)


# ---------------------------------------------------------------------------
# 登录
# ---------------------------------------------------------------------------

@app.post("/api/login")
def login(body: dict):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    user = db.row("SELECT * FROM users WHERE username=?", (username,))
    if not user or not db.verify_password(password, user["password_hash"]):
        raise HTTPException(401, "账号或密码错误")
    if user["status"] != "active":
        raise HTTPException(403, "账号已停用")
    token = auth.create_session(user["id"])
    db.log(user["id"], "login", "system", f"{user['name']} 登录")
    resp = JSONResponse({"ok": True, "user": _public_user(user)})
    resp.set_cookie(auth.COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 12)
    return resp


@app.post("/api/logout")
def logout(request: Request):
    auth.destroy_session(request.cookies.get(auth.COOKIE))
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(auth.COOKIE)
    return resp


@app.get("/api/me")
def get_me(user: dict = Depends(me)):
    return {"user": user, "role_label": auth.PLATFORM_ROLES.get(user["platform_role"], user["platform_role"])}


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "name": u["name"],
        "platform_role": u["platform_role"],
        "role_label": auth.PLATFORM_ROLES.get(u["platform_role"], u["platform_role"]),
    }


# ---------------------------------------------------------------------------
# 项目
# ---------------------------------------------------------------------------

def _project_dict(p: dict, user: dict) -> dict:
    stats = db.row(
        "SELECT COUNT(*) total,"
        " SUM(CASE WHEN status IN ('submitted','review') THEN 1 ELSE 0 END) reviewing,"
        " SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done"
        " FROM tasks WHERE project_id=?",
        (p["id"],),
    ) or {}
    total = stats.get("total") or 0
    done = stats.get("done") or 0
    p = dict(p)
    p["labels"] = json.loads(p.pop("label_config") or "{}")
    p["stats"] = {
        "total": total,
        "done": done,
        "reviewing": stats.get("reviewing") or 0,
        "progress": round(done / total * 100) if total else 0,
    }
    p["my_role"] = auth.project_role(user, p["id"])
    p["my_role_label"] = auth.PROJECT_ROLES.get(p["my_role"], "无")
    p["modality_label"] = db.MODALITY_LABEL.get(p["modality"], p["modality"])
    return p


@app.get("/api/projects")
def list_projects(user: dict = Depends(me)):
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"projects": []}
    marks = ",".join("?" * len(ids))
    items = db.rows(f"SELECT * FROM projects WHERE id IN ({marks}) ORDER BY id", tuple(ids))
    return {"projects": [_project_dict(p, user) for p in items]}


@app.post("/api/projects")
def create_project(body: dict, user: dict = Depends(me)):
    auth.require(user, "platform_admin", "project_manager")
    name = (body.get("name") or "").strip()
    modality = body.get("modality") or "audio"
    if not name:
        raise HTTPException(400, "项目名称不能为空")
    code = (body.get("code") or f"proj-{uuid.uuid4().hex[:6]}").strip()
    labels = body.get("labels") or db.DEFAULT_LABELS.get(modality, {})
    pid = db.execute(
        "INSERT INTO projects(code,name,modality,description,owner_id,engine,engine_url,label_config,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (
            code,
            name,
            modality,
            body.get("description") or "",
            user["id"],
            body.get("engine") or "",
            body.get("engine_url") or "",
            json.dumps(labels, ensure_ascii=False),
            db.now(),
        ),
    )
    db.execute(
        "INSERT OR REPLACE INTO project_members(project_id,user_id,project_role) VALUES(?,?,?)",
        (pid, user["id"], "manager"),
    )
    db.log(user["id"], "create_project", f"project:{pid}", name)
    return {"ok": True, "id": pid}


@app.get("/api/projects/{pid}/members")
def project_members(pid: int, user: dict = Depends(me)):
    if not auth.is_admin(user) and not auth.project_role(user, pid):
        raise HTTPException(403, "无权查看该项目")
    items = db.rows(
        "SELECT u.id,u.username,u.name,u.platform_role,m.project_role FROM project_members m"
        " JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY u.id",
        (pid,),
    )
    for it in items:
        it["project_role_label"] = auth.PROJECT_ROLES.get(it["project_role"], it["project_role"])
    return {"members": items}


@app.post("/api/projects/{pid}/members")
def add_member(pid: int, body: dict, user: dict = Depends(me)):
    if not auth.is_admin(user) and auth.project_role(user, pid) != "manager":
        raise HTTPException(403, "仅项目经理可分配成员")
    uid = int(body.get("user_id") or 0)
    role = body.get("project_role") or "annotator"
    if role not in auth.PROJECT_ROLES:
        raise HTTPException(400, "非法项目角色")
    db.execute(
        "INSERT OR REPLACE INTO project_members(project_id,user_id,project_role) VALUES(?,?,?)",
        (pid, uid, role),
    )
    db.log(user["id"], "add_member", f"project:{pid}", f"user:{uid} -> {role}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 任务
# ---------------------------------------------------------------------------

TASK_SQL = """
SELECT t.*, p.name project_name, p.code project_code, p.modality,
       a.name assignee_name, r.name reviewer_name
FROM tasks t
JOIN projects p ON p.id=t.project_id
LEFT JOIN users a ON a.id=t.assignee_id
LEFT JOIN users r ON r.id=t.reviewer_id
"""


@app.get("/api/tasks")
def list_tasks(status: str = "", project_id: int = 0, q: str = "", user: dict = Depends(me)):
    where, args = auth.task_scope_sql(user)
    conds = [where]
    vals = list(args)
    if status:
        conds.append("t.status=?")
        vals.append(status)
    if project_id:
        conds.append("t.project_id=?")
        vals.append(project_id)
    if q:
        conds.append("(t.name LIKE ? OR p.name LIKE ?)")
        vals.extend([f"%{q}%", f"%{q}%"])
    items = db.rows(TASK_SQL + " WHERE " + " AND ".join(conds) + " ORDER BY t.id DESC", tuple(vals))
    for t in items:
        t["modality_label"] = db.MODALITY_LABEL.get(t["modality"], t["modality"])
    return {"tasks": items}


def _get_task(task_id: int, user: dict) -> dict:
    t = db.row(TASK_SQL + " WHERE t.id=?", (task_id,))
    if not t:
        raise HTTPException(404, "任务不存在")
    auth.assert_task(user, t)
    return t


@app.get("/api/tasks/{tid}")
def task_detail(tid: int, user: dict = Depends(me)):
    task = _get_task(tid, user)
    project = db.row("SELECT * FROM projects WHERE id=?", (task["project_id"],))
    ann = db.row(
        "SELECT * FROM annotations WHERE task_id=? ORDER BY updated_at DESC, id DESC LIMIT 1", (tid,)
    )
    annotation = None
    if ann:
        annotation = {
            "id": ann["id"],
            "status": ann["status"],
            "version": ann["version"],
            "user_id": ann["user_id"],
            "payload": json.loads(ann["payload"] or "{}"),
            "prelabel": json.loads(ann["prelabel"] or "{}"),
            "updated_at": ann["updated_at"],
        }
    qc = db.row("SELECT * FROM qc_records WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    return {
        "task": task,
        "project": _project_dict(project, user) if project else None,
        "annotation": annotation,
        "qc": qc,
        "my_role": auth.project_role(user, task["project_id"]),
        "can_edit": user["platform_role"] in ("platform_admin", "project_manager")
        or task["assignee_id"] == user["id"]
        or auth.project_role(user, task["project_id"]) == "manager",
    }


@app.post("/api/tasks/{tid}/assign")
def assign_task(tid: int, body: dict, user: dict = Depends(me)):
    task = _get_task(tid, user)
    if not (
        auth.is_admin(user)
        or auth.project_role(user, task["project_id"]) == "manager"
        or user["platform_role"] == "project_manager"
    ):
        raise HTTPException(403, "仅项目经理可分配任务")
    assignee = int(body.get("assignee_id") or 0)
    reviewer = int(body.get("reviewer_id") or 0) or task["reviewer_id"]
    db.execute(
        "UPDATE tasks SET assignee_id=?, reviewer_id=?, updated_at=? WHERE id=?",
        (assignee or None, reviewer, db.now(), tid),
    )
    db.log(user["id"], "assign_task", f"task:{tid}", f"assignee:{assignee}")
    return {"ok": True}


@app.post("/api/tasks/{tid}/media")
async def upload_media(tid: int, file: UploadFile = File(...), user: dict = Depends(me)):
    task = _get_task(tid, user)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".wav"
    raw_path = os.path.join(db.TMP_DIR, f"upload-{uuid.uuid4().hex}{ext}")
    with open(raw_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    name = f"{task['project_code']}-{tid}-{uuid.uuid4().hex[:6]}.wav"
    out_path = os.path.join(db.MEDIA_DIR, name)
    try:
        proc = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", raw_path, "-ar", "16000", "-ac", "1", out_path],
            capture_output=True,
            text=True,
            timeout=300,
        )
    finally:
        try:
            os.remove(raw_path)
        except OSError:
            pass
    if proc.returncode != 0 or not os.path.exists(out_path):
        raise HTTPException(400, f"音频转码失败：{(proc.stderr or '')[-300:]}")

    duration = 0.0
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", out_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        duration = round(float(probe.stdout.strip() or 0), 2)
    except Exception:
        pass

    db.execute(
        "UPDATE tasks SET media_path=?, duration=?, media_type='audio', updated_at=? WHERE id=?",
        (out_path, duration, db.now(), tid),
    )
    db.log(user["id"], "upload_media", f"task:{tid}", name)
    return {"ok": True, "media": f"/media/{name}", "duration": duration}


@app.post("/api/tasks/{tid}/prelabel")
def run_prelabel(tid: int, body: dict | None = None, user: dict = Depends(me)):
    task = _get_task(tid, user)
    body = body or {}
    media_type = task.get("media_type") or "audio"
    media_path = task["media_path"]
    if not media_path:
        raise HTTPException(400, "该任务尚未上传媒体文件")

    if media_type == "image":
        # 图片预标注
        proj = db.row("SELECT label_config FROM projects WHERE id=?", (task["project_id"],)) or {}
        labels = json.loads((proj or {}).get("label_config") or "{}")
        classes = labels.get("目标类别") or ["商品主体", "价签", "货架", "遮挡"]
        engine = body.get("engine") or "auto"
        min_conf = float(body.get("min_conf") or 0.25)
        result = prelabel.prelabel_image(media_path, classes=classes, engine=engine, min_conf=min_conf)
        if not result.get("ok"):
            raise HTTPException(400, result.get("error") or "预识别失败")
        prelabel_json = json.dumps(result, ensure_ascii=False)
        seg_count = len(result.get("boxes", []))
    else:
        # 音频预识别
        cfg = {r["key"]: r["value"] for r in db.rows("SELECT key,value FROM settings")}
        hotwords = [w.strip() for w in (cfg.get("hotwords") or "").replace("，", ",").split(",") if w.strip()]
        spk_num = int(cfg.get("spk_num") or 0) or None
        result = prelabel.prelabel_audio(
            media_path,
            hotwords=hotwords,
            spk_num=spk_num,
            with_emotion=bool(body.get("emotion")),
        )
        if not result.get("ok"):
            raise HTTPException(400, result.get("error") or "预识别失败")

        try:
            from . import overlap
            ov = overlap.annotate(result.get("segments") or [], media_path)
            result["overlap"] = ov
        except Exception as exc:
            result["overlap"] = {"ok": False, "reason": str(exc)[:200]}
        prelabel_json = json.dumps(result, ensure_ascii=False)
        seg_count = len(result.get("segments", []))

    ann = db.row(
        "SELECT * FROM annotations WHERE task_id=? ORDER BY updated_at DESC, id DESC LIMIT 1", (tid,)
    )
    if ann:
        db.execute(
            "UPDATE annotations SET prelabel=?, updated_at=? WHERE id=?",
            (prelabel_json, db.now(), ann["id"]),
        )
    else:
        db.execute(
            "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (tid, user["id"], "{}", prelabel_json, "draft", 1, db.now(), db.now()),
        )
    if task["status"] == "pending":
        db.execute("UPDATE tasks SET status='annotating', updated_at=? WHERE id=?", (db.now(), tid))
    if result.get("duration"):
        db.execute("UPDATE tasks SET duration=? WHERE id=?", (result["duration"], tid))
    kind = "图片" if media_type == "image" else "音频"
    db.log(user["id"], "prelabel", f"task:{tid}", f"{kind}·{result.get('elapsed_ms')}ms / {seg_count} 个")
    return {"ok": True, "prelabel": result}


@app.post("/api/tasks/{tid}/annotation")
def save_annotation(tid: int, body: dict, user: dict = Depends(me)):
    task = _get_task(tid, user)
    if not (
        user["platform_role"] in ("platform_admin", "project_manager")
        or task["assignee_id"] == user["id"]
        or auth.project_role(user, task["project_id"]) == "manager"
    ):
        raise HTTPException(403, "仅任务标注员可保存标注")
    payload = body.get("payload") or {}
    segments = payload.get("segments") or []
    for seg in segments:
        try:
            seg["start"] = max(0.0, round(float(seg.get("start", 0)), 2))
            seg["end"] = max(seg["start"], round(float(seg.get("end", 0)), 2))
        except (TypeError, ValueError):
            raise HTTPException(400, "时间轴数据格式错误")
    payload["segments"] = segments

    ann = db.row(
        "SELECT * FROM annotations WHERE task_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (tid,)
    )
    if ann:
        db.execute(
            "UPDATE annotations SET payload=?, updated_at=? WHERE id=?",
            (json.dumps(payload, ensure_ascii=False), db.now(), ann["id"]),
        )
        aid = ann["id"]
    else:
        aid = db.execute(
            "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (tid, user["id"], json.dumps(payload, ensure_ascii=False), "{}", "draft", 1, db.now(), db.now()),
        )
    if task["status"] == "pending":
        db.execute("UPDATE tasks SET status='annotating', updated_at=? WHERE id=?", (db.now(), tid))
    return {"ok": True, "annotation_id": aid, "saved_at": db.now()}


@app.post("/api/tasks/{tid}/submit")
def submit_annotation(tid: int, body: dict, user: dict = Depends(me)):
    task = _get_task(tid, user)
    payload = body.get("payload") or {}
    if not (payload.get("segments") or []):
        raise HTTPException(400, "至少需要一段标注结果才能提交")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    if not ann:
        raise HTTPException(400, "请先保存标注草稿")
    db.execute(
        "UPDATE annotations SET payload=?, status='submitted', version=version+1, updated_at=? WHERE id=?",
        (json.dumps(payload, ensure_ascii=False), db.now(), ann["id"]),
    )
    db.execute("UPDATE tasks SET status='submitted', updated_at=? WHERE id=?", (db.now(), tid))
    db.log(user["id"], "submit", f"task:{tid}", f"annotation:{ann['id']}")
    return {"ok": True}


@app.get("/api/qc")
def qc_queue(user: dict = Depends(me)):
    where, args = auth.task_scope_sql(user)
    items = db.rows(
        TASK_SQL + f" WHERE {where} AND t.status IN ('submitted','review') ORDER BY t.updated_at DESC",
        tuple(args),
    )
    out = []
    for t in items:
        ann = db.row(
            "SELECT id,updated_at,payload FROM annotations WHERE task_id=? ORDER BY updated_at DESC LIMIT 1",
            (t["id"],),
        )
        t["has_annotation"] = bool(ann)
        t["modality_label"] = db.MODALITY_LABEL.get(t["modality"], t["modality"])
        out.append(t)
    return {"tasks": out}


@app.post("/api/tasks/{tid}/review")
def review(tid: int, body: dict, user: dict = Depends(me)):
    task = _get_task(tid, user)
    if user["platform_role"] not in ("platform_admin", "reviewer", "project_manager") and auth.project_role(
        user, task["project_id"]
    ) != "reviewer":
        raise HTTPException(403, "仅质检员可执行质检")
    result = body.get("result") or ""
    if result not in ("approved", "rejected"):
        raise HTTPException(400, "质检结论必须为 approved 或 rejected")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    if not ann:
        raise HTTPException(400, "任务尚未提交标注")
    score = float(body.get("score") or 0)
    db.execute(
        "INSERT INTO qc_records(task_id,annotation_id,reviewer_id,result,score,comment,created_at)"
        " VALUES(?,?,?,?,?,?,?)",
        (tid, ann["id"], user["id"], result, score, body.get("comment") or "", db.now()),
    )
    if result == "approved":
        db.execute(
            "UPDATE annotations SET status='approved', updated_at=? WHERE id=?", (db.now(), ann["id"])
        )
        db.execute("UPDATE tasks SET status='done', updated_at=? WHERE id=?", (db.now(), tid))
    else:
        db.execute(
            "UPDATE annotations SET status='rejected', updated_at=? WHERE id=?", (db.now(), ann["id"])
        )
        db.execute("UPDATE tasks SET status='annotating', updated_at=? WHERE id=?", (db.now(), tid))
    db.log(user["id"], "review", f"task:{tid}", f"{result} {score}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 统计 / 成员 / 设置 / 审计
# ---------------------------------------------------------------------------

@app.get("/api/stats")
def stats(user: dict = Depends(me)):
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"summary": {}, "by_status": [], "by_modality": [], "trend": [], "projects": []}
    marks = ",".join("?" * len(ids))
    args = tuple(ids)
    summary = db.row(
        f"SELECT COUNT(*) total,"
        f" SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,"
        f" SUM(CASE WHEN status='annotating' THEN 1 ELSE 0 END) annotating,"
        f" SUM(CASE WHEN status IN ('submitted','review') THEN 1 ELSE 0 END) reviewing,"
        f" SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done"
        f" FROM tasks WHERE project_id IN ({marks})",
        args,
    ) or {}
    by_status = [
        {"name": "待标注", "key": "pending", "value": summary.get("pending") or 0},
        {"name": "标注中", "key": "annotating", "value": summary.get("annotating") or 0},
        {"name": "质检中", "key": "reviewing", "value": summary.get("reviewing") or 0},
        {"name": "已完成", "key": "done", "value": summary.get("done") or 0},
    ]
    by_modality = db.rows(
        f"SELECT p.modality, COUNT(*) value FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE t.project_id IN ({marks}) GROUP BY p.modality",
        args,
    )
    for m in by_modality:
        m["name"] = db.MODALITY_LABEL.get(m["modality"], m["modality"])
    trend = []
    today = datetime.now().date()
    for i in range(6, -1, -1):
        day = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        total = db.row(
            f"SELECT COUNT(*) c FROM tasks WHERE project_id IN ({marks}) AND substr(created_at,1,10)=?",
            args + (day,),
        )
        done = db.row(
            f"SELECT COUNT(*) c FROM tasks WHERE project_id IN ({marks}) AND status='done' AND substr(updated_at,1,10)=?",
            args + (day,),
        )
        trend.append({"day": day[5:], "created": total["c"] if total else 0, "done": done["c"] if done else 0})

    projects = db.rows(f"SELECT * FROM projects WHERE id IN ({marks}) ORDER BY id", args)
    proj_stats = []
    for p in projects:
        s = db.row(
            "SELECT COUNT(*) total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done FROM tasks WHERE project_id=?",
            (p["id"],),
        )
        total = s["total"] or 0
        proj_stats.append(
            {
                "name": p["name"],
                "modality": db.MODALITY_LABEL.get(p["modality"], p["modality"]),
                "total": total,
                "done": s["done"] or 0,
                "progress": round((s["done"] or 0) / total * 100) if total else 0,
            }
        )

    qc = db.row(
        f"SELECT COUNT(*) c, SUM(CASE WHEN result='approved' THEN 1 ELSE 0 END) ok FROM qc_records"
        f" WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN ({marks}))",
        args,
    ) or {}
    qc_total = qc.get("c") or 0
    summary["qc_pass_rate"] = round((qc.get("ok") or 0) / qc_total * 100) if qc_total else 0
    summary["qc_total"] = qc_total
    return {
        "summary": summary,
        "by_status": by_status,
        "by_modality": by_modality,
        "trend": trend,
        "projects": proj_stats,
    }


@app.get("/api/members")
def members(user: dict = Depends(me)):
    if not auth.is_admin(user) and user["platform_role"] != "project_manager":
        raise HTTPException(403, "无权查看成员")
    items = db.rows("SELECT id,username,name,platform_role,status,created_at FROM users ORDER BY id")
    for it in items:
        it["role_label"] = auth.PLATFORM_ROLES.get(it["platform_role"], it["platform_role"])
        it["project_count"] = (
            db.row("SELECT COUNT(*) c FROM project_members WHERE user_id=?", (it["id"],)) or {}
        ).get("c", 0)
    return {"members": items}


@app.post("/api/members")
def create_member(body: dict, user: dict = Depends(me)):
    auth.require(user, "platform_admin")
    username = (body.get("username") or "").strip()
    if not username:
        raise HTTPException(400, "账号不能为空")
    if db.row("SELECT id FROM users WHERE username=?", (username,)):
        raise HTTPException(400, "账号已存在")
    role = body.get("platform_role") or "annotator"
    if role not in auth.PLATFORM_ROLES:
        raise HTTPException(400, "非法角色")
    uid = db.execute(
        "INSERT INTO users(username,name,password_hash,platform_role,created_at) VALUES(?,?,?,?,?)",
        (username, body.get("name") or username, db.hash_password(body.get("password") or db.DEFAULT_PASSWORD), role, db.now()),
    )
    db.log(user["id"], "create_member", f"user:{uid}", role)
    return {"ok": True, "id": uid}


@app.patch("/api/members/{uid}")
def update_member(uid: int, body: dict, user: dict = Depends(me)):
    auth.require(user, "platform_admin")
    target = db.row("SELECT * FROM users WHERE id=?", (uid,))
    if not target:
        raise HTTPException(404, "成员不存在")
    role = body.get("platform_role") or target["platform_role"]
    status = body.get("status") or target["status"]
    if role not in auth.PLATFORM_ROLES:
        raise HTTPException(400, "非法角色")
    db.execute("UPDATE users SET platform_role=?, status=? WHERE id=?", (role, status, uid))
    db.log(user["id"], "update_member", f"user:{uid}", f"{role}/{status}")
    return {"ok": True}


@app.get("/api/settings")
def get_settings(user: dict = Depends(me)):
    data = {r["key"]: r["value"] for r in db.rows("SELECT key,value FROM settings")}
    data["worker_ready"] = prelabel.worker_ready()
    data["engines"] = prelabel.engine_status()
    return data


@app.post("/api/settings")
def save_settings(body: dict, user: dict = Depends(me)):
    auth.require(user, "platform_admin")
    for key in ("hotwords", "spk_num", "auto_prelabel", "asr_engine"):
        if key in body:
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (key, str(body[key])))
    db.log(user["id"], "save_settings", "system", ",".join(body.keys()))
    return {"ok": True}


@app.get("/api/audit")
def audit(user: dict = Depends(me)):
    items = db.rows(
        "SELECT l.*, u.name actor_name FROM audit_log l LEFT JOIN users u ON u.id=l.actor_id"
        " ORDER BY l.id DESC LIMIT 60"
    )
    return {"logs": items}


@app.get("/api/bootstrap")
def bootstrap(user: dict = Depends(me)):
    projects = list_projects(user)["projects"]
    tasks = list_tasks("", 0, "", user)["tasks"]
    data = {r["key"]: r["value"] for r in db.rows("SELECT key,value FROM settings")}
    return {
        "user": {**user, "role_label": auth.PLATFORM_ROLES.get(user["platform_role"], "")},
        "projects": projects,
        "tasks": tasks,
        "engines": prelabel.engine_status(),
        "settings": data,
        "counts": {
            "tasks": len(tasks),
            "pending": sum(1 for t in tasks if t["status"] == "pending"),
            "review": sum(1 for t in tasks if t["status"] in ("submitted", "review")),
            "done": sum(1 for t in tasks if t["status"] == "done"),
        },
    }
