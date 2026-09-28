# PHASE 2 IMPLEMENTATION PROMPTS — Stripe Checkout & Webhook Pipeline

Companion to `docs/phases.md` (roadmap) and `docs/implementation_prompt_template.md` (prompt-generation system).

Last updated: 2026-09-28 · Phase 2 status: `NOT STARTED` · Contains: M2.1, M2.2, M2.3, M2.4.

## How to use this file

* Run **one prompt per implementation-agent session, in order M2.1 → M2.2 → M2.3 → M2.4**. Do not start a milestone until the previous one's completion report is verified and `docs/phases.md` is updated.
* Each prompt is **self-contained** (template §6): it repeats the context the agent needs, so it can be pasted into a fresh session alone.
* Each prompt follows the **21-section output format** defined in `docs/implementation_prompt_template.md` §21.

## Repository facts these prompts were compiled against (verified 2026-09-28)

| Fact | Where verified |
|---|---|
| `express.json()` is applied globally before all routes; no billing router exists | `backend/src/index.ts` |
| `getStripe()`, `isStripeConfigured`, `stripeConfig { webhookSecret, priceIdMonthly, priceIdAnnual, apiVersion: '2026-08-26.dahlia' }` all exist; `stripe.ts` is the only module that may import `stripe` | `backend/src/lib/stripe.ts` |
| `getAuthUser(req)` is exported from `auth.ts` and returns the full billing projection (`plan`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`) | `backend/src/routes/auth.ts` |
| Backend is ESM (`"type": "module"`) — relative imports must end in `.js` | `backend/package.json` |
| `stripe` ^22.6.2, express ^4.21.2, vitest ^5 installed; **no supertest** | `backend/package.json` |
| User model already has the 6 billing fields (Phase 0 complete) | `backend/prisma/schema.prisma` |

## Decision gate (phases.md §3.1 / template §16)

* **OD-1** (price ID env vars) — Decided. **ND-1** (raw body isolation on `/api/billing/webhook` before the global JSON parser) — Decided. **No decision blocks Phase 2.**
* **New decision raised by M2.2:** **ND-4 — Checkout return URLs.** Default: derive `success_url`/`cancel_url` from the existing `CLIENT_ORIGIN` with optional `STRIPE_CHECKOUT_SUCCESS_URL` / `STRIPE_CHECKOUT_CANCEL_URL` overrides. Record the outcome as a new row in the `docs/phases.md` §6 register. Do **not** renumber or edit the redesign decisions in `docs/decisions.md` — the payment feature tracks its decisions in the `phases.md` §6 register.
* **Known documentation discrepancy (report, don't silently resolve):** `docs/phases.md` cites a payment decision log in `docs/decisions.md` (FD §33 D-1…D-5), but `docs/decisions.md` currently only contains the *redesign* log. The payment register that actually exists is `docs/phases.md` §6. Agents must log payment decisions there and flag the discrepancy in their milestone report.

---

# IMPLEMENTATION TASK — M2.1

## Role

You are the implementation agent responsible for completing milestone **M2.1 — Express Raw Body Parser & Webhook Route Mounting** of **Phase 2 (Stripe Checkout & Webhook Pipeline)** in the Achivii Pro Membership & Stripe Subscription feature. You implement exactly this milestone, verify it, produce a completion report, and stop. You do **not** begin M2.2.

## Project Context

* Roadmap: `docs/phases.md`. Phase 0 (schema billing fields, `stripe` package, Stripe client module) is `COMPLETE`. Phase 2 has no blocking decisions; **ND-1** is decided: *"Mount raw buffer middleware specifically on `/api/billing/webhook` before Express global json parser."*
* Behavioral source of truth: `docs/feature_definition_payment.md` §20 (backend requirement), §25 (webhook signature verification with raw buffers), §26 (failure behavior). **RULE-6**: webhooks are the sole authoritative source of truth for subscription transitions. **N-1**: zero card data on Achivii servers. **R-20**: raw body signature verification with 5-minute tolerance.
* Verified repository state: `backend/src/index.ts` applies `app.use(express.json())` globally, then mounts `/api/health`, `/api/auth`, `/api/goal`. No billing routes exist. `backend/src/lib/stripe.ts` (Phase 0) exports `getStripe()`, `isStripeConfigured`, `stripeConfig`. Backend is ESM — relative imports end in `.js`.

## Current State

The global `express.json()` parser consumes and re-parses request bodies into JS objects. A JSON re-serialization is **not byte-identical** to Stripe's original payload, so Stripe signature verification would fail if the webhook route relied on it. Stripe webhooks must be read as the exact raw bytes. There is no `/api/billing` router yet.

## Objective

A billing router mounted at `/api/billing` whose `/webhook` path receives the exact raw request body as a `Buffer`, with every other route's middleware behavior unchanged, and honest `501` stubs for the three billing endpoints that M2.2–M2.4 will implement.

## Requirements

### R1
In `backend/src/index.ts`, mount the raw-body parser **before** `app.use(express.json())`, scoped strictly to the webhook path:

```ts
// Stripe webhook: must capture the exact raw bytes for signature verification (ND-1).
// Mounted BEFORE express.json() so the JSON parser never consumes this stream.
app.use('/api/billing/webhook', express.raw({ type: 'application/json', limit: '1mb' }));
```

`express.raw` sets `req._body`, so the subsequent global `express.json()` automatically skips these requests. Add a comment explaining this ordering contract so nobody "cleans it up" later.

### R2
Create `backend/src/routes/billing.ts` exporting `billingRouter` (follow the export style of `authRouter`/`goalRouter`) with three stub routes, each returning honest `501` responses:

* `POST /webhook` → `501 { error: 'Webhook handler not implemented yet (M2.3).', bodyIsBuffer: Buffer.isBuffer(req.body) }`
* `POST /create-checkout-session` → `501 { error: 'Not implemented yet (M2.2).' }`
* `GET /sync-status` → `501 { error: 'Not implemented yet (M2.4).' }`

The `bodyIsBuffer` diagnostic on the webhook stub is deliberate: it is how this milestone proves raw-body capture. M2.3 replaces the stub entirely.

### R3
Mount the router in `backend/src/index.ts`: `app.use('/api/billing', billingRouter);` alongside the existing routers, and import it with the ESM `.js` extension.

### R4
Verify zero cross-contamination: after the middleware reorder, all pre-existing JSON routes must still parse request bodies correctly (sign-up, login, `GET /api/auth/me`, goal routes).

### R5
Make **no other changes** to `index.ts` (CORS, error handling, route order for existing routers stay exactly as they are).

## Existing Behavior That MUST Remain Unchanged

* `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` — request parsing and responses (R-1).
* `POST /api/goal/create` and all goal routes — untouched.
* CORS behavior, including the allow-null-origin rule (Stripe's servers send webhooks with no `Origin` header — this must keep working).
* The global `express.json()` behavior for every non-webhook path.
* `backend/src/lib/stripe.ts` — do not modify; it already provides everything Phase 2 needs.

## Files / Areas to Inspect

Inspect these first, and verify against the repository rather than trusting this list:

* `backend/src/index.ts` — middleware order, route mounting.
* `backend/src/routes/auth.ts` and `backend/src/routes/goal.ts` — router export/mount conventions, `getAuthUser` pattern.
* `backend/src/lib/stripe.ts` — what Phase 0 already provides.
* `backend/test/stripe.test.ts` — Phase 0 test conventions (vitest, `vi.resetModules`, env cloning).
* `docs/phases.md` Phase 2 section and `docs/implementation_prompt_template.md`.

## Implementation Guidance

* Express 4 semantics: a path-scoped `app.use('/api/billing/webhook', ...)` mounted before the JSON parser is the standard Stripe pattern; do **not** use `express.json({ verify: ... })` tricks — they are fragile and contradict ND-1.
* The `1mb` limit accommodates large Stripe event payloads (the default 100 KB raw limit has caused truncated-payload signature failures in the wild).
* Do not create any new Prisma models, env vars, or dependencies in this milestone.

## Explicit Non-Goals

* Do **not** implement signature verification, checkout sessions, or sync-status logic (M2.2–M2.4).
* Do **not** touch the frontend, `goal.ts`, `auth.ts` logic, `schema.prisma`, or `lib/stripe.ts`.
* Do **not** add test dependencies (e.g., supertest) — none are installed and none are needed.
* Do **not** reorder or refactor existing middleware beyond what R1 requires.

## Acceptance Criteria

1. `POST /api/billing/webhook` with a JSON body responds `501` with `bodyIsBuffer: true`.
2. `POST /api/auth/login` with a JSON body parses correctly (raw middleware did not intercept it).
3. `GET /api/billing/sync-status` and `POST /api/billing/create-checkout-session` respond `501`.
4. Backend builds cleanly and the full backend vitest suite passes.

## Validation Requirements

1. `npm run build --workspace=backend` — clean.
2. `npm test --workspace=backend` — 100% pass (Phase 0's `stripe.test.ts` must still pass).
3. Manual verification against a running dev server:
   * `curl -i -X POST localhost:5000/api/billing/webhook -H 'Content-Type: application/json' -d '{"x":1}'` → `501`, `bodyIsBuffer: true`.
   * `curl -i -X POST localhost:5000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"e@x.com","password":"wrong"}'` → normal JSON auth response (401), proving JSON parsing still works.
   * `curl -i localhost:5000/api/billing/sync-status` → `501`.

