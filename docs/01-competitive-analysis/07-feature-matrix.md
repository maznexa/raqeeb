# Unified Feature Matrix (Keystone)

*Every capability worth having across ClickUp, Asana, monday.com, Wrike, Forecast, and
Teamwork — who does it best and how, and Raqeeb's committed decision for each.*

**How to read the decision column.** Versions map to the roadmap
(`../07-roadmap/01-roadmap.md`): **v1** = scaffold + P1–P2 (work core, tenancy/RLS,
billing/entitlements, custom fields, comments/activity, core views, search, webhooks +
public API GA); **v2** = P3–P5 (time, financials, resources/scheduling, automations,
intake, client portal, proofing); **v3** = P6–P7 (portfolios/goals/dashboards, invoicing,
enterprise, platform, AI); **never** = identified anti-pattern Raqeeb commits not to
build. Terminology follows the domain model: Tenant, Space, Folder, Project, Section,
Task, `task_locations`, workflows/statuses with canonical groups
(`not_started/active/done/cancelled`), allocations, item types.

## 1. Work core

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Container hierarchy | ClickUp: Workspace→Space→Folder→List→Task | v1 | D1: Tenant→Space→Folder(≤5 deep)→Project→Section→Task |
| Infinite folder nesting | Wrike: unbounded folder/project tree | never | Scale cliff + UX trap; depth capped at 5; portfolios (v3) group cross-cutting |
| Task multi-homing | Asana memberships ≡ Wrike parents[] ≡ ClickUp multi-list | v1 | D2: `task_locations` (project, section, position, is_primary); `is_primary` drives task-ID prefix (`DEV-123`, ClickUp) + financial attribution |
| Subtasks as real tasks | Asana/ClickUp: same entity, nested | v1 | Same `tasks` table; monday's hidden-board subitems = never |
| Multiple assignees | ClickUp: N assignees per task | v1 | `task_assignees` many-to-many; Asana's single-assignee = never |
| Dependencies: FS/SS/FF/SF + lag, cross-project | Wrike | v1 | Model + DAG cycle rejection on write (Asana) in scaffold; auto-reschedule v2 |
| Item subtypes: milestone + approval | Asana: milestone; approval w/ pending/approved/changes_requested/rejected | v1 | D6; milestone = due-date-only; approval flows complete in v2 (P5) |
| Item types | Wrike CIT: own icon, fields, layout, type-scoped automations, blueprints, form bindings | v1 | D5: `item_types` table (base_kind task/milestone/approval) ships now; full CIT features v2 |
| Drag-and-drop ordering | — (all) | v1 | D10: fractional-indexing TEXT keys; API takes insert_before/after, never raw keys; rebalance job |
| Recurrence + checklists | ClickUp: flexible recurrence; task checklists | v2 | Recurrence via BullMQ; checklists task-detail only, not a hierarchy level |
| Sprints (points, velocity, burndown, auto-rollover) | ClickUp first-class sprints | v3 | Per-Space toggle; Forecast validates optional-per-project |

