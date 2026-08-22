# Entitlement Service

> **Status:** Accepted. The Entitlements module ships in the Wave A scaffold (plans table
> + `check()` facade); live gates and metering turn on in P1. One rule above all: **every
> gate is enforced server-side at a single point, and the UI mirrors — never replaces —
> that enforcement.**

## Entitlement kinds

| Kind | Question it answers | Examples | Evaluation |
| --- | --- | --- | --- |
| **boolean** | "does this tenant have the feature at all?" | `retainers`, `client_portal`, `saml_sso`, `automations` | plan JSONB → override |
| **limit** | "how many may exist?" (state-counted) | `members_count` (Free 5), `guests_count`, `webhooks_count`, `saved_views_count`, `storage_bytes` | counted against current state at mutation time |
| **metered** | "how many may happen per window?" | `automation_runs_month`, `api_rpm` | counter consumed per occurrence, window-reset |

## Resolution model

```
effective(tenant, feature) =
    tenant_entitlement_overrides[feature]     -- if present
    ?? plans[tenant.plan_id].features/limits[feature]
```

- **`plans`** (global table, seeded): the four tiers' `features` (boolean map) and
  `limits` (numeric map). Packaging changes = reviewed data migrations.
- **`tenant_entitlement_overrides`** (P1, tenant-scoped): per-tenant exceptions —
  negotiated Enterprise terms, grandfathered limits, beta flags, support goodwill
  bumps. Every override row records who/why/when (+ optional `expires_at`). Overrides
  are the escape valve that keeps plan rows clean — there is never an
  `enterprise_acme_special` plan.
- Resolution result is cached in-process for 30 s and busted on plan/override change
  events (via the outbox) — entitlement checks must be nanosecond-cheap because they run
  on hot paths.

## Single enforcement point

```ts
// the ONLY api — no module reads plans directly
entitlements.check(tenantId, 'retainers')            // boolean kind → allowed | denied
entitlements.checkLimit(tenantId, 'guests_count', current + 1)  // limit kind
entitlements.consume(tenantId, 'automation_runs_month', 1)      // metered → ok | degraded
```

- `check`/`checkLimit` are called from guards/interceptors on the API route (declarative:
  `@RequiresEntitlement('retainers')`) and from services for compound operations. Direct
  reads of `plans` outside the Entitlements module are lint-banned — one enforcement
  point means one place to audit, one place to log, one place the UI can trust.
- Denials return problem type `entitlement-required` with the feature name and the
  minimum plan that includes it — the API itself is an upsell surface
  (`402`-adjacent but semantically `403` + problem detail; billing-state blocks use 402).
- Every denial and degradation increments a per-feature metric — quota pressure is a
  **sales signal**, routed to the growth dashboard, not just an ops counter.

## Mirrored UI states

The web app receives the tenant's resolved entitlement map (`GET /tenants/current` →
`entitlements` block) and renders one of three states per feature. The server remains
authoritative — UI state is UX, not security:

| State | When | Treatment |
| --- | --- | --- |
| **enabled** | entitled | normal UI |
| **upsell** | not entitled, feature is *discoverable* (default for tier features) | visible but locked: the control renders with a plan badge; clicking opens the upgrade panel naming the required plan. Discoverability is how packaging sells itself. |
| **hidden** | not entitled and contractually/contextually irrelevant (e.g. SAML config for Free, isolation options outside Enterprise) | not rendered at all — noise, not upsell |

The hide-vs-upsell choice is declared per feature in one registry
(`packages/contracts/entitlements.ts`) shared by web and API docs — no per-screen
ad-hoc decisions.

## Metered counters — Redis with PG rollup

- **Hot path:** `consume()` executes an atomic Redis Lua script:
  `INCRBY tenant:{id}:meter:{feature}:{window}` and compares against the resolved limit;
  returns `ok` or `degraded` plus remaining. Sub-millisecond, no PG on the hot path.
- **Rollup:** a periodic job (reconciliation queue, every 5 min) flushes window counters
  into a PG `entitlement_usage` table (tenant, feature, window, count) — the durable
  record that survives Redis loss and feeds usage UI, invoicing-adjacent reporting, and
  the sales-signal dashboards.
- **Redis loss:** counters rebuild from the PG rollup at the last flush + fail-open for
  the gap (a few minutes of unmetered generosity beats false lockouts).
- Windows are UTC-calendar (monthly for `automation_runs_month`); `RateLimit`-style
  windows (api_rpm) live in the rate limiter, which consumes the same resolved limits.

## The degradation contract: `consume() → ok | degraded`

```ts
const r = await entitlements.consume(tenantId, 'automation_runs_month', 1);
// r: { status: 'ok' | 'degraded', remaining: number, limit: number }
```

- `consume()` **never returns "refused" for existing functionality** (risk 7). Callers
  branch on `degraded` to apply their documented degradation (automations drop to the
  best-effort priority band; see plans doc for the full per-limit table). A caller that
  cannot degrade must use `checkLimit` *before* creating new state instead.
- `degraded` occurrences emit an event → admin-visible banner + notification (first
  crossing of 80%, 100%, then weekly summary — not per-occurrence spam).
- This is the structural answer to the monday/Wrike automation-cliff anti-pattern: the
  quota system is *incapable* of expressing "pause all rules".

## ADR summary

**Decision.** Central entitlement service; three kinds (boolean/limit/metered); plan
defaults + per-tenant overrides; single server-side enforcement point mirrored by a
three-state UI registry; Redis counters with PG rollup; degradation-only quota contract.

**Rationale.** Feature gates sprinkled through controllers rot into inconsistency between
API and UI within months (visible in every competitor's API-vs-app behavior gaps). A
single facade makes packaging changes deployable as data, keeps the public API honest
(same gates), and turns quota pressure into telemetry.

**Rejected alternatives.**
- *Checks against `plans` JSONB inline everywhere*: unauditable sprawl; guaranteed
  UI/API drift.
- *Third-party flag service as the source of truth*: entitlements are billing-coupled
  tenant state, not deploy-time flags; an external SaaS in the request hot path is a new
  failure mode. (A flag system for *rollout* flags may still exist separately.)
- *Hard-refusal quotas*: the documented competitor cliff; rejected by contract shape —
  `consume()` has no refuse branch.
- *PG-only counters*: hot-path contention on busy tenants; Redis+rollup is the standard
  answer.
