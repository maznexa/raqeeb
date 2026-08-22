# API Versioning & Rate Limits

> **Status:** Accepted.

## Versioning: one version, evolved additively (ADR)

**Decision.** The public API has **one version, `/api/v1`, indefinitely**. Change is
additive; removals go through a formal deprecation pipeline with headers and long
windows. There is no planned v2 path segment.

**Rationale.** Teamwork maintains three concurrent API versions and its integrator
ecosystem is permanently fragmented across them — every SDK, doc page, and support
thread pays the tax (a headline finding of the developer-platform research). Meanwhile,
Asana has evolved one REST surface for a decade via additive change + `opt_fields`.
Raqeeb's contract-first setup makes additive evolution cheap: responses may grow (clients
must ignore unknown response fields), requests stay strict.

**Rejected alternatives.**
- *Path versioning per breaking change (v2, v3, …)*: the Teamwork failure.
- *Date-pinned versions (Stripe model)*: excellent for a payments API with thousands of
  breaking micro-changes; overkill here and heavy to operate (per-version transform
  layers). Reconsider only if we ever accumulate unavoidable breaking changes.
- *GraphQL to dodge versioning*: deferred product-wide (build plan); complexity budgets
  and caching costs are not worth it for v1.

### Change rules

**Always allowed (additive):** new endpoints/resources, new optional request fields, new
response fields, new event types, new enum values *on fields documented as open enums*
(all enums are documented open unless marked closed; clients must tolerate unknown
values), new optional headers.

**Never without deprecation:** removing/renaming fields or endpoints, changing types or
semantics, tightening validation on existing fields, closing an open enum.

### Deprecation pipeline

1. Announce in changelog + docs; mark in OpenAPI with `deprecated: true` and
   `x-raqeeb-sunset`.
2. Responses touching a deprecated element carry:
   `Deprecation: @<unix-ts>` and `Sunset: <HTTP-date>` (RFC 8594), plus
   `Link: <changelog-url>; rel="deprecation"`.
3. Minimum window: **12 months** for anything GA; usage telemetry per token identifies
   affected integrators for direct outreach before sunset.
4. After sunset, the element returns problem type `gone` (410) for ≥ 3 months before
   removal.

## Rate limits

Enforced as **token buckets in Redis** at the gateway (implementation:
`04-architecture/07-security.md`). Two buckets checked per request — both must pass:

1. **Per-tenant** (aggregate, plan-tiered — the table below).
2. **Per-token/principal** (each PAT, OAuth grant, or user session): capped at
   `min(tenant limit, 50% of tenant limit)` so one runaway integration cannot starve the
   tenant's other clients.

### Plan tiers

| Plan | Sustained (per tenant) | Burst bucket | Per-token cap | Notes |
| --- | --- | --- | --- | --- |
| Free | **60 req/min** | 120 | 30/min | |
| Pro | **300 req/min** | 600 | 150/min | |
| Business | **1,000 req/min** | 2,000 | 500/min | |
| Enterprise | **custom** (default 5,000/min) | 2× sustained | negotiated | dedicated buckets; can be isolated per service account |

- **Burst vs sustained:** the bucket size is 2× the per-minute refill rate — clients may
  burst to bucket capacity, then are throttled to the sustained refill. This absorbs
  spiky-but-honest clients (page loads, batch scripts with pauses) while capping
  sustained pressure.
- Webhook *deliveries to* customers and realtime events do not consume API quota; bulk
  endpoints (future imports/exports) and search have separate, documented sub-limits.
- Read-after-write fairness: `429` never applies to `POST /auth/refresh` (its own strict
  limiter) so clients can always re-authenticate.

### Headers & 429 contract

Every authenticated response (per the draft IETF RateLimit standard):

```
RateLimit-Limit: 300
RateLimit-Remaining: 112
RateLimit-Reset: 27          # seconds until the bucket refills to full
```

On limit:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 12
Content-Type: application/problem+json

{ "type": ".../problems/rate-limited", "title": "Rate limit exceeded",
  "status": 429, "scope": "tenant", "limit": 300, "retry_after": 12, "request_id": "..." }
```

`scope` tells the caller *which* bucket tripped (`tenant` or `token`) — actionable, not
mysterious. SDKs retry automatically on 429 honoring `Retry-After` with jitter.

Rate-limit upgrades are an explicit entitlement (plans table `limits.api_rpm`), so a
tenant's limit changes the moment their plan does — no deploy, no support ticket.

## Published artifacts

- **OpenAPI 3.1** spec generated from `packages/contracts` (Zod → OpenAPI) on every
  release; published at `https://api.raqeeb.app/openapi.json` + rendered reference docs.
  The spec is the SDK source (TypeScript SDK generated first).
- **`llms.txt`** (and per-page `.md` variants of the docs) published from day one so
  AI coding assistants can consume the API accurately — the Asana docs lesson: the next
  10,000 integrations are written with an LLM in the loop.
- Changelog feed (RSS + JSON) with `Deprecation`/`Sunset` items called out; a
  machine-readable deprecations index at `/.well-known/deprecations.json`.
