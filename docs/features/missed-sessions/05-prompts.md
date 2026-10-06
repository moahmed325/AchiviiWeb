# Achivii Missed Sessions — IMPLEMENTATION PROMPTS
**Version:** 2.0 | **Date:** 2026-10-07 (M3.1 prompt drafted)
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

### STATUS
COMPLETE (2026-10-07). Report: `docs/features/missed-sessions/milestones/m1.2-day-close-classification.md`.

### ROLE
You are the implementation agent for Achivii missed-sessions P1/M1.2. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
M1.1b made `User.timezone` the single clock: `DailyTask.date` is the user's local calendar date, and new goals are dated on the user's local day. M1.2 builds the pure logic that decides, for a given instant, which past days of a plan were done, which were missed, and whether a gap is open. It writes nothing. M1.3 will call it from `POST /api/goal/reconcile`; P2 adds carry-forward on top.

Repository facts (verify, do not trust this prompt):
- `DailyTask.status` is a free string; code writes only `pending` and `completed` (M1.1 R2). Completion is recorded **per day** (`status`, `completedAt`), never per step. The 10-minute version is stored exactly like a full session until M2.0 adds `usedMinimumVersion` (M1.1 R10).
- `DailyTask` has `date` ('YYYY-MM-DD'), `weekNumber`, `dayNumber`, `isRestDay`, `isKeySession`, `isTestDay`.
- `sleepTime` ('HH:MM', default `23:00` at goal create) lives in `Goal.routine`, a JSON string. `readRoutine` (`backend/src/lib/planV2.ts`) parses it but its `RoutineShape` type does not declare `sleepTime`.
- `backend/src/lib/timezone.ts` has `normalizeTimezone`, `getZonedDateString`, `getZonedTimeParts` and `getZonedDayBounds`. `getZonedDayBounds` takes the UTC offset at local **noon**, so it can be one hour off for a wall time on a DST-change day. Do not use it to place the day-close instant.
- Rows for future weeks do not exist until the weekly review writes them (M1.1 R4), so classification only ever sees weeks already written.

### OBJECTIVE
Pure, fully tested backend functions that compute each day's close instant, classify every task of a goal as done / missed / rest / planned at a given instant, and detect a gap. These satisfy AC-1, AC-5 and AC-14 at the logic level.

### READ FIRST
- docs/features/missed-sessions/03-feature.md: section 6 (Missed / Done session, Gap), section 7 (lifecycle), section 10 (edge cases), RULE-5, RULE-8, OD-1, AC-1, AC-5, AC-10, AC-14.
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-1, ND-2), P1 (6.2-6.10), M1.2.
- docs/features/missed-sessions/milestones/m1.1-repository-verification.md (R1, R2, R4, R9, R10) and m1.1b-user-timezone-today.md (section 4).

### INSPECT FIRST
- `backend/src/lib/timezone.ts` and `backend/test/timezone.test.ts`.
- `backend/src/lib/planV2.ts` (`readRoutine`, `RoutineShape`).
- `backend/prisma/schema.prisma` (`DailyTask`, `Goal.routine`, `User.timezone`).
- `backend/src/routes/goal.ts` goal create (how `routine.sleepTime` is written and defaulted).
- The style of existing pure-logic modules and their tests (for example `backend/src/lib/ai/weekPlan.ts` with `backend/test/weekPlan.test.ts`).

### REQUIREMENTS
R1. **Local wall time to instant.** Add to `timezone.ts` a function that turns a local date ('YYYY-MM-DD') plus a wall time ('HH:MM') in an IANA timezone into the exact UTC instant, correct on DST-change days. A wall time that does not exist (spring-forward gap) resolves to the first valid instant after it. An ambiguous wall time (fall-back overlap) resolves to the **later** instant, because a later close can never create a false miss. Existing `timezone.ts` exports keep their behavior (R-9).

R2. **Day-close instant (OD-1).** For a task dated D, in the user's timezone, with `sleepTime` S:
- If S is from 18:00 to 23:59, bedtime is D at S. If S is from 00:00 to 17:59, bedtime is D+1 at S (an after-midnight or daytime sleeper).
- Close = bedtime + 2 hours, capped at D+1 04:00 local. So a day never closes before D 20:00 or after D+1 04:00.
- `sleepTime` missing, empty or not a valid 'HH:MM': close at D+1 04:00 (the most conservative reading; P1 risk 6.10).
- Timezone missing or invalid: `normalizeTimezone` (UTC), the same fallback as M1.1b.
Examples to test: S 23:00 → D+1 01:00; S 22:30 → D+1 00:30; S 01:00 → D+1 03:00; S 03:00 → D+1 04:00 (capped); S 09:00 → D+1 04:00; S 19:00 → D 21:00.

R3. **Routine reading.** Extend `RoutineShape` with an optional `sleepTime` (type only; `readRoutine` keeps its current output for every existing caller). Validate the value inside the new module, not by changing `readRoutine`'s defaults.

R4. **Classification (ND-2: derived, never stored).** A function takes the goal's tasks, `now`, the timezone and the raw `sleepTime`, and returns one entry per task: its id, date, week and day number, `isKeySession`, `isTestDay`, and a kind:
- `rest`: `isRestDay` is true, whatever the status or time (RULE-5, AC-5). A rest day is never `missed` and never `done`.
- `done`: practice day with `status === 'completed'`, whether or not its day has closed.
- `missed`: practice day whose close instant is at or before `now` and whose status is anything other than `completed`.
- `planned`: practice day whose day has not closed yet (today, a still-open yesterday before its close, and future days).
Test days and key sessions are classified like any practice day; the flags are carried through so P2 and P4 can treat them differently. Do not decide carry, swap or late-test behavior here.

R5. **Done means the day's status (scope decision for M1.2).** The data has no per-step completion, so "at least one step done" and "the P1 step was done but later steps were not" (Feature Definition section 6 and section 10) cannot be computed. In M1.2, done = `status === 'completed'`, and the 10-minute version counts as done because it is stored the same way (RULE-4). Do not add per-step tracking or parse `notes` for it. Record this in the report as the limit of "partial-day credit" and name what would be needed to go further.

R6. **Gap detection (RULE-8, AC-10 logic).** A function over the classification, ordered by date: a gap is 3 or more `missed` practice days in a row. Rest days neither count nor break a run; a `done` or `planned` practice day breaks it. Runs may span a week boundary. Return the open gap (the run that ends at the most recent closed practice day, if its length is 3 or more) with its first and last dates and its length, or none. Do not decide what the next session becomes; that is P2/P3.

R7. **Pure and deterministic.** No Prisma, no network, no `Date.now()` or `new Date()` inside the logic: `now` is a parameter. Results must not depend on the server's timezone (`TZ`). No writes, no new `status` value, no schema change, no route change.

R8. **Tests** (new file, for example `backend/test/missedSessions.test.ts`, plus additions to `timezone.test.ts` for R1):
- Every R2 example, in at least UTC+3 (`Africa/Addis_Ababa`), UTC-8 (`America/Los_Angeles`) and UTC+14 (`Pacific/Kiritimati`).
- DST: a close time on the spring-forward night and on the fall-back night (`America/New_York`, 8 Mar 2026 and 1 Nov 2026), including a wall time inside the gap and one inside the overlap.
- A late-evening session: task D completed at 00:40 on D+1 with S 23:00 is `done`; the same task still pending at 00:40 is `planned`, and at 01:00 exactly it becomes `missed`.
- Rest days: pending and past → `rest`; completed → `rest`.
- Missing, empty and malformed `sleepTime` (`''`, `'25:00'`, `'7pm'`) → close at D+1 04:00.
- Missing or invalid timezone → UTC.
- Gap: exactly 2 missed (no gap), 3 missed (gap), 3 missed with a rest day between them (gap of 3), missed-done-missed-missed (no gap), a run that crosses from week 1 into week 2, and a trailing run still ending in a `planned` today (the gap ends at the last closed day).
- The same inputs give identical output with `TZ` set to UTC and to another zone (the runner allows `TZ=... npx vitest run <file>`; M1.1b used this).

### OUT OF SCOPE
`POST /api/goal/reconcile` and any route (M1.3); carry-forward, swap, mark missed, high-load handling (P2); the `usedMinimumVersion` migration (M2.0); any UI, copy or frontend change (P3); late-test and weekly status (P4); per-step completion tracking; changing `getZonedDayBounds`; fixing the 9 `AppShell.test.tsx` failures (ND-7) or the flaky `AuthScreen.test.tsx` test.

### REGRESSION CHECKS
R-7 (old goals: nothing in this milestone runs for them; no shared code path changes), R-9 (`timezone.ts` existing exports unchanged; `timezone.test.ts` passes untouched). Baseline: backend 55 files / 373 tests pass; backend `tsc --noEmit` passes. The frontend is not touched; if you run it, the baseline is 9 failures in `AppShell.test.tsx` (plus an occasional pre-existing `AuthScreen.test.tsx` timing flake). `backend/test/researchCache.test.ts` writes to whatever database `DATABASE_URL` points at: confirm it is a development database before running the full backend suite, or run only the files you changed.

### VALIDATION
Use only repository-defined commands. Run the new and changed test files first (`cd backend && npx vitest run test/missedSessions.test.ts test/timezone.test.ts`, also under two `TZ` values), then `cd backend && npm test` and `cd backend && npx tsc --noEmit`.

