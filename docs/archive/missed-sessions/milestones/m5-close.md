# Missed Sessions — M5 Acceptance, Copy Audit, Regression and Close

**Milestone:** P5 / M5.1-M5.3
**Date:** 2026-10-08
**Status:** COMPLETE
**Prompt:** docs/archive/missed-sessions/05-prompts.md, M5 (commit `27652bb`)
**Branch:** `m5-close-missed-sessions` (not merged; no PR)

## 1. Summary

- **Acceptance (M5.1).** AC-1 to AC-8, AC-10, AC-12 and AC-13 each have unit and browser (or API) evidence (section 2). AC-9 and AC-11 moved to the weekly-update feature with M4.2 (ND-19). AC-14 is retired by docs/decisions.md ND-21. No AC failed, and none needed a new test except AC-12, which gained a guard on the preset prose.
- **Copy (M5.2).** The missed-sessions screens (Today, the Dashboard, the plan actions, the late-test card) already follow the copy rules. Five strings changed (section 3): the three preset adherence sentences, which promised a "weekend buffer" the app does not have and said "missed", and two marketing lines ("A missed day is information, not failure."). Strings outside the missed-sessions surface are listed, not changed (section 3.3).
- **Honest preset prose (R3).** guitar and saas now say what carry-forward really does. run10k says nothing piles up, because every run10k step is high-load and is dropped, never carried (RULE-10). "Never two rest days in a row" is true for every plan variant (section 3.2), so it stays.
- **Accessibility (R3b).** The `text-text-muted` labels on the Achievement "Your Results" tab failed axe contrast, as M3.4 predicted: 13 violations when a browser test reaches the tab with a recorded final test. They now use `text-text-secondary`, and a new case checks the tab at four widths.
- **Regression (M5.3).** R-1 to R-11 pass or are recorded (section 5). R-7 is retired with AC-14.
- **Closed and archived (R5).** Every phase status is updated. M4.2 moved to `docs/features/weekly-update/01-problem.md` with its scope. This folder moved from `docs/features/missed-sessions/` with `git mv`, and every path to it was updated. `git grep -n "features/missed-sessions"` finds nothing outside this folder.

## 2. Acceptance walkthrough (M5.1)

Unit files are under `backend/test` or `frontend/src`. Browser specs are under `frontend/e2e` and run on both projects. Reports are in this folder's `milestones/`.