## Regression Checks

* **R-1 (Authentication & Session)**: signup/login/session flows must be fully operational after the middleware reorder. Re-verify by running the auth flows above.
* **R-19 (Payment Card Data Safety)**: trivially satisfied here, but confirm no route accepts or stores card data.
* **R-20 (Webhook Cryptographic Integrity)**: only the plumbing exists at this point; full verification happens in M2.3/M2.4.

## Documentation Requirements

* Set `M2.1` status to `COMPLETE` in `docs/phases.md` with a one-line evidence note.

## Final Report Requirements

Report: (1) summary; (2) files changed/created; (3) requirements R1–R5 completed or not, with evidence; (4) tests run and results; (5) build result; (6) regression results for R-1; (7) carry-overs; (8) `git status` (do not commit); (9) documentation updated. Never claim a check passed that you did not run.

## Important Constraints

* Backend allowance for Phase 2: create `backend/src/routes/billing.ts`; mount raw body handler and billing router in `backend/src/index.ts`; update `User` subscription fields via Prisma upon webhook receipt (M2.3 only). Nothing else.
* ESM: every relative import ends in `.js`. TypeScript strictness per existing `tsconfig`.

---

# IMPLEMENTATION TASK — M2.2

## Role

You are the implementation agent responsible for completing milestone **M2.2 — Stripe Checkout Session Endpoint** of **Phase 2 (Stripe Checkout & Webhook Pipeline)**. You implement exactly this milestone, verify it, produce a completion report, and stop. You do **not** begin M2.3.

