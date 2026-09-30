# Achivii — Lemon Squeezy Checkout Identity Contract

**Milestone:** M0.3 — Checkout Identity Contract  
**Status:** Implemented  
**Verified:** 2026-09-29

## 1. Existing Authentication Source of Truth

Achivii currently authenticates users with a server-verified HS256 JWT.

1. `POST /api/auth/signup` creates the user and returns a JWT containing `userId` and `email`.
2. `POST /api/auth/login` returns the same JWT shape.
3. Authenticated routes call `getAuthUser(req)` from `backend/src/routes/auth.ts`.
4. `getAuthUser` reads `Authorization: Bearer <token>`.
5. The JWT signature and expiration are verified server-side.
6. The resulting `userId` is looked up in Prisma's `User` table.
7. The returned database user is therefore the trusted application identity for downstream operations.

The canonical identifier for billing association is the **Achivii `User.id` UUID**.

## 2. Required Checkout Association

The intended purchase flow is:

```text
Authenticated browser
      ↓ Authorization Bearer JWT
Achivii backend
      ↓ getAuthUser(req)
Achivii User.id
      ↓ server creates Lemon Squeezy checkout
Lemon Squeezy checkout custom_data
      ↓ signed provider webhook
Lemon Squeezy subscription
      ↓ verified webhook processing
Achivii User.id
      ↓ local subscription record
Entitlement
```

The backend must create the checkout while the authenticated user is still known. The frontend must never choose the billing user ID independently.

## 3. Checkout Custom Data

The only application identity value that should be passed through Lemon Squeezy checkout custom data is:

```json
{
  "achivii_user_id": "<authenticated User.id>"
}
```

This value is an association hint, not proof of authorization.

Do **not** put any of the following in provider custom data:

- JWTs
- passwords/password hashes
- API keys
- webhook signing secrets
- payment credentials
- private personal data not required for association
- entitlement flags such as `isPro: true`
- prices or amounts supplied by the client

The authenticated backend request is the source of truth for who initiated checkout.

## 4. Webhook Resolution

When Lemon Squeezy sends a subscription webhook:

1. Verify the webhook signature against the raw request body.
2. Parse the provider event only after signature verification.
3. Read `achivii_user_id` from the provider custom data attached to the subscription/order where available.
4. Validate that the value has the expected identifier format.
5. Resolve `User.id` against the local database.
6. Associate the verified provider subscription with that user.
7. Persist the provider subscription ID and verified billing state.

The webhook must never use:

- browser cookies;
- the checkout success URL;
- query-string user IDs;
- frontend state;
- email alone as the authorization mechanism.

If the custom user ID is missing or does not resolve to a local user, the event must not grant entitlement. It should be recorded/rejected for operational investigation according to the later webhook-processing contract.

## 5. Browser Return

A successful browser return from Lemon Squeezy does not prove payment.

The return flow is only:

```text
Provider checkout
      ↓
Browser return
      ↓
Achivii asks backend for current subscription/entitlement state
      ↓
Verified webhook/provider synchronization determines access
```

If the webhook has not arrived yet, the UI should display a synchronization/pending state rather than granting Pro.

This makes the system work when:

- the user closes the browser immediately after payment;
- the user returns on another device;
- the return URL is never visited;
- webhook delivery is delayed;
- the browser is refreshed multiple times.

## 6. Different Devices

Device continuity is not required for billing identity.

The provider subscription is associated with the server-side Achivii `User.id`. A user can therefore:

1. start checkout on Device A;
2. complete payment;
3. never return to Achivii on Device A;
4. sign in on Device B;
5. receive Pro entitlement after verified subscription synchronization.

The browser itself is not the durable identity link.

## 7. Duplicate / Repeated Checkout

M0.3 does not implement checkout deduplication, but later checkout creation must account for the possibility that a user starts multiple checkouts.

Each provider subscription must remain associated with the correct Achivii user. Later entitlement logic must define which subscription(s) can grant the same plan and how cancellation/expiration is handled.

## 8. Client Trust Boundary

The frontend may request:

```text
POST /api/billing/checkout
```

with a requested plan/interval such as:

```json
{
  "plan": "pro",
  "interval": "monthly"
}
```

The frontend must **not** submit:

```json
{
  "userId": "...",
  "variantId": "...",
  "price": 999,
  "entitled": true
}
```

The backend derives the user ID from authentication and derives the Lemon Squeezy variant ID from server-side configuration.

## 9. Exact Association Contract

| Data | Source | Trust level | Later use |
|---|---|---|---|
| `User.id` | Verified JWT + database lookup | Trusted application identity | Associate subscription |
| `email` | Database user | Trusted local account data | Optional provider/customer association |
| `achivii_user_id` custom data | Backend-created checkout | Association metadata | Resolve webhook to user |
| Provider subscription ID | Signed provider webhook | Trusted provider identifier | Local subscription key |
| Provider status | Signed provider webhook | Trusted provider state | Entitlement calculation |
| Browser return | Browser | Untrusted | UX synchronization only |
| Client `userId` | Browser request | Untrusted | Must be ignored |
| Client `variantId` | Browser request | Untrusted | Must be ignored |
| Client entitlement flag | Browser request | Untrusted | Must be ignored |

## 10. Implementation Boundary

M0.3 intentionally does **not** implement:

- `/api/billing/checkout`;
- Lemon Squeezy API calls;
- Prisma billing tables;
- webhook endpoints;
- webhook signature verification code;
- Pro entitlement enforcement;
- billing UI.

Those belong to subsequent milestones.

## 11. Acceptance Trace

A future checkout implementation must satisfy this trace:

```text
JWT
 ↓
getAuthUser(req)
 ↓
user.id
 ↓
server selects variant from billing configuration
 ↓
server creates provider checkout with achivii_user_id=user.id
 ↓
provider creates subscription
 ↓
signed webhook arrives
 ↓
signature verified
 ↓
achivii_user_id resolved to users.id
 ↓
provider subscription stored for that user
 ↓
entitlement service evaluates verified subscription state
```

At no point is a browser-provided user ID used to authorize paid access.

## 12. Exit Criteria

- Existing JWT authentication was traced to `User.id`.
- The durable billing association is explicitly defined.
- Provider custom data contains only the minimum non-secret identifier.
- Browser return is explicitly non-authoritative.
- Missing browser return and different-device scenarios are covered.
- Server-side variant selection is required.
- No sensitive credential or entitlement information is passed through provider metadata.
- No checkout, schema, webhook, or UI implementation was introduced in M0.3.
