#!/usr/bin/env python3
"""图像预标注 worker

用法:
    python scripts/detect_worker.py --in shelf.jpg --out result.json
    python scripts/detect_worker.py --in shelf.jpg --out result.json \
        --engine grounding-dino-hf --classes "商品主体,价签,货架,遮挡"

引擎:
    grounding-dino-hf - Grounding DINO tiny 原版（HF transformers）
                       英文 prompt → 零样本开放词汇检测 → 中文业务类回填
                       纯 CPU ~2.6s/次，检出质量远高于 YOLOv8n
    yolo              - ultralytics YOLOv8n COCO 80 类 baseline

输出 JSON 结构:
{
  "ok": true,
  "engine": "grounding-dino-hf",
  "img_size": {"w": 1400, "h": 933},
  "elapsed_ms": 2640,
  "boxes": [
    {"cls": "商品主体", "cls_id": 0, "conf": 0.87, "x": 0.12, "y": 0.23, "w": 0.18, "h": 0.41,
     "auto_cls": "a grocery product"}
  ]
}
"""
from __future__ import annotations
import argparse, json, os, re, sys, time
from pathlib import Path

MODELS_DIR = Path("/Volumes/ORICO/voice-ai/models")
YOLO_WEIGHTS = MODELS_DIR / "detect" / "yolov8n.pt"
GD_HF_MODEL = "IDEA-Research/grounding-dino-tiny"

# ---------------------------------------------------------------------------
# 中英类别映射表
# Grounding DINO 的 text encoder 是 bert-base-uncased（英文），
# 把中文业务类翻译成高质量英文 prompt 才能让模型检出东西。
# 每个中文类 → 多组英文候选短语（Grounding DINO 对丰富描述效果更好）
# ---------------------------------------------------------------------------
ZH_TO_EN: dict[str, list[str]] = {
    # 零售货架巡检
    "商品主体": ["a grocery product", "a retail product",
                 "a bottle", "a box", "a can", "a package"],
    "价签":     ["a retail price tag", "a price tag"],
    "货架":     ["a store shelf", "a shelf panel", "a product shelf", "a grocery shelf"],
    "遮挡":     ["an occluded area", "an occlusion", "blocked view", "partially covered"],
    "清晰":     [],   # 质量类 Grounding DINO 无法检测（不是物体）
    "模糊":     [],
    "过曝":     [],
    # 智驾 3D 场景（COCO 里有的，Grounding DINO 也能检出）
    "行人":     ["a person", "a pedestrian", "a walking person"],
    "骑行者":   ["a bicycle", "a motorcycle", "a cyclist"],
    "轿车":     ["a car", "a sedan", "a motor vehicle"],
    "卡车":     ["a truck", "a lorry", "a large vehicle"],
}

# Grounding DINO 输出的英文 label → 中文业务类（关键字模糊匹配）
EN_TO_BIZ_KEYWORDS: list[tuple[str, list[str]]] = [
    # 价签必须排在货架前：短语 "a shelf price label" 同时含 shelf/price，应判为价签
    ("价签",     ["price tag", "price label", "price", "retail tag", "tag", "label sticker", "label"]),
    ("货架",     ["shelf", "display", "panel", "rack", "stand"]),
    ("商品主体", ["product", "grocery", "bottle", "box", "can", "package", "beverage",
                  "item", "goods", "merchandise"]),
    ("遮挡",     ["occluded", "occlusion", "blocked", "hidden", "covered", "occluded area"]),
    ("行人",     ["person", "pedestrian", "man", "woman", "boy", "girl", "child", "baby"]),
    ("骑行者",   ["bicycle", "bike", "motorcycle", "cyclist", "rider"]),
    ("轿车",     ["car", "sedan", "automobile", "vehicle"]),
    ("卡车",     ["truck", "lorry", "bus"]),
]


def zh_classes_to_prompt(classes: list[str]) -> tuple[str, dict[int, str]]:
    """中文业务类 → Grounding DINO 英文 prompt + 映射表

    返回 (prompt, idx_to_zh)
      prompt: "a grocery product. a retail price tag. a store shelf. an occluded area."
      idx_to_zh: {0: "商品主体", 1: "价签", 2: "货架", 3: "遮挡"}
    """
    prompt_parts: list[str] = []
    idx_to_zh: dict[int, str] = {}
    idx = 0
    for zh in classes:
        phrases = ZH_TO_EN.get(zh) or [f"a {zh}"]   # 兜底：a 中文（肯定无效）
        # 用第一个作为主短语，其他加到 prompt 里让 Grounding DINO 多种说法都能命中
        for phrase in phrases:
            prompt_parts.append(phrase)
            idx_to_zh[idx] = zh
            idx += 1
    prompt = " . ".join(prompt_parts) + " ."
    return prompt, idx_to_zh


