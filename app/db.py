"""春科数据标注平台 - 数据库与初始化数据。"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MEDIA_DIR = os.path.join(DATA_DIR, "media")
TMP_DIR = os.path.join(DATA_DIR, "tmp")
DB_PATH = os.path.join(DATA_DIR, "chunke.db")

DEFAULT_PASSWORD = "chunke123"


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or os.urandom(8).hex()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hash_password(password, salt) == stored


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def rows(sql: str, args: tuple = ()) -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute(sql, args).fetchall()]


def row(sql: str, args: tuple = ()) -> dict | None:
    with connect() as conn:
        r = conn.execute(sql, args).fetchone()
        return dict(r) if r else None


def execute(sql: str, args: tuple = ()) -> int:
    with connect() as conn:
        cur = conn.execute(sql, args)
        conn.commit()
        return cur.lastrowid


def log(actor_id: int | None, action: str, target: str = "", detail: str = "") -> None:
    execute(
        "INSERT INTO audit_log(actor_id, action, target, detail, created_at) VALUES(?,?,?,?,?)",
        (actor_id, action, target, detail, now()),
    )


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  platform_role TEXT NOT NULL DEFAULT 'annotator',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  engine TEXT NOT NULL DEFAULT '',
  engine_url TEXT NOT NULL DEFAULT '',
  label_config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project_members(
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  project_role TEXT NOT NULL,
  PRIMARY KEY(project_id, user_id)
);
CREATE TABLE IF NOT EXISTS tasks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  media_path TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'audio',
  duration REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  assignee_id INTEGER,
  reviewer_id INTEGER,
  priority TEXT NOT NULL DEFAULT 'normal',
  batch TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  prelabel TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS qc_records(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  annotation_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  result TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenants(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orgs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id INTEGER,
  manager_id INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE(tenant_id, code)
);
CREATE TABLE IF NOT EXISTS teams(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  leader_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE(org_id, code)
);
CREATE TABLE IF NOT EXISTS team_members(
  team_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  team_role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY(team_id, user_id)
);
CREATE TABLE IF NOT EXISTS role_permissions(
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  PRIMARY KEY(role, permission)
);
CREATE TABLE IF NOT EXISTS datasets(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id INTEGER,
  project_id INTEGER,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'audio',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dataset_versions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dataset_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL,
  version_id INTEGER NOT NULL,
  task_id INTEGER,
  name TEXT NOT NULL,
  media_path TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'audio',
  size INTEGER NOT NULL DEFAULT 0,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS templates(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  label_config TEXT NOT NULL DEFAULT '{}',
  qc_config TEXT NOT NULL DEFAULT '{}',
  instruction TEXT NOT NULL DEFAULT '',
  builtin INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflows(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  project_id INTEGER,
  template_id INTEGER,
  description TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '[]',
  qc_policy TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  tenant_id INTEGER,
  scopes TEXT NOT NULL DEFAULT 'read',
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS api_requests(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id INTEGER,
  key_name TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL DEFAULT 200,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS security_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  actor TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS jobs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  project_id INTEGER,
  task_id INTEGER,
  dataset_id INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT '{}',
  error TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS upload_sessions(
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  total_chunks INTEGER NOT NULL DEFAULT 0,
  received TEXT NOT NULL DEFAULT '[]',
  size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading',
  target TEXT NOT NULL DEFAULT '',
  project_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_packages(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  task_count INTEGER NOT NULL DEFAULT 0,
  claimed_by INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_package_items(
  package_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  PRIMARY KEY(package_id, task_id)
);
CREATE TABLE IF NOT EXISTS template_versions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  label_config TEXT NOT NULL DEFAULT '{}',
  qc_config TEXT NOT NULL DEFAULT '{}',
  instruction TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  locked INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(template_id, version)
);
CREATE TABLE IF NOT EXISTS user_preferences(
  user_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS annotation_versions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  annotation_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS components(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'image',
  schema TEXT NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  builtin INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operators(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'http',
  modality TEXT NOT NULL DEFAULT '',
  endpoint TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'POST',
  headers TEXT NOT NULL DEFAULT '{}',
  input_map TEXT NOT NULL DEFAULT '{}',
  output_map TEXT NOT NULL DEFAULT '{}',
  timeout INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS operator_runs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator_id INTEGER,
  task_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  request TEXT NOT NULL DEFAULT '{}',
  response TEXT NOT NULL DEFAULT '{}',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS model_registry(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'detection',
  provider TEXT NOT NULL DEFAULT 'local',
  endpoint TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  metrics TEXT NOT NULL DEFAULT '{}',
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quality_rules(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS issues(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  project_id INTEGER NOT NULL,
  item_type TEXT NOT NULL DEFAULT '',
  item_index INTEGER NOT NULL DEFAULT -1,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  assignee_id INTEGER,
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tracks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  track_uid TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  keyframes TEXT NOT NULL DEFAULT '[]',
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_media(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  path TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS label_sets(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  modality TEXT NOT NULL DEFAULT 'image',
  labels TEXT NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS help_articles(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT '通用',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS backups(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_totp(
  user_id INTEGER PRIMARY KEY,
  secret TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  recovery TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations(
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
"""

