# PRD 12 — Goals, Portfolios & Dashboards

*The management layer: nestable portfolios that cut across the hierarchy with status rollups and portfolio fields, goals whose progress rolls up automatically from real work, and a widget dashboard framework with scheduled exports.*

## Overview

This module gives leadership a truthful, low-effort picture. Three primitives:

- **Portfolios** (Asana model): cross-cutting, **nestable** collections of projects (and other portfolios) — explicitly *not* part of the containment hierarchy (D1). They carry their own **portfolio fields** (metadata columns on member projects), health/status rollups, and feed workload and reporting.
- **Goals**: objectives with **metric targets** (number/percent/currency/task-based) whose progress **auto-rolls up from connected projects and portfolios** — the Asana/ClickUp pattern that keeps OKRs honest because they move when the work moves, not when someone remembers to update a slide.
- **Dashboards**: a widget framework (~15 widget types at P6 launch) over the same query engine as views (PRD 04), rendering live tenant data with plan-appropriate scope, plus **scheduled exports** (PDF/CSV to email, including curated client reports per PRD 11).

A lesson encoded from research: dashboards must read **live** data (monday's 4–24 h refresh lag is an anti-pattern) and never be plan-capped into uselessness (dashboard *count* caps are what we avoid; widget scope follows data-module gating instead).

Phase: **P6**.

## User stories

1. As an **agency owner**, I can build a "Client: Acme" portfolio containing all Acme projects and see rolled-up status, timeline span, budget burn, and workload in one screen.
2. As a **PMO lead**, I can nest portfolios (departments → programs) and the parent rolls up its children's health so the exec view is two clicks deep, not twenty.
3. As a **PMO lead**, I can add portfolio fields ("Strategic priority", "Sponsor", "Phase") shown as columns across member projects, so that portfolio review meetings run off live data.
4. As a **project lead**, I can post a project status update (on track / at risk / off track + narrative) that feeds portfolio rollups and subscriber notifications.
5. As a **tenant owner**, I can define quarterly goals with metric targets ("Revenue from retainers ≥ SAR 500k", "Launch 12 campaigns") and connect projects or portfolios as progress sources, so that progress computes itself.
6. As a **team lead**, I can create sub-goals under a company goal, with weighted contribution to the parent, so that the goal tree mirrors how we actually divide work.
7. As a **member**, I can see which goal my project serves from the project header, so that priorities are legible at the working level.
8. As an **admin**, I can compose dashboards from widgets — numbers, charts, task lists, time & financial widgets — filtered to any scope (tenant/space/portfolio/project/client), and share them with chosen roles.
9. As an **agency owner**, I can schedule a weekly PDF of a client-facing dashboard to the client's inbox (client-scoped data only), so that reporting happens without anyone assembling decks.
10. As a **finance admin**, my profitability widgets respect cost-visibility permissions per viewer (PRD 07 FR-15) — the same dashboard shows me margins and shows a PM only burn.

## Functional requirements

### Portfolios
- **FR-1** `portfolios`: name, owner, description, color/icon, privacy (private/shared list); members via `portfolio_items` (project **or** portfolio child; cycle-check on nesting; max depth 5). A project may belong to many portfolios.
- **FR-2** Portfolio fields: reuse the custom-field engine (PRD 03) with portfolio scope — definitions attach to a portfolio; values attach to member projects *in that portfolio's context* (`portfolio_item_field_values`), so "Priority in Portfolio A" is independent of Portfolio B.
- **FR-3** Rollups per portfolio (live, query-time or incrementally cached): status distribution of member projects (from latest status updates), aggregate timeline (min start–max due), task progress (% done by canonical group), budget burn & profitability (Business + permission-gated), workload summary (PRD 08 data).
- **FR-4** Project **status updates**: authored rich-text posts with health ∈ `on_track / at_risk / off_track / on_hold / complete`, snapshot metrics auto-attached (progress %, burn); notify project + portfolio subscribers; history retained. Nested portfolios roll up worst-of / distribution (configurable).
- **FR-5** Portfolio view surfaces: table of member projects (portfolio fields as columns), timeline of projects, workload tab, and dashboard tab (widgets scoped to the portfolio).

### Goals
- **FR-6** `goals`: title, description, owner, time period (quarter/year/custom), parent goal (tree, weighted children), privacy, status. Target types: **number** (unit + start/target), **percent**, **currency**, **task-based** (count of done tasks / % complete of connected sources).
- **FR-7** Progress sources via `goal_links`: connected projects, portfolios, or explicit task filters. Auto-rollup recomputes on source change events (outbox-driven): task-based targets from canonical-group done ratios; metric targets from sub-goal weighted averages or manual checkpoint entries (for externally-measured metrics).
- **FR-8** Manual override is always possible (with a visible "manually set" badge and history), because not every metric lives in Raqeeb; the badge is the honesty mechanism.
- **FR-9** Goal check-ins: periodic prompt to goal owners for a status note (on track/at risk/off) layered over the computed progress; feeds a goals overview page and digests.

### Dashboards
- **FR-10** `dashboards` (tenant/space/portfolio/project/personal scope) contain ordered `dashboard_widgets` (type + config JSONB: data scope, filters — same filter tree as PRD 04 —, display options, size/position in a grid).
- **FR-11** Launch widget set (~15): number/KPI card, bar chart, line/burn-up, pie/donut, stacked column, task list, table (grouped aggregates), calendar peek, workload heatmap summary (Business), time logged (by person/project), billable vs non-billable, budget burn, profitability/margin (permission-gated), portfolio status board, goal progress, text/markdown card.
- **FR-12** All widgets query live data through the shared view/query engine with the same permission scoping as the viewer (each viewer sees their own permitted slice — dashboards never leak across permission lines). Widget queries obey the performance budget; heavy aggregates use incremental caches refreshed on relevant outbox events, never a fixed multi-hour lag.
- **FR-13** Sharing: dashboards shareable to roles/spaces/specific members; client-facing dashboards restricted to the client-scoped query path (PRD 11 FR-12).
- **FR-14** **Scheduled exports**: any dashboard or saved view → PDF/CSV/PNG on a schedule (daily/weekly/monthly, timezone-aware) to members and/or client users (toggle 14 in PRD 11's matrix); delivery via email with expiring links; export jobs on BullMQ with per-tenant concurrency caps; run log per schedule.

## Data model touchpoints

`portfolios`, `portfolio_items`, `portfolio_item_field_values` (portfolio-scoped `custom_fields`), `project_status_updates`, `goals`, `goal_links`, `goal_checkins`, `dashboards`, `dashboard_widgets`, `scheduled_exports` (+ `export_runs`); reads across `projects`, `tasks`, `statuses` (canonical groups), `time_entries`, `project_budgets`/`retainer_periods` (PRD 07), `allocations` (PRD 08), `stories` (time-in-status); recompute via `outbox_events`. Wave B, P6; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: no portfolios/goals; 1 personal dashboard with core widgets (task/number/chart on own data).
- Pro: dashboards (shared, core + time widgets), project status updates, basic goals (flat list, task-based targets).
- **Business:** portfolios (nested, portfolio fields, rollups), full goal trees with auto-rollup + check-ins, full widget set incl. financial/workload widgets (permission-gated), scheduled exports incl. client delivery.
- Enterprise: no extra feature gates — higher export volumes, longest retention of status/check-in history.
- No dashboard-count caps on paid tiers (anti-pattern pledge); scope gating rides the underlying modules.

## Out of scope / later

- BI-grade explore (pivot builder over arbitrary entities) and the BI export with field-change history — the export lands with P6 platform work (`docs/05-api-design`), the explore UI post-v3.
- Widget marketplace / custom widgets — with the apps framework, post-P7.
- Goal→compensation/score integrations — never planned.
- Portfolio-level budgets (budgets remain per project/retainer; portfolio shows rollups only) — reconsider post-P6.
- Public (unauthenticated) dashboard links — client delivery is via scheduled exports and the portal; public links are a later decision.
- AI health summaries and risk insights on portfolios — P7 (PRD 14).
