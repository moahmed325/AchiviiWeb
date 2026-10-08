# ACHIVII — LEMON SQUEEZY BILLING IMPLEMENTATION PROMPTS

### Copy-paste-ready implementation prompts for every payment milestone

**Source of truth**
- `docs/features/billing/03-feature.md` — what the payment feature must do.
- `docs/features/billing/04-phases.md` — phase order, scope, milestones, exit criteria.
- `docs/decisions.md` — decisions that must not be reversed.
- `CLAUDE.md` ("Working on a milestone") — the shared rules for implementing a milestone.
- Repository code — current implementation truth.

**Important:** This file is intentionally separate from the existing redesign `docs/archive/redesign-v1/prompts.md`. It prevents the payment implementation prompts from overwriting or contaminating the redesign execution system.

---

# PART A — PAYMENT IMPLEMENTATION SYSTEM PROMPT

Use this once at the beginning of a coding-agent session.

```text
ACHIVII — LEMON SQUEEZY BILLING IMPLEMENTATION AGENT

You are the implementation agent responsible for Achivii's Lemon Squeezy billing feature.

Your job is to implement ONLY the milestone you are explicitly given, verify it, report evidence, and stop.

SOURCES OF TRUTH
1. docs/features/billing/03-feature.md
2. docs/features/billing/04-phases.md
3. docs/decisions.md
4. CLAUDE.md ("Working on a milestone")
5. Existing repository implementation

The repository is the source of truth for what currently exists.
The payment feature definition is the source of truth for intended product behavior.
phases.md is the source of truth for sequence, scope and milestone exit criteria.
decisions.md is the source of truth for resolved decisions.

If these disagree:
- identify the disagreement;
- do not silently choose;
- use the newest verified state where unambiguous;
- otherwise stop and ask for clarification.

PERMANENT PAYMENT DECISIONS
- Provider: Lemon Squeezy.
- No Stripe.
- Initial commercial model: Free + Pro.
- Pro supports monthly and yearly variants.
- Custom goals are the primary paid capability.
- Certified/free pathways remain free.
- Existing premium/custom work is preserved after entitlement ends.
- Cancellation does not immediately remove access when the provider still considers the subscription entitled.
- Lemon Squeezy is authoritative for payment/subscription state.
- Achivii is authoritative for product entitlements.
- Hosted Lemon Squeezy checkout is used for V1.
- Detailed subscription management is provider-managed.
- No custom coupon engine.
- Production payout to CBE is intended but must be verified through actual seller onboarding; documentation-only claims are not enough.
- Exact production prices are still open until explicitly configured.

SECURITY
- Provider API credentials and webhook secrets are server-only.
- Never store card/payment credentials.
- Never trust a browser return as proof of payment.
- Never let the frontend grant Pro.
- Webhooks must be signature-verified.
- Webhook processing must be idempotent.
- A user may access only their own subscription and entitlement.
- Do not log secrets or unnecessary sensitive payment data.

SCOPE
- Work only on the supplied milestone.
- Do not begin another milestone.
- Do not refactor unrelated code.
- Do not introduce another payment provider.
- Do not add multi-tier pricing, coupons, invoices, affiliates, team billing or usage billing.
- Do not redesign unrelated Achivii screens.
- Do not invent final prices.
- Do not create fake payment states or fake billing data.

EXISTING PRODUCT PROTECTION
Preserve authentication, free pathways, existing journey execution, existing goal data, onboarding behavior, daily tasks, reviews, progress, achievement behavior and responsive/accessibility behavior unless the current milestone explicitly changes a named billing boundary.

BACKEND RULE
Backend changes are allowed only where the phase explicitly grants them. Prefer existing project patterns. Keep Lemon Squeezy behind a provider-specific integration boundary; product code should consume internal subscription/entitlement concepts rather than scattered provider status strings.

IMPLEMENTATION DISCIPLINE
Before editing:
1. Check git status.
2. Read the relevant phase and milestone.
3. Read the feature definition sections relevant to the milestone.
4. Read relevant decisions.
5. Inspect the actual repository files and tests.
6. Confirm the milestone's dependencies are complete.

While editing:
- Re-read files immediately before changing them.
- Keep changes minimal and coherent.
- Do not weaken tests to make them pass.
- Do not claim verification you did not perform.
- If a required decision is unresolved, stop rather than guess.
- If an unrelated bug is found, record it as a carry-over instead of silently fixing it.

VALIDATION
Use the repository's real commands and patterns. Relevant known commands include:
- npm run build
- npm run build --workspace=backend
- npm run test --workspace=backend
- npm run build --workspace=frontend
- npm run lint --workspace=frontend
- npm run test --workspace=frontend

Use provider-supported Lemon Squeezy test-mode mechanisms for provider behavior. Never call test-mode success production success.

COMPLETION
A milestone is complete only when:
1. Requirements are implemented.
2. Acceptance criteria are verified.
3. Relevant tests pass.
4. Regression checks pass.
5. Manual/browser verification required by the milestone passes.
6. Known limitations are recorded.
7. Documentation is updated only where required.
8. git status is reported.

Do not commit or push unless explicitly instructed.

FINAL REPORT
Return:
- Summary
- Files changed
- Requirements completed
- Requirements not completed
- Tests run/results
- Build/type-check/lint results
- Browser/provider verification
- Regression results
- Documentation changes
- Carry-overs
- Risks
- Git status
- Confirmation that the next milestone was NOT started
```

