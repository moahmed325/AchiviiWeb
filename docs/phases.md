# ACHIVII PRO MEMBERSHIP & STRIPE SUBSCRIPTION — IMPLEMENTATION PHASES

### Roadmap, milestones and exit criteria

Companion to the primary source-of-truth documents:

* `docs/feature_definition_payment.md` — **what** the feature is and must do (cited as **FD §n**).
* `docs/decisions.md` — **why**: architecture, technology, and product decisions (cited as **D-n**, **OD-n**, **ND-n**).
* `backend/prisma/schema.prisma` — current database models and constraints.
* `docs/visual-design-system.md` — visual tokens, glassmorphism surfaces, and interaction standards (cited as **VDS §n**).

The project documentation hierarchy:

| Document | Purpose |
|---|---|
| `docs/phases.md` (this file) | **When and in what order** — phases, milestones, dependencies, backend allowances, regression protections, and verifiable exit criteria |
| `docs/implementation_prompt_template.md` | **How the coding agent is instructed** — 21-section self-contained execution prompt compiled per milestone |
| `docs/decisions.md` | **Why** — architectural decision records (ADRs) preventing accidental regression of key technical choices |
| `docs/feature_definition_payment.md` | **What** — authoritative behavioral specifications, user actions, states, and acceptance criteria |

Last updated: 2026-09-28 · Current position: **Phase 0 in progress — M0.1 complete; M0.2 next.**

---

# 0 — HOW TO READ THIS FILE

## Status legend

| Status | Meaning |
|---|---|
| `NOT STARTED` | No work has begun on this phase or milestone. |
| `IN PROGRESS` | Work is actively underway by an implementation agent. |
| `PARTIAL` | Some milestones in the phase have completed while others remain pending. |
| `COMPLETE` | All milestones delivered, automated tests pass, manual verification completed, and review approved. |
| `BLOCKED` | The phase or milestone cannot proceed until an unresolved decision or external dependency is resolved. |

## Identifiers

* **M&lt;phase&gt;.&lt;n&gt;** — a concrete, bounded implementation milestone (e.g., `M0.1`, `M2.3`).
* **OD-n** — an Open Decision originating from `feature_definition_payment.md` (e.g., `OD-1`).
* **ND-n** — a New Decision identified during implementation planning, recorded in Section 6 and logged to `docs/decisions.md`.
* **R-n** — a regression check from the project-wide Must-Not-Break register (Section 3.3).
* **RULE-n** — an authoritative product rule from `feature_definition_payment.md` (Section 14).
* **AC-n** — a testable acceptance criterion from `feature_definition_payment.md` (Section 32).
* **UX-n** — a user experience or screen definition from `feature_definition_payment.md` (Section 8).

## Anatomy of a phase

Every phase in Section 4 follows the exact same 15 canonical fields:

1. **Status** — current execution status.
2. **Source** — specific citations from `feature_definition_payment.md`, `decisions.md`, and design documentation.
3. **Objective** — one clear sentence describing the observable system outcome.
4. **Narrative line** — the user-facing product story line.
5. **Current state** — repository-aware reality of what exists today before the phase begins.
6. **Decisions required before starting** — blocking OD/ND items.
7. **In scope** — concrete boundaries of work.
8. **Out of scope** — explicit non-goals to prevent scope creep.
9. **Backend allowance** — narrow, strictly named modifications permitted to backend/schema.
10. **Files likely affected** — starting points in the codebase.
11. **Milestones** — ordered, bounded implementation units (`M<X.Y>`).
12. **Regression checks** — touched `R-n` capabilities that must be re-verified.
13. **Mobile acceptance** — small-screen touch and layout constraints.
14. **Validation** — exact project commands and manual verification procedures.
15. **Exit criteria** — observable, non-subjective conditions required for completion.
16. **Risks** — specific failure modes and mitigations.

---

# 1 — STATUS AT A GLANCE

| # | Phase | Status | Depends on | Decisions blocking start | Backend allowance |
|---|---|---|---|---|---|
| **0** | Billing Foundation, Schema & Stripe Client | `NOT STARTED` | — | OD-1 (price env vars) | Named: User billing fields and Stripe client initialization |
| **1** | Server-Side Goal Limit & Multi-Goal Engine | `NOT STARTED` | 0 | — | Named: Goal creation limit guard and non-archiving multi-goal queries |
| **2** | Stripe Checkout & Webhook Pipeline | `NOT STARTED` | 0 | — | Named: Checkout session creation, raw webhook verification, subscription sync |
| **3** | Customer Portal & Billing Management API | `NOT STARTED` | 2 | — | Named: Portal session generation and subscription status endpoint |
| **4** | Frontend Upgrade Modal, Pricing UI & Entry Points | `NOT STARTED` | 2 | — | None |
| **5** | Settings Billing Tab, Checkout Return & Grace Mode | `NOT STARTED` | 3, 4 | — | None |
| **6** | Multi-Goal Switching & Concurrent Trajectories UI | `NOT STARTED` | 1, 5 | — | None |
| **7** | Mobile Ergonomics, Accessibility & E2E Verification | `NOT STARTED` | 0–6 | — | None |

---

# 2 — ORDER AND DEPENDENCIES

The dependency order follows strict architectural boundaries: database and API contracts first, server-side rule enforcement second, external payment integration third, followed by customer-facing interfaces, account settings, multi-goal experience, and the final end-to-end quality sweep.

```text
PHASE 0  Billing Foundation, Schema & Stripe Client
   │
   ├──────────────────────────────┐
   ▼                              ▼
PHASE 1                        PHASE 2
Goal Limit & Multi-Goal Engine Stripe Checkout & Webhooks
   │                              │
   │                              ▼
   │                           PHASE 3
   │                           Customer Portal & Billing API
   │                              │
   │           ┌──────────────────┤
   ▼           ▼                  ▼
PHASE 4     PHASE 5
Upgrade UI  Settings Billing & Grace Mode
   │           │
   └─────┬─────┘
         ▼
      PHASE 6  Multi-Goal Switching UI (Pro)
         │
         ▼
      PHASE 7  Mobile, Accessibility & E2E Verification Sweep
```

### Why this order holds:

