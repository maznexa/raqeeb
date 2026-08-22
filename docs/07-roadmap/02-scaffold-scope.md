# Phase 0 — Scaffold Scope (Definition of Runnable)

> **Status:** Accepted, normative. This document is the contract for the Phase 0
> deliverable: exactly what ships, exactly what does not, and the runnable test that
> decides "done".

## Monorepo layout

pnpm workspaces + Turborepo:

```
apps/api        NestJS modular monolith (HTTP /api/v1 + Socket.IO stub)
apps/worker     thin BullMQ bootstrap importing processors from api modules
apps/web        Next.js App Router · next-intl (en/ar) · Tailwind + Radix/shadcn · logical CSS only
packages/db     Drizzle schema (source of truth) · SQL migrations incl. RLS · seed · withTenant()
packages/contracts  Zod schemas + inferred types (api ↔ web ↔ worker) · OpenAPI emitted
packages/i18n   en.json / ar.json catalogs + ICU helpers (6 Arabic plural categories)
packages/config shared tsconfig / eslint / prettier / stylelint
docker-compose.yml   postgres:16 (with raqeeb_app non-owner role) · redis:7 · mailpit
turbo.json · .github/workflows/ci.yml
```

## Wave A tables (20)

`plans, accounts, tenants, memberships, invitations, spaces, folders, projects,
sections, workflows, statuses, item_types, tasks, task_locations, task_assignees,
task_dependencies, clients, personal_access_tokens, audit_logs, outbox_events`

Per `docs/03-domain-model/03-schema-reference.md`: RLS (FORCE) on all tenant tables with
the scalar-subselect policy pattern; `accounts`/`plans` global; composite indexes
leading with `tenant_id`; fractional TEXT positions; UUIDv7 ids. Migrations are
hand-edited SQL carrying the RLS/index/trigger DDL in the same files.

## Module list (apps/api)

| Module | Scaffold scope |
| --- | --- |
| Core | Zod env config, pino, `/healthz`, exception filter (problem+json), request-id |
| Database | pool, `withTenant()` / `withSystem()`, AsyncLocalStorage tx context |
| Auth | argon2id signup/login, JWT access (15 m) + rotating refresh (30 d), guards; Google SSO stub |
| Tenants | provisioning + slug rules + seed defaults, slug/header middleware, memberships CRUD, invitations (Mailpit) |
| Entitlements | plans access + `check(tenant, feature)` facade (gates activate in P1) |
| Spaces | CRUD + ordering + privacy flag |
| Projects | folders (≤ 5 deep), projects (key, counter, client link, workflow binding), sections |
| Tasks | CRUD, multi-homing (locations incl. primary rules), assignees, status transitions (+`completed_at`), fractional reorder with retry, subtasks, dependencies w/ cycle rejection |
| Workflows | library CRUD, canonical-group validation |
| Clients | CRUD |
| Audit | async interceptor → audit_logs |
| Events | outbox writes + stub Socket.IO broadcast (poller + rooms wired, no UI consumption yet) |
| ApiPublic | PAT create/list/revoke + Bearer auth; public API = the same controllers |

Stripe billing: **docs-specified now (P1 implementation)** — schema hooks only.

## Seed contents

- Tenant 1: **"Raqeeb Demo"** (`raqeeb-demo`, locale `en`).
- Tenant 2: **Arabic-named tenant** (e.g. "شركة رقيب للتقنية", slug `raqeeb-ar`, locale
  `ar`) — exists specifically to force RTL through every screen and to make the RLS
  suite's cross-tenant checks meaningful.
- 3 accounts with **cross-tenant memberships** (one account belongs to both tenants —
  exercises D9's one-login-N-tenants path), roles covering owner/admin/member.
- Default workflow: Backlog / In Progress / In Review / Done / Cancelled with correct
  canonical groups; system item types (Task, Milestone, Approval).
- 2 projects per tenant shape: one **client-linked** (seeded client row), one internal;
  sections seeded.
- ~15 tasks including: one **multi-homed** task (two locations, one primary), one
  **milestone**, one **dependency chain** (3 tasks, FS), several assignees incl. a
  multi-assignee task, Arabic-language task titles in tenant 2.
- One seeded **PAT** per tenant (printed by the seed script) for the curl walkthrough.

## CI gates (`.github/workflows/ci.yml`)

Install → lint (eslint + stylelint logical-properties ban + i18n catalog checks) →
typecheck → **migration drift check** (`drizzle-kit check`) → migrate against service
Postgres → unit tests → **RLS isolation suite** → build.

The RLS isolation suite is **non-negotiable and ships in the scaffold**: for every
tenant-scoped table, tenant A context cannot read or write tenant B rows; unset context
returns zero rows; the canary asserts every `tenant_id`-bearing table has FORCE RLS +
policy (details: `docs/04-architecture/02-tenancy-rls.md`).

## Definition of runnable (the acceptance test)

From a fresh clone:

```
docker compose up -d && pnpm install && pnpm db:migrate && pnpm db:seed && pnpm dev
```

Then **all** of the following succeed:

1. **Browser (en):** signup → tenant auto-provisioned (slug rules enforced) → open the
   seeded project → create a task → change its status (Backlog → In Progress → Done;
   `completed_at` set) → drag-reorder it (fractional key, no full-list rewrite).
2. **Browser (ar):** the same flow in Arabic — RTL layout renders correctly (logical
   properties, flipped directional icons, Arabic plurals in the task counter).
3. **curl + PAT:** using the seeded PAT with `X-Raqeeb-Tenant`:
   list projects → create a task → move it between sections → **add a second location**
   (multi-home) → attempt any of it against the *other* tenant's slug → `404/403`.
4. **CI is green** on the branch, including the RLS isolation suite.

If any step fails, Phase 0 is not done — there is no partial credit.

## Explicitly OUT of scaffold scope

Deferred with their phase, not silently missing:

- **Board view** (and Table/Calendar) — P2; scaffold ships list interactions only.
- **Comments** / mentions / activity feed — P2.
- **Realtime UI consumption** — P2 (outbox + Socket.IO stub exist; the web app does not
  yet subscribe).
- **Stripe billing** — P1 (schema hooks + docs only).
- Custom fields, saved views, notifications, attachments/uploads — P2.
- Time tracking & all financials — P3. Allocations/work schedules — P4.
- Automations, forms, client portal, proofing — P5. Dashboards/portfolios/goals — P6.
- SSO (beyond the Google stub), SCIM, audit UI, OAuth2, MCP, AI — P7.
- Custom CNAME domains, mobile apps, GraphQL, Yjs/CRDT docs, Meilisearch,
  schema-per-tenant/BYOK — deferred per the build plan's deviation list.

Scope creep into this list requires editing this document first — that is the point of
having it.
