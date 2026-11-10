"""登录态与权限判定。"""
from __future__ import annotations

import os
import secrets

from fastapi import HTTPException, Request

from . import db

SESSIONS: dict[str, int] = {}
COOKIE = "chunke_session"

PLATFORM_ROLES = {
    "platform_admin": "平台管理员",
    "project_manager": "项目经理",
    "annotator": "标注员",
    "reviewer": "质检员",
    "client": "客户(只读)",
}
PROJECT_ROLES = {"manager": "项目经理", "annotator": "标注员", "reviewer": "质检员", "viewer": "只读"}


def create_session(user_id: int) -> str:
    token = secrets.token_hex(24)
    SESSIONS[token] = user_id
    return token


def destroy_session(token: str | None) -> None:
    if token:
        SESSIONS.pop(token, None)


def user_by_token(token: str | None) -> dict | None:
    if not token:
        return None
    uid = SESSIONS.get(token)
    if not uid:
        return None
    return db.row("SELECT id,username,name,platform_role,status FROM users WHERE id=?", (uid,))


def current_user(request: Request) -> dict:
    user = user_by_token(request.cookies.get(COOKIE))
    if not user or user["status"] != "active":
        raise HTTPException(status_code=401, detail="请先登录")
    return user


def require(user: dict, *roles: str) -> None:
    if user["platform_role"] not in roles:
        raise HTTPException(status_code=403, detail="当前角色无权执行该操作")


def is_admin(user: dict) -> bool:
    return user["platform_role"] == "platform_admin"


def project_role(user: dict, project_id: int) -> str:
    if is_admin(user):
        return "manager"
    r = db.row(
        "SELECT project_role FROM project_members WHERE project_id=? AND user_id=?",
        (project_id, user["id"]),
    )
    return r["project_role"] if r else ""


def visible_project_ids(user: dict) -> list[int]:
    if is_admin(user):
        return [r["id"] for r in db.rows("SELECT id FROM projects")]
    return [
        r["project_id"]
        for r in db.rows("SELECT project_id FROM project_members WHERE user_id=?", (user["id"],))
    ]


def can_access_task(user: dict, task: dict) -> bool:
    if is_admin(user):
        return True
    role = project_role(user, task["project_id"])
    if not role:
        return False
    if role in ("manager", "viewer"):
        return True
    if role == "annotator":
        return task["assignee_id"] == user["id"] or task["status"] in ("pending", "annotating")
    if role == "reviewer":
        return task["reviewer_id"] == user["id"] or task["status"] in ("submitted", "review")
    return False


def assert_task(user: dict, task: dict) -> None:
    if not can_access_task(user, task):
        raise HTTPException(status_code=403, detail="无权访问该任务")


def task_scope_sql(user: dict) -> tuple[str, tuple]:
    """返回任务列表的附加过滤条件。"""
    if is_admin(user) or user["platform_role"] == "project_manager":
        ids = visible_project_ids(user)
        if not ids:
            return "1=0", ()
        marks = ",".join("?" * len(ids))
        return f"t.project_id IN ({marks})", tuple(ids)
    if user["platform_role"] == "client":
        ids = visible_project_ids(user)
        if not ids:
            return "1=0", ()
        marks = ",".join("?" * len(ids))
        return f"t.project_id IN ({marks})", tuple(ids)
    if user["platform_role"] == "annotator":
        return "t.assignee_id=?", (user["id"],)
    if user["platform_role"] == "reviewer":
        return "t.reviewer_id=?", (user["id"],)
    return "1=0", ()


def safe_next(value: str | None) -> str | None:
    if not value or not value.startswith("/") or value.startswith("//"):
        return None
    return value