1. **Phase 0 comes first** because neither server-side authorization guards nor payment webhooks can operate without the database fields (`plan`, `stripeCustomerId`, etc.) and the initialized Stripe client.
2. **Phase 1 implements server-side goal limits immediately** to guarantee that the 1-goal limit on the free tier is strictly enforced by the API (`RULE-1`, `RULE-7`) before any front-end UI assumes it.
3. **Phase 2 creates the functional payment bridge** (Checkout + Webhooks). Front-end upgrade modals cannot test actual checkout sessions without this pipeline.
4. **Phase 3 adds Customer Portal and self-service status**, unlocking subscription management and renewal tracking before UI construction.
5. **Phase 4 builds the Upgrade Modal and entry points**, wiring directly into Phase 2's Checkout endpoint.
6. **Phase 5 delivers the Settings Billing tab, return page, and Grace Mode banner**, consuming Phase 3's Customer Portal and subscription status.
7. **Phase 6 builds the multi-goal switcher UI**, which requires Phase 1's backend multi-goal support and Phase 5's active Pro status.
8. **Phase 7 completes the cross-product sweep**, verifying mobile viewports, WCAG AA accessibility, and automated Playwright E2E suites.

---

# 3 — RULES FOR EVERY PHASE

## 3.1 One phase at a time

Implementation agents must adhere to strict sequential discipline:
* Work only on the designated milestone within the active phase.
* Do not begin subsequent milestones until the active milestone passes all validations.
* Produce a formal Milestone Completion Report upon finishing.
* A phase becomes `COMPLETE` only after full review against exit criteria.

## 3.2 Backend / architecture scope rule

* A phase may make a backend change **only if explicitly listed in that phase's "Backend allowance"**.
* Anything not named remains strictly off-limits (no unauthorized refactors or schema edits).
* Never create client-only entitlement locks. The UI must never rely on frontend state to gate operations without server-side validation.

## 3.3 Must not break (Regression Register)

Every phase identifies which of these existing capabilities it touches. Touched items must be re-verified before the phase concludes:

| ID | Capability | Where it lives today | Verification procedure |
|---|---|---|---|
| **R-1** | Authentication & Session | `AuthContext.tsx`, `auth.ts`, `getAuthUser` | Sign up, sign in, persistent JWT session across reloads |
| **R-2** | Goal Creation & Scaffolding | `OnboardingWizard.tsx` &rarr; `POST /api/goal/create` | Create custom goal and certified preset goal end to end |
| **R-3** | Preset Pathway Launch | `certifiedPresets.ts`, navigation state | Pathway exploration, preview, and preselection in onboarding |
| **R-4** | Onboarding Payload Schema | `OnboardingWizard.tsx` &rarr; `goal.ts` | Field-for-field parity of generation request payloads |
| **R-5** | AI Roadmap Generation | `POST /api/goal/create` | Generates 12-week periodized curriculum and velocity table |
| **R-6** | Generation SSE Stream | SSE on `POST /api/goal/create` (`text/event-stream`) | Progress stages, stage indicators, 20s slow notice, error handling |
| **R-7** | Goal Persistence | `saveV2Goal` in `routes/goal.ts` | Active goal reloads from database upon refresh |
| **R-8** | Daily Task Retrieval | `GoalContext.tsx` &rarr; `GET /api/goal/active` | Today dashboard loads current week daily tasks |
| **R-9** | Daily Task Completion | `PATCH /api/goal/tasks/:taskId` | Botanical task checkoff persists across reloads |
| **R-10** | Task Notes & Focus Wins | `PATCH /api/goal/tasks/:taskId` (`notes`) | Auto-save on blur persists user notes |
| **R-11** | Zen Focus Chamber | `FocusSessionModal.tsx` | Fullscreen countdown, spacebar pause/resume, audio chimes |
| **R-12** | Weekly Review | `POST /api/goal/weeks/:weekNumber/review` | Reflection submission and benchmark test result storage |
| **R-13** | Weekly Progression | Same endpoint (writes next week, phase gates) | Week advancement and adaptive task generation |
| **R-14** | Strategic Roadmap View | `RoadmapPage.tsx`, `PlanV2Panel.tsx` | 12-week staircase renders without visual regression |
| **R-15** | Reset / Switch Goal | `DELETE /api/goal/active`, `switchGoal` state | Goal switching preserves past goal archives cleanly |
| **R-16** | Draft Goal Preservation | `localStorage['achivii_draft_goal']` | Preserves custom goal input across unauthenticated signup |
| **R-17** | Offline Indicator | `GoalContext` `apiStatus`, `Navbar` chip | Offline status banner appears when backend is unreachable |
| **R-18** | Onboarding Navigation | `OnboardingWizard.tsx` | Step navigation preserves entered wizard state |
| **R-19** | Payment Card Data Safety | Stripe Hosted Checkout & Customer Portal | Zero card details touch Achivii backend or database (PCI-DSS) |
| **R-20** | Webhook Cryptographic Integrity | `POST /api/billing/webhook` | Raw body signature verification with 5-minute tolerance |
| **R-21** | Free User 1-Goal Integrity | Free tier accounts | Existing single-goal free users operate 100% free indefinitely |
| **R-22** | Grace Mode Non-Destruction | Downgraded accounts with >1 goals | Existing goals are NEVER deleted, locked, or hidden |

## 3.4 Do not pretend

The UI must never simulate functionality that the underlying system does not actually support:
* No mock payment dialogs or fake credit card input forms.
* No client-side-only "Pro" badges that disappear on reload or lack backend database backing.
* No mock Customer Portal links.
* If Stripe is operating in sandbox/test mode, the UI and documentation must clearly state it.

## 3.5 Voice and copy

* SaaS pricing copy must be calm, transparent, and dignified.
* Annual billing savings must be explicitly stated (e.g., *"Save 20% with annual billing"*).
* No manipulative countdown timers, deceptive "only 2 seats left" badges, or dark pattern cancellation hurdles.
* Downgrade messaging must be reassuring: *"Your existing goals remain safely archived and accessible."*

## 3.6 Visual rules

* Strict compliance with Achivii's dark glassmorphism system: `slate-950` canvas, `slate-900/80` glass panels, cyan/emerald accents (`#10b981`, `#06b6d4`).
* High-visibility "PRO" pill badge in navigation with glowing emerald border.
* Tabular numerals (`tabular-nums font-mono`) on pricing cards to prevent numeral jitter.
* Minimum touch target of 44×44px on all interactive toggles, buttons, and close affordances.

## 3.7 Mobile acceptance in every phase

