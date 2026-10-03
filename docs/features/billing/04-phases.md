# ACHIVII — LEMON SQUEEZY BILLING IMPLEMENTATION PHASES

### Roadmap, milestones and exit criteria

**Feature:** Lemon Squeezy subscription billing for international Achivii subscriptions  
**Primary paid capability:** Custom goals  
**Initial commercial model:** Free + Pro, monthly + yearly  
**Provider:** Lemon Squeezy  
**Payout destination:** Intended Ethiopian bank account (CBE), subject to production onboarding verification  
**Current position:** Feature definition approved; implementation has not started.

## Source-of-truth documents

- `docs/features/billing/03-feature.md` — authoritative feature behavior, product decisions, acceptance criteria, constraints, and resolved/open decisions.
- `docs/templates/04-phases.md` — roadmap structure and implementation discipline.
- `docs/decisions.md` — existing Achivii product/architecture decisions, including the prior decision that payments were deferred from the redesign.
- `docs/product/visual-design-system.md` — existing visual rules.
- `Design.md` / `docs/product/redesign-blueprint.md` — existing product/design context where relevant.
- Repository implementation — authoritative for what currently exists in code.

### Important historical context

The earlier redesign decision explicitly deferred real payments. This roadmap is a **new payment project after that redesign**, not a reopening of the previous redesign scope. The previous Stripe payment work was removed. This roadmap must not reintroduce Stripe.

---

# 0 — HOW TO READ THIS FILE

## Status legend

| Status | Meaning |
|---|---|
| `NOT STARTED` | No work has begun. |
| `IN PROGRESS` | The phase is currently being implemented. |
| `PARTIAL` | Some milestones are complete while others remain. |
| `COMPLETE` | Exit criteria are met and required validation/review has occurred. |
| `BLOCKED` | A required decision or dependency prevents the phase from proceeding. |

No phase becomes `COMPLETE` merely because code exists.

## Identifiers

- Phases: `PHASE 0`, `PHASE 1`, etc.
- Milestones: `M0.1`, `M1.1`, etc.
- Feature requirements: `FR-n` where useful.
- Open decisions: `OD-n`.
- New decisions: `ND-n`.
- Regression requirements: `R-n`.
- Acceptance criteria: `AC-n` from the feature definition.

## Anatomy of a phase

Every phase contains:

1. Status
2. Source
3. Objective
4. Narrative line
5. Current state
6. Decisions required before starting
7. In scope
8. Out of scope
9. Backend / architecture allowance
10. Files likely affected
11. Milestones
12. Regression checks
13. Mobile acceptance
14. Accessibility
15. Validation
16. Exit criteria
17. Risks
18. Completion evidence, once implemented

---

# 1 — STATUS AT A GLANCE

| # | Phase | Status | Depends on | Decisions blocking start | Backend / architecture allowance |
|---|---|---|---|---|---|
| PHASE 0 | Billing foundation & provider contract | NOT STARTED | Feature definition | None for test-mode implementation; OD-2 blocks production pricing configuration | Configuration/contracts only; no unrelated architecture changes |
| PHASE 1 | Subscription persistence & entitlement model | NOT STARTED | PHASE 0 | None | Prisma schema + migration for billing state |
| PHASE 2 | Lemon Squeezy checkout & webhook integration | NOT STARTED | PHASE 1 | Provider store/test credentials; production payout onboarding is not required for test mode | Billing routes, provider integration, webhook processing |
| PHASE 3 | Server-side Pro entitlement enforcement | NOT STARTED | PHASE 1 + PHASE 2 | None | Goal creation authorization and billing entitlement service only |
| PHASE 4 | Billing UI & purchase journey | NOT STARTED | PHASE 2 + PHASE 3 | OD-2 exact production pricing before production-facing final copy | Billing pages/components/routes; no redesign of unrelated screens |
| PHASE 5 | Subscription lifecycle & account management | NOT STARTED | PHASE 2 + PHASE 4 | None for provider-managed V1 | Lifecycle reconciliation/management endpoint as required |
| PHASE 6 | Full validation, security, production readiness & launch | NOT STARTED | PHASES 0–5 | OD-2 and OD-8 must be resolved for production launch | Production configuration only; no new product scope |

**Important:** Test-mode implementation may proceed before exact production prices and CBE payout onboarding are complete. Production launch may not.

---

# 2 — ORDER AND DEPENDENCIES

```
PHASE 0
Billing foundation & provider contract
        │
        ▼
PHASE 1
Subscription persistence & entitlement model
        │
        ▼
PHASE 2
Checkout & signed webhook synchronization
        │
        ├──────────────────────┐
        ▼                      ▼
PHASE 3                  PHASE 4
Server entitlement       Billing UI & purchase
enforcement              journey
        │                      │
        └──────────┬───────────┘
                   ▼
                PHASE 5
      Subscription lifecycle & management
                   │
                   ▼
                PHASE 6
 Validation, security & production readiness
```

### Why this order holds

**PHASE 0** establishes the provider-facing contract and prevents implementation from being built around invented provider assumptions.

**PHASE 1** must exist before webhooks can persist subscription state. It also establishes the separation between provider subscription state and Achivii product entitlement.

**PHASE 2** then creates the actual trusted payment integration: checkout creation plus signed webhook synchronization.

**PHASE 3** can enforce paid access only once the backend can reliably determine entitlement.

