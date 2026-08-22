# Domain Model Decisions — D1–D10 (ADRs)

> **Status:** Accepted. These ten decisions are the load-bearing walls of the Raqeeb domain
> model. They were derived from the competitive research on ClickUp, Asana, monday.com,
> Forecast, Wrike, and Teamwork, and from the two user-supplied blueprint documents.
> Changing any of them after Phase 2 is a migration project, not a refactor.

Format: each ADR states the **Decision**, the **Rationale**, and the **Rejected alternatives**
(with the competitor evidence that disqualified them).

---

## D1 — Container hierarchy: Tenant → Space → Folder → Project → Section → Task

**Decision.**
The work hierarchy is: **Tenant** (= workspace, 1:1 implicit — a tenant *is* the workspace) →
**Space** (permission and feature boundary) → **Folder** (optional, nestable, depth ≤ 5) →
**Project** (the terminal task container ≡ ClickUp List ≡ Teamwork Task List ≡ monday Board)
→ **Section** (ordered grouping inside a project) → **Task**. Portfolios are cross-cutting
collections layered on top in v2 (P6), never part of the containment tree.

**Rationale.**
- Every one of the six competitors converged on “a permission boundary, an organizing tree,
  a terminal container that tasks actually live in, and a light grouping inside it.” Raqeeb
  names the pattern once and maps every competitor concept onto it, which makes imports and
  user onboarding tractable.
- Space as the *permission and feature* boundary copies ClickUp’s per-Space ClickApps toggles
  and Wrike Spaces: features and access are configured where teams think, not per project.
- Folder depth ≤ 5 gives Wrike-style flexibility without Wrike’s infinite-nesting scale
  cliffs (documented anti-pattern: deep trees degrade every rollup and permission check).
- Project as terminal container keeps the query model simple: a task’s locations always
  resolve to (project, section, position) — no “is this folder secretly a project” ambiguity.

**Rejected alternatives.**
- *Wrike’s folder≈project unification* (a folder is a project with extra fields, infinitely
  nested): elegant on paper, but it makes permissions, financial attribution, and reporting
  ambiguous, and Wrike’s own scale problems on large trees argue against it.
- *monday’s flat Workspace → Board*: too flat for agencies that need client/program grouping;
  monday itself bolted Folders on later.
- *ClickUp’s 7-level chain (Space → Folder → Subfolder → List …)*: two of those levels exist
  only to work around List limitations; ClickUp’s clutter and learning curve are documented
  top complaints.
- *Portfolios as a hierarchy level*: rejected because portfolios must be able to collect
  projects across spaces and overlap each other — that is a junction, not a tree edge.

---

## D2 — Task multi-homing from day one: `tasks` + `task_locations`

**Decision.**
Tasks are canonical rows in `tasks`. Placement is exclusively through the `task_locations`
junction: `(task_id, project_id, section_id, position, is_primary)`, with
`UNIQUE(task_id, project_id)` and exactly one `is_primary = true` row per task (partial
unique index). `is_primary` drives the task-ID prefix (project key) and financial
attribution. Ships in Wave A, in the scaffold.

**Rationale.**
- The same primitive was validated independently three times: Asana project *memberships*
  (its self-described killer feature), Wrike *parents[]* cross-tagging (folders behave as
  tags), and ClickUp *Tasks in Multiple Lists*. Convergent evolution across the three
  strongest work-management products is the strongest signal in the whole research corpus.
- Retrofitting multi-homing onto a `tasks.project_id` column is one of the most expensive
  migrations imaginable (every query, index, permission check, and UI assumption changes).
  It must be day-one.
- One `is_primary` location resolves the two questions multi-homing otherwise leaves open:
  which project’s key numbers the task (`ACME-42`), and which project’s budget absorbs the
  task’s time and cost (D8).

**Rejected alternatives.**
- *`tasks.project_id` FK (single home), junction later*: the retrofit-cost argument above;
  also exactly the trap ClickUp fell into (multi-list is a bolted-on ClickApp with
  second-class behavior in reporting).
- *Blueprint-1’s `project_tasks` with `section_name VARCHAR` inline*: sections must be
  first-class ordered entities (renameable, reorderable, referenced by automations), not
  strings repeated per location row.
- *Copy the task row per project (duplication)*: destroys the single source of truth;
  monday’s mirror-column machinery is the workaround tax for not having canonical items.

---

## D3 — Statuses: tenant-scoped reusable workflows with canonical groups

**Decision.**
`workflows` are a tenant-level library. Each workflow owns ordered `statuses`
(name, color, position, `canonical_group ∈ {not_started, active, done, cancelled}`).
Projects **bind** one workflow (space default, project-level override). Custom statuses are
available on **every plan tier**. See `04-canonical-status-groups.md` for the mapping table.

