"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-04-19

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(length=320), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "login_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("ip_address", sa.String(length=45)),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_login_attempts_email", "login_attempts", ["email"])
    op.create_index("ix_login_attempts_ip_address", "login_attempts", ["ip_address"])
    op.create_index("ix_login_attempts_created_at", "login_attempts", ["created_at"])

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("plan", sa.String(length=32), nullable=False, server_default="free"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("yukassa_customer_id", sa.String(length=128)),
        sa.Column("yukassa_subscription_id", sa.String(length=128)),
        sa.Column("current_period_start", sa.DateTime(timezone=True)),
        sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("meta", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("site_url", sa.String(length=1000)),
        sa.Column("industry", sa.String(length=255)),
        sa.Column("region", sa.String(length=255)),
        sa.Column("campaign_type", sa.String(length=64), server_default="Текстово-графическая"),
        sa.Column("strategy", sa.String(length=128), server_default="Оптимизация конверсий"),
        sa.Column("daily_budget", sa.Integer()),
        sa.Column("goal", sa.Text()),
        sa.Column("audience", sa.Text()),
        sa.Column("usp", sa.Text()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("brief_json", postgresql.JSONB()),
        sa.Column("analysis_json", postgresql.JSONB()),
        sa.Column("default_bid", sa.Numeric(10, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_campaigns_user_id", "campaigns", ["user_id"])

    op.create_table(
        "keywords",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("phrase", sa.String(length=512), nullable=False),
        sa.Column("group_name", sa.String(length=255)),
        sa.Column("intent", sa.String(length=64)),
        sa.Column("frequency", sa.Integer()),
        sa.Column("bid", sa.Numeric(10, 2)),
        sa.Column("minus_words", sa.Text()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_keywords_campaign_id", "keywords", ["campaign_id"])
    op.create_index("ix_keywords_group_name", "keywords", ["group_name"])

    op.create_table(
        "ads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_name", sa.String(length=255), nullable=False),
        sa.Column("ad_type", sa.String(length=64), nullable=False, server_default="Текстово-графическое"),
        sa.Column("headline1", sa.String(length=56), nullable=False),
        sa.Column("headline2", sa.String(length=30)),
        sa.Column("body", sa.String(length=81), nullable=False),
        sa.Column("final_url", sa.String(length=1000), nullable=False),
        sa.Column("display_url", sa.String(length=255)),
        sa.Column("sitelinks_json", postgresql.JSONB()),
        sa.Column("callouts_json", postgresql.JSONB()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ads_campaign_id", "ads", ["campaign_id"])
    op.create_index("ix_ads_group_name", "ads", ["group_name"])

    op.create_table(
        "kpi_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("impressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ctr", sa.Numeric(8, 4), nullable=False, server_default="0"),
        sa.Column("spend", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("conversions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cpa", sa.Numeric(12, 2)),
        sa.Column("cpc", sa.Numeric(12, 2)),
        sa.Column("report_type", sa.String(length=32), nullable=False, server_default="campaign"),
        sa.Column("raw_payload", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("campaign_id", "snapshot_date", name="uq_kpi_campaign_date"),
    )
    op.create_index("ix_kpi_snapshots_campaign_id", "kpi_snapshots", ["campaign_id"])
    op.create_index("ix_kpi_snapshots_snapshot_date", "kpi_snapshots", ["snapshot_date"])

    op.create_table(
        "report_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("report_type", sa.String(length=32)),
        sa.Column("period_start", sa.Date()),
        sa.Column("period_end", sa.Date()),
        sa.Column("issues_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_report_uploads_user_id", "report_uploads", ["user_id"])
    op.create_index("ix_report_uploads_campaign_id", "report_uploads", ["campaign_id"])

    op.create_table(
        "analyst_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("upload_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("report_uploads.id", ondelete="SET NULL")),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False, server_default="info"),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("diagnosis", sa.Text()),
        sa.Column("proposal_json", postgresql.JSONB()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="proposed"),
        sa.Column("export_xlsx_path", sa.Text()),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_analyst_actions_campaign_id", "analyst_actions", ["campaign_id"])


def downgrade() -> None:
    op.drop_index("ix_analyst_actions_campaign_id", table_name="analyst_actions")
    op.drop_table("analyst_actions")
    op.drop_index("ix_report_uploads_campaign_id", table_name="report_uploads")
    op.drop_index("ix_report_uploads_user_id", table_name="report_uploads")
    op.drop_table("report_uploads")
    op.drop_index("ix_kpi_snapshots_snapshot_date", table_name="kpi_snapshots")
    op.drop_index("ix_kpi_snapshots_campaign_id", table_name="kpi_snapshots")
    op.drop_table("kpi_snapshots")
    op.drop_index("ix_ads_group_name", table_name="ads")
    op.drop_index("ix_ads_campaign_id", table_name="ads")
    op.drop_table("ads")
    op.drop_index("ix_keywords_group_name", table_name="keywords")
    op.drop_index("ix_keywords_campaign_id", table_name="keywords")
    op.drop_table("keywords")
    op.drop_index("ix_campaigns_user_id", table_name="campaigns")
    op.drop_table("campaigns")
    op.drop_table("subscriptions")
    op.drop_index("ix_login_attempts_created_at", table_name="login_attempts")
    op.drop_index("ix_login_attempts_ip_address", table_name="login_attempts")
    op.drop_index("ix_login_attempts_email", table_name="login_attempts")
    op.drop_table("login_attempts")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