def en_label_to_zh(label: str) -> str:
    """Grounding DINO 返回的英文 label → 中文业务类（关键字模糊匹配）

    匹配不到任何业务关键字（如 "view"、裸 "product" 这类整图/噪声框）时返回空串，
    由调用方丢弃，避免把无意义框兜底成「商品主体」。
    """
    low = label.lower().strip()
    for zh, kws in EN_TO_BIZ_KEYWORDS:
        for kw in kws:
            if kw in low:
                return zh
    return ""


# ---------------------------------------------------------------------------
# Grounding DINO HF 原版（推荐引擎）
# ---------------------------------------------------------------------------
def run_grounding_dino_hf(image_path: str, classes: list[str], min_conf: float = 0.15):
    """Grounding DINO tiny 原版（HF transformers）

    英文 prompt → 零样本检测 → 中文业务类回填。

    模型缓存路径: ~/.cache/huggingface/hub/models--IDEA-Research--grounding-dino-tiny/
    首次加载约 20-30s，之后每次推理 2.5-3s（纯 CPU）。
    """
    import torch
    from PIL import Image
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection

    # 懒加载（每次调用都加载，因为 worker 是 subprocess 模式；模型会缓存到 HF hub）
    processor = AutoProcessor.from_pretrained(GD_HF_MODEL)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(GD_HF_MODEL)
    model.eval()

    img = Image.open(image_path).convert("RGB")
    W, H = img.size

    prompt, idx_to_zh = zh_classes_to_prompt(classes)
    print(f"[debug] 中文类: {classes}", file=sys.stderr)
    print(f"[debug] 英文 prompt: {prompt[:200]}...", file=sys.stderr)

    inputs = processor(images=img, text=prompt, return_tensors="pt")
    with torch.no_grad():
        outputs = model(**inputs)

    # transformers 5.x API: processor.post_process_grounded_object_detection(outputs, input_ids, threshold, ...)
    results = processor.post_process_grounded_object_detection(
        outputs, inputs.input_ids, threshold=min_conf, text_threshold=min_conf,
        target_sizes=[img.size[::-1]],
    )
    boxes, scores = results[0]["boxes"], results[0]["scores"]
    # v4.51.0+ 返回 text_labels（字符串），之前版本返回 labels（可能是整数 id）
    raw_labels = results[0].get("text_labels") or results[0].get("labels") or []

    out = []
    for i in range(len(scores)):
        x1, y1, x2, y2 = boxes[i].tolist()
        en_label = raw_labels[i] if isinstance(raw_labels[i], str) else str(raw_labels[i])
        bw, bh = x2 - x1, y2 - y1
        # Grounding DINO 可能返回组合 label，如 "a shelf a display"，按关键词取第一个匹配的中文类
        zh_cls = en_label_to_zh(en_label)
        if not zh_cls:
            # 匹配不到业务类的噪声框（如整图 "view"）直接丢弃
            continue
        # 过滤行级噪声框：商品/价签若横跨画面大半宽且很矮，说明检出的是「整排」而不是单个目标
        if zh_cls in ("商品主体", "价签") and bw / W > 0.5 and bh / H < 0.12:
            continue
        out.append({
            "cls": zh_cls,
            "cls_id": i,                # 内部序号
            "conf": round(float(scores[i]), 3),
            "x": round(x1 / W, 4), "y": round(y1 / H, 4),
            "w": round(max(0.001, (x2 - x1) / W), 4),
            "h": round(max(0.001, (y2 - y1) / H), 4),
            "auto_cls": en_label[:60],  # Grounding DINO 原始英文 label（最多 60 字符）
        })

    # 按业务类做 NMS，避免同个区域多个框（Grounding DINO 多短语易在同一物体上重复命中）
    out = _nms_by_cls(out, iou_thr=0.30)
    # 置信度降序
    out.sort(key=lambda x: -x["conf"])
    return out, {"w": W, "h": H}


