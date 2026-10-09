# Achivii Method-Aware Recovery — Phases

**Status:** IN PROGRESS
**Feature:** docs/features/method-aware-recovery/02-feature.md
**Decisions:** docs/features/method-aware-recovery/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | DONE 2026-10-08 | [m1.1](milestones/m1.1-check-the-code.md) |
| M1.2 | Profile format, checks, templates, pathway profiles, keyword table | AC-1 (pathways), AC-4 (profile side) | DONE 2026-10-09 | [m1.2](milestones/m1.2-profiles-and-templates.md) |
| M1.3a | Profiles stored at creation and for older goals (no model call) | AC-1 | DONE 2026-10-09 | [m1.3a](milestones/m1.3a-store-profiles.md) |
| M1.3b | The custom profile call (off until the eval passes) | AC-2 | READY | [m1.3b](milestones/m1.3b-profile-call.md) |
| M2.1 | The week call tags every step | AC-3, AC-4 | NOT STARTED | |
| M2.2 | The eval | AC-11 | NOT STARTED | |
| O1 | Mo: agree to switch on custom profiles once M2.2's eval has passed (MR-14) | AC-2 | NOT STARTED | |
| M3.1a | Carry: move, continue, let go, fixed; counts; the switch | AC-5, AC-9, AC-10 | NOT STARTED | |
| M3.1b | Carry: order and rest gaps | AC-6 | NOT STARTED | |
| M3.2 | Swap, set today aside and move now follow the rules | AC-6, AC-8 (server) | NOT STARTED | |
| M3.3 | Today, Dashboard and Focus | AC-7, AC-8 | NOT STARTED | |
| O2 | Mo: turn on `METHOD_RECOVERY_ENABLED` in Render once M3.3 is live, then run the production checks | — | NOT STARTED | |
| M4.1 | Copy honesty, acceptance, regression and close | AC-12, AC-13, all | NOT STARTED | |

## 2. Order
- **P1 Profiles:** every goal has a checked recovery profile. Nothing the person sees changes. M1.3a needs M1.2; M1.3b needs M1.3a.
- **P2 Tagging:** every new step carries a kind, and custom profiles are measured. M2.1 needs M1.3a; M2.2 needs M1.3b and M2.1.
- **P3 Recovery follows the kinds:** needs M2.1. M3.1b needs M3.1a; M3.2 can run alongside M3.1b; M3.3 needs M3.1b and M3.2.
- **P4 Close.** Needs P3. Switching on custom profiles needs M2.2 and Mo.

