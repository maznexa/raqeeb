# PRD 08 — Resource Planning

*Effort, duration, assignment, and allocation are four different things: bookings for people or placeholder roles, real work schedules, a Forecast-thresholded capacity heatmap, and utilization against billable targets.*

## Overview

Resource planning is where most competitors blur concepts until numbers stop meaning anything. Raqeeb's model (decision D7) keeps four ideas strictly separate:

- **Effort** — `estimate_minutes` on a task (how much work it is),
- **Duration** — the task's start→due window (when it happens),
- **Assignment** — who executes (`task_assignees`),
- **Allocation** — a reservation of a person's (or a placeholder role's) capacity on a project over a date range (`allocations`).

Allocations unify Wrike bookings ≡ Forecast soft/hard allocations ≡ Asana's Allocations API: person **XOR** placeholder role, project, date range, tentative|confirmed, hours/day or a distributed total. **Demand = max(allocations, task-estimate demand)** per person·project·period — Forecast's combined mode — so planning and execution never double-count. Capacity comes from **work schedules** (per-user weekly hours, dated exceptions, holiday calendars), and the heatmap uses Forecast's proven thresholds: **≤ 92% under-allocated · 93–106% healthy · ≥ 107% over-allocated**. One deliberate rejection: Teamwork's two disjoint resource tools (Workload vs Schedule) — Raqeeb has **one** allocation store behind every resource surface.

Phase: **P4**.

## User stories

1. As a **resource manager**, I can allocate Sara to Project Alpha at 4 h/day for 6 weeks as *tentative*, then flip to *confirmed* when the SOW signs, so that pipeline and committed load are distinguishable.
2. As a **resource manager**, I can book a *placeholder* ("Senior Designer, 60 h across March") before knowing who will do the work, and later convert it to a named person, keeping the same allocation record.
3. As a **resource manager**, I can see a capacity heatmap (people × weeks) colored by the Forecast thresholds, filter by role/space/client, and drill into any hot cell to see exactly which allocations and task estimates make it red.
4. As an **admin**, I can define each person's work schedule (weekly hours per weekday, e.g. Sun–Thu 8 h for our Riyadh team), dated exceptions (part-time month, parental leave), and attach a holiday calendar, so that capacity math reflects reality, not a hard-coded 40.
5. As a **member**, my vacation/sick time is entered as non-project allocations so that my heatmap cell shows me unavailable rather than mysteriously under-allocated.
6. As a **project lead**, when task estimates in my project exceed what's allocated, the demand line shows the higher number and flags the gap, so that I ask for capacity before the crunch.
7. As a **resource manager**, I can drag allocations between people on the heatmap (respecting role match warnings) so that rebalancing is direct manipulation, not ticket-filing.
8. As an **agency owner**, I can see a utilization report — billable hours vs capacity per person vs their billable target (default 80%) — over any period, so that staffing decisions are grounded.
9. As a **project lead**, unscheduled-but-estimated work sits in a **Backlog Box** beside the workload view, and dragging it onto a person/week creates the allocation, so that nothing invisible eats the plan (Wrike Backlog Box).
10. As a **resource manager**, tentative allocations can be included/excluded from the heatmap with one toggle so that I can view committed-only or pipeline-weighted load.

## Functional requirements

