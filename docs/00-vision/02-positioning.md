# Raqeeb — Positioning

*How Raqeeb positions against each of the six incumbents, how it prices, and the explicit
product commitments (the anti-pattern pledge) the team is accountable to.*

## Positioning against each competitor

### vs ClickUp — "the depth, without the drag"

Raqeeb takes ClickUp's best structural ideas: custom statuses (named, colored, grouped)
available everywhere, modular per-Space feature toggles (ClickApps → Raqeeb space
features), multiple assignees, native time tracking, custom task IDs, sprints, and
automations scopeable at any level of the hierarchy. What Raqeeb does differently is treat
ClickUp's two chronic failures as founding constraints: **performance is a feature**
(explicit budgets — task-list p95 < 500 ms at 10k tasks, a 50k-task nightly fixture from
Phase 2 — versus ClickUp's 90-second Everything view) and **minimal defaults with
progressive disclosure** instead of forty toggles greeting a new user. Raqeeb ships fewer
views and fields on day one, all of them fast, and never issues scopeless non-expiring API
tokens.

### vs Asana — "the graph model, without the ceilings"

Raqeeb adopts Asana's deepest ideas wholesale: task multi-homing as a core primitive
(`task_locations`), the Stories event-stream activity model as a clean audit trail,
approval task subtypes, the Allocations concept (staffing distinct from task assignment),
My Tasks auto-promotion, Rule bundles, and Asana's best-in-class API discipline
(`opt_fields`, batch, webhooks with HMAC handshake, scoped OAuth, published OpenAPI +
llms.txt). What Raqeeb refuses to inherit are Asana's two most-complained-about ceilings —
**single assignee per task** and **binary complete/incomplete with no custom statuses** —
plus its habit of tier-gating basics like time tracking and workload behind Advanced+.
Raqeeb: multiple assignees in the core schema, custom statuses on every tier, time
tracking in the product, not the price fence.

### vs monday.com — "the composability, without the quota cliffs"

Raqeeb borrows monday's approachability: automation **recipe sentences** ("When [trigger],
only if [conditions], then [actions]"), instant building-block onboarding, dashboard
widgets, WorkForms-style intake, and its developer-platform manners (Idempotency-Key,
RateLimit headers, deliberate versioning) — plus, long-term, its apps-framework ambition
and agent-native MCP posture. Raqeeb diverges on the data model and the meter: **subtasks
are canonical tasks, never second-class subitems on a hidden linked board**; fields and
statuses live in **tenant-level shared libraries** rather than being trapped per-board
(monday only mitigates this with Enterprise "Managed Columns"); and automation quotas
**degrade gracefully** instead of monday's 250-actions-then-everything-pauses cliff. No
seat minimums, no five-seat increments.

### vs Wrike — "the enterprise skeleton, without the SKU sprawl"

Raqeeb takes more architecture from Wrike than from anyone: cross-tagging validated
multi-homing (parents[] ≡ `task_locations`), **unlimited named workflows whose custom
statuses map to exactly four canonical groups** (Raqeeb's
`not_started/active/done/cancelled`), custom item types as user-defined schemas, the full
resource stack (effort independent of duration, work schedules, tentative/confirmed
bookings, job-role placeholders), request forms → blueprints with relative dates, proofing
with version compare and free guest reviewers. What Raqeeb rejects is Wrike's commercial
and UX overhead: no add-on SKU sprawl (Integrate/Lock/Analyze equivalents are core-tier
capabilities), no automation engine that disables every rule at zero balance, no 5-minute
comment-edit window, and an in-product extension surface on the roadmap where Wrike has
none.

### vs Forecast — "the financial spine, without the guardrails"

Raqeeb replicates Forecast's category-defining financial engine: four budget types (Fixed
Price / T&M / Retainer / Non-billable), retainer periods with rollover and per-period
invoicing, per-role date-effective rate cards, time-versioned person cost periods,
Baseline/Planned/Actual/Remaining/At-Completion financials at project *and* task level,
and the resource model (soft/hard allocations, placeholders, capacity heatmap with
Forecast's own health thresholds, Demand = max(allocations, task estimates)). Raqeeb does
it **without the hard-coded guardrails** its users resent: budget types are convertible
(with a recorded conversion event) instead of immutable, locked periods have governed
escape hatches instead of dead-ends, guest permissions are per-project instead of global,
the API is scoped OAuth/PATs instead of a key-only full-access token, and AI features are
explainable instead of opaque. With Forecast's base mid-migration to Accelo, Raqeeb is the
natural landing zone.

### vs Teamwork.com — "the agency layer, priced like we mean it"

Raqeeb adopts Teamwork's client/agency layer as the template: clients as first-class
records, **free client users who never consume seats**, the per-project per-user
permission matrix, per-item privacy inside shared projects, the four-level rate hierarchy
(project override → client role rate → tenant rate card → user default), budgets with
threshold notifications and history, per-project profitability, and proofs with external
email-link approval. Raqeeb differs in three ways: the agency core (retainers,
profitability) ships at the **Business tier, not gated at Scale**; cost rates are
**time-versioned per person** (`person_cost_periods`) instead of a single site-wide
mutable number that corrupts historical margins; and there is **one resourcing surface**
built on allocations, not two disjoint tools (Workload vs Schedule) — and one versioned
API, not three concurrent ones.

## Pricing posture

- **Per-seat, monthly or annual, no seat minimums, no seat-increment games.** One seat is
  a valid purchase; the 6th seat costs the same as the 5th.
- **Clients and guests are free, forever, on every tier.** `is_billable_seat = false` is a
  schema fact, not a promo. External reviewers on proofs need no account at all.
- **The agency core (retainers, rate cards, profitability, client portal) lands at
  Business tier** — the tier a 15-person agency actually buys — never Enterprise-only.
- **No add-on SKUs** for integrations, security, or analytics. Tiers differ by
  limits and enterprise controls (SSO/SCIM, audit UI, BYOK), not by amputated modules.
- **Quotas that degrade, never punish.** Where a plan meters something (automation runs,
  storage), hitting the limit degrades that feature gracefully and prompts an upgrade — it
  never mass-disables existing configuration.

## The anti-pattern pledge

These are product commitments, testable in the product, derived from the consolidated
anti-pattern research (`../01-competitive-analysis/08-anti-patterns.md`). Breaking one
requires revisiting this document, not a quiet pricing meeting.

| # | Pledge | Against |
|---|--------|---------|
| 1 | **Custom statuses on every tier.** Workflows with named, colored statuses mapped to canonical groups are core schema, free tier included. | Asana's binary completion; tier-gated basics |
| 2 | **Multiple assignees on every task.** `task_assignees` is many-to-many; no workaround fields. | Asana's single-assignee limit |
| 3 | **Automations degrade gracefully, never pause.** The quota service returns `ok \| degraded`; existing rules are never mass-disabled by a meter. | monday's 250/mo pause; Wrike disabling everything at 0 |
| 4 | **No add-on SKU sprawl.** No separately priced Integrate/Lock/Analyze-style boxes. | Wrike |
| 5 | **Performance budgets are a feature.** Published budgets (task list p95 < 500 ms @ 10k tasks), 50k-task nightly fixture, regressions block release. | ClickUp's 90s Everything view; monday/Wrike scale cliffs |
| 6 | **Clients and guests never consume seats.** Free on every tier; external proof reviewers need no account. | Seat-metered client access; Wrike-style licensing of reviewers avoided |
| 7 | **No seat minimums or seat increments.** | monday/Wrike 5-seat games |
| 8 | **Subtasks are real tasks.** Same table, same fields, same views — never a hidden linked board. | monday subitems |
| 9 | **One API, versioned deliberately.** Scoped tokens that expire and revoke; HMAC-signed webhooks; published OpenAPI + llms.txt from day one. | Teamwork's 3 concurrent versions; ClickUp's scopeless non-expiring tokens; Forecast's key-only API |
| 10 | **Financial history is immutable-by-design, never rigid-by-design.** Rate snapshots and cost periods preserve history; budget types convert with recorded events; locks have governed escape hatches. | Teamwork's site-wide mutable cost rate and delete-and-recreate budgets; Forecast's immutable retainers and locked-period dead-ends |