**PHASE 4** depends on those server capabilities because the UI must not pretend a payment system exists when no trusted backend flow exists.

**PHASE 5** completes the ongoing subscription experience: cancellation, renewal, failed payment states, provider-managed subscription controls, and reconciliation behavior.

**PHASE 6** is deliberately last because production readiness requires the complete system to exist before security, lifecycle, regression, and live-provider validation can be meaningful.

PHASE 3 and PHASE 4 may overlap technically after PHASE 2, but sequential implementation is preferred so the frontend does not build against an unstable entitlement contract.

---

# 3 — RULES FOR EVERY PHASE

## 3.1 One phase at a time

The implementation agent:

1. Works only on the assigned phase.
2. Completes its milestones.
3. Runs the required validation.
4. Produces a completion report.
5. Stops.

It must not automatically begin the next phase.

---

## 3.2 Backend / architecture scope rule

Payment work requires backend changes, but payment work is **not permission to rewrite Achivii**.

The following are protected unless a phase explicitly allows a change:

- Existing authentication behavior.
- Existing goal schema outside billing-related additions.
- Existing goal generation logic.
- Existing AI/research architecture.
- Existing pathway data.
- Existing navigation architecture.
- Existing design system.
- Existing API contracts unrelated to billing.
- Existing user data.
- Existing free functionality.

A phase may modify protected areas only where its **Backend / architecture allowance** explicitly permits it.

No opportunistic refactors.

No "while we're here" architecture migration.

---

## 3.3 Must not break

The following existing capabilities must remain functional:

| ID | Capability | Where it lives | How to verify |
|---|---|---|---|
| R-1 | User signup/login/authentication | `backend/src/routes/auth.ts`, `frontend/src/context/AuthContext.tsx`, auth pages | Existing auth tests + manual login/signup |
| R-2 | Existing custom-goal flow before billing entitlement is active | `backend/src/routes/goal.ts`, onboarding/pathway components | Existing custom-goal tests and authenticated flow |
| R-3 | Certified/free pathways | `frontend/src/components/pathways/`, backend preset logic | Existing pathway tests + launch flow |
| R-4 | Existing goal persistence and execution | `backend/prisma/schema.prisma`, goal routes, journey/today components | Backend/frontend tests + representative goal flow |
| R-5 | Existing account/navigation shell | `frontend/src/components/app/` | Existing component tests + browser verification |
| R-6 | Existing responsive/mobile application | frontend responsive components | Mobile browser verification |
| R-7 | Existing achievement/progress experience | `frontend/src/components/achievement/`, `progress/` | Existing tests + representative authenticated journey |

Billing must gate only the explicitly paid capability. It must not accidentally gate existing free certified pathways or unrelated goal execution.

---

## 3.4 Do not pretend

The application must never display a successful paid state when the server has not verified it.

Specifically prohibited:

- Fake payment success.
- Frontend-only Pro state.
- Granting Pro because the browser returned from checkout.
- Hard-coded "subscription active" data.
- Fake billing history.
- Fake invoices.
- Fake payout confirmation.
- Fake CBE transfer confirmation.
- Fake provider webhook success.
- Treating a test-mode transaction as a production sale.

UI can represent future/unavailable states, but must label them honestly.

---

## 3.5 Voice and copy

Billing copy must be:

- Clear.
- Direct.
- Honest.
- Consistent with Achivii's existing product voice.
- Specific about what Pro unlocks.
- Free of claims about payments or availability that are not actually true.

Do not invent final pricing.

Do not claim "secure payment" or similar guarantees beyond what is appropriate to state.

---

## 3.6 Visual rules

- Reuse existing Achivii primitives.
- Reuse existing typography, spacing, surfaces, buttons, dialogs, and responsive patterns.
- Do not create a second design system for billing.
- The billing UI should feel like Achivii, while clearly distinguishing the external Lemon Squeezy checkout.
- Do not rebuild Lemon Squeezy's hosted checkout.
- Do not add decorative payment UI that obscures the product purpose.

---

## 3.7 Mobile acceptance

Every UI milestone must verify:

- No horizontal overflow.
- Purchase CTA remains reachable.
- Billing state is readable on narrow screens.
- Provider checkout launch works from mobile.
- Return-from-checkout state is usable.
- Management link remains reachable.
- Long error messages do not break layout.
- Touch targets remain usable.
- Dialog/sheet behavior follows existing project patterns.

---

## 3.8 Accessibility baseline

Billing UI must support:

- Semantic headings.
- Keyboard navigation.
- Visible focus.
- Accessible button/link names.
- Meaningful loading and error announcements.
- Non-color-only status communication.
- Accessible disabled/loading states.
- Logical focus behavior for dialogs.
- Accessible plan comparison if any comparison is presented.

The external Lemon Squeezy checkout remains subject to the provider's own checkout accessibility implementation.

---

## 3.9 Motion

Use existing Achivii motion conventions only.

No decorative payment animation is required.

Reduced-motion behavior must follow the existing design system.

---

## 3.10 Dependencies

Provider-dependent work must clearly distinguish:

**Development dependency**
- Lemon Squeezy test/store access.
- Test product/variants.
- Test API credentials.
- Test webhook signing secret.

**Production dependency**
- Seller onboarding/KYC completion.
- Production store configuration.
- Production Pro variants and final prices.
- Verified payout configuration for the Ethiopian bank destination.
- Production webhook configuration.

