# Achivii Missed Sessions — IMPLEMENTATION PHASES
### Detailed roadmap, milestones, dependencies, evidence, and exit criteria

**Status:** IN PROGRESS (P1, M2.0, M2.1 and M2.2 complete; next is M2.3; M4.2 is blocked, see 2.2)
**Version:** 1.5 (updated 2026-10-07: phase review, ND-9 to ND-16)
**Date:** 2026-10-03
**Feature Definition:** docs/features/missed-sessions/03-feature.md
**Plan source:** docs/architecture/plan-v2.md (Missed sessions, Week call, Weekly update)
**Template:** docs/templates/04-phases.md

---

# 0 — HOW TO READ THIS FILE

This file is the execution roadmap and source of truth for implementation order.
It converts the approved Feature Definition into ordered phases and independently verifiable milestones.
The Prompt Engineer consumes one milestone plus current repository evidence to create an implementation prompt.
No milestone authorizes unrelated work.

## 0.1 Status legend
| Status | Meaning |
|---|---|
| NOT STARTED | No implementation work has begun. |
| IN PROGRESS | Work is actively being implemented. |
| PARTIAL | Some milestones are complete; phase exit criteria are not met. |
| COMPLETE | Milestones, evidence, regressions, and review are complete. |
| BLOCKED | A required dependency or decision prevents safe progress. |

## 0.2 Identifier system
- P1-P5 = phases. M1.1 etc. = milestones.
- OD-n = Feature Definition decisions (all closed). ND-n = decisions discovered during implementation.
- AC-n = Feature Definition acceptance criteria. RULE-n = Feature Definition rules.
- R-n = regression requirements. EV-n = required evidence.

## 0.3 Completion rule
Code existing is not completion.
A milestone is complete only when its objective has observable evidence, touched regressions pass, scope stayed bounded, and unresolved work is recorded.

---

# 1 — APPROVED PRODUCT DIRECTION

## 1.1 Problem
Plan v2 decided how a missed day is handled, but the product does not yet detect misses, carry a step forward, protect the test day, or help a user return after a gap. Today only shows a generic "yesterday's step wasn't completed" callout.

## 1.2 Direction
A single, predictable recovery path per session type, applied automatically when the app is opened. Rules are decided in code, not by the model. Copy follows the blueprint: **adapt the journey, don't punish the person.**

## 1.3 Resolved decisions inherited from the Feature Definition
| ID | Resolution |
|---|---|
| OD-1 | Day closes at the user's `sleepTime` + 2 hours, capped at 04:00 local, in the user's IANA timezone. |
| OD-2 | The 10-minute version counts as a session done, but not as a key session done. |
| OD-3 | Pause plan is a separate future feature. Out of scope. |
| OD-4 | No streak is introduced. |
| OD-5 | High-load steps use a new per-step flag. |

## 1.4 Repository findings that shape the roadmap (evidence from 2026-10-03 inspection)
| ID | Finding | Consequence |
|---|---|---|
| F-1 | `backend/src/lib/timezone.ts` already provides IANA validation and zoned day-boundary helpers. | Reuse for OD-1. Do not write new date logic. **Corrected by M1.1 (see 1.5): the helpers existed but were unused; M1.1b wired them in.** |
| F-2 | `DailyTask.status` is a free string (default `pending`); the PATCH `/api/goal/tasks/:taskId` route accepts any `status`. Steps live in the `detailedSteps` string and `minimumVersion` is JSON. | A `missed` status and a per-step flag likely need no schema migration. Verify in M1.1. **Settled by ND-2: no `missed` status; "missed" is derived.** |
| F-3 | `Today.tsx` has a frontend-only `yesterdayUncompleted` callout. Nothing persists or moves. Existing tests assert no "missed", "failed", "behind" wording on Today. | P3 replaces the callout; keep the no-punitive-copy assertions. |
| F-4 | No "mark today missed" or "swap day" implementation was found in frontend or backend. | M2.4 builds them. Plan v2 only decided them. |
| F-5 | `weekPlan.ts` accepts `retestFirst` as an input, but no weekly-update code (status, nextTargets, checkpointOffer) exists in the backend. | M4.2 is blocked on plan v2 build step 4. **Corrected by M1.1: the weekly review route exists; status, `nextTargets`, checkpoint and `retestFirst` do not.** |
| F-6 | `RoadmapWeek.testResult` and `validateWeeklyTestResult` exist. | Late test logging (M4.1) can build on them. **Corrected by M1.1: `testResult` is only written by the review, which closes the week; see ND-4.** |
| F-7 | Presets `run10k.ts` and `recomp.ts` generate physical steps. | They need the high-load flag in M2.1. **Corrected by M1.1: v2 steps are model-written, so the flag comes from the goal and the week call, not the preset files (ND-5).** |
| F-8 | No streak code exists in the frontend. | OD-4 needs no work. |

