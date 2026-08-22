# PRD 01 — Identity & Tenancy

*One global account, N tenants: signup, verification, login, tenant provisioning, invitations, roles, and the seat semantics that keep clients and guests free.*

## Overview

Raqeeb separates **who you are** from **where you work** (decision D9). A person has exactly one global `account` (email-unique, not tenant-scoped, not under RLS) and any number of per-tenant `memberships`, each with its own role, display profile, and seat status. This is the Asana/ClickUp model and it is what makes agency life workable: a freelancer can be a member of their own tenant and a guest in three client tenants with one login.

Tenants are provisioned self-serve at signup or created later from the tenant switcher. Every tenant gets a URL slug (`app.raqeeb.com/{slug}`; subdomain routing and custom domains are later evolutions), seeded defaults (default space, default workflow, sample project), and a Free-plan subscription until upgraded. Authentication is email/password (argon2id) with JWT access/refresh tokens in v1; Google/Microsoft OAuth SSO lands in P2, SAML/SCIM in P7.

Phase: **Phase 0 scaffold** (all of this except social SSO and 2FA UI ships in the scaffold; Stripe-backed plan changes arrive in P1).

## User stories

1. As a **visitor**, I can sign up with email + password, receive a verification email, and land in a freshly provisioned tenant so that I can start working within two minutes.
2. As a **tenant owner**, I can name my organization and get a URL slug (editable once, warned) so that my team has a stable home address.
3. As an **admin**, I can invite people by email with a chosen role (admin/member/guest/client), and see pending/expired invitations, so that onboarding is self-serve.
4. As an **invited person who already has a Raqeeb account**, accepting an invitation adds a membership to my existing account — no second password — so that I keep one identity.
5. As a **member of multiple tenants**, I can switch tenants from a switcher menu that shows each tenant's name, my role there, and unread counts, so that cross-company work is one login.
6. As a **tenant owner**, I can see which memberships are billable seats and which are free (guests, clients) so that my invoice is predictable before I invite someone.
7. As an **admin**, I can deactivate a membership (not delete the account) so that a departing employee loses access instantly while their work history and attributions remain.
8. As a **user**, I can reset my password via a time-limited emailed link, and all my refresh tokens are revoked when I do, so that a compromised password has a bounded blast radius.
9. As a **tenant owner**, I can transfer ownership to another admin so that the org survives my departure.
10. As a **guest**, when I log in I see only the projects I was invited to — no tenant directory, no space browser — so that the inviting tenant's privacy holds.

## Functional requirements

### Accounts & authentication
- **FR-1** Signup creates an `accounts` row with `email` (globally UNIQUE, case-insensitive), argon2id `password_hash`, `email_verified_at NULL`, locale, timezone.
- **FR-2** A verification email (signed, 24 h expiry) must be confirmed before the account can create additional tenants or be discoverable for invitations; the initial signup tenant is usable immediately with an "unverified" banner.
- **FR-3** Login issues a short-lived JWT **access token** (≤ 15 min; claims: `account_id`, `tenant_id` of the active tenant, membership role) and a rotating **refresh token** (httpOnly cookie, 30 d, single-use rotation with reuse detection → revoke family).
- **FR-4** Tenant context: every API request resolves `tenant_id` from the JWT claim, verifies an active membership, then executes inside `withTenant()` (`SET LOCAL app.current_tenant_id`) so RLS applies. Requests with a valid account but no membership in the claimed tenant return 403.
- **FR-5** Password reset: emailed one-time token (1 h expiry); consuming it revokes all refresh tokens for the account.
- **FR-6** Rate limits on auth endpoints (per-IP and per-email) with progressive backoff; failed-login lockout after configurable attempts. All auth events write `audit_logs`.
- **FR-7 (P2)** Google and Microsoft OAuth sign-in/sign-up mapped to the same `accounts` row by verified email; an account may have both a password and linked SSO identities. **(P7)** SAML per tenant with `enforce_sso`, plus SCIM provisioning.
- **FR-8 (P2)** TOTP 2FA opt-in per account; recovery codes; admins can require 2FA tenant-wide (Business+).

