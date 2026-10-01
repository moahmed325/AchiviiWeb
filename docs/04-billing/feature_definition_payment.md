# Lemon Squeezy Subscription Billing — FEATURE DEFINITION

## 1. Overview

### Feature
International subscription billing for Achivii using Lemon Squeezy as the Merchant of Record and payment/subscription provider.

### Problem
Achivii needs a real way for users outside Ethiopia to purchase paid Achivii capabilities. Stripe Payments is not the payment foundation for this feature. Achivii needs a provider that can accept international customer payments, manage recurring subscriptions, and provide a payout path available to an Ethiopian seller.

Lemon Squeezy currently supports bank payouts in Ethiopia and supports subscription checkout, subscription management, and webhook synchronization.

### Desired outcome
A user can purchase an Achivii paid plan through Lemon Squeezy, return to Achivii, and have their account receive the corresponding entitlement based on verified subscription state. Subscription changes, cancellations, expirations, failed payments, and renewals must keep Achivii's access state synchronized with Lemon Squeezy.

### Target user
Achivii users who want paid capabilities and are able to purchase internationally.

### Motivation
Turn the existing planned premium model into a real, enforceable product capability without coupling Achivii's product logic directly to a payment provider's internal representation.

---

## 2. User Goal

As an Achivii user,
I want to purchase a paid Achivii plan using an international payment method,
so that I can access the paid capabilities associated with that plan and keep access synchronized with my active subscription.

---

## 3. Core User Actions

### Action: View available paid plan
Who can perform it: Any visitor/user who encounters a paid feature or the future billing experience.
What happens: The user can understand what the paid plan provides and its current price/billing interval.
What should the user see: Accurate plan information and a clear purchase action.
What happens if it fails: The user should still be able to use all currently available free functionality.

### Action: Start checkout
Who can perform it: A user eligible to purchase the selected paid plan.
What happens: Achivii sends the user into a Lemon Squeezy checkout for the selected subscription variant and associates the checkout with the authenticated Achivii user.
What should the user see: A clear transition into the payment experience.
What happens if it fails: The user remains on Achivii and sees a retryable error without receiving paid access.

### Action: Complete purchase
Who can perform it: A customer who successfully completes Lemon Squeezy checkout.
What happens: Lemon Squeezy records the subscription and notifies Achivii through the configured webhook flow.
What should the user see: A successful return/confirmation experience; paid access becomes available only after Achivii has verified and persisted the subscription state.
What happens if it fails: No paid entitlement is granted solely because the user returned from checkout.

### Action: Manage subscription
Who can perform it: A user with an active or otherwise manageable paid subscription.
What happens: The user can use the supported Lemon Squeezy subscription-management flow for applicable actions such as cancellation, resumption, plan changes, or payment-method updates.
What should the user see: A clear way to manage their subscription.
What happens if it fails: Achivii preserves the last verified state and gives the user a retry path.

### Action: Lose paid access
Who can perform it: The system, based on verified provider state.
What happens: Access is removed when the subscription is no longer entitled to access under the product rules.
What should the user see: A clear explanation and an available path to resubscribe if appropriate.
What happens if it fails: Achivii must not accidentally revoke access because of a transient webhook/API failure.

---

## 4. Primary User Journey

User encounters a paid Achivii capability
    ↓
User reviews the real plan and price
    ↓
User selects the paid plan
    ↓
Achivii starts a Lemon Squeezy checkout associated with the authenticated user
    ↓
User completes international checkout
    ↓
Lemon Squeezy creates/updates the subscription
    ↓
Lemon Squeezy sends the relevant signed webhook event
    ↓
Achivii verifies and processes the event
    ↓
Achivii persists the provider subscription state and entitlement
    ↓
User receives paid access
    ↓
Future renewals / cancellations / failures / expirations synchronize through provider events
    ↓
User can manage or renew the subscription

---

## 5. Entry Points

1. Paid feature gate: a user reaches a capability that requires a paid plan.
2. Account/billing area: an authenticated user can view their current subscription state and manage it.
3. Future marketing/pricing experience: a public plan presentation may lead into checkout once exact pricing and plan packaging are finalized.

