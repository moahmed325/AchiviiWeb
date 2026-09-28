# ACHIVII PRO MEMBERSHIP & STRIPE SUBSCRIPTION SYSTEM — FEATURE DEFINITION

## 1. Overview

### Feature
Achivii Pro Membership & Stripe Subscription System

### Problem
Achivii currently provides deep AI research and multi-week deliberate practice scaffolding, but lacks any monetization infrastructure. Ambitious users who want to pursue multiple concurrent 90-day goals (e.g. professional craft + fitness + creative mastery) have no way to unlock concurrent goal tracking, while the platform absorbs ongoing AI compute and search costs without recurring revenue.

### Desired outcome
Free users can track and execute 1 active goal indefinitely at zero cost. When they attempt to create a second concurrent goal, they encounter an intuitive Upgrade modal offering Monthly and Annual Pro subscription options. After completing payment through Stripe's secure hosted Checkout, their account is instantly upgraded to Achivii Pro, allowing unlimited concurrent goals and full billing self-service via the Stripe Customer Portal in Settings.

### Target user
Ambitious professionals, founders, and self-directed learners who actively apply deliberate practice to multiple simultaneous domains and need a single command center for all their active trajectories.

### Motivation
To establish a sustainable, scalable SaaS business model while keeping onboarding frictionless with a permanent freemium tier that converts users at their highest moment of intent (expanding beyond their first goal).

---

## 2. User Goal

- **As a free user**, I want to use all core deliberate practice tools for my primary 90-day goal without paying, so that I can validate the platform's value before committing financially.
- **As an ambitious achiever**, I want to upgrade to Achivii Pro with a monthly or annual subscription, so that I can execute multiple concurrent goals simultaneously.
- **As a paying subscriber**, I want to view my renewal date, download invoices, update payment methods, or cancel anytime through a self-service billing portal, so that I have complete control over my subscription without contacting support.

---

## 3. Core User Actions

- **View Pricing / Upgrade Options**:
  - *Who can perform it*: Authenticated users on the Free tier.
  - *What happens*: A responsive modal opens presenting Monthly and Annual Pro plan benefits, pricing, and an interval toggle.
  - *What should the user see*: Feature comparison, pricing, savings badge on the annual plan (e.g., "Save 20%"), and an "Upgrade to Pro" CTA.
  - *What happens if it fails*: N/A (client-side modal).

- **Initiate Pro Checkout**:
  - *Who can perform it*: Authenticated Free users.
  - *What happens*: Backend creates a Stripe Checkout session with the selected price ID and user ID metadata, returning the session URL.
  - *What should the user see*: A momentary loading spinner ("Redirecting to secure checkout...") followed by redirect to Stripe's hosted checkout page.
  - *What happens if it fails*: An error banner appears: "Unable to start checkout. Please try again."

- **Complete Payment**:
  - *Who can perform it*: Any user on the Stripe Checkout page.
  - *What happens*: Stripe charges the user's card/Apple Pay/Google Pay and dispatches a secure webhook (`checkout.session.completed`) to Achivii.
  - *What should the user see*: User is redirected to `/billing/success` with a celebratory confirmation screen ("Welcome to Achivii Pro!"), then returned to the dashboard with unlimited goal creation unlocked.
  - *What happens if it fails*: Handled directly by Stripe with immediate retry or card error message.

- **Access Stripe Customer Portal**:
  - *Who can perform it*: Active or past Pro subscribers.
  - *What happens*: User clicks "Manage Subscription" in Settings; backend generates an authenticated Stripe Customer Portal session URL and redirects the user.
  - *What should the user see*: Stripe's hosted portal where they can update payment cards, view invoice history, switch intervals, or cancel the subscription.
  - *What happens if it fails*: An error toast: "Unable to load billing portal. Please try again later."

- **Cancel / Reactivate Subscription**:
  - *Who can perform it*: Active Pro subscribers (via Stripe Customer Portal).
  - *What happens*: Stripe marks the subscription to cancel at the end of the billing period and emits `customer.subscription.updated`.
  - *What should the user see*: Settings shows "Cancels on [Date]" with full Pro access retained until that date.

---

## 4. Primary User Journey

