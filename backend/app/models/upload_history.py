from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UploadHistory(Base):
    """One row per /excel/upload — what the user sees on /dashboard.

    We store only the aggregate (counts, averages), not the ads
    themselves.  Per product contract, raw ad data is ephemeral.
    """

    __tablename__ = "upload_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename: Mapped[str] = mapped_column(String(512), nullable=False)

    total_ads: Mapped[int] = mapped_column(Integer, nullable=False)
    total_campaigns: Mapped[int] = mapped_column(Integer, nullable=False)
    improved_count: Mapped[int] = mapped_column(Integer, nullable=False)
    weak_ads_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_score: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