* All billing modals, pricing cards, and settings sections must be verified at **390px** and **360px** viewports.
* Pricing cards stack vertically on viewports &lt; 768px.
* Zero horizontal overflow (`documentOverflow <= 1`).
* Checkout and Customer Portal transitions utilize full-screen browser redirect for native Apple Pay / Google Pay support.

## 3.8 Accessibility baseline

* WCAG 2.1 AA contrast compliance (&ge; 4.5:1 for body copy).
* Upgrade modal traps focus when opened and cleanly restores focus upon `Escape` or dismissal.
* Billing interval switch implements `role="radiogroup"` or `role="switch"` with clear `aria-checked` states.
* Screen reader live region (`aria-live="polite"`) for checkout redirection and error notices.

## 3.9 Motion

* Billing interval toggle transition is subtle (150ms opacity/transform crossfade).
* Respect `prefers-reduced-motion: reduce`: disable scale and sliding animations.

## 3.10 Dependencies

* Backend: Official `stripe` npm package added to `backend/package.json`.
* Frontend: No external billing SDKs needed (uses Stripe Hosted Checkout and Customer Portal via standard browser navigation).

## 3.11 Validation baseline

Every phase must pass this authoritative toolchain check:

| Check | Command / Procedure |
|---|---|
| Frontend Type-Check | `npm run type-check --workspace=frontend` or `node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend` |
| Backend Build | `npm run build --workspace=backend` |
| Frontend Unit Tests | `npm test --workspace=frontend` |
| Backend Unit Tests | `npm test --workspace=backend` |
| Playwright E2E Tests | `npx playwright test` |
| Mobile Viewport Sweep | Visual check at 390px and 360px viewports |
| Accessibility Sweep | 0 `@axe-core/playwright` violations on all touched surfaces |

---

# 4 — THE PHASES

---

## PHASE 0 — Billing Foundation, Database Schema & Stripe Client

**Status:** `NOT STARTED`

**Source:** FD §11, §12, §20, §21, §35 · D-3, D-4 · decisions.md

**Objective:** Extend the Prisma schema with user subscription fields, run migrations, initialize the official Stripe backend client, and expose subscription status in the user auth context.

**Narrative line:** *None (infrastructure).*

### Current state

* `backend/prisma/schema.prisma`: `User` model only has `id`, `email`, `password_hash`, `timezone`, `created_at`, `goals`.
* `backend/src/routes/auth.ts`: `getAuthUser` selects only `id`, `email`, `timezone`, `created_at`.
* `frontend/src/context/AuthContext.tsx`: `User` interface has no `plan` or billing properties.
* `backend/package.json`: Does not contain `stripe`.

### Decisions required before starting

