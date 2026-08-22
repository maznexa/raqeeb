# Competitive Analysis — Forecast

*The financial/resource spine Raqeeb copies — budget types, rate cards, retainers, EAC,
capacity heatmaps — from a product whose Accelo acquisition has put its customers in play.*

## Market situation

Forecast was acquired by **Accelo in July 2025** (correction to earlier research: not
Deltek). Its customer base is mid-migration. These customers — financially rigorous
agencies and consultancies — are Raqeeb's highest-value early segment, and this document
doubles as the checklist of concepts they will expect to recognize on arrival.

## Data model & hierarchy

```
Company → Programs / Connected Projects → Projects → Phases (= Milestones) → Tasks → Subtasks
```

- **Phases double as milestones** — scheduling structure and progress markers in one
  concept. Raqeeb keeps these separate (Sections for structure, milestone item-subtype
  for markers, D6) but preserves the phase-level financial roll-up idea.
- **Sprints optional per project**; per-project workflow columns categorized
  **TODO / INPROGRESS / DONE** — a three-group ancestor of Raqeeb's four canonical
  status groups.

## The financial spine (the core of what Raqeeb adopts)

- **Four budget types: Fixed Price / Time & Materials / Retainer / Non-billable.**
  Adopted directly as Raqeeb's `project_budgets.budget_type` (D8) — with one deliberate
  inversion: Forecast makes the retainer type **immutable** after creation; Raqeeb budget
  types are **convertible with a recorded conversion event**.
- **Retainers:** periods with targets in **hours or price**, **rollover of surplus or
  deficit** between periods, period **locking**, and per-period invoicing. Adopted as
  `retainers` + `retainer_periods` (rollover_in/out, overage, locking) in P3 — with
  governed escape hatches instead of locked-period dead-ends.
- **Rate cards:** per-role rates with **date-effective versions**; person cost rates are
  **time-versioned** (`person_cost_periods`). This is the single most important financial
  modeling lesson in the research: *rates are never a mutable column on a person* —
  history must survive rate changes. Raqeeb adopts both structures verbatim (D8).
- **The financials engine computes at project AND task level:**
  **Baseline / Planned / Actual / Remaining / At-Completion × revenue, cost, profit,
  margin**, plus variance objects and revenue recognition. Raqeeb's P3 profitability +
  EAC module targets this grid (task-level attribution flows through the `is_primary`
  location in `task_locations`).
- **Baseline = the pre-sale quote:** hours per role per phase + expenses, a **win
  probability**, and one-click generation of placeholders from the quote. The
  quote→delivery bridge is a v3 target; the win-probability weighting already informs
  the capacity pipeline view.

## The resource model (co-template with Wrike for Raqeeb P4)

- **Account-level resourcing strategy:** allocate-to-projects, assign-to-tasks, or
  **combined — where Demand = max(allocations, task estimates)**. Raqeeb adopts the
  combined formula as the default demand definition (D7).
- **Soft vs hard allocations** — converges with Wrike's tentative/confirmed bookings into
  Raqeeb's single `allocations` status flag.
- **Minutes-per-weekday granularity**; **placeholders** (role-level unnamed demand);
  capacity overview that **weighs pipeline by win probability**.
- **People Schedule heatmap with explicit health thresholds: ≤ 92% under-allocated,
  93–106% healthy, ≥ 107% over-allocated.** Raqeeb's P4 capacity heatmap ships with
  these exact thresholds as defaults.
- **Non-project time (vacation/sick) modeled as allocations**, plus **holiday
  calendars** — capacity math stays honest without a separate leave system.

## Time & invoicing

- **Timer + timesheets**, **billable split per entry**, an **approval workflow
  (submit → approve)**, entry **locking**, and AI suggestions. Raqeeb P3 adopts the full
  pipeline, storing snapshotted bill/cost rates on every `time_entries` row.
- **Native invoicing** (draft → approved → sent) with Xero / QuickBooks / e-conomic
  sync — Raqeeb's v3 invoicing target (QBO/Xero first).

## AI (the differentiator to replicate later)

- **Auto Schedule:** builds a plan from a task list — proposes assignees and estimates
  from history and **learns per-person estimation bias**.
- **Nova Insights:** budget-overrun risk, task performance ratio, team focus, predicted
  end date.
- **Time-registration suggestions** and **staffing suggestions**.

All four are P7 targets for Raqeeb — with one hard requirement Forecast failed:
**explainability**. Opaque AI in financial software erodes exactly the trust it needs.

## Weaknesses & anti-patterns to avoid

- **Hard-coded guardrails:** retainer budget type immutable after creation; locked
  periods with no governed way back. Raqeeb: convertible budgets with recorded events;
  locks reversible by admins, with the audit trail doing the guarding (pledge #10).
- **Key-only, full-access API** — one key, all the data, no scopes. Raqeeb: scoped PATs
  from the scaffold, OAuth2 scopes later (pledge #9).
- **Global-only guest permissions** — a guest's access is account-wide, not per-project.
  Raqeeb: the client/guest permission matrix is per-project (Teamwork's model).
- **Opaque AI** — recommendations without reasons.

## Summary for Raqeeb

Forecast defines Raqeeb's D8 financial spine and half of D7's resource model — budget
types, retainer mechanics, date-effective rates, cost periods, the EAC grid, the demand
formula, and the heatmap thresholds. Raqeeb replicates the engine, deletes the
guardrails, and times its arrival to the Accelo migration window.
