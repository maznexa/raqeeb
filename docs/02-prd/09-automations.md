# PRD 09 — Automations

*monday-style recipe sentences — "When [trigger], only if [conditions], then [actions]" — scoped with inheritance, with a full run audit trail and quotas that degrade gracefully instead of mass-pausing every rule.*

## Overview

Raqeeb's automation engine adopts the model users demonstrably understand: the **recipe sentence**. A rule reads as one sentence — *When status changes to Done, only if priority is Urgent, then notify the project lead and set field "Resolved on" to today* — assembled from a trigger catalog, optional condition groups, and an ordered action list.

Rules are **scoped** at space, folder, or project, and inherit downward: a space rule applies to every project inside unless a descendant disables it. Cross-project actions (create/move a task elsewhere) support **field mapping** (monday's cross-board recipes). Execution runs on BullMQ with per-rule and per-tenant safeguards.

The defining pledge (#6): **quotas degrade gracefully, never mass-pause.** monday pauses accounts at 250 runs; Wrike disables *everything* at zero balance. Raqeeb's quota service `consume()` returns `ok | degraded`; degraded runs **queue** at lower priority and the owner is **notified** with an upgrade path — no silent workflow death, ever.

Phase: **P5** (webhook *deliveries* for integrations exist from P2; the rule engine is P5). Natural-language rule creation and rule bundles are v3 (P7).

## User stories

1. As a **project lead**, I can build a rule from dropdowns that reads as a sentence, preview which recent events *would have* matched, and enable it — without documentation.
2. As an **admin**, I can define a rule once at space level ("when a task moves to Done, set Completed date") and have it govern all 40 projects in the space, with per-project opt-out.
3. As a **project lead**, I can automate cross-project flow: when a task here reaches "Ready for design", create a linked task in the Design project with title/fields mapped from the source.
4. As an **operations admin**, I can use scheduled triggers ("every Monday 08:00", "2 days before due date") so that recurring nudges and SLA warnings run themselves.
5. As a **developer**, I can add a "call webhook" action with a templated JSON payload and HMAC signature so that rules reach systems Raqeeb doesn't know about.
6. As an **admin**, when we exceed our monthly run quota, new runs queue with a delay and I get a clear notification with usage numbers — my client-facing automations never silently die mid-month.
7. As a **project lead**, I can open any rule's run history — trigger event, condition evaluation, each action's result or error — so that "why didn't the automation fire?" takes one minute to answer.
8. As an **admin**, I can see tenant-wide automation usage by rule (runs, failures, quota consumption) and pause or fix noisy rules individually.
9. As a **member**, actions performed by automations are clearly attributed ("Automation: *Close stale tasks*") in task activity so that ghost edits never confuse the team.
10. As an **admin (v3)**, I can type "when a form submission has budget over 10k, assign to Layla and set priority urgent" and get a correctly configured draft rule to review.

## Functional requirements

### Rule model & scoping
- **FR-1** `automation_rules`: scope (space/folder/project FK), name (auto-generated sentence, editable), trigger (type + params), condition tree (AND/OR groups), ordered actions (type + params, ≤ 10 per rule), enabled flag, owner, created/updated audit.
- **FR-2** Inheritance: rules apply to all descendant containers of their scope; descendants can disable an inherited rule (`automation_rule_overrides`); the rule list at any container shows local + inherited rules with origin badges.
- **FR-3** The builder renders the sentence live, validates parameter completeness, and offers a dry-run preview against the last 7 days of events (matched-event list, no side effects).

### Trigger catalog (P5)
- **FR-4** Triggers: **status changed** (to/from/any, canonical-group option), **field changed** (core or custom field, to/from), **task created**, **task moved** (into section/project — incl. multi-home add), **assignee added/removed**, **due date arrives / N before/after** (date-based, evaluated by scheduler), **form submitted** (PRD 10), **scheduled** (cron-like: daily/weekly/monthly at time, tenant timezone), **budget threshold crossed** (PRD 07), **approval decided** (PRD 13), **WIP limit exceeded** (PRD 04). Button-field trigger is v3 with the button field (PRD 03).
- **FR-5** Conditions: comparisons over task core fields, custom fields, status/canonical group, assignees, item type, location (project/section), client, dates (relative windows), and trigger metadata (old/new values). Grouped AND/OR to depth 2.

### Action catalog (P5)
- **FR-6** Actions: set status; set/clear field (core or custom); add/remove assignee (person or "trigger actor"/"project lead" tokens); move to section; **add to project / create task in project with field mapping** (map source fields → target fields, constants, and templates like `{{task.name}}`); create subtask(s); add comment (template); notify people/roles (Inbox + email); set dates (absolute or relative: `due = today + 3 working days`); apply template checklist; **call webhook** (URL, custom headers, JSON body template, HMAC-SHA256 signature, 3 retries with backoff); start/stop time-entry reminders; archive task.
- **FR-7** Cross-project actions run under the rule owner's permissions, checked at execution (not creation) — a rule cannot write where its owner cannot; failures surface in the run log, never silently skip.

### Execution engine
- **FR-8** Events flow from `outbox_events` → matcher → BullMQ jobs carrying `tenant_id` (re-entering `withTenant()` per the RLS rule); per-rule serialization on the same task to avoid write races; loop protection: an automation-caused event can trigger other rules to a **chain depth ≤ 5**, and a rule can never re-trigger itself on the same task within one chain.
- **FR-9** Idempotency: each (event, rule) pair executes at most once (dedupe key); retries on transient failures (3× backoff) mark the run `retried`; hard failures mark `failed` with the error captured.
- **FR-10** Actions attribute as the automation actor in Stories (PRD 05 FR-6) with a link to the rule.

### Quotas — graceful degradation (pledge #6)
- **FR-11** Quota service: `consume(tenant, feature='automation_run')` → `ok` or `degraded` (with reason + usage snapshot). **Degraded ≠ blocked:** the run enqueues on a low-priority lane (delayed up to a plan-defined lag, e.g. 15 min) and still executes. Only abuse-level ceilings (e.g. 20× plan quota) hard-stop, tenant-wide alarms firing first.
- **FR-12** Owner + admins are notified at 80%, 100%, and on first degradation, with live usage and upgrade CTA. **Under no circumstance are rules mass-paused or disabled by quota state.** Scheduled triggers count as runs; condition-failed evaluations do not.

### Audit trail
- **FR-13** `automation_runs`: rule, trigger event ref, matched/condition-failed, per-action results (status, error, affected object ids), duration, quota state (`ok/degraded`), timestamps. Retained ≥ 90 days (plan-tiered). Filterable per rule and tenant-wide; failure-rate alerting to rule owners after N consecutive failures.

### v3 (P7)
- **FR-14** Natural-language rule creation: prompt → draft rule (trigger/conditions/actions) rendered in the standard builder for human review; never auto-enabled; metered per PRD 14.
- **FR-15** Rule bundles (Asana model): named, versioned packages of rules installable across containers; centrally updated (edit bundle → propagate); bundle-level enable/disable — this, not mass-pause, is the legitimate bulk control.

## Data model touchpoints

`automation_rules`, `automation_rule_overrides`, `automation_runs`, `automation_usage_counters` (per tenant/month, feeding the entitlement service), `webhooks` + `webhook_deliveries` (shared delivery infra with the public API, P2), reading/writing `tasks`, `task_locations`, `task_assignees`, `custom_field_values` (+ cache), `stories`; events from `outbox_events`; jobs on BullMQ with `tenant_id`. Wave B, P5; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: small monthly run quota (degrades gracefully like every tier), rules at project scope only, core trigger/action set (no webhook action).
- Pro: larger quota, space/folder scoping + inheritance, scheduled triggers, cross-project actions with field mapping.
- Business: large quota, webhook action, budget/approval/WIP triggers, 180-day run history, failure alerting.
- Enterprise: highest/custom quota, longest retention, rule bundles + NL creation when P7 lands (NL metered via AI).
- The degradation behavior (queue + notify, never disable) is identical on every tier.

## Out of scope / later

- Visual multi-step workflow builder with branching canvases (monday Workflows) — the sentence model ships first; canvas UI post-P6.
- Button custom field as trigger — v3, with PRD 03's button field.
- Marketplace/third-party automation blocks — with the apps framework, post-P7.
- Automation-triggered AI steps (Asana AI Studio parity) — P7, PRD 14.
- Per-rule custom rate limits and tenant-defined chain depth — Enterprise backlog.
