# Achivii Method-Aware Recovery — Phases

**Status:** PLANNED
**Feature:** docs/features/method-aware-recovery/02-feature.md
**Decisions:** docs/features/method-aware-recovery/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | NOT STARTED | [m1.1](milestones/m1.1-check-the-code.md) |
| M1.2 | Profile format, checks, templates and pathway profiles | AC-1 (pathways), AC-4 (profile side) | NOT STARTED | |
| M1.3 | Profiles at goal creation | AC-1, AC-2 | NOT STARTED | |
| M2.1 | The week call tags every step | AC-3, AC-4 | NOT STARTED | |
| M2.2 | The eval | AC-11 | NOT STARTED | |
| M3.1 | Carry follows the kinds | AC-5, AC-6, AC-9 (counts), AC-10 | NOT STARTED | |
| M3.2 | Swap, set today aside and move now follow the rules | AC-6, AC-8 (server) | NOT STARTED | |
| M3.3 | Today, Focus, review and progress | AC-7, AC-8, AC-9 | NOT STARTED | |
| M4.1 | Copy honesty, acceptance, regression and close | AC-12, AC-13, all | NOT STARTED | |

## 2. Order
- **P1 Profiles:** every goal has a checked recovery profile. Nothing the person sees changes.
- **P2 Tagging:** every new step carries a kind, and custom profiles are measured. Needs P1.
- **P3 Recovery follows the kinds:** carry, swap, set aside and move now act on kinds, and the screens say so. Needs P2 (M2.1). M3.1 and M3.2 can run in parallel.
- **P4 Close.** Needs P3; switch-on of custom profiles needs M2.2.

## 3. Rules for this feature
- **Ship dark.** The new recovery behavior (M3.1, M3.2) runs only when `METHOD_RECOVERY_ENABLED` is exactly `true`. It is unset by default (`sync: false` in `render.yaml`) and turned on by Mo in the Render dashboard after M3.3 is live. Switched off, steps follow missed sessions' current rules. Never turn it on from code or tests.
- **Carry writes stay behind `MISSED_SESSIONS_CARRY_ENABLED`** as today (ND-15).
- **Custom profiles stay on their template until the eval passes** (RULE-19). M1.3 builds the profile call; its result is used only when M2.2 has passed and Mo has agreed.
- **The model never decides recovery** (MR-3): it only writes profiles (custom goals) and tags steps; code decides every action.
- **No silent let go** (MR-5): any code path that meets a step without a valid kind follows RULE-18 (today's behavior), never let go.

## 4. Must not break
| ID | What | How to check |
|---|---|---|
| R-1 | Missed sessions' carry guarantees: no day longer, no pile-up, test day protected, most recent day wins, nothing from a run of days, guarded writes once | `backend` tests for carry forward, reconcile and missed signals |
| R-2 | Set today aside, swap, move now (carry-now) | their endpoint tests |
| R-3 | Today states | the CI e2e specs (`.github/workflows/ci.yml`) |
| R-4 | Focus and the 10-minute version | Focus tests and `e2e/focus.spec.ts` |
| R-5 | Weekly review and the late test | review tests, `e2e/weeklyReview.spec.ts`, `e2e/lateTest.spec.ts` |
| R-6 | Goal creation, pathways and custom | goal-create tests, `e2e/generation.spec.ts`, onboarding specs |
| R-7 | The week call's existing checks | `weekPlan` and task-rule tests |
| R-8 | Pro gating for custom goals | billing and goal-authorization tests |
| R-9 | No forbidden words in copy | the copy-guard tests, including `presetAdherenceCopy.test.ts` |
| R-10 | Accessibility and no overflow | axe and overflow checks in the e2e specs |
| R-11 | The closing stretch | closing-stretch tests and Today e2e |

## 5. Phases

### P1 Profiles
**Goal:** every plan v2 goal gets a recovery profile that passes RULE-4, with no change for the person.

**M1.1 Check the code.** No code changes. Map every place that writes, moves, swaps, counts or describes steps; decide where the profile is stored; check that the 10 pathways fit their templates; show how a per-goal kind list fits the week call for Gemini and Groq; and list what in the docs is wrong. The answers become decisions, and this plan is fixed in place.

**M1.2 Profile format, checks, templates and pathway profiles.** The profile type, the RULE-4 checks, RULE-5's two added kinds, the 12 templates from `reference/domain-templates.md`, and the 10 pathway profiles. Pure code and tests. Covers RULE-2, RULE-4, RULE-5.

**M1.3 Profiles at goal creation.** Pathway goals are saved with their profile; custom goals get one from the profile call (template first, one retry, then the template), but use the template until M2.2 passes; goals created before this feature get one when their next week is written. Covers RULE-1, RULE-3. Checks R-6, R-8.

### P2 Tagging
**M2.1 The week call tags every step.** The kind list as a fixed menu, the code check and retry (RULE-6), the overrides (RULE-7), standalone movable steps (RULE-8). Checks R-6, R-7.

**M2.2 The eval.** The 24 goals with hand-written profiles and tagged weeks, a script that scores the profile call and the tagging, and the recorded result against RULE-19.

### P3 Recovery follows the kinds
**M3.1 Carry follows the kinds.** RULE-9 to RULE-14 and RULE-17's counts in the carry planner and reconcile, behind `METHOD_RECOVERY_ENABLED`; RULE-18 for steps without a kind. Checks R-1.

**M3.2 Swap, set today aside and move now.** RULE-16 on the server, the same rules as M3.1. Checks R-2.

**M3.3 Today, Focus, review and progress.** The section 6 lines, only allowed choices offered, the continue line in Focus, and no "skipped" for let-go or continued steps. Then Mo turns the switch on. Checks R-3, R-4, R-5, R-9, R-10.

### P4 Close
**M4.1 Copy honesty, acceptance, regression and close.** Pathway and onboarding lines match each profile (AC-13); `docs/architecture/plan-v2.md` describes profiles and kinds; every AC and R checked; archive the feature. The weekly update then resumes (WU-10).

## 6. Risks
- **Template quality.** A wrong action in a template affects every goal of that domain. Controlled by Mo's approval (MR-8), the eval (M2.2) and per-template tests in M1.2.
- **Week call failures from strict tagging.** More "try again" if the model tags badly, especially on Groq. Controlled by the fixed menu in Gemini's schema and M2.1 measuring the failure rate on sample weeks.
- **Carry logic growing complex.** Order and rest gaps add cases. Controlled by keeping actions as pure functions with generated-week tests (AC-6).
