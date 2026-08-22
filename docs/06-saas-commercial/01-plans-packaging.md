# Plans & Packaging

> **Status:** Accepted. Packaging encodes the anti-pattern pledge from the competitive
> research: **custom statuses, multiple assignees, and time tracking on every tier; no
> seat minimums; clients and guests never consume paid seats; quotas degrade gracefully,
> never mass-pause.** The agency core (retainers, profitability, resource planning) ships
> at **Business** — not hidden behind Enterprise (the Teamwork "Scale-gating" mistake).

## Tier lineup

| | **Free** | **Pro** | **Business** | **Enterprise** |
| --- | --- | --- | --- | --- |
| Target | trying it out, tiny teams | teams running real work | agencies & serious ops | large orgs, compliance |
| Pricing | $0 | per seat, monthly/annual | per seat, monthly/annual | custom annual |
| Seat minimum | **none** | **none** | **none** | **none** |
| Billing | — | monthly + annual (discount) | monthly + annual (discount) | invoice |
| Trial | — | — | **14-day Business trial, no card** (default signup path) | pilot via sales |

Anti-patterns explicitly rejected: monday/Wrike seat minimums and 5-seat increments;
add-on SKU sprawl (no "Integrate/Lock/Analyze" style add-ons — capabilities live in
tiers); dashboards-capped-by-plan cliffs.

## Feature matrix by tier

**Every tier** (the pledge — these are never gates):

- Unlimited tasks & projects, full hierarchy (Spaces → Folders → Projects → Sections)
- **Custom statuses & workflows** (anti-Asana)
- **Multiple assignees** (anti-Asana)
- **Time tracking** — timer + manual entries (anti-Asana/ClickUp tier-gating; from P3)
- Multi-homing (task in N projects), subtasks, dependencies
- English + Arabic RTL, REST API + PATs, standard views (List; Board/Table/Calendar as
  they ship in P2)

| Capability | Free | Pro | Business | Enterprise |
| --- | --- | --- | --- | --- |
| Members (billable seats) | up to 5 | unlimited | unlimited | unlimited |
| **Guests & client users** | 3 | unlimited — **always free** | unlimited — **always free** | unlimited — **always free** |
| Custom fields (P2) | 3 per project | full library | full library | full library + governance |
| Saved views (P2) | 5 | unlimited | unlimited | unlimited |
| **Automations (P5)** | — | ✔ recipes | ✔ + cross-project recipes | ✔ + governance bundles |
| **Forms / intake (P5)** | — | ✔ | ✔ + conditional logic → blueprints | ✔ |
| Webhooks + API rate tier | 60/min, 2 hooks | 300/min, 25 hooks | 1,000/min, 100 hooks | custom |
| **Time tracking** (P3) | ✔ | ✔ | ✔ + approvals & locking | ✔ |
| **Financials: budgets, rate cards, profitability, EAC (P3)** | — | — | **✔** | ✔ |
| **Retainers w/ rollover & overage (P3)** | — | — | **✔** | ✔ |
| **Resource planning: allocations, placeholders, work schedules, capacity heatmap (P4)** | — | — | **✔** | ✔ |
| **Client portal + per-project permission matrix (P5)** | — | — | **✔** | ✔ |
| Proofing & approvals (P5) | — | ✔ basic approvals | ✔ + external email reviewers | ✔ |
| Portfolios, goals, dashboards (P6) | — | ✔ limited widgets | ✔ full | ✔ full |
| Gantt + baselines (P4) | — | ✔ | ✔ | ✔ |
| **SAML SSO / SCIM (P7)** | — | — | — | **✔** |
| **Audit log UI** (P7; logging itself always on) | — | — | 90-day view | **full + export** |
| **CMEK/BYOK, isolation options (schema/dedicated DB)** (P7) | — | — | — | **✔** |
| Support | community | standard | priority | SLA + CSM |

Rationale for the two big lines:
- **Financials + resource planning at Business** — this *is* the agency product; gating
  it at Enterprise (Teamwork's Scale mistake) pushes the exact customers Raqeeb targets
  to competitors. Business is priced to carry it.
- **Enterprise = trust & control, not capability** — SSO/SCIM, audit UI, CMEK, isolation.
  Enterprise buyers pay for governance; feature-hostage Enterprise tiers poison
  mid-market goodwill.

## Usage limits per tier (metered/limit entitlements)

| Limit | Free | Pro | Business | Enterprise |
| --- | --- | --- | --- | --- |
| Automation runs / month (P5) | — | 2,500 | 25,000 | custom |
| Storage | 1 GB | 50 GB | 250 GB | custom |
| Guests/clients | 3 | unlimited | unlimited | unlimited |
| API rate | 60/min | 300/min | 1,000/min | custom |
| Webhook subscriptions | 2 | 25 | 100 | custom |
| File size / upload | 25 MB | 250 MB | 1 GB | custom |

### Graceful-degradation policy (risk 7 — no cliffs)

What happens at a limit is part of the packaging contract, enforced by the entitlement
service's `consume() → ok | degraded` API (see `02-entitlements.md`):

| Limit hit | Behavior — never a hard stop on existing work |
| --- | --- |
| Automation runs | Runs continue **degraded**: dropped to a best-effort low-priority band with a visible "over quota" banner + upgrade prompt. Rules are **never mass-paused or disabled** (the monday-250/mo and Wrike-disable-at-zero anti-patterns). Sustained 2× overage for 2 consecutive months → sales conversation, not a kill switch. |
| Storage | New uploads blocked with a clear error + upgrade path; existing files always downloadable. Data is never held hostage. |
| Guests (Free) | Adding a 4th guest prompts upgrade; existing guests unaffected. |
| API rate | Standard 429 + `Retry-After` — transient by design, self-heals. |
| Seats (Free) | Inviting a 6th member prompts upgrade; nothing existing breaks. |
| Webhook count | Creation blocked with upsell; existing subscriptions keep delivering. |

Principles: (1) a limit stops *new growth*, never *existing function*; (2) every
degradation is visible to admins with a one-click upgrade path; (3) read access and data
export are never gated by any limit or billing state (see billing doc — `past_due` is
read-only, not lock-out).

## Plan data model

Tiers are rows in the `plans` table (`features` boolean JSONB + `limits` JSONB — schema
reference). Packaging changes are data migrations reviewed like code; per-tenant
overrides (negotiated Enterprise terms, grandfathering) are entitlement overrides, not
plan forks (`02-entitlements.md`).
