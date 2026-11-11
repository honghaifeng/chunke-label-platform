"""企业运维与安全：品牌、存储、SSO、SCIM、MFA、审计导出、备份恢复、监控指标与升级回滚。"""
from __future__ import annotations

import base64
import csv
import hashlib
import hmac
import io
import json
import os
import platform
import secrets
import shutil
import sqlite3
import struct
import time
import urllib.parse
import urllib.request
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response

from . import auth, db, enterprise, workbench

router = APIRouter()
START_TS = time.time()

BRAND_KEYS = ("brand_name", "brand_short", "brand_color", "brand_logo")
SECURITY_KEYS = ("ip_allowlist", "media_token_ttl", "mfa_required", "watermark", "log_retention_days")
STORAGE_KEYS = ("storage_driver", "storage_bucket", "storage_region", "storage_endpoint", "storage_access_key", "storage_secret_key")


def me(request: Request) -> dict:
    return auth.current_user(request)


def get_setting(key: str, default: str = "") -> str:
    r = db.row("SELECT value FROM settings WHERE key=?", (key,))
    return r["value"] if r else default


def set_setting(key: str, value: str) -> None:
    db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (key, value))


def _secret() -> str:
    s = get_setting("app_secret")
    if not s:
        s = secrets.token_hex(32)
        set_setting("app_secret", s)
    return s


def _sign(value: str) -> str:
    return hmac.new(_secret().encode(), value.encode(), hashlib.sha256).hexdigest()


def _json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# 品牌 / 公共配置
# ---------------------------------------------------------------------------

@router.get("/api/public/config")
def public_config():
    return {
        "brand_name": get_setting("brand_name", "春科数据标注平台"),
        "brand_short": get_setting("brand_short", "春科标注"),
        "brand_color": get_setting("brand_color", "#3B82F6"),
        "brand_logo": get_setting("brand_logo", ""),
        "watermark": get_setting("watermark", "on") == "on",
        "language": get_setting("language_default", "zh"),
        "modalities": db.MODALITY_LABEL,
    }


@router.get("/api/ops/brand")
def get_brand(user: dict = Depends(me)):
    return {k: get_setting(k) for k in BRAND_KEYS}