# 平台权限点：用于 RBAC 权限矩阵与接口二次校验
PERMISSIONS = {
    "project.read": "查看项目",
    "project.write": "创建/编辑项目",
    "task.read": "查看任务",
    "task.write": "标注与提交任务",
    "task.review": "质检与返修",
    "dataset.read": "查看数据集",
    "dataset.write": "导入/版本/导出数据集",
    "template.read": "查看模板",
    "template.write": "创建/修改模板",
    "workflow.read": "查看工作流",
    "workflow.write": "创建/修改工作流",
    "org.read": "查看组织架构",
    "org.write": "管理租户/组织/团队",
    "member.read": "查看成员",
    "member.write": "管理成员与角色",
    "api.read": "查看开放接口与密钥",
    "api.write": "创建/吊销 API Key",
    "security.read": "查看安全监控",
    "settings.write": "修改系统设置",
}

ROLE_PERMISSIONS = {
    "platform_admin": list(PERMISSIONS.keys()),
    "project_manager": [
        "project.read", "project.write", "task.read", "task.write", "task.review",
        "dataset.read", "dataset.write", "template.read", "workflow.read", "workflow.write",
        "org.read", "member.read", "api.read", "security.read",
    ],
    "annotator": ["project.read", "task.read", "task.write", "dataset.read", "template.read", "workflow.read"],
    "reviewer": ["project.read", "task.read", "task.review", "dataset.read", "template.read", "workflow.read"],
    "client": ["project.read", "task.read", "dataset.read"],
}

MODALITY_LABEL = {
    "audio": "语音",
    "image": "图片",
    "video": "视频",
    "pointcloud": "3D 点云",
}

