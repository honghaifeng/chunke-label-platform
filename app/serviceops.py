"""运营服务：运营月报、服务工单与 SLA、保密协议台账、培训课程与考核记录。

对应运营商 / 政府类数据标注运营项目的交付要求：
1. 按月输出吞吐、质量、返修、产能与 SLA 达成情况；
2. 维护服务可登记、分派、响应与闭环，并按 SLA 统计；
3. 从业人员保密协议签署状态可追溯、可提醒；
4. 培训课程、参训与考核记录可沉淀，作为交付证据。
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from . import auth, db, ops

router = APIRouter()

TICKET_CATEGORIES = {"data": "数据问题", "system": "系统故障", "training": "培训支持", "other": "其他"}
TICKET_PRIORITIES = {"low": "低", "normal": "普通", "high": "高", "urgent": "紧急"}
TICKET_STATUS = {"open": "待响应", "processing": "处理中", "resolved": "已解决", "closed": "已关闭"}
AGREEMENT_STATUS = {"active": "有效", "expired": "已过期", "revoked": "已撤销"}
TRAINING_STATUS = {"assigned": "待完成", "completed": "已完成"}


def me(request: Request) -> dict:
    return auth.current_user(request)


def _project(pid: int) -> dict:
    p = db.row("SELECT * FROM projects WHERE id=?", (pid,))
    if not p:
        raise HTTPException(404, "项目不存在")
    return p


def _tenant_admin_of(user: dict, project: dict | None) -> bool:
    return bool(
        project
        and user.get("platform_role") == "tenant_admin"
        and user.get("tenant_id")
        and project.get("tenant_id") == user["tenant_id"]
    )


def _readable(user: dict, pid: int) -> dict:
    p = _project(pid)
    if auth.is_admin(user) or _tenant_admin_of(user, p):
        return p
    if pid not in auth.visible_project_ids(user):
        raise HTTPException(403, "无权访问该项目")
    return p


def _manage(user: dict, pid: int) -> dict:
    p = _readable(user, pid)
    if auth.is_admin(user) or _tenant_admin_of(user, p) or auth.project_role(user, pid) == "manager":
        return p
    raise HTTPException(403, "仅项目管理者可执行该操作")


def _manage_global(user: dict) -> None:
    if auth.is_admin(user) or user.get("platform_role") == "tenant_admin":
        return
    if any(auth.project_role(user, pid) == "manager" for pid in auth.visible_project_ids(user)):
        return
    raise HTTPException(403, "仅项目管理者可执行该操作")


def _month_range(month: str | None) -> tuple[str, str, str]:
    value = (month or datetime.now().strftime("%Y-%m")).strip()
    try:
        start = datetime.strptime(value + "-01", "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "月份格式应为 YYYY-MM")
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return value, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def _rate(part: int | float | None, total: int | float | None) -> float:
    total = float(total or 0)
    if total <= 0:
        return 0.0
    return round(float(part or 0) * 100.0 / total, 1)


def _int(value) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def _agreement_state(row: dict) -> dict:
    item = dict(row)
    today = datetime.now().strftime("%Y-%m-%d")
    if item.get("status") == "active" and item.get("expires_at") and item["expires_at"] < today:
        item["status"] = "expired"
    item["expires_soon"] = bool(
        item.get("status") == "active"
        and item.get("expires_at")
        and item["expires_at"] <= (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    )
    return item


def _ticket_state(row: dict) -> dict:
    item = dict(row)
    item["category_label"] = TICKET_CATEGORIES.get(item.get("category"), item.get("category") or "")
    item["priority_label"] = TICKET_PRIORITIES.get(item.get("priority"), item.get("priority") or "")
    item["status_label"] = TICKET_STATUS.get(item.get("status"), item.get("status") or "")
    item["sla_met"] = None
    if item.get("resolved_at"):
        try:
            spent = (
                datetime.strptime(item["resolved_at"], "%Y-%m-%d %H:%M:%S")
                - datetime.strptime(item["created_at"], "%Y-%m-%d %H:%M:%S")
            ).total_seconds() / 3600.0
            item["sla_met"] = spent <= float(item.get("sla_hours") or 0)
            item["spent_hours"] = round(spent, 2)
        except (TypeError, ValueError):
            pass
    return item


# ---------------------------------------------------------------------------
# 运营月报
# ---------------------------------------------------------------------------

def _build_report(user: dict, pid: int, month: str | None) -> dict:
    project = _readable(user, pid)
    m, start, end = _month_range(month)

    task_total = db.row(
        "SELECT COUNT(*) c FROM tasks WHERE project_id=? AND deleted=0 AND created_at>=? AND created_at<?",
        (pid, start, end),
    )["c"]
    task_done = db.row(
        "SELECT COUNT(*) c FROM tasks WHERE project_id=? AND deleted=0 AND status='done'"
        " AND updated_at>=? AND updated_at<?",
        (pid, start, end),
    )["c"]
    qc = db.row(
        "SELECT COUNT(*) c, SUM(CASE WHEN r.result='approved' THEN 1 ELSE 0 END) a, AVG(r.score) s"
        " FROM qc_records r JOIN tasks t ON t.id=r.task_id"
        " WHERE t.project_id=? AND t.deleted=0 AND r.created_at>=? AND r.created_at<?",
        (pid, start, end),
    ) or {}
    qc_total = _int(qc.get("c"))
    qc_approved = _int(qc.get("a"))
    avg_score = round(float(qc.get("s") or 0), 1)

    production = db.rows(
        "SELECT u.name, u.username, COUNT(DISTINCT a.task_id) tasks"
        " FROM annotations a JOIN tasks t ON t.id=a.task_id JOIN users u ON u.id=a.user_id"
        " WHERE t.project_id=? AND t.deleted=0 AND a.status IN ('submitted','approved')"
        " AND a.updated_at>=? AND a.updated_at<?"
        " GROUP BY a.user_id ORDER BY tasks DESC",
        (pid, start, end),
    )

    ticket = db.row(
        "SELECT COUNT(*) total,"
        " SUM(CASE WHEN status IN ('resolved','closed') THEN 1 ELSE 0 END) resolved,"
        " SUM(CASE WHEN resolved_at IS NOT NULL"
        "   AND (julianday(resolved_at)-julianday(created_at))*24 <= sla_hours THEN 1 ELSE 0 END) sla_ok"
        " FROM service_tickets WHERE project_id=? AND created_at>=? AND created_at<?",
        (pid, start, end),
    ) or {}
    ticket_total = _int(ticket.get("total"))
    ticket_resolved = _int(ticket.get("resolved"))
    sla_ok = _int(ticket.get("sla_ok"))

    members = db.row("SELECT COUNT(*) c FROM project_members WHERE project_id=?", (pid,))["c"]
    today = datetime.now().strftime("%Y-%m-%d")
    signed = db.row(
        "SELECT COUNT(DISTINCT user_id) c FROM confidentiality_agreements"
        " WHERE (project_id=? OR project_id IS NULL) AND status='active'"
        " AND (expires_at='' OR expires_at>=?)",
        (pid, today),
    )["c"]

    train = db.row(
        "SELECT COUNT(*) total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) done FROM training_records"
    ) or {}

    kpis = {
        "task_total": task_total,
        "task_done": task_done,
        "qc_total": qc_total,
        "qc_pass_rate": _rate(qc_approved, qc_total),
        "rework_rate": _rate(qc_total - qc_approved, qc_total),
        "avg_score": avg_score,
        "ticket_total": ticket_total,
        "ticket_resolved": ticket_resolved,
        "ticket_sla_rate": _rate(sla_ok, ticket_resolved),
        "member_total": members,
        "agreement_signed": signed,
        "agreement_rate": _rate(signed, members),
        "training_total": _int(train.get("total")),
        "training_done": _int(train.get("done")),
        "training_rate": _rate(train.get("done"), train.get("total")),
    }
    return {
        "month": m,
        "project": {"id": project["id"], "name": project["name"]},
        "kpis": kpis,
        "production": production,
        "generated_at": db.now(),
    }


@router.get("/api/service/report")
def service_report(project_id: int = 0, month: str = "", user: dict = Depends(me)):
    if not project_id:
        raise HTTPException(400, "请选择项目")
    return _build_report(user, project_id, month)


@router.get("/api/service/report.csv")
def service_report_csv(project_id: int = 0, month: str = "", user: dict = Depends(me)):
    if not project_id:
        raise HTTPException(400, "请选择项目")
    report = _build_report(user, project_id, month)
    k = report["kpis"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["运营服务月报"])
    writer.writerow(["项目", report["project"]["name"]])
    writer.writerow(["月份", report["month"]])
    writer.writerow(["生成时间", report["generated_at"]])
    writer.writerow([])
    writer.writerow(["指标", "数值", "单位"])
    for label, key, unit in [
        ("新增任务量", "task_total", "条"),
        ("完成任务量", "task_done", "条"),
        ("质检量", "qc_total", "条"),
        ("质检通过率", "qc_pass_rate", "%"),
        ("返修率", "rework_rate", "%"),
        ("平均质检得分", "avg_score", "分"),
        ("服务工单数", "ticket_total", "单"),
        ("工单已解决", "ticket_resolved", "单"),
        ("SLA 按时率", "ticket_sla_rate", "%"),
        ("项目成员数", "member_total", "人"),
        ("保密协议已签", "agreement_signed", "人"),
        ("保密协议覆盖率", "agreement_rate", "%"),
        ("培训记录数", "training_total", "条"),
        ("培训完成数", "training_done", "条"),
        ("培训完成率", "training_rate", "%"),
    ]:
        writer.writerow([label, k.get(key, 0), unit])
    writer.writerow([])
    writer.writerow(["人员产能"])
    writer.writerow(["姓名", "账号", "提交任务数"])
    for p in report["production"]:
        writer.writerow([p["name"], p["username"], p["tasks"]])
    content = "\ufeff" + buf.getvalue()
    return Response(
        content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="service-report-{report["month"]}.csv"'},
    )


# ---------------------------------------------------------------------------
# 服务工单与 SLA
# ---------------------------------------------------------------------------

@router.get("/api/service/tickets")
def list_tickets(project_id: int = 0, status: str = "", user: dict = Depends(me)):
    if project_id:
        _readable(user, project_id)
        where, args = "WHERE t.project_id=?", (project_id,)
    else:
        ids = auth.visible_project_ids(user)
        if not ids:
            return {"tickets": [], "summary": {"total": 0, "open": 0, "sla_rate": 0}}
        marks = ",".join("?" * len(ids))
        where, args = f"WHERE t.project_id IN ({marks})", tuple(ids)
    if status:
        where += " AND t.status=?"
        args = args + (status,)
    rows = db.rows(
        "SELECT t.*, ru.name requester_name, au.name assignee_name FROM service_tickets t"
        " LEFT JOIN users ru ON ru.id=t.requester_id LEFT JOIN users au ON au.id=t.assignee_id"
        f" {where} ORDER BY t.id DESC LIMIT 200",
        args,
    )
    tickets = [_ticket_state(r) for r in rows]
    resolved = [x for x in tickets if x.get("resolved_at")]
    return {
        "tickets": tickets,
        "summary": {
            "total": len(tickets),
            "open": len([x for x in tickets if x["status"] in ("open", "processing")]),
            "sla_rate": _rate(len([x for x in resolved if x.get("sla_met")]), len(resolved)),
        },
    }


@router.post("/api/service/tickets")
def create_ticket(body: dict, user: dict = Depends(me)):
    pid = _int(body.get("project_id"))
    if not pid:
        raise HTTPException(400, "请选择项目")
    _readable(user, pid)
    title = str(body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "请填写工单标题")
    category = body.get("category") if body.get("category") in TICKET_CATEGORIES else "other"
    priority = body.get("priority") if body.get("priority") in TICKET_PRIORITIES else "normal"
    sla_hours = max(1, _int(body.get("sla_hours")) or 24)
    ts = db.now()
    tid = db.execute(
        "INSERT INTO service_tickets(project_id,title,category,priority,status,requester_id,sla_hours,detail,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?)",
        (pid, title, category, priority, "open", user["id"], sla_hours, str(body.get("detail") or "").strip(), ts, ts),
    )
    db.log(user["id"], "service_ticket_create", f"ticket:{tid}", title)
    return {"ok": True, "id": tid}


@router.patch("/api/service/tickets/{tid}")
def update_ticket(tid: int, body: dict, user: dict = Depends(me)):
    ticket = db.row("SELECT * FROM service_tickets WHERE id=?", (tid,))
    if not ticket:
        raise HTTPException(404, "工单不存在")
    _manage(user, ticket["project_id"])
    fields: dict = {}
    if "status" in body:
        status = str(body.get("status") or "")
        if status not in TICKET_STATUS:
            raise HTTPException(400, "非法工单状态")
        fields["status"] = status
        if status == "processing" and not ticket.get("responded_at"):
            fields["responded_at"] = db.now()
        if status in ("resolved", "closed"):
            fields["resolved_at"] = ticket.get("resolved_at") or db.now()
        if status in ("open", "processing"):
            fields["resolved_at"] = None
    if "assignee_id" in body:
        uid = _int(body.get("assignee_id"))
        if uid and not db.row("SELECT id FROM users WHERE id=?", (uid,)):
            raise HTTPException(400, "指派用户不存在")
        fields["assignee_id"] = uid or None
    if "resolution" in body:
        fields["resolution"] = str(body.get("resolution") or "").strip()
    if "sla_hours" in body:
        fields["sla_hours"] = max(1, _int(body.get("sla_hours")) or 24)
    if "priority" in body and body.get("priority") in TICKET_PRIORITIES:
        fields["priority"] = body["priority"]
    if fields.get("status") in ("resolved", "closed"):
        resolution = fields.get("resolution", ticket.get("resolution") or "").strip()
        if not resolution:
            raise HTTPException(400, "关闭工单前请填写处理结论")
    if not fields:
        raise HTTPException(400, "没有可更新的字段")
    fields["updated_at"] = db.now()
    sets = ",".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE service_tickets SET {sets} WHERE id=?", tuple(fields.values()) + (tid,))
    db.log(user["id"], "service_ticket_update", f"ticket:{tid}", ",".join(fields.keys()))
    return {"ok": True, "ticket": _ticket_state(db.row("SELECT * FROM service_tickets WHERE id=?", (tid,)))}


# ---------------------------------------------------------------------------
# 保密协议台账
# ---------------------------------------------------------------------------

@router.get("/api/service/agreements")
def list_agreements(project_id: int = 0, user: dict = Depends(me)):
    if project_id:
        project = _readable(user, project_id)
        member_rows = db.rows(
            "SELECT u.id, u.name, u.username, m.project_role FROM project_members m"
            " JOIN users u ON u.id=m.user_id WHERE m.project_id=? ORDER BY u.id",
            (project_id,),
        )
        where, args = "(a.project_id=? OR a.project_id IS NULL)", (project_id,)
    else:
        project = None
        tenant = user.get("tenant_id")
        member_rows = db.rows(
            "SELECT id, name, username, platform_role project_role FROM users"
            " WHERE status='active' AND (tenant_id=? OR tenant_id IS NULL) ORDER BY id",
            (tenant,) if tenant else (0,),
        ) if tenant else db.rows(
            "SELECT id, name, username, platform_role project_role FROM users WHERE status='active' ORDER BY id"
        )
        where, args = "1=1", ()
    rows = db.rows(
        "SELECT a.*, u.name user_name, u.username FROM confidentiality_agreements a"
        f" JOIN users u ON u.id=a.user_id WHERE {where} ORDER BY a.id DESC",
        args,
    )
    items = [_agreement_state(r) for r in rows]
    covered = {x["user_id"] for x in items if x["status"] == "active"}
    for m in member_rows:
        m["signed"] = m["id"] in covered
    today = datetime.now().strftime("%Y-%m-%d")
    return {
        "project": {"id": project["id"], "name": project["name"]} if project else None,
        "agreements": items,
        "members": member_rows,
        "summary": {
            "member_total": len(member_rows),
            "signed": len(covered),
            "coverage": _rate(len(covered), len(member_rows)),
            "expiring": len([x for x in items if x["expires_soon"]]),
            "expired": len([x for x in items if x["status"] == "expired"]),
            "today": today,
        },
    }


@router.post("/api/service/agreements")
def create_agreement(body: dict, user: dict = Depends(me)):
    pid = _int(body.get("project_id"))
    if pid:
        _manage(user, pid)
    else:
        _manage_global(user)
    uid = _int(body.get("user_id"))
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(400, "用户不存在")
    signed_at = str(body.get("signed_at") or "").strip() or datetime.now().strftime("%Y-%m-%d")
    expires_at = str(body.get("expires_at") or "").strip() or (
        datetime.now() + timedelta(days=365)
    ).strftime("%Y-%m-%d")
    ts = db.now()
    aid = db.execute(
        "INSERT INTO confidentiality_agreements(user_id,project_id,agreement_no,signed_at,expires_at,status,note,"
        "created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        (
            uid,
            pid or None,
            str(body.get("agreement_no") or "").strip(),
            signed_at,
            expires_at,
            "active",
            str(body.get("note") or "").strip(),
            user["id"],
            ts,
            ts,
        ),
    )
    db.log(user["id"], "agreement_create", f"agreement:{aid}", f"user:{uid}")
    return {"ok": True, "id": aid}


@router.patch("/api/service/agreements/{aid}")
def update_agreement(aid: int, body: dict, user: dict = Depends(me)):
    item = db.row("SELECT * FROM confidentiality_agreements WHERE id=?", (aid,))
    if not item:
        raise HTTPException(404, "协议记录不存在")
    if item.get("project_id"):
        _manage(user, item["project_id"])
    else:
        _manage_global(user)
    fields: dict = {}
    if "status" in body:
        status = str(body.get("status") or "")
        if status not in AGREEMENT_STATUS:
            raise HTTPException(400, "非法协议状态")
        fields["status"] = status
    if "expires_at" in body:
        fields["expires_at"] = str(body.get("expires_at") or "").strip()
    if "note" in body:
        fields["note"] = str(body.get("note") or "").strip()
    if not fields:
        raise HTTPException(400, "没有可更新的字段")
    fields["updated_at"] = db.now()
    sets = ",".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE confidentiality_agreements SET {sets} WHERE id=?", tuple(fields.values()) + (aid,))
    db.log(user["id"], "agreement_update", f"agreement:{aid}", ",".join(fields.keys()))
    return {"ok": True}


# ---------------------------------------------------------------------------
# 培训课程与考核记录
# ---------------------------------------------------------------------------

@router.get("/api/service/training")
def list_training(user: dict = Depends(me)):
    _manage_global(user)
    courses = db.rows(
        "SELECT c.*, COUNT(r.id) assigned,"
        " SUM(CASE WHEN r.status='completed' THEN 1 ELSE 0 END) completed,"
        " AVG(CASE WHEN r.score>0 THEN r.score END) avg_score"
        " FROM training_courses c LEFT JOIN training_records r ON r.course_id=c.id"
        " GROUP BY c.id ORDER BY c.id DESC"
    )
    for c in courses:
        c["assigned"] = _int(c.get("assigned"))
        c["completed"] = _int(c.get("completed"))
        c["avg_score"] = round(float(c.get("avg_score") or 0), 1)
        c["rate"] = _rate(c["completed"], c["assigned"])
        c["modality_label"] = db.MODALITY_LABEL.get(c.get("modality"), c.get("modality") or "通用")
    records = db.rows(
        "SELECT r.*, u.name user_name, u.username, c.title course_title FROM training_records r"
        " JOIN users u ON u.id=r.user_id JOIN training_courses c ON c.id=r.course_id"
        " ORDER BY r.id DESC LIMIT 300"
    )
    for r in records:
        r["status_label"] = TRAINING_STATUS.get(r.get("status"), r.get("status") or "")
    total = len(records)
    done = len([r for r in records if r["status"] == "completed"])
    return {
        "courses": courses,
        "records": records,
        "summary": {"total": total, "completed": done, "rate": _rate(done, total)},
    }


@router.post("/api/service/training/courses")
def create_course(body: dict, user: dict = Depends(me)):
    _manage_global(user)
    title = str(body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "请填写课程名称")
    modality = str(body.get("modality") or "").strip()
    if modality and modality not in db.MODALITY_LABEL:
        raise HTTPException(400, "非法数据模态")
    ts = db.now()
    cid = db.execute(
        "INSERT INTO training_courses(title,modality,description,duration_min,status,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?)",
        (
            title,
            modality,
            str(body.get("description") or "").strip(),
            max(0, _int(body.get("duration_min"))),
            "active",
            user["id"],
            ts,
            ts,
        ),
    )
    db.log(user["id"], "training_course_create", f"course:{cid}", title)
    return {"ok": True, "id": cid}


@router.post("/api/service/training/records")
def create_training_record(body: dict, user: dict = Depends(me)):
    _manage_global(user)
    cid = _int(body.get("course_id"))
    uid = _int(body.get("user_id"))
    if not db.row("SELECT id FROM training_courses WHERE id=?", (cid,)):
        raise HTTPException(400, "课程不存在")
    if not db.row("SELECT id FROM users WHERE id=?", (uid,)):
        raise HTTPException(400, "用户不存在")
    status = body.get("status") if body.get("status") in TRAINING_STATUS else "assigned"
    ts = db.now()
    rid = db.execute(
        "INSERT INTO training_records(course_id,user_id,status,score,note,completed_at,created_by,created_at,updated_at)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (
            cid,
            uid,
            status,
            max(0.0, min(100.0, float(body.get("score") or 0))),
            str(body.get("note") or "").strip(),
            ts if status == "completed" else None,
            user["id"],
            ts,
            ts,
        ),
    )
    db.log(user["id"], "training_record_create", f"record:{rid}", f"user:{uid}")
    return {"ok": True, "id": rid}


@router.patch("/api/service/training/records/{rid}")
def update_training_record(rid: int, body: dict, user: dict = Depends(me)):
    _manage_global(user)
    item = db.row("SELECT * FROM training_records WHERE id=?", (rid,))
    if not item:
        raise HTTPException(404, "培训记录不存在")
    fields: dict = {}
    if "status" in body:
        status = str(body.get("status") or "")
        if status not in TRAINING_STATUS:
            raise HTTPException(400, "非法培训状态")
        fields["status"] = status
        fields["completed_at"] = db.now() if status == "completed" else None
    if "score" in body:
        fields["score"] = max(0.0, min(100.0, float(body.get("score") or 0)))
    if "note" in body:
        fields["note"] = str(body.get("note") or "").strip()
    if not fields:
        raise HTTPException(400, "没有可更新的字段")
    fields["updated_at"] = db.now()
    sets = ",".join(f"{k}=?" for k in fields)
    db.execute(f"UPDATE training_records SET {sets} WHERE id=?", tuple(fields.values()) + (rid,))
    db.log(user["id"], "training_record_update", f"record:{rid}", ",".join(fields.keys()))
    return {"ok": True}


# ------------------------------------------------------------------ 结算中心
SETTLE_STATUS = {"draft": "草稿", "confirmed": "已确认", "paid": "已支付"}


def _billable_rows(project_id: int, period_start: str, period_end: str) -> list[dict]:
    """已交付（done，最新验收非驳回）且未被任何结算单锁定的任务，按验收时间过滤。"""
    args: list = [project_id]
    period = ""
    if period_start:
        period += " AND COALESCE(a.created_at,t.updated_at)>=?"
        args.append(period_start.strip() + (" 00:00:00" if len(period_start.strip()) == 10 else ""))
    if period_end:
        period += " AND COALESCE(a.created_at,t.updated_at)<=?"
        args.append(period_end.strip() + (" 23:59:59" if len(period_end.strip()) == 10 else ""))
    return db.rows(
        "SELECT t.id,t.name,t.est_minutes,COALESCE(a.created_at,t.updated_at) accepted_at FROM tasks t"
        " LEFT JOIN acceptance_records a ON a.task_id=t.id"
        " AND a.id=(SELECT MAX(id) FROM acceptance_records WHERE task_id=t.id)"
        " WHERE t.project_id=? AND t.status='done' AND t.deleted=0"
        " AND (a.result IS NULL OR a.result='approved')" + period +
        " AND NOT EXISTS(SELECT 1 FROM settlement_items si WHERE si.task_id=t.id)"
        " ORDER BY a.created_at",
        tuple(args),
    )


def _unit_price(explicit: float | None = None) -> tuple[str, float]:
    mode = ops.get_setting("billing.mode", "per_item") or "per_item"
    if explicit and explicit > 0:
        return mode, float(explicit)
    if mode == "per_hour":
        return mode, float(ops.get_setting("billing.price_per_hour", "25") or 25)
    return mode, float(ops.get_setting("billing.price_per_k", "12") or 12)


@router.get("/api/settlements/preview")
def settle_preview(project_id: int, period_start: str = "", period_end: str = "", user: dict = Depends(me)):
    p = _manage(user, project_id)
    items = _billable_rows(project_id, period_start, period_end)
    mode, unit = _unit_price()
    return {
        "project": {"id": p["id"], "name": p["name"]},
        "items": items,
        "count": len(items),
        "mode": mode,
        "unit_price": unit,
        "minutes": round(sum(float(x.get("est_minutes") or 0) for x in items), 2),
    }


@router.get("/api/settlements")
def settle_list(project_id: int = 0, user: dict = Depends(me)):
    if user["platform_role"] not in ("platform_admin", "tenant_admin", "project_manager"):
        raise HTTPException(403, "仅管理类角色可查看结算")
    ids = auth.visible_project_ids(user)
    if not ids:
        return {"settlements": []}
    marks = ",".join("?" * len(ids))
    cond = f"s.project_id IN ({marks})"
    args: list = list(ids)
    if project_id:
        cond += " AND s.project_id=?"
        args.append(project_id)
    rows_ = db.rows(
        "SELECT s.*, p.name project_name, u.name creator_name FROM settlements s"
        " JOIN projects p ON p.id=s.project_id LEFT JOIN users u ON u.id=s.created_by"
        f" WHERE {cond} ORDER BY s.id DESC LIMIT 200",
        tuple(args),
    )
    for r in rows_:
        r["status_label"] = SETTLE_STATUS.get(r["status"], r["status"])
    return {"settlements": rows_}


@router.post("/api/settlements")
def settle_create(body: dict, user: dict = Depends(me)):
    pid = int(body.get("project_id") or 0)
    p = _manage(user, pid)
    period_start = str(body.get("period_start") or "").strip()
    period_end = str(body.get("period_end") or "").strip()
    task_ids = [int(x) for x in (body.get("task_ids") or [])]
    billable = _billable_rows(pid, period_start, period_end)
    if task_ids:
        billable = [x for x in billable if x["id"] in task_ids]
    if not billable:
        raise HTTPException(400, "所选周期内没有可结算的已验收任务（或均已在其他结算单中）")
    mode, unit = _unit_price(float(body.get("unit_price") or 0) or None)
    minutes = round(sum(float(x.get("est_minutes") or 0) for x in billable), 2)
    amount = round(minutes * unit, 2) if mode == "per_hour" else round(len(billable) * unit / 1000.0, 2)
    seq = int(db.row("SELECT COUNT(*) c FROM settlements")["c"]) + 1
    code = "ST" + db.now()[:10].replace("-", "") + str(pid).zfill(3) + str(seq).zfill(3)
    sid = db.execute(
        "INSERT INTO settlements(code,project_id,title,period_start,period_end,item_count,unit_price,amount,mode,status,remark,created_by,created_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,'draft',?,?,?)",
        (code, pid, str(body.get("title") or f"{p['name']} 结算"), period_start, period_end,
         len(billable), unit, amount, mode, str(body.get("remark") or ""), user["id"], db.now()),
    )
    try:
        for x in billable:
            db.execute(
                "INSERT INTO settlement_items(settlement_id,task_id,task_name,accepted_at,minutes) VALUES(?,?,?,?,?)",
                (sid, x["id"], x["name"], x["accepted_at"], float(x.get("est_minutes") or 0)),
            )
    except Exception:
        db.execute("DELETE FROM settlement_items WHERE settlement_id=?", (sid,))
        db.execute("DELETE FROM settlements WHERE id=?", (sid,))
        raise
    db.log(user["id"], "settlement_create", f"settlement:{sid}", f"{code} {len(billable)} 项 ¥{amount}")
    return {"ok": True, "id": sid, "code": code, "amount": amount, "count": len(billable)}


@router.get("/api/settlements/{sid}")
def settle_detail(sid: int, user: dict = Depends(me)):
    if user["platform_role"] not in ("platform_admin", "tenant_admin", "project_manager"):
        raise HTTPException(403, "仅管理类角色可查看结算")
    s = db.row(
        "SELECT s.*, p.name project_name, u.name creator_name FROM settlements s"
        " JOIN projects p ON p.id=s.project_id LEFT JOIN users u ON u.id=s.created_by WHERE s.id=?",
        (sid,),
    )
    if not s:
        raise HTTPException(404, "结算单不存在")
    if s["project_id"] not in auth.visible_project_ids(user) and not auth.is_admin(user):
        raise HTTPException(403, "无权查看该结算单")
    items = db.rows("SELECT * FROM settlement_items WHERE settlement_id=? ORDER BY accepted_at", (sid,))
    return {"settlement": s, "items": items, "status_label": SETTLE_STATUS.get(s["status"], s["status"])}


@router.post("/api/settlements/{sid}/confirm")
def settle_confirm(sid: int, user: dict = Depends(me)):
    s = db.row("SELECT * FROM settlements WHERE id=?", (sid,))
    if not s:
        raise HTTPException(404, "结算单不存在")
    _manage(user, s["project_id"])
    if s["status"] != "draft":
        raise HTTPException(400, "仅草稿状态可确认")
    db.execute("UPDATE settlements SET status='confirmed', confirmed_at=? WHERE id=?", (db.now(), sid))
    db.log(user["id"], "settlement_confirm", f"settlement:{sid}", s["code"])
    return {"ok": True, "status": "confirmed"}


@router.post("/api/settlements/{sid}/pay")
def settle_pay(sid: int, body: dict, user: dict = Depends(me)):
    s = db.row("SELECT * FROM settlements WHERE id=?", (sid,))
    if not s:
        raise HTTPException(404, "结算单不存在")
    if not (auth.is_admin(user) or user.get("platform_role") == "tenant_admin"):
        raise HTTPException(403, "仅平台/租户管理员可执行支付")
    if s["status"] != "confirmed":
        raise HTTPException(400, "仅已确认的结算单可支付")
    db.execute(
        "UPDATE settlements SET status='paid', paid_at=?, remark=? WHERE id=?",
        (db.now(), str(body.get("remark") or s["remark"] or ""), sid),
    )
    db.log(user["id"], "settlement_pay", f"settlement:{sid}", s["code"])
    return {"ok": True, "status": "paid"}


@router.delete("/api/settlements/{sid}")
def settle_delete(sid: int, user: dict = Depends(me)):
    s = db.row("SELECT * FROM settlements WHERE id=?", (sid,))
    if not s:
        raise HTTPException(404, "结算单不存在")
    _manage(user, s["project_id"])
    if s["status"] != "draft":
        raise HTTPException(400, "仅草稿状态可删除")
    db.execute("DELETE FROM settlement_items WHERE settlement_id=?", (sid,))
    db.execute("DELETE FROM settlements WHERE id=?", (sid,))
    db.log(user["id"], "settlement_delete", f"settlement:{sid}", s["code"])
    return {"ok": True}


# ------------------------------------------------------------------ 邀请与审批
INVITE_ROLES = {
    "annotator": "标注员", "reviewer": "质检员", "acceptor": "验收员",
    "project_manager": "项目经理", "tenant_admin": "租户管理员", "client": "客户",
}
INVITE_STATUS = {
    "pending": "待使用", "used": "已加入", "rejected": "已拒绝", "cancelled": "已取消",
}
INVITE_MODE = {"direct": "直接加入", "approval": "需审批"}


def _invite_out(r: dict) -> dict:
    d = dict(r)
    d["role_label"] = INVITE_ROLES.get(d.get("role"), d.get("role"))
    d["status_label"] = INVITE_STATUS.get(d.get("status"), d.get("status"))
    d["mode_label"] = INVITE_MODE.get(d.get("mode"), d.get("mode"))
    tenant = db.row("SELECT name FROM tenants WHERE id=?", (d.get("tenant_id"),)) if d.get("tenant_id") else None
    d["tenant_name"] = (tenant or {}).get("name", "—")
    inviter = db.row("SELECT name FROM users WHERE id=?", (d.get("invited_by"),)) if d.get("invited_by") else None
    d["inviter_name"] = (inviter or {}).get("name", "—")
    joiner = db.row("SELECT username,name FROM users WHERE id=?", (d.get("join_user_id"),)) if d.get("join_user_id") else None
    d["joiner_name"] = (joiner or {}).get("name", "")
    return d


def _invite_admin(user: dict) -> None:
    if auth.is_admin(user) or user.get("platform_role") == "tenant_admin":
        return
    raise HTTPException(403, "仅平台/租户管理员可管理邀请")


@router.post("/api/invitations")
def invite_create(body: dict, user: dict = Depends(me)):
    _invite_admin(user)
    tenant_id = int(body.get("tenant_id") or user.get("tenant_id") or 0)
    if not tenant_id:
        raise HTTPException(400, "当前账号未归属租户，无法发起邀请")
    role = str(body.get("role") or "annotator")
    if role not in INVITE_ROLES:
        raise HTTPException(400, "非法角色")
    mode = str(body.get("mode") or "direct")
    if mode not in INVITE_MODE:
        raise HTTPException(400, "非法加入方式")
    token = uuid.uuid4().hex[:12]
    iid = db.execute(
        "INSERT INTO invitations(token,tenant_id,org_id,team_id,role,name,mode,status,invited_by,note,created_at,expires_at)"
        " VALUES(?,?,?,?,?,?,?,'pending',?,?,?,?)",
        (token, tenant_id, int(body.get("org_id") or 0) or None, int(body.get("team_id") or 0) or None,
         role, str(body.get("name") or "").strip(), mode, user["id"],
         str(body.get("note") or "").strip(), db.now(),
         (datetime.now() + timedelta(days=int(body.get("days") or 7))).strftime("%Y-%m-%d %H:%M:%S")),
    )
    db.log(user["id"], "invite_create", f"invite:{iid}", f"{INVITE_ROLES[role]}/{INVITE_MODE[mode]}")
    r = db.row("SELECT * FROM invitations WHERE id=?", (iid,))
    out = _invite_out(r)
    out["url"] = f"#/join?token={token}"
    return {"ok": True, "invitation": out}


@router.get("/api/invitations")
def invite_list(status: str = "", user: dict = Depends(me)):
    _invite_admin(user)
    cond = "1=1"
    args: list = []
    if not auth.is_admin(user):
        cond = "i.tenant_id=?"
        args.append(user.get("tenant_id") or 0)
    if status:
        cond += " AND i.status=?"
        args.append(status)
    rows_ = db.rows(
        f"SELECT i.* FROM invitations i WHERE {cond} ORDER BY i.id DESC LIMIT 200",
        tuple(args),
    )
    return {"invitations": [_invite_out(r) for r in rows_]}


@router.post("/api/invitations/{iid}/cancel")
def invite_cancel(iid: int, user: dict = Depends(me)):
    _invite_admin(user)
    inv = db.row("SELECT * FROM invitations WHERE id=?", (iid,))
    if not inv:
        raise HTTPException(404, "邀请不存在")
    if inv["status"] != "pending":
        raise HTTPException(400, "仅待使用的邀请可取消")
    db.execute("UPDATE invitations SET status='cancelled', decided_by=?, decided_at=? WHERE id=?", (user["id"], db.now(), iid))
    db.log(user["id"], "invite_cancel", f"invite:{iid}", inv["token"][:6])
    return {"ok": True}


@router.post("/api/invitations/{iid}/decide")
def invite_decide(iid: int, body: dict, user: dict = Depends(me)):
    _invite_admin(user)
    inv = db.row("SELECT * FROM invitations WHERE id=?", (iid,))
    if not inv:
        raise HTTPException(404, "邀请不存在")
    if inv["status"] != "pending" or not inv.get("join_user_id"):
        raise HTTPException(400, "该邀请暂无待审批的注册申请")
    approve = bool(body.get("approve"))
    if approve:
        db.execute(
            "UPDATE users SET tenant_id=?, org_id=?, team_id=?, platform_role=? WHERE id=?",
            (inv["tenant_id"], inv.get("org_id"), inv.get("team_id"), inv["role"], inv["join_user_id"]),
        )
        db.execute(
            "UPDATE invitations SET status='used', decided_by=?, decided_at=? WHERE id=?",
            (user["id"], db.now(), iid),
        )
        db.notify(inv["join_user_id"], "加入申请已通过", "您已被接纳为组织成员，请重新进入工作台", "system", "")
        db.log(user["id"], "invite_approve", f"invite:{iid}", f"user:{inv['join_user_id']}")
    else:
        db.execute(
            "UPDATE invitations SET status='rejected', decided_by=?, decided_at=? WHERE id=?",
            (user["id"], db.now(), iid),
        )
        db.notify(inv["join_user_id"], "加入申请未获通过", str(body.get("note") or "如有疑问请联系管理员"), "system", "")
        db.log(user["id"], "invite_reject", f"invite:{iid}", f"user:{inv['join_user_id']}")
    return {"ok": True, "approved": approve}
