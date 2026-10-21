# Plan Safety Limits — Phases

**Status:** IN PROGRESS
**Feature:** docs/features/plan-safety-limits/02-feature.md
**Decisions:** docs/features/plan-safety-limits/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | DONE 2026-10-19 | [m1.1](milestones/m1.1-check-the-code.md) |
| O1 | Mo: run a read-only query on production that counts run10k and recomp roadmaps by week 1 target metric and unit (the query is written in M1.1's report) | — | READY: both read-only queries (O1 and B-58) are in M1.1's report, section 5; M1.2 does not wait for the results | [m1.1](milestones/m1.1-check-the-code.md) |
| M1.2 | The limits module, target families and safe steps at roadmap time | AC-1, AC-2, AC-3 (server), AC-10 (targets), AC-11 | DONE 2026-10-20 | [m1.2](milestones/m1.2-limits-module.md) |
| M1.3 | Older goals on read, and the honest week 12 line | AC-3 (screen), AC-9 | DONE 2026-10-20 | [m1.3](milestones/m1.3-older-goals-honest-line.md) |
| M2.1 | High-load steps carry their load | AC-4 | DONE 2026-10-20 | [m2.1](milestones/m2.1-load-on-steps.md) |
| M2.2a | Week limits against the base week | AC-5, AC-6, AC-10 (weeks) | DONE 2026-10-21 | [m2.2a](milestones/m2.2a-week-limits.md) |
| M2.2b | First week back, and the older weeks it reads | AC-7 | DONE 2026-10-21 | [m2.2b](milestones/m2.2b-first-week-back.md) |
| O2 | Mo: after M2.2b is live, read a week of `[Safety]` lines and note false alarms and failed weeks (`01-brief.md` section 9, question 9), plus how often `load_missing` and `[AI] Week n attempt 1 rejected` show on run10k and recomp (M2.1 review), and how often `hard_runs_over_2`, `running_total_over_limit`, `longest_run_over_limit` and `no_base` show and end `failed` or `first_answer` (M2.2a review, PSL-17); `first_week_back_base` lines, and whether a first week back at the 30-minute floor or the half share ends `failed` or a shortened `light_test` (M2.2b review, PSL-18 (8)); a live Gemini check of such a week, as PSL-17's, before or with this read | — | NOT STARTED | |
| M3.1 | Acceptance, regression and close | AC-8, all | NOT STARTED | |

## 2. Order
- **P1 Targets:** limits in one module; the 12 targets climb by safe steps, for new goals and older ones. Needs O1's numbers only to check the family rules against real data, not to start M1.2.
- **P2 Weeks:** steps carry their load and each week is checked against the one before. Needs P1 (the module).
- **P3 Close:** prove every AC, retire the old clamps, sort every problem. Needs P2 and O2.

Weekly-update M3.1 (RULE-10, WU-23, WU-29) waits for this feature's P2 (M2.2a and M2.2b).

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

**M1.2 The limits module.** One module holds every number in PSL-4 and the target families; a function gives the next safe step for a target; the roadmap check lowers breaching targets and re-checks later weeks (RULE-2), and week 12 below a stated number is accepted at the highest safe step (RULE-3); each lowered target logs `[Safety]`. The check runs inside `checkRoadmapAnswer` after the unit is unified, on the model's 12 targets before `withPathwayTests` copies them, with the stated-target and `finalGoal` checks as PSL-11 (Q2); the families as PSL-10; the deficit as PSL-6; no starting point as PSL-11 (Q14); the model's values kept as PSL-11 (Q15). `statedTarget.ts` widened (PSL-5). Covers AC-1, AC-2, AC-3 (server), AC-10 (targets), AC-11 (the function). Checks R-5, R-6, R-7. Done when tests show each family lowered at one step past the limit and left alone at it.

**M1.3 Older goals and the honest line.** Older goals' targets are lowered on read for the week writer and the plan views, stored data unchanged (RULE-9), in `presentGoal` and `writeNextWeek` with the text rebuilt as PSL-7; a stored split-pathway goal is checked on weeks 4, 8 and 12 only (PSL-11, Q1); the screens are PSL-9's; the week 12 line from section 6 shows where week 12's target shows. Touches `planV2.ts` and `routes/goal.ts` (section 3). Covers AC-3 (screen), AC-9. Checks R-1, R-2, R-7. Done when a stored over-steep goal shows lowered targets and an unchanged row, with screenshots of the line on desktop and mobile.

### P2 Weeks
**Goal:** a week's running, lifting and calorie steps stay inside the numbers.

**M2.1 Load on high-load steps.** The week call asks for and stores `load` on high-load steps of physical goals (`02-feature.md` section 7); a missing load is a retry reason, kept on the last attempt with the text scan deciding (RULE-4). Which steps carry load: PSL-8. `load` is added to the parse (`toStep` in `weekPlan.ts`); the two 10-minute-version fallbacks (`weekPlan.ts` and `recovery/dayText.ts`) and the light-week swap must not copy a full step's `load`; when code rescales minutes, `runMinutes` scales too (PSL-11, Q10). Covers AC-4. Checks R-1, R-3, R-6.

**M2.2a Week limits against the base week.** The running total against the base week with the allowance, longest run, hard runs, deficit, intake and weeks 1 to 3 lifting (RULE-5); one retry then no week (RULE-6); `writeNextWeek` passes last week's planned and done running and the goal id (B-64), counted as PSL-11 (Q8, Q9) and PSL-15; the prompt's running line is built from the limits module (PSL-11, Q17). A step with no load, mixed units, rest-day runs and `conditioning` as PSL-15; an unknown base week is no base, never 0; `runKm` is never scaled down (PSL-14). Until M2.2b, a first week back is counted from the closing week like any other. Covers AC-5, AC-6, AC-10 (weeks). Checks R-1 to R-4, R-6.

**M2.2b First week back.** The first week back held to the last done running total (RULE-7), the last week with any running read from older weeks by `goalId`/`weekNumber` (PSL-11, Q13), a week without load as PSL-15 (1), no allowance and a floor as PSL-18. Covers AC-7. Checks R-1 to R-4, R-6.

### P3 Close
**M3.1 Acceptance, regression and close.** Every AC and R row checked; O2's findings sorted; the velocity-table clamps retired (RULE-1; move the live `formatBasisBadge` tests out of `safetyClamps.test.ts` first, M1.1 report) and what of B-63's scan stays decided (RULE-8); CLAUDE.md step 6 rewritten; every problem from the reports in a milestone or `docs/backlog.md`. Covers AC-8 and all.

## 6. Risks
- **More failed weeks.** Hard limits on model output mean more retries and some 503s, most likely on recomp. Controlled by narrow checks, the retry reason naming the number, and O2's log read before close.
- **Families misread.** A target read as the wrong family gets the wrong limit. Controlled by O1's sample and the `unknown_family` log line (no family means no limit, never a refusal).
- **Shared files.** `planV2.ts` and `routes/goal.ts` are busy with weekly-update. Controlled by section 3's rule.
