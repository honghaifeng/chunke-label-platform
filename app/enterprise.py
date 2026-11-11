"""企业级能力：多租户/组织/团队/RBAC、数据集、模板中心、工作流、开放接口与安全监控。"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import os
import secrets
import shutil
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from . import auth, db

router = APIRouter()

VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv", ".avi"}
POINTCLOUD_EXT = {".pcd", ".ply", ".bin", ".las", ".laz"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


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


def _visible_projects(user: dict) -> list[int]:
    return auth.visible_project_ids(user)


def _assert_project(user: dict, project_id: int, write: bool = False) -> dict:
    project = db.row("SELECT * FROM projects WHERE id=?", (project_id,))
    if not project:
        raise HTTPException(404, "项目不存在")
    if auth.is_admin(user):
        return project
    if project_id not in _visible_projects(user):
        raise HTTPException(403, "无权访问该项目")
    if write and auth.project_role(user, project_id) != "manager":
        raise HTTPException(403, "仅项目管理者可执行该操作")
    return project


# ---------------------------------------------------------------------------
# 组织架构 / 团队 / RBAC
# ---------------------------------------------------------------------------

@router.get("/api/org/tree")
def org_tree(user: dict = Depends(me)):
    auth.require_perm(user, "org.read")
    tenants = db.rows("SELECT * FROM tenants ORDER BY id")
    orgs = db.rows("SELECT * FROM orgs ORDER BY id")
    teams = db.rows("SELECT * FROM teams ORDER BY id")
    members = db.rows(
        "SELECT id,username,name,platform_role,status,tenant_id,org_id,team_id FROM users ORDER BY id"
    )
    for m in members:
        m["role_label"] = auth.PLATFORM_ROLES.get(m["platform_role"], m["platform_role"])
    team_members = db.rows(
        "SELECT tm.team_id,tm.team_role,u.id,u.name,u.username FROM team_members tm"
        " JOIN users u ON u.id=tm.user_id ORDER BY u.id"
    )
    team_map: dict[int, list] = {}
    for tm in team_members:
        team_map.setdefault(tm["team_id"], []).append(tm)
    for t in teams:
        t["leader_name"] = (db.row("SELECT name FROM users WHERE id=?", (t["leader_id"],)) or {}).get("name", "")
        t["members"] = team_map.get(t["id"], [])
        t["member_count"] = len(t["members"])
    org_map: dict[int, list] = {}
    for t in teams:
        org_map.setdefault(t["org_id"], []).append(t)
    for o in orgs:
        o["teams"] = org_map.get(o["id"], [])
        o["manager_name"] = (db.row("SELECT name FROM users WHERE id=?", (o["manager_id"],)) or {}).get("name", "")
        o["member_count"] = sum(1 for m in members if m["org_id"] == o["id"])
    tmap: dict[int, list] = {}
    for o in orgs:
        tmap.setdefault(o["tenant_id"], []).append(o)
    for t in tenants:
        t["orgs"] = tmap.get(t["id"], [])
        t["member_count"] = sum(1 for m in members if m["tenant_id"] == t["id"])
    return {"tenants": tenants, "members": members, "teams": teams}


@router.post("/api/tenants")
def create_tenant(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    name = (body.get("name") or "").strip()
    code = (body.get("code") or f"tenant-{uuid.uuid4().hex[:6]}").strip()
    if not name:
        raise HTTPException(400, "租户名称不能为空")
    if db.row("SELECT id FROM tenants WHERE code=?", (code,)):
        raise HTTPException(400, "租户编码已存在")
    tid = db.execute(
        "INSERT INTO tenants(code,name,status,created_at) VALUES(?,?,?,?)", (code, name, "active", db.now())
    )
    db.log(user["id"], "create_tenant", f"tenant:{tid}", name)
    return {"ok": True, "id": tid}


@router.post("/api/orgs")
def create_org(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    tenant_id = int(body.get("tenant_id") or 0)
    if not db.row("SELECT id FROM tenants WHERE id=?", (tenant_id,)):
        raise HTTPException(400, "请选择有效租户")
    name = (body.get("name") or "").strip()
    code = (body.get("code") or f"org-{uuid.uuid4().hex[:6]}").strip()
    if not name:
        raise HTTPException(400, "组织名称不能为空")
    if db.row("SELECT id FROM orgs WHERE tenant_id=? AND code=?", (tenant_id, code)):
        raise HTTPException(400, "该租户下组织编码已存在")
    oid = db.execute(
        "INSERT INTO orgs(tenant_id,code,name,parent_id,manager_id,status,created_at) VALUES(?,?,?,?,?,?,?)",
        (
            tenant_id,
            code,
            name,
            int(body.get("parent_id") or 0) or None,
            int(body.get("manager_id") or 0) or None,
            "active",
            db.now(),
        ),
    )
    db.log(user["id"], "create_org", f"org:{oid}", name)
    return {"ok": True, "id": oid}


@router.post("/api/teams")
def create_team(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    org_id = int(body.get("org_id") or 0)
    org = db.row("SELECT * FROM orgs WHERE id=?", (org_id,))
    if not org:
        raise HTTPException(400, "请选择有效组织")
    name = (body.get("name") or "").strip()
    code = (body.get("code") or f"team-{uuid.uuid4().hex[:6]}").strip()
    if not name:
        raise HTTPException(400, "团队名称不能为空")
    if db.row("SELECT id FROM teams WHERE org_id=? AND code=?", (org_id, code)):
        raise HTTPException(400, "该组织下团队编码已存在")
    tid = db.execute(
        "INSERT INTO teams(org_id,code,name,leader_id,description,status,created_at) VALUES(?,?,?,?,?,?,?)",
        (
            org_id,
            code,
            name,
            int(body.get("leader_id") or 0) or None,
            body.get("description") or "",
            "active",
            db.now(),
        ),
    )
    db.log(user["id"], "create_team", f"team:{tid}", name)
    return {"ok": True, "id": tid}


@router.post("/api/teams/{tid}/members")
def add_team_member(tid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    if not db.row("SELECT id FROM teams WHERE id=?", (tid,)):
        raise HTTPException(404, "团队不存在")
    uid = int(body.get("user_id") or 0)
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(404, "成员不存在")
    role = body.get("team_role") or "member"
    if role not in ("leader", "member"):
        raise HTTPException(400, "团队角色只能是 leader 或 member")
    db.execute("INSERT OR REPLACE INTO team_members(team_id,user_id,team_role) VALUES(?,?,?)", (tid, uid, role))
    db.execute("UPDATE users SET team_id=? WHERE id=?", (tid, uid))
    db.log(user["id"], "add_team_member", f"team:{tid}", f"user:{uid} -> {role}")
    return {"ok": True}


@router.patch("/api/org/users/{uid}")
def update_user_scope(uid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    target = db.row("SELECT * FROM users WHERE id=?", (uid,))
    if not target:
        raise HTTPException(404, "成员不存在")
    tenant_id = int(body.get("tenant_id") or target["tenant_id"] or 0) or None
    org_id = int(body.get("org_id") or target["org_id"] or 0) or None
    team_id = int(body.get("team_id") or 0) or None
    db.execute("UPDATE users SET tenant_id=?, org_id=?, team_id=? WHERE id=?", (tenant_id, org_id, team_id, uid))
    if team_id:
        db.execute(
            "INSERT OR REPLACE INTO team_members(team_id,user_id,team_role) VALUES(?,?,?)",
            (team_id, uid, "member"),
        )
    db.log(user["id"], "update_user_scope", f"user:{uid}", f"org:{org_id}/team:{team_id}")
    return {"ok": True}


@router.get("/api/rbac/matrix")
def rbac_matrix(user: dict = Depends(me)):
    auth.require_perm(user, "org.read")
    rows = db.rows("SELECT role,permission FROM role_permissions")
    matrix: dict[str, dict[str, bool]] = {role: {} for role in auth.PLATFORM_ROLES}
    for r in rows:
        matrix.setdefault(r["role"], {})[r["permission"]] = True
    return {
        "roles": [{"key": k, "label": v} for k, v in auth.PLATFORM_ROLES.items()],
        "permissions": [{"key": k, "label": v} for k, v in db.PERMISSIONS.items()],
        "matrix": matrix,
    }


@router.post("/api/rbac/matrix")
def save_rbac_matrix(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    role = body.get("role") or ""
    perm = body.get("permission") or ""
    if role not in auth.PLATFORM_ROLES:
        raise HTTPException(400, "非法角色")
    if perm not in db.PERMISSIONS:
        raise HTTPException(400, "非法权限点")
    allowed = bool(body.get("allowed"))
    if allowed:
        db.execute("INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)", (role, perm))
    else:
        db.execute("DELETE FROM role_permissions WHERE role=? AND permission=?", (role, perm))
    db.log(user["id"], "save_rbac", f"role:{role}", f"{perm}={allowed}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 数据集：导入 / 预览 / 版本 / 导出
# ---------------------------------------------------------------------------

def _dataset_stats(ds: dict) -> dict:
    ds = dict(ds)
    latest = db.row(
        "SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds["id"],)
    )
    ds["version_count"] = (db.row("SELECT COUNT(*) c FROM dataset_versions WHERE dataset_id=?", (ds["id"],)) or {}).get("c", 0)
    ds["item_count"] = (db.row("SELECT COUNT(*) c FROM dataset_items WHERE dataset_id=?", (ds["id"],)) or {}).get("c", 0)
    ds["latest_version"] = latest["version"] if latest else 0
    ds["latest_version_id"] = latest["id"] if latest else 0
    ds["size"] = (db.row("SELECT COALESCE(SUM(size),0) s FROM dataset_items WHERE dataset_id=?", (ds["id"],)) or {}).get("s", 0)
    ds["project_name"] = (db.row("SELECT name FROM projects WHERE id=?", (ds["project_id"],)) or {}).get("name", "")
    ds["modality_label"] = db.MODALITY_LABEL.get(ds["modality"], ds["modality"])
    return ds


def _dataset_or_404(ds_id: int, user: dict) -> dict:
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"] and not auth.is_admin(user):
        if ds["project_id"] not in _visible_projects(user):
            raise HTTPException(403, "无权访问该数据集")
    return ds


@router.get("/api/datasets")
def list_datasets(project_id: int = 0, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    items = db.rows("SELECT * FROM datasets ORDER BY id")
    if not auth.is_admin(user):
        ids = set(_visible_projects(user))
        items = [d for d in items if not d["project_id"] or d["project_id"] in ids]
    if project_id:
        items = [d for d in items if d["project_id"] == project_id]
    return {"datasets": [_dataset_stats(d) for d in items]}


@router.post("/api/datasets")
def create_dataset(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.write")
    name = (body.get("name") or "").strip()
    project_id = int(body.get("project_id") or 0) or None
    if not name:
        raise HTTPException(400, "数据集名称不能为空")
    project = _assert_project(user, project_id, write=True) if project_id else None
    modality = body.get("modality") or (project["modality"] if project else "audio")
    code = (body.get("code") or f"ds-{uuid.uuid4().hex[:6]}").strip()
    if db.row("SELECT id FROM datasets WHERE code=?", (code,)):
        raise HTTPException(400, "数据集编码已存在")
    ds_id = db.execute(
        "INSERT INTO datasets(tenant_id,project_id,code,name,modality,description,status,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)",
        (
            user.get("tenant_id"),
            project_id,
            code,
            name,
            modality,
            body.get("description") or "",
            "active",
            user["id"],
            db.now(),
            db.now(),
        ),
    )
    db.log(user["id"], "create_dataset", f"dataset:{ds_id}", name)
    return {"ok": True, "id": ds_id}


@router.get("/api/datasets/{ds_id}")
def dataset_detail(ds_id: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    ds = _dataset_or_404(ds_id, user)
    versions = db.rows(
        "SELECT v.*,u.name creator_name FROM dataset_versions v LEFT JOIN users u ON u.id=v.created_by"
        " WHERE v.dataset_id=? ORDER BY v.version DESC",
        (ds_id,),
    )
    items = db.rows(
        "SELECT i.*,t.status task_status FROM dataset_items i LEFT JOIN tasks t ON t.id=i.task_id"
        " WHERE i.dataset_id=? ORDER BY i.id DESC LIMIT 300",
        (ds_id,),
    )
    for it in items:
        it["media_name"] = os.path.basename(it["media_path"] or "")
        it["media_type_label"] = db.MODALITY_LABEL.get(it["media_type"], it["media_type"])
    detail = _dataset_stats(ds)
    detail["versions"] = versions
    detail["items"] = items
    detail["by_type"] = [
        {"name": db.MODALITY_LABEL.get(r["media_type"], r["media_type"]), "value": r["c"]}
        for r in db.rows(
            "SELECT media_type,COUNT(*) c FROM dataset_items WHERE dataset_id=? GROUP BY media_type", (ds_id,)
        )
    ]
    return detail


@router.post("/api/datasets/{ds_id}/import")
def import_dataset_items(ds_id: int, body: dict, user: dict = Depends(me)):
    """从项目任务批量导入：可选择任务 ID，也可按项目+状态全量导入。"""
    auth.require_perm(user, "dataset.write")
    ds = _dataset_or_404(ds_id, user)
    if not ds["project_id"]:
        raise HTTPException(400, "该数据集未绑定项目，无法从任务导入")
    _assert_project(user, ds["project_id"], write=True)
    ids = [int(x) for x in (body.get("task_ids") or []) if str(x).isdigit()]
    if ids:
        marks = ",".join("?" * len(ids))
        tasks = db.rows(f"SELECT * FROM tasks WHERE project_id=? AND id IN ({marks})", (ds["project_id"], *ids))
    else:
        status = (body.get("status") or "").strip()
        if status:
            tasks = db.rows("SELECT * FROM tasks WHERE project_id=? AND status=?", (ds["project_id"], status))
        else:
            tasks = db.rows("SELECT * FROM tasks WHERE project_id=?", (ds["project_id"],))
    latest = db.row(
        "SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds_id,)
    )
    if latest:
        version_id = latest["id"]
    else:
        version_id = db.execute(
            "INSERT INTO dataset_versions(dataset_id,version,note,item_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
            (ds_id, 1, "初始版本", 0, user["id"], db.now()),
        )
    existing = {r["task_id"] for r in db.rows("SELECT task_id FROM dataset_items WHERE dataset_id=?", (ds_id,))}
    added = 0
    for t in tasks:
        if t["id"] in existing or not t["media_path"]:
            continue
        size = 0
        try:
            size = os.path.getsize(t["media_path"])
        except OSError:
            pass
        db.execute(
            "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (
                ds_id,
                version_id,
                t["id"],
                t["name"],
                t["media_path"],
                t["media_type"],
                size,
                json.dumps({"batch": t["batch"], "duration": t["duration"]}, ensure_ascii=False),
                db.now(),
            ),
        )
        db.execute("UPDATE tasks SET dataset_id=? WHERE id=?", (ds_id, t["id"]))
        added += 1
    total = (db.row("SELECT COUNT(*) c FROM dataset_items WHERE dataset_id=?", (ds_id,)) or {}).get("c", 0)
    db.execute("UPDATE dataset_versions SET item_count=? WHERE id=?", (total, version_id))
    db.execute("UPDATE datasets SET updated_at=? WHERE id=?", (db.now(), ds_id))
    db.log(user["id"], "import_dataset", f"dataset:{ds_id}", f"新增 {added} 条，共 {total} 条")
    return {"ok": True, "added": added, "total": total, "version": latest["version"] if latest else 1}


@router.post("/api/datasets/{ds_id}/upload")
async def upload_dataset_item(
    ds_id: int,
    file: UploadFile = File(...),
    create_task: str = Form("1"),
    user: dict = Depends(me),
):
    auth.require_perm(user, "dataset.write")
    ds = _dataset_or_404(ds_id, user)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext in IMAGE_EXT:
        kind = "image"
    elif ext in VIDEO_EXT:
        kind = "video"
    elif ext in POINTCLOUD_EXT:
        kind = "pointcloud"
    else:
        kind = "audio"
    name = f"ds{ds_id}-{uuid.uuid4().hex[:8]}{ext or '.bin'}"
    out_path = os.path.join(db.MEDIA_DIR, name)
    with open(out_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(out_path)
    latest = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds_id,))
    if latest:
        version_id = latest["id"]
    else:
        version_id = db.execute(
            "INSERT INTO dataset_versions(dataset_id,version,note,item_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
            (ds_id, 1, "初始版本", 0, user["id"], db.now()),
        )
    task_id = None
    if ds["project_id"] and create_task in ("1", "true", "on"):
        task_id = db.execute(
            "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,priority,batch,"
            "workflow_id,dataset_id,qc_required,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                ds["project_id"],
                os.path.splitext(file.filename or name)[0],
                out_path,
                kind,
                0,
                "pending",
                "normal",
                "数据集导入",
                (db.row("SELECT id FROM workflows WHERE project_id=? LIMIT 1", (ds["project_id"],)) or {}).get("id"),
                ds_id,
                1,
                db.now(),
                db.now(),
            ),
        )
    item_id = db.execute(
        "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (
            ds_id,
            version_id,
            task_id,
            os.path.splitext(file.filename or name)[0],
            out_path,
            kind,
            size,
            json.dumps({"source": "upload", "filename": file.filename}, ensure_ascii=False),
            db.now(),
        ),
    )
    total = (db.row("SELECT COUNT(*) c FROM dataset_items WHERE dataset_id=?", (ds_id,)) or {}).get("c", 0)
    db.execute("UPDATE dataset_versions SET item_count=? WHERE id=?", (total, version_id))
    db.execute("UPDATE datasets SET updated_at=? WHERE id=?", (db.now(), ds_id))
    db.log(user["id"], "upload_dataset_item", f"dataset:{ds_id}", f"{name} · {size}B")
    return {"ok": True, "id": item_id, "task_id": task_id, "size": size, "total": total}


@router.post("/api/datasets/{ds_id}/versions")
def create_dataset_version(ds_id: int, body: dict, user: dict = Depends(me)):
    """基于当前数据生成新版本快照。"""
    auth.require_perm(user, "dataset.write")
    ds = _dataset_or_404(ds_id, user)
    if ds["project_id"]:
        _assert_project(user, ds["project_id"], write=True)
    latest = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds_id,))
    next_v = (latest["version"] + 1) if latest else 1
    items = db.rows("SELECT * FROM dataset_items WHERE dataset_id=? ORDER BY id", (ds_id,))
    ver_id = db.execute(
        "INSERT INTO dataset_versions(dataset_id,version,note,item_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
        (ds_id, next_v, body.get("note") or f"v{next_v} 快照", len(items), user["id"], db.now()),
    )
    for it in items:
        db.execute(
            "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (
                ds_id,
                ver_id,
                it["task_id"],
                it["name"],
                it["media_path"],
                it["media_type"],
                it["size"],
                it["meta"],
                db.now(),
            ),
        )
    db.execute("UPDATE datasets SET updated_at=? WHERE id=?", (db.now(), ds_id))
    db.log(user["id"], "create_dataset_version", f"dataset:{ds_id}", f"v{next_v} · {len(items)} 条")
    return {"ok": True, "version": next_v, "item_count": len(items)}


@router.get("/api/datasets/{ds_id}/export")
def export_dataset(ds_id: int, version: int = 0, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    ds = _dataset_or_404(ds_id, user)
    sql = "SELECT * FROM dataset_items WHERE dataset_id=?"
    args: tuple = (ds_id,)
    if version:
        ver = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? AND version=?", (ds_id, version))
        if not ver:
            raise HTTPException(404, "版本不存在")
        sql += " AND version_id=?"
        args += (ver["id"],)
    items = db.rows(sql + " ORDER BY id", args)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["item_id", "name", "media", "media_type", "size", "task_id", "created_at"])
    for it in items:
        writer.writerow(
            [it["id"], it["name"], os.path.basename(it["media_path"]), it["media_type"], it["size"], it["task_id"], it["created_at"]]
        )
    db.log(user["id"], "export_dataset", f"dataset:{ds_id}", f"v{version or 'all'} · {len(items)} 条")
    filename = f"{ds['code']}-v{version or 'all'}.csv"
    return Response(
        content="\ufeff" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# 模板中心
# ---------------------------------------------------------------------------

def _template_dict(t: dict) -> dict:
    t = dict(t)
    t["labels"] = _json(t.pop("label_config", "{}"), {})
    t["qc"] = _json(t.pop("qc_config", "{}"), {})
    t["modality_label"] = db.MODALITY_LABEL.get(t["modality"], t["modality"])
    t["usage"] = (db.row("SELECT COUNT(*) c FROM projects WHERE template_id=?", (t["id"],)) or {}).get("c", 0)
    return t


@router.get("/api/templates")
def list_templates(user: dict = Depends(me)):
    auth.require_perm(user, "template.read")
    return {"templates": [_template_dict(t) for t in db.rows("SELECT * FROM templates ORDER BY id")]}


@router.post("/api/templates")
def create_template(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    name = (body.get("name") or "").strip()
    modality = body.get("modality") or "audio"
    if not name:
        raise HTTPException(400, "模板名称不能为空")
    code = (body.get("code") or f"tpl-{uuid.uuid4().hex[:6]}").strip()
    if db.row("SELECT id FROM templates WHERE code=?", (code,)):
        raise HTTPException(400, "模板编码已存在")
    labels = body.get("labels") or db.DEFAULT_LABELS.get(modality, {})
    tid = db.execute(
        "INSERT INTO templates(code,name,modality,description,label_config,qc_config,instruction,builtin,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)",
        (
            code,
            name,
            modality,
            body.get("description") or "",
            json.dumps(labels, ensure_ascii=False),
            json.dumps(body.get("qc") or {}, ensure_ascii=False),
            body.get("instruction") or "",
            0,
            user["id"],
            db.now(),
        ),
    )
    db.log(user["id"], "create_template", f"template:{tid}", name)
    return {"ok": True, "id": tid}


@router.patch("/api/templates/{tid}")
def update_template(tid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    tpl = db.row("SELECT * FROM templates WHERE id=?", (tid,))
    if not tpl:
        raise HTTPException(404, "模板不存在")
    labels = body.get("labels", _json(tpl["label_config"], {}))
    qc = body.get("qc", _json(tpl["qc_config"], {}))
    db.execute(
        "UPDATE templates SET name=?, description=?, instruction=?, label_config=?, qc_config=? WHERE id=?",
        (
            body.get("name") or tpl["name"],
            body.get("description", tpl["description"]),
            body.get("instruction", tpl["instruction"]),
            json.dumps(labels, ensure_ascii=False),
            json.dumps(qc, ensure_ascii=False),
            tid,
        ),
    )
    db.log(user["id"], "update_template", f"template:{tid}", body.get("name") or tpl["name"])
    from . import workbench

    workbench.snapshot_template(tid, user, body.get("note") or "模板更新自动快照")
    return {"ok": True}


@router.post("/api/projects/{pid}/apply-template")
def apply_template(pid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "project.write")
    project = _assert_project(user, pid, write=True)
    tpl = db.row("SELECT * FROM templates WHERE id=?", (int(body.get("template_id") or 0),))
    if not tpl:
        raise HTTPException(400, "请选择有效模板")
    db.execute(
        "UPDATE projects SET template_id=?, label_config=?, engine=? WHERE id=?",
        (
            tpl["id"],
            tpl["label_config"],
            body.get("engine") or project["engine"],
            pid,
        ),
    )
    wf = db.row("SELECT id FROM workflows WHERE project_id=? ORDER BY id LIMIT 1", (pid,))
    if wf:
        db.execute("UPDATE workflows SET template_id=?, qc_policy=? WHERE id=?", (tpl["id"], tpl["qc_config"], wf["id"]))
    db.log(user["id"], "apply_template", f"project:{pid}", tpl["name"])
    return {"ok": True, "template": _template_dict(tpl)}


# ---------------------------------------------------------------------------
# 工作流 / 质检策略
# ---------------------------------------------------------------------------

def _workflow_dict(w: dict) -> dict:
    w = dict(w)
    w["steps"] = _json(w.get("steps"), [])
    w["qc_policy"] = _json(w.get("qc_policy"), {})
    w["project_name"] = (db.row("SELECT name FROM projects WHERE id=?", (w["project_id"],)) or {}).get("name", "")
    w["template_name"] = (db.row("SELECT name FROM templates WHERE id=?", (w["template_id"],)) or {}).get("name", "")
    w["task_count"] = (db.row("SELECT COUNT(*) c FROM tasks WHERE workflow_id=?", (w["id"],)) or {}).get("c", 0)
    w["done_count"] = (
        db.row("SELECT COUNT(*) c FROM tasks WHERE workflow_id=? AND status='done'", (w["id"],)) or {}
    ).get("c", 0)
    return w


@router.get("/api/workflows")
def list_workflows(user: dict = Depends(me)):
    auth.require_perm(user, "workflow.read")
    items = db.rows("SELECT * FROM workflows ORDER BY id")
    if not auth.is_admin(user):
        ids = set(_visible_projects(user))
        items = [w for w in items if not w["project_id"] or w["project_id"] in ids]
    return {"workflows": [_workflow_dict(w) for w in items]}


@router.post("/api/workflows")
def create_workflow(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "workflow.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "流程名称不能为空")
    pid = int(body.get("project_id") or 0) or None
    if pid:
        _assert_project(user, pid, write=True)
    tpl = db.row("SELECT * FROM templates WHERE id=?", (int(body.get("template_id") or 0),))
    policy = body.get("qc_policy") or (_json(tpl["qc_config"], {}) if tpl else {})
    wid = db.execute(
        "INSERT INTO workflows(name,project_id,template_id,description,steps,qc_policy,status,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (
            name,
            pid,
            tpl["id"] if tpl else None,
            body.get("description") or "",
            json.dumps(body.get("steps") or ["标注", "自检", "抽审", "交付"], ensure_ascii=False),
            json.dumps(policy, ensure_ascii=False),
            "active",
            user["id"],
            db.now(),
        ),
    )
    db.log(user["id"], "create_workflow", f"workflow:{wid}", name)
    return {"ok": True, "id": wid}


@router.patch("/api/workflows/{wid}")
def update_workflow(wid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "workflow.write")
    wf = db.row("SELECT * FROM workflows WHERE id=?", (wid,))
    if not wf:
        raise HTTPException(404, "流程不存在")
    if wf["project_id"]:
        _assert_project(user, wf["project_id"], write=True)
    db.execute(
        "UPDATE workflows SET name=?, description=?, steps=?, qc_policy=?, status=? WHERE id=?",
        (
            body.get("name") or wf["name"],
            body.get("description", wf["description"]),
            json.dumps(body.get("steps", _json(wf["steps"], [])), ensure_ascii=False),
            json.dumps(body.get("qc_policy", _json(wf["qc_policy"], {})), ensure_ascii=False),
            body.get("status") or wf["status"],
            wid,
        ),
    )
    db.log(user["id"], "update_workflow", f"workflow:{wid}", body.get("name") or wf["name"])
    return {"ok": True}


@router.post("/api/tasks/{tid}/workflow")
def bind_task_workflow(tid: int, body: dict, user: dict = Depends(me)):
    task = db.row("SELECT * FROM tasks WHERE id=?", (tid,))
    if not task:
        raise HTTPException(404, "任务不存在")
    auth.assert_task(user, task)
    if not (auth.is_admin(user) or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "仅项目管理者可绑定流程")
    wf = db.row("SELECT * FROM workflows WHERE id=?", (int(body.get("workflow_id") or 0),))
    if not wf:
        raise HTTPException(400, "流程不存在")
    db.execute("UPDATE tasks SET workflow_id=?, updated_at=? WHERE id=?", (wf["id"], db.now(), tid))
    db.log(user["id"], "bind_workflow", f"task:{tid}", wf["name"])
    return {"ok": True, "workflow": _workflow_dict(wf)}


@router.post("/api/qc/sample")
def qc_sample(body: dict, user: dict = Depends(me)):
    """对待质检任务执行抽审：按比例标记 qc_required，其余由策略自动通过。"""
    auth.require_perm(user, "task.review")
    pid = int(body.get("project_id") or 0) or None
    percent = max(0, min(100, int(body.get("percent") or 100)))
    if pid:
        _assert_project(user, pid, write=True)
        tasks = db.rows("SELECT * FROM tasks WHERE project_id=? AND status IN ('submitted','review')", (pid,))
    else:
        tasks = db.rows(
            "SELECT * FROM tasks WHERE status IN ('submitted','review') AND project_id IN ("
            + ",".join("?" * max(1, len(_visible_projects(user)))) + ")",
            tuple(_visible_projects(user) or [0]),
        )
    need = max(0, round(len(tasks) * percent / 100))
    sampled = 0
    for i, t in enumerate(tasks):
        required = 1 if i < need else 0
        db.execute("UPDATE tasks SET qc_required=? WHERE id=?", (required, t["id"]))
        sampled += required
    db.log(user["id"], "qc_sample", f"project:{pid or 'all'}", f"{sampled}/{len(tasks)} 抽审")
    return {"ok": True, "total": len(tasks), "sampled": sampled, "percent": percent}


# ---------------------------------------------------------------------------
# 开放接口：API Key 管理 + 安全监控
# ---------------------------------------------------------------------------

def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _key_dict(k: dict) -> dict:
    k = dict(k)
    k["scopes"] = [s for s in (k.get("scopes") or "").split(",") if s]
    k["request_count"] = (
        db.row("SELECT COUNT(*) c FROM api_requests WHERE api_key_id=?", (k["id"],)) or {}
    ).get("c", 0)
    return k


@router.get("/api/api-keys")
def list_api_keys(user: dict = Depends(me)):
    auth.require_perm(user, "api.read")
    items = db.rows("SELECT * FROM api_keys ORDER BY id DESC")
    return {"keys": [_key_dict(k) for k in items]}


@router.post("/api/api-keys")
def create_api_key(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "api.write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "密钥名称不能为空")
    scopes = body.get("scopes") or ["read", "write"]
    if isinstance(scopes, str):
        scopes = [s.strip() for s in scopes.split(",") if s.strip()]
    scopes = [s for s in scopes if s in ("read", "write", "admin")]
    if not scopes:
        scopes = ["read"]
    raw = f"ck_live_{secrets.token_hex(18)}"
    kid = db.execute(
        "INSERT INTO api_keys(name,key_prefix,key_hash,tenant_id,scopes,status,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (
            name,
            raw[:14],
            _hash_key(raw),
            user.get("tenant_id"),
            ",".join(scopes),
            "active",
            user["id"],
            db.now(),
        ),
    )
    db.log(user["id"], "create_api_key", f"api_key:{kid}", name)
    return {"ok": True, "id": kid, "key": raw, "prefix": raw[:14], "scopes": scopes}


@router.post("/api/api-keys/{kid}/revoke")
def revoke_api_key(kid: int, user: dict = Depends(me)):
    auth.require_perm(user, "api.write")
    key = db.row("SELECT * FROM api_keys WHERE id=?", (kid,))
    if not key:
        raise HTTPException(404, "密钥不存在")
    db.execute("UPDATE api_keys SET status='revoked', revoked_at=? WHERE id=?", (db.now(), kid))
    db.log(user["id"], "revoke_api_key", f"api_key:{kid}", key["name"])
    return {"ok": True}


@router.get("/api/security/overview")
def security_overview(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    total = (db.row("SELECT COUNT(*) c FROM api_requests") or {}).get("c", 0)
    errors = (db.row("SELECT COUNT(*) c FROM api_requests WHERE status_code>=400") or {}).get("c", 0)
    keys = db.rows("SELECT * FROM api_keys ORDER BY id DESC")
    trend = []
    for i in range(6, -1, -1):
        day = (db.row("SELECT date('now', ?) d", (f"-{i} day",)) or {}).get("d", "")
        cnt = (
            db.row("SELECT COUNT(*) c FROM api_requests WHERE substr(created_at,1,10)=?", (day,)) or {}
        ).get("c", 0)
        err = (
            db.row(
                "SELECT COUNT(*) c FROM api_requests WHERE substr(created_at,1,10)=? AND status_code>=400",
                (day,),
            )
            or {}
        ).get("c", 0)
        trend.append({"day": day[5:], "total": cnt, "errors": err})
    top = db.rows(
        "SELECT key_name,COUNT(*) c FROM api_requests GROUP BY key_name ORDER BY c DESC LIMIT 5"
    )
    events = db.rows("SELECT * FROM security_events ORDER BY id DESC LIMIT 40")
    return {
        "summary": {
            "requests": total,
            "errors": errors,
            "error_rate": round(errors / total * 100, 1) if total else 0,
            "keys_active": sum(1 for k in keys if k["status"] == "active"),
            "keys_total": len(keys),
            "blocked": (db.row("SELECT COUNT(*) c FROM security_events WHERE severity IN ('warning','high')") or {}).get("c", 0),
        },
        "trend": trend,
        "top_keys": top,
        "events": events,
        "keys": [_key_dict(k) for k in keys],
        "requests": db.rows("SELECT * FROM api_requests ORDER BY id DESC LIMIT 30"),
    }


# ---------------------------------------------------------------------------
# OpenAPI v1：API Key 鉴权（X-API-Key），带调用日志
# ---------------------------------------------------------------------------

PUBLIC_V1 = {"/api/v1/health", "/api/v1/openapi.json"}


def _record_request(request: Request, key: dict | None, status: int, start: float) -> None:
    db.execute(
        "INSERT INTO api_requests(api_key_id,key_name,method,path,status_code,latency_ms,ip,created_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (
            key["id"] if key else None,
            key["name"] if key else "",
            request.method,
            request.url.path,
            status,
            int((time.time() - start) * 1000),
            auth.client_ip(request),
            db.now(),
        ),
    )


async def v1_middleware(request: Request, call_next):
    """/api/v1/* 统一鉴权与调用审计，密钥无效时回写安全事件。"""
    path = request.url.path
    if not path.startswith("/api/v1/"):
        return await call_next(request)
    start = time.time()
    if path in PUBLIC_V1:
        resp = await call_next(request)
        _record_request(request, None, resp.status_code, start)
        return resp
    raw = request.headers.get("x-api-key") or request.query_params.get("api_key") or ""
    key = db.row("SELECT * FROM api_keys WHERE key_hash=? AND status='active'", (_hash_key(raw),)) if raw else None
    if not key:
        _record_request(request, None, 401, start)
        db.security_event(
            "api_key_invalid",
            "warning",
            actor=raw[:10] if raw else "anonymous",
            ip=auth.client_ip(request),
            detail=f"无效 API Key 访问 {path}",
        )
        return JSONResponse({"detail": "无效或已吊销的 API Key"}, status_code=401)
    request.state.api_key = key
    db.execute("UPDATE api_keys SET last_used_at=? WHERE id=?", (db.now(), key["id"]))
    resp = await call_next(request)
    _record_request(request, key, resp.status_code, start)
    if resp.status_code >= 400:
        db.security_event(
            "api_request_failed",
            "info" if resp.status_code == 404 else "warning",
            actor=key["name"],
            ip=auth.client_ip(request),
            detail=f"{request.method} {path} -> {resp.status_code}",
        )
    return resp


def v1_key(request: Request) -> dict:
    key = getattr(request.state, "api_key", None)
    if not key:
        raise HTTPException(401, "缺少 API Key")
    return key


def require_scope(key: dict, scope: str) -> None:
    scopes = (key.get("scopes") or "").split(",")
    if "admin" not in scopes and scope not in scopes:
        raise HTTPException(403, f"该密钥缺少 {scope} 范围")


def _v1_project_ids(key: dict) -> list[int]:
    tid = key.get("tenant_id")
    rows = db.rows("SELECT id FROM projects WHERE tenant_id=? OR ? IS NULL", (tid, tid))
    return [r["id"] for r in rows]


def _v1_task(task_id: int) -> dict:
    task = db.row(
        "SELECT t.*,p.name project_name,p.modality FROM tasks t JOIN projects p ON p.id=t.project_id WHERE t.id=?",
        (task_id,),
    )
    if not task:
        raise HTTPException(404, "任务不存在")
    return task


def _v1_annotation_payload(task_id: int) -> dict:
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (task_id,))
    if not ann:
        return {}
    return _json(ann["payload"], {})


V1_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "春科数据标注平台 OpenAPI",
        "version": "v1",
        "description": "使用 X-API-Key 鉴权，支持任务查询、结果写入、质检与数据集读取。",
    },
    "servers": [{"url": "/"}],
    "components": {
        "securitySchemes": {
            "ApiKeyAuth": {"type": "apiKey", "in": "header", "name": "X-API-Key"}
        }
    },
    "security": [{"ApiKeyAuth": []}],
    "paths": {
        "/api/v1/health": {"get": {"summary": "健康检查", "security": []}},
        "/api/v1/projects": {"get": {"summary": "项目列表"}},
        "/api/v1/tasks": {
            "get": {"summary": "任务列表（status / project_id / limit）"},
            "post": {"summary": "创建任务（write）", "requestBody": {"required": True}},
        },
        "/api/v1/tasks/{id}": {"get": {"summary": "任务详情与最新标注"}},
        "/api/v1/tasks/{id}/annotation": {
            "post": {"summary": "写入标注结果（write）", "requestBody": {"required": True}}
        },
        "/api/v1/tasks/{id}/submit": {"post": {"summary": "提交质检（write）"}},
        "/api/v1/tasks/{id}/review": {
            "post": {"summary": "质检结论（write）：approved / rejected"}
        },
        "/api/v1/datasets": {"get": {"summary": "数据集列表"}},
        "/api/v1/datasets/{id}/items": {"get": {"summary": "数据集条目"}},
        "/api/v1/stats": {"get": {"summary": "统计概览"}},
    },
}


@router.get("/api/openapi/spec")
def openapi_spec(user: dict = Depends(me)):
    auth.require_perm(user, "api.read")
    return V1_SPEC


@router.get("/api/v1/health")
def v1_health():
    return {"ok": True, "service": "chunke-label", "version": "v1", "time": db.now()}


@router.get("/api/v1/openapi.json")
def v1_openapi():
    return V1_SPEC


@router.get("/api/v1/me")
def v1_me(key: dict = Depends(v1_key)):
    return {
        "key": key["name"],
        "prefix": key["key_prefix"],
        "scopes": (key["scopes"] or "").split(","),
        "last_used_at": key["last_used_at"],
    }


@router.get("/api/v1/projects")
def v1_projects(key: dict = Depends(v1_key)):
    require_scope(key, "read")
    ids = _v1_project_ids(key)
    if not ids:
        return {"projects": []}
    marks = ",".join("?" * len(ids))
    items = db.rows(f"SELECT * FROM projects WHERE id IN ({marks}) ORDER BY id", tuple(ids))
    for p in items:
        p["labels"] = _json(p.pop("label_config", "{}"), {})
        p["modality_label"] = db.MODALITY_LABEL.get(p["modality"], p["modality"])
    return {"projects": items}


@router.get("/api/v1/tasks")
def v1_tasks(status: str = "", project_id: int = 0, limit: int = 100, key: dict = Depends(v1_key)):
    require_scope(key, "read")
    ids = _v1_project_ids(key)
    if not ids:
        return {"tasks": []}
    marks = ",".join("?" * len(ids))
    conds = [f"t.project_id IN ({marks})"]
    vals: list = list(ids)
    if status:
        conds.append("t.status=?")
        vals.append(status)
    if project_id:
        conds.append("t.project_id=?")
        vals.append(project_id)
    limit = max(1, min(500, limit))
    items = db.rows(
        "SELECT t.*,p.name project_name FROM tasks t JOIN projects p ON p.id=t.project_id"
        f" WHERE {' AND '.join(conds)} ORDER BY t.id DESC LIMIT ?",
        tuple(vals + [limit]),
    )
    return {"tasks": items}


@router.get("/api/v1/tasks/{task_id}")
def v1_task_detail(task_id: int, key: dict = Depends(v1_key)):
    require_scope(key, "read")
    task = _v1_task(task_id)
    if task["project_id"] not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    return {"task": task, "payload": _v1_annotation_payload(task_id)}


@router.post("/api/v1/tasks")
def v1_create_task(body: dict, key: dict = Depends(v1_key)):
    require_scope(key, "write")
    pid = int(body.get("project_id") or 0)
    if pid not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该项目")
    project = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not project:
        raise HTTPException(400, "项目不存在")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "任务名称不能为空")
    tid = db.execute(
        "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,priority,batch,"
        "workflow_id,dataset_id,qc_required,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            pid,
            name,
            body.get("media_path") or "",
            body.get("media_type") or project["modality"],
            0,
            "pending",
            "normal",
            body.get("batch") or "OpenAPI",
            (db.row("SELECT id FROM workflows WHERE project_id=? LIMIT 1", (pid,)) or {}).get("id"),
            int(body.get("dataset_id") or 0) or None,
            1,
            db.now(),
            db.now(),
        ),
    )
    db.log(None, "api_create_task", f"task:{tid}", f"key:{key['name']} · {name}")
    return {"ok": True, "id": tid}


@router.post("/api/v1/tasks/{task_id}/annotation")
def v1_save_annotation(task_id: int, body: dict, key: dict = Depends(v1_key)):
    require_scope(key, "write")
    task = _v1_task(task_id)
    if task["project_id"] not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    payload = body.get("payload") or body
    ann = db.row("SELECT * FROM annotations WHERE task_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (task_id,))
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
            (task_id, 0, json.dumps(payload, ensure_ascii=False), "{}", "draft", 1, db.now(), db.now()),
        )
    if task["status"] == "pending":
        db.execute("UPDATE tasks SET status='annotating', updated_at=? WHERE id=?", (db.now(), task_id))
    return {"ok": True, "annotation_id": aid, "saved_at": db.now()}


@router.post("/api/v1/tasks/{task_id}/submit")
def v1_submit(task_id: int, key: dict = Depends(v1_key)):
    require_scope(key, "write")
    task = _v1_task(task_id)
    if task["project_id"] not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (task_id,))
    if not ann:
        raise HTTPException(400, "请先写入标注结果")
    db.execute("UPDATE annotations SET status='submitted', version=version+1, updated_at=? WHERE id=?", (db.now(), ann["id"]))
    db.execute(
        "UPDATE tasks SET status='submitted', qc_required=1, updated_at=? WHERE id=?", (db.now(), task_id)
    )
    db.log(None, "api_submit", f"task:{task_id}", f"key:{key['name']}")
    return {"ok": True, "status": "submitted"}


@router.post("/api/v1/tasks/{task_id}/review")
def v1_review(task_id: int, body: dict, key: dict = Depends(v1_key)):
    require_scope(key, "write")
    task = _v1_task(task_id)
    if task["project_id"] not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    result = body.get("result") or ""
    if result not in ("approved", "rejected"):
        raise HTTPException(400, "result 必须为 approved 或 rejected")
    ann = db.row("SELECT * FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (task_id,))
    if not ann:
        raise HTTPException(400, "任务尚未提交标注")
    db.execute(
        "INSERT INTO qc_records(task_id,annotation_id,reviewer_id,result,score,comment,created_at) VALUES(?,?,?,?,?,?,?)",
        (task_id, ann["id"], 0, result, float(body.get("score") or 0), body.get("comment") or "", db.now()),
    )
    if result == "approved":
        db.execute("UPDATE annotations SET status='approved', updated_at=? WHERE id=?", (db.now(), ann["id"]))
        db.execute("UPDATE tasks SET status='done', updated_at=? WHERE id=?", (db.now(), task_id))
    else:
        db.execute("UPDATE annotations SET status='rejected', updated_at=? WHERE id=?", (db.now(), ann["id"]))
        db.execute(
            "UPDATE tasks SET status='annotating', rework_count=rework_count+1, updated_at=? WHERE id=?",
            (db.now(), task_id),
        )
    db.log(None, "api_review", f"task:{task_id}", f"key:{key['name']} · {result}")
    return {"ok": True, "result": result}


@router.get("/api/v1/datasets")
def v1_datasets(key: dict = Depends(v1_key)):
    require_scope(key, "read")
    ids = set(_v1_project_ids(key))
    items = [d for d in db.rows("SELECT * FROM datasets ORDER BY id") if not d["project_id"] or d["project_id"] in ids]
    return {"datasets": [_dataset_stats(d) for d in items]}


@router.get("/api/v1/datasets/{ds_id}/items")
def v1_dataset_items(ds_id: int, key: dict = Depends(v1_key)):
    require_scope(key, "read")
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"] and ds["project_id"] not in _v1_project_ids(key):
        raise HTTPException(403, "密钥无权访问该数据集")
    items = db.rows(
        "SELECT id,version_id,task_id,name,media_path,media_type,size,created_at FROM dataset_items"
        " WHERE dataset_id=? ORDER BY id LIMIT 500",
        (ds_id,),
    )
    for it in items:
        it["media_name"] = os.path.basename(it["media_path"] or "")
    return {"items": items}


@router.get("/api/v1/stats")
def v1_stats(key: dict = Depends(v1_key)):
    require_scope(key, "read")
    ids = _v1_project_ids(key)
    if not ids:
        return {"summary": {}}
    marks = ",".join("?" * len(ids))
    summary = db.row(
        f"SELECT COUNT(*) total,"
        f" SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,"
        f" SUM(CASE WHEN status IN ('submitted','review') THEN 1 ELSE 0 END) reviewing,"
        f" SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done"
        f" FROM tasks WHERE project_id IN ({marks})",
        tuple(ids),
    )
    return {"summary": summary}
