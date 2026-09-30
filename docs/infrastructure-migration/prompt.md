# ACHIVII INFRASTRUCTURE MIGRATION — EXECUTION PROMPTS

**Goal:** Move the production database to Supabase quickly and safely, then migrate custom auth to Supabase Auth. Use these prompts as an execution checklist, not as a reason to create extra process.

## System rules

```text
You are implementing the Achivii infrastructure migration.

Read the current phase, feature definition, migration brief and actual repository before editing.
Work on one milestone at a time, but keep the milestone as small and practical as possible.
Do not start the next phase automatically.

Permanent constraints:
- users.id must never change.
- Preserve goals, roadmap, tasks, reviews, research cache, subscriptions and webhook events.
- Preserve Lemon Squeezy provider IDs, webhook identity/idempotency and entitlement behavior.
- Do not redesign the product or frontend -> Render API architecture.
- Do not expose secrets.
- Do not invent production facts or claim unverified results.
- Do not destroy the Render DB until migration burn-in is complete.
- No unrelated refactors or dependency changes.
- No commit/push unless explicitly requested.

For DB work, verify the actual target before cutover.
For auth work, preserve the original internal users.id and prevent duplicate accounts.
At the end of every milestone report: changes, files, tests/evidence, failures, risks and git status.
STOP after the assigned milestone.
```

## Simple workflow

### W1 — Inspect
```text
Read the feature definition, migration phases, migration brief and relevant code/tests.
Do not edit.
Report current phase, milestone, dependencies, open decisions and git status.
STOP.
```

### W2 — Execute
```text
Implement ONLY the assigned milestone in docs/infrastructure-migration/phases.md.
Read actual files before editing.
Stay within scope and preserve all protected data/contracts.
Run the relevant validation immediately after the change.
Report actual evidence and unverified items.
STOP. Do not start another milestone.
```

### W3 — Verify
```text
Do not change code.
Verify the milestone using the appropriate build/tests, database checks, API checks and live checks.
For DB migration compare counts, relationships, critical records, indexes/constraints and pgvector.
For auth verify Supabase identity -> original users.id and duplicate-account prevention.
For billing verify subscription identity, webhook idempotency and entitlement.
Report PASS/FAIL/NOT RUN with evidence.
STOP.
```

### W4 — Close
```text
Only after verification passes, update the migration phase status and record evidence.
List carry-overs and risks.
Confirm the next phase has NOT started.
STOP.
```

# P0 — PREPARATION

Execute only P0.

Goal: prepare the direct Render -> Supabase transfer without unnecessary process.

### M0.1 Infrastructure facts
- Confirm Render DB and fresh Supabase project.
- Confirm source/target PostgreSQL versions and pgvector.
- Confirm usable connection endpoints.

### M0.2 Baseline
- Record production counts for users, goals, roadmap weeks, tasks, reviews, subscriptions, webhook events and research cache.
- Record critical identity/billing records.

### M0.3 Transfer preparation
- Use a PostgreSQL 18 client for the PostgreSQL 18 Render source.
- Create the transfer dump/export.
- Validate that the chosen transfer method works with the PostgreSQL 17.6 Supabase target.
- Do not change production yet.

### M0.4 Cutover readiness
- Confirm target schema strategy and pgvector setup.
- Confirm Supabase runtime connection mode.
- Keep Render available as rollback until verification passes.

P0 exit: transfer is technically ready, baseline exists, target is ready, and production has not been cut over.
# P1 — DATABASE TRANSFER

Execute only P1.

Goal: transfer the production Render PostgreSQL database to the fresh Supabase PostgreSQL database and cut production over.

### M1.1 Target schema
- Prepare the fresh Supabase project.
- Enable required pgvector support.
- Apply the existing Prisma migration history.
- Verify tables, indexes and constraints.

### M1.2 Data transfer
- Import the Render production data.
- Preserve every users.id and all relationships.
- Preserve subscriptions, webhook events and research cache.
- Do not rewrite business logic.

### M1.3 Verification
- Compare counts against the P0 baseline.
- Check FK orphans and critical records.
- Check pgvector/vector data.
- Run backend build/tests and npm run verify:pgvector.
- Verify DB-backed goal/task/review flows.

### M1.4 Cutover
- Change only DATABASE_URL for production.
- Verify the live API against Supabase.
- Verify auth lookup, goals, reviews, subscriptions and webhook state.
- Keep Render DB untouched for rollback.

P1 exit: Supabase is serving production traffic and all required verification passes.

# P2 — AUTH GROUNDWORK

Execute only P2.

Goal: introduce Supabase Auth while legacy scrypt/JWT auth remains available.

### M2.1 Identity
- Add nullable unique users.auth_user_id.
- Link Supabase Auth sub -> existing internal users.id.
- Never replace or regenerate users.id.

### M2.2 Backend verification
- Add Supabase token/session verification.
- Preserve the existing internal user/API contract.
- Resolve authenticated Supabase users to the internal user.

### M2.3 Frontend sessions
- Introduce Supabase session ownership in the frontend.
- Make Supabase session restoration available to the existing auth context.
- Preserve existing protected-route behavior and non-auth localStorage.
- Do not make Supabase signup/login the normal path yet; that is P3.

**Status:** pending. Backend Supabase token verification and backend dual-auth linking are already implemented, but the frontend still owns the legacy achivii_auth_token only.

