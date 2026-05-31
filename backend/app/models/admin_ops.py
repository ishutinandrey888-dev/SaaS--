from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CrmSegment(Base):
    __tablename__ = "crm_segments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    slug: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False, default="#22C55E")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    trigger_event: Mapped[str] = mapped_column(String(64), nullable=False)
    trigger_delay_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    auto_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    channels: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
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


class CrmLead(Base):
    __tablename__ = "crm_leads"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    segment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("crm_segments.id", ondelete="RESTRICT"), index=True
    )
    name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="unknown")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
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


class FeedbackItem(Base):
    __tablename__ = "feedback_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="new")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False, default="in_app")
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
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


class ProductAgentRun(Base):
    __tablename__ = "product_agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[str] = mapped_column(String(48), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")
    schedule: Mapped[str] = mapped_column(String(120), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    summary: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class AiUsageDaily(Base):
    __tablename__ = "ai_usage_daily"
    __table_args__ = (UniqueConstraint("day", "provider", "model", name="uq_ai_usage_day_model"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="openai")
    model: Mapped[str] = mapped_column(String(120), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    budget_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PayrollRule(Base):
    __tablename__ = "payroll_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    role: Mapped[str] = mapped_column(String(48), unique=True, nullable=False)
    base_salary_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hourly_rate_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kpi_bonus_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    visible_to_owner_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class PayrollEntry(Base):
    __tablename__ = "payroll_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    period: Mapped[str] = mapped_column(String(7), nullable=False, index=True)
    employee_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_email: Mapped[str | None] = mapped_column(String(320))
    role: Mapped[str] = mapped_column(String(48), nullable=False)
    hours: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    variable_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    kpi_bonus_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_minor: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    meta: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default="{}"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