| AC | Status | Evidence |
|---|---|---|
| AC-1 A day that closes with nothing done is recognised on the next open | Met | `missedSessions.test.ts` › classifyDays › "handles a late-evening session: open until the close, missed from the close…", the `dayCloseInstant` cases (DST, 04:00 cap, missing timezone); `reconcile.test.ts` (EV-2: the same day `planned` at 00:40 and `missed` at 01:00, m1.3 section 4); `GoalContext.test.tsx` › "on a new date, a visibility event runs reconcile, then the goal, once" (a tab left open overnight); browser: `todayStates` › "miss notice (M3.1)…" |
| AC-2 Marking today missed applies the same recovery | Met | `missedActions.test.ts` › mark today missed › "carries today at once: one guarded write…", "holds a key session for a swap offer…", "drops today when the rules say so (no_receiving_day / high_load / does_not_fit / receiving_day_done / in_gap)": the same planner as automatic detection (m2.4 R2); browser: `missedSessions` › "setting today aside (carried)", "setting today aside, dropped", "a swap offer for a key session set aside today…" |
| AC-3 Only the priority-1 step moves; the receiving day gets no longer | Met | `carryForward.test.ts` › "carries a missed day onto the next practice day (AC-3)", the `fitCarriedStep` cases ("can leave the day shorter than before, never longer", "never removes a test step… or the priority-1 step"), invariants › "never lengthens a day, carries at most once per receiving day, and replanning adds nothing"; `reconcileCarry.test.ts` › "two concurrent calls…" |
| AC-4 Nothing is carried onto the test day | Met | `carryForward.test.ts` › "drops the day before the test day: nothing lands on the test day (AC-4)", "drops a missed test day…"; swap refuses `test_day` (`missedActions.test.ts`); browser: `missedSessions` › "swapping with another day" (the test day is not listed) |
| AC-5 Rest days never show a miss message | Met | `missedSessions.test.ts` › "never calls a rest day missed or done (RULE-5, AC-5)"; `missedSignals.test.ts` › signals: rest days (AC-5); `Today.test.tsx` › miss notice › "shows nothing on a rest day", "nothing on a rest day" (M3.3); browser: `todayStates` › "rest day…" and the M3.4 matrix › rest day |
| AC-6 A key session miss offers a swap before carry-forward | Met | `carryForward.test.ts` › key sessions (ND-9) › "holds a missed key session while its receiving day is open…", "drops it as swap_unanswered once the receiving day closes unanswered"; `missedSignals.test.ts` › signals: swap offer; `Today.test.tsx` › swap offer (6 cases); browser: `missedSessions` › "a swap offer answered by \"Swap the days\"", "a swap offer whose answer fails…" |
| AC-7 The 10-minute version is on every practice day and counts as done | Met | `weekPlan.test.ts` › "asks for a minimum version, and derives a 10-minute one on the last attempt"; `taskUpdate.test.ts` › "stores true for a minimum completion…"; `writeNextWeekKeySessions.test.ts` › "a non-key 10-minute completion still counts in done (RULE-4, AC-7)…"; `missedSignals.test.ts` › weekCounts; browser: `today` › "the 10-minute version is offered closed by default…", `focus` › "completing the 10-minute version records usedMinimumVersion…", `missedSessions` › gentle-return and short-on-time cases |
| AC-8 An unlogged test shows a late-test card until the week closes | Met | `lateTestResult.test.ts` (endpoint and review, 12 cases); `LateTestCard.test.tsx` (9); browser: `lateTest` (3 cases) and the M3.4 matrix › late-test card. The window ends at the review, which is what closes the week today (m4.1 section 7, item 3). |
| AC-9 An unlogged test at week close runs the weekly update with the target held | **Moved to the weekly-update feature (ND-19)** | Needs plan v2's weekly update (prompt 4), which does not exist. Scope recorded in `docs/features/weekly-update/01-problem.md`. |
| AC-10 After 3+ missed days in a row, the next session defaults to the 10-minute version | Met | `missedSessions.test.ts` › findOpenGap (threshold 3, rest days, week boundary); `carryForward.test.ts` › "carries nothing from an open gap (ND-11)"; `missedSignals.test.ts` › signals: gentleReturn; `Today.test.tsx` › "gentle-return day: …" (3); browser: `missedSessions` › "gentle-return day: the 10-minute version is the default, the full session one tap away" |
| AC-11 Two far_behind weeks start with a re-test and the daily-time check | **Moved to the weekly-update feature (ND-19)** | `weekPlan.ts` accepts `retestFirst` ("asks for a re-test first when the last two weeks were weak"), but nothing computes far_behind yet. Scope recorded with M4.2. |
| AC-12 Copy never uses "missed", "behind", "failed", or asks why | Met | Whole-page assertions in `Today.test.tsx`, `Dashboard.test.tsx`, `LateTestCard.test.tsx`, and every miss state in `missedSessions.spec.ts`, `todayStates.spec.ts` and `lateTest.spec.ts` (`CALM`); new `presetAdherenceCopy.test.ts` (3 cases) for the preset prose; section 3 audit |
| AC-13 High-load steps are dropped, not carried | Met | `carryForward.test.ts` › "drops a high-load step (RULE-10, AC-13)", "drops any step of a run10k goal, even stored without the flag (M2.1)"; `highLoad.test.ts`; `missedActions.test.ts` › "drops today when the rules say so (high_load)…" |
| AC-14 Old goals behave exactly as before | **Retired by ND-21** | Plan v1 is retired; its goals are deleted by the owner (section 7) and its code removed in a separate change. The v1 guards still pass today (`reconcileCarry.test.ts` › "old (plan v1) goals stay untouched…", `missedActions.test.ts` › "old (plan v1) goals answer not_plan_v2…"), but they are not evidence for a requirement that no longer applies. |

