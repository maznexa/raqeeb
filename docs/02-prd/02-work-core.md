# PRD 02 — Work Core

*The work engine: a five-level container hierarchy, one canonical task that can live in many projects, custom statuses with sane canonical groups, typed items, real dependencies, and multiple assignees on every tier.*

## Overview

Work Core is the center of Raqeeb and the bulk of the Phase 0 scaffold. Its shape is fixed by domain decisions D1–D6 and D10:

- **Hierarchy (D1):** Tenant → **Space** (permission/feature boundary) → optional nested **Folders** (≤ 5 deep) → **Project** (terminal container; ≡ ClickUp List / Teamwork task list / monday board) → **Section** → **Task** (+ subtasks). Portfolios are cross-cutting collections (PRD 12), never part of the containment tree.
- **Multi-homing (D2):** a task is one canonical row in `tasks`; its placements live in `task_locations` (project, section, fractional position, `is_primary`). Validated three times over by Asana memberships, Wrike `parents[]`, and ClickUp tasks-in-multiple-lists — this ships day one, not as a retrofit.
- **Statuses (D3):** tenant-scoped reusable `workflows` containing ordered `statuses`, each mapped to a canonical group ∈ `not_started / active / done / cancelled` (merger of ClickUp's and Wrike's group models) so reporting stays sane no matter how creative status names get. Custom statuses on **every** tier (pledge #1).
- **Item types (D5/D6):** `item_types` ships now with `base_kind ∈ task / milestone / approval` and seeded system types; Wrike-style custom item types (layouts, type-scoped fields/automations) come in v2.
- **Ordering (D10):** fractional-indexing TEXT keys; the API only ever accepts `insert_before`/`insert_after` ids.

## User stories

1. As an **admin**, I can create Spaces with per-space feature toggles and member access so that departments get boundaries without separate tenants.
2. As a **member**, I can organize projects inside nested folders (up to 5 levels) so that a large agency's client → brand → campaign structure fits naturally.
3. As a **member**, I can create a task in a project section, drag it to reorder or move it across sections, and the order holds for everyone.
4. As a **member**, I can home one task into a second project ("add to project…") so that the design team and the campaign team track the same work item without duplicates — edits, comments, and time show identically in both.
5. As a **project lead**, I can bind my project to a tenant workflow or override with a project-specific one, and rename/recolor statuses, so that "In QA" can exist without breaking rollup reports (canonical groups).
6. As a **member**, I can assign multiple people to a task so that pair work does not require phantom duplicate tasks.
7. As a **member**, I can break a task into subtasks with their own assignees/dates/statuses so that execution detail lives under the parent.
8. As a **project lead**, I can link tasks with FS/SS/FF/SF dependencies plus lag, and the system rejects cycles at creation, so that my Gantt (P4) is a real DAG.
9. As a **member**, I can make a task recur (flexible schedules, ClickUp-style) so that repeating operational work regenerates itself.
10. As a **member**, I can reference any task by its human ID (e.g. `RAQ-123`) in comments, commits, and search so that communication survives renames.

## Functional requirements

### Containers
- **FR-1** Spaces: name, icon/color, privacy (open to tenant / private to members), per-space feature toggles (ClickApps-style: time tracking on/off, sprints later, etc.), default workflow. Admins create; space admins manage membership.
- **FR-2** Folders: optional, nested ≤ 5 levels (enforced server-side), exist only inside a space, contain folders and projects. No tasks directly in folders.
- **FR-3** Projects: terminal containers; fields: name, description, space/folder placement, workflow binding (space default unless overridden), optional `client_id`, task-ID prefix, color, archive state, default view. Projects contain ordered Sections; every project has an implicit default section.
- **FR-4** Deleting containers requires empty-or-confirm; deletion soft-deletes contents with 30-day trash restore.

### Tasks & multi-homing
- **FR-5** Task core fields: title, rich-text description, status (FK, must belong to the bound workflow of the location being viewed — see FR-8), priority (urgent/high/normal/low), start/due timestamps, `estimate_minutes`, item type, custom-ID number, timestamps, `created_by`.
- **FR-6** Every task has ≥ 1 row in `task_locations` (project_id, section_id, `position` fractional TEXT key, `is_primary`). Exactly one location has `is_primary = true`; it drives the task-ID prefix and financial attribution (D8). Removing the primary location promotes another explicitly (user choice or newest).
- **FR-7** Add/remove location and move-between-sections are single API operations accepting `insert_before`/`insert_after`; raw position keys are never exposed (D10). Concurrent inserts retry with jitter; a background job rebalances crowded key ranges.
- **FR-8** Status is a single value on the canonical task (one source of truth, Asana-style), not per-location. The workflow of the **primary** location governs the allowed status set; secondary-location boards render the status mapped by canonical group when the local workflow differs.
- **FR-9** Multiple assignees via `task_assignees` (no upper bound enforced below 20; soft-warn above 5). Assignee add/remove generates Stories events and notification fan-out (PRD 05).
- **FR-10** Subtasks: `tasks.parent_id`, nesting depth ≤ 5 (guard against ClickUp-style unbounded trees); subtasks are full tasks (assignable, schedulable, commentable, time-trackable) — never second-class (pledge #9). Subtask rollup (counts, % done by canonical group) is computed for parent display.
- **FR-11** Completing a parent with open subtasks prompts (complete all / leave open); configurable per project.

### Statuses & workflows
- **FR-12** `workflows` are tenant-level reusable libraries; each `statuses` row: name, color, position, `canonical_group ∈ not_started/active/done/cancelled`. Validation: ≥ 1 status in `not_started` and ≥ 1 in `done`; group is mandatory on every status.
- **FR-13** Projects bind exactly one workflow (space default → project override). Rebinding requires a status-mapping step for existing tasks (old status → new status), executed transactionally.
- **FR-14** Status changes are recorded in Stories with actor + timestamps, enabling time-in-status analytics (P6 dashboards).

### Item types & subtypes
- **FR-15** Seeded system item types: **task**, **milestone** (`base_kind=milestone`: due-date-only, no duration; rendered as diamonds in Gantt), **approval** (`base_kind=approval`: carries `approval_status ∈ pending/approved/changes_requested/rejected` per D6; behavior in PRD 13). System types are not deletable; tenants may add named types on these base kinds in v1 (icon + name only); type-scoped fields/layouts/automations are v2 (P6).

### Dependencies
- **FR-16** `task_dependencies`: predecessor, successor, `dep_type ∈ FS/SS/FF/SF`, `lag_minutes` (signed). UNIQUE(predecessor, successor). Cross-project dependencies allowed within a tenant.
- **FR-17** Cycle rejection at write time via DAG reachability check (recursive CTE); the error names the offending path.
- **FR-18** v1 behavior: dependencies are informational (blocked badges, "waiting on" lists, warn on completing a successor before its predecessor). **P4:** auto-reschedule — shifting a predecessor cascades `max(current_start, pred_end + lag + non-working-day buffer)` through downstream tasks, respecting work schedules and holiday calendars (PRD 08), with a preview + undo batch.

### Recurrence & custom IDs (P2)
- **FR-19** Recurrence rules per task (RRULE subset + ClickUp-style "on complete" mode): on schedule or on completion, spawn the next occurrence (copy of fields/assignees/checklist state per settings) linked to the template task; skip/holiday handling per tenant calendar.
- **FR-20** Custom task IDs: per-project prefix (e.g. `RAQ`) + tenant-scoped monotonic sequence per project ⇒ `RAQ-123`. Immutable once issued; searchable; resolves via `/t/RAQ-123` deep link. Prefix defaults from project name; editable by project lead (existing IDs keep the old prefix).

### Everything view concept (v2 — P6)
- **FR-21** A tenant-wide (space-filterable) rollup view of all tasks the viewer can access, with the standard filter/sort/group toolbar (PRD 04). Served by indexed queries + cursor pagination; must meet the p95 < 500 ms budget at 10k visible tasks — this is the anti-ClickUp-Everything-view performance line.

## Data model touchpoints

`spaces`, `folders`, `projects`, `sections`, `tasks`, `task_locations` (D2 junction), `task_assignees`, `task_dependencies`, `workflows`, `statuses`, `item_types` — all Wave A scaffold tables, RLS-scoped, composite indexes leading with `tenant_id`. `outbox_events` receives entity-change events for realtime broadcast; `audit_logs` records destructive operations. Recurrence adds `task_recurrences` (Wave B); custom IDs add `projects.task_prefix` + `projects.next_task_number`.

## Plan-tier gating

- **Every tier (pledges):** full hierarchy, multi-homing, subtasks, dependencies with cycle rejection, custom statuses/workflows, multiple assignees.
- Free: capped total task count generous enough to never feel like a wall (limit in packaging doc); recurrence limited to N active rules.
- Pro: custom task IDs, unlimited recurrence, custom item type naming.
- Business: dependency auto-reschedule (P4) and cross-project dependency reporting; Everything view (P6).
- Enterprise: no additional work-core gates (scale/isolation options only).

## Out of scope / later

- Wrike-style full Custom Item Types (type-scoped fields, layouts, automations, blueprints-per-type) — v2, P6.
- Dependency auto-reschedule & Gantt — P4 (model ships now; behavior later).
- Sprints as first-class (points, velocity, burndown) — post-P6 consideration.
- Checklists inside tasks — P2 nice-to-have, not scaffold.
- Mind Map / Whiteboard / Doc page-views — not planned before the apps framework.
- Per-location status values — rejected by design (one canonical status; groups bridge workflows).