Development must not be blocked unnecessarily by production payout setup.

---

## 3.11 Validation baseline

Use the repository's existing commands rather than inventing new ones.

Relevant known commands:

- Root build: `npm run build`
- Backend build: `npm run build --workspace=backend`
- Backend tests: `npm run test --workspace=backend`
- Frontend build: `npm run build --workspace=frontend`
- Frontend lint: `npm run lint --workspace=frontend`
- Frontend tests: `npm run test --workspace=frontend`

Where browser-level validation is required, use the repository's existing Playwright setup.

Payment lifecycle validation must additionally use Lemon Squeezy test-mode events or an equivalent provider-supported test mechanism. Do not mark provider integration complete from mocked frontend behavior alone.

---

# 4 — THE PHASES

# PHASE 0 — BILLING FOUNDATION & PROVIDER CONTRACT

**Status:** NOT STARTED

### Source

- `docs/features/billing/03-feature.md`: External Services, Product Rules, Security/Privacy, In Scope, Non-Negotiables, Open Decisions OD-2 and OD-8.
- Repository package/config structure.
- Existing authentication and product architecture.

### Objective

Establish a precise Lemon Squeezy integration contract and safe configuration boundary before implementing persistence or user-facing billing.

### Narrative line

None (infrastructure).

### Current state

- No active billing implementation is present.
- The current `User` model has no subscription/entitlement fields.
- Existing authentication identifies users through JWTs and `getAuthUser`.
- Existing custom goals are currently available without payment.
- Stripe is not part of the new feature.
- Lemon Squeezy has not yet been integrated into the repository.

### Decisions required before starting

- None for test-mode foundation.
- **OD-2 exact production pricing** remains required before production product/variant configuration.
- **OD-8 production payout configuration** remains required before production launch, but does not block test-mode foundation.

### In scope

- Provider terminology mapping.
- Pro plan/variant configuration contract.
- Environment variable/configuration contract.
- Server-only secret boundary.
- Test vs production configuration separation.
- Provider IDs required by later phases.
- Definition of how authenticated Achivii users are associated with checkout.
- Definition of the webhook signature verification boundary.
- Definition of provider-to-Achivii state mapping.
- Documentation of assumptions that must be verified against the current Lemon Squeezy API/docs before implementation.

### Out of scope

- Database migration.
- Checkout route implementation.
- Webhook route implementation.
- UI implementation.
- Actual Pro feature gating.
- Production launch.
- CBE payout execution.
- Stripe integration.

### Backend / architecture allowance

Allowed:

- Add a small billing configuration module/type boundary if needed.
- Add environment variable validation for billing configuration if consistent with existing configuration patterns.
- Add provider-specific types/interfaces needed to isolate Lemon Squeezy from product logic.

Not allowed:

- Changing User/Goal schema.
- Changing authentication behavior.
- Adding billing routes.
- Refactoring unrelated backend architecture.

### Files likely affected

Potentially:

- Backend configuration/lib area.
- `backend/.env.example` or equivalent environment documentation if present.
- Billing-specific documentation.

Exact paths must be confirmed from the repository before implementation.

### Milestones

#### M0.1 — Provider contract

Define the minimum Lemon Squeezy concepts Achivii needs:

- Store.
- Product.
- Subscription variant.
- Customer.
- Checkout.
- Subscription.
- Webhook event.
- Subscription-management URL where applicable.

Map provider states to Achivii's internal states without making the provider state the product model.

#### M0.2 — Configuration boundary

Define test/production configuration for:

- API credential.
- Store/product/variant identifiers.
- Webhook signing secret.
- Application return URLs.
- Any other provider identifiers actually required.

Secrets must remain server-side.

#### M0.3 — Checkout identity contract

Define the exact mechanism by which the authenticated Achivii user is associated with a Lemon Squeezy checkout/subscription.

The association must survive:

- Browser return.
- Webhook delivery.
- Different devices.
- Missing browser return.

#### M0.4 — Provider state mapping

Document the mapping between provider subscription/payment states and Achivii entitlement states.

No access decision may be based on an unverified client-side event.

### Regression checks

R-1, R-2, R-3.

### Mobile acceptance

None beyond confirming that no existing mobile behavior changes.

### Accessibility

No new UI.

### Validation

- Type-check/build after any code/config changes.
- Review configuration for accidental client exposure.
- Confirm no provider secret appears in frontend source.
- Confirm Stripe packages/routes/config are not introduced.

### Exit criteria

- Provider contract is documented.
- Environment/configuration boundary is explicit.
- User-to-provider identity strategy is explicit.
- Provider state mapping is explicit.
- Test vs production configuration is distinguishable.
- No existing authentication or goal behavior changes.

### Risks

- Provider API details may differ from assumptions.
- Incorrect checkout-user association could create serious entitlement ownership bugs.
- Configuration leaks could expose provider credentials.

---

# PHASE 1 — SUBSCRIPTION PERSISTENCE & ENTITLEMENT MODEL

**Status:** NOT STARTED

### Source

- Feature definition: Data Behavior, Persistent/Temporary/Derived State, Backend/Persistence Requirement, Product Rules, Security/Privacy.
- M0.1–M0.4.

### Objective

