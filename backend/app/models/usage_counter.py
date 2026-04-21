from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UsageCounter(Base):
    """Per-(user, month) rolling meters for billing limits.

    PK is (user_id, period) so counter upserts never create duplicates.
    `period` is a "YYYY-MM" string — short, tz-free, sortable.

    `ai_ads_used` is the user-visible quota (matches the tier table).
    `ai_requests_used` is internal: one /excel/upload call counts once,
    regardless of how many ads it improved, so we can reason about
    OpenAI spend per head.
    """

    __tablename__ = "usage_counters"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    period: Mapped[str] = mapped_column(String(7), primary_key=True)

    uploads_used: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    ai_ads_used: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )
    ai_requests_used: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
