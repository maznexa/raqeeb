# Schema Reference — Wave A Data Dictionary + Wave B Catalog

> **Status:** Descriptive reference, derived from decisions D1–D10.
> **The implementation source of truth is `packages/db`** (Drizzle schema + hand-edited SQL
> migrations). If this document and `packages/db` disagree, `packages/db` wins and this
> document has a bug. DDL shown here is the *intended* shape, not copy-paste migration code.

Conventions used throughout:

- **PK** = `id uuid PRIMARY KEY` — UUIDv7, generated at the application layer.
- All tenant-scoped tables: `tenant_id uuid NOT NULL REFERENCES tenants(id)`, RLS enabled
  **and forced**, policy per `docs/04-architecture/02-tenancy-rls.md`.
- Timestamps: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT
  NULL DEFAULT now()` (touch trigger). Soft archive: `archived_at timestamptz NULL`.
- `position text` = fractional-indexing key (D10), `NOT NULL`, collation `C`.
- Every composite index on a tenant table **leads with `tenant_id`** so RLS-constrained
  scans stay index-only.

---

## Wave A tables (scaffold, Phase 0)

### plans — *global, no RLS*

Billing plan catalog. Rows are code-managed (seeded), not user-editable.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | text | PK — `free`, `pro`, `business`, `enterprise` |
| name | text | NOT NULL — display name |
| monthly_price_per_seat | numeric(10,2) | NOT NULL |
| annual_price_per_seat | numeric(10,2) | NOT NULL — per month, billed annually |
| features | jsonb | NOT NULL — boolean entitlements (`{"automations": true, ...}`) |
| limits | jsonb | NOT NULL — limit/metered entitlements (`{"automation_runs_month": 1000, ...}`) |
| is_active | boolean | NOT NULL DEFAULT true — retired plans keep rows for FK integrity |
| created_at / updated_at | timestamptz | |

RLS: **no**. Indexes: PK only.

### accounts — *global, no RLS*

One row per human (or future service account). Identity only — no tenant data (D9).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| email | citext | NOT NULL UNIQUE — global login identity |
| password_hash | text | NULL when SSO-only; argon2id (see security doc) |
| full_name | text | NOT NULL |
| avatar_url | text | NULL |
| locale | text | NOT NULL DEFAULT 'en' — CHECK IN ('en','ar') |
| timezone | text | NOT NULL DEFAULT 'UTC' — IANA name |
| email_verified_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **no** — reachable only through the auth service; never joined into tenant queries
(tenant-visible profile lives on `memberships`).
Indexes: `UNIQUE(email)`.

### tenants

The customer organization. Also the workspace (1:1 implicit, D1).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| name | text | NOT NULL |
| slug | citext | NOT NULL UNIQUE — `^[a-z0-9](-?[a-z0-9]){2,49}$`, reserved words rejected (see tenant lifecycle doc) |
| plan_id | text | NOT NULL REFERENCES plans DEFAULT 'free' |
| subscription_status | text | NOT NULL DEFAULT 'trialing' — CHECK IN ('trialing','active','past_due','canceled','suspended') |
| stripe_customer_id | text | NULL UNIQUE |
| stripe_subscription_id | text | NULL UNIQUE |
| trial_ends_at | timestamptz | NULL |
| default_locale | text | NOT NULL DEFAULT 'en' |
| settings | jsonb | NOT NULL DEFAULT '{}' |
| deleted_at | timestamptz | NULL — soft delete; hard purge after 30 days |
| created_at / updated_at | timestamptz | |

RLS: **yes** — special self-policy `id = current_tenant_id()` (a tenant session sees only its
own row). Provisioning/billing paths use the system role.
Indexes: `UNIQUE(slug)`, `(subscription_status)` partial for reconciliation jobs.

### memberships

Account ↔ tenant junction with per-tenant profile (D9). The unit of seat billing.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| account_id | uuid | NOT NULL REFERENCES accounts |
| client_id | uuid | NULL REFERENCES clients — required when role = 'client' (CHECK) |
| role | text | NOT NULL — CHECK IN ('owner','admin','member','guest','client') |
| is_billable_seat | boolean | NOT NULL — CHECK: false when role IN ('guest','client') |
| display_name | text | NULL — per-tenant override of account.full_name |
| status | text | NOT NULL DEFAULT 'active' — CHECK IN ('active','deactivated') |
| joined_at | timestamptz | NOT NULL DEFAULT now() |
| deactivated_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes** — tenant policy, plus a second self-access policy
(`account_id = current_account_id()`) so login/tenant-switcher can enumerate one’s own
memberships before tenant context exists.
Indexes: `UNIQUE(tenant_id, account_id)`, `(account_id)`,
`(tenant_id, role)` partial `WHERE status = 'active'` (seat counting, billing reconciliation).

### invitations

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| email | citext | NOT NULL |
| role | text | NOT NULL — same CHECK as memberships.role, 'owner' excluded |
| invited_by | uuid | NOT NULL REFERENCES memberships |
| token_hash | text | NOT NULL UNIQUE — SHA-256 of the emailed token |
| expires_at | timestamptz | NOT NULL — default now() + 7 days |
| accepted_at | timestamptz | NULL |
| revoked_at | timestamptz | NULL |
| created_at | timestamptz | |

RLS: **yes** (acceptance endpoint resolves the token via the system role, then creates the
membership inside the tenant context).
Indexes: `UNIQUE(token_hash)`, partial `UNIQUE(tenant_id, email) WHERE accepted_at IS NULL
AND revoked_at IS NULL` (one live invite per address).

### spaces

Permission + feature boundary (D1).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| name | text | NOT NULL |
| icon / color | text | NULL |
| is_private | boolean | NOT NULL DEFAULT false |
| default_workflow_id | uuid | NULL REFERENCES workflows — default binding for new projects |
| position | text | NOT NULL — fractional key |
| settings | jsonb | NOT NULL DEFAULT '{}' — per-space feature toggles (ClickApps-style, later) |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `(tenant_id, position)`.

### folders

Optional organizing tree between space and project. Depth ≤ 5 (D1).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| space_id | uuid | NOT NULL REFERENCES spaces |
| parent_folder_id | uuid | NULL self-FK — depth ≤ 5 enforced by trigger + app validation |
| name | text | NOT NULL |
| position | text | NOT NULL |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `(tenant_id, space_id, position)`, `(tenant_id, parent_folder_id)`.

### projects

Terminal task container (D1). Owns the task-ID prefix and counter (D2).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| space_id | uuid | NOT NULL REFERENCES spaces |
| folder_id | uuid | NULL REFERENCES folders |
| client_id | uuid | NULL REFERENCES clients (D8) |
| workflow_id | uuid | NOT NULL REFERENCES workflows — resolved from space default at creation, overridable |
| name | text | NOT NULL |
| key | text | NOT NULL — task-ID prefix, `^[A-Z][A-Z0-9]{1,9}$` |
| task_counter | integer | NOT NULL DEFAULT 0 — allocated with `UPDATE ... RETURNING` |
| description | text | NULL |
| start_date / due_date | date | NULL |
| is_private | boolean | NOT NULL DEFAULT false |
| position | text | NOT NULL |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `UNIQUE(tenant_id, key)`, `(tenant_id, space_id, position)`,
`(tenant_id, client_id)`, `(tenant_id, folder_id)`.

### sections

Ordered grouping inside a project (list groups / board columns v1).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| project_id | uuid | NOT NULL REFERENCES projects ON DELETE CASCADE |
| name | text | NOT NULL |
| position | text | NOT NULL |
| is_default | boolean | NOT NULL DEFAULT false — one per project (partial unique) |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `(tenant_id, project_id, position)`,
partial `UNIQUE(project_id) WHERE is_default`.

### workflows

Tenant-scoped reusable status-set library (D3).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| name | text | NOT NULL — `UNIQUE(tenant_id, name)` |
| description | text | NULL |
| is_default | boolean | NOT NULL DEFAULT false — tenant default (partial unique) |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `UNIQUE(tenant_id, name)`, partial `UNIQUE(tenant_id) WHERE is_default`.

### statuses

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| workflow_id | uuid | NOT NULL REFERENCES workflows ON DELETE CASCADE |
| name | text | NOT NULL — `UNIQUE(workflow_id, name)` |
| color | text | NOT NULL — hex |
| position | text | NOT NULL |
| canonical_group | text | NOT NULL — CHECK IN ('not_started','active','done','cancelled') (see `04-canonical-status-groups.md`) |
| is_initial | boolean | NOT NULL DEFAULT false — workflow entry status (partial unique per workflow) |
| created_at / updated_at | timestamptz | |

Validation (service layer): every workflow must contain ≥ 1 `not_started`, ≥ 1 `done` status,
and exactly one `is_initial`.
RLS: **yes**. Indexes: `(tenant_id, workflow_id, position)`, `UNIQUE(workflow_id, name)`.

### item_types

Type registry (D5/D6). Seeded per tenant with system types: Task, Milestone, Approval.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| name | text | NOT NULL — `UNIQUE(tenant_id, name)` |
| icon / color | text | NULL |
| base_kind | text | NOT NULL — CHECK IN ('task','milestone','approval') |
| is_system | boolean | NOT NULL DEFAULT false — system rows not deletable |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `UNIQUE(tenant_id, name)`.

### tasks

The canonical work item (D2). Never carries a project FK — placement is `task_locations`.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| item_type_id | uuid | NOT NULL REFERENCES item_types |
| parent_task_id | uuid | NULL self-FK — subtasks (depth limited in service layer) |
| status_id | uuid | NOT NULL REFERENCES statuses |
| title | text | NOT NULL — CHECK length ≤ 500 |
| description | text | NULL — markdown v1; rich-doc JSON later |
| priority | text | NOT NULL DEFAULT 'normal' — CHECK IN ('urgent','high','normal','low') |
| estimate_minutes | integer | NULL — effort, independent of dates (D7) |
| start_date / due_date | date | NULL — duration; time-of-day support deferred |
| number | integer | NOT NULL — allocated from primary project's task_counter; display key = `{project.key}-{number}` |
| approval_status | text | NULL — CHECK IN ('pending','approved','changes_requested','rejected'); non-NULL only for approval base_kind (D6) |
| completed_at | timestamptz | NULL — set/cleared by status transitions into/out of the done group |
| created_by | uuid | NULL REFERENCES memberships ON DELETE SET NULL |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

Wave B migration adds: `custom_fields_cache jsonb NOT NULL DEFAULT '{}'` + GIN
`jsonb_path_ops` index (D4).
RLS: **yes**. Indexes: `(tenant_id, status_id)`, `(tenant_id, parent_task_id)`,
`(tenant_id, due_date) WHERE completed_at IS NULL`, `(tenant_id, created_at)`.

### task_locations

Multi-homing junction (D2).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| task_id | uuid | NOT NULL REFERENCES tasks ON DELETE CASCADE |
| project_id | uuid | NOT NULL REFERENCES projects ON DELETE CASCADE |
| section_id | uuid | NULL REFERENCES sections ON DELETE SET NULL |
| position | text | NOT NULL — fractional key within (project, section) |
| is_primary | boolean | NOT NULL DEFAULT false |
| created_at | timestamptz | |

Constraints: `UNIQUE(task_id, project_id)`;
partial `UNIQUE(task_id) WHERE is_primary` (exactly one primary; deleting the primary
location promotes another in the service layer or is refused).
RLS: **yes**. Indexes: `(tenant_id, project_id, section_id, position)` — **the** task-list
index, `(tenant_id, task_id)`.

### task_assignees

Multiple assignees (D7). Assignees are memberships, so guests/clients can be assigned
where permitted.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| task_id | uuid | PK part — REFERENCES tasks ON DELETE CASCADE |
| membership_id | uuid | PK part — REFERENCES memberships |
| tenant_id | uuid | NOT NULL FK |
| assigned_by | uuid | NULL REFERENCES memberships |
| created_at | timestamptz | |

PK: `(task_id, membership_id)`.
RLS: **yes**. Indexes: `(tenant_id, membership_id)` (My Work),
`(tenant_id, task_id)`.

### task_dependencies

DAG edges. Cycles rejected in the service layer (recursive CTE check on insert).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| predecessor_task_id | uuid | NOT NULL REFERENCES tasks ON DELETE CASCADE |
| successor_task_id | uuid | NOT NULL REFERENCES tasks ON DELETE CASCADE |
| dep_type | text | NOT NULL DEFAULT 'FS' — CHECK IN ('FS','SS','FF','SF') |
| lag_minutes | integer | NOT NULL DEFAULT 0 — negative = lead |
| created_at | timestamptz | |

Constraints: `UNIQUE(predecessor_task_id, successor_task_id)`,
`CHECK (predecessor_task_id <> successor_task_id)`.
RLS: **yes**. Indexes: `(tenant_id, predecessor_task_id)`, `(tenant_id, successor_task_id)`.

### clients

First-class agency clients (D8).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| name | text | NOT NULL — `UNIQUE(tenant_id, name)` |
| email | citext | NULL |
| phone | text | NULL |
| currency | text | NOT NULL DEFAULT 'USD' — ISO 4217; client-billing currency (Teamwork lesson) |
| notes | text | NULL |
| archived_at | timestamptz | NULL |
| created_at / updated_at | timestamptz | |

RLS: **yes**. Indexes: `UNIQUE(tenant_id, name)`.

### personal_access_tokens

v1 API credential (`raq_pat_...`). See `docs/05-api-design/03-auth.md`.

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK |
| tenant_id | uuid | NOT NULL FK |
| membership_id | uuid | NOT NULL REFERENCES memberships ON DELETE CASCADE |
| name | text | NOT NULL — user label |
| token_prefix | text | NOT NULL — `raq_pat_` + first 8 random chars, display only |
| token_hash | text | NOT NULL UNIQUE — SHA-256 of the full token; plaintext never stored |
| last_used_at | timestamptz | NULL — updated at most once/minute (write coalescing) |
| expires_at | timestamptz | NULL — optional |
| revoked_at | timestamptz | NULL |
| created_at | timestamptz | |

RLS: **yes** (token *resolution* at request time runs under the auth path by hash, then
enters tenant context).
Indexes: `UNIQUE(token_hash)`, `(tenant_id, membership_id)`.

### audit_logs

Append-only. Range-partitioned by month on `created_at` (see security doc).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| id | uuid | PK part (with created_at, for partitioning) |
| tenant_id | uuid | NOT NULL FK |
| actor_type | text | NOT NULL — CHECK IN ('user','pat','system') |
| membership_id | uuid | NULL REFERENCES memberships ON DELETE SET NULL |
| action | text | NOT NULL — dotted verb: `task.delete`, `member.invite`, `billing.plan_change` |
| entity_type | text | NOT NULL |
| entity_id | uuid | NOT NULL |
| changes | jsonb | NOT NULL DEFAULT '{}' — `{field: {from, to}}` diff |
| ip_address | inet | NULL |
| user_agent | text | NULL |
| created_at | timestamptz | NOT NULL — partition key |

RLS: **yes**. No UPDATE/DELETE grants to the app role (insert + select only).
Indexes per partition: `(tenant_id, created_at)`, `(tenant_id, entity_type, entity_id)`.

### outbox_events

Transactional outbox feeding realtime + webhooks (see realtime doc).

| Column | Type | Constraints / notes |
| --- | --- | --- |
| seq | bigint | PK — `GENERATED ALWAYS AS IDENTITY`; poller ordering |
| id | uuid | NOT NULL UNIQUE — event id; client/webhook dedupe key |
| tenant_id | uuid | NOT NULL FK |
| event_type | text | NOT NULL — `task.created`, `task.status_changed`, ... (webhook catalog) |
| entity_type | text | NOT NULL |
| entity_id | uuid | NOT NULL |
| actor_membership_id | uuid | NULL |
| payload | jsonb | NOT NULL — fat payload: changed fields + new values |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| published_at | timestamptz | NULL — set by the publisher; rows pruned after 7 days |

RLS: **yes** for the app role; the publisher runs under the system role (cross-tenant
poller) — see `docs/04-architecture/02-tenancy-rls.md`.
Indexes: partial `(seq) WHERE published_at IS NULL` (poll queue), `(tenant_id, created_at)`.

---

## Wave A summary matrix

| Table | RLS | Notable uniques | Hot composite index |
| --- | --- | --- | --- |
| plans | no | PK (text) | — |
| accounts | no | email | — |
| tenants | yes (self) | slug | (subscription_status) partial |
| memberships | yes (+ self policy) | (tenant_id, account_id) | (tenant_id, role) WHERE active |
| invitations | yes | token_hash; live (tenant_id, email) | — |
| spaces | yes | — | (tenant_id, position) |
| folders | yes | — | (tenant_id, space_id, position) |
| projects | yes | (tenant_id, key) | (tenant_id, space_id, position) |
| sections | yes | default per project | (tenant_id, project_id, position) |
| workflows | yes | (tenant_id, name) | — |
| statuses | yes | (workflow_id, name) | (tenant_id, workflow_id, position) |
| item_types | yes | (tenant_id, name) | — |
| tasks | yes | — | (tenant_id, due_date) partial; (tenant_id, status_id) |
| task_locations | yes | (task_id, project_id); primary per task | (tenant_id, project_id, section_id, position) |
| task_assignees | yes | PK (task_id, membership_id) | (tenant_id, membership_id) |
| task_dependencies | yes | (predecessor, successor) | (tenant_id, successor_task_id) |
| clients | yes | (tenant_id, name) | — |
| personal_access_tokens | yes | token_hash | (tenant_id, membership_id) |
| audit_logs | yes | — | (tenant_id, created_at) per partition |
| outbox_events | yes* | id (event uuid) | (seq) WHERE published_at IS NULL |

\* publisher reads cross-tenant under the system role.

---

## Wave B catalog (specified now, migrated later)

Each table below is tenant-scoped and RLS-protected. Column detail lives with the owning
phase's design work; purposes and phases are fixed here so Wave A leaves the right hooks.

| Table | Purpose | Phase |
| --- | --- | --- |
| custom_fields | Field library (tenant-level, nullable space/project scope FKs); v1 types text, number, currency, date, checkbox, single_select, multi_select, people, url, email (D4) | P2 |
| custom_field_values | Typed EAV value rows — source of truth for custom field data; typed columns per family + FK integrity | P2 |
| *(tasks.custom_fields_cache)* | JSONB cache column added to `tasks` + GIN jsonb_path_ops; containment filters only (D4, risk 3) | P2 |
| comments | Threaded task comments, rich-text body with mentions; feeds notifications + Stories-style activity | P2 |
| saved_views | Named view configs (list/board/table/calendar) per container: filters, sort, group, column layout | P2 |
| notifications | Per-membership inbox items (assigned, mentioned, status change, due soon) with read state | P2 |
| attachments | File metadata for S3 presigned uploads (bucket key, size, content type, scan status) | P2 |
| time_entries | Time logs with snapshotted bill/cost rates, billable flag, approval state machine, locking (D8) | P3 |
| project_budgets | Budget per project: tm / fixed_fee / retainer / non_billable, convertible with conversion event (D8) | P3 |
| rate_cards / rate_card_entries | Named rate cards; date-effective per-role rates; client-scoped override cards (D8) | P3 |
| person_cost_periods | Time-versioned per-person cost rates — never a mutable column (D8) | P3 |
| retainers / retainer_periods | Retainer agreements; periods with hour/price targets, rollover in/out, overage, per-period locking (D8) | P3 |
| allocations | Staffing reservations: person XOR placeholder-role, project, date range, hrs/day, tentative/confirmed (D7) | P4 |
| work_schedules | Per-person weekly capacity calendars + exceptions (holidays, OOO, capacity changes) | P4 |
| automations | Recipe rules: trigger + conditions + actions, scoped to tenant/space/project; run counters for metered quota | P5 |
| automation_runs | Execution log per rule firing (idempotency + debugging + metering) | P5 |
| webhooks | Outbound subscriptions: target URL, hashed secret, event filters, container scope, health status | P2 (API GA) |
| webhook_deliveries | Delivery attempts with response codes and backoff state (24h retry window) | P2 (API GA) |
| forms | Public intake forms with conditional logic, field→task mapping, branded pages | P5 |
| proofs | Proofing versions with annotations, reviewers/approvers, external email approval | P5 |
| goals | Objectives with target types and auto progress rollup from projects/tasks | P6 |
| portfolios / portfolio_projects | Nestable cross-space project collections with status rollups | P6 |
| dashboards / dashboard_widgets | Widget-based reporting canvases | P6 |
| tenant_sso_configs | SAML/OIDC IdP config per tenant (kept from blueprint-1, enterprise phase) | P7 |
| oauth_apps / oauth_grants | OAuth2 application registry + granted scopes for the v2 developer platform | P7 |

Wave B tables must follow the same rules as Wave A: `tenant_id` on every row, FORCE RLS,
composite indexes leading with `tenant_id`, UUIDv7 PKs, fractional TEXT positions where
users can reorder.