* **OD-1**: Specific price IDs and environment variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_ANNUAL`). *Resolved: Define standard configuration fallbacks in `.env.example`.*

### In scope

* Add `stripe` package to `backend/package.json`.
* Extend Prisma schema `User` model:
  * `plan`: `String` (default `"free"`).
  * `stripeCustomerId`: `String?` (unique, indexed).
  * `stripeSubscriptionId`: `String?` (unique).
  * `subscriptionStatus`: `String?` (`"active"`, `"past_due"`, `"canceled"`).
  * `currentPeriodEnd`: `DateTime?`.
  * `cancelAtPeriodEnd`: `Boolean` (default `false`).
* Generate Prisma Client and create database migration.
* Author `backend/src/lib/stripe.ts`: Initialize singleton Stripe client with API version pinning.
* Update `backend/src/routes/auth.ts`: Include billing fields in `getAuthUser` and `GET /api/auth/me`.
* Update `frontend/src/types/index.ts` and `AuthContext.tsx` with `plan`, `subscriptionStatus`, and helper `isPro`.

### Out of scope

* Checkout session creation or webhooks (Phase 2).
* UI paywall components (Phase 4).

### Backend allowance

* Named: Update `User` model in `backend/prisma/schema.prisma` with 6 billing fields.
* Named: Install `stripe` package in backend.
* Named: Create `backend/src/lib/stripe.ts`.
* Named: Extend `backend/src/routes/auth.ts` user projection.

### Files likely affected

* `backend/package.json`
* `backend/prisma/schema.prisma`
* `backend/src/lib/stripe.ts`
* `backend/src/routes/auth.ts`
* `frontend/src/types/index.ts`
* `frontend/src/context/AuthContext.tsx`
* `backend/test/auth.test.ts`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M0.1** | Install Stripe & Prisma Migration | `COMPLETE` | Add `stripe` to backend, add billing fields to `schema.prisma`, run migration, verify Prisma client generation. |
| **M0.2** | Stripe Singleton Client Module | `NOT STARTED` | Author `backend/src/lib/stripe.ts` loading environment variables with test fallback handling. |
| **M0.3** | Auth Contract & Context Extension | `NOT STARTED` | Expose billing fields in `auth.ts`, update `AuthContext.tsx` and frontend `User` interface, verify login/me payload. |
| **M0.4** | Foundation Vitest & Verification | `NOT STARTED` | Verify backend and frontend Vitest suites, type-checks, and ensure zero regressions across R-1. |

### Regression checks

* **R-1**: Authentication flow, user signup, login, persistent session, and token validation must remain 100% operational.

### Mobile acceptance

* N/A (Backend and contract foundation).

### Validation

1. `npm run type-check --workspace=frontend`
2. `npm run build --workspace=backend`
3. `npm test --workspace=backend` (auth routes pass with new user fields)
4. `npm test --workspace=frontend` (auth context passes with `isPro`)

### Exit criteria

* Database schema has user billing columns.
* Stripe client initializes without errors.
* Calling `GET /api/auth/me` returns `plan: "free"`, `isPro: false` for standard users.
* No existing auth tests broken.

### Risks

* Missing environment variables during local test runs (mitigate with mockable defaults in `stripe.ts`).

---

## PHASE 1 — Server-Side Active Goal Limit & Multi-Goal Architecture

**Status:** `NOT STARTED`

**Source:** FD §6, §14, §20, §30, §32 · RULE-1, RULE-2, RULE-3, RULE-4, RULE-5, RULE-7 · AC-1, AC-2, AC-7

**Objective:** Enforce the 1-active-goal limit on the free tier within the backend API, enable concurrent active goals for Pro subscribers without automatic archiving, and support multi-goal retrieval.

**Narrative line:** *"One journey for everyone; multiple horizons for Pro."*

### Current state

* `backend/src/routes/goal.ts`: `saveV2Goal` and `saveV1PresetGoal` call `archiveActiveGoals(userId)` unconditionally, forcing all users to have at most 1 active goal by archiving prior ones.
* `POST /api/goal/create`: Does not inspect user's plan or count active goals.
* `GET /api/goal/active`: Fetches only the first active goal found.

### Decisions required before starting

* None. (Decisions D-1, D-2, D-5 already established in FD §33).

### In scope

* Update `POST /api/goal/create` in `backend/src/routes/goal.ts`:
  * Query count of currently active goals (`status === 'active'`) for `user.id`.
  * If `user.plan === 'free'` and active count &ge; 1 (and request is not an explicit goal switch/archive), reject with HTTP 403 Forbidden and `{ error: 'GOAL_LIMIT_REACHED', code: 'PRO_REQUIRED' }` (RULE-1, RULE-7, AC-7).
  * If `user.plan === 'pro'`, allow goal creation without calling `archiveActiveGoals` (RULE-3).
* Support explicit goal replacement/switch parameter (`archivePrevious: true`) so free users can still cleanly replace their goal if desired (R-15).
* Add `GET /api/goal/list` endpoint returning all active and completed goals for the authenticated user, allowing multi-goal clients to enumerate journeys.
* Support optional query parameter `GET /api/goal/active?goalId=<id>` so Pro users can fetch a specific active goal.
* Enforce Grace Mode logic: Downgraded users with &gt; 1 active goals retain all existing goals, but cannot create a new one until active count &lt; 1 (RULE-4, RULE-5).

### Out of scope

* Frontend switcher UI components (Phase 6).
* Payment processing or checkout sessions (Phase 2).

### Backend allowance

* Named: Modify `backend/src/routes/goal.ts` to enforce active goal limit on `POST /api/goal/create`.
* Named: Condition `archiveActiveGoals` execution on user plan and switch intent.
* Named: Add `GET /api/goal/list` and query filter on `GET /api/goal/active`.

### Files likely affected

* `backend/src/routes/goal.ts`
* `backend/test/goalLimit.test.ts`
* `frontend/src/lib/api.ts`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M1.1** | Active Goal Count Guard in Create API | `NOT STARTED` | Implement 403 `GOAL_LIMIT_REACHED` check in `POST /api/goal/create` for free users with &ge; 1 active goal. |
| **M1.2** | Pro Multi-Goal Non-Archiving Logic | `NOT STARTED` | Bypass `archiveActiveGoals` when user plan is `'pro'`, allowing concurrent active goals. |
| **M1.3** | Multi-Goal Retrieval & Active Goal Query Filter | `NOT STARTED` | Implement `GET /api/goal/list` and support `?goalId=` on `GET /api/goal/active`. |
| **M1.4** | Grace Mode API Invariance Verification | `NOT STARTED` | Add comprehensive automated tests verifying that downgraded users keep existing goals and cannot add new ones. |

### Regression checks

* **R-2**: Goal creation for free users with 0 active goals must succeed smoothly.
* **R-7**: Saving goals and retrieving active goals must remain fully functional.
* **R-15**: Reset/switch goal flow must still archive previous goal when requested.

### Mobile acceptance

* N/A (Backend authorization and API layer).

### Validation

1. Send `POST /api/goal/create` for free user with 0 goals &rarr; HTTP 201 Created.
2. Send `POST /api/goal/create` for free user with 1 active goal &rarr; HTTP 403 Forbidden with `GOAL_LIMIT_REACHED`.
3. Set `user.plan = 'pro'`, send `POST /api/goal/create` &rarr; HTTP 201 Created, both goals remain `active`.
4. `npm test --workspace=backend`

### Exit criteria

* Free users cannot bypass the 1-goal limit via direct API calls.
* Pro users can hold multiple active goals concurrently in PostgreSQL.
* Zero regressions on standard single-goal onboarding.

### Risks

* Existing tests assuming automatic archiving upon goal creation might fail (mitigate by explicitly testing both free replacement and Pro concurrent scenarios).

---

## PHASE 2 — Stripe Checkout & Webhook Pipeline

**Status:** `NOT STARTED`

**Source:** FD §3, §4, §10, §14, §20, §21, §25, §26 · RULE-6 · AC-3, AC-4, N-1

**Objective:** Build secure server-side Stripe Checkout session generation and a robust, cryptographically verified webhook handler for subscription lifecycle synchronization.

**Narrative line:** *"Seamless, secure payment with instant unlock."*

### Current state

* No billing routes or Stripe webhooks exist in `backend/src/routes/`.
* `backend/src/index.ts` uses standard `express.json()` globally, which consumes request streams before Stripe raw body signature verification can run.

### Decisions required before starting

* None.

### In scope

* Add raw body buffer middleware in `backend/src/index.ts` scoped strictly to `/api/billing/webhook`.
* Create `backend/src/routes/billing.ts` with router mounted at `/api/billing`:
  * `POST /api/billing/create-checkout-session`:
    * Accepts `{ interval: 'monthly' | 'annual' }`.
    * Checks authenticated user.
    * Finds or creates `stripeCustomerId` in Stripe for user.
    * Creates `stripe.checkout.sessions.create` with `mode: 'subscription'`, line items with corresponding Price ID, metadata `{ userId: user.id }`, `success_url`, `cancel_url`.
    * Returns `{ url: session.url }`.
  * `POST /api/billing/webhook`:
    * Verifies `stripe-signature` using `STRIPE_WEBHOOK_SECRET` and raw request body.
    * Handles `checkout.session.completed`: Updates `User` plan to `'pro'`, records `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus = 'active'`, `currentPeriodEnd`.
    * Handles `customer.subscription.updated`: Updates renewal dates, interval changes, `cancelAtPeriodEnd`.
    * Handles `customer.subscription.deleted`: Sets `plan = 'free'`, `subscriptionStatus = 'canceled'`.
    * Handles `invoice.payment_failed`: Sets `subscriptionStatus = 'past_due'`.
  * `GET /api/billing/sync-status`: Fallback sync endpoint for client success page to verify active subscription directly.

### Out of scope

* Frontend Upgrade Modal (Phase 4).
* Customer Portal session endpoint (Phase 3).

### Backend allowance

* Named: Create `backend/src/routes/billing.ts`.
* Named: Mount raw body handler and billing router in `backend/src/index.ts`.
* Named: Update `User` subscription fields via Prisma upon webhook receipt.

### Files likely affected

* `backend/src/index.ts`
* `backend/src/routes/billing.ts`
* `backend/src/lib/stripe.ts`
* `backend/test/billingWebhook.test.ts`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M2.1** | Express Raw Body Parser & Webhook Route Mounting | `NOT STARTED` | Configure raw body capture on `/api/billing/webhook` before global JSON middleware in `index.ts`. |
| **M2.2** | Stripe Checkout Session Endpoint | `NOT STARTED` | Implement `POST /api/billing/create-checkout-session` validating interval and creating Stripe session. |
| **M2.3** | Webhook Cryptographic Verification & Event Handler | `NOT STARTED` | Implement `POST /api/billing/webhook` handling checkout completion, subscription updates, and deletions. |
| **M2.4** | Fallback Sync Endpoint & Idempotency Testing | `NOT STARTED` | Implement `GET /api/billing/sync-status` and author Vitest suite simulating signed Stripe events. |

### Regression checks

* **R-1**: Authentication routes must remain unaffected by raw body middleware.
* **R-20**: Webhook cryptographic signature verification must reject forged headers.

### Mobile acceptance

* N/A (Backend payment pipeline).

### Validation

1. Trigger checkout session creation via test API call &rarr; returns valid Stripe Checkout URL.
2. Dispatch mock `checkout.session.completed` signed event &rarr; user record in database updates to `plan: "pro"`.
3. Dispatch mock `customer.subscription.deleted` &rarr; user record updates to `plan: "free"`.
4. `npm test --workspace=backend`

### Exit criteria

* Server successfully creates valid Stripe checkout sessions.
* Webhook cryptographically validates and correctly transitions user subscription status in database.
* Replayed or forged webhooks are rejected with 400.

### Risks

* Express body-parser conflict if raw buffer is not properly isolated from global JSON parser (mitigate with path-specific middleware in `index.ts`).

---

## PHASE 3 — Customer Portal & Billing Management API

**Status:** `NOT STARTED`

**Source:** FD §3, §10, §11, §20 · AC-5 · decisions.md

**Objective:** Implement server-side generation of authenticated Stripe Customer Portal sessions and subscription status query endpoints for self-service billing management.

**Narrative line:** *"Total control over your membership, always."*

### Current state

* Users have no way to access Stripe billing controls, update credit cards, download tax invoices, or cancel subscriptions.

### Decisions required before starting

* None.

### In scope

* Add `POST /api/billing/create-portal-session` to `backend/src/routes/billing.ts`:
  * Requires authenticated user.
  * Verifies user has a valid `stripeCustomerId`.
  * Creates `stripe.billingPortal.sessions.create` with return URL to user account settings (`/settings`).
  * Returns `{ url: portalSession.url }`.
* Add `GET /api/billing/status` to `backend/src/routes/billing.ts`:
  * Returns `{ plan, subscriptionStatus, currentPeriodEnd, cancelAtPeriodEnd, interval }`.
* Provide clear error handling if a user without a Stripe customer record requests portal access.

### Out of scope

* Frontend Settings billing section (Phase 5).

### Backend allowance

* Named: Add portal session creation and status endpoints in `backend/src/routes/billing.ts`.

### Files likely affected

* `backend/src/routes/billing.ts`
* `backend/test/billingPortal.test.ts`
* `frontend/src/lib/api.ts`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M3.1** | Customer Portal Session Endpoint | `NOT STARTED` | Implement `POST /api/billing/create-portal-session` with user customer validation and return URL. |
| **M3.2** | Subscription Status Query Endpoint | `NOT STARTED` | Implement `GET /api/billing/status` returning authoritative plan metadata. |
| **M3.3** | Portal API Test Coverage | `NOT STARTED` | Author unit tests verifying portal session generation for valid customers and clean rejection for non-paying users. |

### Regression checks

* **R-1**: Authentication guard on portal session endpoint must prevent unauthenticated access.

### Mobile acceptance

* N/A (Backend API layer).

### Validation

1. Call `POST /api/billing/create-portal-session` for a user with `stripeCustomerId` &rarr; returns valid portal session URL.
2. Call `POST /api/billing/create-portal-session` for user without `stripeCustomerId` &rarr; returns 400 Bad Request with descriptive message.
3. `npm test --workspace=backend`

### Exit criteria

* Pro subscribers can request a single-use Customer Portal URL.
* API returns complete subscription details without exposing secret keys.

### Risks

* Stripe Portal configuration uninitialized in Stripe Dashboard (mitigate by documenting configuration checklist in README/setup notes).

---

## PHASE 4 — Frontend Upgrade Modal, Pricing UI & Entry Points

**Status:** `NOT STARTED`

**Source:** FD §3, §4, §5, §8, §16, §17, §18 · UX-1 · RULE-1 · AC-2, AC-3

**Objective:** Build a responsive, accessible Upgrade / Pricing Modal featuring Monthly and Annual plan options, feature comparisons, and seamless checkout redirection, and intercept limit triggers across the application.

**Narrative line:** *"Unlock unlimited deliberate practice when you're ready."*

### Current state

* Clicking "+ New Goal" or navigating to `/onboarding` allows creating another goal without any limit prompts.
* Navigation bar (`Navbar.tsx`, `AppRail.tsx`, `AppBottomBar.tsx`) has no Pro badge or upgrade CTA.
* `PathwaysExplorerModal.tsx` has no tier-awareness.

### Decisions required before starting

* None.

### In scope

* Create `frontend/src/components/billing/UpgradeModal.tsx`:
  * Built using Radix Dialog (`Dialog`, `DialogContent`).
  * Monthly vs Annual billing toggle with animated indicator and *"Save 20%"* emerald badge.
  * Plan feature comparison checklist:
    * *"Unlimited concurrent 90-day deliberate practice goals"*
    * *"Full Golden Rail AI deep research pipeline"*
    * *"Weekly AI adaptations and benchmark evaluations"*
    * *"Zen focus timer & circadian routine visualizer"*
    * *"Self-service billing & priority support"*
  * Clear pricing typography (e.g. $12/month vs $99/year) with tabular numerals (`tabular-nums font-mono`).
  * Primary CTA: *"Proceed to Secure Checkout"* with loading spinner state and double-click prevention.
  * Secondary dismiss affordance: *"Continue with 1 Free Goal"*.
* Intercept goal creation triggers:
  * When a free user (`user.plan === 'free'` or `!isPro`) with &ge; 1 active goal clicks "+ New Goal" in Dashboard or Navbar, open `UpgradeModal` instead of navigating to onboarding (`ENTRY-1`, AC-2).
* Add Pro badge & Upgrade CTA to navigation:
  * If `isPro`: Display glowing emerald "PRO" pill badge in `Navbar.tsx` and mobile navigation.
  * If free: Display discrete "Upgrade" CTA button in `Navbar.tsx` (`ENTRY-2`).
* Integrate `createCheckoutSession` API call in `frontend/src/lib/api.ts` and handle redirect to `session.url`.

### Out of scope

* Stripe Elements or custom in-app credit card fields (100% delegated to hosted Stripe Checkout).
* Settings billing tab (Phase 5).

### Backend allowance

* None. (Frontend UI and client API integration only).

### Files likely affected

* `frontend/src/components/billing/UpgradeModal.tsx` (new)
* `frontend/src/components/billing/PricingCard.tsx` (new)
* `frontend/src/components/app/Navbar.tsx`
* `frontend/src/components/app/AppRail.tsx`
* `frontend/src/components/app/AppBottomBar.tsx`
* `frontend/src/pages/DashboardPage.tsx`
* `frontend/src/lib/api.ts`
* `frontend/src/components/billing/UpgradeModal.test.tsx`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M4.1** | UpgradeModal & Pricing Card Component | `NOT STARTED` | Build accessible dialog with Monthly/Annual toggle, feature list, and Radix primitives. |
| **M4.2** | Stripe Checkout Initiation & Redirect | `NOT STARTED` | Wire "Proceed to Checkout" to `POST /api/billing/create-checkout-session` with loading feedback. |
| **M4.3** | Goal Limit Interception in Dashboard & Navbar | `NOT STARTED` | Intercept "+ New Goal" actions when free user has 1 active goal, triggering UpgradeModal. |
| **M4.4** | Navigation Pro Badge & Upgrade CTA | `NOT STARTED` | Add dynamic Pro pill or Upgrade button to `Navbar`, `AppRail`, and `AppBottomBar`. |
| **M4.5** | Component Unit Tests & Accessibility Verification | `NOT STARTED` | Author Vitest tests for modal toggle, keyboard navigation, focus trap, and checkout trigger. |

### Regression checks

* **R-2**: Free users with 0 active goals must reach onboarding normally without seeing the modal.
* **R-18**: Onboarding navigation must remain fully functional.

### Mobile acceptance

* Verified at 390px and 360px viewports.
* Pricing cards stack vertically.
* Toggle buttons and checkout CTA have minimum 44×44px touch targets.
* Dialog converts smoothly to bottom sheet on small viewports.

### Validation

1. Sign in as free user with 1 goal &rarr; click "+ New Goal" &rarr; UpgradeModal appears.
2. Toggle Monthly / Annual &rarr; price numbers and annual badge update cleanly.
3. Click "Proceed to Secure Checkout" &rarr; button enters loading state, redirects to Stripe URL.
4. `npm test --workspace=frontend`

### Exit criteria

* Free users hitting the 1-goal limit are smoothly prompted with the Upgrade Modal.
* Checkout redirection works without console errors or race conditions.
* Pro subscribers display the "PRO" badge in navigation.

### Risks

* Pop-up blocker intercepting `window.location.href` (mitigate by redirecting in the same window/tab).

---

## PHASE 5 — Settings Billing Tab, Checkout Return & Grace Mode

**Status:** `NOT STARTED`

**Source:** FD §3, §8, §9, §10, §14 · UX-3, UX-4, UX-5 · RULE-4, RULE-5 · AC-4, AC-5, AC-6

**Objective:** Deliver the dedicated Billing & Subscription section in user settings, the celebratory post-checkout return view, and the non-punitive Grace Mode banner for downgraded users.

**Narrative line:** *"Clarity in your account, dignity in your transitions."*

### Current state

* Settings / Profile has no billing section.
* No `/billing/success` or return route exists.
* Downgraded users have no dashboard notification explaining Grace Mode.

### Decisions required before starting

* None.

### In scope

* Build `frontend/src/components/billing/BillingSection.tsx`:
  * Embedded in User Settings / Account dialog/page (`UX-4`).
  * Displays current tier: *"Achivii Pro"* with emerald pill or *"Free Plan"*.
  * Displays billing cycle and renewal date (e.g. *"Renews on October 28, 2026"*).
  * If cancellation pending: Displays *"Pro active through [Date] · Cancels at period end"*.
  * Primary button: *"Manage Subscription & Invoices"* &rarr; calls `POST /api/billing/create-portal-session` and redirects to Stripe Customer Portal (AC-5).
* Build `frontend/src/pages/BillingSuccessPage.tsx` mounted at `/billing/success`:
  * Reached after Stripe Checkout completion (`UX-3`, AC-4).
  * Displays calm celebratory animation ("Welcome to Achivii Pro").
  * Calls `refreshUser()` or `syncStatus()` to instantly update `AuthContext`.
  * CTA: *"Create Your Next Goal"* &rarr; navigates to onboarding.
* Build `frontend/src/components/billing/GraceModeBanner.tsx`:
  * Rendered on `DashboardPage.tsx` when `user.plan === 'free'` and `activeGoalsCount > 1` (`UX-5`, AC-6).
  * Calm copy: *"You are currently on the Free tier with multiple existing journeys. Your active goals remain fully accessible. To create additional journeys, upgrade to Achivii Pro or archive a completed goal."*
  * Secondary CTA: *"View Upgrade Options"* opens `UpgradeModal`.

### Out of scope

* In-app invoice download table (handled by Stripe Customer Portal).

### Backend allowance

* None.

### Files likely affected

* `frontend/src/components/billing/BillingSection.tsx` (new)
* `frontend/src/pages/BillingSuccessPage.tsx` (new)
* `frontend/src/components/billing/GraceModeBanner.tsx` (new)
* `frontend/src/App.tsx` (route `/billing/success`)
* `frontend/src/pages/DashboardPage.tsx`
* `frontend/src/components/account/AccountSheet.tsx` (or settings equivalent)
* `frontend/test/billingSettings.test.tsx`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M5.1** | BillingSection in Settings | `NOT STARTED` | Implement subscription details card and Customer Portal launch button in Settings. |
| **M5.2** | BillingSuccessPage & Immediate State Sync | `NOT STARTED` | Implement `/billing/success` route with celebratory greeting and user state refresh. |
| **M5.3** | Grace Mode Banner & Non-Punitive Notice | `NOT STARTED` | Implement non-destructive notice on Dashboard for downgraded users with multiple goals. |
| **M5.4** | Settings & Return Vitest Suite | `NOT STARTED` | Author unit tests verifying portal launch, success page rendering, and grace mode copy. |

### Regression checks

* **R-1**: User account settings and profile management must continue to operate smoothly.
* **R-22**: Grace Mode must never block viewing or completing tasks on existing goals.

### Mobile acceptance

* 44px tap targets on "Manage Subscription" and return CTAs.
* Grace Mode banner text wraps cleanly without overflow at 360px.
* Customer Portal redirects smoothly in mobile Safari and Chrome.

### Validation

1. Navigate to Settings &rarr; verify billing status, plan name, and renewal date.
2. Click "Manage Subscription" &rarr; redirects to Stripe Customer Portal.
3. Open `/billing/success` &rarr; verifies Pro activation and provides "Create Next Goal" link.
4. Simulate user with `plan = 'free'` and 2 active goals &rarr; Grace Mode banner renders.
5. `npm test --workspace=frontend`

### Exit criteria

* Pro subscribers can reach Stripe Customer Portal with one click.
* Post-checkout return automatically reflects Pro membership.
* Downgraded accounts with multiple goals encounter reassuring Grace Mode notice.

### Risks

* Webhook latency causing `/billing/success` to load before database updates (mitigated by immediate sync call in `BillingSuccessPage`).

---

## PHASE 6 — Multi-Goal Switching & Concurrent Trajectories UI

**Status:** `NOT STARTED`

**Source:** FD §2, §6, §14, §27 · RULE-3 · AC-4

**Objective:** Deliver an intuitive goal switcher in the application navigation and dashboard, enabling Pro subscribers to effortlessly transition between concurrent active 90-day trajectories.

**Narrative line:** *"Master multiple disciplines without friction."*

### Current state

* `GoalContext.tsx` holds a single `activeGoal` and only fetches one active goal.
* Dashboard and navigation assume the user only ever views or switches their singular active goal.

### Decisions required before starting

* None.

### In scope

* Update `frontend/src/context/GoalContext.tsx`:
  * Add `activeGoals: Goal[]` list.
  * Add `switchActiveGoal(goalId: string)` method.
  * Support fetching all user active goals on load when user is Pro.
* Create `frontend/src/components/goal/GoalSwitcher.tsx`:
  * Compact, elegant dropdown in top navigation or dashboard header.
  * Displays active goal title, current week badge (e.g. *"Week 4 of 12"*), and deliberate practice theme.
  * Lists all active concurrent goals with quick-switching tap interaction.
  * Includes "+ New Goal" action at the bottom of the switcher (which creates without paywall for Pro, or triggers UpgradeModal for Free).
* Ensure Today view, strategic Roadmap view, Progress analytics, and Zen focus session immediately update to reflect the newly selected active goal upon switching.

### Out of scope

* Cross-goal aggregated analytics (Progress page remains scoped to the currently selected active goal).

### Backend allowance

* None. (Consumes Phase 1's `GET /api/goal/list` and `GET /api/goal/active?goalId=`).

### Files likely affected

* `frontend/src/context/GoalContext.tsx`
* `frontend/src/components/goal/GoalSwitcher.tsx` (new)
* `frontend/src/components/app/Navbar.tsx`
* `frontend/src/pages/DashboardPage.tsx`
* `frontend/src/components/goal/GoalSwitcher.test.tsx`

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M6.1** | GoalContext Multi-Goal State Expansion | `NOT STARTED` | Extend `GoalContext` with `activeGoals` list and `switchActiveGoal` selector. |
| **M6.2** | GoalSwitcher Navigation Component | `NOT STARTED` | Build accessible dropdown showing concurrent goals with current week and theme indicators. |
| **M6.3** | Seamless View Synchronization | `NOT STARTED` | Verify Today, Roadmap, and Progress views instantly re-render with selected goal context. |
| **M6.4** | Multi-Goal Interaction Tests | `NOT STARTED` | Author unit tests verifying goal switching, active state retention, and keyboard navigation. |

### Regression checks

* **R-7**: Active goal state persists across page reload.
* **R-8**: Daily task retrieval on Today updates cleanly to match selected goal.
* **R-14**: Roadmap staircase re-renders for the selected goal.

### Mobile acceptance

* Dropdown converts to clean bottom sheet on mobile viewports (&le; 768px).
* Touch target for each goal row is &ge; 48px height.
* Smooth close on selection without double taps.

### Validation

1. Sign in as Pro user with 2 active goals &rarr; GoalSwitcher displays both goals.
2. Select Goal B &rarr; Today dashboard immediately switches to Goal B's daily drill.
3. Reload page &rarr; Goal B remains selected.
4. Click "+ New Goal" in switcher &rarr; opens onboarding wizard directly without paywall.
5. `npm test --workspace=frontend`

### Exit criteria

* Pro users can switch between multiple concurrent goals in under 1 second.
* Switching updates all child views without desynchronization.
* Free users with 1 goal see static goal title without switcher complexity.

### Risks

* State stale closure in task completion handlers if `goalId` is not properly bound (mitigate by referencing active goal ID in all mutations).

---

## PHASE 7 — Mobile Ergonomics, Accessibility & E2E Verification Sweep

**Status:** `NOT STARTED`

**Source:** FD §16, §17, §31, §32 · AC-1 through AC-7 · N-1 through N-4

**Objective:** Conduct comprehensive cross-viewport mobile sweeps, WCAG AA accessibility audits, and implement automated Playwright E2E test suites proving the payment and subscription system end-to-end.

**Narrative line:** *"Flawless execution on every device."*

### Current state

* Payment feature components have individual unit tests, but no unified automated Playwright E2E suite covering the complete upgrade, billing portal, and multi-goal lifecycle.

### Decisions required before starting

* None.

### In scope

* Author comprehensive Playwright E2E suite `frontend/e2e/billing.spec.ts`:
  * **Test 1**: Free tier user creates 1 goal &rarr; succeeds without upgrade prompt (`AC-1`).
  * **Test 2**: Free tier user clicks "+ New Goal" &rarr; Upgrade Modal appears (`AC-2`).
  * **Test 3**: Modal interval toggle switches between Monthly and Annual pricing with correct discounts.
  * **Test 4**: Mocked checkout flow redirects to `/billing/success` &rarr; plan updates to Pro (`AC-3`, `AC-4`).
  * **Test 5**: Pro user creates 2nd concurrent goal &rarr; succeeds without paywall; GoalSwitcher toggles between them.
  * **Test 6**: Settings &rarr; Billing & Subscription opens Stripe Customer Portal link (`AC-5`).
  * **Test 7**: Grace Mode test: User downgraded with 2 active goals &rarr; goals remain editable, Grace Mode banner renders, "+ New Goal" is locked (`AC-6`).
  * **Test 8**: API guard test: Direct POST to `/api/goal/create` by free user with active goal returns 403 Forbidden (`AC-7`).
* Mobile viewport sweep across 360px, 375px, 390px, and 412px:
  * Check zero horizontal overflow (`documentOverflow <= 1`).
  * Check touch targets (&ge; 44×44px).
  * Check bottom sheet ergonomics on mobile Safari and Chrome.
* Accessibility sweep with `@axe-core/playwright`:
  * 0 WCAG 2.1 AA violations on UpgradeModal, BillingSection, BillingSuccessPage, and GoalSwitcher.

### Out of scope

* Live credit card processing against Stripe production (Stripe test mode fixtures only).

### Backend allowance

* None.

### Files likely affected

* `frontend/e2e/billing.spec.ts` (new)
* `frontend/src/components/billing/UpgradeModal.tsx` (polish if needed)
* `frontend/src/components/billing/BillingSection.tsx` (polish if needed)

### Milestones

| ID | Milestone | Status | Details |
|---|---|---|---|
| **M7.1** | Playwright E2E Automated Billing Suite | `NOT STARTED` | Implement 8 end-to-end integration tests covering AC-1 through AC-7. |
| **M7.2** | Cross-Device Mobile Viewport Sweep | `NOT STARTED` | Audit 360px, 375px, 390px, 412px viewports for zero overflow and 44px tap targets. |
| **M7.3** | WCAG AA Accessibility & Screen Reader Audit | `NOT STARTED` | Verify 0 axe violations, focus traps, aria labels, and keyboard navigation. |
| **M7.4** | Full Regression Sweep & Final Verification Report | `NOT STARTED` | Re-verify all touched items in R-1..R-22, compile documentation, and produce Phase 7 report. |

### Regression checks

* Complete verification across **R-1** through **R-22**.

### Mobile acceptance

* 0 horizontal scroll at 360px.
* Tap targets meet or exceed 44×44px.
* Native mobile virtual keyboard does not obscure modal inputs or action CTAs.

### Validation

1. `npx playwright test frontend/e2e/billing.spec.ts` (all 8 tests pass)
2. `npm test --workspace=backend` (100% pass)
3. `npm test --workspace=frontend` (100% pass)
4. `npm run type-check --workspace=frontend` (0 errors)
5. `npm run build --workspace=backend` (clean build)
6. `npm run build --workspace=frontend` (clean build)

### Exit criteria

* All 7 acceptance criteria (`AC-1` through `AC-7`) verified by automated Playwright E2E tests.
* Zero axe-core accessibility violations.
* Zero regressions across existing practice features.
* Final Phase Report completed.

### Risks

* E2E flakiness from external network calls (mitigate by mocking Stripe API responses in Playwright network routing).

---

# 5 — CROSS-PHASE CARRY-OVERS

Issues discovered during planning or deferred from earlier roadmaps that are tracked across phases:

| Carry-over ID | Description | Originating Phase | Target Phase | Status |
|---|---|---|---|---|
| **CO-1** | Stripe webhook live secret rotation procedure | Phase 2 planning | Production deployment | Open |
| **CO-2** | Localization of Stripe Checkout currency based on user timezone | Phase 2 planning | Future enhancement | Deferred |
| **CO-3** | Annual gift memberships and team licenses | Phase 4 planning | Future roadmap | Deferred |

---

# 6 — DECISION / OPEN-ITEM REGISTER

| ID | Decision Title | Status | Impact | Blocking |
|---|---|---|---|---|
| **OD-1** | Stripe Environment Price IDs Configuration | `DECIDED` | Injected via `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` env vars with sensible sandbox fallbacks | No |
| **ND-1** | Webhook Raw Body Isolation | `DECIDED` | Mount raw buffer middleware specifically on `/api/billing/webhook` before Express global json parser | No |
| **ND-2** | Free Goal Switch Intent Parameter | `DECIDED` | Provide `archivePrevious: true` in goal creation payload so free users can still replace their active goal cleanly | No |
| **ND-3** | Multi-Goal Default Selection on Login | `DECIDED` | Default to the most recently updated active goal; allow user to switch via GoalSwitcher | No |

---

# 7 — PHASE REPORT TEMPLATE

Upon completing each phase, the implementation agent must append a formal Phase Report using this authoritative format:

```text
# PHASE [X] REPORT — [PHASE NAME]

