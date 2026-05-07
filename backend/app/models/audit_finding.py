from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AuditFinding(Base):
    """One actionable item the agent surfaces from a run.

    `kind`     — issue / opportunity / applied (history of what landed).
    `severity` — critical / warning / info / opportunity.
    `state`    — new / approved / applied / rejected.
    """

    __tablename__ = "audit_findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    agent_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(16), nullable=False, default="info", server_default="info"
    )
    campaign_external_id: Mapped[str | None] = mapped_column(String(64))
    ad_external_id: Mapped[str | None] = mapped_column(String(64))
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    effect: Mapped[str | None] = mapped_column(Text)
    suggested_action: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    confidence: Mapped[int] = mapped_column(
        Integer, nullable=False, default=50, server_default="50"
    )
    state: Mapped[str] = mapped_column(
        String(16), nullable=False, default="new", server_default="new"
    )
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
