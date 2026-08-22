# Webhooks

> **Status:** Accepted (normative contract; delivery infrastructure ships with API GA in
> P2, fed by the Wave A `outbox_events` pipeline).
> Design sources: Asana's handshake + signature + filters (best-in-class), ClickUp's
> health monitoring, and the explicit anti-pattern of skinny payloads that force a
> re-fetch per event.

## Registration API

```
POST /api/v1/webhooks
{
  "target_url": "https://example.com/hooks/raqeeb",     // HTTPS required
  "events": ["task.created", "task.status_changed"],    // or ["task.*"], ["*"]
  "scope": { "type": "project", "id": "0198..." },      // or space / tenant
  "field_filters": { "task.updated": ["status_id", "due_date"] }   // optional
}
```

| Endpoint | Purpose |
| --- | --- |
| `POST /webhooks` | Create subscription (triggers handshake — below) |
| `GET /webhooks` · `GET /webhooks/{id}` | List / inspect (incl. `health`) |
| `PATCH /webhooks/{id}` | Update filters/URL (URL change re-runs handshake) |
| `DELETE /webhooks/{id}` | Remove |
| `POST /webhooks/{id}/rotate-secret` | New secret via handshake; dual-signing overlap 24 h |
| `GET /webhooks/{id}/deliveries` | Recent delivery attempts: event id, status code, duration, next retry |
| `POST /webhooks/{id}/reactivate` | Re-enable a suspended subscription (re-runs handshake) |

Limits: subscriptions per tenant are plan-tiered (entitlement `webhooks_count`); creation
requires role `member`+ and `webhooks:manage` scope once OAuth lands.

## HMAC: handshake on create, signature per delivery

**Handshake (`X-Raqeeb-Secret`).** On create/URL-change/rotate, Raqeeb POSTs an empty
body to `target_url` with header `X-Raqeeb-Secret: <64-hex secret>`. The receiver must
respond `200` echoing `X-Raqeeb-Secret` back within 10 s. Success activates the
subscription and both sides now hold the shared secret (we store it encrypted — we must
sign with it; see security doc). Failure leaves the subscription `pending_handshake`.
This proves URL ownership and delivers the secret without a second channel (Asana model).

**Per-delivery signature (`X-Raqeeb-Signature`).**

```
X-Raqeeb-Signature: t=1766411002, v1=6f8b0c...cafe
```

`v1 = HMAC-SHA256(secret, "{t}." + raw_request_body)`, hex-encoded. Receivers must:
compute over the **raw** body (before any JSON parse), compare constant-time, and reject
`|now − t| > 300 s` (replay window). During secret rotation deliveries carry two
signatures (`v1=` old, `v1=` new) for the overlap window.

Delivery headers also include `X-Raqeeb-Event: task.status_changed`,
`X-Raqeeb-Delivery: <delivery uuid>`, `X-Raqeeb-Event-Id: <event uuid>` (dedupe key), and
`User-Agent: Raqeeb-Webhooks/1`.

## Event catalog

Names are `entity.verb[_qualifier]`, snake_case, the **same vocabulary as realtime
events** (`04-architecture/04-realtime.md`) — one catalog, generated from
`packages/contracts`:

| Family | Events (Wave A engine) |
| --- | --- |
| task | `task.created`, `task.updated`, `task.status_changed`, `task.moved` (location/section/reorder), `task.assigned`, `task.unassigned`, `task.archived`, `task.deleted` |
| dependency | `task.dependency_added`, `task.dependency_removed` |
| project | `project.created`, `project.updated`, `project.archived` |
| section | `section.created`, `section.updated`, `section.archived` |
| space / folder | `space.created`, `space.updated`, `folder.*` likewise |
| workflow | `workflow.created`, `workflow.updated`, `status.*` |
| membership | `member.joined`, `member.role_changed`, `member.deactivated`, `invitation.sent`, `invitation.accepted` |
| client | `client.created`, `client.updated`, `client.archived` |
| Wave B families (reserved) | `comment.*`, `field_value.*`, `time_entry.*`, `budget.*`, `automation.run_*`, `form.submitted`, `proof.*`, `goal.*` |

Wildcards: `task.*` (family), `*` (everything in scope). New event types may be added at
any time — consumers must ignore unknown types (documented contract).

## Filters

Three orthogonal narrowing axes, all optional:

1. **Container scope** — `tenant` (default), `space`, or `project`: only events whose
   `scope` matches (a multi-homed task matches if *any* of its locations is in scope).
2. **Event list** — explicit names and/or wildcards.
3. **Field filters** — per event type, deliver only when the changed-field set intersects
   the listed fields (e.g. only `status_id`/`due_date` changes of `task.updated`).
   Wrike-style, and the single biggest noise reducer for integrators.

## Delivery semantics

Payload = the standard fat envelope (see realtime doc): event id, type, occurred_at,
actor, entity, scope, and `data` with **`changed` fields AND `new` values** (plus `old`
where cheap). Consumers should not need a follow-up GET to act on an event — the
anti-re-fetch rule. Payloads > 256 KB are truncated to changed-field names +
`"truncated": true` (rare; consumers then re-fetch).

- **Timeout: 10 s** per attempt. Success = any `2xx`. Redirects are not followed.
- **At-least-once**, per-subscription ordering best-effort (retries reorder; consumers
  order by `seq`/`occurred_at`, dedupe by `X-Raqeeb-Event-Id`).
- **Retry schedule (exponential, ~24 h total):** 10 s → 1 m → 5 m → 30 m → 2 h → 6 h →
  12 h → 24 h (full jitter). After the final failure the delivery is marked `failed`
  and kept 14 days for inspection/manual replay.

## Health & auto-suspend (the Asana + ClickUp lesson)

Silent webhook death is the worst integrator experience both reference platforms are
known for; Raqeeb makes health first-class:

- Per-subscription `health`: `active` → `degraded` (any failures in the last hour) →
  `suspended`.
- **Auto-suspend:** 100% failure across ≥ 20 consecutive deliveries spanning ≥ 4 h
  suspends the subscription (stops the retry storm, preserves the subscription and its
  config).
- On suspend: notification to the creating user + tenant admins (email + in-app),
  `webhook.suspended` event to *other* active subscriptions, and a visible banner in the
  developer settings UI.
- `GET /webhooks/{id}` exposes `health`, `consecutive_failures`, `last_success_at`,
  `last_failure: {status_code, error, at}` — a **health status endpoint**, not a
  guessing game.
- `POST /webhooks/{id}/reactivate` re-runs the handshake and resumes from *new* events
  (missed-window backfill via the events replay API is a P7 platform item; until then
  the deliveries log covers forensics).