### DELIVERABLE
New module (for example `backend/src/lib/missedSessions.ts`), the R1 helper in `timezone.ts`, the `RoutineShape` type addition, tests for R8, and a report at `docs/features/missed-sessions/milestones/m1.2-day-close-classification.md`: files changed, evidence for R1-R8, the R5 partial-day limit, commands and results against the baseline, carry-overs for M1.3. Do not commit or push.

### DONE
The day-close instant is correct for every R2 case, including DST; every task classifies as exactly one of done / missed / rest / planned; rest days are never missed; gaps of 3+ are detected across rest days and week boundaries; output does not depend on the server timezone; nothing is written; the backend suite and type check pass at the baseline.

### STOP IF
The repository shows per-step completion data after all (then R5 needs a decision); `sleepTime` is stored somewhere other than `Goal.routine` or in another format; a correct DST conversion cannot be built on `Intl` without a new dependency; the work needs a route, a schema change or a frontend change; or a Feature Definition rule conflicts with R2-R6 as written. Report instead of working around it.

---

## M1.3 — Reconcile Endpoint

### STATUS
COMPLETE (2026-10-07). Report: `docs/features/missed-sessions/milestones/m1.3-reconcile-endpoint.md`.

### ROLE
You are the implementation agent for Achivii missed-sessions P1/M1.3. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
M1.2 added pure functions in `backend/src/lib/missedSessions.ts`: `classifyDays(tasks, { now, timezone, sleepTime })` returns one `DayClassification` per task (`done` / `missed` / `rest` / `planned`), and `findOpenGap(days)` returns the open gap or `null`. Nothing calls them yet. ND-6 decided that reconciliation runs through a new `POST /api/goal/reconcile`, called once when the app loads, and that `GET /api/goal/active` stays a pure read. In P1 the endpoint only **reports**; P2 adds carry-forward writes on top of the same route. So build it as: load → classify → (P2 will apply changes here) → respond.

Repository facts (verify, do not trust this prompt):
- `goalRouter` is in `backend/src/routes/goal.ts`, mounted at `/api/goal`. Every handler starts with `const user = await getAuthUser(req)` and returns 401 when it is null. `getAuthUser` returns the Prisma `User`, which includes `timezone`.
- `GET /active` loads the active goal with `prisma.goal.findFirst({ where: { userId, status: 'active' }, include: { dailyTasks: { orderBy: { dayNumber: 'asc' } }, ... } })`, and falls back to the latest completed goal.
- `Goal.planVersion` is an `Int` (1 = old goals, 2 = plan v2). `readRoutine(goal).sleepTime` (`backend/src/lib/planV2.ts`) gives the raw stored bedtime; `classifyDays` validates it.
- HTTP-level route tests already exist with Prisma and `getAuthUser` mocked and the router mounted on a real Express server: `backend/test/goalCompletion.test.ts`, `backend/test/weeklyReviewTestResult.test.ts`. Use the same pattern.
- Frontend: `frontend/src/context/GoalContext.tsx` `loadGoal` calls `fetchActiveGoal(token)` from `frontend/src/lib/api.ts` when the token changes; `refreshGoal` re-fetches after actions. Several frontend tests mock `../lib/api` (some spread the real module with `importOriginal`, so a new real function would really call `fetch` there).

### OBJECTIVE
A working, idempotent `POST /api/goal/reconcile` that returns the derived classification and open gap for the user's active plan v2 goal and writes nothing, plus a single call to it when the app loads. AC-1, AC-5 and AC-14 become true at the API level (EV-2).

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-2, ND-6, ND-8), section 3.4 (idempotency), 3.8 (preservation), P1 (6.2-6.10), M1.3.
- docs/features/missed-sessions/03-feature.md: AC-1, AC-5, AC-14, section 5 (misses are detected when the app is opened).
- docs/features/missed-sessions/milestones/m1.2-day-close-classification.md (section 7, carry-overs).

### INSPECT FIRST
- `backend/src/routes/goal.ts`: `GET /active`, `POST /complete`, `POST /weeks/:weekNumber/review` (auth, error and response style).
- `backend/src/lib/missedSessions.ts`, `backend/src/lib/planV2.ts` (`readRoutine`).
- `backend/test/goalCompletion.test.ts` (mocking and server setup).
- `frontend/src/lib/api.ts` (`fetchActiveGoal` style, `API_BASE_URL`), `frontend/src/context/GoalContext.tsx` (`loadGoal`, `refreshGoal`), and every frontend test that mocks `../lib/api` or renders `GoalProvider`.

### REQUIREMENTS
R1. **Route.** `POST /api/goal/reconcile` in `goal.ts`, no request body. 401 without a valid user (same message style as the other handlers). 500 with a generic message and a `console.error` on unexpected errors, like the other handlers.

R2. **Which goal.** The user's goal with `status: 'active'` only (not the completed-goal fallback of `GET /active`), loaded with its `dailyTasks`. Read only the fields classification needs.

R3. **Gating (3.8, AC-14).** Respond 200 with `{ applies: false, reason }` and nothing else when there is no active goal (`reason: 'no_active_goal'`) or its `planVersion` is not 2 (`reason: 'not_plan_v2'`). Old goals get no classification and nothing about them changes.

R4. **Response for a plan v2 goal.** 200 with:
`{ applies: true, goalId, asOf, timezone, days, gap }`
- `asOf`: the ISO instant used as `now` (read once per request).
- `timezone`: the zone actually used (`normalizeTimezone(user.timezone)`).
- `days`: `classifyDays(goal.dailyTasks, { now, timezone, sleepTime: readRoutine(goal).sleepTime })`, ordered by date then day number.
- `gap`: `findOpenGap(days)`.
No copy, no labels, no extra derived fields; this is data for P2 and P3.

R5. **No writes (ND-2).** The handler performs no Prisma create, update, upsert or delete, and no model call. Put the response-building in a small pure function (in `missedSessions.ts` or beside the route) so it can be tested without HTTP, and leave one clearly marked place where P2's carry-forward will go. Do not build any of P2.

R6. **Idempotent (3.4).** Two calls at the same `now` return identical bodies, and the database is unchanged after any number of calls. Prove both in tests.

R7. **`GET /active` unchanged.** No edits to it or to `presentGoal`.

R8. **Frontend call on app load.** Add `reconcileGoal(token)` to `frontend/src/lib/api.ts` in the style of `fetchActiveGoal`. In `GoalContext.loadGoal`, call it once **before** `fetchActiveGoal` (once P2 writes, the goal must be fetched after reconciliation). Any failure (network, non-200, bad JSON) is caught and logged with `console.warn`, and goal loading continues exactly as before: a reconcile problem must never block, delay past its own failure, or fail the goal load (R-1). Do not call it from `refreshGoal`. Do not store or render the result; there is no consumer until P3. Update the frontend tests that mock `../lib/api` so none of them makes a real network call, and add one GoalProvider test proving the call happens once per load, before `fetchActiveGoal`, and that a reconcile failure still loads the goal.

R9. **Tests (backend).** HTTP-level tests in the existing pattern (new file, for example `backend/test/reconcile.test.ts`), with time controlled (fake timers or an injectable `now` in the pure function):
- 401 without a user.
- No active goal → `applies: false, reason: 'no_active_goal'`.
- `planVersion: 1` goal with a closed, pending practice day → `applies: false, reason: 'not_plan_v2'` (AC-14).
- EV-2: a plan v2 goal in `Africa/Addis_Ababa` with `sleepTime` 23:00, whose yesterday is pending. Before its close (00:40 local) the day is `planned`; after (01:00 local) it is `missed` (AC-1). Record both response bodies in the report.
- A past pending rest day is `rest` in the response (AC-5).
- Three missed practice days produce a `gap`; a done day after them produces none.
- Missing user timezone → `timezone: 'UTC'`; missing `sleepTime` in `routine` → 04:00 close.
- Idempotency: two calls give identical bodies, and no Prisma write mock is ever called across the whole file.
- `GET /active` still returns the same body as before for the same goal (R7), if the existing tests do not already cover it.

### OUT OF SCOPE
Carry-forward, swap, mark missed, high-load handling and any write (P2); the `usedMinimumVersion` migration (M2.0); any UI, copy, or storing the result in context (P3); late-test and weekly status (P4); changes to `GET /active`, `presentGoal` or `missedSessions.ts` rules; per-step completion (ND-8); fixing the 9 `AppShell.test.tsx` failures (ND-7) or the flaky `AuthScreen.test.tsx` test.

### REGRESSION CHECKS
R-1 (auth and active-goal loading: a failing reconcile never breaks goal loading), R-7 (old goals: `not_plan_v2`, no change), R-9 (timezone helpers unchanged). Baseline: backend 55 files / 384 tests pass when `test/researchCache.test.ts` is excluded; backend and frontend `tsc --noEmit` pass; frontend lint 0 errors, 2 warnings; frontend tests fail only in `AppShell.test.tsx` (9), plus an occasional pre-existing `AuthScreen.test.tsx` timing flake. `researchCache.test.ts` writes to whatever `DATABASE_URL` points at: run it only against a confirmed development database, otherwise exclude it (`npx vitest run --exclude test/researchCache.test.ts`) and say so.

