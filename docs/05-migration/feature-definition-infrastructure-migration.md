# Achivii Infrastructure Migration — FEATURE DEFINITION

## 1. Overview
### Feature
Migrate Achivii production infrastructure from Render PostgreSQL + custom authentication to Supabase PostgreSQL + Supabase Auth while preserving application identity, data, billing, and user-facing behavior.

### Problem
Achivii currently relies on Render PostgreSQL and custom scrypt + JWT authentication. The database must move without data loss, and authentication must transition without invalidating existing users or changing their internal identity.

### Desired outcome
Supabase PostgreSQL becomes the production database and Supabase Auth becomes the authentication authority while Achivii continues operating normally.

### Target user
Existing and future Achivii users.

### Motivation
Establish the new production database/auth foundation with minimal disruption and no unrelated product changes.

## 2. User Goal
As an Achivii user, I want my account, goals, progress, and subscription access to continue working while Achivii's infrastructure changes, so that the migration does not disrupt my use of the product.

## 3. Core User Actions
### ACT-1 Existing login
Existing users authenticate with their existing credentials during transition and become linked to Supabase Auth. Failure must not create a duplicate account or lose data.

### ACT-2 New signup
New users create a Supabase Auth identity linked to a new internal Achivii user. Failure must not leave an incomplete account.

### ACT-3 Session restoration
A valid session restores to the correct internal Achivii user without unnecessary logout loops.

### ACT-4 Logout
The user ends the active authentication session and returns to the normal logged-out state.

### ACT-5 Continue using Achivii
Existing goals, roadmap, tasks, reviews, progress, and entitlement remain available after migration.
## 4. Primary User Journey
Database: Render production → backup → Supabase schema → data restore → verification → cutover → burn-in → eventual Render retirement.

Authentication: legacy auth → dual transition → users linked to Supabase Auth → Supabase-authoritative → legacy auth retired.

## 5. Entry Points
- Existing login.
- Existing signup.
- Existing session restoration.
- Existing protected routes.
- Existing account/logout.
- Existing 04-billing/account.

No migration-specific user-facing entry point is required.

## 6. Core Concepts
### Internal Achivii User
The existing users record and its existing users.id. This remains the canonical application identity.

### Supabase Auth Identity
The authentication identity managed by Supabase. It links to, but does not replace, the internal Achivii identity.

### Authentication Link
The relationship between the Supabase identity and the internal user.

### Database Cutover
The controlled point where the Render API begins using Supabase PostgreSQL.

### Legacy Authentication
Existing scrypt password verification and custom JWT retained during transition.

### Entitlement
The existing Achivii determination of paid access.

## 7. Lifecycle
Database: Current → Backed up → Restored → Verified → Cut over → Burned in → Retired.

Authentication: Legacy → Transition → Linked → Supabase-authoritative → Legacy retired.

Internal identity: Existing internal user → Supabase identity linked → Supabase authenticates → internal ID remains unchanged.
## 8. Experiences / Screens

| ID | Experience | Purpose | Required? |
|---|---|---|---|
| UX-1 | Existing Login | Authenticate users | Yes |
| UX-2 | Existing Signup | Create users | Yes |
| UX-3 | Session Restoration | Restore authenticated state | Yes |
| UX-4 | Existing Application | Verify migrated users can use Achivii | Yes |
| UX-5 | Account / Logout | End session | Yes |
| UX-6 | Billing / Account | Verify subscription state | Yes |
| UX-7 | Operational Verification | Validate rollout | Yes |
| UX-8 | Password Recovery | New Supabase capability | Future |

## 9. States
### Database
Pre-migration, Prepared, Restored, Cutover, Post-cutover, Rollback.

### Authentication
Legacy, Transition, Migrated, Supabase-authoritative, Legacy retired.

### Application
Loading, Authenticated, Unauthenticated, Authentication error, Database unavailable, Migration verification failure, Partially migrated user.

## 10. Edge Cases
- Existing user logs in for the first time after auth migration.
- User has no authentication link.
- User already has an authentication link.
- Duplicate identity creation is attempted.
- Browser refresh occurs during session restoration.
- Existing session survives deployment.
- Existing Pro user authenticates after migration.
- Lemon Squeezy webhook arrives during cutover.
- Duplicate webhook arrives.
- Restore produces row-count mismatch.
- Foreign-key relationships are missing.
- pgvector is unavailable.
- Rollback occurs after writes reached Supabase.
- User never logs in during the legacy-auth transition.

## 11. Data Behavior
Internal user identity: must survive unchanged for the lifetime of the account.

Account credentials: retained only as long as needed for the transition, then legacy authentication can be retired separately.

Goals/progress: remain attached to the same internal user.

Subscriptions: provider IDs, user association, dates, and statuses remain intact.

Webhook events: delivery keys and processing state remain intact.

Research cache: cached data and vector embeddings remain valid after migration.
## 12. Persistent / Temporary / Derived State
### Persistent
Internal user identity, account data, legacy password hash during transition, authentication link, goals, roadmap data, daily tasks, weekly reviews, research cache, subscriptions, webhook events.

