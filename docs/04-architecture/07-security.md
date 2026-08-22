# Security

> **Status:** Accepted. Tenant isolation (the biggest control) is covered in
> `02-tenancy-rls.md`; this document covers authentication, authorization layers, audit,
> secrets, webhook signing, rate limiting, and upload safety.

## Authentication

### Passwords — argon2id

- Algorithm: **argon2id** with parameters `memory = 64 MiB`, `iterations = 3`,
  `parallelism = 4`, 16-byte salt, 32-byte hash (comfortably above the OWASP minimum;
  parameters are stored in the hash string so they can be raised later — hashes are
  transparently upgraded on next successful login).
- Login endpoints are rate-limited per account and per IP (separate stricter buckets than
  the API limiter) with progressive lockout + notification on repeated failures.
- `accounts.password_hash` is nullable — SSO-only accounts (Google now, SAML in P7) never
  hold a password.

### Sessions — JWT access + rotating refresh

| Token | Lifetime | Storage | Notes |
| --- | --- | --- | --- |
| Access JWT | **15 minutes** | memory (web) / caller (API) | Claims: `sub` (account_id), `tid` (active tenant), `mid` (membership), `role`, `iat/exp/aud/iss`. Signed (asymmetric, key id in header for rotation). Never in localStorage. |
| Refresh token | **30 days**, single-use | httpOnly Secure SameSite=Lax cookie | **Rotation on every use**: each refresh issues a new token and revokes the old (family id tracked). **Reuse detection**: presenting a consumed token revokes the entire family and forces re-login — stolen-token replay burns the thief or the victim, never both silently. |

- Tenant switching mints a new access token after re-verifying membership; the `tid`
  claim is *context*, never trusted without the membership check
  (see request lifecycle, `01-overview.md`).
- Server-side revocation list (Redis, TTL = access lifetime) covers logout-everywhere and
  membership revocation within the 15-minute window.

### Personal access tokens

- Format `raq_pat_<random 40+ chars>`; shown once at creation.
- **Hashed at rest** (SHA-256 — high-entropy random tokens don't need a slow hash;
  lookup is by hash equality). Plaintext never stored, prefix retained for display.
- `last_used_at` tracked (coalesced writes), optional `expires_at`, instant revocation.
  Full contract in `docs/05-api-design/03-auth.md`.

## Authorization layers

Checked in order; each layer only runs if the previous passed:

1. **Tenant membership** (structural): a valid principal with no active membership in the
   resolved tenant gets **404** — existence of the tenant/resource is not disclosed.
   This is also enforced below the app by RLS.
2. **Role** (coarse): `owner > admin > member > guest > client`. Role gates live in
   guards/decorators (`@Roles('admin')`) for tenant-level operations (billing, member
   management, workflow library edits, PAT policy).
3. **Container access** (v1): space privacy (`is_private` + explicit space membership,
   P2) and project privacy flags; guests/clients see only what they're granted.
4. **Per-project permission matrix** (evolution, P5): the Teamwork-style ~25-toggle
   per-project per-user matrix arrives with the client portal. The v1 role checks are
   written against a `PermissionService.can(actor, action, resource)` facade from day
   one, so the matrix slots in behind the same call sites without a rewrite.

Entitlement checks (`check(tenant, feature)`) are orthogonal to authorization and run at
the same guard layer — see `docs/06-saas-commercial/02-entitlements.md`.

## Audit log