DEFAULT_LABELS = {
    "audio": {
        "业务分类": ["咨询", "投诉", "售后", "回访", "催发货"],
        "情绪": ["中性", "满意", "不满", "愤怒"],
        "事件": ["笑声", "静音", "重叠发言", "噪音", "打断"],
        "说话人": ["坐席", "客户", "第三方"],
    },
    "image": {"目标类别": ["商品主体", "价签", "货架", "遮挡"], "质量": ["清晰", "模糊", "过曝"]},
    "pointcloud": {"目标类别": ["轿车", "卡车", "行人", "骑行者"], "属性": ["静止", "运动", "遮挡"]},
    "video": {"行为": ["正常", "异常"], "事件": ["进入", "离开"]},
}


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    """幂等补列：老库升级时直接启动即可，无需手工迁移。"""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def init_db() -> None:
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        # 兼容历史数据：早期版本曾把中文状态写入 tasks.status
        for old, new in {
            "待标注": "pending",
            "标注中": "annotating",
            "待质检": "submitted",
            "质检中": "review",
            "已完成": "done",
        }.items():
            conn.execute("UPDATE tasks SET status=? WHERE status=?", (new, old))
        # v2 数据模型：多租户 / 组织 / 团队 / 数据集 / 模板 / 工作流 / 开放接口
        _ensure_column(conn, "users", "tenant_id", "INTEGER")
        _ensure_column(conn, "users", "org_id", "INTEGER")
        _ensure_column(conn, "users", "team_id", "INTEGER")
        _ensure_column(conn, "projects", "tenant_id", "INTEGER")
        _ensure_column(conn, "projects", "template_id", "INTEGER")
        _ensure_column(conn, "tasks", "workflow_id", "INTEGER")
        _ensure_column(conn, "tasks", "dataset_id", "INTEGER")
        _ensure_column(conn, "tasks", "qc_required", "INTEGER NOT NULL DEFAULT 1")
        _ensure_column(conn, "tasks", "qc_round", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "tasks", "rework_count", "INTEGER NOT NULL DEFAULT 0")
        # v3：归档 / 软删除 / 任务包 / 暂停恢复 / 导入来源
        _ensure_column(conn, "tasks", "archived", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "tasks", "archived_at", "TEXT")
        _ensure_column(conn, "tasks", "deleted", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "tasks", "package_id", "INTEGER")
        _ensure_column(conn, "tasks", "progress", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "tasks", "paused_at", "TEXT")
        _ensure_column(conn, "tasks", "ended_at", "TEXT")
        _ensure_column(conn, "tasks", "source", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "annotations", "source", "TEXT NOT NULL DEFAULT 'manual'")
        _ensure_column(conn, "qc_records", "dims", "TEXT NOT NULL DEFAULT '{}'")
        _ensure_column(conn, "qc_records", "item_index", "INTEGER NOT NULL DEFAULT -1")
        _ensure_column(conn, "dataset_versions", "digest", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "datasets", "webhook_url", "TEXT NOT NULL DEFAULT ''")
        _ensure_column(conn, "datasets", "sync_enabled", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(conn, "datasets", "storage", "TEXT NOT NULL DEFAULT 'local'")
        _ensure_column(conn, "users", "language", "TEXT NOT NULL DEFAULT 'zh'")
        conn.executescript(
            """
            CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id,status);
            CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id,status);
            CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
            CREATE INDEX IF NOT EXISTS idx_annotations_task ON annotations(task_id,updated_at);
            CREATE INDEX IF NOT EXISTS idx_qc_task ON qc_records(task_id,created_at);
            CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status,created_at);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id,read_at);
            CREATE INDEX IF NOT EXISTS idx_issues_task ON issues(task_id,status);
            CREATE INDEX IF NOT EXISTS idx_operator_runs ON operator_runs(operator_id,created_at);
            CREATE INDEX IF NOT EXISTS idx_dataset_items_version ON dataset_items(version_id,name);
            CREATE INDEX IF NOT EXISTS idx_api_requests_created ON api_requests(created_at);
            CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at);
            """
        )
        conn.commit()

    if rows("SELECT id FROM users LIMIT 1"):
        _seed_v2()
        _seed_v3()
        return

    ts = now()
    users = [
        ("honghaifeng", "洪海峰", "platform_admin"),
        ("admin", "春科管理员", "platform_admin"),
        ("liuxiao", "刘笑", "project_manager"),
        ("wangmin", "王敏", "annotator"),
        ("liqiang", "李强", "annotator"),
        ("zhoulan", "周岚", "reviewer"),
        ("client", "客户代表", "client"),
    ]
    for username, name, role in users:
        execute(
            "INSERT INTO users(username,name,password_hash,platform_role,created_at) VALUES(?,?,?,?,?)",
            (username, name, hash_password(DEFAULT_PASSWORD), role, ts),
        )
    uids = {u["username"]: u["id"] for u in rows("SELECT id,username FROM users")}

    projects = [
        (
            "voice-cs",
            "语音-客服话术质检",
            "audio",
            "客服通话转写、说话人分离、情绪与业务分类质检。对接本地 FunASR 预识别引擎。",
            uids["liuxiao"],
            "本地 FunASR",
            "http://127.0.0.1:8100",
            DEFAULT_LABELS["audio"],
        ),
        (
            "adas-3d",
            "智驾-点云目标标框",
            "pointcloud",
            "车载激光雷达点云 3D 框标注，复用 CVAT 标注内核与质检流程。",
            uids["honghaifeng"],
            "CVAT",
            "http://127.0.0.1:8090",
            DEFAULT_LABELS["pointcloud"],
        ),
        (
            "retail-img",
            "零售-商品图检测",
            "image",
            "货架商品检测与遮挡判定，复用 labelU 图像标注能力。",
            uids["liuxiao"],
            "labelU",
            "http://127.0.0.1:8001",
            DEFAULT_LABELS["image"],
        ),
    ]
    pid = {}
    for code, name, modality, desc, owner, engine, url, labels in projects:
        pid[code] = execute(
            "INSERT INTO projects(code,name,modality,description,owner_id,engine,engine_url,label_config,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (code, name, modality, desc, owner, engine, url, json.dumps(labels, ensure_ascii=False), ts),
        )

    members = {
        "voice-cs": [("liuxiao", "manager"), ("wangmin", "annotator"), ("liqiang", "annotator"), ("zhoulan", "reviewer"), ("client", "viewer")],
        "adas-3d": [("honghaifeng", "manager"), ("liqiang", "annotator"), ("zhoulan", "reviewer")],
        "retail-img": [("liuxiao", "manager"), ("wangmin", "annotator"), ("zhoulan", "reviewer")],
    }
    for code, ms in members.items():
        for username, role in ms:
            execute(
                "INSERT OR REPLACE INTO project_members(project_id,user_id,project_role) VALUES(?,?,?)",
                (pid[code], uids[username], role),
            )

    media = {
        "call-001.wav": os.path.join(MEDIA_DIR, "call-001.wav"),
        "call-002.wav": os.path.join(MEDIA_DIR, "call-002.wav"),
    }
    tasks = [
        ("voice-cs", "客服来电-20261109-001", "call-001.wav", "audio", 10.6, "pending", "wangmin", "zhoulan", "high", "1109 批次"),
        ("voice-cs", "客服来电-20261109-002", "call-002.wav", "audio", 13.9, "pending", "wangmin", "zhoulan", "normal", "1109 批次"),
        ("voice-cs", "客服来电-20261109-003", "", "audio", 0, "pending", "liqiang", "zhoulan", "normal", "1109 批次"),
        ("voice-cs", "客服来电-20261108-014", "call-001.wav", "audio", 10.6, "submitted", "liqiang", "zhoulan", "high", "1108 批次"),
        ("adas-3d", "城市场景-帧段-0031", "", "pointcloud", 0, "pending", "liqiang", "zhoulan", "normal", "点云批次 A"),
        ("adas-3d", "高速场景-帧段-0077", "", "pointcloud", 0, "pending", "liqiang", "zhoulan", "high", "点云批次 A"),
        ("retail-img", "货架巡检-门店-021", "", "image", 0, "pending", "wangmin", "zhoulan", "normal", "巡检 11 月"),
        ("retail-img", "货架巡检-门店-022", "", "image", 0, "pending", "wangmin", "zhoulan", "low", "巡检 11 月"),
    ]
    base = datetime.now()
    for i, (code, name, mf, mt, dur, status, assignee, reviewer, prio, batch) in enumerate(tasks):
        execute(
            "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,assignee_id,reviewer_id,"
            "priority,batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                pid[code],
                name,
                media.get(mf, ""),
                mt,
                dur,
                status,
                uids.get(assignee),
                uids.get(reviewer),
                prio,
                batch,
                (base - timedelta(days=2, hours=i)).strftime("%Y-%m-%d %H:%M:%S"),
                ts,
            ),
        )

    submitted_task = row("SELECT id FROM tasks WHERE status='submitted'")
    if submitted_task:
        payload = {
            "segments": [
                {"start": 0.03, "end": 2.55, "text": "您好，这里是春科客服中心，请问有什么可以帮您？", "spk": "坐席", "emotion": "中性", "events": []},
                {"start": 2.61, "end": 7.95, "text": "我上周买的设备一直没发货，订单号是二零二六幺幺零九。", "spk": "客户", "emotion": "不满", "events": []},
            ],
            "summary": "客户催发货，坐席未给出明确时效",
            "business": "催发货",
            "quality_score": 72,
        }
        execute(
            "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (submitted_task["id"], uids["liqiang"], json.dumps(payload, ensure_ascii=False), "{}", "submitted", 1, ts, ts),
        )

    for k, v in {
        "hotwords": "春科,订单号,发货时效,售后工程师,设备报修",
        "asr_engine": "funasr-paraformer",
        "spk_num": "2",
        "auto_prelabel": "on",
    }.items():
        execute("INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)", (k, v))

    _seed_v2()
    _seed_v3()
    log(uids["admin"], "init", "system", "初始化平台数据与演示任务")