---

# PART B — MILESTONE IMPLEMENTATION PROMPTS

## PHASE 0 — BILLING FOUNDATION & PROVIDER CONTRACT

## M0.1 — Provider Contract

```text
# IMPLEMENTATION TASK — M0.1 Provider Contract

## Role
You are the implementation agent responsible for M0.1 of the Achivii Lemon Squeezy billing project.

## Project Context
Achivii is introducing international subscription billing through Lemon Squeezy. The initial model is Free + Pro, with monthly and yearly Pro variants. Custom goals are the primary Pro capability.

Read:
- docs/features/billing/03-feature.md
- docs/features/billing/04-phases.md
- docs/decisions.md
- CLAUDE.md ("Working on a milestone")

Do not reintroduce Stripe.

## Current State
There is no active Lemon Squeezy integration. The repository currently has authentication, goal creation, Prisma/PostgreSQL persistence and existing free product flows, but no billing provider contract.

## Objective
Define and document the exact Lemon Squeezy concepts Achivii will depend on and map them to internal product concepts without coupling the product to provider-specific status strings.

## Requirements
### R1 — Provider concepts
Document the minimum concepts required:
- Store
- Product
- Subscription variant
- Customer
- Checkout
- Subscription
- Webhook event
- Subscription-management URL where applicable

### R2 — Internal mapping
Define how each provider concept maps to Achivii concepts.

### R3 — State mapping
Define the provider subscription states that matter to entitlement and map them to internal states.

### R4 — Verification
Verify provider assumptions against current Lemon Squeezy documentation/API behavior before encoding them.

## Existing Behavior That MUST Remain Unchanged
- Authentication.
- Existing goal creation.
- Certified/free pathways.
- Existing goal persistence.
- Existing UI and API behavior unrelated to billing.

## Files / Areas to Inspect
- docs/features/billing/03-feature.md
- docs/features/billing/04-phases.md
- docs/decisions.md
- backend/src
- backend/prisma/schema.prisma
- backend package/config files

Verify paths before editing.

## Implementation Guidance
Prefer a short provider-contract document or billing-specific type/module if the repository has an appropriate location. Do not create a large abstraction framework.

The internal product model must eventually reason about Pro entitlement, not raw Lemon Squeezy strings.

## Explicit Non-Goals
- No database migration.
- No checkout route.
- No webhook route.
- No UI.
- No goal gating.
- No Stripe.
- No production payout implementation.

## Acceptance Criteria
- Lemon Squeezy concepts required by Achivii are explicitly defined.
- Internal/product concepts are separated from provider terminology.
- Required provider assumptions are verified.
- No unrelated architecture changes are introduced.

## Validation
- Inspect the resulting contract for completeness.
- Verify no secret is committed.
- Run relevant build/type validation if code was added.

## Regression Checks
Confirm authentication and goal behavior are unchanged.

## Documentation
Update payment documentation only where the contract is being established. Do not modify unrelated redesign docs.

## Final Report
Report files changed, provider assumptions verified, unresolved questions, tests/validation, carry-overs and git status.

STOP. Do not start M0.2.
```

## M0.2 — Configuration Boundary

```text
# IMPLEMENTATION TASK — M0.2 Configuration Boundary

## Role
Implement the Lemon Squeezy configuration boundary for Achivii.

## Context
M0.1 established the provider contract. Achivii needs separate test/production configuration without exposing provider secrets to the browser.

Read the payment feature definition and Phase 0 before editing.

## Objective
Create the smallest safe server-side configuration boundary for Lemon Squeezy.

## Requirements
### R1
Identify configuration values actually required by the verified provider contract.

### R2
Separate test/development values from production values.

### R3
Keep API credentials and webhook signing secrets server-only.

### R4
Add environment/config validation consistent with existing project conventions.

### R5
Document required environment variables without committing secrets.

## Existing Behavior That MUST Remain Unchanged
All existing auth, goal, API and frontend behavior.

## Files / Areas to Inspect
- Existing backend configuration/env loading.
- backend package files.
- .env.example or equivalent.
- M0.1 billing contract.

## Implementation Guidance
Use existing configuration patterns. Do not introduce a new configuration framework unless the repository requires it.

## Explicit Non-Goals
- No checkout endpoint.
- No webhook endpoint.
- No schema changes.
- No UI.
- No production payout code.

## Acceptance Criteria
- Required billing configuration has one clear server-side source.
- Secrets cannot be imported into frontend code.
- Missing required configuration fails clearly where appropriate.
- Test and production configurations cannot be confused.
- No secret is committed.

## Validation
Run relevant backend type/build checks and inspect the generated/configured frontend bundle if necessary to confirm secrets are absent.

## Regression
Existing backend startup and auth flows remain functional.

## Final Report
Include configuration names, files changed, validation evidence and git status.

STOP. Do not start M0.3.
```

## M0.3 — Checkout Identity Contract