### Temporary
Active auth session, migration cutover state, maintenance window, migration verification state.

### Derived
Entitlement, authentication status, subscription presentation, migration verification results.

## 13. Time-Based Rules
- Database cutover uses a short controlled write freeze, target ≤30 minutes unless rehearsal proves otherwise.
- Legacy authentication remains available until migration coverage and verification justify retirement.
- Render database remains available during rollback/burn-in.
- Existing subscription period dates do not change because of migration.
- Burn-in duration: UNKNOWN — REQUIRES DECISION.
- Supabase email-confirmation policy: UNKNOWN — REQUIRES DECISION.

## 14. Product Rules
RULE-1: users.id must remain unchanged. Reason: it is the existing internal identity.

RULE-2: Supabase Auth links to the internal user; it does not replace the internal identity.

RULE-3: Existing user data remains associated with the same internal user.

RULE-4: Infrastructure migration must not change paid entitlement.

RULE-5: Lemon Squeezy provider IDs and webhook delivery keys remain intact.

RULE-6: Legacy authentication is not removed before transition verification succeeds.

RULE-7: Existing non-auth localStorage behavior remains unaffected.
## 15. Permissions
Existing Achivii permission behavior remains unchanged. Users access only their own authenticated account and associated data. No new application roles are introduced.

## 16. Mobile Requirements
Required. Existing mobile login, signup, onboarding, protected routes, application, account, and billing experiences must continue working. No migration-specific mobile UI is required.

## 17. Accessibility Requirements
Existing accessibility behavior remains intact. Authentication loading, errors, session states, and controls must remain usable.

## 18. Design Requirements
The migration should be visually transparent. Existing Achivii design and interaction patterns remain authoritative. Infrastructure/provider terminology should not appear in normal product UI unless required for an auth message.

## 19. Existing System Integrations
### Database
Render PostgreSQL is replaced by Supabase PostgreSQL. All required data and relationships survive.

### Authentication
Custom auth transitions to Supabase Auth while preserving the internal identity.

### Lemon Squeezy
Billing remains keyed to the internal user identity. Existing billing behavior remains unchanged.

### Frontend / Vercel
The frontend continues calling the Render API. The API host remains unchanged during the database move.

### AI / research
Gemini, Groq, and Tavily remain unchanged.

## 20. Backend / Persistence Requirement
Yes. Production data must survive the database migration, relationships must remain valid, authentication linkage must persist, billing state must persist, and application queries must continue working against Supabase. The definition does not prescribe API/schema implementation.
## 21. External Services
### Supabase
Required. Provides target PostgreSQL and authentication.

### Lemon Squeezy
Required existing integration. Must remain behaviorally unchanged.

### Gemini / Groq / Tavily
Existing dependencies. No provider migration is included.

## 22. Notifications
No new product notifications are required. Existing error presentation may communicate auth or migration failures.

## 23. Analytics
Not part of this feature definition except existing operational telemetry needed for migration verification.

## 24. Performance Requirements
- Normal authenticated behavior remains within acceptable existing performance.
- Database connection is reliable for normal API traffic.
- Session restoration does not introduce unnecessary logout loops.
- Cutover downtime is minimized through rehearsal.
- Exact new latency/SLA target: UNKNOWN — REQUIRES DECISION.

## 25. Security / Privacy
- Credentials and secrets must not be exposed or logged.
- Database and verification secrets remain server-side.
- Supabase identity must not be confused with the internal user identity.
- Cross-user access behavior remains unchanged.
- Lemon Squeezy webhook signature verification remains unchanged.
- Existing billing and AI secrets remain protected.

## 26. Failure Behavior
Database cutover failure → do not promote; rollback to Render connection.

Data restore mismatch → stop promotion; correct and re-verify from backup.

Legacy login migration failure → retain legacy path; do not create duplicate user.

Session failure → show auth error and allow retry.

Billing failure → preserve records and use existing webhook retry/reconciliation behavior.

## 27. In Scope
- Render PostgreSQL → Supabase PostgreSQL.
- Production backup and restore verification.
- Data, relationships, indexes, and pgvector preservation.
- Supabase database configuration.
- Internal-to-Supabase auth linking.
- Dual authentication transition.
- Existing-user auth migration, subject to final API verification.
- New-user Supabase Auth flow.
- Session restoration.
- Legacy auth retirement after verification.
- Application and billing regression verification.
- Rollback capability.
## 28. Out of Scope
- Product redesign.
- Unrelated product features.
- Lemon Squeezy redesign or replacement.
- Changes to subscription/entitlement policy.
- Research-cache rewrite.
- Unnecessary re-embedding.
- Frontend/backend hosting migration.
- Unrelated Supabase features.
- OAuth, MFA, and password recovery as part of this migration.

## 29. Future / Deferred
- Password recovery through Supabase Auth.
- Email verification if later desired.
- OAuth providers.
- MFA.
- Final removal of legacy password hashes.
- Cleanup of historical orphaned Stripe columns.
- Future database connection optimization.

