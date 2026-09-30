# Achivii — Lemon Squeezy Webhook Idempotency

**Milestone:** M1.2 — Event Idempotency Model  
**Status:** Implemented  
**Verified:** 2026-09-29

## Provider identity finding

Lemon Squeezy's current webhook documentation exposes:

- `X-Event-Name` — the event name;
- `data.type` — the JSON:API resource type;
- `data.id` — the provider resource identifier;
- `X-Signature` — the HMAC signature of the request body.

The documented webhook request shape does **not** expose a separate unique delivery/event ID. citeturn0search2turn0search5

Therefore Achivii does not incorrectly treat `data.id` as a unique webhook-delivery ID. The same subscription can legitimately generate multiple different events over its lifecycle.

## Delivery key

For each signature-verified request, Achivii derives:

```text
SHA-256(exact raw request body)
```

This hexadecimal digest is stored as `WebhookEvent.deliveryKey`, which has a database-level unique constraint.

Consequences:

- the exact same signed delivery produces the same key;
- a changed provider payload produces a different key;
- event name + resource ID alone are not used as the uniqueness key;
- the full raw payload is not persisted by the idempotency model.

The raw body must be available before JSON parsing because Lemon Squeezy signs the request body. citeturn0search7

## Durable record

`WebhookEvent` stores only the information needed for durable deduplication and later operational processing:

- internal event record ID;
- delivery fingerprint;
- provider event name;
- provider resource type;
- provider resource ID;
- processing status;
- received timestamp;
- processed timestamp;
- processing error, when applicable.

The model deliberately does not persist card data, payment credentials, webhook signatures, or the complete provider payload.

## Duplicate behavior

The repository first attempts to insert the delivery key.

```text
new delivery
   ↓
INSERT with unique deliveryKey
   ↓
created = true

repeated delivery
   ↓
unique constraint conflict
   ↓
find existing deliveryKey
   ↓
created = false
```

A unique-constraint collision is interpreted as a duplicate only when the existing delivery record can be found. Other database errors are propagated rather than being silently classified as duplicates.

This provides the database-backed primitive required by later webhook processing without implementing the webhook HTTP endpoint in M1.2.

## Processing states

The durable model starts with:

- `RECEIVED`

Later webhook processing may transition a record through states such as processed or failed. The exact state machine belongs to the webhook processing milestone and must remain compatible with this unique delivery key.

## Concurrency

Two workers receiving the same exact delivery concurrently race on the same database unique constraint. PostgreSQL permits only one row for the unique `deliveryKey`; the losing operation resolves the existing record and treats the delivery as already recorded.

No frontend state, browser storage, or in-memory lock is part of this guarantee.

## Why not use `data.id`?

For subscription events, `data.id` identifies the subscription resource, not the webhook delivery. Lemon Squeezy can send multiple events concerning the same subscription, including creation, updates, cancellation and expiration. citeturn0search1turn0search4

Using only `data.id` would therefore incorrectly collapse legitimate lifecycle events into one record.

## Later webhook-handler contract

M1.2 intentionally does not implement the HTTP endpoint. When M2 webhook handling is implemented, the endpoint must:

1. receive the exact raw body;
2. verify `X-Signature` before mutation;
3. derive the delivery key from that exact body;
4. atomically record/claim the delivery;
5. process only a newly claimed delivery;
6. safely acknowledge an already-recorded delivery;
7. update subscription state transactionally with the processing record where appropriate.

Lemon Squeezy retries failed webhook requests and can also resend recent events from its dashboard, making this durable boundary necessary. citeturn0search1turn0search2

## Exit criteria

- Provider webhook identity has been explicitly investigated.
- No nonexistent provider event ID is assumed.
- Exact-body SHA-256 delivery fingerprinting is implemented.
- Database uniqueness protects concurrent duplicate insertion.
- Provider resource identity is stored separately from delivery identity.
- Full webhook payloads are not unnecessarily persisted.
- Unit tests cover stable and changed-body fingerprints.
- No webhook HTTP endpoint was introduced.
- No M1.3 work was started.
