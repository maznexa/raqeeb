import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Owner role: migrations only. Runtime uses DATABASE_URL (raqeeb_app, RLS-bound).
    url: process.env.DATABASE_URL_OWNER ?? 'postgres://raqeeb:raqeeb@localhost:5432/raqeeb',
  },
  strict: true,
  verbose: true,
});
