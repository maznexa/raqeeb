# PRD 11 — Client Portal

*Clients collaborate for free — never a billable seat — inside a curated per-project permission matrix, with per-item privacy and hard guarantees that internal time, rates, and estimates stay internal.*

## Overview

The client portal is Raqeeb's agency-market wedge, modeled on Teamwork's proven approach with two Raqeeb pledges hard-wired in: **client users are free forever** (`is_billable_seat = false`, enforced at the model level — pledge #5) and the agency core they attach to ships at **Business tier, not Enterprise** (pledge #4).

Access control is a **per-project, per-user permission matrix**. Teamwork exposes ~25 toggles; Raqeeb ships a **curated ~15** — the set that covers real agency workflows without the checkbox wall. Inside a shared project, **per-item privacy** keeps internal tasks/comments invisible, and **client-scoped visibility rules** guarantee that time amounts, rates, costs, estimates, and profitability never render for client roles regardless of toggle mistakes — a server-side stripping rule, not a UI courtesy.

For proofing, **external reviewers via email link** (PRD 13) need no account at all. Phase: **P5**.

## User stories

1. As an **agency owner**, I can invite any number of client contacts to their projects without ever affecting my seat bill, so that collaboration has no per-head tax.
2. As a **project lead**, I can share a project with a client user and tune exactly what they can do — see tasks, comment, create requests, view milestones, see attachments — from one permission panel.
3. As a **client user**, I log into a focused portal: only my projects, a clean overview (milestones, recent activity, items awaiting me), no internal navigation, in my language (en/ar, RTL).
4. As a **project lead**, I can mark any task, section, or comment as internal-only inside a shared project so that drafts and internal debates stay invisible to the client.
5. As a **client user**, I can create a request (via the project's intake form or a simple new-task composer, per my permissions) and follow its status, so that email stops being our ticketing system.
6. As a **client user**, I can comment on visible tasks and @mention the agency team, and my comments are visibly badged as client comments to the internal team.
7. As an **agency owner**, I am certain a client can never see hourly rates, cost data, time-entry amounts, estimates, or profitability — even if someone fat-fingers a toggle — because the server strips those fields for client roles unconditionally.
8. As a **project lead**, I can let a client see high-level progress (milestones, % complete, due dates) without exposing task-level assignment detail, so that reporting is calm and curated.
9. As a **project lead**, I can grant a client approval rights on approval tasks and proofs (PRD 13) so that sign-off happens in-product with an audit trail.
10. As an **admin**, I can see all client users per client company, which projects each can access, and their effective permissions, so that offboarding a client contact is one screen.

## Functional requirements

### Client users & seats
- **FR-1** Client users are memberships with `role = client`, linked to a `clients` row (`memberships.client_id`); `is_billable_seat = false` is **forced by a DB constraint for client role** and excluded from all seat counts and Stripe reconciliation (P1). No cap on client-user count at Business+.
- **FR-2** Client invitations (PRD 01 flow) require ≥ 1 project grant and a client-company link; accepting lands in the portal shell, never the internal app shell.
- **FR-3** Portal shell: project list (granted only), per-project overview (milestones, activity filtered to client-visible, "awaiting you" items), notifications limited to client-visible events, profile. No space browser, no tenant directory, no library screens. Fully localized incl. RTL.

### Permission matrix (~15 toggles, per project × per client user)
- **FR-4** `project_permissions` rows (project, membership) store the toggle set. Curated v1 set:
  1. View tasks (client-visible ones)
  2. View milestones & project dates
  3. View attachments
  4. View task comments (client-visible)
  5. Add comments
  6. Create tasks/requests
  7. Edit own created tasks
  8. Complete/approve items assigned to them
  9. Be assignable to tasks
  10. View project members (internal names/avatars)
  11. View forms & submit
  12. View proofs + annotate (PRD 13)
  13. Approve proofs (PRD 13)
  14. Receive scheduled status reports (PRD 12 exports)
  15. View high-level progress (% complete, status summary)
- **FR-5** Per-client-company **defaults**: admins define a default toggle set per client; new grants inherit it; per-user overrides allowed. Bulk-apply changes across a client's users.
- **FR-6** Guests (role = guest) reuse the same matrix mechanism with a different default set and without the client-visibility stripping rules (guests are "internal-lite"; clients are "external-hard").

### Per-item privacy
- **FR-7** Tasks and sections carry `visibility ∈ internal / client_visible` (project-level default; new tasks inherit; section setting cascades as default to contained tasks). Internal items are excluded from client queries at the SQL level (not filtered client-side).
- **FR-8** Comments default to `internal_only = true` on client-shared projects (PRD 05 FR-5); authors flip per comment ("Share with client"); a visible badge marks client-visible comments for internal users, and client-authored comments are always client-visible by definition.
- **FR-9** Attachments inherit their parent's visibility; direct-download links (presigned) are only minted for authorized viewers.

### Client-scoped visibility rules (hard guarantees)
- **FR-10** For any `role = client` caller, the API **unconditionally strips**: time-entry durations/amounts, all rates (bill and cost), all cost/profit/margin/budget figures, estimates (`estimate_minutes` and rollups), utilization, allocation data, internal-only custom fields (fields flag `client_visible`, default false), automation internals, and internal member emails. This applies to REST, realtime payloads, exports, and search results — one serializer policy, tested by a dedicated leak-test suite in CI.
- **FR-11** Client queries additionally scope: only granted projects; only client-visible items; Stories filtered to client-visible kinds (status changes on visible tasks, client-visible comments, milestone events).
- **FR-12** Search, notifications, digests, and dashboards for client users draw exclusively from the client-scoped query path (no separate implementations that could drift).

### External reviewers (no account)
- **FR-13** For proofing/approvals only (PRD 13): a signed, expiring email link grants item-scoped view/annotate/approve on one proof — no membership row, no portal access, actions recorded with the reviewer's email identity. Referenced here because it completes the external-access spectrum: member → guest → client user → external reviewer.

## Data model touchpoints

`memberships` (role = client, forced `is_billable_seat=false`, `client_id`), `clients`, `project_permissions` (toggle set + per-client defaults table `client_permission_defaults`), `tasks.visibility`, `sections.visibility`, comments' `internal_only` (PRD 05), `custom_fields.client_visible`, `external_review_links` (PRD 13), `invitations` (project grants), `audit_logs` (grants, permission changes), `stories` (client-visible filtering). Wave B, P5; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: no external sharing.
- Pro: read-only client sharing — client users with a fixed minimal toggle set (view tasks/milestones/comments, add comments), still free seats.
- **Business:** full portal — the ~15-toggle matrix, per-client defaults, per-item privacy controls, client requests via forms, proof approval rights, scheduled client reports.
- Enterprise: same portal + audit UI coverage of client access, IP/session policies applying to client logins.
- On every tier where client users exist, they are free — no exceptions, no "client seat packs".

## Out of scope / later

- Client-branded portal domains (white-label CNAME) — post-P7, with custom domains.
- Client-side dashboards builder — clients receive curated reports (PRD 12 scheduled exports); self-serve client dashboards are post-v3.
- Client user self-registration (open signup against a client company) — invitations only in v1.
- Cross-tenant client identity (one client contact seeing portals from two agencies in one login) — already works via D9 accounts; a unified "my agencies" portal UI is later polish.
- Granular per-field visibility beyond the `client_visible` flag — not planned.
- Client payments inside the portal (pay invoice online) — with invoicing maturity, post-P6.
