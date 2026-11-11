"""春科数据标注平台 - FastAPI 入口。"""
from __future__ import annotations

import json
import os
import random
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import advanced, auth, db, enterprise, extras, ops, prelabel, workbench

BASE_DIR = db.BASE_DIR
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")

app = FastAPI(title="春科数据标注平台", version="1.0.0")
app.include_router(enterprise.router)
app.include_router(workbench.router)
app.include_router(ops.router)
app.include_router(extras.router)
app.include_router(advanced.router)


@app.middleware("http")
async def ip_allowlist_guard(request: Request, call_next):
    """访问 IP 白名单：仅拦截业务 API 与 SCIM，静态资源与健康检查保持可用。"""
    path = request.url.path
    if (path.startswith("/api/") or path.startswith("/scim/")) and not ops.ip_allowed(request):
        db.security_event("ip_blocked", "warning", actor="", ip=auth.client_ip(request), detail=path)
        return JSONResponse({"detail": "当前 IP 不在访问白名单内"}, status_code=403)
    return await call_next(request)


@app.middleware("http")
async def no_cache_frontend(request: Request, call_next):
    """前端页面与静态资源每次都向服务端校验，避免浏览器拿旧 JS/CSS。"""
    resp = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/static/"):
        resp.headers["Cache-Control"] = "no-cache, must-revalidate"
    return resp


@app.middleware("http")
async def api_v1_guard(request: Request, call_next):
    """/api/v1/* 的 API Key 鉴权与调用审计。"""
    return await enterprise.v1_middleware(request, call_next)


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    extras.init_schema()
    advanced.init_schema()


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
def media(name: str, request: Request, token: str = ""):
    """媒体文件：登录会话或短时签名 token（供外部播放器/导出链接使用）。"""
    if not (token and ops.verify_media_token(os.path.basename(name), token)):
        auth.current_user(request)
    path = os.path.join(db.MEDIA_DIR, os.path.basename(name))
    if not os.path.exists(path):
        raise HTTPException(404, "文件不存在")
    return FileResponse(path)


# ---------------------------------------------------------------------------
# 登录
# ---------------------------------------------------------------------------

