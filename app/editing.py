"""图像编辑指令标注：模态定义、结构化校验、样本目录导入、数据集体检与 JSONL 导出。

规范要点（与客户标注规范一一对应）：
1. 原图至少包含 3 个同类型目标，指令通过颜色 / 位置 / 序数等属性唯一指向目标；
2. 只允许两类编辑：删除目标 / 修改属性（颜色、纹理、尺寸、材质）；
3. 数据类型需覆盖人物 / 动物 / 物品 / 食物，单一细分类型占比不超过 10%；
4. 编辑后目标的影子需按实际情况同步调整。
"""
from __future__ import annotations

import json
import os
import re
import shutil
import uuid
import zipfile
from collections import Counter
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response

from . import auth, db

router = APIRouter()

MODALITY = "editing"
MODALITY_LABEL = "图像编辑指令"

EDIT_TYPES = {"delete": "删除目标", "attribute": "修改属性"}
ATTRIBUTE_DIMS = {"color": "颜色", "texture": "纹理", "size": "尺寸", "material": "材质"}
TARGET_CATEGORIES = ["人物", "动物", "物品", "食物"]

MIN_TARGETS = 3
MAX_INSTRUCTION = 120
MIN_INSTRUCTION = 6
SAME_TYPE_LIMIT = 10.0  # 单一细分类型占比上限（%）

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
DELETE_VERB = re.compile(r"删除|删掉|移除|去掉|去除|消除|抹除|擦除|抹去")
ATTR_VERB = re.compile(
    r"改为|改成|换成|变为|变成|调整为|调节为|修改为|替换为|涂成|染成|放大|缩小|增大|减小|加长|缩短|调大|调小|复原|恢复|还原"
)
LOCATOR = re.compile(
    r"左|右|上|下|前|后|中央|中间|正中|顶部|底部|背景|前景|画面|图中|角落|旁边|内侧|外侧|"
    r"桌面|台面|地面|墙|窗|门|床|沙发|柜台|架子|层|旁|侧"
)
ORDINAL = re.compile(r"第[一二三四五六七八九十两0-9]+|最[大小长短高低远近粗细微]|左数|右数|上数|下数|其中|另一")
COLOR_WORD = re.compile(r"红|橙|黄|绿|青|蓝|紫|黑|白|灰|棕|粉|金|银|米色|卡其|墨绿|藏青|咖啡色")


def me(request: Request) -> dict:
    return auth.current_user(request)


def _json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def _project(pid: int) -> dict:
    p = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "项目不存在")
    return p


def _assert_project(user: dict, pid: int, write: bool = False) -> dict:
    project = _project(pid)
    if auth.is_admin(user):
        return project
    if pid not in auth.visible_project_ids(user):
        raise HTTPException(403, "无权访问该项目")
    if write and auth.project_role(user, pid) != "manager":
        raise HTTPException(403, "仅项目管理者可执行该操作")
    return project


def is_editing_project(project: dict | None) -> bool:
    return bool(project) and project.get("modality") == MODALITY


def config() -> dict:
    return {
        "modality": MODALITY,
        "modality_label": MODALITY_LABEL,
        "edit_types": [{"key": k, "label": v} for k, v in EDIT_TYPES.items()],
        "attribute_dims": [{"key": k, "label": v} for k, v in ATTRIBUTE_DIMS.items()],
        "target_categories": TARGET_CATEGORIES,
        "rules": {
            "min_targets": MIN_TARGETS,
            "min_instruction": MIN_INSTRUCTION,
            "max_instruction": MAX_INSTRUCTION,
            "same_type_limit": SAME_TYPE_LIMIT,
            "require_result_image": True,
            "require_shadow_confirmed": True,
        },
    }


# ---------------------------------------------------------------------------
# 结构化数据归一化与校验
# ---------------------------------------------------------------------------

def _norm_text(value: Any) -> str:
    return re.sub(r"[\s，,。.；;：:、！!？?（）()【】\[\]\"'“”‘’]", "", str(value or ""))


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    return str(value or "").strip().lower() in ("1", "true", "yes", "on", "是", "已调整")