## 1.5 Decisions and corrections from M1.1 (evidence: milestones/m1.1-repository-verification.md)

Findings F-1, F-5, F-6 and F-7 above were **corrected** by M1.1. Where this section and 1.4 disagree, this section wins.

| ID | Decision (approved 2026-10-03) | Effect on the roadmap |
|---|---|---|
| ND-1 | Use `User.timezone` as the one clock for "today". `DailyTask.date` is treated as the user's local calendar date. The frontend and backend switch to the same source. | New milestone **M1.1b** before M1.2. The app today uses UTC dates; `timezone.ts` has no production importer. |
| ND-2 | **Derive** "missed" from date + `pending` + day-close time. Do not add a `missed` value to `DailyTask.status`. Persist only moved steps. | M1.2 is pure functions. M1.3 persists nothing about "missed". About 55 status readers are untouched. |
| ND-3 | Add one column `DailyTask.usedMinimumVersion Boolean @default(false)` so the 10-minute version is recorded. | New milestone **M2.0** (the only schema migration in this feature). Required for OD-2. |
| ND-4 | Add a small endpoint that logs the weekly test **without closing the week**. | M4.1 now includes a narrow backend addition. |
| ND-5 | High-load flag: by goal for presets (`run10k`, `recomp`), and per step from the model for custom goals. | M2.1 covers both. Preset prose files are not the source, because v2 steps are model-written. |
| ND-6 | Reconcile runs through a new `POST /api/goal/reconcile`, called once when the app loads. `GET /active` stays a pure read. | M1.3 builds this endpoint. |
| ND-7 | The 9 failing tests in `frontend/src/components/app/AppShell.test.tsx` are a **recorded baseline**, fixed separately. | **Resolved 2026-10-07** (merge of `claude/eager-chatelet-d44dd8`): the tests were out of date. From P2 on, the frontend baseline is zero failures. |
| ND-8 | Completion is stored per day, never per step, so M1.2 counts a day as done only when it is marked completed. "Partial-day credit" and "P1 done, later steps not" are not computed. | M1.2 (recorded 2026-10-07). Per-step completion would need a storage change and is outside P1. |
| ND-9 | **Key session: swap before carry.** Reconcile does not carry a missed key session's step while its swap offer is open. The offer stands until the day that would receive the carry closes. The user's answer triggers the swap (M2.4) or the carry; if the offer day closes unanswered, the normal carry rule runs then. | Recorded 2026-10-07 (phase review). RULE-6 and AC-6 hold even though reconcile runs automatically. M2.2 and M2.4. |
| ND-10 | **Fit rule (RULE-1).** The carried step replaces the receiving day's lowest-priority steps, lowest first, until its minutes fit inside the minutes they free. The receiving day's own priority-1 step and its test step are never replaced. If it cannot fit, the step is dropped. | Recorded 2026-10-07. "A day never gets longer" is guaranteed by construction, not just by a test. M2.2. |
| ND-11 | **No carry after a gap.** When reconcile finds an open gap (3+ missed practice days in a row), nothing from that run is carried; the steps are dropped and the next session is the gentle-return day (RULE-8). | Recorded 2026-10-07. The return day stays short. M2.2, M2.3. |
| ND-12 | **Most recent miss wins.** When several missed days compete for one eligible day, the most recent missed day's priority-1 step is carried; the others are dropped. | Recorded 2026-10-07. M2.2. |
| ND-13 | **Carry writes are guarded.** A carry is written in one database transaction that re-reads the receiving day and writes only if its steps are unchanged since they were read. The carried step stores a `carriedFrom` marker (source task id and date) and the steps it replaced, inside `detailedSteps` JSON. | Recorded 2026-10-07. Two tabs or two reloads cannot carry twice; every carry is auditable and reversible. No migration. M2.2. |
| ND-14 | **Mark missed needs no new storage.** Marking today missed runs the carry for today at once (ND-10 to ND-13). The receiving day's `carriedFrom` marker records it, and reconcile treats a day that is the source of a marker as already handled. It never writes a status, and never `skipped`: `frontend/src/lib/journeyAdapter.ts` counts `skipped` as done. | Recorded 2026-10-07. Keeps ND-2 (no new status). M2.4. |
| ND-15 | **Ship dark, behind a switch.** Every merge to `main` deploys to production at once (Render and Vercel, no CI). Carry writes are gated by one backend environment switch, `MISSED_SESSIONS_CARRY_ENABLED`, off unless set to `true`. With it off, reconcile computes and returns what it would do but writes nothing. It is turned on only after M3.1 (the notice that says what moved) is live, and it is the kill switch if anything goes wrong. | Recorded 2026-10-07. Users never see a plan change without the line that explains it. M2.2 adds the switch; M3.1 turns it on. |
| ND-16 | **Notices are derived, not stored.** "Moved to Thursday", "dropped", short-on-time and gentle-return are computed from classification plus the `carriedFrom` markers, and shown on the day they concern. No "seen" state is stored. | Recorded 2026-10-07. M2.3 returns them from reconcile; P3 renders them. |
| ND-17 | **Fixed receiving day.** Each missed practice day has exactly one receiving day: the first later day that is a practice day, not rest and not the test day. If that day has closed, is done, or already received a carry, the step is dropped permanently; it is never redirected to a later day. This also settles ND-9: a key-session swap offer is open while its receiving day is open, and an unanswered offer ends in a drop. | Recorded 2026-10-07 (M2.2 drafting). Without it, a step dropped on Tuesday could be carried on Thursday by a later reconcile. Stateless: nothing extra is stored. M2.2, M2.4. |

