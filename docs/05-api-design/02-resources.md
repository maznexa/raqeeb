# API Resources — v1 Endpoint Map (Wave A)

> **Status:** Accepted for Wave A; Wave B rows are **reserved paths** (documented so
> integrators and the OpenAPI spec can reserve names — returning `404` with problem type
> `not-yet-available` until their phase ships).
> Conventions (auth, pagination, `fields=`, idempotency, errors): `01-conventions.md`.
> All routes are under `/api/v1` and tenant-scoped via `X-Raqeeb-Tenant` unless marked
> *account-scoped*.

## Auth & session — *account-scoped*

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `POST /auth/signup` | Create account (+ optionally provision first tenant) | req: `email`, `password`, `full_name`, `locale`; opt `tenant: {name, slug}` → resp: account + tenant + tokens |
| `POST /auth/login` | Password login | resp: `access_token` (15 min), refresh cookie; `memberships[]` summary for tenant picker |
| `POST /auth/refresh` | Rotate refresh, mint access | single-use rotation; reuse ⇒ family revoked (security doc) |
| `POST /auth/logout` | Revoke refresh family | |
| `GET /auth/me` | Current account + memberships | resp: account profile, `memberships[]: {tenant: {id, slug, name}, role}` |

## Tenants & provisioning

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `POST /tenants` *(account-scoped)* | Provision tenant (self-serve signup step 2) | req: `name`, `slug`; seeds defaults (workflow, item types, demo project); creator becomes `owner` |
| `GET /tenants/current` | Resolved tenant profile | resp: `id, name, slug, plan_id, subscription_status, default_locale, trial_ends_at` |
| `PATCH /tenants/current` | Update settings | admin+; name, default_locale, settings |
| `GET /tenants/current/usage` | Seat/limit counters | resp: billable seats, entitlement usage snapshot |

## Memberships & invitations

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /memberships` | List members | filters: `role`, `status`; resp rows: `id, account: {email, full_name}, display_name, role, is_billable_seat, status, joined_at` |
| `GET /memberships/{id}` | One member | |
| `PATCH /memberships/{id}` | Change role / display_name / deactivate | admin+; role change to/from billable recalculates seats (billing doc); last-owner protection |
| `DELETE /memberships/{id}` | Deactivate (soft) | never hard-deletes (history FKs) |
| `POST /invitations` | Invite by email | req: `email`, `role`, opt `client_id` (required for role `client`); idempotent per live (tenant, email) |
| `GET /invitations` | List pending | |
| `POST /invitations/{id}/resend` | Re-send email | rate-limited |
| `DELETE /invitations/{id}` | Revoke | |
| `POST /invitations/accept` *(account-scoped)* | Accept via token | req: `token`; creates membership, marks accepted |

## Spaces, folders, projects, sections

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /spaces` · `POST /spaces` | List / create | `name, icon, color, is_private, default_workflow_id, position` (create accepts `insert_before/after`) |
| `GET/PATCH/DELETE /spaces/{id}` | Read / update / archive | DELETE = archive (archived_at); hard delete admin-only + empty |
| `GET /folders?space_id=` · `POST /folders` | List / create | `space_id, parent_folder_id (depth ≤ 5), name`; move via `PATCH` with `parent_folder_id` + `insert_before/after` |
| `GET/PATCH/DELETE /folders/{id}` | | |
| `GET /projects` · `POST /projects` | List / create | filters: `space_id, folder_id, client_id, archived`; create: `name, key, space_id, folder_id?, client_id?, workflow_id?` (defaults to space workflow); resp incl. `task_counter` omitted, `key` |
| `GET/PATCH/DELETE /projects/{id}` | Read / update / archive | `workflow_id` change validates status remapping (statuses map by canonical group, explicit mapping payload for ambiguity) |
| `GET /projects/{id}/sections` · `POST /projects/{id}/sections` | Sections | `name, position` via `insert_before/after` |
| `PATCH/DELETE /sections/{id}` | Rename / reorder / archive | reorder: `insert_before/after` section ids |

