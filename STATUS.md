# Raqeeb — Project Status

*Session handoff document — everything needed to continue from a fresh clone, any time,
anywhere. Updated: 2026-08-22.*

## Where things stand

| Phase (docs/07-roadmap/01-roadmap.md) | State |
|---|---|
| Phase 0 — Scaffold (monorepo, RLS tenancy, work engine core, en/ar web app, worker, CI) | ✅ shipped & verified |
| P1 — SaaS commercial core (Stripe billing, entitlement guards, rate limiting, past_due read-only) | ✅ shipped & hardened |
| P2 — Work engine depth | 🟡 partial: comments + public webhooks + Board view + task drawer + app shell done; **remaining: saved views, Table/Calendar, My Work, notifications + Inbox, attachments, realtime UI (Socket.IO), Postgres FTS, invitation acceptance flow** |
| P3 — Time & financials | ⬜ next major phase (schema specified in docs/03-domain-model/03-schema-reference.md Wave B) |
| P4–P7 — Scheduling/resources, automations/intake/client portal, portfolio layer, enterprise & AI | ⬜ specified in docs, not started |

Quality state: lint/typecheck/build green; **62 tests** green (6 RLS isolation + 56 API incl.
billing dedupe, guards, comments, webhook pipeline, SSRF, seat-invariant CHECK); browser smoke
11/11 (v1) and 8/8 (v2 UI) in English AND Arabic RTL. A 26-agent adversarial review (tenancy,
correctness, security, resilience) ran over the P1+P2 slice; every confirmed finding is fixed
(see commit `148cdbb` for the list).

## Continue from a fresh clone

```bash
pnpm install && docker compose up -d && pnpm db:migrate && pnpm db:seed
pnpm --filter @raqeeb/api build && pnpm --filter @raqeeb/api start   # :4000
pnpm --filter @raqeeb/web build && pnpm --filter @raqeeb/web start   # :3000
```
Logins: `owner@raqeeb.dev` / `password123` · seeded PAT `raq_pat_devseed_2f8c1b6a9d4e037`.
No Docker? Local Postgres 16 + Redis work: create role/db per docker/postgres-init/01-app-role.sql
(migrate creates the runtime roles idempotently), then the same commands.

## Read in this order when resuming

1. `CLAUDE.md` — invariants and commands (do-not-break list).
2. `docs/README.md` — blueprint map; `docs/01-competitive-analysis/07-feature-matrix.md` is the
   build queue (capability → v1/v2/v3).
3. `docs/07-roadmap/01-roadmap.md` — phase goals + exit criteria; pick the next unchecked item
   from the P2-remaining list above or start P3.

## Known deferred items (deliberate, documented)

- Invitation **acceptance** endpoint not built yet (invites are created + tokenized; acceptance
  must call `SeatSyncService.syncSeats` — note in apps/api/src/tenants/tenants.service.ts).
- Comment deletions emit no outbox event yet (`comment.deleted` — add with realtime UI).
- Rate limits are fixed-window per plan tier; token-bucket + per-token sub-limits per
  docs/05-api-design/05-versioning-rate-limits.md are a P2 refinement.
- Webhook secret stored plaintext at rest (KMS envelope encryption is a P7 hardening item).
- Web session tokens in localStorage (httpOnly-cookie migration scheduled with P1 polish).
- Stripe runs the deterministic fake driver until STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET are
  set (both required together — boot fails closed otherwise).

## Session history (this branch)

Six commits, each a verified milestone: bootstrap (tooling + RLS db + docs) → tasks API →
web/worker/CI scaffold complete → Phase 1 groundwork → Phase 1+2 slice (5-agent parallel build)
→ adversarial-review hardening. The blueprint docs (48 files) were produced from primary-source
research of all six competitors' official + developer documentation.