Create the minimum durable backend model required to associate an Achivii user with a Lemon Squeezy subscription and derive a trustworthy Pro entitlement.

### Narrative line

None (infrastructure).

### Current state

The current Prisma schema contains `User`, `Goal`, roadmap, task, review, and research models, but no billing/subscription model.

### Decisions required before starting

None beyond the resolved feature definition.

### In scope

- Billing/subscription persistence.
- Provider customer/subscription identifiers.
- Plan/variant association.
- Subscription status.
- Relevant billing-period timestamps.
- Entitlement representation or authoritative derivation.
- Webhook/event idempotency persistence if required by the chosen implementation.
- Database constraints/indexes necessary for ownership and uniqueness.
- Migration.
- Server-side billing repository/service boundary.

### Out of scope

- Checkout.
- Webhook HTTP endpoint.
- Frontend billing UI.
- Goal gating.
- Pricing UI.
- Payment provider SDK abstractions beyond what persistence needs.

### Backend / architecture allowance

Allowed:

- Modify `backend/prisma/schema.prisma` only for billing-related models/fields.
- Add the minimum billing migration.
- Add billing-specific backend service/repository modules.
- Add billing-related types.

Not allowed:

- Rewrite existing Goal/User relationships.
- Change authentication semantics.
- Rename unrelated schema fields.
- Add unrelated indexes/migrations.

### Files likely affected

- `backend/prisma/schema.prisma`
- New Prisma migration.
- Billing-specific backend modules.
- Relevant test files.

### Milestones

#### M1.1 — Subscription data model

Implement a durable representation of:

- Achivii user.
- Lemon Squeezy customer identity where required.
- Lemon Squeezy subscription identity.
- Variant/plan identity.
- Provider subscription status.
- Current/next billing timestamps where available.
- Cancellation/ending state.
- Relevant entitlement information.

The model must prevent ambiguous ownership.

#### M1.2 — Event idempotency model

Add the minimum durable mechanism needed to prevent repeated webhook delivery from creating duplicate side effects.

#### M1.3 — Entitlement service

Create a server-side product-level entitlement boundary such as:

`hasProEntitlement(userId)`

or the repository's equivalent pattern.

The rest of Achivii should depend on the entitlement model, not Lemon Squeezy-specific status strings.

#### M1.4 — Migration and persistence tests

Run the migration against the project's supported database workflow and test:

- Create subscription state.
- Update subscription state.
- Lookup by user.
- Lookup by provider subscription.
- Duplicate event handling data.
- Entitlement derivation.

### Regression checks

R-1, R-2, R-3, R-4.

### Mobile acceptance

None.

### Accessibility

None.

### Validation

- Backend build.
- Backend test suite.
- Migration verification.
- Direct persistence tests.
- Verify existing user/goal records remain readable.

### Exit criteria

- Billing state can be persisted.
- Provider subscription belongs to exactly the intended Achivii user.
- Entitlement can be derived server-side.
- Duplicate-event protection has durable support.
- Existing schema behavior remains intact.

### Risks

- Over-modeling provider state.
- Creating a billing model that cannot support future Pro capabilities.
- Migration errors affecting existing users.

---

# PHASE 2 — LEMON SQUEEZY CHECKOUT & WEBHOOK INTEGRATION

**Status:** NOT STARTED

### Source

- Feature definition: Primary User Journey, Actions, External Services, Security/Privacy, Failure Behavior, AC-2 through AC-7.
- PHASE 0 and PHASE 1.

### Objective

Implement the trusted payment-provider connection that creates Pro checkouts and synchronizes verified subscription lifecycle events into Achivii.

### Narrative line

None (integration).

### Current state

No Lemon Squeezy checkout or webhook endpoint exists.

### Decisions required before starting

- Test store/product/variant configuration must be available.
- Exact production pricing remains OD-2; test implementation may use provider test variants.

### In scope

- Server-side checkout creation.
- Authenticated-user association.
- Lemon Squeezy webhook endpoint.
- Signature validation.
- Event parsing.
- Idempotent processing.
- Subscription persistence updates.
- Provider failure handling.
- Logging appropriate for operational debugging without exposing secrets/payment data.
- Test-mode provider integration.

### Out of scope

- Production launch.
- CBE payout handling.
- Frontend Pro feature gating.
- Billing dashboard.
- Custom checkout UI.
- Payment-card handling.

### Backend / architecture allowance

Allowed:

- Add billing checkout route.
- Add billing webhook route.
- Add Lemon Squeezy provider client/service.
- Add event handlers.
- Add billing reconciliation helper if required.
- Modify billing persistence from PHASE 1.

Not allowed:

- Modify unrelated API routes.
- Modify authentication logic unless required solely to obtain the authenticated user.
- Store card data.
- Introduce Stripe.

### Files likely affected

- New billing route/service files.
- Backend route registration.
- Billing tests.
- Environment/configuration.
- Existing auth helper may be consumed but should not be rewritten.

### Milestones

#### M2.1 — Checkout creation

Implement authenticated checkout creation for the selected Pro variant.

The server must:

- Verify the user.
- Determine the intended Pro variant.
- Associate the checkout with the user.
- Return only the information the frontend needs to launch the provider checkout.
- Never expose secret API credentials.

#### M2.2 — Webhook endpoint

Implement a provider webhook endpoint that:

- Receives the raw provider request as required for signature verification.
- Validates the webhook signature.
- Rejects invalid events.
- Parses only supported event types.
- Persists the verified subscription state.

#### M2.3 — Subscription lifecycle handlers

Support the provider events necessary for:

- Subscription creation.
- Subscription update.
- Renewal-related state changes.
- Cancellation.
- Expiration.
- Failed payment/recovery state.
- Other events only when they materially affect entitlement.

#### M2.4 — Idempotent event processing

Ensure repeated delivery of the same event does not duplicate or corrupt state.

#### M2.5 — Test-mode lifecycle verification

Use provider-supported test events/transactions to verify the integration from provider event through local persistence.

### Regression checks

R-1, R-2, R-3, R-4.

### Mobile acceptance

Checkout launch endpoint must return correctly regardless of client viewport.

### Accessibility

No new provider-hosted UI is implemented here.

### Validation

- Backend build.
- Backend test suite.
- Unit tests for signature verification.
- Unit tests for event mapping.
- Duplicate-event tests.
- Invalid-signature tests.
- Test-mode provider lifecycle verification.

### Exit criteria

- Authenticated user can receive a valid test checkout.
- Provider webhook signature is enforced.
- Valid subscription events update local state.
- Invalid events cannot alter entitlements.
- Duplicate events are safe.
- No client-side payment claim can alter backend subscription state.

### Risks

- Raw-body/signature verification mistakes.
- Webhook event ordering.
- Provider retries.
- Incorrect user association.
- Assuming browser return equals successful payment.

---

# PHASE 3 — SERVER-SIDE PRO ENTITLEMENT ENFORCEMENT

**Status:** NOT STARTED

### Source

- Feature definition: Product Rules RULE-1 through RULE-10, Permissions, Backend/Persistence Requirement, AC-3, AC-11, AC-13, AC-14.
- Existing custom-goal implementation.
- PHASE 1 and PHASE 2.

### Objective

Enforce the Pro requirement for new custom goals on the server while preserving existing custom goals and all free functionality.

### Narrative line

None (product enforcement).

### Current state

The current backend accepts custom goals without a paid entitlement. Existing custom goals are therefore a working free capability and must be handled deliberately when paid gating begins.

### Decisions required before starting

None; the feature definition has already resolved:

- Custom goals become the primary Pro capability.
- Existing custom goals are grandfathered.
- Free certified pathways remain free.

### In scope

- Server-side entitlement check.
- New custom-goal creation gate.
- Grandfathering behavior for existing custom goals.
- Clear distinction between creating a new custom goal and accessing existing work.
- Authorization tests.
- Entitlement-aware error response.

### Out of scope

- Payment checkout.
- Pricing UI.
- Provider webhook implementation.
- Changing free pathway behavior.
- Deleting existing custom goals.
- Gating unrelated functionality.

### Backend / architecture allowance

Allowed:

- Add entitlement check to the custom-goal creation path.
- Add a billing/entitlement helper used by the goal route.
- Add the minimum data lookup required to determine whether a goal/user is grandfathered.

Not allowed:

- Rewrite goal creation.
- Change AI generation behavior.
- Change certified preset generation.
- Delete or mutate existing goals as part of gating.

### Files likely affected

- `backend/src/routes/goal.ts`
- Billing entitlement service.
- Billing tests.
- Goal route tests.
- Possibly frontend error handling after the API contract is established.

### Milestones

#### M3.1 — New custom-goal authorization

When an authenticated user attempts to create a new custom goal:

- Pro entitlement is required.
- The check happens server-side.
- Failure returns an explicit entitlement-related response.

#### M3.2 — Grandfather existing custom goals

Existing custom goals created before paid gating must remain supported according to the feature definition.

The implementation must not silently delete or invalidate those goals.

#### M3.3 — Free pathway protection

Verify that certified/free pathways do not accidentally pass through the new custom-goal gate.

#### M3.4 — Authorization tests

Test at minimum:

- Free user creating new custom goal → denied.
- Active Pro user creating custom goal → allowed.
- Existing grandfathered custom goal → preserved.
- Free certified pathway → allowed.
- User cannot use another user's entitlement.
- Expired/cancelled entitlement → new custom goal denied.

### Regression checks

R-1, R-2, R-3, R-4.

### Mobile acceptance

API behavior is viewport-independent; frontend errors introduced by this phase must remain usable on mobile.

### Accessibility

If a new frontend error state is added, it must use accessible error feedback.

### Validation

- Backend tests.
- Existing goal tests.
- Regression test for certified pathways.
- Build.
- Representative authenticated browser flow after frontend contract is connected.

### Exit criteria

- Pro entitlement is enforced server-side.
- Existing custom goals are preserved.
- Free pathways remain free.
- Client-side manipulation cannot bypass the gate.
- Authorization is tested.

### Risks

- Accidentally locking existing users out.
- Incorrect grandfathering criteria.
- Gating the wrong goal type.
- Entitlement lookup becoming coupled to provider-specific states.

---

# PHASE 4 — BILLING UI & PURCHASE JOURNEY

**Status:** NOT STARTED

### Source

- Feature definition: Experiences/Screens, Entry Points, Design Requirements, Mobile Requirements, Accessibility Requirements, AC-1, AC-3, AC-16, AC-17.
- Existing visual design system.
- PHASE 2 and PHASE 3.

### Objective