BUILTIN_TEMPLATES = [
    {
        "code": "tpl-audio-cs",
        "name": "语音客服质检模板",
        "modality": "audio",
        "description": "转写 + 说话人 + 情绪 + 业务分类，适用于客服通话质检。",
        "labels": DEFAULT_LABELS["audio"],
        "qc": {"sample_rate": 30, "min_score": 80, "max_rework": 2, "require_comment": True},
        "instruction": "逐段校对转写文本，修正错别字与业务术语；标注说话人、情绪与业务分类。",
    },
    {
        "code": "tpl-image-retail",
        "name": "零售商品检测模板",
        "modality": "image",
        "description": "货架商品、价签、遮挡目标检测，支持 AI 预标注。",
        "labels": DEFAULT_LABELS["image"],
        "qc": {"sample_rate": 50, "min_score": 85, "max_rework": 2, "require_comment": True},
        "instruction": "每个商品主体画框并填写名称；价签与遮挡单独成类，避免漏标。",
    },
    {
        "code": "tpl-video-behavior",
        "name": "视频行为识别模板",
        "modality": "video",
        "description": "视频片段行为与事件标注，按时间段切分。",
        "labels": DEFAULT_LABELS["video"],
        "qc": {"sample_rate": 40, "min_score": 80, "max_rework": 2, "require_comment": False},
        "instruction": "按行为片段标注起止时间与事件类型，异常行为需填写说明。",
    },
    {
        "code": "tpl-pointcloud-3d",
        "name": "点云 3D 目标框模板",
        "modality": "pointcloud",
        "description": "车载激光雷达点云 3D 框标注规范与质检策略。",
        "labels": DEFAULT_LABELS["pointcloud"],
        "qc": {"sample_rate": 100, "min_score": 90, "max_rework": 3, "require_comment": True},
        "instruction": "对每个目标绘制 3D 框并标注类别与运动属性，遮挡目标需标记遮挡程度。",
    },
]