### Tenant provisioning
- **FR-9** Signup flow provisions: `tenants` row (name, unique `slug`, plan = Free, trial state per commercial rules), owner `membership`, and seed defaults — one Space ("General"), the default workflow (Backlog / In Progress / In Review / Done / Cancelled with canonical groups per D3), system item types (task/milestone/approval per D5), and one sample project with onboarding tasks.
- **FR-10** Slug rules: 3–50 chars, `[a-z0-9-]`, uniqueness enforced, reserved words blocked (`admin`, `api`, `www`, …). Owner may change it once; old slug 301-redirects for 30 days.
- **FR-11** A verified account can create additional tenants from the switcher ("New organization"), each independently planned and billed.
- **FR-12** Tenant deletion (owner only): soft-delete with 14-day grace and export offer, then hard purge job. Subscription must be cancelled or is cancelled as part of the flow (P1).

### Invitations & memberships
- **FR-13** `invitations` carry tenant, email, proposed role, optional project grants (required for guest/client roles), inviter, signed token, 14-day expiry, states `pending/accepted/revoked/expired`. Re-inviting refreshes the token.
- **FR-14** Accepting an invitation: existing account → add membership; no account → combined signup+accept flow. Either way the account ends with a `memberships` row (role, per-tenant `display_name`/avatar override, `is_billable_seat`, `status ∈ active/deactivated`).
- **FR-15** Role capabilities (summary; full matrix in `docs/04-architecture/security`):
  - **owner** — everything incl. billing, ownership transfer, tenant deletion. Exactly one owner per tenant (v1).
  - **admin** — manage members/invitations, spaces, tenant libraries (workflows, fields, item types, rate cards), security settings; no billing/deletion.
  - **member** — full work participation subject to space/project access.
  - **guest** — access only to explicitly granted projects; cannot see tenant directory, libraries, or other spaces; cannot invite.
  - **client** — portal experience only (PRD 11); project access via the client permission matrix; internal financial data always hidden.
- **FR-16** `is_billable_seat` is derived from role: owner/admin/member → `true`; guest/client → `false`, **not overridable upward for clients** (pledge #5). Seat count = active billable memberships; P1 reconciles this count to Stripe daily and on every membership change.
- **FR-17** Deactivating a membership blocks login-into-tenant and API access immediately (access-token TTL bound), frees the seat, and preserves all authored data and attributions. Reactivation restores access.
- **FR-18** Ownership transfer: owner selects an admin, confirms with password; roles swap atomically and the event is audit-logged.

### Tenant switcher
- **FR-19** Authenticated shell lists all active memberships (tenant name, logo, role); switching re-issues the access token with the new tenant claim without re-login. Last-active tenant is remembered per account. Deep links to another tenant's resources trigger an in-context switch prompt.

## Data model touchpoints

| Table | Role in this module |
|---|---|
| `accounts` | Global identity: email (UNIQUE), password hash, verification, locale/timezone. **Not RLS-scoped.** |
| `tenants` | Org: name, slug, plan linkage, subscription status (P1: Stripe ids), settings. |
| `memberships` | account ↔ tenant: `role ∈ owner/admin/member/guest/client`, `is_billable_seat`, per-tenant profile, status. UNIQUE(tenant_id, account_id). |
| `invitations` | Pending invites: email, role, token, expiry, optional project grants. |
| `plans` | Global plan catalog + entitlements (read by the entitlement service). |
| `personal_access_tokens` | API tokens bound to a membership (account + tenant scope). |
| `audit_logs` | Auth and membership lifecycle events. |

## Plan-tier gating

- Free: up to a member limit (e.g. 5 billable seats — final number in `docs/06-saas-commercial/plans-packaging`); unlimited guests is **not** Free (guests from Pro).
- Pro: unlimited billable seats (paid), guests included.
- Business: client users + client portal matrix; 2FA enforcement; priority in per-tenant rate limits.
- Enterprise: SAML SSO with `enforce_sso`, SCIM, audit log UI, session policies (max age, IP allowlists).
- **Every tier:** one account / N tenants, tenant switcher, email/password + (P2) Google/Microsoft SSO. Clients and guests are free on any tier that includes them.

## Out of scope / later

- SAML SSO, SCIM, enforced IdP sessions — P7.
- Custom domains (CNAME) and subdomain-per-tenant routing — post-P7 evolution; v1 is path-based slugs.
- Multiple owners / role granularity beyond the five roles (custom roles) — Enterprise roadmap, not v1.
- Account merging (two accounts, same human) — manual support process for now.
- Organization-of-tenants (holding-company grouping) — not planned for v1–v3.