## Project Context

* Roadmap: `docs/phases.md` Phase 2. M2.1 is complete: a raw-body parser is mounted on `/api/billing/webhook` and `backend/src/routes/billing.ts` exists with `501` stubs.
* Behavioral source of truth: `docs/feature_definition_payment.md` §3 (*Initiate Pro Checkout* — loading spinner client-side, backend returns session URL; failure copy: *"Unable to start checkout. Please try again."*), §10 (double-click / duplicate-session edge case), §20 (endpoint contract `POST /api/billing/create-checkout-session`), §24 (<800 ms session creation), §25 (PCI — no card data), §26 (Stripe outage copy: *"Unable to connect to payment service. Please try again in a moment."*). **OD-1** decided: price IDs come from `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL`.
* Phase 4 (frontend) will consume `{ url }` and redirect the browser; the checkout page itself is 100% Stripe-hosted (UX-2).

## Current State

`backend/src/routes/billing.ts` contains only stubs. Phase 0's `backend/src/lib/stripe.ts` provides `getStripe()` (throws descriptively if `STRIPE_SECRET_KEY` is unset), `isStripeConfigured`, and `stripeConfig.priceIdMonthly` / `stripeConfig.priceIdAnnual`. `backend/src/routes/auth.ts` exports `getAuthUser(req)`, already used by `goal.ts`, returning the user with `id`, `email`, `plan`, and all billing fields.

## Objective

An authenticated `POST /api/billing/create-checkout-session` endpoint that validates the billing interval, finds or creates the user's Stripe customer, creates a Stripe Checkout subscription session for the selected price, and returns `{ url }`.

## Requirements

### R1 — Authentication guard
Resolve the user with `getAuthUser(req)` from `../routes/auth.js` (same pattern as `goal.ts`). If null → `401 { error: 'Unauthorized. Please sign in.' }`.

### R2 — Request validation
Accept `{ interval: 'monthly' | 'annual' }` only. Missing, non-string, or out-of-enum values → `400 { error: 'Invalid billing interval. Use "monthly" or "annual".' }`.

### R3 — Configuration guard
If `!isStripeConfigured` or the selected price ID (`stripeConfig.priceIdMonthly` / `stripeConfig.priceIdAnnual`) is an empty string → `503 { error: 'Billing is not configured. Please try again later.' }`. Never send an empty price ID to Stripe.

### R4 — Find-or-create Stripe customer
* If `user.stripeCustomerId` exists, reuse it.
* Otherwise `getStripe().customers.create({ email: user.email, metadata: { userId: user.id } })` and persist the ID via `prisma.user.update` on `../lib/prisma.js`.
* Reuse of an existing customer ID must not trigger a Stripe API call.

### R5 — Checkout session creation
`getStripe().checkout.sessions.create(...)` with:

```ts
{
  mode: 'subscription',
  line_items: [{ price: <selectedPriceId>, quantity: 1 }],
  customer: <stripeCustomerId>,
  client_reference_id: user.id,
  metadata: { userId: user.id },
  subscription_data: { metadata: { userId: user.id } }, // so subscription lifecycle webhooks carry the user
  success_url: <successUrl>,   // see R6
  cancel_url: <cancelUrl>,     // see R6
}
```

Do **not** set `allow_promotion_codes`, coupons, or trial settings — coupons are out of scope (FD §28).

### R6 — Return URLs (**raises decision ND-4 — record the outcome**)
Default, derived from the already-defined `CLIENT_ORIGIN` pattern in `index.ts`:

* `success_url`: `${CLIENT_ORIGIN}/billing/success?session_id={CHECKOUT_SESSION_ID}` (the `{CHECKOUT_SESSION_ID}` template lets the Phase 5 success page call `sync-status`).
* `cancel_url`: `${CLIENT_ORIGIN}/?checkout=canceled`.