## 2. Views

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Core views: List, Board (+WIP limits), Table, Calendar | ClickUp Board WIP; monday table engine | v1 | List in scaffold; rest P2; all virtualized |
| Saved views per project | ClickUp/monday | v1 | P2; filters + sort + grouping persisted |
| My Work (cross-project personal queue) | Asana My Tasks: auto-promotion Recently assigned→Today/Upcoming/Later | v1 | P2; promotion rules included |
| Gantt/Timeline + baselines | Wrike: auto-reschedule + snapshots/baselines | v2 | P4, with dependency cascade over work calendars |
| Workload view | Wrike: hours/%/FTE, over-capacity semantics, Backlog Box | v2 | P4, on the allocations model |
| Everything view (tenant-wide rollup) | ClickUp Everything | v3 | P6 — only within perf budget (ClickUp's takes ~90s) |
| Mind Map / Map / Box / Whiteboard views | ClickUp | never | Clutter; low value per perf cost — progressive-disclosure principle |

## 3. Custom fields

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Tenant-level field library + local fields | Asana global field library | v1 | D4: nullable space/project scope FKs; anti-monday per-board silos |
| Core types: text, number, currency, date, checkbox, single_select, multi_select, people, url, email | monday's ~30-type catalog (curated) | v1 | D4 v1 set |
| Typed value storage + fast filtering | — (Raqeeb synthesis) | v1 | Typed `custom_field_values` = truth; `tasks.custom_fields_cache` JSONB (GIN) for filters; written in one transaction |
| Formula + rollup fields | ClickUp Formula/Rollup; monday formula | v2 | D4 v2 set |
| Relationship fields | ClickUp Relationship / monday Connect Boards | v2 | Typed task↔task links |
| Progress (auto) + rating | ClickUp | v2 | |
| Mirror fields | monday mirror columns | v3 | Needs relationship graph maturity |
| Button + AI fields | ClickUp Button (triggers automations) + AI Fields; monday AI column | v3 | Buttons ride the automation engine; AI fields ride P7 |

## 4. Statuses & workflows

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Custom named/colored statuses | ClickUp: per Space/Folder/List, with templates | v1 | D3 — on EVERY plan tier (pledge #1); the tenant library is the template mechanism |
| Canonical status groups | Wrike: every status maps to exactly 4 groups | v1 | `not_started/active/done/cancelled` (ClickUp's + Wrike's merged); keeps cross-project reporting sane |
| Reusable workflow library | Teamwork site-level Workflows | v1 | Tenant-scoped `workflows`→`statuses`; space default, project override |
| Per-stage automation hooks | Teamwork: per-stage automations | v2 | Status-entry triggers in the P5 engine |
| Time-in-status | ClickUp | v3 | Derived from the activity stream; ships with reporting |
| Binary complete/incomplete only | Asana | never | The category's most-complained-about ceiling |

## 5. Collaboration

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Comments + @mentions, freely editable | — (anti-Wrike) | v1 | P2; edit trail in activity; Wrike's 5-minute edit window = never |
| Activity as event stream | Asana Stories: immutable per-object events | v1 | P2; doubles as audit trail + field-change history source |
| Attachments | — (all) | v1 | P2; S3-compatible presigned uploads |
| Realtime entity-change broadcasts | monday realtime tables | v1 | P2; outbox → Redis pub/sub → Socket.IO |
| Notification inbox with Important/Other triage | ClickUp Inbox split; Asana Inbox UX | v2 | Basic notifications v1; triage split + digest defaults v2 (anti-noise) |
| Collaborative block docs w/ live embedded views | monday workdocs (two-way LIVE embeds) | v3 | CRDT/Yjs deferred; v1 non-goal (no docs editor) |
| Team chat product | ClickUp Chat | never | Non-goal; comments + integrations cover it |

## 6. Time tracking

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Timer + manual timesheets, timelog categories | Forecast timer/timesheets; Wrike categories + submission rules | v2 | P3 |
| Billable split per entry | Forecast | v2 | Billable/non-billable minutes on one entry |
| Rate snapshots at entry time | Forecast/Teamwork pattern | v2 | `time_entries` stores bill + cost rate at log time; history immune to later rate changes |
| Approval workflow + locking | Forecast submit→approve; Wrike timelog locks | v2 | State machine on entries; locks have governed admin escape hatch (anti-Forecast dead-ends); invoiced-time locks (Teamwork) arrive with v3 invoicing |
| Task estimates | ClickUp: estimates incl. per-assignee | v1 | `estimate_minutes` in scaffold (D7); per-assignee split v2 |
| AI time-registration suggestions | Forecast | v3 | P7 |

## 7. Financials

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Clients first-class | Teamwork: Companies in the hierarchy | v1 | `clients` table in scaffold; projects link to clients |
| Budget types: T&M / fixed fee / retainer / non-billable | Forecast budget types | v2 | P3; D8 `project_budgets`; convertible with recorded conversion event — Forecast's immutability = never |
| Rate cards (date-effective) + resolution hierarchy | Forecast versioned per-role cards; Teamwork user→role→client role→project | v2 | D8 order: project override → client role rate → tenant rate card → user default |
| Person cost periods (time-versioned) | Forecast person_cost_periods | v2 | Never a mutable column (anti-Teamwork site-wide rate) |
| Retainers: periods, rollover, overage, locking | Forecast periods (hours-or-price targets) + Teamwork overspend subtraction | v2 | P3; `retainers` + `retainer_periods` (rollover_in/out) |
| Profitability panel + cross-project report | Teamwork: profit = budget − expenses − staff costs | v2 | Permission-gated; heed cost-rate inference warning |
| EAC / Baseline-Planned-Actual-Remaining-At-Completion grid | Forecast financials engine | v2 | Project AND task level (attribution via primary location) |
| Expenses, budget thresholds, budget history | Teamwork | v2 | Budgets editable w/ history; delete-and-recreate = never; section sub-budgets v3 |
| Native invoicing + Xero/QBO sync, revenue recognition | Forecast draft→approved→sent; Teamwork unbilled-time round-trip | v3 | P6 |
| Baseline pre-sale quote (roles×phases, win probability, placeholder generation) | Forecast Baseline | v3 | Quote→delivery bridge |

## 8. Resource planning

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Allocations distinct from assignment | Asana Allocations API (% or hrs over range) | v2 | D7 `allocations`; model specified in v1 schema docs, UI in P4 |
| Soft/hard allocations = bookings before tasks exist | Forecast soft/hard ≡ Wrike tentative/confirmed bookings | v2 | One status flag; reservation needs no task |
| Job roles + placeholders | Wrike/Forecast: role-level unnamed demand | v2 | Allocation targets person XOR placeholder role |
| Demand = max(allocations, task estimates) | Forecast combined mode | v2 | Default demand formula (D7) |
| Effort independent of duration | Wrike: Basic/Daily/Flexible shapes | v2 | D7 separates estimate, dates, assignment, allocation |
| Work schedules + holiday calendars + OOO | Wrike per-user calendars/exceptions; Forecast holidays, non-project time as allocations; Asana OOO awareness | v2 | P4; vacation/sick = allocations, so capacity math stays honest |
| Capacity heatmap w/ health thresholds | Forecast: ≤92% / 93–106% / ≥107% | v2 | Thresholds shipped as defaults |
| Utilization report + billable target per user | Teamwork (default 80%) | v2 | P4 |
| One resourcing surface | — (anti-Teamwork) | v2 | Everything reads `allocations`; two disjoint tools (Workload vs Schedule) = never |
| Pipeline-weighted capacity (win probability) | Forecast | v3 | Needs Baseline quotes (v3) |

## 9. Automations

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Recipe-sentence authoring | monday: "When…, only if…, then…" | v2 | P5 primary UI over a trigger/conditions/actions rule model |
| Rules scoped at any hierarchy level, incl. webhook action | ClickUp: Space/Folder/List scoping + webhook step | v2 | Tenant/Space/Project scope; fires signed webhooks |
| Conditions, scheduled triggers, variables | Asana Rules | v2 | |
| Graceful quota degradation | — (Raqeeb synthesis) | v2 | Quota service returns ok\|degraded from day one of the engine |
| Quota exhaustion mass-pauses all rules | monday (250/mo Standard); Wrike (disables at 0); ClickUp/Asana silent pause | never | Pledge #3 |
| Cross-project recipes + visual builder with branching | monday cross-board recipes w/ column mapping; monday/Asana visual builders | v3 | Sentence UI first, canvas later |
| Rule bundles (governed reusable packages) | Asana Rule bundles | v3 | Portfolio/governance phase |
| Button-triggered rules | ClickUp Button fields | v3 | With the v3 button field type |
| AI steps in rules | Asana AI Studio | v3 | P7 |

## 10. Intake & forms

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Forms with conditional logic + branding + field mapping | Wrike conditional branching; Teamwork branded forms | v2 | P5; answers map to custom fields |
| Conditional launch → templates | Wrike: form answers pick the blueprint | v2 | Form → blueprint pipeline verbatim |
| Blueprints with relative dates | Wrike: templated project trees | v2 | Instantiated as async jobs (Asana templates lesson) |
| Standalone shareable form product | monday WorkForms | v3 | Beyond intake, if demand proves |

## 11. Client portal

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Free client users (no seat consumed) | Teamwork: client users + collaborators free | v1 | D9 `is_billable_seat=false` from scaffold; portal UI v2; Teamwork's 5-project cap on clients = never |
| Client portal experience | Teamwork client views | v2 | P5 |
| Per-project per-user permission matrix | Teamwork (~25 toggles) | v2 | Curated matrix; Forecast's global-only guests = never |
| Per-item privacy in shared projects | Teamwork | v2 | Task/comment-level hide-from-client |
| Client currency + client role rates | Teamwork Clients view | v2 | With the P3 rate system |

## 12. Proofing & approvals

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Annotation proofing (image / frame-accurate video / PDF / Office) | Wrike | v2 | P5 |
| Version compare + approval reset on new version | Wrike side-by-side | v2 | |
| Reviewers vs approvers split | Teamwork proofs | v2 | Distinct roles per proof |
| External approval via email link, no account | Teamwork; Wrike free unlicensed guest reviewers | v2 | Zero-friction client signoff |
| Approval tasks first-class | Asana approval subtype | v1 | Model in scaffold (D6); flows in P5 |

## 13. Goals, portfolios & dashboards

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Portfolios (nestable, custom fields, status rollups, workload) | Asana Portfolios | v3 | P6; cross-cutting collections, not hierarchy (D1) |
| Goals with auto progress rollup | Asana (from projects); ClickUp (4 target types incl. task-based) | v3 | P6 |
| Dashboard widgets | monday ~20 widget types; ClickUp 50+ cards | v3 | P6; curated set, live queries |
| Plan-capped dashboards / laggy analytics | monday/Wrike (caps; 4–24h refresh) | never | Tiers never cap dashboards; data is live or clearly labeled |
| Portfolio boards with triggers | Teamwork | v3 | Folds into automations + portfolios |
| Exports / BI incl. field-change history | Wrike BI export | v3 | Activity stream makes change history cheap |

## 14. Search

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Full-text search (tasks, comments), permission-scoped | — (all) | v1 | P2: Postgres FTS |
| Dedicated search engine | — | v3 | P6: Meilisearch/Typesense behind an adapter interface |
| Connected search (external apps) | ClickUp Universal/Connected search | v3 | After integrations mature |

## 15. AI

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| AI fields (generate/classify per row) | ClickUp AI Fields | v3 | P7 |
| Auto Schedule (plan from task list; learns per-person estimation bias) | Forecast Auto Schedule | v3 | P7; staffing suggestions included |
| Predictive insights (overrun risk, task performance, predicted end date) | Forecast Nova Insights | v3 | P7 |
| Role-based AI teammates | Teamwork (Scout personal, Flo project health); Asana AI Teammates | v3 | P7 |
| MCP server (agent access, both directions) | monday + ClickUp | v3 | P7; llms.txt docs ship v1 |
| Opaque AI recommendations | Forecast | never | Every AI output carries its reasoning and inputs |

## 16. Developer platform

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Public REST API from day one | Asana REST | v1 | Public API = same controllers as the app, from scaffold |
| Published OpenAPI + llms.txt docs; official SDKs | Asana (.md docs, llms.txt, SDKs) | v1 | Generated from Zod contracts; TS SDK v2, others later |
| API conventions: `opt_fields` sparse fieldsets, cursor pagination, Idempotency-Key | Asana opt_fields; monday Idempotency-Key | v1 | Convention doc in `../05-api-design/` |
| RateLimit headers + published per-plan limits | monday headers; ClickUp plan-tiered limits (100→10k/min) | v1 | Legible, upgrade-aligned |
| Webhooks: HMAC handshake + signature, event filters, custom payloads, health | Asana handshake/heartbeats; Wrike filters + payload fields; ClickUp wildcard events + health | v1 | P2 GA |
| PATs: scoped, expiring, revocable | — (anti-ClickUp/Forecast) | v1 | ClickUp's scopeless non-expiring tokens and Forecast's key-only full-access API = never |
| OAuth2 with granular scopes + refresh tokens | Asana `resource:action` scopes | v2 | Full app platform in v3 |
| Batch + async-job APIs | Asana Batch; Wrike async jobs | v2 | Long ops return job handles |
| Events API (polling sync tokens) | Asana | v3 | Webhooks first; polling sync for large integrators |
| Apps framework + marketplace | monday (views/widgets/blocks, monetization, hosted code) | v3 | P7; Wrike's absence of an extension surface = strategic gap |
| GraphQL API | monday (complexity budgets) | v3 | REST-first; GraphQL only on proven demand |
| Service accounts | Asana | v3 | Enterprise phase |
| Multiple concurrent API versions | Teamwork v1/v2/v3 | never | One API; deliberate versioning + deprecation policy (monday's quarterly cadence as reference) |

## 17. Enterprise & security

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Tenant isolation (pooled Postgres RLS) | — (Raqeeb architecture) | v1 | D9: `tenant_id` + FORCE RLS, `SET LOCAL` via withTenant(); CI cross-tenant isolation suite is non-negotiable |
| Cross-tenant identity (one login, N tenants) | Asana/ClickUp account model | v1 | Global `accounts` + per-tenant `memberships`; email unique per tenant |
| Email/password + Google/Microsoft SSO + TOTP 2FA | — | v1 | Vetted auth library; Google stub in scaffold |
| Audit log | Wrike audit log | v1 | Table + async interceptor writes from scaffold; audit UI + export v3 |
| SAML SSO + SCIM | Wrike-class enterprise | v3 | P7 |
| BYOK/CMEK + schema-per-tenant option | Wrike Lock (CMEK) | v3 | P7; documented as enterprise-tier evolution, not built early |
| Access roles + selective sharing | Wrike | v2 | Space privacy v1; granular sharing lands with the P5 portal matrix |
| Per-tenant rate limiting | — | v1 | P1; protects neighbors in pooled infra |

## 18. Commercial & SaaS

| Capability | Best-in-class (product + mechanism) | Raqeeb | Notes |
|---|---|---|---|
| Self-serve signup + tenant provisioning | — (all incumbents) | v1 | Slug tenancy, seeded defaults, invitations; custom domains later |
| Per-seat Stripe billing: trials, upgrade/downgrade, dunning, past_due read-only | — | v1 | P1; webhook idempotency (event-id dedupe) + daily seat reconciliation; degrade, never delete |
| Plan entitlements (boolean/limit/metered) with graceful degradation | — (anti-category) | v1 | Single server-side `check(tenant, feature)`, mirrored in UI; limits degrade, never brick configs |
| Free client/guest seats on every tier | Teamwork free clients | v1 | `is_billable_seat=false`; pledge #6 |
| Custom statuses on every tier | — (anti-Asana / anti-tier-gating) | v1 | Pledge #1; see §4 |
| Agency core at Business tier | — (anti-Teamwork Scale-gating) | v2 | Retainers/profitability priced where agencies live |
| Seat minimums / seat increments | monday/Wrike 5-seat packs | never | Pledge #7 |
| Add-on SKU sprawl | Wrike Integrate/Lock/Analyze | never | Pledge #4; tiers differ by limits + enterprise controls |
| Performance budgets as a product feature | — (anti-ClickUp) | v1 | p95 < 500ms task list @ 10k tasks; 50k-task nightly fixture from P2; regressions block release |
| Arabic + RTL bilingual product | — (none of the six) | v1 | en/ar catalogs, ICU (6 Arabic plurals), logical CSS only, RTL screenshots in CI |

## Coverage check

~130 decision rows across 18 modules; every row commits to v1, v2, v3, or never. All six
competitors appear as best-in-class donors; every anti-pattern in `08-anti-patterns.md`
appears here as a "never" row or an explicit inverse commitment.
