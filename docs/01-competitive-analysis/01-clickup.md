# Competitive Analysis — ClickUp

*What ClickUp gets right (deep hierarchy, custom statuses, modular toggles), what Raqeeb
adopts with mechanisms, and the performance/clutter debt Raqeeb must not inherit.*

## Data model & hierarchy

```
Workspace → Space → Folder → Subfolder → List → Task → Subtask (…7 levels via ClickApp) → Checklist
```

- **Tasks live only in Lists.** The List is the terminal container — the direct ancestor
  of Raqeeb's Project in D1 (`Tenant → Space → Folder → Project → Section → Task`).
- **"Tasks in Multiple Lists" ClickApp** ≈ multi-homing: a task can appear in additional
  Lists beyond its home. This is one of three independent validations (with Asana
  memberships and Wrike parents[]) behind Raqeeb's `task_locations` junction (D2).
- **Custom Task Types** with type-scoped custom fields — a lighter cousin of Wrike's CIT;
  feeds Raqeeb's `item_types` table (D5).
- **Custom Task IDs** (`DEV-123`) — per-container human-readable IDs. Raqeeb: the
  `is_primary` location in `task_locations` drives the task-ID prefix.
- **Statuses:** custom named/colored status sets configurable per Space/Folder/List,
  grouped into **Not Started / Active / Done / Closed**, with status templates and
  time-in-status tracking. Merged with Wrike's four groups, this becomes Raqeeb's
  canonical `not_started / active / done / cancelled` (D3).
- **Custom fields:** 23 types, including Formula, Rollup, Relationship, Button (triggers
  automations), auto-Progress, Voting, and AI Fields.
- **Dependencies:** blocking / waiting-on relations, with a downstream auto-reschedule
  ClickApp.

## Standout features Raqeeb adopts (with mechanism)

- **ClickApps — modular per-Space feature toggles (~40).** Features like sprints, time
  tracking, and multiple assignees switch on per Space. *Raqeeb mechanism:* per-Space
  feature flags stored on the Space, checked alongside plan entitlements — the same
  progressive-disclosure lever that keeps small teams' UI minimal. Raqeeb ships far fewer
  toggles, deliberately.
- **Custom statuses everywhere.** *Mechanism:* tenant-scoped reusable `workflows` →
  `statuses` (name, color, position, canonical_group); projects bind a workflow (space
  default, project override). Available on every plan tier — pledge #1.
- **Views as a family over one store:** List, Board (with WIP limits), Calendar, Table,
  Gantt, Timeline, Team, Workload — plus page-views (Doc, Chat, Form, Whiteboard,
  Dashboard). *Raqeeb:* List/Board/Table/Calendar in v1, Gantt/Workload in v2; exotic
  views (Mind Map, Map, Box) are consciously skipped as clutter.
- **Everything view** — workspace-wide task rollup. *Raqeeb:* v3, and only inside the
  performance budget (this is exactly the view ClickUp lets take 90 seconds).
- **Sprints as first-class** (points, velocity, burndown, auto-rollover automation) —
  adopted in the portfolio/scale phase, not v1.
- **Native time tracking:** timer, billable flag, estimates per-assignee, rollups.
  *Raqeeb:* subsumed by the richer Forecast/Teamwork time model (`time_entries` with rate
  snapshots) in P3, but ClickUp proves timers belong in the core product, not a tier gate.
- **Automations = trigger → conditions → actions, scoped at any hierarchy level**, with a
  webhook action and Button-field triggers. *Raqeeb:* the scoping model for the P5 recipe
  engine; webhook action included, Button triggers later (buttons are a v3 field type).
- **Form view with conditional logic**; **templates at every level**; **flexible
  recurrence**; **proofing annotations**; **Inbox with Important/Other split** (the
  antidote to notification noise); **Universal/Connected search**; **Goals with 4 target
  types** including task-based auto-progress.
- **Brain AI posture:** multi-model, agents, AI fields, MCP server in both directions —
  the shape of Raqeeb's P7 AI layer.

## Developer-platform lessons

- **Plan-tiered rate limits (100 → 10k req/min):** legible and upgrade-aligned; Raqeeb
  publishes per-plan limits with `RateLimit` headers.
- **Wildcard webhook events + webhook health monitoring:** adopt — Raqeeb webhooks carry
  event filters, HMAC signatures, and a health status.
- **Scopeless, non-expiring personal tokens: avoid.** Raqeeb PATs are scoped, expiring,
  and revocable from day one.

## Weaknesses & anti-patterns to avoid

- **Performance debt.** The Everything view can take ~90 seconds on large workspaces.
  This is the #1 competitor failure Raqeeb engineers against: published perf budgets
  (task-list p95 < 500 ms @ 10k tasks), a 50k-task nightly fixture from Phase 2,
  virtualized views.
- **Clutter and learning curve.** ~40 toggles, a dozen view types, features stacked on
  features. Raqeeb's counter: minimal defaults, progressive disclosure, fewer-but-fast
  views.
- **Hard automation caps that silently pause** rules. Raqeeb quotas return
  `ok | degraded` and never mass-disable.
- **Buggy mobile.** Reinforces the v1 non-goal: no mobile apps until the web product is
  earned.
- **Notification noise** — mitigated by adopting ClickUp's own best idea (Important/Other
  triage) as the default inbox model.

## Summary for Raqeeb

ClickUp is the donor of Raqeeb's status system, feature-toggle philosophy, and view
breadth ambitions — and the cautionary tale that scoped Raqeeb's performance budgets and
minimal-default UX. Adopt the depth; refuse the drag.
