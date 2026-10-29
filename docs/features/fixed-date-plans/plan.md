# Plans that fit a fixed date: plan

**Status:** BUILT and merged to main (2026-10-29), after the code review in section 8. Left: the live check (section 4, step 4).
**Backlog:** B-109. **Ideas:** I-29. **Builds on:** B-106 (the fixed date field).

## 1. The problem

Every plan is 12 weeks (`TOTAL_WEEKS = 12`, `lib/ai/roadmap.ts`). B-106 added an optional fixed date (an exam, a race, a talk) and stops the plan moving past it after a break, but a date under 90 days away still gets a 12-week plan:

- **The plan ends after the date.** An exam 7 weeks away gets a plan whose final test is in week 12, five weeks after the exam. Onboarding says so ("Your plan is 90 days, so it ends after your date"), and that's all it does.
- **The person peaks too late.** Weeks 8 to 12 hold the hardest work and the final test. On the date itself they're in week 7, halfway up the climb.
- **Nobody tapers.** Coaches make the last week before a race or exam lighter, so the person arrives rested. Today's plan has no week like that.

Exams, races and talks are what serious people bring, so this is the case that matters most.

## 2. What it does

1. **The plan fits the date.** With a fixed date under 90 days away, the plan has as many whole weeks as fit before it: `N = floor(days from the start to the day before the date / 7)`, from 4 to 11. With no date, or a date 90 or more days away, nothing changes: 12 weeks.
2. **The plan ends the day before the date at the latest.** It can end up to 6 days before (the plan is whole weeks). Those last few days and the date itself are theirs; Today says "Your date is in 3 days. Rest, and trust the work."
3. **The final test comes a week before the date.** Week N-1 holds the final test, with the full target. Week N is the easier "ready" week: shorter sessions, no new load, a light check (the pathway's light test, or "Done as written" for a custom goal), and the same target as week N-1 (targets never go down).
4. **The method's phases shrink to fit.** The roadmap call is told "This plan is N weeks" and writes N weeks, with its phases covering 1 to N. A 6-week plan might be 2 weeks base, 3 weeks build, 1 week ready.
5. **The big tests and checkpoints move with it.** Today: big tests in weeks 4, 8 and 12, checkpoints after 4 and 8. For N weeks: big tests at about one third and two thirds of the way through, then N-1 (`round(N/3)`, `round(2N/3)`, N-1, duplicates dropped). Checkpoints only after a big test with at least 2 weeks still to go.
6. **The safety limits still hold.** Targets climb no faster than today's limits, so a short plan may not reach the full goal. The honest line that already exists says so ("Safe for 6 weeks: 8 km. Your goal is 10 km.").
7. **Said plainly in onboarding.** The fixed date line changes from "Your plan is 90 days, so it ends after your date" to "Your plan will be 7 weeks, with the final test on {date}, the week before your date."

## 3. What changes

### Stored data (one migration)

- **`Goal.totalWeeks`** (`Int`, default 12): how many weeks this plan has. Every existing goal gets 12, so nothing changes for them. A column, not JSON, because nearly every part of the plan reads it.
- `Goal.targetDate` stays the plan's last day: start + 7N - 1.
- `RoadmapWeek` rows: N of them instead of 12. Nothing else changes in the row.

### Backend

Today `TOTAL_WEEKS` is read in about 80 places across 14 files. Each one becomes the goal's own count.

| Where | Change |
|---|---|
| `lib/ai/roadmap.ts` | `TOTAL_WEEKS` stays as the default (`DEFAULT_WEEKS = 12`). New `planWeeks(start, fixedDate)` (pure) works out N. The roadmap prompt and its checks take N: `"weeks"` has exactly N; phases cover 1 to N; the last week is the ready week and keeps week N-1's target. `BIG_TEST_WEEKS` becomes `bigTestWeeks(N)` (12 still gives 4, 8, 12); `nextCheckWeek` and `withPathwayTests` take N. |
| Preset method text | Some presets name weeks ("hard gates at weeks 4, 8 and 12"). The prompt gets one line for a short plan: "This plan is N weeks; the method's week numbers are for 12. Keep its order and use these test weeks: ...". The preset files don't change. |
| `routes/goal/create.ts` | Works out N from the fixed date, saves `totalWeeks` and `targetDate`, and passes N to the roadmap call. Under 4 weeks: see choice (a). |
| `lib/ai/weekPlan.ts` | The week call is told "week 5 of 7" and, in the ready week, that it is the week before their date: shorter, lighter, nothing new. The safety limits for a ready week are the light-week ones that already exist. |
| `lib/planV2.ts`, `lib/weekClose/*` (`close`, `breaks`, `checkpoint`, `checkpointClose`, `update`), `lib/recovery/carry.ts`, `lib/ai/weeklyUpdate.ts`, `lib/safety/storedTargets.ts`, `lib/nextPlan.ts`, `routes/goal/weeks.ts`, `routes/goal/schedule.ts` | Read `goal.totalWeeks` wherever they read `TOTAL_WEEKS` today: the final week, "weeks left", checkpoint spreads, the day-90 line (now "the final target"), "6 of 7 weeks" in the next plan. |
| `routes/goal/present.ts` | Sends `totalWeeks` with every goal. |

**What already copes, unchanged:** missed-session carry and recovery (they work one week at a time); B-106's break rule (the plan never moves past the date; with a short plan there is just less room, which it already handles by going to the final week); edit my schedule (B-108).

### Frontend

The app says "12 weeks" or "90 days", or counts to 12, in about 60 places. Every screen about the person's own plan reads `goal.totalWeeks` instead: Today, the week close, the closing stretch, the roadmap, the journey, progress, the weekly review, the achievement screens, edit my schedule's final week, reset plan. Marketing and pathway cards keep "12 weeks" (that is still the normal plan).

| Where | Change |
|---|---|
| `lib/fixedDate.ts`, onboarding | The new line from section 2 (7), with N worked out the same way as the server. |
| `types/index.ts` | `Goal.totalWeeks`. |
| Today | The "your date is in N days" line after the last week. |

### Tests

- `planWeeks`: dates 29 to 89 days out give 4 to 11 weeks; a date on a week boundary; time zones (the person's local day, `lib/timezone.ts`).
- The roadmap checks: N weeks, phases 1 to N, the ready week keeps week N-1's target, the big-test weeks for N from 4 to 12 (12 gives exactly today's).
- Every place that read `TOTAL_WEEKS`: the existing tests still pass with 12; new cases with a 6-week goal (the final week, checkpoints, the weekly update's last weeks, the next plan's text).
- The 90-day simulation (`ninetyDays.test.ts`): a 7-week goal from week 1 to the end, with a missed week and a break that runs into the date.
- The week prompt fixture for a 12-week goal stays byte for byte.
- Frontend: the screens above with a 7-week goal; the onboarding line.

Code review before merging (stored data, the roadmap and week writers, safety).

## 4. Order

1. Backend: the column and migration, `planWeeks`, `goal.totalWeeks` read everywhere (still 12 for everyone), the tests. Nothing changes for users yet.
2. Backend: the roadmap call and week call for N weeks (ready week, test weeks, the preset line), goal create.
3. Frontend: every screen reads `totalWeeks`; the onboarding line; Today's last-days line.
4. A live check: one real 6-week custom goal and one 7-week run10k goal, to read the roadmap the model writes.

## 5. Out of scope

- **Plans longer than 12 weeks** for a date further away. A date 5 months out still gets 12 weeks, and the plan ends before it (B-106 already says so).
- **Changing the date** after the goal is made.
- **Changing the length** of goals already made.

## 6. Risks

- **The model ignores N.** The roadmap check refuses anything but N weeks and the call retries once, as it does today; after that, the 503 with nothing saved that exists today.
- **A preset's week numbers fight N.** The prompt line in section 3 covers it; the live check in step 4 is there to see it work.
- **A missed place still says 12.** Step 1 replaces every `TOTAL_WEEKS` read before anything is shorter, and the tests run a 6-week goal through each one.

## 7. Mo's choices

Mo took every recommendation (2026-10-29): (a) a date under 4 weeks away is refused; (b) the final test in week N-1 with an easier week N; (c) same as today on free and Pro; (d) whole weeks, ending up to 6 days before the date, with Today's rest line.

a. **A date under 4 weeks away.** Recommended: say "Your date is too close for a full plan. Choose a date at least 4 weeks away, or leave it empty." Alternatives: a 4-week plan that ends after the date, or a 2- or 3-week "sharpen up" plan (no checkpoints, one test).
b. **Where the final test goes.** Recommended: week N-1, with an easier week N before the date (what coaches do for races and exams). Alternative: the final test in week N, as close to the date as possible.
c. **Free or Pro.** Recommended: same as today, so pathways free and custom goals Pro, with a fixed date allowed on both.
d. **The last few days.** Recommended: the plan ends with whole weeks, up to 6 days before the date, and Today says to rest. Alternative: stretch the ready week to end the day before the date (a week of 7 to 13 days; more code, since every week is 7 days today).

## 8. Built (2026-10-29)

- **Server:** `lib/planLength.ts` (`planLengthFor`, `PlanShape`, `shapeOf`, `checkWeekFor`, `ANY_CHECKPOINT_WEEKS`); migration `20261029120000_goal_total_weeks` (`Goal.totalWeeks`, default 12). Goal create answers 400 `fixed_date_too_close` under 4 weeks. Every `TOTAL_WEEKS` read now reads the goal's shape: "week 12" as the final target is `finalWeek`, "the last week" is `weeks`. The roadmap and week prompts name the weeks, the final test week and the ready week; a 12-week plan's prompts are byte for byte as before (tests pin it).
- **App:** `frontend/src/lib/planLength.ts`; the day counter, closing stretch, review, progress, roadmap, dashboard, checkpoint, end-screen and edit-my-schedule copy follow `goal.totalWeeks`. Onboarding: "Your plan will be 6 weeks, with the final test in week 5, the week before your date." and the too-close error. The closing stretch shows "Your date is in 3 days. Rest, and trust the work."
- **Tests:** `backend/test/fixedDatePlans.test.ts`; two short-plan people in `ninetyDays.test.ts` (Exam Ella, 7 weeks with misses; Busy Ben, 6 weeks with a 10-day break); `goalCreateFixedDate.test.ts`; `frontend/src/lib/planLength.test.ts`, `fixedDate.test.ts`, `StepSchedule.test.tsx`, `ClosingStretchView.test.tsx`. Backend 1998, frontend 928 tests pass; e2e today, onboarding, generation, weekly review, progress, next plan, light test, week close and journey (desktop) pass.

### Code review (`/code-review high`, 2026-10-29)

Ten findings, all fixed on the branch:
1. "Keep going" after a long break could jump past the final test straight to the ready week. It now stops at the final test week; past it, "Do my final week".
2. On read, a light-test goal's big weeks were held four safe steps apart, but a shorter plan's are 3 to 6 weeks apart, so targets were lowered after create (or held too loosely). `safeCheckWeekClimb` now allows one step per week between them; the weekly update's safe maximum the same.
3. A light pathway's ready week was told to build toward last week's check. It now says the final test was last week.
4. The roadmap's final stretch could show "Days 50–49" when the plan ends with its last week. Hidden when there are no closing days.
5. Today's day counter still announced "of 90" to screen readers.
6. The weekly update's system text said "90-day plan", and the success answer is asked for 90 days. The update names the plan's weeks; the roadmap prompt says code lowers what can't be reached safely by the date.
7. A small move could put a shorter plan's last day on the date itself. `fixedDateRoom` now keeps it the day before.
8. The achievement screen's "Total Path" still said 90 days.
9. A type guard in `checkWeekFor` existed only for one test's `.map(nextCheckWeek)`; the test now passes the week, and the guard is gone.
10. An unused frontend helper and a stale `[4, 8, 12]` constant were removed.
