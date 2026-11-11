"""补充能力：计划管理、我的待办、数据检索、多格式导出、远程导入、
自定义角色、分层/风险抽审、TC609 留痕包、租户切换与任务级授权。"""
from __future__ import annotations

import csv
import ftplib
import io
import json
import os
import random
import shutil
import subprocess
import uuid
import urllib.parse
import urllib.request
import zipfile
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from . import auth, db, workbench

router = APIRouter()


def me(request: Request) -> dict:
    return auth.current_user(request)


def _json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _project(pid: int) -> dict:
    p = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "项目不存在")
    return p


def _assert_project(user: dict, pid: int, write: bool = False) -> dict:
    p = _project(pid)
    if auth.is_admin(user):
        return p
    if pid not in auth.visible_project_ids(user):
        raise HTTPException(403, "无权访问该项目")
    if write and auth.project_role(user, pid) != "manager":
        raise HTTPException(403, "仅项目管理者可执行该操作")
    return p


def _task(tid: int, user: dict) -> dict:
    task = db.row("SELECT * FROM tasks WHERE id=?", (tid,))
    if not task or task.get("deleted"):
        raise HTTPException(404, "任务不存在")
    _assert_project(user, task["project_id"])
    return task


def _page(rows: list, page: int, limit: int) -> dict:
    page = max(1, int(page or 1))
    limit = max(1, min(200, int(limit or 20)))
    start = (page - 1) * limit
    return {"items": rows[start:start + limit], "total": len(rows), "page": page, "limit": limit}


# ---------------------------------------------------------------------------
# 幂等建表 / 补列
# ---------------------------------------------------------------------------

