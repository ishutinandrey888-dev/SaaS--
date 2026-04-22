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

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.database import AsyncSessionAdmin
from app.middleware.auth import CurrentUser
from app.middleware.rate_limit import limiter
from app.models.user import User
from app.schemas.admin import FunnelMetricsResponse
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


@router.get(
    "/metrics",
    response_model=FunnelMetricsResponse,
    status_code=status.HTTP_200_OK,
)
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