def _seed_v2() -> None:
    """幂等补齐 v2 演示数据，老库升级后也能看到完整组织/数据集/模板/工作流。"""
    ts = now()
    tenant = row("SELECT id FROM tenants ORDER BY id LIMIT 1")
    if tenant:
        tid = tenant["id"]
    else:
        tid = execute(
            "INSERT INTO tenants(code,name,status,created_at) VALUES(?,?,?,?)",
            ("chunke", "春科数据集团", "active", ts),
        )
    uids = {u["username"]: u["id"] for u in rows("SELECT id,username FROM users")}
    org_map = {o["code"]: o for o in rows("SELECT * FROM orgs WHERE tenant_id=?", (tid,))}
    for code, name, parent, manager in [
        ("hq", "总部交付中心", None, "honghaifeng"),
        ("east", "华东交付中心", "hq", "liuxiao"),
        ("south", "华南交付中心", "hq", "client"),
    ]:
        if code not in org_map:
            oid = execute(
                "INSERT INTO orgs(tenant_id,code,name,parent_id,manager_id,status,created_at) VALUES(?,?,?,?,?,?,?)",
                (
                    tid,
                    code,
                    name,
                    org_map.get(parent, {}).get("id") if parent else None,
                    uids.get(manager),
                    "active",
                    ts,
                ),
            )
            org_map[code] = {"id": oid, "code": code, "name": name}
    team_map = {t["code"]: t for t in rows("SELECT * FROM teams")}
    for code, org, name, leader, desc in [
        ("voice-team", "east", "语音标注一组", "liuxiao", "负责客服、回访等语音数据标注"),
        ("cv-team", "east", "视觉标注组", "liqiang", "负责图片、视频与点云标注"),
        ("qc-team", "hq", "质量审核组", "zhoulan", "统一抽审、返修与交付验收"),
    ]:
        if code not in team_map:
            team_map[code] = {
                "id": execute(
                    "INSERT INTO teams(org_id,code,name,leader_id,description,status,created_at) VALUES(?,?,?,?,?,?,?)",
                    (org_map[org]["id"], code, name, uids.get(leader), desc, "active", ts),
                ),
                "code": code,
            }
    user_org_team = {
        "honghaifeng": ("hq", "qc-team"),
        "admin": ("hq", "qc-team"),
        "liuxiao": ("east", "voice-team"),
        "wangmin": ("east", "voice-team"),
        "liqiang": ("east", "cv-team"),
        "zhoulan": ("hq", "qc-team"),
        "client": ("south", None),
    }
    for username, (org, team) in user_org_team.items():
        if username in uids:
            execute(
                "UPDATE users SET tenant_id=?, org_id=?, team_id=? WHERE id=?",
                (tid, org_map[org]["id"], team_map[team]["id"] if team else None, uids[username]),
            )
            if team:
                execute(
                    "INSERT OR REPLACE INTO team_members(team_id,user_id,team_role) VALUES(?,?,?)",
                    (
                        team_map[team]["id"],
                        uids[username],
                        "leader" if username in ("liuxiao", "liqiang", "zhoulan") else "member",
                    ),
                )

    if not rows("SELECT role FROM role_permissions LIMIT 1"):
        for role, perms in ROLE_PERMISSIONS.items():
            for perm in perms:
                execute(
                    "INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)",
                    (role, perm),
                )

    tpl_ids = {}
    for t in BUILTIN_TEMPLATES:
        found = row("SELECT id FROM templates WHERE code=?", (t["code"],))
        if found:
            tpl_ids[t["modality"]] = found["id"]
        else:
            tpl_ids[t["modality"]] = execute(
                "INSERT INTO templates(code,name,modality,description,label_config,qc_config,instruction,builtin,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    t["code"],
                    t["name"],
                    t["modality"],
                    t["description"],
                    json.dumps(t["labels"], ensure_ascii=False),
                    json.dumps(t["qc"], ensure_ascii=False),
                    t["instruction"],
                    1,
                    ts,
                ),
            )

    for p in rows("SELECT * FROM projects"):
        execute("UPDATE projects SET tenant_id=? WHERE id=?", (tid, p["id"]))
        if not p.get("template_id") and p["modality"] in tpl_ids:
            execute("UPDATE projects SET template_id=? WHERE id=?", (tpl_ids[p["modality"]], p["id"]))
        wf = row("SELECT id FROM workflows WHERE project_id=? LIMIT 1", (p["id"],))
        if not wf:
            tpl = row("SELECT * FROM templates WHERE id=?", (tpl_ids.get(p["modality"]),))
            policy = json.loads(tpl["qc_config"]) if tpl else {"sample_rate": 100, "min_score": 80, "max_rework": 2}
            wf_id = execute(
                "INSERT INTO workflows(name,project_id,template_id,description,steps,qc_policy,status,created_by,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    f"{p['name']} · 标准流程",
                    p["id"],
                    tpl["id"] if tpl else None,
                    "标注 → 自检 → 抽审 → 返修 → 交付",
                    json.dumps(["标注", "自检", "抽审", "返修", "交付"], ensure_ascii=False),
                    json.dumps(policy, ensure_ascii=False),
                    "active",
                    uids.get("admin"),
                    ts,
                ),
            )
        else:
            wf_id = wf["id"]
        execute("UPDATE tasks SET workflow_id=? WHERE project_id=? AND workflow_id IS NULL", (wf_id, p["id"]))

        ds_code = f"ds-{p['code']}"
        ds = row("SELECT id FROM datasets WHERE code=?", (ds_code,))
        if not ds:
            ds_id = execute(
                "INSERT INTO datasets(tenant_id,project_id,code,name,modality,description,status,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?,?)",
                (
                    tid,
                    p["id"],
                    ds_code,
                    f"{p['name']} · 原始数据集",
                    p["modality"],
                    "由项目任务自动汇聚的原始数据，可按版本快照并导出。",
                    "active",
                    uids.get("admin"),
                    ts,
                    ts,
                ),
            )
            task_items = rows(
                "SELECT * FROM tasks WHERE project_id=? AND media_path<>'' ORDER BY id", (p["id"],)
            )
            ver_id = execute(
                "INSERT INTO dataset_versions(dataset_id,version,note,item_count,created_by,created_at) VALUES(?,?,?,?,?,?)",
                (ds_id, 1, "初始化版本", len(task_items), uids.get("admin"), ts),
            )
            for t in task_items:
                size = 0
                try:
                    size = os.path.getsize(t["media_path"])
                except OSError:
                    pass
                execute(
                    "INSERT INTO dataset_items(dataset_id,version_id,task_id,name,media_path,media_type,size,meta,created_at)"
                    " VALUES(?,?,?,?,?,?,?,?,?)",
                    (
                        ds_id,
                        ver_id,
                        t["id"],
                        t["name"],
                        t["media_path"],
                        t["media_type"],
                        size,
                        json.dumps({"batch": t["batch"], "duration": t["duration"]}, ensure_ascii=False),
                        ts,
                    ),
                )
            execute("UPDATE tasks SET dataset_id=? WHERE project_id=?", (ds_id, p["id"]))


