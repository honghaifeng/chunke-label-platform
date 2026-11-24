"""登录态与权限判定。"""
from __future__ import annotations

import json
import os
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException, Request

from . import db

COOKIE = "chunke_session"
SESSION_TTL_HOURS = 12

PLATFORM_ROLES = {
    "platform_admin": "平台管理员",
    "tenant_admin": "租户管理员",
    "project_manager": "项目经理",
    "annotator": "标注员",
    "reviewer": "质检员",
    "acceptor": "验收员",
    "client": "客户(只读)",
}
PROJECT_ROLES = {
    "manager": "项目经理",
    "annotator": "标注员",
    "reviewer": "质检员",
    "acceptor": "验收员",
    "viewer": "只读",
}


def _expiry() -> str:
    return (datetime.now() + timedelta(hours=SESSION_TTL_HOURS)).strftime("%Y-%m-%d %H:%M:%S")


def _prune_expired() -> None:
    db.execute("DELETE FROM sessions WHERE expires_at < ?", (db.now(),))


def create_session(user_id: int) -> str:
    token = secrets.token_hex(24)
    _prune_expired()
    db.execute(
        "INSERT INTO sessions(token,user_id,created_at,expires_at) VALUES(?,?,?,?)",
        (token, user_id, db.now(), _expiry()),
    )
    return token


def destroy_session(token: str | None) -> None:
    if token:
        db.execute("DELETE FROM sessions WHERE token=?", (token,))


def set_active_tenant(token: str | None, tenant_id: int | None) -> None:
    if not token:
        return
    if tenant_id:
        db.execute("UPDATE sessions SET tenant_id=? WHERE token=?", (int(tenant_id), token))
    else:
        db.execute("UPDATE sessions SET tenant_id=NULL WHERE token=?", (token,))


def user_by_token(token: str | None) -> dict | None:
    if not token:
        return None
    return db.row(
        "SELECT u.id,u.username,u.name,u.platform_role,u.status,u.tenant_id,u.org_id,u.team_id,"
        " s.tenant_id session_tenant_id"
        " FROM sessions s JOIN users u ON u.id=s.user_id"
        " WHERE s.token=? AND s.expires_at >= ?",
        (token, db.now()),
    )


def current_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    user = user_by_token(token)
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="请先登录")
    active = user.pop("session_tenant_id", None)
    if active and active != user.get("tenant_id"):
        user["tenant_id"] = active
        member = db.row(
            "SELECT org_id,team_id FROM tenant_members WHERE tenant_id=? AND user_id=? AND status='active'",
            (active, user["id"]),
        )
        if member:
            user["org_id"] = member["org_id"]
            user["team_id"] = member["team_id"]
    return user


def require(user: dict, *roles: str) -> None:
    if user["platform_role"] not in roles:
        raise HTTPException(status_code=403, detail="当前角色无权执行该操作")


def has_perm(user: dict, permission: str) -> bool:
    """RBAC 权限判定：平台管理员直通，其它角色查 role_permissions 矩阵。"""
    if user["platform_role"] == "platform_admin":
        return True
    custom = db.row(
        "SELECT r.permissions p FROM custom_roles r JOIN users u ON u.custom_role_id=r.id WHERE u.id=?",
        (user["id"],),
    )
    if custom:
        try:
            if permission in (json.loads(custom["p"] or "[]") or []):
                return True
        except (TypeError, ValueError):
            pass
    hit = db.row(
        "SELECT 1 ok FROM role_permissions WHERE role=? AND permission=?",
        (user["platform_role"], permission),
    )
    if hit:
        return True
    # 该角色已在矩阵中配置过：以矩阵为准（取消勾选即收回），不再回退默认值
    configured = db.row(
        "SELECT 1 ok FROM role_permissions WHERE role=? LIMIT 1",
        (user["platform_role"],),
    )
    if configured:
        return False
    # 矩阵未初始化时回退到内置默认值
    return permission in db.ROLE_PERMISSIONS.get(user["platform_role"], [])


def require_perm(user: dict, permission: str) -> None:
    if not has_perm(user, permission):
        raise HTTPException(status_code=403, detail=f"缺少权限：{db.PERMISSIONS.get(permission, permission)}")


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for") or ""
    return (fwd.split(",")[0].strip() or (request.client.host if request.client else ""))[:64]


def is_admin(user: dict) -> bool:
    return user["platform_role"] == "platform_admin"


