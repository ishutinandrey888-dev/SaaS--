"""row-level security policies

Revision ID: 0002_rls_policies
Revises: 0001_initial
Create Date: 2026-04-19

Apply Postgres RLS so Supabase clients (authenticated via JWT) can only
see rows that belong to them.  The backend service role bypasses RLS.

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_rls_policies"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


POLICY_SQL = """
-- Helper: derive current user id from the Supabase JWT "sub" claim.
CREATE OR REPLACE FUNCTION public.current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- USERS ---------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users
  FOR SELECT USING (id = public.current_app_user_id());
DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users
  FOR UPDATE USING (id = public.current_app_user_id());

-- SUBSCRIPTIONS -------------------------------------------------------
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_owner_all ON subscriptions;
CREATE POLICY subscriptions_owner_all ON subscriptions
  FOR ALL USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- CAMPAIGNS -----------------------------------------------------------
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campaigns_owner_all ON campaigns;
CREATE POLICY campaigns_owner_all ON campaigns
  FOR ALL USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- Child tables: access through campaign ownership ---------------------
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS keywords_owner_all ON keywords;
CREATE POLICY keywords_owner_all ON keywords
  FOR ALL USING (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = keywords.campaign_id
              AND c.user_id = public.current_app_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = keywords.campaign_id
              AND c.user_id = public.current_app_user_id())
  );

ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ads_owner_all ON ads;
CREATE POLICY ads_owner_all ON ads
  FOR ALL USING (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = ads.campaign_id
              AND c.user_id = public.current_app_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = ads.campaign_id
              AND c.user_id = public.current_app_user_id())
  );

ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kpi_snapshots_owner_all ON kpi_snapshots;
CREATE POLICY kpi_snapshots_owner_all ON kpi_snapshots
  FOR ALL USING (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = kpi_snapshots.campaign_id
              AND c.user_id = public.current_app_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = kpi_snapshots.campaign_id
              AND c.user_id = public.current_app_user_id())
  );

ALTER TABLE report_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS report_uploads_owner_all ON report_uploads;
CREATE POLICY report_uploads_owner_all ON report_uploads
  FOR ALL USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

ALTER TABLE analyst_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analyst_actions_owner_all ON analyst_actions;
CREATE POLICY analyst_actions_owner_all ON analyst_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = analyst_actions.campaign_id
              AND c.user_id = public.current_app_user_id())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns c
            WHERE c.id = analyst_actions.campaign_id
              AND c.user_id = public.current_app_user_id())
  );

-- login_attempts: only service role (no RLS policies) -----------------
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
"""


DROP_SQL = """
ALTER TABLE IF EXISTS login_attempts DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS analyst_actions_owner_all ON analyst_actions;
ALTER TABLE IF EXISTS analyst_actions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_uploads_owner_all ON report_uploads;
ALTER TABLE IF EXISTS report_uploads DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_snapshots_owner_all ON kpi_snapshots;
ALTER TABLE IF EXISTS kpi_snapshots DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ads_owner_all ON ads;
ALTER TABLE IF EXISTS ads DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS keywords_owner_all ON keywords;
ALTER TABLE IF EXISTS keywords DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaigns_owner_all ON campaigns;
ALTER TABLE IF EXISTS campaigns DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscriptions_owner_all ON subscriptions;
ALTER TABLE IF EXISTS subscriptions DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_update ON users;
DROP POLICY IF EXISTS users_self_select ON users;
ALTER TABLE IF EXISTS users DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS public.current_app_user_id();
"""


def upgrade() -> None:
    op.execute(POLICY_SQL)


def downgrade() -> None:
    op.execute(DROP_SQL)
