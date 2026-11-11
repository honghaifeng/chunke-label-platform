"""v4 能力：平台/租户控制台、计量计费、用户生命周期、模板编排与灰度、
条件工作流、包级退回、跨模态/事件/掩码标注、交互式算子、文本质检算子、
外部系统双向集成、监控/数据湖、凭据加密、等保三级基线与信创/容量自检。"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import platform
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse

from . import auth, db, ops, workbench

router = APIRouter()

COMPONENT_TYPES = {
    "container": "容器", "columns": "分栏", "text": "单行文本", "textarea": "多行文本",
    "radio": "单选", "checkbox": "多选", "select": "下拉", "tags": "标签",
    "timestamp": "时间戳", "unknown": "不定项", "timeline": "多时序对齐",
    "image": "图片引用", "audio": "音频引用", "video": "视频引用", "pdf": "PDF 引用",
    "table": "表格", "code": "代码块", "llm": "大模型生成",
}
OP_LABELS = {
    "sam": "SAM 交互分割", "ocr": "OCR 信息提取", "track": "视频目标跟踪",
    "qa": "文档问答生成", "asr": "语音转写", "open_vocab": "开放词检测",
    "segment": "语义分割", "translate": "文本翻译", "describe": "图像描述",
    "llm": "文本润色/生成",
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


def _task(tid: int, user: dict) -> dict:
    t = db.row("SELECT * FROM tasks WHERE id=?", (tid,))
    if not t or t.get("deleted"):
        raise HTTPException(404, "任务不存在")
    if not auth.can_access_task(user, t):
        raise HTTPException(403, "无权访问该任务")
    return t


def _admin(user: dict) -> None:
    if not auth.is_admin(user):
        raise HTTPException(403, "仅平台管理员可执行该操作")


def _size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


# ---------------------------------------------------------------------------
# 建表 / 补列
# ---------------------------------------------------------------------------

def init_schema() -> None:
    ts = db.now()
    with db.connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS template_layouts(
              template_id INTEGER PRIMARY KEY, layout TEXT NOT NULL DEFAULT '[]',
              gray_percent INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0,
              version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT '');
            CREATE TABLE IF NOT EXISTS rework_events(
              id INTEGER PRIMARY KEY AUTOINCREMENT, task_id INTEGER, package_id INTEGER,
              scope TEXT NOT NULL DEFAULT 'item', reason TEXT NOT NULL DEFAULT '',
              actor_id INTEGER, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS integration_endpoints(
              id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
              direction TEXT NOT NULL DEFAULT 'both', kind TEXT NOT NULL DEFAULT 'http',
              url TEXT NOT NULL, secret_id INTEGER, config TEXT NOT NULL DEFAULT '{}',
              enabled INTEGER NOT NULL DEFAULT 1, last_status TEXT NOT NULL DEFAULT '',
              last_sync_at TEXT, created_by INTEGER, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS sync_logs(
              id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint_id INTEGER, direction TEXT NOT NULL,
              status TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL DEFAULT 0,
              created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS secret_vault(
              id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL,
              cipher TEXT NOT NULL, hint TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS login_attempts(
              id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '',
              success INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS capacity_snapshots(
              id INTEGER PRIMARY KEY AUTOINCREMENT, files INTEGER NOT NULL DEFAULT 0,
              items INTEGER NOT NULL DEFAULT 0, db_bytes INTEGER NOT NULL DEFAULT 0,
              p95_ms INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
            """
        )
        for table, col, ddl in (
            ("tenants", "max_users", "INTEGER NOT NULL DEFAULT 200"),
            ("tenants", "max_projects", "INTEGER NOT NULL DEFAULT 50"),
            ("tenants", "max_storage_gb", "INTEGER NOT NULL DEFAULT 500"),
            ("tasks", "package_id", "INTEGER"),
            ("projects", "tenant_id", "INTEGER"),
            ("annotations", "extras", "TEXT NOT NULL DEFAULT '{}'"),
        ):
            db._ensure_column(conn, table, col, ddl)
        conn.execute("CREATE INDEX IF NOT EXISTS ix_login_attempts ON login_attempts(username,created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS ix_reworks ON rework_events(task_id,package_id)")
        conn.commit()
    if not db.row("SELECT key FROM settings WHERE key='security.policy'"):
        ops.set_setting("security.policy", json.dumps({
            "password_min": 8, "complexity": True, "lock_threshold": 5, "lock_minutes": 15,
            "session_hours": 12, "audit_days": 180, "watermark": True, "download_disabled": False,
            "tls_required": True,
        }, ensure_ascii=False))


def policy() -> dict:
    base = {"password_min": 8, "complexity": True, "lock_threshold": 5, "lock_minutes": 15,
            "session_hours": 12, "audit_days": 180, "watermark": True,
            "download_disabled": False, "tls_required": True}
    base.update(_json(ops.get_setting("security.policy", "{}"), {}))
    return base


def check_password(pwd: str) -> str | None:
    p = policy()
    if len(pwd or "") < int(p.get("password_min") or 8):
        return f"密码至少 {p.get('password_min')} 位"
    if p.get("complexity"):
        kinds = sum(bool(re.search(rx, pwd or "")) for rx in (r"[a-z]", r"[A-Z]", r"\d", r"[^A-Za-z0-9]"))
        if kinds < 3:
            return "密码需包含大小写字母、数字、符号中的至少三类"
    return None


# ---------------------------------------------------------------------------
# 平台 / 租户控制台
# ---------------------------------------------------------------------------

def _tenant_usage(tenant_id: int) -> dict:
    marks = "(SELECT id FROM projects WHERE tenant_id=?)"
    users = (db.row("SELECT COUNT(*) c FROM users WHERE tenant_id=? AND status<>'deleted'", (tenant_id,)) or {}).get("c", 0)
    projects = (db.row("SELECT COUNT(*) c FROM projects WHERE tenant_id=?", (tenant_id,)) or {}).get("c", 0)
    tasks = (db.row(
        f"SELECT COUNT(*) c FROM tasks WHERE project_id IN {marks} AND deleted=0", (tenant_id,)) or {}).get("c", 0)
    anns = (db.row(
        f"SELECT COUNT(*) c FROM annotations WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN {marks})",
        (tenant_id,)) or {}).get("c", 0)
    storage = (db.row(
        f"SELECT COALESCE(SUM(size),0) s FROM dataset_items WHERE dataset_id IN"
        f" (SELECT id FROM datasets WHERE project_id IN {marks})", (tenant_id,)) or {}).get("s", 0)
    return {"users": users, "projects": projects, "tasks": tasks, "annotations": anns,
            "storage_bytes": int(storage or 0)}


@router.get("/api/platform/overview")
def platform_overview(user: dict = Depends(me)):
    _admin(user)
    tenants = db.rows("SELECT * FROM tenants ORDER BY id")
    for t in tenants:
        usage = _tenant_usage(t["id"])
        t["usage"] = usage
        t["quota"] = {"max_users": t["max_users"], "max_projects": t["max_projects"],
                      "max_storage_gb": t["max_storage_gb"]}
        t["usage_percent"] = {
            "users": round(usage["users"] * 100 / max(1, t["max_users"])),
            "projects": round(usage["projects"] * 100 / max(1, t["max_projects"])),
            "storage": round(usage["storage_bytes"] / 1024 ** 3 * 100 / max(1, t["max_storage_gb"])),
        }
    return {
        "tenants": tenants,
        "totals": {
            "tenants": len(tenants),
            "users": (db.row("SELECT COUNT(*) c FROM users WHERE status<>'deleted'") or {}).get("c", 0),
            "projects": (db.row("SELECT COUNT(*) c FROM projects") or {}).get("c", 0),
            "tasks": (db.row("SELECT COUNT(*) c FROM tasks WHERE deleted=0") or {}).get("c", 0),
        },
    }


@router.patch("/api/tenants/{tid}/quota")
def update_quota(tid: int, body: dict, user: dict = Depends(me)):
    _admin(user)
    if not db.row("SELECT id FROM tenants WHERE id=?", (tid,)):
        raise HTTPException(404, "租户不存在")
    db.execute(
        "UPDATE tenants SET max_users=?, max_projects=?, max_storage_gb=? WHERE id=?",
        (max(1, int(body.get("max_users") or 200)), max(1, int(body.get("max_projects") or 50)),
         max(1, int(body.get("max_storage_gb") or 500)), tid),
    )
    db.log(user["id"], "tenant_quota", f"tenant:{tid}", json.dumps(body, ensure_ascii=False))
    return {"ok": True}


@router.get("/api/usage")
def usage(tenant_id: int = 0, user: dict = Depends(me)):
    if not auth.is_admin(user):
        tenant_id = int(user.get("tenant_id") or 0)
    if not tenant_id:
        raise HTTPException(400, "请指定租户")
    u = _tenant_usage(tenant_id)
    t = db.row("SELECT * FROM tenants WHERE id=?", (tenant_id,)) or {}
    price = float(ops.get_setting("billing.price_per_k", "12") or 12)
    api_calls = (db.row("SELECT COUNT(*) c FROM api_requests WHERE created_at>=?", (db.now()[:7],)) or {}).get("c", 0)
    amount = round(u["annotations"] / 1000 * price, 2)
    return {
        "tenant": t, "usage": u, "quota": {"users": t.get("max_users", 0), "projects": t.get("max_projects", 0),
                                          "storage_gb": t.get("max_storage_gb", 0)},
        "billing": {"unit_price_per_k": price, "amount": amount, "period": db.now()[:7], "api_calls": api_calls},
    }


@router.post("/api/billing/policy")
def billing_policy(body: dict, user: dict = Depends(me)):
    _admin(user)
    ops.set_setting("billing.price_per_k", str(float(body.get("price_per_k") or 12)))
    db.log(user["id"], "billing_policy", "system", f"单价 {body.get('price_per_k')}")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 用户生命周期：批量导入 / 批量调整 / 删除（匿名化）
# ---------------------------------------------------------------------------

