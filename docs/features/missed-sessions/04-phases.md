# Achivii Missed Sessions — IMPLEMENTATION PHASES
### Detailed roadmap, milestones, dependencies, evidence, and exit criteria

**Status:** READY FOR IMPLEMENTATION PROMPT GENERATION (P1-P3 and M4.1 can start now; M4.2 is blocked, see 2.2)
**Version:** 1.0
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
| F-1 | `backend/src/lib/timezone.ts` already provides IANA validation and zoned day-boundary helpers. | Reuse for OD-1. Do not write new date logic. |
| F-2 | `DailyTask.status` is a free string (default `pending`); the PATCH `/api/goal/tasks/:taskId` route accepts any `status`. Steps live in the `detailedSteps` string and `minimumVersion` is JSON. | A `missed` status and a per-step flag likely need no schema migration. Verify in M1.1. |
| F-3 | `Today.tsx` has a frontend-only `yesterdayUncompleted` callout. Nothing persists or moves. Existing tests assert no "missed", "failed", "behind" wording on Today. | P3 replaces the callout; keep the no-punitive-copy assertions. |
| F-4 | No "mark today missed" or "swap day" implementation was found in frontend or backend. | M2.4 builds them. Plan v2 only decided them. |
| F-5 | `weekPlan.ts` accepts `retestFirst` as an input, but no weekly-update code (status, nextTargets, checkpointOffer) exists in the backend. | M4.2 is blocked on plan v2 build step 4. |
| F-6 | `RoadmapWeek.testResult` and `validateWeeklyTestResult` exist. | Late test logging (M4.1) can build on them. |
| F-7 | Presets `run10k.ts` and `recomp.ts` generate physical steps. | They need the high-load flag in M2.1. |
| F-8 | No streak code exists in the frontend. | OD-4 needs no work. |

---

# 2 — ROADMAP AT A GLANCE

| Phase | Name | Depends on | Backend allowance |
|---|---|---|---|
| P1 | Miss Recognition | Feature Definition | New lib module, wired into active-goal load. No schema migration expected. |
| P2 | Recovery Rules | P1 | Carry-forward, high-load flag, mark-missed and swap actions. |
| P3 | Today Experience | P2 | None beyond response fields P2 exposes. |
| P4 | Test Day & Week Close | P1; M4.2 also needs plan v2 weekly update | Late test logging; week-close handoff. |
| P5 | QA, Copy Audit & Regression | P1-P4 | None. |

All phases begin **NOT STARTED**.

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
Recognition comes first because every rule needs a trustworthy "was this day missed" answer. Rules are built before UI so the UI reads decided state instead of inventing it. The test day work is split so the part that does not need the weekly update can ship.

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

**Status:** NOT STARTED

## 6.1 Source
Feature Definition RULE-5, RULE-8 (detection part), OD-1, AC-1, AC-5, AC-14. Findings F-1, F-2.

## 6.2 Objective
Reliably decide, on app open, which past practice days of the active plan v2 goal were missed, using the user's timezone and sleep time, and persist that decision idempotently.

## 6.3 In scope
- Day-close calculation (OD-1) using `timezone.ts`.
- Classification of each past day: done, missed, rest (never missed), planned.
- Detection of a gap (3+ missed practice days in a row).
- Idempotent reconcile on active-goal load that marks closed, uncompleted practice days as `missed`.

## 6.4 Out of scope
- Moving or changing any step (P2).
- UI (P3).
- Weekly status or the weekly update (P4).
- Push notifications.

## 6.5 Backend allowance
New pure-logic module plus a call from the active-goal path. A new `missed` value for `DailyTask.status` is expected to need no migration (F-2); verify in M1.1. A migration requires a narrow explicit decision (ND-n).

## 6.6 Files likely affected (verify first)
`backend/src/lib/timezone.ts` (reuse only), a new lib module, `backend/src/routes/goal.ts` (active-goal route), `backend/test/`.

## 6.7 Milestones

**M1.1 — Repository verification.** Confirm where `sleepTime` and timezone are stored (`Goal.routine`, request, or user), what `status` values exist and who reads them, how `yesterdayUncompleted` is derived, how the active-goal route builds tasks, and which test commands exist. Output: evidence note and any ND-n. No code.

**M1.2 — Day-close and classification.** Pure functions: day-close time, task classification, gap detection. Unit tests for: late-evening sessions not marked missed, timezone offsets and DST, travel across zones, rest days never missed, 04:00 cap, a partial day (any step or the 10-minute version) counts as done.

**M1.3 — Idempotent reconcile on load.** Run classification on active-goal load for `planVersion: 2` only, persist `missed`, and expose it in the response. Running twice changes nothing. Old goals untouched.

## 6.8 Regression checks
R-1, R-2, R-3, R-7, R-9.

## 6.9 Exit criteria
AC-1, AC-5, AC-14 are demonstrably true at the logic and API level. Reconcile is idempotent. Evidence EV-1: tests for each case in M1.2. EV-2: before/after API response for a goal with a closed unfinished day.

## 6.10 Risks
Wrong day boundary causes false misses (Feature Definition R-1). Mitigation: M1.2 tests, timezone fallback to UTC only when no timezone is known, and a conservative reading when `sleepTime` is missing.

