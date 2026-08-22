# Competitive Analysis — Teamwork.com

*The client/agency layer Raqeeb copies — free client users, per-project permission
matrices, rate hierarchies, profitability — minus the tier-gating and rigidity that
frustrate its own base.*

## Data model & hierarchy

```
Site → Companies/Clients (first-class) → Projects → Task Lists → Tasks → Subtasks
```

- **Clients are first-class citizens of the hierarchy**, not a custom field. Projects
  belong to client companies; client identity flows into rates, currency, permissions,
  and reporting. Raqeeb adopts this outright: the `clients` table ships in the v1
  scaffold, and `projects.client_id` drives financial attribution (D8).
- **Task Lists** are the terminal work container (≡ Raqeeb Project per D1's mapping:
  Project ≡ ClickUp List ≡ Teamwork Task List ≡ monday Board).
- **Milestones with attached task lists** — delivery markers wired to the work that
  produces them; Raqeeb models milestones as an item subtype (D6) linkable to sections.
- **Site-level Workflows:** reusable stage sets with **per-stage automations**, plus
  Portfolio boards with triggers. A second validation (after ClickUp/Wrike) that status
  sets belong in a tenant-level library, and the direct precedent for status-entry
  automation hooks in Raqeeb's P5 engine.

## The client model (the template for Raqeeb's portal)

- **Client users are FREE** — they never consume seats (Teamwork caps them at 5
  projects); collaborators are free too. Raqeeb adopts the free-client principle as a
  schema fact (`memberships.is_billable_seat = false`, D9) and drops the arbitrary
  project cap.
- **Per-project, per-user permission matrix (~25 toggles)** — what a client sees and
  does is decided per project, not globally (the exact inverse of Forecast's
  global-only guests). Raqeeb's P5 client portal implements a curated version of this
  matrix.
- **Per-item privacy inside shared projects** — individual tasks/comments hidden from
  clients within a project they otherwise see. Essential agency behavior; adopted.
- **Clients view with client currency + client role rates** — client-scoped commercial
  context; folds into Raqeeb's rate resolution (below).

## Rates, budgets, profitability (co-template with Forecast for Raqeeb P3)

- **Rate hierarchy:** user site-wide billable + cost rate → role rates → client role
  rates → project rates (override). Raqeeb generalizes this into the D8 resolution
  order: **project override → client role rate → tenant rate card → user default**.
- **Budgets:** time/fee, fixed fee, **retainer with rollover and overspend
  subtraction**, task-list sub-budgets, expenses, **threshold notifications**, and
  **budget history**. All adopted in P3 (sub-budgets follow project budgets).
- **Profitability:** per-project panel — profit = budget − expenses − staff costs — plus
  a cross-project report. **Permission-gated, with a documented cost-rate inference
  warning**: showing profit to someone who knows the budget lets them derive colleagues'
  cost rates. Raqeeb inherits both the gate and the design caution.
- **Invoicing:** generate from unbilled time & expenses or fixed price; **invoiced time
  locks**; QuickBooks Online / Xero round-trip. Raqeeb v3 invoicing follows this shape.

## Other standout features Raqeeb adopts

- **Proofs:** versioned, with distinct **reviewers vs approvers**, and **external
  approval via email link without an account** — the zero-friction client signoff Raqeeb
  ships in P5 proofing.
- **Forms:** branded intake with conditional logic and field mapping into projects —
  merged with Wrike's form→blueprint factory in P5.
- **Utilization report with a per-user billable target (default 80%)** — the
  agency-health KPI in Raqeeb's P4 utilization reporting.
- **AI Teammates** — role-based assistants (Scout for personal work, Flo for project
  health); a P7 reference point alongside Asana's AI Teammates.

## Developer-platform lessons

- **Three concurrent API versions (v1/v2/v3)** — integrators must learn which endpoints
  live where. Raqeeb: one versioned API with a deliberate deprecation policy
  (pledge #9).

## Weaknesses & anti-patterns to avoid

- **Two disjoint resource tools** — Workload and Schedule are separate features with
  separate data assumptions. Raqeeb builds **one** resourcing surface on the single
  `allocations` model (D7).
- **Scale-gating the agency core** — retainers and profitability, the reasons agencies
  buy Teamwork, sit in the top tier. Raqeeb ships the agency core at Business tier.
- **Site-wide-only cost rates** — one mutable cost number per user corrupts historical
  margins every time it changes. Raqeeb: time-versioned `person_cost_periods`, never a
  mutable column (pledge #10).
- **Budget delete-and-recreate rigidity** — changing a budget's fundamentals means
  destroying its history. Raqeeb budgets are editable with recorded change events and
  history.
- **Three concurrent API versions** (above).

## Summary for Raqeeb

Teamwork defines Raqeeb's client layer end-to-end: first-class clients, free client
users, the per-project permission matrix, per-item privacy, the rate hierarchy, budget
mechanics, and permission-gated profitability. Raqeeb's differences are surgical — the
agency core priced where agencies live, cost rates with a time dimension, one resource
model, one API.