def _normalize_boxes(boxes: Any) -> list[dict]:
    out: list[dict] = []
    for b in boxes or []:
        if not isinstance(b, dict):
            continue
        try:
            x = min(1.0, max(0.0, float(b.get("x", 0))))
            y = min(1.0, max(0.0, float(b.get("y", 0))))
            w = min(1.0 - x, max(0.0, float(b.get("w", 0))))
            h = min(1.0 - y, max(0.0, float(b.get("h", 0))))
        except (TypeError, ValueError):
            continue
        if w <= 0 or h <= 0:
            continue
        out.append({
            "x": round(x, 6),
            "y": round(y, 6),
            "w": round(w, 6),
            "h": round(h, 6),
            "cls": str(b.get("cls") or "同类目标").strip() or "同类目标",
            "name": str(b.get("name") or "").strip(),
            "target": _as_bool(b.get("target")),
        })
    if sum(1 for b in out if b["target"]) > 1:
        seen = False
        for b in out:
            if b["target"]:
                b["target"] = not seen
                seen = True
    return out


def normalize(payload: dict | None) -> dict:
    """把前端扁平字段或 edit 子对象统一成稳定结构，落库前调用。"""
    raw = dict(payload or {})
    source = raw.get("edit") if isinstance(raw.get("edit"), dict) else {}

    def pick(key: str) -> Any:
        if key in raw:
            return raw[key]
        return source.get(key)

    boxes = _normalize_boxes(raw.get("boxes"))
    try:
        same_count = int(pick("same_target_count") or 0)
    except (TypeError, ValueError):
        same_count = 0
    if same_count <= 0:
        same_count = len(boxes)

    dims_raw = pick("attribute_dim") or pick("attribute_dims") or []
    if isinstance(dims_raw, str):
        dims_raw = [dims_raw]
    dims = sorted({str(d) for d in dims_raw if str(d) in ATTRIBUTE_DIMS})

    edit = {
        "edit_type": str(pick("edit_type") or "").strip(),
        "attribute_dim": dims,
        "attribute_value": str(pick("attribute_value") or "").strip(),
        "same_target_count": same_count,
        "target_locator": str(pick("target_locator") or "").strip(),
        "target_name": str(pick("target_name") or "").strip(),
        "target_category": str(pick("target_category") or "").strip(),
        "shadow_adjusted": _as_bool(pick("shadow_adjusted")),
        "instruction": str(pick("instruction") or "").strip(),
        "result_note": str(pick("result_note") or "").strip(),
    }
    for key in ("edit_type", "attribute_dim", "attribute_value", "same_target_count", "target_locator",
                "target_name", "target_category", "shadow_adjusted", "instruction", "result_note"):
        raw.pop(key, None)
    if edit["edit_type"] == "delete":
        edit["attribute_dim"] = []
        edit["attribute_value"] = ""
    raw["media_type"] = MODALITY
    raw["edit"] = edit
    raw["boxes"] = boxes
    return raw


def result_media(task_id: int) -> dict | None:
    for row in db.rows("SELECT * FROM task_media WHERE task_id=? ORDER BY id DESC", (task_id,)):
        if row.get("kind") != "image":
            continue
        meta = _json(row.get("meta"), {})
        if meta.get("role") == "result" or meta.get("source") == "result":
            return row
    return None


