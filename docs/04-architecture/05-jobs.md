# Background Jobs — BullMQ

> **Status:** Accepted. Queues run on BullMQ over Redis. `apps/worker` is a thin bootstrap
> that imports processor classes from the API's domain modules — domain logic never forks.

## Queue topology

| Queue | Producers | Work | Concurrency (initial) | Notes |
| --- | --- | --- | --- | --- |
| `automations` | Events module (rule matches an outbox event) | Execute recipe actions (P5) | 8 | metered per plan; degrades, never mass-pauses (risk 7) |
| `notifications` | Domain modules (assign, mention, due-soon scheduler) | Fan out in-app/email notifications | 8 | email via provider adapter; Mailpit in dev |
| `webhooks-delivery` | Outbox publisher (subscription match) | Sign + POST to subscriber endpoints | 16 | 10 s timeout, 24 h backoff schedule — see webhooks doc |
| `digests` | Cron (BullMQ repeatable) | Daily/weekly digest emails per membership | 2 | locale-aware (en/ar) rendering |
| `rebalance` | Fractional-ordering collision monitor + threshold scan | Rewrite over-long position keys per list | 1 | low priority; batched; idempotent (D10) |
| `reconciliation` | Cron | Stripe seat reconciliation (daily), JSONB cache consistency check (nightly), outbox pruning, invitation expiry, soft-delete purge | 1 | mostly system-role paths, each explicitly listed in the tenancy doc |

Conventions: one BullMQ queue per family (not per tenant — see fairness), job names are
verbs (`deliver`, `run-rule`, `send-digest`), every job schema is a Zod type in
`packages/contracts/jobs` — **`tenant_id` is a required field on every payload** (except
the explicitly cross-tenant reconciliation jobs, which carry `tenant_id: null` and are
allow-listed).

## Tenant-context base processor

The worker rule from `02-tenancy-rls.md`, made concrete:

```ts
// apps/worker — every processor extends this
export abstract class TenantProcessor<P extends { tenant_id: string }> {
  async process(job: Job<P>) {
    const log = jobLogger(job);                      // tenant_id + job id correlation
    return withTenant(job.data.tenant_id, (tx) =>
      this.handle(job.data, tx, log),                // handler gets the tx, not the pool
    );
  }
  abstract handle(data: P, tx: Tx, log: Logger): Promise<void>;
}
```

- Handlers receive the RLS-scoped transaction handle; there is no way to query outside
  tenant context from a processor.
- Cross-tenant jobs extend `SystemProcessor` (uses `withSystem()`), which is import-
  restricted to the reconciliation module.
- The processor also verifies the tenant is not hard-deleted/suspended before running
  side-effectful work (a suspended tenant's queued automations are dropped with a metric,
  not executed).

## Idempotency rules

At-least-once delivery is assumed everywhere (BullMQ retries, worker crashes mid-job,
outbox re-publishes). Every job must be one of:

1. **Naturally idempotent** — e.g. rebalance (rewrites to a deterministic layout),
   reconciliation (converges state), cache rebuild.
2. **Keyed idempotent** — the job carries a deterministic `jobId`
   (BullMQ deduplicates by job id) derived from its cause:
   - webhook delivery: `wh:{subscription_id}:{event_id}` — one delivery record per
     event per subscription; retries reuse the record.
   - automation run: `auto:{rule_id}:{event_id}` — an outbox event triggers a rule at
     most once; the `automation_runs` row is the durable dedupe (P5).
   - notifications: `notif:{kind}:{entity_id}:{membership_id}:{bucket}` — dedupe window
     per recipient.
3. **Guarded by a dedupe table** — Stripe webhook processing inserts the Stripe event id
   into a unique-constrained table first; conflict = already processed, exit 0
   (see billing doc).

A job that fits none of the three shapes does not ship.

## Per-tenant fairness

One noisy tenant (a 10k-row import triggering 10k automation events) must not starve
everyone else. Strategy, in order of application:

1. **Queue-key sharding by tenant group:** BullMQ *group*-style fairness is implemented
   with a per-tenant pending counter in Redis — the producer tags jobs
   `{queue}:{tenant_id}`, and the worker's picker round-robins across tenants with
   pending work (a small Lua script pops the next tenant's oldest job). Family queues
   stay single, fairness is at pick time.
2. **Per-tenant concurrency cap:** at most N (default 2) in-flight jobs per tenant per
   queue; excess waits regardless of global idle capacity.
3. **Plan-weighted quotas for metered work:** automation runs consume the tenant's
   metered entitlement (`consume()` → `ok | degraded`); degraded runs drop to a
   best-effort priority band instead of being refused (see entitlements doc — no
   monday/Wrike-style mass-pause cliffs).
4. **Burst isolation:** bulk operations (import, bulk edit) enqueue one *batch* job that
   internally chunks, rather than 10k individual jobs.

## Retry & backoff policy

| Class | Attempts | Backoff | On exhaustion |
| --- | --- | --- | --- |
| Default (transient infra) | 5 | exponential, base 5 s, factor 4, full jitter (5s → ~20m) | dead-letter queue + alert metric |
| `webhooks-delivery` | ~8 over 24 h | its own schedule: 10s, 1m, 5m, 30m, 2h, 6h, 12h, 24h | mark delivery failed; consecutive-failure counter → auto-suspend subscription (webhooks doc) |
| `automations` | 3 | exponential base 10 s | run recorded as failed; visible in rule run history; never disables the rule by itself |
| `reconciliation` crons | 1 per schedule | next scheduled run is the retry | alert if 2 consecutive misses |

Rules:
- **Retryable vs terminal errors are distinguished in code** (`TerminalJobError` skips
  retries): a 404'd entity or a validation failure must not burn 5 attempts.
- Dead-letter queues are per-family (`{queue}:dead`), retained 14 days, with an internal
  admin view; replay is a deliberate manual action.
- All timers use **full jitter** to avoid synchronized retry storms after an outage.
- Job duration, wait time, retry count, and per-tenant throughput are exported as metrics
  (`08-observability-performance.md`); the SLO is queue wait p95 < 30 s for
  `notifications` and `webhooks-delivery` under nominal load.
