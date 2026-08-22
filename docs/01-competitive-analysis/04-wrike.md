# Competitive Analysis — Wrike

*The enterprise skeleton: cross-tagging, canonical status groups, custom item types, and
the category's best resource stack — sold through SKU sprawl and quota cliffs Raqeeb
refuses to copy.*

## Data model & hierarchy

```
Account → Space → Folder/Project tree (infinite nesting; folder ≈ project) → Task → Subtask
```

- **Folder ≈ project.** A project is a folder with extra fields (dates, status, owner);
  the tree nests infinitely. Raqeeb keeps Folder and Project as distinct types (D1) with
  folder nesting capped at depth ≤ 5 — infinite nesting is a scale cliff and a UX trap.
- **Cross-tagging is the signature primitive:** folders behave as *tags*. One canonical
  item lives in many locations via its `parents[]` array. This is multi-homing — the same
  primitive as Asana memberships and ClickUp multi-list, validated a third time.
  **Conclusion baked into Raqeeb D2: `task_locations` must be core, not a bolt-on.**
- **Workflows:** unlimited *named* workflows, each with custom statuses, every status
  mapped to exactly **4 canonical groups: Active / Completed / Deferred / Cancelled**.
  This is the design that keeps cross-project reporting sane while allowing infinite
  status creativity. Merged with ClickUp's grouping, it becomes Raqeeb D3:
  `not_started / active / done / cancelled`.
- **Custom Item Types (CIT):** user-defined schemas — own icon, own fields, own item-view
  layout, **type-scoped automations**, blueprints, and request-form bindings. Raqeeb D5:
  the `item_types` table ships in the scaffold (base_kind ∈ task/milestone/approval);
  full CIT features (layouts, type-scoped fields/automations) land in v2.
- **Dependencies:** FS/SS/FF/SF + lag, cross-project, with Gantt auto-reschedule and
  snapshots/baselines. Raqeeb adopts all four types + lag in the v1 model; cascade
  rescheduling with work calendars in P4.

## Standout features Raqeeb adopts (with mechanism)

The **resource stack is the model to copy** — it is the most complete in the category:

- **Effort independent of duration.** A 2-week task can carry 6h of effort, shaped as
  Basic / Daily / Flexible allocation curves. Feeds Raqeeb D7's core separation:
  effort ≠ duration ≠ assignment ≠ allocation.
- **Workload charts** in hours / % / FTE with real over-capacity semantics, grouping by
  job role, and a **Backlog Box** for unscheduled effort.
- **Work schedules:** per-user calendars, exceptions, capacity changes over time —
  Raqeeb's P4 work-schedule + holiday-calendar module.
- **Bookings:** tentative/confirmed effort reservations against a person **or a job-role
  placeholder, before tasks exist**. Together with Forecast's soft/hard allocations and
  Asana's Allocations API, this converges on Raqeeb's single `allocations` table
  (person XOR placeholder-role, project, date range, hrs/day, tentative|confirmed).
- **Timesheets** with submission rules, timelog locks, and timelog categories — folded
  into Raqeeb's P3 time module alongside Forecast's approval workflow.
- **The intake factory:** request forms with **conditional branching + conditional
  launch** that instantiate **blueprints — templated project trees with relative
  dates**. This form→blueprint pipeline is Raqeeb's P5 intake design, verbatim.
- **Proofing:** image / video (frame-accurate) / PDF / Office markup, **side-by-side
  version compare**, approval reset on new version, first-class approvals, and — the
  commercial masterstroke — **free unlicensed guest reviewers**. All adopted in P5.
- **Enterprise controls:** Wrike Lock (customer-managed keys/CMEK), audit log, access
  roles, selective sharing — the checklist for Raqeeb's P7 enterprise phase (audit log
  table ships in the v1 scaffold).

## Developer-platform lessons

- **Webhooks with event filtering + custom payload fields** — subscribers choose events
  and shape payloads; adopted in Raqeeb's webhook design.
- **Batch and async-job APIs** — long operations (tree copies, exports) return job
  handles; Raqeeb blueprints and exports follow this pattern.
- **BI export including field-change history** — change-level data for warehouses;
  Raqeeb's v3 export layer includes field history (the Stories/audit stream makes this
  cheap).
- **No in-product extension surface** — no apps framework, no marketplace. A strategic
  gap Raqeeb (like monday) eventually fills in P7.

## Weaknesses & anti-patterns to avoid

- **Automation quota hits 0 → every rule in the account is disabled.** The harshest
  quota cliff in the category. Raqeeb: `ok | degraded`, never mass-disable (pledge #3).
- **Seat minimums & 5-seat increments** (pledge #7).
- **Add-on SKU sprawl:** Integrate, Lock, Analyze sold as separate boxes on top of tiers.
  Raqeeb: capabilities live in tiers, not add-ons (pledge #4).
- **Dashboards capped by plan; analytics with 4–24h refresh lag.**
- **The 5-minute comment-edit window** — a permanent irritant with no user benefit.
  Raqeeb: comments are editable with an edit trail in the activity stream.
- **Notification overload; scale cliffs on big trees** — category-wide; answered by
  triage inbox and performance budgets.
- **High onboarding overhead** — the cost of enterprise depth without progressive
  disclosure; Raqeeb pairs Wrike's skeleton with monday's onboarding bar.

## Summary for Raqeeb

Wrike contributes more load-bearing architecture than any other competitor: canonical
status groups, cross-tagging as the second proof of multi-homing, CIT as the item-type
end-state, the resource stack, and the form→blueprint intake factory. Its commercial
model (SKUs, seat packs, quota cliffs) is the definitive list of what Raqeeb's pricing
pledge forbids.