**Validation baseline from P2 on (2026-10-07, `main` after P1 and the test-fix merges):** backend `npx vitest run` 41 files / 361 tests pass, including `researchCache.test.ts`, which no longer touches a database; backend and frontend `tsc --noEmit` pass; frontend lint 0 errors, 2 warnings; frontend `npx vitest run` 419 tests, 0 failures (5 full runs in a row); frontend `npm run build` passes. `backend/vitest.config.ts` excludes `dist/`, whose stale compiled tests inflated earlier backend counts.

**Validation baseline (2026-10-03, `main`, historical; backend counts include stale `dist/` copies):** backend `npm test` 54 files / 362 tests pass; backend and frontend `tsc --noEmit` pass; frontend lint 0 errors; frontend `npm test` 9 failures, all in `AppShell.test.tsx` (pre-existing); Playwright e2e not run (no npm script).

**Other corrections to carry:** a weekly-review route (`POST /weeks/:weekNumber/review`) already exists for v2 goals, so M4.2 extends it and no longer builds it from scratch; status, `nextTargets`, checkpoint offer and `retestFirst` are still not built. Preset prose in `run10k.ts`, `guitar.ts` and `saas.ts` promises "missed days shift into weekend buffers", which is not implemented; M5.2 must make this copy honest. The frontend `DetailedStep` type lacks `priority`; add it in P3.

---

# 2 — ROADMAP AT A GLANCE

| Phase | Name | Depends on | Backend allowance |
|---|---|---|---|
| P1 | Miss Recognition | Feature Definition | User-timezone date source (M1.1b), new pure lib module, new `POST /api/goal/reconcile`. No migration. |
| P2 | Recovery Rules | P1 | **One migration** (`usedMinimumVersion`, M2.0), carry-forward behind the ND-15 switch, high-load flag, mark-missed and swap actions. |
| P3 | Today Experience | P2 | None beyond response fields P2 exposes. |
| P4 | Test Day & Week Close | P1; M4.2 also needs plan v2 weekly update | Endpoint to log the test without closing the week (M4.1); week-close handoff extends the existing review route (M4.2). |
| P5 | QA, Copy Audit & Regression | P1-P4 | None. |

Current status: P1 COMPLETE; P2 IN PROGRESS; P3, P4, P5 NOT STARTED (M4.1 can start any time, see 2.3).

## 2.1 Dependency graph
```
Feature Definition
        ↓
P1 — Miss Recognition
        ↓
P2 — Recovery Rules
   ↓            ↓
P3 Today     P4 Test day & week close
   ↓            ↓   (M4.2 needs plan v2 weekly update)
        P5 — QA
```

## 2.2 Blocked item
**M4.2 (week-close handoff) is BLOCKED** by the plan v2 weekly update (prompt 4), which is not built (F-5). It covers AC-9, AC-11 and the status inputs. Everything else can ship without it. When the weekly update is built, M4.2 becomes unblocked and P4 can complete.

## 2.3 Ordering rationale
Recognition comes first because every rule needs a trustworthy "was this day missed" answer. Rules are built before UI so the UI reads decided state instead of inventing it. The test day work is split so the part that does not need the weekly update can ship. M4.1 (late test) depends only on P1, so it can be run at any point, in parallel with P2 or P3.

