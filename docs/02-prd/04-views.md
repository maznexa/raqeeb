# PRD 04 — Views

*One query/filter/group engine, many lenses: List first, then Board, Table, Calendar and My Work, then Gantt, Timeline and Workload — every view saved, shareable, pinnable, and inside the performance budget.*

## Overview

Views are how the same canonical tasks (PRD 02) are seen through different lenses. Raqeeb builds **one** underlying view engine — filter, sort, group, column-set, cursor pagination — and renders it through multiple view types, so a saved filter behaves identically in List, Board, or Gantt.

Rollout: **v1 (P2):** List view with grouping (section/status/assignee), filters, sort, saved views. **v2 (P2 for Board/Table/Calendar/My Work; P6 for Everything):** Board with WIP limits, spreadsheet-style Table, Calendar, My Work with Asana-style auto-promotion, tenant-wide Everything view. **v3 (P4):** Gantt with baselines/snapshots, Timeline, Workload (the workload data model is PRD 08's).

The performance budget is a hard requirement, not a note: **p95 < 500 ms task-list load at 10k tasks** (see `docs/04-architecture/observability-performance`; nightly 50k-task fixture from P2). Every view type must ship with virtualization and server-side pagination; a view that misses budget does not ship.

## User stories

1. As a **member**, I can filter a project's List by assignee, status group, due date, priority, and custom fields, group it by section or status, sort within groups, and save that configuration as a named view.
2. As a **project lead**, I can create shared saved views ("Client-facing backlog", "This sprint") that appear as tabs on the project for everyone, while my personal saved views stay mine.
3. As a **project lead**, I can set the default view per container (this project opens in Board; that folder's projects default to List) so that each team lands in its natural lens.
4. As a **member**, I can pin my most-used views (project tabs and sidebar) so that navigation is two clicks anywhere.
5. As a **member**, I can work a Board grouped by status with drag-to-change-status, and see WIP-limit highlights when a column exceeds its cap, so that flow problems are visible at a glance.
6. As a **member**, I can bulk-edit in Table view (multi-row select → set assignee/status/field) so that grooming 50 tasks takes a minute.
7. As a **member**, I can see date-bearing tasks on a Calendar (month/week), drag to reschedule, and show/hide multi-homed duplicates, so that scheduling is visual.
8. As a **member**, My Work shows everything assigned to me across all projects, auto-sorted into Recently assigned → Today → Upcoming → Later, with promotion rules moving items forward as dates approach, so that my day plans itself (Asana My Tasks model).
9. As an **admin (P6)**, I can open the Everything view across the tenant, filter by space/client, and it still loads inside budget, so that oversight doesn't require a data export.
10. As a **project lead (P4)**, I can plan in Gantt — drag bars, link dependencies, save a baseline before kickoff and compare actuals against it later.

## Functional requirements

### View engine (applies to all view types)
- **FR-1** A view definition = view type + filter tree (AND/OR groups over core fields, custom fields, assignee, status/canonical group, dates, client, item type) + sort (multi-key) + group-by + column set + view-type options (e.g. WIP limits, calendar span). Serialized as versioned JSON in `saved_views.definition`.
- **FR-2** Server-side execution: filters compile to SQL against tasks/task_locations/custom fields per the query-routing rule (PRD 03 FR-13); cursor pagination; result windowing for virtualized clients. No client-side full-dataset filtering above 1k rows.
- **FR-3** Saved views: personal (`visibility=private`) or shared (`visibility=container`, creator + leads can edit); both scoped to a container (project/folder/space/tenant). Ad-hoc toolbar changes on a shared view never mutate it silently — explicit "Save"/"Save as".
- **FR-4** Defaults & pinning: every container has a default view (set by lead/admin); users may set a personal default override per container; pinned views render as ordered tabs (per-user pin set, per-container shared tab order).
- **FR-5** All view types honor multi-homing: a task appears in each project view it is homed in; cross-project views (My Work, Everything) deduplicate to the canonical task and badge its locations.
- **FR-6** Realtime: views subscribe to entity-change broadcasts (outbox → Socket.IO) and patch in place; no full refetch on single-task changes.
- **FR-7** Every view type meets the budget: p95 < 500 ms initial payload at 10k tasks in container; interactions (drag, inline edit) reflect optimistically < 100 ms.

### List (v1 — P2)
- **FR-8** Grouping by section (default), status, assignee, priority, due bucket, or any select-type custom field; groups collapsible with counts and (Business) numeric-field aggregates per group.
- **FR-9** Inline create ("+ Add task" per group), inline edit of title/assignees/status/dates/fields; drag between groups applies the group value (e.g. drop on "In Review" sets status). Multi-select + bulk actions.

### Board (v2 — P2)
- **FR-10** Columns = status (default) or any single-select field / assignee; drag between columns writes the value; swimlanes by one additional dimension (Pro+).
- **FR-11** WIP limits per column (count-based): configurable per view; exceeded columns highlight; automations can react (PRD 09). Limits warn, never block.

### Table (v2 — P2)
- **FR-12** Spreadsheet grid: every core + custom field as a column; column show/hide/reorder/resize persisted in the view; keyboard navigation; bulk paste of values into a column (type-validated); CSV export of current view (Pro+).

### Calendar (v2 — P2)
- **FR-13** Month/week/agenda; tasks placed by due date (or start→due span bars); drag to reschedule; unscheduled-tasks side panel for drag-on; optional holiday-calendar underlay (P4).

### My Work (v2 — P2)
- **FR-14** Cross-project personal view fed by `task_assignees`; buckets: **Recently assigned** (new arrivals, unsorted), **Today**, **Upcoming** (≤ 7 days), **Later**. Auto-promotion rules (Asana model): items move Later → Upcoming → Today as due dates approach; user drag between buckets sets a personal plan date without touching the task's real dates.
- **FR-15** My Work includes approvals awaiting me (PRD 13) and (P3) a "time to submit" reminder card for timesheets; badge counts sync with Inbox (PRD 05).

### Everything view (v2 — P6)
- **FR-16** Tenant-wide rollup of all tasks the viewer can access (permission-filtered at query level, incl. client-portal exclusions); the standard toolbar applies; saved Everything views are Business+. Served within budget via composite indexes and mandatory pagination — the explicit anti-ClickUp-90-seconds requirement.

### Gantt & Timeline (v3 — P4)
- **FR-17** Gantt: time-scaled bars from start/due; milestones as diamonds; dependency lines with create-by-drag; drag/resize writes dates; auto-reschedule cascade preview per PRD 02 FR-18; critical-path highlight (Business); weekend/holiday shading from work schedules.
- **FR-18** Baselines/snapshots: capture named snapshot of all bar dates (auto-snapshot on first baseline save); overlay any snapshot as ghost bars; variance (days late/early) surfaced per task and rolled up.
- **FR-19** Timeline: lightweight single-row-per-group horizontal plan (Asana Timeline style) sharing the Gantt renderer without dependency editing.

### Workload (v3 — P4)
- **FR-20** Person-rows × time-columns heatmap fed by PRD 08's demand model (allocations vs capacity, Forecast thresholds ≤92 / 93–106 / ≥107%); drag tasks/allocations between people re-assigns/re-allocates; view-only here — the full semantics live in PRD 08.

## Data model touchpoints

`saved_views` (container scope, type, definition JSONB, visibility, creator, position), `view_pins` (user ↔ view, order), `projects.default_view_id` (+ per-user override in `user_container_prefs`), `gantt_snapshots` (P4: named baseline date sets). Reads span `tasks`, `task_locations`, `task_assignees`, `statuses` (canonical groups), `custom_field_values` / `tasks.custom_fields_cache`; realtime via `outbox_events`. Wave B; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: List + Board, 1 saved view per container, default views.
- Pro: Table, Calendar, My Work, unlimited saved views (personal + shared), pinning, swimlanes, CSV export.
- Business: Gantt + baselines, Timeline, Workload, Everything view, per-group aggregates, critical path.
- Enterprise: no extra view gates (dashboards/exports scale in PRD 12).
- Gating never touches the view *engine*: filters, sort, grouping work identically on every tier.

## Out of scope / later

- Mind Map, Map, Box, Chat, Doc, Whiteboard page-views (ClickUp parity) — not before the apps framework.
- Form view — intake owns forms (PRD 10).
- Public/embeddable read-only view links — post-P6 (client portal covers the primary need).
- Per-view field-value conditional formatting — P6+ nice-to-have.
- Offline/local-first view cache — not planned for v1–v3.
