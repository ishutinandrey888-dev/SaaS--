-- =====================================================================
-- Restricted Postgres role for user-scoped queries.
--
-- Why this exists:
--   Supabase's default `postgres` role (used via the service-role key)
--   has BYPASSRLS.  Any connection via that role ignores RLS policies
--   entirely, which means `SET LOCAL request.jwt.claim.sub = '…'` is
--   completely ineffective — Postgres still returns every row.
--
--   To make RLS actually enforce isolation, the backend needs a SECOND
--   connection as a role that does **not** own tables and does **not**
--   bypass RLS.  That's this script.
--
-- Run this ONCE per environment, in the Supabase SQL editor or via
-- any psql session connected as the project owner.  Re-running is safe
-- (all statements are IF-NOT-EXISTS / idempotent).
--
-- After running, put the new role's credentials into DATABASE_URL_USER.
-- =====================================================================

-- Set a strong password for the restricted role.  Generate with e.g.
--   python -c 'import secrets; print(secrets.token_urlsafe(32))'
-- and keep it out of git.
\set app_user_password `echo "${APP_USER_PASSWORD:?set APP_USER_PASSWORD env var}"`

-- --- Role ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD :'app_user_password'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION
      NOBYPASSRLS;
  ELSE
    ALTER ROLE app_user WITH PASSWORD :'app_user_password' NOBYPASSRLS;
  END IF;
END $$;

-- Important: app_user must NOT own any tables in public, otherwise
-- ownership would let it bypass its own RLS.  The project's `postgres`
-- role owns the schema; app_user merely has DML rights.

-- --- Grants ----------------------------------------------------------
GRANT USAGE ON SCHEMA public TO app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_user;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Same grants for any future tables / sequences / functions created by
-- the default migration owner (postgres).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON FUNCTIONS TO app_user;

-- Explicitly deny dangerous bits.
REVOKE CREATE ON SCHEMA public FROM app_user;

-- --- Sanity check ---------------------------------------------------
-- Expect: rolbypassrls = false
SELECT rolname, rolbypassrls, rolsuper, rolcreatedb
FROM pg_roles
WHERE rolname = 'app_user';

-- Expect: policies + RLS enabled for each user-scoped table (already
-- set up by Alembic migration 0002_rls_policies).
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('users','campaigns','keywords','ads','kpi_snapshots',
                    'report_uploads','analyst_actions','audit_logs',
                    'subscriptions')
ORDER BY tablename;
