"""Helpers for writing to `audit_logs`.

Design points:
  * Opens its own transaction on `engine_admin` and commits
    immediately, so the audit record survives rollbacks of the caller's
    transaction (e.g. failed logins, duplicate-email registrations).
  * No foreign key on `user_id` — see `models.audit_log` — so we can
    safely write rows for users that don't exist yet (failed register)
    or that were later deleted.
  * Fails-open: if persistence fails we warn to stderr and return.
    Losing an audit line is preferable to failing the business request.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from fastapi import Request

from app.core.database import AsyncSessionAdmin
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

    EXCEL_UPLOAD = "excel.upload"
    EXCEL_IMPROVE_ALL = "excel.improve_all"
    START_GENERATE = "start.generate"

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


def _coerce_user_id(user: User | uuid.UUID | str | None) -> uuid.UUID | None:
    if user is None:
        return None
    if isinstance(user, User):
        return user.id
    if isinstance(user, uuid.UUID):
        return user
    try:
        return uuid.UUID(str(user))
    except (TypeError, ValueError):
        # Store NULL rather than bogus garbage (the column is nullable on
        # purpose), but surface the misuse so it's noticed.
        logger.warning("audit_log_invalid_user_id user=%r", user)
        return None


async def log(
    *,
    action: str,
    request: Request | None = None,
    user: User | uuid.UUID | str | None = None,
    resource_type: str | None = None,
    resource_id: uuid.UUID | str | None = None,
    success: bool = True,
    meta: dict[str, Any] | None = None,
) -> None:
    """Insert a single audit row in its own transaction.  Never raises."""
    try:
        rid = None
        if resource_id is not None:
            rid = (
                resource_id
                if isinstance(resource_id, uuid.UUID)
                else uuid.UUID(str(resource_id))
            )

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

        async with AsyncSessionAdmin() as session:
            async with session.begin():
                session.add(entry)
    except Exception:  # noqa: BLE001 -- fails-open by design
        logger.warning("audit_log_failed action=%s", action, exc_info=True)