The exact navigation placement remains an open product decision if it is not already established elsewhere.

---

## 6. Core Concepts

### Plan
A commercial Achivii offering with a defined price, billing interval, and set of entitlements.

### Subscription
The user's ongoing commercial relationship with a Lemon Squeezy plan.

### Entitlement
The product-level permission that determines which paid Achivii capabilities the user may use.

### Payment state
The provider-reported state relevant to whether the user should retain access.

### Provider identity
The identifiers needed to associate an Achivii account with the corresponding Lemon Squeezy customer/subscription/order.

### Webhook event
A signed asynchronous notification from Lemon Squeezy describing a relevant change in store, order, or subscription state.

---

## 7. Lifecycle

### Subscription lifecycle

#### Created
Meaning: A paid subscription has been created by Lemon Squeezy.
How it is entered: Successful subscription checkout/provider confirmation.
How it is exited: Updated, cancelled, paused, expired, or otherwise changed by provider state.

#### Active
Meaning: The subscription currently grants the user paid access.
How it is entered: Verified provider state indicates access should be active.
How it is exited: Cancellation/expiration/payment failure or another provider state that changes entitlement according to the product rules.

#### Grace / cancelled-at-period-end
Meaning: The subscription is cancelled for future renewal but remains valid through its applicable paid period.
How it is entered: Provider reports cancellation while the subscription remains valid.
How it is exited: Subscription expires or is resumed.

#### Past due / payment recovery
Meaning: A renewal payment has failed and Lemon Squeezy is attempting recovery.
How it is entered: Provider reports failed renewal/payment state.
How it is exited: Payment recovers or the subscription becomes unpaid/expired.

#### Expired
Meaning: The subscription no longer grants paid access.
How it is entered: Provider reports expiration.
How it is exited: A new paid subscription is created.

---

## 8. Experiences / Screens

| ID | Experience | Purpose | Required? |
|---|---|---|---|
| UX-1 | Paid plan presentation | Explain the available paid offering | Yes |
| UX-2 | Lemon Squeezy checkout | Complete purchase | Yes |
| UX-3 | Purchase return / confirmation | Explain the result after checkout | Yes |
| UX-4 | Billing/account state | Show current subscription/access state | Yes |
| UX-5 | Subscription management entry | Allow the user to manage an existing subscription | Yes |
| UX-6 | Paid feature gate | Explain why a capability requires the paid plan and provide purchase path | Yes |
| UX-7 | Billing failure / unavailable state | Handle provider/API/webhook uncertainty without falsely changing access | Yes |

---

## 9. States

### Initial
The user has no paid subscription.

### Loading
The application is retrieving current subscription/entitlement state or starting a checkout.

### Active
The user has a verified paid entitlement.

### Cancelled / ending
The subscription is cancelled but remains valid through the provider-defined paid period.

### Past due
The provider reports a failed renewal/payment and recovery is still possible.

### Unpaid
The provider reports that renewal attempts have failed and the subscription no longer has normal active-payment status.

### Expired
The subscription has ended and paid access is no longer available.

### Checkout failure
Checkout could not be started or completed. No entitlement is granted.

### Synchronization pending
A user has completed or changed checkout but Achivii has not yet received/processed the corresponding provider event. The application must not infer paid access merely from browser return state.

### Provider unavailable
Lemon Squeezy cannot currently be reached. Achivii should use the last verified entitlement state rather than treating temporary provider unavailability as cancellation.

---

## 10. Edge Cases

- User closes checkout before paying.
- User completes payment but does not return to Achivii.
- Webhook arrives before the browser return.
- Browser returns before the webhook arrives.
- The same webhook is delivered more than once.
- Webhook processing fails and Lemon Squeezy retries.
- Webhook arrives out of order.
- A user attempts to start checkout while already subscribed.
- A user has multiple provider events for the same subscription.
- A subscription is cancelled but remains valid until the end of its billing period.
- Renewal payment fails temporarily and later recovers.
- Subscription expires.
- User changes plan.
- User changes payment method through the provider.
- User logs out or changes device after purchasing.
- User attempts to access a paid feature while entitlement synchronization is pending.
- Provider/API is temporarily unavailable.
- A malicious user attempts to claim paid access without a verified provider event.
- A webhook has an invalid signature.
- A webhook references an unknown Achivii user.
- A provider subscription exists but the local record is missing or stale.
- A checkout is created for the wrong user or wrong plan.
- A plan price changes for future purchases while existing subscriptions retain their existing subscription price unless explicitly changed through the provider.

