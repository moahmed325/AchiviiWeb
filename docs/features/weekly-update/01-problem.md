# Achivii Weekly Update — PROBLEM (handover stub)

**Status:** NOT STARTED. This file only records the work handed over from missed sessions. Write the full problem definition with `docs/templates/01-problem.md` before planning.
**Date:** 2026-10-08
**Builds on:** `docs/architecture/plan-v2.md` (Weekly update, prompt 4)

## Moved here from missed sessions (M4.2)

Missed sessions closed on 2026-10-08 without its milestone M4.2, the week-close handoff. Its own record: `docs/archive/missed-sessions/04-phases.md` (ND-19, section 9). Plan v2's weekly update (prompt 4) does not exist yet, and the handoff cannot be built without it. The scope moves here unchanged:

- **Week-close handoff.** On the first open of a new week, close the previous week and run the plan v2 weekly update.
- **Unlogged test, held target (AC-9, RULE-7).** If the week's test was never logged, the update runs with the test marked missing. The target is held, and the week's sessions decide its status. A missing test is never treated as the person failing. Today the result is `RoadmapWeek.testResult: null`.
- **Two far_behind weeks (AC-11, RULE-9).** After two far_behind weeks in a row, the next week starts with a re-test (`retestFirst`, which `weekPlan.ts` already accepts) and a check that the daily time still works.
- **Read the stored result.** `writeNextWeek` (`backend/src/lib/planV2.ts`, `lastWeekResult`) does not read `RoadmapWeek.testResult` today. The update must read it, whether it was logged late (missed sessions M4.1, `PUT /api/goal/weeks/:weekNumber/test-result`) or with the review.
- **Inputs already built.** `weekCounts` in `backend/src/lib/missedSignals.ts` gives each week's planned, done, 10-minute, key, key-skipped, missed, carried and dropped counts (missed sessions M2.3). Its `tasks` input needs `usedMinimumVersion`, which the reconcile query does not load today.

Copy rules carry over: never "missed", "behind" or "failed", and never ask why (missed sessions Feature Definition section 12). Two section 12 lines belong to this work and are not yet shown anywhere: "Last week's test wasn't logged, so we're holding your target. Take it now (about N minutes) and we'll adjust." and "The last two weeks were hard to fit in. Let's re-test to find your real level and check your daily time still works."