def validate_payload(payload: dict | None, task_id: int | None = None) -> list[dict]:
    """返回结构化问题列表；空列表表示满足规范，可提交。"""
    p = normalize(payload)
    e = p["edit"]
    boxes = p["boxes"]
    issues: list[dict] = []

    def add(field: str, message: str, level: str = "error") -> None:
        issues.append({"field": field, "message": message, "level": level})

    if e["edit_type"] not in EDIT_TYPES:
        add("edit_type", "请选择编辑类型（删除目标 / 修改属性）")
    if e["edit_type"] == "attribute":
        if not e["attribute_dim"]:
            add("attribute_dim", "修改属性需至少选择一个属性维度（颜色 / 纹理 / 尺寸 / 材质）")
        if not e["attribute_value"]:
            add("attribute_value", "修改属性需填写目标属性值，例如“改为深棕色”")

    if len(boxes) < MIN_TARGETS:
        add("boxes", f"原图同类目标不足 {MIN_TARGETS} 个（当前标注 {len(boxes)} 个）")
    if e["same_target_count"] != len(boxes):
        add("same_target_count", f"同类目标数（{e['same_target_count']}）与标注框数量（{len(boxes)}）不一致")
    if boxes and sum(1 for b in boxes if b["target"]) != 1:
        add("boxes", "请在标注框中唯一标记本次编辑的目标（仅一个目标框）")

    if e["target_category"] not in TARGET_CATEGORIES:
        add("target_category", "请选择目标类别（人物 / 动物 / 物品 / 食物）")
    if not e["target_name"]:
        add("target_name", "请填写目标描述，例如“棕色圆凳”")

    instruction = e["instruction"]
    ins_norm = _norm_text(instruction)
    name_norm = _norm_text(e["target_name"])
    if len(instruction) < MIN_INSTRUCTION:
        add("instruction", f"指令至少 {MIN_INSTRUCTION} 个字符")
    elif len(instruction) > MAX_INSTRUCTION:
        add("instruction", f"指令不超过 {MAX_INSTRUCTION} 个字符")
    if name_norm and ins_norm and name_norm not in ins_norm:
        tail = name_norm[-2:] if len(name_norm) > 2 else name_norm
        if tail not in ins_norm:
            add("instruction", f"指令中需包含目标描述“{e['target_name']}”，确保可唯一指向")
    if not e["target_locator"]:
        add("target_locator", "请填写目标定位信息（位置 / 颜色 / 序数等）")
    if not (LOCATOR.search(instruction) or ORDINAL.search(instruction) or COLOR_WORD.search(instruction)):
        add("instruction", "指令需包含定位词（位置、颜色或序数），用于唯一指向目标")

    if e["edit_type"] == "delete" and not DELETE_VERB.search(instruction):
        add("instruction", "删除类指令需包含“删除 / 移除 / 去除”等动词")
    if e["edit_type"] == "attribute" and not ATTR_VERB.search(instruction):
        add("instruction", "属性修改类指令需包含“改为 / 换成 / 放大 / 缩小”等动词")

    if not e["shadow_adjusted"]:
        add("shadow_adjusted", "需确认编辑后目标影子的调整情况（未调整将无法提交）")

    if task_id and result_media(task_id) is None:
        add("result_image", "请挂载编辑结果图（双图对照中的结果图）")
    return issues


def assert_valid(payload: dict | None, task_id: int) -> dict:
    normalized = normalize(payload)
    issues = validate_payload(normalized, task_id)
    errors = [i["message"] for i in issues if i["level"] == "error"]
    if errors:
        raise HTTPException(400, "图像编辑标注校验未通过：" + "；".join(dict.fromkeys(errors)))
    return normalized


_QUANTIFIER = "个|瓣|块|片|杯|条|朵|根|瓶|头|串|包|盒|罐|碗|盘|张|只|双|把|束|枝|粒|颗|枚|支|袋|桶|锅"
_EDIT_VERB = re.compile(
    r"(删除|删掉|移除|去掉|去除|消除|抹除|擦除|抹去|放大|缩小|增大|减小|加长|缩短|调大|调小|"
    r"改为|改成|换成|变成|调整为|调节为|修改为|替换为|复原|恢复|还原)"
)


def _clean_locator(text: str) -> str:
    s = (text or "").strip()
    s = re.sub(r"^(?:请)?(?:将|把)?(?:图[0-9一二三四五六七八九十百]*|图中|画面中|这张图|该图)?", "", s)
    s = re.sub(r"^(?:位于|在)", "", s)
    return s.strip("的 ")


def prefill_from_instruction(text: str) -> dict:
    """导入时按指令预填可推断字段，减少标注员重复劳动。"""
    instruction = (text or "").strip()
    edit = {
        "edit_type": "",
        "attribute_dim": [],
        "attribute_value": "",
        "target_locator": "",
        "target_name": "",
        "target_category": "",
        "shadow_adjusted": False,
        "instruction": instruction,
        "result_note": "",
    }
    if DELETE_VERB.search(instruction):
        edit["edit_type"] = "delete"
    elif ATTR_VERB.search(instruction):
        edit["edit_type"] = "attribute"
        if re.search(r"放大|缩小|增大|减小|加长|缩短|调大|调小", instruction):
            edit["attribute_dim"] = ["size"]
        if COLOR_WORD.search(instruction):
            edit["attribute_dim"] = sorted(set(edit["attribute_dim"] + ["color"]))
    m = re.search(r"第[一二三四五六七八九十两0-9]+(?:" + _QUANTIFIER + r")([^，。；,;]{1,16}?)" + _EDIT_VERB.pattern, instruction)
    if m:
        edit["target_name"] = m.group(1).strip("的 ")
        locator = re.split(r"[，,；;]", instruction[: m.start(1)])[-1]
        edit["target_locator"] = _clean_locator(locator)
    else:
        m = re.search(r"(?:位于|在|画面|图中)?([^，。；,;]{0,8}?)(?:的|中的|里的)([^，。；,;的]{1,12}?)" + _EDIT_VERB.pattern, instruction)
        if m:
            edit["target_locator"] = _clean_locator(m.group(1))
            edit["target_name"] = m.group(2).strip("的 ")
        else:
            # 兜底：将图1<目标描述><编辑动词>，跳过序数前缀明确的情况
            m = re.match(
                r"^(?:请)?(?:将|把)?(?:图[0-9一二三四五六七八九十百]*|图中|画面中)?"
                r"([^，。；,;]{1,20}?)" + _EDIT_VERB.pattern,
                instruction,
            )
            if m and not re.search(r"数第|^从", m.group(1)):
                edit["target_name"] = m.group(1).strip("的 ")
    return edit


