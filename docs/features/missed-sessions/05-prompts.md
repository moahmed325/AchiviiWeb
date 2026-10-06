# Achivii Missed Sessions — IMPLEMENTATION PROMPTS
**Version:** 1.2 | **Date:** 2026-10-07
**Roadmap:** docs/features/missed-sessions/04-phases.md
**Feature:** docs/features/missed-sessions/03-feature.md
**Plan spec:** docs/architecture/plan-v2.md
**Template:** docs/templates/05-prompts.md

# 0 — OPERATING CONTRACT
Each prompt below is copy-paste ready for one milestone. The roadmap defines WHAT and ORDER; the prompt defines HOW an implementation agent executes one approved milestone. Paste section 0 together with the milestone prompt.

## Universal role
You are an implementation agent working on Achivii. You are responsible only for the milestone named in the prompt. Inspect the repository before editing and use current repository evidence, not assumptions.

## Source-of-truth order
1. Current repository: what exists now.
2. docs/features/missed-sessions/03-feature.md: approved behavior and rules (RULE-n, AC-n).
3. docs/features/missed-sessions/04-phases.md: milestone scope, regressions (R-n), findings (F-n).
4. docs/architecture/plan-v2.md and docs/decisions.md: persistent rules.

If sources conflict, stop, name the discrepancy, and ask when it materially affects scope. Never silently invent requirements.

## Universal execution sequence
1. Run `git status` and note anything already modified.
2. Read the assigned milestone and the source documents it cites.
3. Inspect the actual files, routes, data, and tests.
4. Do only the assigned milestone.
5. Verify the acceptance and regression items for that milestone.
6. Run only repository-supported validation (read `package.json` scripts first; do not invent commands).
7. Report evidence, limitations, and carry-overs.
8. Do not commit or push unless explicitly told to.

## Universal preservation
- Old goals (`planVersion` 1) behave exactly as before; new logic is gated on `planVersion: 2`.
- Code, not the model, decides practice, rest, and test days.
- No schema migration unless a narrow, explicit decision is recorded first.
- Never use "missed", "behind", or "failed" in user-facing copy. Never ask the user why.

## Universal stop conditions
Stop and report if: a blocking decision is unresolved; the repository contradicts a requirement materially; a schema migration appears necessary; unrelated refactoring appears necessary; or scope must expand.

## Universal final report
Milestone and status; objective; what was done and not done; files changed; evidence for each requirement; commands run and results; discrepancies against the docs; open questions; carry-overs; `git status`; final state: COMPLETE, PARTIAL, or BLOCKED.

---

# 1 — P1 MISS RECOGNITION

## M1.1 — Repository Verification (COMPLETE)

### STATUS
COMPLETE (2026-10-03). Report: `docs/features/missed-sessions/milestones/m1.1-repository-verification.md`. Decisions ND-1 through ND-7 accepted and applied to the feature definition and phase definition.

---

## M1.1b — User-Timezone "Today" (COMPLETE, first draft kept for history)

### STATUS
COMPLETE (2026-10-07). Report: `docs/features/missed-sessions/milestones/m1.1b-user-timezone-today.md`. This first draft was superseded by the second M1.1b prompt at the end of this file, which is the one that was implemented.

### ROLE
You are the implementation agent for Achivii missed-sessions P1/M1.1b. This is the first code milestone.

### CONTEXT
Achivii's date model is currently UTC-based: task dates are written as the server-local UTC date string (`toISOString().split('T')[0]`), and the frontend decides "today" from the UTC date. For a user in UTC+3 a day rolls over at 03:00 local; for a user in UTC−5 a day rolls over at 19:00 local. Decision ND-1 resolves this: `User.timezone` (an IANA string, default `"UTC"`) becomes the single clock for "today", and task dates are treated as the user's local calendar dates.

The backend already has `backend/src/lib/timezone.ts` with tested helpers (`getZonedDateString`, `getUserTodayDateString`, `getZonedTimeParts`, `getZonedDayBounds`, `normalizeTimezone`, `isValidTimezone`). None of these have any production importer yet. The frontend has `frontend/src/lib/dateUtils.ts` with `getLocalDateString` and `getTodayDateString` which use `Intl.DateTimeFormat('en-CA')`, the same approach as the backend.

### OBJECTIVE
Make `User.timezone` the single authoritative clock for "today" across the frontend and backend, so that M1.2 (day-close and classification) can rely on a correct day boundary.

### READ FIRST
- docs/features/missed-sessions/03-feature.md (OD-1, ND-1, edge case on timezone/travel)
- docs/features/missed-sessions/04-phases.md (M1.1b description, ND-1, section 1.5)
- docs/features/missed-sessions/milestones/m1.1-repository-verification.md (section 4, day-boundary detail)

### INSPECT BEFORE EDITING
Verify current state in the actual code, not from this prompt:

