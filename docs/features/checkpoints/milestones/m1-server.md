# M1 — Server

**Feature:** docs/features/checkpoints/02-feature.md
**Branch:** cp-m1-server
**Prompt written:** 2026-10-24

## Prompt

### Context
Checkpoints are the honest check at the close of weeks 4 and 8 (`02-feature.md`). This milestone builds everything the server decides and stores; M2 builds the screens. Verify these against the code, don't trust this prompt:
- The close: `saveWeekClose` in `backend/src/lib/weekClose/close.ts` (one transaction), `updateThenWrite` and `nextWeekSentence` in `lib/weekClose/update.ts` (also `resultNumber`, `isLogged`, and the week-12 read-modify-write of `Goal.roadmap.loweredTargets`), `weeklyUpdateEnabled()` in `lib/weekClose/switch.ts`, breaks and jumps in `lib/weekClose/breaks.ts`.
- Targets: `safeGoalTargets`, `withTargetText`, `week12LineFor` in `lib/safety/storedTargets.ts`; `nextSafeStep`, `harder`, `targetFamily` in `lib/safety/targetSteps.ts`; limit numbers in `lib/safety/limits.ts`.
- Prompts: the weekly update's in `lib/ai/weeklyUpdate.ts`, the week writer's in `lib/ai/weekPlan.ts` (via `writeNextWeek` in `lib/planV2.ts`).
- The goal response: `presentGoal` in `routes/goal.ts`.

### Goal
With both switches on, a week 4 or 8 close stores an offer when someone is clearly behind (or, at week 8, ahead of a lowered target); the answer route applies it; the goal response sends `checkpoint` and `dayNinetyLine`; with either switch off nothing changes.

### Read first
- `docs/features/checkpoints/02-feature.md`: sections 3, 4 (all rules), 5, 7, 9.
- `docs/features/checkpoints/decisions.md`: the Decision lines of CP-5 to CP-16.
- `docs/features/weekly-update/decisions.md`: WU-15, WU-23 (search by ID).

