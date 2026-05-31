"""Admin-only endpoints.

Gated by `ADMIN_EMAILS` env var (comma-separated list of user emails).
The check is intentionally simple — we don't want a full RBAC layer
in the MVP, and the founder's email is the only thing that needs the
funnel report today.

Reads from `audit_logs` + `payments` via the user-scoped session;
admins are still real users and the rows they need are visible without
BYPASSRLS — `audit_logs` has no RLS (writes are unscoped) and the
metrics SELECT touches no row the user couldn't see.

Actually that's not true: `audit_logs` aggregates across users, and
the founder needs to see *everyone's* events.  We use the admin session
explicitly to side-step RLS for the aggregate read.
"""

from __future__ import annotations

import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import AsyncSessionAdmin
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.admin_ops import (
    AiUsageDaily,
    CrmLead,
    CrmSegment,
    FeedbackItem,
    PayrollEntry,
    ProductAgentRun,
)
from app.models.notification import Notification
from app.models.payment import Payment
from app.models.user import User
from app.schemas.admin import (
    AdminPaymentItem,
    AdminPaymentsResponse,
    AdminUserItem,
    AdminUsersResponse,
    AgentOpsResponse,
    BroadcastResult,
    CrmLeadOut,
    CrmOverviewResponse,
    CrmSegmentOut,
    CrmTemplateUpdate,
    FeedbackCreate,
    FeedbackOut,
    FeedbackStatusUpdate,
    FunnelMetricsResponse,
    PayrollEntryOut,
    PayrollResponse,
)
from app.services import metrics

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger("admin")


def _is_admin(user: User) -> bool:
    s = get_settings()
    admins = s.admin_email_set
    if not admins:
        return False
    return (user.email or "").strip().lower() in admins


async def require_admin(user: CurrentUser) -> User:
    if not _is_admin(user):
        # Same 404 the route would return for an unknown path — don't
        # advertise the surface to non-admins.
        raise HTTPException(status_code=404, detail="not_found")
    return user


async def require_owner(user: CurrentUser) -> User:
    settings = get_settings()
    if not _is_admin(user) or (user.email or "").strip().lower() != settings.owner_email:
        raise HTTPException(status_code=404, detail="not_found")
    return user