---

## 11. Data Behavior

The system must persist enough information to:

- identify the Achivii user associated with a Lemon Squeezy customer/subscription;
- identify the current provider subscription;
- identify the purchased plan/variant;
- determine the current verified subscription state;
- determine relevant access/entitlement state;
- know when the subscription is expected to renew or end when that information is available;
- process webhook events safely and idempotently;
- recover from temporary provider/API failures;
- support account/device changes without losing subscription ownership.

The product definition does not prescribe a database schema.

---

## 12. Persistent / Temporary / Derived State

### Persistent
- Achivii user-to-provider customer association.
- Achivii user-to-provider subscription association.
- Current verified subscription state.
- Current plan/variant association.
- Relevant provider identifiers.
- Relevant renewal/end timestamps.
- Webhook processing information required for reliable synchronization.
- Paid entitlement state or the authoritative information from which it can be derived.

### Temporary
- Checkout loading state.
- Current redirect/return state.
- Transient provider/API errors.
- UI feedback during synchronization.

### Derived
- Whether a user currently has access to a paid feature.
- Whether a subscription is ending soon.
- Which product capabilities are available under the current plan.

---

## 13. Time-Based Rules

- Subscription access follows the verified provider subscription state.
- A subscription cancelled during a paid period remains entitled until its valid end according to Lemon Squeezy's subscription state.
- Renewal dates must use the provider's authoritative subscription data.
- Achivii must not invent its own renewal schedule when Lemon Squeezy already provides the authoritative value.
- Exact grace-period/access behavior for failed payments must be explicitly decided before implementation.
- User timezone does not determine provider billing periods.

---

## 14. Product Rules

### RULE-1
Paid access is granted only from a verified subscription/payment state, not from a client-side checkout-success signal.

### RULE-2
The server is authoritative for entitlement enforcement.

### RULE-3
Webhook signatures must be validated before an event can change paid access.

### RULE-4
Webhook handling must be idempotent so repeated delivery does not duplicate or corrupt subscription state.

### RULE-5
Transient provider/API failures must not automatically revoke an otherwise valid entitlement.

### RULE-6
A cancelled subscription remains entitled for its valid paid period unless the verified provider state says otherwise.

### RULE-7
Existing free functionality must remain usable by users without a paid subscription.

### RULE-8
Custom goals become paid only when the corresponding paid plan and entitlement are actually available. Existing custom goals remain grandfathered according to the existing product decision unless a new product decision explicitly changes that behavior.

### RULE-9
The product must never display a paid-plan or payment state that is not actually available.

### RULE-10
Provider-specific state must be translated into Achivii product entitlements rather than exposing provider terminology as the application's core product model.

---

## 15. Permissions

- Any visitor may view public plan information if a public pricing experience exists.
- An authenticated user may start checkout for themselves.
- An authenticated user may view their own subscription state.
- An authenticated user may manage their own subscription through the supported provider flow.
- Users cannot grant themselves paid entitlements.
- One user's subscription must never grant another user's account access.
- Administrative/provider operations are not user-facing permissions and are not defined here.

---

## 16. Mobile Requirements

Required.

Checkout and billing entry points must remain usable on mobile. The user must be able to:

- understand the plan;
- start checkout;
- return to Achivii;
- understand their subscription state;
- access subscription management.

The external Lemon Squeezy checkout experience must not be assumed to be controlled by Achivii's design system.

---

## 17. Accessibility Requirements

- Paid feature gates must have accessible names and descriptions.
- Purchase and subscription-management actions must be keyboard accessible.
- Success, failure, and synchronization states must be announced appropriately.
- Entitlement state must not be communicated through color alone.
- Loading states must not leave keyboard or screen-reader users without feedback.
- Error messages must explain what happened and what the user can do next.

---

