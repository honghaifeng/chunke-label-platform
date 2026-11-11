"""标注作业中心：批量导入、分片上传、异步作业、版本管理、任务大厅、多模态与智能算子。"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import shutil
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response

from . import auth, db

router = APIRouter()

JOB_LOCK = threading.Lock()
CANCELED: set[int] = set()
MEDIA_SUFFIX = {
    ".wav", ".mp3", ".flac", ".m4a", ".ogg", ".aac",
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif",
    ".mp4", ".mov", ".webm", ".mkv", ".avi",
    ".pcd", ".ply", ".bin", ".las", ".laz",
    ".txt", ".json", ".jsonl", ".csv", ".pdf",
}


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


def _assert_write(user: dict, pid: int) -> dict:
    project = _project(pid)
    if auth.is_admin(user) or auth.project_role(user, pid) == "manager":
        return project
    raise HTTPException(403, "仅平台管理员 / 项目管理者可执行该操作")


def _task(tid: int, user: dict) -> dict:
    t = db.row(
        "SELECT t.*,p.name project_name,p.code project_code,p.modality FROM tasks t"
        " JOIN projects p ON p.id=t.project_id WHERE t.id=?",
        (tid,),
    )
    if not t:
        raise HTTPException(404, "任务不存在")
    auth.assert_task(user, t)
    return t


def _media_kind(ext: str) -> str:
    if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"):
        return "image"
    if ext in (".mp4", ".mov", ".webm", ".mkv", ".avi"):
        return "video"
    if ext in (".pcd", ".ply", ".bin", ".las", ".laz"):
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


# ---------------------------------------------------------------------------
# 异步作业
# ---------------------------------------------------------------------------

JOB_HANDLERS: dict[str, Any] = {}


def job_handler(kind: str):
    def deco(fn):
        JOB_HANDLERS[kind] = fn
        return fn

    return deco


def _progress(job_id: int, percent: int, message: str = "") -> None:
    db.execute(
        "UPDATE jobs SET progress=?,message=?,updated_at=? WHERE id=?",
        (max(0, min(100, percent)), message, db.now(), job_id),
    )


def _canceled(job_id: int) -> bool:
    return job_id in CANCELED


def _run_job(job_id: int) -> None:
    j = db.row("SELECT * FROM jobs WHERE id=?", (job_id,))
    if not j:
        return
    db.execute(
        "UPDATE jobs SET status='running',started_at=?,updated_at=? WHERE id=?",
        (db.now(), db.now(), job_id),
    )
    try:
        handler = JOB_HANDLERS.get(j["kind"])
        if not handler:
            raise RuntimeError(f"未知作业类型：{j['kind']}")
        result = handler(j, lambda p, m="": _progress(job_id, p, m))
        if _canceled(job_id):
            db.execute("UPDATE jobs SET status='canceled',updated_at=? WHERE id=?", (db.now(), job_id))
        else:
            db.execute(
                "UPDATE jobs SET status='done',progress=100,result=?,finished_at=?,updated_at=? WHERE id=?",
                (json.dumps(result, ensure_ascii=False), db.now(), db.now(), job_id),
            )
    except Exception as exc:  # noqa: BLE001 作业失败需写入可读错误
        db.execute(
            "UPDATE jobs SET status='failed',error=?,finished_at=?,updated_at=? WHERE id=?",
            (str(exc)[:800], db.now(), db.now(), job_id),
        )
    finally:
        CANCELED.discard(job_id)


def _start_job(kind: str, name: str, user: dict, payload: dict, **refs) -> int:
    jid = db.execute(
        "INSERT INTO jobs(kind,name,project_id,task_id,dataset_id,status,progress,message,payload,"
        "created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            kind,
            name,
            refs.get("project_id"),
            refs.get("task_id"),
            refs.get("dataset_id"),
            "queued",
            0,
            "等待执行",
            json.dumps(payload, ensure_ascii=False),
            user["id"],
            db.now(),
            db.now(),
        ),
    )
    threading.Thread(target=_run_job, args=(jid,), daemon=True).start()
    return jid


@router.get("/api/jobs")
def list_jobs(kind: str = "", status: str = "", limit: int = 50, user: dict = Depends(me)):
    conds, vals = ["1=1"], []
    if kind:
        conds.append("kind=?")
        vals.append(kind)
    if status:
        conds.append("status=?")
        vals.append(status)
    if not auth.is_admin(user):
        conds.append("(created_by=? OR project_id IN (SELECT project_id FROM project_members WHERE user_id=?))")
        vals.extend([user["id"], user["id"]])
    items = db.rows(
        "SELECT * FROM jobs WHERE " + " AND ".join(conds) + " ORDER BY id DESC LIMIT ?",
        tuple(vals + [max(1, min(200, limit))]),
    )
    for it in items:
        it["payload"] = _json(it["payload"], {})
        it["result"] = _json(it["result"], {})
        it["kind_label"] = {
            "audio_denoise": "语音降噪", "video_frames": "视频抽帧", "video_compress": "视频转码",
            "dataset_export": "数据集导出", "dataset_sync": "数据集同步", "import_urls": "URL 导入",
        }.get(it["kind"], it["kind"])
    return {"jobs": items}


@router.get("/api/jobs/{jid}")
def job_detail(jid: int, user: dict = Depends(me)):
    j = db.row("SELECT * FROM jobs WHERE id=?", (jid,))
    if not j:
        raise HTTPException(404, "作业不存在")
    j["payload"] = _json(j["payload"], {})
    j["result"] = _json(j["result"], {})
    return j


@router.post("/api/jobs/{jid}/cancel")
def cancel_job(jid: int, user: dict = Depends(me)):
    j = db.row("SELECT * FROM jobs WHERE id=?", (jid,))
    if not j:
        raise HTTPException(404, "作业不存在")
    if j["status"] in ("done", "failed", "canceled"):
        raise HTTPException(400, "作业已结束")
    CANCELED.add(jid)
    db.execute("UPDATE jobs SET status='canceled',updated_at=? WHERE id=?", (db.now(), jid))
    return {"ok": True}


def _ffmpeg(args: list[str], timeout: int = 900) -> None:
    try:
        proc = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"ffmpeg 执行失败：{exc}") from exc
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg 失败：{(proc.stderr or '')[-400:]}")


def _probe_duration(path: str) -> float:
    try:
        proc = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", path],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return round(float(proc.stdout.strip() or 0), 2)
    except Exception:  # noqa: BLE001
        return 0.0


@job_handler("audio_denoise")
def _job_audio_denoise(j: dict, report) -> dict:
    task = db.row("SELECT * FROM tasks WHERE id=?", (j["task_id"],))
    if not task or not task["media_path"] or not os.path.exists(task["media_path"]):
        raise RuntimeError("任务媒体不存在")
    report(15, "正在降噪")
    out = os.path.join(db.MEDIA_DIR, f"{task['project_id']}-{task['id']}-dn-{uuid.uuid4().hex[:6]}.wav")
    _ffmpeg(["-i", task["media_path"], "-af", "afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "16000", "-ac", "1", out])
    report(80, "正在回写")
    dur = _probe_duration(out)
    db.execute("UPDATE tasks SET media_path=?,duration=?,updated_at=? WHERE id=?", (out, dur, db.now(), task["id"]))
    db.log(j["created_by"], "preprocess_audio", f"task:{task['id']}", out)
    note = "已生成降噪音频，可在工作台对比原始音频"
    return {"media": f"/media/{os.path.basename(out)}", "duration": dur, "note": note}


@job_handler("video_frames")
def _job_video_frames(j: dict, report) -> dict:
    task = db.row("SELECT * FROM tasks WHERE id=?", (j["task_id"],))
    if not task or not task["media_path"] or not os.path.exists(task["media_path"]):
        raise RuntimeError("任务媒体不存在")
    payload = _json(j["payload"], {})
    interval = float(payload.get("interval") or 1)
    max_frames = int(payload.get("max_frames") or 120)
    prefix = f"frames-{task['id']}-{uuid.uuid4().hex[:6]}"
    pattern = os.path.join(db.MEDIA_DIR, f"{prefix}-%05d.jpg")
    report(10, "开始抽帧")
    _ffmpeg(["-i", task["media_path"], "-vf", f"fps=1/{max(0.04, interval)},scale=1280:-2", pattern])
    names = sorted(n for n in os.listdir(db.MEDIA_DIR) if n.startswith(prefix) and n.endswith(".jpg"))[:max_frames]
    for n in names:
        db.execute(
            "INSERT INTO task_media(task_id,kind,path,name,meta,created_at) VALUES(?,?,?,?,?,?)",
            (task["id"], "image", os.path.join(db.MEDIA_DIR, n), n, json.dumps({"source": "frames"}, ensure_ascii=False), db.now()),
        )
    report(90, f"已抽取 {len(names)} 帧")
    return {"count": len(names), "frames": [f"/media/{n}" for n in names[:12]]}


@job_handler("video_compress")
def _job_video_compress(j: dict, report) -> dict:
    task = db.row("SELECT * FROM tasks WHERE id=?", (j["task_id"],))
    if not task or not task["media_path"]:
        raise RuntimeError("任务媒体不存在")
    report(20, "转码中")
    out = os.path.join(db.MEDIA_DIR, f"{task['id']}-{uuid.uuid4().hex[:6]}.mp4")
    _ffmpeg(["-i", task["media_path"], "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264", "-crf", "28", "-preset", "veryfast", "-c:a", "aac", out])
    db.execute("UPDATE tasks SET media_path=?,duration=?,updated_at=? WHERE id=?", (out, _probe_duration(out), db.now(), task["id"]))
    return {"media": f"/media/{os.path.basename(out)}"}


@job_handler("dataset_export")
def _job_dataset_export(j: dict, report) -> dict:
    from . import extras  # 延迟导入：extras 依赖本模块的作业框架

    ds = db.row("SELECT * FROM datasets WHERE id=?", (j["dataset_id"],))
    if not ds:
        raise RuntimeError("数据集不存在")
    payload = _json(j["payload"], {})
    fmt = (payload.get("format") or "jsonl").lower()
    rows = extras._export_rows(ds)
    report(40, f"导出 {len(rows)} 条（{fmt}）")
    out = extras._write_export(rows, fmt, ds["code"])
    return {"file": f"/api/jobs/{j['id']}/download", "path": out, "count": len(rows), "format": fmt}


@job_handler("dataset_sync")
def _job_dataset_sync(j: dict, report) -> dict:
    ds = db.row("SELECT * FROM datasets WHERE id=?", (j["dataset_id"],))
    if not ds or not ds["webhook_url"]:
        raise RuntimeError("数据集未配置同步 Webhook")
    ver = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds["id"],))
    body = json.dumps({
        "event": "dataset.sync",
        "dataset": {"code": ds["code"], "name": ds["name"], "modality": ds["modality"]},
        "version": ver["version"] if ver else 0,
        "items": len(db.rows("SELECT id FROM dataset_items WHERE version_id=?", (ver["id"],))) if ver else 0,
        "time": db.now(),
    }, ensure_ascii=False).encode()
    report(40, "推送中")
    req = urllib.request.Request(ds["webhook_url"], data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 平台配置的可信回调
            text = resp.read(4000).decode("utf-8", "ignore")
            return {"status": resp.status, "response": text[:2000]}
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Webhook 调用失败：{exc}") from exc


@job_handler("import_urls")
def _job_import_urls(j: dict, report) -> dict:
    payload = _json(j["payload"], {})
    project = _project(int(payload.get("project_id") or 0))
    urls = payload.get("urls") or []
    batch = payload.get("batch") or "URL 导入"
    created = []
    for i, url in enumerate(urls):
        if _canceled(j["id"]):
            break
        report(int(10 + 80 * (i + 1) / max(1, len(urls))), f"下载 {i + 1}/{len(urls)}")
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 用户显式提交的 URL
                data = resp.read(300 * 1024 * 1024)
        except Exception as exc:  # noqa: BLE001
            created.append({"url": url, "error": str(exc)[:200]})
            continue
        name = os.path.basename(url.split("?")[0]) or f"url-{uuid.uuid4().hex[:6]}"
        ext = os.path.splitext(name)[1].lower()
        local = f"{project['code']}-{uuid.uuid4().hex[:8]}{ext or '.bin'}"
        with open(os.path.join(db.MEDIA_DIR, local), "wb") as f:
            f.write(data)
        tid = db.execute(
            "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,priority,batch,source,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (project["id"], name, os.path.join(db.MEDIA_DIR, local), _media_kind(ext), 0, "pending", "normal", batch, "url", db.now(), db.now()),
        )
        created.append({"url": url, "task_id": tid})
    return {"created": created, "count": len([c for c in created if c.get("task_id")])}


@router.get("/api/jobs/{jid}/download")
def job_download(jid: int, user: dict = Depends(me)):
    j = db.row("SELECT * FROM jobs WHERE id=?", (jid,))
    if not j:
        raise HTTPException(404, "作业不存在")
    result = _json(j["result"], {})
    path = result.get("path") or ""
    if not path or not os.path.isfile(path):
        raise HTTPException(404, "导出文件不存在或已被清理")
    return FileResponse(path, filename=os.path.basename(path))


@router.post("/api/tasks/{tid}/preprocess")
def task_preprocess(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    if not (auth.is_admin(user) or task["assignee_id"] == user["id"] or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "无权处理该任务")
    kind = body.get("kind") or ""
    mapping = {"audio_denoise": "语音降噪", "video_frames": "视频抽帧", "video_compress": "视频转码"}
    if kind not in mapping:
        raise HTTPException(400, "不支持的预处理类型")
    if not task["media_path"] or not os.path.exists(task["media_path"]):
        raise HTTPException(400, "请先上传媒体文件")
    payload = {k: body.get(k) for k in ("interval", "max_frames") if body.get(k) is not None}
    jid = _start_job(kind, f"{mapping[kind]} · {task['name']}", user, payload, project_id=task["project_id"], task_id=tid)
    return {"ok": True, "job_id": jid}


# ---------------------------------------------------------------------------
# 批量导入 / 分片上传
# ---------------------------------------------------------------------------

def _create_task(project: dict, name: str, path: str, kind: str, batch: str, user: dict, source: str) -> int:
    return db.execute(
        "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,priority,batch,source,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (project["id"], name, path, kind, _probe_duration(path) if kind == "audio" else 0, "pending", "normal", batch, source, db.now(), db.now()),
    )


def _append_dataset_version(ds_id: int, items: list[dict], note: str, user: dict) -> dict:
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    ver = (db.row("SELECT MAX(version) v FROM dataset_versions WHERE dataset_id=?", (ds_id,)) or {}).get("v") or 0
    ver += 1
    digest_src = "|".join(f"{i['name']}:{i.get('size', 0)}" for i in sorted(items, key=lambda x: x["name"]))
    digest = hashlib.sha256(digest_src.encode()).hexdigest()[:16]
    vid = db.execute(
        "INSERT INTO dataset_versions(dataset_id,version,note,item_count,digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
        (ds_id, ver, note, len(items), digest, user["id"], db.now()),
    )
    for it in items:
        db.execute(
            "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (ds_id, vid, it.get("task_id"), it["name"], it.get("media_path", ""), it.get("media_type", "audio"), it.get("size", 0), json.dumps(it.get("meta") or {}, ensure_ascii=False), db.now()),
        )
    db.log(user["id"], "dataset_version", f"dataset:{ds_id}", f"v{ver} · {len(items)} 条 · {digest}")
    return {"version": ver, "version_id": vid, "count": len(items), "digest": digest}


@router.post("/api/import")
async def import_files(
    files: list[UploadFile] = File(...),
    project_id: int = Form(...),
    target: str = Form("tasks"),
    batch: str = Form(""),
    user: dict = Depends(me),
):
    project = _assert_write(user, project_id)
    batch = batch or f"导入 {db.now()[:10]}"
    saved: list[dict] = []
    tmp_zip = []
    for f in files:
        ext = os.path.splitext(f.filename or "")[1].lower()
        raw = os.path.join(db.TMP_DIR, f"imp-{uuid.uuid4().hex}{ext}")
        with open(raw, "wb") as out:
            shutil.copyfileobj(f.file, out)
        if ext == ".zip":
            tmp_zip.append(raw)
        else:
            saved.append({"name": os.path.basename(f.filename or raw), "path": raw, "ext": ext})
    for z in tmp_zip:
        with zipfile.ZipFile(z) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                ext = os.path.splitext(info.filename)[1].lower()
                if ext not in MEDIA_SUFFIX:
                    continue
                out = os.path.join(db.TMP_DIR, f"zip-{uuid.uuid4().hex}{ext}")
                with zf.open(info) as src, open(out, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                saved.append({"name": os.path.basename(info.filename), "path": out, "ext": ext})
        try:
            os.remove(z)
        except OSError:
            pass
    if not saved:
        raise HTTPException(400, "未发现可导入的媒体文件")

    created_tasks, items = [], []
    for s in saved:
        kind = _media_kind(s["ext"])
        local = f"{project['code']}-{uuid.uuid4().hex[:8]}{s['ext']}"
        dest = os.path.join(db.MEDIA_DIR, local)
        shutil.move(s["path"], dest)
        size = os.path.getsize(dest)
        if target == "dataset":
            items.append({"name": s["name"], "media_path": dest, "media_type": kind, "size": size, "task_id": None})
        else:
            tid = _create_task(project, os.path.splitext(s["name"])[0], dest, kind, batch, user, "import")
            created_tasks.append(tid)
            items.append({"name": s["name"], "media_path": dest, "media_type": kind, "size": size, "task_id": tid})
    result = {"ok": True, "count": len(items), "tasks": created_tasks}
    ds = db.row("SELECT id FROM datasets WHERE project_id=? ORDER BY id LIMIT 1", (project["id"],))
    if target == "dataset":
        if not ds:
            ds_id = db.execute(
                "INSERT INTO datasets(tenant_id,project_id,code,name,modality,description,status,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?,?)",
                (user.get("tenant_id"), project["id"], f"ds-{project['code']}-{uuid.uuid4().hex[:4]}", f"{project['name']} · 导入数据集", project["modality"], "批量导入", "active", user["id"], db.now(), db.now()),
            )
            ds = {"id": ds_id}
        result["dataset"] = _append_dataset_version(ds["id"], items, f"{batch} · 导入", user)
    db.log(user["id"], "import", f"project:{project_id}", f"{len(items)} 个文件 → {target}")
    return result


@router.post("/api/import/url")
def import_urls(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    _assert_write(user, pid)
    urls = [u.strip() for u in (body.get("urls") or []) if str(u).strip()]
    if not urls:
        raise HTTPException(400, "请提供至少一个 URL")
    jid = _start_job(
        "import_urls",
        f"URL 导入 · {len(urls)} 个文件",
        user,
        {"urls": urls[:200], "project_id": pid, "batch": body.get("batch") or ""},
        project_id=pid,
    )
    return {"ok": True, "job_id": jid}


@router.post("/api/uploads/init")
def upload_init(body: dict, user: dict = Depends(me)):
    filename = os.path.basename(body.get("filename") or "upload.bin")
    total = int(body.get("total_chunks") or 0)
    if total <= 0:
        raise HTTPException(400, "total_chunks 必须大于 0")
    sid = uuid.uuid4().hex
    os.makedirs(os.path.join(db.TMP_DIR, "uploads", sid), exist_ok=True)
    db.execute(
        "INSERT INTO upload_sessions(id,filename,total_chunks,received,size,status,target,project_id,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (sid, filename, total, "[]", int(body.get("size") or 0), "uploading", body.get("target") or "tasks", int(body.get("project_id") or 0) or None, user["id"], db.now(), db.now()),
    )
    return {"ok": True, "upload_id": sid, "chunk_size": 4 * 1024 * 1024}


@router.put("/api/uploads/{sid}/chunks/{index}")
async def upload_chunk(sid: str, index: int, request: Request, user: dict = Depends(me)):
    session = db.row("SELECT * FROM upload_sessions WHERE id=?", (sid,))
    if not session:
        raise HTTPException(404, "上传会话不存在")
    if index < 0 or index >= session["total_chunks"]:
        raise HTTPException(400, "分片序号越界")
    data = await request.body()
    path = os.path.join(db.TMP_DIR, "uploads", sid, f"{index:05d}.part")
    with open(path, "wb") as f:
        f.write(data)
    received = set(_json(session["received"], []))
    received.add(index)
    db.execute(
        "UPDATE upload_sessions SET received=?,updated_at=? WHERE id=?",
        (json.dumps(sorted(received)), db.now(), sid),
    )
    return {"ok": True, "received": len(received), "total": session["total_chunks"]}


@router.post("/api/uploads/{sid}/complete")
def upload_complete(sid: str, user: dict = Depends(me)):
    session = db.row("SELECT * FROM upload_sessions WHERE id=?", (sid,))
    if not session:
        raise HTTPException(404, "上传会话不存在")
    received = set(_json(session["received"], []))
    if len(received) < session["total_chunks"]:
        raise HTTPException(400, f"分片不完整：{len(received)}/{session['total_chunks']}")
    base = os.path.join(db.TMP_DIR, "uploads", sid)
    ext = os.path.splitext(session["filename"])[1].lower()
    local = f"upload-{uuid.uuid4().hex[:8]}{ext or '.bin'}"
    dest = os.path.join(db.MEDIA_DIR, local)
    with open(dest, "wb") as out:
        for i in range(session["total_chunks"]):
            with open(os.path.join(base, f"{i:05d}.part"), "rb") as part:
                shutil.copyfileobj(part, out)
    shutil.rmtree(base, ignore_errors=True)
    db.execute("UPDATE upload_sessions SET status='done',updated_at=? WHERE id=?", (db.now(), sid))
    kind = _media_kind(ext)
    result = {"ok": True, "media": f"/media/{local}", "media_type": kind, "size": os.path.getsize(dest)}
    if session["target"] == "tasks" and session["project_id"]:
        project = _project(int(session["project_id"]))
        if auth.is_admin(user) or auth.project_role(user, project["id"]) == "manager":
            tid = _create_task(project, os.path.splitext(session["filename"])[0], dest, kind, "分片上传", user, "chunked")
            result["task_id"] = tid
    return result


# ---------------------------------------------------------------------------
# 数据集版本：对比 / 回滚
# ---------------------------------------------------------------------------

def _version_items(ds_id: int, version: int) -> tuple[dict | None, list[dict]]:
    ver = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? AND version=?", (ds_id, version))
    if not ver:
        raise HTTPException(404, "版本不存在")
    return ver, db.rows("SELECT * FROM dataset_items WHERE version_id=? ORDER BY name", (ver["id"],))


@router.get("/api/datasets/{ds_id}/versions")
def dataset_versions(ds_id: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    items = db.rows(
        "SELECT v.*,u.name created_by_name FROM dataset_versions v LEFT JOIN users u ON u.id=v.created_by"
        " WHERE v.dataset_id=? ORDER BY v.version DESC",
        (ds_id,),
    )
    return {"versions": items}


@router.get("/api/datasets/{ds_id}/versions/diff")
def dataset_version_diff(ds_id: int, a: int, b: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    _, items_a = _version_items(ds_id, a)
    _, items_b = _version_items(ds_id, b)
    map_a = {i["name"]: i for i in items_a}
    map_b = {i["name"]: i for i in items_b}
    added = [map_b[n] for n in sorted(set(map_b) - set(map_a))]
    removed = [map_a[n] for n in sorted(set(map_a) - set(map_b))]
    changed = [
        {"name": n, "from": {"size": map_a[n]["size"], "media_path": map_a[n]["media_path"]},
         "to": {"size": map_b[n]["size"], "media_path": map_b[n]["media_path"]}}
        for n in sorted(set(map_a) & set(map_b))
        if map_a[n]["size"] != map_b[n]["size"] or map_a[n]["media_path"] != map_b[n]["media_path"]
    ]
    return {"a": a, "b": b, "added": added, "removed": removed, "changed": changed,
            "summary": {"added": len(added), "removed": len(removed), "changed": len(changed)}}


@router.post("/api/datasets/{ds_id}/versions/{version}/rollback")
def dataset_rollback(ds_id: int, version: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.write")
    _, items = _version_items(ds_id, version)
    payload = [
        {
            "name": i["name"], "media_path": i["media_path"], "media_type": i["media_type"],
            "size": i["size"], "task_id": i["task_id"], "meta": _json(i["meta"], {}),
        }
        for i in items
    ]
    out = _append_dataset_version(ds_id, payload, f"回滚自 v{version}", user)
    out["ok"] = True
    return out


@router.get("/api/tasks/{tid}/annotation/history")
def annotation_history(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    items = db.rows(
        "SELECT h.id,h.version,h.note,h.created_at,u.name created_by_name FROM annotation_versions h"
        " LEFT JOIN users u ON u.id=h.created_by WHERE h.task_id=? ORDER BY h.version DESC LIMIT 50",
        (tid,),
    )
    return {"versions": items}


@router.get("/api/tasks/{tid}/annotation/versions/{vid}")
def annotation_version(tid: int, vid: int, user: dict = Depends(me)):
    _task(tid, user)
    v = db.row("SELECT * FROM annotation_versions WHERE id=? AND task_id=?", (vid, tid))
    if not v:
        raise HTTPException(404, "版本不存在")
    v["payload"] = _json(v["payload"], {})
    return v


@router.post("/api/tasks/{tid}/annotation/versions/{vid}/restore")
def annotation_restore(tid: int, vid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    v = db.row("SELECT * FROM annotation_versions WHERE id=? AND task_id=?", (vid, tid))
    if not v:
        raise HTTPException(404, "版本不存在")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (tid,))
    if not ann:
        aid = db.execute(
            "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (tid, user["id"], v["payload"], "{}", "draft", 1, db.now(), db.now()),
        )
    else:
        aid = ann["id"]
        hist = (db.row("SELECT COUNT(*) c FROM annotation_versions WHERE annotation_id=?", (aid,)) or {}).get("c", 0) + 1
        db.execute(
            "INSERT INTO annotation_versions(annotation_id,task_id,version,payload,note,created_by,created_at)"
            " VALUES(?,?,?,?,?,?,?)",
            (aid, tid, hist, ann["payload"], f"恢复 v{v['version']} 前快照", user["id"], db.now()),
        )
        db.execute("UPDATE annotations SET payload=?,updated_at=? WHERE id=?", (v["payload"], db.now(), aid))
    db.log(user["id"], "annotation_restore", f"task:{tid}", f"version:{vid}")
    return {"ok": True, "payload": _json(v["payload"], {})}


# ---------------------------------------------------------------------------
# 归档 / 软删除 / 任务大厅 / 任务包 / 暂停恢复
# ---------------------------------------------------------------------------

def _task_action(tid: int, user: dict, sql: str, args: tuple, action: str) -> None:
    task = _task(tid, user)
    if not (auth.is_admin(user) or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "仅项目管理者可执行该操作")
    db.execute(sql, args)
    db.log(user["id"], action, f"task:{tid}")


@router.post("/api/tasks/{tid}/archive")
def archive_task(tid: int, user: dict = Depends(me)):
    _task_action(tid, user, "UPDATE tasks SET archived=1,archived_at=?,updated_at=? WHERE id=?", (db.now(), db.now(), tid), "archive_task")
    return {"ok": True}


@router.post("/api/tasks/{tid}/restore")
def restore_task(tid: int, user: dict = Depends(me)):
    _task_action(tid, user, "UPDATE tasks SET archived=0,deleted=0,updated_at=? WHERE id=?", (db.now(), tid), "restore_task")
    return {"ok": True}


@router.delete("/api/tasks/{tid}")
def delete_task(tid: int, user: dict = Depends(me)):
    _task_action(tid, user, "UPDATE tasks SET deleted=1,updated_at=? WHERE id=?", (db.now(), tid), "delete_task")
    return {"ok": True}


@router.get("/api/tasks/trash")
def task_trash(user: dict = Depends(me)):
    where, args = auth.task_scope_sql(user)
    items = db.rows(
        "SELECT t.id,t.name,t.status,t.archived,t.deleted,t.updated_at,p.name project_name FROM tasks t"
        " JOIN projects p ON p.id=t.project_id WHERE " + where + " AND (t.deleted=1 OR t.archived=1) ORDER BY t.id DESC LIMIT 200",
        tuple(args),
    )
    return {"tasks": items}


@router.get("/api/task-hall")
def task_hall(project_id: int = 0, user: dict = Depends(me)):
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"tasks": [], "packages": []}
    marks = ",".join("?" * len(ids))
    conds = [f"t.project_id IN ({marks})", "t.status='pending'", "t.deleted=0", "(t.assignee_id IS NULL OR t.assignee_id=0)"]
    vals: list = list(ids)
    if project_id:
        conds.append("t.project_id=?")
        vals.append(project_id)
    tasks = db.rows(
        "SELECT t.*,p.name project_name,p.modality FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE {' AND '.join(conds)} ORDER BY t.priority='high' DESC,t.id LIMIT 200",
        tuple(vals),
    )
    packages = db.rows(
        f"SELECT * FROM task_packages WHERE project_id IN ({marks}) AND status='open' ORDER BY id DESC",
        tuple(ids),
    )
    return {"tasks": tasks, "packages": packages}


@router.post("/api/task-hall/claim")
def claim_tasks(body: dict, user: dict = Depends(me)):
    ids = [int(x) for x in (body.get("task_ids") or [])]
    package_id = int(body.get("package_id") or 0)
    if package_id:
        ids = [r["task_id"] for r in db.rows("SELECT task_id FROM task_package_items WHERE package_id=?", (package_id,))]
    if not ids:
        raise HTTPException(400, "请选择要领取的任务")
    claimed = []
    for tid in ids:
        t = db.row("SELECT * FROM tasks WHERE id=?", (tid,))
        if not t or t["status"] != "pending" or t["assignee_id"]:
            continue
        if not auth.is_admin(user) and auth.project_role(user, t["project_id"]) not in ("annotator", "manager"):
            continue
        db.execute("UPDATE tasks SET assignee_id=?,status='annotating',updated_at=? WHERE id=?", (user["id"], db.now(), tid))
        claimed.append(tid)
    if package_id and claimed:
        db.execute("UPDATE task_packages SET status='claimed',claimed_by=?,updated_at=? WHERE id=?", (user["id"], db.now(), package_id))
        db.execute("UPDATE tasks SET package_id=? WHERE id IN (%s)" % ",".join("?" * len(claimed)), (package_id, *claimed))
    db.log(user["id"], "claim_tasks", "task_hall", f"{len(claimed)} 个任务")
    return {"ok": True, "claimed": claimed, "count": len(claimed)}


@router.get("/api/task-packages")
def list_packages(project_id: int = 0, user: dict = Depends(me)):
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"packages": []}
    marks = ",".join("?" * len(ids))
    conds = [f"p.project_id IN ({marks})"]
    vals: list = list(ids)
    if project_id:
        conds.append("p.project_id=?")
        vals.append(project_id)
    items = db.rows(
        "SELECT p.*,pr.name project_name,u.name claimed_by_name FROM task_packages p"
        " JOIN projects pr ON pr.id=p.project_id LEFT JOIN users u ON u.id=p.claimed_by"
        f" WHERE {' AND '.join(conds)} ORDER BY p.id DESC",
        tuple(vals),
    )
    return {"packages": items}


@router.post("/api/task-packages")
def create_package(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    _assert_write(user, pid)
    task_ids = [int(x) for x in (body.get("task_ids") or [])]
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "任务包名称不能为空")
    code = body.get("code") or f"pkg-{uuid.uuid4().hex[:6]}"
    pkg_id = db.execute(
        "INSERT INTO task_packages(project_id,code,name,description,status,task_count,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (pid, code, name, body.get("description") or "", "open", len(task_ids), user["id"], db.now(), db.now()),
    )
    for tid in task_ids:
        db.execute("INSERT OR IGNORE INTO task_package_items(package_id,task_id) VALUES(?,?)", (pkg_id, tid))
        db.execute("UPDATE tasks SET package_id=? WHERE id=?", (pkg_id, tid))
    db.log(user["id"], "create_package", f"package:{pkg_id}", f"{len(task_ids)} 个任务")
    return {"ok": True, "id": pkg_id, "code": code}


@router.get("/api/task-packages/{pkg_id}")
def package_detail(pkg_id: int, user: dict = Depends(me)):
    pkg = db.row("SELECT * FROM task_packages WHERE id=?", (pkg_id,))
    if not pkg:
        raise HTTPException(404, "任务包不存在")
    tasks = db.rows(
        "SELECT t.id,t.name,t.status,t.assignee_id,u.name assignee_name FROM tasks t"
        " JOIN task_package_items i ON i.task_id=t.id LEFT JOIN users u ON u.id=t.assignee_id WHERE i.package_id=?",
        (pkg_id,),
    )
    pkg["tasks"] = tasks
    return pkg


@router.post("/api/tasks/{tid}/pause")
def pause_task(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    if task["status"] in ("done", "ended"):
        raise HTTPException(400, "任务已结束，无法暂停")
    db.execute("UPDATE tasks SET status='paused',paused_at=?,updated_at=? WHERE id=?", (db.now(), db.now(), tid))
    db.notify(task["assignee_id"], "任务已暂停", task["name"], "pause", f"#/annotate/{tid}")
    db.log(user["id"], "pause_task", f"task:{tid}")
    return {"ok": True}


@router.post("/api/tasks/{tid}/resume")
def resume_task(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    db.execute("UPDATE tasks SET status='annotating',paused_at=NULL,updated_at=? WHERE id=?", (db.now(), tid))
    db.notify(task["assignee_id"], "任务已恢复", task["name"], "resume", f"#/annotate/{tid}")
    db.log(user["id"], "resume_task", f"task:{tid}")
    return {"ok": True}


@router.post("/api/tasks/{tid}/end")
def end_task(tid: int, body: dict | None = None, user: dict = Depends(me)):
    task = _task(tid, user)
    if not (auth.is_admin(user) or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "仅项目管理者可结束任务")
    db.execute("UPDATE tasks SET status='ended',ended_at=?,updated_at=? WHERE id=?", (db.now(), db.now(), tid))
    db.notify(task["assignee_id"], "任务已结束", task["name"], "end", f"#/tasks")
    db.log(user["id"], "end_task", f"task:{tid}", (body or {}).get("reason") or "")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 通知 / 个人偏好 / 成员批量导入
# ---------------------------------------------------------------------------

@router.get("/api/notifications")
def notifications(user: dict = Depends(me)):
    items = db.rows(
        "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50", (user["id"],)
    )
    unread = db.row("SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read_at IS NULL", (user["id"],))["c"]
    return {"notifications": items, "unread": unread}


@router.post("/api/notifications/{nid}/read")
def read_notification(nid: int, user: dict = Depends(me)):
    db.execute("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?", (db.now(), nid, user["id"]))
    return {"ok": True}


@router.post("/api/notifications/read-all")
def read_all(user: dict = Depends(me)):
    db.execute("UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL", (db.now(), user["id"]))
    return {"ok": True}


@router.get("/api/preferences")
def get_prefs(user: dict = Depends(me)):
    return {"preferences": db.pref_get(user["id"])}


@router.put("/api/preferences")
def save_prefs(body: dict, user: dict = Depends(me)):
    data = dict(db.pref_get(user["id"]))
    data.update(body.get("preferences") or body or {})
    db.execute(
        "INSERT INTO user_preferences(user_id,data,updated_at) VALUES(?,?,?)"
        " ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
        (user["id"], json.dumps(data, ensure_ascii=False), db.now()),
    )
    if data.get("language") in ("zh", "en"):
        db.execute("UPDATE users SET language=? WHERE id=?", (data["language"], user["id"]))
    return {"ok": True, "preferences": data}


@router.post("/api/members/import")
async def import_members(file: UploadFile = File(...), user: dict = Depends(me)):
    auth.require_perm(user, "member.write")
    raw = (await file.read()).decode("utf-8-sig", "ignore")
    reader = csv.DictReader(io.StringIO(raw))
    created, updated, errors = 0, 0, []
    for i, row in enumerate(reader, start=2):
        username = (row.get("username") or row.get("账号") or "").strip()
        name = (row.get("name") or row.get("姓名") or username).strip()
        role = (row.get("role") or row.get("角色") or "annotator").strip()
        password = (row.get("password") or "chunke123").strip()
        if not username:
            errors.append(f"第 {i} 行缺少 username")
            continue
        if role not in auth.PLATFORM_ROLES:
            role = "annotator"
        found = db.row("SELECT id FROM users WHERE username=?", (username,))
        if found:
            db.execute("UPDATE users SET name=?,platform_role=?,status='active' WHERE id=?", (name, role, found["id"]))
            uid, updated = found["id"], updated + 1
        else:
            uid = db.execute(
                "INSERT INTO users(username,name,password_hash,platform_role,status,created_at) VALUES(?,?,?,?,?,?)",
                (username, name, db.hash_password(password), role, "active", db.now()),
            )
            created += 1
        org_code = (row.get("org_code") or row.get("组织") or "").strip()
        team_code = (row.get("team_code") or row.get("团队") or "").strip()
        tenant = db.row("SELECT id FROM tenants ORDER BY id LIMIT 1")
        org = db.row("SELECT id FROM orgs WHERE code=? AND tenant_id=?", (org_code, tenant["id"])) if org_code and tenant else None
        team = db.row("SELECT id FROM teams WHERE code=?", (team_code,)) if team_code else None
        db.execute(
            "UPDATE users SET tenant_id=?,org_id=?,team_id=? WHERE id=?",
            (tenant["id"] if tenant else None, org["id"] if org else None, team["id"] if team else None, uid),
        )
        if team:
            db.execute("INSERT OR REPLACE INTO team_members(team_id,user_id,team_role) VALUES(?,?,?)", (team["id"], uid, "member"))
        for code in [c.strip() for c in (row.get("project_codes") or row.get("项目") or "").split(",") if c.strip()]:
            p = db.row("SELECT id FROM projects WHERE code=?", (code,))
            if p:
                db.execute(
                    "INSERT OR REPLACE INTO project_members(project_id,user_id,project_role) VALUES(?,?,?)",
                    (p["id"], uid, "annotator"),
                )
    db.log(user["id"], "import_members", "users", f"新建 {created}，更新 {updated}")
    return {"ok": True, "created": created, "updated": updated, "errors": errors}


# ---------------------------------------------------------------------------
# 模板版本
# ---------------------------------------------------------------------------

def snapshot_template(tid: int, user: dict, note: str = "") -> dict:
    t = db.row("SELECT * FROM templates WHERE id=?", (tid,))
    if not t:
        raise HTTPException(404, "模板不存在")
    latest = db.row("SELECT * FROM template_versions WHERE template_id=? ORDER BY version DESC LIMIT 1", (tid,))
    if latest and latest["label_config"] == t["label_config"] and latest["qc_config"] == t["qc_config"] and latest["instruction"] == t["instruction"]:
        return latest
    version = (latest["version"] if latest else 0) + 1
    vid = db.execute(
        "INSERT INTO template_versions(template_id,version,label_config,qc_config,instruction,note,locked,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (tid, version, t["label_config"], t["qc_config"], t["instruction"], note or "自动快照", 0, user["id"], db.now()),
    )
    return db.row("SELECT * FROM template_versions WHERE id=?", (vid,))


@router.get("/api/templates/{tid}/versions")
def template_versions(tid: int, user: dict = Depends(me)):
    auth.require_perm(user, "template.read")
    items = db.rows(
        "SELECT v.*,u.name created_by_name FROM template_versions v LEFT JOIN users u ON u.id=v.created_by"
        " WHERE v.template_id=? ORDER BY v.version DESC",
        (tid,),
    )
    return {"versions": items}


@router.post("/api/templates/{tid}/versions")
def create_template_version(tid: int, body: dict | None = None, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    snap = snapshot_template(tid, user, (body or {}).get("note") or "手动快照")
    return {"ok": True, "version": snap}


@router.post("/api/templates/{tid}/versions/{version}/rollback")
def rollback_template(tid: int, version: int, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    v = db.row("SELECT * FROM template_versions WHERE template_id=? AND version=?", (tid, version))
    if not v:
        raise HTTPException(404, "版本不存在")
    db.execute(
        "UPDATE templates SET label_config=?,qc_config=?,instruction=? WHERE id=?",
        (v["label_config"], v["qc_config"], v["instruction"], tid),
    )
    snap = snapshot_template(tid, user, f"回滚自 v{version}")
    db.log(user["id"], "rollback_template", f"template:{tid}", f"v{version}")
    return {"ok": True, "version": snap}


@router.post("/api/templates/{tid}/versions/{version}/lock")
def lock_template_version(tid: int, version: int, body: dict | None = None, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    locked = 0 if (body or {}).get("locked") is False else 1
    db.execute("UPDATE template_versions SET locked=? WHERE template_id=? AND version=?", (locked, tid, version))
    return {"ok": True, "locked": bool(locked)}


# ---------------------------------------------------------------------------
# 组件构建器 / 标签库
# ---------------------------------------------------------------------------

@router.get("/api/components")
def list_components(user: dict = Depends(me)):
    items = db.rows("SELECT * FROM components ORDER BY builtin DESC,id")
    for it in items:
        it["schema"] = _json(it["schema"], {})
    return {"components": items}


@router.post("/api/components")
def create_component(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "组件名称不能为空")
    code = body.get("code") or f"cmp-{uuid.uuid4().hex[:6]}"
    cid = db.execute(
        "INSERT INTO components(code,name,modality,schema,description,builtin,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (code, name, body.get("modality") or "image", json.dumps(body.get("schema") or {"fields": []}, ensure_ascii=False),
         body.get("description") or "", 0, user["id"], db.now(), db.now()),
    )
    return {"ok": True, "id": cid, "code": code}


@router.patch("/api/components/{cid}")
def update_component(cid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    c = db.row("SELECT * FROM components WHERE id=?", (cid,))
    if not c:
        raise HTTPException(404, "组件不存在")
    db.execute(
        "UPDATE components SET name=?,modality=?,schema=?,description=?,updated_at=? WHERE id=?",
        (body.get("name") or c["name"], body.get("modality") or c["modality"],
         json.dumps(body.get("schema") or _json(c["schema"], {}), ensure_ascii=False),
         body.get("description", c["description"]), db.now(), cid),
    )
    return {"ok": True}


@router.delete("/api/components/{cid}")
def delete_component(cid: int, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    c = db.row("SELECT * FROM components WHERE id=?", (cid,))
    if not c:
        raise HTTPException(404, "组件不存在")
    if c["builtin"]:
        raise HTTPException(400, "内置组件不可删除")
    db.execute("DELETE FROM components WHERE id=?", (cid,))
    return {"ok": True}


@router.get("/api/libraries")
def libraries(user: dict = Depends(me)):
    return {
        "label_sets": [{**r, "labels": _json(r["labels"], {})} for r in db.rows("SELECT * FROM label_sets ORDER BY id")],
        "components": [{**r, "schema": _json(r["schema"], {})} for r in db.rows("SELECT * FROM components ORDER BY id")],
        "models": [{**r, "metrics": _json(r["metrics"], {})} for r in db.rows("SELECT * FROM model_registry ORDER BY id")],
    }


# ---------------------------------------------------------------------------
# 问题清单
# ---------------------------------------------------------------------------

@router.get("/api/issues")
def list_issues(task_id: int = 0, project_id: int = 0, status: str = "", user: dict = Depends(me)):
    conds, vals = ["1=1"], []
    if task_id:
        conds.append("i.task_id=?")
        vals.append(task_id)
    if project_id:
        conds.append("i.project_id=?")
        vals.append(project_id)
    if status:
        conds.append("i.status=?")
        vals.append(status)
    items = db.rows(
        "SELECT i.*,u.name assignee_name,c.name created_by_name,t.name task_name FROM issues i"
        " LEFT JOIN users u ON u.id=i.assignee_id LEFT JOIN users c ON c.id=i.created_by"
        " LEFT JOIN tasks t ON t.id=i.task_id WHERE " + " AND ".join(conds) + " ORDER BY i.id DESC LIMIT 300",
        tuple(vals),
    )
    return {"issues": items}


@router.post("/api/tasks/{tid}/issues")
def create_issue(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "问题标题不能为空")
    iid = db.execute(
        "INSERT INTO issues(task_id,project_id,item_type,item_index,title,description,severity,status,assignee_id,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (tid, task["project_id"], body.get("item_type") or "", int(body.get("item_index", -1)),
         title, body.get("description") or "", body.get("severity") or "normal", "open",
         body.get("assignee_id") or task["assignee_id"], user["id"], db.now(), db.now()),
    )
    db.notify(task["assignee_id"], "新增问题项", f"{task['name']} · {title}", "issue", f"#/annotate/{tid}")
    db.log(user["id"], "create_issue", f"task:{tid}", title)
    return {"ok": True, "id": iid}


@router.patch("/api/issues/{iid}")
def update_issue(iid: int, body: dict, user: dict = Depends(me)):
    issue = db.row("SELECT * FROM issues WHERE id=?", (iid,))
    if not issue:
        raise HTTPException(404, "问题不存在")
    db.execute(
        "UPDATE issues SET status=?,severity=?,description=?,updated_at=? WHERE id=?",
        (body.get("status") or issue["status"], body.get("severity") or issue["severity"],
         body.get("description", issue["description"]), db.now(), iid),
    )
    db.log(user["id"], "update_issue", f"issue:{iid}", body.get("status") or "")
    return {"ok": True}


@router.delete("/api/issues/{iid}")
def delete_issue(iid: int, user: dict = Depends(me)):
    db.execute("DELETE FROM issues WHERE id=?", (iid,))
    return {"ok": True}


# ---------------------------------------------------------------------------
# 视频轨迹（关键帧 + 插值）
# ---------------------------------------------------------------------------

@router.get("/api/tasks/{tid}/tracks")
def list_tracks(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    items = db.rows("SELECT * FROM tracks WHERE task_id=? ORDER BY id", (tid,))
    for it in items:
        it["keyframes"] = _json(it["keyframes"], [])
    return {"tracks": items}


@router.post("/api/tasks/{tid}/tracks")
def save_tracks(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    tracks = body.get("tracks") or []
    db.execute("DELETE FROM tracks WHERE task_id=?", (tid,))
    for t in tracks:
        db.execute(
            "INSERT INTO tracks(task_id,track_uid,label,category,keyframes,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
            (tid, t.get("uid") or uuid.uuid4().hex[:8], t.get("label") or "", t.get("category") or "",
             json.dumps(t.get("keyframes") or [], ensure_ascii=False), user["id"], db.now()),
        )
    db.log(user["id"], "save_tracks", f"task:{tid}", f"{len(tracks)} 条轨迹")
    return {"ok": True, "count": len(tracks)}


@router.post("/api/tracks/interpolate")
def interpolate_track(body: dict):
    """按关键帧线性插值，生成逐帧框；前端也可本地计算，此接口保证服务端一致。"""
    frames = sorted(body.get("keyframes") or [], key=lambda x: float(x.get("t") or 0))
    if len(frames) < 2:
        return {"frames": frames}
    step = float(body.get("step") or 1)
    max_t = float(body.get("max_t") or frames[-1]["t"])
    out = []
    t = float(frames[0]["t"])
    idx = 0
    while t <= max_t + 1e-6:
        while idx + 1 < len(frames) and float(frames[idx + 1]["t"]) < t:
            idx += 1
        if idx + 1 >= len(frames):
            break
        a, b = frames[idx], frames[idx + 1]
        ta, tb = float(a["t"]), float(b["t"])
        ratio = 0 if tb == ta else (t - ta) / (tb - ta)
        out.append({
            "t": round(t, 3),
            **{k: round(float(a.get(k, 0)) + (float(b.get(k, 0)) - float(a.get(k, 0))) * ratio, 4)
               for k in ("x", "y", "w", "h", "yaw", "z", "l") if k in a or k in b},
        })
        t += step
    return {"frames": out}


# ---------------------------------------------------------------------------
# 算子中心 / 模型仓库 / 规则质检
# ---------------------------------------------------------------------------

@router.get("/api/operators")
def list_operators(user: dict = Depends(me)):
    items = db.rows("SELECT * FROM operators ORDER BY id")
    for it in items:
        for k in ("headers", "input_map", "output_map"):
            it[k] = _json(it[k], {})
    return {"operators": items}


@router.post("/api/operators")
def create_operator(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "算子名称不能为空")
    code = body.get("code") or f"op-{uuid.uuid4().hex[:6]}"
    oid = db.execute(
        "INSERT INTO operators(code,name,kind,modality,endpoint,method,headers,input_map,output_map,timeout,enabled,description,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (code, name, body.get("kind") or "http", body.get("modality") or "", body.get("endpoint") or "",
         (body.get("method") or "POST").upper(), json.dumps(body.get("headers") or {}, ensure_ascii=False),
         json.dumps(body.get("input_map") or {}, ensure_ascii=False), json.dumps(body.get("output_map") or {}, ensure_ascii=False),
         int(body.get("timeout") or 30), 1 if body.get("enabled", True) else 0, body.get("description") or "",
         user["id"], db.now(), db.now()),
    )
    return {"ok": True, "id": oid, "code": code}


@router.patch("/api/operators/{oid}")
def update_operator(oid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    o = db.row("SELECT * FROM operators WHERE id=?", (oid,))
    if not o:
        raise HTTPException(404, "算子不存在")
    db.execute(
        "UPDATE operators SET name=?,kind=?,modality=?,endpoint=?,method=?,headers=?,input_map=?,output_map=?,"
        "timeout=?,enabled=?,description=?,updated_at=? WHERE id=?",
        (body.get("name") or o["name"], body.get("kind") or o["kind"], body.get("modality", o["modality"]),
         body.get("endpoint", o["endpoint"]), (body.get("method") or o["method"]).upper(),
         json.dumps(body.get("headers") or _json(o["headers"], {}), ensure_ascii=False),
         json.dumps(body.get("input_map") or _json(o["input_map"], {}), ensure_ascii=False),
         json.dumps(body.get("output_map") or _json(o["output_map"], {}), ensure_ascii=False),
         int(body.get("timeout") or o["timeout"]), int(body.get("enabled", o["enabled"])),
         body.get("description", o["description"]), db.now(), oid),
    )
    return {"ok": True}


def _dig(obj: Any, path: str) -> Any:
    cur = obj
    for part in (path or "").split("."):
        if not part:
            continue
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


@router.post("/api/operators/{oid}/run")
def run_operator(oid: int, body: dict, user: dict = Depends(me)):
    op = db.row("SELECT * FROM operators WHERE id=?", (oid,))
    if not op:
        raise HTTPException(404, "算子不存在")
    if not op["endpoint"]:
        raise HTTPException(400, "该算子尚未配置服务地址，请在算子中心填写 endpoint")
    task = _task(int(body.get("task_id") or 0), user) if body.get("task_id") else None
    payload = dict(body.get("input") or {})
    if task and "file" not in payload:
        payload["file"] = f"/media/{os.path.basename(task['media_path'] or '')}"
        payload["task_id"] = task["id"]
    data = json.dumps(payload, ensure_ascii=False).encode()
    headers = _json(op["headers"], {})
    headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(op["endpoint"], data=data if op["method"] != "GET" else None, headers=headers, method=op["method"])
    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=max(1, int(op["timeout"]))) as resp:  # noqa: S310 平台配置的可信算子
            raw = resp.read(2 * 1024 * 1024).decode("utf-8", "ignore")
            status = resp.status
    except urllib.error.HTTPError as exc:
        raw = exc.read(2000).decode("utf-8", "ignore")
        status = exc.code
    except Exception as exc:  # noqa: BLE001
        latency = int((time.time() - start) * 1000)
        db.execute(
            "INSERT INTO operator_runs(operator_id,task_id,status,request,response,latency_ms,created_by,created_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (oid, body.get("task_id"), "error", json.dumps(payload, ensure_ascii=False),
             json.dumps({"error": str(exc)[:400]}, ensure_ascii=False), latency, user["id"], db.now()),
        )
        raise HTTPException(502, f"算子调用失败：{str(exc)[:200]}") from exc
    latency = int((time.time() - start) * 1000)
    try:
        parsed = json.loads(raw)
    except ValueError:
        parsed = {"raw": raw[:2000]}
    mapped = {}
    for key, path in _json(op["output_map"], {}).items():
        value = _dig(parsed, path)
        if value is not None:
            mapped[key] = value
    db.execute(
        "INSERT INTO operator_runs(operator_id,task_id,status,request,response,latency_ms,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (oid, body.get("task_id"), "ok" if status < 400 else "error", json.dumps(payload, ensure_ascii=False),
         json.dumps(parsed, ensure_ascii=False)[:20000], latency, user["id"], db.now()),
    )
    return {"ok": status < 400, "status": status, "latency_ms": latency, "response": parsed, "mapped": mapped}


@router.get("/api/operators/runs")
def operator_runs(operator_id: int = 0, limit: int = 50, user: dict = Depends(me)):
    conds, vals = ["1=1"], []
    if operator_id:
        conds.append("r.operator_id=?")
        vals.append(operator_id)
    items = db.rows(
        "SELECT r.*,o.name operator_name,u.name created_by_name FROM operator_runs r"
        " LEFT JOIN operators o ON o.id=r.operator_id LEFT JOIN users u ON u.id=r.created_by"
        " WHERE " + " AND ".join(conds) + " ORDER BY r.id DESC LIMIT ?",
        tuple(vals + [max(1, min(200, limit))]),
    )
    for it in items:
        it["request"] = _json(it["request"], {})
        it["response"] = _json(it["response"], {})
    return {"runs": items}


@router.get("/api/models")
def list_models(user: dict = Depends(me)):
    items = db.rows("SELECT * FROM model_registry ORDER BY id")
    for it in items:
        it["metrics"] = _json(it["metrics"], {})
        it["config"] = _json(it["config"], {})
    return {"models": items}


@router.post("/api/models")
def create_model(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "模型名称不能为空")
    mid = db.execute(
        "INSERT INTO model_registry(name,kind,provider,endpoint,version,status,metrics,config,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)",
        (name, body.get("kind") or "detection", body.get("provider") or "local", body.get("endpoint") or "",
         body.get("version") or "", body.get("status") or "active",
         json.dumps(body.get("metrics") or {}, ensure_ascii=False),
         json.dumps(body.get("config") or {}, ensure_ascii=False), db.now(), db.now()),
    )
    return {"ok": True, "id": mid}


@router.patch("/api/models/{mid}")
def update_model(mid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    m = db.row("SELECT * FROM model_registry WHERE id=?", (mid,))
    if not m:
        raise HTTPException(404, "模型不存在")
    db.execute(
        "UPDATE model_registry SET name=?,kind=?,provider=?,endpoint=?,version=?,status=?,metrics=?,config=?,updated_at=? WHERE id=?",
        (body.get("name") or m["name"], body.get("kind") or m["kind"], body.get("provider", m["provider"]),
         body.get("endpoint", m["endpoint"]), body.get("version", m["version"]), body.get("status", m["status"]),
         json.dumps(body.get("metrics") or _json(m["metrics"], {}), ensure_ascii=False),
         json.dumps(body.get("config") or _json(m["config"], {}), ensure_ascii=False), db.now(), mid),
    )
    return {"ok": True}


@router.get("/api/quality/rules")
def list_rules(project_id: int = 0, user: dict = Depends(me)):
    conds, vals = ["1=1"], []
    if project_id:
        conds.append("(project_id=? OR project_id IS NULL)")
        vals.append(project_id)
    items = db.rows("SELECT * FROM quality_rules WHERE " + " AND ".join(conds) + " ORDER BY id", tuple(vals))
    for it in items:
        it["config"] = _json(it["config"], {})
    return {"rules": items}


@router.post("/api/quality/rules")
def create_rule(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "规则名称不能为空")
    rid = db.execute(
        "INSERT INTO quality_rules(project_id,name,modality,config,enabled,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
        (int(body.get("project_id") or 0) or None, name, body.get("modality") or "",
         json.dumps(body.get("config") or {}, ensure_ascii=False), 1 if body.get("enabled", True) else 0,
         user["id"], db.now()),
    )
    return {"ok": True, "id": rid}


@router.patch("/api/quality/rules/{rid}")
def update_rule(rid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    r = db.row("SELECT * FROM quality_rules WHERE id=?", (rid,))
    if not r:
        raise HTTPException(404, "规则不存在")
    db.execute(
        "UPDATE quality_rules SET name=?,modality=?,config=?,enabled=? WHERE id=?",
        (body.get("name") or r["name"], body.get("modality", r["modality"]),
         json.dumps(body.get("config") or _json(r["config"], {}), ensure_ascii=False),
         int(body.get("enabled", r["enabled"])), rid),
    )
    return {"ok": True}


def _rule_items(payload: dict) -> list[dict]:
    for key in ("boxes", "segments", "spans", "messages", "rows", "intervals", "points", "tracks"):
        if isinstance(payload.get(key), list) and payload[key]:
            return payload[key]
    return []


def evaluate_rules(task: dict, payload: dict, rules: list[dict]) -> dict:
    items = _rule_items(payload)
    violations = []
    dims = {"完整性": 100, "规范性": 100, "准确性": 100}
    for rule in rules:
        cfg = rule["config"]
        modality = rule["modality"]
        if modality and modality != task.get("media_type") and modality != task.get("modality"):
            continue
        if len(items) < int(cfg.get("min_count") or 0):
            violations.append({"rule": rule["name"], "level": "error", "message": f"标注数量 {len(items)} 少于要求 {cfg.get('min_count')}"})
            dims["完整性"] -= 30
        for field in cfg.get("require_non_empty") or []:
            missing = [i for i, it in enumerate(items) if not str(it.get(field) or "").strip()]
            if missing:
                violations.append({
                    "rule": rule["name"], "level": "error",
                    "message": f"存在 {len(missing)} 条缺少字段 {field}",
                    "items": missing[:20],
                })
                dims["规范性"] -= min(30, 5 * len(missing))
        max_gap = float(cfg.get("max_gap") or 0)
        if max_gap and payload.get("segments"):
            segs = sorted(payload["segments"], key=lambda x: float(x.get("start") or 0))
            gaps = []
            for a, b in zip(segs, segs[1:]):
                gap = float(b.get("start") or 0) - float(a.get("end") or 0)
                if gap > max_gap:
                    gaps.append(round(gap, 2))
            if gaps:
                violations.append({"rule": rule["name"], "level": "warn", "message": f"存在 {len(gaps)} 处超过 {max_gap}s 的空隙", "gaps": gaps[:10]})
                dims["准确性"] -= min(20, 3 * len(gaps))
        min_conf = float(cfg.get("min_conf") or 0)
        if min_conf:
            low = [i for i, it in enumerate(items) if isinstance(it.get("conf"), (int, float)) and it["conf"] < min_conf]
            if low:
                violations.append({"rule": rule["name"], "level": "warn", "message": f"{len(low)} 条置信度低于 {min_conf}", "items": low[:20]})
                dims["准确性"] -= min(20, 3 * len(low))
    for k in dims:
        dims[k] = max(0, dims[k])
    score = round(sum(dims.values()) / max(1, len(dims)))
    return {"score": score, "dims": dims, "violations": violations, "item_count": len(items)}


@router.post("/api/tasks/{tid}/qc/rules/run")
def run_rules(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    if not ann:
        raise HTTPException(400, "任务尚无标注结果")
    rules = db.rows(
        "SELECT * FROM quality_rules WHERE enabled=1 AND (project_id=? OR project_id IS NULL)", (task["project_id"],)
    )
    for r in rules:
        r["config"] = _json(r["config"], {})
    result = evaluate_rules(task, _json(ann["payload"], {}), rules)
    result["task_id"] = tid
    return result


@router.get("/api/prelabel/stats")
def prelabel_stats(project_id: int = 0, user: dict = Depends(me)):
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"stats": {}}
    marks = ",".join("?" * len(ids))
    conds = [f"a.task_id IN (SELECT id FROM tasks WHERE project_id IN ({marks}))"]
    vals: list = list(ids)
    if project_id:
        conds.append("t.project_id=?")
        vals.append(project_id)
    rows_ = db.rows(
        "SELECT a.task_id,a.prelabel,a.payload,t.project_id,t.media_type FROM annotations a"
        " JOIN tasks t ON t.id=a.task_id WHERE " + " AND ".join(conds),
        tuple(vals),
    )
    suggested = kept = confirmed = runs = 0
    per_project: dict[int, dict] = {}
    for r in rows_:
        pre = _json(r["prelabel"], {})
        pay = _json(r["payload"], {})
        pre_boxes = pre.get("boxes") or []
        boxes = pay.get("boxes") or []
        if pre_boxes:
            runs += 1
            suggested += len(pre_boxes)
            ai_kept = [b for b in boxes if b.get("source") == "ai" or isinstance(b.get("conf"), (int, float))]
            kept += len(ai_kept)
        if pre.get("segments"):
            runs += 1
            suggested += len(pre["segments"])
            kept += len(pay.get("segments") or [])
        if boxes or pay.get("segments"):
            confirmed += 1
        p = per_project.setdefault(r["project_id"], {"runs": 0, "suggested": 0, "kept": 0})
        p["runs"] += 1
        p["suggested"] += len(pre_boxes) + len(pre.get("segments") or [])
        p["kept"] += len(boxes) + len(pay.get("segments") or [])
    projects = {p["id"]: p["name"] for p in db.rows("SELECT id,name FROM projects")}
    return {
        "stats": {
            "runs": runs,
            "suggested": suggested,
            "kept": kept,
            "acceptance_rate": round(kept / suggested * 100, 1) if suggested else 0,
            "confirmed_tasks": confirmed,
            "total_tasks": len({r["task_id"] for r in rows_}),
        },
        "by_project": [
            {"project_id": k, "project_name": projects.get(k, str(k)), **v,
             "acceptance_rate": round(v["kept"] / v["suggested"] * 100, 1) if v["suggested"] else 0}
            for k, v in per_project.items()
        ],
    }


@router.get("/api/help/articles")
def help_articles(q: str = "", category: str = ""):
    conds, vals = ["1=1"], []
    if q:
        conds.append("(title LIKE ? OR body LIKE ?)")
        vals.extend([f"%{q}%", f"%{q}%"])
    if category:
        conds.append("category=?")
        vals.append(category)
    items = db.rows("SELECT * FROM help_articles WHERE " + " AND ".join(conds) + " ORDER BY sort,id", tuple(vals))
    cats = [r["category"] for r in db.rows("SELECT DISTINCT category FROM help_articles ORDER BY category")]
    return {"articles": items, "categories": cats}
