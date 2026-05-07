"""Event bus.

Persists events to the `events` table.  Producers call `emit(...)`.
Consumers (notification fan-out, retraining feeders, AI memory) read
the table via offset cursor — no Kafka in MVP.

Naming convention: `<domain>.<action>` — finding.created, agent.launched,
campaign.paused, budget.changed.

`emit` is non-blocking from the user's perspective: it inserts in the
caller's session.  If the caller's transaction rolls back, the event
disappears too — that's the right behaviour for "log the thing that
actually happened".
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event

logger = logging.getLogger("events")


# Event names — keep stable, treat like a public API for downstream
# consumers.  Add new ones; don't rename existing ones.
class EventName:
    PROJECT_CREATED = "project.created"
    PROJECT_DELETED = "project.deleted"

    OAUTH_YANDEX_GRANTED = "oauth.yandex.granted"
    OAUTH_YANDEX_REVOKED = "oauth.yandex.revoked"

    AGENT_CREATED = "agent.created"
    AGENT_LAUNCHED = "agent.launched"
    AGENT_PAUSED = "agent.paused"

    AGENT_RUN_STARTED = "agent.run.started"
    AGENT_RUN_FINISHED = "agent.run.finished"
    AGENT_RUN_FAILED = "agent.run.failed"

    FINDING_CREATED = "finding.created"
    FINDING_APPROVED = "finding.approved"
    FINDING_REJECTED = "finding.rejected"
    FINDING_APPLIED = "finding.applied"

    CAMPAIGN_PAUSED = "campaign.paused"
    BUDGET_CHANGED = "budget.changed"
    BID_CHANGED = "bid.changed"

    PAYMENT_SUCCEEDED = "payment.succeeded"


async def emit(
    session: AsyncSession,
    *,
    name: str,
    user_id: uuid.UUID | None = None,
    subject_type: str | None = None,
    subject_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> Event:
    evt = Event(
        name=name,
        user_id=user_id,
        subject_type=subject_type,
        subject_id=subject_id,
        payload=payload or {},
    )
    session.add(evt)
    await session.flush()
    logger.info("event_emit name=%s subject=%s/%s", name, subject_type, subject_id)
    return evt