# ---------------------------------------------------------------------------
# 任务 / 附件辅助
# ---------------------------------------------------------------------------

def _task(tid: int, user: dict) -> dict:
    t = db.row("SELECT * FROM tasks WHERE id=? AND deleted=0", (tid,))
    if not t:
        raise HTTPException(404, "任务不存在")
    auth.assert_task(user, t)
    return t


def _copy_into_media(path: str, ext: str, prefix: str) -> str:
    name = f"{prefix}-{uuid.uuid4().hex[:8]}{ext}"
    dest = os.path.join(db.MEDIA_DIR, name)
    shutil.move(path, dest) if path.startswith(db.TMP_DIR) else shutil.copyfile(path, dest)
    return dest


# ---------------------------------------------------------------------------
# 配置 / 校验 / 体检 / 导出接口
# ---------------------------------------------------------------------------

@router.get("/api/editing/config")
def editing_config(user: dict = Depends(me)):
    return config()


@router.post("/api/tasks/{tid}/editing/validate")
def validate_task(tid: int, body: dict, user: dict = Depends(me)):
    task = _task(tid, user)
    payload = normalize(body.get("payload") or body)
    issues = validate_payload(payload, tid)
    return {"ok": not any(i["level"] == "error" for i in issues), "issues": issues, "payload": payload}


