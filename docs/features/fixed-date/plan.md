# Fixed date: plan for the small fix (B-106)

Status: PLANNED, waiting on Mo's choices in section 4. Nothing is built.

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
| `lib/nextPlan.ts` | A fresh plan after a break carries the fixed date over, if it is still ahead. |
| `routes/goal/present.ts` | Send `fixedDate` to the app. |
| Logs | The `[WeekClose]` line adds `fixedDate` when the room was cut by it. |

### Frontend

| Where | Change |
|---|---|
| Onboarding (`components/onboarding/`, `payload.ts`) | An optional date field (step to choose, 4a). Sent as `fixedDate`. The create body is pinned by the R-4 baseline (`e2e/fixtures/onboarding`), so the fixture changes too. |
| `types/index.ts`, `GoalContext` | `fixedDate` on the goal. |
| Today / progress, where the end date shows | "Your date: {date}" next to the plan's end date. The welcome-back lines (`WELCOME_BACK_INSIGHT` and others) stay as they are. |

### Tests

- `planWeekMove` and `pastLimitMove` with a fixed date: room cut by the date, cut to 0, a date further away than 28 days (no change), no date (no change).
- Create route: valid date, bad date, date before the start, no date.
- `backend/test/ninetyDays.test.ts`: a new person, "Race-day Rae", with a fixed date and a 10-day break in week 5; the rule that must hold is "the plan never ends after the fixed date".
- Frontend: the field, the payload, the end-date line; e2e onboarding fixture.

Code review before merging: it changes stored data and the week-close logic.

## 4. Mo's choices

a. **Where the question goes.** On the schedule step next to "minutes a day" (recommended: it is about time), or on the review step.

b. **A date less than 90 days away.** Options:
   1. Accept it and say plainly: "Your plan is 90 days, so it ends after your date. We won't let it move any later." (recommended for the small fix; the medium fix makes the plan fit)
   2. Refuse the date and say plans need 90 days.

c. **The final-week choice after a long break.** Today "Do my final week" starts week 12 on the day they return. With a fixed date, if that week would end after the date:
   1. Start week 12 so it ends on the date (fewer days of it are offered) (recommended).
   2. Keep it as now and let it end after the date.

d. **Copy.** The question, the hint under it and the end-date line. Suggested: "Is there a fixed date this has to be ready by?", hint "An exam, a race, a talk. Leave it empty if not."

## 5. Order

1. Migration and backend (create, `planWeekMove`, `pastLimitMove`, present, next plan) with tests.
2. Frontend field, payload, end-date line, e2e fixture.
3. Code review, then Mo merges; the migration runs on deploy.
