"""本地真实 AI 服务层：LLM（Ollama/OpenAI 兼容）、OCR（RapidONNX）、分割（GrabCut/区域生长）。

原则：全部真实推理，无伪造输出。服务不可用返回 None/抛出明确错误，由调用方转 400。
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

import numpy as np

from . import db

_OLLAMA = "http://127.0.0.1:11434"
_llm_cache: dict | None = None
_llm_cache_at = 0.0
_ocr_engine = None


# ---------------------------------------------------------------- LLM 服务发现
def llm_service() -> dict | None:
    """发现可用的大模型服务：设置 operator.llm.url → 环境变量 → 本机 Ollama。"""
    global _llm_cache, _llm_cache_at
    if _llm_cache and time.time() - _llm_cache_at < 60:
        return _llm_cache
    svc = None
    url = (db.row("SELECT value FROM settings WHERE key='operator.llm.url'") or {}).get("value")
    if not url:
        url = os.environ.get("CK_LLM_URL") or os.environ.get("CK_OPENAI_BASE_URL")
    if url:
        svc = {"kind": "openai", "base": url.rstrip("/"),
               "model": os.environ.get("CK_LLM_MODEL") or _first_ollama_model() or "qwen3"}
    else:
        model = _first_ollama_model()
        if model:
            svc = {"kind": "ollama", "base": _OLLAMA, "model": model}
    _llm_cache, _llm_cache_at = svc, time.time()
    return svc


def _first_ollama_model() -> str:
    try:
        with urllib.request.urlopen(f"{_OLLAMA}/api/tags", timeout=1.5) as resp:
            models = json.loads(resp.read().decode()).get("models") or []
        names = [m.get("name") for m in models if m.get("name")]
        # 优先小模型，响应快
        names.sort(key=lambda n: ("14b" in n or "70b" in n, len(n)))
        return names[0] if names else ""
    except Exception:
        return ""


def llm_chat(messages: list[dict], temperature: float = 0.3, json_mode: bool = False,
             timeout: int = 180) -> str:
    svc = llm_service()
    if not svc:
        raise RuntimeError("无可用大模型服务：请安装 Ollama 并拉取模型（如 qwen3），"
                           "或在系统设置填写 operator.llm.url（OpenAI 兼容地址）")
    if svc["kind"] == "ollama":
        body = {"model": svc["model"], "messages": messages, "stream": False,
                "options": {"temperature": temperature}}
        if json_mode:
            body["format"] = "json"
        req = urllib.request.Request(
            f"{svc['base']}/api/chat", data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
        return (data.get("message") or {}).get("content") or ""
    body = {"model": svc["model"], "messages": messages, "temperature": temperature}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    req = urllib.request.Request(
        f"{svc['base'].rstrip('/')}/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {os.environ.get('CK_LLM_KEY', 'ollama')}"},
        method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode())
    return (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""


# ---------------------------------------------------------------- OCR（RapidOCR，真实识别）
def ocr_ready() -> bool:
    try:
        from rapidocr_onnxruntime import RapidOCR  # noqa: F401
        return True
    except ImportError:
        return False


def ocr_image(path: str) -> list[dict]:
    """对整图做真实 OCR，返回 [{'box':[[x,y]x4], 'text', 'conf'}]（像素坐标）。"""
    global _ocr_engine
    if not ocr_ready():
        raise RuntimeError("未安装 RapidOCR：请运行 uv pip install rapidocr_onnxruntime")
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _ocr_engine = RapidOCR()
    from PIL import Image
    with Image.open(path) as im:
        w, h = im.size
    result, _ = _ocr_engine(path)
    out = []
    for item in (result or []):
        box, text, conf = item[0], item[1], float(item[2])
        out.append({"box": [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in box],
                    "text": str(text), "conf": round(conf, 4),
                    "bbox_norm": [round(box[0][0] / w, 4), round(box[0][1] / h, 4),
                                  round((box[2][0] - box[0][0]) / w, 4), round((box[2][1] - box[0][1]) / h, 4)]})
    return out


# ---------------------------------------------------------------- 分割（GrabCut / 区域生长，真实算法）
def cv_ready() -> bool:
    try:
        import cv2  # noqa: F401
        return True
    except ImportError:
        return False


def _mask_to_polygon(mask: np.ndarray, w: int, h: int) -> list[list[float]]:
    import cv2
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    c = max(contours, key=cv2.contourArea)
    eps = 0.01 * cv2.arcLength(c, True)
    approx = cv2.approxPolyDP(c, eps, True)
    pts = [[round(p[0][0] / w, 4), round(p[0][1] / h, 4)] for p in approx]
    return pts if len(pts) >= 3 else []


def segment_box(path: str, rect: tuple[float, float, float, float]) -> dict:
    """矩形提示 → GrabCut 图割分割（真实算法），返回归一化多边形与覆盖率。"""
    if not cv_ready():
        raise RuntimeError("未安装 opencv-python：请运行 uv pip install opencv-python-headless")
    import cv2
    img = cv2.imread(path)
    if img is None:
        raise RuntimeError("图像读取失败")
    h, w = img.shape[:2]
    x, y, bw, bh = rect
    x0, y0 = max(0, int(x * w) - 8), max(0, int(y * h) - 8)
    x1, y1 = min(w, int((x + bw) * w) + 8), min(h, int((y + bh) * h) + 8)
    if x1 - x0 < 4 or y1 - y0 < 4:
        raise RuntimeError("提示框过小")
    mask = np.zeros((h, w), np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(img, mask, (x0, y0, x1 - x0, y1 - y0), bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
    out = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype(np.uint8)
    if out.sum() < 30:
        raise RuntimeError("GrabCut 未能从该提示框中分出前景，请调整提示框")
    return {"polygon": _mask_to_polygon(out, w, h), "coverage": round(float(out.mean()), 4)}


def segment_point(path: str, pt: tuple[float, float], positive: bool = True) -> dict:
    """点提示 → 区域生长（floodFill 色差扩张），返回多边形。"""
    if not cv_ready():
        raise RuntimeError("未安装 opencv-python：请运行 uv pip install opencv-python-headless")
    import cv2
    img = cv2.imread(path)
    if img is None:
        raise RuntimeError("图像读取失败")
    h, w = img.shape[:2]
    px, py = int(pt[0] * w), int(pt[1] * h)
    if not (0 <= px < w and 0 <= py < h):
        raise RuntimeError("提示点超出图像范围")
    seed = img[py, px].reshape(1, 1, 3).astype(np.int16)
    lo = int(np.abs(img.astype(np.int16) - seed).max() * 0.9) + 12
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | (255 << 8) | cv2.FLOODFILL_MASK_ONLY
    if not positive:
        flags |= cv2.FLOODFILL_FIXED_RANGE
    cv2.floodFill(img, mask, (px, py), 255, (lo,) * 3, (lo,) * 3, flags)
    out = mask[1:-1, 1:-1]
    if out.sum() < 20:
        raise RuntimeError("该区域过小或与周边颜色相近，请换一点")
    if out.sum() > 0.5 * h * w:  # 扩散失控则收缩阈值重试
        mask = np.zeros((h + 2, w + 2), np.uint8)
        cv2.floodFill(img, mask, (px, py), 255, (8, 8, 8), (8, 8, 8), flags)
        out = mask[1:-1, 1:-1]
    return {"polygon": _mask_to_polygon(out, w, h), "coverage": round(float(out.mean()), 4)}


# ---------------------------------------------------------------- 状态汇总
def ai_status() -> list[dict]:
    svc = llm_service()
    items = []
    if svc:
        label = "Ollama · " + svc["model"] if svc["kind"] == "ollama" else "OpenAI 兼容 · " + svc["model"]
        items.append({"name": "大模型服务", "desc": label, "kind": "llm", "online": True})
    else:
        items.append({"name": "大模型服务", "desc": "未检测到：安装 Ollama 或配置 operator.llm.url",
                      "kind": "llm", "online": False})
    items.append({"name": "OCR 识别", "desc": "RapidOCR（ONNX 本地）", "kind": "ocr", "online": ocr_ready()})
    items.append({"name": "图像分割", "desc": "GrabCut / 区域生长（OpenCV）", "kind": "cv", "online": cv_ready()})
    return items