## 18. Design Requirements

- Follow the existing Achivii visual design system.
- Preserve the existing premium/achievement visual language rather than introducing a new billing visual language.
- Paid presentation must remain consistent with the product's existing rule that premium should not feel like an arbitrary decorative badge.
- Do not fake payment UI.
- Do not reproduce Lemon Squeezy's entire checkout inside Achivii unless there is an explicit product decision to use a custom checkout experience.
- Clearly distinguish Achivii UI from the external/provider checkout experience.

---

## 19. Existing System Integrations

### Authentication
Relationship: Subscription ownership is tied to the authenticated Achivii user.
Required behavior: Checkout initiation and entitlement synchronization must associate provider data with the correct user.

### Custom Goals / Custom Journeys
Relationship: This is the primary paid capability currently identified in the product decisions.
Required behavior: Access should be controlled by a real server-side entitlement once payments are active. Existing custom goals remain supported according to the current grandfathering decision.

### Pathways
Relationship: Certified preset pathways are currently free.
Required behavior: Payment integration must not accidentally gate existing free preset functionality.

### Account
Relationship: Subscription state and management should be discoverable from the user's account/billing experience.

### Existing design system
Relationship: All billing-related in-app experiences must follow the existing visual and accessibility system.

---

## 20. Backend / Persistence Requirement

Yes.

The feature requires persistent server-side data because paid access must survive refreshes, sessions, and devices, and because client-side-only gating is not secure.

The server must be able to:

- associate provider identities with Achivii users;
- receive and verify Lemon Squeezy webhook events;
- synchronize subscription state;
- determine entitlements;
- enforce paid access;
- handle repeated/out-of-order webhook delivery safely;
- retain enough provider state to recover from synchronization problems.

Exact routes, schema, files, and implementation architecture are intentionally left to the roadmap/implementation stage.

---

## 21. External Services

### Service: Lemon Squeezy
Why required: International checkout, subscription billing, Merchant of Record responsibilities, payment collection, subscription state, and payout infrastructure.
What behavior depends on it: Purchase, recurring billing, subscription lifecycle, payment state, and provider-side subscription management.
Required or optional: Required.

Lemon Squeezy currently documents hosted/overlay checkout, API-created checkouts, custom checkout data, subscription management, and signed webhooks. Its supported-country documentation currently lists Ethiopia for bank payouts.

---

## 22. Notifications

### Provider notifications
Lemon Squeezy handles its own customer payment/subscription communications.

### Achivii notifications
Not required for the initial feature unless explicitly decided.

If Achivii later sends its own billing emails/in-app notifications, the exact events and copy should be defined separately.

---

## 23. Analytics

Analytics are not part of this feature definition unless existing product analytics requirements explicitly require billing events.

Do not invent analytics events as part of the payment implementation.

---

## 24. Performance Requirements

- Starting checkout should provide immediate user feedback.
- The application should not block normal authenticated use while waiting indefinitely for provider synchronization.
- Webhook processing should be reliable enough to return successful responses promptly and process events safely.
- Temporary provider latency must not make the rest of Achivii unusable.

---

## 25. Security / Privacy

- Lemon Squeezy API credentials must remain server-side.
- Webhook signatures must be verified.
- Client-side requests must never be trusted as proof of payment.
- Users must only access their own subscription information and entitlements.
- Provider identifiers must not expose unnecessary sensitive information in public responses.
- Payment card details should not be stored by Achivii; payment collection remains with Lemon Squeezy.
- Webhook processing must defend against replay/duplicate events and unauthorized requests.
- Subscription state changes must be based on trusted provider data.

---

## 26. Failure Behavior

### Checkout start
Normal outcome: A valid Lemon Squeezy checkout is opened for the intended user and plan.
Failure outcome: Achivii reports that checkout could not be started.
Recovery: User can retry.

### Webhook
Normal outcome: Signed event is accepted, processed idempotently, and returns HTTP 200.
Failure outcome: Event is rejected or safely retried if invalid/unprocessable.
Recovery: Lemon Squeezy retry behavior and/or provider dashboard resend can be used.

