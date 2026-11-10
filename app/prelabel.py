"""AI 预识别桥接：调用 FunASR venv 中的 worker，把结果转成平台标注结构。"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

from . import db

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUNASR_PY = "/Users/haifeng2026/Desktop/mini2026/voice-repos/FunASR/.venv/bin/python"
FUNASR_CWD = "/Users/haifeng2026/Desktop/mini2026/voice-repos/FunASR"
WORKER_ASR = os.path.join(BASE_DIR, "scripts", "asr_worker.py")
WORKER_DETECT = os.path.join(BASE_DIR, "scripts", "detect_worker.py")

# YOLOv8n baseline 权重路径（和 detect_worker.py 保持一致）
_MODELS_DIR = Path("/Volumes/ORICO/voice-ai/models")
YOLO_WEIGHTS = _MODELS_DIR / "detect" / "yolov8n.pt"

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
    return os.path.exists(FUNASR_PY) and os.path.exists(WORKER_ASR)


def detect_worker_ready() -> bool:
    """detect_worker 就绪：脚本存在 + 至少一个引擎的权重可用

    注意：Grounding DINO HF 用平台 venv（sys.executable），不依赖 FunASR venv。
    所以这里只检查 WORKER_DETECT 脚本 + 权重文件，不检查 FUNASR_PY。
    """
    if not os.path.exists(WORKER_DETECT):
        return False
    # Grounding DINO HF tiny 权重（HF cache）
    gd_hf_cache = Path.home() / ".cache" / "huggingface" / "hub" / "models--IDEA-Research--grounding-dino-tiny"
    gd_ok = gd_hf_cache.exists() and any(
        (p.name.startswith("model") and p.suffix in (".safetensors", ".bin"))
        for p in gd_hf_cache.rglob("*")
    )
    # YOLOv8n 权重
    yolo_ok = YOLO_WEIGHTS.exists()
    return gd_ok or yolo_ok


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
            [FUNASR_PY, WORKER_ASR, "--in", req_path, "--out", out_path],
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


def prelabel_image(
    image_path: str,
    classes: list[str] | None = None,
    engine: str = "auto",
    min_conf: float = 0.15,
) -> dict:
    """图片预标注：调 detect_worker 跑 Grounding DINO（默认）或 YOLOv8n。

    默认 engine="auto"，让 worker 自己按依赖可用性选 Grounding DINO HF 或 YOLO。
    worker 用 **当前 Python**（sys.executable）执行，这样：
      - 用平台 venv 跑 → 有 transformers + torch → Grounding DINO HF
      - 用 FunASR venv 跑 → 只有 opencv + tokenizers → 回退 YOLOv8n
    """
    if not os.path.exists(image_path):
        return {"ok": False, "error": "图片文件不存在，请先上传"}
    if not detect_worker_ready():
        return {"ok": False, "error": "本地检测引擎未就绪（缺权重或依赖）"}

    token = uuid.uuid4().hex[:12]
    out_path = os.path.join(db.TMP_DIR, f"detect-{token}.json")

    # 用当前 Python 执行 detect_worker（而非 FUNASR_PY）
    current_py = sys.executable or FUNASR_PY
    cmd = [
        current_py, WORKER_DETECT,
        "--in", os.path.abspath(image_path),
        "--out", out_path,
        "--engine", engine,
        "--min-conf", str(min_conf),
    ]
    if classes:
        cmd += ["--classes", ",".join(classes)]

    started = time.time()
    try:
        proc = subprocess.run(
            cmd,
            cwd=FUNASR_CWD,
            env=ENV,
            capture_output=True,
            text=True,
            timeout=180,
        )
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "检测超时（180 秒）"}

    if not os.path.exists(out_path):
        tail = (proc.stderr or proc.stdout or "")[-600:]
        return {"ok": False, "error": f"检测失败：{tail.strip() or 'worker 无输出'}"}

    try:
        with open(out_path, encoding="utf-8") as f:
            result = json.load(f)
    finally:
        try:
            os.remove(out_path)
        except OSError:
            pass

    result["elapsed_ms"] = int((time.time() - started) * 1000)
    return result
