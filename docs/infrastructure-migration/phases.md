# ACHIVII INFRASTRUCTURE MIGRATION — PHASES

**Goal:** Move Achivii production PostgreSQL from Render to the fresh Supabase project, then migrate custom scrypt/JWT authentication to Supabase Auth without changing user identity or billing behavior.

**Source of truth:** `docs/infrastructure-migration/feature-definition-infrastructure-migration.md`, migration brief, repository code/tests.

**Current position:** Phase 2 auth groundwork is implemented. M2.1, backend M2.2, backend M2.4, and M2.3 frontend session ownership are complete. M2.5 live-session verification was explicitly waived by the user; proceed to Phase 3 with that verification limitation recorded.

## Global rules

- One phase at a time; do not start the next automatically.
- `users.id` is immutable.
- Preserve goals, roadmap weeks, tasks, reviews, research cache, subscriptions and webhook events.
- Preserve Lemon Squeezy IDs, webhook idempotency and entitlement behavior.
- Do not redesign the product or API architecture.
- Do not expose secrets.
- Do not claim success without evidence.
- No unrelated refactors or dependency changes.
- Keep the Render DB available until the Supabase migration is verified.
- Health `200` alone is not proof of DB connectivity.
- No commit/push unless explicitly requested.

## Phase order

`P0 Preparation → P1 Database Transfer → P2 Auth Groundwork → P3 Auth Cutover → P4 Cleanup`

## Status

| Phase | Status | Main result |
|---|---|---|
| P0 | COMPLETE | Facts, baseline, transfer method and rollback posture |
| P1 | COMPLETE | Supabase is serving production DB traffic; data and runtime verification passed |
| P2 | COMPLETE* | Supabase identity linking, backend dual-auth, and frontend session ownership implemented |
| P3 | IN PROGRESS | Supabase Auth becomes normal path |
| P4 | BLOCKED | Legacy auth retired and migration closed |

# P0 — PREPARATION

**Objective:** Confirm the two databases, establish the production baseline, and prepare the transfer. This is preparation, not a separate project-long backup exercise.

### M0.1 — Verify infrastructure
- Confirm Render DB and fresh Supabase project.
- Confirm target region/version/pgvector.
- Confirm connection options.
- Record only facts that affect migration.

### M0.2 — Capture baseline
- Record production table counts and critical records.
- Record users, goals, roadmap/task/review data, subscriptions, webhook events and research cache.
- Confirm current Prisma migration state.

### M0.3 — Prepare transfer
- Use PostgreSQL 18 client for the Render PostgreSQL 18 source.
- Produce the transfer dump/export.
- Validate that the dump can be used against the PostgreSQL 17 Supabase target before production cutover.
- If version incompatibility appears, stop and resolve it before changing production.

### M0.4 — Decide cutover
- Choose Supabase runtime connection mode.
- Confirm target pgvector setup.
- Confirm rollback window: Render remains intact until verification passes.

**Exit:** transfer artifact exists and is usable, baseline is recorded, target is ready, and no production data has been changed.

# P1 — DATABASE TRANSFER

**Objective:** Copy Render PostgreSQL to Supabase and switch the API to Supabase.

### M1.1 — Prepare target
- Enable required PostgreSQL/pgvector capabilities.
- Apply the existing Prisma migration history to Supabase.
- Verify schema, indexes and constraints.

### M1.2 — Transfer data
- Import production data into Supabase.
- Preserve every existing `users.id` and all relationships.
- Do not rewrite application/business logic.

### M1.3 — Verify target
- Compare table counts with the baseline.
- Check FK orphans and critical records.
- Check subscriptions/webhook events and pgvector.
- Run backend tests and `npm run verify:pgvector`.

### M1.4 — Cut over
- Change only the production DB connection to Supabase.
- Verify real DB-backed API flows: auth lookup, goals, tasks, reviews and billing state.
- Keep Render available for rollback.

**Verified 2026-09-30:**
- Production `https://achivii-api.onrender.com/api/health` returned HTTP 200.
- Production protected goal and billing routes returned HTTP 401 when unauthenticated, confirming the live route stack is responding normally.
- Supabase migration data was previously verified: `users=4`, `subscriptions=1`, `webhook_events=11`; `goals=0`, `daily_tasks=0`, `roadmap_weeks=0`, `weekly_reviews=0`, `research_cache=0`.
- Supabase pgvector verification passed: vector column, HNSW index, GIN index and cosine query.
- Backend build passed; backend test suite passed: 52 files / 358 tests.
- User confirmed the production application is working after the cutover.
- Old Render `achivii-db` remains available for rollback.
- `render.yaml` now uses manually managed `DATABASE_URL` (`sync: false`) so a Blueprint sync cannot silently restore the old database reference.
- No application/business-logic changes were made for the cutover.

