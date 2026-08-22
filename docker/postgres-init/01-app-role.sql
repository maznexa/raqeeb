-- Runtime application role: NOT the table owner, no BYPASSRLS.
-- FORCE ROW LEVEL SECURITY on tenant tables only binds against non-owner roles,
-- so api/worker must connect as raqeeb_app (see .env.example DATABASE_URL).
CREATE ROLE raqeeb_app LOGIN PASSWORD 'raqeeb_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
-- System role: BYPASSRLS escape hatch for cross-tenant identity/provisioning/billing
-- operations only (see packages/db/src/client.ts). Never used for tenant business queries.
CREATE ROLE raqeeb_system LOGIN PASSWORD 'raqeeb_system' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
GRANT CONNECT ON DATABASE raqeeb TO raqeeb_app, raqeeb_system;
\connect raqeeb
GRANT USAGE ON SCHEMA public TO raqeeb_app, raqeeb_system;
-- Table/sequence grants are (re)applied idempotently by the migrate script;
-- these defaults cover tables created later by the owner role.
ALTER DEFAULT PRIVILEGES FOR ROLE raqeeb IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO raqeeb_app, raqeeb_system;
ALTER DEFAULT PRIVILEGES FOR ROLE raqeeb IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO raqeeb_app, raqeeb_system;