## 2.4 Release order (ND-15)
Code merged to `main` reaches production immediately. So: P2 lands with `MISSED_SESSIONS_CARRY_ENABLED` off; P3's M3.1 lands; the switch is turned on in the Render dashboard; M3.1's evidence is re-checked in production. Turning the switch off again stops all carries at once without a deploy.

---

# 3 — RULES FOR EVERY PHASE

## 3.1 Repository-first
Inspect current files and behavior before implementing. Do not trust path assumptions in this document; "files likely affected" are starting points only.

## 3.2 Scope discipline
The milestone is the maximum scope. No convenient refactors.

## 3.3 Rules live in code
Detection, carry-forward, drop rules, and gap handling are deterministic code. The model is never asked to decide them (plan v2: code decides practice, rest, test days).

## 3.4 Idempotency
Reconciliation runs on app open and may run many times. Running it twice must produce the same result, with no double carries and no duplicated steps.

## 3.5 No pile-up
No path may make any day longer than its planned minutes (RULE-1). Treat as a hard invariant with a test.

## 3.6 Tone
Neutral and encouraging. Never ask why. Never use "missed", "failed", "behind" in user-facing copy. Existing assertions to that effect stay.

## 3.7 Honesty
Do not imply a feature exists when it does not: no fake streaks, no fake status labels, no notifications (out of scope), no checkpoint offer before the weekly update exists.

## 3.8 Preservation
Old (planVersion 1) goals behave exactly as before (AC-14). Every new code path must be gated on `planVersion: 2`.

## 3.9 Accessibility and mobile
New Today UI keeps semantic structure, keyboard operation, visible focus, non-color status, reduced motion, and no horizontal overflow on supported widths.

## 3.10 Validation
Do not invent commands. Inspect `package.json` scripts and the existing test setup (backend tests, frontend unit tests, Playwright e2e) immediately before choosing validation.


## 3.11 Ship dark
Any code that changes a user's stored plan must be off by default behind a named switch until the UI that explains the change is live (ND-15). Merging to `main` deploys.

---

# 4 — REGRESSION REGISTER

| ID | Existing capability | Required verification |
|---|---|---|
| R-1 | Authentication and active-goal loading | Goal loads or honest error appears. |
| R-2 | Task completion (PATCH task) | Mark complete still works and persists. |
| R-3 | Today states | Rest day, key session, test day, review due, completed goal, offline, and load error still render as before. |
| R-4 | Focus session and 10-minute version | Focus modal and minimum version remain usable. |
| R-5 | Weekly review modal | Existing review still opens and saves. |
| R-6 | Week plan generation | `weekPlan.ts` output rules and tests still pass. |
| R-7 | Old goals (planVersion 1) | No behavior change. |
| R-8 | Presets | Preset plans still generate and load. |
| R-9 | Timezone behavior | Existing timezone utilities unchanged in behavior. |
| R-10 | No punitive copy | Existing no "missed/failed/behind" assertions still pass. |
| R-11 | Accessibility and responsive | Axe and overflow checks still pass at existing widths. |

Each phase states which R-n items it touches.

---

# 5 — PHASE ANATOMY

Every phase uses: Status, Source, Objective, Current state, In scope, Out of scope, Backend allowance, Files likely affected, Milestones, Regression checks, Validation, Exit criteria, Risks, Completion evidence.

---

# 6 — P1 MISS RECOGNITION

**Status:** COMPLETE (2026-10-07: M1.1, M1.1b, M1.2, M1.3)

## 6.1 Source
Feature Definition RULE-5, RULE-8 (detection part), OD-1, AC-1, AC-5, AC-14. Findings F-1, F-2.

## 6.2 Objective
Reliably decide, on app open, which past practice days of the active plan v2 goal were missed, using the user's timezone and sleep time. The decision is derived each time and never stored as a status.

## 6.3 In scope
- Day-close calculation (OD-1) using `timezone.ts`.
- A single user-timezone clock for "today" (M1.1b).
- Derived (never stored) classification of each past day: done, missed, rest (never missed), planned.
- Detection of a gap (3+ missed practice days in a row).
- An idempotent `POST /api/goal/reconcile` that returns the classification (P2 adds the writes).

## 6.4 Out of scope
- Moving or changing any step (P2).
- UI (P3).
- Weekly status or the weekly update (P4).
- Push notifications.

## 6.5 Backend allowance
New pure-logic module, a user-timezone date source (M1.1b), and a new `POST /api/goal/reconcile` endpoint (ND-6). **No schema migration and no new `status` value** (ND-2): "missed" is derived, never stored.