def _audit_rows(rows: list[dict], title: str) -> dict:
    total = len(rows)
    pending_rows = [r for r in rows if r.get("pending")]
    done_rows = [r for r in rows if not r.get("pending")]
    base = len(done_rows)
    edit_types: Counter = Counter()
    categories: Counter = Counter()
    detail_types: Counter = Counter()
    attributes: Counter = Counter()
    instructions: Counter = Counter()
    issue_counts: Counter = Counter()
    issue_samples: dict[str, list] = {}
    valid = 0

    for item in done_rows:
        payload = item["payload"]
        e = payload.get("edit") or {}
        issues = validate_payload(payload, item.get("task_id"))
        errors = [i for i in issues if i["level"] == "error"]
        if not errors:
            valid += 1
        for i in errors:
            key = i["field"]
            issue_counts[key] += 1
            bucket = issue_samples.setdefault(key, [])
            if len(bucket) < 5:
                bucket.append({"task_id": item.get("task_id"), "name": item.get("name", ""), "message": i["message"]})
        if e.get("edit_type"):
            edit_types[e["edit_type"]] += 1
        if e.get("target_category"):
            categories[e["target_category"]] += 1
        name = _norm_text(e.get("target_name"))
        if name:
            detail_types[name] += 1
        for d in e.get("attribute_dim") or []:
            attributes[d] += 1
        ins = _norm_text(e.get("instruction"))
        if ins:
            instructions[ins] += 1

    def percent(n: int) -> float:
        return round(n * 100 / base, 1) if base else 0.0

    issues_out = []
    if total == 0:
        issues_out.append({
            "type": "empty",
            "level": "warning",
            "count": 0,
            "percent": 0.0,
            "message": "暂无样本数据，无法评估数据占比与规范符合度",
            "samples": [],
        })
    if pending_rows:
        issues_out.append({
            "type": "pending_annotation",
            "level": "warning",
            "count": len(pending_rows),
            "percent": percent(len(pending_rows)),
            "message": f"有 {len(pending_rows)} 条样本尚未完成标注，未计入合规统计",
            "samples": [{"task_id": r.get("task_id"), "name": r.get("name", "")} for r in pending_rows[:5]],
        })
    for key, count in issue_counts.items():
        sample = issue_samples.get(key, [])
        message = sample[0]["message"] if sample else key
        issues_out.append({
            "type": key,
            "level": "error",
            "count": count,
            "percent": percent(count),
            "message": message,
            "samples": sample,
        })

    duplicates = [{"instruction": k, "count": v} for k, v in instructions.items() if v > 1]
    if duplicates:
        issues_out.append({
            "type": "duplicate_instruction",
            "level": "error",
            "count": len(duplicates),
            "percent": percent(len(duplicates)),
            "message": f"存在 {len(duplicates)} 组重复指令，需保证每条指令唯一对应样本",
            "samples": [{"instruction": d["instruction"], "count": d["count"]} for d in duplicates[:5]],
        })

    over_limit = [
        {"name": k, "count": v, "percent": percent(v)}
        for k, v in detail_types.items() if base and v * 100 / base > SAME_TYPE_LIMIT
    ]
    if over_limit:
        small = base < 10
        issues_out.append({
            "type": "type_over_limit",
            "level": "warning" if small else "error",
            "count": len(over_limit),
            "message": f"存在 {len(over_limit)} 个细分类型占比超过 {SAME_TYPE_LIMIT}%"
                       + ("（已完成样本不足 10 条，占比仅供参考）" if small else ""),
            "samples": over_limit[:8],
        })

    category_over = [
        {"name": k, "count": v, "percent": percent(v)}
        for k, v in categories.items() if base and v * 100 / base > SAME_TYPE_LIMIT
    ]
    category_missing = [c for c in TARGET_CATEGORIES if categories.get(c, 0) == 0]
    if category_over:
        issues_out.append({
            "type": "category_over_limit",
            "level": "warning",
            "count": len(category_over),
            "message": f"{len(category_over)} 个目标大类占比超过 {SAME_TYPE_LIMIT}%，请结合规范确认统计口径",
            "samples": category_over[:8],
        })
    if base >= 10 and category_missing:
        issues_out.append({
            "type": "category_missing",
            "level": "warning",
            "count": len(category_missing),
            "message": "目标大类覆盖不全，缺少：" + "、".join(category_missing),
            "samples": [{"name": c} for c in category_missing],
        })

    penalties = {
        "boxes": 25, "same_target_count": 15, "target_category": 10, "target_name": 10,
        "instruction": 20, "target_locator": 10, "edit_type": 20, "attribute_dim": 10,
        "attribute_value": 10, "shadow_adjusted": 15, "result_image": 25,
        "duplicate_instruction": 10, "type_over_limit": 15,
    }
    deducted = 0
    for i in issues_out:
        if i["level"] == "error":
            deducted += penalties.get(i["type"], 10)
    score = max(0, 100 - deducted)
    passed = not any(i["level"] == "error" for i in issues_out)

    return {
        "title": title,
        "total": total,
        "completed": base,
        "pending": len(pending_rows),
        "valid": valid,
        "score": score,
        "passed": passed,
        "edit_types": [
            {"key": k, "label": EDIT_TYPES.get(k, k), "count": v, "percent": percent(v)}
            for k, v in edit_types.most_common()
        ],
        "attributes": [
            {"key": k, "label": ATTRIBUTE_DIMS.get(k, k), "count": v, "percent": percent(v)}
            for k, v in attributes.most_common()
        ],
        "categories": [
            {"name": k, "count": v, "percent": percent(v)} for k, v in categories.most_common()
        ],
        "category_over_limit": category_over,
        "detail_types": [
            {"name": k, "count": v, "percent": percent(v)} for k, v in detail_types.most_common(20)
        ],
        "duplicates": duplicates[:20],
        "issues": issues_out,
    }


