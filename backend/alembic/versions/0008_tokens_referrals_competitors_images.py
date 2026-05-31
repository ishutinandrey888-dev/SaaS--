"""tokens, referrals, competitor radar, image briefs

Revision ID: 0008_tokens_referrals_competitors_images
Revises: 0007_demo_admin
Create Date: 2026-05-28
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_tokens_referrals_competitors_images"
down_revision: Union[str, None] = "0007_demo_admin"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _owner_policy(table: str, user_col: str = "user_id") -> None:
    op.execute(
        f"""
        ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS {table}_owner_all ON {table};
        CREATE POLICY {table}_owner_all ON {table}
          FOR ALL USING ({user_col} = public.current_app_user_id())
          WITH CHECK ({user_col} = public.current_app_user_id());
        """
    )


def upgrade() -> None:
    op.add_column(
        "usage_counters",
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_check_constraint(
        "ck_usage_counters_tokens_nonneg", "usage_counters", "tokens_used >= 0"
    )

    op.create_table(
        "token_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(length=64), nullable=False),
        sa.Column("meta", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_token_transactions_user_period", "token_transactions", ["user_id", "period"])
    _owner_policy("token_transactions")

    op.create_table(
        "referral_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=48), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", name="uq_referral_codes_user"),
    )
    _owner_policy("referral_codes")

    op.create_table(
        "referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("referrer_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("referred_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("code", sa.String(length=48), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False, server_default=sa.text("'invited'")),
        sa.Column("reward_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("rewarded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_referrals_referrer", "referrals", ["referrer_id"])
    _owner_policy("referrals", "referrer_id")

    op.create_table(
        "competitor_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.String(length=255), nullable=False),
        sa.Column("region", sa.String(length=120), nullable=False, server_default=sa.text("'Москва'")),
        sa.Column("source", sa.String(length=32), nullable=False, server_default=sa.text("'yandex_direct'")),
        sa.Column("results", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_competitor_reports_user_created", "competitor_reports", ["user_id", sa.text("created_at DESC")])
    _owner_policy("competitor_reports")

    op.create_table(
        "competitor_watch",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("query", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_competitor_watch_user_active", "competitor_watch", ["user_id", "active"])
    _owner_policy("competitor_watch")

    op.create_table(
        "image_briefs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("site_url", sa.String(length=1024), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("brand", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("brief", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("generated_assets", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_image_briefs_user_created", "image_briefs", ["user_id", sa.text("created_at DESC")])
    _owner_policy("image_briefs")


def downgrade() -> None:
    for table in ("image_briefs", "competitor_watch", "competitor_reports", "referrals", "referral_codes", "token_transactions"):
        op.execute(f"DROP POLICY IF EXISTS {table}_owner_all ON {table}")
        op.execute(f"ALTER TABLE IF EXISTS {table} DISABLE ROW LEVEL SECURITY")
        op.drop_table(table)
    op.drop_constraint("ck_usage_counters_tokens_nonneg", "usage_counters", type_="check")
    op.drop_column("usage_counters", "tokens_used")