Give users a clear, honest Achivii-native path from discovering Pro to launching Lemon Squeezy checkout and understanding the resulting subscription state.

### Narrative line

**Know what Pro unlocks.**

### Current state

The existing product presents Custom Journeys as future Premium in historical redesign work, while real payments were intentionally deferred. This phase changes the state only after the real backend payment system exists.

### Decisions required before starting

- OD-2 exact production price before final production copy.
- Test-mode UI may use clearly configured test pricing.

### In scope

- Pro plan presentation.
- Paid feature gate for new custom-goal creation.
- Checkout CTA.
- Checkout loading/error states.
- Checkout return/confirmation experience.
- Billing status display.
- Subscription management entry point placeholder if provider-management URL is already available.
- Responsive behavior.
- Accessibility.
- Existing design-system integration.

### Out of scope

- Rebuilding Lemon Squeezy checkout.
- Billing-history dashboard.
- Custom coupon UI.
- Full account redesign.
- Unrelated marketing redesign.
- New Pro features beyond custom goals.

### Backend / architecture allowance

Allowed:

- Consume the billing API created in PHASE 2.
- Add minimal frontend-facing billing endpoints if an existing API contract is insufficient.
- Add billing-related client state/types.

Not allowed:

- Client-side entitlement authority.
- Hard-coded active subscriptions.
- Direct use of provider secret credentials.
- Unrelated state-management rewrite.

### Files likely affected

Likely areas:

- `frontend/src/pages/`
- `frontend/src/components/app/`
- `frontend/src/components/pathways/`
- `frontend/src/lib/api.ts`
- New billing components/types/tests.
- Route registration in `frontend/src/App.tsx` if a dedicated billing route is chosen.

Exact files must be confirmed before implementation.

### Milestones

#### M4.1 — Pro presentation

Present:

- Pro name.
- Configured price.
- Billing interval.
- Custom-goal entitlement.
- Purchase CTA.

No invented price may be hard-coded.

#### M4.2 — Paid feature gate

When a free user reaches the custom-goal creation entry point:

- Explain that custom goals require Pro.
- Provide a purchase path.
- Preserve access to free pathways.

#### M4.3 — Checkout launch

Connect the purchase CTA to the authenticated checkout endpoint.

States:

- Ready.
- Loading.
- Provider launch.
- Failure/retry.

#### M4.4 — Return and synchronization state

After returning from Lemon Squeezy:

- Do not immediately assume Pro.
- Retrieve authoritative subscription/entitlement state.
- Show a synchronization/pending state if necessary.
- Show success only after the backend verifies entitlement.

#### M4.5 — Billing/account state

Display the user's current plan/status and relevant billing date.

Do not invent invoice history.

### Regression checks

R-1, R-2, R-3, R-5, R-6, R-7.

### Mobile acceptance

Verify narrow mobile billing/gating/return states and touch targets.

### Accessibility

Verify keyboard navigation, focus, status announcements, and accessible CTA names.

### Validation

- Frontend tests.
- Frontend lint.
- Frontend build.
- Browser verification.
- Mobile verification.
- Accessibility verification using existing project tooling where appropriate.
- End-to-end test-mode checkout journey where feasible.

### Exit criteria

- A user can understand Pro.
- A user can start a real test checkout.
- The app never falsely reports paid access.
- Free pathways remain visible/usable.
- Billing states work on mobile and keyboard navigation.
- UI uses existing Achivii design primitives.

### Risks

- Race between browser return and webhook.
- Poorly communicated pending state.
- Final pricing changing after UI implementation.
- Accidentally making custom goals inaccessible before the payment flow is ready.

---

# PHASE 5 — SUBSCRIPTION LIFECYCLE & ACCOUNT MANAGEMENT

**Status:** NOT STARTED

### Source

- Feature definition: Lifecycle, Time-Based Rules, Failure Behavior, Subscription Management, AC-7 through AC-12 and AC-15.
- PHASE 2–4.

### Objective

Make the billing system behave correctly over the entire subscription lifecycle rather than only at initial purchase.

### Narrative line

None (lifecycle).

### Current state

Initial purchase synchronization will exist after PHASE 2, but lifecycle UX and reconciliation still need to be completed.

### Decisions required before starting

None for the V1 behavior already approved.

### In scope

- Active subscription state.
- Cancellation-at-period-end.
- Renewal.
- Past-due/payment recovery.
- Unpaid/expired behavior.
- Provider-managed subscription management.
- Reconciliation path.
- Stale-state handling.
- Account billing state.
- Access preservation during provider outages according to verified-state rules.

### Out of scope

- Custom billing-management UI.
- Custom invoices.
- Coupon engine.
- Refund policy beyond provider-supported behavior.
- Multiple payment providers.
- Team billing.

### Backend / architecture allowance

Allowed:

- Billing lifecycle handlers.
- Provider subscription-management URL retrieval where needed.
- Reconciliation endpoint/service.
- Subscription state refresh from provider where justified.
- Billing-specific account endpoint changes.

Not allowed:

- Rewrite authentication.
- Add unrelated scheduled-job infrastructure unless explicitly required and approved.
- Change non-billing business logic.

### Files likely affected

- Billing services/routes.
- Billing persistence.
- Account UI.
- Billing components.
- Tests.

### Milestones

#### M5.1 — Active/renewed state

Verify renewal events keep Pro entitlement active and update relevant dates.