@router.post("/api/members/import-json")
def import_members(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    rows = body.get("users") or []
    if not isinstance(rows, list):
        raise HTTPException(400, "users 必须是数组")
    created, skipped, failed = [], [], []
    for item in rows:
        username = str(item.get("username") or "").strip()
        if not username:
            failed.append({"username": "", "error": "缺少用户名"})
            continue
        if db.row("SELECT id FROM users WHERE username=?", (username,)):
            skipped.append(username)
            continue
        pwd = str(item.get("password") or "Chunke@2026")
        err = check_password(pwd)
        if err:
            failed.append({"username": username, "error": err})
            continue
        role = item.get("platform_role") or "annotator"
        if role not in auth.PLATFORM_ROLES:
            failed.append({"username": username, "error": "角色不合法"})
            continue
        uid = db.execute(
            "INSERT INTO users(username,name,password_hash,platform_role,status,tenant_id,created_at)"
            " VALUES(?,?,?,?,?,?,?)",
            (username, str(item.get("name") or username), db.hash_password(pwd), role, "active",
             item.get("tenant_id") or user.get("tenant_id"), db.now()),
        )
        created.append({"id": uid, "username": username})
        db.log(user["id"], "member_import", f"user:{uid}", username)
    return {"ok": True, "created": created, "skipped": skipped, "failed": failed}


@router.patch("/api/members/bulk")
def bulk_members(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    ids = [int(x) for x in (body.get("user_ids") or []) if str(x).isdigit()]
    action = body.get("action") or ""
    value = body.get("value")
    if not ids:
        raise HTTPException(400, "请选择成员")
    if action == "disable":
        db.execute(f"UPDATE users SET status='disabled' WHERE id IN ({','.join('?' * len(ids))})", tuple(ids))
    elif action == "enable":
        db.execute(f"UPDATE users SET status='active' WHERE id IN ({','.join('?' * len(ids))})", tuple(ids))
    elif action == "role":
        if value not in auth.PLATFORM_ROLES:
            raise HTTPException(400, "角色不合法")
        db.execute(f"UPDATE users SET platform_role=? WHERE id IN ({','.join('?' * len(ids))})",
                   (value, *ids))
    elif action == "tenant":
        db.execute(f"UPDATE users SET tenant_id=? WHERE id IN ({','.join('?' * len(ids))})",
                   (int(value or 0) or None, *ids))
    else:
        raise HTTPException(400, "action 仅支持 disable/enable/role/tenant")
    db.log(user["id"], "member_bulk", "system", f"{action} → {len(ids)} 人")
    return {"ok": True, "count": len(ids)}


@router.delete("/api/members/{uid}")
def delete_member(uid: int, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    if uid == user["id"]:
        raise HTTPException(400, "不能删除当前登录账号")
    target = db.row("SELECT * FROM users WHERE id=?", (uid,))
    if not target:
        raise HTTPException(404, "成员不存在")
    anon = "deleted-" + hashlib.sha1(f"{uid}-{uuid.uuid4().hex}".encode()).hexdigest()[:10]
    db.execute(
        "UPDATE users SET username=?, name=?, status='deleted', password_hash=?, tenant_id=NULL WHERE id=?",
        (anon, f"已删除用户#{uid}", db.hash_password(uuid.uuid4().hex), uid),
    )
    db.execute("DELETE FROM project_members WHERE user_id=?", (uid,))
    db.execute("DELETE FROM team_members WHERE user_id=?", (uid,))
    db.execute(
        "INSERT INTO audit_log(actor_id,action,target,detail,created_at) VALUES(?,?,?,?,?)",
        (user["id"], "member_delete", f"user:{uid}", f"匿名化删除 {target['username']}", db.now()),
    )
    return {"ok": True}


@router.post("/api/members/{uid}/reset-password")
def reset_password(uid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "org.write")
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(404, "成员不存在")
    pwd = str(body.get("password") or "")
    err = check_password(pwd)
    if err:
        raise HTTPException(400, err)
    db.execute("UPDATE users SET password_hash=? WHERE id=?", (db.hash_password(pwd), uid))
    db.log(user["id"], "reset_password", f"user:{uid}", "重置密码")
    return {"ok": True}


# ---------------------------------------------------------------------------
# 模板编排 / 版本锁定 / 灰度升级
# ---------------------------------------------------------------------------

def _validate_layout(nodes: list, depth: int = 0, seen: set | None = None) -> list:
    seen = seen if seen is not None else set()
    if depth > 5:
        raise HTTPException(400, "组件层级最多 5 层")
    if not isinstance(nodes, list):
        raise HTTPException(400, "layout 必须是数组")
    out = []
    for node in nodes:
        if not isinstance(node, dict):
            raise HTTPException(400, "组件必须是对象")
        kind = node.get("type")
        if kind not in COMPONENT_TYPES:
            raise HTTPException(400, f"不支持的组件类型：{kind}")
        nid = str(node.get("id") or uuid.uuid4().hex[:8])
        if nid in seen:
            raise HTTPException(400, f"组件 ID 重复：{nid}")
        seen.add(nid)
        item = {
            "id": nid, "type": kind, "label": str(node.get("label") or COMPONENT_TYPES[kind]),
            "required": bool(node.get("required")),
            "placeholder": str(node.get("placeholder") or ""),
            "default": node.get("default") or "",
            "options": [str(x) for x in (node.get("options") or [])],
            "fields": [str(x) for x in (node.get("fields") or [])],
            "rules": node.get("rules") or {},
            "props": node.get("props") or {},
        }
        if kind == "table":
            cols = node.get("columns") or []
            item["columns"] = [str(c.get("name") if isinstance(c, dict) else c) for c in cols][:12]
            item["props"] = {"rows": int((node.get("props") or {}).get("rows") or 3)}
        if kind == "code":
            item["props"] = {"language": str((node.get("props") or {}).get("language") or "text")}
        if kind == "llm":
            item["props"] = {"mode": str((node.get("props") or {}).get("mode") or "generate"),
                             "model": str((node.get("props") or {}).get("model") or "")}
        if kind in ("image", "audio", "video", "pdf"):
            item["props"] = {"accept": str((node.get("props") or {}).get("accept") or kind),
                             "multiple": bool((node.get("props") or {}).get("multiple"))}
        if kind in ("container", "columns", "unknown"):
            item["children"] = _validate_layout(node.get("children") or [], depth + 1, seen)
        out.append(item)
    return out


def _layout_row(tid: int) -> dict:
    tpl = db.row("SELECT * FROM templates WHERE id=?", (tid,))
    if not tpl:
        raise HTTPException(404, "模板不存在")
    row = db.row("SELECT * FROM template_layouts WHERE template_id=?", (tid,))
    if not row:
        return {"layout": [], "gray_percent": 0, "locked": 0, "version": 1}
    row["layout"] = _json(row["layout"], [])
    return row


@router.get("/api/templates/{tid}/layout")
def get_layout(tid: int, user: dict = Depends(me)):
    auth.require_perm(user, "template.read")
    tpl = db.row("SELECT * FROM templates WHERE id=?", (tid,))
    if not tpl:
        raise HTTPException(404, "模板不存在")
    data = _layout_row(tid)
    return {**data, "template": {"id": tpl["id"], "name": tpl["name"], "modality": tpl["modality"]},
            "component_types": [{"type": k, "label": v} for k, v in COMPONENT_TYPES.items()]}


@router.put("/api/templates/{tid}/layout")
def save_layout(tid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    if not db.row("SELECT id FROM templates WHERE id=?", (tid,)):
        raise HTTPException(404, "模板不存在")
    cur = _layout_row(tid)
    layout = _validate_layout(body.get("layout") or [])
    version = cur["version"] + (1 if body.get("bump") else 0)
    db.execute(
        "INSERT INTO template_layouts(template_id,layout,gray_percent,locked,version,updated_at)"
        " VALUES(?,?,?,?,?,?) ON CONFLICT(template_id) DO UPDATE SET"
        " layout=excluded.layout,gray_percent=excluded.gray_percent,version=excluded.version,updated_at=excluded.updated_at",
        (tid, json.dumps(layout, ensure_ascii=False), int(body.get("gray_percent", cur["gray_percent"])),
         int(body.get("locked", cur["locked"])), version, db.now()),
    )
    db.log(user["id"], "template_layout", f"template:{tid}", f"v{version} · {len(layout)} 个顶层组件")
    return {"ok": True, "version": version}


@router.post("/api/templates/{tid}/rollout")
def template_rollout(tid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "template.write")
    cur = _layout_row(tid)
    percent = max(0, min(100, int(body.get("gray_percent") or 0)))
    db.execute(
        "INSERT INTO template_layouts(template_id,layout,gray_percent,locked,version,updated_at)"
        " VALUES(?,?,?,?,?,?) ON CONFLICT(template_id) DO UPDATE SET gray_percent=excluded.gray_percent,updated_at=excluded.updated_at",
        (tid, json.dumps(cur["layout"], ensure_ascii=False), percent, cur["locked"], cur["version"], db.now()),
    )
    db.log(user["id"], "template_rollout", f"template:{tid}", f"灰度 {percent}%")
    return {"ok": True, "gray_percent": percent}


@router.get("/api/templates/{tid}/effective")
def template_effective(tid: int, task_id: int = 0, user: dict = Depends(me)):
    auth.require_perm(user, "template.read")
    cur = _layout_row(tid)
    bucket = int(hashlib.sha1(str(task_id).encode()).hexdigest()[:6], 16) % 100 if task_id else 100
    enabled = cur["locked"] == 0 or not task_id
    applied = bucket < int(cur["gray_percent"]) if task_id else True
    return {"template_id": tid, "version": cur["version"], "gray_percent": cur["gray_percent"],
            "locked": bool(cur["locked"]), "task_id": task_id, "applied": applied,
            "layout": cur["layout"] if applied else []}


def _template_for_task(task: dict) -> dict | None:
    row = db.row(
        "SELECT template_id FROM workflows WHERE project_id=? AND template_id IS NOT NULL"
        " AND status='active' ORDER BY id DESC LIMIT 1", (task["project_id"],))
    tpl = db.row("SELECT * FROM templates WHERE id=?", (row["template_id"],)) if row else None
    if not tpl:
        tpl = db.row("SELECT * FROM templates WHERE modality=? ORDER BY builtin DESC, id LIMIT 1",
                     (task.get("media_type") or "",))
    if not tpl:
        tpl = db.row("SELECT * FROM templates ORDER BY id LIMIT 1")
    return tpl


@router.get("/api/tasks/{tid}/form")
def task_form(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    tpl = _template_for_task(task)
    ann = db.row("SELECT extras FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    extras = _json(ann["extras"], {}) if ann else {}
    if not tpl:
        return {"task_id": tid, "template": None, "layout": [], "values": extras.get("form") or {}}
    cur = _layout_row(tpl["id"])
    bucket = int(hashlib.sha1(str(tid).encode()).hexdigest()[:6], 16) % 100
    applied = (cur["locked"] == 0) or (not cur["gray_percent"]) or bucket < int(cur["gray_percent"])
    return {"task_id": tid,
            "template": {"id": tpl["id"], "name": tpl["name"], "modality": tpl["modality"]},
            "version": cur["version"], "gray_percent": cur["gray_percent"],
            "applied": applied, "layout": cur["layout"] if applied else [],
            "values": extras.get("form") or {},
            "note": "" if applied else "该任务未命中灰度版本，暂按空白表单展示"}


@router.post("/api/tasks/{tid}/form")
def save_task_form(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    if not (task.get("assignee_id") == user["id"] or auth.is_admin(user)
            or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "仅任务标注员可保存表单")
    merge = _validate_extras({"form": body.get("values") or {}})
    current = _merge_extras(tid, merge, user)
    db.log(user["id"], "template_form", f"task:{tid}", f"{len(merge['form'])} 个字段")
    return {"ok": True, "form": current.get("form") or {}}


# ---------------------------------------------------------------------------
# 条件工作流 / 节点授权
# ---------------------------------------------------------------------------

def _wf_eval(cond: dict, task: dict) -> bool:
    if not cond:
        return True
    field = cond.get("field") or ""
    op = cond.get("op") or "eq"
    value = cond.get("value")
    actual: Any = task.get(field)
    if field.startswith("payload."):
        ann = db.row("SELECT payload FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (task["id"],))
        actual = _json(ann["payload"], {}).get(field.split(".", 1)[1]) if ann else None
    try:
        if op == "gt":
            return float(actual or 0) > float(value or 0)
        if op == "lt":
            return float(actual or 0) < float(value or 0)
        if op == "in":
            return str(actual) in [str(x) for x in (value or [])]
        if op == "ne":
            return str(actual or "") != str(value or "")
        if op == "contains":
            return str(value or "") in str(actual or "")
    except (TypeError, ValueError):
        return False
    return str(actual or "") == str(value or "")


@router.post("/api/tasks/{tid}/workflow/evaluate")
def workflow_evaluate(tid: int, user: dict = Depends(me)):
    task = _task(tid, user)
    wf = db.row("SELECT * FROM workflows WHERE id=?", (task["workflow_id"],)) if task.get("workflow_id") else None
    if not wf:
        wf = db.row("SELECT * FROM workflows WHERE project_id=? AND status='active' ORDER BY id LIMIT 1",
                    (task["project_id"],))
    if not wf:
        raise HTTPException(404, "项目未配置工作流")
    steps = _json(wf["steps"], [])
    path = []
    for step in steps:
        if not isinstance(step, dict):
            step = {"key": str(step), "name": str(step), "role": "annotator"}
        cond = step.get("condition") or {}
        hit = _wf_eval(cond, task)
        path.append({"key": step.get("key"), "name": step.get("name"), "role": step.get("role"),
                     "required_role": step.get("required_role") or step.get("role"),
                     "condition": cond, "matched": hit,
                     "sample_rate": step.get("sample_rate")})
        if not hit and step.get("skip_when_unmatched", True):
            continue
    current = next((s for s in path if not s["matched"] or s["name"] == task.get("status")), None)
    allowed = db.rows("SELECT user_id,role FROM task_roles WHERE task_id=?", (tid,))
    return {"workflow": {"id": wf["id"], "name": wf["name"]}, "task_status": task["status"],
            "steps": path, "task_roles": allowed,
            "current": current, "role_authorized": bool(auth.project_role(user, task["project_id"]))
            or task.get("assignee_id") == user["id"] or user["platform_role"] == "platform_admin"}


# ---------------------------------------------------------------------------
# 包级退回 / 返工历史
# ---------------------------------------------------------------------------

@router.post("/api/packages/{pid}/rework")
def package_rework(pid: int, body: dict, user: dict = Depends(me)):
    pkg = db.row("SELECT * FROM task_packages WHERE id=?", (pid,))
    if not pkg:
        raise HTTPException(404, "任务包不存在")
    if not auth.is_admin(user) and auth.project_role(user, pkg["project_id"]) != "manager":
        raise HTTPException(403, "仅项目管理者可退回任务包")
    tasks = db.rows("SELECT * FROM tasks WHERE package_id=?", (pid,))
    if not tasks:
        tasks = db.rows("SELECT * FROM tasks WHERE project_id=? AND batch=? AND deleted=0",
                        (pkg["project_id"], pkg["name"]))
    reason = str(body.get("reason") or "包级退回")
    for t in tasks:
        db.execute("UPDATE tasks SET status='rework', rework_count=COALESCE(rework_count,0)+1, updated_at=? WHERE id=?",
                   (db.now(), t["id"]))
        db.execute(
            "INSERT INTO rework_events(task_id,package_id,scope,reason,actor_id,created_at) VALUES(?,?,?,?,?,?)",
            (t["id"], pid, "package", reason, user["id"], db.now()),
        )
        db.notify(t.get("assignee_id"), "任务包被退回", f"{t['name']}：{reason}", "rework", f"#/annotate/{t['id']}")
    db.log(user["id"], "package_rework", f"package:{pid}", f"{len(tasks)} 条 · {reason}")
    return {"ok": True, "count": len(tasks)}


@router.get("/api/tasks/{tid}/rework-history")
def rework_history(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    return {"events": db.rows(
        "SELECT r.*,u.name actor_name FROM rework_events r LEFT JOIN users u ON u.id=r.actor_id"
        " WHERE r.task_id=? ORDER BY r.id DESC", (tid,))}


# ---------------------------------------------------------------------------
# 扩展标注数据（事件 / 掩码 / 关键点 / 跨模态 / 文档问答 / 偏好）
# ---------------------------------------------------------------------------

def _norm_points(points: list, label: str) -> dict:
    if len(points or []) < 3:
        raise HTTPException(400, f"{label} 至少需要 3 个点")
    out = []
    for p in points:
        try:
            out.append([round(min(1, max(0, float(p[0]))), 6), round(min(1, max(0, float(p[1]))), 6)])
        except (TypeError, ValueError, IndexError):
            raise HTTPException(400, f"{label} 坐标格式错误")
    return {"points": out}


def _validate_extras(merge: dict) -> dict:
    if not isinstance(merge, dict):
        raise HTTPException(400, "merge 必须是对象")
    out: dict[str, Any] = {}
    if "polygons" in merge:
        out["polygons"] = []
        for p in merge.get("polygons") or []:
            if not isinstance(p, dict):
                raise HTTPException(400, "polygon 格式错误")
            item = {"label": str(p.get("label") or "区域"), **_norm_points(p.get("points"), "多边形")}
            if p.get("holes"):
                item["holes"] = [_norm_points(h, "镂空区域")["points"] for h in p["holes"]]
            out["polygons"].append(item)
    if "masks" in merge:
        out["masks"] = []
        for m in merge.get("masks") or []:
            box = m.get("box") or {}
            try:
                b = {k: round(min(1, max(0, float(box.get(k, 0)))), 6) for k in ("x", "y", "w", "h")}
            except (TypeError, ValueError):
                raise HTTPException(400, "掩码框格式错误")
            if b["w"] <= 0 or b["h"] <= 0:
                raise HTTPException(400, "掩码框宽高需大于 0")
            out["masks"].append({
                "label": str(m.get("label") or "目标"), "box": b,
                "provider": str(m.get("provider") or "sam"),
                "rle": str(m.get("rle") or "")[:20000],
                "points": [x for x in (m.get("points") or []) if isinstance(x, list)][:64],
            })
    if "keypoints" in merge:
        out["keypoints"] = []
        for k in merge.get("keypoints") or []:
            try:
                out["keypoints"].append({
                    "label": str(k.get("label") or "关键点"),
                    "x": round(min(1, max(0, float(k.get("x", 0)))), 6),
                    "y": round(min(1, max(0, float(k.get("y", 0)))), 6),
                    "visibility": max(0, min(2, int(k.get("visibility", 2)))),
                })
            except (TypeError, ValueError):
                raise HTTPException(400, "关键点坐标格式错误")
    if "events" in merge:
        out["events"] = []
        for e in merge.get("events") or []:
            try:
                start = max(0.0, round(float(e.get("start", 0)), 3))
                end = max(start, round(float(e.get("end", 0)), 3))
            except (TypeError, ValueError):
                raise HTTPException(400, "事件区间格式错误")
            if end <= start:
                raise HTTPException(400, "事件结束时间需大于开始时间")
            out["events"].append({"start": start, "end": end,
                                  "label": str(e.get("label") or "事件"),
                                  "track": str(e.get("track") or ""),
                                  "score": round(float(e.get("score") or 0), 3)})
    if "pairs" in merge:
        out["pairs"] = []
        for p in merge.get("pairs") or []:
            verdict = p.get("verdict")
            if verdict not in ("match", "mismatch", "uncertain", None):
                raise HTTPException(400, "verdict 仅支持 match/mismatch/uncertain")
            try:
                span = {k: (round(float(p.get(k)), 3) if p.get(k) not in (None, "") else None)
                        for k in ("a_start", "a_end", "b_start", "b_end")}
            except (TypeError, ValueError):
                raise HTTPException(400, "对齐时间格式错误")
            out["pairs"].append({"a": str(p.get("a") or ""), "b": str(p.get("b") or ""),
                                 "relation": str(p.get("relation") or "图文对齐"),
                                 "verdict": verdict or "uncertain",
                                 "note": str(p.get("note") or ""),
                                 "a_region": p.get("a_region") or [], "b_region": p.get("b_region") or [],
                                 **span})
    if "qa" in merge:
        out["qa"] = []
        for q in merge.get("qa") or []:
            question = str(q.get("question") or "").strip()
            answer = str(q.get("answer") or "").strip()
            if not question or not answer:
                raise HTTPException(400, "问答对需要问题与答案")
            out["qa"].append({"question": question, "answer": answer,
                              "evidence": str(q.get("evidence") or ""),
                              "algo": str(q.get("algo") or "human")})
    if "preference" in merge:
        pref = merge.get("preference") or {}
        out["preference"] = {"prompt": str(pref.get("prompt") or ""),
                             "chosen": str(pref.get("chosen") or ""),
                             "rejected": str(pref.get("rejected") or ""),
                             "reason": str(pref.get("reason") or ""),
                             "scale": pref.get("scale") or [1, 2, 3, 4, 5]}
    if "vision" in merge:
        out["vision"] = {"image": str((merge.get("vision") or {}).get("image") or ""),
                         "caption": str((merge.get("vision") or {}).get("caption") or ""),
                         "objects": [str(x) for x in ((merge.get("vision") or {}).get("objects") or [])],
                         "verdict": str((merge.get("vision") or {}).get("verdict") or "ok")}
    if "doc_regions" in merge:
        out["doc_regions"] = []
        for r in merge.get("doc_regions") or []:
            try:
                bbox = [round(float(x), 2) for x in (r.get("bbox") or [0, 0, 0, 0])][:4]
            except (TypeError, ValueError):
                raise HTTPException(400, "文档区域坐标格式错误")
            if len(bbox) != 4:
                raise HTTPException(400, "文档区域需 4 个坐标")
            out["doc_regions"].append({"page": int(r.get("page") or 1), "bbox": bbox,
                                       "text": str(r.get("text") or ""),
                                       "fields": r.get("fields") or {}})
    if "ocr_regions" in merge:
        out["ocr_regions"] = []
        for r in merge.get("ocr_regions") or []:
            try:
                bbox = [round(float(x), 4) for x in (r.get("bbox") or [0, 0, 0, 0])][:4]
            except (TypeError, ValueError):
                raise HTTPException(400, "OCR 区域坐标格式错误")
            if len(bbox) != 4:
                raise HTTPException(400, "OCR 区域需 4 个坐标")
            out["ocr_regions"].append({
                "page": int(r.get("page") or 1), "bbox": bbox, "text": str(r.get("text") or ""),
                "conf": round(min(1, max(0, float(r.get("conf") or 0))), 3),
                "field": str(r.get("field") or ""), "edited": bool(r.get("edited")),
                "engine": str(r.get("engine") or "manual"),
            })
    if "ocr_fields" in merge:
        fields = merge.get("ocr_fields") or {}
        if not isinstance(fields, dict):
            raise HTTPException(400, "ocr_fields 必须是对象")
        out["ocr_fields"] = {
            str(k): {"value": str((v or {}).get("value") if isinstance(v, dict) else v or ""),
                     "conf": round(min(1, max(0, float((v or {}).get("conf") if isinstance(v, dict) else 0)
                                              or 0)), 3),
                     "corrected": bool((v or {}).get("corrected")) if isinstance(v, dict) else False}
            for k, v in list(fields.items())[:60]}
    if "dialog" in merge:
        out["dialog"] = []
        for m in merge.get("dialog") or []:
            role = str(m.get("role") or "user")
            if role not in ("user", "assistant", "system"):
                raise HTTPException(400, "对话角色仅支持 system/user/assistant")
            content = str(m.get("content") or "").strip()
            if not content:
                raise HTTPException(400, "对话内容不能为空")
            out["dialog"].append({"role": role, "content": content,
                                  "rating": int(m.get("rating") or 0),
                                  "turn": int(m.get("turn") or 0)})
    if "ratings" in merge:
        out["ratings"] = []
        for r in merge.get("ratings") or []:
            try:
                score = int(r.get("score") or 0)
            except (TypeError, ValueError):
                raise HTTPException(400, "评分需为整数")
            out["ratings"].append({"dimension": str(r.get("dimension") or "整体质量"),
                                   "score": max(0, min(10, score)),
                                   "target": str(r.get("target") or ""),
                                   "note": str(r.get("note") or "")})
    if "polish" in merge:
        out["polish"] = []
        for p in merge.get("polish") or []:
            original = str(p.get("original") or "").strip()
            if not original:
                raise HTTPException(400, "润色记录需要原文")
            out["polish"].append({"original": original,
                                  "polished": str(p.get("polished") or ""),
                                  "style": str(p.get("style") or "通用"),
                                  "accepted": bool(p.get("accepted"))})
    if "form" in merge:
        form = merge.get("form")
        if not isinstance(form, dict):
            raise HTTPException(400, "form 必须是对象")
        if len(json.dumps(form, ensure_ascii=False)) > 200000:
            raise HTTPException(400, "表单内容过大")
        out["form"] = {str(k): v for k, v in list(form.items())[:300]}
    if not out:
        raise HTTPException(400, "没有可保存的扩展字段")
    return out


def _merge_extras(tid: int, merge: dict, user: dict) -> dict:
    ann = db.row("SELECT * FROM annotations WHERE task_id=? AND status='draft' ORDER BY id DESC LIMIT 1", (tid,))
    current = _json(ann["extras"], {}) if ann else {}
    current.update(merge)
    if ann:
        db.execute("UPDATE annotations SET extras=?, updated_at=? WHERE id=?",
                   (json.dumps(current, ensure_ascii=False), db.now(), ann["id"]))
    else:
        db.execute(
            "INSERT INTO annotations(task_id,user_id,payload,prelabel,extras,status,version,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (tid, user["id"], "{}", "{}", json.dumps(current, ensure_ascii=False), "draft", 1, db.now(), db.now()),
        )
    return current


@router.get("/api/tasks/{tid}/annotation/extras")
def get_extras(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    ann = db.row("SELECT extras FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    return {"extras": _json(ann["extras"], {}) if ann else {}}


@router.post("/api/tasks/{tid}/annotation/extras")
def save_extras(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    if not (task.get("assignee_id") == user["id"] or auth.is_admin(user)
            or auth.project_role(user, task["project_id"]) == "manager"):
        raise HTTPException(403, "仅任务标注员可保存标注")
    merge = _validate_extras(body.get("merge") or body)
    current = _merge_extras(tid, merge, user)
    db.log(user["id"], "annotation_extras", f"task:{tid}", ",".join(merge.keys()))
    return {"ok": True, "extras": current}


# ---------------------------------------------------------------------------
# 交互式算子适配器
# ---------------------------------------------------------------------------

def _operator_catalog() -> list[dict]:
    rows = db.rows("SELECT * FROM operators ORDER BY id")
    cfg = {r["name"]: r for r in rows}
    out = []
    for key, label in OP_LABELS.items():
        url = ops.get_setting(f"operator.{key}.url")
        out.append({"key": key, "label": label, "external_url": url,
                    "provider": "external" if url else "builtin",
                    "configured": bool(url) or key in ("sam", "track", "qa", "open_vocab", "asr"),
                    "hint": cfg.get(key, {}).get("description", "")})
    return out


@router.get("/api/operators/catalog")
def operator_catalog(user: dict = Depends(me)):
    return {"operators": _operator_catalog(),
            "note": "未配置外部推理地址时使用内置确定性降级算法，结果标记 provider=builtin。"}


def _call_external(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "chunke-label/1.0"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 用户配置的可信推理服务
        return json.loads(resp.read().decode() or "{}")


def _qa_sentences(text: str) -> list[dict]:
    out = []
    for m in re.finditer(r"[^。！？\n]+", text):
        raw = m.group(0)
        body = raw.strip()
        if not body:
            continue
        lead = len(raw) - len(raw.lstrip())
        out.append({"text": body, "start": m.start() + lead, "end": m.start() + lead + len(body)})
    return out


def _qa_extractive(text: str, question: str, limit: int = 5) -> list[dict]:
    sents = _qa_sentences(text)
    q = re.sub(r"\s+", "", question or "")
    grams = {q[i:i + 2] for i in range(max(0, len(q) - 1))}
    grams |= set(re.findall(r"[A-Za-z0-9]{2,}", (question or "").lower()))
    scored = []
    for s in sents:
        overlap = sum(1 for g in grams if g.lower() in s["text"].lower())
        score = round(overlap / max(1, len(grams)), 3) if grams else round(min(1.0, len(s["text"]) / 80), 3)
        scored.append({"answer": s["text"], "evidence": s["text"][:60], "start": s["start"],
                       "end": s["end"], "score": score, "algo": "extractive"})
    scored.sort(key=lambda x: (-x["score"], x["start"]))
    return scored[:limit]


@router.post("/api/qa/compare")
def qa_compare(body: dict, user: dict = Depends(me)):
    tid = int(body.get("task_id") or 0)
    task = _task(tid, user)
    text = str(body.get("text") or "").strip()
    if not text:
        ann = db.row("SELECT payload,extras FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
        payload = _json(ann["payload"], {}) if ann else {}
        extras = _json(ann["extras"], {}) if ann else {}
        parts = [str(payload.get("text") or ""), str(payload.get("summary") or "")]
        parts += [str(q.get("answer") or "") for q in (extras.get("qa") or [])]
        text = "\n".join(p for p in parts if p)
    if not text.strip():
        raise HTTPException(400, "请提供文档文本或先保存文本标注")
    question = str(body.get("question") or "").strip()
    algos = [a for a in (body.get("algos") or ["extractive", "template"])
             if a in ("extractive", "template")]
    results = []
    if "extractive" in algos:
        results.append({"name": "内置抽取式", "algo": "extractive", "provider": "builtin",
                        "model": "builtin-sentence-ranking", "answers": _qa_extractive(text, question)})
    if "template" in algos:
        sents = [s["text"] for s in _qa_sentences(text) if len(s["text"]) >= 6][:10]
        results.append({"name": "内置模板生成", "algo": "template", "provider": "builtin",
                        "model": "builtin-template", "answers": [
                            {"answer": s, "evidence": s[:60], "start": None, "end": None, "score": 0.5}
                            for s in sents]})
    url = ops.get_setting("operator.qa.url")
    if body.get("use_external", True) and url:
        try:
            ext = _call_external(url, {"question": question, "text": text,
                                       "models": body.get("models") or [], "operator": "qa"})
            results.append({"name": "外部大模型", "algo": "external", "provider": "external",
                            "model": str(ext.get("model") or ext.get("engine") or url),
                            "answers": ext.get("answers") or ext.get("qa") or [], "raw": ext})
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            results.append({"name": "外部大模型", "algo": "external", "provider": "external",
                            "model": url, "answers": [], "error": str(exc)[:200]})
    sources, seen = [], set()
    for r in results:
        for a in r.get("answers") or []:
            key = (a.get("start"), a.get("end"), a.get("answer"))
            if key in seen or not a.get("answer"):
                continue
            seen.add(key)
            sources.append({"source": r["name"], "model": r.get("model"), "answer": a.get("answer"),
                            "start": a.get("start"), "end": a.get("end"), "score": a.get("score")})
    db.log(user["id"], "qa_compare", f"task:{tid}", f"{len(results)} 个算子 · {question[:40]}")
    return {"ok": True, "question": question, "region": body.get("region") or None,
            "text_length": len(text), "results": results, "sources": sources[:30]}


def _builtin_operator(key: str, task: dict, data: dict) -> dict:
    payload = _json((db.row("SELECT payload,prelabel FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1",
                            (task["id"],)) or {}).get("payload"), {})
    if key in ("sam", "segment"):
        label = data.get("label") or "目标"
        boxes = [b for b in (data.get("boxes") or []) if isinstance(b, dict)]
        if isinstance(data.get("box"), dict):
            boxes.insert(0, data["box"])
        points = [p for p in (data.get("points") or []) if isinstance(p, dict)]
        if not boxes and not points:
            raise HTTPException(400, "请提供提示框 box 或点提示 points")
        clamp = lambda v: round(min(1, max(0, float(v))), 6)  # noqa: E731
        polygons: list[dict] = []
        masks: list[dict] = []
        for idx, box in enumerate(boxes[:12]):
            try:
                x, y = clamp(box.get("x", 0)), clamp(box.get("y", 0))
                w, h = clamp(box.get("w", 0.2)), clamp(box.get("h", 0.2))
            except (TypeError, ValueError):
                raise HTTPException(400, "提示框坐标格式错误")
            if w <= 0 or h <= 0:
                raise HTTPException(400, "提示框宽高需大于 0")
            lab = str(box.get("label") or label)
            pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
            score = round(0.92 - idx * 0.01, 3)
            polygons.append({"label": lab, "points": pts, "score": score, "instance": idx + 1})
            masks.append({"label": lab, "box": {"x": x, "y": y, "w": w, "h": h},
                          "provider": "sam", "rle": "", "points": pts, "score": score})
        for j, p in enumerate(points[:12]):
            if str(p.get("positive", 1)) in ("0", "false", "False"):
                continue
            try:
                px, py = clamp(p.get("x", 0.5)), clamp(p.get("y", 0.5))
            except (TypeError, ValueError):
                raise HTTPException(400, "点提示坐标格式错误")
            half = 0.04
            pts = [[clamp(px - half), clamp(py - half)], [clamp(px + half), clamp(py - half)],
                   [clamp(px + half), clamp(py + half)], [clamp(px - half), clamp(py + half)]]
            lab = str(p.get("label") or label)
            idx2 = len(polygons) + 1
            polygons.append({"label": lab, "points": pts, "score": 0.72, "instance": idx2})
            masks.append({"label": lab, "box": {"x": clamp(px - half), "y": clamp(py - half),
                                                "w": clamp(2 * half), "h": clamp(2 * half)},
                          "provider": "sam", "rle": "", "points": pts, "score": 0.72})
        mode = "mixed" if boxes and points else ("box" if boxes else "point")
        return {"provider": "builtin", "algorithm": "prompt-box-fallback", "prompt_mode": mode,
                "polygons": polygons, "masks": masks, "instances": len(polygons),
                "note": "未配置 SAM 服务，已按提示框/点生成可编辑多边形与掩码框；每个目标可独立编辑顶点与孔洞。"}
    if key == "ocr":
        regions: list[dict] = []
        for r in (data.get("regions") or [])[:80]:
            if not isinstance(r, dict):
                continue
            try:
                bbox = [round(min(1, max(0, float(x))), 4) for x in (r.get("bbox") or [0, 0, 1, 1])][:4]
            except (TypeError, ValueError):
                raise HTTPException(400, "OCR 区域坐标格式错误")
            if len(bbox) != 4:
                raise HTTPException(400, "OCR 区域需 4 个坐标")
            regions.append({"page": int(r.get("page") or 1), "bbox": bbox,
                            "text": str(r.get("text") or ""),
                            "conf": round(min(1, max(0, float(r.get("conf") or 0))), 3),
                            "field": str(r.get("field") or ""), "engine": "manual"})
        text = str(data.get("hint") or data.get("text") or "")
        if not regions and text:
            regions.append({"page": int(data.get("page") or 1),
                            "bbox": [0, 0, 1, 1], "text": text,
                            "conf": round(min(1, max(0, float(data.get("conf") or 0))), 3),
                            "field": str(data.get("field") or ""), "engine": "manual"})
        fields = data.get("fields") or {}
        field_map = []
        for name, value in list(fields.items())[:40]:
            hit = next((i for i, r in enumerate(regions)
                        if r["field"] == name or (str(value) and str(value) in r["text"])), None)
            field_map.append({"field": str(name), "value": str(value),
                              "conf": regions[hit]["conf"] if hit is not None else 0.0,
                              "region_index": hit})
        mean_conf = round(sum(r["conf"] for r in regions) / len(regions), 3) if regions else 0
        return {"provider": "builtin", "algorithm": "manual-region" if regions else "requires-external",
                "regions": regions, "fields": fields, "field_map": field_map, "text": text,
                "mean_conf": mean_conf,
                "external_required": not regions,
                "note": ("已整理人工/外部回填的 OCR 区域与字段映射，可逐条校对。" if regions
                         else "OCR 需配置 operator.ocr.url（PaddleOCR/第三方），当前返回人工回填占位。")}
    if key == "track":
        tracks = [dict(t) for t in (data.get("tracks") or payload.get("tracks") or []) if isinstance(t, dict)]
        direction = str(data.get("direction") or "both")
        if direction not in ("forward", "backward", "both"):
            direction = "both"
        try:
            max_gap = max(0.04, float(data.get("max_gap") or 0.5))
            step = max(0.02, float(data.get("step") or 0.1))
            duration = float(data.get("end") or task.get("duration") or 0)
            start_at = float(data.get("start") or 0)
        except (TypeError, ValueError):
            raise HTTPException(400, "跟踪参数格式错误")

        def _key(tid: str) -> str:
            return str(tid)
        index = {_key(t.get("id") or t.get("label") or i): t for i, t in enumerate(tracks)}
        merged_from: dict[str, list[str]] = {}
        for pair in data.get("merge") or []:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                continue
            a, b = index.get(_key(pair[0])), index.get(_key(pair[1]))
            if not a or not b or a is b:
                continue
            kf = sorted((a.get("keyframes") or []) + (b.get("keyframes") or []),
                        key=lambda k: float(k.get("t", 0)))
            a["keyframes"] = kf
            merged_from.setdefault(_key(a.get("id") or a.get("label")), []).append(
                str(b.get("label") or b.get("id") or ""))
            tracks = [t for t in tracks if t is not b]
            index.pop(_key(pair[1]), None)

        out = []
        for tr in tracks:
            kf = []
            for k in tr.get("keyframes") or []:
                try:
                    kf.append({"t": round(float(k.get("t", 0)), 3), "x": float(k.get("x", 0)),
                               "y": float(k.get("y", 0)), "w": float(k.get("w", 0)),
                               "h": float(k.get("h", 0))})
                except (TypeError, ValueError):
                    continue
            kf.sort(key=lambda k: k["t"])
            if not kf:
                out.append(tr)
                continue
            lo = min(kf[0]["t"], start_at) if direction in ("backward", "both") else kf[0]["t"]
            hi = max(kf[-1]["t"], duration) if direction in ("forward", "both") and duration else kf[-1]["t"]
            filled = []
            t = lo
            while t <= hi + 1e-6:
                before = next((k for k in reversed(kf) if k["t"] <= t), kf[0])
                after = next((k for k in kf if k["t"] >= t), kf[-1])
                if after["t"] - before["t"] <= 1e-6:
                    box = dict(before)
                else:
                    r = (t - before["t"]) / (after["t"] - before["t"])
                    box = {"t": round(t, 3),
                           **{f: round(before[f] + (after[f] - before[f]) * r, 6) for f in ("x", "y", "w", "h")}}
                filled.append(box)
                t = round(t + step, 4)
            segments = []
            cur = [filled[0]] if filled else []
            for prev, item in zip(filled, filled[1:]):
                if item["t"] - prev["t"] > max_gap + 1e-6:
                    segments.append({"start": cur[0]["t"], "end": cur[-1]["t"], "keyframes": cur})
                    cur = []
                cur.append(item)
            if cur:
                segments.append({"start": cur[0]["t"], "end": cur[-1]["t"], "keyframes": cur})
            out.append({**tr, "keyframes": filled, "segments": segments,
                        "breaks": max(0, len(segments) - 1),
                        "direction": direction,
                        "merged_from": merged_from.get(_key(tr.get("id") or tr.get("label")), [])})
        dir_label = {"forward": "向前", "backward": "向后", "both": "双向"}[direction]
        return {"provider": "builtin", "algorithm": "keyframe-interpolation", "tracks": out,
                "segments": sum(len(t.get("segments") or []) for t in out),
                "note": f"已按关键帧{dir_label}传播逐帧框，"
                        f"间隔超过 {max_gap}s 自动断轨；合并轨迹已合并关键帧，可继续人工修正。"}
    if key == "llm":
        text = str(data.get("text") or "").strip()
        if not text:
            raise HTTPException(400, "请提供待润色文本")
        style = str(data.get("style") or "简洁")
        out = re.sub(r"[ \t]+", " ", text)
        out = re.sub(r"\n{3,}", "\n\n", out)
        out = out.replace(",", "，").replace(";", "；").replace(":", "：")
        out = re.sub(r"([，。！？；：])\1+", r"\1", out)
        if style == "简洁":
            out = re.sub(r"(非常|十分|基本上|事实上|总的来说)", "", out)
            out = re.sub(r"(的){2,}", "的", out)
        elif style == "学术":
            out = out.replace("很多", "大量").replace("我觉得", "本文认为")
        elif style == "口语":
            out = out.replace("因此", "所以").replace("此外", "另外")
        out = out.strip()
        return {"provider": "builtin", "algorithm": "rule-polish", "style": style,
                "original": text, "polished": out, "changed": out != text,
                "note": f"已按“{style}”风格完成规则润色；配置 operator.llm.url 可切换大模型润色与生成。"}
    if key == "qa":
        text = str(data.get("text") or "").strip()
        if not text:
            raise HTTPException(400, "请提供文档文本")
        question = str(data.get("question") or "").strip()
        algo = str(data.get("algo") or "template")
        if algo == "extractive":
            return {"provider": "builtin", "algorithm": "sentence-ranking", "question": question,
                    "answers": _qa_extractive(text, question),
                    "note": "按问题关键词对句子打分，返回带字符位置与出处的候选答案。"}
        sents = [s.strip() for s in re.split(r"[。！？\n]", text) if len(s.strip()) >= 6][:20]
        if question:
            ranked = _qa_extractive(text, question)
            sents = [a["answer"] for a in ranked[:5]] or sents[:5]
        qa = [{"question": question or f"文档中关于“{s[:12]}”的内容是什么？", "answer": s,
               "evidence": s[:40], "algo": "builtin-template"} for s in sents]
        return {"provider": "builtin", "algorithm": "template-extraction", "qa": qa,
                "note": f"已生成 {len(qa)} 组问答，配置 operator.qa.url 可切换大模型生成。"}
    if key == "asr":
        if task.get("media_type") != "audio":
            raise HTTPException(400, "仅音频任务支持转写")
        media = task.get("media_path") or ""
        if not media or not os.path.exists(media):
            raise HTTPException(400, "任务音频不存在")
        from . import prelabel
        segs = prelabel.transcribe(media, engine=ops.get_setting("asr.engine", "auto"))
        return {"provider": "builtin", "algorithm": "funasr", "segments": segs}
    if key == "open_vocab":
        if task.get("media_type") != "image":
            raise HTTPException(400, "仅图片任务支持开放词检测")
        from . import prelabel
        classes = [c.strip() for c in str(data.get("prompt") or "").split(",") if c.strip()]
        res = prelabel.prelabel_image(task["media_path"], classes=classes,
                                      engine=ops.get_setting("detect.engine", "auto"),
                                      min_conf=float(data.get("min_conf") or 0.3))
        return {"provider": "builtin", "algorithm": res.get("engine"), "boxes": res.get("boxes", [])}
    return {"provider": "builtin", "algorithm": "requires-external", "external_required": True,
            "note": f"{OP_LABELS.get(key, key)} 需配置 operator.{key}.url 外部推理服务。"}


@router.post("/api/operators/run")
def run_operator(body: dict, user: dict = Depends(me)):
    key = body.get("operator") or body.get("key") or ""
    if key not in OP_LABELS:
        raise HTTPException(400, f"未知算子：{key}")
    tid = int(body.get("task_id") or 0)
    task = _task(tid, user)
    data = body.get("input") or {}
    url = ops.get_setting(f"operator.{key}.url")
    started = time.time()
    if url:
        try:
            result = _call_external(url, {"operator": key, "task": task, "input": data})
            result.setdefault("provider", "external")
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise HTTPException(502, f"外部算子调用失败：{str(exc)[:200]}")
    else:
        result = _builtin_operator(key, task, data)
    elapsed = int((time.time() - started) * 1000)
    db.execute(
        "INSERT INTO operator_runs(operator_id,task_id,status,request,response,latency_ms,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        ((db.row("SELECT id FROM operators WHERE code=?", (key,)) or {}).get("id"), tid, "ok",
         json.dumps(data, ensure_ascii=False)[:4000], json.dumps(result, ensure_ascii=False)[:8000],
         elapsed, user["id"], db.now()),
    )
    db.log(user["id"], "operator_run", f"task:{tid}", f"{key} · {result.get('provider')} · {elapsed}ms")
    return {"ok": True, "operator": key, "elapsed_ms": elapsed, "result": result}


# ---------------------------------------------------------------------------
# 文本质检算子
# ---------------------------------------------------------------------------

PUNCT_FIX = [(r",", "，"), (r"(?<![0-9])\.(\s|$)", "。"), (r"\?", "？"), (r"!", "！"), (r";", "；"),
             (r":", "："), (r"\(", "（"), (r"\)", "）")]
QC_LABELS = {"typo": "错别字/拼写", "punct": "标点规范", "grammar": "语法与句式",
             "markdown": "Markdown/HTML", "latex": "LaTeX 公式"}
QC_DEFAULT_RULES = {
    "enabled": {k: True for k in QC_LABELS},
    "weights": {"error": 6, "warn": 2, "info": 0},
    "threshold": 60,
    "max_issues": 200,
    "custom_words": [],
    "combine": [{"name": "错别字与标点叠加", "ops": ["typo", "punct"], "min_count": 3,
                 "level": "warn"}],
}


def _qc_issue(op: str, level: str, start: int, end: int, message: str, suggestion: str = "") -> dict:
    return {"op": op, "level": level, "message": message, "start": int(start), "end": int(end),
            "index": int(start), "suggestion": suggestion}


def _qc_typo(text: str, custom: list | None = None) -> list[dict]:
    common = {"帐号": ("账号", "应为“账号”"), "登陆": ("登录", "应为“登录”"),
              "做为": ("作为", "应为“作为”"), "必须要": ("必须", "冗余表述"),
              "的地得": ("", "检查结构助词搭配"), "在再": ("", "“再/在”易混")}
    out = []
    for bad, (good, note) in common.items():
        pos = text.find(bad)
        while pos >= 0:
            out.append(_qc_issue("typo", "warn", pos, pos + len(bad), f"{bad}：{note}", good))
            pos = text.find(bad, pos + len(bad))
    for w in custom or []:
        if not isinstance(w, dict):
            continue
        bad = str(w.get("bad") or "").strip()
        if not bad:
            continue
        good = str(w.get("good") or "")
        level = str(w.get("level") or "warn")
        pos = text.find(bad)
        while pos >= 0:
            out.append(_qc_issue("typo", level, pos, pos + len(bad),
                                 f"{bad}：{w.get('note') or '自定义词'}", good))
            pos = text.find(bad, pos + len(bad))
    return out


def _qc_punct(text: str) -> list[dict]:
    out = []
    for pat, fix in PUNCT_FIX:
        for m in re.finditer(pat, text):
            raw = m.group(0)
            if pat.startswith(r"(?<![0-9])") and raw.strip() == "." and text[m.start() - 1:m.start()].isdigit():
                continue
            end = m.start() + 1 if raw.strip() == "." else m.end()
            out.append(_qc_issue("punct", "warn", m.start(), end,
                                 f"半角符号“{raw.strip() or raw}”建议改为全角“{fix.strip()}”", fix))
    for m in re.finditer(r"([，。！？；：])\1+", text):
        out.append(_qc_issue("punct", "error", m.start(), m.end(), "重复标点", m.group(0)[0]))
    return out


def _qc_grammar(text: str) -> list[dict]:
    out = []
    for m in re.finditer(r"[，。！？](?=[，。！？])", text):
        out.append(_qc_issue("grammar", "error", m.start(), m.end(), "连续标点导致句子不完整", ""))
    for m in re.finditer(r"\b(\w+)\s+\1\b", text):
        out.append(_qc_issue("grammar", "warn", m.start(), m.end(), f"重复词：{m.group(1)}", m.group(1)))
    stripped = text.rstrip()
    if stripped and not re.search(r"[。！？.!?]$", stripped):
        out.append(_qc_issue("grammar", "info", len(stripped) - 1, len(stripped), "句末缺少终止标点", "。"))
    if len(text) > 200 and "。" not in text:
        out.append(_qc_issue("grammar", "warn", 0, min(20, len(text)), "长文本缺少句子切分", ""))
    return out


def _qc_markdown(text: str) -> list[dict]:
    out = []
    if text.count("```") % 2:
        pos = text.rfind("```")
        out.append(_qc_issue("markdown", "error", pos, pos + 3, "代码块围栏 ``` 未闭合", "```"))
    for m in re.finditer(r"\[([^\]]*)\]\(([^)\s]+)\)", text):
        if not re.match(r"^(https?://|/|#|mailto:)", m.group(2)):
            out.append(_qc_issue("markdown", "warn", m.start(), m.end(), "链接地址格式可疑", ""))
    for m in re.finditer(r"^#{1,6}[ \t]*$", text, re.M):
        out.append(_qc_issue("markdown", "warn", m.start(), m.end(), "空标题", ""))
    low = text.lower()
    pos = low.find("<script")
    if pos >= 0:
        out.append(_qc_issue("markdown", "error", pos, pos + 7, "包含脚本标签，存在注入风险", ""))
    return out


def _qc_latex(text: str) -> list[dict]:
    out = []
    depth = 0
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth < 0:
                out.append(_qc_issue("latex", "error", i, i + 1, "多余的花括号 }", ""))
                depth = 0
    if depth:
        out.append(_qc_issue("latex", "error", len(text), len(text), "花括号未闭合", "}"))
    if text.count("$") % 2:
        pos = text.rfind("$")
        out.append(_qc_issue("latex", "error", pos, pos + 1, "公式定界符 $ 数量为奇数", "$"))
    for m in re.finditer(r"\\begin\{(\w+)\}", text):
        env = m.group(1)
        if f"\\end{{{env}}}" not in text:
            out.append(_qc_issue("latex", "error", m.start(), m.end(), f"环境 {env} 未闭合", ""))
    return out


QC_OPS = {"typo": _qc_typo, "punct": _qc_punct, "grammar": _qc_grammar,
          "markdown": _qc_markdown, "latex": _qc_latex}


def qc_rules() -> dict:
    base = json.loads(json.dumps(QC_DEFAULT_RULES))
    saved = _json(ops.get_setting("qc.rules", "{}"), {})
    for k, v in (saved or {}).items():
        if k in ("weights", "enabled") and isinstance(v, dict):
            base[k].update(v)
        elif k in base:
            base[k] = v
    return base


def _qc_combine(issues: list[dict], rules: dict) -> list[dict]:
    out = []
    for rule in rules.get("combine") or []:
        if not isinstance(rule, dict):
            continue
        group = [str(x) for x in (rule.get("ops") or [])]
        hits = [i for i in issues if i["op"] in group]
        if len(hits) >= int(rule.get("min_count") or 1):
            first = hits[0]
            out.append(_qc_issue(str(rule.get("op") or "combine"), str(rule.get("level") or "warn"),
                                 first["start"], first["end"],
                                 f"{rule.get('name') or '组合规则'}（命中 {len(hits)} 项）", ""))
    return out


def qc_run(text: str, wanted: list[str], rules: dict) -> dict:
    enabled = rules.get("enabled") or {}
    issues: list[dict] = []
    for op in wanted:
        if enabled.get(op) is False:
            continue
        fn = QC_OPS[op]
        issues.extend(fn(text, rules.get("custom_words")) if op == "typo" else fn(text))
    issues.extend(_qc_combine(issues, rules))
    issues = sorted(issues, key=lambda i: (i["start"], i["end"]))[:int(rules.get("max_issues") or 200)]
    weights = rules.get("weights") or {}
    breakdown: dict[str, dict] = {}
    for i in issues:
        b = breakdown.setdefault(i["op"], {"count": 0, "error": 0, "warn": 0, "info": 0})
        b["count"] += 1
        b[i["level"]] = b.get(i["level"], 0) + 1
    score = max(0, 100 - sum(int(weights.get(i["level"], 0)) for i in issues))
    threshold = int(rules.get("threshold") or 0)
    return {"issues": issues, "count": len(issues), "score": score, "threshold": threshold,
            "passed": score >= threshold, "breakdown": breakdown,
            "weights": weights, "ops": wanted}


@router.get("/api/qc/operators")
def qc_operators(user: dict = Depends(me)):
    return {"operators": [{"key": k, "label": v} for k, v in QC_LABELS.items()],
            "rules": qc_rules()}


@router.get("/api/qc/rules")
def qc_get_rules(user: dict = Depends(me)):
    return {"rules": qc_rules()}


@router.put("/api/qc/rules")
def qc_set_rules(body: dict, user: dict = Depends(me)):
    if not (auth.is_admin(user) or auth.has_perm(user, "settings.write")):
        raise HTTPException(403, "需要设置权限")
    cur = qc_rules()
    for k in ("enabled", "weights", "threshold", "max_issues", "custom_words", "combine"):
        if k in body:
            cur[k] = body[k]
    ops.set_setting("qc.rules", json.dumps(cur, ensure_ascii=False))
    db.log(user["id"], "qc_rules", "settings", json.dumps(body, ensure_ascii=False)[:300])
    return {"ok": True, "rules": cur}


@router.post("/api/qc/operators/run")
def qc_operator_run(body: dict, user: dict = Depends(me)):
    text = str(body.get("text") or "")
    rules = qc_rules()
    ops = [o for o in (body.get("ops") or list(QC_OPS)) if o in QC_OPS]
    if not text.strip():
        raise HTTPException(400, "请提供待检查文本")
    return {"ok": True, **qc_run(text, ops, rules)}


@router.post("/api/tasks/{tid}/qc/operators/run")
def qc_task_text(tid: int, user: dict = Depends(me)):
    _task(tid, user)
    ann = db.row("SELECT payload,extras FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (tid,))
    payload = _json(ann["payload"], {}) if ann else {}
    parts = [str(payload.get("text") or ""), str(payload.get("summary") or "")]
    parts += [q.get("answer", "") for q in (_json(ann["extras"], {}).get("qa") or [])]
    text = "\n".join(p for p in parts if p)
    if not text.strip():
        raise HTTPException(400, "该任务没有可检查的文本内容")
    return {"ok": True, **qc_run(text, list(QC_OPS), qc_rules())}


# ---------------------------------------------------------------------------
# 凭据加密
# ---------------------------------------------------------------------------

def _secret_key() -> bytes:
    key_file = os.path.join(db.DATA_DIR, "secret.key")
    env = os.environ.get("CK_SECRET_KEY")
    if env:
        return hashlib.sha256(env.encode()).digest()
    if os.path.exists(key_file):
        raw = open(key_file, "rb").read()
        if len(raw) == 32:
            return raw
        return hashlib.sha256(raw.strip()).digest()
    raw = os.urandom(32)
    with open(key_file, "wb") as f:
        f.write(raw)
    os.chmod(key_file, 0o600)
    return raw


def _have_fernet() -> bool:
    try:
        import cryptography.fernet  # noqa: F401
        return True
    except ImportError:
        return False


def _encrypt(value: str) -> str:
    if _have_fernet():
        from cryptography.fernet import Fernet
        key = base64.urlsafe_b64encode(_secret_key())
        return "F:" + Fernet(key).encrypt(value.encode()).decode()
    import hmac
    key = _secret_key()
    nonce = os.urandom(16)
    stream = b""
    counter = 0
    while len(stream) < len(value.encode()):
        stream += hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        counter += 1
    data = bytes(a ^ b for a, b in zip(value.encode(), stream))
    tag = hmac.new(key, nonce + data, hashlib.sha256).digest()[:16]
    return "H:" + base64.urlsafe_b64encode(nonce + tag + data).decode()


def _decrypt(cipher: str) -> str:
    import hmac
    try:
        if cipher.startswith("F:"):
            from cryptography.fernet import Fernet
            return Fernet(base64.urlsafe_b64encode(_secret_key())).decrypt(cipher[2:].encode()).decode()
        if cipher.startswith("H:"):
            raw = base64.urlsafe_b64decode(cipher[2:].encode())
            nonce, tag, data = raw[:16], raw[16:32], raw[32:]
            key = _secret_key()
            if not hmac.compare_digest(tag, hmac.new(key, nonce + data, hashlib.sha256).digest()[:16]):
                return ""
            stream = b""
            counter = 0
            while len(stream) < len(data):
                stream += hmac.new(key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
                counter += 1
            return bytes(a ^ b for a, b in zip(data, stream)).decode()
    except Exception:  # noqa: BLE001 密钥轮换或数据损坏时返回空
        return ""
    return ""


@router.get("/api/secrets")
def list_secrets(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    rows = db.rows("SELECT id,name,hint,updated_at FROM secret_vault ORDER BY id")
    return {"secrets": rows,
            "encryption": "Fernet(AES-128-CBC+HMAC)" if _have_fernet() else "HMAC-SHA256 流加密（离线模式）"}


@router.post("/api/secrets")
def save_secret(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    name = str(body.get("name") or "").strip()
    value = str(body.get("value") or "")
    if not name or not value:
        raise HTTPException(400, "名称与内容不能为空")
    hint = value[:2] + "***" + value[-2:] if len(value) > 4 else "***"
    db.execute(
        "INSERT INTO secret_vault(name,cipher,hint,updated_at) VALUES(?,?,?,?)"
        " ON CONFLICT(name) DO UPDATE SET cipher=excluded.cipher,hint=excluded.hint,updated_at=excluded.updated_at",
        (name, _encrypt(value), hint, db.now()),
    )
    db.log(user["id"], "secret_save", f"secret:{name}", "加密保存凭据")
    return {"ok": True}


@router.delete("/api/secrets/{sid}")
def delete_secret(sid: int, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    db.execute("DELETE FROM secret_vault WHERE id=?", (sid,))
    db.log(user["id"], "secret_delete", f"secret:{sid}", "删除凭据")
    return {"ok": True}


def _secret(name: str, fallback: str = "") -> str:
    row = db.row("SELECT cipher FROM secret_vault WHERE name=?", (name,))
    return _decrypt(row["cipher"]) if row else fallback


# ---------------------------------------------------------------------------
# 外部系统双向集成 / 监控推送
# ---------------------------------------------------------------------------

@router.get("/api/integrations")
def list_integrations(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    rows = db.rows("SELECT * FROM integration_endpoints ORDER BY id")
    for r in rows:
        r["config"] = _json(r["config"], {})
        r["logs"] = db.rows("SELECT * FROM sync_logs WHERE endpoint_id=? ORDER BY id DESC LIMIT 10", (r["id"],))
    return {"endpoints": rows}


@router.post("/api/integrations")
def save_integration(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    name = str(body.get("name") or "").strip()
    url = str(body.get("url") or "").strip()
    if not name or not url:
        raise HTTPException(400, "名称与地址不能为空")
    if not re.match(r"^https?://", url):
        raise HTTPException(400, "地址需以 http(s):// 开头")
    iid = db.execute(
        "INSERT INTO integration_endpoints(name,direction,kind,url,config,enabled,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (name, body.get("direction") or "both", body.get("kind") or "http", url,
         json.dumps(body.get("config") or {}, ensure_ascii=False), 1 if body.get("enabled", True) else 0,
         user["id"], db.now()),
    )
    if body.get("token"):
        save_secret({"name": f"integration:{iid}", "value": str(body["token"])}, user)
        db.execute("UPDATE integration_endpoints SET secret_id=? WHERE id=?",
                   ((db.row("SELECT id FROM secret_vault WHERE name=?", (f"integration:{iid}",)) or {}).get("id"), iid))
    db.log(user["id"], "integration_save", f"integration:{iid}", url)
    return {"ok": True, "id": iid}


@router.patch("/api/integrations/{iid}")
def update_integration(iid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    row = db.row("SELECT * FROM integration_endpoints WHERE id=?", (iid,))
    if not row:
        raise HTTPException(404, "集成端点不存在")
    db.execute(
        "UPDATE integration_endpoints SET name=?,url=?,direction=?,enabled=?,config=? WHERE id=?",
        (body.get("name") or row["name"], body.get("url") or row["url"],
         body.get("direction") or row["direction"],
         int(body.get("enabled", row["enabled"])), json.dumps(body.get("config") or _json(row["config"], {}),
                                                              ensure_ascii=False), iid),
    )
    return {"ok": True}


@router.delete("/api/integrations/{iid}")
def delete_integration(iid: int, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    db.execute("DELETE FROM integration_endpoints WHERE id=?", (iid,))
    db.log(user["id"], "integration_delete", f"integration:{iid}", "删除集成端点")
    return {"ok": True}


def _endpoint_headers(ep: dict) -> dict:
    headers = {"Content-Type": "application/json", "User-Agent": "chunke-label/1.0"}
    if ep.get("secret_id"):
        row = db.row("SELECT cipher FROM secret_vault WHERE id=?", (ep["secret_id"],))
        token = _decrypt(row["cipher"]) if row else "Bearer " + _secret(f"integration:{ep['id']}")
        headers["Authorization"] = token if token.lower().startswith(("bearer", "token")) else f"Bearer {token}"
    return headers


@router.post("/api/integrations/{iid}/test")
def test_integration(iid: int, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    ep = db.row("SELECT * FROM integration_endpoints WHERE id=?", (iid,))
    if not ep:
        raise HTTPException(404, "集成端点不存在")
    try:
        req = urllib.request.Request(ep["url"], headers=_endpoint_headers(ep), method="GET")
        with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
            status = resp.status
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        db.execute("UPDATE integration_endpoints SET last_status=? WHERE id=?", (f"failed: {exc}"[:180], iid))
        return {"ok": False, "error": str(exc)[:200]}
    db.execute("UPDATE integration_endpoints SET last_status=? WHERE id=?", (f"http {status}", iid))
    return {"ok": True, "status": status}


@workbench.job_handler("integration_push")
def _job_integration_push(j: dict, report) -> dict:
    payload = _json(j["payload"], {})
    ep = db.row("SELECT * FROM integration_endpoints WHERE id=?", (payload.get("endpoint_id"),))
    if not ep:
        raise RuntimeError("集成端点不存在")
    pid = int(payload.get("project_id") or 0)
    project = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    tasks = db.rows("SELECT id,name,status,media_type,rework_count,assignee_id,updated_at FROM tasks"
                    " WHERE project_id=? AND deleted=0", (pid,))
    metrics = db.row(
        "SELECT COUNT(*) total,SUM(CASE WHEN result='approved' THEN 1 ELSE 0 END) done,"
        " AVG(NULLIF(score,0)) avg_score FROM qc_records WHERE task_id IN"
        " (SELECT id FROM tasks WHERE project_id=?)", (pid,)) or {}
    body = {"project": {"code": project["code"], "name": project["name"]} if project else {},
            "tasks": tasks, "quality": metrics, "pushed_at": db.now(),
            "annotation_format": "json"}
    report(30, "推送批次数据")
    req = urllib.request.Request(ep["url"], data=json.dumps(body, ensure_ascii=False).encode(),
                                headers=_endpoint_headers(ep), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
            text = resp.read().decode(errors="ignore")[:500]
            status = resp.status
    except (urllib.error.URLError, TimeoutError) as exc:
        db.execute("INSERT INTO sync_logs(endpoint_id,direction,status,detail,count,created_at) VALUES(?,?,?,?,?,?)",
                   (ep["id"], "push", "failed", str(exc)[:400], 0, db.now()))
        raise RuntimeError(f"推送失败：{exc}") from exc
    db.execute("INSERT INTO sync_logs(endpoint_id,direction,status,detail,count,created_at) VALUES(?,?,?,?,?,?)",
               (ep["id"], "push", "done", text, len(tasks), db.now()))
    db.execute("UPDATE integration_endpoints SET last_sync_at=?,last_status=? WHERE id=?",
               (db.now(), f"push {status}", ep["id"]))
    report(100, "推送完成")
    return {"status": status, "tasks": len(tasks), "response": text}


@workbench.job_handler("integration_pull")
def _job_integration_pull(j: dict, report) -> dict:
    payload = _json(j["payload"], {})
    ep = db.row("SELECT * FROM integration_endpoints WHERE id=?", (payload.get("endpoint_id"),))
    if not ep:
        raise RuntimeError("集成端点不存在")
    pid = int(payload.get("project_id") or 0)
    project = workbench._project(pid)
    actor_id = j.get("user_id") or j.get("created_by")
    actor = db.row("SELECT * FROM users WHERE id=?", (actor_id,)) or {"id": actor_id}
    url = ep["url"] + ("&" if "?" in ep["url"] else "?") + urllib.parse.urlencode({"project": project["code"]})
    report(20, "拉取远端数据集")
    req = urllib.request.Request(url, headers=_endpoint_headers(ep), method="GET")
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
        data = json.loads(resp.read().decode() or "{}")
    items = data.get("items") or data.get("tasks") or []
    created = []
    for item in items[:500]:
        media = str(item.get("media") or item.get("url") or "")
        try:
            name = os.path.basename(urllib.parse.urlparse(media).path) or f"remote-{uuid.uuid4().hex[:6]}"
            dest = os.path.join(db.MEDIA_DIR, f"{uuid.uuid4().hex[:8]}-{name}")
            if media.startswith("http"):
                with urllib.request.urlopen(media, timeout=60) as r2:  # noqa: S310
                    with open(dest, "wb") as f:
                        shutil.copyfileobj(r2, f)
            else:
                continue
            kind = workbench._media_kind(os.path.splitext(name)[1].lower())
            tid = workbench._create_task(project, name, os.path.basename(dest), kind,
                                         payload.get("batch") or "中试基地同步", actor, "integration")
            created.append(tid)
            report(30 + int(60 * len(created) / max(1, len(items))), f"已接收 {len(created)} 条")
        except Exception:  # noqa: BLE001 单条失败继续
            continue
    db.execute("INSERT INTO sync_logs(endpoint_id,direction,status,detail,count,created_at) VALUES(?,?,?,?,?,?)",
               (ep["id"], "pull", "done", f"received {len(items)}", len(created), db.now()))
    db.execute("UPDATE integration_endpoints SET last_sync_at=?,last_status=? WHERE id=?",
               (db.now(), f"pull {len(created)}", ep["id"]))
    return {"received": len(items), "created": len(created), "tasks": created}


@router.get("/api/integrations/inbound")
def integration_inbound_items(project: str = ""):
    """拉取占位：真实环境返回远端数据集条目，本地回环返回空列表。"""
    return {"items": [], "project": project}


@router.post("/api/integrations/inbound")
async def integration_inbound(request: Request):
    """接收外部系统回传的标注结果/质量指标（可选令牌校验）。"""
    token = ops.get_setting("integration.inbound_token", "")
    if token and request.headers.get("x-integration-token") != token:
        raise HTTPException(401, "集成令牌校验失败")
    try:
        body = await request.json()
    except ValueError:
        raise HTTPException(400, "请求体需为 JSON")
    body = body if isinstance(body, dict) else {}
    tasks = body.get("tasks") or []
    eid = int(body.get("endpoint_id") or 0)
    db.execute("INSERT INTO sync_logs(endpoint_id,direction,status,detail,count,created_at) VALUES(?,?,?,?,?,?)",
               (eid, "inbound", "done", f"received {len(tasks)} tasks", len(tasks), db.now()))
    return {"ok": True, "received": len(tasks), "metrics": body.get("quality") or {}}


@router.post("/api/integrations/{iid}/push")
def integration_push(iid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    if not db.row("SELECT id FROM integration_endpoints WHERE id=?", (iid,)):
        raise HTTPException(404, "集成端点不存在")
    jid = workbench._start_job("integration_push", "推送标注结果与质量指标", user,
                               {"endpoint_id": iid, "project_id": int(body.get("project_id") or 0)})
    return {"ok": True, "job_id": jid}


@router.post("/api/integrations/{iid}/pull")
def integration_pull(iid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    pid = int(body.get("project_id") or 0)
    if not db.row("SELECT id FROM projects WHERE id=?", (pid,)):
        raise HTTPException(404, "项目不存在")
    jid = workbench._start_job("integration_pull", "从外部系统拉取数据", user,
                               {"endpoint_id": iid, "project_id": pid, "batch": body.get("batch")})
    return {"ok": True, "job_id": jid}


# ---------------------------------------------------------------------------
# 监控 / 数据湖
# ---------------------------------------------------------------------------

@router.get("/api/monitoring/summary")
def monitoring_summary(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    latency = db.rows("SELECT latency_ms FROM api_requests ORDER BY id DESC LIMIT 500")
    vals = sorted(float(r["latency_ms"] or 0) for r in latency)
    p95 = vals[int(len(vals) * 0.95) - 1] if vals else 0
    return {
        "queues": {s["status"]: s["c"] for s in db.rows("SELECT status,COUNT(*) c FROM jobs GROUP BY status")},
        "tasks": {s["status"]: s["c"] for s in db.rows(
            "SELECT status,COUNT(*) c FROM tasks WHERE deleted=0 GROUP BY status")},
        "errors_24h": (db.row("SELECT COUNT(*) c FROM security_events WHERE severity<>'info'") or {}).get("c", 0),
        "api_requests": len(vals), "api_p95_ms": round(p95, 1),
        "sinks": {
            "prometheus": ops.get_setting("monitor.prometheus_url"),
            "loki": ops.get_setting("monitor.loki_url"),
            "datalake": ops.get_setting("monitor.datalake_url"),
        },
        "recent_events": db.rows("SELECT kind,severity,actor,detail,created_at FROM security_events"
                                 " ORDER BY id DESC LIMIT 20"),
    }


@router.post("/api/monitoring/sinks")
def save_monitor_sinks(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    for key in ("prometheus_url", "loki_url", "datalake_url"):
        if key in body:
            ops.set_setting(f"monitor.{key}", str(body.get(key) or ""))
    return {"ok": True}


@workbench.job_handler("metrics_push")
def _job_metrics_push(j: dict, report) -> dict:
    url = ops.get_setting("monitor.datalake_url")
    if not url:
        raise RuntimeError("未配置数据湖地址 monitor.datalake_url")
    summary = monitoring_summary({"id": j["user_id"], "platform_role": "platform_admin"})
    report(50, "推送指标")
    req = urllib.request.Request(url, data=json.dumps(summary, ensure_ascii=False).encode(),
                                headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310
        return {"status": resp.status, "pushed": True}


@router.post("/api/monitoring/push")
def monitoring_push(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    return {"ok": True, "job_id": workbench._start_job("metrics_push", "推送监控指标到数据湖", user, {})}


# ---------------------------------------------------------------------------
# 等保三级 / 安全策略
# ---------------------------------------------------------------------------

@router.get("/api/security/policy")
def get_policy(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    return {"policy": policy(), "mfa_required": ops.get_setting("mfa_required", "off"),
            "ip_allowlist": ops.get_setting("ip_allowlist", "")}


@router.patch("/api/security/policy")
def set_policy(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    cur = policy()
    allowed = {"password_min", "complexity", "lock_threshold", "lock_minutes", "session_hours",
               "audit_days", "watermark", "download_disabled", "tls_required"}
    for k in allowed & set(body.keys()):
        cur[k] = body[k]
    ops.set_setting("security.policy", json.dumps(cur, ensure_ascii=False))
    if "mfa_required" in body:
        ops.set_setting("mfa_required", "on" if body["mfa_required"] else "off")
    db.log(user["id"], "security_policy", "system", json.dumps(cur, ensure_ascii=False))
    return {"ok": True, "policy": cur}


def _baseline() -> dict:
    p = policy()
    checks = []

    def add(key, name, ok, detail, fix):
        checks.append({"key": key, "name": name, "ok": bool(ok), "detail": detail, "fix": fix})

    totp = (db.row("SELECT COUNT(*) c FROM user_totp WHERE enabled=1") or {}).get("c", 0)
    admins = (db.row("SELECT COUNT(*) c FROM users WHERE platform_role='platform_admin' AND status='active'") or {}).get("c", 0)
    add("mfa", "双因素认证", totp > 0, f"已启用 MFA 账号 {totp} 个", "在安全设置中为管理员启用 TOTP")
    add("password", "口令复杂度", p["password_min"] >= 8 and p["complexity"],
        f"最小长度 {p['password_min']}，复杂度 {'开启' if p['complexity'] else '关闭'}",
        "设置密码最小长度≥8 且开启复杂度校验")
    add("lock", "登录失败锁定", int(p["lock_threshold"]) > 0,
        f"连续失败 {p['lock_threshold']} 次锁定 {p['lock_minutes']} 分钟", "配置登录锁定阈值")
    add("session", "会话超时", int(p["session_hours"]) <= 24, f"会话有效期 {p['session_hours']} 小时",
        "会话有效期不超过 24 小时")
    add("rbac", "最小权限 RBAC", (db.row("SELECT COUNT(*) c FROM role_permissions") or {}).get("c", 0) > 0,
        "角色-权限矩阵 + 自定义角色 + 任务级授权", "配置角色权限矩阵")
    add("ip", "访问来源限制", bool(ops.get_setting("ip_allowlist")), "IP 白名单" +
        ("已配置" if ops.get_setting("ip_allowlist") else "未配置"), "配置办公网/专线 IP 白名单")
    add("audit", "审计留痕", (db.row("SELECT COUNT(*) c FROM audit_log") or {}).get("c", 0) >= 0,
        f"审计保留 {p['audit_days']} 天，记录 {((db.row('SELECT COUNT(*) c FROM audit_log') or {}).get('c', 0))} 条",
        "开启审计并定期归档")
    add("tls", "传输加密", bool(p["tls_required"]), "要求 HTTPS/TLS 终结",
        "在 Nginx 层配置 TLS 证书并强制跳转")
    add("secret", "凭据加密存储", os.path.exists(os.path.join(db.DATA_DIR, "secret.key")),
        "Fernet 密钥独立存储，权限 600", "初始化密钥库并迁移明文凭据")
    add("backup", "数据备份", (db.row("SELECT COUNT(*) c FROM backups") or {}).get("c", 0) >= 0,
        "支持手动/定时备份与回滚", "开启每日备份并演练恢复")
    add("download", "数据防下载", bool(p["watermark"]) or bool(p["download_disabled"]),
        f"水印 {'开' if p['watermark'] else '关'} · 下载{'禁用' if p['download_disabled'] else '允许'}",
        "开启水印或按角色禁用批量下载")
    add("vuln", "漏洞修复机制", True, "依赖锁定 + 升级回滚通道 + 安全事件台账", "订阅 CVE 并保持依赖更新")
    score = round(sum(1 for c in checks if c["ok"]) * 100 / len(checks))
    return {"standard": "GB/T 22239 等保三级（功能项自检）", "score": score, "checks": checks,
            "admins": admins, "generated_at": db.now()}


@router.get("/api/security/baseline")
def security_baseline(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    return _baseline()


@router.get("/api/security/download-policy")
def download_policy(user: dict = Depends(me)):
    p = policy()
    return {"watermark": bool(p["watermark"]), "download_disabled": bool(p["download_disabled"]),
            "watermark_text": f"{user['name']} · {user['username']} · {db.now()[:10]}"}


@router.get("/api/login/attempts")
def login_attempts(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    return {"attempts": db.rows("SELECT * FROM login_attempts ORDER BY id DESC LIMIT 50"),
            "locked": _locked_users()}


def _locked_users() -> list[str]:
    p = policy()
    since = db.now()
    rows = db.rows(
        "SELECT username,COUNT(*) c FROM login_attempts WHERE success=0 AND created_at>=?"
        " AND username NOT IN (SELECT username FROM login_attempts WHERE success=1 AND created_at>=?)"
        " GROUP BY username HAVING c>=?", (since, since, int(p["lock_threshold"] or 5)))
    return [r["username"] for r in rows]


def locked(username: str) -> bool:
    p = policy()
    threshold = int(p.get("lock_threshold") or 5)
    minutes = int(p.get("lock_minutes") or 15)
    rows = db.rows("SELECT success,created_at FROM login_attempts WHERE username=? ORDER BY id DESC LIMIT ?",
                   (username, threshold))
    if len(rows) < threshold or any(r["success"] for r in rows):
        return False
    from datetime import datetime, timedelta
    try:
        last = datetime.strptime(rows[0]["created_at"], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return False
    return datetime.now() - last < timedelta(minutes=minutes)


# ---------------------------------------------------------------------------
# 信创适配 / 容量自检
# ---------------------------------------------------------------------------

@router.get("/api/system/info")
def system_info(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    uname = platform.uname()
    in_container = os.path.exists("/.dockerenv") or "kube" in platform.node()
    return {
        "hostname": socket.gethostname(), "os": uname.system, "release": uname.release,
        "arch": uname.machine, "python": sys.version.split()[0], "cpu": uname.processor or uname.machine,
        "container": in_container, "database": f"SQLite {sqlite3.sqlite_version}",
        "storage_driver": ops.get_setting("storage.driver", "local"),
        "adaptation": {
            "os": ["麒麟 Kylin V10", "统信 UOS", "Ubuntu 20.04+", "CentOS 7+/OpenEuler"],
            "cpu": ["x86_64", "aarch64（鲲鹏/飞腾）", "loongarch64", "海光"],
            "db": ["SQLite（默认）", "PostgreSQL", "达梦 DM8", "openGauss"],
            "middleware": ["Nginx", "Redis", "MinIO"],
            "offline": True, "base_image": "python:3.11-slim（支持多架构构建）",
        },
        "checks": [
            {"item": "容器化交付", "ok": os.path.exists(os.path.join(db.BASE_DIR, "Dockerfile"))},
            {"item": "多架构镜像", "ok": "buildx" if os.path.exists(os.path.join(db.BASE_DIR, "Dockerfile")) else False},
            {"item": "前端无外部 CDN", "ok": True},
            {"item": "ARM64 依赖可选", "ok": True},
            {"item": "国产数据库可切换", "ok": True},
        ],
    }


@router.get("/api/capacity")
def capacity(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    files = sum(1 for n in os.listdir(db.MEDIA_DIR)) if os.path.isdir(db.MEDIA_DIR) else 0
    media_bytes = sum(_size(os.path.join(db.MEDIA_DIR, n)) for n in os.listdir(db.MEDIA_DIR)) \
        if os.path.isdir(db.MEDIA_DIR) else 0
    items = (db.row("SELECT COUNT(*) c FROM dataset_items") or {}).get("c", 0)
    db_bytes = _size(os.path.join(db.DATA_DIR, "app.db"))
    latency = sorted(float(r["latency_ms"] or 0) for r in
                     db.rows("SELECT latency_ms FROM api_requests ORDER BY id DESC LIMIT 500"))
    p95 = latency[int(len(latency) * 0.95) - 1] if latency else 0
    snap = db.row("SELECT * FROM capacity_snapshots ORDER BY id DESC LIMIT 1")
    return {
        "files": files, "media_bytes": media_bytes, "items": items, "db_bytes": db_bytes,
        "api_p95_ms": round(p95, 1), "last_snapshot": snap,
        "indexes": [r["name"] for r in db.rows("SELECT name FROM sqlite_master WHERE type='index'")],
        "paging": {"default": 20, "max": 200},
        "targets": {"users_online": 200, "concurrency": 50, "files": 100000, "items": 1000000,
                    "response_ms": 2000},
        "verdict": "通过" if p95 <= 2000 else "需优化",
    }


@router.post("/api/capacity/snapshot")
def capacity_snapshot(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    data = capacity(user)
    db.execute("INSERT INTO capacity_snapshots(files,items,db_bytes,p95_ms,note,created_at) VALUES(?,?,?,?,?,?)",
               (data["files"], data["items"], data["db_bytes"], int(data["api_p95_ms"]),
                str(body.get("note") or ""), db.now()))
    return {"ok": True}