**Feature Definition section 12, the five situations:**

| Situation | What the app says | Match |
|---|---|---|
| Carried step | "Yesterday's session didn't happen. We moved its most important step into today, so today stays the same length." (or "…to {Weekday}, so that day stays the same length."; on the Dashboard "Yesterday's most important step is part of today's session.") | Yes, with "its" for "the" and the day named (M3.1) |
| Short on time | "The 10-minute version still counts toward this week." | Verbatim (M3.2) |
| Test not logged | Not shown: it belongs to the week-close handoff. The late-test card says "This week's test is still open. Take it when you can. Your result goes into this week's review." (M4.1) | Moved with M4.2 |
| Return after a gap | "Welcome back. Today's a short one to ease in." | Verbatim (M3.2) |
| Two weak weeks | Not shown | Moved with M4.2 |

## 3. Copy audit (M5.2)

Searched: every non-test `.ts`/`.tsx` string under `frontend/src`, the preset prose in `backend/src/lib/ai/presets/*.ts`, the recorded onboarding fixtures, and every backend message a user can receive (`backend/src/routes/goal.ts`, including `ACTION_ERRORS`). Patterns: `missed`, `behind`, `fail`, `why`, plus status labels (`far_behind`, `a_bit_behind`), `buffer` and `streak`.

### 3.1 Changed (missed-sessions surface)

| File | Before | After |
|---|---|---|
| `backend/src/lib/ai/presets/run10k.ts` (adherence) | "Sessions fit around work, commute, and family. Missed Tuesday? It shifts automatically into an open weekend buffer. Never two rest days in a row." | "Sessions fit around work, commute, and family. If a run doesn't happen, nothing piles up: there is no catching up, and no day gets longer. Never two rest days in a row." |
| `backend/src/lib/ai/presets/guitar.ts` (adherence) | "…Short daily sessions fit around work, and missed days slide into weekend buffers without streak guilt." | "…Short daily sessions fit around work. If a day doesn't happen, its most important step moves to your next practice day if it fits, and no day gets longer." |
| `backend/src/lib/ai/presets/saas.ts` (adherence) | "…45-minute daily sprints fit around work and family, while missed sessions shift seamlessly into weekend buffers without streak shame." | "…45-minute daily sprints fit around work and family. If a day doesn't happen, its most important step moves to your next practice day if it fits, and no day gets longer." |
| `frontend/e2e/fixtures/onboarding/clarify-run10k.json` | the run10k sentence above (a recorded clarify response) | the new run10k sentence, so the fixture matches what the server sends |
| `frontend/src/components/marketing/sections/Faq.tsx` | "A missed day is information, not failure. Every week closes…" | "A day that doesn't happen is information, not a verdict. Every week closes…" |
| `frontend/src/components/marketing/sections/Product.tsx` | "A missed day is information, not failure. Each week is rewritten…" | "A day that doesn't happen is information, not a verdict. Each week is rewritten…" |

The preset sentences are shown during onboarding (`EvidenceTriad`, from the clarify response); `frontend/src/lib/certifiedPresets.ts` does not mirror them. Each kept promise was checked:
- "If it fits" and "no day gets longer" are the fit rule (ND-10).
- run10k is a high-load preset (M2.1), so its steps are always dropped (RULE-10); "moves to your next practice day" would be false there.
- "streak guilt" / "streak shame" were dropped: there are no streaks (OD-4), so the phrase described nothing.

### 3.2 "Never two rest days in a row" (run10k)

`restDayIndices` (`backend/src/lib/ai/weekPlan.ts`) puts rest on days 4 and 7 (`steady`), 3, 5 and 7 (`minimal`) or 7 (`accelerated`). No two are adjacent within a week, and every week's day 1 is a practice day, so a week's day 7 never meets the next week's rest. Setting a day aside never turns it into a rest day. The claim is true; kept.

### 3.3 Found outside the missed-sessions surface (listed, not changed)

