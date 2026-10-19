# Weekly Update — Phases

**Status:** IN PROGRESS
**Feature:** docs/features/weekly-update/02-feature.md
**Decisions:** docs/features/weekly-update/decisions.md

## 1. Status

| Milestone | What | Covers | Status | Report |
|---|---|---|---|---|
| M1.1 | Check the code | — | DONE 2026-10-17 | [m1.1](milestones/m1.1-check-the-code.md) |
| M1.2a | Server week close, the migration, the review-route guard (B-59) | AC-7, AC-16 (failed write), AC-17, AC-19 (part) | DONE 2026-10-17 | [m1.2a](milestones/m1.2a-server-week-close.md) |
| M1.2b | The close in the app: before reconcile, "getting ready", the test card, the line once | AC-6 | DONE 2026-10-17 | [m1.2b](milestones/m1.2b-close-in-the-app.md) |
| M1.3 | Moved days in every date | — | MOVED to M1.4 (WU-30) | |
| M1.4 | Moved dates and gaps: days not offered, short gaps move the plan | AC-11, AC-16 | DONE 2026-10-17 | [m1.4](milestones/m1.4-moved-dates-and-gaps.md) |
| M1.5a | Breaks: the length, the first-week-back note, the high-load hold, welcome back | AC-9 (part), AC-10 (dates), AC-18 (length) | DONE 2026-10-19 | [m1.5a](milestones/m1.5a-breaks-first-week-back.md) |
| M1.5b | Past the limit: the choice card, jumped weeks, the fresh plan | AC-12 | NOT STARTED | |
| O1 | Mo: turn on `WEEK_CLOSE_ENABLED` in Render, then run the P1 production checks | — | NOT STARTED | |
| M2.1 | Light weekly tests: 10 pathways and the custom-goal rule | AC-20 | NOT STARTED | |
| M3.1 | The update call and its checks, on the review path (needs B-62) | AC-1, AC-2, AC-3, AC-8, AC-13, AC-15 | NOT STARTED | |
| M3.2 | Eval of the update call on recorded weeks | AC-2, AC-3, AC-8 (measured) | NOT STARTED | |
| M3.3 | The update in the automatic close; unlogged test; two hard weeks | AC-1, AC-4, AC-5 | NOT STARTED | |
| M3.4 | Break restart | AC-9, AC-10, AC-18 | NOT STARTED | |
| M4.1 | Copy and acceptance | AC-14, AC-19, all | NOT STARTED | |
| O2 | Mo: turn on `WEEKLY_UPDATE_ENABLED` in Render | — | BLOCKED (the `checkpoints` feature must ship first, WU-23) | |

## 2. Order

- **P1 Week close** (`WEEK_CLOSE_ENABLED`): a skipped review no longer leaves next week unwritten; gaps and breaks move dates; no target changes. Needs M1.1. Ends with O1.
- **P2 Light weekly tests**: new goals get light tests (no switch, goal creation). Needs M1.1; can run between P1 milestones; must finish before M3.1.
- **P3 Weekly update** (`WEEKLY_UPDATE_ENABLED`): targets follow the person. Needs P1, P2 and `docs/backlog.md` B-62 (real safety limits, WU-29). M3.2's eval comes before M3.3 puts the update inside the automatic close.
- **P4 Close**: copy, every acceptance criterion in the three switch states, docs. Needs P3. O2 waits on the `checkpoints` feature.

## 3. Rules for this feature

- Two switches (RULE-18, WU-25). P1 work acts only with `WEEK_CLOSE_ENABLED`; P3 work only with both on. Both off is exactly today's behaviour. Tests set the switches per test; code never turns them on.
- P1 never changes a target and makes no model call except the week call the review already makes (WU-25).
- One migration for the whole feature, in M1.2, shape decided in M1.1's review; it only adds fields, nullable or with a default (WU-21).
- The close is saved before reconcile runs (RULE-17); with nobody away, reconcile's results are unchanged (R-2).
- Who closes a week is decided inside the all-or-nothing save by a conditional update on the week's status, never by a read before it (WU-27).
- A move shifts the stored `startDate` and `targetDate`; past days are read only from their stored rows (WU-26).

## 4. Must not break

| ID | What | How to check |
|---|---|---|
| R-1 | Missed sessions: reconcile, carry, swap, mark missed, carry-now, signals, with both switches off and with each recovery switch state | Backend `npm test` (missed-sessions, carry, recovery and reconcile tests); e2e `today` specs |
| R-2 | Carry at a normal week change with nobody away, reading the week before (method-aware recovery RULE-20, M3.1d) | Reconcile tests across the week change give the same body with `WEEK_CLOSE_ENABLED` on and off, both for an on-time review and for a review or close on the morning after the week ended (WU-30) |
| R-3 | The weekly review writes next week as today when `WEEKLY_UPDATE_ENABLED` is off | Review-route and `writeNextWeek` tests; e2e review spec |
| R-4 | Late test: `PUT /weeks/:weekNumber/test-result` and Today's late-test card | `lateTestResult` tests; `LateTestCard` tests |
| R-5 | Day numbers, the closing stretch from day 85, roadmap, progress and achievement screens with 0 moved days | Frontend `npm test`; e2e journey and progress specs |
| R-6 | Goal creation, Pro gating, the 503 and 422 paths | Goal-create tests |
| R-7 | Both switches off is exactly today (AC-19) | Tests per milestone with both switches unset |

## 5. Phases

### P1 Week close

**Goal:** a week closes on time even when the review is skipped, and someone who comes back late starts the week the day they return.