Allow optional env overrides `STRIPE_CHECKOUT_SUCCESS_URL` and `STRIPE_CHECKOUT_CANCEL_URL`. Document the chosen defaults in `.env.example` (append only — do not touch existing entries), and log ND-4 (chosen option + rationale) as a new row in the `docs/phases.md` §6 register. Do **not** edit the redesign log in `docs/decisions.md`.

### R7 — Response and error mapping
* Success → `200 { url: session.url }`. If `session.url` is unexpectedly null → `502 { error: 'Checkout session created without a URL.' }`.
* Stripe API errors → `502 { error: 'Unable to connect to payment service. Please try again in a moment.' }` (FD §26 exact copy) and `console.error` the Stripe error server-side.
* No response ever includes Stripe error details, keys, or card data (R-19, N-1).

### R8 — Performance and hygiene
No artificial latency; the handler should typically complete well under 800 ms (FD §24). Log nothing that contains secrets or customer PII beyond the user id.

## Existing Behavior That MUST Remain Unchanged

* All auth and goal routes and their payloads (R-1).
* The raw-body middleware and webhook stub from M2.1.
* `backend/src/lib/stripe.ts` — import from it; do not modify it. It remains the only module importing the `stripe` package.
* The `User` schema — `stripeCustomerId` is the only field this milestone writes, and it already exists. No migrations.

## Files / Areas to Inspect

* `backend/src/routes/billing.ts` — replace the M2.2 stub only.
* `backend/src/lib/stripe.ts`, `backend/src/lib/prisma.ts`, `backend/src/routes/auth.ts` (`getAuthUser`), `backend/src/routes/goal.ts` (guard/error conventions).
* `backend/src/index.ts` — `CLIENT_ORIGIN` definition.
* `.env.example`, `docs/phases.md` §6 (decision register).

## Implementation Guidance

* Export the interval→price mapping and URL-building as small pure helpers (e.g., `resolvePriceId(interval)`, `buildCheckoutUrls(origin)`) so M2.4 can unit-test them without network access.
* Wrap the whole Stripe interaction in try/catch; distinguish configuration errors (R3, 503) from Stripe runtime errors (R7, 502).
* Double-click duplicate-session protection is a Phase 4 client concern (disabled loading state); the server stays naturally correct — one session per call is acceptable.

## Explicit Non-Goals

* Do **not** implement the webhook handler or signature verification (M2.3), or `sync-status` (M2.4), or the Phase 3 portal endpoints.
* Do **not** touch the frontend, schema, or `lib/stripe.ts`.
* Do **not** write the automated endpoint test suite — that is M2.4 (a few unit tests for the pure helpers from the guidance section are welcome).
* Do **not** add dependencies.

## Acceptance Criteria

1. Valid JWT + `{ interval: 'annual' }` → `200` with a `url` beginning `https://checkout.stripe.com` (test mode), and a customer ID persisted on the user.
2. Second call reuses the stored customer ID (verifiable by Stripe dashboard/test logs or API log count).
3. Missing/invalid interval → `400`. No auth → `401`. Unset price env var → `503`.
4. Backend build clean; all existing backend tests pass.

## Validation Requirements

1. `npm run build --workspace=backend` — clean.
2. `npm test --workspace=backend` — 100% pass.
3. Manual verification (test-mode key required; creates one Stripe **test-mode** customer + session — safe, no live money):
   * Call the endpoint with a real signup's JWT → assert `url` shape, then `curl` the user row (or `GET /api/auth/me`) to confirm `stripeCustomerId` persisted.
   * Repeat the three failure cases in Acceptance Criteria 3.

## Regression Checks

* **R-1**: auth flows unaffected — `GET /api/auth/me` still returns the full billing projection.
* **R-19 (PCI)**: confirm no card data is requested, logged, or stored anywhere in this flow.
* **R-2/R-7**: goal creation and persistence untouched.

## Documentation Requirements

* Set `M2.2` to `COMPLETE` in `docs/phases.md`; add the **ND-4** row to the §6 register; append the new optional env vars to `.env.example`.

## Final Report Requirements

Report: summary; files changed; R1–R8 evidence; tests run/results; build result; live-verification note (explicitly stating it was Stripe **test mode** and what data it created); ND-4 decision recorded; regressions; carry-overs; `git status`; docs updated. Never claim unrun checks.

## Important Constraints

* Backend allowance: create/extend `backend/src/routes/billing.ts`. Writing `stripeCustomerId` to `User` is within "finds or creates stripeCustomerId in Stripe for user" from the phase scope. No other schema or backend changes.
* `lib/stripe.ts` is the sole import site of the `stripe` package.

---

# IMPLEMENTATION TASK — M2.3

## Role

You are the implementation agent responsible for completing milestone **M2.3 — Webhook Cryptographic Verification & Event Handler** of **Phase 2 (Stripe Checkout & Webhook Pipeline)**. You implement exactly this milestone, verify it, produce a completion report, and stop. You do **not** begin M2.4.

## Project Context

