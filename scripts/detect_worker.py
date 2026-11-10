#!/usr/bin/env python3
"""图像预标注 worker

用法:
    python scripts/detect_worker.py --in shelf.jpg --out result.json
    python scripts/detect_worker.py --in shelf.jpg --out result.json \
        --engine grounding-dino --classes "商品主体,价签,货架,遮挡"

引擎:
    yolo           - ultralytics YOLOv8n，COCO 80 类（需要 torch）
    grounding-dino - ONNX 开放词汇检测（需要 tokenizers + onnxruntime）

输出 JSON 结构:
{
  "ok": true,
  "engine": "grounding-dino",
  "img_size": {"w": 1400, "h": 933},
  "elapsed_ms": 842,
  "boxes": [
    {"cls": "商品主体", "cls_id": 0, "conf": 0.87, "x": 0.12, "y": 0.23, "w": 0.18, "h": 0.41}
  ]
}
"""
from __future__ import annotations
import argparse, json, os, sys, time
from pathlib import Path

# 模型路径
MODELS_DIR = Path("/Volumes/ORICO/voice-ai/models")
YOLO_WEIGHTS = MODELS_DIR / "detect" / "yolov8n.pt"
GD_BASE = MODELS_DIR / "detect" / "grounding-dino-tiny"
GD_ONNX = GD_BASE / "onnx" / "model.onnx"
GD_TOKENIZER = GD_BASE / "tokenizer.json"
GD_PRE = GD_BASE / "preprocessor_config.json"

# YOLO COCO → 业务类别粗映射（baseline 用）
COCO_TO_BIZ = {
    "person": "行人", "bicycle": "骑行者", "car": "轿车", "truck": "卡车",
    "bottle": "商品主体", "cup": "商品主体", "wine glass": "商品主体",
    "handbag": "商品主体", "backpack": "商品主体",
}


def run_yolo(image_path: str, min_conf: float = 0.35):
    import cv2
    from ultralytics import YOLO
    # 首次调用自动下载 yolov8n.pt (~5MB) 到 ~/.config/Ultralytics/
    model = YOLO(str(YOLO_WEIGHTS) if YOLO_WEIGHTS.exists() else "yolov8n.pt")
    img = cv2.imread(image_path)
    if img is None:
        raise RuntimeError(f"无法读取图片: {image_path}")
    h, w = img.shape[:2]
    results = model.predict(img, conf=min_conf, verbose=False)[0]
    boxes = []
    for box in results.boxes:
        xyxy = box.xyxy[0].tolist()
        x1, y1, x2, y2 = xyxy
        cls_name = model.names[int(box.cls)]
        boxes.append({
            "cls": COCO_TO_BIZ.get(cls_name, cls_name),
            "cls_id": int(box.cls),
            "conf": round(float(box.conf), 3),
            "x": round(x1 / w, 4),
            "y": round(y1 / h, 4),
            "w": round((x2 - x1) / w, 4),
            "h": round((y2 - y1) / h, 4),
        })
    return boxes, {"w": w, "h": h}


