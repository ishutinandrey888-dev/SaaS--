"""dozim pivot: drop legacy ad-pipeline tables, rename plans, add agent stack

Revision ID: 0006_dozim_pivot
Revises: 0005_payments
Create Date: 2026-05-07

This is a one-shot pivot from the Excel-audit MVP to the AI-agent product
ДОЖИМ-АЙ.  The migration is destructive on shape but lossy only in tables
the previous app was already discarding (uploads / report_uploads / ads).
Users + payments + audit_logs + usage_counters survive.

Plan tier rename:
    free, starter, pro  →  free, pro, agency
Existing 'starter' plan rows are upgraded to 'pro' (it's a higher tier
in the new product), 'pro' rows become 'agency'.

New domain tables (all user-scoped, RLS):
    projects        : user-owned namespace for one Yandex Direct setup
    ad_accounts     : encrypted OAuth tokens to Yandex Direct
    agents          : one AI worker per project (advisor/assistant/auto)
    ai_runs         : execution log per agent
    audit_findings  : issues + opportunities + applied changes
    notifications   : user-facing event drops
    events          : decoupled event bus (finding.created, etc.)
    prompt_versions : versioned AI prompts so we can A/B + debug regressions

Dropped tables:
    subscriptions, ads, keywords, campaigns, kpi_snapshots,
    report_uploads, analyst_actions, upload_history.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_dozim_pivot"
down_revision: Union[str, None] = "0005_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Drop legacy ad-pipeline tables in dependency order.
    # ------------------------------------------------------------------
    op.execute("DROP POLICY IF EXISTS upload_history_owner_all ON upload_history")
    op.execute("ALTER TABLE IF EXISTS upload_history DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS upload_history CASCADE")

    op.execute("DROP TABLE IF EXISTS analyst_actions CASCADE")
    op.execute("DROP TABLE IF EXISTS report_uploads CASCADE")
    op.execute("DROP TABLE IF EXISTS kpi_snapshots CASCADE")
    op.execute("DROP TABLE IF EXISTS ads CASCADE")
    op.execute("DROP TABLE IF EXISTS keywords CASCADE")
    op.execute("DROP TABLE IF EXISTS campaigns CASCADE")
    op.execute("DROP TABLE IF EXISTS subscriptions CASCADE")

    # ------------------------------------------------------------------
    # users.plan: rename {free, starter, pro} → {free, pro, agency}.
    # ------------------------------------------------------------------
    op.drop_constraint("ck_users_plan_values", "users", type_="check")
    op.execute("UPDATE users SET plan = 'agency' WHERE plan = 'pro'")
    op.execute("UPDATE users SET plan = 'pro'    WHERE plan = 'starter'")
    op.create_check_constraint(
        "ck_users_plan_values",
        "users",
        "plan IN ('free', 'pro', 'agency')",
    )

    op.drop_constraint("ck_payments_plan_values", "payments", type_="check")
    op.execute("UPDATE payments SET plan = 'agency' WHERE plan = 'pro'")
    op.execute("UPDATE payments SET plan = 'pro'    WHERE plan = 'starter'")
    op.create_check_constraint(
        "ck_payments_plan_values",
        "payments",
        "plan IN ('pro', 'agency')",
    )

    # ------------------------------------------------------------------
    # projects: user-owned namespace.
    # ------------------------------------------------------------------
    op.create_table(
        "projects",
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
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_projects_user_id", "projects", ["user_id"])
    op.execute(
        """
        ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
        CREATE POLICY projects_owner_all ON projects
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # ad_accounts: encrypted Yandex Direct OAuth credentials.
    # ------------------------------------------------------------------
    op.create_table(
        "ad_accounts",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=False),
        # Fernet ciphertext; never logged.
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("meta", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint(
            "user_id",
            "provider",
            "external_id",
            name="uq_ad_accounts_user_provider_external",
        ),
        sa.CheckConstraint(
            "status IN ('active', 'expired', 'revoked', 'error')",
            name="ck_ad_accounts_status",
        ),
        sa.CheckConstraint(
            "provider IN ('yandex_direct')",
            name="ck_ad_accounts_provider",
        ),
    )
    op.create_index("ix_ad_accounts_project_id", "ad_accounts", ["project_id"])
    op.create_index("ix_ad_accounts_user_id", "ad_accounts", ["user_id"])
    op.execute(
        """
        ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ad_accounts_owner_all ON ad_accounts
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # agents
    # ------------------------------------------------------------------
    op.create_table(
        "agents",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "project_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "mode",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'advisor'"),
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'draft'"),
        ),
        # JSON brief: url/niche/audience/geo/notes/etc.
        sa.Column(
            "brief",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        # JSON KPI: cpa/ctr/romi/budget/goal/etc.
        sa.Column(
            "kpi",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        # Many-to-many → agent ⇄ ad_accounts kept as JSON list of UUIDs
        # for MVP; promote to a join table when there's a UI for partial
        # selections.
        sa.Column(
            "ad_account_ids",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "mode IN ('advisor', 'assistant', 'auto')",
            name="ck_agents_mode",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'active', 'paused', 'archived')",
            name="ck_agents_status",
        ),
    )
    op.create_index("ix_agents_user_id", "agents", ["user_id"])
    op.create_index("ix_agents_project_id", "agents", ["project_id"])
    op.create_index("ix_agents_next_run_at", "agents", ["next_run_at"])
    op.execute(
        """
        ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agents_owner_all ON agents
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # prompt_versions (created before ai_runs so the FK is satisfiable).
    # Each prompt the agent runner can use is a row.  Active prompt is
    # selected by (kind, is_active=true).  History is kept forever — tiny
    # rows, big debugging value when AI quality degrades.
    # ------------------------------------------------------------------
    op.create_table(
        "prompt_versions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("version", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=64), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("user_prompt_template", sa.Text(), nullable=False),
        sa.Column(
            "params",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("kind", "version", name="uq_prompt_versions_kind_version"),
    )
    op.create_index(
        "uq_prompt_versions_active_per_kind",
        "prompt_versions",
        ["kind"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    # ------------------------------------------------------------------
    # ai_runs
    # ------------------------------------------------------------------
    op.create_table(
        "ai_runs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'running'"),
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "stats",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("error", sa.Text(), nullable=True),
        # Track which prompt version produced this run (NULL allowed for
        # bootstrap and for runs that don't call AI at all).
        sa.Column(
            "prompt_version_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("prompt_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.CheckConstraint(
            "status IN ('running', 'succeeded', 'failed', 'canceled')",
            name="ck_ai_runs_status",
        ),
    )
    op.create_index("ix_ai_runs_agent_started", "ai_runs", ["agent_id", sa.text("started_at DESC")])
    op.create_index("ix_ai_runs_user_id", "ai_runs", ["user_id"])
    op.execute(
        """
        ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY ai_runs_owner_all ON ai_runs
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # audit_findings
    # ------------------------------------------------------------------
    op.create_table(
        "audit_findings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("ai_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "agent_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("agents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column(
            "severity",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'info'"),
        ),
        sa.Column("campaign_external_id", sa.String(length=64), nullable=True),
        sa.Column("ad_external_id", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("effect", sa.Text(), nullable=True),
        sa.Column(
            "suggested_action",
            postgresql.JSONB(),
            nullable=True,
        ),
        sa.Column(
            "confidence",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("50"),
        ),
        sa.Column(
            "state",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'new'"),
        ),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "kind IN ('issue', 'opportunity', 'applied')",
            name="ck_audit_findings_kind",
        ),
        sa.CheckConstraint(
            "severity IN ('critical', 'warning', 'info', 'opportunity')",
            name="ck_audit_findings_severity",
        ),
        sa.CheckConstraint(
            "state IN ('new', 'approved', 'applied', 'rejected')",
            name="ck_audit_findings_state",
        ),
        sa.CheckConstraint(
            "confidence BETWEEN 0 AND 100",
            name="ck_audit_findings_confidence",
        ),
    )
    op.create_index("ix_audit_findings_run", "audit_findings", ["run_id"])
    op.create_index("ix_audit_findings_user_state", "audit_findings", ["user_id", "state"])
    op.execute(
        """
        ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
        CREATE POLICY audit_findings_owner_all ON audit_findings
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # notifications
    # ------------------------------------------------------------------
    op.create_table(
        "notifications",
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
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_notifications_user_unread",
        "notifications",
        ["user_id", sa.text("created_at DESC")],
        postgresql_where=sa.text("read_at IS NULL"),
    )
    op.execute(
        """
        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
        CREATE POLICY notifications_owner_all ON notifications
          FOR ALL USING (user_id = public.current_app_user_id())
          WITH CHECK (user_id = public.current_app_user_id());
        """
    )

    # ------------------------------------------------------------------
    # events: lightweight event bus persisted for replay + analytics.
    #
    # Future consumers (AI memory, retraining, autonomous flows) read
    # this table via offset cursor; we don't ship a Kafka in MVP.
    # Names: domain.action — finding.created, agent.launched, etc.
    # ------------------------------------------------------------------
    op.create_table(
        "events",
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
            nullable=True,
        ),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column(
            "subject_type",
            sa.String(length=32),
            nullable=True,
        ),
        sa.Column(
            "subject_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "payload",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_events_name_created", "events", ["name", sa.text("created_at DESC")])
    op.create_index("ix_events_user_created", "events", ["user_id", sa.text("created_at DESC")])
    op.create_index("ix_events_subject", "events", ["subject_type", "subject_id"])
    # No RLS: events are read by both the user (their own) and admin
    # surfaces (cross-user analytics).  Per-user filtering happens at
    # query time; admin reads use the admin session.

    # No RLS on prompt_versions: prompts are global (admin-managed,
    # no per-user data).

    # ------------------------------------------------------------------
    # Seed the default audit prompt so agent runs have something to use.
    # ------------------------------------------------------------------
    op.execute(
        """
        INSERT INTO prompt_versions (kind, version, model, system_prompt, user_prompt_template, params, notes)
        VALUES (
            'audit.findings',
            'v1',
            'gpt-4o-mini',
            'Ты — старший аналитик контекстной рекламы. Возвращаешь JSON-массив '
              || 'findings: title, severity, effect, suggested_action, confidence (0-100).',
            'Аккаунт {account_id}. Кампании и метрики:\n{data}\n\nKPI цели: {kpi}.\nБриф: {brief}.',
            '{"temperature": 0.2}'::jsonb,
            'Initial bootstrap prompt for the agent runner.'
        )
        ON CONFLICT (kind, version) DO NOTHING;
        """
    )


def downgrade() -> None:
    # Pivot is not designed to be reverted in a running prod; a downgrade
    # path exists only to keep alembic happy.  Drops new tables; does
    # not recreate the legacy schema.
    op.execute("DROP TABLE IF EXISTS prompt_versions CASCADE")

    op.execute("DROP INDEX IF EXISTS ix_events_subject")
    op.execute("DROP INDEX IF EXISTS ix_events_user_created")
    op.execute("DROP INDEX IF EXISTS ix_events_name_created")
    op.execute("DROP TABLE IF EXISTS events CASCADE")

    op.execute("DROP POLICY IF EXISTS notifications_owner_all ON notifications")
    op.execute("ALTER TABLE IF EXISTS notifications DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS notifications CASCADE")

    op.execute("DROP POLICY IF EXISTS audit_findings_owner_all ON audit_findings")
    op.execute("ALTER TABLE IF EXISTS audit_findings DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS audit_findings CASCADE")

    op.execute("DROP POLICY IF EXISTS ai_runs_owner_all ON ai_runs")
    op.execute("ALTER TABLE IF EXISTS ai_runs DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS ai_runs CASCADE")

    op.execute("DROP POLICY IF EXISTS agents_owner_all ON agents")
    op.execute("ALTER TABLE IF EXISTS agents DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS agents CASCADE")

    op.execute("DROP POLICY IF EXISTS ad_accounts_owner_all ON ad_accounts")
    op.execute("ALTER TABLE IF EXISTS ad_accounts DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS ad_accounts CASCADE")

    op.execute("DROP POLICY IF EXISTS projects_owner_all ON projects")
    op.execute("ALTER TABLE IF EXISTS projects DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS projects CASCADE")

    op.drop_constraint("ck_payments_plan_values", "payments", type_="check")
    op.execute("UPDATE payments SET plan = 'starter' WHERE plan = 'pro'")
    op.execute("UPDATE payments SET plan = 'pro'     WHERE plan = 'agency'")
    op.create_check_constraint(
        "ck_payments_plan_values",
        "payments",
        "plan IN ('starter', 'pro')",
    )

    op.drop_constraint("ck_users_plan_values", "users", type_="check")
    op.execute("UPDATE users SET plan = 'starter' WHERE plan = 'pro'")
    op.execute("UPDATE users SET plan = 'pro'     WHERE plan = 'agency'")
    op.create_check_constraint(
        "ck_users_plan_values",
        "users",
        "plan IN ('free', 'starter', 'pro')",
    )
