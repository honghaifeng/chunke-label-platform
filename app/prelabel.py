"""AI 预识别桥接：调用 FunASR venv 中的 worker，把结果转成平台标注结构。"""
from __future__ import annotations

import json
import os
import subprocess
import time
import uuid

from . import db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNASR_PY = "/Users/haifeng2026/Desktop/mini2026/voice-repos/FunASR/.venv/bin/python"
FUNASR_CWD = "/Users/haifeng2026/Desktop/mini2026/voice-repos/FunASR"
WORKER = os.path.join(BASE_DIR, "scripts", "asr_worker.py")

ENV = {
    **os.environ,
    "MODELSCOPE_CACHE": "/Volumes/ORICO/voice-ai/models/modelscope",
    "HF_HOME": "/Volumes/ORICO/voice-ai/models/hf",
    "PYTHONUNBUFFERED": "1",
    "TOKENIZERS_PARALLELISM": "false",
}


def settings() -> dict:
    return {r["key"]: r["value"] for r in db.rows("SELECT key,value FROM settings")}


def worker_ready() -> bool:
    return os.path.exists(FUNASR_PY) and os.path.exists(WORKER)


def prelabel_audio(
    audio_path: str,
    hotwords: list[str] | None = None,
    spk_num: int | None = None,
    with_emotion: bool = False,
) -> dict:
    if not os.path.exists(audio_path):
        return {"ok": False, "error": "音频文件不存在，请先上传音频"}
    if not worker_ready():
        return {"ok": False, "error": "未找到本地 FunASR 运行环境"}

    token = uuid.uuid4().hex[:12]
    req_path = os.path.join(db.TMP_DIR, f"asr-{token}.json")
    out_path = os.path.join(db.TMP_DIR, f"asr-{token}.out.json")
    with open(req_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "audio": os.path.abspath(audio_path),
                "hotwords": hotwords or [],
                "spk_num": spk_num,
                "emotion": bool(with_emotion),
            },
            f,
            ensure_ascii=False,
        )

    started = time.time()
    try:
        proc = subprocess.run(
            [FUNASR_PY, WORKER, "--in", req_path, "--out", out_path],
            cwd=FUNASR_CWD,
            env=ENV,
            capture_output=True,
            text=True,
            timeout=600,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "预识别超时（600 秒），音频过长请先切片"}
    finally:
        try:
            os.remove(req_path)
        except OSError:
            pass

    if not os.path.exists(out_path):
        tail = (proc.stderr or proc.stdout or "")[-800:]
        return {"ok": False, "error": f"预识别失败：{tail.strip() or 'worker 无输出'}"}

    try:
        with open(out_path, encoding="utf-8") as f:
            result = json.load(f)
    finally:
        try:
            os.remove(out_path)
        except OSError:
            pass

    if not result.get("ok"):
        return result

    result["elapsed_ms"] = int((time.time() - started) * 1000)
    return result


def engine_status() -> list[dict]:
    import urllib.request

    items = [
        ("本地 ASR 引擎", "FunASR · Paraformer + CAM++", "http://127.0.0.1:8100/health", "inuse"),
        ("Label Studio", "语音/文本/多模态", "http://127.0.0.1:8080/", "linked"),
        ("labelU", "图像标注", "http://127.0.0.1:8001/", "linked"),
        ("CVAT", "点云/视频/图像", "http://127.0.0.1:8090/", "linked"),
    ]
    out = []
    for name, desc, url, kind in items:
        ok = False
        code = 0
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=1.2) as resp:
                code = resp.status
                ok = code < 500
        except Exception:
            ok = False
        out.append({"name": name, "desc": desc, "url": url, "kind": kind, "online": ok, "code": code})
    return out


def asr_model_ready() -> bool:
    try:
        return db.row("SELECT value FROM settings WHERE key='asr_engine'") is not None and worker_ready()
    except Exception:
        return False
