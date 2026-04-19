"""Helpers for writing to `audit_logs`.

Fails-open: if logging raises (e.g. DB disconnect), we log a warning and
continue rather than surfacing an error to the caller.  Losing an audit
line is preferable to failing a business request — the application log
still captures the event.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger("audit")

_UA_MAX = 512
_IP_MAX = 45


class Action:
    """String constants used for `audit_logs.action`.  Keep stable."""

    AUTH_REGISTER = "auth.register"
    AUTH_REGISTER_FAILED = "auth.register.failed"
    AUTH_LOGIN = "auth.login"
    AUTH_LOGIN_FAILED = "auth.login.failed"
    AUTH_LOGIN_LOCKED = "auth.login.locked"
    AUTH_REFRESH = "auth.refresh"
    AUTH_REFRESH_FAILED = "auth.refresh.failed"
    AUTH_LOGOUT = "auth.logout"

    CAMPAIGN_CREATE = "campaign.create"
    CAMPAIGN_UPDATE = "campaign.update"
    CAMPAIGN_DELETE = "campaign.delete"

    EXPORT_XLSX = "export.xlsx"
    EXPORT_ACTIONS_XLSX = "export.actions_xlsx"

    ANALYST_UPLOAD = "analyst.upload_report"
    ANALYST_APPROVE = "analyst.approve_action"
    ANALYST_REJECT = "analyst.reject_action"

    PAYMENTS_WEBHOOK = "payments.webhook"
    PAYMENTS_SUBSCRIBE = "payments.subscribe"


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        candidate = fwd.split(",", 1)[0].strip()
        if candidate:
            return candidate[:_IP_MAX]
    if request.client:
        return request.client.host[:_IP_MAX]
    return None


def _user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = request.headers.get("user-agent")
    if not ua:
        return None
    return ua[:_UA_MAX]


def _request_id(request: Request | None) -> str | None:
    if request is None:
        return None
    rid = getattr(request.state, "request_id", None)
    if isinstance(rid, str):
        return rid[:32]
    return None


def _coerce_user_id(
    user: User | uuid.UUID | str | None,
) -> uuid.UUID | None:
    if user is None:
        return None
    if isinstance(user, User):
        return user.id
    if isinstance(user, uuid.UUID):
        return user
    try:
        return uuid.UUID(str(user))
    except (TypeError, ValueError):
        return None


async def log(
    db: AsyncSession,
    *,
    action: str,
    request: Request | None = None,
    user: User | uuid.UUID | str | None = None,
    resource_type: str | None = None,
    resource_id: uuid.UUID | str | None = None,
    success: bool = True,
    meta: dict[str, Any] | None = None,
) -> None:
    """Insert an audit row.  Never raises to the caller."""
    try:
        rid = None
        if resource_id is not None:
            rid = resource_id if isinstance(resource_id, uuid.UUID) else uuid.UUID(str(resource_id))

        entry = AuditLog(
            user_id=_coerce_user_id(user),
            action=action,
            resource_type=resource_type,
            resource_id=rid,
            ip_address=_client_ip(request),
            user_agent=_user_agent(request),
            request_id=_request_id(request),
            success=success,
            meta=meta,
        )
        db.add(entry)
        await db.flush()
    except Exception:  # noqa: BLE001 -- fails-open by design
        logger.warning("audit_log_failed action=%s", action, exc_info=True)