```text
# IMPLEMENTATION TASK — M0.3 Checkout Identity Contract

## Objective
Define the trusted association between an authenticated Achivii user and a Lemon Squeezy checkout/subscription.

## Requirements
### R1
Trace the existing authenticated-user identity mechanism.

### R2
Define exactly how a checkout initiated by a user is associated with that user's Achivii ID.

### R3
Ensure the association survives webhook delivery without relying on browser return.

### R4
Account for browser return, different devices and missing browser return.

### R5
Define the data that may safely be sent as checkout metadata/custom data and what must remain server-side.

## Inspect
- Existing auth middleware/helpers.
- User model.
- Backend route conventions.
- M0.1 provider contract.
- M0.2 configuration.

## Non-Goals
No checkout implementation, schema migration, webhook endpoint or frontend UI.

## Acceptance Criteria
- User identity association is unambiguous.
- Webhooks can resolve the intended Achivii user without trusting the browser.
- No sensitive data is put into provider metadata.
- The approach fits existing auth architecture.

## Validation
Trace one authenticated request from JWT/user resolution through the planned checkout and webhook association. Document exact fields and lookup path.

STOP. Do not start M0.4.
```

## M0.4 — Provider State Mapping

```text
# IMPLEMENTATION TASK — M0.4 Provider State Mapping

## Objective
Finalize the mapping from verified Lemon Squeezy subscription states to Achivii billing/entitlement states.

## Requirements
### R1
Identify provider lifecycle states relevant to Achivii.
### R2
Define Achivii's minimal internal subscription states.
### R3
Define entitlement behavior for active, cancellation-at-period-end, recovery/past-due and expired/unpaid states.
### R4
Define behavior for invalid, unsupported or unknown provider states.
### R5
Ensure provider-specific state strings do not leak into product authorization logic.

## Inspect
- Feature definition failure/lifecycle rules.
- M0.1–M0.3.
- Existing decisions.md.
- Planned subscription model.

## Non-Goals
No database migration, webhook endpoint, checkout or UI.

## Acceptance Criteria
A developer can determine, from the mapping alone, whether a user should have Pro entitlement for each supported lifecycle state.

## Validation
Review each state against the feature definition and record ambiguities rather than guessing.

STOP. Phase 0 is not complete until all four milestones are complete.
```

---

# PHASE 1 — SUBSCRIPTION PERSISTENCE & ENTITLEMENT MODEL

## M1.1 — Subscription Data Model

```text
# IMPLEMENTATION TASK — M1.1 Subscription Data Model

## Objective
Add the minimum durable Prisma/PostgreSQL model needed to associate Achivii users with Lemon Squeezy subscriptions.

## Requirements
### R1
Model ownership by Achivii user.
### R2
Persist provider customer/subscription identifiers required by the contract.
### R3
Persist plan/variant identity.
### R4
Persist provider subscription status.
### R5
Persist relevant billing-period/cancellation timestamps.
### R6
Add appropriate uniqueness constraints and indexes.
### R7
Do not store card/payment credentials.

## Inspect
- backend/prisma/schema.prisma
- Existing User model and relationships.
- M0 provider contract/state mapping.
- Existing migration conventions.

## Backend Allowance
Only billing-related schema/model changes are allowed.

## Non-Goals
No checkout, webhook route, UI, goal gating or unrelated schema refactor.

## Acceptance Criteria
- A subscription belongs unambiguously to an Achivii user.
- Provider identifiers are queryable.
- Duplicate provider subscription ownership is prevented.
- Existing schema records migrate safely.

## Validation
Create/run the migration using the project's normal workflow. Run backend tests/build and verify existing user/goal records remain readable.

STOP. Do not start M1.2.
```

## M1.2 — Event Idempotency Model

```text
# IMPLEMENTATION TASK — M1.2 Event Idempotency Model

## Objective
Create durable storage/support for safe processing of repeated Lemon Squeezy webhook deliveries.

## Requirements
### R1
Identify the provider event identifier available for idempotency.
### R2
Persist enough information to detect an already-processed event.
### R3
Prevent duplicate side effects.
### R4
Use database constraints where appropriate.
### R5
Do not treat event idempotency as frontend state.

## Inspect
- Prisma schema.
- Existing unique/event/audit patterns.
- M0.4 state mapping.
- Lemon Squeezy webhook contract.

## Non-Goals
No webhook HTTP endpoint yet.

## Acceptance Criteria
A later webhook handler can atomically determine whether an event has already been processed.

## Validation
Test first insertion, duplicate insertion, concurrent/constraint behavior where practical.

STOP. Do not start M1.3.
```

## M1.3 — Entitlement Service

```text
# IMPLEMENTATION TASK — M1.3 Entitlement Service

## Objective
Create a product-level server service that answers whether an Achivii user currently has Pro entitlement without exposing Lemon Squeezy-specific state logic throughout the application.

## Requirements
### R1
Implement a server-side entitlement lookup for a user.
### R2
Base it on verified persisted subscription state.
### R3
Respect cancellation/end dates and lifecycle rules.
### R4
Unknown/invalid state must not grant access.
### R5
Keep provider-specific status mapping behind the billing boundary.
### R6
Make the service easy for the custom-goal route to consume later.

## Inspect
- Billing schema.
- Existing auth/user service patterns.
- M0.4 state mapping.

## Non-Goals
Do not gate goal creation yet.

## Acceptance Criteria
Given a user's persisted subscription state, the service deterministically returns Pro/not-Pro according to the feature definition.

## Validation
Unit-test active, cancelled-but-entitled, expired, recovery and no-subscription cases.

STOP. Do not start M1.4.
```

## M1.4 — Migration & Persistence Tests