**Rationale.**
- Wrike proved the model: unlimited named workflows whose custom statuses map to exactly four
  canonical groups keep cross-project reporting sane no matter how creative teams get with
  status names. ClickUp’s four groups (Not Started/Active/Done/Closed) confirm the shape.
- A tenant-level *library* (rather than per-project status lists) means one edit fixes fifty
  projects, and reporting can group by workflow.
- Custom statuses on every tier is a positioning decision (anti-pattern pledge): Asana’s
  binary completion is one of its top user complaints, and gating statuses by plan tier
  would recreate it for free-tier users.

**Rejected alternatives.**
- *Blueprint-1’s `tasks.status VARCHAR DEFAULT 'todo'`*: free-text statuses make rollups,
  burndowns, and automations impossible to define; every competitor that started there
  migrated off it.
- *Asana’s binary complete + sections-as-stages*: documented top complaint; sections then
  do double duty as both grouping and state, which breaks the moment a task is multi-homed.
- *Per-project status sets only (no library)*: ClickUp allows per-List statuses and the
  result is drift — fifty subtly different “Done” variants; the library + binding model
  gives local flexibility with central governance.
- *Five canonical groups (splitting done/closed like ClickUp)*: the done/closed distinction
  duplicates what archiving already expresses; Wrike’s four groups cover reporting needs.

---

## D4 — Custom fields: typed EAV table as source of truth + JSONB cache

**Decision.**
Custom fields are a tenant-level library with optional space/project scoping (nullable scope
FKs). Values live in a **typed `custom_field_values` table (source of truth)** and are
mirrored into `tasks.custom_fields_cache JSONB` (GIN `jsonb_path_ops`) for list filtering —
both written in one transaction. v1 field types: text, number, currency, date, checkbox,
single_select, multi_select, people, url, email. v2: formula, rollup, relationship,
progress, rating. v3: mirror, button, AI. Tables land in P2 (Wave B).

**Rationale.**
- The typed table gives real indexes, real sorting/range queries, referential integrity for
  people/select values, and a reporting surface; the JSONB cache gives one-fetch task lists
  and fast containment filters. Each covers the other’s weakness (see
  `docs/04-architecture/03-data-access.md` for the cache rules and risk 3 mitigations).
- Library + scoping copies the best of both worlds found in research: Asana’s global field
  library (governance, cross-project reporting on the same field) and monday’s per-board
  columns (local autonomy). monday’s *lack* of global fields is a documented gap its own
  Enterprise “Managed Columns” tries to patch.

**Rejected alternatives.**
- *Blueprint-1’s JSONB-only `tasks.custom_field_values`*: explicitly assessed and rejected in
  the build plan — no typed indexes, no cross-field reporting, no FK integrity, silent type
  drift. JSONB-only is fine until the first “sort by budget field” request, then it isn’t.
- *Typed table only (no cache)*: every task-list render becomes an N-field join/aggregate;
  ClickUp’s list performance debt is the cautionary tale.
- *Column-per-field (ALTER TABLE per custom field)*: unbounded DDL under RLS with pooled
  tenancy is operationally unacceptable.

---

## D5 — `item_types` table ships now; full Custom Item Types in v2

**Decision.**
The `item_types` table ships in Wave A: `(name, icon, base_kind ∈ {task, milestone,
approval}, is_system)`, seeded with system types per tenant. Every task carries
`item_type_id`. Wrike-style Custom Item Type features — per-type layouts, type-scoped
fields and automations, blueprints, request-form bindings — arrive in v2 (P5+).

**Rationale.**
- Wrike’s Custom Item Types and ClickUp’s Custom Task Types both show where the market is
  going: user-defined schemas over a shared task engine. The *column* (`item_type_id`) is
  cheap now and brutal to retrofit later (backfilling a NOT NULL FK on the largest table).
- Shipping the table with seeded system types lets v1 UI branch on `base_kind` (milestone
  rendering, approval flow) without committing to the full CIT feature surface.

**Rejected alternatives.**
- *`task_kind` enum column*: enums can’t grow into user-defined types with icons, layouts,
  and scoped automations; the table costs one join and buys the entire v2 roadmap.
- *Full CIT in v1*: layouts and type-scoped automation are P5-sized features; shipping the
  storage now and the surface later is the whole point of the Wave A/Wave B split.

---

## D6 — Task subtypes: milestone and approval in the v1 model

**Decision.**
Two behavioral subtypes exist from v1 via `item_types.base_kind`: **milestone**
(due-date-only semantics — no estimate, renders as a diamond on timelines) and **approval**
(carries `tasks.approval_status ∈ {pending, approved, changes_requested, rejected}`,
orthogonal to workflow status).

