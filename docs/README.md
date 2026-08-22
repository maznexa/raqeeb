# Raqeeb Product Blueprint

*The executable documentation set for building Raqeeb — read in order for the full picture, or
jump by role below.*

## Reading order

| # | Section | What it answers |
|---|---------|-----------------|
| 00 | [Vision](./00-vision/01-vision.md) · [Positioning](./00-vision/02-positioning.md) | Why Raqeeb exists, for whom, and the anti-pattern pledge |
| 01 | [Competitive analysis](./01-competitive-analysis/) — ClickUp, Asana, monday, Wrike, Forecast, Teamwork · [**Feature matrix**](./01-competitive-analysis/07-feature-matrix.md) · [Anti-patterns](./01-competitive-analysis/08-anti-patterns.md) | What each competitor does best, what Raqeeb adopts (v1/v2/v3), what it will never build |
| 02 | [PRD](./02-prd/00-module-map.md) — 14 module specs | Functional requirements, user stories, tier gating per module |
| 03 | [Domain model](./03-domain-model/01-erd.md) · [Decisions D1–D10](./03-domain-model/02-decisions.md) · [Schema reference](./03-domain-model/03-schema-reference.md) · [Status groups](./03-domain-model/04-canonical-status-groups.md) | The unified data model reconciling all six products |
| 04 | [Architecture](./04-architecture/01-overview.md) — tenancy/RLS, data access, realtime, jobs, i18n/RTL, security, observability | How the system is built and why |
| 05 | [API design](./05-api-design/01-conventions.md) — conventions, resources, auth, webhooks, versioning & rate limits | The public API contract |
| 06 | [SaaS commercial](./06-saas-commercial/01-plans-packaging.md) — plans, entitlements, Stripe billing, tenant lifecycle | How Raqeeb is sold and metered |
| 07 | [Roadmap](./07-roadmap/01-roadmap.md) · [Scaffold scope](./07-roadmap/02-scaffold-scope.md) | Phase 0–7 sequencing and the definition of runnable |

## By role

- **Engineer starting on the codebase** → 03 (domain model) → 04 (architecture) → root README.
- **Product/design** → 00 → 01 (feature matrix first) → 02 (PRDs).
- **API consumer / integrations** → 05.
- **Commercial/founder** → 00 → 06 → 07.

## Glossary

| Term | Meaning |
|------|---------|
| **Tenant** | The customer organization (= billing boundary = workspace; D1/D9) |
| **Space** | Top-level container inside a tenant; permission & feature boundary |
| **Project** | Terminal task container (≡ ClickUp List, Teamwork Task List, monday Board) |
| **Multi-homing** | One canonical task living in N projects via `task_locations` (D2) |
| **Canonical status group** | `not_started / active / done / cancelled` — every custom status maps to one (D3) |
| **Item type** | Task/Milestone/Approval system kinds; user-defined types (Wrike CIT) in v2 (D5) |
| **Allocation** | Capacity reservation (person or role placeholder), distinct from assignment (D7) |
| **Entitlement** | Plan-derived feature gate (boolean/limit/metered), enforced server-side |
| **رقيب (Raqeeb)** | Arabic: "watcher/overseer" — the product name |