### Entitlement synchronization
Normal outcome: Local subscription/access state matches the latest verified provider state.
Failure outcome: Last verified state remains in effect while synchronization is retried.
Recovery: Reprocess the event or reconcile against provider data.

### Provider unavailable
Normal outcome: Existing verified access continues according to the last known valid state.
Failure outcome: New checkout or management operations may be temporarily unavailable.
Recovery: Retry once provider access returns.

---

## 27. In Scope

- Lemon Squeezy as Achivii's initial international subscription/payment provider.
- Real paid-plan representation.
- Lemon Squeezy subscription checkout.
- Association of checkout/subscription with the authenticated Achivii user.
- Server-side subscription persistence.
- Signed webhook reception and validation.
- Subscription lifecycle synchronization.
- Server-side entitlement enforcement.
- Paid feature gating.
- Subscription/account state display.
- Subscription management entry point.
- Handling cancellation, renewal, payment failure, recovery, and expiration states relevant to access.
- Mobile and accessibility behavior for the in-app billing experience.
- Test-mode integration and provider-event validation before production release.
- Production configuration only after Lemon Squeezy merchant/store onboarding is successfully completed.

---

## 28. Out of Scope

- Stripe Payments integration.
- Building a custom payment processor.
- Storing card numbers or payment credentials.
- Ethiopian-local payment gateways as an alternative provider.
- Building a tax engine.
- Recreating Lemon Squeezy's full hosted checkout UI inside Achivii.
- Internal payout accounting for CBE.
- Custom invoicing/tax infrastructure that Lemon Squeezy already provides as Merchant of Record.
- Affiliate/referral systems.
- Coupons/discounts unless specifically required by the final pricing definition.
- Usage-based billing unless specifically required by the final product model.
- Multiple payment providers in the first implementation.
- Provider abstraction for multiple interchangeable providers unless architecture requires a minimal boundary to prevent product coupling.

---

## 29. Future / Deferred

- Additional payment providers.
- Provider failover.
- Multiple currencies/pricing localization beyond what is required for launch.
- Advanced coupons and promotional pricing.
- Usage-based billing.
- Team/business plans.
- Affiliate revenue sharing.
- Advanced billing analytics.
- In-app billing invoices/history beyond what the product actually needs.
- Automated billing emails from Achivii.
- Advanced plan experimentation.

---

## 30. Non-Negotiables

### N-1
Paid access must be enforced server-side.

### N-2
A browser redirect or client-side success state must never be sufficient proof of payment.

### N-3
Lemon Squeezy webhook signatures must be validated.

### N-4
Webhook processing must be idempotent.

### N-5
Existing free Achivii functionality must not become accidentally paid.

### N-6
The application must not expose or store customer card details.

### N-7
The feature must work for international customers while retaining a payout path available to the Ethiopian seller.

### N-8
The integration must preserve the existing Achivii product/design system.

### N-9
No production payment flow should be enabled until the Lemon Squeezy seller/store onboarding and payout setup are actually confirmed.

---

## 31. Success Criteria

- A user can view an accurate paid plan.
- A user can start a real Lemon Squeezy subscription checkout.
- A completed subscription is associated with the correct Achivii account.
- Paid access becomes available only after trusted subscription state is recorded.
- A renewal keeps the user entitled.
- A cancellation at period end keeps access until the valid end date.
- An expiration removes paid access.
- A failed renewal follows the explicitly defined payment-recovery rule without accidental immediate revocation.
- Repeated webhook delivery does not corrupt state.
- Invalid webhook signatures cannot change entitlements.
- Users cannot grant themselves paid access.
- Existing free pathways continue to work.
- Existing custom goals remain supported according to the grandfathering rule.
- The billing experience works on mobile.
- The billing experience is accessible.
- Test-mode subscription lifecycle events can be verified before production.
- Production seller onboarding and Ethiopian bank payout setup are confirmed before launch.

---

## 32. Acceptance Criteria

### AC-1 — Plan visibility
Given the user encounters a paid Achivii capability,
when the paid offer is displayed,
then the plan name, price, billing interval, and included paid capabilities are accurate.

### AC-2 — Checkout
Given an authenticated user selects a paid plan,
when they choose to purchase,
then Achivii starts a Lemon Squeezy checkout associated with that user and the intended plan.

