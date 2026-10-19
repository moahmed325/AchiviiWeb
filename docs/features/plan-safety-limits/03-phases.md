# Plan Safety Limits — Phases

**Status:** IN PROGRESS
**Feature:** docs/features/plan-safety-limits/02-feature.md
**Decisions:** docs/features/plan-safety-limits/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | READY | [m1.1](milestones/m1.1-check-the-code.md) |
| O1 | Mo: run a read-only query on production that counts run10k and recomp roadmaps by week 1 target metric and unit (the query is written in M1.1's report) | — | NOT STARTED | |
| M1.2 | The limits module, target families and safe steps at roadmap time | AC-1, AC-2, AC-3 (server), AC-10 (targets), AC-11 | NOT STARTED | |
| M1.3 | Older goals on read, and the honest week 12 line | AC-3 (screen), AC-9 | NOT STARTED | |
| M2.1 | High-load steps carry their load | AC-4 | NOT STARTED | |
| M2.2 | Week limits, base week and first week back | AC-5, AC-6, AC-7, AC-10 (weeks) | NOT STARTED | |
| O2 | Mo: after M2.2 is live, read a week of `[Safety]` lines and note false alarms and failed weeks (`01-brief.md` section 9, question 9) | — | NOT STARTED | |
| M3.1 | Acceptance, regression and close | AC-8, all | NOT STARTED | |

## 2. Order
- **P1 Targets:** limits in one module; the 12 targets climb by safe steps, for new goals and older ones. Needs O1's numbers only to check the family rules against real data, not to start M1.2.
- **P2 Weeks:** steps carry their load and each week is checked against the one before. Needs P1 (the module).
- **P3 Close:** prove every AC, retire the old clamps, sort every problem. Needs P2 and O2.

Weekly-update M3.1 (RULE-10, WU-23, WU-29) waits for this feature's P2.

## 3. Rules for this feature
- `backend/src/lib/planV2.ts` and `backend/src/routes/goal.ts` are shared with weekly-update: a milestone here that touches either starts only when no weekly-update milestone has an open branch in it, and its prompt names the weekly-update state it was written against.
- Nothing stored is ever rewritten for an older goal (RULE-9); new goals store lowered targets (`02-feature.md` section 7).
- The week prompt for a goal that is not physical stays byte-for-byte unchanged; for a physical goal it changes only on purpose, in M2.1.
- No switch: the limits are always on (PSL-4). A milestone ships only with its tests green.
- B-63's scan stays until M3.1 decides what of it the load checks replace (RULE-8).

## 4. Must not break
| ID | What | How to check |
|---|---|---|
| R-1 | The week call's checks and prompt fixture | `weekPlan.test.ts` (fixture `weekPrompt.before-m2.1.txt`), `taskRules.test.ts`, `highLoad.test.ts`, `highLoadCallers.test.ts` |
| R-2 | Honest 503s with nothing saved | `goalCreateNoV1Fallback.test.ts`, the review route's 503 tests |
| R-3 | Method-aware recovery: rest gaps, easy line, handoff | `methodOrderGap.test.ts`, `methodActions.test.ts`, `methodHandoff.test.ts`, `methodReconcile.test.ts` |
| R-4 | Carry-forward never makes a day longer | `carryForward.test.ts`, `reconcile.test.ts` |
| R-5 | The stated-target rule for goals without a family | `roadmap.test.ts`, the `statedTarget` tests |
| R-6 | B-63's stopgap | `weekPlanSafety.test.ts` |
| R-7 | Goal create for every pathway and a custom goal | `presetMatch.test.ts`, `e2e/generation.spec.ts` |

## 5. Phases

### P1 Targets
**Goal:** code, not the model, decides how fast a number target may climb.

**M1.1 Check the code.** Facts, as tables with file paths: where targets are written and read (roadmap, `presentGoal`, the week input, the journey and roadmap views); how a week's planned and done steps can be read back per goal (task status, stored steps); the metrics and units the roadmap model writes for physical goals (from tests and fixtures), and the read-only query O1 runs to count them in production; where week 12's target shows on screen; what of `safetyClamps.ts` and its tests is still used. Questions for Mo where the code disagrees with `02-feature.md`. Done when the report answers each and the plan is fixed in place.

**M1.2 The limits module.** One module holds every number in PSL-4 and the target families; a function gives the next safe step for a target; the roadmap check lowers breaching targets and re-checks later weeks (RULE-2), and week 12 below a stated number is accepted at the highest safe step (RULE-3); each lowered target logs `[Safety]`. Covers AC-1, AC-2, AC-3 (server), AC-10 (targets), AC-11 (the function). Checks R-5, R-6, R-7. Done when tests show each family lowered at one step past the limit and left alone at it.

**M1.3 Older goals and the honest line.** Older goals' targets are lowered on read for the week writer and the plan views, stored data unchanged (RULE-9); the week 12 line from section 6 shows where week 12's target shows. Touches `planV2.ts` and `routes/goal.ts` (section 3). Covers AC-3 (screen), AC-9. Checks R-1, R-2, R-7. Done when a stored over-steep goal shows lowered targets and an unchanged row, with screenshots of the line on desktop and mobile.

### P2 Weeks
**Goal:** a week's running, lifting and calorie steps stay inside the numbers.

**M2.1 Load on high-load steps.** The week call asks for and stores `load` on high-load steps of physical goals (`02-feature.md` section 7); a missing load is a retry reason, kept on the last attempt with the text scan deciding (RULE-4). Covers AC-4. Checks R-1, R-3, R-6.

**M2.2 Week limits.** The running total against the base week with the allowance, longest run, hard runs, deficit, intake and weeks 1 to 3 lifting (RULE-5); one retry then no week (RULE-6); the first week back held to the last done total (RULE-7); `writeNextWeek` passes last week's planned and done load and the goal id (B-64). Covers AC-5, AC-6, AC-7, AC-10 (weeks). Checks R-1 to R-4, R-6.

### P3 Close
**M3.1 Acceptance, regression and close.** Every AC and R row checked; O2's findings sorted; the velocity-table clamps retired (RULE-1) and what of B-63's scan stays decided (RULE-8); CLAUDE.md step 6 rewritten; every problem from the reports in a milestone or `docs/backlog.md`. Covers AC-8 and all.

## 6. Risks
- **More failed weeks.** Hard limits on model output mean more retries and some 503s, most likely on recomp. Controlled by narrow checks, the retry reason naming the number, and O2's log read before close.
- **Families misread.** A target read as the wrong family gets the wrong limit. Controlled by O1's sample and the `unknown_family` log line (no family means no limit, never a refusal).
- **Shared files.** `planV2.ts` and `routes/goal.ts` are busy with weekly-update. Controlled by section 3's rule.