**Rationale.**
- Milestones are universal (Forecast Phases *are* milestones; Teamwork milestones anchor
  task lists; Wrike/ClickUp/Asana all have them). Approvals are Asana’s differentiator that
  agencies specifically need (client sign-off), and they anchor the P5 proofing/approval
  work (external email reviewers).
- `approval_status` as a separate column keeps approval state orthogonal to workflow status:
  an approval task can be “In Review / pending” and move to “Done / approved” — conflating
  them (one status axis) is why competitors’ approval bolt-ons feel broken.

**Rejected alternatives.**
- *Separate `milestones` / `approvals` tables*: splits the task engine — every view, query,
  dependency, and automation would need three code paths. Asana’s subtype-on-task model is
  the proven shape.
- *Approval as a status group*: approval outcome and workflow position are different
  dimensions; merging them makes “approved but not yet deployed” unrepresentable.

---

## D7 — Effort ≠ duration ≠ assignment ≠ allocation

**Decision.**
Four independent concepts, four independent structures:
- **Effort**: `tasks.estimate_minutes`.
- **Duration**: `tasks.start_date` / `tasks.due_date` — independent of effort.
- **Assignment**: `task_assignees` junction — **multiple assignees allowed**.
- **Allocation** (staffing): `allocations` (Wave B/P4) — person **XOR** placeholder-role,
  project, date range, hours/day, `tentative | confirmed`.
Demand for capacity planning = `max(allocations, task estimates)` per project/person,
matching Forecast’s “combined” resourcing mode.

**Rationale.**
- Wrike’s resource stack (the research’s pick as the model to copy) is built exactly on
  effort-independent-of-duration plus bookings; Forecast’s soft/hard allocations and Asana’s
  Allocations API (staffing distinct from task assignment) triangulate the same design.
  Collapsing any two of the four concepts makes real resource planning impossible — you
  cannot book a designer at 50% for March against tasks that don’t exist yet unless
  allocation is its own entity.
- Multiple assignees is an explicit rejection of Asana’s single-assignee limitation — a
  documented top complaint we can win switchers on. Accountability concerns are handled in
  UI (first assignee = responsible) rather than by a schema restriction.
- Placeholder-role allocations (unnamed demand) are how agencies plan pipeline work before
  hiring/staffing — Forecast placeholders ≡ Wrike job-role bookings.

**Rejected alternatives.**
- *Asana’s single assignee* (`tasks.assignee_id`): rejected on the research evidence; also
  makes pair-work and DRI+support patterns unrepresentable.
- *Deriving allocation from task assignments + estimates alone*: fails for pre-sale/pipeline
  staffing and for non-project time (vacation as allocation); both Forecast and Wrike ship a
  separate reservation object for this reason.
- *Blueprint-1’s capacity fields on `users`* (`weekly_capacity_hours` as a mutable column):
  capacity varies over time; it belongs in `work_schedules` (per-user calendars with
  exceptions), not a scalar column.

---

## D8 — Financial spine: clients, budgets, rate hierarchy, snapshots, retainers

**Decision.**
- `clients` are first-class Wave A entities (Teamwork model), linkable from projects.
- `project_budgets` (P3): `budget_type ∈ {tm, fixed_fee, retainer, non_billable}` —
  **convertible**, with a recorded conversion event.
- Rate resolution hierarchy: **project override → client role rate → tenant rate card →
  user default**; `rate_cards` have date-effective entries.
- `person_cost_periods`: time-versioned cost rates — never a mutable column.
- `time_entries` snapshot both bill and cost rates at write time, and carry an approval
  state machine (draft → submitted → approved) plus locking.
- `retainers` + `retainer_periods` with rollover in/out, overage, and per-period locking.

**Rationale.**
- This is the Forecast/Teamwork agency spine, the half of the market Asana/ClickUp/monday
  serve badly. The rate hierarchy is Teamwork’s exactly (site → role → client role →
  project override), which agencies already understand.
- Rate *snapshots* on time entries are non-negotiable for correctness: invoices and
  profitability reports must not rewrite history when a rate card changes. Same reasoning
  forces `person_cost_periods` — a mutable `cost_rate_hourly` column (blueprint-1) silently
  corrupts every historical margin figure.
- Convertible budget types are an explicit anti-Forecast fix: Forecast hard-codes retainer
  type as immutable and users hit dead-ends; Teamwork’s delete-and-recreate budget rigidity
  is the same failure. Raqeeb records a conversion event instead of forbidding the change.

**Rejected alternatives.**
- *Blueprint-1’s `users.cost_rate_hourly` / `default_billable_rate` columns*: mutable rates
  = corrupted history; rejected in favor of time-versioned periods and per-entry snapshots.
