# Competitive Analysis — monday.com

*The most approachable product in the category — recipe-sentence automations, building-block
onboarding, an apps marketplace — undermined by per-board data silos, second-class
subitems, and quota cliffs.*

## Data model & hierarchy

```
Account → Product → Workspace → Folder → Board → Group → Item → Subitem
```

- **The Board is the atom.** Everything is a table: a Board holds Groups (sections) of
  Items (tasks). Maps to Raqeeb's Project → Section → Task.
- **Subitems live on a hidden linked board** and are second-class citizens in views,
  automations, and dashboards. **Do not copy.** Raqeeb subtasks are rows in the same
  `tasks` table as their parents — same fields, same views (pledge #8).
- **Columns = per-board typed fields**, ~30 types including status, people, timeline,
  formula, **mirror**, **board_relation / Connect Boards**, dependency, time_tracking,
  vote, button, and AI columns. The column-type catalog is the best in the category and
  directly shaped Raqeeb's custom-field roadmap (D4): v1 primitives → v2
  formula/rollup/relationship → v3 mirror/button/AI.
- **No global fields or statuses.** Every board redefines its own columns; only
  Enterprise "Managed Columns" mitigates. This is the structural flaw Raqeeb's
  tenant-level **shared field/status libraries + local fields** (D3/D4) are designed
  against: define once, bind everywhere, still allow project-local fields.

## Standout features Raqeeb adopts (with mechanism)

- **Automation recipe sentences.** "When [trigger], only if [conditions], then
  [actions]" — automations read as English sentences assembled from dropdowns. *Raqeeb
  mechanism:* the P5 automation engine's primary authoring UI is the recipe sentence over
  a trigger/conditions/actions rule model (ClickUp supplies the any-scope attachment,
  monday supplies the grammar). Cross-board recipes **with column mapping** and the
  **visual workflow builder with branching** arrive later (v3) on the same rule model.
- **Building-blocks composability & instant onboarding.** A new user assembles boards,
  columns, and recipes in minutes with zero training. *Raqeeb:* templates plus minimal
  defaults aim at the same time-to-value, with real hierarchy underneath instead of
  board sprawl.
- **Workdocs** — multiplayer block documents with LIVE two-way embedded boards/widgets.
  Genuinely differentiated, but CRDT docs are explicitly deferred (v1 non-goal: no native
  docs editor); Raqeeb revisits in v3.
- **Dashboards with ~20 widget types** aggregating across boards — the benchmark for
  Raqeeb's v3 dashboard layer (and the pledge that widget counts are not plan-capped).
- **WorkForms** — standalone form builder feeding boards; folded into Raqeeb's P5 intake
  (forms with conditional logic → blueprints).
- **My Work** — the cross-board personal queue; validates Raqeeb's My Work view in P2.
- **Apps framework + marketplace** — custom views, widgets, integration blocks, developer
  monetization, and "monday code" hosting. The long-term differentiator Raqeeb schedules
  for the P7 platform phase (OAuth2 app platform) — and the thing Wrike conspicuously
  lacks.
- **MCP server + agent-native posture** — monday treats AI agents as first-class API
  consumers. Raqeeb's P7 includes an MCP server; llms.txt docs ship from day one.

## Developer-platform lessons

- **GraphQL API with complexity budgets** — queries are metered by cost, not just count.
  Raqeeb is REST-first (GraphQL deferred), but adopts the legibility: published limits,
  `RateLimit` headers.
- **Quarterly API versioning** — predictable deprecation cadence; Raqeeb adopts a
  deliberate versioning policy (one live API, scheduled deprecations — contrast
  Teamwork's three concurrent versions).
- **Idempotency-Key support** — adopted in Raqeeb API conventions from day one.

## Weaknesses & anti-patterns to avoid

- **Metered automation quotas that pause everything.** 250 actions/month on Standard;
  exhausting the meter halts recipes. Users discover their process silently stopped.
  Raqeeb: quota service returns `ok | degraded`, never mass-disables (pledge #3).
- **Seat minimums & 5-seat increments** — you pay for phantom users. Raqeeb: per-seat,
  no minimums (pledge #7).
- **Second-class subitems** — the hidden-board hack leaks everywhere (views, automations,
  API). Raqeeb: subtasks are canonical tasks.
- **No global fields/statuses** (Enterprise-only mitigation) — Raqeeb ships tenant
  libraries on every tier.
- **Dashboards capped by plan; analytics with 4–24h refresh lag** — Raqeeb dashboards
  query live data; capability tiers don't cap widget counts.
- **Notification overload** and **scale cliffs on big boards** — the same category-wide
  failures; Raqeeb answers with triage-first inbox and performance budgets.

## Summary for Raqeeb

monday donates the automation grammar, the onboarding bar, the dashboard benchmark, and
the platform/marketplace ambition. Its per-board silo model and quota-cliff commerce are
the two things Raqeeb's tenant-level libraries and graceful-degradation quotas are
explicitly built to beat.
