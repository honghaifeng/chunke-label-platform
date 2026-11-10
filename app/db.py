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
"""

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


def init_db() -> None:
    os.makedirs(MEDIA_DIR, exist_ok=True)
    os.makedirs(TMP_DIR, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        conn.commit()

    if rows("SELECT id FROM users LIMIT 1"):
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

    log(uids["admin"], "init", "system", "初始化平台数据与演示任务")