```text
# IMPLEMENTATION TASK — M1.4 Migration and Persistence Tests

## Objective
Prove the Phase 1 billing persistence model works without damaging existing application data.

## Requirements
### R1
Run the billing migration through the normal repository workflow.
### R2
Test subscription creation/update.
### R3
Test lookup by Achivii user.
### R4
Test lookup by provider subscription ID.
### R5
Test duplicate-event persistence.
### R6
Test entitlement derivation.
### R7
Verify existing User/Goal data remains intact.

## Inspect
All Phase 1 billing files plus existing backend test setup.

## Non-Goals
No checkout/webhook route or frontend changes.

## Acceptance Criteria
All billing persistence tests pass and the existing backend suite remains green.

## Validation
Backend tests, build, migration verification and relevant database checks.

STOP. Do not start Phase 2.
```

---

# PHASE 2 — CHECKOUT & WEBHOOK INTEGRATION

## M2.1 — Checkout Creation

```text
# IMPLEMENTATION TASK — M2.1 Checkout Creation

## Objective
Implement an authenticated backend endpoint that creates a Lemon Squeezy checkout for the configured Pro variant and associates it with the current Achivii user.

## Requirements
### R1
Require authenticated user.
### R2
Resolve the intended Pro variant from server-side configuration.
### R3
Associate the checkout with the Achivii user using the M0.3 identity contract.
### R4
Never expose provider API credentials.
### R5
Return only the frontend-safe checkout information required to launch checkout.
### R6
Handle provider errors without granting entitlement.

## Inspect
- Existing auth middleware.
- Backend route registration.
- M0 identity contract.
- M1 subscription model.
- Provider client/config conventions.

## Non-Goals
No webhook route, UI, goal gate or fake success state.

## Acceptance Criteria
An authenticated test-mode user can obtain a valid provider checkout reference/URL; an unauthenticated request is rejected; provider failure does not change entitlement.

## Validation
Backend tests with authenticated/unauthenticated cases and provider test-mode verification.

STOP. Do not start M2.2.
```

## M2.2 — Webhook Endpoint

```text
# IMPLEMENTATION TASK — M2.2 Webhook Endpoint

## Objective
Implement the verified Lemon Squeezy webhook endpoint.

## Requirements
### R1
Receive the raw request body as required for signature verification.
### R2
Verify the Lemon Squeezy webhook signature before changing state.
### R3
Reject invalid signatures.
### R4
Parse supported event types only.
### R5
Use the M0.3 identity association.
### R6
Persist only verified provider state.
### R7
Return provider-appropriate success/failure responses without exposing secrets.

## Inspect
- Existing Express route/body-parser setup.
- M1 persistence/idempotency model.
- Lemon Squeezy webhook documentation.
- M0.4 state mapping.

## Non-Goals
No frontend, goal gating or billing dashboard.

## Acceptance Criteria
Valid signed events can reach the billing handler; invalid signatures cannot mutate subscription state.

## Validation
Signature unit tests, invalid-signature tests, supported-event parsing tests and test-mode webhook delivery.

STOP. Do not start M2.3.
```

## M2.3 — Subscription Lifecycle Handlers

```text
# IMPLEMENTATION TASK — M2.3 Subscription Lifecycle Handlers

## Objective
Translate verified Lemon Squeezy subscription lifecycle events into Achivii subscription persistence.

## Requirements
### R1
Handle initial subscription creation.
### R2
Handle subscription updates.
### R3
Handle renewal-related state/date changes.
### R4
Handle cancellation.
### R5
Handle expiration/unpaid state.
### R6
Handle recovery/past-due state according to M0.4.
### R7
Ignore or safely record unsupported events without changing entitlement.

## Inspect
- M2.2 webhook endpoint.
- M1 schema/service.
- Provider event payloads.
- Feature definition lifecycle rules.

## Non-Goals
No frontend changes or goal gating.

## Acceptance Criteria
Each supported lifecycle event produces the expected local state and entitlement outcome.

## Validation
Provider test-mode event matrix plus backend unit/integration tests.

STOP. Do not start M2.4.
```

## M2.4 — Idempotent Event Processing

```text
# IMPLEMENTATION TASK — M2.4 Idempotent Event Processing

## Objective
Make webhook processing safe under provider retries and duplicate delivery.

## Requirements
### R1
Identify duplicate events by provider event identity.
### R2
Ensure duplicate delivery does not create duplicate subscriptions or side effects.
### R3
Handle database uniqueness/transaction failures safely.
### R4
Do not mark an event processed before its required state change is safely persisted.
### R5
Preserve observable provider lifecycle state.

## Inspect
- M1.2 event model.
- M2.2/M2.3 handlers.
- Existing transaction patterns.

## Acceptance Criteria
Sending the same event multiple times produces one logical state transition.

## Validation
Duplicate-event tests, retry simulation and transaction/error-path tests.

STOP. Do not start M2.5.
```

## M2.5 — Test-Mode Lifecycle Verification

