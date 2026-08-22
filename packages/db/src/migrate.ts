import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

/**
 * Migration runner. Connects as the OWNER role and:
 *  1. ensures the runtime roles exist (idempotent — CI's postgres service has no init script),
 *  2. applies drizzle migrations (plain SQL files in ./migrations, RLS included),
 *  3. re-applies grants so raqeeb_app / raqeeb_system can reach the new tables.
 */
const ownerUrl = process.env.DATABASE_URL_OWNER ?? 'postgres://raqeeb:raqeeb@localhost:5432/raqeeb';

const ROLE_SETUP = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'raqeeb_app') THEN
    CREATE ROLE raqeeb_app LOGIN PASSWORD 'raqeeb_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'raqeeb_system') THEN
    CREATE ROLE raqeeb_system LOGIN PASSWORD 'raqeeb_system' NOSUPERUSER NOCREATEDB NOCREATEROLE BYPASSRLS;
  END IF;
END
$$;
`;

const GRANTS = `
GRANT USAGE ON SCHEMA public TO raqeeb_app, raqeeb_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO raqeeb_app, raqeeb_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO raqeeb_app, raqeeb_system;
`;

async function main() {
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  const db = drizzle(pool);
  const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

  console.log('[migrate] ensuring runtime roles…');
  await pool.query(ROLE_SETUP);

  console.log(`[migrate] applying migrations from ${migrationsFolder}…`);
  await migrate(db, { migrationsFolder });

  console.log('[migrate] applying grants…');
  await pool.query(GRANTS);

  await pool.end();
  console.log('[migrate] done.');
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
