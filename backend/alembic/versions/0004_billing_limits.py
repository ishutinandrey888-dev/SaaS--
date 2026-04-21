"""billing limits: users.plan + usage_counters + upload_history

Revision ID: 0004_billing_limits
Revises: 0003_audit_logs
Create Date: 2026-04-21

Monetisation MVP:
  * users.plan ∈ {free, starter, pro} — single source of truth for tier.
    (subscriptions.plan predates this and will be reconciled when real
    billing is wired up; for now `users.plan` wins.)
  * users.ai_ads_used_lifetime — free-tier hybrid counter that never
    resets.  Paid tiers read from usage_counters instead.
  * usage_counters — per-(user, month) rolling meters for uploads and
    AI-improved ads.  PK is (user_id, period) so we never double-count.
  * upload_history — what the user sees on /dashboard.  We persist a
    small aggregate per upload, not the ads themselves (they're still
    ephemeral per the product contract).
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_billing_limits"
down_revision: Union[str, None] = "0003_audit_logs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users — plan + lifetime AI counter
    # ------------------------------------------------------------------
    op.add_column(
        "users",
        sa.Column(
            "plan",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'free'"),
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "ai_ads_used_lifetime",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_check_constraint(
        "ck_users_plan_values",
        "users",
        "plan IN ('free', 'starter', 'pro')",
    )
    op.create_check_constraint(
        "ck_users_ai_lifetime_nonneg",
        "users",
        "ai_ads_used_lifetime >= 0",
    )

    # ------------------------------------------------------------------
    # usage_counters — per-month meters
    # ------------------------------------------------------------------
    op.create_table(
        "usage_counters",
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # "YYYY-MM" — short, timezone-free, easy to index.
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column(
            "uploads_used",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "ai_ads_used",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        # Internal cost-tracking: one /excel/upload call is one request
        # even if it improves N ads.  Kept for ops/analytics, not exposed.
        sa.Column(
            "ai_requests_used",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("user_id", "period", name="pk_usage_counters"),
        sa.CheckConstraint(
            "uploads_used >= 0 AND ai_ads_used >= 0 AND ai_requests_used >= 0",
            name="ck_usage_counters_nonneg",
        ),
    )
    op.create_index(
        "ix_usage_counters_period",
        "usage_counters",
        ["period"],
    )

    op.execute("""
        ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS usage_counters_owner_all ON usage_counters;
        CREATE POLICY usage_counters_owner_all ON usage_counters
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
    """)

    # ------------------------------------------------------------------
    # upload_history — dashboard feed
    # ------------------------------------------------------------------
    op.create_table(
        "upload_history",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=512), nullable=False),
        sa.Column("total_ads", sa.Integer(), nullable=False),
        sa.Column("total_campaigns", sa.Integer(), nullable=False),
        sa.Column("improved_count", sa.Integer(), nullable=False),
        sa.Column("weak_ads_percent", sa.Integer(), nullable=False),
        # Stored as float — avg_score has one decimal.
        sa.Column("avg_score", sa.Float(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_upload_history_user_created",
        "upload_history",
        ["user_id", sa.text("created_at DESC")],
    )

    op.execute("""
        ALTER TABLE upload_history ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS upload_history_owner_all ON upload_history;
        CREATE POLICY upload_history_owner_all ON upload_history
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
    """)


def downgrade() -> None:
    op.execute("""
        DROP POLICY IF EXISTS upload_history_owner_all ON upload_history;
        ALTER TABLE IF EXISTS upload_history DISABLE ROW LEVEL SECURITY;
    """)
    op.drop_index("ix_upload_history_user_created", table_name="upload_history")
    op.drop_table("upload_history")

    op.execute("""
        DROP POLICY IF EXISTS usage_counters_owner_all ON usage_counters;
        ALTER TABLE IF EXISTS usage_counters DISABLE ROW LEVEL SECURITY;
    """)
    op.drop_index("ix_usage_counters_period", table_name="usage_counters")
    op.drop_table("usage_counters")

    op.drop_constraint("ck_users_ai_lifetime_nonneg", "users", type_="check")
    op.drop_constraint("ck_users_plan_values", "users", type_="check")
    op.drop_column("users", "ai_ads_used_lifetime")
    op.drop_column("users", "plan")