**M1.1 Check the code.** Read only. Maps the review path, goal loading and reconcile order, every date worked out from `Goal.startDate`, missed sessions around a week with no tasks yet, the late-test card, the safety limits for high-load goals, and how switches are read; proposes the one migration. Done when the report answers its questions with file paths and Mo has decided the storage and any plan changes.

**M1.2a Server week close.** First the review route's guard (B-59, every switch state): a conditional update on the week's status and all writes in one transaction after the model call (WU-27). Then, behind `WEEK_CLOSE_ENABLED`, a close endpoint that is safe to repeat and all or nothing (RULE-9), acts only on an `active` week whose last day has closed (RULE-8), records the first-attempt date, can answer "due, test not logged" without closing (for M1.2b's card), writes the week as the review does with the targets as planned, upserts the review row with the neutral line, and logs one `[WeekClose]` line per close. Includes the one migration (M1.1 report section 8, plus `closeLineSeenAt`). Covers AC-7, AC-17, the failed-write part of AC-16, the switch-off part of AC-19. Checks R-1 to R-4, R-7.

**M1.2b The close in the app.** `GoalContext` calls the close before reconcile (RULE-17); "getting ready" on the loading views; the test card on Today with any other action counting as Skip and a closed tab bringing it back (WU-14, WU-28); the neutral line once (`closeLineSeenAt`). A review open in another tab when the automatic close wins: the person's typed reflection must not be lost, and the modal must not say the review was saved (M1.2a review). Covers AC-6. Checks R-1, R-3, R-4, R-5, R-7.

**M1.3** Moved into M1.4 (WU-30).

**M1.4 Moved dates and gaps.** A move shifts `startDate` and `targetDate` (WU-26); days not offered (never missed, nothing carried, no status effect; the day kind decided in this prompt, WU-28) and short gaps moving the plan within the 28-day limit, with "not offered" when the limit is used up (RULE-13, WU-13). Covers AC-11, AC-16. Checks R-1, R-2, R-5, R-7.

**M1.5a Breaks: the first week back.** Split from M1.5 (WU-35). Break detection and length (RULE-13, WU-18), stored as `breakDays`; the return rule's "first week back" note to the week writer (WU-25 (3)); for a high-load goal, the writer's note and the first-week-back line on every hard high-load step (WU-29, WU-35); the welcome-back line. Covers the date parts of AC-9, AC-10, AC-18. Checks R-1, R-2, R-3, R-5, R-7.

**M1.5b Past the limit.** The choice card when a break goes past the 28-day limit, "Keep going" with jumped weeks (RULE-15, WU-8, WU-19), and the text-only fresh plan (WU-9, WU-24). Settled by the logic check of 2026-10-19: how far the plan moves and when the card shows, with no week wholly in the past ever written (WU-37); other screens send the person to the card, and past week 12 the card offers the final week (WU-38); no test card after a break (WU-39); jumped weeks shown as "Paused" and the lines (WU-40); a light test in a high-load first week back (WU-41). The P1 release checklist for O1 is written in its review. Covers AC-12. Checks R-1, R-5, R-6, R-7.

**O1.** Not before M1.5a and M1.5b are merged (WU-33: until then a 7+ day break gets a full-load first week back; WU-35). Mo turns on `WEEK_CLOSE_ENABLED` in Render after a P1 release checklist (written in M1.5b's review), then records the production checks here. The checklist includes: the backend (with M1.2a's migration) is deployed before the switch is turned on; a frontend that ships first gets 404 from `/close-week`, which it treats as nothing due (M1.2b review); the `[WeekClose]` log lines show closes by `auto` with their `gapDays`.

### P2 Light weekly tests

**M2.1 Light weekly tests.** A hand-written weekly test for each of the 10 pathways, light in every week except 4, 8 and 12 for run10k, recomp, speech and spanish, and the light-test rule for custom goals in the roadmap call (RULE-19, WU-22). Existing goals keep their stored tests. Covers AC-20. Checks R-6.

### P3 Weekly update

**M3.1 The update call.** Needs B-62's safety limits (WU-29). Wires `weekCounts` into the update's inputs (RULE-2, WU-30). Prompt 4 with its code checks (RULE-4 with WU-11, WU-15, WU-16's bound left to M3.4, WU-23, deliverables), the status stored, the sentence and its fallback, the coach's note to the week writer, on the review path only.
**M3.2 Eval.** The update call on recorded weeks: rejections, fallbacks, safety, wording.
**M3.3 The update in the automatic close.** Plus the unlogged test and re-test (RULE-5, WU-17) and two hard weeks with the daily-time question (RULE-6, WU-20).
**M3.4 Break restart.** The return rule's restart level, the re-test first, the restart level as lower bound, week 1 as the floor, the week a break started in left out of RULE-6 (RULE-16, WU-16, WU-18).

### P4 Close

**M4.1 Copy and acceptance.** Every line in section 6, the kind names in the sentence (WU-11), every acceptance criterion in the three switch states, e2e, and the docs (`docs/architecture/plan-v2.md`, `CLAUDE.md`).

## 6. Risks

- **Waiting on Today.** An automatic close writes a week while the person waits (10 to 30 seconds). Controlled by the "getting ready" state and by RULE-9's retry on the next open.
- **Dates in many places.** Controlled by WU-26: a move shifts the two stored dates, which M1.1 found are read only for today's day number and new weeks.
- **No safety limits act on plan v2 today** (B-62, a safety issue outside this feature). P3 waits for it (WU-29); P1 changes no target, and a high-load first week back is held down by WU-29 (1).