def run_grounding_dino(image_path: str, classes: list[str], min_conf: float = 0.25):
    """Grounding DINO tiny ONNX 开放词汇检测

    cls 是一段 text prompt（用 . 或逗号分隔），返回每个 prompt 下所有命中的 box。
    直接用 tokenizers 库编码 prompt，避免 ~1GB 的 transformers 依赖。
    """
    import cv2
    import numpy as np
    import onnxruntime as ort
    from tokenizers import Tokenizer

    if not GD_ONNX.exists():
        raise RuntimeError(f"Grounding DINO ONNX 未找到: {GD_ONNX}")
    if not GD_TOKENIZER.exists():
        raise RuntimeError(f"tokenizer 未找到: {GD_TOKENIZER}")

    tokenizer = Tokenizer.from_file(str(GD_TOKENIZER))
    # BERT 风格 tokenization → token_ids + type_ids(全0) + attention_mask
    def encode(prompt: str, max_len: int = 256):
        enc = tokenizer.encode(prompt)
        ids = enc.ids[:max_len]
        n = len(ids)
        # 补 [PAD]=0 到 max_len
        if n < max_len:
            ids = ids + [0] * (max_len - n)
        attn = [1] * min(n, max_len) + [0] * (max_len - min(n, max_len))
        type_ids = [0] * max_len  # Grounding DINO 单句输入
        return (np.array(ids, dtype=np.int64)[None, :],
                np.array(attn, dtype=np.int64)[None, :],
                np.array(type_ids, dtype=np.int64)[None, :])

    sess = ort.InferenceSession(str(GD_ONNX), providers=["CPUExecutionProvider"])
    input_names = [i.name for i in sess.get_inputs()]
    print(f"[debug] ONNX inputs: {input_names}", file=sys.stderr)

    # 图片预处理（按 preprocessor_config.json 通常是 800x800, ImageNet normalize）
    pre_cfg = json.loads(GD_PRE.read_text()) if GD_PRE.exists() else {}
    target = pre_cfg.get("size", {"height": 800, "width": 800})
    TH, TW = target.get("height", 800), target.get("width", 800)

    img = cv2.imread(image_path)
    if img is None:
        raise RuntimeError(f"无法读取图片: {image_path}")
    h, w = img.shape[:2]
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (TW, TH), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)
    resized = (resized - mean) / std
    pixel_values = resized.transpose(2, 0, 1)[None, ...]  # [1,3,TH,TW]
    # Grounding DINO 需要 pixel_mask（全 1，表示整图有效）
    pixel_mask = np.ones((1, TH, TW), dtype=np.int64)

    # 文本 prompt: " . ".join(classes) + " ."
    prompt = " . ".join(classes) + " ."
    input_ids, attention_mask, token_type_ids = encode(prompt)

    # 组装 feeds（按 ONNX 要求的名称）
    feeds = {
        "pixel_values": pixel_values,
        "input_ids": input_ids,
        "attention_mask": attention_mask,
        "token_type_ids": token_type_ids,
        "pixel_mask": pixel_mask,
    }
    print(f"[debug] feeds keys: {list(feeds.keys())}", file=sys.stderr)

    outputs = sess.run(None, feeds)
    print(f"[debug] outputs: {[o.shape for o in outputs]}", file=sys.stderr)
    # Grounding DINO ONNX 输出顺序 (onnx-community 版本): logits, pred_boxes (cxcywh),
    # text_attn (or similar). pred_boxes 是归一化坐标 (0..1).
    logits = outputs[0]
    boxes_cxcywh = outputs[1]

    if logits.ndim == 3:
        logits = logits[0]
    if boxes_cxcywh.ndim == 3:
        boxes_cxcywh = boxes_cxcywh[0]

    # 每个 box argmax 取类别 → classes 索引
    cls_per_box = logits.argmax(axis=1)
    conf_per_box = logits.max(axis=1)

    results = []
    for i in range(logits.shape[0]):
        conf = float(conf_per_box[i])
        if conf < min_conf:
            continue
        cls_id = int(cls_per_box[i])
        if cls_id >= len(classes):
            continue
        name = classes[cls_id]
        cx, cy, bw, bh = boxes_cxcywh[i].tolist()
        x1 = max(0.0, cx - bw / 2)
        y1 = max(0.0, cy - bh / 2)
        results.append({
            "cls": name,
            "cls_id": cls_id,
            "conf": round(conf, 3),
            "x": round(x1, 4), "y": round(y1, 4),
            "w": round(max(0.001, bw), 4), "h": round(max(0.001, bh), 4),
        })

    results = _nms_by_cls(results, iou_thr=0.5)
    return results, {"w": w, "h": h}


def _nms_by_cls(boxes: list[dict], iou_thr: float = 0.5) -> list[dict]:
    """简单按类别做 NMS"""
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--engine", default="grounding-dino", choices=["grounding-dino", "yolo"])
    ap.add_argument("--classes", default="商品主体,价签,货架,遮挡")
    ap.add_argument("--min-conf", type=float, default=0.25)
    args = ap.parse_args()

    t0 = time.time()
    classes = [c.strip() for c in args.classes.split(",") if c.strip()]
    try:
        if args.engine == "yolo":
            boxes, size = run_yolo(args.inp, args.min_conf)
        else:
            boxes, size = run_grounding_dino(args.inp, classes, args.min_conf)
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
        "engine": args.engine,
        "img_size": size,
        "elapsed_ms": elapsed_ms,
        "boxes": boxes,
        "error": err,
    }
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({"ok": ok, "boxes": len(boxes), "elapsed_ms": elapsed_ms, "engine": args.engine}, ensure_ascii=False))
    if not ok:
        sys.exit(2)


if __name__ == "__main__":
    main()