1. Outcome
   One paragraph describing what the user or system can now do that was impossible before.

2. What changed
   Detailed breakdown per screen, component, backend route, schema, or system behavior.

3. Files changed / created / removed
   - Created: ...
   - Modified: ...
   - Removed: ...

4. Functionality preserved (Regression Verification)
   Every R-n touched, with verification evidence and test results.

5. Decisions applied
   Every OD-n / ND-n implemented, citing rationale.

6. Validation evidence
   - Frontend Type-check: 0 errors
   - Backend Build: 0 errors
   - Frontend Vitest: X/X passed
   - Backend Vitest: X/X passed
   - Playwright E2E: X/X passed
   - Mobile Viewports (360px, 390px): 0 horizontal overflow
   - Accessibility: 0 axe-core violations

7. Carry-overs
   Any discovered issues or deferred enhancements, with assigned target phases.

8. Issues and risks found
   Any unexpected friction or edge cases resolved during implementation.

9. Next phase status
   Confirm next phase readiness and verify that the next phase has NOT begun.
```

---

# 8 — CHANGE LOG

| Date | Change description | Author |
|---|---|---|
| 2026-09-28 | Archived previous 12-phase redesign roadmap to `docs/phases_redesign_archive.md` | Phase Roadmap Architect |
| 2026-09-28 | Generated authoritative 8-phase implementation roadmap for Achivii Pro Membership & Stripe Subscription System (`docs/phases.md`) based on `docs/phases_template.md` and `docs/feature_definition_payment.md` | Phase Roadmap Architect |