```text
Free User with 1 Active Goal
    ↓
Clicks "+ New Goal" or "Upgrade to Pro"
    ↓
Upgrade to Pro modal appears (Monthly vs Annual toggle)
    ↓
User selects billing interval and clicks "Proceed to Checkout"
    ↓
Redirected to secure Stripe Hosted Checkout
    ↓
User enters payment details and confirms purchase
    ↓
Stripe processes payment & sends webhook to Achivii backend
    ↓
Backend updates user plan to 'pro' and stores Stripe customer references
    ↓
User redirected to Achivii /billing/success screen
    ↓
User returns to Dashboard: "PRO" badge active, unlimited goal creation unlocked
```

---

## 5. Entry Points

- **ENTRY-1: Intercepted Goal Creation**: User has 1 active goal and clicks "+ New Goal" in Dashboard or Navbar -> Triggers the Upgrade Modal explaining the 1-goal limit on Free.
- **ENTRY-2: Navbar CTA**: Dedicated "Upgrade" button / Pro badge in the main navigation bar.
- **ENTRY-3: User Settings / Profile**: Dedicated "Billing & Subscription" tab displaying current plan status, renewal date, and "Manage Billing" link.

---

## 6. Core Concepts

- **Plan / Tier**: The access level assigned to an account (`free` vs `pro`).
- **Active Goal**: Any Goal in the database belonging to the user where `status` is `'active'`. (Archived or completed goals do not count).
- **Goal Limit**: Maximum concurrent active goals allowed (`1` for `free`, unlimited for `pro`).
- **Stripe Customer ID**: Unique identifier linking an Achivii user to Stripe's billing ecosystem.
- **Stripe Subscription ID**: Unique identifier tracking the ongoing recurring billing contract.
- **Billing Interval**: Cadence of recurring charge (`monthly` or `annual`).
- **Grace Mode**: Status for downgraded or canceled users who currently have 2+ active goals. All existing goals remain completely open and editable, but new goal creation is halted until active goals drop below 1.

---

## 7. Lifecycle

```text
Free Plan (0-1 active goals)
    ↓ (Clicks Upgrade + completes Stripe Checkout)
Active Pro Subscription (Unlimited active goals)
    ↓ (Automatic renewal or billing interval change)
Renewed Pro Subscription
    ↓ (User initiates cancellation via Customer Portal)
Pending Cancellation (Pro access retained until currentPeriodEnd)
    ↓ (Period ends without renewal)
Grace Free Plan (Existing goals remain intact; cannot create new goals until active < 1)
    ↓ (User re-subscribes via Checkout)
Active Pro Subscription
```

---

## 8. Experiences / Screens

| ID | Experience | Purpose | Required? |
|---|---|---|---|
| UX-1 | Upgrade / Pricing Modal | Displays Monthly & Annual plans, features comparison, and checkout CTA when user triggers an upgrade entry point. | Yes |
| UX-2 | Stripe Hosted Checkout | Secure, hosted payment capture handling credit cards, Apple Pay, Google Pay, and billing address. | Yes (Stripe-hosted) |
| UX-3 | Checkout Success Page | Confirms successful Pro activation, shows Pro badge, and directs user back to create their next goal. | Yes |
| UX-4 | Settings Billing & Subscription Section | Shows current tier, renewal/expiry date, plan status, and button to open Stripe Customer Portal. | Yes |
| UX-5 | Grace Mode Banner | Subtle notification in Dashboard for downgraded users explaining that existing goals are preserved but new goal creation requires < 1 active goal or upgrading. | Yes |

---

## 9. States

- **Initial / Free (0 active goals)**: User has full access to create their first goal with no upgrade prompts.
- **Free Cap Reached (1 active goal)**: User works normally; clicking "+ New Goal" triggers the Upgrade Modal.
- **Checkout In-Flight**: "Redirecting to checkout..." loading state prevents duplicate submissions.
- **Active Pro**: User has active subscription; "PRO" pill badge displayed in Navbar; "+ New Goal" works unconditionally.
- **Past Due**: Automated renewal charge failed; user sees a non-blocking warning banner in Settings with a direct link to update payment method in Stripe Portal.
- **Canceled (Grace Period)**: Subscription is canceled but period hasn't ended; UI displays "Pro access active through [Date]".
- **Downgraded to Free (Grace Mode)**: Subscription ended with >1 active goals; all existing goals remain editable, but "+ New Goal" is locked with upgrade prompt.