## 3. Rules for this feature
- **Ship dark.** The new recovery behavior (M3.1a, M3.1b, M3.2) runs only when `METHOD_RECOVERY_ENABLED` is exactly `true`, read per request like `MISSED_SESSIONS_CARRY_ENABLED`. It is unset by default (`sync: false` in `render.yaml`, with a yaml test) and turned on by Mo in the Render dashboard after M3.3 is live. Off: every step follows missed sessions' current rules. Never turn it on from code or tests.
- **Carry writes stay behind `MISSED_SESSIONS_CARRY_ENABLED`** as today (ND-15). Carry off: nothing written, whatever the method switch says.
- **Custom profiles use their keyword-picked template unchanged until the eval passes** (RULE-19, MR-14). M1.3b builds the profile call behind its own switch; it is used only when M2.2 has passed and Mo has agreed.
- **The model never decides recovery** (MR-3): it only writes profiles (custom goals) and tags steps; code decides every action.
- **No silent let go** (MR-5): any code path that meets a step without a valid kind follows RULE-18 (today's behavior), never let go.
- **Prompt changes are visible at once.** M2.1's week-call changes (kinds, warm-ups inside movable steps, game and review as one step) reach new weeks as soon as they merge, before the switch is on. Mo is told when M2.1 merges.

## 4. Must not break
| ID | What | How to check |
|---|---|---|
| R-1 | Missed sessions' carry guarantees: no day longer, no pile-up, test day protected, most recent day wins, nothing from a run of days, guarded writes once | `backend/test/carryForward.test.ts`, `reconcile.test.ts`, `reconcileCarry.test.ts`, `reconcileSignals.test.ts`, `missedSignals.test.ts`, `missedSessions.test.ts` |
| R-2 | Set today aside, swap, move now (carry-now) | `backend/test/missedActions.test.ts`, `frontend/src/lib/api.planActions.test.ts`, `useTaskActions.test.tsx` |
| R-3 | Today states | the CI e2e specs (`.github/workflows/ci.yml`), `missedSessions.spec.ts` |
| R-4 | Focus and the 10-minute version | Focus tests and `e2e/focus.spec.ts` |
| R-5 | Weekly review and the late test | review tests, `writeNextWeekKeySessions.test.ts`, `e2e/weeklyReview.spec.ts`, `e2e/lateTest.spec.ts` |
| R-6 | Goal creation, pathways and custom | `goalCreateNoV1Fallback.test.ts`, `roadmap.test.ts`, `presetMatch.test.ts`, `e2e/generation.spec.ts`, onboarding specs |
| R-7 | The week call's existing checks | `weekPlan.test.ts` (its prompt fixture changes only on purpose, in M2.1), `taskRules.test.ts`, `highLoad.test.ts`, `highLoadCallers.test.ts` |
| R-8 | Pro gating for custom goals | billing and goal-authorization tests |
| R-9 | No forbidden words in copy | copy-guard tests, including `presetAdherenceCopy.test.ts` (changes on purpose in M4.1) |
| R-10 | Accessibility and no overflow | axe and overflow checks in the e2e specs |
| R-11 | The closing stretch | closing-stretch tests and Today e2e |

## 5. Phases

### P1 Profiles
**Goal:** every plan v2 goal gets a recovery profile that passes RULE-4, with no change for the person.

**M1.1 Check the code.** DONE. Its findings became MR-9 to MR-21.

**M1.2 Profile format, checks, templates and pathway profiles.** DONE (`backend/src/lib/recovery/`). Pure code and tests, nothing wired in: the profile type with the return-rule format; the RULE-4 checks; RULE-5's two added kinds; the 13 templates from `reference/domain-templates.md`; the 10 pathway profiles; the keyword table that picks a template (MR-14); the checked reader for a stored profile (MR-9); `actionOf` for a step, including RULE-7's overrides and MR-11. Covers RULE-2, RULE-4, RULE-5, RULE-7 (pure part). Checks R-6, R-7.

**M1.3a Profiles stored at creation and for older goals.** DONE. Pathway goals and custom goals (keyword template) are saved with a profile under `recovery` in `Goal.roadmap`; an older goal gets one just before its next week is written, and a failure never blocks the review (MR-14). No model call. Covers RULE-1, RULE-2. Checks R-5, R-6, R-8.

**M1.3b The custom profile call.** The profile call, its checks, one retry and the template fallback (RULE-3, RULE-4), behind its own switch, off. Checks R-6.

### P2 Tagging
**M2.1 The week call tags every step.** The kind list as a fixed menu, the hard code check and retry (RULE-6, MR-15, MR-16), the overrides (RULE-7), movable steps that stand alone (RULE-8); measures the tag failure rate on sample weeks. Updates the prompt fixture on purpose. Checks R-6, R-7.

**M2.2 The eval.** The 26 goals with hand-written profiles and tagged weeks, a script that scores the profile call and the tagging, and the recorded result against RULE-19.

### P3 Recovery follows the kinds
**M3.1a Carry: move, continue, let go, fixed.** RULE-9 (first later day that passes, MR-10), RULE-10 (continue marker), RULE-11, RULE-12, RULE-17's counts and RULE-18, behind `METHOD_RECOVERY_ENABLED`; the reconcile body says which rules ran. Checks R-1.

**M3.1b Carry: order and rest gaps.** RULE-13's shift in one transaction and RULE-14, with generated-week tests that no day gets longer and no rule is broken. Checks R-1.

**M3.2 Swap, set today aside and move now.** RULE-16 on the server, with the allowed swap days and actions sent in the reconcile body. Checks R-2.

**M3.3 Today, Dashboard and Focus.** Section 6's lines (Today and Dashboard), choices from the server's list, the continue line in Today and Focus. Then Mo turns the switch on. Checks R-3, R-4, R-5, R-9, R-10.

### P4 Close
**M4.1 Copy honesty, acceptance, regression and close.** Pathway and onboarding lines match each profile, including `presetAdherenceCopy.test.ts` (AC-13); `docs/architecture/plan-v2.md` describes profiles and kinds; every AC and R checked; archive the feature. The weekly update then resumes (WU-10).

## 6. Risks
- **Template quality.** A wrong action in a template affects every goal of that domain. Controlled by Mo's approval (MR-8, MR-20), per-template tests in M1.2 and the eval (M2.2).
- **Week call failures from strict tagging**, at goal creation too. Controlled by the fixed menu, the reason sent on retry, and M2.1's measured rate (MR-16: above 2%, Mo revisits).
- **Carry logic growing complex.** Order and rest gaps add cases and a multi-day write. Controlled by pure functions, generated-week tests (AC-6) and the split into M3.1a and M3.1b.