## 6.6 Files likely affected (verify first)
`backend/src/lib/timezone.ts` (reuse), `backend/src/lib/ai/weekPlan.ts` (`weekLayout` date labels for new goals), a new lib module, `backend/src/routes/goal.ts`, `frontend/src/lib/today.ts`, `frontend/src/lib/dateUtils.ts`, `frontend/src/context/AuthContext.tsx`, `backend/test/`, `frontend/src/lib/today.test.ts`.

## 6.7 Milestones

**M1.1 — Repository verification. COMPLETE** (2026-10-03). Evidence: `milestones/m1.1-repository-verification.md`. Answers feed ND-1 to ND-7 above.

**M1.1b — User-timezone "today". COMPLETE** (2026-10-07). Evidence: `milestones/m1.1b-user-timezone-today.md`. Make `User.timezone` the single clock for "today" (ND-1). Frontend: `todayKey`, `isToday`, `findYesterdayTask`, `isWeekReviewDue` use the user's timezone (browser zone, then UTC, as fallback) instead of the UTC date. Backend: dates written for **new** goals are the user's local calendar dates, using `timezone.ts`. Existing rows are not rewritten. Tests: offsets such as UTC+3, UTC-8 and UTC+14, DST changes, a goal created late in the evening, and a user whose timezone is missing. Regression: R-3, R-5, R-7, R-9.

**M1.2 — Day-close and classification (pure functions only). COMPLETE** (2026-10-07). Evidence: `milestones/m1.2-day-close-classification.md`. Partial-day credit is limited by ND-8. Day-close time (sleep time + 2 hours, capped at 04:00 local), derived classification (done, missed, rest, planned) from date + status + close time, partial-day credit, and gap detection. No writes, no new status value. Unit tests for late-evening sessions, DST, rest days, the 04:00 cap, and partial days.

**M1.3 — Reconcile endpoint. COMPLETE** (2026-10-07). Evidence: `milestones/m1.3-reconcile-endpoint.md` (EV-2 in section 4). `POST /api/goal/reconcile`, `planVersion: 2` only, called once on app load. In P1 it returns the derived classification and persists nothing; P2 adds the carry-forward writes on top. Idempotent by design. `GET /active` is unchanged. Old goals untouched.

## 6.8 Regression checks
R-1, R-2, R-3, R-5, R-7, R-9.

## 6.9 Exit criteria
AC-1, AC-5, AC-14 are demonstrably true at the logic and API level. Reconcile is idempotent. Evidence EV-1: tests for each case in M1.2. EV-2: before/after API response for a goal with a closed unfinished day.

## 6.10 Risks
Wrong day boundary causes false misses (Feature Definition R-1). Mitigation: M1.2 tests, timezone fallback to UTC only when no timezone is known, and a conservative reading when `sleepTime` is missing.

---

# 7 — P2 RECOVERY RULES

**Status:** IN PROGRESS (M2.0, M2.1, M2.2 complete)

## 7.1 Source
RULE-1, RULE-2, RULE-3, RULE-4, RULE-6 (data part), RULE-8 (data part), RULE-10, OD-2, OD-5, AC-2, AC-3, AC-4, AC-7, AC-13. Findings F-2, F-4, F-7.

## 7.2 Objective
Apply the carry-forward and drop rules in code so a miss moves at most one priority-1 step, never lengthens a day, never touches the test day, and never carries a high-load step.

## 7.3 In scope
- High-load per-step flag (OD-5), set for plan v2 week calls and for `run10k` and `recomp` presets.
- Carry-forward: the priority-1 step of the most recent missed day (ND-12) moves to the next eligible day, replacing that day's lowest-priority steps until it fits (ND-10); drop when there is no eligible day, when the step is high-load, when it cannot fit, or after a gap (ND-11). Missed key sessions wait for the swap answer (ND-9). Writes are guarded (ND-13) and switched off by default (ND-15).
- The 10-minute version counts as done; a key session done only by the 10-minute version is not "key done".
- Record key-session-skipped and missed counts for later weekly use.
- "Mark today missed" and "swap day" actions, if absent (F-4), producing the same recovery as automatic detection.
- Signals for the UI, derived not stored (ND-16): carried, dropped, swap offer, short-on-time (2 misses in a week), gentle-return (after a gap).

## 7.4 Out of scope
UI, weekly status, model prompts beyond adding the flag to the week-call schema, pause plan (OD-3).

## 7.5 Backend allowance
**One schema migration**: `DailyTask.usedMinimumVersion Boolean @default(false)` (ND-3, M2.0). Step fields inside `detailedSteps` JSON (`highLoad`, `carriedFrom`; no migration). Writes inside `POST /reconcile` behind the ND-15 switch. Two small actions on the goal router (mark missed, swap).