#### M5.2 — Cancellation at period end

Verify cancellation preserves access until the provider-defined entitlement end.

#### M5.3 — Payment recovery

Verify past-due/recovery state follows the feature definition and does not trigger arbitrary immediate revocation.

#### M5.4 — Expiration/unpaid

Verify paid access ends only when authoritative provider state says it no longer grants entitlement.

#### M5.5 — Provider-managed subscription management

Expose the provider-supported management experience from Achivii.

#### M5.6 — Reconciliation

Implement a safe recovery/reconciliation mechanism for situations such as:

- Webhook delivery failure.
- Temporary provider outage.
- Local state drift.
- Browser return before webhook.

The mechanism must not undermine webhook authority or create client-side payment claims.

### Regression checks

R-1 through R-7 as applicable.

### Mobile acceptance

Verify billing status and management entry on mobile.

### Accessibility

Verify status changes and management controls are accessible.

### Validation

- Backend lifecycle tests.
- Provider test-mode lifecycle.
- Duplicate/out-of-order event tests.
- Frontend billing-state tests.
- Browser verification.
- Regression suite.

### Exit criteria

- Initial purchase works.
- Renewal works.
- Cancellation works.
- Recovery state works.
- Expiration works.
- Management works.
- Provider outage does not falsely revoke verified access.
- Local state can recover from synchronization problems.

### Risks

- Out-of-order events.
- Provider retries.
- Race conditions between reconciliation and webhook processing.
- Incorrect cancellation/end-date interpretation.

---

# PHASE 6 — FULL VALIDATION, SECURITY, PRODUCTION READINESS & LAUNCH

**Status:** NOT STARTED

### Source

- Feature definition: Security/Privacy, Failure Behavior, Non-Negotiables, Success Criteria, Acceptance Criteria.
- All previous phases.
- Provider production onboarding requirements.

### Objective

Prove that the complete billing system is secure, regression-safe, operationally ready, and genuinely connected to a production Lemon Squeezy seller configuration before enabling paid sales.

### Narrative line

**Nothing goes live until the system can prove it works.**

### Current state

Production billing is not ready until provider onboarding, final pricing, payout configuration, and full lifecycle validation are complete.

### Decisions required before starting

**Blocking production launch:**

- OD-2 — Exact production prices and billing intervals.
- OD-8 — Actual Lemon Squeezy seller onboarding and Ethiopian bank payout configuration.

All implementation decisions from the feature definition must remain consistent.

### In scope

- Full automated test pass.
- Security review.
- Webhook signature review.
- Authorization review.
- Client-secret exposure review.
- Duplicate/replay review.
- Lifecycle verification.
- Mobile verification.
- Accessibility verification.
- Production Lemon Squeezy configuration.
- Production webhook configuration.
- Seller onboarding verification.
- Payout configuration verification.
- Final production smoke test.
- Launch checklist.
- Rollback/disable procedure.

### Out of scope

- New product features.
- New payment providers.
- Multi-tier expansion.
- Custom billing history.
- Custom coupon system.
- Large refactors unrelated to launch blockers.

### Backend / architecture allowance

Allowed:

- Production configuration.
- Security hardening directly related to billing.
- Minimal fixes discovered during validation.
- Operational logging improvements directly required for safe billing.

Not allowed:

- Scope expansion.
- Architecture rewrite.
- New billing features not defined by the feature definition.

### Files likely affected

Potentially:

- Production configuration/environment definitions.
- Deployment configuration.
- Billing modules/tests.
- Documentation.
- No broad product changes.

### Milestones

#### M6.1 — Automated validation

Run:

- Root build.
- Backend build.
- Backend tests.
- Frontend build.
- Frontend lint.
- Frontend tests.
- Relevant Playwright/browser tests.
- Accessibility checks where configured.

#### M6.2 — Security validation

Verify:

- Provider secret is server-only.
- Webhook signature is required.
- Invalid webhook cannot change state.
- Client cannot grant entitlement.
- User cannot read another user's subscription.
- User cannot use another user's entitlement.
- Replay/duplicate webhook behavior is safe.
- Sensitive payment data is not stored.

#### M6.3 — Lifecycle matrix

Verify all required states:

| Scenario | Expected result |
|---|---|
| No subscription | Free |
| Checkout started | Free/pending until verified |
| Active Pro | Pro |
| Renewal | Pro remains active |
| Cancelled but period valid | Pro remains active |
| Past due/recovery | Follows provider entitlement state |
| Unpaid/expired | Pro removed |
| Invalid webhook | No state change |
| Duplicate webhook | No duplicate side effect |
| Provider unavailable | Last verified entitlement preserved |
| Existing grandfathered custom goal | Preserved according to product rule |
| New custom goal without Pro | Denied |
| Certified pathway without Pro | Allowed |

#### M6.4 — Production provider readiness

Complete and independently verify:

- Lemon Squeezy seller/store onboarding.
- Production Pro product.
- Monthly Pro variant.
- Yearly Pro variant.
- Final production prices.
- Production API credentials.
- Production webhook signing secret.
- Production webhook endpoint.
- Ethiopian payout configuration.
- CBE receiving requirements/confirmation.

Do not treat "Ethiopia is supported" as proof that this particular seller account has completed payout setup.

#### M6.5 — Production smoke test

