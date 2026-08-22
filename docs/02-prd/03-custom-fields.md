# PRD 03 — Custom Fields

*A tenant-level field library with space/project scoping, stored as a typed values table (source of truth) plus a JSONB cache for fast filtering — monday's column flexibility without monday's board-local silos.*

## Overview

Custom fields turn Raqeeb from a task tracker into a Work OS. The design (decision D4) deliberately fixes the two biggest competitor mistakes: monday.com has no global field library (every board reinvents its columns; Enterprise "Managed Columns" is a bolt-on), and blueprint-style "JSONB column on tasks" storage cannot be indexed, validated, or reported on reliably.

Raqeeb fields are defined once in a **tenant-level library** and scoped to where they apply: tenant-wide, one space, or one project (nullable scope FKs). Values are written to a **typed EAV table (`custom_field_values`) as the source of truth** and mirrored into **`tasks.custom_fields_cache` (JSONB, GIN `jsonb_path_ops`)** in the same transaction; the cache serves list filtering, the typed table serves sorting, range queries, rollups, and reporting.

Type waves: **v1 (P2):** text, number, currency, date, checkbox, single_select, multi_select, people, url, email. **v2 (P6):** formula, rollup, relationship, progress, rating. **v3 (P7):** mirror, button, AI.

## User stories

1. As an **admin**, I can define a "Client Priority" single-select once at tenant level and see it available in every project, so that reports across projects group on one field, not fifteen lookalikes.
2. As a **project lead**, I can add a project-scoped field without admin help so that a one-off tracking need doesn't pollute the tenant library.
3. As an **admin**, I can promote a project-scoped field to space or tenant scope (values preserved) so that a pattern that proved useful becomes standard.
4. As a **member**, I can set field values inline in List/Table views with type-appropriate editors (date picker, people picker, currency with tenant currency default) so that data entry is fast.
5. As a **member**, I can filter and sort any view by custom fields (e.g. `Budget > 5000 AND Region in (GCC)`) and the view stays within the performance budget.
6. As a **project lead**, I can mark fields required-on-create for my project so that intake quality is enforced at the source.
7. As an **admin**, I can archive a field (hidden everywhere, values retained) instead of deleting it, so that historical reporting survives cleanup.
8. As a **member (v2)**, I can add a formula field ("Days overdue = today − due date") and a rollup field (sum of subtask estimates) so that computed insight lives on the task row.
9. As a **member (v2)**, I can create a relationship field linking tasks to tasks in another project (typed links, both directions visible) so that cross-team traceability is data, not comment links.
10. As an **admin**, I can see where a field is used (projects, view filters, automations, forms) before archiving it so that I don't silently break rules and forms.

## Functional requirements

### Definitions & scoping
- **FR-1** `custom_fields` rows carry: name, `field_type`, `config` JSONB (options with id/color/position for selects, currency code, number precision/format, formula source in v2…), scope (`space_id` and `project_id` nullable — both NULL = tenant-wide), required flag default, position, archived flag, creator.
- **FR-2** Visibility resolution for a task = union of tenant-wide fields + fields scoped to the space and project of the location being viewed. Name collisions are allowed across scopes; UI disambiguates with scope badges.
- **FR-3** Scope promotion (project → space → tenant) preserves field id and all values; demotion is blocked if values exist outside the target scope (reported with counts).
- **FR-4** Select options are stable ids (never stored by label); renaming an option renames history everywhere. Option deletion requires a remap-or-clear choice.
- **FR-5** Archived fields: hidden from editors/toolbars, values retained and exportable; restorable. Hard delete only for fields with zero values (admin, audit-logged).
- **FR-6** Creation/edit permissions: tenant-scope fields — admin; space-scope — space admin; project-scope — project lead+. Per-field value-edit permissions (e.g. "only finance edits Budget") are **later** (see Out of scope).

