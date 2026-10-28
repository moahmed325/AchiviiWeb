# Edit my schedule: plan

**Status:** BUILT (2026-10-28) on `claude/trusting-edison-v1d3od`, with Mo's picks for all four choices (free, two rest days in a row allowed, the account menu, any time). Waiting on review and merge.
**Backlog:** B-108. **Ideas:** I-31.

## 1. The problem

A goal's schedule is set once, in onboarding, and locked for all 90 days.

- **No way to change it later.** Days per week (`planVariant`: 4, 5 or 6), minutes per day (`dailyMinutes`) and time of day (`preferredSlot`) live in `Goal.routine` and no route changes them. The one exception is the weekly update's daily-time card (`POST /api/goal/daily-time`), which can only make the minutes shorter, and only after two hard weeks.
- **Nobody chooses their rest days.** `restDayIndices` (`backend/src/lib/ai/weekPlan.ts`) puts them at fixed positions counted from the plan's start date: "steady" rests on plan days 4 and 7, so a goal started on a Monday rests on Thursday and Sunday for 12 weeks. The test is always the last practice day of the plan week.
- **What a person can do today:** swap one day at a time, every week, or start the whole plan again.

A committed person's commitment doesn't change, but their life does (a new shift, a class timetable, a season). They want to say once "I train Tuesday, Thursday and Saturday mornings now" and have every week follow it.

## 2. What it does

1. **Pick your training days.** In onboarding (the schedule step) and later: choose the weekdays, not only how many. "Steady" means 5 days; the person picks which 2 are rest days. Default: today's positions, so nothing changes for anyone who doesn't choose.
2. **Edit my schedule.** For the active goal, from the account menu (next to the time zone): days per week and which days, minutes per day (30, 45, 60, 90) and time of day.
3. **From next week.** A change applies to the next week written (the week close already writes one week at a time). The current week stays as it is; nothing done is lost; nothing stored for past weeks is rewritten.
4. **Targets don't change.** Only when and how long. If someone trains less, the weekly update and the checkpoints at weeks 4 and 8 already react (a held target, a re-test, a realistic target offer).
5. **Said plainly.** After saving: "Saved. Your new schedule starts next week, on {date}."

## 3. What changes

### Stored data (no migration)

`Goal.routine` is JSON. It gets one optional field:

- `restWeekdays`: the rest days as weekdays (0 Sunday to 6 Saturday), as many as the plan has (`7 - activeDaysFor(planVariant)`). Absent on every existing goal, which keeps today's positions.

`planVariant`, `dailyMinutes` and `preferredSlot` are the fields that already exist; editing changes them in place. Each change logs one `[Schedule]` line (goal id, before and after, the week it starts).

### Backend

| Where | Change |
|---|---|
| `lib/ai/weekPlan.ts` `weekLayout` | With `restWeekdays`, a day is a rest day when its date's weekday is in the list; without, today's positions. The test stays the last practice day of the plan week. |
| `lib/planV2.ts` `readRoutine` | Reads `restWeekdays` (checked: unique weekdays 0 to 6, the right count for the variant; anything else is ignored, so the default applies). |
| `writeNextWeek`, `weekClose/update.ts` (the layout read for the update) | Pass the routine's rest weekdays to `weekLayout`. |
| New `PATCH /api/goal/schedule` | Takes any of `planVariant`, `restWeekdays`, `dailyMinutes`, `preferredSlot`; checks them as onboarding does; refuses in week 12 (no next week: 409 `last_week`); saves `Goal.routine` and the pending weeks' `plannedMinutes` in one transaction; answers the date it starts. |
| `routes/goal/create.ts` | Accepts `routine.restWeekdays` from onboarding, checked the same way. |

**What already copes, unchanged:** missed-session carry and the recovery rules (they read the stored days, whatever their weekdays); the next week's handoff (places carried steps in the new week's sessions); the safety limits (next week's running is still held to last week's plus 10%, so training more days can't jump the load); the weekly update and checkpoints (they read done and planned sessions, not positions).

### Frontend

| Where | Change |
|---|---|
| Onboarding `StepSchedule.tsx` | Under "How many days a week?", the seven weekdays as toggles with the rest days preselected; picking a variant resets them to its default. |
| `AccountMenu.tsx` | "Edit my schedule" opens a `Dialog` with the same controls (days, minutes, time of day) and the "starts next week" line. |
| `lib/api.ts`, `GoalContext` | The new call; the goal's routine refreshed after saving. |

All with existing primitives (`Dialog`, `ChoiceGroup`, `SegmentedControl`, `Button`); no new component kind.

### Tests

- `weekLayout`: rest weekdays on any start weekday; the test day; no `restWeekdays` gives today's layout exactly (the existing week-prompt fixture stays byte for byte).
- The route: each field checked, week 12 refused, one transaction, the start date answered.
- The week close after a change: next week written with the new days, minutes and slot; the current week unchanged.
- Carry and handoff across a change of rest days (a moved step lands on a new practice day).
- The 90-day simulation: a person who changes from 5 to 4 days in week 5 still reaches week 12 with nothing broken.
- Frontend: the weekday toggles, the dialog, the payload.

Code review before merging (stored data and the week writer).

## 4. Order

1. Backend: `restWeekdays` in the layout and the routine, the route, the tests.
2. Onboarding: pick your days.
3. Edit my schedule: the dialog.

## 5. Out of scope

- Changing the rest of **this** week: it is already written; the swap covers a single day.
- Wake, sleep and busy hours: they only shape week 1 today, so editing them would change nothing later.
- Changing the goal, the method or the targets.

## 6. Mo's choices

a. **Free or Pro.** Recommended: free; it's core to sticking with any plan, pathway or custom.
b. **Two rest days in a row** (a weekend off). Today's defaults never put two together. Recommended: allow it; people choose it.
c. **Where to edit.** Recommended: the account menu, next to the time zone. Alternative: a link on Today.
d. **How often.** Recommended: any time; edits before the next week starts just replace each other.
