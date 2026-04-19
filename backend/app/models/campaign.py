from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.ad import Ad
    from app.models.analyst_action import AnalystAction
    from app.models.keyword import Keyword
    from app.models.kpi_snapshot import KpiSnapshot
    from app.models.report_upload import ReportUpload
    from app.models.user import User


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    site_url: Mapped[str | None] = mapped_column(String(1000))
    industry: Mapped[str | None] = mapped_column(String(255))
    region: Mapped[str | None] = mapped_column(String(255))

    campaign_type: Mapped[str] = mapped_column(String(64), default="Текстово-графическая")
    strategy: Mapped[str] = mapped_column(String(128), default="Оптимизация конверсий")
    daily_budget: Mapped[int | None] = mapped_column(Integer)

    goal: Mapped[str | None] = mapped_column(Text)
    audience: Mapped[str | None] = mapped_column(Text)
    usp: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)

    brief_json: Mapped[dict | None] = mapped_column(JSONB)
    analysis_json: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="campaigns")
    keywords: Mapped[list["Keyword"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )
    ads: Mapped[list["Ad"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )
    kpi_snapshots: Mapped[list["KpiSnapshot"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )
    report_uploads: Mapped[list["ReportUpload"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )
    analyst_actions: Mapped[list["AnalystAction"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )

    # Simple numeric field for metrics if needed later
    default_bid: Mapped[float | None] = mapped_column(Numeric(10, 2))