```text
# IMPLEMENTATION TASK — M2.5 Test-Mode Lifecycle Verification

## Objective
Verify the complete provider integration from authenticated checkout through verified webhook and local entitlement state.

## Requirements
### R1
Create a test-mode Pro checkout.
### R2
Complete the provider-supported test purchase/subscription flow.
### R3
Observe and verify webhook delivery.
### R4
Verify local subscription persistence.
### R5
Verify entitlement derivation.
### R6
Test at least one update/cancellation lifecycle transition.
### R7
Record evidence and any provider-specific caveats.

## Non-Goals
Do not perform a production sale or payout.

## Acceptance Criteria
The end-to-end test-mode chain works without frontend-only assumptions.

## Validation
Provider test-mode evidence + backend tests/build.

## Final Report
Include event IDs/subscription references only where safe; never expose secrets.

STOP. Do not start Phase 3.
```

---

# PHASE 3 — SERVER-SIDE PRO ENTITLEMENT ENFORCEMENT

## M3.1 — New Custom-Goal Authorization

```text
# IMPLEMENTATION TASK — M3.1 New Custom-Goal Authorization

## Objective
Require a valid Pro entitlement when an authenticated user creates a new custom goal.

## Requirements
### R1
Identify exactly how the existing goal route distinguishes custom goals from certified/preset pathways.
### R2
Call the server-side entitlement service.
### R3
Reject new custom-goal creation when the user lacks Pro.
### R4
Allow creation for an entitled user.
### R5
Return a stable, explicit authorization/entitlement error.
### R6
Do not rely on frontend locking.

## Inspect
- backend/src/routes/goal.ts
- Existing goal creation helpers/tests.
- M1.3 entitlement service.
- M2 persisted subscription behavior.

## Non-Goals
Do not alter preset pathways, AI generation behavior or existing custom goals yet.

## Acceptance Criteria
A direct API call from a free user cannot create a new custom goal, while an entitled user can.

## Validation
Backend tests for free/Pro users and direct API bypass attempts.

STOP. Do not start M3.2.
```

## M3.2 — Grandfather Existing Custom Goals

```text
# IMPLEMENTATION TASK — M3.2 Grandfather Existing Custom Goals

## Objective
Preserve existing custom goals when paid gating is introduced.

## Requirements
### R1
Determine the safest repository-consistent way to distinguish existing custom work from new creation.
### R2
Existing custom goals must not be deleted.
### R3
Existing custom goals must remain retrievable and usable according to the feature definition.
### R4
Do not grant unlimited future custom-goal creation merely because one existing custom goal exists.
### R5
Add explicit tests for grandfathered behavior.

## Inspect
- Goal schema.
- Goal creation route.
- Goal retrieval/execution routes.
- Existing custom-goal tests.
- M3.1 gate.

## Non-Goals
Do not change unrelated goal execution or introduce a new product tier.

## Acceptance Criteria
A user with an existing grandfathered custom goal retains that work while creation of additional new custom goals remains governed by Pro entitlement.

## Validation
Database fixture + API tests + existing custom-goal flow.

STOP. Do not start M3.3.
```

## M3.3 — Free Pathway Protection

```text
# IMPLEMENTATION TASK — M3.3 Free Pathway Protection

## Objective
Prove that certified/free preset pathways remain available after custom-goal gating.

## Requirements
### R1
Trace preset pathway launch to the backend creation path.
### R2
Ensure the new Pro gate only applies to genuinely custom goals.
### R3
Test free user launching a certified pathway.
### R4
Test Pro user launching the same pathway.
### R5
Verify no accidental entitlement requirement appears.

## Non-Goals
Do not change pathway product logic.

## Acceptance Criteria
Free users can continue using certified/free pathways exactly as before.

## Validation
Backend tests + representative browser launch.

STOP. Do not start M3.4.
```

## M3.4 — Authorization Tests

```text
# IMPLEMENTATION TASK — M3.4 Authorization Test Matrix

## Objective
Complete and harden the server-side billing authorization tests.

## Test Matrix
1. No subscription + new custom goal → denied.
2. Active Pro + new custom goal → allowed.
3. Cancelled but still entitled + new custom goal → allowed.
4. Expired/unpaid/no longer entitled + new custom goal → denied.
5. Existing grandfathered custom goal → preserved.
6. Free certified pathway → allowed.
7. User A cannot use User B's entitlement.
8. Direct API request cannot bypass frontend restrictions.

## Requirements
Use realistic fixtures and existing test conventions.

## Non-Goals
Do not weaken tests or change product behavior to make tests pass.

## Acceptance Criteria
The matrix passes and the existing backend suite remains green.

## Validation
Backend tests/build.

STOP. Do not start Phase 4.
```

---

# PHASE 4 — BILLING UI & PURCHASE JOURNEY

## M4.1 — Pro Presentation

```text
# IMPLEMENTATION TASK — M4.1 Pro Presentation

## Objective
Introduce a clear Achivii-native Pro presentation using real configured billing data.

## Requirements
### R1
Show Pro name and primary paid capability.
### R2
Show monthly/yearly billing options only when configured.
### R3
Never hard-code an invented production price.
### R4
Explain that Custom Goals require Pro.
### R5
Reuse existing design-system primitives.
### R6
Ensure responsive layout at 390px and 360px.

## Inspect
- Existing billing/product surfaces.
- frontend/src/components/ui.
- Existing typography/spacing/tokens.
- Feature definition UI requirements.

## Non-Goals
No custom checkout UI, coupon UI or unrelated redesign.

## Acceptance Criteria
A user can understand what Pro unlocks and what the purchase option represents without misleading claims.

## Validation
Frontend tests, lint, build, desktop/mobile browser check and accessibility check.

STOP. Do not start M4.2.
```

