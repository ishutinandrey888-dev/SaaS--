"""payments table + users.plan_expires_at

Revision ID: 0005_payments
Revises: 0004_billing_limits
Create Date: 2026-04-21

Payments MVP:
  * `payments` — one row per provider-backed payment.  The webhook is
    the only place that flips `status` to succeeded/failed, so the
    table is our idempotency log.  `(provider, provider_payment_id)`
    is unique so a replayed webhook is a no-op.
  * `users.plan_expires_at` — nullable UTC timestamp.  Populated by the
    webhook handler when a paid plan is granted; billing reads this
    alongside `users.plan` to decide whether to auto-downgrade.

RLS: payments are per-user but the webhook handler writes via the
admin session (no JWT context), so we enable RLS + add an owner
policy for app_user reads and let BYPASSRLS handle provider writes.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_payments"
down_revision: Union[str, None] = "0004_billing_limits"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "plan_expires_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.create_table(
        "payments",
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
        sa.Column("plan", sa.String(length=16), nullable=False),
        # Stored as minor units (kopecks) to avoid float rounding.
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default=sa.text("'RUB'")),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_payment_id", sa.String(length=128), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "confirmation_url",
            sa.String(length=1024),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "plan IN ('starter', 'pro')",
            name="ck_payments_plan_values",
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'canceled')",
            name="ck_payments_status_values",
        ),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount_pos"),
        sa.UniqueConstraint(
            "provider",
            "provider_payment_id",
            name="uq_payments_provider_payment",
        ),
    )
    op.create_index(
        "ix_payments_user_created",
        "payments",
        ["user_id", sa.text("created_at DESC")],
    )

    op.execute("""
        ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS payments_owner_select ON payments;
        CREATE POLICY payments_owner_select ON payments
          FOR SELECT USING (user_id = public.current_app_user_id());
    """)


def downgrade() -> None:
    op.execute("""
        DROP POLICY IF EXISTS payments_owner_select ON payments;
        ALTER TABLE IF EXISTS payments DISABLE ROW LEVEL SECURITY;
    """)
    op.drop_index("ix_payments_user_created", table_name="payments")
    op.drop_table("payments")
    op.drop_column("users", "plan_expires_at")