### Allocations
- **FR-1** `allocations`: tenant, project, **exactly one of** `person_id` XOR `placeholder_role_id` (DB CHECK), date range, mode ∈ `hours_per_day` (value applied to each working day in range, per the person's schedule) or `total_distributed` (total hours spread over working days), status ∈ `tentative / confirmed`, note, creator. Optional `task_id` link for task-anchored bookings.
- **FR-2** CRUD with drag/resize semantics from the heatmap and workload views; splitting an allocation at a date produces two rows sharing a `series_id` for history.
- **FR-3** Placeholder → staffing conversion: assigning a person to a placeholder allocation swaps the XOR fields in place (same row id, story-logged), and optionally bulk-offers to also assign that person to the project's matching unassigned tasks.
- **FR-4** Non-project time: system projects per tenant ("Vacation", "Sick", "Internal") accept allocations; these subtract from available capacity rather than counting as project load, and render distinctly in the heatmap.
- **FR-5** Permission: resource managers (admin or granted role) manage allocations tenant-wide; project leads manage allocations on their projects; members see their own schedule and (tenant setting) the team heatmap without money data.

### Work schedules & calendars
- **FR-6** `work_schedules`: per person — weekly template (minutes per weekday; supports Sun–Thu and Mon–Fri weeks), effective-dated versions; `schedule_exceptions` for dated overrides (single day or range, altered hours incl. zero).
- **FR-7** `holiday_calendars` + `holidays`: named calendars (e.g. KSA, UAE, US) assignable per person (default from tenant); holidays are zero-capacity days. Calendars feed capacity math here, timesheet grids (PRD 06), and dependency auto-reschedule + Gantt shading (PRDs 02/04).
- **FR-8** Capacity(person, period) = Σ scheduled minutes − holidays − zero-exceptions. Changing a schedule recomputes affected heatmap aggregates asynchronously (outbox-driven), tolerating eventual consistency of a few seconds.

### Demand & heatmap
- **FR-9** Task-estimate demand: for tasks with estimates and date windows, remaining estimate (estimate − logged) spreads across the remaining working days of the window per assignee (divided evenly among assignees until per-assignee estimates land, PRD 06 FR-8). Tasks without dates contribute to the Backlog Box, not the heatmap.
- **FR-10** **Demand(person, project, period) = max(allocated hours, task-estimate demand)** — never the sum. The heatmap cell shows demand/capacity %, colored: **≤ 92% under · 93–106% healthy · ≥ 107% over** (thresholds tenant-tunable, Forecast defaults).
- **FR-11** Heatmap: people (groupable by role/team) × day/week/month columns; filters (space, project, client, role, tentative on/off); cell drill-down lists constituent allocations + tasks with jump links; drag between people/rows re-allocates (role-mismatch warning). Meets the PRD 04 performance budget at 200 people × 26 weeks.
- **FR-12** Placeholder rows render in the heatmap as unnamed demand grouped by role, so hiring/staffing gaps are visible alongside real people.
- **FR-13** Backlog Box: panel of scheduling candidates — estimated tasks without dates, unstaffed placeholders — draggable onto the grid to create allocations or set dates.

### Utilization
- **FR-14** `memberships.billable_target_pct` (default **80%**). Utilization report per person/team/period: capacity, logged (billable/non-billable split from PRD 06), allocated, **billable utilization % = billable logged ÷ capacity**, variance vs target; historical trend and CSV/scheduled export (PRD 12).
- **FR-15** Utilization respects cost-visibility gating (PRD 07 FR-15): hours are visible to leads; monetized utilization (revenue per person) requires financial permissions.

## Data model touchpoints

`allocations` (person XOR placeholder CHECK, mode, status), `placeholder_roles` (a.k.a. job roles — shared with rate cards' role dimension in PRD 07), `work_schedules`, `schedule_exceptions`, `holiday_calendars`, `holidays`, `memberships.billable_target_pct`; reads `tasks` (estimates, dates), `task_assignees`, `time_entries` (logged/billable), `projects`/`clients` for filters; `outbox_events` for async aggregate recompute; `stories` for allocation changes. Wave B, P4; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free / Pro: personal capacity basics only — My Work due-load and (Pro) a personal week grid of own estimates vs schedule. No allocations.
- **Business:** the full module — allocations (tentative/confirmed), placeholders + conversion, work schedules + exceptions + holiday calendars, capacity heatmap with thresholds, Backlog Box, utilization report with billable targets, Workload view (PRD 04).
- Enterprise: larger org scale (heatmap perf tier), skills matrix when shipped.
- Threshold semantics and the demand=max rule are identical wherever the feature exists — no "lite math" tiers.

## Out of scope / later

- Skills matrix & skill-based staffing suggestions — P7 with the AI layer (PRD 14 staffing suggestions come first as heuristics).
- Win-probability-weighted pipeline capacity (Forecast baseline integration) — post-P6, alongside the quote/baseline module.
- Auto-leveling / auto-balancing of overloads — P7 auto-schedule territory (PRD 14); v1 is manual drag with warnings.
- Per-assignee task estimates — PRD 06 FR-8, lands P4 as noted.
- Approval workflow on allocation changes (booking requests) — not planned before Enterprise feedback.