def init_schema() -> None:
    ts = db.now()
    with db.connect() as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS custom_roles("
            "id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE NOT NULL,"
            "description TEXT NOT NULL DEFAULT '',permissions TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS sampling_policies("
            "id INTEGER PRIMARY KEY AUTOINCREMENT,project_id INTEGER NOT NULL UNIQUE,"
            "mode TEXT NOT NULL DEFAULT 'layered',config TEXT NOT NULL DEFAULT '{}',updated_at TEXT NOT NULL)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS task_roles("
            "task_id INTEGER NOT NULL,user_id INTEGER NOT NULL,role TEXT NOT NULL,"
            "created_at TEXT NOT NULL,PRIMARY KEY(task_id,user_id,role))"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS evidence_packages("
            "id INTEGER PRIMARY KEY AUTOINCREMENT,task_id INTEGER,project_id INTEGER,"
            "actor_id INTEGER,path TEXT NOT NULL,created_at TEXT NOT NULL)"
        )
        cols = [
            ("projects", "start_at", "TEXT NOT NULL DEFAULT ''"),
            ("projects", "end_at", "TEXT NOT NULL DEFAULT ''"),
            ("projects", "milestones", "TEXT NOT NULL DEFAULT '[]'"),
            ("projects", "progress", "INTEGER NOT NULL DEFAULT 0"),
            ("tasks", "start_at", "TEXT NOT NULL DEFAULT ''"),
            ("tasks", "end_at", "TEXT NOT NULL DEFAULT ''"),
            ("tasks", "dataset_version", "INTEGER NOT NULL DEFAULT 0"),
            ("tasks", "template_version", "INTEGER NOT NULL DEFAULT 0"),
            ("datasets", "archived", "INTEGER NOT NULL DEFAULT 0"),
            ("datasets", "archived_at", "TEXT"),
            ("datasets", "deleted", "INTEGER NOT NULL DEFAULT 0"),
            ("users", "custom_role_id", "INTEGER"),
        ]
        for table, col, ddl in cols:
            db._ensure_column(conn, table, col, ddl)
        conn.execute("CREATE INDEX IF NOT EXISTS ix_taskroles_user ON task_roles(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS ix_project_plan ON projects(start_at,end_at)")
        conn.commit()
    if not db.row("SELECT id FROM custom_roles LIMIT 1"):
        for name, desc in (("验收专员", "负责交付验收与抽检复核"), ("数据工程师", "负责导入、预处理与导出")):
            db.execute(
                "INSERT OR IGNORE INTO custom_roles(name,description,permissions,created_at) VALUES(?,?,?,?)",
                (name, desc, json.dumps(["task.read", "dataset.read", "task.review"], ensure_ascii=False), ts),
            )


def task_can_edit(user: dict, task: dict) -> bool:
    """任务级授权：标注员/质检/验收等角色按任务单独授权。"""
    if user["platform_role"] in ("platform_admin", "project_manager"):
        return True
    if task.get("assignee_id") == user["id"]:
        return True
    if auth.project_role(user, task["project_id"]) == "manager":
        return True
    hit = db.row(
        "SELECT 1 ok FROM task_roles WHERE task_id=? AND user_id=? AND role IN ('annotator','acceptor')",
        (task["id"], user["id"]),
    )
    return bool(hit)


def sampling_decision(task: dict, policy: dict) -> tuple[bool, int, str]:
    """按抽审策略决定是否进入人工质检：基础比例 + 分层 + 风险加权。"""
    sp = db.row("SELECT * FROM sampling_policies WHERE project_id=?", (task["project_id"],))
    rate = max(0, min(100, int(policy.get("sample_rate", 100))))
    reason = f"基础抽审 {rate}%"
    if sp:
        cfg = _json(sp["config"], {})
        rate = max(0, min(100, int(cfg.get("sample_rate", rate))))
        reason = f"策略抽审 {rate}%"
        for layer in cfg.get("layers") or []:
            field = layer.get("field")
            value = str(layer.get("value") or "")
            actual = str(task.get(field) or "")
            if value and actual == value:
                rate = max(rate, min(100, int(layer.get("rate", rate))))
                reason = f"{field}={value} 分层抽审 {rate}%"
        risk = cfg.get("risk") or {}
        if risk:
            last = db.row(
                "SELECT score FROM qc_records WHERE task_id=? ORDER BY id DESC LIMIT 1", (task["id"],)
            )
            low = float(risk.get("low_score", 80) or 80)
            if risk.get("rework") and int(task.get("rework_count") or 0) > 0:
                rate = max(rate, min(100, int(risk.get("rate", 100))))
                reason = f"返修任务风险抽审 {rate}%"
            elif last and float(last["score"] or 0) < low:
                rate = max(rate, min(100, int(risk.get("rate", 100))))
                reason = f"历史低分风险抽审 {rate}%"
    return random.randint(1, 100) <= rate, rate, reason


# ---------------------------------------------------------------------------
# 项目 / 任务计划
# ---------------------------------------------------------------------------

@router.get("/api/projects/{pid}/plan")
def project_plan(pid: int, user: dict = Depends(me)):
    p = _assert_project(user, pid)
    milestones = _json(p.get("milestones"), [])
    stats = db.rows(
        "SELECT status,COUNT(*) c FROM tasks WHERE project_id=? AND deleted=0 GROUP BY status", (pid,)
    )
    counts = {r["status"]: r["c"] for r in stats}
    total = sum(counts.values())
    done = counts.get("done", 0)
    return {
        "project": p, "milestones": milestones, "counts": counts, "total": total,
        "progress": round(done * 100 / total) if total else int(p.get("progress") or 0),
        "owner_name": (db.row("SELECT name FROM users WHERE id=?", (p["owner_id"],)) or {}).get("name", ""),
    }


@router.patch("/api/projects/{pid}/plan")
def save_project_plan(pid: int, body: dict, user: dict = Depends(me)):
    _assert_project(user, pid, write=True)
    milestones = body.get("milestones")
    if milestones is not None and not isinstance(milestones, list):
        raise HTTPException(400, "milestones 必须是数组")
    owner = body.get("owner_id")
    if owner is not None and owner and not db.row("SELECT id FROM users WHERE id=?", (int(owner),)):
        raise HTTPException(400, "负责人不存在")
    db.execute(
        "UPDATE projects SET owner_id=?, status=?, start_at=?, end_at=?, milestones=? WHERE id=?",
        (
            int(owner) if owner else None,
            body.get("status") or "active",
            (body.get("start_at") or "").strip(),
            (body.get("end_at") or "").strip(),
            json.dumps(milestones if milestones is not None else _json(_project(pid).get("milestones"), []), ensure_ascii=False),
            pid,
        ),
    )
    db.log(user["id"], "project_plan", f"project:{pid}", "更新项目计划")
    return {"ok": True}


@router.patch("/api/tasks/{tid}/plan")
def save_task_plan(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    _assert_project(user, task["project_id"], write=True)
    db.execute(
        "UPDATE tasks SET start_at=?, end_at=?, dataset_version=?, template_version=?, priority=?, updated_at=? WHERE id=?",
        (
            (body.get("start_at") or "").strip(),
            (body.get("end_at") or "").strip(),
            int(body.get("dataset_version") or 0),
            int(body.get("template_version") or 0),
            body.get("priority") or task["priority"],
            db.now(), tid,
        ),
    )
    db.log(user["id"], "task_plan", f"task:{tid}", "更新任务计划")
    return {"ok": True}


@router.get("/api/tasks/{tid}/plan")
def task_plan(tid: int, user: dict = Depends(me)):
    return {"task": _task(tid, user)}


@router.get("/api/tasks/{tid}/roles")
def task_roles(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    rows = db.rows(
        "SELECT tr.role,tr.user_id,u.name,u.username FROM task_roles tr JOIN users u ON u.id=tr.user_id"
        " WHERE tr.task_id=? ORDER BY tr.role", (tid,)
    )
    return {"roles": rows}


@router.post("/api/tasks/{tid}/roles")
def grant_task_role(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    _assert_project(user, task["project_id"], write=True)
    role = body.get("role") or ""
    if role not in ("annotator", "reviewer", "acceptor"):
        raise HTTPException(400, "角色仅支持 annotator/reviewer/acceptor")
    uid = int(body.get("user_id") or 0)
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(404, "成员不存在")
    db.execute(
        "INSERT OR IGNORE INTO task_roles(task_id,user_id,role,created_at) VALUES(?,?,?,?)",
        (tid, uid, role, db.now()),
    )
    db.notify(uid, f"任务 #{tid} 授权", f"你被授予 {role} 角色", "system", f"#/annotate/{tid}")
    db.log(user["id"], "grant_task_role", f"task:{tid}", f"user:{uid} -> {role}")
    return {"ok": True}


@router.delete("/api/tasks/{tid}/roles")
def revoke_task_role(tid: int, user_id: int, role: str = "", user: dict = Depends(me)):
    task = _task(tid, user)
    _assert_project(user, task["project_id"], write=True)
    if role:
        db.execute("DELETE FROM task_roles WHERE task_id=? AND user_id=? AND role=?", (tid, user_id, role))
    else:
        db.execute("DELETE FROM task_roles WHERE task_id=? AND user_id=?", (tid, user_id))
    return {"ok": True}


# ---------------------------------------------------------------------------
# 我的待办
# ---------------------------------------------------------------------------

@router.get("/api/my/todo")
def my_todo(user: dict = Depends(me)):
    role = user["platform_role"]
    mine = auth.visible_project_ids(user)
    if not mine:
        return {"counts": {}, "groups": []}
    marks = ",".join("?" * len(mine))
    args = tuple(mine) + (user["id"],)
    annotating = db.rows(
        f"SELECT t.*,p.name project_name FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE t.project_id IN ({marks}) AND t.deleted=0 AND t.assignee_id=? AND t.status IN ('pending','annotating','rework')"
        f" ORDER BY t.updated_at DESC LIMIT 20", args
    )
    reviewing = db.rows(
        f"SELECT t.*,p.name project_name FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE t.project_id IN ({marks}) AND t.deleted=0 AND (t.reviewer_id=? OR ?='platform_admin' OR ?='project_manager')"
        f" AND t.status IN ('submitted','review') ORDER BY t.updated_at DESC LIMIT 20",
        tuple(mine) + (user["id"], role, role),
    )
    overdue = db.rows(
        f"SELECT t.*,p.name project_name FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE t.project_id IN ({marks}) AND t.deleted=0 AND t.end_at<>'' AND t.end_at<? AND t.status<>'done'"
        f" ORDER BY t.end_at LIMIT 20", tuple(mine) + (db.now(),)
    ) if mine else []
    groups = [
        {"key": "annotating", "label": "待我标注", "items": annotating},
        {"key": "reviewing", "label": "待我质检", "items": reviewing},
        {"key": "overdue", "label": "已超期", "items": overdue},
    ]
    counts = {g["key"]: len(g["items"]) for g in groups}
    return {"counts": counts, "groups": groups}


# ---------------------------------------------------------------------------
# 数据检索与预览
# ---------------------------------------------------------------------------

@router.get("/api/datasets/{ds_id}/items")
def dataset_items(ds_id: int, q: str = "", media_type: str = "", status: str = "",
                  page: int = 1, limit: int = 20, user: dict = Depends(me)):
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"]:
        _assert_project(user, ds["project_id"])
    rows = db.rows(
        "SELECT i.*,t.status task_status,t.assignee_id,t.reviewer_id,"
        " (SELECT COUNT(*) FROM annotations a WHERE a.task_id=i.task_id) ann_count"
        " FROM dataset_items i LEFT JOIN tasks t ON t.id=i.task_id"
        " WHERE i.dataset_id=? ORDER BY i.id DESC", (ds_id,)
    )
    if q:
        kw = q.lower()
        rows = [r for r in rows if kw in (r["name"] or "").lower() or kw in (r["media_path"] or "").lower()]
    if media_type:
        rows = [r for r in rows if r["media_type"] == media_type]
    if status:
        rows = [r for r in rows if (r.get("task_status") or "") == status]
    data = _page(rows, page, limit)
    data["rows"] = data.pop("items")
    return data


@router.get("/api/datasets/items/{item_id}")
def dataset_item_detail(item_id: int, user: dict = Depends(me)):
    item = db.row("SELECT * FROM dataset_items WHERE id=?", (item_id,))
    if not item:
        raise HTTPException(404, "数据条目不存在")
    ds = db.row("SELECT * FROM datasets WHERE id=?", (item["dataset_id"],))
    if ds and ds["project_id"]:
        _assert_project(user, ds["project_id"])
    ann = db.row(
        "SELECT payload,status,updated_at FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1",
        (item["task_id"],),
    ) if item["task_id"] else None
    return {
        "item": item, "meta": _json(item["meta"], {}),
        "preview_url": f"/media/{urllib.parse.quote(os.path.basename(item['media_path']))}" if item["media_path"] else "",
        "annotation": _json(ann["payload"], {}) if ann else {},
        "annotation_status": ann["status"] if ann else "",
    }


# ---------------------------------------------------------------------------
# 多格式导出（JSON/JSONL/CSV/COCO/VOC/LabelMe）
# ---------------------------------------------------------------------------

def _export_rows(ds: dict) -> list[dict]:
    ver = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds["id"],))
    items = db.rows("SELECT * FROM dataset_items WHERE dataset_id=? AND version_id=?",
                    (ds["id"], ver["id"])) if ver else []
    out = []
    for it in items:
        ann = db.row("SELECT payload FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1",
                     (it["task_id"],)) if it["task_id"] else None
        task = db.row("SELECT status FROM tasks WHERE id=?", (it["task_id"],)) if it["task_id"] else None
        out.append({
            "id": it["id"], "name": it["name"], "media": it["media_path"],
            "media_type": it["media_type"], "size": it["size"], "meta": _json(it["meta"], {}),
            "task_status": task["status"] if task else "",
            "annotation": _json(ann["payload"], {}) if ann else {},
        })
    return out


def _zip_write(zf: zipfile.ZipFile, name: str, data: str) -> None:
    zf.writestr(name, data.encode("utf-8"))


def _write_export(rows: list[dict], fmt: str, name: str) -> str:
    safe = "".join(c for c in name if c.isalnum() or c in "-_") or "dataset"
    if fmt == "jsonl":
        path = os.path.join(db.TMP_DIR, f"export-{safe}-{uuid.uuid4().hex[:6]}.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        return path
    if fmt == "json":
        path = os.path.join(db.TMP_DIR, f"export-{safe}-{uuid.uuid4().hex[:6]}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        return path
    if fmt == "csv":
        path = os.path.join(db.TMP_DIR, f"export-{safe}-{uuid.uuid4().hex[:6]}.csv")
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(["id", "name", "media", "media_type", "size", "task_status", "annotation"])
            for r in rows:
                w.writerow([r["id"], r["name"], r["media"], r["media_type"], r["size"],
                            r["task_status"], json.dumps(r["annotation"], ensure_ascii=False)])
        return path
    path = os.path.join(db.TMP_DIR, f"export-{safe}-{fmt}-{uuid.uuid4().hex[:6]}.zip")
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        if fmt == "coco":
            images, anns, cid = [], [], 0
            for r in rows:
                if r["media_type"] != "image":
                    continue
                w = int(r["meta"].get("width") or 1000)
                h = int(r["meta"].get("height") or 1000)
                images.append({"id": r["id"], "file_name": os.path.basename(r["media"]),
                               "width": w, "height": h})
                for i, b in enumerate(r["annotation"].get("boxes") or []):
                    cid += 1
                    anns.append({
                        "id": cid, "image_id": r["id"],
                        "category_id": (r["annotation"].get("classes") or ["object"]).index(b.get("cls"))
                        + 1 if b.get("cls") in (r["annotation"].get("classes") or []) else 1,
                        "bbox": [round(float(b.get("x", 0)) * w, 2), round(float(b.get("y", 0)) * h, 2),
                                 round(float(b.get("w", 0)) * w, 2), round(float(b.get("h", 0)) * h, 2)],
                        "area": round(float(b.get("w", 0)) * float(b.get("h", 0)) * w * h, 2),
                        "iscrowd": 0,
                    })
            cats = sorted({a["category_id"] for a in anns}) or [1]
            _zip_write(zf, "annotations/instances.json", json.dumps(
                {"images": images, "annotations": anns, "categories": [{"id": c, "name": f"class_{c}"} for c in cats]},
                ensure_ascii=False, indent=2))
        elif fmt == "voc":
            for r in rows:
                if r["media_type"] != "image":
                    continue
                w = int(r["meta"].get("width") or 1000)
                h = int(r["meta"].get("height") or 1000)
                objs = "".join(
                    f"<object><name>{b.get('cls') or 'object'}</name><difficult>0</difficult><bndbox>"
                    f"<xmin>{round(float(b.get('x', 0)) * w)}</xmin><ymin>{round(float(b.get('y', 0)) * h)}</ymin>"
                    f"<xmax>{round((float(b.get('x', 0)) + float(b.get('w', 0))) * w)}</xmax>"
                    f"<ymax>{round((float(b.get('y', 0)) + float(b.get('h', 0))) * h)}</ymax></bndbox></object>"
                    for b in r["annotation"].get("boxes") or []
                )
                xml = (f"<annotation><filename>{os.path.basename(r['media'])}</filename>"
                       f"<size><width>{w}</width><height>{h}</height><depth>3</depth></size>{objs}</annotation>")
                _zip_write(zf, f"Annotations/{os.path.splitext(os.path.basename(r['name']))[0]}.xml", xml)
        elif fmt == "labelme":
            for r in rows:
                if r["media_type"] != "image":
                    continue
                shapes = [{
                    "label": b.get("cls") or "object", "shape_type": "rectangle",
                    "points": [[float(b.get("x", 0)), float(b.get("y", 0))],
                               [float(b.get("x", 0)) + float(b.get("w", 0)),
                                float(b.get("y", 0)) + float(b.get("h", 0))]],
                } for b in r["annotation"].get("boxes") or []]
                _zip_write(zf, f"labelme/{os.path.splitext(os.path.basename(r['name']))[0]}.json",
                           json.dumps({
                               "version": "5.0", "imagePath": os.path.basename(r["media"]),
                               "imageData": None, "shapes": shapes,
                               "imageWidth": int(r["meta"].get("width") or 1000),
                               "imageHeight": int(r["meta"].get("height") or 1000),
                           }, ensure_ascii=False, indent=2))
        else:
            raise HTTPException(400, "不支持的导出格式")
        _zip_write(zf, "README.txt", f"春科数据标注平台导出 · 格式 {fmt} · 条目 {len(rows)}")
    return path


@router.post("/api/datasets/{ds_id}/export")
def dataset_export(ds_id: int, body: dict, user: dict = Depends(me)):
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    fmt = (body.get("format") or "jsonl").lower()
    if fmt not in ("jsonl", "json", "csv", "coco", "voc", "labelme"):
        raise HTTPException(400, "格式仅支持 jsonl/json/csv/coco/voc/labelme")
    jid = workbench._start_job(
        "dataset_export", f"导出 {ds['name']}（{fmt}）", user,
        {"format": fmt}, dataset_id=ds_id,
    )
    return {"ok": True, "job_id": jid}


# ---------------------------------------------------------------------------
# 多渠道导入：HTTP / FTP / HDFS / S3(预签名)
# ---------------------------------------------------------------------------

def _download(url: str, dest: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "chunke-label/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 用户配置的可信地址
        with open(dest, "wb") as f:
            shutil.copyfileobj(resp, f)
    return dest


def _fetch_ftp(url: str, workdir: str, report) -> list[str]:
    parsed = urllib.parse.urlparse(url)
    host = parsed.hostname or ""
    if not host:
        raise RuntimeError("FTP 地址缺少主机名")
    user = urllib.parse.unquote(parsed.username or "anonymous")
    pwd = urllib.parse.unquote(parsed.password or "")
    remote = parsed.path or "/"
    out: list[str] = []
    ftp = ftplib.FTP(host, timeout=30)
    ftp.login(user, pwd)
    try:
        try:
            entries = list(ftp.mlsd(remote))
            files = [os.path.join(remote, n) for n, meta in entries if meta.get("type") == "file"]
        except (ftplib.error_perm, AttributeError):
            files = [os.path.join(remote, n) for n in ftp.nlst(remote) if "." in os.path.basename(n)]
        for idx, path in enumerate(files):
            dest = os.path.join(workdir, os.path.basename(path))
            with open(dest, "wb") as f:
                ftp.retrbinary(f"RETR {path}", f.write)
            out.append(dest)
            report(20 + int(60 * (idx + 1) / max(1, len(files))), f"FTP 已下载 {os.path.basename(path)}")
    finally:
        try:
            ftp.quit()
        except Exception:  # noqa: BLE001 连接关闭异常可忽略
            pass
    return out


def _fetch_hdfs(remote: str, workdir: str) -> list[str]:
    if not shutil.which("hdfs"):
        raise RuntimeError("当前环境未安装 hdfs 客户端")
    proc = subprocess.run(["hdfs", "dfs", "-get", remote, workdir],
                          capture_output=True, text=True, timeout=600)
    if proc.returncode != 0:
        raise RuntimeError(f"HDFS 拉取失败：{proc.stderr[:300]}")
    return [os.path.join(workdir, n) for n in os.listdir(workdir)]


def _fetch_s3(uri: str, workdir: str) -> list[str]:
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise RuntimeError("未安装 boto3，无法直连 S3；可改用预签名 URL 导入") from exc
    if not uri.startswith("s3://"):
        raise RuntimeError("S3 地址需形如 s3://bucket/prefix")
    _, rest = uri.split("s3://", 1)
    bucket, _, prefix = rest.partition("/")
    client = boto3.client("s3")
    out = []
    for obj in client.list_objects_v2(Bucket=bucket, Prefix=prefix).get("Contents", []):
        key = obj["Key"]
        if key.endswith("/"):
            continue
        dest = os.path.join(workdir, os.path.basename(key))
        client.download_file(bucket, key, dest)
        out.append(dest)
    return out


@workbench.job_handler("import_source")
def _job_import_source(j: dict, report) -> dict:
    payload = _json(j["payload"], {})
    kind = payload.get("type") or "http"
    actor = db.row("SELECT * FROM users WHERE id=?", (j["user_id"],)) or {"id": j["user_id"]}
    project = workbench._project(int(payload.get("project_id") or 0))
    batch = payload.get("batch") or f"{kind} 导入"
    ds_id = int(payload.get("dataset_id") or 0)
    workdir = os.path.join(db.TMP_DIR, f"import-{uuid.uuid4().hex[:8]}")
    os.makedirs(workdir, exist_ok=True)
    report(10, f"{kind} 拉取中")
    if kind == "ftp":
        local = _fetch_ftp(payload.get("path") or "", workdir, report)
    elif kind == "hdfs":
        local = _fetch_hdfs(payload.get("path") or "", workdir)
    elif kind == "s3":
        local = _fetch_s3(payload.get("path") or "", workdir)
    else:
        urls = payload.get("urls") or ([payload.get("path")] if payload.get("path") else [])
        local = []
        for idx, url in enumerate(urls):
            name = os.path.basename(urllib.parse.urlparse(url).path) or f"file-{idx}"
            local.append(_download(url, os.path.join(workdir, name)))
            report(10 + int(40 * (idx + 1) / max(1, len(urls))), f"已下载 {name}")
    tasks, failed, items = [], [], []
    for idx, path in enumerate(local):
        try:
            ext = os.path.splitext(path)[1].lower()
            kind_media = workbench._media_kind(ext)
            media = f"{uuid.uuid4().hex[:10]}{ext}"
            shutil.copy2(path, os.path.join(db.MEDIA_DIR, media))
            tid = workbench._create_task(project, os.path.basename(path), media, kind_media, batch, actor, kind)
            tasks.append(tid)
            items.append({
                "name": os.path.basename(path), "media_path": media, "media_type": kind_media,
                "size": os.path.getsize(path), "task_id": tid, "meta": {"source": kind},
            })
        except Exception as exc:  # noqa: BLE001 单文件失败不影响整体
            failed.append({"file": os.path.basename(path), "error": str(exc)})
        report(50 + int(45 * (idx + 1) / max(1, len(local))), f"已创建 {len(tasks)} 个任务")
    if ds_id and items:
        ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
        if ds:
            workbench._append_dataset_version(ds_id, items, f"{kind} 导入 {len(items)} 条", actor)
    shutil.rmtree(workdir, ignore_errors=True)
    return {"tasks": tasks, "created": len(tasks), "failed": failed, "source": kind}


@router.post("/api/import/source")
def import_source(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    _assert_project(user, pid, write=True)
    kind = (body.get("type") or "http").lower()
    if kind not in ("http", "ftp", "hdfs", "s3"):
        raise HTTPException(400, "导入类型仅支持 http/ftp/hdfs/s3")
    ref = body.get("path") or body.get("url")
    if not ref and not body.get("urls"):
        raise HTTPException(400, "请填写导入地址")
    payload = {
        "type": kind, "project_id": pid, "batch": body.get("batch") or f"{kind} 导入",
        "dataset_id": int(body.get("dataset_id") or 0),
        "path": ref or "", "urls": body.get("urls") or [],
    }
    jid = workbench._start_job("import_source", f"{kind} 导入 {os.path.basename(str(ref))[:30]}", user, payload)
    return {"ok": True, "job_id": jid}


# ---------------------------------------------------------------------------
# 数据集生命周期（归档 / 回收站 / 恢复）
# ---------------------------------------------------------------------------

@router.post("/api/datasets/{ds_id}/archive")
def archive_dataset(ds_id: int, user: dict = Depends(me)):
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"]:
        _assert_project(user, ds["project_id"], write=True)
    else:
        auth.require_perm(user, "dataset.write")
    db.execute("UPDATE datasets SET archived=1, archived_at=? WHERE id=?", (db.now(), ds_id))
    db.log(user["id"], "archive_dataset", f"dataset:{ds_id}", "归档数据集")
    return {"ok": True}


@router.post("/api/datasets/{ds_id}/restore")
def restore_dataset(ds_id: int, user: dict = Depends(me)):
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"]:
        _assert_project(user, ds["project_id"], write=True)
    else:
        auth.require_perm(user, "dataset.write")
    db.execute("UPDATE datasets SET archived=0, deleted=0, archived_at=NULL WHERE id=?", (ds_id,))
    db.log(user["id"], "restore_dataset", f"dataset:{ds_id}", "恢复数据集")
    return {"ok": True}


@router.delete("/api/datasets/{ds_id}")
def delete_dataset(ds_id: int, user: dict = Depends(me)):
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"]:
        _assert_project(user, ds["project_id"], write=True)
    else:
        auth.require_perm(user, "dataset.write")
    refs = (db.row("SELECT COUNT(*) c FROM tasks WHERE dataset_id=? AND deleted=0", (ds_id,)) or {}).get("c", 0)
    if refs:
        raise HTTPException(400, f"仍有 {refs} 个任务引用该数据集，请先归档或解除引用")
    db.execute("UPDATE datasets SET deleted=1 WHERE id=?", (ds_id,))
    db.log(user["id"], "delete_dataset", f"dataset:{ds_id}", "软删除数据集")
    return {"ok": True}


@router.get("/api/dataset-trash")
def dataset_trash(user: dict = Depends(me)):
    rows = db.rows("SELECT * FROM datasets WHERE deleted=1 OR archived=1 ORDER BY id DESC")
    if not auth.is_admin(user):
        ids = set(auth.visible_project_ids(user))
        rows = [r for r in rows if not r["project_id"] or r["project_id"] in ids]
    return {"datasets": rows}


# ---------------------------------------------------------------------------
# 自定义角色（RBAC 扩展）
# ---------------------------------------------------------------------------

@router.get("/api/roles")
def list_roles(user: dict = Depends(me)):
    auth.require_perm(user, "org.read")
    rows = db.rows("SELECT * FROM custom_roles ORDER BY id")
    for r in rows:
        r["permissions"] = _json(r["permissions"], [])
        r["member_count"] = (db.row("SELECT COUNT(*) c FROM users WHERE custom_role_id=?", (r["id"],)) or {}).get("c", 0)
    return {"roles": rows, "permissions": [{"key": k, "label": v} for k, v in db.PERMISSIONS.items()]}


@router.post("/api/roles")
def create_role(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "角色名称不能为空")
    if db.row("SELECT id FROM custom_roles WHERE name=?", (name,)):
        raise HTTPException(400, "角色名称已存在")
    perms = [p for p in (body.get("permissions") or []) if p in db.PERMISSIONS]
    rid = db.execute(
        "INSERT INTO custom_roles(name,description,permissions,created_at) VALUES(?,?,?,?)",
        (name, body.get("description") or "", json.dumps(perms, ensure_ascii=False), db.now()),
    )
    db.log(user["id"], "create_role", f"role:{rid}", name)
    return {"ok": True, "id": rid}


@router.patch("/api/roles/{rid}")
def update_role(rid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    role = db.row("SELECT * FROM custom_roles WHERE id=?", (rid,))
    if not role:
        raise HTTPException(404, "角色不存在")
    perms = [p for p in (body.get("permissions") or _json(role["permissions"], [])) if p in db.PERMISSIONS]
    db.execute(
        "UPDATE custom_roles SET name=?, description=?, permissions=? WHERE id=?",
        (body.get("name") or role["name"], body.get("description", role["description"]),
         json.dumps(perms, ensure_ascii=False), rid),
    )
    db.log(user["id"], "update_role", f"role:{rid}", "更新自定义角色")
    return {"ok": True}


@router.delete("/api/roles/{rid}")
def delete_role(rid: int, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    if not db.row("SELECT id FROM custom_roles WHERE id=?", (rid,)):
        raise HTTPException(404, "角色不存在")
    db.execute("UPDATE users SET custom_role_id=NULL WHERE custom_role_id=?", (rid,))
    db.execute("DELETE FROM custom_roles WHERE id=?", (rid,))
    db.log(user["id"], "delete_role", f"role:{rid}", "删除自定义角色")
    return {"ok": True}


@router.post("/api/roles/{rid}/assign")
def assign_role(rid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    if not db.row("SELECT id FROM custom_roles WHERE id=?", (rid,)):
        raise HTTPException(404, "角色不存在")
    uid = int(body.get("user_id") or 0)
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(404, "成员不存在")
    db.execute("UPDATE users SET custom_role_id=? WHERE id=?", (rid if body.get("assign", True) else None, uid))
    db.log(user["id"], "assign_role", f"user:{uid}", f"role:{rid}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 分层 / 风险抽审策略
# ---------------------------------------------------------------------------

@router.get("/api/sampling/policies")
def sampling_policies(user: dict = Depends(me)):
    rows = db.rows("SELECT * FROM sampling_policies ORDER BY project_id")
    for r in rows:
        r["config"] = _json(r["config"], {})
        r["project_name"] = (_project(r["project_id"]) or {}).get("name", "")
    return {"policies": rows}


@router.post("/api/sampling/policies")
def save_sampling_policy(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    _assert_project(user, pid, write=True)
    cfg = body.get("config") or {}
    if not isinstance(cfg, dict):
        raise HTTPException(400, "config 必须是对象")
    db.execute(
        "INSERT INTO sampling_policies(project_id,mode,config,updated_at) VALUES(?,?,?,?)"
        " ON CONFLICT(project_id) DO UPDATE SET mode=excluded.mode,config=excluded.config,updated_at=excluded.updated_at",
        (pid, body.get("mode") or "layered", json.dumps(cfg, ensure_ascii=False), db.now()),
    )
    db.log(user["id"], "save_sampling", f"project:{pid}", "保存抽审策略")
    return {"ok": True}


@router.get("/api/sampling/preview")
def sampling_preview(project_id: int, user: dict = Depends(me)):
    _assert_project(user, project_id)
    sp = db.row("SELECT * FROM sampling_policies WHERE project_id=?", (project_id,))
    cfg = _json(sp["config"], {}) if sp else {"sample_rate": 100}
    tasks = db.rows("SELECT id,name,batch,rework_count,assignee_id FROM tasks WHERE project_id=? AND deleted=0 LIMIT 100",
                    (project_id,))
    out = []
    for t in tasks:
        rate = int(cfg.get("sample_rate", 100))
        layer_hit = ""
        for layer in cfg.get("layers") or []:
            if str(t.get(layer.get("field")) or "") == str(layer.get("value") or ""):
                rate = max(rate, int(layer.get("rate", rate)))
                layer_hit = f"{layer.get('field')}={layer.get('value')}"
        risk_flag = bool((cfg.get("risk") or {}).get("rework") and int(t.get("rework_count") or 0) > 0)
        if risk_flag:
            rate = max(rate, int((cfg.get("risk") or {}).get("rate", 100)))
        out.append({**t, "rate": min(100, rate), "layer": layer_hit, "risk": risk_flag})
    return {"policy": cfg, "tasks": out}


# ---------------------------------------------------------------------------
# TC609 留痕包
# ---------------------------------------------------------------------------

def _task_evidence(task: dict) -> dict:
    tid = task["id"]
    project = db.row("SELECT * FROM projects WHERE id=?", (task["project_id"],))
    anns = db.rows(
        "SELECT id,user_id,status,version,created_at,updated_at FROM annotations WHERE task_id=? ORDER BY id", (tid,)
    )
    qcs = db.rows("SELECT * FROM qc_records WHERE task_id=? ORDER BY id", (tid,))
    events = db.rows(
        "SELECT action,target,detail,created_at FROM audit_log WHERE target=? OR detail LIKE ? ORDER BY id DESC LIMIT 200",
        (f"task:{tid}", f"%task:{tid}%"),
    )
    tpl_ver = (db.row(
        "SELECT * FROM template_versions WHERE template_id=? ORDER BY version DESC LIMIT 1",
        (project["template_id"],)) if project and project.get("template_id") else None)
    scores = [float(q["score"] or 0) for q in qcs]
    return {
        "standard": "TC609 数据标注过程留痕",
        "generated_at": db.now(),
        "project": {"code": project["code"], "name": project["name"], "modality": project["modality"]} if project else {},
        "task": {k: task.get(k) for k in ("id", "name", "media_path", "media_type", "status", "batch",
                                          "assignee_id", "reviewer_id", "created_at", "updated_at")},
        "template_version": tpl_ver,
        "annotation_versions": anns,
        "qc_records": qcs,
        "quality_metrics": {
            "qc_rounds": len(qcs),
            "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "rework_count": int(task.get("rework_count") or 0),
            "passed": bool(qcs and qcs[-1]["result"] in ("approved", "auto_approved")),
        },
        "events": events,
    }


@router.get("/api/tasks/{tid}/evidence")
def task_evidence(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    return _task_evidence(task)


@router.get("/api/projects/{pid}/evidence.zip")
def project_evidence(pid: int, user: dict = Depends(me)):
    project = _assert_project(user, pid)
    tasks = db.rows("SELECT * FROM tasks WHERE project_id=? AND deleted=0 ORDER BY id", (pid,))
    buf = io.BytesIO()
    all_scores = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for t in tasks:
            ev = _task_evidence(t)
            all_scores.extend(q["score"] for q in ev["qc_records"])
            zf.writestr(f"tasks/task-{t['id']}.json", json.dumps(ev, ensure_ascii=False, indent=2))
        summary = {
            "standard": "TC609", "project": project["code"], "generated_at": db.now(),
            "task_count": len(tasks),
            "avg_score": round(sum(all_scores) / len(all_scores), 2) if all_scores else 0,
            "done": sum(1 for t in tasks if t["status"] == "done"),
        }
        zf.writestr("summary.json", json.dumps(summary, ensure_ascii=False, indent=2))
    db.log(user["id"], "export_evidence", f"project:{pid}", f"TC609 留痕包 {len(tasks)} 个任务")
    return Response(
        content=buf.getvalue(), media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="tc609-{project["code"]}.zip"'},
    )


# ---------------------------------------------------------------------------
# 租户切换
# ---------------------------------------------------------------------------

@router.get("/api/tenants/switchable")
def switchable_tenants(user: dict = Depends(me)):
    rows = db.rows("SELECT * FROM tenants WHERE status='active' ORDER BY id")
    return {"tenants": rows, "current": user.get("tenant_id") or 0}


@router.post("/api/tenant/switch")
def switch_tenant(body: dict, user: dict = Depends(me)):
    tid = int(body.get("tenant_id") or 0)
    tenant = db.row("SELECT * FROM tenants WHERE id=? AND status='active'", (tid,))
    if tid and not tenant:
        raise HTTPException(404, "租户不存在或已停用")
    db.execute("UPDATE users SET tenant_id=? WHERE id=?", (tid or None, user["id"]))
    db.log(user["id"], "switch_tenant", f"tenant:{tid}", "切换租户")
    return {"ok": True, "tenant_id": tid}