- *Rates resolved at report time (no snapshots)*: cheaper writes, but reports become
  non-reproducible and invoice disputes unresolvable.
- *Immutable budget types (Forecast)* and *site-wide-only cost rates (Teamwork)*: both are
  documented competitor anti-patterns.
- *Deferring `clients` to Wave B*: rejected — client linkage on projects is needed by the
  seed data, the portal roadmap, and membership roles (`role = client`), and it is a
  ten-column table.

---

## D9 — Tenancy: global `accounts` + `tenants` + `memberships`

**Decision.**
- `accounts`: global identity, `email UNIQUE` (citext), **not RLS-scoped**. One login.
- `tenants`: the customer organization (slug, plan, subscription status).
- `memberships`: the account↔tenant junction — `role ∈ {owner, admin, member, guest,
  client}`, `is_billable_seat`, per-tenant profile (display name), `UNIQUE(tenant_id,
  account_id)`. One person, N tenants.
- Auth flow: JWT carries `account_id` + active tenant claim → membership verified →
  `SET LOCAL app.current_tenant_id` → RLS applies (see
  `docs/04-architecture/02-tenancy-rls.md`).
- Clients and guests always have `is_billable_seat = false` — free forever, by schema.

**Rationale.**
- One human works with multiple organizations (their employer, a client’s workspace they’re
  invited into, a side project). Asana and ClickUp both model identity globally with
  per-workspace membership; it is the only shape that supports consultants and client users
  without duplicate logins and password-reset chaos.
- Splitting identity (global) from membership (tenant-scoped) also cleanly splits what RLS
  protects: profile-ish tenant data is in `memberships` (RLS yes), while `accounts` is
  reachable only through the auth service.
- `is_billable_seat` on the membership makes the billing rule (`docs/06-saas-commercial/
  03-billing-stripe.md`) a one-line SQL predicate and makes “free client users” (the
  Teamwork lesson, and a pledge in our positioning) structurally guaranteed rather than a
  billing-code special case.

**Rejected alternatives.**
- *Blueprint-1’s `users(tenant_id, email)` with `UNIQUE(tenant_id, email)`*: explicitly
  rejected. It conflates identity with membership: the same person becomes N unrelated user
  rows with N passwords, cross-tenant SSO becomes impossible, and every future feature
  (tenant switcher, unified notifications, one 2FA enrollment) fights the schema. This was
  flagged as a must-fix when absorbing the blueprint.
- *Global `users` with a `tenant_id` array or default tenant column*: membership needs its
  own attributes (role, billable flag, per-tenant display name, deactivation) — that is a
  junction table by definition.
- *Auth0-style external identity only*: still needs a local accounts row for FKs and
  profile; external IdPs (Google now, SAML later) hang off `accounts`, not replace it.

---

## D10 — Ordering: fractional-indexing TEXT keys

**Decision.**
Every user-orderable list (task positions within a section, sections, folders, projects,
spaces, statuses, …) uses **`fractional-indexing` string keys stored as TEXT**, generated
via the fractional-indexing algorithm (base-62 digit strings where a new key can always be
generated between any two existing keys). The API accepts `insert_before` / `insert_after`
**ids** — never raw keys. Collisions (concurrent same-slot inserts) are retried with jitter;
a background rebalance job (P0 queue, low priority) rewrites pathologically long keys.

**Rationale.**
- Reordering must be O(1 row): update one row’s key, no shifting of siblings, no lock storms
  on 10k-task lists (performance budget: board drag < 100 ms perceived).
- String fractional keys never exhaust: between any two keys there is always another key of
  at most one more character. Long keys are a *cosmetic* problem fixed lazily by rebalance,
  never a correctness problem.
- Hiding keys behind `insert_before/after` ids keeps the encoding an implementation detail —
  we can change the alphabet, rebalance at will, and clients cannot fabricate invalid keys.

**Rejected alternatives.**
- *Blueprint-1’s `position_index NUMERIC(12, 6)`*: explicitly rejected. Fixed-precision
  midpoint insertion exhausts after ~20 consecutive insertions in the same gap
  (each halving consumes a bit of precision); then the entire list needs renumbering
  inside a user-facing request. This is a correctness cliff, not a tuning knob.
- *Integer positions with gaps (1000, 2000, …)*: same exhaustion problem, earlier, plus
  bulk renumber transactions that fight RLS-scoped batch updates on hot lists.
- *Linked lists (prev_id/next_id)*: O(1) insert but O(n) ordered reads without recursive
  CTEs on every list render, and concurrent-edit repair is notoriously fiddly.
- *Exposing raw keys in the API*: invites clients to synthesize keys, which breaks the
  rebalance contract and leaks the encoding.
