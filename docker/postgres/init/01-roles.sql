-- Runs once on first container start.
-- Creates the RLS-subject application role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'beauty_app') THEN
    CREATE ROLE beauty_app WITH LOGIN PASSWORD 'app_password_dev';
  END IF;
END
$$;

-- Ensure the role does NOT bypass RLS.
ALTER ROLE beauty_app NOBYPASSRLS NOSUPERUSER;

GRANT CONNECT ON DATABASE beauty_platform TO beauty_app;
GRANT USAGE ON SCHEMA public TO beauty_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO beauty_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO beauty_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO beauty_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO beauty_app;
