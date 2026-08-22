# Tenancy & Row-Level Security

> **Status:** Accepted. This is the security backbone of the product; the RLS isolation
> test suite is non-negotiable and ships in the Phase 0 scaffold (CI gate: tenant A cannot
> read tenant B, ever).

## Model: pooled Postgres + RLS

All tenants share one PostgreSQL 16 cluster and one schema. Every tenant-scoped table
carries `tenant_id uuid NOT NULL` and is protected by row-level security. Isolation is
enforced **in the database**, not in query code — a forgotten `WHERE tenant_id = ?` returns
zero rows instead of leaking another tenant's data.

### ADR: pooled RLS over schema-per-tenant

**Decision.** v1 tenancy is pooled rows + RLS. Schema-per-tenant and dedicated-DB are
documented enterprise evolutions (see below), not built now.

**Rationale.** Pooled RLS handles tens of thousands of small/medium tenants on one cluster
with a single migration path, one connection pool, and uniform observability. Cross-tenant
platform features (usage metering, reconciliation) stay cheap.

**Rejected alternatives.**
- *Schema-per-tenant from day one*: N schemas × M migrations = operational quadratic pain;
  connection pooling fragments per schema; tooling (drift check, seed, fixtures) becomes
  N-way. Wrong trade for a product whose first 10,000 tenants are small.
- *Database-per-tenant from day one*: the enterprise end state for a few tenants, absurd
  for the long tail.
- *App-layer filtering only (no RLS)*: one missed WHERE clause is a breach. Rejected
  without further discussion.

## The four load-bearing rules

### 1. `FORCE ROW LEVEL SECURITY` + a non-owner application role

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;   -- applies even to the table owner
```

The application connects as **`raqeeb_app`**, a dedicated role that:
- does **not** own any table (owners bypass RLS unless FORCEd — we FORCE anyway, belt and
  suspenders);
- has `BYPASSRLS` **not** granted;
- has only the grants it needs (`SELECT/INSERT/UPDATE/DELETE` on app tables — no `DELETE`
  or `UPDATE` on `audit_logs`, no DDL);
- is provisioned in `docker-compose` and migrations from Phase 0 so dev == prod discipline.

Migrations run as the owner role (`raqeeb_owner`) via the migration runner only.

### 2. Policy pattern: scalar-subselect current_setting

```sql
CREATE POLICY tenant_isolation ON tasks
    USING (
        tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid)
    )
    WITH CHECK (
        tenant_id = (SELECT current_setting('app.current_tenant_id', true)::uuid)
    );
