# Fixed date: plan for the small fix (B-106)

Status: BUILT 2026-10-28 on `claude/trusting-edison-v1d3od`, with Mo's picks for all four choices (the recommended option in each of a to d). Waiting on review and merge.

## 1. The problem

The app has no idea a goal can have a real date (an exam, a race, a talk, a wedding).

- Every plan is exactly 90 days from its start: `routes/goal/create.ts` sets `targetDate = start + 90`.
- Nothing asks for a date. The four clarify questions are level, success, equipment and obstacle (`lib/ai/clarify.ts`, `QUESTION_IDS`); the roadmap prompt has no date; `Goal` has nowhere to store one.
- After a gap of 2 days or more, or a break, the plan moves later, end date included, up to 28 days (`planWeekMove` in `lib/weekClose/close.ts`, RULE-14, RULE-15). Right for a goal with no date, wrong for one with a date.
- Only single steps know dates: a step's `dueDate` never moves past it (B-39).

Example: a 10K race 90 days away. The person is sick for 10 days, the plan moves 10 days later, and race day falls in week 11, before the peak and taper.

## 2. What the small fix does

1. **Ask.** One optional question when making a plan: "Is there a fixed date this has to be ready by?" A date picker, no AI.
2. **Save it.** A new nullable column `Goal.fixedDate`.
3. **Never move the end past it.** After a gap or a break, the plan moves only as far as the date allows. Whatever does not fit is skipped, with the same jumped weeks the app already uses past the 28-day limit (RULE-15, WU-37, WU-38).
4. **Show it.** Where the plan's end date is shown, also show the fixed date, so the person sees both.

Out of scope (the medium and large fixes): a plan shorter than 90 days, planning backwards from the date (peak and taper right before it), telling the roadmap or week writer about the date.

## 3. What changes

### Database

- Migration: `Goal.fixedDate DateTime?`, stored like `startDate` (the local date at 00:00 UTC, ND-1). Null for every existing goal, so old goals behave exactly as now. Additive, no backfill. Apply with `prisma migrate deploy`.

### Backend

| Where | Change |
|---|---|
| `routes/goal/create.ts` | Read an optional `fixedDate` (`YYYY-MM-DD`) from the body. 400 when it is not a real date or is not after the start date. Save it on the goal. The plan is still 90 days (`targetDate` unchanged). |
| `lib/weekClose/close.ts`, `planWeekMove` | The room becomes `min(28 - movedDays, days from targetDate to fixedDate)`, never below 0. With no `fixedDate`, exactly as now. |
| `lib/weekClose/breaks.ts`, `pastLimitMove` | Already works from `room`, so a smaller room gives the choice card sooner. `final_week` may today go past the 28-day limit; with a fixed date it must not end after it (see 4c). |
| `lib/nextPlan.ts` (frontend), `WeekClose.tsx` | A fresh plan (Pro and free) and keep going fill the old plan's date in the field, kept only while it is still ahead; the person can change or clear it. The server carries nothing (code review). |
| `routes/goal/present.ts` | Sends `fixedDate` to the app already (it spreads the goal); no change needed. |
| Logs | The `[WeekClose]` line adds `fixedDate` when the room was cut by it. |

### Frontend

| Where | Change |
|---|---|
| Onboarding (`components/onboarding/`, `payload.ts`) | An optional date field on the schedule step (4a). Sent as `fixedDate` only when set, so the R-4 baseline bodies (`e2e/fixtures/onboarding`) are unchanged. |
| `types/index.ts`, `GoalContext` | `fixedDate` on the goal. |
| Today | Under the Day 1 to Day 90 bar: "Your date: {date}. Your plan ends on {end}.", or "..., after it, and won't move any later." when the plan ends after the date (`lib/fixedDate.ts`). The welcome-back lines stay as they are. |

### Tests

- `planWeekMove` and `pastLimitMove` with a fixed date: room cut by the date, cut to 0, a date further away than 28 days (no change), no date (no change).
- Create route: valid date, bad date, date before the start, no date.
- `backend/test/ninetyDays.test.ts`: "Race-day Rae" (race 3 days after day 90, away 10 days in week 5: moves 3, not 5) and "Exam-day Eve" (exam on day 90, away 6 weeks: nothing moves, weeks are jumped); every open checks "the plan never ends after the fixed date".
- Frontend: the field (`StepSchedule.test.tsx`), the payload, the Today line, `lib/fixedDate.test.ts`.

Code review before merging: it changes stored data and the week-close logic.

## 4. Mo's choices

a. **Where the question goes.** On the schedule step next to "minutes a day" (recommended: it is about time), or on the review step.

b. **A date less than 90 days away.** Options:
   1. Accept it and say plainly: "Your plan is 90 days, so it ends after your date. We won't let it move any later." (recommended for the small fix; the medium fix makes the plan fit)
   2. Refuse the date and say plans need 90 days.

c. **The final-week choice after a long break.** Today "Do my final week" starts week 12 on the day they return. With a fixed date, if that week would end after the date:
   1. Start week 12 so it ends on the date (fewer days of it are offered) (recommended). As built, week 12 always keeps today: when the date is under a week away, the plan may end up to 6 days after it rather than leave no final week at all.
   2. Keep it as now and let it end after the date.

d. **Copy.** The question, the hint under it and the end-date line. Suggested: "Is there a fixed date this has to be ready by?", hint "An exam, a race, a talk. Leave it empty if not."

## 5. Order

1. Migration and backend (create, `planWeekMove`, `pastLimitMove`, present, next plan) with tests.
2. Frontend field, payload, end-date line, e2e fixture.
3. Code review, then Mo merges; the migration runs on deploy.

## 6. Code review (2026-10-28)

`/code-review` found ten points; all fixed on the same branch:

1. A next plan kept the old date on the server where the person couldn't see or clear it. Now the app fills it in the field (fresh plan, Pro and free, and keep going); the server carries nothing.
2. Today's line kept saying "won't move any later" after the date had passed. It now goes once the date has passed.
3. After "Do my final week" cut by the date, the saved line said "Your final week starts today" though week 12 had started earlier. That case now saves "Welcome back. Your final week is under way, and your plan ends on {date}."
4. The field checked against the browser's date; it now uses the person's stored time zone, as the server does.
5. The `fixedDate` log line fired when the date did not hold the move back. It now fires only when the date made the move shorter (`dateCut`).
6. The log line was missing on the review path; both close paths log it now (`logFixedDate`).
7. A free user's "Start a fresh plan" lost the date. It is filled in now (see 1).
8. The field accepted impossible dates (February 30). Now rejected, as on the server.
9. The date check was done twice (hook and step); the hook does it once and passes it down.
10. The date label was formatted in two places; both use `utcDateLabel` now.
