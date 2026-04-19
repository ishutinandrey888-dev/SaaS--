from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditLog(Base):
    """Durable audit trail for compliance, anti-fraud, and incident response.

    Distinct from `login_attempts` (which is tuned for the hot-path
    brute-force guard).  This table is **append-only** — no updates, no
    deletes — and is meant to be read rarely but kept for a long time.

    `action` uses dotted names: "auth.login", "auth.register",
    "auth.refresh", "auth.logout", "campaign.create", "campaign.update",
    "export.xlsx", "analyst.upload_report", "analyst.approve_action",
    "payments.webhook", …  Keep them stable — they're searched on.
    """

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nullable and intentionally NO foreign key: audit rows are written
    # in their own transaction (so failed/rolled-back operations still
    # produce a record), and we want them to survive user deletion for
    # compliance / investigation purposes.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        index=True,
    )

    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    # Optional resource pointer for fan-out by object.
    resource_type: Mapped[str | None] = mapped_column(String(64))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    ip_address: Mapped[str | None] = mapped_column(String(45), index=True)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    request_id: Mapped[str | None] = mapped_column(String(32))

    success: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Action-specific extras: email on failed login, campaign name on
    # export, payment amount, etc.  Anything useful for an investigation.
    meta: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
