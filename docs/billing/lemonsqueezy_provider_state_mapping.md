# Achivii — Lemon Squeezy Provider State Mapping

**Milestone:** M0.4 — Provider State Mapping  
**Status:** Implemented  
**Verified:** 2026-09-29

## Purpose

This document is the authoritative translation boundary between Lemon Squeezy subscription states and Achivii's internal billing/entitlement model.

Provider-specific status strings must remain inside the billing adapter/webhook layer. Product authorization consumes Achivii states only.

## Internal states

### Subscription state

- `ACTIVE`
- `CANCELLED_ENDING`
- `PAST_DUE_RECOVERY`
- `UNPAID`
- `PAUSED`
- `EXPIRED`
- `PENDING_SYNC`
- `NO_SUBSCRIPTION`
- `UNKNOWN`

### Entitlement

Only two product-level outcomes are exposed to authorization:

- `PRO_ENTITLED`
- `PRO_NOT_ENTITLED`

The distinction between lifecycle states is useful for account/billing UX but must not require product components to understand Lemon Squeezy terminology.

## Mapping

| Lemon Squeezy provider state | Achivii state | Pro entitlement | Product interpretation |
|---|---|---|---|
| `active` | `ACTIVE` | `PRO_ENTITLED` | Paid subscription is currently valid |
| `cancelled` with a future valid period end | `CANCELLED_ENDING` | `PRO_ENTITLED` | Renewal is cancelled, but the paid period remains valid |
| `past_due` | `PAST_DUE_RECOVERY` | `PRO_ENTITLED` | Payment recovery is in progress; do not revoke solely because renewal failed |
| `unpaid` | `UNPAID` | `PRO_ENTITLED` while provider subscription remains valid | Preserve access according to Lemon Squeezy's documented lifecycle; do not invent an immediate downgrade |
| `paused` | `PAUSED` | `PRO_ENTITLED` while provider considers the subscription valid | Do not infer expiration from pause alone |
| `expired` | `EXPIRED` | `PRO_NOT_ENTITLED` | Subscription has ended |
| Missing/unknown provider status | `UNKNOWN` | `PRO_NOT_ENTITLED` for a new/unverified entitlement | Fail closed rather than inventing paid access |
| No local subscription | `NO_SUBSCRIPTION` | `PRO_NOT_ENTITLED` | No verified paid relationship exists |
| Checkout/event synchronization not yet persisted | `PENDING_SYNC` | Existing entitlement is preserved; otherwise `PRO_NOT_ENTITLED` | Browser return or pending webhook is not payment proof |

### Important cancellation rule

Cancellation is not the same as expiration.

If Lemon Squeezy reports a subscription as cancelled but its valid billing period has not ended, Achivii retains `PRO_ENTITLED` until the provider-defined end. The entitlement service should use the authoritative provider end timestamp rather than inventing its own cancellation date.

### Important failed-payment rule

`past_due` and `unpaid` must not automatically become `PRO_NOT_ENTITLED` merely because a payment failed.

Lemon Squeezy's documented subscription lifecycle states that customers retain access in documented statuses other than `expired`. Achivii therefore preserves the provider-backed entitlement while the subscription remains within the provider's valid lifecycle. Actual expiration is the definitive loss-of-access transition.

This also protects against transient provider/webhook/API failures.

## Unknown and invalid states

Unknown provider status values must never grant Pro.

If a future Lemon Squeezy status appears that Achivii does not recognize:

1. Store/record the raw provider status in the billing synchronization layer as appropriate for diagnostics.
2. Translate it to `UNKNOWN`.
3. Do not grant a new entitlement based on that status.
4. Preserve a previously verified entitlement only when the local verified subscription remains valid and the unknown event cannot establish that access ended.
5. Surface the condition to operational logging/monitoring.
6. Update this mapping explicitly before treating the new state as a normal product state.

The provider adapter is responsible for the translation. Product authorization must never switch on raw strings such as `active` or `expired`.

## Synchronization failures

A failed webhook/API request is not itself a subscription state.

If Achivii already has a verified entitlement and a provider synchronization attempt temporarily fails:

- retain the last verified entitlement;
- record the synchronization failure;
- retry/reconcile according to the later webhook/reconciliation implementation;
- do not downgrade solely because the network/provider is temporarily unavailable.

If Achivii has never verified a subscription, a failed synchronization cannot be treated as proof of payment.

## Event-to-state guidance

The following events are relevant to the mapping layer:

| Provider event | Expected state transition |
|---|---|
| `subscription_created` | `PENDING_SYNC` → verified provider state, normally `ACTIVE` |
| `subscription_updated` | Recalculate from verified subscription status |
| `subscription_cancelled` | `CANCELLED_ENDING` while still valid; `EXPIRED` once provider says it has ended |
| `subscription_resumed` | Usually back to `ACTIVE` or the provider's current verified state |
| `subscription_expired` | `EXPIRED` → `PRO_NOT_ENTITLED` |
| `subscription_paused` | `PAUSED`, retaining entitlement while provider considers it valid |
| `subscription_unpaused` | Recalculate current verified state |
| `subscription_payment_failed` | Usually `PAST_DUE_RECOVERY`/provider current state; do not immediately revoke |
| `subscription_payment_success` | Recalculate current verified subscription state |
| `subscription_payment_recovered` | Return to current verified entitled state, normally `ACTIVE` |

The event name is not the entitlement decision. The verified subscription resource/state is authoritative.

## Product authorization contract

Product code should ask:

    hasEntitlement(user, "PRO")

or consume:

    entitlement === "PRO_ENTITLED"

It should not ask whether a raw provider status equals `active`, `cancelled`, or `past_due`.

This separation keeps the product model stable if Achivii changes providers in the future.

## Custom goals

The payment feature definition states that custom goals become paid only when the corresponding paid plan and entitlement are actually available.

Therefore:

- before Pro billing is operational, existing custom-goal behavior remains unchanged;
- existing custom goals are grandfathered according to the existing product decision;
- once Pro entitlement enforcement is implemented, a new custom-goal creation request may require `PRO_ENTITLED`;
- existing grandfathered custom goals must not be revoked merely because the user's current entitlement changes.

This milestone does not implement that gate.

## Test cases required by later implementation

The later subscription/entitlement implementation must test at minimum:

1. active → entitled;
2. cancellation with future end date → entitled;
3. cancellation reaching provider end → not entitled;
4. past due → entitled while provider lifecycle remains valid;
5. unpaid → no immediate downgrade solely from payment failure;
6. expired → not entitled;
7. unknown status → never grants new entitlement;
8. duplicate events → same final state;
9. temporary provider failure → last verified entitlement preserved;
10. missing local user → no entitlement grant;
11. checkout success page without webhook → no new entitlement;
12. a user cannot consume another user's subscription.

## Exit criteria

- All relevant provider lifecycle states are mapped.
- Achivii has a minimal internal state vocabulary.
- Entitlement is separated from provider terminology.
- Cancellation-at-period-end is explicitly handled.
- Failed-payment/recovery behavior is explicit.
- Expiration is the definitive access-loss state.
- Unknown states fail closed for new entitlement.
- Temporary provider failure does not revoke verified access.
- Custom-goal grandfathering is preserved.
- No database, checkout, webhook, or UI implementation is introduced in M0.4.