### M2.4 Dual transition
- Keep legacy scrypt/JWT verification working.
- Link existing users safely.
- Prepare new-user bootstrap.
- Prevent duplicate internal users.

**Status:** backend implementation complete; final P2 verification is blocked on M2.3 frontend session ownership.

### M2.5 Verification
Test:
- existing user
- new user
- free user
- Pro user
- wrong password
- logout
- refresh/session restoration
- protected routes
- duplicate identity
- internal users.id resolution

Do not mark logout, refresh or session restoration as PASS until a real Supabase frontend session has been exercised.

P2 exit: Supabase identities can be linked safely while legacy auth still works, and the frontend can restore and own a Supabase session.

# P3 — AUTH CUTOVER

Execute only P3.

Goal: make Supabase Auth the normal path without changing internal identity or billing.

### M3.1 New users
- New signup/login uses Supabase Auth.
- Create/link the internal Achivii user.
- Preserve users.id.

### M3.2 Existing users
- Migrate existing users through the approved transition path.
- Never create duplicate internal accounts.
- Keep legacy login available until coverage is verified.

### M3.3 Sessions
- Supabase session restoration becomes normal.
- Backend protected requests resolve to the original internal user.
- Logout and refresh must work.

**Status:** COMPLETE for implementation/automated verification. Frontend build passes, backend dual-auth tests pass (4/4), and the existing production protected-route unauthenticated check returns HTTP 401. Live browser login/logout/refresh was explicitly waived by the user.

### M3.4 Product/billing verification
Verify:
- free account
- Pro account
- existing goals
- protected routes
- entitlement
- logout
- session restoration
- Lemon Squeezy webhook behavior

**Status:** COMPLETE* — billing route tests 10/10 passed, webhook identity/idempotency tests 6/6 passed, frontend production build passed, and backend TypeScript build passed. Live authenticated free/Pro/logout/session-restoration checks were not independently exercised because live browser verification was explicitly waived.

P3 exit: Supabase Auth is the normal path and remaining legacy users are known.
# P4 — CLEANUP AND CLOSE

Execute only P4.

Goal: retire legacy auth after migration coverage is proven.

### M4.1 Retirement readiness
- Confirm remaining legacy users.
- Confirm rollback/burn-in requirements are satisfied.
- Do not remove legacy auth if required users remain unmigrated.

### M4.2 Retire legacy auth
- Disable/remove legacy JWT/scrypt paths only after evidence and approval.
- Remove migration-only configuration.
- Do not delete legacy password hashes unless explicitly approved.

### M4.3 Final verification
Run:
- backend build/tests
- frontend build/tests
- fresh signup/login
- migrated login
- session restoration
- logout
- protected routes
- goal access
- Pro entitlement
- Lemon Squeezy webhook idempotency
- deployment/live checks

### M4.4 Close
- Document final architecture.
- Record remaining deferred work.
- Keep Render DB decommissioning separate unless explicitly approved.

P4 exit: Supabase Auth is authoritative, legacy auth is retired, and application/billing behavior is verified.

# AUTH-SPECIFIC NOTES

Keep these details during P2-P4 even though the overall migration is simplified:

1. users.id is the permanent Achivii identity.
2. users.auth_user_id is only the link to Supabase Auth.
3. Lemon Squeezy continues to reference the internal Achivii user, not the Supabase user ID.
4. Existing users must not be recreated merely because they receive a Supabase identity.
5. A legacy-auth login may be used to establish the Supabase identity link only through the approved transition design.
6. New Supabase users must receive an internal Achivii user record.
7. Supabase token verification must resolve to the internal Achivii user before protected application logic runs.
8. Duplicate email/identity cases must fail safely rather than create a second account.
9. Legacy auth remains available until P3 coverage is verified.
10. Password recovery, email verification, OAuth and MFA are deferred unless separately approved.

# MILESTONE TEMPLATE

Phase: {{PHASE}}
Milestone: {{MILESTONE}}

Implement ONLY this milestone from docs/infrastructure-migration/phases.md.

Read first:
- docs/infrastructure-migration/feature-definition-infrastructure-migration.md
- docs/infrastructure-migration/phases.md
- docs/migration/MIGRATION_BRIEF_RENDER_TO_SUPABASE.md
- relevant repository code/tests

Before editing:
- inspect git status
- inspect the actual implementation
- verify required decisions

After editing:
- run relevant validation
- inspect git diff/status
- report exact evidence

Preserve:
- users.id
- application data
- subscriptions/webhook events
- Lemon Squeezy contracts
- existing product behavior

Do not:
- start another milestone
- perform unrelated refactors
- expose secrets
- claim unverified success
- commit/push unless explicitly requested

STOP.

# COMPLETION CHECKLIST

The migration is complete only when:

- Render data exists correctly in Supabase.
- users.id values are preserved.
- Counts and relationships match the baseline.
- pgvector works.
- Goals/tasks/reviews work.
- Subscriptions and webhook events are intact.
- Lemon Squeezy entitlement remains correct.
- Supabase identity mapping works.
- No duplicate internal accounts were created.
- Existing users can authenticate.
- New users can authenticate.
- Session restoration/logout work.
- Legacy auth is retired only after coverage is verified.
- Final production checks pass.

A green deployment or /api/health 200 alone is not sufficient.

# Change log

| Date | Change |
|---|---|
| 2026-09-30 | Initial migration execution prompt system. |
| 2026-09-30 | Simplified into direct transfer-first workflow; retained detailed auth safeguards. |