# API Authentication — PATs now, OAuth2 next, Service Accounts later

> **Status:** Accepted. Credential strategy is staged deliberately: PATs ship in the v1
> scaffold (the "same API via curl" runnable criterion depends on them); OAuth2 with
> granular scopes is the v2 developer platform (P7); service accounts are an enterprise
> follow-on. The ClickUp lesson — scopeless, non-expiring tokens as the *only* option for
> years — is the trap this staging avoids.

## v1 — Personal Access Tokens

### Format & lifecycle

- Token string: **`raq_pat_`** + 43+ chars of URL-safe randomness (256-bit). The stable
  prefix makes tokens greppable by secret scanners (GitHub secret scanning pattern will
  be registered) and self-identifying in support tickets.
- Created via UI or `POST /personal-access-tokens`; the full token is returned **exactly
  once**. Optional `expires_at`; revocation is immediate
  (`DELETE /personal-access-tokens/{id}`).
- **Hashed at rest:** SHA-256 of the full token; `token_prefix` (first 8 chars after the
  scheme) stored for display ("raq_pat_a1b2c3d4…"). High-entropy random tokens need
  collision-resistant hashing for lookup, not a slow KDF.
- **Last-used tracking:** `last_used_at` updated on authentication, write-coalesced to at
  most once per minute per token; surfaced in the UI so users can find and kill stale
  tokens. Unused-for-90-days tokens trigger a notification nudge.

### Semantics

- A PAT belongs to a **membership**, not an account: it is tenant-scoped by construction
  and dies with the membership (deactivation revokes its PATs). One PAT can never touch
  two tenants — the `X-Raqeeb-Tenant` header must match the PAT's tenant or the request
  gets `404`.
- A PAT acts **as the user**: same role, same permission checks, same rate-limit
  per-token bucket under the tenant cap, same audit trail (`actor_type = 'pat'`, with
  token id recorded).
- v1 PATs are full-access-as-user (no scopes). The schema carries a `scopes` concept
  forward-compatibly: when OAuth scopes land, PATs gain optional scope narrowing using
  the **same scope vocabulary** — no second permission language.
- Usage: `Authorization: Bearer raq_pat_...`.

## v2 (P7) — OAuth 2.0 for third-party apps

The Asana model, adopted deliberately as best-in-class:

- **Authorization-code grant with PKCE** (PKCE mandatory for public clients,
  recommended for all). No implicit grant, no password grant, no device flow at launch.
- **Refresh tokens** with rotation (same family/reuse-detection machinery as first-party
  sessions); access tokens short-lived (≤ 1 h).
- **Granular scopes, `resource:action` grammar:**
  `tasks:read`, `tasks:write`, `projects:read`, `projects:write`, `members:read`,
  `webhooks:manage`, `time-entries:write`, … — the resource segment matches the API
  resource map 1:1, so the scope list is generated from the OpenAPI spec and can never
  drift from reality. Coarse rollups (`read-only`) are macros over the granular set.
- Effective permission = **intersection** of the app's granted scopes and the
  authorizing user's own permissions — an app can never out-privilege its user.
- Consent screen lists scopes in plain language (en/ar); grants are per-tenant and
  auditable/revocable by tenant admins (`oauth_grants`), not only by the end user.
- App registry (`oauth_apps`): redirect URIs (exact match), client secret hashed,
  optional IP allowlist, per-app rate-limit identity.

## Later — service accounts (enterprise)

- Non-human principals owned by the **tenant** (not by an employee who might leave):
  created by admins, hold their own memberships with role + scopes, authenticate via
  OAuth2 client-credentials grant.
- Use cases: ERP sync, data warehouse export, SCIM-adjacent provisioning bots.
- Distinct `actor_type = 'service_account'` in audit logs; sessions/PATs of departed
  employees stop being the load-bearing integration credential (the failure mode every
  enterprise buyer asks about).
- Ships alongside SAML/SCIM in P7; until then, the documented workaround is a dedicated
  "integration user" membership with a PAT — honest, if inelegant, and cheap to migrate.

## Decision summary (ADR)

**Decision.** PATs (prefixed, hashed, last-used-tracked) in v1; OAuth2 authorization-code
+ PKCE + refresh + `resource:action` scopes in v2; service accounts at enterprise.

**Rationale.** v1 needs a credential on day one that is safe to store and trivial to use
from curl/CI — that is a PAT. The scope system is expensive to design well and worthless
if rushed; adopting Asana's proven grammar later, keyed to our resource map, gives
integrators a familiar model. Staging also keeps the scaffold's auth surface small enough
to audit thoroughly.

**Rejected alternatives.**
- *ClickUp-style permanent scopeless keys as the long-term story*: explicitly the
  anti-pattern; fine for week one, disqualifying for a platform.
- *OAuth2 from day one*: months of consent/registry/rotation work before the first
  integrator exists.
- *API keys per tenant (not per user)*: destroys attribution and audit; a leaked key is a
  tenant-wide breach with no blast-radius control.
- *JWTs as API keys*: revocation and rotation semantics get conflated with session
  machinery; opaque random tokens with server-side state are simpler and safer here.
