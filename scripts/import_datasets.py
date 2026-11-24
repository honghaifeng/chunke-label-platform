"""把本机已下载的自动驾驶数据集导入为平台标注任务。

支持数据源（默认根目录 /Volumes/ORICO/data/datasets）：
- kitti_image   KITTI object/training：图片 + label_2 二维框 → 城市治理-人车流量检测
- kitti_lidar   KITTI object/training：velodyne 点云 + 标定换算 3D 框 → 智驾-点云目标标框
- nuscenes      nuScenes mini：LIDAR_TOP 点云（附带 CAM_FRONT 图）→ 智驾-点云目标标框
- dair          DAIR-V2X-C（需先解压 dair-v2x-c-full.zip）：车端/路端图像 → 城市治理-人车流量检测

幂等：按「项目 + 任务名」去重，重复运行不会产生重复任务。
用法：python3 scripts/import_datasets.py [--root 数据集根目录] [--only kitti_image|kitti_lidar|nuscenes|dair]
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import random
import shutil
import struct
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db  # noqa: E402

ROOT = "/Volumes/ORICO/data/datasets"
TS = db.now()
BATCH_TAG = "外部数据集"

KITTI_CLS = {
    "Car": "轿车", "Van": "货车", "Truck": "货车", "Tram": "公交车",
    "Pedestrian": "行人", "Person_sitting": "行人", "Cyclist": "骑行者",
}
SKIP_CLS = {"Misc", "DontCare"}


def _uids() -> dict:
    return {u["username"]: u["id"] for u in db.rows("SELECT id,username FROM users")}


def _project(code: str, name: str, modality: str, desc: str, labels: dict, owner: int) -> int:
    p = db.row("SELECT id FROM projects WHERE code=?", (code,))
    if p:
        return p["id"]
    return db.execute(
        "INSERT INTO projects(code,name,modality,description,owner_id,engine,engine_url,label_config,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (code, name, modality, desc, owner, "", "", json.dumps(labels, ensure_ascii=False), TS),
    )


def _member(pid: int, uid: int | None, role: str) -> None:
    if uid:
        db.execute(
            "INSERT OR IGNORE INTO project_members(project_id,user_id,project_role) VALUES(?,?,?)",
            (pid, uid, role),
        )


def _task(pid: int, name: str, media: str, media_type: str, status: str,
          assignee: int | None, reviewer: int | None, batch: str, duration: float = 0) -> int | None:
    if db.row("SELECT 1 ok FROM tasks WHERE project_id=? AND name=? AND deleted=0", (pid, name)):
        return None
    return db.execute(
        "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,assignee_id,reviewer_id,"
        "priority,batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        (pid, name, media, media_type, duration, status, assignee, reviewer, "normal", batch, TS, TS),
    )


def _draft(tid: int, uid: int | None, payload: dict, prelabel: dict | None = None) -> None:
    if db.row("SELECT 1 ok FROM annotations WHERE task_id=?", (tid,)):
        return
    db.execute(
        "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (tid, uid, json.dumps(payload, ensure_ascii=False),
         json.dumps(prelabel or {}, ensure_ascii=False), "draft", 1, TS, TS),
    )


def _copy_media(src: str, prefix: str) -> str:
    dst = os.path.join(db.MEDIA_DIR, f"{prefix}{os.path.basename(src)}")
    if not os.path.exists(dst):
        shutil.copy2(src, dst)
    return dst


def _attach_media(tid: int, path: str, kind: str, role: str = "") -> None:
    if not path or not os.path.exists(path):
        return
    if db.row("SELECT 1 ok FROM task_media WHERE task_id=? AND path=?", (tid, path)):
        return
    db.execute(
        "INSERT INTO task_media(task_id,kind,name,path,meta,created_at) VALUES(?,?,?,?,?,?)",
        (tid, kind, os.path.basename(path), path,
         json.dumps({"role": role}, ensure_ascii=False) if role else "{}", TS),
    )


# ---------------------------------------------------------------- KITTI 图片
def import_kitti_image(root: str, pid: int, uid: dict, limit: int = 12) -> int:
    train = os.path.join(root, "kitti/object/training")
    rng = random.Random(42)
    picked: list[tuple[str, list]] = []
    for lbl_path in sorted(glob.glob(os.path.join(train, "label_2/*.txt"))):
        stem = os.path.splitext(os.path.basename(lbl_path))[0]
        boxes = []
        with open(lbl_path) as f:
            for line in f:
                parts = line.split()
                if len(parts) < 15 or parts[0] in SKIP_CLS:
                    continue
                cls = KITTI_CLS.get(parts[0])
                if not cls:
                    continue
                l, t, r, b = map(float, parts[4:8])
                if r - l < 8 or b - t < 8:
                    continue
                boxes.append({"cls": cls, "box": (l, t, r, b), "src": parts[0]})
        if not boxes:
            continue
        has_car = any(b["cls"] in ("轿车", "货车") for b in boxes)
        has_ped = any(b["cls"] == "行人" for b in boxes)
        if has_car and has_ped and len(boxes) >= 3:
            picked.append((stem, boxes))
        if len(picked) >= limit:
            break

    count = 0
    for i, (stem, boxes) in enumerate(picked):
        img_src = os.path.join(train, "image_2", f"{stem}.png")
        if not os.path.exists(img_src):
            continue
        with Image.open(img_src) as im:
            W, H = im.size
        media = _copy_media(img_src, "kitti-")
        name = f"kitti-训练-{stem}"
        status = "annotating" if i < 8 else "pending"
        tid = _task(pid, name, media, "image", status, uid.get("wangmin"), uid.get("zhoulan"), "kitti-train")
        if not tid:
            continue
        count += 1

        def norm(b):
            l, t, r, b2 = b["box"]
            return {
                "cls": b["cls"],
                "x": round(l / W, 4), "y": round(t / H, 4),
                "w": round((r - l) / W, 4), "h": round((b2 - t) / H, 4),
            }

        ai_boxes = []
        for b in boxes:
            n = norm(b)
            jitter = lambda v: max(0.0, min(0.98, v + rng.uniform(-0.012, 0.012)))  # noqa: E731
            ai_boxes.append({
                "cls": n["cls"], "auto_cls": b["src"], "conf": round(rng.uniform(0.68, 0.95), 2),
                "x": round(jitter(n["x"]), 4), "y": round(jitter(n["y"]), 4),
                "w": round(max(0.01, n["w"] + rng.uniform(-0.01, 0.01)), 4),
                "h": round(max(0.01, n["h"] + rng.uniform(-0.01, 0.01)), 4),
            })
        # 人工已确认一部分，其余留给标注员对照 AI 建议核对
        confirm_n = max(1, int(len(boxes) * 0.5))
        human_boxes = [{**norm(b), "source": "manual", "name": ""} for b in boxes[:confirm_n]]
        payload = {"boxes": human_boxes + [
            {**a, "name": "", "source": "ai"} for a in ai_boxes[confirm_n:]
        ]}
        _draft(tid, uid.get("wangmin"), payload, {"engine": "Grounding DINO", "boxes": [{**a, "name": ""} for a in ai_boxes]})
    return count


# ---------------------------------------------------------------- KITTI 点云
def _read_calib(path: str) -> dict:
    calib = {}
    with open(path) as f:
        for line in f:
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            calib[k.strip()] = np.array([float(x) for x in v.split()], dtype=np.float64)
    return calib


def import_kitti_lidar(root: str, pid: int, uid: dict, limit: int = 4) -> int:
    train = os.path.join(root, "kitti/object/training")
    rng = np.random.default_rng(7)
    count = 0
    for lbl_path in sorted(glob.glob(os.path.join(train, "label_2/*.txt"))):
        if count >= limit:
            break
        stem = os.path.splitext(os.path.basename(lbl_path))[0]
        bin_path = os.path.join(train, "velodyne", f"{stem}.bin")
        if not os.path.exists(bin_path):
            continue
        objs = []
        with open(lbl_path) as f:
            for line in f:
                parts = line.split()
                if len(parts) < 15 or parts[0] in SKIP_CLS or parts[0] not in KITTI_CLS:
                    continue
                h, w, l = map(float, parts[8:11])
                x, y, z = map(float, parts[11:14])
                ry = float(parts[14])
                objs.append((KITTI_CLS[parts[0]], h, w, l, x, y, z, ry))
        if len(objs) < 4:
            continue
        pts = np.fromfile(bin_path, dtype=np.float32).reshape(-1, 4)[:, :3]
        if len(pts) > 30000:
            idx = rng.choice(len(pts), 30000, replace=False)
            pts = pts[idx]
        calib = _read_calib(os.path.join(train, "calib", f"{stem}.txt"))
        Tr = calib.get("Tr_velo_to_cam", np.eye(4)[:3].reshape(-1))
        R = calib.get("R0_rect", np.eye(3).reshape(-1))[:9].reshape(3, 3)
        Tr_m = Tr.reshape(3, 4)
        Tr_inv = np.linalg.inv(Tr_m[:, :3])
        boxes = []
        for cls, h, w, l, x, y, z, ry in objs:
            cam = np.array([x, y, z])
            velo = Tr_inv @ (R.T @ cam - Tr_m[:, 3])
            if abs(velo[0]) > 60 or abs(velo[1]) > 60:  # 只保留可视范围内的目标
                continue
            boxes.append({
                "label": cls, "x": round(float(velo[0]), 2), "y": round(float(velo[1]), 2),
                "z": round(float(velo[2]), 2), "l": round(l, 2), "w": round(w, 2),
                "h": round(h, 2), "yaw": round(-ry, 3),
            })
        if len(boxes) < 3:
            continue
        name = f"kitti-点云-{stem}"
        tid = _task(pid, name, "", "pointcloud", "annotating", uid.get("liqiang"), uid.get("zhoulan"), "kitti-train")
        if not tid:
            continue
        count += 1
        # 双视图联动：挂载同帧相机图 + 标定矩阵（3D 框可投影到 2D）
        img_src = os.path.join(train, "image_2", f"{stem}.png")
        if os.path.exists(img_src):
            media = _copy_media(img_src, "kitti-cam-")
            _attach_media(tid, media, "image", "camera_front")
        _draft(tid, uid.get("liqiang"), {
            "sample": [[round(float(a), 2) for a in p] for p in pts],
            "boxes": boxes, "category": "城市道路",
            "calib": {
                "P2": [round(float(x), 6) for x in calib["P2"]],
                "Tr": [round(float(x), 6) for x in calib["Tr_velo_to_cam"]],
                "R0": [round(float(x), 6) for x in calib["R0_rect"]],
            },
        })
    return count


# ---------------------------------------------------------------- nuScenes mini
def import_nuscenes(root: str, pid: int, uid: dict, limit: int = 2) -> int:
    samples = os.path.join(root, "nuscenes_mini/samples")
    rng = np.random.default_rng(11)
    count = 0
    cam_pool: dict[int, str] = {}
    for cam_path in glob.glob(os.path.join(samples, "CAM_FRONT/*.jpg")):
        stem = os.path.splitext(os.path.basename(cam_path))[0]
        try:
            cam_pool[int(stem.split("__")[-1])] = cam_path
        except ValueError:
            continue
    cam_stamps = sorted(cam_pool) if cam_pool else []

    def nearest_cam(stamp: int, max_delta_us: int = 300_000) -> str:
        """按微秒时间戳匹配最近的相机帧（nuScenes 时间戳单位为 μs，帧间隔 50ms）。"""
        if not cam_stamps:
            return ""
        # 二分找最近时间戳
        import bisect
        i = bisect.bisect_left(cam_stamps, stamp)
        best = None
        for j in (i - 1, i):
            if 0 <= j < len(cam_stamps) and abs(cam_stamps[j] - stamp) <= max_delta_us:
                if best is None or abs(cam_stamps[j] - stamp) < abs(best - stamp):
                    best = cam_stamps[j]
        return cam_pool[best] if best is not None else ""

    for bin_path in sorted(glob.glob(os.path.join(samples, "LIDAR_TOP/*.pcd.bin"))):
        if count >= limit:
            break
        token = os.path.basename(bin_path)
        try:
            stamp = int(token.split("__")[-1].replace(".pcd.bin", ""))
        except ValueError:
            continue
        cam = nearest_cam(stamp)
        pts = np.fromfile(bin_path, dtype=np.float32).reshape(-1, 5)[:, :3]
        if len(pts) > 6000:
            idx = rng.choice(len(pts), 6000, replace=False)
            pts = pts[idx]
        name = f"nuscenes-点云-{stamp}"
        tid = _task(pid, name, "", "pointcloud", "annotating", uid.get("liqiang"), uid.get("zhoulan"), "nuscenes-mini")
        if not tid:
            continue
        count += 1
        _draft(tid, uid.get("liqiang"), {
            "sample": [[round(float(a), 2) for a in p] for p in pts],
            "boxes": [], "category": "城区自动驾驶",
        })
        if cam and os.path.exists(cam):
            media = _copy_media(cam, "nuscenes-")
            _attach_media(tid, media, "image", "camera_front")
    return count


# ---------------------------------------------------------------- DAIR-V2X-C
def import_dair(root: str, pid: int, uid: dict, limit: int = 6) -> int:
    base = os.path.join(root, "dair_v2x/dair_v2x_full/_extracted/cooperative-vehicle-infrastructure")
    if not os.path.isdir(base):
        print("  [跳过] DAIR-V2X-C 尚未解压：先 unzip dair-v2x-c-full.zip 到 _extracted/")
        return 0
    count = 0
    for side, side_cn in (("vehicle-side", "车端"), ("infrastructure-side", "路端")):
        img_dir = os.path.join(base, side, "image")
        lbl_dir = os.path.join(base, side, "label", "camera")
        if not os.path.isdir(img_dir) or not os.path.isdir(lbl_dir):
            continue
        for img_src in sorted(glob.glob(os.path.join(img_dir, "*.jpg"))):
            if count >= limit:
                return count
            stem = os.path.splitext(os.path.basename(img_src))[0]
            lbl_path = os.path.join(lbl_dir, f"{stem}.json")
            if not os.path.exists(lbl_path):
                continue
            with open(lbl_path) as f:
                labels = json.load(f)
            items = []
            if isinstance(labels, dict):
                for key in ("labels", "frames"):
                    if isinstance(labels.get(key), list):
                        items = labels[key]
                        break
            elif isinstance(labels, list):
                items = labels
            boxes = []
            for it in items:
                b2 = it.get("2d_box") or it.get("2dBox")
                if not b2:
                    continue
                cls = KITTI_CLS.get(str(it.get("type", "")), None) or {
                    "Car": "轿车", "Truck": "货车", "Bus": "公交车",
                    "Pedestrian": "行人", "Cyclist": "骑行者", "Van": "货车",
                }.get(str(it.get("type", "")))
                if not cls:
                    continue
                try:
                    l, t = float(b2["xmin"]), float(b2["ymin"])
                    r, b = float(b2["xmax"]), float(b2["ymax"])
                except (KeyError, TypeError, ValueError):
                    continue
                if r - l < 8 or b - t < 8:
                    continue
                boxes.append((cls, l, t, r, b))
            if len(boxes) < 2:
                continue
            with Image.open(img_src) as im:
                W, H = im.size
            media = _copy_media(img_src, f"dair-{side[:3]}-")
            name = f"dair-v2x-{side_cn}-{stem}"
            status = "annotating" if count < 4 else "pending"
            tid = _task(pid, name, media, "image", status, uid.get("wangmin"), uid.get("zhoulan"), "dair-v2x-c")
            if not tid:
                continue
            count += 1
            ai_boxes = [{
                "cls": c, "auto_cls": c, "conf": 0.9, "x": round(l / W, 4), "y": round(t / H, 4),
                "w": round((r - l) / W, 4), "h": round((b - t) / H, 4),
            } for c, l, t, r, b in boxes]
            human = [{
                "cls": c, "name": "", "source": "manual",
                "x": round(l / W, 4), "y": round(t / H, 4), "w": round((r - l) / W, 4), "h": round((b - t) / H, 4),
            } for c, l, t, r, b in boxes[: max(1, len(boxes) // 2)]]
            _draft(tid, uid.get("wangmin"), {"boxes": human}, {"engine": "DAIR-V2X 真值", "boxes": ai_boxes})
    return count


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=ROOT)
    ap.add_argument("--only", choices=["kitti_image", "kitti_lidar", "nuscenes", "dair", "all"], default="all")
    args = ap.parse_args()
    uid = _uids()
    need = {"wangmin", "zhoulan", "liqiang", "liuxiao"}
    if not need.issubset(uid):
        raise SystemExit(f"缺少演示用户: {need - set(uid)}")

    img_pid = _project(
        "traffic-detect", "城市治理-人车流量检测", "image",
        "路口、广场、高架等城市场景的人与车辆目标检测，支撑人车流量统计与事件分析。",
        {"目标类别": ["行人", "骑行者", "轿车", "货车", "公交车"]}, uid["liuxiao"],
    )
    pc_pid = _project(
        "adas-3d", "智驾-点云目标标框", "pointcloud",
        "车载激光雷达点云 3D 框标注，复用 CVAT 标注内核与质检流程。",
        {"目标类别": ["轿车", "货车", "行人", "骑行者"], "属性": ["静止", "运动", "遮挡"]}, uid.get("honghaifeng") or uid["liuxiao"],
    )
    for pid, role_map in (
        (img_pid, {"liuxiao": "manager", "wangmin": "annotator", "zhoulan": "reviewer"}),
        (pc_pid, {"honghaifeng": "manager", "liuxiao": "manager", "liqiang": "annotator", "zhoulan": "reviewer"}),
    ):
        for uname, prole in role_map.items():
            _member(pid, uid.get(uname), prole)

    jobs = {
        "kitti_image": lambda: import_kitti_image(args.root, img_pid, uid),
        "kitti_lidar": lambda: import_kitti_lidar(args.root, pc_pid, uid),
        "nuscenes": lambda: import_nuscenes(args.root, pc_pid, uid),
        "dair": lambda: import_dair(args.root, img_pid, uid),
    }
    for key, fn in jobs.items():
        if args.only not in (key, "all"):
            continue
        n = fn()
        print(f"[{key}] 新增任务 {n} 个")


if __name__ == "__main__":
    main()
