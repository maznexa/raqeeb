# PRD 10 — Intake

*Forms with conditional logic that map answers to fields — and, at the top of the funnel, Wrike's factory pattern: a submission conditionally launches a blueprint, stamping out an entire templated project tree with relative dates.*

## Overview

Intake is how work enters Raqeeb in a structured way instead of via chat and email archaeology. The module has two layers:

1. **Forms** — per-project, optionally public and branded, with conditional (branching) logic and explicit **answer → field mapping**, so a submission becomes a well-formed task with populated custom fields, not a blob of text.
2. **Conditional launch → blueprints** — the Wrike forms→blueprints factory: based on the submitter's answers, a submission can, instead of creating a single task, instantiate a **blueprint** — a templated project or task tree with relative dates, role-based assignments, dependencies, and pre-wired sections — turning "new client onboarding request" into a fully scheduled 40-task project in one submit.

Forms feed the automation engine (`form submitted` trigger, PRD 09) and respect required custom fields (PRD 03). Email-in intake is a later addition.

Phase: **P5** (forms + mapping + conditional launch + blueprints). Blueprints are also usable directly (project templates) independent of forms.

## User stories

1. As a **project lead**, I can build a form attached to my project with typed questions (text, select, date, number, file upload, people), mark questions required, and reorder by drag, so that intake asks exactly what execution needs.
2. As a **project lead**, I can add branching: "if request type = Bug, show severity and steps-to-reproduce; if = Feature, show business case" — so that submitters see only what's relevant.
3. As a **project lead**, I can map each answer to a task field (title template, description block, custom fields, assignee, priority, section) so that submissions arrive as complete, filterable tasks.
4. As an **admin**, I can publish a form to a public URL with our logo, colors, and a thank-you message so that clients and other departments can submit without a Raqeeb login.
5. As a **submitter (no account)**, I can fill a public form, optionally leave my email, and receive a confirmation (and later a status update if enabled), so that the request isn't a black hole.
6. As an **operations admin**, I can define a blueprint — a templated project tree: sections, tasks with **relative dates** ("start T+2, due T+7 working days"), dependencies, role placeholders ("Account Manager", "Designer"), checklists, custom-field presets — so that repeatable engagements are stamped, not rebuilt.
7. As an **operations admin**, I can configure conditional launch on a form: "if budget ≥ 50k → launch *Enterprise Onboarding* blueprint into the Sales space; else → create a task in the Triage project" — so that big requests self-assemble into projects.
8. As a **project lead**, when a blueprint launches I'm prompted to bind role placeholders to real people (with allocation hand-off to PRD 08 where enabled), so that the stamped project is staffed in one step.
9. As a **member**, I can see the original submission (all answers, submitter, timestamp) attached to the created task/project so that context never detaches from the work.
10. As an **admin**, I can review a form's submission log — including failed/spam-filtered submissions — so that intake is auditable.

## Functional requirements

### Form builder
- **FR-1** `forms` belong to a project (creation target) with: name, slug, status (draft/published/closed), branding (logo, colors, intro/thank-you rich text), access (members-only / anyone-in-tenant / **public link**), optional CAPTCHA + rate limits for public forms, notification recipients.
- **FR-2** `form_fields`: question types — short/long text, number, currency, date, single/multi select, checkbox, email, url, people (member-visible forms only), **file upload** (S3 presigned, size/type limits per plan). Required flag, help text, placeholder, position.
- **FR-3** Conditional logic: show/hide rules per field — condition on earlier answers (equals/not/any-of/greater/less), AND/OR groups; the builder blocks forward references and cycles; a live preview simulates all branches.
- **FR-4** Versioning: editing a published form creates a new version; submissions reference the version they were filled against, so historical answers always render with their original schema.