**Frontend — the functions to change:**
- `frontend/src/lib/today.ts`: `todayKey(now)` (line ~10) returns `now.toISOString().split('T')[0]` — the UTC date. All downstream comparisons (`isToday`, `findYesterdayTask`, `isWeekReviewDue`, `selectTodayTask`, `isYesterdayPending`) chain through it.
- `frontend/src/lib/dateUtils.ts`: `getLocalDateString` and `getTodayDateString` already format with `Intl.DateTimeFormat('en-CA', { timeZone })`. These may be reusable.
- `frontend/src/lib/today.test.ts`: existing tests at lines ~76-86 assert UTC behavior explicitly ("uses the UTC date at the day boundary"). These must be updated to assert timezone-aware behavior.

**Frontend — where the timezone is available:**
- `frontend/src/types/index.ts`: `User` interface has `timezone?: string`.
- `frontend/src/context/AuthContext.tsx`: `useAuth()` exposes `{ user, token, ... }` where `user.timezone` is the stored IANA timezone.
- `AuthContext.tsx` line ~92: on signup, `Intl.DateTimeFormat().resolvedOptions().timeZone` is sent as user metadata.

**Frontend — callers of the today.ts functions (check for each):**
- `frontend/src/components/today/Today.tsx`: calls `isToday`, `isWeekReviewDue`, `selectTodayTask`, `isYesterdayPending`. Currently `useAuth()` extracts `{ token }` only.
- `frontend/src/pages/Dashboard.tsx`: calls `isToday`, `isWeekReviewDue`.
- `frontend/src/pages/Dashboard.test.tsx`: calls `todayKey`.
- `frontend/src/lib/journeyAdapter.ts`: has its own `isToday` comparison using `task.date === todayStr`.

**Backend — date-writing sites:**
- `backend/src/routes/goal.ts` line ~217: `taskDate.toISOString().split('T')[0]` for initial task creation.
- `backend/src/routes/goal.ts` line ~896: `taskDate.toISOString().split('T')[0]` for next-week task creation.
- `backend/src/lib/ai/weekPlan.ts` line ~52: `date.toISOString().split('T')[0]` in `weekLayout`.
- `backend/src/lib/planV2.ts` line ~35-38: `weekStartFor` uses `Date.setDate` in server-local time.

**Backend — user timezone access:**
- `backend/src/routes/goal.ts`: `getAuthUser(req)` returns a Prisma `User` record. `User.timezone` is a String with default `"UTC"` (schema.prisma line ~15).
- `backend/src/lib/timezone.ts`: `getZonedDateString(date, timezone)` is the replacement for `toISOString().split('T')[0]`.

### REQUIREMENTS