| Where | String | Why it is listed |
|---|---|---|
| run10k, guitar, saas, spanish presets, `socialAdherence.coreRule` | "… + Zero-Guilt Buffers." | Names a buffer mechanism the app does not have. It is a pillar title, not a sentence about misses, so renaming it is a product decision. **Owner's call.** |
| `book.ts`, adherence | "…hitting 500 words before 9:00 AM makes failure impossible." | Writing-habit copy, not about misses |
| `recomp.ts`, week 12 test | "…log every lift working weight with zero missed workouts…" | A fitness test criterion, not a miss message; would need the preset owner's wording |
| `chess.ts` | "Missed Puzzle Post-Mortem & Notation", "missed a basic tactic", "Missed pin/fork", "For any failed puzzle…find why your candidate move failed" | Chess vocabulary inside practice steps |
| `guitar.ts` | "Focusing on missed notes instead of continuous forward momentum." | Music vocabulary in a step's pitfall |
| `book.ts`, `recomp.ts` onboarding questions | "What has been your primary obstacle or failure point in past … attempts?" | Onboarding questions about past attempts, not a miss |
| Other presets | "failure", "fail", "behind" (thumb behind the neck, shadowing behind audio), "why" inside step instructions | Domain vocabulary |
| `Method.tsx` (marketing) | "Big goals fail in the gap between the dream and today." | General marketing, not about missed days |
| `LegalPage.tsx` | "Failed payments", "If a renewal payment fails…" | Billing terms |
| `ResetPlanDialog.tsx` | "We couldn't reset your plan. Please try again." | Clean; listed because it was matched by `fail` in code |

No status labels (`far_behind`, `a_bit_behind`) are shown anywhere in the frontend. Backend error messages for the missed-sessions endpoints ("This day has already been changed.", "This action is not available yet.", "This week has already been reviewed.", and so on) follow the rules, and the frontend never shows them: plan actions say "That didn't change. Please try again.", and the late-test card says "That didn't save. Please try again.".

## 4. Accessibility carry-over (R3b)

`frontend/src/components/achievement/AchievementResults.tsx`: the metric labels, "Target Deliverable", "Pass Criteria", each benchmark's "Week N", "Target:", "Recorded:" and the "No test recorded" pill used `text-text-muted`. They now use `text-text-secondary`, as M3.4 did on the closing stretch and `AchievementHero.tsx`.

The large "/{total}" figure and the "·" separator are left as they are: axe passes them (large text, and punctuation).

New browser case: `todayStates.spec.ts` › M3.4 matrix › "completed goal, results tab". It opens "Your Results" on a completed goal with a recorded week-12 test, one recorded week and one week without a result. It checks overflow and axe at 360, 375, 390 and 412 px. Without the fix it reports 13 `color-contrast` violations; with it, it passes on desktop and mobile.

## 5. Regression (M5.3)

| ID | Capability | How checked | Result |
|---|---|---|---|
| R-1 | Auth and goal loading | `GoalContext.test.tsx`, `Home.test.tsx`; browser: `todayStates` › goal load failure, M3.4 matrix › loading, load error | Pass |
| R-2 | Task completion | `Today.test.tsx` (Complete through the write path), `taskUpdate.test.ts`; browser: `today` › completion and failed-write cases | Pass |
| R-3 | Today states | browser: M3.4 matrix (rest, key, test, review due, completed goal, offline, load error, and more) | Pass |
| R-4 | Focus session and 10-minute version | `FocusSessionModal.test.tsx`; browser: `focus` (all) | Pass |
| R-5 | Weekly review | `Today.test.tsx` review cases, `WeeklyReviewModal.test.tsx`; browser: `weeklyReview` (all) | Pass |
| R-6 | Week plan generation | `weekPlan.test.ts` (backend suite) | Pass |
| R-7 | Old goals (plan v1) | Retired with AC-14 (ND-21). The v1 guards in the backend suite still pass today. | Retired |
| R-8 | Presets | `presetMatch.test.ts`, `highLoad.test.ts`, `clarify.test.ts`, new `presetAdherenceCopy.test.ts`; browser: `onboarding`, `onboardingStates` (recorded run10k clarify fixture) | Pass |
| R-9 | Timezone | `timezone.test.ts`, `goalStartDates.test.ts`, `missedSessions.test.ts` | Pass |
| R-10 | No punitive copy | every existing assertion (AC-12 row) plus the preset guard | Pass |
| R-11 | Accessibility and responsive | browser: the M3.4 matrix and every miss state at 360-412 px, the keyboard walk, reduced motion, and the new results-tab case | Pass |

