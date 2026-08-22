# Consolidated Anti-Patterns — The "Do Not Build" List

*Every failure mode our competitive research catalogued, who exhibits it, why users hate
it, and the binding design rule Raqeeb adopts instead.*

Each entry: **Seen in** (competitor(s)) → **Pain** (what it does to users) → **Raqeeb
rule** (the commitment, and where it's enforced). Rows marked ⚑ are covered by the
anti-pattern pledge in `../00-vision/02-positioning.md`.

## A. Commercial & packaging

### 1. Automation quotas that mass-pause everything ⚑
- **Seen in:** monday.com (250 actions/mo on Standard, then recipes stop), Wrike
  (disables *every* rule when the balance hits 0), ClickUp & Asana (hard caps that
  silently pause).
- **Pain:** business processes stop without warning; users discover days later that
  nothing has been routing, assigning, or notifying.
- **Raqeeb rule:** the quota service returns `ok | degraded` — new runs may queue or slow
  at the limit, but existing rules are **never mass-disabled**. Enforced in the P5
  automation engine's quota design.

### 2. Seat minimums and 5-seat increments ⚑
- **Seen in:** monday.com, Wrike.
- **Pain:** a 6-person team pays for 10; every hire is a pricing negotiation.
- **Raqeeb rule:** per-seat, any count, no increments. Enforced in Stripe plan
  configuration and P1 seat reconciliation.

### 3. Add-on SKU sprawl ⚑
- **Seen in:** Wrike (Integrate, Lock, Analyze sold as separate add-ons).
- **Pain:** the quoted price is never the real price; procurement fatigue; features feel
  ransomed.
- **Raqeeb rule:** no capability add-on SKUs. Tiers differ by limits and enterprise
  controls only.

### 4. Tier-gating the basics ⚑
- **Seen in:** Asana (time tracking and workload behind Advanced+), Teamwork
  (retainers/profitability — the agency core — gated at Scale), ClickUp/monday (assorted
  fundamentals behind upper tiers).
- **Pain:** the reason you bought the product is in the tier you didn't buy.
- **Raqeeb rule:** custom statuses on every tier including free; the agency core ships
  at Business tier; time tracking is a product feature, not a price fence.

### 5. Dashboards and analytics capped by plan
- **Seen in:** monday.com, Wrike (dashboard counts capped; analytics refreshed on a
  4–24h lag).
- **Pain:** reports are stale exactly when leadership asks for them; arbitrary caps
  force workarounds.
- **Raqeeb rule:** dashboards query live data; tiers never cap widget/dashboard counts.

### 6. Charging for client and guest access ⚑
- **Seen in:** category-wide seat metering of external users (Teamwork and Wrike are
  the honorable exceptions — free clients, free guest reviewers).
- **Pain:** agencies pay for their own customers to look at their own projects.
- **Raqeeb rule:** `memberships.is_billable_seat = false` for clients/guests on every
  tier; external proof reviewers need no account at all. No arbitrary project caps on
  client users (drop Teamwork's 5-project cap).

## B. Data model

### 7. Second-class subitems ⚑
- **Seen in:** monday.com (subitems live on a hidden linked board).
- **Pain:** subitems vanish from views, automations, dashboards, and API responses;
  every feature must "add subitem support" separately, forever.
- **Raqeeb rule:** subtasks are rows in the same `tasks` table with the same fields and
  capabilities. Enforced by D1/D2 schema.

### 8. Single assignee per task ⚑
- **Seen in:** Asana.
- **Pain:** the most-worked-around limit in the category — duplicate tasks,
  "pair" custom fields, ownership ambiguity.
- **Raqeeb rule:** `task_assignees` is many-to-many (D7). Multiple assignees from the
  scaffold.

### 9. Binary complete/incomplete — no custom statuses ⚑
- **Seen in:** Asana (a top user complaint).
- **Pain:** real processes have review, blocked, and cancelled states; teams fake them
  with sections and tags, breaking reporting.
- **Raqeeb rule:** D3 — tenant-scoped workflows with named/colored statuses mapped to
  canonical groups (`not_started/active/done/cancelled`), on every tier.

### 10. Per-board field/status silos
- **Seen in:** monday.com (no global fields or statuses; Enterprise "Managed Columns" as
  a paid mitigation).
- **Pain:** thirty boards, thirty slightly different "Status" columns; cross-board
  reporting becomes string matching.
- **Raqeeb rule:** tenant-level shared field and workflow libraries with optional
  space/project-local definitions (D3/D4).

### 11. Unbounded hierarchy nesting
- **Seen in:** Wrike (infinite folder/project trees).
- **Pain:** navigation mazes, permission ambiguity, and pathological query depth at
  scale.
- **Raqeeb rule:** D1 — folder nesting capped at depth 5; portfolios (v3) handle
  cross-cutting grouping instead.

## C. Financial rigidity

### 12. Immutable budget/retainer types
- **Seen in:** Forecast (retainer budget type cannot be changed after creation).
- **Pain:** a contract renegotiation forces recreating the project and losing history.
- **Raqeeb rule:** budget types are convertible, with a recorded conversion event (D8).

### 13. Locked-period dead-ends
- **Seen in:** Forecast (locked time/retainer periods with no governed way back).
- **Pain:** one mislogged entry in a locked month requires support tickets or false
  entries in the next period.
- **Raqeeb rule:** locks are reversible by admins through a governed, audited unlock —
  the audit trail is the guardrail, not the wall.

### 14. Site-wide-only mutable cost rates
- **Seen in:** Teamwork (one cost rate per user, site-wide).
- **Pain:** every raise silently rewrites the profitability of all historical projects.
- **Raqeeb rule:** `person_cost_periods` — time-versioned cost rates, never a mutable
  column; `time_entries` snapshot bill+cost rates at entry (D8). ⚑

### 15. Budget delete-and-recreate rigidity
- **Seen in:** Teamwork.
- **Pain:** correcting a budget's fundamentals destroys its history and notifications.
- **Raqeeb rule:** budgets are editable with recorded change events and a visible
  history.

### 16. Profitability screens that leak cost rates
- **Seen in:** Teamwork (documents the risk itself: profit + known budget ⇒ colleagues'
  cost rates can be inferred).
- **Pain:** salary-adjacent data exposure through arithmetic.
- **Raqeeb rule:** profitability is permission-gated, and report design is reviewed for
  inference leaks (aggregation floors on small teams).

## D. Permissions & client access

### 17. Global-only guest permissions
- **Seen in:** Forecast.
- **Pain:** a guest invited to one project can be granted only account-wide access
  levels — so agencies simply don't invite clients.
- **Raqeeb rule:** per-project, per-user client permission matrix with per-item privacy
  (Teamwork's model), in the P5 portal.

## E. Platform & API

### 18. Key-only, full-access API ⚑
- **Seen in:** Forecast.
- **Pain:** every integration holds the keys to everything; no rotation story, no least
  privilege.
- **Raqeeb rule:** scoped, expiring, revocable PATs from the scaffold; OAuth2 with
  `resource:action` scopes in v2.

### 19. Scopeless, non-expiring personal tokens
- **Seen in:** ClickUp.
- **Pain:** tokens outlive employees and leak with full account power.
- **Raqeeb rule:** same as #18 — scoped + expiring is the only token shape Raqeeb
  issues.

### 20. Multiple concurrent API versions ⚑
- **Seen in:** Teamwork (v1/v2/v3 simultaneously live).
- **Pain:** integrators memorize which resource lives in which version; docs triple.
- **Raqeeb rule:** one API, deliberate versioning with a published deprecation policy
  (monday's quarterly cadence as the reference).

### 21. No in-product extension surface
- **Seen in:** Wrike.
- **Pain:** customers who outgrow the product can only leave; no marketplace ecosystem
  moat.
- **Raqeeb rule:** REST API + webhooks from day one; OAuth2 app platform and apps
  framework in P7 (monday as the model).

## F. Performance & UX

### 22. Performance debt / scale cliffs ⚑
- **Seen in:** ClickUp (90-second Everything view), monday.com (big boards), Wrike
  (large trees).
- **Pain:** the product punishes success — the bigger the customer, the worse the
  experience; the #1 category failure.
- **Raqeeb rule:** published performance budgets (task list p95 < 500 ms @ 10k tasks), a
  50k-task nightly fixture from Phase 2, virtualized views; regressions block release.

### 23. Feature clutter without progressive disclosure
- **Seen in:** ClickUp (~40 toggles, a dozen view types, steep learning curve), Wrike
  (high onboarding overhead).
- **Pain:** day-one overwhelm; admins become the only people who understand the tool.
- **Raqeeb rule:** minimal defaults, per-Space feature toggles that start *off*,
  monday-grade onboarding as the bar.

### 24. Notification overload
- **Seen in:** all six, explicitly flagged for ClickUp, Asana, monday, Wrike.
- **Pain:** users disable notifications entirely, then miss real signals.
- **Raqeeb rule:** triage-first inbox (ClickUp's Important/Other split + Asana's inbox
  UX) and digest defaults, designed in P2, expanded v2.

### 25. Arbitrary edit windows
- **Seen in:** Wrike (comments editable for only 5 minutes).
- **Pain:** permanent typos or noisy correction-comments; no user benefit.
- **Raqeeb rule:** comments remain editable, with edits recorded in the activity
  stream — trust the audit trail, not the timer.

### 26. Buggy or premature mobile apps
- **Seen in:** ClickUp, Asana.
- **Pain:** a bad mobile app damages trust in the whole product.
- **Raqeeb rule:** no mobile apps in v1 (an explicit non-goal); ship mobile only when it
  can meet the same quality budget as the web app.

### 27. Opaque AI
- **Seen in:** Forecast (recommendations without reasons).
- **Pain:** users won't act on staffing or budget advice they can't interrogate —
  especially when money is involved.
- **Raqeeb rule:** every P7 AI output (schedule, estimate, risk flag) ships with its
  reasoning and inputs visible.

### 28. Two disjoint tools for one job
- **Seen in:** Teamwork (Workload vs Schedule — separate resource tools with separate
  assumptions).
- **Pain:** two half-truths about capacity; teams reconcile them in spreadsheets.
- **Raqeeb rule:** one `allocations` model (D7) feeds every resourcing surface —
  workload, schedule, heatmap, utilization.

## Enforcement

These rules are load-bearing: each maps to a schema decision (D1–D10), a roadmap item
(P1–P7), or a pledge row in `../00-vision/02-positioning.md`. A proposal that violates
one must amend this document first — silently shipping an anti-pattern is a build error,
not a product decision.
