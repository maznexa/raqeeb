# Raqeeb — Vision

*Why Raqeeb exists, who it serves, and what v1 deliberately does not attempt.*

## The problem

Modern teams run their work on two different classes of software and are forced to buy both:

1. **General work management** (ClickUp, Asana, monday.com, Wrike): flexible hierarchies,
   custom fields, views, automations, portfolios, goals, dashboards. Excellent at *executing*
   work; largely blind to whether that work makes money.
2. **Agency / professional-services operations** (Forecast, Teamwork.com): clients as
   first-class records, billable time with rate cards, budgets and retainers with rollover,
   profitability and EAC forecasting, client portals, invoicing. Excellent at the *business*
   of client work; comparatively weak as a general-purpose work engine.

No incumbent serves both sides well. The result, visible in every mid-size agency and in
most product companies with a services arm, is a 2–3 tool stack: one tool to run the work,
one to track time/money, and often a third for intake or client review. That stack costs
duplicated seats, brittle sync integrations, double data entry (the same "task" lives in
two systems), and a permanent gap between delivery status and financial truth — the PM sees
"on track" while the finance lead sees margin bleeding.

The incumbents also share a set of self-inflicted wounds that our research catalogued in
detail (see `../01-competitive-analysis/08-anti-patterns.md`): automation quotas that pause
every rule at once, seat minimums and add-on SKU sprawl, basics gated behind top tiers
(custom statuses, time tracking, retainers), second-class subitems, and performance cliffs
on large workspaces. These are not engineering accidents; they are pricing and architecture
decisions users actively resent — and they are attackable.

## The Raqeeb thesis

**One Work OS that is simultaneously a first-rate general work manager and a first-rate
agency operations platform.** Not a PM tool with a billing add-on, and not a PSA tool with
a task list bolted on — a single domain model where the same canonical Task carries status,
custom fields, and view membership *and* billable time, rate snapshots, and budget
attribution.

The unified model is what makes this credible rather than aspirational:

- **Tenant → Space → Folder → Project → Section → Task**, with **multi-homing via
  `task_locations`** so one canonical task lives in many projects (the primitive Asana and
  Wrike independently validated).
- **Workflows/statuses** with custom names and colors on every tier, mapped to four
  canonical groups (`not_started / active / done / cancelled`) so reporting stays sane.
- **Clients, budgets, rate cards, retainers, time entries with point-in-time rate
  snapshots, and allocations** as core schema — not an integration.
- **Effort ≠ duration ≠ assignment ≠ allocation**, so resource planning (bookings,
  placeholders, capacity) works for both a product squad and a staffing-driven agency.
- **Item types** (task / milestone / approval as seeded base kinds) so the model extends
  toward Wrike-style custom item types without re-architecture.

Companies get the Asana/ClickUp/monday feature class; agencies get the Forecast/Teamwork
feature class; both get them in one place, on one seat, over one API.

## Target segments

### 1. SMB → mid-market companies (general work management)

Teams of ~10–500 running projects, sprints, and cross-functional initiatives. They are
today's ClickUp/Asana/monday buyers. What wins them: custom statuses and multiple assignees
without tier games, fast views at 10k+ tasks (performance budget: task-list p95 < 500 ms at
10k tasks), automations that degrade gracefully instead of pausing, and a clean API from
day one.

### 2. Agencies and professional-services firms

Studios, consultancies, dev shops, and marketing agencies of ~5–200 billable staff. What
wins them: free client users who never consume seats, retainers with rollover, rate-card
hierarchies, per-project profitability, and a client portal with a real per-project
permission matrix — **shipped in the Business tier, not held hostage at Enterprise**
(Teamwork gates retainers/profitability behind Scale; we will not).

### 3. The MENA market, with Arabic/RTL as a structural differentiator

Raqeeb ships bilingual (English + Arabic) with full RTL from day one — not a retrofit.
Logical CSS properties only, ICU messages with Arabic's six plural forms, RTL rendering in
CI, and an Arabic-named seed tenant that forces the team to live in RTL during development.
None of the six incumbents treats Arabic as a first-class experience; for MENA agencies and
enterprises this is a buying criterion no competitor can quickly match, and the product's
name signals the commitment.

## Market timing: the Forecast → Accelo disruption

Forecast was acquired by **Accelo in July 2025**, and its customer base is now
mid-migration. Forecast's customers are precisely Raqeeb's second segment: financially
sophisticated agencies who chose it for budget types (Fixed Price / T&M / Retainer /
Non-billable), per-role date-effective rate cards, per-project *and* per-task financials,
and capacity heatmaps. A forced migration is the one moment such customers re-evaluate the
category. Raqeeb's financial spine (D8 in the domain model) is deliberately shaped so that
a Forecast customer recognizes every concept — budget types, retainer periods with
rollover, rate cards, cost periods, EAC — while shedding Forecast's rigidities (immutable
retainer types, locked-period dead-ends, key-only API). Landing even a modest share of this
displaced base seeds the agency segment with reference customers.

## Non-goals for v1

Stated explicitly so nobody builds them by accident:

- **No mobile apps.** Buggy mobile is a documented ClickUp/Asana pain point; a bad app is
  worse than none. v1 is a desktop-browser web app. Mobile comes after the web product
  earns it.
- **No native docs editor.** No Yjs/CRDT collaborative documents in v1 (monday workdocs
  class). v1 real-time is entity-change broadcasts. Rich task descriptions and comments
  yes; a docs product no — revisit in the portfolio/scale phase.
- **No chat product.** Raqeeb will not build a Slack competitor. Comments, mentions, and an
  activity stream cover in-context collaboration; team chat belongs to the tools teams
  already use.

Also deferred past v1 (documented, not built): GraphQL API, SAML/SCIM, BYOK,
schema-per-tenant isolation, custom CNAME domains, invoicing/accounting sync, marketplace
apps framework, and the AI layer. Each has a designated phase in
`../07-roadmap/01-roadmap.md`.

## What success looks like

- A company team and an agency team both run entirely on Raqeeb — no second tool for time,
  budgets, or client access.
- A displaced Forecast customer migrates and finds every financial concept they relied on,
  minus the guardrails they hated.
- An Arabic-speaking team uses Raqeeb in RTL and it feels native, not translated.
- The anti-pattern pledge (`02-positioning.md`) survives contact with the pricing
  spreadsheet.