### VALIDATION
Repository commands only. Backend: the new test file first, then `npx vitest run --exclude test/researchCache.test.ts` (or `npm test` against a confirmed development database) and `npx tsc --noEmit`. Frontend: the changed test files first, then `npm test`, `npx tsc --noEmit`, `npm run lint`.

### DELIVERABLE
The route, the pure response builder, the frontend `reconcileGoal` and its single call in `loadGoal`, tests for R8 and R9, and a report at `docs/features/missed-sessions/milestones/m1.3-reconcile-endpoint.md`: files changed, evidence for R1-R9, the two EV-2 response bodies, commands and results against the baseline, and carry-overs for P2 (where the writes go, and how idempotency must hold once they do). Do not commit or push.

### DONE
`POST /api/goal/reconcile` returns the classification and gap for an active plan v2 goal, `applies: false` for everything else, writes nothing, and returns the same body when repeated; the app calls it once per load before fetching the goal, and a reconcile failure never affects loading; all validation is at the baseline or better.

### STOP IF
The active goal cannot be found the same way `GET /active` finds it; `User.timezone` is not available from `getAuthUser`; the frontend call cannot be added without changing what any screen shows or how long it takes to load when reconcile succeeds; a write, a schema change or a change to `GET /active` appears necessary; or tests can only pass by calling the real network or database. Report instead of working around it.

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

---

# 2 — P2 RECOVERY RULES

## M2.0 — `usedMinimumVersion` Migration (ND-3)

### STATUS
COMPLETE (2026-10-07, commit `1d219aa`). Report: `docs/features/missed-sessions/milestones/m2.0-used-minimum-version.md`. This is the only schema migration in the feature.

### ROLE
You are the implementation agent for Achivii missed-sessions P2/M2.0. Implement only this milestone. Follow the operating contract in section 0, including its stop condition on schema changes: this milestone **is** the one recorded schema decision (ND-3), and no other schema change is allowed.

### CONTEXT
OD-2: the 10-minute version counts as a done session, but a key session done only through it is not "key done". M1.1 R10 found that completing the minimum version is stored exactly like a full session (`status: 'completed'`), so the two cannot be told apart. ND-3 adds one column to record it. M2.0 only **records** the flag; M2.3 will use it in the counting rules.

Repository facts (verify, do not trust this prompt):
- `DailyTask` is in `backend/prisma/schema.prisma` (table `daily_tasks`, camelCase quoted columns). The datasource is PostgreSQL.
- Migrations are versioned folders in `backend/prisma/migrations/` (`YYYYMMDDHHMMSS_name/migration.sql`); `20260927071946_add_weekly_test_result` is a one-column example. `render.yaml` runs `npx prisma migrate deploy` on every deploy, so **any migration merged to `main` is applied to the deployed database on the next deploy**.
- `backend/.env` points at a hosted Supabase database that has not been confirmed as development-only.
- The only path that completes the minimum version: Focus mode's "Complete minimum" (`FocusStepRunner.tsx`, state `isMinimumVersion` in `FocusSessionModal.tsx`) → `onCompleteSession(reflection)` → `Today.tsx` `onFinishFocus` → `useTaskActions.finishFocus` → `updateDailyTask` (`frontend/src/lib/api.ts`) → `PATCH /api/goal/tasks/:taskId` (`backend/src/routes/goal.ts`). The flag is dropped at the first step.
- That route accepts only `status`, `notes` and `slotTime`, sets `completedAt` on `completed` and clears it on `pending`. No test covers it yet.
- Today also shows the minimum version's content behind a reveal button, but completing from Today uses the normal Complete action (`toggleComplete`), which is a full completion.

### OBJECTIVE
Add `DailyTask.usedMinimumVersion` and set it correctly whenever a task's completion changes, so M2.3 can apply OD-2 from stored data.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-3, and the validation baseline from P2 on), section 3 (rules), P2 (7.1-7.10), M2.0.
- docs/features/missed-sessions/03-feature.md: OD-2, RULE-4, AC-7.
- docs/features/missed-sessions/milestones/m1.1-repository-verification.md (R2, R10).

### INSPECT FIRST
- `backend/prisma/schema.prisma` (`DailyTask`) and two or three existing migrations.
- `backend/src/routes/goal.ts` `PATCH /tasks/:taskId`, and every other place that writes `status` or creates `DailyTask` rows (`planV2.ts` `saveWeekTasks`, goal create, weekly review).
- `frontend/src/components/FocusSessionModal.tsx`, `focus/FocusStepRunner.tsx`, `focus/FocusCompletion.tsx`, `today/Today.tsx` (`onFinishFocus`), `today/useTaskActions.ts`, `lib/api.ts` (`updateDailyTask`), `types/index.ts` (`DailyTask`).
- The tests for those files, and `backend/test/goalCompletion.test.ts` for the HTTP route-test pattern.

### REQUIREMENTS
R1. **Schema.** Add `usedMinimumVersion Boolean @default(false)` to `DailyTask`, with a short comment pointing to ND-3. Nothing else in the schema changes.

R2. **Migration file, not applied.** Create one migration folder, timestamped after the latest existing one and named for example `add_daily_task_used_minimum_version`, whose SQL only adds the column: `ALTER TABLE "daily_tasks" ADD COLUMN "usedMinimumVersion" BOOLEAN NOT NULL DEFAULT false;`. Generate or check it without a database, for example with `npx prisma migrate diff --from-schema-datamodel <schema at HEAD> --to-schema-datamodel prisma/schema.prisma --script`. **Do not run `prisma migrate dev`, `migrate deploy`, `migrate reset` or `db push`, and do not connect to any database.** Run `npx prisma generate` so the client types include the column (it does not touch a database). Existing rows get `false` from the default when the migration is applied later.

R3. **Server rule (`PATCH /tasks/:taskId`).** Accept an optional boolean `usedMinimumVersion`; reject a non-boolean with 400. The stored flag follows the completion it describes:
- `status: 'completed'` sets the flag to the given value, or `false` when it is omitted (a normal completion is a full session).
- `status: 'pending'` (un-completing) sets it to `false`.
- A request without `status` (a note or slot change) leaves it unchanged, and `usedMinimumVersion` sent without `status: 'completed'` is ignored.
- `true` is stored only when the task has a `minimumVersion`; otherwise `false`. Old goals have no minimum version, so nothing changes for them (AC-14).
The response returns the updated task, now including the flag.

R4. **No other writer changes.** Rows created by week generation, goal create or the weekly review get the column default. Do not change those paths.

R5. **Frontend wiring.** `FocusSessionModal` passes whether the minimum version was completed through `onCompleteSession` (for example a second argument `{ usedMinimumVersion: boolean }`; keep existing callers working). `Today.onFinishFocus` hands it to `useTaskActions.finishFocus`, which sends `usedMinimumVersion: true` with `status: 'completed'` only for a minimum completion. `toggleComplete` and every other completion stay full completions (no flag sent, so the server stores `false`). Add `usedMinimumVersion?: boolean` to the frontend `DailyTask` type and to `updateDailyTask`'s update shape. No visible change: same screens, same copy ("Minimum complete" stays as it is).

R6. **Tests.**
- Backend, HTTP-level in the `goalCompletion.test.ts` pattern (new file, for example `backend/test/taskUpdate.test.ts`): completed with `true` on a task with a minimum version → `true`; completed with no flag → `false`; completed with `true` on a task without a minimum version → `false`; back to pending → `false` and `completedAt` cleared; a notes-only update leaves the flag as it was; a non-boolean flag → 400; another user's task → 404 as today; `completedAt` behavior otherwise unchanged.
- Frontend: Focus "Complete minimum" sends `usedMinimumVersion: true` with `status: 'completed'`; a full Focus completion and Today's Complete button send no flag; un-completing sends `status: 'pending'`.
- Evidence that the migration SQL adds exactly that one column (a small test that reads the file, or the `migrate diff` output recorded in the report).

### OUT OF SCOPE
Using the flag anywhere (OD-2 counting, key-done, weekly review: M2.3); the high-load flag (M2.1); carry-forward (M2.2); mark missed and swap (M2.4); any UI or copy change; applying the migration to any database; any other schema change; backfilling old rows.

### REGRESSION CHECKS
R-2 (task completion still works and persists), R-4 (focus session and the 10-minute version still usable), R-7 (old goals unchanged). Baseline (04-phases.md, from P2 on): backend `npx vitest run` 41 files / 361 tests pass; backend and frontend `tsc --noEmit` pass; frontend lint 0 errors, 2 warnings; frontend `npx vitest run` 419 tests, 0 failures; frontend `npm run build` passes. No test in either suite needs a database.