### AC-3 — No false entitlement
Given the user has started or completed a browser checkout return,
when Achivii has not yet verified the corresponding subscription state,
then paid access is not granted solely from the browser return.

### AC-4 — Successful subscription
Given Lemon Squeezy reports a valid subscription for an Achivii user,
when the signed webhook is processed successfully,
then the user's verified subscription state and entitlement reflect the purchased plan.

### AC-5 — Invalid webhook
Given a webhook request has an invalid signature,
when Achivii receives it,
then the event cannot change subscription or entitlement state.

### AC-6 — Duplicate webhook
Given the same valid webhook is delivered more than once,
when Achivii processes the duplicate,
then the final subscription/entitlement state remains correct and no duplicate side effect is created.

### AC-7 — Renewal
Given a user has an active subscription,
when a valid renewal event is received,
then the subscription remains active and its relevant renewal information is updated.

### AC-8 — Cancellation
Given a subscription is cancelled but remains valid through the current billing period,
when Achivii receives the cancellation state,
then the user retains paid access until the provider-defined end of the valid period.

### AC-9 — Expiration
Given a subscription has expired,
when Achivii receives and processes the verified expiration state,
then paid entitlement is removed.

### AC-10 — Payment failure
Given a renewal payment fails,
when Achivii receives the provider's payment-failure/subscription state,
then Achivii follows the defined recovery/access rule and does not treat a transient failure as an arbitrary immediate expiration.

### AC-11 — User isolation
Given User A has a paid subscription,
when User B accesses their own account,
then User B cannot obtain User A's paid entitlement.

### AC-12 — Provider outage
Given Lemon Squeezy is temporarily unavailable,
when an existing user opens Achivii,
then a previously verified valid entitlement is not removed solely because the provider is temporarily unreachable.

### AC-13 — Free functionality
Given a user has no paid subscription,
when they use an existing free certified pathway,
then the pathway remains usable.

### AC-14 — Grandfathered goals
Given a user created a custom goal before paid gating was introduced,
when the user returns later without a paid subscription,
then the existing custom goal remains supported according to the grandfathering rule.

### AC-15 — Subscription management
Given a user has a manageable subscription,
when they choose subscription management,
then they are given the supported Lemon Squeezy management experience for that subscription.

### AC-16 — Mobile
Given a user accesses billing functionality from a supported mobile viewport,
when they view the offer, start checkout, return, or inspect their subscription state,
then the experience remains usable without hidden or inaccessible primary actions.

### AC-17 — Accessibility
Given a keyboard or assistive-technology user accesses the in-app billing experience,
when they navigate purchase, status, and management actions,
then controls have accessible names, logical focus order, and meaningful state/error feedback.

### AC-18 — Production readiness
Given the application is ready for production payment testing,
when production billing is enabled,
then Lemon Squeezy merchant/store onboarding and the Ethiopian payout configuration have been independently confirmed.

---

## 33. Decisions Already Made

### D-1
Decision: Lemon Squeezy is the initial payment/subscription provider for Achivii's international paid subscriptions.
Reason: It currently documents international subscription capabilities and explicitly lists Ethiopia as supported for bank payouts.

### D-2
Decision: Lemon Squeezy is treated as the external payment/subscription system and Merchant of Record; Achivii owns its own product-level entitlement model.
Reason: Product access should not be coupled directly to provider-specific terminology.

### D-3
Decision: Paid access must be server-side and based on verified provider state.
Reason: Frontend-only gating is bypassable and is not sufficient for paid product access.

### D-4
Decision: Existing custom goals are grandfathered when paid gating is introduced.
Reason: This preserves existing user-created work and matches the established product decision.

### D-5
Decision: Existing free certified pathways remain free.
Reason: Payment integration must not retroactively make existing free functionality paid.

### D-6
Decision: Stripe Payments is not part of this feature.
Reason: Achivii is being designed around a payment route that can support an Ethiopian seller while serving international customers.

### D-7
Decision: Production billing is not considered ready merely because the code works.
Reason: Seller onboarding, KYC, and Ethiopian bank payout configuration must be confirmed before launch.

