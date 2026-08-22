# PRD 14 — AI & MCP

*An explainable AI layer — AI fields, auto-scheduling with per-person estimate learning, risk insights, time and staffing suggestions — plus Raqeeb as an MCP server, all under transparent metering with no dark credit drains.*

## Overview

Raqeeb's AI layer (v3, **P7**) replicates the two capabilities competitors proved valuable — Forecast's predictive scheduling/insights and ClickUp/monday's AI fields — while rejecting their failure modes. The design constitution:

1. **Explainability over magic (anti-Forecast-opacity).** Every AI output ships with its "why": the inputs, comparable history, and confidence. A prediction the user can't interrogate is a bug.
2. **Suggestions, not silent actions.** AI proposes; humans (or explicitly configured automations) apply. Every applied suggestion is attributed in Stories as AI-assisted.
3. **Transparent metering (pledge #10).** AI usage is a visible, itemized meter — per feature, per user, per run — with predictable plan inclusions. No opaque "credits" that drain mysteriously (the dark pattern the market is converging on).

The second half of this PRD is the **MCP server**: Raqeeb exposes its work graph as a Model Context Protocol server so external AI assistants (Claude, IDE agents, org chatbots) can read and act on Raqeeb data under scoped, auditable authorization — the agent-native posture monday and ClickUp are racing toward, built on Raqeeb's public API discipline (`docs/05-api-design`).

## User stories

1. As a **project lead**, I can add an AI custom field ("Summary", "Sentiment of latest client comments", "Suggested next step") whose values compute from the task's own content, with a per-field prompt template I control.
2. As a **project lead**, I can ask auto-schedule to draft a plan from my task list — proposed assignees, estimates, and dates that respect dependencies, work schedules, and current allocations — presented as a **diff preview** I can edit before applying anything.
3. As a **member**, estimates suggested for me reflect *my* history (the system learns that I finish design tasks 20% under estimate and code reviews 30% over), and I can see the exact history it learned from.
4. As an **agency owner**, I get risk insights: projects trending toward budget overrun (EAC vs budget trajectory), predicted end dates vs committed dates, and tasks predicted to overrun their estimates — each with the evidence behind the flag.
5. As a **member**, at week's end I get time-entry suggestions ("you worked on RAQ-214 across Tue–Wed based on your task activity — log 6h?") that I confirm, edit, or dismiss; nothing is ever logged for me automatically.
6. As a **resource manager**, when staffing a placeholder I get ranked person suggestions (role match, availability from PRD 08, comparable past work) with the ranking factors shown.
7. As a **tenant owner**, I can see an AI usage dashboard — runs per feature, per user, per day, against my plan's included volume — and set a hard monthly cap, so that the bill is never a surprise.
8. As an **admin**, I can enable/disable each AI feature independently (fields, scheduling, insights, suggestions) tenant-wide or per space, so that adoption is a choice, not an ambush.
9. As a **developer/power user**, I can connect my AI assistant to Raqeeb's MCP server with a scoped token and ask it to query my tasks, log time, or file a request — every action visible in the audit trail as performed-via-MCP.
10. As a **security admin**, I can review and revoke MCP/AI integrations per user, and confirm client-scoped data rules (PRD 11) hold for any AI or MCP pathway.

## Functional requirements

### Foundations
- **FR-1** AI gateway service: single egress point to model providers (provider-pluggable); per-tenant data-isolation guarantees (no cross-tenant context mixing; no training on tenant data — contractual posture documented); PII/financial-field redaction rules applied per caller permissions **before** prompt assembly (cost data never enters a prompt for a caller without `view_cost_rates`).
- **FR-2** Every AI invocation writes `ai_runs`: feature, tenant, actor, input refs (object ids, not payload copies), model, token counts, latency, outcome (suggested/applied/dismissed), cost units. This table feeds metering, the usage dashboard, and audit.
- **FR-3** Explainability contract: every user-facing output carries a structured `rationale` (inputs used, comparable items, confidence band) rendered in an expandable "Why this?" panel. Features that cannot produce a rationale do not ship.

### AI fields (v3 of custom fields, PRD 03)
- **FR-4** Field type `ai`: config = prompt template with allowed context tokens ({{task.description}}, {{comments.latest N}}, {{fields.X}}), output type (text/select mapping), recompute policy (manual / on-change debounced / scheduled). Values write through the standard typed-EAV path flagged `computed_by=ai`, with per-value provenance (run id).
- **FR-5** Recompute is quota-aware (consume() per PRD 09 semantics — degrade to queued, never silently stale without a badge); bulk backfills are explicit admin actions with cost preview.

### Auto-schedule (Forecast's flagship, made explainable)
- **FR-6** Input: a project (or selection) of tasks ± existing estimates/dependencies. Output: a **plan proposal** — per task: suggested assignee(s), estimate, start/due — solving against: dependency DAG (PRD 02), work schedules/holidays and current allocations (PRD 08), and estimate history. Presented as a Gantt-diff preview; user edits inline; **apply is one explicit action**, batched and undoable; applied changes are Stories-attributed as AI-assisted.
- **FR-7** Estimate learning per person: `estimate_history` aggregates (person × item type × field signature) of estimated-vs-actual from `time_entries` and `tasks.estimate_minutes`; each suggestion cites its sample ("based on 14 similar tasks you completed, median ratio 1.3×"). Learning is per-tenant only.

### Risk insights
- **FR-8** Insight jobs (nightly + on-material-change) produce `ai_insights`: **budget overrun risk** (EAC trajectory vs budget, PRD 07 data), **predicted end date** (velocity + remaining estimates + dependency chain vs committed due), **task overrun alerts** (logged approaching/exceeding estimate with estimate-history ratio applied). Each insight: severity, evidence payload (rationale contract), state (new/acknowledged/resolved/muted), delivery via Inbox (Important for high severity) and dashboard widgets (PRD 12).
- **FR-9** Insights are read-only observations; any remediation (re-plan, re-staff) routes through the normal features. Mute rules per project/insight-type prevent alert fatigue.

### Time-entry & staffing suggestions
- **FR-10** Time suggestions: from the user's own activity signals inside Raqeeb (task touches, comments, status changes, timer gaps) — never OS-level surveillance — propose draft entries in the timesheet UI; accept/edit/dismiss; accepted entries are normal drafts (PRD 06 state machine). Per-user opt-in.
- **FR-11** Staffing suggestions: for a placeholder or unassigned estimated task, rank candidates by role match, availability window (capacity minus demand, PRD 08), and comparable-work history; factors displayed with weights; selecting a candidate uses the standard conversion flow (PRD 08 FR-3).

### MCP server
- **FR-12** Raqeeb ships an MCP server exposing tools over the public API's authorization model: resources/tools for querying tasks/projects (views engine filters), creating/updating tasks, commenting, logging time, listing My Work, reading dashboards summaries. Tool schemas versioned with the API (`docs/05-api-design`).
- **FR-13** AuthZ: MCP connections use scoped tokens (PAT scopes v1 → OAuth2 scopes) bound to a membership; all RLS, role, and client-scoping rules apply unchanged; every MCP-initiated mutation is audit-logged and Stories-attributed ("via MCP: <client name>"). Admins list/revoke connections tenant-wide; per-scope consent screens on connect.
- **FR-14** Rate limits per token + per tenant (shared budget with the public API); destructive tools (delete/archive) excluded from default scope sets.

### Metering posture (pledge #10)
- **FR-15** Plans include a transparent monthly AI allowance denominated in **runs per feature class** (not abstract credits); the usage dashboard shows consumption per feature/user/day; 80%/100% notifications; over-allowance behavior = degrade (queue/defer non-interactive recomputes) + optional metered overage **only with an explicit tenant opt-in and a hard cap**. Default is never-overspend.

## Data model touchpoints

`ai_runs`, `ai_insights`, `estimate_history`, `ai_settings` (per-tenant/space feature toggles, caps), custom `custom_fields` type `ai` + provenance on `custom_field_values`, `time_entries` (suggested-entry drafts flagged), `personal_access_tokens`/OAuth grants (MCP), `audit_logs` + `stories` (AI/MCP attribution); reads broadly: `tasks`, `task_dependencies`, `work_schedules`, `allocations`, `project_budgets`, EAC aggregates (PRD 07). Wave B/P7; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: no AI features; MCP read-only with a minimal scope set (evaluation posture).
- Pro: metered allowance for AI fields and time-entry suggestions; full MCP with PAT scopes.
- Business: + auto-schedule, risk insights, staffing suggestions; larger allowances; MCP with OAuth2 app connections.
- Enterprise: custom allowances, provider/region choice (with BYOK track), AI feature policy controls (per-space disable, data-handling addenda), full audit UI of AI/MCP activity.
- On every tier: itemized usage visibility, per-feature toggles, never-overspend default (pledge #10).

## Out of scope / later

- AI agents/teammates that own work end-to-end (ClickUp Brain agents, Teamwork Scout/Flo parity) — post-P7; Raqeeb ships assistive AI first.
- Natural-language automation building — specified in PRD 09 (FR-14), delivered alongside this layer.
- Raqeeb as an MCP **client** (calling external tools from automations) — post-P7 with the apps framework.
- Cross-tenant/global model fine-tuning on customer data — permanently out (posture, not backlog).
- AI writing assistance in comments/docs (generic text generation) — low priority; the work-graph features come first.
- Semantic search / pgvector-powered retrieval — enabling infra noted in the stack (pgvector later); product surface post-P7.