**F-1. Frontend: add timezone parameter to today.ts functions.**
- Change `todayKey(now: Date)` to accept an optional `timezone?: string` parameter. When provided, format `now` using `Intl.DateTimeFormat('en-CA', { timeZone })` (the same approach as `dateUtils.ts`). When omitted or empty, fall back to the browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`, then to `'UTC'`.
- `isToday`, `findYesterdayTask`, `isYesterdayPending`, `isWeekReviewDue` must propagate the timezone through to `todayKey`.
- Do NOT break the function signatures for callers that don't pass a timezone yet — the parameter must be optional.

**F-2. Frontend: thread timezone from the user object to callers.**
- In `Today.tsx`: pull `user` from `useAuth()` alongside `token`. Pass `user?.timezone` to the today.ts helpers.
- In `Dashboard.tsx`: same approach.
- In `Dashboard.test.tsx`: update `todayKey` calls to pass the test timezone or accept the new default.
- In `journeyAdapter.ts`: if it has its own date comparison, make it consistent.
- For each caller, verify the change compiles and the existing tests still pass.

**F-3. Frontend tests: update today.test.ts.**
- The test at lines ~76-86 ("uses the UTC date at the day boundary") must be updated. Replace or supplement with tests that prove:
  - `todayKey(date, 'Africa/Addis_Ababa')` at 00:30 local (which is 21:30 UTC the previous day) returns the local date, not the UTC date.
  - `todayKey(date, 'America/New_York')` at 23:30 local (which is 04:30 UTC the next day) returns the local date, not the UTC date.
  - `todayKey(date)` without a timezone falls back to the browser timezone (or UTC in the test environment).
  - `isWeekReviewDue` with timezone parameter respects the local day boundary.
  - `findYesterdayTask` with timezone parameter finds the correct task.
- Add a test for a user with no timezone stored (undefined/null) falling back correctly.
- Add a test for `'UTC+14'` or `'Pacific/Kiritimati'` (the most extreme positive offset).

**F-4. Backend: switch date-writing for new goals to use timezone.ts.**
- In `goal.ts` line ~217 (initial task creation) and line ~896 (next-week task creation): replace `taskDate.toISOString().split('T')[0]` with `getZonedDateString(taskDate, user.timezone)` from `timezone.ts`. The `user` object is available from `getAuthUser(req)` in those route handlers.
- In `weekPlan.ts` line ~52 (`weekLayout`): add an optional `timezone` parameter to `weekLayout` and use `getZonedDateString(date, timezone)` instead of `date.toISOString().split('T')[0]`. If timezone is not provided, fall back to `'UTC'`.
- Pass the user's timezone from the goal route handlers into `weekLayout` where it is called.
- In `planV2.ts` `weekStartFor`: verify it still works correctly and consider whether `setDate` needs timezone awareness. If `weekStartFor` is only used to compute a base `Date` object (not a date string), it may be fine as-is. Document the reasoning.

**F-5. Backend tests: ensure timezone.test.ts still passes and add coverage.**
- The existing tests in `backend/test/timezone.test.ts` must still pass.
- If you change `weekLayout`, add or update tests in the weekPlan test file to verify date strings are timezone-aware.

**F-6. Existing rows are not rewritten.**
- Do not create any migration. Do not modify any existing DailyTask rows.
- Old goals with UTC dates will continue to work because the frontend will compare using the user's timezone going forward. A user who always had `timezone: "UTC"` sees no change.

**F-7. No new status value, no new column, no schema change.**
- This milestone adds no columns, no migration, and no new `status` values. It only changes how dates are written for new goals and how "today" is computed.

### REGRESSION CHECKS
- **R-3 (Today states):** All existing Today states (rest day, key session, test day, review due, completed goal, offline, error) must still render correctly.
- **R-5 (Weekly review):** `isWeekReviewDue` must still return the correct result.
- **R-7 (Old goals):** A planVersion 1 goal with UTC date strings must continue to work. If the user's timezone is `"UTC"`, behavior is identical to before.
- **R-9 (Timezone behavior):** `timezone.ts` functions are unchanged in behavior; they gain production importers.

### VALIDATION
Run only commands from `package.json`:
- `cd backend && npm test` — all 362 tests must pass (baseline).
- `cd frontend && npx tsc --noEmit` — must pass.
- `cd frontend && npm run lint` — 0 errors (2 warnings baseline).
- `cd frontend && npm test` — same 9 pre-existing failures in `AppShell.test.tsx`, no new failures.

### OUT OF SCOPE
- Day-close calculation (M1.2).
- Reconcile endpoint (M1.3).
- Any UI changes to Today's visual design.
- Rewriting existing DailyTask date values.
- Schema migrations.
- The `yesterdayUncompleted` callout content (P3 replaces it).

### DELIVERABLE
1. Updated `frontend/src/lib/today.ts` with timezone parameter.
2. Updated callers (`Today.tsx`, `Dashboard.tsx`, `Dashboard.test.tsx`, `journeyAdapter.ts`).
3. Updated `frontend/src/lib/today.test.ts` with timezone-aware tests.
4. Updated `backend/src/routes/goal.ts` date-writing sites.
5. Updated `backend/src/lib/ai/weekPlan.ts` `weekLayout`.
6. Any backend test updates needed.
7. Report: `docs/features/missed-sessions/milestones/m1.1b-user-timezone-today.md`.

### DONE
M1.1b is complete when:
- `todayKey(now, timezone)` returns the user's local calendar date.
- Backend writes dates as local calendar dates for new goals.
- All validation commands pass at the recorded baseline or better.
- The report lists evidence for F-1 through F-7 and R-3, R-5, R-7, R-9.

### STOP IF
- A schema migration appears necessary.
- Changing date-writing breaks existing goals in a way that requires a data migration.
- The frontend test environment cannot resolve IANA timezones (some Node versions need `full-icu`).
- An unrelated refactor is needed to thread the timezone through.

---

## M1.2 — Day-Close and Classification (pure functions only)

_Next. M1.1b is complete; this prompt is to be drafted._

---

## M1.3 — Reconcile Endpoint

_Prompt to be drafted after M1.2 is complete._

## M1.1b — User-Timezone "Today" (COMPLETE, implemented version)

### STATUS
COMPLETE (2026-10-07). Report: `docs/features/missed-sessions/milestones/m1.1b-user-timezone-today.md`.

### ROLE
You are the implementation agent for Achivii missed-sessions P1/M1.1b. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
M1.1 (docs/features/missed-sessions/milestones/m1.1-repository-verification.md) found that the app has no user-timezone day boundary. `DailyTask.date` is written as a UTC date string (`weekPlan.ts:52`, `date.toISOString().split('T')[0]`), the weekday comes from server-local `getDay()`, and the frontend decides "today" from the UTC date (`frontend/src/lib/today.ts`, `todayKey`). `backend/src/lib/timezone.ts` is tested but has no production importer. `User.timezone` is stored (default `UTC`) and sent by the frontend at sign-in (`AuthContext.tsx:92-97`) but ignored. Decision ND-1 (approved) makes `User.timezone` the single clock for "today", with `DailyTask.date` treated as the user's local calendar date.

### OBJECTIVE
Make "today" mean the user's local calendar date everywhere it is computed, for the frontend and for the dates written to new goals, without changing existing stored rows.

### READ FIRST
- docs/features/missed-sessions/04-phases.md (section 1.5, P1, M1.1b)
- docs/features/missed-sessions/03-feature.md (OD-1, section 10 time-zone edge case)
- docs/features/missed-sessions/milestones/m1.1-repository-verification.md (R1, R9, section 4)

### INSPECT FIRST
- `frontend/src/lib/today.ts` and every caller of `todayKey`, `isToday`, `findYesterdayTask`, `isYesterdayPending`, `isWeekReviewDue`.
- `frontend/src/lib/dateUtils.ts` (it may already contain timezone-aware helpers) and `frontend/src/context/AuthContext.tsx` (how `user.timezone` reaches components).
- `backend/src/lib/timezone.ts` and `backend/test/timezone.test.ts`.
- `backend/src/lib/ai/weekPlan.ts` (`weekLayout`, date and weekday computation) and `backend/src/lib/planV2.ts` (`weekStartFor`, `saveWeekTasks`).
- `backend/src/routes/goal.ts` goal-create (`startDate` handling, about lines 262-330) and every other place that creates or compares task dates, including the v1 and preset paths.
- Existing tests that depend on dates: `today.test.ts`, `Today.test.tsx`, `todayStates.spec.ts`, `weekPlan` tests.

### REQUIREMENTS
R1. Frontend: one function returns the user's local date string for a given instant and timezone. `todayKey`, `isToday`, `findYesterdayTask`, `isYesterdayPending` and `isWeekReviewDue` use it. Timezone source order: the signed-in user's `timezone`, then the browser's resolved timezone, then `UTC`. An invalid timezone must not throw.
R2. Backend: for **new** goals, the start date label is the user's local date (via `timezone.ts` and `User.timezone`) when no explicit `startDate` is supplied, and every task date in the week is that local date plus N calendar days. Weekday names are derived from the date label, not from server-local `getDay()`, so the result does not depend on the server's timezone.
R3. `weekStartFor` and `weekLayout` must give identical results regardless of the server's timezone (test with `TZ` set to different values if the runner allows, or by passing dates as strings).
R4. Existing stored `DailyTask.date` values are not rewritten, migrated or re-derived. State in the report how an existing goal's labels behave under the new clock (at most a one-day shift at day boundaries) and list any visible effect.
R5. Old goals (planVersion 1) and presets keep working; any shared date code they use must behave correctly under the new clock.
R6. Tests (backend and frontend) for: UTC+3 (Addis Ababa), UTC-8, UTC+14, a DST change, a goal created at 23:30 local, a goal created just after local midnight, a user with a missing or invalid timezone, and a server timezone different from the user's.
R7. No change to what the user sees except that "today" now matches their local date. No new UI and no new copy.

### OUT OF SCOPE
Day-close time (sleep time + 2 hours), missed classification, reconcile endpoint, carry-forward, any new `status` value, any schema migration, rewriting existing task dates, UI or copy changes, fixing the 9 failing `AppShell.test.tsx` tests (recorded baseline, ND-7).

### REGRESSION CHECKS
R-3 (Today states), R-5 (weekly review), R-7 (old goals), R-9 (timezone behavior), R-1, R-2. Compare against the baseline: backend 54 files / 362 tests pass; backend and frontend `tsc --noEmit` pass; frontend lint 0 errors; frontend tests fail only in `AppShell.test.tsx` (9). Do not run the backend test suite against a production database; confirm `DATABASE_URL` points to a development database first, or run only the specific test files you changed.

### VALIDATION
Use only repository-defined commands (backend and frontend `npm test`, `npx tsc --noEmit`, `npm run lint` in frontend). Run the specific tests you added or changed first, then the full suites.

### DELIVERABLE
Code and tests for R1-R7, plus a short report: files changed, how each requirement is satisfied with evidence, how existing goals behave (R4), commands run and results compared with the baseline, and carry-overs. Do not commit or push.

### DONE
`todayKey` and its callers no longer use the UTC date; new-goal dates and weekdays are derived from the user's timezone and do not depend on the server timezone; existing rows are untouched; all new tests pass; no regression versus the baseline.

### STOP IF
The user's timezone cannot be reliably obtained on the frontend; making new-goal dates local would break the week layout or the review-due logic for existing goals in a way that hides or duplicates tasks; a schema change appears necessary; or the work needs to expand into day-close or missed classification. Report instead of working around it.