---

## 34. Open Decisions

### OD-1
Question: What exact paid plan(s) will Achivii sell?
Why it matters: Determines Lemon Squeezy products/variants, entitlements, pricing presentation, and checkout mapping.
What it affects: Product model, checkout, plan switching, marketing, database state.
Blocking: Yes.

### OD-2
Question: What are the exact prices and billing intervals for each paid plan?
Why it matters: The product definition must not invent pricing.
What it affects: Plan presentation, Lemon Squeezy variants, checkout, revenue model.
Blocking: Yes.

### OD-3
Question: Which exact Achivii capabilities belong to each paid plan?
Why it matters: Entitlements cannot be enforced until plan capabilities are explicit.
What it affects: Feature gates, entitlement model, acceptance criteria.
Blocking: Yes.

### OD-4
Question: What is the exact access rule for a subscription in past_due or unpaid state?
Why it matters: Lemon Squeezy supports payment-recovery states, but Achivii needs an explicit product rule for access during recovery.
What it affects: Entitlement state machine and webhook handling.
Blocking: Yes.

### OD-5
Question: Should users be allowed to switch between paid plans from inside Achivii?
Why it matters: Determines whether Achivii needs plan-management flows or only provider-hosted management.
What it affects: UX, subscription management, plan changes, proration expectations.
Blocking: Medium.

### OD-6
Question: Should Achivii show a full billing history/invoice history inside the app, or only current subscription state and provider management?
Why it matters: Determines additional product scope.
What it affects: Account experience and data requirements.
Blocking: No.

### OD-7
Question: Should the first release support coupons/discounts?
Why it matters: Changes plan/pricing and checkout requirements.
What it affects: Checkout and pricing model.
Blocking: No.

### OD-8
Question: What exact payout configuration will be used for the Ethiopian seller account?
Why it matters: Lemon Squeezy currently lists Ethiopia for bank payouts, but production readiness requires the actual seller onboarding and bank payout setup to be completed and confirmed.
What it affects: Launch readiness, operational setup.
Blocking: Yes for production launch; not necessarily for development.

---

## 35. Constraints

- Existing Achivii authentication and user identity must remain intact.
- Existing free product functionality must remain intact.
- Existing custom goals must not be silently removed.
- The application currently has no active billing implementation.
- The previous Stripe billing implementation has been removed and must not be reintroduced.
- The existing Achivii visual design system remains authoritative for in-app billing experiences.
- Backend changes require explicit planning because the repository's current project process treats backend/schema/auth changes as controlled scope.
- Payment credentials and webhook secrets must never be exposed to the frontend.
- The external provider's checkout UI is not fully controlled by Achivii.
- Production payment launch depends on successful Lemon Squeezy seller onboarding and payout configuration.

---

## 36. Regression Requirements

### R-1
Existing capability: User signup/login.
Why it matters: Subscription ownership depends on authenticated identity.
How it should remain unchanged: Existing authentication behavior and session/token handling continue to work.

### R-2
Existing capability: Certified free pathways.
Why it matters: They are the existing free product.
How it should remain unchanged: Users without paid subscriptions can still access them.

### R-3
Existing capability: Existing custom goals.
Why it matters: Users may already have created custom goals before billing exists.
How it should remain unchanged: Existing custom goals remain accessible according to the grandfathering rule.

### R-4
Existing capability: Goal creation and execution.
Why it matters: Billing should gate only explicitly paid capabilities, not break goal execution.
How it should remain unchanged: Paid integration must not alter core goal execution behavior for users who are entitled to use it.

### R-5
Existing capability: Account experience.
Why it matters: Billing state will be added to an existing authenticated account context.
How it should remain unchanged: Existing account/auth functionality continues to work when no subscription exists.

### R-6
Existing capability: Mobile navigation and responsive design.
Why it matters: Billing is a new user journey inside an existing responsive application.
How it should remain unchanged: Existing mobile navigation and content must not be obscured or broken by billing UI.

---

## External Reference Notes

