# Raqeeb — رقيب

**A unified work, project & resource management platform**, built as a commercial multi-tenant
SaaS. Raqeeb combines the strongest ideas of ClickUp, Asana, monday.com, Wrike, Forecast, and
Teamwork.com in one product: deep work management for companies **and** the client/financial
layer agencies need — bilingual (English + Arabic, full RTL) from day one.

> 📘 The full product blueprint lives in [`docs/`](./docs/README.md): competitive analysis of all
> six products, PRDs, the unified domain model (D1–D10), architecture, API design, SaaS
> commercial layer, and the Phase 0–7 roadmap.

## ▶️ Continuing this project (CLI, desktop, web — anywhere)

This repo is fully self-contained. To resume work in a new session:

1. **[STATUS.md](./STATUS.md)** — where the project stands, what's next, fresh-clone setup,
   dev logins and API token.
2. **[CLAUDE.md](./CLAUDE.md)** — commands and the invariants no change may break
   (loaded automatically by Claude Code).
3. In the repo, just say: **"Read STATUS.md and continue with the next roadmap item."**

## Monorepo layout

```
apps/api        NestJS modular monolith — REST API /api/v1 (JWT sessions + raq_pat_* tokens)
apps/worker     BullMQ worker — transactional-outbox publisher, queue scaffold
apps/web        Next.js App Router — English + Arabic (RTL), Tailwind (logical properties only)
packages/db     Drizzle schema (source of truth), SQL migrations incl. RLS, withTenant(), seed
packages/contracts  Zod schemas shared api ↔ web ↔ worker
packages/i18n   Message catalogs (en/ar, ICU) + locale helpers
packages/config Shared tsconfig presets
docs/           Product blueprint (48 documents)
```

## Quick start

Prereqs: Node ≥ 22, pnpm ≥ 10, Docker.

```bash
pnpm install
docker compose up -d          # Postgres 16 (+ RLS roles), Redis, Mailpit
pnpm db:migrate               # applies migrations incl. RLS policies (owner role)
pnpm db:seed                  # demo tenants: raqeeb-demo (en) + alufq (ar) — prints a smoke PAT
pnpm --filter @raqeeb/api build && pnpm --filter @raqeeb/api start   # :4000
pnpm --filter @raqeeb/web build && pnpm --filter @raqeeb/web start   # :3000
```

Sign in at `http://localhost:3000` with `owner@raqeeb.dev` / `password123`
(also `sara@raqeeb.dev`, `client@acme.example`). Copy `.env.example` to `.env` for
customization; the defaults match docker-compose.

### Try the public API

```bash
PAT=raq_pat_devseed_2f8c1b6a9d4e037   # printed by pnpm db:seed
curl -H "Authorization: Bearer $PAT" localhost:4000/api/v1/projects
```

## Tenancy security model (the part you must not break)

- Every tenant table has `tenant_id` + a `FORCE ROW LEVEL SECURITY` policy.
- The API/worker connect as **`raqeeb_app`** (no BYPASSRLS). All tenant queries go through
  `withTenant(tenantId, fn)` from `@raqeeb/db`, which wraps a transaction and
  `SET LOCAL app.current_tenant_id`.
- Outside that context, queries see **zero rows** (fail closed).
- Cross-tenant identity/provisioning/billing operations use the **`raqeeb_system`** role
  (BYPASSRLS) — only where documented in `docs/04-architecture/02-tenancy-rls.md`.
- `packages/db/test/rls.test.ts` is the isolation proof and runs in CI. Keep it green.

## Development

```bash
pnpm lint         # eslint across all packages
pnpm typecheck
pnpm test         # includes the RLS isolation suite (needs the DB up + migrated)
pnpm build
```

## Status

Phase 0 scaffold (see `docs/07-roadmap/02-scaffold-scope.md` for the contract, and
`docs/07-roadmap/01-roadmap.md` for Phases 1–7: Stripe billing & entitlements, work-engine
depth, time & financials, scheduling & resources, automations & client portal, portfolio
layer, enterprise & AI).
