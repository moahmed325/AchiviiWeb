# Achivii — Lemon Squeezy Provider Contract

**Milestone:** M0.1 — Provider Contract  
**Status:** Implemented  
**Verified:** 2026-09-29

## Purpose

This document defines the minimum Lemon Squeezy concepts and provider-state boundary that Achivii needs for its international subscription billing implementation.

The provider contract is deliberately separate from Achivii's product entitlement model:

```
Lemon Squeezy provider state
        ↓ verified webhook / server API
Achivii subscription record
        ↓ internal entitlement rules
Achivii product entitlement
        ↓
Feature access
```

Lemon Squeezy is authoritative for **payment/subscription state**. Achivii is authoritative for **product entitlements**.

## 1. Provider Concepts

### Store

The Lemon Squeezy store is the provider account/store under which Achivii's products, variants, customers, orders and subscriptions exist.

**Achivii mapping:** configuration-level provider identity. A store ID is not an Achivii user or subscription.

**Required later:** server-side store identifier.

### Product

A Lemon Squeezy product represents a commercial product sold through the store.

**Achivii mapping:** commercial product definition. For the initial model, this will represent Achivii Pro rather than an application user.

**Important:** product identity is not entitlement by itself. Entitlement comes from a verified subscription state for a purchased variant.

### Subscription Variant

A variant is the purchasable configuration of a Lemon Squeezy product. Achivii's initial Pro model has monthly and yearly billing variants.

**Achivii mapping:** an internal plan/price choice such as:

- Pro Monthly
- Pro Yearly

Exact production prices and provider variant IDs remain configuration decisions until production setup.

### Customer

A Lemon Squeezy customer represents the purchaser/customer identity held by the provider.

**Achivii mapping:** provider-side customer identity associated with an authenticated Achivii user.

A customer ID must never be treated as an Achivii user ID by itself. The application must maintain the explicit user-to-provider association.

### Checkout

A Lemon Squeezy checkout is the purchase flow used to start a subscription.

For V1, Achivii uses provider-hosted checkout.

**Achivii mapping:** a transient purchase operation initiated by an authenticated Achivii user.

Checkout completion is **not** itself an entitlement grant. Paid access is granted only after verified provider state has been synchronized.

### Subscription

A Lemon Squeezy subscription is the recurring commercial relationship created after purchase.

The provider subscription contains identifiers and attributes including store, customer, product, variant, renewal/end dates, status and customer-facing management URLs.

**Achivii mapping:** persistent local subscription record associated with exactly one Achivii user.

The local record should retain the provider subscription ID and enough verified state to determine product entitlement without coupling product code to raw provider strings.

### Webhook Event

A Lemon Squeezy webhook is a signed asynchronous notification describing provider/store activity such as subscription creation, updates, cancellation, expiration and payment events.

**Achivii mapping:** an externally initiated synchronization event.

Webhook requests must be signature-verified before they can mutate billing state. Event processing must be idempotent.

### Subscription-management URL

Lemon Squeezy exposes customer-facing management URLs on subscription/customer data, including a signed Customer Portal URL and payment-method management URL.

**Achivii mapping:** a provider-managed account-management entry point. Achivii does not need to recreate the full billing-management system for V1.

These URLs are time-limited and should be retrieved/refreshed server-side when needed rather than treated as permanent application data.

## 2. Identity Mapping

The required relationship is:

```
Achivii User
  ├── internal user ID
  └── authenticated account
          │
          ├── Lemon Squeezy customer ID
          │
          └── Lemon Squeezy subscription ID
                    └── variant/product/store IDs
```

Checkout initiation must associate the authenticated Achivii user with the provider checkout using Lemon Squeezy's supported checkout custom-data mechanism.

The user identifier passed through checkout metadata must be the minimum non-secret identifier required to resolve the local account. Provider custom data is not a security boundary; webhook signatures and server-side ownership checks remain mandatory.

The authoritative association is established from a **verified provider webhook** and/or verified server-side provider API response, not from a browser query parameter or checkout return.

## 3. Provider → Achivii State Boundary

The provider has states including:

| Lemon Squeezy state | Achivii interpretation | Entitlement direction |
|---|---|---|
| Active | Subscription currently active | Entitled |
| Paused | Payment collection paused while subscription remains active | Follow verified provider/product rule; do not invent a downgrade |
| Past due | Renewal payment failed and recovery is underway | Preserve access while provider/product rules still consider it entitled |
| Unpaid | Renewal retries have failed | Follow verified provider entitlement state; do not equate every transient failure with expiration |
| Cancelled | Future renewal cancelled but subscription remains valid through current billing period | Entitled until provider-defined end |
| Expired | Subscription has ended | Not entitled |

The product layer should consume an internal concept such as:

- `PRO_ENTITLED`
- `PRO_NOT_ENTITLED`

and, where useful for UI/account state:

- `ACTIVE`
- `CANCELLED_ENDING`
- `PAST_DUE_RECOVERY`
- `UNPAID`
- `EXPIRED`
- `PENDING_SYNC`
- `NO_SUBSCRIPTION`

Provider strings must not be scattered throughout goal authorization or other product code.

### Important state rule