@router.get(
    "/metrics",
    response_model=FunnelMetricsResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def get_metrics(
    request: Request,
    response: Response,
    _admin: User = Depends(require_admin),
) -> FunnelMetricsResponse:
    async with AsyncSessionAdmin() as session:
        session.info["kind"] = "admin"
        funnel = await metrics.compute_funnel(session)
    payload = metrics.funnel_to_dict(funnel)
    return FunnelMetricsResponse(**payload)


@router.get("/users", response_model=AdminUsersResponse, status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_users(
    request: Request,
    _admin: User = Depends(require_admin),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
    plan: str | None = Query(default=None),
) -> AdminUsersResponse:
    try:
        async with AsyncSessionAdmin() as session:
            session.info["kind"] = "admin"
            count_q = select(func.count(User.id))
            if plan:
                count_q = count_q.where(User.plan == plan)
            total = (await session.execute(count_q)).scalar_one()

            list_q = select(User)
            if plan:
                list_q = list_q.where(User.plan == plan)
            rows = (
                await session.execute(
                    list_q.order_by(User.created_at.desc()).offset(offset).limit(limit)
                )
            ).scalars().all()

        return AdminUsersResponse(
            total=total,
            items=[
                AdminUserItem(
                    id=user.id,
                    email=user.email,
                    full_name=user.full_name,
                    plan=user.plan,
                    is_active=user.is_active,
                    plan_expires_at=user.plan_expires_at,
                    created_at=user.created_at,
                )
                for user in rows
            ],
        )
    except Exception:
        logger.exception("admin_users_failed")
        raise


@router.get("/payments", response_model=AdminPaymentsResponse, status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_payments(
    request: Request,
    _admin: User = Depends(require_admin),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> AdminPaymentsResponse:
    try:
        async with AsyncSessionAdmin() as session:
            session.info["kind"] = "admin"
            total = (await session.execute(select(func.count(Payment.id)))).scalar_one()
            rows = (
                await session.execute(
                    select(Payment, User.email)
                    .join(User, Payment.user_id == User.id)
                    .order_by(Payment.created_at.desc())
                    .offset(offset)
                    .limit(limit)
                )
            ).all()

        return AdminPaymentsResponse(
            total=total,
            items=[
                AdminPaymentItem(
                    id=payment.id,
                    user_email=email,
                    plan=payment.plan,
                    amount=payment.amount,
                    currency=payment.currency,
                    status=payment.status,
                    provider=payment.provider,
                    created_at=payment.created_at,
                    paid_at=payment.paid_at,
                )
                for payment, email in rows
            ],
        )
    except Exception:
        logger.exception("admin_payments_failed")
        raise


def _lead_out(lead: CrmLead) -> CrmLeadOut:
    return CrmLeadOut(
        id=lead.id,
        user_id=lead.user_id,
        name=lead.name,
        email=lead.email,
        plan=lead.plan,
        source=lead.source,
        status=lead.status,
        score=lead.score,
        next_action_at=lead.next_action_at,
        meta=lead.meta,
    )


@router.get("/crm", response_model=CrmOverviewResponse)
@limiter.limit("30/minute")
async def get_crm(
    request: Request,
    _admin: User = Depends(require_admin),
) -> CrmOverviewResponse:
    async with AsyncSessionAdmin() as session:
        segments = (
            await session.execute(select(CrmSegment).order_by(CrmSegment.sort_order))
        ).scalars().all()
        leads = (
            await session.execute(select(CrmLead).order_by(CrmLead.score.desc(), CrmLead.created_at.desc()))
        ).scalars().all()

    leads_by_segment: dict[UUID, list[CrmLead]] = {}
    for lead in leads:
        leads_by_segment.setdefault(lead.segment_id, []).append(lead)

    return CrmOverviewResponse(
        segments=[
            CrmSegmentOut(
                id=segment.id,
                slug=segment.slug,
                title=segment.title,
                color=segment.color,
                sort_order=segment.sort_order,
                trigger_event=segment.trigger_event,
                trigger_delay_minutes=segment.trigger_delay_minutes,
                auto_enabled=segment.auto_enabled,
                template=segment.template,
                channels=segment.channels,
                lead_count=len(leads_by_segment.get(segment.id, [])),
                leads=[_lead_out(lead) for lead in leads_by_segment.get(segment.id, [])[:50]],
            )
            for segment in segments
        ]
    )


@router.patch("/crm/segments/{slug}", response_model=CrmSegmentOut)
@limiter.limit("20/minute")
async def update_crm_segment(
    slug: str,
    payload: CrmTemplateUpdate,
    request: Request,
    _admin: User = Depends(require_admin),
) -> CrmSegmentOut:
    async with AsyncSessionAdmin() as session:
        segment = (
            await session.execute(select(CrmSegment).where(CrmSegment.slug == slug))
        ).scalar_one_or_none()
        if segment is None:
            raise HTTPException(status_code=404, detail="segment_not_found")
        segment.template = payload.template
        if payload.auto_enabled is not None:
            segment.auto_enabled = payload.auto_enabled
        if payload.channels is not None:
            segment.channels = payload.channels
        await session.commit()
        await session.refresh(segment)
        lead_count = (
            await session.execute(
                select(func.count()).select_from(CrmLead).where(CrmLead.segment_id == segment.id)
            )
        ).scalar_one()

    return CrmSegmentOut(
        id=segment.id,
        slug=segment.slug,
        title=segment.title,
        color=segment.color,
        sort_order=segment.sort_order,
        trigger_event=segment.trigger_event,
        trigger_delay_minutes=segment.trigger_delay_minutes,
        auto_enabled=segment.auto_enabled,
        template=segment.template,
        channels=segment.channels,
        lead_count=lead_count,
        leads=[],
    )


@router.post("/crm/segments/{slug}/broadcast", response_model=BroadcastResult)
@limiter.limit("10/minute")
async def broadcast_crm_segment(
    slug: str,
    request: Request,
    _admin: User = Depends(require_admin),
) -> BroadcastResult:
    async with AsyncSessionAdmin() as session:
        segment = (
            await session.execute(select(CrmSegment).where(CrmSegment.slug == slug))
        ).scalar_one_or_none()
        if segment is None:
            raise HTTPException(status_code=404, detail="segment_not_found")

        leads = (
            await session.execute(select(CrmLead).where(CrmLead.segment_id == segment.id))
        ).scalars().all()
        queued = 0
        for lead in leads:
            if not lead.user_id:
                continue
            session.add(
                Notification(
                    user_id=lead.user_id,
                    kind="crm_broadcast",
                    payload={
                        "segment": segment.slug,
                        "template": segment.template,
                        "channels": segment.channels,
                    },
                )
            )
            queued += 1
        await session.commit()

    return BroadcastResult(segment_slug=slug, queued=queued, channels=segment.channels)


@router.get("/feedback", response_model=list[FeedbackOut])
@limiter.limit("30/minute")
async def list_feedback(
    request: Request,
    _admin: User = Depends(require_admin),
) -> list[FeedbackOut]:
    async with AsyncSessionAdmin() as session:
        items = (
            await session.execute(select(FeedbackItem).order_by(FeedbackItem.created_at.desc()).limit(100))
        ).scalars().all()
    return [
        FeedbackOut(
            id=item.id,
            user_id=item.user_id,
            kind=item.kind,
            rating=item.rating,
            status=item.status,
            title=item.title,
            body=item.body,
            source=item.source,
            meta=item.meta,
            created_at=item.created_at,
        )
        for item in items
    ]


@router.post("/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def create_feedback(
    payload: FeedbackCreate,
    request: Request,
    user: User = Depends(require_admin),
) -> FeedbackOut:
    item = FeedbackItem(
        user_id=user.id,
        kind=payload.kind,
        rating=payload.rating,
        status="new",
        title=payload.title,
        body=payload.body,
        source=payload.source,
        meta=payload.meta,
    )
    async with AsyncSessionAdmin() as session:
        session.add(item)
        await session.commit()
        await session.refresh(item)
    return FeedbackOut(
        id=item.id,
        user_id=item.user_id,
        kind=item.kind,
        rating=item.rating,
        status=item.status,
        title=item.title,
        body=item.body,
        source=item.source,
        meta=item.meta,
        created_at=item.created_at,
    )


@router.patch("/feedback/{feedback_id}", response_model=FeedbackOut)
@limiter.limit("20/minute")
async def update_feedback_status(
    feedback_id: UUID,
    payload: FeedbackStatusUpdate,
    request: Request,
    _admin: User = Depends(require_admin),
) -> FeedbackOut:
    async with AsyncSessionAdmin() as session:
        item = (
            await session.execute(select(FeedbackItem).where(FeedbackItem.id == feedback_id))
        ).scalar_one_or_none()
        if item is None:
            raise HTTPException(status_code=404, detail="feedback_not_found")
        item.status = payload.status
        await session.commit()
        await session.refresh(item)
    return FeedbackOut(
        id=item.id,
        user_id=item.user_id,
        kind=item.kind,
        rating=item.rating,
        status=item.status,
        title=item.title,
        body=item.body,
        source=item.source,
        meta=item.meta,
        created_at=item.created_at,
    )


@router.get("/agent-ops", response_model=AgentOpsResponse)
@limiter.limit("30/minute")
async def get_agent_ops(
    request: Request,
    _admin: User = Depends(require_admin),
) -> AgentOpsResponse:
    settings = get_settings()
    today = date.today()
    month_prefix = today.strftime("%Y-%m")
    async with AsyncSessionAdmin() as session:
        runs = (
            await session.execute(
                select(ProductAgentRun).order_by(ProductAgentRun.created_at.desc()).limit(30)
            )
        ).scalars().all()
        usage = (
            await session.execute(
                select(AiUsageDaily)
                .where(func.to_char(AiUsageDaily.day, "YYYY-MM") == month_prefix)
                .order_by(AiUsageDaily.day.desc())
            )
        ).scalars().all()

    month_cost = sum(row.cost_minor for row in usage)
    month_tokens = sum(row.input_tokens + row.output_tokens for row in usage)
    budget = settings.ai_monthly_budget_minor
    return AgentOpsResponse(
        runs=[
            {
                "id": run.id,
                "name": run.name,
                "kind": run.kind,
                "status": run.status,
                "schedule": run.schedule,
                "started_at": run.started_at,
                "finished_at": run.finished_at,
                "next_run_at": run.next_run_at,
                "input_tokens": run.input_tokens,
                "output_tokens": run.output_tokens,
                "cost_minor": run.cost_minor,
                "summary": run.summary,
                "error": run.error,
            }
            for run in runs
        ],
        usage=[
            {
                "day": row.day,
                "provider": row.provider,
                "model": row.model,
                "input_tokens": row.input_tokens,
                "output_tokens": row.output_tokens,
                "cost_minor": row.cost_minor,
                "budget_minor": row.budget_minor,
            }
            for row in usage
        ],
        month_cost_minor=month_cost,
        month_tokens=month_tokens,
        budget_minor=budget,
        budget_used_pct=round(month_cost / budget, 4) if budget else 0.0,
        telegram_enabled=bool(settings.telegram_bot_token and settings.telegram_ops_chat_id),
        code_audit_schedule_days=settings.code_audit_schedule_days,
    )


@router.get("/payroll", response_model=PayrollResponse)
@limiter.limit("20/minute")
async def get_payroll(
    request: Request,
    period: str | None = None,
    _owner: User = Depends(require_owner),
) -> PayrollResponse:
    period = period or date.today().strftime("%Y-%m")
    async with AsyncSessionAdmin() as session:
        entries = (
            await session.execute(
                select(PayrollEntry)
                .where(PayrollEntry.period == period)
                .order_by(PayrollEntry.employee_name)
            )
        ).scalars().all()
    total = sum(entry.total_minor for entry in entries)
    return PayrollResponse(
        period=period,
        total_minor=total,
        entries=[
            PayrollEntryOut(
                id=entry.id,
                period=entry.period,
                employee_name=entry.employee_name,
                employee_email=entry.employee_email,
                role=entry.role,
                hours=entry.hours,
                variable_minor=entry.variable_minor,
                kpi_bonus_minor=entry.kpi_bonus_minor,
                total_minor=entry.total_minor,
                status=entry.status,
            )
            for entry in entries
        ],
    )
