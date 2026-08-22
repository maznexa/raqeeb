# Billing — Stripe

> **Status:** Accepted (specified now; implemented in **P1**). The scaffold ships the
> schema hooks (`tenants.stripe_*`, `subscription_status`, `memberships.is_billable_seat`)
> so P1 is wiring, not migration.

## Seat semantics — the one rule

> **A billable seat is:** `SELECT count(*) FROM memberships
> WHERE tenant_id = $1 AND is_billable_seat AND status = 'active'`.

- `is_billable_seat` is constrained at the schema level: **`false` whenever
  `role IN ('guest','client')`** — clients and guests are *structurally* free (D9).
  Free client users are a headline positioning promise (the Teamwork lesson); making it
  a CHECK constraint means no billing bug can ever charge for them.
- Owners/admins/members default to billable; deactivating a membership frees the seat
  immediately.
- No seat minimums, no seat-pack increments (anti-monday/Wrike): quantity is the exact
  count.

## Subscription model

- **Stripe Billing, per-seat licensed subscriptions**: one subscription per tenant, one
  seat-priced item, `quantity = billable seat count`. Monthly and annual prices per plan
  (four products: Pro, Business, Enterprise-custom; Free has no subscription).
- **Checkout**: upgrade flows create a Stripe Checkout session (hosted — PCI stays
  Stripe's problem). **Customer Portal** handles card updates, invoice history, plan
  switches within allowed paths, and cancellation — we do not rebuild billing UI.
- **Trials: 14-day Business trial, no card required** — the default signup path
  provisions Free + a Business-entitlement trial (`tenants.trial_ends_at`). Trial expiry
  without subscription → tenant drops to Free entitlements gracefully (degradation rules
  in the plans doc — nothing is deleted, over-limit state stops *growing*, never
  functioning-then-vanishing).
- **Proration on seat changes:** adding a billable member updates subscription quantity
  immediately with Stripe's standard proration; removals apply at period end (credit
  balance), both via `proration_behavior: 'create_prorations'`. Seat changes are pushed
  by the Tenants module on membership transitions (invite accepted, role change
  crossing the billable line, deactivation) — and *verified* by reconciliation (below).

## Webhook handling

Endpoint: `POST /billing/stripe/webhook` (signature-verified with the endpoint secret;
raw-body route).

**Idempotency via event-id dedupe table.** First step of every delivery:
`INSERT INTO stripe_webhook_events (event_id) ...` — unique-violation ⇒ already
processed ⇒ ack 200 and exit. Stripe retries and out-of-order delivery are normal;
every handler is also written to be state-convergent (set fields to the event's values,
never increment).

| Stripe event | Effect on tenant |
| --- | --- |
| `checkout.session.completed` | link `stripe_customer_id`/`stripe_subscription_id`, set plan |
| `customer.subscription.created/updated` | sync `plan_id` (from price), `subscription_status` (`active`, `trialing`, `past_due`, `canceled`), period dates, quantity mismatch → flag for reconciliation |
| `customer.subscription.deleted` | `subscription_status = 'canceled'` → Free entitlements at period end |
| `invoice.paid` | clear dunning state |
| `invoice.payment_failed` | dunning state advances (below) |

All handlers run in the worker (queue `reconciliation` family) — the webhook route only
verifies, dedupes, enqueues, and acks fast.

`tenants.subscription_status` is the **single field the request pipeline reads** (step 4
of the request lifecycle) — billing complexity collapses to one enum at the gate.

## Dunning — past_due is read-only, never hostage

When payments fail, Stripe Smart Retries + our messaging run for ~14 days
(`past_due`). Policy:

| State | Product behavior |
| --- | --- |
| `active` / `trialing` | normal |
| `past_due` | **Read-only mode**: all data readable, all views work, **export always available**; writes return `403` problem "Workspace is read-only" (billing + auth routes exempt) with a fix-payment link; admins see the dunning banner with a one-click Customer Portal link. Realtime and notifications continue (read-side). |
| `canceled` (post-dunning or voluntary) | drops to Free entitlements; if over Free limits, degradation rules apply (nothing deleted). Data export remains available indefinitely while the tenant exists. |
| `suspended` (abuse/legal only — never billing) | access blocked, data retained per lifecycle doc |

**Data is never hostage:** read + export survive every billing state. This is both the
ethical position and the cheapest churn-recovery tool we own — a customer who can leave
easily is a customer who can come back.

## Daily reconciliation job

Webhooks get missed; race conditions happen; support edits things. A daily job
(reconciliation queue, system role) makes Stripe and Postgres converge:

1. For every tenant with a subscription: compute local billable seats (the one-rule
   query) and fetch the Stripe subscription.
2. **quantity ≠ local seats** → update Stripe quantity (with proration), log + metric
   (`billing.seat_drift` — a rising rate means an event push path is broken).
3. **status ≠ local `subscription_status`** → Stripe wins → sync local, emit event.
4. **plan/price ≠ local `plan_id`** → Stripe wins → sync + entitlement cache bust.
5. Orphans (subscription without tenant, tenant pointing at dead subscription) → alert,
   human review — never auto-delete.

Drift metrics trend to zero in a healthy system; the job is the safety net, not the
mechanism (risk 4).

## ADR summary

**Decision.** Stripe Billing with hosted Checkout + Customer Portal; per-seat licensed
quantity = active billable memberships; 14-day cardless Business trial; event-id-deduped
convergent webhook handlers; `past_due` = read-only + export; daily seat/status/plan
reconciliation.

**Rejected alternatives.**
- *Usage-based metered seats reported to Stripe*: licensed + quantity-update is simpler,
  supports proration natively, and matches "seats" mentally for buyers.
- *Card-required trials*: kills top-of-funnel for the SMB/agency segment; dunning tools
  make post-trial conversion safe enough.
- *In-house invoice/payment UI*: PCI scope + months of work to badly rebuild the
  Customer Portal.
- *Lock-out on `past_due`*: hostage-taking churns angry customers and poisons word of
  mouth; read-only-with-export is strictly better on every axis we care about.
- *Trusting webhooks alone (no reconciliation)*: risk 4 in the build plan; drift is a
  when, not an if.