def security_event(kind: str, severity: str = "info", actor: str = "", ip: str = "", detail: str = "") -> None:
    execute(
        "INSERT INTO security_events(kind,severity,actor,ip,detail,created_at) VALUES(?,?,?,?,?,?)",
        (kind, severity, actor, ip, detail, now()),
    )


def notify(user_id: int | None, title: str, body: str = "", kind: str = "system", link: str = "") -> None:
    """站内通知：任务分配、返修、暂停等节点统一写入。"""
    if not user_id:
        return
    execute(
        "INSERT INTO notifications(user_id,kind,title,body,link,created_at) VALUES(?,?,?,?,?,?)",
        (user_id, kind, title, body, link, now()),
    )


def pref_get(user_id: int) -> dict:
    r = row("SELECT data FROM user_preferences WHERE user_id=?", (user_id,))
    if not r:
        return {}
    try:
        return json.loads(r["data"] or "{}")
    except (TypeError, ValueError):
        return {}


DEFAULT_HELP = [
    ("快速入门", "如何完成一条图片标注任务", "1. 任务中心打开任务 → 进入标注；2. 上传图片；3. 点击「AI 预识别」或手工画框；4. 填写目标名称；5. 保存草稿后提交质检。"),
    ("快速入门", "语音转写与说话人校对", "在音频工作台点击播放，逐段校对转写文本，选择说话人、情绪与事件；支持快捷键空格播放/暂停、A/D 微调边界。"),
    ("质检", "质检评分与返修规则", "质检员按维度评分（准确性、完整性、规范性），低于模板最低分自动进入返修；每个问题项可单独定位并返修。"),
    ("数据集", "数据集版本与回溯", "每次快照生成不可变版本并记录摘要哈希，可对比任意两个版本的新增/删除/变更条目，并一键回滚生成新版本。"),
    ("开放平台", "API Key 与 OpenAPI", "在开放平台创建 API Key（read/write/admin 范围），通过 X-API-Key 调用 /api/v1/*；所有调用均记录在调用日志中。"),
    ("运维", "备份与恢复", "运维中心可创建 SQLite 热备份，恢复前自动生成安全副本；建议每日定时备份并异地保存。"),
]