---

## 10. Edge Cases

- **Checkout Abandonment**: User opens Stripe Checkout and closes the tab or clicks "Back". User returns to Achivii with state intact and no orphan Pro status granted.
- **Webhook Latency / Race Condition**: User returns to `/billing/success` before the webhook finishes processing. The success page polls or triggers a light backend sync verification before rendering confirmation.
- **Card Expiry / Payment Failure**: Stripe emits `invoice.payment_failed`. Account enters `past_due`; Achivii shows a billing alert in Settings without immediately revoking access during Stripe's automatic retry window.
- **Pro User with 3 Goals Cancels**: Once subscription terminates, existing 3 goals are NOT deleted, locked, or hidden. The user can view, edit, and complete tasks on all 3. However, attempting to create a 4th goal opens the Upgrade modal.
- **Double Click on Checkout**: Button enters disabled loading state to prevent generating duplicate Stripe sessions.

---

## 11. Data Behavior

### User Account Attributes
- `plan`: String (`"free"` | `"pro"`), default `"free"`.
- `stripeCustomerId`: String?, nullable.
- `stripeSubscriptionId`: String?, nullable.
- `subscriptionStatus`: String?, nullable (`"active"`, `"past_due"`, `"canceled"`, `"trialing"`).
- `currentPeriodEnd`: DateTime?, nullable.
- `cancelAtPeriodEnd`: Boolean, default `false`.

### Data Survival
- Subscription state must survive all sessions, refreshes, device changes, and logouts.
- All user goals and deliberate practice data survive subscription upgrades, downgrades, and cancellations without loss.

---

## 12. Persistent / Temporary / Derived State