## M4.2 — Paid Feature Gate UI

```text
# IMPLEMENTATION TASK — M4.2 Paid Feature Gate UI

## Objective
Connect the custom-goal creation entry point to the real server-side entitlement state.

## Requirements
### R1
Free user reaching new custom-goal creation sees an honest Pro requirement.
### R2
Provide a path to checkout.
### R3
Pro users retain normal custom-goal creation.
### R4
Certified/free pathways remain unaffected.
### R5
Frontend never becomes the entitlement authority.
### R6
Loading/error states are explicit.

## Inspect
- Existing custom-goal UI.
- API client.
- M3 backend gate.
- Existing dialogs/sheets.

## Non-Goals
No frontend-only lock that substitutes for the backend gate.

## Acceptance Criteria
UI state matches server entitlement and direct API bypass remains impossible.

## Validation
Free/Pro browser flows at desktop and 390px, keyboard/accessibility, frontend tests.

STOP. Do not start M4.3.
```

## M4.3 — Checkout Launch

```text
# IMPLEMENTATION TASK — M4.3 Checkout Launch

## Objective
Connect the Pro purchase CTA to the authenticated Lemon Squeezy checkout endpoint.

## Requirements
### R1
Use the backend checkout route.
### R2
Handle loading.
### R3
Handle provider/API failure with retryable UI.
### R4
Launch only the checkout returned by the trusted backend.
### R5
Do not expose provider API secrets.
### R6
Do not grant Pro when checkout starts.

## Inspect
- M2.1 checkout route.
- Frontend API conventions.
- M4.1/M4.2 components.

## Acceptance Criteria
A free user can launch a real test-mode Lemon Squeezy checkout; failure does not change entitlement.

## Validation
Frontend tests + test-mode browser verification + mobile verification.

STOP. Do not start M4.4.
```

## M4.4 — Return and Synchronization State

```text
# IMPLEMENTATION TASK — M4.4 Checkout Return & Synchronization

## Objective
Handle the browser return from Lemon Squeezy without treating the return itself as proof of payment.

## Requirements
### R1
Detect a legitimate checkout return using the provider-supported mechanism.
### R2
Request authoritative Achivii subscription/entitlement state from the backend.
### R3
Show a pending/synchronizing state when webhook processing has not completed.
### R4
Show Pro success only after verified entitlement.
### R5
Show recoverable failure when entitlement is not verified.
### R6
Ensure refresh does not fabricate success.

## Inspect
- Checkout return route.
- Auth state.
- Billing API.
- M2 webhook lifecycle.

## Non-Goals
No client-side subscription storage as authority.

## Acceptance Criteria
A user returning before the webhook arrives sees a truthful pending state, then sees Pro only after backend verification.

## Validation
Simulate delayed webhook, successful webhook, failed checkout and refresh.

STOP. Do not start M4.5.
```

## M4.5 — Billing/Account State

```text
# IMPLEMENTATION TASK — M4.5 Billing Account State

## Objective
Show minimal authoritative billing status in Achivii.

## Requirements
### R1
Show current plan.
### R2
Show subscription status.
### R3
Show relevant billing/period-end date when available.
### R4
Provide provider-managed subscription management entry when available.
### R5
Do not invent invoices/history.
### R6
Handle no-subscription, pending and expired states.

## Inspect
- Billing API/service.
- Existing account/settings patterns.
- Feature definition billing UI requirements.

## Non-Goals
No custom invoice center, coupon system or full billing dashboard.

## Acceptance Criteria
Billing information displayed in Achivii matches the server's verified state.

## Validation
Frontend tests, browser verification, mobile/accessibility checks.

STOP. Do not start Phase 5.
```

---

# PHASE 5 — SUBSCRIPTION LIFECYCLE & ACCOUNT MANAGEMENT

## M5.1 — Active/Renewed State

```text
# IMPLEMENTATION TASK — M5.1 Active and Renewal State

## Objective
Verify and harden renewal handling so active Pro access continues through valid renewal transitions.

## Requirements
### R1
Process renewal-related provider events.
### R2
Update relevant billing dates.
### R3
Keep entitlement active when provider state remains entitled.
### R4
Do not create duplicate subscriptions.
### R5
Reflect updated dates in account state where supported.

## Validation
Provider test-mode renewal/update events + backend/frontend tests.

## Non-Goals
No new pricing or plan tiers.

STOP. Do not start M5.2.
```

## M5.2 — Cancellation at Period End

```text
# IMPLEMENTATION TASK — M5.2 Cancellation at Period End

## Objective
Implement and verify cancellation behavior where Pro remains available through the provider-defined entitled period.

## Requirements
### R1
Persist cancellation/end-of-period state.
### R2
Keep entitlement while the provider still grants access.
### R3
Show cancellation/end date accurately.
### R4
Remove entitlement only when provider state says the entitlement ended.
### R5
Do not delete premium work.

## Validation
Provider cancellation event + entitlement tests + browser account state.

STOP. Do not start M5.3.
```

## M5.3 — Payment Recovery