## 30. Non-Negotiables
N-1: Existing users.id values remain unchanged.
N-2: Existing goals, plans, tasks, reviews, subscriptions, webhook events, and relevant research cache remain intact.
N-3: Lemon Squeezy subscription identity remains valid.
N-4: A verified production backup exists before database cutover.
N-5: Render database remains available during rollback/burn-in.
N-6: Legacy auth is not removed before migration verification.
N-7: No unrelated product behavior changes.
N-8: Database cutover remains reversible.

## 31. Success Criteria
- Supabase PostgreSQL serves production data successfully.
- Verified row counts match the pre-migration baseline.
- Required relationships and pgvector functionality work.
- Existing users retain accounts and data.
- Existing users can authenticate through transition.
- New users can authenticate through Supabase Auth.
- Existing Pro users retain correct entitlement.
- Lemon Squeezy webhooks continue processing.
- Authenticated product flows continue working.
- Rollback remains executable.
## 32. Acceptance Criteria
AC-1: Given a production backup exists, migration begins only after the backup is available for restoration.

AC-2: Given Supabase is prepared, all required Achivii tables and pgvector capabilities exist.

AC-3: Given production data is restored, every required table matches the verified Render baseline.

AC-4: Given data is restored, required foreign-key orphan counts are zero.

AC-5: Given an existing internal user, their migrated goals, progress, and account data remain accessible.

AC-6: Given an existing Pro user, authentication does not change their entitlement.

AC-7: Given a legacy user logs in successfully, they are linked to Supabase Auth without a duplicate internal account.

AC-8: Given a new signup succeeds, a corresponding internal Achivii user is linked to the Supabase identity.

AC-9: Given a valid session, refreshing a protected page preserves authentication and resolves the correct internal user.

AC-10: Given a duplicate Lemon Squeezy webhook, existing idempotency behavior prevents duplicate subscription mutation.

AC-11: Given unacceptable post-cutover failure, the application can return to Render without identity remapping.

AC-12: Given migration is complete, onboarding, goal execution, progress/journey, reviews, and billing continue to work.

AC-13: Given migration is complete, non-auth localStorage behavior remains unchanged.
## 33. Decisions Already Made
D-1: Database migration occurs before authentication migration. Reason: separates risk.

D-2: users.id remains the immutable internal identity. Reason: protects application and billing relationships.

D-3: Supabase identity is stored as a separate link. Reason: provider identity must not replace application identity.

D-4: Lemon Squeezy billing contracts remain behaviorally untouched. Reason: billing is not the migration target.

D-5: Existing Prisma migration history is replayed rather than baselined/squashed during the high-risk migration. Reason: preserve migration history conservatively.

D-6: Existing auth uses a transition period rather than immediate forced reset. Reason: scrypt hashes cannot simply be imported into Supabase Auth.

D-7: Render database remains available during rollback/burn-in. Reason: preserve practical rollback.

D-8: Transaction-mode pooler is not the intended runtime connection for current application behavior.

## 34. Open Decisions
OD-1: Actual Render DB plan and creation/expiry status. Blocking: Yes.

OD-2: Final Supabase runtime connection mode after connectivity verification. Blocking: Yes.

OD-3: Supabase JWT signing configuration and backend verification method. Blocking: Yes for auth.

OD-4: Exact Supabase Admin API semantics for known-password user creation. Blocking: Yes for lazy import.

OD-5: Supabase email-confirmation policy. Blocking: Yes for auth UX.

OD-6: Final password policy. Blocking: No for DB; Yes for final auth UX.

OD-7: Production user count and existing Pro/test subscriber count. Blocking: No.

OD-8: Custom frontend production domain existence. Blocking: No unless one exists.

OD-9: Agreed burn-in duration before Render retirement. Blocking: No.
## 35. Constraints
- Production data must be preserved.
- Internal user IDs must remain stable.
- Lemon Squeezy contracts must remain intact.
- Frontend API host remains the Render API.
- Existing product behavior should remain unchanged except required auth-transition behavior.
- Existing Prisma migrations remain immutable.
- pgvector must remain functional.
- Render health check alone is insufficient to verify DB cutover.
- Production secrets must never enter source control or chat.
- No unrelated refactors are bundled into migration.
- Migration is staged with verification gates.
- Existing scrypt hashes cannot be directly imported as-is into Supabase Auth.
- Production rollback remains possible during the migration window.

## 36. Regression Requirements
R-1: User accounts remain accessible with the same internal identity.

R-2: Existing goals and goal-loading behavior remain intact.

R-3: Daily execution, reviews, and progress remain intact.

R-4: Pro entitlement remains correct.

R-5: Lemon Squeezy webhook signature, idempotency, provider IDs, and internal identity behavior remain intact.

R-6: Research cache and pgvector behavior remain operational.

R-7: Frontend-to-Render-API communication remains intact.

R-8: Existing non-auth localStorage keys remain unaffected.

R-9: Protected application routes resolve the correct internal user.

---

## Definition Status

Status: READY FOR ROADMAP PLANNING, WITH EXPLICIT OPEN DECISIONS.

This document defines the product and migration behavior. It does not define implementation phases, coding prompts, or file-level tasks. Those belong to the roadmap/phase stage.