def _seed_v3() -> None:
    """v3 幂等数据：帮助中心、标签库、组件、算子、模型、质检规则、模板版本。"""
    ts = now()
    uids = {u["username"]: u["id"] for u in rows("SELECT id,username FROM users")}
    admin_id = uids.get("admin")
    if not rows("SELECT id FROM help_articles LIMIT 1"):
        for i, (cat, title, body) in enumerate(DEFAULT_HELP):
            execute(
                "INSERT INTO help_articles(category,title,body,sort,updated_at) VALUES(?,?,?,?,?)",
                (cat, title, body, i, ts),
            )
    if not rows("SELECT id FROM label_sets LIMIT 1"):
        for modality, labels in DEFAULT_LABELS.items():
            execute(
                "INSERT OR IGNORE INTO label_sets(code,name,modality,labels,description,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (
                    f"ls-{modality}",
                    f"{MODALITY_LABEL.get(modality, modality)}默认标签集",
                    modality,
                    json.dumps(labels, ensure_ascii=False),
                    "内置标签库，可在标注模板中直接引用。",
                    admin_id,
                    ts,
                    ts,
                ),
            )
    if not rows("SELECT id FROM components LIMIT 1"):
        builtin = [
            (
                "cmp-classify",
                "单选分类组件",
                "image",
                {"fields": [{"key": "category", "type": "select", "label": "业务分类", "options": ["咨询", "投诉", "售后"]}]},
                "适用于图片/文本的单标签分类。",
            ),
            (
                "cmp-multi-check",
                "多选质检组件",
                "audio",
                {"fields": [{"key": "checks", "type": "checkbox", "label": "质检项", "options": ["无噪音", "无重叠", "转写准确"]}]},
                "语音质检多选项。",
            ),
            (
                "cmp-text-span",
                "文本实体组件",
                "text",
                {"fields": [{"key": "entity", "type": "text", "label": "实体", "placeholder": "输入实体名称"}]},
                "文本实体抽取标注。",
            ),
        ]
        for code, name, modality, schema, desc in builtin:
            execute(
                "INSERT INTO components(code,name,modality,schema,description,builtin,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (code, name, modality, json.dumps(schema, ensure_ascii=False), desc, 1, admin_id, ts, ts),
            )
    if not rows("SELECT id FROM operators LIMIT 1"):
        for code, name, kind, modality, desc in [
            ("op-ocr", "OCR 文字识别算子", "ocr", "image", "调用外部 OCR 服务，把识别文字写入预标注。"),
            ("op-sam", "SAM 分割算子", "sam", "image", "调用 Segment Anything 生成候选框/掩码。"),
            ("op-track", "视频目标跟踪算子", "tracking", "video", "按关键帧跟踪目标，自动插值生成框序列。"),
            ("op-qa", "文本质检算子", "qa", "text", "调用大模型对文本标注做一致性质检。"),
            ("op-asr", "语音识别算子", "asr", "audio", "调用 FunASR/Whisper 服务生成分段时间戳。"),
        ]:
            execute(
                "INSERT INTO operators(code,name,kind,modality,endpoint,method,headers,input_map,output_map,timeout,enabled,description,created_by,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    code,
                    name,
                    kind,
                    modality,
                    "",
                    "POST",
                    "{}",
                    json.dumps({"media": "file", "task_id": "task.id"}, ensure_ascii=False),
                    json.dumps({"boxes": "result.boxes", "segments": "result.segments"}, ensure_ascii=False),
                    30,
                    1,
                    desc,
                    admin_id,
                    ts,
                    ts,
                ),
            )
    if not rows("SELECT id FROM model_registry LIMIT 1"):
        for name, kind, provider, version, metrics in [
            ("FunASR Paraformer", "asr", "local", "v2.0", {"cer": 0.061, "rtf": 0.12}),
            ("YOLOv8 商品检测", "detection", "local", "8.1", {"map50": 0.842}),
            ("SAM ViT-H", "segmentation", "local", "1.0", {"iou": 0.91}),
            ("Qwen2.5-72B 质检", "qa", "remote", "2.5", {"agreement": 0.88}),
        ]:
            execute(
                "INSERT INTO model_registry(name,kind,provider,endpoint,version,status,metrics,config,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?,?,?)",
                (name, kind, provider, "", version, "active", json.dumps(metrics), "{}", ts, ts),
            )
    if not rows("SELECT id FROM quality_rules LIMIT 1"):
        for name, modality, config in [
            ("图片目标必填名称", "image", {"require_non_empty": ["name"], "min_count": 1}),
            ("语音分段覆盖检查", "audio", {"min_count": 1, "max_gap": 1.5, "require_non_empty": ["text"]}),
            ("通用空标注拦截", "", {"min_count": 1}),
        ]:
            execute(
                "INSERT INTO quality_rules(project_id,name,modality,config,enabled,created_by,created_at) VALUES(?,?,?,?,?,?,?)",
                (None, name, modality, json.dumps(config, ensure_ascii=False), 1, admin_id, ts),
            )
    for t in rows("SELECT * FROM templates"):
        if not row("SELECT id FROM template_versions WHERE template_id=? LIMIT 1", (t["id"],)):
            execute(
                "INSERT OR IGNORE INTO template_versions(template_id,version,label_config,qc_config,instruction,note,locked,created_by,created_at)"
                " VALUES(?,?,?,?,?,?,?,?,?)",
                (t["id"], 1, t["label_config"], t["qc_config"], t["instruction"], "初始版本", t["builtin"], admin_id, ts),
            )
    for version, name in [
        (1, "多租户与 RBAC"),
        (2, "数据集/模板/工作流/开放接口"),
        (3, "作业中心/多模态/算子/运维"),
    ]:
        execute(
            "INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)",
            (version, name, ts),
        )
    for k, v in {
        "brand_name": "春科数据标注平台",
        "brand_short": "春科标注",
        "brand_color": "#3B82F6",
        "storage_driver": "local",
        "storage_bucket": "",
        "storage_region": "",
        "storage_endpoint": "",
        "media_token_ttl": "600",
        "ip_allowlist": "",
        "watermark": "on",
        "mfa_required": "off",
        "sso_provider": "",
        "sso_client_id": "",
        "sso_discovery": "",
        "scim_token": "",
        "log_retention_days": "90",
        "language_default": "zh",
    }.items():
        execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))