---

# 7 — P2 RECOVERY RULES

**Status:** NOT STARTED

## 7.1 Source
RULE-1, RULE-2, RULE-3, RULE-4, RULE-6 (data part), RULE-8 (data part), RULE-10, OD-2, OD-5, AC-2, AC-3, AC-4, AC-7, AC-13. Findings F-2, F-4, F-7.

## 7.2 Objective
Apply the carry-forward and drop rules in code so a miss moves at most one priority-1 step, never lengthens a day, never touches the test day, and never carries a high-load step.

## 7.3 In scope
- High-load per-step flag (OD-5), set for plan v2 week calls and for `run10k` and `recomp` presets.
- Carry-forward: priority-1 step replaces the lowest-priority step on the next eligible day; drop when none, or when high-load.
- The 10-minute version counts as done; a key session done only by the 10-minute version is not "key done".
- Record key-session-skipped and missed counts for later weekly use.
- "Mark today missed" and "swap day" actions, if absent (F-4), producing the same recovery as automatic detection.
- Signals for the UI: carried, dropped, short-on-time (2 misses in a week), gentle-return (after a gap).

## 7.4 Out of scope
UI, weekly status, model prompts beyond adding the flag to the week-call schema, pause plan (OD-3).

## 7.5 Backend allowance
Step schema addition in `detailedSteps` JSON (no migration expected). Two small actions on the goal router.

## 7.6 Files likely affected (verify first)
`backend/src/lib/ai/weekPlan.ts`, `taskRules.ts`, `planSchema.ts`, `ai/presets/run10k.ts`, `ai/presets/recomp.ts`, `backend/src/routes/goal.ts`, new recovery lib module, `backend/test/`.

## 7.7 Milestones

**M2.1 — High-load step flag.** Add the per-step flag to the step schema and validation; set it for physical preset steps and allow the week call to set it. Existing plans without the flag are treated as normal.

**M2.2 — Carry-forward algorithm.** Pure function with tests for: next eligible day exists, day before test day (drop), multiple missed days before one eligible day (only one carry), P1 step already done (no carry), high-load (drop), receiving day minutes never increase, idempotent on repeat.

**M2.3 — Counting rules and signals.** 10-minute version counts as done, key-session rule per OD-2, short-on-time and gentle-return signals, key-skipped and missed counts recorded.

**M2.4 — Mark missed and swap actions.** Verify absence first. Mark missed runs the same recovery as detection. Swap exchanges two days within the week and respects test-day and key-session placement rules (key sessions never on the test day).

## 7.8 Regression checks
R-2, R-4, R-6, R-7, R-8.

## 7.9 Exit criteria
AC-2, AC-3, AC-4, AC-7, AC-13 are true at the logic and API level. A property-style test proves no day exceeds its planned minutes. Evidence EV-3: test list per M2.2 case. EV-4: a week fixture before and after a miss.

## 7.10 Risks
Duplicate or lost steps on repeated reconcile (idempotency test). Preset steps without the flag stacking physical load (M2.1 covers `run10k` and `recomp`; list any other physical presets found).

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
None, beyond fields P2 already exposes.

## 8.6 Files likely affected (verify first)
`frontend/src/components/today/Today.tsx` and `Today.test.tsx`, `frontend/src/components/focus/*`, `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`, `frontend/e2e/todayStates.spec.ts`.

## 8.7 Milestones

**M3.1 — Miss notice.** Replace the `yesterdayUncompleted` callout with the real carried or dropped notice. Copy from Feature Definition section 12.

**M3.2 — Short-on-time and gentle-return.** UX-2 and UX-4, with the 10-minute version reachable in two taps or fewer.

**M3.3 — Key-session swap and mark-missed UI.** Swap offered before carry-forward for a missed key session. Rest days never show a miss message.

**M3.4 — State coverage and accessibility.** Loading, error, offline, rest, key, test, review-due, and completed states still correct; axe and overflow checks at the existing widths.

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

**M4.1 — Late test card (ready).** A "Take the test now" card on Today from the end of test day until the next week opens, built on the existing weekly test result logging. After the window, the card is gone.

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
**M5.2 — Copy audit.** Search all new user-facing strings for "missed", "behind", "failed", and "why" prompts. All five Feature Definition copy situations match section 12.
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
| AC-6 Key session swap first | M2.4, M3.3 |
| AC-7 10-minute version always counts | M2.3, M3.2 |
| AC-8 Late test card | M4.1 |
| AC-9 Unlogged test at week close | M4.2 (blocked) |
| AC-10 Gap gentle-return | M2.3, M3.2 |
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

---

# HANDOFF CONTRACT

The Implementation Prompt consumes **one milestone** from this file, the approved Feature Definition, and the current repository state. It must not reinterpret product direction or invent requirements. Recommended first prompt: **M1.1 (repository verification)**, because it settles where `sleepTime`, timezone, and task status are stored before any code is written.

**Core principle:**
> **Adapt the journey, don't punish the person.**

**Status:** READY FOR IMPLEMENTATION PROMPT GENERATION