Lemon Squeezy's documentation states that customers should retain access in all documented subscription statuses except **Expired**. Achivii's final product entitlement service will still be the authority for how provider state maps to product access, but the implementation must not invent an immediate downgrade solely because a transient payment failure occurs.

## 4. Relevant Webhook Events

The provider documents subscription events including:

- `subscription_created`
- `subscription_updated`
- `subscription_cancelled`
- `subscription_resumed`
- `subscription_expired`
- `subscription_paused`
- `subscription_unpaused`
- `subscription_payment_failed`
- `subscription_payment_success`
- `subscription_payment_recovered`

Achivii should subscribe only to the events required by its lifecycle implementation.

Webhook processing requirements:

1. Receive the raw request body as required for signature verification.
2. Verify the `X-Signature` header using the configured webhook signing secret.
3. Reject invalid signatures before state mutation.
4. Identify the event and local user.
5. Apply the provider-to-Achivii state mapping.
6. Process duplicate delivery idempotently.
7. Persist the verified state.
8. Return the appropriate HTTP response.

## 5. Checkout Return Rule

The browser return from Lemon Squeezy is a **UX synchronization signal**, not payment proof.

The safe sequence is:

```
Checkout completed
      ↓
Browser returns to Achivii
      ↓
Achivii asks its own backend for current entitlement
      ↓
Backend uses verified local/provider state
      ↓
If webhook has not arrived:
    show synchronization pending
      ↓
After verified state is persisted:
    show paid access
```

A frontend route must never grant Pro merely because a checkout-success URL was visited.

## 6. Provider API Boundary

Provider API credentials remain server-only.

The backend may use the Lemon Squeezy API to:

- create/check out subscriptions;
- retrieve verified subscription information;
- obtain current provider management URLs;
- reconcile local state when explicitly required.

Frontend code must never receive the provider API key or webhook signing secret.

Product services should depend on internal billing/subscription abstractions rather than importing Lemon Squeezy API details directly.

## 7. Management URLs

The provider documents these subscription/customer-facing URLs:

- `customer_portal`
- `update_payment_method`
- `update_customer_portal` where applicable

The signed Customer Portal URL is time-limited. Achivii should therefore retrieve or refresh it through the backend rather than persisting it as a permanent credential.

For V1, detailed subscription management remains provider-managed.

## 8. Data Achivii Needs Later

The provider contract establishes the need for these categories of data:

### Provider identity

- store ID
- customer ID
- subscription ID
- product ID
- variant ID

### Subscription state

- provider status
- renewal timestamp
- end timestamp where applicable
- cancellation state
- relevant provider timestamps

### Synchronization

- provider event identifier
- event name/type
- processing state/timestamp as needed for idempotency and operational recovery

### Product mapping

- internal plan identifier
- internal billing interval
- entitlement derived from verified provider state

No card numbers, CVV values, payment credentials or other unnecessary payment secrets are stored by Achivii.

## 9. Security Boundary

The following are non-negotiable:

- Provider API keys are server-only.
- Webhook signing secrets are server-only.
- Webhook signatures must be verified before state mutation.
- Browser return is not payment proof.
- Client-provided entitlement claims are not trusted.
- One Achivii user's subscription cannot grant another user's access.
- Provider custom checkout data is an association mechanism, not an authorization mechanism.
- Duplicate webhook delivery must not duplicate subscription side effects.
- Unknown/invalid provider states must fail closed for entitlement rather than granting access.
- Temporary provider/API failure must not arbitrarily erase a previously verified entitlement.

## 10. Test vs Production

Lemon Squeezy documents separate test-mode and live-mode API credentials/stores.

The implementation must keep these environments distinguishable.

Test mode may be used to verify:

- checkout creation;
- subscription creation;
- webhook delivery;
- subscription state changes;
- lifecycle synchronization.

Production readiness additionally requires:

- final Pro plan/variant configuration;
- final pricing;
- live credentials;
- live webhook configuration;
- successful seller onboarding;
- actual Ethiopian payout configuration verification.

Test-mode success does not establish production payout readiness.

## 11. Verified Provider References

The following current Lemon Squeezy documentation was checked on 2026-09-29:

- Webhooks and signing: https://docs.lemonsqueezy.com/help/webhooks
- Webhook synchronization/events: https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- Subscription states: https://docs.lemonsqueezy.com/help/products/subscriptions
- Subscription object and management URLs: https://docs.lemonsqueezy.com/api/subscriptions/the-subscription-object
- Subscription management: https://docs.lemonsqueezy.com/guides/developer-guide/managing-subscriptions
- Custom checkout data: https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
- API/test mode: https://docs.lemonsqueezy.com/api

These sources confirm the provider concepts and technical capabilities used in this contract.

## 12. Explicit Non-Goals

M0.1 does not implement:

- database schema/migrations;
- checkout routes;
- webhook routes;
- entitlement enforcement;
- billing UI;
- production payout setup;
- Stripe integration.

Those belong to later milestones.

## 13. Exit Criteria

M0.1 is complete when:

- Lemon Squeezy concepts required by Achivii are defined.
- Provider identities are mapped to internal concepts.
- Provider lifecycle states are mapped to an internal entitlement boundary.
- Checkout-to-user association is defined.
- Webhook verification requirements are defined.
- Provider management URLs are understood.
- Test/live separation is understood.
- No unrelated product architecture is changed.
