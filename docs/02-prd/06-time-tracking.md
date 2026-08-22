# PRD 06 — Time Tracking

*A global timer and manual entries with per-entry billable split, timesheets with a real approval state machine, period locking, and bill/cost rates snapshotted at entry time — on every plan tier.*

## Overview

Time is the raw material of the whole financial spine (PRD 07): profitability, retainer burn, EAC, invoicing, and utilization all derive from `time_entries`. Two design rules follow. First, **every entry snapshots its bill rate and cost rate at creation** (resolved via the D8 hierarchy) so historical reports never drift when rates change. Second, entries move through an explicit **approval state machine** with **period locking**, because agencies cannot invoice from mutable data.

Raqeeb pledges **time tracking on every tier** (pledge #3 — rejecting Asana's Advanced+ gating): timer, manual entries, and the billable flag are universal; timesheets/approvals/locking start at Pro, and the rate/financial layer above them starts at Business (PRD 07).

Phase: **P3** (model specified now; `tasks.estimate_minutes` already ships in the Wave A scaffold).

## User stories

1. As a **member**, I can start a global timer from any task (or the top bar, picking the task) and it follows me across the app; stopping it creates a time entry on that task.
2. As a **member**, I can add and edit manual entries (duration or start/end, date, note) on any task I can access, so that untimed work is still captured.
3. As a **member**, I can mark each entry billable or non-billable — split within the same task and day — so that internal rework doesn't inflate client bills.
4. As a **member**, I can see and complete my timesheet in day and week grids (tasks × days, totals per day/week vs my scheduled hours) and submit the week when done.
5. As a **project lead**, I can review my team's submitted timesheets, approve or reject with a reason, and rejected entries return to the owner as drafts with an Inbox notification.
6. As a **finance admin**, I can lock a period (e.g. last month) so that no entry inside it can be created, edited, or deleted except by an explicit audited unlock — no Forecast-style locked-period dead-ends: unlock is always possible with the right permission.
7. As a **project lead**, I can set time estimates on tasks and see logged-vs-estimate progress bars and overrun flags, so that scope creep is visible daily, not at the retro.
8. As a **member**, only one timer of mine runs at a time; starting a second one stops and saves the first, so that I never discover a 14-hour phantom entry.
9. As a **finance admin**, I can trust that every entry carries the bill and cost rate that were in force on its date, so that changing a rate card next quarter never rewrites last quarter's margin.
10. As an **admin**, I can correct an unlocked entry's task/project attribution (with the story trail preserved) so that mis-filed time doesn't poison project reports.

## Functional requirements

### Capture
- **FR-1** Global timer: singleton per user (server-enforced); start(task) / stop / discard; running state visible in the top bar and on the task; survives navigation and re-login; auto-stop safeguard after a configurable maximum (default 12 h) with a fix-up prompt.
- **FR-2** Manual entries: fields = task (required v1), date, duration minutes (or start/end pair), note, billable flag. Duration granularity 1 min; per-tenant rounding policy (none / up to 6 min / 15 min) applied at entry creation and recorded.
- **FR-3** Entries always attach to a task; the entry's project attribution = the task's **primary location** (D2) at creation time, stored denormalized on the entry (immutable thereafter except FR-13 correction) so multi-homing never double-counts financials.
- **FR-4** Billable default: from the project's budget type (PRD 07) — e.g. non-billable projects default entries to non-billable; user may flip per entry unless the project forbids billable time.
- **FR-5** Rate snapshots: on create (and on FR-13 re-attribution), resolve `bill_rate_snapshot` and `cost_rate_snapshot` per the D8 hierarchy (project override → client role rate → tenant rate card → user default; cost from `person_cost_periods` effective on the entry date) and store them on the row. Snapshots never change when sources change. Members without cost visibility never receive cost fields in API responses (PRD 07 FR-gating).
- **FR-6** Others' time: leads/admins may add or edit entries for their reports (flagged `entered_by ≠ user_id`, story-logged); plan-gated to Pro+.

### Estimates
- **FR-7** `tasks.estimate_minutes` editable by assignees/leads; subtask estimates roll up to parent display (sum, shown separately from the parent's own estimate). Logged-vs-estimate and remaining (= max(0, estimate − logged)) power EAC (PRD 07) and demand (PRD 08).
- **FR-8 (later, P4)** Per-assignee estimates (`task_assignee_estimates`) for multi-assignee tasks, so demand splits correctly per person; until then demand divides the task estimate evenly among assignees.

### Timesheets & approval state machine
- **FR-9** Timesheet = a user's entries for a period (week default; day view included). Grid shows scheduled hours (from work schedules, PRD 08) vs logged, per-day and total; missing-day nudges per tenant policy.
- **FR-10** State machine per entry, driven by timesheet submission: `draft → submitted → approved`, with `rejected` returning to `draft`. Transitions: submit (owner), approve/reject (approver = project lead or designated approver chain; tenant setting: per-project vs per-person approval), reopen (approver, before lock). All transitions story-logged with actor + timestamp; rejection requires a reason.
- **FR-11** Approved entries are immutable to the owner; only an approver may reopen. Invoicing (PRD 07, P6) additionally sets `invoiced_at`, which locks the entry independent of period locks.
- **FR-12** Submission rules: tenant can require weekly submission by a deadline (e.g. Monday 12:00), with Inbox + email reminders and a lead dashboard of missing/unsubmitted timesheets.
- **FR-13** Correction flow: while unlocked and un-invoiced, approvers may re-attribute an entry (task/project); the original attribution is preserved in the story payload; snapshots re-resolve (FR-5) and the change is audit-logged.

### Locking
- **FR-14** `timelog_locks`: per-tenant period locks (date ranges, typically months); creating a lock requires all contained entries to be `approved` or explicitly listed as exceptions in the lock record. Inside a locked period: create/edit/delete of entries rejected (409 with lock reference) for everyone.
- **FR-15** Unlock: finance-admin permission, reason required, audit-logged; relock supported. Retainer period locks (PRD 07) and invoice locks compose with period locks — an entry is mutable only if **no** lock of any kind covers it.

## Data model touchpoints

| Table | Role |
|---|---|
| `time_entries` | The record: task, user, denormalized project/client attribution, date, minutes, note, `is_billable`, `bill_rate_snapshot`, `cost_rate_snapshot`, currency, state (`draft/submitted/approved/rejected`), `entered_by`, `invoiced_at`, timestamps. |
| `timesheet_submissions` | Per user+period submission envelope (state, submitted_at, approver, decided_at, reason). |
| `timelog_locks` | Period locks: range, created_by, reason, exceptions. |
| `tasks.estimate_minutes`, `task_assignee_estimates` (P4) | Estimates feeding EAC and demand. |
| `person_cost_periods`, `rate_cards`, `rate_card_entries` (PRD 07) | Rate resolution sources at snapshot time. |
| `stories`, `audit_logs` | Transition trail; lock/unlock and cross-user edits. |
| `work_schedules` (PRD 08) | Scheduled-hours baseline in timesheet grids. |

Wave B, migrated in P3; fully specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- **Every tier (pledge #3):** timer, manual entries, per-entry billable/non-billable flag, estimates, personal logged-time views.
- Pro: timesheets (day/week), submission + approval state machine, entering time for others, submission-deadline reminders.
- Business: timelog period locking, rate snapshots surfaced in financial reports (rates themselves are PRD 07/Business), utilization + billable targets (PRD 08), invoicing locks (P6).
- Enterprise: no additional time gates (audit/retention only).
- AI time-entry suggestions are PRD 14 (P7, metered).

## Out of scope / later

- Timelog categories/labels on entries (Wrike parity) — post-P3 if demand shows.
- Desktop idle-detection / auto-tracking — not planned (privacy posture).
- Time on non-task objects (project-level or "non-project time") — vacation/sick time is modeled as allocations (PRD 08), not time entries; project-level misc time uses a catch-all task.
- Per-entry approval routing chains (multi-step) — single approver step in v1.
- Mobile timer — with mobile apps, post-v1.