### Mapping (answers → fields)
- **FR-5** Each form field maps to: task title (template with `{{answer}}` tokens), description block (all unmapped answers append as a formatted block by default), a specific custom field (type-compatible, validated at build time), priority, assignee(s), section, or start/due dates.
- **FR-6** Required custom fields on the target project (PRD 03 FR-10) must be satisfied by mappings or defaults before a form can publish — the builder shows unresolved requirements.
- **FR-7** Submission processing is transactional: create task (or launch blueprint), write mapped values (typed table + cache per D4), attach the submission record + uploaded files, emit Stories + `form submitted` automation trigger. Failures land in a retry queue, never lost.

### Public forms
- **FR-8** Public forms run on tokenized URLs (unguessable slugs), no auth; tenant branding; per-form and per-IP rate limits + honeypot/CAPTCHA; submitter email optional field with confirmation email (and, if enabled, a status-notification opt-in when the created task reaches a done-group status).
- **FR-9** Public submissions record source metadata (referrer, UA) and pass a spam filter; flagged submissions are quarantined in the submission log for manual accept/reject — accepted ones then process normally (FR-7).

### Blueprints
- **FR-10** `blueprints`: tenant-level library (space-scopable), containing a serialized template tree — folders/projects/sections/tasks/subtasks with: relative date rules (`anchor + N calendar|working days`, anchor = launch date or a named milestone), dependencies between templated tasks, **role placeholders** for assignments, item types, checklists, custom-field presets, workflow binding, and default views.
- **FR-11** Launch (manual "New from blueprint" or form-triggered): instantiates the tree as an async job (large trees don't block; Asana's async template jobs lesson), resolves relative dates against the anchor **respecting work schedules/holiday calendars where available (P4)**, wires dependencies, prompts for role→person binding (deferrable — unbound roles stay as placeholders visible in PRD 08).
- **FR-12** Conditional launch on forms: an ordered rule list (conditions over answers, same engine as FR-3) selecting: create task in project X / launch blueprint Y into container Z (with answer→blueprint-variable mapping, e.g. client name into project title template). First match wins; a default rule is mandatory.
- **FR-13** Blueprint versioning: launched instances record blueprint id + version; editing a blueprint never mutates past launches.

### Email-in (later)
- **FR-14 (post-P5)** Per-project intake addresses (`project-slug@in.raqeeb.com`): subject → title, body → description, attachments carried, sender matched to membership when possible; replies thread into comments. Specified here for completeness; not in P5 scope.

## Data model touchpoints

`forms`, `form_versions`, `form_fields`, `form_logic_rules`, `form_submissions` (answers JSONB against version schema, source metadata, spam state, created object refs), `blueprints`, `blueprint_versions`, `blueprint_launches` (anchor, bindings, created tree refs, job state); writes into `tasks`, `task_locations`, `sections`, `projects`, `custom_field_values` + `tasks.custom_fields_cache`, `task_dependencies`, `attachments`; emits `outbox_events` + `stories`; triggers `automation_rules` (PRD 09). Wave B, P5; specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: 1 form per tenant, members-only, basic mapping (title/description), no branching.
- Pro: unlimited forms, public/branded forms, conditional logic, full answer→field mapping, file uploads.
- Business: conditional launch → blueprints, blueprint library + versioning, submission spam quarantine, status-update emails to submitters.
- Enterprise: no additional intake gates (larger upload limits, retention).
- Blueprints as plain project templates (manual launch) are Pro+; the *conditional-launch factory* is the Business differentiator.

## Out of scope / later

- Email-in intake (FR-14) — post-P5.
- Payment collection on forms — not planned.
- Multi-page forms with save-and-resume for anonymous submitters — later; v1 public forms are single-page (sections allowed).
- Embeddable form widget (iframe/script) — fast-follow after P5.
- Request-management SLAs (first-response timers, queues) — automation recipes cover basics; dedicated service-desk features are post-v3.
- Wrike-style approval steps inside the intake flow itself — approvals attach to the created work (PRD 13), not the form.
