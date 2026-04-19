from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.campaign import Campaign


class Ad(Base):
    __tablename__ = "ads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    group_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    ad_type: Mapped[str] = mapped_column(String(64), default="Текстово-графическое", nullable=False)

    headline1: Mapped[str] = mapped_column(String(56), nullable=False)
    headline2: Mapped[str | None] = mapped_column(String(30))
    body: Mapped[str] = mapped_column(String(81), nullable=False)

    final_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    display_url: Mapped[str | None] = mapped_column(String(255))

    sitelinks_json: Mapped[list | None] = mapped_column(JSONB)
    callouts_json: Mapped[list | None] = mapped_column(JSONB)

    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    campaign: Mapped["Campaign"] = relationship(back_populates="ads")