```text
# IMPLEMENTATION TASK — M5.3 Payment Recovery

## Objective
Handle payment-failure/recovery states according to verified Lemon Squeezy state rather than arbitrary immediate downgrade.

## Requirements
### R1
Map relevant past-due/recovery state through the established provider-state mapping.
### R2
Do not revoke access merely because a transient failure occurs if provider entitlement remains valid.
### R3
Update state when recovery succeeds.
### R4
Handle eventual loss of entitlement correctly.
### R5
Ensure UI language is honest and non-alarming.

## Validation
Test-mode payment failure/recovery where supported, webhook tests and browser state.

STOP. Do not start M5.4.
```

## M5.4 — Expiration/Unpaid

```text
# IMPLEMENTATION TASK — M5.4 Expiration and Unpaid State

## Objective
Ensure Pro access ends correctly when the provider definitively ends entitlement.

## Requirements
### R1
Process authoritative expiration/unpaid state.
### R2
Persist the final subscription state.
### R3
Entitlement service returns not-Pro.
### R4
New custom goals are denied.
### R5
Existing custom work is preserved according to grandfathering rules.
### R6
Free pathways remain available.

## Validation
Provider event simulation/test mode + backend authorization tests + browser verification.

STOP. Do not start M5.5.
```

## M5.5 — Provider-Managed Subscription Management

```text
# IMPLEMENTATION TASK — M5.5 Provider-Managed Subscription Management

## Objective
Give users a trustworthy way to manage their Lemon Squeezy subscription without building a custom billing-management system.

## Requirements
### R1
Obtain the provider-supported management URL/mechanism.
### R2
Expose it only to the correct authenticated user.
### R3
Handle unavailable management URL safely.
### R4
Explain that management occurs through the payment provider.
### R5
Preserve Achivii's authoritative local subscription state.

## Non-Goals
No custom plan-switching UI, invoices or payment-method storage.

## Validation
Authenticated browser flow, mobile flow and authorization tests.

STOP. Do not start M5.6.
```

## M5.6 — Reconciliation

```text
# IMPLEMENTATION TASK — M5.6 Billing Reconciliation

## Objective
Provide a safe recovery path when local billing state can drift from Lemon Squeezy because of missed webhooks, temporary outages or browser/webhook timing.

## Requirements
### R1
Identify a justified reconciliation trigger/mechanism.
### R2
Use authenticated server-side provider communication.
### R3
Never let the browser directly assert subscription state.
### R4
Do not undermine webhook idempotency.
### R5
Update local state only from verified provider state.
### R6
Handle provider unavailable/errors without falsely granting Pro.
### R7
Record sufficient operational information for debugging without secrets.

## Inspect
- Provider service.
- Webhook handler.
- Entitlement service.
- Account billing endpoint.
- Existing backend operational patterns.

## Non-Goals
Do not introduce broad job/scheduler infrastructure unless clearly required and separately approved.

## Acceptance Criteria
A missed/delayed webhook can be safely reconciled; a provider outage cannot cause false Pro access.

## Validation
Simulate stale local state, successful reconciliation, provider error and repeated reconciliation.

STOP. Do not start Phase 6.
```

---

# PHASE 6 — VALIDATION, SECURITY & PRODUCTION READINESS

## M6.1 — Automated Validation

```text
# IMPLEMENTATION TASK — M6.1 Automated Validation

## Objective
Run the complete relevant automated validation suite for the billing feature.

## Requirements
Run and record:
- root build where applicable;
- backend build;
- backend tests;
- frontend build;
- frontend lint;
- frontend tests;
- Playwright/browser tests if configured.

Do not modify code merely to hide failures.

## Acceptance Criteria
All required checks pass, or every failure is explicitly classified as a real carry-over/blocker.

## Non-Goals
No new feature work.

STOP. Do not start M6.2.
```

## M6.2 — Security Validation

```text
# IMPLEMENTATION TASK — M6.2 Billing Security Validation

## Objective
Perform a focused security review of the complete Lemon Squeezy integration.

## Requirements
Verify:
### R1
Provider secrets are server-only.
### R2
Webhook signatures are mandatory.
### R3
Invalid/replayed events cannot grant access.
### R4
Frontend cannot grant Pro.
### R5
Users cannot access another user's billing state.
### R6
Users cannot use another user's entitlement.
### R7
No card/payment credentials are stored.
### R8
Logs do not expose secrets or unnecessary sensitive payment data.
### R9
Checkout association cannot be forged through client input.

## Validation
Use code inspection plus automated/security tests. Attempt safe negative authorization tests.

## Acceptance Criteria
No critical billing security flaw remains unresolved.

STOP. Do not start M6.3.
```

## M6.3 — Lifecycle Matrix

```text
# IMPLEMENTATION TASK — M6.3 Billing Lifecycle Matrix

## Objective
Execute the full lifecycle matrix defined in docs/features/billing/04-phases.md.

## Matrix
1. No subscription → Free.
2. Checkout started → no Pro until verified.
3. Active Pro → Pro.
4. Renewal → Pro remains active.
5. Cancelled but period valid → Pro remains active.
6. Recovery/past-due → provider-defined entitlement behavior.
7. Unpaid/expired → Pro removed.
8. Invalid webhook → no state change.
9. Duplicate webhook → no duplicate side effect.
10. Provider unavailable → last verified entitlement preserved.
11. Existing grandfathered custom goal → preserved.
12. New custom goal without Pro → denied.
13. Certified pathway without Pro → allowed.

## Acceptance Criteria
Every row has evidence and the observed result matches the feature definition.

## Validation
Use automated tests plus provider test-mode/manual verification where necessary.

STOP. Do not start M6.4.
```