```

- The **`(SELECT ...)` wrapper matters**: it makes the setting a one-time InitPlan the
  planner treats as a stable scalar and caches per statement, instead of re-evaluating
  `current_setting()` per row. On large scans this is the difference between an index scan
  and a 10× slower filter.
- `current_setting(..., true)` (missing_ok) returns NULL when the GUC is unset → the
  predicate is NULL → **zero rows**. Unset context fails closed.
- `WITH CHECK` mirrors `USING` so INSERT/UPDATE cannot write rows for another tenant even
  if application code passes a wrong `tenant_id`.
- Special cases: `tenants` uses `id = (SELECT ...)` (self-row policy); `memberships` adds a
  second self-access policy on `app.current_account_id` for the login/tenant-switcher path
  (enumerate *my own* memberships before tenant context exists).

### 3. The `withTenant()` contract

`SET LOCAL` is only valid **inside a transaction** — outside one it is silently a no-op
warning, which with a connection pool means *the previous tenant's setting may still be
live on the connection*. Therefore:

```ts
// packages/db — the ONLY way to touch tenant data
await withTenant(tenantId, async (tx) => {
  // BEGIN;
  // SET LOCAL app.current_tenant_id = '<tenantId>';   -- parameterized via set_config()
  // ... all queries in this callback run on THIS connection, in THIS tx ...
  // COMMIT;  (ROLLBACK on throw)
});
```

Contract, enforced by code review + lint rule (no raw `pool.query` imports outside
`packages/db`):

- `withTenant()` opens a transaction, applies the GUC with
  `SELECT set_config('app.current_tenant_id', $1, true)` (the `true` = local/transaction
  scoped), runs the callback on that same client via AsyncLocalStorage, and commits.
- The GUC dies with the transaction — nothing persists on the pooled connection.
- Nested `withTenant()` with the *same* tenant joins the ambient transaction; with a
  *different* tenant it throws (no tenant-hopping inside a unit of work).
- `withSystem()` (see escape hatches) is a separate, deliberately noisy API.

### 4. The worker rule

Background jobs have no HTTP request to derive context from, so:

- **Every job payload carries `tenant_id`** — enqueueing without it is a type error
  (`packages/contracts` job schemas).
- A **base processor class** wraps every processor: it reads `payload.tenant_id`, opens
  `withTenant(tenant_id)`, and runs the handler inside it. Processors physically cannot
  run queries outside tenant context (the handler receives the tx handle, not the pool).
- Cross-tenant jobs (reconciliation, outbox publishing) use the system path below and are
  explicitly listed — currently: outbox poller, Stripe reconciliation, purge job, nightly
  cache consistency check.

See `05-jobs.md` for queue topology.

## Admin / system escape hatches

Some legitimate work is cross-tenant: billing reconciliation, the outbox publisher, tenant
provisioning/purge, support tooling. Rules:

- A separate role **`raqeeb_system`** exists for these paths. It is *not* `BYPASSRLS`
  either; instead, policies include
  `OR (SELECT current_setting('app.is_system', true))::boolean` **only on the tables the
  system paths need** (tenants, memberships, outbox_events, audit_logs). Cross-tenant
  access is opt-in per table, never ambient.
- The app role can never become the system role (`NOLOGIN` role granted only to the worker
  deployment's credentials where needed; the API process does not hold it).
- Every `withSystem()` invocation logs a structured audit line (who/which job/why).
- Human support access goes through an internal admin surface with its own audit trail —
  never through psql as the app or owner role in production.

## PgBouncer / pooling note

- **Transaction-mode pooling is compatible** with this design *because* the GUC is
  `SET LOCAL` inside a transaction: the setting and the transaction travel together and
  die together.
- **Session-mode pooling + plain `SET` is a leak vector**: a `SET app.current_tenant_id`
  without LOCAL sticks to the server connection, which the pooler then hands to another
  request. Forbidden — CI greps migrations and code for non-LOCAL `SET app.` as a cheap
  tripwire.
- Corollaries of transaction pooling: no session-level prepared statements, no advisory
  locks held across transactions, no `LISTEN/NOTIFY` on pooled connections (the outbox
  poller uses its own direct connection).

## Testing (Phase 0, CI-gated)

The RLS isolation suite runs on every CI build:

1. Seed tenant A and tenant B with look-alike data.
2. For **every** tenant-scoped table: under `withTenant(A)`, `SELECT` returns only A rows;
   `INSERT/UPDATE` with `tenant_id = B` fails the `WITH CHECK`.
3. Unset context (no GUC) returns zero rows on every table.
4. API-level: PAT of tenant A against tenant B slug → 404; cross-tenant object IDs → 404.
5. A canary test asserts `FORCE ROW LEVEL SECURITY` and a policy exist on every table with
   a `tenant_id` column (catches "new table forgot RLS" at review time).

## Enterprise evolution path (documented, not built)

| Stage | Isolation | When | Notes |
| --- | --- | --- | --- |
| v1 (now) | Pooled rows + RLS | all tiers | this document |
| Enterprise option 1 | Schema-per-tenant | P7, contract-driven | Same DDL stamped per schema; migration runner iterates schemas; clean backup/restore + isolated migration rollout per tenant. Entry criteria: a signed customer requiring it, or a pooled tenant whose scale degrades neighbors. |
| Enterprise option 2 | Dedicated database/cluster (+ BYOK/CMEK) | P7+ | Full blast-radius isolation, tenant-managed keys, region pinning. Routed by a tenant→connection-string directory; app code unchanged (withTenant still applied — RLS as defense-in-depth even with one tenant per DB). |

The invariant that makes the evolution cheap: **application code never assumes pooled
tenancy** — all access flows through `withTenant()`, so re-pointing a tenant at a
different schema or cluster is a routing-layer change, not an application rewrite.
