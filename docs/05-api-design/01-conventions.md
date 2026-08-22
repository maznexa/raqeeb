# API Conventions

> **Status:** Accepted. The public API is not a bolt-on: the web app consumes the same
> `/api/v1` controllers from day one, so the public surface is exercised by every user
> session. Contracts are Zod schemas in `packages/contracts`; OpenAPI 3 is emitted from
> them and published (with an `llms.txt`) — see `05-versioning-rate-limits.md`.

## Style

- **REST over HTTPS, JSON only** (`application/json`; errors are
  `application/problem+json`).
- **Base path: `/api/v1` — and there will be ONE version.** Teamwork runs three
  concurrent API versions and the ecosystem pays for it forever; Raqeeb evolves v1
  additively with deprecation headers instead (versioning policy doc). `v1` in the path
  is a stability promise, not the first of a series.
- Tenant scoping: the tenant is resolved from the **`X-Raqeeb-Tenant: {slug}`** header
  (API clients) or the app's path slug; it is never inferred from the token alone
  (membership is verified per request — see request lifecycle).

## Resource naming

- Plural kebab-case nouns: `/tasks`, `/task-dependencies` → no; dependencies are
  sub-resources: `/tasks/{id}/dependencies`. Top-level collections: `tenants`, `spaces`,
  `folders`, `projects`, `sections`, `workflows`, `statuses`, `item-types`, `tasks`,
  `clients`, `memberships`, `invitations`, `personal-access-tokens`, `webhooks` (P2).
- Nesting is one level deep maximum and only for true composition
  (`/projects/{id}/sections`); everything else filters on the collection
  (`/tasks?project_id=...`), so URLs never encode the whole hierarchy.
- Actions that aren't CRUD are explicit sub-resources or verbs where REST mapping would
  lie: `POST /tasks/{id}/locations/{locId}/move`, `POST /invitations/{id}/resend`.
- Field names: `snake_case` in JSON (matches SQL and the webhook payloads; one casing
  everywhere on the wire).

## Identifiers

- **UUIDv7** for all ids: time-ordered (index-friendly, roughly sortable by creation),
  non-enumerable, generated at the application layer.
- Human task keys (`ACME-42`) are display/lookup aliases
  (`GET /tasks/by-key/{key}`), never the canonical id.

## Timestamps

- **ISO 8601, always UTC, always with `Z`** (`2026-08-22T14:03:22.114Z`), millisecond
  precision. Date-only fields (task `start_date`/`due_date`) are `YYYY-MM-DD` with no
  timezone semantics (they mean "that calendar date wherever the viewer is").
- The API neither accepts nor emits local-time offsets; formatting is a client concern
  (`04-architecture/06-i18n-rtl.md`).

## Pagination — cursor only

```
GET /api/v1/tasks?project_id=0198...&limit=100
→ 200 { "data": [...], "next_cursor": "eyJwIjoiYTBWi...", "has_more": true }
GET /api/v1/tasks?project_id=0198...&cursor=eyJwIjoiYTBWi...
```

- **Keyset cursors** (opaque, base64, signed) encoding the sort key + id tiebreaker.
  No OFFSET pagination anywhere — it's both slow at depth and unstable under writes.
- `limit` default 50, max 200. Cursors are stable across inserts/deletes (you never see
  a row twice because a page shifted).
- Sorted endpoints document their sort keys; cursors are only valid for the sort/filter
  combination that produced them (encoded inside, validated on use).

## Sparse fieldsets — `fields=`

Inspired by Asana's `opt_fields` (its single best developer-platform idea):

```
GET /tasks?project_id=...&fields=id,title,status.name,assignees.membership_id,locations
```

- Every collection endpoint returns a documented **compact default** shape; `fields=`
  opts into more (dot paths for nested expansions) or narrows further.
- Expansions are bounded and enumerated per resource (no arbitrary graph walking); each
  expansion maps to one batched query server-side — `fields=` can never create N+1s.
- Unknown fields → `400` with the offending name (fail loud, not silently ignore —
  silent ignoring hides client typos forever).

## Errors — RFC 9457 problem+json

```json
{
  "type": "https://api.raqeeb.app/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "due_date must be on or after start_date",
  "instance": "/api/v1/tasks",
  "request_id": "req_0198f3...",
  "errors": [ { "path": "due_date", "code": "date_order", "message": "..." } ]
}
```

- Every error is problem+json with a stable, documented `type` URI and machine-readable
  `code`s; `request_id` always present (correlates to logs/traces).
- Status usage: `400` malformed, `401` unauthenticated, `402` subscription-blocked
  (dunning write-block), `403` authenticated but forbidden *within* the tenant, **`404`
  for cross-tenant or nonexistent** (existence never disclosed across tenants), `409`
  conflict (idempotency replay mismatch, ordering retry exhausted), `422` semantic
  validation, `429` rate limited (with `Retry-After`).

## Idempotency-Key on mutations

- All `POST` endpoints accept an **`Idempotency-Key`** header (UUID recommended;
  ≤ 255 chars). `PUT`/`DELETE` are naturally idempotent; `PATCH` accepts it too.
- Semantics (Stripe model): first request stores `(tenant, key, request_hash, response)`
  for 24 h; a retry with the same key + same body replays the stored response (including
  status); same key + different body → `409` problem `idempotency-key-reuse`.
- Storage: Redis with PG fallback for the response envelope; replays are marked with
  `Idempotency-Replayed: true`.
- SDKs and docs teach retries-with-key as the default write pattern; combined with
  at-least-once webhooks, integrators get exactly-once *effects* end to end.

## Rate-limit headers

Every authenticated response carries the draft-standard headers:

```
RateLimit-Limit: 300
RateLimit-Remaining: 287
RateLimit-Reset: 42
```

429s add `Retry-After` (seconds). Buckets, tiers, and burst semantics:
`05-versioning-rate-limits.md`.

## Misc contract rules

- Request bodies validated by the shared Zod schemas; unknown body fields are rejected
  (`422`) — additive server changes are safe because *responses* may grow, requests may
  not silently carry junk.
- All list responses are wrapped (`{ "data": [...] }`) so metadata can be added without
  breaking arrays-at-root clients.
- Compression (gzip/br) on; ETags on single-resource GETs with `If-None-Match` support.
- CORS: public API allows configured origins per OAuth app (v2); PAT usage is
  server-to-server and gets no wildcard CORS.