## 7.6 Files likely affected (verify first)
`backend/src/lib/ai/weekPlan.ts`, `backend/src/lib/ai/presets/index.ts` (read only, to identify presets), `backend/src/lib/missedSessions.ts`, `backend/src/lib/planV2.ts` (`writeNextWeek` counts), `backend/src/routes/goal.ts` (`POST /reconcile`, new actions), a new recovery lib module, `backend/test/`. Preset prose files are **not** changed (ND-5).

## 7.7 Milestones

**M2.0 — `usedMinimumVersion` migration (ND-3). COMPLETE** (2026-10-07). Evidence: `milestones/m2.0-used-minimum-version.md`. Add `DailyTask.usedMinimumVersion Boolean @default(false)` to the schema. Generate the Prisma migration as a file; it is applied by `prisma migrate deploy` on the next Render deploy of `main`, never from the agent. Wire the column in the focus-session completion path so the flag is set when the user completes the 10-minute version. Existing rows default to `false`. This is the only schema migration in the feature.

**M2.1 - High-load step flag. COMPLETE** (2026-10-07). Evidence: `milestones/m2.1-high-load-flag.md`. The recomp preset's id is `body_recomposition_90day`. Two sources (ND-5): goal-level for `run10k` and `recomp` goals (every step counts as high-load), and a per-step `highLoad` field emitted by the week call for custom goals, added to `WEEK_RESPONSE_SCHEMA` and normalized in `checkWeekAnswer` (`weekPlan.ts`). Preset prose files are not the source, because v2 steps are model-written. One reader, `isHighLoadStep(step, goal)`, also treats every step of an existing `run10k`/`recomp` goal as high-load even though its stored steps have no flag; steps of custom goals written before M2.1 count as normal.

**M2.2 — Carry-forward. COMPLETE** (2026-10-07, switched off). Evidence: `milestones/m2.2-carry-forward.md`. Planner in `backend/src/lib/carryForward.ts`. A pure planning function, then the guarded write.
* Pure function (input: classification, gap, tasks, goal, now; output: carries and drops): next eligible day = the next practice day that is still open, not the test day and not completed; most recent miss wins (ND-12); fit rule (ND-10); high-load dropped via `isHighLoadStep` (M2.1); nothing carried from a gap run (ND-11); missed key sessions held while their swap offer is open (ND-9); a day already the source of a `carriedFrom` marker is never carried again.
* Write: in `POST /reconcile` at the marked P2 place, one transaction per receiving day with the unchanged-since-read check and the `carriedFrom` marker holding the replaced steps (ND-13). Only when `MISSED_SESSIONS_CARRY_ENABLED` is `true`; otherwise the response reports the planned carries and nothing is written (ND-15). The variable is declared in `render.yaml` with `sync: false` (no value: unset is off, and a Blueprint sync can never overwrite the dashboard setting).
* Tests: every rule above; day before the test day (drop); multiple misses before one eligible day; a carried step that does not fit (drop) and one that needs two replaced steps; the receiving day's own priority-1 and test steps never replaced; a property-style test that no day's total minutes ever increase; idempotency (repeat calls, and two concurrent calls, carry once); switch off writes nothing. ("P1 step already done" is not a case: completion is per day, ND-8.)

**M2.3 - Counting rules and signals.** The 10-minute version counts as a done session. A key session completed only through the 10-minute version is not "key done" (OD-2), decided from `DailyTask.usedMinimumVersion` (M2.0): change `keySessionsSkipped` in `writeNextWeek` (`backend/src/lib/planV2.ts`) to count it as skipped. Missed-day and dropped-step counts are derived by a tested week-counts function, ready for M4.2 to pass to the weekly update (ND-2); they are not added to any prompt now (7.4). Reconcile returns the derived signals (ND-16): carried (what, from, to), dropped, swap offer, short-on-time (2+ missed practice days this week), gentle-return (open gap).

**M2.4 — Mark missed and swap actions.** Verify absence first. Mark missed runs the M2.2 carry for today at once, with the same rules, guard and switch, and stores nothing else (ND-14); never a `skipped` or `missed` status. Swap exchanges the plan content of two open practice days in the same week (dates stay), never moves the test day, never puts a key session on the test day, and answers a key-session swap offer (ND-9). Both are idempotent and guarded like M2.2.

## 7.8 Regression checks
R-2, R-4, R-6, R-7, R-8.

