# Achivii Weekly Update — Brief

**Status:** DIRECTION CHOSEN
**Date:** 2026-10-08
**Links:** `docs/architecture/plan-v2.md` (Weekly update, prompt 4), `docs/archive/missed-sessions/04-phases.md` (ND-19), `docs/features/weekly-update/decisions.md`

## 1. The problem
A plan v2 goal's targets never change after the roadmap is written. The weekly test result is stored but nothing reads it, so a person who beats every target and a person who did nothing get the same next week. A week also only ends when the person submits the weekly review: if they never do, they never get a new week. A person back from a long break gets a plan that assumes no time passed.

## 2. Who and when
Every plan v2 user, at the end of every week (weeks 1 to 11), and anyone who comes back after more than a week away.

## 3. What we know
- **Fact:** next week is written by `writeNextWeek` (`backend/src/lib/planV2.ts`) only when the review is submitted (`POST /api/goal/weeks/:weekNumber/review` in `backend/src/routes/goal.ts`).
- **Fact:** `writeNextWeek` never reads `RoadmapWeek.testResult`; it only looks at the test day's status and note (`lastWeekResult`). Targets stay as the roadmap wrote them.
- **Fact:** the week-plan prompt already accepts a coach's note and `retestFirst` (`backend/src/lib/ai/weekPlan.ts`), but nothing sends them.
- **Fact:** the review's message is a count ("3 of 4 sessions done.") stored in `WeeklyReview.aiAdaptationInsight` and shown in the review's adaptation step and the progress history.
- **Fact:** weeks are fixed calendar weeks from `Goal.startDate` (`weekStartFor`). Nothing can move them.
- **Fact:** per-week counts (planned, done, 10-minute, key skipped, missed, carried, dropped) already exist: `weekCounts` in `backend/src/lib/missedSignals.ts` (missed sessions M2.3).
- **Fact:** Today decides "review due" in the browser (`isWeekReviewDue`, `frontend/src/lib/today.ts`); the server never closes a week by itself.
- **Fact (Mo, 2026-10-08):** jumping over missed weeks is not acceptable. Each goal has its own way of handling a break, and the plan must follow it.

## 4. How bad it is, and why now
Without it the plan is not adaptive, which is the core promise of plan v2. Missed sessions is closed and handed over its last piece (M4.2) to this feature.

## 5. What good looks like
- After each week, the next targets fit what the person actually did, and they read one honest, kind sentence about what happens next.
- A week ends on time even if they never open the review.
- After a break, they restart the way their method says to, and the plan makes room for it.

## 6. Options we looked at
### Option A: the plan v2 weekly update, with automatic week close and goal-specific breaks
Build prompt 4 as `plan-v2.md` specifies, close weeks automatically, and handle breaks with each goal's own return rule, moving the plan's dates.

### Option B: weekly update only, no automatic close
Smaller, but a person who skips the review is stuck on an old week. Rejected (WU-1).

### Option C: on a long break, jump to the current calendar week
Simple, but it squeezes the remaining climb and ignores how the method says to return. Rejected by Mo (WU-4).

## 7. Chosen direction
Option A. Weeks close automatically (WU-1). An unlogged test holds the target and the next week opens with a re-test (WU-3). A break follows the goal's own return rule and moves the plan's dates, keeping the same 12 weeks, up to 4 weeks in total (WU-4, WU-5, WU-6). Checkpoints at weeks 4 and 8 are a separate feature (WU-2).
Agreed by Mo on 2026-10-08.

## 8. Limits
**In scope:** prompt 4, week close (review or automatic), unlogged tests, two hard weeks in a row, breaks and the moving plan dates.
**Out of scope:** checkpoint offers at weeks 4 and 8 (`docs/features/checkpoints/01-brief.md`); reminders; photo and video tests; plan v1 (retired, ND-21).
**Must not break:** missed sessions (reconcile, carry, swap, late test), the weekly review flow, the closing stretch, Pro gating.

## 10. Handed over from other features
### Moved here from missed sessions (M4.2)
Missed sessions closed on 2026-10-08 without its milestone M4.2, the week-close handoff (`docs/archive/missed-sessions/04-phases.md`, ND-19, section 9):

- **Week-close handoff.** On the first open of a new week, close the previous week and run the weekly update.
- **Unlogged test, held target (AC-9, RULE-7 there).** A missing test is never treated as the person failing.
- **Two far_behind weeks (AC-11, RULE-9 there).** The next week starts with a re-test (`retestFirst`) and a check that the daily time still works.
- **Read the stored result,** whether logged late (`PUT /api/goal/weeks/:weekNumber/test-result`) or with the review.
- **Inputs already built:** `weekCounts`. Its `tasks` input needs `usedMinimumVersion`, which the reconcile query does not load today.

Copy rules carry over: never "missed", "behind" or "failed", and never ask why.
