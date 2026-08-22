# Raqeeb PRD — Module Map

*Index of the Raqeeb product requirements set: every module, its purpose, the roadmap phase it lands in, the personas it serves, and the plan-tier gating rules that bind all modules.*

## Overview

Raqeeb is a commercial multi-tenant SaaS Work OS that combines the work-management strengths of ClickUp, Asana, and monday.com with the agency/professional-services spine of Forecast, Wrike, and Teamwork.com: flexible hierarchy and views, task multi-homing, custom fields and statuses, automations and intake, plus billable time, rate cards, budgets, retainers, profitability, resource planning, and a free client portal.

This document maps the 14 module PRDs in this directory to the delivery roadmap (Phase 0 scaffold through P7) and states the cross-cutting rules — personas, plan tiers, and the anti-pattern pledges — that every module PRD inherits. The authoritative domain decisions are D1–D10 in `docs/03-domain-model/02-decisions.md`; PRDs reference them by number.

## Module list

| # | Module PRD | Purpose (one line) | Lands in |
|---|-----------|--------------------|----------|
| 01 | [Identity & Tenancy](01-identity-tenancy.md) | Global accounts, per-tenant memberships (D9), signup/login, provisioning, invitations, roles, tenant switcher. | Phase 0 (scaffold); SSO in P2; SAML/SCIM in P7 |
| 02 | [Work Core](02-work-core.md) | The work engine: Space → Folder → Project → Section → Task (D1), multi-homing (D2), statuses/workflows (D3), item types (D5/D6), assignees, subtasks, dependencies. | Phase 0 (scaffold); recurrence & custom task IDs in P2; auto-reschedule in P4 |
| 03 | [Custom Fields](03-custom-fields.md) | Tenant field library with space/project scoping and typed-EAV + JSONB-cache storage (D4). | P2 (v1 types); P6 (v2 types); P7 (v3 types) |
| 04 | [Views](04-views.md) | List, Board, Table, Calendar, My Work, Everything, Gantt, Timeline, Workload; saved views, pinning, defaults. | P2 (List/Board/Table/Calendar/My Work); P4 (Gantt/Timeline/Workload); P6 (Everything) |
| 05 | [Collaboration](05-collaboration.md) | Comments, @mentions, reactions, Stories activity stream, followers, notifications + Inbox, attachments. | P2 |
| 06 | [Time Tracking](06-time-tracking.md) | Timer + manual entries, billable split, timesheets, approvals, locking, estimates, rate snapshots. Every tier. | P3 |
| 07 | [Financials](07-financials.md) | Clients, budget types (T&M/fixed/retainer/non-billable), rate resolution, cost periods, retainers, profitability, EAC, invoicing (D8). | P3; invoicing + Xero/QBO in P6 |
| 08 | [Resource Planning](08-resource-planning.md) | Allocations vs assignments (D7), work schedules, capacity heatmap, placeholders, utilization, Backlog Box. | P4 |
| 09 | [Automations](09-automations.md) | Recipe-sentence rules with scoped inheritance, graceful quotas, run audit trail, webhook actions. | P5; NL creation & rule bundles in P7 |
| 10 | [Intake](10-intake.md) | Forms with conditional logic and answer→field mapping; conditional launch into blueprints. | P5; email-in later |
| 11 | [Client Portal](11-client-portal.md) | Free client users, per-project permission matrix, per-item privacy, client-scoped visibility, guest reviewers. | P5 |
| 12 | [Goals, Portfolios & Dashboards](12-goals-portfolios-dashboards.md) | Cross-cutting portfolios with rollups, goals with auto-progress, widget dashboards, scheduled exports. | P6 |
| 13 | [Proofing & Approvals](13-proofing-approvals.md) | Approval tasks (D6), versioned proofs with pinned annotations, reviewers vs approvers, external email reviewers. | Approval subtype Phase 0 (model); proofing P5 |
| 14 | [AI & MCP](14-ai-mcp.md) | AI fields, auto-schedule, risk insights, time/staffing suggestions, Raqeeb MCP server, transparent metering. | P7 |

Cross-cutting platform concerns (billing/entitlements, tenancy/RLS, public API/webhooks, i18n/RTL, performance budgets) are specified in `docs/04-architecture`, `docs/05-api-design`, and `docs/06-saas-commercial`; module PRDs reference them rather than restating them.

## Roadmap phases (summary)

- **Phase 0 — Scaffold:** runnable monorepo; identity + tenancy (D9), Wave A work core (hierarchy, tasks, multi-homing, statuses, dependencies), PATs, audit log, RLS isolation suite, en/ar RTL.
- **P1 — SaaS commercial core:** Stripe billing, trials, dunning, seat reconciliation, live entitlement gates, per-tenant rate limiting, `past_due` read-only mode.
- **P2 — Work engine depth:** custom fields v1, comments/mentions/Stories, attachments, saved views + Board/Table/Calendar, My Work, recurrence, custom task IDs, Postgres FTS, realtime broadcasts, webhooks + public API GA, Google/Microsoft SSO.
- **P3 — Time & financials:** timer/timesheets/approvals/locking, rate hierarchy + cost periods, budgets, retainer periods with rollover, profitability + EAC.
- **P4 — Scheduling & resources:** dependency auto-reschedule, Gantt + baselines, allocations, placeholders/roles, work schedules + holiday calendars, capacity heatmap, utilization report.
- **P5 — Automations, intake & client portal:** recipe engine with graceful quotas, forms → blueprints, client portal, proofing + external reviewers.
- **P6 — Portfolio layer & scale:** dashboards/widgets, portfolios + goals, Everything view, exports, Meilisearch adapter, invoicing + Xero/QBO, custom-field v2 types.
- **P7 — Enterprise & AI:** SAML/SCIM, audit UI, OAuth2 app platform, MCP server, AI layer, schema-per-tenant option, BYOK, custom-field v3 types.

