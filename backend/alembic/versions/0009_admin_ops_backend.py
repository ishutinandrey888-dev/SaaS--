"""admin ops backend

Revision ID: 0009_admin_ops_backend
Revises: 0008_tokens_referrals_competitors_images
Create Date: 2026-05-28
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_admin_ops_backend"
down_revision: Union[str, None] = "0008_tokens_referrals_competitors_images"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "crm_segments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(length=48), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("color", sa.String(length=16), nullable=False, server_default="#22C55E"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("trigger_event", sa.String(length=64), nullable=False),
        sa.Column("trigger_delay_minutes", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("auto_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("template", sa.Text(), nullable=False),
        sa.Column("channels", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_crm_segments_slug"),
    )
    op.create_index("ix_crm_segments_slug", "crm_segments", ["slug"])

    op.create_table(
        "crm_leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("segment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("crm_segments.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("plan", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="unknown"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("score", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("next_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_crm_leads_user_id", "crm_leads", ["user_id"])
    op.create_index("ix_crm_leads_segment_id", "crm_leads", ["segment_id"])
    op.create_index("ix_crm_leads_email", "crm_leads", ["email"])

    op.create_table(
        "feedback_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="new"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="in_app"),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feedback_items_user_id", "feedback_items", ["user_id"])

    op.create_table(
        "product_agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("kind", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="planned"),
        sa.Column("schedule", sa.String(length=120), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("cost_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "ai_usage_daily",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False, server_default="openai"),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("cost_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("budget_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("day", "provider", "model", name="uq_ai_usage_day_model"),
    )
    op.create_index("ix_ai_usage_daily_day", "ai_usage_daily", ["day"])

    op.create_table(
        "payroll_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("role", sa.String(length=48), nullable=False),
        sa.Column("base_salary_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("hourly_rate_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("kpi_bonus_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("visible_to_owner_only", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("role", name="uq_payroll_rules_role"),
    )

    op.create_table(
        "payroll_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("employee_name", sa.String(length=255), nullable=False),
        sa.Column("employee_email", sa.String(length=320), nullable=True),
        sa.Column("role", sa.String(length=48), nullable=False),
        sa.Column("hours", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("variable_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("kpi_bonus_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_minor", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_payroll_entries_user_id", "payroll_entries", ["user_id"])
    op.create_index("ix_payroll_entries_period", "payroll_entries", ["period"])

    op.execute(
        """
        INSERT INTO crm_segments (slug, title, color, sort_order, trigger_event, trigger_delay_minutes, template, channels)
        VALUES
          ('new', 'Новые лиды', '#3B82F6', 10, 'user.registered', 5, 'Привет, {name}! Поможем подключить первый рекламный кабинет и найти точки роста.', '{"telegram": true, "email": true}'::jsonb),
          ('activation', 'Активация', '#06B6D4', 20, 'project.not_created', 1440, '{name}, вижу, что проект еще не запущен. Отправить быстрый чек-лист подключения?', '{"telegram": true, "email": true}'::jsonb),
          ('trial', 'Триал / оценка', '#F59E0B', 30, 'trial.day_3', 4320, 'Как вам ДОЖИМ-АЙ? Оцените продукт от 1 до 5, это поможет нам улучшить агент.', '{"telegram": true, "email": false}'::jsonb),
          ('paid', 'Платящие', '#219C46', 40, 'payment.success', 0, 'Спасибо за оплату, {name}. Пришлем еженедельный отчет по экономии бюджета.', '{"telegram": true, "email": true}'::jsonb),
          ('risk', 'Риск оттока', '#DC2626', 50, 'subscription.expiring', 0, '{name}, подписка скоро закончится. Хотите, чтобы специалист помог продлить и сохранить настройки?', '{"telegram": true, "email": true}'::jsonb)
        ON CONFLICT (slug) DO NOTHING;
        """
    )

    op.execute(
        """
        INSERT INTO product_agent_runs (name, kind, status, schedule, summary)
        VALUES
          ('Ежедневный smoke-тест продукта', 'smoke_test', 'planned', 'каждый день 09:00', 'Проверяет регистрацию, логин, оплату, админку и основные страницы.'),
          ('Поиск сломанных сценариев', 'product_qa', 'planned', 'каждые 6 часов', 'Ищет ошибки в пользовательских сценариях и пишет алерты.'),
          ('Аудит кода', 'code_audit', 'planned', 'раз в 3 дня', 'Плановый аудит безопасности, регрессий и технического долга.')
        """
    )

    op.execute(
        """
        INSERT INTO payroll_rules (role, base_salary_minor, hourly_rate_minor, kpi_bonus_minor)
        VALUES
          ('owner', 0, 0, 0),
          ('admin', 9000000, 0, 1000000),
          ('manager', 6500000, 90000, 1200000),
          ('marketer', 8000000, 120000, 1500000),
          ('support', 5500000, 75000, 700000),
          ('finance', 7000000, 100000, 900000),
          ('viewer', 3500000, 50000, 0)
        ON CONFLICT (role) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.drop_index("ix_payroll_entries_period", table_name="payroll_entries")
    op.drop_index("ix_payroll_entries_user_id", table_name="payroll_entries")
    op.drop_table("payroll_entries")
    op.drop_table("payroll_rules")
    op.drop_index("ix_ai_usage_daily_day", table_name="ai_usage_daily")
    op.drop_table("ai_usage_daily")
    op.drop_table("product_agent_runs")
    op.drop_index("ix_feedback_items_user_id", table_name="feedback_items")
    op.drop_table("feedback_items")
    op.drop_index("ix_crm_leads_email", table_name="crm_leads")
    op.drop_index("ix_crm_leads_segment_id", table_name="crm_leads")
    op.drop_index("ix_crm_leads_user_id", table_name="crm_leads")
    op.drop_table("crm_leads")
    op.drop_index("ix_crm_segments_slug", table_name="crm_segments")
    op.drop_table("crm_segments")
