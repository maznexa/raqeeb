# Tenant Lifecycle

> **Status:** Accepted. Provisioning ships in the Wave A scaffold (signup → tenant
> auto-provisioned is part of the definition of runnable); export/deletion jobs land
> with P1; enterprise isolation options are documented here and built in P7.

## Provisioning

Flow: signup (`POST /auth/signup` with tenant block, or `POST /tenants` from an existing
account) → validate slug → create tenant + owner membership → seed defaults → ready.
Provisioning is a single `withTenant` transaction after the tenant row exists (target:
< 3 s end-to-end; measured as a business canary metric).

### Slug rules

- Grammar: `^[a-z0-9](-?[a-z0-9]){2,49}$` — 3–50 chars, lowercase latin + digits,
  single internal hyphens (no leading/trailing/double). Stored as citext, unique.
- Normalization on input: trim, lowercase, spaces→hyphens, strip diacritics; Arabic
  tenant names get a transliterated *suggestion*, user confirms (slugs stay ASCII —
  they live in URLs and the `X-Raqeeb-Tenant` header).
- **Reserved words rejected** (maintained list in `packages/contracts`), including:
  infrastructure (`www`, `api`, `app`, `admin`, `mail`, `cdn`, `static`, `assets`,
  `ws`, `docs`, `status`, `health`), product (`raqeeb`, `support`, `help`, `billing`,
  `settings`, `auth`, `login`, `signup`, `oauth`, `webhooks`, `internal`, `system`,
  `security`, `blog`, `about`, `legal`, `privacy`, `terms`), abuse-prone (`official`,
  `verify`, `account`, `payments`) and offensive-term screening.
- Slug changes: owner-only, rate-limited (1/30 days), old slug reserved for 90 days
  (redirect window) to keep links and API clients from breaking silently.

### Seed defaults

Every new tenant gets (mirrors the demo seed shape):

- Default **workflow**: Backlog / In Progress / In Review / Done / Cancelled
  (canonical groups: not_started / active / active / done / cancelled), marked tenant
  default.
- System **item types**: Task, Milestone, Approval (`is_system = true`).
- One **Space** ("General" / "عام" per tenant default_locale), one starter **Project**
  (key `START`) with three sections and a handful of onboarding tasks that teach the
  product (localized).
- Owner membership (`role = owner`, `is_billable_seat = true`), `plans.free` +
  14-day Business trial entitlements (billing doc).

## Lifecycle states

```
provisioning → active ⇄ past_due (billing)          [read-only, self-healing]
active → suspended (abuse/legal/manual)             [blocked, data intact]
active|suspended → pending_deletion (soft, 30d)     [blocked, export allowed]
pending_deletion → deleted (hard purge)             [gone]
pending_deletion → active (restore within 30d)
```

| State | Access | Trigger | Exit |
| --- | --- | --- | --- |
| `provisioning` | none (sub-second normally) | signup | seed complete |
| `active` | full | — | — |
| `past_due` | **read-only + export** (billing doc — never data-hostage) | payment failure | payment fixed / cancel |
| `suspended` | blocked (401-wall with status page); data intact; **not** used for billing issues | abuse/legal/security compromise; manual, dual-approval, audited | manual reinstate |
| `pending_deletion` | blocked for members; owner may restore or export | owner deletion request, or prolonged post-cancel inactivity (with 3 warning emails over 60 days) | restore, or purge at day 30 |
| `deleted` | — | purge job | — |

The request pipeline enforces state at step 4 (subscription/lifecycle gate) — one enum
read, no scattered checks.

## Data export

Available to owners/admins **in every state except `deleted`** — export rights are
never gated by plan or billing status (the no-hostage rule):

- `POST /tenants/current/export` → async job → notification with a time-limited
  download link (presigned, 7 days).
- **Formats:** a single archive containing (1) **JSON** — complete, lossless: every
  tenant-scoped table serialized with stable ids, suitable for re-import/migration
  tooling; (2) **CSV** — human-usable flattened sets (tasks with location/assignee/
  status columns, projects, members, clients; later time entries, budgets);
  (3) attachments manifest (P2+: files included or linked per size).
- Rate-limited (1 concurrent, 1/day per tenant); generation runs in the worker under
  `withTenant` (RLS keeps even the exporter honest); every export is audit-logged.

## Deletion — soft 30 days, then hard purge

1. **Soft delete:** owner request (re-auth + typed slug confirmation) sets
   `deleted_at`, state → `pending_deletion`. Members lose access immediately;
   subscription is cancelled at Stripe; confirmation + restore instructions emailed to
   the owner.
2. **Grace window: 30 days.** Owner can restore (state → `active`, `deleted_at`
   cleared) or export. Warning email at day 23.
3. **Hard purge (day 30+):** the purge job (reconciliation queue, system role,
   explicitly allow-listed cross-tenant path) deletes all tenant-scoped rows in FK
   order, object-storage files under `tenants/{id}/`, Redis keys, and search entries;
   Stripe customer retained per financial record obligations; a minimal tombstone
   (tenant id, slug hash, purge timestamp) is kept for support/legal. Purge completion
   is audit-logged to the platform (not tenant) log.
4. Accounts are **not** deleted with a tenant (D9 — accounts are global; account
   deletion is a separate GDPR flow that anonymizes authored content references in
   surviving tenants).
5. Backups: purged tenants age out of backups with the backup retention window
   (≤ 35 days); restore-from-backup procedures re-apply pending purges.

## Enterprise isolation evolution (documented options — P7)

Both options preserve the application contract (`withTenant()` everywhere), so they are
routing/provisioning changes, not app rewrites (see the invariant in
`docs/04-architecture/02-tenancy-rls.md`):

- **Schema-per-tenant:** dedicated PG schema stamped from the same migration set;
  tenant→schema directory in the router; per-tenant backup/restore and isolated
  migration rollout. Offered when a contract requires it or a tenant's scale degrades
  pool neighbors.
- **Dedicated database + BYOK/CMEK:** separate cluster, tenant-managed encryption keys
  (KMS grant model — key revocation = data inaccessible to us), region pinning.
  RLS stays on even with one tenant per DB (defense in depth).
- Migration between modes is an offline-window export/import using the lossless JSON
  export format above — the export pipeline is deliberately the same one customers use,
  so it is tested continuously.
