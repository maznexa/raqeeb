# PRD 13 — Proofing & Approvals

*First-class approval tasks and versioned visual proofs: pinned annotations, side-by-side version compare, approvals that reset when the file changes, and external approvers who need nothing but an email link.*

## Overview

Sign-off is a workflow, not a comment thread. Raqeeb models it at two levels:

- **Approval tasks** (decision D6): an item type with `base_kind = approval` carrying `approval_status ∈ pending / approved / changes_requested / rejected` — Asana's proven subtype, present in the data model from the Phase 0 scaffold. Any deliverable-shaped decision ("approve the media plan") is an approval task, with or without a file.
- **Proofs**: versioned review of visual assets attached to a task — **image and PDF in v1 of the feature**, video later. Reviewers drop **pinned annotation comments** on the asset (position-anchored, threaded), compare any two versions **side by side**, and record decisions. Uploading a new version **resets approvals** — a stale "approved" can never silently apply to changed work (Wrike's rule, adopted).

Roles are explicit: **reviewers** give feedback; **approvers** gate. And per Wrike/Teamwork's best trick, **external approvers participate via a signed email link without any account** — free, frictionless, auditable.

Phase: approval subtype ships in the Phase 0 model; the proofing feature set is **P5** (with the client portal, its natural companion).

## User stories

1. As a **project lead**, I can create an approval task ("Approve Q3 media plan"), assign approvers and a due date, and its state (pending/approved/changes requested/rejected) is visible wherever the task appears.
2. As an **approver (member or client user)**, approvals awaiting me surface in My Work and my Inbox as Important, so that I never bottleneck a launch by not noticing.
3. As a **designer**, I can upload artwork to a task as a proof and invite reviewers/approvers in one step, so that feedback happens on the pixels, not in email.
4. As a **reviewer**, I can click anywhere on an image or PDF page to pin a comment at that exact spot, thread replies under it, and mark it resolved, so that "the logo, a bit left" has coordinates.
5. As a **designer**, I can upload v2 of the proof; all v1 annotations stay with v1, approvals reset to pending, and everyone involved is notified that a new version awaits.
6. As a **reviewer**, I can open v1 and v2 side by side (synced zoom/pan) so that "what changed?" takes seconds.
7. As a **project lead**, I can distinguish reviewers (feedback expected) from approvers (decision required, all must approve unless configured any-of), so that sign-off authority is unambiguous.
8. As an **agency PM**, I can send a proof to the client's brand director — who has no Raqeeb account — via an email link where she can view, annotate, and approve; her identity (email) is stamped on every action.
9. As a **client user**, with proof permissions (PRD 11 toggles 12–13) I can annotate and approve proofs inside the portal, seeing only client-visible discussion.
10. As a **project lead**, I can see an audit trail of the whole approval: versions, who was asked, who decided what and when, and on which version, so that disputes end with a link.

## Functional requirements

### Approval tasks (Phase 0 model; behavior from P2)
- **FR-1** Item type with `base_kind = approval` (D5/D6); `tasks.approval_status ∈ pending / approved / changes_requested / rejected`, default `pending`. Approval status is **orthogonal to workflow status** (an approval task still moves through the board); automations can bind them (e.g. approved → move to Done).
- **FR-2** Approvers = the task's assignees by default; optional explicit approver list with policy `all_of` (default) | `any_of`. Decision actions record actor + timestamp + optional note as Stories; `changes_requested` and `rejected` require a note.
- **FR-3** A new decision cycle (re-request after changes) resets to `pending` and preserves prior cycles in history. Approval decisions trigger notifications (Important tier) and the `approval decided` automation trigger (PRD 09).

### Proofs & versions (P5)
- **FR-4** A proof attaches to a task: `proofs` (task, title, settings) with ordered `proof_versions` (attachment ref, uploader, created_at, per-version decision state). v1 formats: raster images (png/jpg/webp/gif first frame), PDF (multi-page, per-page annotation); files render via a server-side tiling/preview pipeline (no full-file download needed to view).
- **FR-5** Uploading a new version: annotations remain bound to their version; **all approval decisions reset to pending on the new version** (FR-hard rule); participants notified; older versions become read-only for new annotations (viewable, resolvable).
- **FR-6** Version compare: any two versions side by side with synchronized zoom/pan and page navigation (PDF); annotation overlays toggleable per side.

### Annotations
- **FR-7** `proof_comments`: anchored to (version, page, normalized x/y [+ optional rectangle]), body rich text, author (membership or external identity), thread replies, states `open/resolved` (resolver + timestamp recorded). Rendered as numbered pins; a sidebar lists pins with filter (open/resolved/by author) and click-to-focus.
- **FR-8** Annotations are Stories-integrated (task activity shows "3 annotations on v2") and count toward the task's client-visibility rules: on client-shared projects, internal-only annotation threads are supported (PRD 11 FR-8 semantics).

### Reviewers vs approvers
- **FR-9** Per proof: **reviewers** (may annotate, comment, mark "review done") and **approvers** (may additionally decide approve / request changes / reject on a version). Proof-level outcome per version: approved when the approver policy is satisfied; any `request changes` flags the version. Proof outcome can auto-set the owning approval task's `approval_status` (on by default when the task is an approval type).
- **FR-10** Reminders: configurable nudge cadence to pending reviewers/approvers (default: 48 h, twice), respecting DND and digest rules (PRD 05).

### External reviewers (no account)
- **FR-11** `external_review_links`: per proof × external email — signed token URL, scope (view+annotate / +approve), expiry (default 14 days, renewable), revocable; optional access code for sensitive work. No membership row is created (persona: external reviewer).
- **FR-12** External sessions: minimal branded review UI (en/ar), identity = verified email (link click + optional code), all actions stamped with that identity in annotations/decisions/Stories; rate-limited; watermark option (Business setting). External reviewers see only the proof — never the task, project, or any internal comments.
- **FR-13** Decisions from external approvers satisfy approver policy like any internal decision, and appear in the audit trail as "Jane (external — jane@client.com)".

## Data model touchpoints

`item_types` (base_kind approval — Wave A), `tasks.approval_status` (Wave A), `approval_decisions` (cycles, actor, decision, note), `proofs`, `proof_versions`, `proof_comments` (anchors, threads, resolve state), `proof_participants` (role reviewer/approver, policy), `external_review_links`, `attachments` (underlying files + preview artifacts), `stories` (decision/annotation events), `notifications`, `audit_logs` (link issuance/revocation). Proof tables Wave B (P5); specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free: approval tasks (create/decide, all-of policy) — the subtype is core, not an upsell.
- Pro: proofs on image/PDF with pinned annotations, versions with approval reset, side-by-side compare, reviewer/approver roles.
- Business: **external reviewers/approvers via email link** (free, unlimited), watermarking, client-portal proofing toggles (PRD 11), reminder policies.
- Enterprise: retention/legal-hold on proofs, access codes enforced, audit UI coverage.
- External reviewers are never billable and never consume seats (pledge #5), wherever the feature exists.

## Out of scope / later

- Video proofing (frame-accurate comments) and Office-document markup — later versions of the feature (Wrike parity); the data model (version + anchor) is designed to accept a time anchor.
- Comparison diff overlays (pixel diff/onion skin) — post-P5 polish; v1 compare is side-by-side.
- Multi-step approval chains (sequential stages with different approver sets) — single-stage policy in v1; chains post-P6.
- Proof templates / review checklists — later.
- Digital signatures / legally binding e-sign — not planned; Raqeeb approvals are workflow sign-off, not contracts.
- Auto-conversion of annotations into subtasks — candidate automation recipe post-P5.