## Personas

All module PRDs write user stories against these six personas. The first five map to `memberships.role` (D9); the external reviewer holds no membership at all.

| Persona | Definition | Billable seat? |
|---------|-----------|----------------|
| **Tenant owner** | Created (or was transferred) the tenant. Full control incl. billing, plan changes, tenant deletion, ownership transfer. | Yes |
| **Admin** | Manages members, spaces, tenant-level libraries (workflows, fields, rate cards), security settings. No billing control unless also owner. | Yes |
| **Member** | Regular internal user. Creates and executes work, tracks time, participates everywhere their space/project access allows. | Yes |
| **Guest** | External collaborator (contractor, partner) invited to specific projects only. No tenant-level navigation or libraries. | No (`is_billable_seat = false`) |
| **Client user** | A person at a client company using the client portal. Sees only projects shared with them, filtered by the client permission matrix; never sees internal rates/costs. Free forever. | No (`is_billable_seat = false`) |
| **External reviewer** | Approves/annotates a proof via an emailed signed link. Has **no account and no membership**. | No — not a seat at all |

## Plan-tier gating overview

Four public tiers: **Free / Pro / Business / Enterprise**. Entitlements are boolean gates, numeric limits, or metered quotas, enforced server-side by the entitlement service (`docs/06-saas-commercial`) and mirrored in the UI. Each module PRD has a "Plan-tier gating" section that binds to this table.

| Capability area | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Core work engine (hierarchy, multi-homing, subtasks, dependencies) | ✔ | ✔ | ✔ | ✔ |
| **Custom statuses / workflows** | ✔ (pledge) | ✔ | ✔ | ✔ |
| **Multiple assignees** | ✔ (pledge) | ✔ | ✔ | ✔ |
| **Time tracking (timer, manual, billable flag)** | ✔ (pledge) | ✔ | ✔ | ✔ |
| Custom fields | Limited count | ✔ v1 types | ✔ + v2 types | ✔ + v3 types |
| Views | List, Board | + Table, Calendar, My Work, saved views | + Gantt, Timeline, Workload, Everything | ✔ all |
| Automations | Small metered quota (degrades gracefully) | Larger quota | Large quota + webhook actions | Highest/custom quota |
| Forms & intake | 1 basic form | ✔ forms + mapping | + conditional launch → blueprints | ✔ |
| Timesheets, approvals, timelog locking | — | ✔ | ✔ | ✔ |
| **Agency core: budgets, rate cards, retainers, profitability, EAC** | — | — | **✔ ships at Business (pledge: NOT Enterprise)** | ✔ |
| Client portal (free client users) | — | Read-only sharing | ✔ full permission matrix | ✔ |
| Resource planning (allocations, heatmap, utilization) | — | — | ✔ | ✔ |
| Portfolios, goals, dashboards | — | Basic dashboards | ✔ | ✔ |
| Proofing & approvals | Approval tasks | ✔ + proofs | ✔ + external reviewers | ✔ |
| Invoicing + Xero/QBO | — | — | ✔ | ✔ |
| AI layer & MCP | — | Metered | Metered, higher | Metered, custom |
| SAML SSO, SCIM, audit log UI, BYOK/dedicated isolation | — | — | — | ✔ |

### The Raqeeb pledges (anti-patterns we refuse to ship)

Derived from the consolidated competitor anti-pattern research (`docs/01-competitive-analysis/08-anti-patterns.md`):

1. **Custom statuses on every tier** — Asana's binary complete/incomplete is a top user complaint; we never gate workflows by plan.
2. **Multiple assignees on every tier** — rejecting Asana's single-assignee limitation.
3. **Time tracking on every tier** — rejecting Asana gating it behind Advanced+.
4. **Agency core ships at Business, not Enterprise** — rejecting Teamwork's Scale-gating of retainers/profitability.
5. **Client users and external reviewers are always free** — `is_billable_seat = false`, never counted against seats (Teamwork/Wrike model).
6. **Automation quotas degrade gracefully** — over-quota runs queue and notify; we never mass-pause or disable all rules (monday/Wrike anti-pattern).
7. **No seat minimums, no 5-seat increments, no add-on SKU sprawl.**
8. **Performance budget is a requirement, not an aspiration** — p95 < 500 ms task-list load at 10k tasks (see `docs/04-architecture/observability-performance`); ClickUp's 90-second Everything view is the cautionary tale.
9. **No 5-minute comment-edit window** (Wrike anti-pattern) and no second-class subitems (monday anti-pattern).
10. **Transparent AI metering** — no opaque credit drains; every AI action is attributable and visible.

## Out of scope / later (product-wide)

- Mobile apps (post-v1; web app is responsive but mobile-native is deferred).
- Collaborative docs (Yjs/CRDT) — phase 2+ of realtime; v1 realtime is entity-change broadcasts.
- Apps framework / marketplace (monday-style) — long-term differentiator, after P7.
- Custom CNAME domains, schema-per-tenant, BYOK — enterprise evolution (P7+).
- GraphQL API (REST + webhooks first), sprints module (first-class sprints considered post-P6).
