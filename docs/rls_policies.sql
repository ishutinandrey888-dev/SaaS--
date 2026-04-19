-- =====================================================================
-- Row-Level Security policies for Supabase (apply via SQL editor).
-- Equivalent to Alembic migration 0002_rls_policies.py, provided as a
-- standalone script for convenience.
--
-- Model:
--   * Every request from an authenticated Supabase client includes the
--     user's JWT.  Postgres exposes claims under `request.jwt.claim.*`.
--   * `current_app_user_id()` returns the `sub` claim as uuid.
--   * Backend service role (SUPABASE_SERVICE_KEY) bypasses RLS, so our
--     FastAPI workers are unaffected by these policies.
-- =====================================================================

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

-- KEYWORDS ------------------------------------------------------------
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

-- ADS -----------------------------------------------------------------
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

-- KPI SNAPSHOTS -------------------------------------------------------
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

-- REPORT UPLOADS ------------------------------------------------------
ALTER TABLE report_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_uploads_owner_all ON report_uploads;
CREATE POLICY report_uploads_owner_all ON report_uploads
  FOR ALL USING (user_id = public.current_app_user_id())
  WITH CHECK (user_id = public.current_app_user_id());

-- ANALYST ACTIONS -----------------------------------------------------
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

-- LOGIN ATTEMPTS (service-role only) ----------------------------------
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: client role has no access.

-- AUDIT LOGS (append-only, owner may read their own) ------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_owner_select ON audit_logs;
CREATE POLICY audit_logs_owner_select ON audit_logs
  FOR SELECT USING (user_id = public.current_app_user_id());
-- no INSERT/UPDATE/DELETE policies: client role cannot write or modify.