* Roadmap: `docs/phases.md` Phase 2. M2.1 mounted the raw-body parser; M2.2 implemented checkout creation. The webhook stub currently returns `501 { error: 'Webhook handler not implemented yet (M2.3).', bodyIsBuffer: ... }`.
* Behavioral source of truth: `docs/feature_definition_payment.md` §10 (webhook latency race), §13 (**5-minute signature tolerance**), §20 (raw body signature verification), §24 (respond HTTP 200 within 1000 ms), §25 (every request verifies `stripe-signature` against `STRIPE_WEBHOOK_SECRET` using raw buffers), §26 (Stripe retries with exponential backoff on non-2xx). **RULE-6**: webhooks are the sole authoritative source of subscription transitions. **N-1/N-3**: no card data; cancelation never touches goals. **R-20**: forged or replayed webhooks are rejected with 400; **R-22**: Grace Mode non-destruction.
* Exit criterion for the phase: *"Replayed or forged webhooks are rejected with 400."*

## Current State

`backend/src/routes/billing.ts` has a checkout endpoint and a webhook stub. `stripeConfig.webhookSecret` (from `STRIPE_WEBHOOK_SECRET`, may be empty) is exported from `backend/src/lib/stripe.ts`. `req.body` on the webhook route is already a `Buffer` thanks to M2.1. The `User` model carries `plan`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd` (Phase 0 migration live).

## Objective

A cryptographically verified `POST /api/billing/webhook` that transitions the `User` record through the subscription lifecycle: checkout completion → `pro`, subscription updates → period/status sync, deletion → `free` (Grace Mode), failed invoice → `past_due`.

## Requirements

### R1 — Signature verification (R-20)
Inside the handler:

```ts
const event = getStripe().webhooks.constructEvent(
  req.body,                       // raw Buffer from M2.1
  req.headers['stripe-signature'] as string,
  stripeConfig.webhookSecret,
  { tolerance: 300 },             // 5 minutes, per FD §13
);
```

* Missing/invalid signature header, tampered payload, or stale timestamp → `400 { error: 'Webhook signature verification failed.' }`. Never leak the secret or echo the body.
* If `stripeConfig.webhookSecret` is empty → `503 { error: 'Webhook is not configured.' }`. **Never** process an event when unconfigured — an unsigned webhook must never be trusted (RULE-6).

### R2 — Fast acknowledge
Return `200 { received: true }` after handling (FD §24: within 1000 ms). Unknown/uninteresting event types → `200 { received: true, ignored: true }` — never 4xx/5xx for unrecognized types, or Stripe will retry forever.

### R3 — `checkout.session.completed`
* Only act when `event.data.object.mode === 'subscription'`; otherwise ignore.
* Resolve the user: `session.metadata?.userId` → fallback `session.client_reference_id` → fallback lookup by `stripeCustomerId = session.customer`. If no user found → `200` + log (a foreign-environment event must not 500).
* Update: `plan: 'pro'`, `stripeCustomerId`, `stripeSubscriptionId: session.subscription`, `subscriptionStatus: 'active'`, `cancelAtPeriodEnd: false`, and `currentPeriodEnd` (see R7).
* Handle the race where the customer row was not persisted by M2.2 (e.g., user created between session creation and completion) — find-or-create logic must tolerate `stripeCustomerId` already being set.

### R4 — `customer.subscription.updated`
* Resolve the user by `stripeSubscriptionId` first, then by `stripeCustomerId`.
* Sync `subscriptionStatus` (normalized per R6), `currentPeriodEnd`, and `cancelAtPeriodEnd` from the subscription object.
* Do **not** set `plan: 'free'` here — access persists through `past_due` and pending-cancellation periods (FD §9, §10). Only `customer.subscription.deleted` downgrades.

### R5 — `customer.subscription.deleted`
* Set `plan: 'free'`, `subscriptionStatus: 'canceled'`, `cancelAtPeriodEnd: false`.
* **Keep** `stripeCustomerId` and `stripeSubscriptionId` (past subscribers may still open the portal for invoices — FD §3).
* Never touch the user's goals — Grace Mode is non-destructive (RULE-4, N-3, R-22).

### R6 — Status normalization
Map Stripe subscription statuses onto the app's vocabulary (FD §11): `active → 'active'`, `trialing → 'trialing'`, `past_due → 'past_due'`, `canceled | unpaid | incomplete_expired → 'canceled'`. For unmapped future values, store the raw Stripe string (forward-compatible) rather than crashing. Export the normalizer as a pure function for M2.4's tests.

### R7 — Period end retrieval
Derive `currentPeriodEnd` by retrieving the subscription (`getStripe().subscriptions.retrieve(subscriptionId)`) and reading the current period end **as exposed by the pinned API version** (`2026-08-26.dahlia`). On recent Stripe API versions the period lives on subscription items, not the subscription root — verify against `node_modules/stripe/types` for the installed version and code to what the typings actually expose. Store as a Prisma `DateTime`.

### R8 — Idempotency without new tables
The Phase 2 backend allowance does **not** include new Prisma models, so there is no webhook-audit table. Achieve idempotency structurally: every write is a full-field update keyed on the user's Stripe identifiers, so re-delivering the same event produces the same final state (replay-safe, and replayed-but-valid events still return `200`). Verify this property in the handler design; M2.4 tests it.

### R9 — Error policy
* DB failure inside a verified handler → `500` (Stripe will retry with backoff — this is desirable), with a server-side log.
* Never log the signature header, the secret, or the full raw body.

## Existing Behavior That MUST Remain Unchanged

* The M2.1 raw-body middleware ordering and M2.2's checkout endpoint.
* Auth/goal routes (R-1), CORS null-origin allowance (Stripe posts without an `Origin` header).
* `lib/stripe.ts` — import only; it stays the sole `stripe` import site.
* No schema changes; the six billing columns already exist.

## Files / Areas to Inspect

* `backend/src/routes/billing.ts` — replace the webhook stub.
* `backend/src/lib/stripe.ts` — `stripeConfig.webhookSecret`, `getStripe`.
* `backend/src/routes/auth.ts` (`getAuthUser` is **not** used here — webhooks are authenticated by signature, not JWT), `backend/src/lib/prisma.ts`.
* `node_modules/stripe/types` — confirm the subscription period-end field path for the pinned API version.
* `docs/feature_definition_payment.md` §9, §13, §25, §26.

## Implementation Guidance

* Structure the handler as: verify → switch on `event.type` → resolve user → apply update → respond. Export the core as pure-ish functions (e.g., `verifyStripeSignature`, `normalizeSubscriptionStatus`, `handleStripeEvent`) so M2.4 can test them without HTTP or network.
* Test-mode manual verification uses `stripe listen --forward-to localhost:5000/api/billing/webhook` then `stripe trigger checkout.session.completed`. Without the Stripe CLI, you can hand-roll a valid header in a scratch script: `t=<unixSeconds>,v1=<hex hmac-sha256(secret, "<ts>.<rawBody>")>` — the same construction M2.4 will use in vitest.
* Keep the handler's Stripe reads minimal (one subscription retrieve) to respect the 1000 ms budget.

## Explicit Non-Goals

* Do **not** implement `GET /api/billing/sync-status` (M2.4), portal endpoints (Phase 3), or any frontend work.
* Do **not** create Prisma models/migrations (idempotency must be structural, R8).
* Do **not** change `lib/stripe.ts`, the checkout endpoint's contract, or auth routes.
* Do **not** grant Pro status from anything other than a verified webhook (no client-callable upgrade path — RULE-6).

## Acceptance Criteria

1. A validly signed `checkout.session.completed` (subscription mode) updates the target user to `plan: 'pro'` with IDs, `subscriptionStatus: 'active'`, and a non-null `currentPeriodEnd`.
2. A validly signed `customer.subscription.deleted` sets `plan: 'free'` / `subscriptionStatus: 'canceled'` and leaves the user's goals untouched.
3. A tampered payload or forged `stripe-signature` → `400`. A signature computed with the wrong secret → `400`. A timestamp older than 5 minutes → `400`.
4. An unknown but validly signed event type → `200 { received: true, ignored: true }`.
5. Re-delivering the same valid event twice leaves the DB in the same state (no duplicates/corruption).
6. When `STRIPE_WEBHOOK_SECRET` is unset, the endpoint responds `503` and performs no Prisma writes.

## Validation Requirements

1. `npm run build --workspace=backend` — clean.
2. `npm test --workspace=backend` — 100% pass.
3. Manual verification, choosing one (state which, and what data it created):
   * **Stripe CLI (test mode):** `stripe listen` + `stripe trigger checkout.session.completed` / `customer.subscription.deleted`; confirm the DB transitions.
   * **Hand-rolled signatures:** a scratch Node script that signs canned event JSON with the local `whsec_` and POSTs it; confirm Acceptance Criteria 1–5. Delete the scratch script afterward.

## Regression Checks

* **R-20**: forged/replayed → 400; valid → transitions applied. This milestone is the primary R-20 implementation.
* **R-19**: confirm no card/PII data is logged or stored by any handler.
* **R-1**: auth routes untouched and passing.

## Documentation Requirements

* Set `M2.3` to `COMPLETE` in `docs/phases.md`. If the pinned-API-version period-end field path contradicted anything in the docs, record it as a carry-over row in `docs/phases.md` §5 (cross-phase carry-overs).

## Final Report Requirements

Report: summary; files changed; R1–R9 evidence (including the exact period-end field path you found in the Stripe typings); tests run/results; build result; verification method used (CLI vs hand-rolled) and data created; regressions; carry-overs; `git status`; docs updated.

## Important Constraints

* Backend allowance: "Update `User` subscription fields via Prisma upon webhook receipt" — the six billing columns only. No new tables, no new endpoints beyond what exists.
* The webhook route must remain JWT-free: its authentication is the Stripe signature (R-1 applies to *other* routes, not this one).

---

# IMPLEMENTATION TASK — M2.4

## Role

You are the implementation agent responsible for completing milestone **M2.4 — Fallback Sync Endpoint & Idempotency Testing** of **Phase 2 (Stripe Checkout & Webhook Pipeline)** — the final milestone of Phase 2. You implement exactly this milestone, verify the whole phase, produce the **Phase 2 Report** per `docs/phases.md` §7, and stop.

## Project Context

* Roadmap: `docs/phases.md` Phase 2. M2.1 (raw body + mounting), M2.2 (checkout session), M2.3 (verified webhook with four event handlers) are complete.
* Behavioral source of truth: `docs/feature_definition_payment.md` §10 (**webhook latency race**: the success page must be able to verify the subscription directly), §26 (`GET /api/billing/sync-status` is the client fallback when webhook delivery lags), §24 (light, fast), §12 (`isPro` derives from `plan === 'pro' && subscriptionStatus === 'active'`). **RULE-6** still holds: webhooks are authoritative; sync-status is a *reconciler*, not an alternate upgrade path.
* Phase 3 will add a separate, pure-DB `GET /api/billing/status` — do not build it now and do not confuse the two endpoints.

## Current State

`backend/src/routes/billing.ts` implements checkout creation and the verified webhook handlers. The `GET /sync-status` route is still the M2.1 `501` stub. Test conventions in the repo: vitest 5, `vi.mock`/`vi.resetModules`, env cloning (`backend/test/stripe.test.ts`), function-level tests, **no supertest and no HTTP-layer tests**.

## Objective

A `GET /api/billing/sync-status` endpoint that returns the authoritative billing state and can self-heal webhook latency by reconciling against Stripe, plus a full vitest suite proving Phase 2's acceptance criteria, ending with the Phase 2 Report.

## Requirements

### R1 — Sync-status endpoint (auth)
Resolve via `getAuthUser` → `401` if absent. Response `200`:

```ts
{
  plan: string,                    // 'free' | 'pro'
  subscriptionStatus: string | null,
  currentPeriodEnd: string | null, // ISO
  cancelAtPeriodEnd: boolean,
  hasStripeCustomer: boolean,      // boolean only — never echo IDs beyond what's needed
  synced: boolean,                 // true if live reconciliation ran and matched
}
```

### R2 — Live reconciliation (fallback path, FD §26)
If the user has `stripeSubscriptionId` **and** Stripe is configured: retrieve the subscription, normalize the status (reuse M2.3's normalizer), and compare against the DB. On drift, update the `User` billing fields (this is the named "subscription sync" allowance) and return `synced: true`. If Stripe is unreachable or errors → **still `200`** with the DB state and `synced: false` — the endpoint must be safe to poll repeatedly from the Phase 5 success page.

### R3 — Secrets hygiene
The response never contains Stripe IDs beyond booleans, never price IDs, never secrets (extends R-19).

### R4 — Automated webhook/signature suite
Create `backend/test/billingWebhook.test.ts` covering, using hand-rolled HMAC signatures (`t=<ts>,v1=<hex hmac-sha256(webhookSecret, "<ts>.<rawBody>")>`) and a mocked Prisma layer per repo conventions:

1. Valid signature → handler runs; `checkout.session.completed` sets `plan: 'pro'`, IDs, `subscriptionStatus: 'active'`, `currentPeriodEnd`.
2. Tampered payload / wrong-secret signature → rejected with 400 (R-20).
3. Timestamp older than 300 s → rejected with 400 (FD §13 tolerance).
4. `customer.subscription.updated` syncs `subscriptionStatus` / `currentPeriodEnd` / `cancelAtPeriodEnd` without downgrading `plan`.
5. `customer.subscription.deleted` sets `plan: 'free'` / `canceled` and performs **zero** writes to any Goal model (R-22 evidence).
6. `invoice.payment_failed` sets `subscriptionStatus: 'past_due'`, `plan` unchanged.
7. Re-delivering the same event twice yields identical final DB state (idempotency, M2.3-R8).
8. Unknown event type → ignored with 200; no Prisma writes.
9. Empty `STRIPE_WEBHOOK_SECRET` → 503, zero Prisma writes.
10. User-not-found events → 200, no crash.

### R5 — Automated checkout & sync-status suite
In the same file or `backend/test/billingCheckout.test.ts`:

1. Interval→price mapping: monthly/annual resolve to the right env price; unknown → 400.
2. Missing price env / `isStripeConfigured === false` → 503 without calling Stripe.
3. Customer find-or-create: creates + persists when absent; reuses without a second Stripe customer call when present.
4. Session params: `mode: 'subscription'`, correct price, `metadata.userId` **and** `subscription_data.metadata.userId` set, no promotion codes.
5. Success/error mapping: `{ url }` on success; 502 with FD §26 copy on a Stripe error.
6. Sync-status: 401 unauthenticated; drift self-heal writes and `synced: true`; Stripe failure → 200 with DB state and `synced: false`.

### R6 — Testability without new dependencies
Export the pure helpers (`normalizeSubscriptionStatus`, signature verification, `handleStripeEvent`, interval/URL helpers) from `billing.ts`. Do **not** add supertest or any dependency (D-8: dependencies must earn their place; the existing suite is function-level).

### R7 — Full phase verification & Phase 2 Report
Run the complete Phase 2 validation list from `docs/phases.md`: backend build; backend vitest; frontend type-check and vitest (unaffected but required by the baseline §3.11); manual checks: checkout session creation returns a valid Stripe URL, signed `checkout.session.completed` upgrades to `pro`, signed `customer.subscription.deleted` downgrades to `free`, forged webhook → 400. Then write the **Phase 2 Report** in `docs/phases.md` §7 format (Outcome; What changed; Files; Regression verification for R-1, R-19, R-20; Decisions applied — OD-1, ND-1, ND-4; Validation evidence; Carry-overs; Issues/risks; Next-phase status confirming Phase 3 has not begun) and set Phase 2 status and the Status-at-a-Glance table accordingly. Append a row to the §8 change log.

## Existing Behavior That MUST Remain Unchanged

* M2.1 middleware ordering, M2.2 checkout contract (`{ url }`, status codes), M2.3 handler semantics — the suite must test them *as built*, not after refactoring.
* Auth/goal routes; `lib/stripe.ts`; Prisma schema (no migrations in this milestone).
* Frontend — untouched (its suites must still pass untouched).

## Files / Areas to Inspect

* `backend/src/routes/billing.ts` — replace the sync-status stub; keep exported helpers stable.
* `backend/test/stripe.test.ts`, `backend/test/goalCompletion.test.ts` — mocking and structure conventions to follow.
* `backend/src/lib/stripe.ts`, `backend/src/lib/prisma.ts`, `backend/src/routes/auth.ts`.
* `docs/phases.md` (Phase 2 exit criteria; §7 report template; §6 register; §8 change log).

## Implementation Guidance

* Mock Prisma at the module boundary (`vi.mock('../src/lib/prisma.js', ...)`) and Stripe at the `lib/stripe.ts` boundary where a live call would otherwise occur (`getStripe`), so signature verification runs against real crypto but network calls are faked.
* For the live-reconcile test, mock `getStripe().subscriptions.retrieve` to return drifted and erroring fixtures.
* Keep the reconciliation read minimal (one `subscriptions.retrieve`) — the success page may poll it several times.

## Explicit Non-Goals

* Do **not** implement `GET /api/billing/status` (Phase 3) or any portal endpoint.
* Do **not** begin Phase 3 work of any kind, and do not modify Phase 1's future scope.
* Do **not** add dependencies, Prisma models, or frontend code.
* Do **not** alter M2.2/M2.3 behavior to make tests easier — if a test reveals a genuine bug, fix the bug and report it.

## Acceptance Criteria

1. `GET /api/billing/sync-status` returns the R1 shape for authenticated users; drift self-heals; Stripe outage degrades gracefully (`synced: false`, 200).
2. The new vitest suites pass and cover the ten webhook cases (R4) and six checkout/sync cases (R5).
3. All Phase 2 validation commands from `docs/phases.md` pass.
4. `docs/phases.md` contains a complete Phase 2 Report, updated statuses, and a change-log row.

## Validation Requirements

1. `npm run build --workspace=backend` — clean.
2. `npm test --workspace=backend` — 100% pass including the new suites.
3. `npm run type-check --workspace=frontend` and `npm test --workspace=frontend` — pass (baseline §3.11).
4. Manual end-to-end of the phase's validation list (test-mode Stripe; state what data was created): checkout URL returned; signed upgrade event → `pro`; signed deletion event → `free`; forged → 400.

## Regression Checks

* **R-1**: auth routes and session flows still pass their suites.
* **R-19**: confirm across all three billing endpoints that no card data or secrets are stored, logged, or returned.
* **R-20**: forged/replayed/stale → 400 (now proven by automated tests, not just manual checks).

## Documentation Requirements

* Complete Phase 2 report, statuses, change log as specified in R7.
* Log any discovered discrepancy (e.g., the decisions.md/payment-register split noted in this file's header) in the report's Issues section — never resolve it silently.

## Final Report Requirements

Per `docs/phases.md` §7 and the template §L: summary; files changed/created; requirement traceability (R# → file → test → result, e.g. `M2.4-R4.3 → billing.ts → billingWebhook.test.ts → passed`); all validation evidence with real numbers; regression evidence; carry-overs (e.g., CO-1 webhook secret rotation, CO-2 currency localization remain open); risks; `git status` (do not commit); confirmation that Phase 3 has **not** been started.

## Important Constraints

* Backend allowance: the sync-status endpoint and the named "subscription sync" writes only. No new tables, no schema edits, no new dependencies.
* The whole phase closes here: every Phase 2 exit criterion in `docs/phases.md` must be demonstrably true before you mark it complete.