### Value storage & integrity
- **FR-7** `custom_field_values`: one row per (task, field) with typed columns (`value_text`, `value_number NUMERIC`, `value_date`, `value_bool`, `value_json` for multi-select/people arrays), UNIQUE(task_id, field_id). This table is the **source of truth**.
- **FR-8** Every value write updates `custom_field_values` and `tasks.custom_fields_cache` (`{field_id: value}` JSONB) **in one transaction**; the cache is never written alone.
- **FR-9** Server-side validation per type: number precision, currency ISO code, email/url syntax, option ids exist, people ids are active memberships in-tenant, date ISO-8601. Invalid writes are 422 with field-level errors.
- **FR-10** Required fields are enforced at task creation in the scoped container and on form submission (PRD 10); existing tasks that predate a requirement are flagged, not blocked.
- **FR-11** Field defaults (per scope) apply at task creation; defaults never retro-write existing tasks.
- **FR-12** A nightly consistency job compares cache to typed values and repairs drift from the typed side (risk item #3 in the build plan); discrepancies are metered and alerted.
- **FR-13** Query routing rule: containment/equality filters may use the GIN-indexed cache; sorting and range predicates must hit the typed table. The view engine (PRD 04) applies this automatically.

### v2 types (P6)
- **FR-14** **Formula**: expression over the task's own fields + core fields; dependency-tracked recompute on write (no on-read compute in lists); cycle detection across formula fields.
- **FR-15** **Rollup**: aggregate (sum/avg/min/max/count/%) over subtasks or over a relationship field's targets; recomputed incrementally via outbox events.
- **FR-16** **Relationship**: typed task↔task links with reciprocal visibility, optional constrained target (specific project); powers rollups and (v3) mirrors.
- **FR-17** **Progress**: auto (% subtasks done by canonical group) or manual 0–100. **Rating**: 1–5 stars.
- **FR-18** **v3:** **mirror** (display a field from a related task), **button** (fires an automation, PRD 09), **AI** (computed by the AI layer, PRD 14).

## Data model touchpoints

| Table | Role |
|---|---|
| `custom_fields` | Definitions: type, config JSONB, scope FKs (`space_id`, `project_id` nullable), archive flag. |
| `custom_field_values` | Typed EAV source of truth; UNIQUE(task_id, field_id); indexes on (tenant_id, field_id, value_number/value_date) for sort/range. |
| `tasks.custom_fields_cache` | JSONB mirror, GIN `jsonb_path_ops`; equality/containment filtering only. |
| `stories` | Field-change activity entries (old → new) for the task feed (PRD 05). |
| `automation_rules`, `forms` | Consumers: field-change triggers/conditions (PRD 09), answer→field mapping (PRD 10). |

Wave B tables; fully specified in `docs/03-domain-model/03-schema-reference.md`, migrated in P2.

## Plan-tier gating

- Free: up to N active custom fields per tenant (small; packaging doc), v1 types only.
- Pro: unlimited v1 fields, required fields, defaults, tenant library management.
- Business: v2 types (formula, rollup, relationship, progress, rating) when P6 lands; field usage report.
- Enterprise: v3 types (mirror, button, AI — AI metered per PRD 14); field-level edit permissions when shipped.
- No tier ever gates *scoping* — even Free fields can be tenant-, space-, or project-scoped (the library model is the product, not an upsell).

## Out of scope / later

- Per-field value-edit permissions ("only role X can edit") — post-P6, with the access-role rework.
- Field types not in the three waves: location, vote, time-tracking-as-column, dependency-as-column (monday parity items we deliberately model as first-class features instead).
- Cross-object fields (fields on projects/portfolios) — portfolios get their own fields in PRD 12; unified "fields on anything" is a later refactor.
- Formula across *other* tasks (aggregation beyond relationship/rollup targets) — not planned; use dashboards.
- Public API write of v2 computed fields (formula/rollup/mirror are read-only by definition).
