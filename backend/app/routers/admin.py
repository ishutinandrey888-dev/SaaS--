"""Admin-only endpoints — gated by ADMIN_EMAILS env var."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import AsyncSessionAdmin
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.payment import Payment
from app.models.user import User
from app.schemas.admin import (
    AdminPaymentItem,
    AdminPaymentsResponse,
    AdminUserItem,
    AdminUsersResponse,
    FunnelMetricsResponse,
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
        raise HTTPException(status_code=404, detail="not_found")
    return user


@router.get("/metrics", response_model=FunnelMetricsResponse, status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_metrics(
    request: Request,
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
    async with AsyncSessionAdmin() as session:
        q = select(User)
        if plan:
            q = q.where(User.plan == plan)
        total_result = await session.execute(select(func.count()).select_from(q.subquery()))
        total = total_result.scalar_one()
        rows = (
            await session.execute(q.order_by(User.created_at.desc()).offset(offset).limit(limit))
        ).scalars().all()
    return AdminUsersResponse(
        total=total,
        items=[
            AdminUserItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                plan=u.plan,
                is_active=u.is_active,
                plan_expires_at=u.plan_expires_at,
                created_at=u.created_at,
            )
            for u in rows
        ],
    )


@router.get("/payments", response_model=AdminPaymentsResponse, status_code=status.HTTP_200_OK)
@limiter.limit("30/minute")
async def get_payments(
    request: Request,
    _admin: User = Depends(require_admin),
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> AdminPaymentsResponse:
    async with AsyncSessionAdmin() as session:
        q = select(Payment, User.email).join(User, Payment.user_id == User.id)
        total_result = await session.execute(
            select(func.count()).select_from(Payment)
        )
        total = total_result.scalar_one()
        rows = (
            await session.execute(
                q.order_by(Payment.created_at.desc()).offset(offset).limit(limit)
            )
        ).all()
    return AdminPaymentsResponse(
        total=total,
        items=[
            AdminPaymentItem(
                id=p.id,
                user_email=email,
                plan=p.plan,
                amount=p.amount,
                currency=p.currency,
                status=p.status,
                provider=p.provider,
                created_at=p.created_at,
                paid_at=p.paid_at,
            )
            for p, email in rows
        ],
    )