**Exit:** Supabase is serving production traffic and verification passes. Auth remains the existing custom auth.

# P2 — AUTH GROUNDWORK

**Objective:** Add Supabase Auth without removing the current auth path.

### M2.1 — Identity link
- Add nullable unique `users.auth_user_id`.
- Link Supabase `sub` to the existing internal `users.id`.

### M2.2 — Backend token foundation
- Add backend Supabase token verification.
- Preserve the existing internal user/API contract.
- Resolve Supabase-authenticated users to the original internal users.id.
- Legacy auth remains available.

### M2.3 — Frontend session foundation
- Introduce Supabase session ownership in the frontend.
- Make Supabase session restoration available to the existing auth context.
- Preserve existing protected-route behavior and non-auth localStorage.
- Do not cut over normal signup/login yet; that belongs to P3.

**Status:** COMPLETE. Supabase session ownership/restoration is wired into the existing auth context; normal signup/login remains legacy until P3. Live browser session exercise was not performed; user explicitly waived it.

### M2.4 — Dual transition
- Keep legacy scrypt/JWT verification working.
- Prevent duplicate internal users.
- Establish safe existing-user linking and new-user bootstrap.

**Status:** COMPLETE. Safe existing-user linking, new-user bootstrap, and duplicate prevention are implemented and tested.

### M2.5 — Verify
- Backend dual-auth tests cover legacy JWT, existing-user linking, new-user bootstrap and duplicate-identity safety.
- Frontend production build passes with Supabase session ownership wired in.
- Live browser verification of Supabase login/logout/refresh was explicitly waived by the user; this remains a known verification limitation.

**Exit:** Supabase identities can be safely linked to existing users while legacy auth still works, and the frontend can restore and own a Supabase session.

**P2 completion note:** Implementation is complete, but live frontend session exercise is not independently evidenced.

# P3 — AUTH CUTOVER

**Objective:** Make Supabase Auth the normal authentication path while preserving internal identity.

### M3.1 — New users
- New signup/login uses Supabase Auth.
- Create/link the internal Achivii user without replacing `users.id`.
- Frontend AuthContext uses Supabase sign-in/sign-up when configured; legacy auth remains fallback when it is not configured.
- Supabase-authenticated sessions call `/api/auth/me`, which performs safe internal-user linking/bootstrap.
- Production frontend and backend builds pass; live Supabase browser login was not independently exercised.

### M3.2 — Existing users
- Migrate existing users safely on the approved transition path.
- Never create a duplicate internal account.

### M3.3 — Sessions and protected routes
- Supabase session restoration becomes authoritative.
- Backend requests resolve to the original internal user.

### M3.4 — End-to-end verification
- Verify free and Pro accounts, goals, protected routes, entitlement, logout and refresh.

**Exit:** Supabase Auth is the normal path and remaining legacy users are known.

# P4 — CLEANUP & CLOSE

**Objective:** Retire legacy auth only after migration coverage is verified.

### M4.1 — Retirement readiness
- Confirm remaining legacy users and rollback needs.

### M4.2 — Retire legacy auth
- Disable/remove legacy JWT/scrypt paths only after approval and evidence.
- Remove migration-only configuration.
- Do not delete password hashes unless explicitly approved.

### M4.3 — Final verification
- Build/tests, login/session restoration, goals, Pro entitlement, Lemon Squeezy webhook idempotency and deployment checks.

### M4.4 — Close
- Document final architecture and remaining deferred work.

**Exit:** Supabase Auth is authoritative, legacy auth is retired, application/billing behavior is verified.

# Deferred

- Password recovery, email verification, OAuth and MFA.
- Historical Stripe-column cleanup.
- Render DB decommissioning, after migration burn-in.
- Unrelated repository issues.

# Auth decisions that still matter

- Supabase JWT verification configuration.
- Known-password user creation/linking semantics.
- Email-confirmation policy.
- Password policy.
- Auth retirement/burn-in window.

# Completion standard

The migration is complete only when data, `users.id`, subscriptions, webhook events, pgvector, application flows, entitlement and authentication have all been verified. A successful deployment alone is insufficient.

# Change log

| Date | Change |
|---|---|
| 2026-09-30 | Initial roadmap. |
| 2026-09-30 | Simplified into a direct transfer-first execution plan while retaining detailed auth phases. |
| 2026-09-30 | P0 and P1 completed: Supabase data transfer verified, pgvector/build/tests passed, production Render API cut over to Supabase, and render.yaml changed to manually managed DATABASE_URL. P2 remains not started. |