# ---------------------------------------------------------------------------
# YOLOv8n COCO 80 类 baseline（回退）
# ---------------------------------------------------------------------------
def run_yolo(image_path: str, min_conf: float = 0.35):
    import cv2
    from ultralytics import YOLO
    model = YOLO(str(YOLO_WEIGHTS) if YOLO_WEIGHTS.exists() else "yolov8n.pt")
    img = cv2.imread(image_path)
    if img is None:
        raise RuntimeError(f"无法读取图片: {image_path}")
    h, w = img.shape[:2]
    results = model.predict(img, conf=min_conf, verbose=False)[0]
    boxes = []
    for box in results.boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        en_name = model.names[int(box.cls)]
        zh_cls = en_label_to_zh(en_name)
        boxes.append({
            "cls": zh_cls,
            "cls_id": int(box.cls),
            "conf": round(float(box.conf), 3),
            "x": round(x1 / w, 4), "y": round(y1 / h, 4),
            "w": round((x2 - x1) / w, 4), "h": round((y2 - y1) / h, 4),
            "auto_cls": en_name,
        })
    return boxes, {"w": w, "h": h}


def _nms_by_cls(boxes: list[dict], iou_thr: float = 0.5) -> list[dict]:
    def iou(a, b):
        ax1, ay1, ax2, ay2 = a["x"], a["y"], a["x"] + a["w"], a["y"] + a["h"]
        bx1, by1, bx2, by2 = b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"]
        ix1, iy1 = max(ax1, bx1), max(ay1, by1)
        ix2, iy2 = min(ax2, bx2), min(ay2, by2)
        ia = max(0, ix2 - ix1) * max(0, iy2 - iy1)
        if ia <= 0:
            return 0.0
        union = a["w"] * a["h"] + b["w"] * b["h"] - ia
        return ia / union if union > 0 else 0.0

    kept: list[dict] = []
    for grp_cls in {b["cls"] for b in boxes}:
        grp = sorted([b for b in boxes if b["cls"] == grp_cls], key=lambda x: -x["conf"])
        while grp:
            top = grp.pop(0)
            kept.append(top)
            grp = [b for b in grp if iou(top, b) < iou_thr]
    return kept


def _engine_available(engine: str) -> bool:
    if engine == "grounding-dino-hf":
        try:
            import transformers, torch
            return True
        except ImportError:
            return False
    if engine == "yolo":
        try:
            import ultralytics, cv2
            return True
        except ImportError:
            return False
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--engine", default="auto",
                    choices=["auto", "grounding-dino-hf", "yolo", "grounding-dino"])
    ap.add_argument("--classes", default="商品主体,价签,货架,遮挡")
    ap.add_argument("--min-conf", type=float, default=0.15)
    args = ap.parse_args()

    t0 = time.time()
    classes = [c.strip() for c in args.classes.split(",") if c.strip()]

    # auto: 优先 Grounding DINO HF，否则 YOLO
    engine = args.engine
    if engine == "auto":
        if _engine_available("grounding-dino-hf"):
            engine = "grounding-dino-hf"
        elif _engine_available("yolo"):
            engine = "yolo"
        else:
            raise SystemExit("无可用检测引擎：需要 transformers+torch 或 ultralytics+opencv")

    try:
        if engine == "grounding-dino-hf":
            boxes, size = run_grounding_dino_hf(args.inp, classes, args.min_conf)
        elif engine == "yolo":
            boxes, size = run_yolo(args.inp, args.min_conf)
        else:
            # 旧 ONNX grounding-dino 分支：已废弃，改用 HF 原版
            raise RuntimeError("grounding-dino(onnx) 已废弃，请改用 grounding-dino-hf")
        ok = True
        err = None
    except Exception as exc:
        ok = False
        err = f"{type(exc).__name__}: {exc}"
        boxes = []
        size = {"w": 0, "h": 0}

    elapsed_ms = int((time.time() - t0) * 1000)
    result = {
        "ok": ok,
        "engine": engine,
        "img_size": size,
        "elapsed_ms": elapsed_ms,
        "boxes": boxes,
        "error": err,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({"ok": ok, "boxes": len(boxes), "elapsed_ms": elapsed_ms,
                       "engine": engine, "class_prompt_separators": zh_classes_to_prompt(classes)[0][:120]},
                      ensure_ascii=False))
    if not ok:
        sys.exit(2)


if __name__ == "__main__":
    main()