## Workflows & statuses & item types

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /workflows` · `POST /workflows` | Library list / create | create accepts inline `statuses[]`; validation: ≥1 `not_started`, ≥1 `done`, exactly one `is_initial` |
| `GET/PATCH/DELETE /workflows/{id}` | | DELETE blocked while bound to projects (409 lists bindings) |
| `POST /workflows/{id}/statuses` | Add status | `name, color, canonical_group, is_initial, insert_before/after` |
| `PATCH/DELETE /statuses/{id}` | Update / remove | remove requires `reassign_to` status id when tasks reference it |
| `GET /item-types` | List (system + custom) | `name, icon, base_kind, is_system`; custom CRUD unlocks with CIT (P5) — POST reserved |

## Tasks (incl. locations, assignees, dependencies)

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /tasks` | List/filter | filters: `project_id` (required unless `assignee_id`/`parent_task_id` given), `section_id`, `status_id`, `canonical_group`, `assignee_id`, `item_type_id`, `due_before/after`, `archived`; sort: `position` (default, needs project), `due_date`, `created_at`; cursor-paginated |
| `POST /tasks` | Create | req: `title`, `project_id` (+ `section_id?`, `insert_before/after?` → primary location), `item_type_id?` (default Task), `description?, priority?, estimate_minutes?, start_date?, due_date?, assignee_ids?[], parent_task_id?`; resp incl. `key` (`ACME-42`), `locations[]`, initial status |
| `GET /tasks/{id}` | Read | expansions: `locations, assignees, dependencies, subtasks` via `fields=` |
| `GET /tasks/by-key/{key}` | Read by display key | |
| `PATCH /tasks/{id}` | Update fields | `status_id` transitions maintain `completed_at`; `approval_status` only for approval base_kind (422 otherwise) |
| `DELETE /tasks/{id}` | Archive (default) / `?hard=true` (admin) | |
| `GET /tasks/{id}/locations` | List homes | `project_id, section_id, position, is_primary` |
| `POST /tasks/{id}/locations` | Add home (multi-home) | req: `project_id, section_id?, insert_before/after?`; 409 if already homed there |
| `PATCH /tasks/{id}/locations/{locId}` | Move within/between sections; set primary | `section_id?, insert_before/after?, is_primary?` (primary handoff atomic) |
| `POST /tasks/{id}/locations/{locId}/move` | Explicit reorder verb | `insert_before` XOR `insert_after` (task ids) — fractional key computed server-side (D10) |
| `DELETE /tasks/{id}/locations/{locId}` | Remove a home | removing the primary: 409 unless another location nominated via `?promote={locId}` |
| `PUT /tasks/{id}/assignees/{membershipId}` | Assign (idempotent) | multiple assignees supported (D7) |
| `DELETE /tasks/{id}/assignees/{membershipId}` | Unassign | |
| `GET /tasks/{id}/dependencies` | Both directions | resp: `predecessors[], successors[]` with `dep_type, lag_minutes` |
| `POST /tasks/{id}/dependencies` | Add edge | req: `predecessor_task_id` XOR `successor_task_id`, `dep_type` (default `FS`), `lag_minutes`; 422 `dependency-cycle` on cycle detection |
| `DELETE /dependencies/{id}` | Remove edge | |
| `GET /tasks/{id}/subtasks` | Children list | |

## Clients

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /clients` · `POST /clients` | List / create | `name, email, phone, currency, notes` |
| `GET/PATCH/DELETE /clients/{id}` | | DELETE = archive; projects keep the FK |

## Personal access tokens

| Method + path | Purpose | Notable fields |
| --- | --- | --- |
| `GET /personal-access-tokens` | List own tokens (admins: all) | `name, token_prefix, last_used_at, expires_at, revoked_at` — never the token |
| `POST /personal-access-tokens` | Create | req: `name, expires_at?`; resp includes the **full token once** (`raq_pat_...`) |
| `DELETE /personal-access-tokens/{id}` | Revoke | immediate |

## Reserved paths (Wave B — return `not-yet-available` until their phase)

| Path family | Resource | Phase |
| --- | --- | --- |
| `/custom-fields`, `/tasks/{id}/field-values` | Custom fields + values | P2 |
| `/comments`, `/tasks/{id}/comments` | Comments & mentions | P2 |
| `/attachments` | Presigned uploads | P2 |
| `/views` | Saved views | P2 |
| `/notifications` | Notification inbox | P2 |
| `/webhooks`, `/webhooks/{id}/deliveries` | Webhook subscriptions (contract already normative in `04-webhooks.md`) | P2 |
| `/search` | FTS | P2 |
| `/time-entries`, `/timesheets` | Time tracking | P3 |
| `/project-budgets`, `/rate-cards`, `/retainers` | Financials | P3 |
| `/allocations`, `/work-schedules`, `/capacity` | Resource planning | P4 |
| `/automations`, `/forms` | Rules & intake | P5 |
| `/goals`, `/portfolios`, `/dashboards` | Portfolio layer | P6 |
| `/audit-logs` (read API), `/scim/v2`, OAuth2 endpoints | Enterprise & platform | P7 |

Reserved names are present in the published OpenAPI as stubs with `x-raqeeb-phase`
markers, so SDK generators and integrators never collide with them.
