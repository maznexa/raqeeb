# Competitive Analysis — Asana

*The cleanest object model and best developer platform in the category — and two famous
ceilings (single assignee, binary completion) Raqeeb explicitly rejects.*

## Data model & hierarchy

```
Workspace/Organization → Team → Project → Section → Task → Subtask   (5 levels)
```

- **Multi-homing is the killer primitive.** A task belongs to N projects via project
  *memberships* while remaining one source of truth — no duplication, no sync. This is
  the strongest of the three independent validations behind Raqeeb's D2:
  canonical `tasks` + `task_locations` (project_id, section_id, position, is_primary).
- **Sections** inside projects — directly adopted as Raqeeb's Section level in D1.
- **Task subtypes:** default / **milestone** / **approval** (approval states: pending /
  approved / changes_requested / rejected). Adopted as Raqeeb D6: milestone
  (due-date-only) and approval (approval_status) subtypes ship in the v1 model, seeded
  through the `item_types` table.
- **No custom statuses — binary complete/incomplete.** A top user complaint. **Do not
  copy.** Raqeeb's D3 workflow/status model exists precisely because of this gap.
- **Custom fields:** text, number (+formula), enum, multi_enum, date, people,
  reference (typed links), custom-ID — with a **global field library** plus per-project
  fields. The library idea (define once, reuse everywhere) becomes Raqeeb's tenant-level
  field library with space/project scoping (D4).
- **Portfolios:** nestable, with their own custom fields, status rollups, and workload —
  the template for Raqeeb's v3 portfolio layer (cross-cutting collections, not hierarchy).
- **Stories — event-stream activity model.** Every change is an immutable event on the
  object. Raqeeb adopts this as the activity/audit backbone for comments-and-history (P2)
  because it gives a clean audit trail for free.

## Standout features Raqeeb adopts (with mechanism)

- **My Tasks auto-promotion.** Tasks flow Recently assigned → Today / Upcoming / Later by
  rules, so the personal view triages itself. *Raqeeb:* the My Work view (P2) implements
  promotion rules over due dates and assignment recency.
- **Inbox triage UX** — follow/unfollow, archive-first notification stream; part of
  Raqeeb's answer to category-wide notification overload.
- **Workflow Builder** — visual project pipeline: intake form → sections → rules → app
  actions. Informs how Raqeeb composes forms + sections + automations in P5.
- **Rules** with conditions, **scheduled triggers**, **variables**, and **Rule bundles**
  — reusable, centrally governed rule packages applied across projects. *Raqeeb:*
  recipe-sentence engine in P5; bundles arrive with the portfolio/governance layer.
- **Goals with auto progress rollup from projects** — v3 goals layer.
- **Allocations API — staffing distinct from task assignment** (percent or hours over a
  date range), plus portfolio/universal Workload comparing an Effort field against weekly
  capacity, with OOO awareness. This is a founding input to Raqeeb D7: `allocations`
  (person XOR placeholder-role, project, date range, hrs/day, tentative|confirmed) as a
  first-class table, independent of `task_assignees`.
- **Approval tasks** and **proofing** — native review objects rather than status hacks;
  feed Raqeeb's P5 proofing/approvals module.
- **Project templates instantiated as async jobs** — the correct mechanic for copying
  large trees; Raqeeb blueprints (P5) instantiate the same way via BullMQ.
- **AI Studio (AI steps inside rules) + AI Teammates** — the shape of Raqeeb's P7
  automation-native AI.

## Developer-platform lessons (best-in-class — adopt the discipline wholesale)

- REST with **`opt_fields` sparse fieldsets** — clients fetch exactly what they need.
- **Batch API** for compound operations.
- **Events API** (polling with sync tokens) *plus* webhooks — two sync styles, one event
  stream.
- **Webhooks done right:** HMAC handshake on registration, signature on delivery,
  filters, heartbeats. Raqeeb copies this contract verbatim in P2.
- **Granular OAuth scopes (`resource:action`) + refresh tokens; service accounts** for
  enterprise automation.
- **Official SDKs, published OpenAPI, docs served as `.md` / llms.txt** — agent-readable
  documentation. Raqeeb publishes OpenAPI + llms.txt from day one.

## Weaknesses & anti-patterns to avoid

- **Single assignee per task.** The most-worked-around limitation in the product. Raqeeb:
  `task_assignees` is many-to-many (pledge #2).
- **Binary completion / no custom statuses.** Raqeeb: D3 workflows on every tier
  (pledge #1).
- **Tier-gating basics:** time tracking and workload sit behind Advanced+. Raqeeb prices
  tiers on limits and enterprise controls, not amputated fundamentals.
- **Hard automation caps that silently pause** rules — same cliff as the others; Raqeeb
  quotas degrade gracefully.
- **Buggy mobile** and **notification noise** — reinforce the v1 mobile non-goal and the
  triage-first inbox.

## Summary for Raqeeb

Asana contributes Raqeeb's two deepest structural choices — multi-homing and the
event-stream activity model — plus the allocations concept and the API discipline the
public platform imitates. Its ceilings (one assignee, done/not-done) are the exact holes
Raqeeb's D3/D7 decisions are drilled through.