**Production-only checks.** The M3.3 release checklist (m3.3 section 8) covers turning the switch on: automatic carry, the three actions, a stale page, a double click and the copy. 04-phases.md records the switch as ON in production. No results from running the checklist are recorded in the repository, so its outcome is **not recorded**; the owner should confirm steps 4-8 and 11-19 there.

## 6. Commands and results

| Command | Result |
|---|---|
| `cd backend && npx vitest run test/presetAdherenceCopy.test.ts` | 3 passed |
| `cd backend && npm test` | **48 files / 434 passed** (baseline 47 / 431, plus the new copy test) |
| `cd backend && npm run typecheck` | pass |
| `cd frontend && npm test` | **575 passed**, 0 failures (baseline 575) |
| `cd frontend && npm run typecheck` | pass |
| `cd frontend && npm run lint` | 0 errors, 2 warnings (baseline) |
| `cd frontend && npm run build` | pass |
| `npm run e2e -- <the six Today specs> e2e/onboarding.spec.ts e2e/onboardingStates.spec.ts` | **219 passed** (17.2m), 0 failed, both projects |
| `git grep -n "features/missed-sessions"` | no hits outside `docs/archive/missed-sessions/` |

## 7. Decisions, discrepancies and open items

- **Where M4.2 lives.** No weekly-update feature folder existed. I created `docs/features/weekly-update/01-problem.md` as a handover stub: the M4.2 scope, the two section 12 lines it owns, and the inputs already built (`weekCounts`, the late test). Its full problem definition is still to be written. The archived 04-phases.md M4.2 entry links to it.
- **No decision changed**, so `docs/decisions.md` is untouched. ND-19 stays in 04-phases.md; ND-21 is unchanged.
- **Plan v1 data (ND-21).** ND-21 says the owner deletes the remaining v1 goals with "SQL in the missed-sessions closing notes". No SQL was in the repository, so here it is. This milestone did not run it. Run it against the production database after a backup:

  ```sql
  -- How many plan v1 goals exist (expected: only test data).
  SELECT count(*) FROM "goals" WHERE "planVersion" = 1;
  -- Their roadmap_weeks, daily_tasks and weekly_reviews are removed by ON DELETE CASCADE.
  DELETE FROM "goals" WHERE "planVersion" = 1;
  ```

- **run10k wording.** The prompt's example sentence ("its most important step moves to your next practice day") is untrue for run10k, whose steps are high-load and always dropped, so run10k got its own true sentence.
- **Marketing lines.** "A missed day is information, not failure." is marketing copy that describes missed days, which the prompt lists for inspection. It was changed as part of the missed-sessions surface. The rest of each line ("Each week is rewritten from what actually happened", "the next week is written from what you actually did") is true for plan v2.
- **Open from earlier milestones, unchanged here:**
  - M3.2 item 1: full-session minutes shown beside "a short one".
  - M3.2/M3.3: `Design.md` section 6 does not yet describe the 10-minute default and the swap actions.
  - M4.1 item 4: "Clear benchmark entry" in the review cannot remove a result logged late.
  - The "Zero-Guilt Buffers" pillar titles (section 3.3).
- **Parallel work.** I did not edit `goalDecomposer.ts` or any v1 code path. The only backend source edits are the three preset strings and three doc-path comments (`carryForward.ts`, `missedSessions.ts`, `missedSignals.ts`).

## 8. CI and `git status`

CI: see the commit message and the branch's Actions runs; every job (backend, frontend, e2e) must be green before merge.

`git status` before commit: only this milestone's files, plus `frontend/shot4.mjs` (untracked before this work, not part of it).