### VALIDATION
Repository commands only: `npx prisma generate`; the new and changed test files first; then backend `npx vitest run` and `npx tsc --noEmit`, frontend `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### DELIVERABLE
The schema change, one migration folder, the PATCH rule, the frontend wiring, tests for R6, and a report at `docs/features/missed-sessions/milestones/m2.0-used-minimum-version.md`: files changed, the migration SQL, evidence for R1-R6, commands and results against the baseline, and a clear note that the migration is **not applied** and will be applied by `prisma migrate deploy` on the next Render deploy of `main`. Do not commit or push.

### DONE
The column exists in the schema and in exactly one new migration; a minimum-version completion from Focus mode stores `true`, every other completion stores `false`, un-completing clears it, other updates leave it alone; nothing visible changed; no database was touched; validation is at the baseline or better.

### STOP IF
Another path completes the minimum version; the migration would need anything beyond adding this one column (a backfill, a rename, an index); generating or checking it seems to need a database connection; the migration history does not match `schema.prisma` at HEAD (drift); or any requirement would change what a user sees. Report instead of working around it.

---

## M2.1 — High-Load Step Flag (ND-5)

### STATUS
COMPLETE (2026-10-07, commit `d1f7cb6`). Report: `docs/features/missed-sessions/milestones/m2.1-high-load-flag.md`.

### ROLE
You are the implementation agent for Achivii missed-sessions P2/M2.1. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
RULE-10 and AC-13: a high-load step (running, strength) is dropped, never carried, so a missed day can never stack physical load onto another day. M2.2's carry-forward needs to know which steps are high-load. OD-5 and ND-5 decided two sources: goal-level for the `run10k` and `recomp` presets (every step counts as high-load), and a per-step `highLoad` flag written by the week call for custom goals. M2.1 records and exposes the flag; it moves nothing.

Repository facts (verify, do not trust this prompt):
- Plan v2 steps are model-written for presets too (M1.1 R11), so the preset prose files are not the source. They are written only by `generateWeekPlan` (`backend/src/lib/ai/weekPlan.ts`), called from goal create (`backend/src/routes/goal.ts`, about line 351) and `writeNextWeek` (`backend/src/lib/planV2.ts`). If the first week call fails, goal create falls back to a v1 plan; v1 is out of scope (AC-14).
- The model's step shape is `WEEK_RESPONSE_SCHEMA` (`stepProperties` plus `priority` and `timing`); the step rules are in `buildWeekPrompt`'s "Each step has:" list; `toStep` and `checkWeekAnswer` normalize the answer into `DetailedStep` (`backend/src/lib/ai/goalDecomposer.ts`). Steps are stored as JSON in `DailyTask.detailedSteps`, so a new step field needs **no migration**. `minimumVersion` is a separate step object, and the test step is added by code (`testStepFor`, priority 0).
- Goals do not store which preset they came from. The app identifies a preset from the goal text: `findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome)` (`backend/src/lib/ai/presets/index.ts`), as goal create and `goalDecomposer.ts` already do. Preset ids: `book, chess, deepwork, guitar, recomp, run10k, saas, spanish, speech, youtube`. M1.1 found only `run10k` and `recomp` to be physical.
- Existing `run10k` and `recomp` goals already have stored steps without any flag.
- `backend/test/weekPlan.test.ts` mocks the model (`generateStructuredContent`) and tests `checkWeekAnswer` and `buildWeekPrompt`.

### OBJECTIVE
Every plan v2 step written from now on carries an honest `highLoad` boolean, and one pure function answers "is this step high-load?" for any goal, including goals written before this milestone, so M2.2 can drop instead of carry.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-5), section 3 (rules; 3.3 rules live in code, 3.8 preservation), P2 (7.1-7.10), M2.1.
- docs/features/missed-sessions/03-feature.md: RULE-10, AC-13, OD-5, section 10 (edge case on high-load steps).
- docs/features/missed-sessions/milestones/m1.1-repository-verification.md (R3, R11).

### INSPECT FIRST
- `backend/src/lib/ai/weekPlan.ts`: `WEEK_RESPONSE_SCHEMA`, `buildWeekPrompt`, `RawStep`, `toStep`, `rankSteps`, `keepTopSteps`, `testStepFor`, `checkWeekAnswer` (including how `minimumVersion` is built), `WeekCallInput`.
- `backend/src/lib/ai/goalDecomposer.ts` (`DetailedStep`), `backend/src/lib/ai/presets/index.ts` and `presets/run10k.ts`, `presets/recomp.ts` (their `id` and matching patterns).
- Both `generateWeekPlan` callers and what goal fields they have (`rawGoal`, `clarifiedOutcome`).
- `backend/test/weekPlan.test.ts` and any test that snapshots the week schema or prompt.

### REQUIREMENTS
R1. **Step type.** Add optional `highLoad?: boolean` to `DetailedStep`, with a one-line comment (ND-5: physical strain; dropped, never carried).

R2. **Model flag (custom goals).** Add `highLoad: { type: 'boolean' }` to the step schema for practice steps and make it required there, and add one line to the "Each step has:" list in `buildWeekPrompt`, for example: "highLoad: true when the step puts real physical strain on the body (running, lifting, high-intensity or impact work); otherwise false". Do not change any other prompt wording, the system prompt, or the day/rest/test rules (section 7.4: no prompt changes beyond adding the flag).

R3. **Normalization.** `toStep` keeps `highLoad` only when the model sent a real boolean; anything else becomes `false`. A missing flag never fails the answer or triggers a retry. Rest-day light steps and `minimumVersion` follow the same rule.

R4. **Goal-level flag (presets).** Add `highLoadGoal?: boolean` to `WeekCallInput`. When it is true, `checkWeekAnswer` sets `highLoad: true` on every step of every practice day, the code-added test step and `minimumVersion`, whatever the model said. Both callers set it from one shared pure helper, `isHighLoadGoal({ rawGoal, clarifiedOutcome })`, true exactly when `findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome)` is `run10k` or `recomp`. Keep the list of high-load preset ids in one exported constant.

R5. **One reader for M2.2.** Export a pure `isHighLoadStep(step, goal)` (place it with the helper, for example in a small new module such as `backend/src/lib/highLoad.ts`): true when `isHighLoadGoal(goal)` is true, or when `step.highLoad === true`; false otherwise. This makes existing `run10k`/`recomp` goals safe even though their stored steps have no flag. Steps of custom goals written before M2.1 have no flag and count as normal, as the roadmap says.

R6. **No movement, no schema change.** Nothing reads the flag yet except `isHighLoadStep` and its tests. No migration (the field lives in JSON), no route change, no frontend change (the frontend `DetailedStep` type is updated in P3), no change to v1 or preset prose files.

R7. **Tests** (extend `backend/test/weekPlan.test.ts`; new file for the helper, for example `backend/test/highLoad.test.ts`):
- The schema requires `highLoad` on practice steps; the prompt contains the one new line and is otherwise unchanged (compare against the previous prompt text for a fixed input).
- `checkWeekAnswer`: the model's `true`/`false` is kept; a missing or non-boolean value becomes `false` without a retry; with `highLoadGoal: true`, every practice step, the test step and `minimumVersion` are `true` even when the model said `false`.
- `isHighLoadGoal`: a `run10k` goal by `rawGoal`, a `recomp` goal by `clarifiedOutcome` only, a non-physical preset (`guitar`), a custom goal, and empty text.
- `isHighLoadStep`: a stored step without the flag on a `run10k` goal is high-load; on a custom goal it is not; `highLoad: true` on a custom goal is high-load.
- Both callers pass `highLoadGoal` (assert on the input given to the mocked week call, or test the helper they call).

### OUT OF SCOPE
Carry-forward and drop (M2.2); counting rules and signals (M2.3); mark missed and swap (M2.4); storing a preset id on `Goal` or any schema change; changing preset prose or v1 plans; backfilling flags into stored steps; any frontend, UI or copy change; any other prompt change.

### REGRESSION CHECKS
R-6 (week plan generation: existing `weekPlan.ts` rules and tests still pass), R-7 (old goals: v1 untouched), R-8 (presets still generate and load). Baseline (04-phases.md, P2 on, plus M2.0): backend `npx vitest run` 42 files / 377 tests pass; backend and frontend `npx tsc --noEmit` pass (use each package's own TypeScript, `node_modules/.bin/tsc`, if `npx` fetches a different version); frontend lint 0 errors, 2 warnings; frontend `npx vitest run` 425 tests, 0 failures; frontend `npm run build` passes. No test needs a database or the network.

### VALIDATION
Repository commands only: the new and changed test files first, then backend `npx vitest run` and `npx tsc --noEmit`. Run the frontend checks once to confirm nothing changed there.

### DELIVERABLE
The type, schema, prompt line, normalization, goal-level stamping, the shared helpers, tests for R7, and a report at `docs/features/missed-sessions/milestones/m2.1-high-load-flag.md`: files changed, the exact prompt line added, evidence for R1-R7, commands and results against the baseline, and carry-overs for M2.2 (call `isHighLoadStep`, never read `step.highLoad` directly). Do not commit or push.

### DONE
New plan v2 steps carry `highLoad` (true for every step of `run10k`/`recomp` goals, the model's honest answer otherwise); `isHighLoadStep` gives the right answer for old and new goals; nothing moves; no schema, route, UI or prose change; validation is at the baseline or better.

### STOP IF
Steps reach the database through a path other than `generateWeekPlan` for plan v2; making `highLoad` required makes the existing week tests or a live-shaped fixture fail in a way that needs other prompt changes; another preset turns out to be physical (list it and ask); identifying the preset needs a stored preset id; or any requirement would change what a user sees. Report instead of working around it.

---

## M2.2 — Carry-Forward

### STATUS
COMPLETE (2026-10-07, commit `d666deb`; merged with `render.yaml` changed to `sync: false`). Report: `docs/features/missed-sessions/milestones/m2.2-carry-forward.md`. Ships **switched off** (ND-15).

### ROLE
You are the implementation agent for Achivii missed-sessions P2/M2.2. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
P1 made `POST /api/goal/reconcile` report each day's classification and the open gap, and left one marked place in the route ("P2 applies carry-forward here"). M2.1 added `isHighLoadStep(step, goal)` (`backend/src/lib/highLoad.ts`). M2.2 decides which missed priority-1 steps move and where, and writes the moves safely. It is gated by an environment switch that stays off until P3's notice is live, so production behavior does not change when this merges.

The rules (Feature Definition section 11 and its 2026-10-07 clarifications; 04-phases.md ND-9 to ND-17). Read them there; in short:
- **Fixed receiving day (ND-17).** Each missed practice day has exactly one receiving day: the first day after it, in date order, that is a practice day, not a rest day and not the test day. It is fixed by the plan and never recalculated.
- **When a carry happens.** The missed day's priority-1 step moves to its receiving day only if that day exists, is still open (classified `planned`), has a date on or after the user's local today, is not completed, and has not already received a carry. Otherwise the step is dropped, permanently. Nothing is carried across a week boundary (next week's rows do not exist yet).
- **Most recent miss wins (ND-12).** If several missed days share one receiving day, the latest one is carried; the others are dropped.
- **No carry from an open gap (ND-11).** Days in the open gap (`findOpenGap`) are never carried.
- **High-load (RULE-10).** A step for which `isHighLoadStep(step, goal)` is true is dropped.
- **Key sessions (ND-9).** A missed key session's step is held while its swap offer is open: the offer is open while its receiving day is open. M2.4 adds the answer; until then, a held step that is never answered is dropped when its receiving day closes. M2.2 only holds and reports.
- **Fit (ND-10, RULE-1).** On the receiving day, remove its lowest-priority steps, lowest first, until the minutes freed are at least the carried step's minutes. Never remove the receiving day's own priority-1 step or its test step. If it still does not fit, drop the carried step. The day's total minutes never increase.
- **Writes are guarded (ND-13).** A carry is written as a compare-and-set on `DailyTask.detailedSteps` (a JSON string): update only where `id` matches **and** `detailedSteps` still equals the string that was read (for example `updateMany` with both in `where`, and check the count). A second concurrent request finds no match and writes nothing. The carried step stores `carriedFrom: { taskId, date, replaced: DetailedStep[] }`.
- **Already handled.** A missed day that is the `carriedFrom.taskId` of any stored step is already carried and is never carried again.
- **Switch (ND-15).** Writes happen only when `process.env.MISSED_SESSIONS_CARRY_ENABLED === 'true'` (read per request). Otherwise reconcile computes and reports the same plan and writes nothing.

Repository facts (verify, do not trust this prompt):
- `backend/src/routes/goal.ts` `POST /reconcile` loads the active goal with a `select` that does not yet include `detailedSteps`, `durationMinutes`, `rawGoal` or `clarifiedOutcome`; it calls `buildReconcileResult` (`backend/src/lib/missedSessions.ts`), then responds. Old goals return `applies: false` and must stay untouched.
- Steps: `DailyTask.detailedSteps` is a JSON string array of `DetailedStep` (`backend/src/lib/ai/goalDecomposer.ts`) with unique `priority` per day (1 = most important; the test step is 0), `stepNumber`, `durationMinutes`, `highLoad?`. `DailyTask.durationMinutes` is the day's total, written from the week plan (`dailyTaskRows`, `backend/src/lib/planV2.ts`).
- Route tests use the pattern in `backend/test/reconcile.test.ts` (Prisma and `getAuthUser` mocked, `Date` faked); it currently asserts that no write method is ever called, which stays true with the switch off.
- `render.yaml` lists the API's environment variables.

### OBJECTIVE
A pure carry planner and a guarded writer behind the switch, so that turning the switch on makes reconcile move exactly the steps the rules allow, once, without ever lengthening a day.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-2, ND-8 to ND-17), section 2.4 (release order), section 3 (rules, especially 3.4, 3.5, 3.11), P2 (7.1-7.10), M2.2.
- docs/features/missed-sessions/03-feature.md: sections 6, 7, 10, 11 (with clarifications), AC-3, AC-4, AC-6, AC-13.
- docs/features/missed-sessions/milestones/m1.2-day-close-classification.md, m1.3-reconcile-endpoint.md (section 7), m2.1-high-load-flag.md.

### INSPECT FIRST
- `backend/src/lib/missedSessions.ts` (`classifyDays`, `findOpenGap`, `buildReconcileResult`, `ReconcileResult`), `backend/src/lib/highLoad.ts`, `backend/src/lib/timezone.ts`.
- `backend/src/routes/goal.ts` `POST /reconcile` and `PATCH /tasks/:taskId` (another writer of the same rows).
- `backend/src/lib/planV2.ts` (`dailyTaskRows`, `saveWeekTasks`), `backend/test/reconcile.test.ts`, `render.yaml`.
- How the frontend reads `detailedSteps` (`frontend/src/lib/today.ts` `parseSteps`) to confirm extra step fields are ignored.

### REQUIREMENTS
R1. **Pure planner.** A function (in `missedSessions.ts` or a new `backend/src/lib/carryForward.ts`) that takes the classified days, the open gap, the tasks with their parsed steps, the goal (for `isHighLoadStep`), the user's local today, and returns:
- `carries`: `{ fromTaskId, fromDate, toTaskId, toDate, step, replaced }` for each move to make, with the receiving day's new step list;
- `drops`: `{ taskId, date, reason }` with one reason from `no_receiving_day`, `receiving_day_closed`, `receiving_day_done`, `receiving_day_taken`, `lost_to_later_miss`, `in_gap`, `high_load`, `does_not_fit`, `swap_unanswered`, `no_priority_step`;
- `held`: `{ taskId, date, receivingTaskId, offerUntil }` for key sessions waiting for a swap answer;
- `alreadyCarried`: the moves found in stored `carriedFrom` markers.
No Prisma, no clock, no environment reads. Deterministic for the same input.

R2. **Building the receiving day.** The carried step keeps its content and `highLoad`, gains `carriedFrom`, and takes priority 2 (directly after the receiving day's own priority-1 step); the remaining steps keep their relative order, and `stepNumber` and `priority` are renumbered so both stay unique and contiguous (the test step keeps priority 0). The new total of step minutes is never more than the old total. The receiving task's `durationMinutes` is set to the new total.

R3. **Writer.** At the marked place in `POST /reconcile`: extend the `select` with the fields the planner needs, run the planner, and when the switch is on, write each carry with the compare-and-set from the rules (one write per receiving day; a lost race is skipped, not retried). Nothing else is written: no status, no field on the missed day (ND-2, ND-14).

R4. **Response.** Add one field to the plan v2 response, for example `carry: { enabled, carries, drops, held, alreadyCarried, written }` (`written` lists the carries this request actually wrote; empty when the switch is off or a race was lost). Keep every existing field unchanged. No user-facing copy: that is P3.

R5. **Switch.** Read `MISSED_SESSIONS_CARRY_ENABLED` per request; only the exact string `true` turns writes on. Add it to `render.yaml` with value `"false"` and a comment pointing to ND-15. Mention it in `CLAUDE.md` only if that file already documents environment variables.

R6. **Tests.**
- Planner (unit): a carry onto the next day; receiving day is the test day's neighbor rule (the step before the test day drops, `no_receiving_day`); receiving day closed, done, or already taken; two missed days sharing one receiving day (latest wins, the other `lost_to_later_miss`); an open gap (`in_gap`); a high-load step (`high_load`), including a `run10k` goal whose stored steps have no flag; fit needing one and needing two removed steps; the receiving day's priority-1 and test steps never removed; does not fit (`does_not_fit`); a missed key session held while its receiving day is open, then `swap_unanswered` once it closes; a day with no priority-1 step; already carried (found from the marker, never planned again); renumbering of `stepNumber` and `priority`.
- Invariant (property-style): over many generated weeks and miss patterns, no receiving day's total minutes ever increases, each receiving day gets at most one carry, and planning on the output of a previous run plans nothing new.
- Route: switch off → identical response fields as before plus `carry`, and no write method called; switch on → exactly one guarded write per carry with the expected `where`; a second call after the write plans nothing new; two concurrent calls where the first write wins → the second writes nothing (simulate with the mocked `updateMany` returning 0); old goals still `applies: false` with no writes; the existing `reconcile.test.ts` assertions still pass with the switch unset.

### OUT OF SCOPE
User-facing notices and copy (P3); counting rules and signals such as short-on-time and gentle-return (M2.3); the swap answer and mark-missed actions (M2.4); an undo endpoint; any schema change or migration; any frontend change; turning the switch on anywhere.

### REGRESSION CHECKS
R-1 (goal loading: reconcile errors still never block it), R-2 (task completion still works; `PATCH /tasks` is untouched), R-6, R-7 (old goals untouched). Baseline: backend `npx vitest run` 44 files / 398 tests pass; backend `npx tsc --noEmit` passes (the backend type-check covers `src/` only); frontend `npx vitest run` 425 tests, 0 failures; frontend `npx tsc --noEmit`, lint (0 errors, 2 warnings) and build pass. Use each package's own TypeScript if `npx` fetches another version. No test may need a database or the network.

### VALIDATION
Repository commands only: the new and changed test files first, then backend `npx vitest run` and `npx tsc --noEmit`, then the frontend checks once.

### DELIVERABLE
The planner, the writer behind the switch, the response field, the `render.yaml` entry, tests for R6, and a report at `docs/features/missed-sessions/milestones/m2.2-carry-forward.md`: files changed, evidence for R1-R6, EV-3 (the test list per case) and EV-4 (one week fixture before and after a miss, with the switch on and off), commands and results against the baseline, and carry-overs for M2.3 and M2.4. Do not commit or push to `main`.

### DONE
With the switch off, production behaves exactly as now apart from the extra `carry` field. With it on, each allowed carry is written once, guarded against concurrent requests, never lengthens a day, never lands on a test day, never moves a high-load step, never comes from an open gap, and never redirects a dropped step later; all validation is at the baseline or better.

### STOP IF
A rule above conflicts with the Feature Definition or 04-phases.md as written; the compare-and-set cannot be expressed with Prisma on the current schema; any other code path rewrites `detailedSteps` of the current week in a way that would race with reconcile (list it); stored steps lack the priorities the fit rule needs; or the work needs a schema change, a frontend change or user-facing copy. Report instead of working around it.

---

## M2.3 — Counting Rules and Signals

### STATUS
COMPLETE (2026-10-07, commit `8966b75`). Report: `docs/features/missed-sessions/milestones/m2.3-counting-and-signals.md`.

### ROLE
You are the implementation agent for Achivii missed-sessions P2/M2.3. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
Two pieces of P2 remain before the UI: how the 10-minute version counts (OD-2), and the signals P3 will render (ND-16). Signals are data, not copy: P3 writes the words. They are derived on every reconcile from the classification, the open gap, the carry plan and the stored `carriedFrom` markers; nothing new is stored.

Repository facts (verify, do not trust this prompt):
- `POST /api/goal/reconcile` (`backend/src/routes/goal.ts`) returns, for a plan v2 goal, `{ applies, goalId, asOf, timezone, days, gap, carry: { enabled, carries, drops, held, alreadyCarried, written } }`. The planner is `planCarries` in `backend/src/lib/carryForward.ts`; classification and gap are in `backend/src/lib/missedSessions.ts`.
- The only place that decides whether a key session was done is `writeNextWeek` (`backend/src/lib/planV2.ts`, `keySessionsSkipped`, about line 152): today `task.isKeySession && task.status !== 'completed'`. `DailyTask.usedMinimumVersion` exists since M2.0 (true when the day was completed only through the 10-minute version).
- `LastWeekSummary` (`backend/src/lib/ai/weekPlan.ts`) feeds the week call's "last week" block; its `done` and `planned` already count a 10-minute completion as done.
- The weekly update (prompt 4) that would consume missed and dropped counts does not exist (M4.2 is blocked).

### OBJECTIVE
Make OD-2 true where key sessions are counted, expose the per-week counts M4.2 will need, and return a small, honest `signals` object from reconcile that P3 can render without any further logic.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-2, ND-3, ND-9, ND-11, ND-15, ND-16, ND-17), P2 (7.3, M2.3), P3 (8.3, 8.7) to see what the UI will need.
- docs/features/missed-sessions/03-feature.md: sections 6, 8 (UX-1, UX-2, UX-4), 9, 11 (RULE-4, RULE-6, RULE-8, RULE-9), 12, OD-2, AC-7, AC-10.
- docs/features/missed-sessions/milestones/m2.2-carry-forward.md (carry-overs for M2.3).

### INSPECT FIRST
- `backend/src/lib/carryForward.ts` (`CarryPlan`, `PlannedCarry`, `CarryDrop`, `HeldCarry`, `CarriedEarlier`), `backend/src/lib/missedSessions.ts`, `backend/src/routes/goal.ts` `POST /reconcile`.
- `backend/src/lib/planV2.ts` `writeNextWeek` and its tests, `backend/src/lib/ai/weekPlan.ts` `LastWeekSummary` and `lastWeekBlock`.
- `backend/test/reconcile.test.ts`, `backend/test/reconcileCarry.test.ts`, `backend/test/carryForward.test.ts`.

### REQUIREMENTS
R1. **OD-2 in the week call.** In `writeNextWeek`, a key session counts as skipped when it is not completed **or** was completed only through the 10-minute version (`usedMinimumVersion === true`). Nothing else in `LastWeekSummary` changes: `done` still counts a 10-minute completion as done (RULE-4, AC-7). No prompt wording changes.

R2. **Week counts (for M4.2).** A pure, exported function that, for one week of a plan v2 goal, returns `{ practicePlanned, practiceDone, doneByMinimum, keySessions, keyDone, keySkipped, missed, carried, dropped }`, from the tasks, their classification and the carry plan. `keyDone` excludes 10-minute completions (OD-2); `missed` counts classified `missed` practice days; `carried` counts stored carries out of that week (markers), `dropped` counts that week's drops. Not wired into any prompt or route in this milestone (M4.2 will use it); tested only.

R3. **Signals.** Add `signals` to the plan v2 reconcile response, computed by a pure function from the existing result and plan (no new queries):
- `carried`: stored carries that concern today, each `{ fromDate, fromTaskId, toDate, toTaskId, stepTitle }`. A carry concerns today from the missed day's close until its receiving day closes. **Only stored carries** (from `carry.written` or `carry.alreadyCarried`): a carry that was only planned (switch off) is never reported as moved.
- `dropped`: drops whose missed day closed most recently, i.e. the latest missed practice day before today, when its step was dropped; each `{ date, taskId, reason }`. Reported only while that missed day is the most recent closed practice day.
- `swapOffer`: the held key session whose receiving day is open, `{ missedTaskId, missedDate, receivingTaskId, receivingDate, offerUntil }`, or null.
- `shortOnTime`: true when the current week (the week of today's task) has 2 or more `missed` practice days and today is an open practice day (RULE-9, UX-2).
- `gentleReturn`: when there is an open gap and today is the first open practice day after it, `{ gapLength, firstDate, lastDate }`; otherwise null (RULE-8, UX-4, AC-10).
- `notice`: the one thing P3 shows as a line (notice fatigue, 8.10), chosen in this order: `gentle_return`, `swap_offer`, `carried`, `dropped`, or null. `shortOnTime` is separate (it changes which version is offered, not the line).
With the switch off, `carried` is always empty, so no "moved" notice can appear before the move is real (ND-15).

R4. **Old goals and no goal.** `applies: false` responses are unchanged: no `signals`, no `carry`.

R5. **No writes, no copy, no schema.** M2.3 writes nothing new, adds no user-facing strings, no migration, no frontend change, and does not change the carry planner's decisions.

R6. **Tests.**
- `writeNextWeek`: a key session completed in full is done; completed only through the 10-minute version is skipped; pending is skipped; a non-key 10-minute completion still counts in `done`.
- Week counts: a fixture week with full, 10-minute, missed, carried and dropped days gives the expected numbers; rest days never count.
- Signals, one case per field: a written carry concerns today until its receiving day closes, then not; an already stored carry from an earlier reconcile; a planned but unwritten carry (switch off) gives no `carried`; a drop shown only while its day is the most recent closed practice day; a swap offer while held, gone once the receiving day closes; `shortOnTime` at 1 and 2 misses, and false on a rest day; `gentleReturn` on the first open practice day after a gap, not the day after; `notice` precedence when several apply; a rest day today never yields a carried or dropped notice about a rest day (AC-5).
- Route: the plan v2 response gains `signals` and keeps every other field exactly; `applies: false` responses are unchanged; with the switch off nothing is written (the existing assertions still hold).

### OUT OF SCOPE
Rendering or wording any notice (P3); the swap answer and mark-missed actions (M2.4); changing carry decisions (M2.2); wiring week counts into the weekly review or any model prompt (M4.2); any schema change, migration or frontend change; turning on `MISSED_SESSIONS_CARRY_ENABLED`.

### REGRESSION CHECKS
R-5 (weekly review still opens and saves), R-6 (week plan generation and its tests), R-7 (old goals), and every M2.2 carry test unchanged. Baseline: backend `npx vitest run` 46 files / 446 tests pass; backend `npx tsc --noEmit` passes (covers `src/` only); frontend `npx vitest run` 425 tests, 0 failures; frontend `npx tsc --noEmit`, lint (0 errors, 2 warnings) and build pass. Use each package's own TypeScript if `npx` fetches another version. No test may need a database or the network.

### VALIDATION
Repository commands only: the new and changed test files first, then backend `npx vitest run` and `npx tsc --noEmit`, then the frontend checks once.

### DELIVERABLE
The OD-2 change, the week-counts function, the `signals` field, tests for R6, and a report at `docs/features/missed-sessions/milestones/m2.3-counting-and-signals.md`: files changed, evidence for R1-R6, one example `signals` object for each notice type, commands and results against the baseline, and carry-overs for P3 (the exact fields to render) and M4.2 (the week counts). Do not commit or push to `main`.

### DONE
A key session done only as the 10-minute version is reported to the week call as skipped; week counts are available and tested; reconcile returns signals that never claim a move that did not happen, pick at most one notice, and change nothing for old goals; validation is at the baseline or better.

### STOP IF
Another code path decides "key done" (list it); a signal cannot be derived without storing new state; the signal timing rules above conflict with the Feature Definition or 04-phases.md; or the work needs copy, a frontend change, a schema change, or a change to carry decisions. Report instead of working around it.

---

## M2.4 — Mark Missed and Swap Actions

### STATUS
COMPLETE (2026-10-07, commit `1a98c63`). Report: `docs/features/missed-sessions/milestones/m2.4-mark-missed-and-swap.md`. Completes P2.

### ROLE
You are the implementation agent for Achivii missed-sessions P2/M2.4. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
Three user actions remain, each producing the same recovery as automatic detection (AC-2) and answering the key-session swap offer (RULE-6, AC-6, ND-9): mark today missed, swap two days, and "just move the main step" for a held key session. The rules come from 04-phases.md ND-9 to ND-18; ND-18 (added with this prompt) settles what M2.2 and M2.3 left open:
- **Mark missed shows at once.** A stored carry is reported in `signals.carried` from the moment it is stored until its receiving day closes (the lower bound "from the missed day's close" is removed). Automatic carries are only ever written after the close, so they are unaffected.
- **Swap marker.** Answering a swap offer moves the missed key session's content onto today and today's original content onto the missed (past) day. The steps that land on each day carry `swappedFrom: { taskId, date }` inside `detailedSteps` JSON. The planner treats a missed day that is the `swappedFrom.taskId` of any stored step, or holds steps with a `swappedFrom` marker, as handled: never carried, never held again. Without this, the next reconcile would carry today's original priority-1 step back into today.
- **All plan-changing actions are switched.** Mark missed, swap and carry-now write only when `MISSED_SESSIONS_CARRY_ENABLED === 'true'`; otherwise they answer 409 with `reason: 'carry_disabled'` and write nothing (rule 3.11).

Repository facts (verify, do not trust this prompt):
- `POST /api/goal/reconcile` (`backend/src/routes/goal.ts`) loads the active goal, classifies (`buildReconcileResult`), plans (`planCarries`, `backend/src/lib/carryForward.ts`), writes carries with a compare-and-set `updateMany` behind the switch, builds `signals` (`buildSignals`, `backend/src/lib/missedSignals.ts`) and responds.
- Content fields of `DailyTask` (see `schema.prisma`): `title`, `detailedSteps` (JSON string), `implementationIntention`, `durationMinutes`, `resourceTitle`, `resourceUrl`, `resourceType`, `resourceWhy`, `isKeySession`, `whyToday`, `minimumVersion`. Fields that belong to the date and the user, not the plan: `id`, `goalId`, `weekNumber`, `dayNumber`, `date`, `dayOfWeek`, `slotTime`, `isRestDay`, `isTestDay`, `status`, `completedAt`, `notes`, `usedMinimumVersion`.
- The frontend receives `detailedSteps` as the stored string (`frontend/src/types/index.ts`), so a client can send back exactly what it saw.
- Prisma interactive transactions are already used in `backend/src/routes/webhook.ts` (`prisma.$transaction(async (tx) => ...)`), with a mocked `$transaction` in `webhook.test.ts`.

### OBJECTIVE
Three guarded, idempotent endpoints that let a user change this week's plan by hand, each returning the same body as reconcile so the client can refresh in one round trip, all off until the switch is on.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-2, ND-9 to ND-18), section 3 (3.4, 3.5, 3.8, 3.11), P2 (M2.4), P3 (M3.3, which will call these).
- docs/features/missed-sessions/03-feature.md: section 3 (core user actions), 7, 10, 11 (RULE-6 and clarifications), AC-2, AC-6.
- docs/features/missed-sessions/milestones/m2.2-carry-forward.md and m2.3-counting-and-signals.md (carry-overs).

### INSPECT FIRST
- `backend/src/routes/goal.ts` (`POST /reconcile`, `PATCH /tasks/:taskId` for the auth and ownership pattern), `backend/src/lib/carryForward.ts`, `backend/src/lib/missedSignals.ts`, `backend/src/lib/missedSessions.ts`.
- `backend/src/routes/webhook.ts` and `webhook.test.ts` (transaction pattern), `backend/test/reconcileCarry.test.ts`, `backend/test/reconcileSignals.test.ts`, `backend/test/carryForward.test.ts`.

### REQUIREMENTS
R1. **One reconcile core.** Extract the body of `POST /reconcile` into a function the route and the three actions share (load, classify, plan, write behind the switch, build signals), with an optional override that treats one open task as `missed` for planning. `POST /reconcile` behaves exactly as now (its tests must pass unchanged).

R2. **Mark today missed.** `POST /api/goal/tasks/:taskId/mark-missed`, no body. Allowed only for the user's active plan v2 goal, on the task dated the user's local today, which is a practice day (not rest), not completed, and not already handled (a source of a `carriedFrom` or `swappedFrom` marker). It plans with that task treated as missed, so every M2.2 rule applies unchanged: it is carried to its receiving day, held for a swap offer if it is a key session, or dropped (for example no receiving day, high-load, does not fit, or now part of a gap). Only a carry writes anything (a guarded write, as in M2.2); a hold or a drop stores nothing (ND-14), and the day closes as missed tonight as it would anyway. Never writes a status. Responds 200 with the reconcile body. A repeat call after a carry is a no-op (already handled).

R3. **Swap.** `POST /api/goal/tasks/:taskId/swap` with `{ withTaskId, expected: { [taskId]: string, [withTaskId]: string } }`, where `expected` holds each day's `detailedSteps` exactly as the client last loaded it. Two shapes are allowed, both in the same week of the active plan v2 goal:
- **Open swap:** both days open (classified `planned`), dated today or later, practice days, not the test day, not completed, and neither holds a `carriedFrom` step. The content fields are exchanged; date-and-user fields stay. No marker is needed.
- **Answering a swap offer (ND-9):** `taskId` is a held missed key session and `withTaskId` is its receiving day, still open. The content fields are exchanged, and every step that lands on either day gets `swappedFrom` (R5). Key sessions never land on the test day (the receiving day is never the test day, ND-17).
Both days are written in one interactive transaction, each with a compare-and-set on `detailedSteps` equal to `expected` and on `status`; if either write matches no row, the transaction rolls back and the endpoint answers 409 (`reason: 'changed'`). So a double submit swaps once. `usedMinimumVersion` is not moved (neither day is completed). Responds 200 with the reconcile body.

R4. **Carry now.** `POST /api/goal/tasks/:taskId/carry-now`, no body: the "no swap, just move the main step" answer to a held key session. Allowed only while the task is held (its receiving day open); it carries the priority-1 step exactly as M2.2 would for a non-key day (fit rule, high-load, guarded write). Responds 200 with the reconcile body; a repeat is a no-op.

R5. **Planner and signals (ND-18).** In `planCarries`: a day that is the `swappedFrom.taskId` of any stored step, or that holds a step with `swappedFrom`, is handled (no carry, no hold, no drop entry). In `buildSignals`: a stored carry is reported from the moment it is stored until its receiving day closes. A swapped offer no longer appears as `swapOffer`. Add the marker type next to `CarryMarker`.

R6. **Guards and answers.** 401 without a user; 404 when the task is not the user's (as `PATCH /tasks` does); 409 with a `reason` for a disallowed state (`not_today`, `rest_day`, `completed`, `already_handled`, `not_held`, `not_same_week`, `not_open`, `test_day`, `holds_carry`, `changed`, `not_plan_v2`, `carry_disabled`); 400 for a malformed body. Error bodies follow the existing `{ error }` style plus `reason`. No user-facing copy beyond those error messages.

R7. **Tests.**
- Mark missed: carried (written, and immediately in `signals.carried` with notice `carried`); a key session held (swap offer appears); dropped for each reason path that applies to today; not today, rest day, completed, already handled; repeat is a no-op; switch off → 409 `carry_disabled` and nothing written.
- Swap: open swap exchanges exactly the content fields and keeps the others; answering an offer writes `swappedFrom` on both days, the offer disappears, and a following reconcile plans nothing for either day (no carry back); `expected` mismatch → 409 `changed` with nothing written (rollback); double submit swaps once; not same week, test day, completed, closed, or a day holding a carry → 409; switch off → 409.
- Carry now: carries a held key session's priority-1 step with the fit rule; not held → 409; repeat no-op; switch off → 409.
- Signals: a carry stored before the missed day closes is reported at once; automatic carries unchanged.
- `POST /reconcile` tests pass unchanged; old goals answer `not_plan_v2` for every action.

### OUT OF SCOPE
UI and wording for any action (P3, M3.3); marking a past or future day missed; swapping across weeks or with rest or test days; an undo endpoint; any schema change or migration; any frontend change; turning on the switch.

### REGRESSION CHECKS
R-2 (task completion via `PATCH /tasks` untouched), R-6, R-7, and every M2.2 and M2.3 test unchanged except where R5 deliberately changes the carried-signal window (update only those assertions, and say which). Baseline: backend `npx vitest run` 49 files / 469 tests pass; backend `npx tsc --noEmit` passes (covers `src/` only); frontend `npx vitest run` 425 tests, 0 failures; frontend `npx tsc --noEmit`, lint (0 errors, 2 warnings) and build pass. Use each package's own TypeScript if `npx` fetches another version. No test may need a database or the network.

### VALIDATION
Repository commands only: the new and changed test files first, then backend `npx vitest run` and `npx tsc --noEmit`, then the frontend checks once.

### DELIVERABLE
The shared reconcile core, the three endpoints, the planner and signals changes, tests for R7, and a report at `docs/features/missed-sessions/milestones/m2.4-mark-missed-and-swap.md`: files changed, evidence for R1-R7, the request and response for each endpoint, commands and results against the baseline, and carry-overs for P3 (exactly what M3.3 calls and when). Do not commit or push to `main`.

### DONE
Mark missed, swap and carry-now each apply the M2.2 rules, write once under concurrent or repeated requests, never carry a swapped day back, show a manual carry at once, change nothing for old goals, and write nothing while the switch is off; `POST /reconcile` is unchanged; validation is at the baseline or better; P2's exit criteria (04-phases.md 7.9) are met.

### STOP IF
A rule above conflicts with the Feature Definition or 04-phases.md; an action needs a stored status or a schema change; the two-day swap cannot be made atomic with Prisma on the current setup; any field's owner (content versus date-and-user) is unclear in a way that changes behavior (list it and ask); or the work needs copy, UI or a frontend change. Report instead of working around it.

---

# 3 — P3 TODAY EXPERIENCE

## M3.1 — Miss Notice

### STATUS
READY (drafted 2026-10-07). Depends on P2 (complete). The first user-visible milestone. After it is live, the ND-15 switch can be turned on (04-phases.md 2.4).

### ROLE
You are the implementation agent for Achivii missed-sessions P3/M3.1. Implement only this milestone. Follow the operating contract in section 0.

### CONTEXT
P2 made `POST /api/goal/reconcile` return `carry` and `signals` (ND-16), with `signals.notice` naming the one line to show (`gentle_return`, `swap_offer`, `carried`, `dropped`, or null). The frontend calls reconcile once per load in `GoalContext.loadGoal` but keeps nothing from it, and its `ReconcileResult` type (`frontend/src/types/index.ts`) predates `carry` and `signals`. Today still shows the generic, frontend-only callout "Yesterday's step wasn't completed" (`Today.tsx`, `yesterdayUncompleted`), and the Dashboard's status line says "Yesterday slipped past. No catching up needed, just today." (`pages/Dashboard.tsx`, `statusLine`, `slipped`). M3.1 replaces both with the real notice.

Scope of the notice in M3.1: only `carried` and `dropped`. `gentle_return` needs the 10-minute default (M3.2) before its line ("Today's a short one") is true, and `swap_offer` needs the swap UI (M3.3). Until then, those two kinds render nothing.

### OBJECTIVE
Today and the Dashboard show one calm, honest line about a missed day, taken from reconcile, and a tab left open overnight catches up on its own.

### READ FIRST
- docs/features/missed-sessions/04-phases.md: section 1.5 (ND-14 to ND-18), 2.4 (release order), section 3 (3.6 tone, 3.7 honesty, 3.9 accessibility, 3.11), P3 (8.1-8.10, M3.1, M3.3 notes).
- docs/features/missed-sessions/03-feature.md: sections 8 (UX-1), 9, 12 (tone and copy), AC-1, AC-5, AC-12.
- docs/features/missed-sessions/milestones/m2.3-counting-and-signals.md (the `signals` fields and examples) and m2.4-mark-missed-and-swap.md (what P3 calls).
- Design.md sections 5 and 6, and docs/decisions.md ND-19 (the Dashboard reads the same data as Today and never contradicts it).

### INSPECT FIRST
- `frontend/src/context/GoalContext.tsx`, `frontend/src/lib/api.ts` (`reconcileGoal`), `frontend/src/types/index.ts` (`ReconcileResult`, `ReconcileDay`).
- `frontend/src/components/today/Today.tsx` (`yesterdayUncompleted`, `Callout`) and `Today.test.tsx` (including the no-"missed"/"failed"/"behind" assertions).
- `frontend/src/pages/Dashboard.tsx` (`statusLine`, `slipped`) and `Dashboard.test.tsx`; `frontend/src/lib/today.ts` (`isYesterdayPending`, `todayKey`).
- The backend response shape: `backend/src/lib/missedSignals.ts` (`MissedSignals`) and `backend/src/lib/reconcileCore.ts` (`ReconcileBody`).
- `frontend/e2e/mockApi.ts`, `today.spec.ts`, `todayStates.spec.ts`.

### REQUIREMENTS
R1. **Types.** Mirror the backend response in `frontend/src/types/index.ts`: extend the plan v2 `ReconcileResult` with `carry` (full types only for the fields the UI reads) and `signals` (`carried`, `dropped`, `swapOffer`, `shortOnTime`, `gentleReturn`, `notice`), matching `MissedSignals` field for field.

R2. **Keep the result.** `GoalContext` stores the latest reconcile body as `reconciliation` (null before the first answer, after a failure, when signed out, and for `applies: false`). Load order and failure handling stay exactly as in M1.3: reconcile first, then the goal; a reconcile failure is logged and never affects loading. `refreshGoal` does not reconcile.

R3. **Catch up on a new day.** When the page becomes visible again (`visibilitychange` to visible, or window `focus`) and the user's local date (`todayKey` with the stored timezone) differs from the date of the last reconcile, run the same load again (reconcile, then the goal). At most one run at a time; never on the same date; nothing when signed out.

R4. **Today's notice.** Remove the `yesterdayUncompleted` callout. In its place, when `signals.notice` is `carried` or `dropped`, show exactly one line in the existing `Callout`, with these strings and no others:
- `carried`, moved into today: "{Day}'s session didn't happen. We moved its most important step into today, so today stays the same length."
- `carried`, moved to a later day: "{Day}'s session didn't happen. We moved its most important step to {Weekday}, so that day stays the same length."
- `dropped`: "{Day}'s session didn't happen. Nothing needs making up: the plan carries on as it is."
`{Day}` is "Yesterday" when the missed date is yesterday in the user's timezone, otherwise its weekday ("Monday"); `{Weekday}` is the receiving day's weekday. Take the dates from `signals.carried[0]` or `signals.dropped[0]`. Never show the drop reason. For `gentle_return`, `swap_offer` and null, show nothing (M3.2, M3.3). A rest day never shows a notice (the backend already returns no line on a rest day; keep that true in the UI). The notice belongs to Today's view of today only, not when another day is selected.

R5. **Dashboard agrees (ND-19).** Replace the `slipped` input of `statusLine` with the same signals: `carried` into today → "{Day}'s most important step is part of today's session."; `dropped` → "{Day} slipped past. No catching up needed, just today."; `{Day}` follows the R4 rule; otherwise unchanged. The line keeps the priority `slipped` has now. `isYesterdayPending` stops driving any user-facing line; remove it and its tests only if nothing else uses it.

R6. **Copy rules (3.6, AC-12).** No string added or shown contains "missed", "behind", "failed", "why", or a status label. The existing assertions stay, and new ones cover every R4 and R5 string.

R7. **Accessibility.** The notice reuses `Callout` (no new live region; it appears with the page). Zero horizontal overflow at 360, 375, 390 and 412 px; the longest string wraps cleanly.

R8. **Tests.**
- GoalContext: stores the body; null on failure, on `applies: false`, and when signed out; a visibility event on a new date runs reconcile then the goal once; the same date does nothing; two quick visibility events run once.
- Today: each R4 string, including "Yesterday" versus a weekday and "into today" versus a later day; nothing for `gentle_return`, `swap_offer`, null, a rest day, another selected day, or a failed reconcile; never more than one line; the old callout text is gone.
- Dashboard: each R5 line, and the unchanged lines.
- e2e: make `mockApi.ts` answer `POST /api/goal/reconcile` (default `applies: false`) so existing specs never depend on a failing request; add one `todayStates.spec.ts` case with a `carried` notice at 390 px.

### OUT OF SCOPE
Short-on-time and gentle-return (M3.2); swap, mark-missed and carry-now UI (M3.3); any backend change; turning on `MISSED_SESSIONS_CARRY_ENABLED` (a dashboard step after this ships, see the release checklist); new copy beyond R4 and R5.

### REGRESSION CHECKS
R-1 (goal loading), R-3 (every Today state), R-5, R-10 (no punitive copy), R-11 (axe and overflow). Baseline: backend `npm test` 50 files / 504 tests pass; frontend `npm test` 425 tests, 0 failures; frontend `npm run typecheck`, `npm run lint` (0 errors, 2 warnings) and `npm run build` pass; GitHub Actions CI (`.github/workflows/ci.yml`) green on the branch. Prefer the package scripts: a bare `npx tsc` can fetch a newer TypeScript.

### VALIDATION
Repository commands only: the changed test files first, then frontend `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and the Playwright specs you touched (`npx playwright test e2e/todayStates.spec.ts`). Push the branch and confirm CI passes.

### DELIVERABLE
The types, the stored reconciliation, the new-day catch-up, the Today notice, the Dashboard line, tests for R8, and a report at `docs/features/missed-sessions/milestones/m3.1-miss-notice.md`: files changed, every user-facing string, evidence for R1-R8 (EV-5 tests, EV-6 screenshots at 390 and 360 px), commands and results, and a **release checklist** for turning the switch on: set `MISSED_SESSIONS_CARRY_ENABLED` to `true` in the Render dashboard, confirm in production that a closed, pending practice day's priority-1 step moves once and Today shows the `carried` line, and how to turn it off again. Do not commit or push to `main`.

### DONE
Today and the Dashboard show at most one honest line about a missed day, from reconcile, with the exact strings above; the old callout is gone; nothing claims a move that did not happen; a tab opened on a new day catches up; all checks and CI pass.

### STOP IF
The backend response does not match `MissedSignals`; a string above cannot be made true for a case (list it); the notice would need a backend change; or the Dashboard and Today cannot read the same signals without restructuring. Report instead of working around it.
