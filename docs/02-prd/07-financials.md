# PRD 07 — Financials

*Clients as first-class citizens, four convertible budget types, a deterministic rate-resolution hierarchy, time-versioned cost rates, retainers with rollover, live profitability and EAC — shipping at Business tier, not Enterprise.*

## Overview

This module is Raqeeb's agency spine (decision D8), synthesizing Forecast's financial engine with Teamwork's client/budget pragmatism while fixing both products' rigidity: **budget types are convertible** (Forecast hard-codes retainer immutability — we record a conversion event instead), **locked periods always have an audited exit**, and **cost visibility is permission-gated with an inference warning** (Teamwork's design lesson: showing "profit" to someone who knows revenue lets them infer colleagues' cost rates).

Everything downstream computes from two immutable inputs: `time_entries` with snapshotted bill/cost rates (PRD 06) and recorded expenses. Rates resolve through a strict hierarchy; person costs are **time-versioned rows, never a mutable column**. The headline pledge: **the agency core — retainers, budgets, profitability — ships at Business tier, NOT Enterprise** (pledge #4, rejecting Teamwork's Scale-gating).

Phase: **P3** (clients table ships in the Phase 0 scaffold; invoicing + Xero/QBO sync is v2, P6).

## User stories

1. As an **admin**, I can manage Clients (company, currency, contacts, default rate behavior) and link projects to them, so that every report can pivot by client.
2. As a **project lead**, I can give a project a budget of type T&M, fixed fee, retainer, or non-billable — with hours and/or money targets — and later convert the type with a recorded conversion event, so that a discovery T&M engagement can become a retainer without delete-and-recreate.
3. As a **finance admin**, I can maintain a tenant rate card (per role, date-effective entries) plus client-specific role rates and per-project overrides, and know exactly which rate wins, so that quoting and billing are deterministic.
4. As a **finance admin**, I can record a person's cost rate changes as dated periods so that January margins are still computed with January costs after a raise in March.
5. As an **agency owner**, I can set up a monthly retainer (hours or fee target) with rollover of surplus/deficit and an out-of-scope overage rate, and lock finished periods, so that recurring clients are billed correctly with zero spreadsheet glue.
6. As a **project lead with financial permission**, I can open a project's profitability panel — revenue, cost, profit, margin %, budget burn — computed live from snapshots, so that I catch overruns while they're fixable.
7. As a **finance admin**, I can see EAC (estimate at completion) per project and per task so that "will we land inside budget?" has a number, not a feeling.
8. As an **admin**, I can grant or deny cost-rate visibility per person, and the system warns me when a permission combination would let someone infer cost rates from derived numbers.
9. As a **finance admin (P6)**, I can generate an invoice from unbilled time and expenses (or fixed-price lines), and invoiced entries lock automatically, so that billing never double-counts.
10. As an **agency owner**, I can see profitability across all projects for one client so that renewal conversations are grounded in data.

## Functional requirements

### Clients
- **FR-1** `clients`: name, code, currency, default client role rates link, contacts, notes, archive flag. Projects reference `client_id`; multi-homing attribution uses the **primary** location's project → client (D2/D8). Client rollups (all projects, retainers, unbilled) are Business-tier reports.

### Budgets
- **FR-2** `project_budgets`: type ∈ `time_and_materials / fixed_fee / retainer / non_billable`; targets: hours and/or amount (fixed fee stores fee amount; T&M optional cap); currency; threshold notification levels (e.g. 80/100%); optional task-list/section sub-budgets (later). One active budget per project; history retained.
- **FR-3** Budget burn computes from approved + submitted entries (toggle: include drafts) and expenses; threshold crossings emit notifications and automation triggers (PRD 09).
- **FR-4** **Conversion:** changing budget type writes a `budget_conversion_events` row (from-type, to-type, actor, timestamp, carried values, note). Historical reporting before the conversion date renders under the old type's semantics; no data is deleted. Anti-Forecast requirement: conversion is always possible for finance admins, including retainer → T&M and back.
- **FR-5** Expenses: per project (date, category, amount, billable flag, markup %, receipt attachment); billable expenses join unbilled-items for invoicing; all expenses join cost for profitability.

### Rates
- **FR-6** Resolution hierarchy for a billable entry (person P, role R, project Pr, client C, date D) — first match wins:
  1. **Project override** — `project_rate_overrides` (per person or per role on Pr),
  2. **Client role rate** — `client_rates` (C × R, date-effective),
  3. **Tenant rate card** — `rate_card_entries` (R, date-effective),
  4. **User default** — person's default bill rate.
  Resolution is evaluated at entry creation for snapshots (PRD 06 FR-5) and re-run only on explicit re-attribution. An admin "explain rate" endpoint shows the winning rule for any (person, project, date).
- **FR-7** `rate_cards` + `rate_card_entries`: per-role rates with `effective_from`/`effective_to`; overlapping periods for the same role rejected; future-dated entries allowed. Client rates and project overrides follow the same date-effective shape.
- **FR-8** `person_cost_periods`: per-person cost rate rows (effective_from/to, rate, currency) — **never a mutable column on the user**. Gaps resolve to the nearest earlier period; no period at all ⇒ cost 0 with a data-quality warning in financial reports.

### Retainers
- **FR-9** `retainers`: client, linked project(s), frequency (monthly/quarterly/custom), target in **hours or money**, overage rate ("out-of-scope" rate), rollover policy (none / surplus / deficit / both, optional cap), start/end.
- **FR-10** `retainer_periods`: generated per cycle with `target`, `rollover_in`, consumed (from billable entries + expenses attributed to the retainer), `rollover_out`, overage quantity and value (overage priced at the out-of-scope rate per the Teamwork engine), state ∈ `open / closed / locked`. Closing a period computes rollover_out → next period's rollover_in; locking freezes contained entries (composes with PRD 06 locks) and is reversible via audited unlock.
- **FR-11** Retainer dashboard: current-period burn vs target, projected end-of-period position (run-rate), rollover ledger across periods, overage alerts at configurable thresholds.

### Profitability & EAC
- **FR-12** Profitability panel (project, client, and portfolio rollups): **Revenue** = Σ(billable minutes × bill_rate_snapshot)/60 + billable expenses (with markup); **Cost** = Σ(all minutes × cost_rate_snapshot)/60 + all expenses; **Profit = Revenue − Cost**; **Margin % = Profit / Revenue**. Fixed-fee revenue recognition: recognized = fee × completion % (hours-based default; manual override), documented per project.
- **FR-13** EAC block (Forecast engine): `AC` = actual cost to date; `EV` (recognized value) per FR-12; `RemainingHours = max(0, estimate − logged)` per task; **`EAC = AC + Σ(remaining_hours × current cost rate)`** (person rate when assigned; role/blended rate for unassigned); `Variance = Budget − EAC`; margin-at-completion %. Surfaced per task and rolled up per project/client.
- **FR-14** All financial figures carry currency; cross-currency rollups convert at a tenant-configured rate table with the conversion date shown (no silent mixing).

### Cost visibility & permission gating
- **FR-15** Distinct permissions: `view_billable_rates`, `view_cost_rates`, `view_profitability`, `manage_budgets`, `manage_rates`. Cost-bearing fields are stripped server-side (not hidden client-side) for callers without the permission — including on time entries, exports, and the public API.
- **FR-16** **Inference warning:** granting `view_profitability` without `view_cost_rates` triggers an explicit admin warning that profit + known revenue lets the grantee infer aggregate cost rates; the admin must acknowledge. Client users (PRD 11) can never receive any of these permissions.

### Invoicing (v2 — P6)
- **FR-17** Invoice builder: from unbilled approved time (grouped by task/person/date) and unbilled expenses, or fixed-price lines, or retainer-period lines; drafts editable; numbering per tenant sequence; tax lines; PDF render; client currency.
- **FR-18** Issuing an invoice stamps `invoiced_at` on included entries/expenses (immutable thereafter; credit-note flow reverses). States: `draft → approved → sent → paid/void`.
- **FR-19** Xero/QuickBooks Online sync: push invoices + payments status pull; idempotent by external id; sync log with per-line errors.

## Data model touchpoints

`clients`, `project_budgets`, `budget_conversion_events`, `expenses`, `rate_cards`, `rate_card_entries`, `client_rates`, `project_rate_overrides`, `person_cost_periods`, `retainers`, `retainer_periods`, `invoices`, `invoice_lines` (P6), reading `time_entries` (+ snapshots) and `tasks.estimate_minutes`; `stories`/`audit_logs` for conversions, locks, permission changes. `clients` is Wave A; the rest Wave B (P3/P6), specified in `docs/03-domain-model/03-schema-reference.md`.

## Plan-tier gating

- Free / Pro: billable flag on time entries exists (PRD 06); no budgets, rates, or financial reports. Pro adds simple project hour targets (non-financial burn bar).
- **Business (pledge #4):** the full agency core — clients reports, all four budget types + conversion, rate cards/hierarchy, person cost periods, retainers + periods + rollover, profitability panel, EAC, expenses. Invoicing + Xero/QBO at Business when P6 lands.
- Enterprise: everything above plus revenue-recognition policies, cross-currency rate tables governance, audit UI. **Nothing agency-core is Enterprise-only.**

## Out of scope / later

- Baseline/quote module (Forecast pre-sale baselines, win probability, placeholder generation from quote) — post-P6; allocations cover placeholder demand (PRD 08).
- Purchase orders, vendor bills, payroll export — not planned v1–v3.
- e-conomic and other regional accounting syncs — after Xero/QBO.
- Task-list sub-budgets and budget change-history UI — fast-follow after P3.
- Multi-entity consolidated finance (one tenant, several legal entities) — Enterprise roadmap, post-P7.