## 7.9 Exit criteria
AC-2, AC-3, AC-4, AC-6 (logic), AC-7, AC-13 are true at the logic and API level. A property-style test proves no day exceeds its planned minutes. Concurrent reconcile calls carry once. With the switch off, production behaves exactly as after P1. Evidence EV-3: test list per M2.2 case. EV-4: a week fixture before and after a miss, with the switch on and off.

## 7.10 Risks
Duplicate or lost steps on repeated or concurrent reconcile (ND-13 guard and tests). Preset steps without the flag stacking physical load (`isHighLoadStep` covers old `run10k`/`recomp` goals; list any other physical presets found). Plan changes reaching users before the notice exists (ND-15 switch).

---

# 8 — P3 TODAY EXPERIENCE

**Status:** NOT STARTED

## 8.1 Source
UX-1, UX-2, UX-4, RULE-6 (UI), RULE-8 (UI), RULE-9, tone section, AC-1, AC-5, AC-6, AC-7, AC-10, AC-12. Finding F-3.

## 8.2 Objective
Show the recovery on Today in one calm line with one clear next action, replacing the generic "yesterday's step wasn't completed" callout.

## 8.3 In scope
- Miss notice: what moved, in neutral copy.
- Short-on-time prompt after 2 misses in a week, with the 10-minute version prominent.
- Gentle-return day after a gap: 10-minute version by default, full session one tap away.
- Key-session-missed state with a swap offer.
- Mark-today-missed and swap entry points.
- Entry point for the 10-minute version on Today.

## 8.4 Out of scope
Late test card (P4), weekly update message and checkpoint offer (P4/M4.2), streaks, reminders.

## 8.5 Backend allowance
None, beyond fields P2 already exposes. Turning on `MISSED_SESSIONS_CARRY_ENABLED` is a dashboard setting, not code (ND-15).

## 8.6 Files likely affected (verify first)
`frontend/src/components/today/Today.tsx` and `Today.test.tsx`, `frontend/src/components/focus/*`, `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`, `frontend/e2e/todayStates.spec.ts`.

## 8.7 Milestones

**M3.1 — Miss notice.** Replace the `yesterdayUncompleted` callout with the real carried or dropped notice from the reconcile signals (ND-16). Copy from Feature Definition section 12. Also reconcile again when the tab becomes visible on a new local date, so a tab left open overnight catches up. After this ships, turn the ND-15 switch on and re-check the notice in production (2.4).

**M3.2 — Short-on-time and gentle-return.** UX-2 and UX-4, with the 10-minute version reachable in two taps or fewer.

**M3.3 — Key-session swap and mark-missed UI.** Swap offered before carry-forward for a missed key session. Rest days never show a miss message.

**M3.4 — State coverage and accessibility.** Loading, error, offline, rest, key, test, review-due, and completed states still correct; axe and overflow checks at the existing widths. Add an `e2e` npm script in `frontend/package.json` that runs the existing Playwright config, so EV-5 can be run by a command.

## 8.8 Regression checks
R-3, R-4, R-5, R-10, R-11.

## 8.9 Exit criteria
AC-1, AC-5, AC-6, AC-7, AC-10, AC-12 true in the UI. Existing no-punitive-copy assertions still pass. Evidence EV-5: unit and e2e tests per state. EV-6: mobile screenshots at 390 and 360 widths.

## 8.10 Risks
Copy drifting punitive (Feature Definition R-4): add assertions for the new strings. Notice fatigue: show one line, not a list.

---

# 9 — P4 TEST DAY AND WEEK CLOSE

**Status:** NOT STARTED (M4.1 ready, M4.2 BLOCKED)

## 9.1 Source
RULE-7, RULE-9, UX-3, UX-5, UX-6, AC-8, AC-9, AC-11. Findings F-5, F-6.

## 9.2 Objective
Let a user take the weekly test late, and make an unlogged test flow honestly into the weekly update.

## 9.3 Milestones

**M4.1 - Late test (ready; depends only on P1, can run any time).** A small backend endpoint logs the weekly test result into `RoadmapWeek.testResult` **without closing the week** (ND-4), reusing `validateWeeklyTestResult`. On Today, a "Take the test now" card shows from the end of test day until the weekly review is submitted, because the existing review (`POST /weeks/:weekNumber/review`) is what closes the week today. After the review, the card is gone.

**M4.2 — Week-close handoff (BLOCKED).** On the first open of a new week, if the test is unlogged, run the plan v2 weekly update with the test marked missing, target held, and sessions deciding status; feed it missed-day, dropped-step, and key-skipped counts; apply `retestFirst` after two far_behind weeks and the daily-time check. **Blocked until plan v2 build step 4 (weekly update, prompt 4) exists.** Do not build a substitute status engine in this feature.