## M6.4 — Production Provider Readiness

```text
# IMPLEMENTATION TASK — M6.4 Production Provider Readiness

## Objective
Prepare Lemon Squeezy production configuration without enabling sales until every prerequisite is verified.

## Blocking Decisions
- OD-2 exact production pricing.
- OD-8 actual Ethiopian payout configuration.

## Requirements
### R1
Complete/verify seller/store onboarding.
### R2
Configure production Pro product.
### R3
Configure monthly Pro variant.
### R4
Configure yearly Pro variant.
### R5
Set final approved prices.
### R6
Configure production credentials securely.
### R7
Configure production webhook signing secret/endpoint.
### R8
Verify the Ethiopian payout destination through actual seller onboarding.
### R9
Verify CBE receiving requirements with the relevant bank process.
### R10
Do not claim payout support solely from a website/documentation statement.

## Non-Goals
No uncontrolled production transaction.

## Acceptance Criteria
Production provider configuration is complete and independently verified.

STOP. Do not start M6.5.
```

## M6.5 — Production Smoke Test

```text
# IMPLEMENTATION TASK — M6.5 Production Smoke Test

## Objective
Perform a controlled production verification of the entire payment path.

## Requirements
Verify:
1. Customer reaches production checkout.
2. Payment/subscription is created.
3. Production webhook arrives and verifies.
4. Achivii subscription record updates.
5. Pro entitlement is granted only after verification.
6. Custom goal creation works for entitled user.
7. Subscription management works.
8. Payout/account operational setup is valid according to the approved launch procedure.

## Safety
Use the smallest safe controlled transaction/test procedure supported by Lemon Squeezy. Do not perform uncontrolled transactions or expose customer/payment data.

## Acceptance Criteria
Every step has evidence. Any failure blocks launch.

STOP. Do not start M6.6.
```

## M6.6 — Launch and Rollback Readiness

```text
# IMPLEMENTATION TASK — M6.6 Launch and Rollback Readiness

## Objective
Finalize the operational procedure for enabling Achivii subscriptions safely.

## Requirements
### R1
Document how new purchases can be disabled.
### R2
Document webhook failure diagnosis.
### R3
Document subscription-state reconciliation.
### R4
Document provider-outage behavior.
### R5
Document credential rotation procedure.
### R6
Define conditions that require disabling new purchases.
### R7
Verify all feature acceptance criteria.
### R8
Verify all regression requirements.
### R9
Verify final pricing and payout onboarding.
### R10
Confirm the next redesign/payment phase is not started automatically.

## Acceptance Criteria
The team has a concrete launch checklist and rollback/disable procedure, and all production blockers are cleared.

## Final Validation
Run the complete test/build/browser/security/lifecycle matrix.

STOP. Payment implementation is complete only after the Phase 6 report confirms every exit criterion.
```

---

# PART C — EXECUTION RULE

For any milestone, send the System Prompt once, then send the exact milestone prompt.

The coding agent must:

1. Read the relevant source-of-truth documents.
2. Inspect the actual repository.
3. Confirm dependencies and decisions.
4. Implement only the specified milestone.
5. Validate it.
6. Report evidence.
7. Stop.

Do not send the next milestone until the current milestone has been reviewed and accepted.

---

# PART D — MILESTONE INDEX

| Phase | Milestones |
|---|---|
| PHASE 0 | M0.1 Provider Contract · M0.2 Configuration Boundary · M0.3 Checkout Identity Contract · M0.4 Provider State Mapping |
| PHASE 1 | M1.1 Subscription Data Model · M1.2 Event Idempotency Model · M1.3 Entitlement Service · M1.4 Migration & Persistence Tests |
| PHASE 2 | M2.1 Checkout Creation · M2.2 Webhook Endpoint · M2.3 Subscription Lifecycle Handlers · M2.4 Idempotent Event Processing · M2.5 Test-Mode Lifecycle Verification |
| PHASE 3 | M3.1 New Custom-Goal Authorization · M3.2 Grandfather Existing Custom Goals · M3.3 Free Pathway Protection · M3.4 Authorization Tests |
| PHASE 4 | M4.1 Pro Presentation · M4.2 Paid Feature Gate UI · M4.3 Checkout Launch · M4.4 Return & Synchronization · M4.5 Billing/Account State |
| PHASE 5 | M5.1 Active/Renewed State · M5.2 Cancellation at Period End · M5.3 Payment Recovery · M5.4 Expiration/Unpaid · M5.5 Provider-Managed Management · M5.6 Reconciliation |
| PHASE 6 | M6.1 Automated Validation · M6.2 Security Validation · M6.3 Lifecycle Matrix · M6.4 Production Provider Readiness · M6.5 Production Smoke Test · M6.6 Launch/Rollback Readiness |

**Total: 34 implementation milestones.**

---

# CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-29 | Created dedicated Lemon Squeezy payment implementation prompt system from the project's implementation prompt template and payment phases. |
| 2026-09-29 | Added one copy-paste-ready implementation prompt for every payment milestone M0.1–M6.6. |
| 2026-09-29 | Explicitly separated payment prompts from the existing redesign `docs/archive/redesign-v1/prompts.md` to avoid overwriting the redesign execution system. |
