"""audit_logs table + RLS policy

Revision ID: 0003_audit_logs
Revises: 0002_rls_policies
Create Date: 2026-04-19

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_audit_logs"
down_revision: Union[str, None] = "0002_rls_policies"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        # No FK to users.id on purpose: audit rows are written in their
        # own transaction (so failed ops still produce a record), and
        # they must survive user deletion for compliance.
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64)),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True)),
        sa.Column("ip_address", sa.String(length=45)),
        sa.Column("user_agent", sa.String(length=512)),
        sa.Column("request_id", sa.String(length=32)),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("meta", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_ip_address", "audit_logs", ["ip_address"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])
    # Composite index: the most common query is "this user's recent activity".
    op.create_index(
        "ix_audit_logs_user_created",
        "audit_logs",
        ["user_id", sa.text("created_at DESC")],
    )

    # RLS: owner may read their own audit entries (useful for SOC2 /
    # "account activity" page).  No UPDATE/DELETE policy -> append-only.
    op.execute("""
        ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS audit_logs_owner_select ON audit_logs;
        CREATE POLICY audit_logs_owner_select ON audit_logs
          FOR SELECT USING (user_id = public.current_app_user_id());
    """)


def downgrade() -> None:
    op.execute("""
        DROP POLICY IF EXISTS audit_logs_owner_select ON audit_logs;
        ALTER TABLE IF EXISTS audit_logs DISABLE ROW LEVEL SECURITY;
    """)
    op.drop_index("ix_audit_logs_user_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_ip_address", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_table("audit_logs")
