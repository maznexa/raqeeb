# Raqeeb — instructions for AI sessions and new contributors

Raqeeb (رقيب) is a commercial multi-tenant SaaS Work OS combining the best of ClickUp, Asana,
monday.com, Wrike, Forecast, and Teamwork — for internal teams AND agencies, bilingual
English/Arabic (full RTL). Current state and next steps: see **STATUS.md**. Product truth lives
in **docs/** (start at docs/README.md); the 134-row feature matrix in
docs/01-competitive-analysis/07-feature-matrix.md decides what gets built and when.

## Commands

```bash
pnpm install
docker compose up -d            # Postgres 16, Redis, Mailpit (or use local PG16 + redis-server)
pnpm db:migrate                 # owner role; applies SQL migrations incl. RLS; idempotent
pnpm db:seed                    # demo tenants; prints the smoke-test PAT
pnpm lint && pnpm typecheck && pnpm build
pnpm test                       # needs migrated PG + Redis; includes the RLS isolation suite
pnpm --filter @raqeeb/api start     # :4000 (env: see .env.example)
pnpm --filter @raqeeb/web start     # :3000 (NEXT_PUBLIC_API_URL=http://localhost:4000)
pnpm --filter @raqeeb/worker start  # outbox publisher, webhook delivery, reconciliation
```

Dev logins: `owner@raqeeb.dev` / `password123` (also sara@…, client@acme.example).
Seeded API token: `raq_pat_devseed_2f8c1b6a9d4e037` (tenant raqeeb-demo).

## Invariants — do not break these

1. **RLS is the tenancy boundary.** Every tenant-scoped query goes through
   `withTenant(tenantId, fn)` from `@raqeeb/db` (transaction + `SET LOCAL app.current_tenant_id`).
   `systemDb()` (BYPASSRLS) is allowed ONLY for the operations listed in
   `packages/db/src/client.ts` (identity, provisioning, billing, webhook fanout/delivery,
   reconciliation). Worker jobs re-enter tenant context via `tenantProcessor`. The test class
   `packages/db/test/rls.test.ts` must stay green — never weaken it.
2. **Schema changes**: edit `packages/db/src/schema/*`, run
   `pnpm --filter @raqeeb/db generate`, then hand-append RLS (`ENABLE`/`FORCE ROW LEVEL SECURITY`
   + `tenant_isolation` policy, pattern in migrations/0000) for any new tenant table. New tenant
   tables always carry `tenant_id` with composite indexes leading on it.
3. **Domain decisions D1–D10** (docs/03-domain-model/02-decisions.md) are settled: multi-homing
   via task_locations, canonical status groups, fractional-indexing TEXT positions (never expose
   raw keys — API takes insert_before/after ids), effort ≠ duration ≠ assignment ≠ allocation,
   global accounts + per-tenant memberships. Clients/guests NEVER occupy billable seats
   (DB CHECK enforces it).
4. **RTL parity** (docs/04-architecture/06-i18n-rtl.md): Tailwind logical utilities only
   (ms-*/me-*/ps-*/pe-*/start-*/end-*), every string in BOTH packages/i18n/messages/en.json and
   ar.json (natural Arabic), test views in `dir=rtl`.
5. **UI bar** (docs/00-vision/03-ui-ux-principles.md): ClickUp density + monday color language,
   optimistic updates with rollback, drawers not page navigations, skeletons not spinners.
6. **Billing fails closed**: a real STRIPE_SECRET_KEY without STRIPE_WEBHOOK_SECRET must refuse
   to boot; never reintroduce unverified webhook parsing. Webhook delivery keeps its SSRF guard
   (https + public-address check at delivery time).
7. **Anti-patterns** (docs/01-competitive-analysis/08-anti-patterns.md) are binding: no
   automation mass-pausing, no seat minimums, custom statuses on every tier, data never hostage
   (past_due = read-only, export always works).

## Layout

apps/api (NestJS modular monolith, global guards Auth→RateLimit→ReadOnly), apps/worker
(outbox → Redis pub/sub; webhook fanout/delivery; seat reconciliation; retention), apps/web
(Next.js App Router + next-intl), packages/db (Drizzle schema = source of truth, withTenant),
packages/contracts (shared Zod schemas), packages/i18n (message catalogs).

## Verification bar for any change

lint + typecheck + build + `pnpm test` green (RLS suite included), and for API/UI changes a
runtime smoke: signup → provision → project → create/status/reorder task, in `en` AND `ar`,
plus the same via curl with a PAT. Commit and push to the working branch as milestones land —
the repo must always be resumable from a fresh clone.
