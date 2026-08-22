# PRD 05 — Collaboration

*Comments, mentions, reactions, an event-sourced Stories activity stream, followers, attachments, and an Inbox engineered against notification noise — the loudest complaint about every competitor.*

## Overview

Collaboration is what keeps work conversations attached to the work. Raqeeb models all activity as **Stories** (Asana's proven pattern): an append-only, event-sourced stream per object where user entries (comments) and system entries (status changed, assignee added, field edited, homed into project) interleave into one auditable narrative.

Two competitor lessons shape this module. First, **no 5-minute comment-edit window** — Wrike's arbitrary cutoff is an anti-pattern; comments are editable indefinitely with a visible "edited" marker and revision history. Second, **anti-noise is a default, not a setting**: every competitor's users drown in notifications, so Raqeeb ships with an Important/Other Inbox split, bundling, digests, snooze, and conservative auto-follow rules out of the box.

Attachments ride S3-compatible object storage with presigned uploads. Phase: **P2** (comments/mentions/Stories/attachments/notifications land together with realtime broadcasts).

## User stories

1. As a **member**, I can comment on a task with rich text, @mentions, emoji, and file attachments so that context lives on the work item, not in chat.
2. As a **member**, I can edit or delete my comment at any time — with an "edited" indicator and viewable history — so that fixing a typo an hour later is not forbidden.
3. As a **member**, when I'm @mentioned I get an Important-inbox notification and become a follower of that task so that I never miss a direct call-out.
4. As a **member**, I can react to a comment (emoji) so that acknowledgment doesn't require a "+1" comment.
5. As a **member**, I can read a task's full activity: who changed status, who edited which field (old → new), when it was homed into another project — so that "what happened here?" has an answer.
6. As a **member**, I can follow/unfollow any task, and unfollow silences it everywhere except direct @mentions, so that I control my noise floor.
7. As a **member**, my Inbox separates Important (mentions, assignments, approvals requested of me) from Other (follower updates, status changes), bundles rapid-fire events on one task into one entry, and lets me snooze any item to a chosen time.
8. As a **member**, I can attach files by drag-drop or picker; images preview inline; every version of a re-uploaded file is retained.
9. As an **admin**, I can set tenant-default notification and auto-follow policies so that new members start quiet-by-default rather than opted into everything.
10. As a **client user**, I only ever see comments marked client-visible in shared projects (PRD 11), so that internal discussion stays internal.

## Functional requirements

### Comments & mentions
- **FR-1** Comments: rich text (bold/italic/lists/links/code), @mentions (members; guests/clients only where they have access), emoji, attachments, task links (`RAQ-123` auto-resolves). Stored as a Story entry of kind `comment`.
- **FR-2** Editing: unlimited window (pledge #9); edits store revisions (`comment_revisions`), UI shows "edited" with history viewable by anyone who can see the comment. Deletion is soft (tombstone "comment deleted", content purged, attachments detached), audit-logged.
- **FR-3** Threading: one level of replies per top-level comment (v1); reply notifications target the thread participants, not all followers.
- **FR-4** @mention of a user without access to the task triggers an access-grant prompt for users who can share, never a silent broken mention.
- **FR-5** Comment visibility flag `internal_only` (default true on client-shared projects) controls client-portal exposure (PRD 11 FR semantics).

### Stories (activity stream)
- **FR-6** `stories` is append-only: (tenant, object type/id, actor — user/automation/system/api-token, kind, payload JSONB with old/new values, created_at). System kinds: created, status_changed, assignee_added/removed, field_changed, dates_changed, location_added/removed/primary_changed, dependency_added/removed, attachment_added, approval_changed, time_logged, automation_acted.
- **FR-7** All writers (API handlers, automation engine, recurrence, imports) emit Stories via the same service; there is no side channel that mutates tasks without a story.
- **FR-8** Task view renders the stream with filters (comments only / all activity); field-change entries render old → new. Stories are the source for time-in-status analytics and the BI export's change history (P6).
- **FR-9** Stories are immutable; redaction (legal/GDPR) replaces payload with a redaction marker via an audited admin action.

### Followers & notification fan-out
- **FR-10** `task_followers`: explicit follow/unfollow, plus auto-follow on: created it, assigned to it, @mentioned, commented. Tenant policy can trim this list (e.g. drop "commented"); defaults are the conservative set above — never "everyone in the project".
- **FR-11** Event fan-out: every relevant story generates notification candidates for followers minus the actor; per-user preference and channel resolution decides delivery (in-app always; email per preference; push reserved for mobile later).
- **FR-12** Classification: **Important** = direct @mention, new assignment, approval requested, date-critical (due today/overdue on tasks you're assigned), access granted. **Other** = everything else you follow. Users may promote/demote categories per-source.

### Inbox
- **FR-13** Inbox = persistent notification center with Important/Other tabs, unread counts, mark-read/all, archive. Items deep-link to the object with the triggering story highlighted.
- **FR-14** Bundling: events on the same task within a rolling window collapse into one inbox item ("Sara and 2 others: 3 updates on RAQ-214"); email digests aggregate Other-tier events (per-user cadence: real-time / hourly / daily, default daily).
- **FR-15** Snooze: any inbox item can be snoozed to +1h / tonight / tomorrow / custom; it returns unread at the chosen time.
- **FR-16** Do-not-disturb schedule per user (respects user timezone); emails queue until the window opens. Defaults on for 20:00–07:00 for new users.

### Attachments
- **FR-17** Upload via S3 presigned URLs (client → storage direct); server records `attachments` (object key, name, size, mime, sha256, uploader, parent object) after upload confirmation callback. Max size per plan; storage metered per tenant.
- **FR-18** Attachments attach to tasks and comments; image/PDF inline preview; re-upload with same name creates a new version chained to the original (full version list; proofing versions build on this in PRD 13).
- **FR-19** Virus scanning hook (async; quarantine on hit) and download via short-lived presigned GETs only — no public URLs. Deleting an attachment soft-deletes with trash-window restore.

## Data model touchpoints

`stories` (the spine — Wave B, P2), `comment_revisions`, `reactions` (story_id, user, emoji, UNIQUE triple), `task_followers`, `notifications` (recipient, story ref, tier, read/archived/snoozed_until), `notification_preferences` (per user per category/channel), `attachments` (+ version chain), `outbox_events` (realtime fan-out), `audit_logs` (redactions, deletions). Reads join `tasks`, `task_assignees`, `memberships`. Client visibility interacts with `project_permissions` (PRD 11).

## Plan-tier gating

- Free: comments, mentions, reactions, followers, full activity stream, Inbox with Important/Other, attachments within a small storage quota (e.g. 2 GB/tenant).
- Pro: email digests configuration, snooze, larger storage, attachment version history.
- Business: comment `internal_only` client controls (with portal), storage tiers up, Stories-based BI export (P6).
- Enterprise: retention policies, legal hold, redaction workflows, largest storage.
- Anti-noise defaults, unlimited comment editing, and the Stories model itself are identical on every tier.

## Out of scope / later

- Real-time collaborative documents (Yjs/CRDT workdocs) — post-v1 (plan defers CRDT; v1 realtime is entity-change broadcasts).
- Chat / channels (ClickUp Chat parity) — not planned; Raqeeb integrates with Slack instead (integration post-P6).
- Video/audio clip recording in comments — later nice-to-have.
- Per-comment granular permissions beyond `internal_only` — not planned.
- Email-reply-to-comment (inbound email threading) — with intake email-in, later than P5.
- Public guest commenting without account — only via proofing's external reviewer links (PRD 13), not on ordinary tasks.