- **What is recorded:** security-relevant and destructive actions — auth events (login,
  failed login, refresh reuse, PAT create/revoke), membership/role/invitation changes,
  billing changes, workflow/library edits, deletions and archivals, permission changes,
  export requests, and all admin/system escape-hatch usage. Routine reads and high-volume
  benign edits are *not* audited (that's what `outbox_events` is for).
- **Shape:** actor (type + membership), action (dotted verb), entity, `changes` diff
  (`{field: {from, to}}`), ip, user agent, timestamp (see schema reference).
- **Written asynchronously** post-commit via interceptor + queue — audit latency never
  blocks requests, loss on crash is bounded by the queue's persistence.
- **Append-only:** the app role has INSERT + SELECT only; no UPDATE/DELETE grants.
- **Partitioning:** range-partitioned by month on `created_at`; partitions older than the
  retention window (plan-dependent; Enterprise configurable) are detached and archived to
  object storage. Partition maintenance is a reconciliation-queue job.
- Tenant-facing audit UI ships in P7 (Enterprise); the table and writes ship in Wave A so
  history exists from day one.

## Secrets handling

- Runtime secrets (DB URLs, JWT signing keys, Stripe keys, webhook signing secrets) come
  from the environment/secret manager — never committed, never logged. The Zod env schema
  in Core fails boot on missing/malformed secrets.
- JWT signing keys are versioned (`kid` header) and rotated without downtime (old public
  keys retained for verification until expiry horizon).
- Tenant-owned secrets stored by us (webhook subscription secrets, future OAuth client
  secrets) are stored **hashed** where only verification is needed, or encrypted at the
  column level (AES-GCM via a KMS-held key) where the plaintext must be recoverable
  (webhook signing needs the secret to sign — encrypted, not hashed).
- Pino redaction lists (`authorization`, `cookie`, `password`, `token`, `secret` paths)
  are configured centrally; adding a field named like a secret without redaction fails a
  lint check on the log-schema module.

## Webhook HMAC signing

Outbound webhooks are signed so consumers can authenticate us (full API contract in
`docs/05-api-design/04-webhooks.md`):

- At subscription creation, the handshake delivers the secret via the `X-Raqeeb-Secret`
  header (Asana-style confirm loop).
- Every delivery carries `X-Raqeeb-Signature: t=<unix_ts>, v1=<hex HMAC-SHA256>` computed
  over `"{t}.{raw_body}"` with the subscription secret. Consumers must verify with a
  constant-time compare and reject `|now - t| > 5 min` (replay window).
- Signing secrets are per-subscription, rotatable with a dual-signing overlap window.

## Rate limiting

- **Token buckets in Redis**, evaluated in the gateway layer before controllers:
  - per **tenant** (the aggregate cap — plan-tiered), and
  - per **token/principal** (a single runaway PAT can't consume its tenant's whole
    budget).
- Plan-tiered sustained rates with a burst allowance (bucket size > refill rate); exact
  tiers and the 429 contract are normative in
  `docs/05-api-design/05-versioning-rate-limits.md` (Free 60/min → Enterprise custom).
- Every response carries draft-standard **`RateLimit-*` headers** (limit, remaining,
  reset); 429s include `Retry-After`.
- Separate, stricter buckets for auth endpoints and expensive operations (exports,
  bulk endpoints).
- Fail-open policy on Redis outage (availability over throttling) with alerting — but
  auth endpoints fail closed to their per-IP fallback limiter.

## File uploads (P2 — designed now)

OWASP-aligned presigned-upload flow; the API never proxies file bytes:

1. Client asks the API for an upload slot: declared filename, byte size, content type.
2. API validates: size against plan storage entitlement, content type against an
   allowlist, filename normalized (never trusted for storage keys — keys are
   `tenants/{tenant_id}/attachments/{uuid}`).
3. API returns a **short-lived presigned PUT URL** (S3-compatible store) constrained to
   exact key, content-type, and content-length.
4. Client uploads directly to object storage; the API confirms and records the
   attachment row (`pending → stored`).
5. Post-upload: server-side content-type sniffing (magic bytes must match the declared
   type), optional AV scan hook; mismatches quarantine the object.
6. Downloads are short-lived presigned GETs with
   `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; user HTML/SVG
   is never served inline from the app origin (separate media origin, CSP-sandboxed).

## Baseline hardening checklist

- TLS everywhere; HSTS; secure cookie attributes as above.
- CSP on the web app (no inline script; hashed Next.js runtime), `frame-ancestors 'none'`.
- CSRF: state-changing browser routes rely on SameSite=Lax cookies + custom-header check;
  the pure-Bearer API surface is CSRF-immune by construction.
- Input validation at the edge via `packages/contracts` Zod schemas — nothing reaches a
  service unparsed; problem+json errors (RFC 9457) never echo internals.
- Dependency and container scanning in CI; `npm audit`/OSV gate on high severity.
- IDs are UUIDv7 — non-enumerable; all list access is cursor-based (no offset probing).