def project_role(user: dict, project_id: int) -> str:
    if is_admin(user):
        return "manager"
    if user["platform_role"] == "tenant_admin":
        p = db.row("SELECT tenant_id FROM projects WHERE id=?", (project_id,))
        if p and p["tenant_id"] and p["tenant_id"] == user.get("tenant_id"):
            return "manager"
    r = db.row(
        "SELECT project_role FROM project_members WHERE project_id=? AND user_id=?",
        (project_id, user["id"]),
    )
    return r["project_role"] if r else ""


def visible_project_ids(user: dict) -> list[int]:
    tenant = user.get("tenant_id")
    if is_admin(user):
        return [r["id"] for r in db.rows("SELECT id FROM projects")]
    if user.get("platform_role") == "tenant_admin":
        if not tenant:
            return []
        return [r["id"] for r in db.rows("SELECT id FROM projects WHERE tenant_id=?", (tenant,))]
    mine = {
        r["project_id"]
        for r in db.rows("SELECT project_id FROM project_members WHERE user_id=?", (user["id"],))
    }
    if not tenant:
        return sorted(mine)
    return [
        r["id"] for r in db.rows(
            "SELECT id FROM projects WHERE tenant_id=? OR tenant_id IS NULL", (tenant,))
        if r["id"] in mine
    ]


def can_access_task(user: dict, task: dict) -> bool:
    if is_admin(user):
        return True
    if user.get("tenant_id") and task["project_id"] not in tenant_project_ids(user):
        return False
    role = project_role(user, task["project_id"])
    task_roles = {
        r["role"]
        for r in db.rows(
            "SELECT role FROM task_roles WHERE task_id=? AND user_id=?", (task["id"], user["id"])
        )
    }
    if not role and not task_roles:
        return False
    if role in ("manager", "viewer"):
        return True
    if role == "annotator" or "annotator" in task_roles:
        return (
            task["assignee_id"] == user["id"]
            or task["status"] in ("pending", "annotating")
            or "acceptor" in task_roles
        )
    if role == "reviewer" or "reviewer" in task_roles:
        return task["reviewer_id"] == user["id"] or task["status"] in (
            "submitted", "review", "review_done",
        )
    if role == "acceptor" or "acceptor" in task_roles:
        return task["status"] in ("review_done", "done")
    return False


def assert_task(user: dict, task: dict) -> None:
    if not can_access_task(user, task):
        raise HTTPException(status_code=403, detail="无权访问该任务")


def tenant_project_ids(user: dict) -> list[int]:
    """当前租户下的项目（含未绑定租户的演示项目），用于任务级权限的租户隔离。"""
    tenant = user.get("tenant_id")
    if not tenant:
        return []
    return [
        r["id"] for r in db.rows(
            "SELECT id FROM projects WHERE tenant_id=? OR tenant_id IS NULL", (tenant,)
        )
    ]


def task_scope_sql(user: dict) -> tuple[str, tuple]:
    """返回任务列表的附加过滤条件。"""
    if is_admin(user) or user["platform_role"] in ("project_manager", "tenant_admin", "client"):
        ids = visible_project_ids(user)
        if not ids:
            return "1=0", ()
        marks = ",".join("?" * len(ids))
        return f"t.project_id IN ({marks})", tuple(ids)
    if user["platform_role"] == "acceptor":
        ids = visible_project_ids(user)
        tids = tenant_project_ids(user)
        clauses = []
        args: list = []
        if tids:
            tmarks = ",".join("?" * len(tids))
            clauses.append(
                "(t.id IN (SELECT task_id FROM task_roles WHERE user_id=? AND role='acceptor')"
                f" AND t.project_id IN ({tmarks}))"
            )
            args.append(user["id"])
            args.extend(tids)
        if ids:
            marks = ",".join("?" * len(ids))
            clauses.append(f"t.project_id IN ({marks})")
            args.extend(ids)
        if not clauses:
            return "1=0", ()
        return "(" + " OR ".join(clauses) + ")", tuple(args)
    if user["platform_role"] == "annotator":
        ids = visible_project_ids(user)
        if not ids:
            return "1=0", ()
        marks = ",".join("?" * len(ids))
        return f"t.assignee_id=? AND t.project_id IN ({marks})", (user["id"], *ids)
    if user["platform_role"] == "reviewer":
        ids = visible_project_ids(user)
        if not ids:
            return "1=0", ()
        marks = ",".join("?" * len(ids))
        return f"t.reviewer_id=? AND t.project_id IN ({marks})", (user["id"], *ids)
    return "1=0", ()


def safe_next(value: str | None) -> str | None:
    if not value or not value.startswith("/") or value.startswith("//"):
        return None
    return value