### Requirements
1. **The check, as pure code.** Progress share, flat-start straight line, forecast with the safe-climb cap, share of the climb, the offered target with RULE-5's rounding, and the outcome (`lower`, `raise`, `line_only`, `on_track`, `none` with its reason), both directions. `CHECKPOINT_BEHIND_PERCENT` (75) and `CHECKPOINT_FLAT_PLAN_PERCENT` (10) in `limits.ts`. (RULE-3 to RULE-6, RULE-10, CP-15, CP-16)
2. **In the close.** Only with `weeklyUpdateEnabled()`, only at the close of week 4 or 8, after the weekly update has decided the targets, inside the close's transaction; none on a break, a jumped week, no result, a light test, an unreadable unit, a deliverable or no starting point. An offer is appended to `Goal.roadmap.checkpoints` (section 7's fields); an open offer is stored as `keep` / `expired` first at any later close. A lost race stores nothing. (RULE-1, RULE-2, RULE-8)
3. **`POST /api/goal/checkpoint`** `{ week, answer: 'keep' | 'accept' }` with section 7's 409s and 400. `accept` changes week 12 and spreads the weeks between (RULE-9: open week unchanged, light weeks follow, `withTargetText`, pathway `finalTest`, `finalGoal` untouched, raise only inside the safe climb); answer and targets in one transaction; the first answer wins. (RULE-8, RULE-9)
4. **Goal response.** `checkpoint` (the open offer) and `dayNinetyLine` (goal = `week12Line`'s goal when there is one), both null with either switch off. (RULE-11, section 7)
5. **Prompt line.** While `dayNinetyLine` is set, both prompts get RULE-12's line, word for word; otherwise byte-for-byte unchanged. (RULE-12)
6. **Logs.** RULE-13's two lines, word for word.
7. **Tests.** AC-3's three worked examples plus a lower-is-better time, body weight, the flat start, the safe-climb cap, a jumped week, each skip reason; rounding for every unit step; expiry; accept for lower, partial raise and full raise (including a light-test goal and a pathway `finalTest`); 409s and the two-answer race; the response fields; the prompt line and the unchanged fixtures; every switch state off stores and sends nothing.

### Out of scope
Any screen or frontend type change (M2). CLAUDE.md and plan-v2 rewrites beyond what this milestone makes wrong (M2 does the full pass).

### Checks
- Must not break: R-1, R-2, R-3, R-5, R-6.
- Run: backend `npm test`, `npm run build`. Measure on your starting commit first.

### Done when
Every requirement has a test, the backend suite and build pass against the baseline, and the report lists the files and evidence.

### Stop if
The code disagrees with `02-feature.md` in a way that changes the work (for example, where the open week's target or week 12's entry is stored), a migration seems needed, or `routes/goal.ts` / `planV2.ts` has an open plan-safety-limits branch.

## Report

**Branch:** cp-m1-server (from main at d510efe). **Stopped on:** nothing. No migration, no new dependency, no open plan-safety-limits branch (psl-m2.1 and psl-m2.2b are merged).

### Checks
| Check | Before (d510efe) | After |
|---|---|---|
| Backend `npm test` | 96 files, 1733 tests, all pass | 98 files, 1813 tests, all pass (+80 new) |
| Backend `npm run build` | clean | clean |

R-1 (`weekCloseR2.test.ts`, the M4.1b matrix tests), R-2 (`targetSteps`, `storedTargets`, weekly update tests), R-3 (`weekPrompt.*.txt` fixtures, `weeklyUpdatePromptPin.test.ts`), R-5 (`week12Line` tests) and R-6 (goal-create tests) all pass unchanged; no existing test was edited.

### Files
- `backend/src/lib/weekClose/checkpoint.ts` (new, pure): the check (`checkpointFor`), RULE-5's steps (`unitStep`, `roundEasier`), RULE-9's spread (`acceptedWeeks`, `spreadIsSafe`), the stored list (`readCheckpoints`, `openCheckpoint`, `expireOpen`), and what the goal response reads (`checkpointViewOf`, `dayNinetyLineOf`).
- `backend/src/lib/weekClose/checkpointClose.ts` (new): `checkpointsAtClose`, the close's decision with every skip reason, and RULE-13's check line.
- `backend/src/lib/ai/dayNinety.ts` (new): the `DayNinetyLine` type and RULE-12's prompt line.
- `backend/src/lib/weekClose/close.ts`: `saveWeekClose` takes `checkpoints`; inside the transaction it expires an open offer first, appends the new offer, writes the roadmap once, and logs only when its close wins.
- `backend/src/routes/goal.ts`: both closes pass `checkpointsAtClose(...)`; `presentGoal` adds `checkpoint` and `dayNinetyLine`; new `POST /api/goal/checkpoint`; new refusal `no_checkpoint`.
- `backend/src/lib/weekClose/update.ts`, `backend/src/lib/planV2.ts`: set `dayNinety` on the weekly update and week writer inputs only while a choice stands.
- `backend/src/lib/ai/weeklyUpdate.ts`, `backend/src/lib/ai/weekPlan.ts`: the line after `Goal:` when `dayNinety` is given.
- `backend/src/lib/ai/roadmap.ts`: `shownAmount` moved here from `update.ts` (now shared).
- `backend/src/lib/safety/limits.ts`: `CHECKPOINT_BEHIND_PERCENT` (75), `CHECKPOINT_FLAT_PLAN_PERCENT` (10).
- Tests: `backend/test/checkpoint.test.ts` (44, pure), `backend/test/checkpointClose.test.ts` (36, through the routes on the in-memory store).
- `docs/architecture/backend-details.md`: one checkpoints paragraph.

### Evidence, by requirement
1. The check: `checkpoint.test.ts`. It covers the three AC-3 examples (on track; 6 km; 6.5 km), a lower-is-better time (29 min), body weight (87.5 kg), no climb, the flat start (straight line 2.4, so 2 km), jumped weeks left out of weeks done (4 km), the safe-climb cap (16 km on plan toward 20), no cap without a family, line only, never on the wrong side of the result, `not_easier`, and rounding for all 15 unit cases. At week 8 it covers a partial raise (9), a full raise capped at the full goal (10), an unsafe spread, under one step, no raise without a week-4 lower, and a second lower.
2. In the close: `checkpointClose.test.ts` "the check in the close". The review and the automatic close both store the offer. On track stores nothing. Line only is stored. Weeks other than 4 and 8 do nothing. Each skip reason is logged: `not_logged`, `unit`, `light_test`, `no_start`, `deliverable`, `break`, `jumped`. A lost close race stores and logs one offer only. Expiry: the next close stores `keep` / `expired`, logged before anything else in that close.
3. `POST /checkpoint`: keep; accept lower (week 12 at 6, weeks 6 to 11 spread, open week 5 and `finalGoal` unchanged, one transaction); a full raise at week 8; two answers at once give one 200 and one 409; a second answer gets 409; no offer for the week and accept on line only get 409; an offer that expired after the goal was loaded gets 409; four bad bodies get 400. The light-test spread, partial and full raise and pathway `finalTest` are in `checkpoint.test.ts` (run10k).
4. Response: the open offer's view; `dayNinetyLine` after an accept; null after keep, after expiry and after a raise to the full goal; `week12Line`'s goal when WU-23 lowered week 12.
5. Prompt line: word for word after `Goal:` in both prompts after an accept. With no choice standing, neither input has the key; the weekly update prompt with the line minus the line equals the prompt without it. The fixture and pin tests are unchanged.
6. Logs: both RULE-13 lines are asserted word for word.
7. Switches: for A, B and D (either switch off), a week-4 close stores nothing and logs nothing; the response sends both null; a stored offer can't be answered (409 `weekly_update_disabled`), is not expired, and no prompt gets the line.

### Decisions I made
1. **Two modules, not one.** `checkpoint.ts` is pure; the close's decision is in `checkpointClose.ts`. Other option: one file. Why: `planV2.ts` needs `dayNinetyLineOf`, and the close decision needs `update.ts`, which imports `planV2.ts`. One file would make an import cycle.
2. **First answer wins by holding the open week's row.** The answer's transaction starts with a no-op conditional update of the open week (`status: 'active'`), then reads the offer again. Other option: a JSON compare-and-swap on `Goal.roadmap`. Why: a close of that week takes the same row first, so an answer and an expiry can never both win, and it needs no raw SQL or new filter.
3. **The close reads the roadmap for checkpoints only when the goal as loaded has an open offer, or the close makes one.** Other option: read on every close with the switches on. Why: goals with no offer then close with exactly the reads and writes they had before (R-1). Only a close can open an offer, so the loaded goal can't miss one; whether it is still open is read inside the transaction.
4. **When rounding easier lands below the result, the offer is the result rounded harder.** Other option: the raw result. Why: it stays a clean number and is never on the wrong side of the result (AC-4).
5. **`share` in the log line is the share of the climb (RULE-4).** Other option: the progress share. Why: it is the number that decides "clearly behind".
6. **The response sends amounts as strings.** `checkpoint.target`, `offered` and `goal`, and `dayNinetyLine`, are formatted with `shownAmount` (no metric label, " or less" for lower-is-better). For lower-is-better, `week12Line`'s goal gets " or less" added. Other option: send numbers and format in the app. Why: CP-14 says code writes the lines, and RULE-7 sets how amounts are shown.
7. **`checkpoint.last` is `week === 8`, also for a raise.** The app picks the raise title from `kind`. For M2: a raise is "up to the full goal" when `offered === goal`.
8. **The `POST /checkpoint` 200 body is `{ week, answer, by, answeredAt }`.** Other option: the whole presented goal. Why: section 7 doesn't set it, and the app refreshes the goal anyway.
9. **Extra `none` reasons:** `not_easier`, `unreadable` (not 12 readable weeks), `already_offered` (guard), and `jumped`, which is logged by the close that jumps week 4 or 8. Other option: no line for a jumped week. Why: AC-2 asks that each skip logs its reason.
10. **Accept spreads the weeks as `safeGoalTargets` reads them** (an older goal's targets lowered on read), and stores only weeks whose value changes. Why: it matches what the person sees.
11. **The raise "passes the safe climb" check reads the spread weeks back with `safeStoredTargets` and needs nothing lowered.** Why: it is the same climb every read uses, so a raise can never be lowered later.

### Problems found
1. **Light-test goals after a week-4 lower.** RULE-9 spreads from the open week's target, and on a light-test goal the open week (5) already shows week 8's old target. So the spread value for week 8 is about its old value, and "never harder" keeps it. The whole drop then lands between week 8 and the new week 12 (example in `checkpoint.test.ts`: 6 to 8 instead of 10). This is safe (only lower), but week 8 is not eased. Anchoring the spread on week 4's target would ease it. That is a product choice, so I didn't change it.
2. **A raise is narrow by design.** The spread from the open week must pass the safe climb, so a week-8 raise can only reach about three safe steps above week 9's target (four on a light-test goal). Most raises will be partial or none. This matches RULE-9 and RULE-10; noting it for expectations.
3. **For M2:** after an accept on a goal that WU-23 lowered, `week12Line` is still sent, with the accepted value and "a safe step" wording, next to `dayNinetyLine`. RULE-11 already says screens show `dayNinetyLine` in its place; M2 must make sure no screen shows both.

### Ideas
None beyond the M2 notes above.

## Review

**Reviewed:** 2026-10-24
**Verdict:** ACCEPTED after fixes made in the review chat.
Checked the diff against `02-feature.md`, reran backend tests (1813 pass) and build, ran code review (high). Fixed on the branch: (1) an accept saved while the next close was between its model call and its transaction was overwritten by the close's stale targets; the close now saves nothing when the open offer was accepted since it loaded the goal (`CheckpointAcceptedError`), both close routes answer their 503, and the retry reads the new targets (test added, fails without the guard); (3) the week-12 entry merge is one helper (`withUpdateEntries`) used by the close and the check. Not changed: (2) the extra `safeGoalTargets` reads only run when the goal has an open offer or an accepted one; (4) on a light-test goal a week-4 lower usually leaves week 8 as it was (RULE-9 as written; Mo: leave it). All nine "Decisions I made" accepted.
**Problems sorted:** the `week12Line` note goes to M2 (screens show only `dayNinetyLine` while it is set, RULE-11).