Perform a controlled production verification using the smallest safe transaction/test procedure supported by Lemon Squeezy.

Verify:

1. Customer checkout.
2. Provider subscription.
3. Webhook.
4. Achivii subscription record.
5. Pro entitlement.
6. Custom-goal access.
7. Subscription-management path.
8. Payout/account operational setup.

#### M6.6 — Launch/rollback readiness

Document:

- How billing can be disabled safely.
- How a failed webhook incident is diagnosed.
- How subscription state can be reconciled.
- How a provider outage is handled.
- How production credentials are rotated.
- What conditions require disabling new purchases.

### Regression checks

R-1 through R-7.

### Mobile acceptance

Full billing journey from a mobile browser, including:

- Plan.
- Checkout launch.
- Provider return.
- Synchronization state.
- Account status.
- Management.

### Accessibility

Full applicable accessibility verification.

### Validation

All project validation commands plus provider production verification.

### Exit criteria

Production billing may be considered **COMPLETE** only when:

- All acceptance criteria in `docs/features/billing/03-feature.md` are satisfied.
- Automated tests pass.
- Security checks pass.
- Lifecycle matrix passes.
- Mobile/accessibility checks pass.
- Final pricing is configured.
- Seller onboarding is complete.
- Ethiopian payout configuration is confirmed.
- Production webhooks work.
- A controlled production smoke test succeeds.
- Rollback/disable procedure is documented.

---

# 5 — CROSS-PHASE CARRY-OVERS

These rules remain active throughout every phase.

## CARRY-1 — No Stripe

Stripe must not be reintroduced into this feature.

## CARRY-2 — Provider/product separation

Lemon Squeezy-specific concepts belong behind a provider integration boundary.

Achivii's core product should reason about:

- Pro entitlement.
- Subscription status.
- Plan.
- Access.

rather than scattering Lemon Squeezy-specific status strings throughout the frontend and unrelated backend modules.

## CARRY-3 — Server authority

The server is authoritative for paid access.

Frontend state is a representation of server state.

## CARRY-4 — Existing work preservation

Existing user-created custom goals must not be destructively deleted because billing is introduced.

## CARRY-5 — Free functionality protection

Certified/free pathways remain free.

## CARRY-6 — Honest state

No UI may claim:

- paid,
- active,
- subscribed,
- renewed,
- cancelled,
- refunded,
- or payout completed

unless the underlying system has the evidence required to support that claim.

## CARRY-7 — Test/production separation

Test provider identifiers and credentials must never accidentally be used as production configuration.

Production credentials must never appear in source control.

## CARRY-8 — No scope creep

Do not add:

- additional providers,
- multi-tier pricing,
- coupons,
- invoices,
- affiliates,
- team billing,
- usage-based billing

unless the feature definition is explicitly updated.

---

# 6 — DECISION / OPEN-ITEM REGISTER

| ID | Decision | Status | Impact |
|---|---|---|---|
| OD-1 | Initial plan structure | RESOLVED — Free + Pro | Architecture/product |
| OD-2 | Exact production prices | OPEN | Production launch |
| OD-3 | Initial paid entitlement | RESOLVED — Custom goals | Entitlement/gating |
| OD-4 | Failed-payment behavior | RESOLVED — follow verified provider state/recovery | Lifecycle |
| OD-5 | Plan switching | RESOLVED — provider-managed/hybrid | Management UX |
| OD-6 | Billing history | RESOLVED — minimal in-app | Account UX |
| OD-7 | Coupons | RESOLVED — no custom coupon system | Scope |
| OD-8 | Ethiopian payout setup | OPEN until actual seller onboarding/payout confirmation | Production launch |

### New implementation decisions

| ID | Decision | Status |
|---|---|---|
| ND-1 | Use a provider-specific integration boundary rather than exposing Lemon Squeezy throughout product logic | DECIDED |
| ND-2 | Server-side entitlement is the only authority for Pro access | DECIDED |
| ND-3 | Webhook processing must be idempotent | DECIDED |
| ND-4 | Hosted Lemon Squeezy checkout is used for V1 | DECIDED |
| ND-5 | Production launch requires actual payout configuration verification, not documentation-only support claims | DECIDED |

No new product requirements may be introduced through implementation prompts without updating the feature definition first.

---

# 7 — PHASE REPORT TEMPLATE

After completing any phase, the implementation agent should report:

```md
# PHASE X — COMPLETION REPORT

Status: COMPLETE / PARTIAL / BLOCKED

## What was implemented

- ...

## Milestones completed

- Mx.1
- Mx.2

## Files changed

- ...

## Backend / architecture changes

- ...

## Tests run

- ...

## Validation results

- Build:
- Tests:
- Lint:
- Browser:
- Mobile:
- Accessibility:
- Provider verification:

## Regression checks

- R-1:
- R-2:
- ...

## Acceptance criteria verified

- AC-...

## Known limitations

- ...

## Open items carried forward

- ...

## Evidence

- ...

## Next phase

Do not start automatically.
```

---

# 8 — CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-29 | Initial Lemon Squeezy implementation roadmap created from `docs/features/billing/03-feature.md` and repository state. |
| 2026-09-29 | Established Free + Pro, monthly + yearly, custom goals as initial paid capability, hosted checkout, provider-managed subscription management, server-side entitlement, grandfathered existing custom goals, and CBE payout verification requirements. |