def audit_project(pid: int, task_ids: list[int] | None = None) -> dict:
    project = _project(pid)
    tasks = db.rows("SELECT id,name FROM tasks WHERE project_id=? AND deleted=0 ORDER BY id", (pid,))
    if task_ids:
        allowed = set(task_ids)
        tasks = [t for t in tasks if t["id"] in allowed]
    rows = []
    for t in tasks:
        ann = db.row("SELECT payload,status FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (t["id"],))
        payload = normalize(_json(ann["payload"], {}) if ann else {})
        rows.append({
            "task_id": t["id"],
            "name": t["name"],
            "payload": payload,
            "pending": (not ann) or ann.get("status") not in ("submitted", "approved", "rejected"),
        })
    result = _audit_rows(rows, "图像编辑指令体检")
    result["project"] = {"id": project["id"], "name": project["name"], "code": project["code"]}
    return result


@router.get("/api/projects/{pid}/editing/audit")
def project_audit(pid: int, user: dict = Depends(me)):
    _assert_project(user, pid)
    project = _project(pid)
    if not is_editing_project(project):
        raise HTTPException(400, "该项目不是图像编辑指令项目")
    return audit_project(pid)


def _dataset(ds_id: int, user: dict) -> dict:
    ds = db.row("SELECT * FROM datasets WHERE id=?", (ds_id,))
    if not ds:
        raise HTTPException(404, "数据集不存在")
    if ds["project_id"] and not auth.is_admin(user):
        if ds["project_id"] not in auth.visible_project_ids(user):
            raise HTTPException(403, "无权访问该数据集")
    return ds


@router.get("/api/datasets/{ds_id}/editing/audit")
def dataset_audit(ds_id: int, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    ds = _dataset(ds_id, user)
    if ds["modality"] != MODALITY:
        raise HTTPException(400, "该数据集不是图像编辑指令数据集")
    latest = db.row(
        "SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds_id,)
    )
    sql = "SELECT task_id,name FROM dataset_items WHERE dataset_id=?"
    args: tuple = (ds_id,)
    if latest:
        sql += " AND version_id=?"
        args += (latest["id"],)
    items = db.rows(sql + " ORDER BY id", args)
    task_ids = [i["task_id"] for i in items if i.get("task_id")]
    if ds["project_id"]:
        result = audit_project(ds["project_id"], task_ids)
    else:
        result = _audit_rows([], "图像编辑指令体检")
    result["dataset"] = {"id": ds["id"], "name": ds["name"], "code": ds["code"], "version": latest["version"] if latest else 0}
    return result


@router.get("/api/datasets/{ds_id}/export.jsonl")
def export_jsonl(ds_id: int, version: int = 0, user: dict = Depends(me)):
    auth.require_perm(user, "dataset.read")
    ds = _dataset(ds_id, user)
    if ds["modality"] != MODALITY:
        raise HTTPException(400, "仅图像编辑指令数据集支持 JSONL 导出")
    sql = "SELECT * FROM dataset_items WHERE dataset_id=?"
    args: tuple = (ds_id,)
    if version:
        ver = db.row("SELECT * FROM dataset_versions WHERE dataset_id=? AND version=?", (ds_id, version))
        if not ver:
            raise HTTPException(404, "版本不存在")
        sql += " AND version_id=?"
        args += (ver["id"],)
    else:
        latest = db.row(
            "SELECT * FROM dataset_versions WHERE dataset_id=? ORDER BY version DESC LIMIT 1", (ds_id,)
        )
        if latest:
            sql += " AND version_id=?"
            args += (latest["id"],)
    items = db.rows(sql + " ORDER BY id", args)

    lines = []
    for it in items:
        task = db.row("SELECT * FROM tasks WHERE id=?", (it["task_id"],)) if it.get("task_id") else None
        ann = db.row(
            "SELECT payload,status FROM annotations WHERE task_id=? ORDER BY id DESC LIMIT 1", (it["task_id"],)
        ) if task else None
        payload = normalize(_json(ann["payload"], {}) if ann else {})
        edit = payload["edit"]
        boxes = payload["boxes"]
        target_box = next((b for b in boxes if b.get("target")), None)
        rm = result_media(it["task_id"]) if task else None
        source_name = os.path.basename(it["media_path"] or "")
        result_name = os.path.basename(rm["path"]) if rm else ""
        record = {
            "id": it["task_id"],
            "name": it["name"],
            "source_image": source_name,
            "source_url": f"/media/{source_name}" if source_name else "",
            "result_image": result_name,
            "result_url": f"/media/{result_name}" if result_name else "",
            "task_status": task["status"] if task else "",
            "annotation_status": ann["status"] if ann else "",
            "image_size": payload.get("img_size") or {},
            "instruction": edit["instruction"],
            "edit_type": edit["edit_type"],
            "attribute_dim": edit["attribute_dim"],
            "attribute_value": edit["attribute_value"],
            "same_target_count": edit["same_target_count"],
            "target_locator": edit["target_locator"],
            "target_name": edit["target_name"],
            "target_category": edit["target_category"],
            "shadow_adjusted": edit["shadow_adjusted"],
            "target_box": target_box,
            "boxes": boxes,
            "result_note": edit["result_note"],
            "valid": not any(i["level"] == "error" for i in validate_payload(payload, it["task_id"])),
        }
        lines.append(json.dumps(record, ensure_ascii=False))
    db.log(user["id"], "export_editing_jsonl", f"dataset:{ds_id}", f"v{version or 'latest'} · {len(lines)} 条")
    filename = f"{ds['code']}-v{version or 'latest'}.jsonl"
    return Response(
        content="\n".join(lines) + ("\n" if lines else ""),
        media_type="application/jsonl; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# 样本目录导入：原图 + 结果图 + 指令 txt
# ---------------------------------------------------------------------------

_STRIP_SUFFIXES = (
    "_result", "-result", "_output", "-output", "_out",
    "_src", "-src", "_source", "_input", "_origin", "_original", "_in",
    "_结果", "_结果图", "_结果图片", "_编辑后", "_编辑结果", "_编辑结果图", "_生成图", "_edited", "_edit", "_编辑", "_ch", "_instruction", "_指令",
    "_原图",
)


def _sample_key(filename: str) -> str:
    base = os.path.splitext(os.path.basename(filename))[0]
    changed = True
    while changed:
        changed = False
        low = base.lower()
        for suffix in _STRIP_SUFFIXES:
            if low.endswith(suffix) and len(base) > len(suffix):
                base = base[: -len(suffix)]
                changed = True
                break
        m = re.search(r"(_\d{1,2})$", base)
        if m and len(base) > len(m.group(0)):
            base = base[: -len(m.group(0))]
            changed = True
    return base


def _is_result_name(filename: str) -> bool:
    low = os.path.splitext(os.path.basename(filename))[0].lower()
    return any(x in low for x in ("result", "edited", "output", "生成图", "结果", "编辑后", "编辑图"))


def _classify_entries(entries: dict[str, str]) -> tuple[dict, list[dict]]:
    groups: dict[str, dict] = {}
    errors: list[dict] = []
    for name, path in entries.items():
        ext = os.path.splitext(name)[1].lower()
        if ext in IMAGE_EXT:
            key = _sample_key(name)
            group = groups.setdefault(key, {})
            if _is_result_name(name):
                group["result"] = (name, path)
            elif "source" not in group:
                group["source"] = (name, path)
            else:
                # 多张原图时优先 _1，其次文件名排序靠前者
                current = group["source"][0]
                if re.search(r"_1\.[^.]+$", name) and not re.search(r"_1\.[^.]+$", current):
                    group["source"] = (name, path)
        elif ext in (".txt", ".md"):
            key = _sample_key(name)
            groups.setdefault(key, {})["instruction"] = (name, path)
    for key, group in groups.items():
        if "source" not in group:
            errors.append({"sample": key, "reason": "缺少原图"})
            continue
        if "result" not in group:
            errors.append({"sample": key, "reason": "缺少结果图（文件名需包含 result）"})
        if "instruction" not in group:
            errors.append({"sample": key, "reason": "缺少指令 txt"})
    return groups, errors


def _read_instruction(path: str) -> str:
    for enc in ("utf-8-sig", "gb18030"):
        try:
            with open(path, "r", encoding=enc) as fh:
                return fh.read().strip()
        except UnicodeDecodeError:
            continue
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        return fh.read().strip()


@router.post("/api/projects/{pid}/editing/import")
async def import_samples(
    pid: int,
    files: list[UploadFile] = File(...),
    batch: str = Form(""),
    user: dict = Depends(me),
):
    project = _assert_project(user, pid, write=True)
    if not is_editing_project(project):
        raise HTTPException(400, "仅图像编辑指令项目支持样本目录导入")
    batch = batch or f"图像编辑导入 {db.now()[:10]}"

    entries: dict[str, str] = {}
    tmp_paths: list[str] = []
    try:
        for f in files:
            ext = os.path.splitext(f.filename or "")[1].lower()
            raw = os.path.join(db.TMP_DIR, f"ed-{uuid.uuid4().hex}{ext or '.bin'}")
            with open(raw, "wb") as out:
                shutil.copyfileobj(f.file, out)
            tmp_paths.append(raw)
            if ext == ".zip":
                try:
                    with zipfile.ZipFile(raw) as zf:
                        for info in zf.infolist():
                            if info.is_dir() or os.path.basename(info.filename).startswith((".", "__MACOSX")):
                                continue
                            inner_ext = os.path.splitext(info.filename)[1].lower()
                            if inner_ext not in IMAGE_EXT | {".txt", ".md"}:
                                continue
                            out = os.path.join(db.TMP_DIR, f"edz-{uuid.uuid4().hex}{inner_ext}")
                            with zf.open(info) as src, open(out, "wb") as dst:
                                shutil.copyfileobj(src, dst)
                            tmp_paths.append(out)
                            entries[os.path.basename(info.filename)] = out
                except zipfile.BadZipFile:
                    raise HTTPException(400, f"压缩包损坏：{f.filename}")
            else:
                entries[os.path.basename(f.filename or raw)] = raw

        groups, errors = _classify_entries(entries)
        if not groups:
            raise HTTPException(400, "未识别到样本（需原图 + 结果图 + 指令 txt）")

        existing = {
            r["name"] for r in db.rows("SELECT name FROM tasks WHERE project_id=? AND deleted=0", (pid,))
        }
        created, skipped = [], []
        for key in sorted(groups):
            group = groups[key]
            if "source" not in group:
                continue
            if key in existing:
                skipped.append({"sample": key, "reason": "同名任务已存在"})
                continue
            source_name, source_path = group["source"]
            dest = _copy_into_media(source_path, os.path.splitext(source_name)[1].lower(), project["code"])
            instruction = ""
            if group.get("instruction"):
                instruction = _read_instruction(group["instruction"][1])
            tid = db.execute(
                "INSERT INTO tasks(project_id,name,media_path,media_type,duration,status,priority,batch,source,"
                "created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (pid, key, dest, "image", 0, "pending", "normal", batch, "editing_import", db.now(), db.now()),
            )
            if group.get("result"):
                rname, rpath = group["result"]
                rdest = _copy_into_media(rpath, os.path.splitext(rname)[1].lower(), f"{project['code']}-res")
                meta = {"source": "result", "role": "result", "original": rname,
                        "size": os.path.getsize(rdest)}
                db.execute(
                    "INSERT INTO task_media(task_id,kind,path,name,meta,created_at) VALUES(?,?,?,?,?,?)",
                    (tid, "image", rdest, os.path.basename(rdest), json.dumps(meta, ensure_ascii=False), db.now()),
                )
            edit = prefill_from_instruction(instruction)
            payload = normalize({"edit": edit, "boxes": []})
            db.execute(
                "INSERT INTO annotations(task_id,user_id,payload,prelabel,status,version,created_at,updated_at)"
                " VALUES(?,?,?,?,?,?,?,?)",
                (tid, user["id"], json.dumps(payload, ensure_ascii=False), "{}", "draft", 1, db.now(), db.now()),
            )
            created.append({"task_id": tid, "sample": key, "instruction": instruction[:60]})

        db.log(user["id"], "import_editing_samples", f"project:{pid}", f"{len(created)} 个样本 · {batch}")
        return {
            "ok": True,
            "created": len(created),
            "skipped": len(skipped),
            "errors": errors,
            "tasks": created,
            "batch": batch,
        }
    finally:
        for path in tmp_paths:
            try:
                os.remove(path)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# 启动种子：确保内置模板与标签体系存在
# ---------------------------------------------------------------------------

def seed() -> None:
    ts = db.now()
    tpl = db.row("SELECT id FROM templates WHERE code='tpl-image-editing'")
    if not tpl:
        db.execute(
            "INSERT INTO templates(code,name,modality,description,label_config,qc_config,instruction,builtin,created_at)"
            " VALUES(?,?,?,?,?,?,?,?,?)",
            (
                "tpl-image-editing",
                "图像编辑指令模板",
                MODALITY,
                "基于原图与编辑结果图的双图对照标注：删除目标 / 修改属性，校验同类目标数、定位词与影子调整。",
                json.dumps(db.DEFAULT_LABELS.get(MODALITY, {}), ensure_ascii=False),
                json.dumps({"sample_rate": 100, "min_score": 90, "max_rework": 2, "require_comment": True},
                           ensure_ascii=False),
                "在原图标注全部同类目标（≥3）并唯一标记编辑目标；填写编辑类型、属性维度、定位信息并确认影子调整。",
                1,
                ts,
            ),
        )
    if not db.row("SELECT id FROM label_sets WHERE code='ls-editing'"):
        db.execute(
            "INSERT OR IGNORE INTO label_sets(code,name,modality,labels,description,created_by,created_at,updated_at)"
            " VALUES(?,?,?,?,?,?,?,?)",
            ("ls-editing", "图像编辑指令默认标签集", MODALITY,
             json.dumps(db.DEFAULT_LABELS.get(MODALITY, {}), ensure_ascii=False),
             "内置标签库，覆盖编辑类型、属性维度与目标大类。", None, ts, ts),
        )
