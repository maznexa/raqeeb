# Observability & Performance

> **Status:** Accepted. Performance is a **product feature**, not an ops metric: the #1
> documented failure of the strongest competitor (ClickUp's performance debt — 90-second
> Everything views) is the failure mode Raqeeb's budgets exist to prevent (risk 6).

## Structured logging — Pino

- **Pino JSON logs** everywhere (API, worker, web server runtime), one schema:
  - `request_id` — generated at the edge (or honored from `X-Request-Id`), echoed in
    responses and problem+json errors, propagated to jobs (`caused_by_request_id`).
  - `tenant_id` — bound into the logger context by the tenant-resolution middleware and
    the worker base processor; **every** log line inside tenant work carries it. Debugging
    "tenant X is slow" is a filter, not an archaeology dig.
  - `membership_id` / `actor_type`, `module`, `event` (machine-readable name), `duration_ms`.
- Redaction lists for secrets are centralized (see security doc). Log levels: `info` for
  state changes, `warn` for degraded paths (rate-limit hits, retry storms, cache
  mismatches), `error` reserved for actionable failures — error-level noise is treated as
  a bug.
- Request access logs include route template (not raw URL), status, duration, tenant, and
  auth kind — enough to compute per-tenant/per-route p95 from logs alone if metrics are
  down.

## Traces — OpenTelemetry

- OTel SDK on API and worker: automatic HTTP/pg/ioredis/BullMQ instrumentation plus
  manual spans around `withTenant` (span attrs: `tenant.id`, `db.tx = true`), outbox
  publishing, and each job `handle()`.
- Context propagation: W3C traceparent from web → API; job payloads carry the producing
  trace context so a webhook delivery can be traced back to the originating mutation.
- Sampling: parent-based, 10% baseline, 100% for requests that exceed budget thresholds
  (tail-based escalation via the collector) and 100% on error.
- Export via OTLP to the collector; backend is pluggable (dev: local Jaeger in
  docker-compose).

## Metrics

Prometheus-format metrics (OTel metrics API), the ones that matter:

| Family | Metrics |
| --- | --- |
| HTTP | request rate/duration histogram by route template + status; in-flight; 429 count by tenant plan |
| DB | pool acquire wait, tx duration histogram, rows-per-query on hot paths |
| RLS/tenancy | withTenant depth misuse counter (should be zero), system-role usage by job |
| Outbox/realtime | outbox lag (oldest unpublished age), publish batch size, socket room counts, events/sec per tenant |
| Jobs | queue depth, wait p95, run duration, retries, DLQ size — per queue |
| Entitlements | consume() degraded count by feature/tenant plan (quota pressure = upsell signal, not just ops) |
| Business canaries | signups, provisioning duration, seed-to-first-task time |

Alerting is SLO-based (budgets below), not threshold-noise.

## Performance budgets (the anti-ClickUp budgets)

Budgets are **acceptance criteria**: a feature that blows its budget is not done. They are
asserted in CI (see fixture below) and monitored as SLOs in production.

| Surface | Budget | Measured as |
| --- | --- | --- |
| Task list (project view) | **p95 < 500 ms @ 10,000 tasks** in the project | server time to first page (100 rows) incl. RLS, filters, assignees; and client render < 16 ms/frame scroll via virtualization |
| Board drag | **< 100 ms perceived** | optimistic reorder applied to DOM within 100 ms; server confirm async (fractional keys make the write O(1 row) — D10) |
| Everything view (workspace rollup, P6) | **< 2 s** initial render at 50k tasks/tenant | the direct anti-ClickUp budget; achieved by cursor-paged, pre-filtered queries — never "load then filter" |
| Task detail open | p95 < 300 ms | single round trip: task + locations + assignees + deps |
| API simple GETs | p95 < 200 ms server time | per-route SLO dashboards |
| Realtime propagation | event visible to other clients < 2 s p95 | outbox lag + fan-out |
| Cold web navigation | LCP < 2.5 s p75 | standard Web Vitals, both locales (RTL pages must not be slower) |

Budget engineering rules that follow from these numbers:
- keyset pagination only (no OFFSET anywhere);
- every list endpoint returns a bounded page (max 200) with sparse fieldsets;
- virtualized rendering for any list that can exceed ~200 rows;
- counts are estimated or cached — no `COUNT(*)` over large sets in request paths;
- N+1s blocked at review by the contracts layer (one query per collection, batched
  loaders for expansions).

## The 50k-task load fixture (nightly CI, from P2)

- A deterministic generator in `packages/db/fixtures` builds a tenant with **50,000
  tasks** (realistic shape: 40 projects, multi-homed tasks ~8%, 6-status workflows,
  3,000 dependency edges, 25 members, custom fields once P2 lands) plus a second smaller
  tenant so RLS overhead is measured under real policy conditions.
- Nightly CI job: restore fixture → run the budget suite (k6 for HTTP percentiles +
  Playwright for perceived interactions) → compare against the budget table →
  **fail the nightly and open an issue on regression** (>10% or budget breach).
- `EXPLAIN (ANALYZE, BUFFERS)` output for the hot queries is captured per run and diffed,
  so plan flips (lost index, RLS predicate not pushed down) are caught the night they
  happen, not at 10× scale.
- The fixture doubles as the demo/perf environment seed — sales demos run on the same
  data shape engineering is accountable to.

## Slow queries — pg_stat_statements

- `pg_stat_statements` enabled from Phase 0 (in docker-compose Postgres too — dev parity).
- `log_min_duration_statement = 250ms` in production (50 ms in the nightly perf run);
  slow-query log lines are shipped with the same pipeline and joined to `request_id` via
  `application_name` tagging (`raqeeb:{service}:{request_id_prefix}`).
- Weekly automated report (reconciliation queue): top statements by total time and by
  mean, diffed against last week — regressions get issues before users notice.
- Index-usage audit query (unused indexes, sequential scans on tenant tables) runs in the
  same report; every index in the schema reference must either earn its writes or be
  removed.