@router.post("/api/ops/brand")
def save_brand(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    for k in BRAND_KEYS:
        if k in body:
            set_setting(k, str(body[k]))
    db.log(user["id"], "brand_update", "settings", json.dumps({k: body.get(k) for k in BRAND_KEYS}, ensure_ascii=False))
    return {"ok": True}


# ---------------------------------------------------------------------------
# 存储抽象 / 预签名
# ---------------------------------------------------------------------------

def _storage_cfg() -> dict:
    return {k: get_setting(k) for k in STORAGE_KEYS}


def _presign_local(name: str, ttl: int, op: str = "get") -> str:
    exp = int(time.time()) + ttl
    raw = f"local|{op}|{name}|{exp}"
    token = base64.urlsafe_b64encode(f"{exp}.{_sign(raw)}".encode()).decode()
    return f"/api/ops/storage/local?name={urllib.parse.quote(name)}&op={op}&token={token}"


def _presign_s3(name: str, ttl: int, op: str = "get") -> dict:
    cfg = _storage_cfg()
    if cfg.get("storage_access_key") and cfg.get("storage_secret_key") and cfg.get("storage_bucket"):
        try:
            import boto3  # type: ignore

            client = boto3.client(
                "s3",
                region_name=cfg.get("storage_region") or None,
                endpoint_url=cfg.get("storage_endpoint") or None,
                aws_access_key_id=cfg["storage_access_key"],
                aws_secret_access_key=cfg["storage_secret_key"],
            )
            method = "put_object" if op == "put" else "get_object"
            params = {"Bucket": cfg["storage_bucket"], "Key": name}
            url = client.generate_presigned_url(method, Params=params, ExpiresIn=ttl)
            return {"driver": "s3", "url": url, "method": "PUT" if op == "put" else "GET"}
        except ImportError:
            raise HTTPException(501, "未安装 boto3，无法生成 S3 预签名；请 pip install boto3 或切换本地存储")
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(502, f"S3 预签名失败：{str(exc)[:200]}") from exc
    raise HTTPException(400, "S3 存储未配置完整（bucket / access_key / secret_key）")


@router.get("/api/ops/storage")
def get_storage(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    cfg = _storage_cfg()
    cfg["storage_secret_key"] = "********" if cfg.get("storage_secret_key") else ""
    return cfg


@router.post("/api/ops/storage")
def save_storage(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    for k in STORAGE_KEYS:
        if k in body and not (k == "storage_secret_key" and body[k] == "********"):
            set_setting(k, str(body[k]))
    db.log(user["id"], "storage_update", "settings", get_setting("storage_driver"))
    return {"ok": True}


@router.post("/api/ops/storage/presign")
def presign(body: dict, user: dict = Depends(me)):
    name = os.path.basename(str(body.get("name") or ""))
    if not name:
        raise HTTPException(400, "缺少文件名")
    ttl = max(60, min(86400, int(body.get("ttl") or get_setting("media_token_ttl", "600"))))
    op = "put" if body.get("op") == "put" else "get"
    if get_setting("storage_driver", "local") == "s3":
        return _presign_s3(name, ttl, op)
    return {"driver": "local", "url": _presign_local(name, ttl, op), "method": "GET"}


@router.get("/api/ops/storage/local")
def storage_local(name: str, op: str = "get", token: str = ""):
    path = os.path.join(db.MEDIA_DIR, os.path.basename(name))
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        exp_s, sig = decoded.split(".", 1)
        exp = int(exp_s)
    except (ValueError, TypeError):
        raise HTTPException(401, "无效的预签名")
    if exp < int(time.time()):
        raise HTTPException(401, "预签名已过期")
    if not hmac.compare_digest(sig, _sign(f"local|{op}|{os.path.basename(name)}|{exp}")):
        raise HTTPException(401, "预签名校验失败")
    if not os.path.exists(path):
        raise HTTPException(404, "文件不存在")
    return FileResponse(path)


@router.post("/api/media-token")
def media_token(body: dict, user: dict = Depends(me)):
    name = os.path.basename(str(body.get("name") or ""))
    if not name:
        raise HTTPException(400, "缺少文件名")
    ttl = max(30, min(86400, int(body.get("ttl") or get_setting("media_token_ttl", "600"))))
    exp = int(time.time()) + ttl
    token = base64.urlsafe_b64encode(f"{exp}.{_sign(f'media|{name}|{exp}')}".encode()).decode()
    return {"ok": True, "url": f"/media/{urllib.parse.quote(name)}?token={token}", "expires_at": exp}


def verify_media_token(name: str, token: str) -> bool:
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        exp_s, sig = decoded.split(".", 1)
        exp = int(exp_s)
    except (ValueError, TypeError):
        return False
    if exp < int(time.time()):
        return False
    return hmac.compare_digest(sig, _sign(f"media|{name}|{exp}"))


# ---------------------------------------------------------------------------
# 安全策略 / IP 白名单 / 安全基线
# ---------------------------------------------------------------------------

@router.get("/api/ops/security/policy")
def get_policy(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    return {k: get_setting(k) for k in SECURITY_KEYS}


@router.post("/api/ops/security/policy")
def save_policy(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    for k in SECURITY_KEYS:
        if k in body:
            set_setting(k, str(body[k]))
    db.log(user["id"], "security_policy", "settings", json.dumps({k: body.get(k) for k in SECURITY_KEYS}, ensure_ascii=False))
    return {"ok": True}


def ip_allowed(request: Request) -> bool:
    allow = [x.strip() for x in get_setting("ip_allowlist").split(",") if x.strip()]
    if not allow:
        return True
    ip = auth.client_ip(request)
    for rule in allow:
        if rule.endswith("*") and ip.startswith(rule[:-1]):
            return True
        if rule == ip:
            return True
    return False


@router.get("/api/ops/security/baseline")
def security_baseline(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    checks = []

    def add(key: str, name: str, ok: bool, detail: str, weight: int = 1):
        checks.append({"key": key, "name": name, "pass": ok, "detail": detail, "weight": weight})

    admin = db.row("SELECT * FROM users WHERE username='admin'")
    admin_default = bool(admin and db.verify_password(db.DEFAULT_PASSWORD, admin["password_hash"]))
    add("default_password", "未保留默认口令账号", not admin_default,
        "admin 仍使用默认口令 chunke123" if admin_default else "admin 口令已修改", 2)
    add("mfa", "开启多因子认证", get_setting("mfa_required") == "on", f"当前：{get_setting('mfa_required')}", 2)
    add("ip_allowlist", "配置访问 IP 白名单", bool(get_setting("ip_allowlist")), "未配置 IP 白名单", 1)
    add("media_token", "媒体访问使用短时令牌", int(get_setting("media_token_ttl", "600")) <= 900, f"TTL={get_setting('media_token_ttl')}s", 1)
    add("https", "启用 HTTPS/TLS", False, "需要在反向代理（nginx）配置 TLS 证书", 2)
    add("watermark", "开启动态水印", get_setting("watermark") == "on", "未开启水印", 1)
    add("audit", "审计日志持续记录", bool(db.row("SELECT id FROM audit_log LIMIT 1")), "尚无审计记录", 1)
    add("backup", "存在可用备份", bool(db.row("SELECT id FROM backups LIMIT 1")), "尚未创建备份", 1)
    add("key_rotation", "API Key 最近 90 天轮换", bool(db.row(
        "SELECT id FROM api_keys WHERE status='active' AND created_at >= ?",
        ((db.datetime.now() - __import__('datetime').timedelta(days=90)).strftime("%Y-%m-%d %H:%M:%S"),),
    )), "无 90 天内新建的 API Key", 1)
    total = sum(c["weight"] for c in checks)
    got = sum(c["weight"] for c in checks if c["pass"])
    return {"checks": checks, "score": round(got / total * 100) if total else 0, "passed": got, "total": total}


@router.get("/api/audit/export.csv")
def audit_export(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    rows_ = db.rows(
        "SELECT a.id,a.created_at,u.name actor,a.action,a.target,a.detail FROM audit_log a"
        " LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 20000"
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["时间", "操作人", "动作", "对象", "详情"])
    for r in rows_:
        writer.writerow([r["created_at"], r["actor"] or "", r["action"], r["target"], r["detail"]])
    db.log(user["id"], "audit_export", "audit_log", f"{len(rows_)} 条")
    return Response(
        content=buf.getvalue().encode("utf-8-sig"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=audit-export.csv"},
    )


# ---------------------------------------------------------------------------
# TOTP 多因子
# ---------------------------------------------------------------------------

def _totp(secret_b32: str, at: float | None = None, digits: int = 6, step: int = 30) -> str:
    key = base64.b32decode(secret_b32 + "=" * ((8 - len(secret_b32) % 8) % 8))
    counter = int((at if at is not None else time.time()) // step)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % (10 ** digits)
    return str(code).zfill(digits)


def verify_totp(secret_b32: str, code: str) -> bool:
    code = (code or "").strip()
    if not code:
        return False
    now = time.time()
    return any(hmac.compare_digest(_totp(secret_b32, now + w * 30), code) for w in (-1, 0, 1))


def user_totp(user_id: int) -> dict | None:
    return db.row("SELECT * FROM user_totp WHERE user_id=?", (user_id,))


def totp_required(user: dict) -> bool:
    row = user_totp(user["id"])
    if row and row["enabled"]:
        return True
    return get_setting("mfa_required") == "on"


@router.get("/api/auth/mfa/status")
def mfa_status(user: dict = Depends(me)):
    row = user_totp(user["id"])
    return {
        "enabled": bool(row and row["enabled"]),
        "required_globally": get_setting("mfa_required") == "on",
        "setup_pending": bool(row and not row["enabled"]),
    }


@router.post("/api/auth/mfa/setup")
def mfa_setup(user: dict = Depends(me)):
    secret = base64.b32encode(os.urandom(20)).decode().rstrip("=")
    recovery = [uuid.uuid4().hex[:10] for _ in range(6)]
    db.execute(
        "INSERT INTO user_totp(user_id,secret,enabled,recovery,created_at,updated_at) VALUES(?,?,?,?,?,?)"
        " ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,enabled=0,recovery=excluded.recovery,updated_at=excluded.updated_at",
        (user["id"], secret, 0, json.dumps(recovery), db.now(), db.now()),
    )
    label = urllib.parse.quote(f"{get_setting('brand_short', '春科标注')}:{user['username']}")
    uri = f"otpauth://totp/{label}?secret={secret}&issuer={urllib.parse.quote(get_setting('brand_short', '春科标注'))}&period=30&digits=6"
    return {"ok": True, "secret": secret, "otpauth": uri, "recovery_codes": recovery}


@router.post("/api/auth/mfa/enable")
def mfa_enable(body: dict, user: dict = Depends(me)):
    row = user_totp(user["id"])
    if not row:
        raise HTTPException(400, "请先调用 setup 生成密钥")
    if not verify_totp(row["secret"], body.get("code") or ""):
        raise HTTPException(400, "动态口令不正确")
    db.execute("UPDATE user_totp SET enabled=1,updated_at=? WHERE user_id=?", (db.now(), user["id"]))
    db.log(user["id"], "mfa_enable", "user", user["username"])
    return {"ok": True, "recovery_codes": _json(row["recovery"], [])}


@router.post("/api/auth/mfa/disable")
def mfa_disable(body: dict, user: dict = Depends(me)):
    row = user_totp(user["id"])
    if not row:
        return {"ok": True}
    if row["enabled"] and not verify_totp(row["secret"], body.get("code") or ""):
        raise HTTPException(400, "动态口令不正确")
    db.execute("UPDATE user_totp SET enabled=0,updated_at=? WHERE user_id=?", (db.now(), user["id"]))
    return {"ok": True}


# ---------------------------------------------------------------------------
# SSO (OIDC) / SCIM
# ---------------------------------------------------------------------------

SSO_KEYS = ("sso_provider", "sso_client_id", "sso_client_secret", "sso_discovery", "sso_authorize_url", "sso_token_url", "sso_redirect_uri", "sso_default_role")


@router.get("/api/ops/sso")
def get_sso(user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    cfg = {k: get_setting(k) for k in SSO_KEYS}
    cfg["sso_client_secret"] = "********" if cfg["sso_client_secret"] else ""
    return cfg


@router.post("/api/ops/sso")
def save_sso(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    for k in SSO_KEYS:
        if k in body and not (k == "sso_client_secret" and body[k] == "********"):
            set_setting(k, str(body[k]))
    db.log(user["id"], "sso_update", "settings", get_setting("sso_provider"))
    return {"ok": True}


@router.get("/api/auth/sso/start")
def sso_start(request: Request):
    client_id = get_setting("sso_client_id")
    authorize = get_setting("sso_authorize_url")
    redirect_uri = get_setting("sso_redirect_uri") or str(request.base_url).rstrip("/") + "/api/auth/sso/callback"
    if not client_id or not authorize:
        raise HTTPException(400, "SSO 未配置：请先在运维中心填写 client_id / authorize_url / token_url")
    state = secrets.token_urlsafe(16)
    set_setting(f"sso_state_{state}", str(int(time.time())))
    query = urllib.parse.urlencode({
        "client_id": client_id, "response_type": "code", "scope": "openid email profile",
        "redirect_uri": redirect_uri, "state": state,
    })
    return RedirectResponse(f"{authorize}?{query}")


def _decode_jwt_payload(token: str) -> dict:
    try:
        part = token.split(".")[1]
        part += "=" * ((4 - len(part) % 4) % 4)
        return json.loads(base64.urlsafe_b64decode(part).decode())
    except (IndexError, ValueError):
        return {}


@router.get("/api/auth/sso/callback")
def sso_callback(request: Request, code: str = "", state: str = ""):
    if not code:
        raise HTTPException(400, "缺少授权码 code")
    state_ts = get_setting(f"sso_state_{state}")
    if not state_ts or int(time.time()) - int(state_ts) > 600:
        raise HTTPException(400, "SSO state 校验失败或已过期")
    token_url = get_setting("sso_token_url")
    redirect_uri = get_setting("sso_redirect_uri") or str(request.base_url).rstrip("/") + "/api/auth/sso/callback"
    data = urllib.parse.urlencode({
        "grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri,
        "client_id": get_setting("sso_client_id"), "client_secret": get_setting("sso_client_secret"),
    }).encode()
    try:
        req = urllib.request.Request(token_url, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 平台配置的 IdP
            tok = json.loads(resp.read().decode())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"SSO 换取令牌失败：{str(exc)[:200]}") from exc
    info = _decode_jwt_payload(tok.get("id_token") or "")
    if not info:
        try:
            with urllib.request.urlopen(tok.get("access_token") or "", timeout=15) as resp:  # noqa: S310
                info = json.loads(resp.read().decode())
        except Exception:  # noqa: BLE001
            info = {}
    email = (info.get("email") or info.get("preferred_username") or info.get("sub") or "").lower()
    username = email.split("@")[0] if email else ""
    found = db.row("SELECT * FROM users WHERE lower(username)=? OR lower(username)=?", (username, email))
    if not found:
        role = get_setting("sso_default_role", "annotator")
        if role not in auth.PLATFORM_ROLES:
            role = "annotator"
        uid = db.execute(
            "INSERT INTO users(username,name,password_hash,platform_role,status,created_at) VALUES(?,?,?,?,?,?)",
            (username or f"sso-{uuid.uuid4().hex[:6]}", info.get("name") or username or "SSO 用户",
             db.hash_password(secrets.token_hex(8)), role, "active", db.now()),
        )
        found = db.row("SELECT * FROM users WHERE id=?", (uid,))
    token = auth.create_session(found["id"])
    db.log(found["id"], "sso_login", "system", f"provider:{get_setting('sso_provider')}")
    resp = RedirectResponse("/")
    resp.set_cookie(auth.COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 12)
    return resp


def _scim_guard(request: Request) -> None:
    token = (request.headers.get("authorization") or "").replace("Bearer ", "").strip()
    expected = get_setting("scim_token")
    if not expected:
        raise HTTPException(403, "SCIM 未启用：请先在系统设置中配置 scim_token")
    if not hmac.compare_digest(token, expected):
        raise HTTPException(401, "SCIM Token 无效")


def _scim_user(u: dict) -> dict:
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": str(u["id"]),
        "userName": u["username"],
        "name": {"formatted": u["name"]},
        "displayName": u["name"],
        "active": u["status"] == "active",
        "emails": [{"value": f"{u['username']}@chunke.local", "primary": True}],
        "roles": [{"value": u["platform_role"]}],
        "meta": {"resourceType": "User", "location": f"/scim/v2/Users/{u['id']}"},
    }


@router.get("/scim/v2/ServiceProviderConfig")
def scim_config(request: Request):
    _scim_guard(request)
    return {
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        "patch": {"supported": True},
        "filter": {"supported": True, "maxResults": 200},
        "bulk": {"supported": False},
    }


@router.get("/scim/v2/Users")
def scim_users(request: Request, filter: str = "", startIndex: int = 1, count: int = 100):
    _scim_guard(request)
    conds, vals = ["1=1"], []
    if filter:
        if "userName eq" in filter:
            value = filter.split("eq", 1)[1].strip().strip('"')
            conds.append("username=?")
            vals.append(value)
        elif "active eq" in filter:
            value = filter.split("eq", 1)[1].strip().strip('"').lower()
            conds.append("status=?")
            vals.append("active" if value == "true" else "disabled")
    items = db.rows(
        "SELECT * FROM users WHERE " + " AND ".join(conds) + " ORDER BY id LIMIT ? OFFSET ?",
        tuple(vals + [max(1, min(500, count)), max(0, startIndex - 1)]),
    )
    total = db.row("SELECT COUNT(*) c FROM users WHERE " + " AND ".join(conds), tuple(vals))["c"]
    return {
        "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
        "totalResults": total,
        "startIndex": startIndex,
        "itemsPerPage": len(items),
        "Resources": [_scim_user(u) for u in items],
    }


@router.post("/scim/v2/Users")
def scim_create_user(body: dict, request: Request):
    _scim_guard(request)
    username = (body.get("userName") or "").strip()
    if not username:
        raise HTTPException(400, "userName 必填")
    if db.row("SELECT id FROM users WHERE username=?", (username,)):
        raise HTTPException(409, "用户已存在")
    role = ((body.get("roles") or [{}])[0].get("value") or "annotator")
    if role not in auth.PLATFORM_ROLES:
        role = "annotator"
    name = (body.get("displayName") or (body.get("name") or {}).get("formatted") or username)
    uid = db.execute(
        "INSERT INTO users(username,name,password_hash,platform_role,status,created_at) VALUES(?,?,?,?,?,?)",
        (username, name, db.hash_password(secrets.token_hex(8)), role, "active" if body.get("active", True) else "disabled", db.now()),
    )
    db.log(None, "scim_create_user", f"user:{uid}", username)
    user = db.row("SELECT * FROM users WHERE id=?", (uid,))
    return JSONResponse(_scim_user(user), status_code=201)


@router.patch("/scim/v2/Users/{uid}")
def scim_patch_user(uid: int, body: dict, request: Request):
    _scim_guard(request)
    u = db.row("SELECT * FROM users WHERE id=?", (uid,))
    if not u:
        raise HTTPException(404, "用户不存在")
    status, name = u["status"], u["name"]
    if "active" in body:
        status = "active" if body["active"] else "disabled"
    for op in body.get("Operations") or body.get("operations") or []:
        path = (op.get("path") or "").lower()
        value = op.get("value")
        if path == "active":
            status = "active" if value else "disabled"
        elif path == "displayname":
            name = str(value)
    db.execute("UPDATE users SET status=?,name=? WHERE id=?", (status, name, uid))
    return _scim_user(db.row("SELECT * FROM users WHERE id=?", (uid,)))


@router.delete("/scim/v2/Users/{uid}")
def scim_delete_user(uid: int, request: Request):
    _scim_guard(request)
    db.execute("UPDATE users SET status='disabled' WHERE id=?", (uid,))
    db.log(None, "scim_disable_user", f"user:{uid}")
    return Response(status_code=204)


# ---------------------------------------------------------------------------
# 监控指标 / 日志留存
# ---------------------------------------------------------------------------

_STATUSES = ["pending", "annotating", "submitted", "review", "done", "paused", "ended"]


@router.get("/metrics")
def metrics():
    lines = [
        "# HELP chunke_tasks_total 任务总数（按状态）",
        "# TYPE chunke_tasks_total gauge",
    ]
    for s in _STATUSES:
        n = db.row("SELECT COUNT(*) c FROM tasks WHERE status=? AND deleted=0", (s,))["c"]
        lines.append(f'chunke_tasks_total{{status="{s}"}} {n}')
    lines += ["# HELP chunke_tasks_archived 归档任务数", "# TYPE chunke_tasks_archived gauge"]
    lines.append(f"chunke_tasks_archived {db.row('SELECT COUNT(*) c FROM tasks WHERE archived=1 AND deleted=0')['c']}")
    lines += ["# HELP chunke_jobs_total 作业数（按状态）", "# TYPE chunke_jobs_total gauge"]
    for s in ("queued", "running", "done", "failed", "canceled"):
        n = db.row("SELECT COUNT(*) c FROM jobs WHERE status=?", (s,))["c"]
        lines.append(f'chunke_jobs_total{{status="{s}"}} {n}')
    qc = db.row(
        "SELECT SUM(CASE WHEN result IN ('approved','auto_approved') THEN 1 ELSE 0 END) ok,COUNT(*) total FROM qc_records"
    ) or {}
    rate = round((qc.get("ok") or 0) / qc["total"] * 100, 2) if qc.get("total") else 0
    lines += ["# HELP chunke_qc_pass_rate 质检通过率", "# TYPE chunke_qc_pass_rate gauge"]
    lines.append(f"chunke_qc_pass_rate {rate}")
    reqs = db.rows("SELECT status_code,COUNT(*) c FROM api_requests GROUP BY status_code")
    lines += ["# HELP chunke_api_requests_total 开放接口调用数", "# TYPE chunke_api_requests_total counter"]
    for r in reqs:
        lines.append(f'chunke_api_requests_total{{status="{r["status_code"]}"}} {r["c"]}')
    lines += ["# HELP chunke_uptime_seconds 运行时长", "# TYPE chunke_uptime_seconds gauge"]
    lines.append(f"chunke_uptime_seconds {int(time.time() - START_TS)}")
    lines += ["# HELP chunke_users_total 用户数", "# TYPE chunke_users_total gauge"]
    lines.append(f"chunke_users_total {db.row('SELECT COUNT(*) c FROM users')['c']}")
    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4; charset=utf-8")


@router.get("/api/ops/monitor")
def monitor(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    disk = shutil.disk_usage(db.BASE_DIR)
    import resource

    mem_used = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if platform.system() == "Darwin":
        mem_used = mem_used / 1024 / 1024
    else:
        mem_used = mem_used / 1024
    last_hour = db.row("SELECT COUNT(*) c FROM api_requests WHERE created_at>=?", (db.now()[:13] + ":00:00",))["c"]
    jobs = db.rows("SELECT status,COUNT(*) c FROM jobs GROUP BY status")
    return {
        "uptime_seconds": int(time.time() - START_TS),
        "load_avg": list(os.getloadavg()) if hasattr(os, "getloadavg") else [],
        "memory_mb": round(mem_used, 1),
        "disk": {"total": disk.total, "used": disk.used, "free": disk.free, "percent": round(disk.used / disk.total * 100, 1)},
        "db_size": os.path.getsize(db.DB_PATH) if os.path.exists(db.DB_PATH) else 0,
        "api_requests_last_hour": last_hour,
        "jobs": {r["status"]: r["c"] for r in jobs},
        "process": {"python": platform.python_version(), "platform": platform.platform()},
    }


@router.post("/api/ops/retention/run")
def retention_run(body: dict | None = None, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    days = int((body or {}).get("days") or get_setting("log_retention_days", "90"))
    cutoff = (db.datetime.now() - __import__("datetime").timedelta(days=max(1, days))).strftime("%Y-%m-%d %H:%M:%S")
    removed = {}
    with db.connect() as conn:
        for table in ("api_requests", "security_events", "operator_runs", "jobs"):
            cur = conn.execute(f"DELETE FROM {table} WHERE created_at < ?", (cutoff,))
            removed[table] = cur.rowcount
        conn.commit()
    db.log(user["id"], "retention_run", "system", f"{days} 天 · {removed}")
    return {"ok": True, "cutoff": cutoff, "removed": removed}


# ---------------------------------------------------------------------------
# 备份 / 恢复 / 升级回滚
# ---------------------------------------------------------------------------

@router.get("/api/ops/backups")
def list_backups(user: dict = Depends(me)):
    auth.require_perm(user, "security.read")
    return {"backups": db.rows("SELECT * FROM backups ORDER BY id DESC")}


@router.post("/api/ops/backup")
def create_backup(body: dict | None = None, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    os.makedirs(os.path.join(db.DATA_DIR, "backups"), exist_ok=True)
    name = f"chunke-{time.strftime('%Y%m%d-%H%M%S')}.db"
    path = os.path.join(db.DATA_DIR, "backups", name)
    src = sqlite3.connect(db.DB_PATH)
    dst = sqlite3.connect(path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    bid = db.execute(
        "INSERT INTO backups(path,size,note,created_by,created_at) VALUES(?,?,?,?,?)",
        (path, os.path.getsize(path), (body or {}).get("note") or "手动备份", user["id"], db.now()),
    )
    db.log(user["id"], "backup", "system", name)
    return {"ok": True, "id": bid, "path": path, "size": os.path.getsize(path)}


@router.post("/api/ops/backups/{bid}/restore")
def restore_backup(bid: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    if (body or {}).get("confirm") != "RESTORE":
        raise HTTPException(400, "请输入 RESTORE 确认恢复操作")
    b = db.row("SELECT * FROM backups WHERE id=?", (bid,))
    if not b or not os.path.exists(b["path"]):
        raise HTTPException(404, "备份不存在")
    safety = os.path.join(db.DATA_DIR, "backups", f"before-restore-{time.strftime('%Y%m%d-%H%M%S')}.db")
    src = sqlite3.connect(db.DB_PATH)
    dst = sqlite3.connect(safety)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    src = sqlite3.connect(b["path"])
    dst = sqlite3.connect(db.DB_PATH)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    db.execute("INSERT INTO backups(path,size,note,created_by,created_at) VALUES(?,?,?,?,?)",
               (safety, os.path.getsize(safety), "恢复前安全副本", user["id"], db.now()))
    db.log(user["id"], "restore_backup", "system", os.path.basename(b["path"]))
    return {"ok": True, "restored": os.path.basename(b["path"]), "safety_copy": os.path.basename(safety)}


MIGRATIONS = {
    4: ("性能索引与运维表", lambda: True),
    5: ("多模态工作台与算子中心", lambda: True),
}


@router.get("/api/ops/version")
def version_info(user: dict = Depends(me)):
    applied = db.rows("SELECT * FROM schema_migrations ORDER BY version")
    pending = [{"version": v, "name": n} for v, (n, _) in sorted(MIGRATIONS.items()) if v not in {a["version"] for a in applied}]
    return {"app_version": "1.0.0", "applied": applied, "pending": pending}


@router.post("/api/ops/upgrade")
def upgrade(body: dict | None = None, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    applied = {r["version"] for r in db.rows("SELECT version FROM schema_migrations")}
    ran = []
    for v, (name, fn) in sorted(MIGRATIONS.items()):
        if v in applied:
            continue
        fn()
        db.execute("INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)", (v, name, db.now()))
        ran.append({"version": v, "name": name})
    db.log(user["id"], "upgrade", "system", json.dumps(ran, ensure_ascii=False))
    return {"ok": True, "applied": ran}


@router.post("/api/ops/rollback")
def rollback(body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "settings.write")
    if (body or {}).get("confirm") != "ROLLBACK":
        raise HTTPException(400, "请输入 ROLLBACK 确认回滚（将恢复最近一次备份）")
    latest = db.row("SELECT * FROM backups ORDER BY id DESC LIMIT 1")
    if not latest:
        raise HTTPException(400, "没有可用备份")
    src = sqlite3.connect(latest["path"])
    dst = sqlite3.connect(db.DB_PATH)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()
    db.log(user["id"], "rollback", "system", os.path.basename(latest["path"]))
    return {"ok": True, "restored": os.path.basename(latest["path"])}


# ---------------------------------------------------------------------------
# 数据集同步配置
# ---------------------------------------------------------------------------

@router.patch("/api/datasets/{ds_id}/sync")
def dataset_sync_config(ds_id: int, body: dict, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.write")
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    db.execute(
        "UPDATE datasets SET webhook_url=?,sync_enabled=?,storage=?,updated_at=? WHERE id=?",
        (body.get("webhook_url", ds["webhook_url"]), int(body.get("sync_enabled", ds["sync_enabled"])),
         body.get("storage", ds["storage"]), db.now(), ds_id),
    )
    return {"ok": True}


@router.post("/api/datasets/{ds_id}/sync")
def dataset_sync(ds_id: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.write")
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    jid = workbench._start_job("dataset_sync", f"同步数据集 · {ds['name']}", user, {}, dataset_id=ds_id)
    return {"ok": True, "job_id": jid}


# ---------------------------------------------------------------------------
# /api/v1 全量 CRUD 扩展
# ---------------------------------------------------------------------------

def _v1_ids(key: dict) -> list[int]:
    return enterprise._v1_project_ids(key)


@router.put("/api/v1/projects/{pid}")
def v1_update_project(pid: int, body: dict, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    if pid not in _v1_ids(key):
        raise HTTPException(403, "密钥无权访问该项目")
    p = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "项目不存在")
    db.execute(
        "UPDATE projects SET name=?,description=?,engine=?,engine_url=?,label_config=? WHERE id=?",
        (body.get("name") or p["name"], body.get("description", p["description"]), body.get("engine", p["engine"]),
         body.get("engine_url", p["engine_url"]),
         json.dumps(body.get("labels") or _json(p["label_config"], {}), ensure_ascii=False), pid),
    )
    return {"ok": True}


@router.delete("/api/v1/projects/{pid}")
def v1_delete_project(pid: int, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "admin")
    if pid not in _v1_ids(key):
        raise HTTPException(403, "密钥无权访问该项目")
    db.execute("UPDATE projects SET status='archived' WHERE id=?", (pid,))
    return {"ok": True}


@router.patch("/api/v1/tasks/{task_id}")
def v1_update_task(task_id: int, body: dict, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    task = enterprise._v1_task(task_id)
    if task["project_id"] not in _v1_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    db.execute(
        "UPDATE tasks SET name=?,status=?,priority=?,batch=?,assignee_id=?,reviewer_id=?,updated_at=? WHERE id=?",
        (body.get("name") or task["name"], body.get("status") or task["status"], body.get("priority") or task["priority"],
         body.get("batch", task["batch"]), body.get("assignee_id", task["assignee_id"]),
         body.get("reviewer_id", task["reviewer_id"]), db.now(), task_id),
    )
    return {"ok": True}


@router.delete("/api/v1/tasks/{task_id}")
def v1_delete_task(task_id: int, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    task = enterprise._v1_task(task_id)
    if task["project_id"] not in _v1_ids(key):
        raise HTTPException(403, "密钥无权访问该任务")
    db.execute("UPDATE tasks SET deleted=1,updated_at=? WHERE id=?", (db.now(), task_id))
    return {"ok": True}


@router.post("/api/v1/datasets")
def v1_create_dataset(body: dict, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "数据集名称不能为空")
    pid = int(body.get("project_id") or 0) or None
    if pid and pid not in _v1_ids(key):
        raise HTTPException(403, "密钥无权访问该项目")
    ds_id = db.execute(
        "INSERT INTO datasets(tenant_id,project_id,code,name,modality,description,status,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)",
        (key.get("tenant_id"), pid, body.get("code") or f"ds-{uuid.uuid4().hex[:6]}", name,
         body.get("modality") or "audio", body.get("description") or "", "active", None, db.now(), db.now()),
    )
    return {"ok": True, "id": ds_id}


@router.patch("/api/v1/datasets/{ds_id}")
def v1_update_dataset(ds_id: int, body: dict, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    db.execute(
        "UPDATE datasets SET name=?,description=?,status=?,updated_at=? WHERE id=?",
        (body.get("name") or ds["name"], body.get("description", ds["description"]),
         body.get("status", ds["status"]), db.now(), ds_id),
    )
    return {"ok": True}


@router.post("/api/v1/datasets/{ds_id}/items")
def v1_append_dataset_items(ds_id: int, body: dict, key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "write")
    items = body.get("items") or []
    if not items:
        raise HTTPException(400, "items 不能为空")
    version = (db.row("SELECT MAX(version) v FROM dataset_versions WHERE dataset_id=?", (ds_id,)) or {}).get("v") or 0
    version += 1
    digest = hashlib.sha256(json.dumps(items, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]
    vid = db.execute(
        "INSERT INTO dataset_versions(dataset_id,version,note,item_count,digest,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
        (ds_id, version, body.get("note") or "OpenAPI 追加", len(items), digest, None, db.now()),
    )
    for it in items:
        db.execute(
            "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (ds_id, vid, it.get("task_id"), it.get("name") or "未命名", it.get("media_path") or "",
             it.get("media_type") or "audio", int(it.get("size") or 0),
             json.dumps(it.get("meta") or {}, ensure_ascii=False), db.now()),
        )
    return {"ok": True, "version": version, "version_id": vid, "digest": digest}


@router.get("/api/v1/members")
def v1_members(key: dict = Depends(enterprise.v1_key)):
    enterprise.require_scope(key, "read")
    items = db.rows("SELECT id,username,name,platform_role,status FROM users ORDER BY id")
    return {"members": items}


@router.get("/api/v1/qc")
def v1_qc(key: dict = Depends(enterprise.v1_key), limit: int = 100):
    enterprise.require_scope(key, "read")
    items = db.rows(
        "SELECT q.*,t.name task_name,t.project_id FROM qc_records q JOIN tasks t ON t.id=q.task_id"
        " ORDER BY q.id DESC LIMIT ?",
        (max(1, min(500, limit)),),
    )
    return {"records": items}