### Persistent State
- User billing metadata in database (`plan`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`).
- Webhook audit log / event idempotency records to prevent replay attacks.

### Temporary State
- Selected billing interval toggle (Monthly vs Annual) on the Upgrade Modal.
- Checkout redirect loading spinner.

### Derived State
- `canCreateGoal`: Boolean calculated as `plan === 'pro' || activeGoalsCount < 1`.
- `isGraceMode`: Boolean calculated as `plan === 'free' && activeGoalsCount > 1`.
- `isPro`: Boolean calculated as `plan === 'pro' && subscriptionStatus === 'active'`.

---

## 13. Time-Based Rules

- **Renewal Cadence**: Monthly subscriptions bill every 30/31 days; Annual subscriptions bill every 365 days, governed by Stripe.
- **Period End Access**: If canceled mid-cycle, Pro benefits remain active until exact Unix timestamp `currentPeriodEnd`.
- **Stripe Webhook Event Timing**: Webhook signatures are validated with a 5-minute tolerance window to prevent replay.

---

## 14. Product Rules

- **RULE-1**: Free tier accounts may have at most 1 active goal at any time.
- **RULE-2**: Completed (`status = 'completed'`) or archived goals do not count toward the active goal limit.
- **RULE-3**: Pro subscribers may create and maintain unlimited concurrent active goals.
- **RULE-4**: Downgrading or canceling Pro does NOT delete, freeze, or lock existing goals (Grace Mode).
- **RULE-5**: Users in Grace Mode with > 1 active goal cannot create a new goal until active goal count is 0.
- **RULE-6**: Stripe webhooks are the sole authoritative source of truth for subscription status transitions.
- **RULE-7**: The backend API (`POST /api/goals`) must enforce the active goal limit independently of frontend UI controls.

---

## 15. Permissions

- Any authenticated user can view pricing and initiate a Stripe Checkout session.
- Only the account owner can access their personalized Stripe Customer Portal.
- Unauthenticated visitors attempting to access checkout are routed to sign up / log in first.

---

## 16. Mobile Requirements

- Pricing cards and Upgrade Modal must be fully responsive and stack vertically on screens under 768px.
- Touch targets for the Monthly/Annual toggle and "Upgrade to Pro" buttons must exceed 44×44px.
- Stripe Hosted Checkout seamlessly adapts to mobile viewports with native Apple Pay and Google Pay sheets.

---

## 17. Accessibility Requirements

- Upgrade modal must trap focus when open and close cleanly on `Escape`.
- Monthly/Annual toggle must have descriptive `role="switch"` or `role="radiogroup"` with `aria-checked` states.
- Feature comparison lists must use standard semantic list elements (`<ul>`, `<li>`) with high color contrast (> 4.5:1).

---

## 18. Design Requirements

- Adhere to Achivii's dark glassmorphism design system (Tailwind v4 tokens, slate-900 canvas, emerald/cyan accents).
- High-visibility "PRO" pill badge in the Navbar next to the user avatar.
- Annual discount highlighted with a glowing emerald badge (e.g., "Save 20%").
- Clean, uncluttered pricing card layout with crisp iconography for included capabilities.

---

## 19. Existing System Integrations

- **Goal Creation Engine (`OnboardingWizard` & `goal.ts`)**: Gated when user already has an active goal.
- **User Authentication (`auth.ts` & `AuthContext`)**: Exposes `plan` and `isPro` to the client-side state.
- **Navbar (`Navbar.tsx`)**: Displays Pro badge or Upgrade CTA button.
- **Dashboard (`DashboardPage.tsx`)**: Handles intercepted "+ New Goal" action and displays subscription status.

---

## 20. Backend / Persistence Requirement

- Yes, server-side data and endpoint infrastructure are strictly required:
  - Database schema expansion on `User` to track Stripe subscription fields.
  - Server-side active goal count check in `POST /api/goals`.
  - Stripe Checkout session creation endpoint (`POST /api/billing/create-checkout-session`).
  - Stripe Customer Portal session endpoint (`POST /api/billing/create-portal-session`).
  - Stripe Webhook handler (`POST /api/billing/webhook`) with raw body signature verification.

---

## 21. External Services

- **Service**: Stripe (Stripe API & Stripe Webhooks)
- **Why required**: Secure credit card handling, recurring subscription lifecycle management, tax calculation, invoices, and compliance.
- **What behavior depends on it**: Checkout, recurring billing, payment method updates, cancellation, invoice generation.
- **Required or optional**: Required for paid tier functionality.

---

## 22. Notifications

- Toast notification upon successful return from Stripe Checkout: "Welcome to Achivii Pro! Unlimited goals unlocked."
- Non-blocking banner in Settings and Dashboard if a recurring payment fails (`past_due`).

---

## 23. Analytics

- Track event: `pricing_modal_opened` (with source: navbar vs goal_limit_trigger).
- Track event: `checkout_initiated` (with interval: monthly vs annual).
- Track event: `checkout_completed`.

---

## 24. Performance Requirements

- Checkout session URL generation must complete in under 800ms.
- Webhook response to Stripe must return HTTP 200 within 1000ms, performing heavier tasks asynchronously if needed.

---

## 25. Security / Privacy

- **PCI-DSS Compliance**: No raw credit card or financial account numbers ever touch Achivii servers or database; all payment entry is 100% delegated to Stripe Hosted Checkout and Customer Portal.
- **Webhook Signature Verification**: Every webhook request must verify the `stripe-signature` header against `STRIPE_WEBHOOK_SECRET` using raw request buffers.
- **Customer Portal Scoping**: Portal session creation must strictly scope to the authenticated user's `stripeCustomerId`.

---

## 26. Failure Behavior

- **Stripe Outage during Checkout Initiation**:
  - *Normal outcome*: User redirected to Stripe Checkout.
  - *Failure outcome*: Server returns error; user sees "Unable to connect to payment service. Please try again in a moment."
  - *Recovery*: User can retry without page reload or loss of data.
- **Webhook Delivery Failure / Retry**:
  - *Normal outcome*: Instant plan upgrade upon payment.
  - *Failure outcome*: Stripe retries webhook delivery with exponential backoff; client-side `/billing/success` endpoint includes a fallback verification endpoint (`GET /api/billing/sync-status`).

---

## 27. In Scope

- Monthly and Annual Pro recurring subscriptions via Stripe.
- Free tier 1-active-goal limit enforcement (frontend interceptor + backend authorization guard).
- Unlimited active goals for Pro subscribers.
- Responsive Upgrade / Pricing Modal with Monthly/Annual toggle and feature breakdown.
- Stripe Hosted Checkout integration.
- Stripe Customer Portal integration for self-service billing management.
- Webhook processing for checkout completion, renewal updates, cancellations, and payment failures.
- Dedicated "Billing & Subscription" section in User Settings.
- Grace Mode for expired/canceled subscriptions with > 1 existing goals.

---

## 28. Out of Scope

- Custom in-app credit card entry fields (Stripe Elements) — Hosted Checkout is chosen for PCI simplicity and mobile wallets.
- Usage-based token metering or pay-per-search credits.
- Team, enterprise, or multi-seat accounts.
- Coupon / referral marketing engine.
- Cryptocurrency or invoice-based wire payments.

---

## 29. Future / Deferred

- Lifetime one-time pass option.
- Team workspace subscriptions with shared goal tracking.
- Annual gift subscriptions.
- Promotional discount codes.

---

## 30. Non-Negotiables

- **N-1**: Zero sensitive payment card data stored on Achivii servers (100% delegated to Stripe).
- **N-2**: Existing free users must never lose access to their 1 active goal or any past completed goals.
- **N-3**: Canceled Pro users must retain full access to their existing goals (Grace Mode; no data deletion or artificial freeze).
- **N-4**: Goal creation API must enforce limits server-side, not just in UI.

---

## 31. Success Criteria

- A Free user with 1 active goal cannot create a 2nd goal without seeing the Upgrade modal.
- A user can complete Stripe Checkout in test mode and immediately see their account upgraded to Pro.
- A Pro user can create 2, 3, or more active goals concurrently.
- A Pro user can open Stripe Customer Portal from Settings to manage their subscription.
- Webhook updates properly reflect cancellation and transition user to Grace Mode when period ends.

---

## 32. Acceptance Criteria

- **AC-1**: Given a Free user with 0 active goals, when they create a goal, it succeeds without an upgrade prompt.
- **AC-2**: Given a Free user with 1 active goal, when they click "Create Goal" or "+ New Goal", the Upgrade to Pro modal opens explaining the 1-goal limit and offering Monthly and Annual Pro plans.
- **AC-3**: Given a user on the Upgrade modal, when they click "Upgrade to Pro", they are redirected to a secure Stripe Checkout session.
- **AC-4**: Given a successful Stripe payment, when the user is redirected to the app, their plan displays as "Achivii Pro" and they can create additional goals immediately.
- **AC-5**: Given an active Pro user, when they navigate to Settings > Billing & Subscription, they see their active plan, next renewal date, and a "Manage Subscription" button that opens Stripe Customer Portal.
- **AC-6**: Given a canceled Pro user whose period has ended and who has 2 active goals, when they view their dashboard, both goals remain active and editable, but "+ New Goal" triggers the Upgrade modal.
- **AC-7**: Given a direct POST request to `/api/goals` by a Free user who already has 1 active goal, the server returns 403 Forbidden with `{ error: "GOAL_LIMIT_REACHED" }`.

---

## 33. Decisions Already Made

- **D-1**: Recurring subscription model with Monthly and Annual options.
- **D-2**: Paywall boundary is number of active concurrent goals (Free = 1, Pro = unlimited).
- **D-3**: Payment gateway is Stripe, utilizing Stripe Hosted Checkout and Stripe Customer Portal.
- **D-4**: Freemium strategy with permanent free tier (no credit card required on signup).
- **D-5**: Grace mode for canceled/downgraded subscribers with >1 goal (no goal freezing or deletion).
- **D-6**: Upgrade entry points are "+ New Goal" action interception, Navbar Pro CTA, and Settings Billing tab.

---

## 34. Open Decisions

- **OD-1**: Specific price points (e.g., $12/month and $99/year) to be configured via Stripe Dashboard and injected via `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` environment variables. *Blocking: No.*

---

## 35. Constraints

- Must integrate into existing React 19 + Vite frontend and Node/Express + Prisma backend monorepo.
- Must use official `stripe` npm library on backend.
- Must verify Stripe raw webhook signatures with Express raw body parser middleware.

---

## 36. Regression Requirements

- **R-1**: Free users with 0 active goals must continue to create goals via OnboardingWizard without regression.
- **R-2**: The Golden Rail AI research pipeline, daily task checkoffs, Zen focus timer, and weekly reviews must remain fully operational across all goals.
- **R-3**: Existing JWT authentication and profile endpoints must remain backward-compatible.
