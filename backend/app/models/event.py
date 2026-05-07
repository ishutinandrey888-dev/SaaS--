from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Event(Base):
    """Decoupled event bus persisted in Postgres.

    Producers (the agent runner, OAuth flow, billing webhook) call
    `services.events.emit(...)` which inserts a row.  Consumers
    (notification fan-out, AI memory loader, retraining feeders) tail
    via offset cursor.  No external broker in MVP.
    """

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    subject_type: Mapped[str | None] = mapped_column(String(32))
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