Lemon Squeezy's current documentation confirms:
- Ethiopia is listed among countries supported for bank payouts.
- Checkout can be hosted or overlaid and can be created through the API.
- Custom checkout data can be passed through to webhook events.
- Subscription lifecycle events can be synchronized through signed webhooks.
- Subscription APIs support management actions such as changing plans, cancelling, pausing, and resuming.
- Lemon Squeezy documents its own subscription states including active, past due, unpaid, cancelled, and expired.

These references are used only to establish provider capabilities; product behavior above remains the Achivii product definition.

## 37. Resolved Product Decisions

The following decisions are approved for the initial Lemon Squeezy billing implementation.

### OD-1 � Plan structure
**Decision:** Free + Pro.

Achivii will initially have one paid subscription tier. This keeps the first commercial version understandable and avoids premature multi-tier entitlement complexity.

### OD-2 � Billing intervals
**Decision:** Monthly + yearly.

Both billing intervals may be offered for Pro. Exact production prices remain configurable and must be finalized before launch; the implementation must not hard-code invented pricing.

### OD-3 � Initial paid entitlement
**Decision:** Custom goals are the primary Pro capability.

Existing free functionality remains free. The entitlement model should support additional Pro capabilities later without requiring a redesign of subscription ownership.

### OD-4 � Failed-payment behavior
**Decision:** Follow verified Lemon Squeezy subscription state and allow provider-defined payment recovery before removing entitlement where the provider still considers the subscription entitled.

Achivii must not immediately revoke access merely because a transient payment failure occurs. Final access removal occurs when the authoritative provider state indicates the subscription no longer grants access.

### OD-5 � Plan management
**Decision:** Hybrid/provider-managed management.

Achivii displays the current subscription state and provides a management entry point. Lemon Squeezy handles the detailed subscription-management experience for the initial release.

### OD-6 � Billing history
**Decision:** Minimal in-app billing information.

Achivii shows current plan, status, and relevant next/end billing information. Detailed invoices and billing history remain in the Lemon Squeezy management experience unless later product decisions require otherwise.

### OD-7 � Coupons and discounts
**Decision:** No custom coupon system in V1.

If promotional pricing is required, use Lemon Squeezy's supported commercial mechanisms rather than building an Achivii discount engine.

### OD-8 � Payout setup
**Decision:** Verify the actual Lemon Squeezy seller onboarding and payout setup before production launch.

CBE is the intended initial bank destination, subject to successful confirmation that the user's account can receive the required international payout and that Lemon Squeezy accepts the provided bank details during seller onboarding.

### Additional � Cancellation
**Decision:** Cancellation is effective at the end of the current entitled period unless the provider state indicates otherwise.

A cancellation request does not immediately destroy paid access when the provider continues to consider the subscription valid through its paid period.

### Additional � Premium work after downgrade
**Decision:** Preserve existing premium work; restrict creation of new paid-only work after entitlement ends.

Existing user-created custom goals must not be destructively deleted solely because a subscription ends. The exact editing/execution behavior of grandfathered premium work follows the existing product decision and must not be silently changed by the billing implementation.

### Additional � Billing source of truth
**Decision:** Lemon Squeezy is authoritative for payment/subscription state; Achivii is authoritative for product entitlements.

The intended synchronization model is:

Lemon Squeezy ? verified webhook/provider state ? Achivii subscription record ? Achivii entitlement ? feature access.

### Additional � Checkout
**Decision:** Use Lemon Squeezy hosted checkout for V1.

Achivii starts the checkout and associates it with the authenticated user. The payment UI itself remains provider-hosted rather than being rebuilt inside Achivii.

---

## 38. Updated Success Criteria From Resolved Decisions

- There is exactly one initial paid tier: Pro.
- Pro supports monthly and yearly billing variants.
- Custom goals are the primary paid capability.
- Free certified pathways and existing free functionality remain free.
- Failed payments follow verified provider recovery/state behavior rather than an arbitrary immediate downgrade.
- Cancellation preserves entitlement through the provider-defined valid period.
- Existing premium work is preserved after entitlement ends.
- Detailed subscription management is delegated to Lemon Squeezy for V1.
- Achivii does not implement a custom coupon engine.
- Production launch requires successful seller verification and payout setup.
- Checkout is provider-hosted.