## 9.4 In scope / out of scope
In scope: late test, handoff inputs. Out of scope: building the weekly update itself, checkpoint offers (owned by the weekly update).

## 9.5 Files likely affected (verify first)
`backend/src/routes/goal.ts` (test result path), `frontend/src/components/today/Today.tsx`, `frontend/src/components/review/*`, `RoadmapWeek` handling, the future weekly-update module.

## 9.6 Regression checks
R-5, R-6, R-3.

## 9.7 Exit criteria
M4.1: AC-8 true, evidence EV-7 (card shown in window, gone after). M4.2: AC-9 and AC-11 true, evidence EV-8 (unlogged-test week produces a held target and a neutral one-line message). P4 is PARTIAL until M4.2 is done.

## 9.8 Risks
A missing test being treated as a failure of the person (RULE-7). Building a stand-in weekly update that later conflicts with the real one.

---

# 10 — P5 QA, COPY AUDIT AND REGRESSION

**Status:** NOT STARTED

## 10.1 Objective
Prove the whole feature against the Feature Definition and the regression register.

## 10.2 Milestones
**M5.1 — Acceptance walkthrough.** Walk AC-1 to AC-14 and record evidence; mark any AC that depends on M4.2 as deferred if it is still blocked.
**M5.2 — Copy audit.** Search all new user-facing strings for "missed", "behind", "failed", and "why" prompts. All five Feature Definition copy situations match section 12. Additionally verify that preset prose in `run10k.ts`, `guitar.ts`, and `saas.ts` either matches implemented behavior or has been softened (ND-5 honesty).
**M5.3 — Regression and old goals.** Run R-1 to R-11; confirm planVersion 1 goals behave exactly as before (AC-14).

## 10.3 Exit criteria
Every AC has evidence or a recorded deferral tied to M4.2. No unresolved regressions. Open ND-n items recorded.

---

# 11 — ACCEPTANCE CRITERIA COVERAGE

| AC | Phase / milestone |
|---|---|
| AC-1 Detect missed day | M1.2, M1.3, M3.1 |
| AC-2 Mark missed = same recovery | M2.4 |
| AC-3 Only P1 moves, no longer day | M2.2 |
| AC-4 Never onto test day | M2.2 |
| AC-5 Rest days never missed | M1.2, M3.3 |
| AC-6 Key session swap first | M2.2 (hold, ND-9), M2.4, M3.3 |
| AC-7 10-minute version always counts | M2.0, M2.3, M3.2 |
| AC-8 Late test card | M4.1 |
| AC-9 Unlogged test at week close | M4.2 (blocked) |
| AC-10 Gap gentle-return | M2.2 (no carry, ND-11), M2.3, M3.2 |
| AC-11 Two far_behind weeks re-test | M4.2 (blocked) |
| AC-12 Copy rules | M3.1-M3.4, M5.2 |
| AC-13 High-load dropped | M2.1, M2.2 |
| AC-14 Old goals unchanged | M1.3, M5.3 |

---

# 12 — ROADMAP RISKS

| ID | Risk | Control |
|---|---|---|
| RC-1 | False misses from day boundary. | M1.2 timezone and DST tests; OD-1 resolution. |
| RC-2 | Non-idempotent reconcile duplicates steps. | Idempotency requirement 3.4 and tests. |
| RC-3 | Weekly update not built, blocking AC-9 and AC-11. | Isolate in M4.2; ship the rest. |
| RC-4 | Punitive tone slips in. | Copy audit M5.2 and assertions in P3. |
| RC-5 | Physical goals stacking load. | M2.1 flag and drop rule. |
| RC-6 | Scope creep into pause plan or streaks. | Both explicitly out of scope (OD-3, OD-4). |
| RC-7 | Users' plans change in production before the notice that explains it exists, because merging to `main` deploys. | ND-15 switch, release order 2.4, rule 3.11. |
| RC-8 | A carry is applied twice or lost under concurrent requests. | ND-13 transaction and `carriedFrom` marker; concurrency test in M2.2. |

---

# HANDOFF CONTRACT

The Implementation Prompt consumes **one milestone** from this file, the approved Feature Definition, and the current repository state. It must not reinterpret product direction or invent requirements. Next prompt: **M2.3 (counting rules and signals)**. M4.1 can be drafted at any time.

**Core principle:**
> **Adapt the journey, don't punish the person.**

**Status:** P1, M2.0, M2.1 and M2.2 COMPLETE; M2.3 PROMPT READY
