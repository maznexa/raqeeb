# Canonical Status Groups

> **Status:** Accepted (part of D3).
> Every status in every workflow maps to exactly one of four canonical groups:
> **`not_started` · `active` · `done` · `cancelled`**.
> Status *names* are free (per-tenant, per-workflow, any language); status *semantics* are
> fixed by the group. All reporting, rollups, automations, and burndowns are written against
> groups, never against names.

## Why four groups

Wrike demonstrated the pattern (unlimited custom statuses, exactly four canonical groups →
reporting stays sane at any scale); ClickUp's group model confirms it. Raqeeb merges the two
group vocabularies:

- ClickUp `Done` and `Closed` collapse into **`done`** — the done/closed split duplicates
  what archiving already expresses.
- Wrike `Deferred` maps to **`not_started`** — deferred/on-hold work is work that is *not
  happening*, and reporting must treat it that way (see semantics below).
- `cancelled` is kept as its own terminal group (Wrike `Cancelled`) because "won't do" and
  "done" must never be conflated in velocity, billing, or burndown math.

## Competitor mapping table

| Competitor | Their model | Their group/state | → Raqeeb group | Notes |
| --- | --- | --- | --- | --- |
| **ClickUp** | Custom statuses in 4 groups | Not Started | `not_started` | direct |
| | | Active | `active` | direct |
| | | Done | `done` | |
| | | Closed | `done` | Raqeeb does not split done/closed; use archive for "fully retired". Import: statuses named cancelled/won't-do inside Closed → `cancelled`. |
| **Wrike** | Custom statuses in 4 groups | Active | `active` | direct |
| | | Completed | `done` | direct |
| | | Deferred | `not_started` | **deferred/on-hold ≡ not started** — see semantics |
| | | Cancelled | `cancelled` | direct |
| **Asana** | Binary complete + sections as stages | Incomplete | `not_started` or `active` | Import heuristic: section name matched against a stage dictionary ("Backlog", "To do" → `not_started`; "Doing", "In progress", "Review" → `active`); unmatched → `active`. |
| | | Complete | `done` | |
| | Approval subtype | Rejected | `cancelled` | pending → `active`; approved → `done`; changes_requested → `active`. |
| **monday.com** | Per-board status labels (color-typed) | Labels flagged as "Done" type | `done` | monday marks done-type labels per board. |
| | | "Stuck" and similar | `active` | Stuck is *blocked but in play*; blocking is a flag/automation concern, not a group. |
| | | Default / neutral labels | `not_started` or `active` | Import heuristic by label name + position; first column labels → `not_started`. |
| **Forecast** | Workflow columns categorized | TODO | `not_started` | direct |
| | | INPROGRESS | `active` | direct |
| | | DONE | `done` | direct — Forecast has no cancelled category; "halted"-style columns import as `cancelled` by name match, else `not_started`. |
| **Teamwork** | Board columns/stages + complete flag | Complete flag | `done` | The flag wins over column. |
| | | "On Hold" / "Waiting" columns | `not_started` | on-hold ≡ not started |
| | | Working columns | `active` | Column name heuristic, same dictionary as Asana sections. |
| | | Backlog/intake columns | `not_started` | |

Import tooling ships this table as data: a name-matching dictionary (multi-language,
including Arabic stage names) with per-import manual override.

## Group semantics

These semantics are the *contract* — every feature that reasons about state must use this
table and nothing else.

| Semantic | `not_started` | `active` | `done` | `cancelled` |
| --- | --- | --- | --- | --- |
| `is_complete` | no | no | **yes** | no |
| Terminal (leaves remaining-work pool) | no | no | yes | yes |
| `completed_at` behavior | cleared | cleared | set on entry | cleared (cancellation ≠ completion) |
| Overdue eligibility (due_date < today) | **yes** | **yes** | no | no |
| Counts in "remaining work" (lists, My Work) | yes | yes | no | no |
| Burndown treatment | remaining scope | remaining scope | burned (progress) | **removed from scope** (scope-change line, not progress) |
| Velocity / throughput | — | — | counts | never counts |
| Time tracking allowed | yes | yes | yes (late logs) | yes (write-down analysis) |
| Auto-reschedule cascade (P4) participates | yes | yes | no | no |
| Default list filter | shown | shown | hidden (toggle) | hidden (toggle) |
| Workflow validation | ≥ 1 required per workflow | optional | ≥ 1 required per workflow | optional |

### Notes and edge rules

1. **Deferred/on-hold maps to `not_started`, deliberately.** An on-hold task is overdue-
   eligible and sits in remaining scope — hiding it in a soft "deferred" limbo is how
   Wrike-style reports quietly lose work. Teams that want an explicit "On Hold" state
   create a status named *On Hold* in the `not_started` group: the name communicates,
   the group keeps the math honest.
2. **`done` vs archive.** "Closed"-style post-completion states are not a fifth group;
   archiving (`archived_at`) removes done work from default views. This is the anti-ClickUp
   simplification.
3. **`cancelled` in burndown** renders as a scope-reduction event on the date of
   cancellation (the ideal line drops), never as completed work — otherwise cancelling
   half a sprint looks like shipping it.
4. **`completed_at`** is maintained by status-transition logic only (single code path in
   the Tasks module): set when a task enters any `done` status, cleared when it leaves the
   group. Reports use `completed_at`, never status-name string matching.
5. **Approval subtype interplay (D6):** `approval_status` is orthogonal. Convention:
   automations may sync `approved → done-group status`, but the model does not force it.
6. **Multi-homing (D2):** status is a property of the task, not the location — one task in
   three projects has one status. Per-location board columns beyond sections are a saved-
   view concern (P2), not a status concern.