@app.post("/api/login")
def login(body: dict, request: Request):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    ip = auth.client_ip(request)
    if username and advanced.locked(username):
        db.security_event("login_locked", "warning", actor=username, ip=ip, detail="账号已临时锁定")
        raise HTTPException(429, "登录失败次数过多，请稍后再试")
    user = db.row("SELECT * FROM users WHERE username=?", (username,))
    if not user or not db.verify_password(password, user["password_hash"]):
        if username:
            db.execute("INSERT INTO login_attempts(username,ip,success,created_at) VALUES(?,?,0,?)",
                       (username, ip, db.now()))
        db.security_event(
            "login_failed",
            "warning",
            actor=username,
            ip=auth.client_ip(request),
            detail="账号或密码错误",
        )
        raise HTTPException(401, "账号或密码错误")
    db.execute("INSERT INTO login_attempts(username,ip,success,created_at) VALUES(?,?,1,?)",
               (username, ip, db.now()))
    if user["status"] != "active":
        db.security_event("login_disabled", "warning", actor=username, ip=auth.client_ip(request), detail="停用账号尝试登录")
        raise HTTPException(403, "账号已停用")
    code = str(body.get("code") or "").strip()
    totp = ops.user_totp(user["id"])
    if totp and totp["enabled"]:
        if not code:
            return JSONResponse({"detail": "需要动态口令", "mfa_required": True}, status_code=401)
        if not ops.verify_totp(totp["secret"], code):
            db.security_event("mfa_failed", "warning", actor=username, ip=auth.client_ip(request), detail="动态口令错误")
            return JSONResponse({"detail": "动态口令不正确", "mfa_required": True}, status_code=401)
    elif ops.get_setting("mfa_required") == "on" and user["platform_role"] == "platform_admin":
        return JSONResponse({"detail": "管理员必须启用 MFA 后登录", "mfa_setup_required": True}, status_code=403)
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
    return {
        "user": user,
        "role_label": auth.PLATFORM_ROLES.get(user["platform_role"], user["platform_role"]),
        "permissions": [p for p in db.PERMISSIONS if auth.has_perm(user, p)],
    }


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "username": u["username"],
        "name": u["name"],
        "platform_role": u["platform_role"],
        "role_label": auth.PLATFORM_ROLES.get(u["platform_role"], u["platform_role"]),
        "tenant_id": u.get("tenant_id"),
        "org_id": u.get("org_id"),
        "team_id": u.get("team_id"),
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
    tpl = db.row("SELECT id,name,code FROM templates WHERE id=?", (p.get("template_id"),)) if p.get("template_id") else None
    p["template"] = tpl
    wf = db.row("SELECT id,name,qc_policy FROM workflows WHERE project_id=? ORDER BY id LIMIT 1", (p["id"],))
    if wf:
        wf["qc_policy"] = json.loads(wf["qc_policy"] or "{}")
    p["workflow"] = wf
    p["dataset_count"] = (
        db.row("SELECT COUNT(*) c FROM datasets WHERE project_id=?", (p["id"],)) or {}
    ).get("c", 0)
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
    tpl = None
    if body.get("template_id"):
        tpl = db.row("SELECT * FROM templates WHERE id=?", (int(body["template_id"]),))
    if not tpl:
        tpl = db.row("SELECT * FROM templates WHERE modality=? ORDER BY id LIMIT 1", (modality,))
    labels = body.get("labels") or (json.loads(tpl["label_config"]) if tpl else db.DEFAULT_LABELS.get(modality, {}))
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
        "UPDATE projects SET tenant_id=?, template_id=? WHERE id=?",
        (user.get("tenant_id"), tpl["id"] if tpl else None, pid),
    )
    if tpl:
        db.execute(
            "INSERT INTO workflows(name,project_id,template_id,description,steps,qc_policy,status,created_by,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (
                f"{name} · 标准流程",
                pid,
                tpl["id"],
                "标注 → 自检 → 抽审 → 返修 → 交付",
                json.dumps(["标注", "自检", "抽审", "返修", "交付"], ensure_ascii=False),
                tpl["qc_config"],
                "active",
                user["id"],
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
def list_tasks(status: str = "", project_id: int = 0, q: str = "", archived: int = 0,
               page: int = 1, limit: int = 0, user: dict = Depends(me)):
    where, args = auth.task_scope_sql(user)
    conds = [where, "t.deleted=0", "t.archived=?"]
    vals = list(args) + [1 if archived else 0]
    if status:
        conds.append("t.status=?")
        vals.append(status)
    if project_id:
        conds.append("t.project_id=?")
        vals.append(project_id)
    if q:
        conds.append("(t.name LIKE ? OR p.name LIKE ?)")
        vals.extend([f"%{q}%", f"%{q}%"])
    total = db.row(
        "SELECT COUNT(*) c FROM tasks t JOIN projects p ON p.id=t.project_id WHERE " + " AND ".join(conds),
        tuple(vals),
    )["c"]
    sql = TASK_SQL + " WHERE " + " AND ".join(conds) + " ORDER BY t.id DESC"
    if limit:
        sql += " LIMIT ? OFFSET ?"
        vals.extend([max(1, min(500, limit)), max(0, (max(1, page) - 1) * max(1, limit))])
    items = db.rows(sql, tuple(vals))
    for t in items:
        t["modality_label"] = db.MODALITY_LABEL.get(t["modality"], t["modality"])
    return {"tasks": items, "total": total, "page": page, "limit": limit}


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
    media = db.rows("SELECT id,kind,name,path,meta,created_at FROM task_media WHERE task_id=? ORDER BY id", (tid,))
    for m in media:
        m["url"] = "/media/" + os.path.basename(m["path"])
        try:
            m["meta"] = json.loads(m["meta"] or "{}")
        except ValueError:
            m["meta"] = {}
    return {
        "task": task,
        "project": _project_dict(project, user) if project else None,
        "annotation": annotation,
        "qc": qc,
        "issues": db.rows("SELECT * FROM issues WHERE task_id=? ORDER BY id DESC", (tid,)),
        "media": media,
        "tracks": [
            {**tr, "keyframes": json.loads(tr["keyframes"] or "[]")}
            for tr in db.rows("SELECT * FROM tracks WHERE task_id=? ORDER BY id", (tid,))
        ],
        "my_role": auth.project_role(user, task["project_id"]),
        "can_edit": extras.task_can_edit(user, task),
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
    if assignee:
        db.notify(assignee, "收到新任务", f"{task['project_name']} · {task['name']}", "assign", f"#/annotate/{tid}")
    db.log(user["id"], "assign_task", f"task:{tid}", f"assignee:{assignee}")
    return {"ok": True}


@app.post("/api/tasks")
def create_task(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    project = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not project:
        raise HTTPException(400, "请选择有效的项目")
    if not auth.is_admin(user) and (
        pid not in auth.visible_project_ids(user) or auth.project_role(user, pid) != "manager"
    ):
        raise HTTPException(403, "仅平台管理员 / 项目管理者可创建任务")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "任务名称不能为空")
    media_type = body.get("media_type") or project["modality"]
    if media_type not in ("audio", "image", "video", "pointcloud"):
        media_type = project["modality"]
    priority = body.get("priority") or "normal"
    if priority not in ("low", "normal", "high"):
        priority = "normal"
    assignee = int(body.get("assignee_id") or 0) or None
    reviewer = int(body.get("reviewer_id") or 0) or None
    tid = db.execute(
        "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,assignee_id,reviewer_id,"
        "priority,batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            pid,
            name,
            "",
            media_type,
            0,
            "pending",
            assignee,
            reviewer,
            priority,
            (body.get("batch") or "").strip(),
            db.now(),
            db.now(),
        ),
    )
    db.log(user["id"], "create_task", f"task:{tid}", f"{project['name']} · {name}")
    return {"ok": True, "id": tid}


IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
POINTCLOUD_EXT = {".pcd", ".ply", ".bin", ".las", ".laz"}


def _media_kind(ext: str) -> str:
    if ext in IMAGE_EXT:
        return "image"
    if ext in VIDEO_EXT:
        return "video"
    if ext in POINTCLOUD_EXT:
        return "pointcloud"
    if ext == ".pdf":
        return "pdf"
    if ext in (".txt", ".md"):
        return "text"
    if ext in (".json", ".jsonl"):
        return "llm"
    if ext == ".csv":
        return "timeseries"
    return "audio"


@app.post("/api/tasks/{tid}/media")
async def upload_media(tid: int, file: UploadFile = File(...), user: dict = Depends(me)):
    task = _get_task(tid, user)
    if not (
        user["platform_role"] in ("platform_admin", "project_manager")
        or task["assignee_id"] == user["id"]
        or auth.project_role(user, task["project_id"]) == "manager"
    ):
        raise HTTPException(403, "仅任务标注员可上传媒体")
    ext = os.path.splitext(file.filename or "")[1].lower()
    kind = _media_kind(ext)

    # 图片 / 视频 / 点云：原样落盘，不走音频转码
    if kind != "audio":
        name = f"{task['project_code']}-{tid}-{uuid.uuid4().hex[:6]}{ext or '.bin'}"
        out_path = os.path.join(db.MEDIA_DIR, name)
        with open(out_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        db.execute(
            "UPDATE tasks SET media_path=?, media_type=?, duration=0, updated_at=? WHERE id=?",
            (out_path, kind, db.now(), tid),
        )
        db.log(user["id"], "upload_media", f"task:{tid}", f"{kind} · {name}")
        return {
            "ok": True,
            "media": f"/media/{name}",
            "media_type": kind,
            "size": os.path.getsize(out_path),
        }

    raw_path = os.path.join(db.TMP_DIR, f"upload-{uuid.uuid4().hex}{ext or '.wav'}")
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
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(400, f"音频转码失败：{str(exc)[:200]}")
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
    if (task.get("media_type") or "audio") == "image":
        # 图片标注：归一化坐标并丢弃无效框
        boxes = []
        for b in payload.get("boxes") or []:
            try:
                x = min(1.0, max(0.0, float(b.get("x", 0))))
                y = min(1.0, max(0.0, float(b.get("y", 0))))
                w = min(1.0, max(0.0, float(b.get("w", 0))))
                h = min(1.0, max(0.0, float(b.get("h", 0))))
            except (TypeError, ValueError):
                raise HTTPException(400, "目标框坐标格式错误")
            if w <= 0 or h <= 0:
                continue
            item = {
                "cls": str(b.get("cls") or "").strip() or "未分类",
                "name": str(b.get("name") or ""),
                "source": b.get("source") or "manual",
                "auto_cls": b.get("auto_cls") or "",
                "x": round(x, 6),
                "y": round(y, 6),
                "w": round(w, 6),
                "h": round(h, 6),
            }
            if b.get("conf") is not None:
                try:
                    item["conf"] = round(float(b.get("conf")), 4)
                except (TypeError, ValueError):
                    pass
            boxes.append(item)
        payload["boxes"] = boxes
    else:
        if "segments" in payload:
            segments = payload.get("segments") or []
            for seg in segments:
                try:
                    seg["start"] = max(0.0, round(float(seg.get("start", 0)), 2))
                    seg["end"] = max(seg["start"], round(float(seg.get("end", 0)), 2))
                except (TypeError, ValueError):
                    raise HTTPException(400, "时间轴数据格式错误")
            payload["segments"] = segments
        # 视频轨迹：校验关键帧数值
        for track in payload.get("tracks") or []:
            for kf in track.get("keyframes") or []:
                try:
                    kf["t"] = max(0.0, round(float(kf.get("t", 0)), 3))
                except (TypeError, ValueError):
                    raise HTTPException(400, "视频轨迹帧时间格式错误")

    ann = db.row(
        "SELECT * FROM annotations WHERE task_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (tid,)
    )
    if ann:
        old = json.loads(ann["payload"] or "{}")
        if old != payload:
            hist = (db.row("SELECT COUNT(*) c FROM annotation_versions WHERE annotation_id=?", (ann["id"],)) or {}).get("c", 0)
            db.execute(
                "INSERT INTO annotation_versions(annotation_id,task_id,version,payload,note,created_by,created_at)"
                " VALUES(?,?,?,?,?,?,?)",
                (ann["id"], tid, hist + 1, json.dumps(old, ensure_ascii=False),
                 body.get("note") or "自动保存前快照", user["id"], db.now()),
            )
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


def _task_qc_policy(task: dict) -> tuple[dict | None, dict]:
    wf = None
    if task.get("workflow_id"):
        wf = db.row("SELECT * FROM workflows WHERE id=?", (task["workflow_id"],))
    if not wf:
        wf = db.row(
            "SELECT * FROM workflows WHERE project_id=? AND status='active' ORDER BY id LIMIT 1",
            (task["project_id"],),
        )
    if not wf and task.get("project_id"):
        proj = db.row("SELECT template_id FROM projects WHERE id=?", (task["project_id"],))
        if proj and proj.get("template_id"):
            tpl = db.row("SELECT qc_config FROM templates WHERE id=?", (proj["template_id"],))
            return None, json.loads(tpl["qc_config"]) if tpl else {}
    return wf, json.loads(wf["qc_policy"] or "{}") if wf else {}


@app.post("/api/tasks/{tid}/submit")
def submit_annotation(tid: int, body: dict, user: dict = Depends(me)):
    task = _get_task(tid, user)
    if not (
        user["platform_role"] in ("platform_admin", "project_manager")
        or task["assignee_id"] == user["id"]
        or auth.project_role(user, task["project_id"]) == "manager"
    ):
        raise HTTPException(403, "仅任务标注员可提交质检")
    payload = body.get("payload") or {}
    modality = task.get("media_type") or "audio"
    if modality == "image":
        if not (payload.get("boxes") or []):
            raise HTTPException(400, "至少需要一个标注目标才能提交")
    elif modality in ("text", "llm"):
        if not (payload.get("spans") or payload.get("messages") or str(payload.get("text") or "").strip()):
            raise HTTPException(400, "请先完成文本标注")
    elif modality == "video":
        if not (payload.get("tracks") or payload.get("segments") or payload.get("boxes")):
            raise HTTPException(400, "至少需要一条视频轨迹才能提交")
    elif modality == "pointcloud":
        if not (payload.get("boxes") or payload.get("points")):
            raise HTTPException(400, "至少需要一个 3D 框才能提交")
    elif modality == "timeseries":
        if not (payload.get("rows") or payload.get("intervals") or payload.get("points")):
            raise HTTPException(400, "请先完成时序标注")
    elif modality == "multimodal":
        if not (payload.get("boxes") or payload.get("segments") or payload.get("items")):
            raise HTTPException(400, "请先完成多模态标注")
    elif not (payload.get("segments") or []):
        raise HTTPException(400, "至少需要一段标注结果才能提交")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    if not ann:
        raise HTTPException(400, "请先保存标注草稿")
    wf, policy = _task_qc_policy(task)
    required, sample, sample_reason = extras.sampling_decision(task, policy)
    db.execute(
        "UPDATE annotations SET payload=?, status='submitted', version=version+1, updated_at=? WHERE id=?",
        (json.dumps(payload, ensure_ascii=False), db.now(), ann["id"]),
    )
    if required:
        db.execute(
            "UPDATE tasks SET status='submitted', qc_required=1, qc_round=qc_round+1, updated_at=? WHERE id=?",
            (db.now(), tid),
        )
    else:
        db.execute(
            "UPDATE annotations SET status='approved', updated_at=? WHERE id=?", (db.now(), ann["id"])
        )
        db.execute(
            "INSERT INTO qc_records(task_id,annotation_id,reviewer_id,result,score,comment,created_at)"
            " VALUES(?,?,?,?,?,?,?)",
            (tid, ann["id"], user["id"], "auto_approved", 100, f"按抽审策略自动通过（{sample_reason}）", db.now()),
        )
        db.execute(
            "UPDATE tasks SET status='done', qc_required=0, qc_round=qc_round+1, updated_at=? WHERE id=?",
            (db.now(), tid),
        )
    db.log(
        user["id"],
        "submit",
        f"task:{tid}",
        f"annotation:{ann['id']} · {'抽审' if required else '策略自动通过'}",
    )
    return {
        "ok": True,
        "qc_required": required,
        "auto_approved": not required,
        "sample_rate": sample,
        "workflow": wf["name"] if wf else "默认流程",
        "min_score": policy.get("min_score", 0),
        "message": f"已提交质检（{sample_reason}）" if required else f"按抽审策略自动通过（{sample_reason}）",
    }


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
        wf = db.row("SELECT name FROM workflows WHERE id=?", (t.get("workflow_id"),)) if t.get("workflow_id") else None
        t["workflow_name"] = wf["name"] if wf else "默认流程"
        t["qc_required_label"] = "抽审" if t.get("qc_required") else "免检"
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
    dims = body.get("dims") or {}
    item_index = int(body.get("item_index", -1))
    if dims:
        try:
            valid = {k: float(v) for k, v in dims.items() if v is not None}
        except (TypeError, ValueError):
            raise HTTPException(400, "维度评分格式错误")
        if valid and not score:
            score = round(sum(valid.values()) / len(valid), 1)
        dims = valid
    _, policy = _task_qc_policy(task)
    comment = (body.get("comment") or "").strip()
    if result == "rejected" and policy.get("require_comment") and not comment:
        raise HTTPException(400, "该流程要求返修时填写质检意见")
    db.execute(
        "INSERT INTO qc_records(task_id,annotation_id,reviewer_id,result,score,comment,dims,item_index,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (tid, ann["id"], user["id"], result, score, comment, json.dumps(dims, ensure_ascii=False), item_index, db.now()),
    )
    if result == "approved":
        db.execute(
            "UPDATE annotations SET status='approved', updated_at=? WHERE id=?", (db.now(), ann["id"])
        )
        db.execute("UPDATE tasks SET status='done', progress=100, updated_at=? WHERE id=?", (db.now(), tid))
        escalated = False
        db.notify(task["assignee_id"], "任务质检通过", f"{task['name']} · {score} 分", "qc", f"#/annotate/{tid}")
    else:
        db.execute(
            "UPDATE annotations SET status='rejected', updated_at=? WHERE id=?", (db.now(), ann["id"])
        )
        reworks = (task.get("rework_count") or 0) + 1
        escalated = reworks > int(policy.get("max_rework") or 99)
        db.execute(
            "UPDATE tasks SET status='annotating', rework_count=?, priority=? , updated_at=? WHERE id=?",
            (reworks, "high" if escalated else task.get("priority") or "normal", db.now(), tid),
        )
        db.notify(
            task["assignee_id"], "任务需要返修",
            f"{task['name']} · {comment[:60] or '请按质检意见修改'}", "rework", f"#/annotate/{tid}",
        )
    db.log(
        user["id"],
        "review",
        f"task:{tid}",
        f"{result} {score}" + (" · 超返修上限升级" if escalated else ""),
    )
    return {"ok": True, "escalated": escalated, "max_rework": policy.get("max_rework")}


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
    items = db.rows(
        "SELECT u.id,u.username,u.name,u.platform_role,u.status,u.created_at,u.tenant_id,u.org_id,u.team_id,"
        " t.name tenant_name,o.name org_name,tm.name team_name FROM users u"
        " LEFT JOIN tenants t ON t.id=u.tenant_id"
        " LEFT JOIN orgs o ON o.id=u.org_id"
        " LEFT JOIN teams tm ON tm.id=u.team_id ORDER BY u.id"
    )
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
def audit(page: int = 1, limit: int = 60, action: str = "", user: dict = Depends(me)):
    conds, vals = ["1=1"], []
    if action:
        conds.append("l.action LIKE ?")
        vals.append(f"%{action}%")
    total = db.row("SELECT COUNT(*) c FROM audit_log l WHERE " + " AND ".join(conds), tuple(vals))["c"]
    items = db.rows(
        "SELECT l.*, u.name actor_name FROM audit_log l LEFT JOIN users u ON u.id=l.actor_id"
        " WHERE " + " AND ".join(conds) + " ORDER BY l.id DESC LIMIT ? OFFSET ?",
        tuple(vals + [max(1, min(200, limit)), max(0, (max(1, page) - 1) * max(1, limit))]),
    )
    return {"logs": items, "total": total, "page": page, "limit": limit}


@app.get("/api/bootstrap")
def bootstrap(user: dict = Depends(me)):
    projects = list_projects(user)["projects"]
    tasks = list_tasks("", 0, "", 0, 1, 0, user)["tasks"]
    data = {r["key"]: r["value"] for r in db.rows("SELECT key,value FROM settings")}
    return {
        "user": {**user, "role_label": auth.PLATFORM_ROLES.get(user["platform_role"], "")},
        "permissions": [p for p in db.PERMISSIONS if auth.has_perm(user, p)],
        "projects": projects,
        "tasks": tasks,
        "engines": prelabel.engine_status(),
        "settings": data,
        "notifications": {
            "unread": db.row(
                "SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL", (user["id"],)
            )["c"],
            "recent": db.rows(
                "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 8", (user["id"],)
            ),
        },
        "brand": {
            "name": data.get("brand_name", "春科数据标注平台"),
            "short": data.get("brand_short", "春科标注"),
            "color": data.get("brand_color", "#3B82F6"),
            "watermark": data.get("watermark", "on") == "on",
        },
        "preferences": db.pref_get(user["id"]),
        "counts": {
            "tasks": len(tasks),
            "pending": sum(1 for t in tasks if t["status"] == "pending"),
            "review": sum(1 for t in tasks if t["status"] in ("submitted", "review")),
            "done": sum(1 for t in tasks if t["status"] == "done"),
            "datasets": (db.row("SELECT COUNT(*) c FROM datasets") or {}).get("c", 0),
            "templates": (db.row("SELECT COUNT(*) c FROM templates") or {}).get("c", 0),
            "workflows": (db.row("SELECT COUNT(*) c FROM workflows") or {}).get("c", 0),
            "api_keys": (db.row("SELECT COUNT(*) c FROM api_keys WHERE status='active'") or {}).get("c", 0),
            "orgs": (db.row("SELECT COUNT(*) c FROM orgs") or {}).get("c", 0),
            "teams": (db.row("SELECT COUNT(*) c FROM teams") or {}).get("c", 0),
        },
    }
