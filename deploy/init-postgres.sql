-- =====================================================================
-- Bootstrap for the LOCAL DEMO compose stack.
--
-- The app expects two roles on the same database:
--   * postgres  — BYPASSRLS owner, used for migrations / admin writes.
--   * app_user  — NOBYPASSRLS, used by user-scoped routes so that
--                 Row-Level Security policies actually apply.
--
-- This file is mounted into /docker-entrypoint-initdb.d/ on the
-- Postgres image; it runs automatically the FIRST time the database
-- cluster is created (i.e. on an empty volume).  Re-run by deleting
-- the volume:  `docker compose down -v`.
--
-- The password is hardcoded to "postgres" for local demo only — do
-- NOT ship this file to any internet-reachable deployment.  Prod uses
-- Supabase's managed roles (see docs/db-roles.sql).
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'postgres'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

-- DML access to all current + future objects in `public`.
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO app_user;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE                        ON FUNCTIONS TO app_user;

REVOKE CREATE ON SCHEMA public FROM app_user;

-- pgcrypto is required by the 0001 migration (gen_random_uuid()).
CREATE EXTENSION IF NOT EXISTS pgcrypto;
