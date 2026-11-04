# Plan v2 spec

Custom goal → 12-week plan (or a shorter one before a fixed date), one week written at a time from what the person
did. **No weekly tests (2026-10-30, `docs/features/no-weekly-tests/plan.md`, decisions.md ND-35):** there are no weekly
targets, tests, checkpoints or final test, and no weekly update call. Each week has a focus inside the method's
phases; the next week is written from last week's sessions done, how they felt and the person's notes.

## Flow

1. User types a goal → **Prompt 1 (clarify)** runs in the background while they fill in their schedule.
2. User answers 4 questions → **Prompt 2 (method + roadmap)**: final goal, method, rules, phases, each week's focus,
   and, for a goal counted in one number, its `measure` with today's level as the starting point.
3. **Prompt 3 (week call)** writes week 1.
4. Each week closes by the weekly review ("how did it go" plus a note) or automatically on the first open after its
   last day closed (`WEEK_CLOSE_ENABLED`); either way **Prompt 3** writes the next week, told what last week was
   (below). After a break (a gap of 7 days or more) the first week back is told the days away and the return rule's
   restart level. While a choice past the 28-day limit waits ("Keep going" or "Do my final week"), nothing closes on
   any screen. With `WEEK_CLOSE_ENABLED` off nothing closes a week but the review.
   The review is accepted from the week's last day on, and a day can only be completed from its own date on, both
   in the person's time zone (ND-24), so a week can't be crammed and closed early.

Presets (guitar, chess, 10K and others) skip the method part of prompt 2: their method is fixed; their roadmap is
built from their own routine and questions. Their method text still names its old weekly tests; the prompt tells the
model the plan has none and to keep only the method's order and phases.

**Plan length (B-109, `docs/features/fixed-date-plans/plan.md`).** A plan is 12 weeks unless the goal has a fixed
date (an exam, a race, a talk) under 12 weeks away. Then it has the whole weeks that fit before the date, 4 to 11
(`Goal.totalWeeks`; `lib/planLength.ts` on the server, `frontend/src/lib/planLength.ts` in the app), and the last is
an easier "ready" week. "Do my final week" goes to the last full week before it (`PlanShape.finalWeek`). A date under
4 weeks away gets no plan (400 `fixed_date_too_close`). Wherever this spec says "12 weeks", "week 12" or "day 90", a
shorter plan reads its own weeks and its last day.

Plan v2 is the only plan model (docs/decisions.md ND-21). Every goal is created with `planVersion: 2`; plan v1 and
its code were removed. A goal that is not plan v2 gets a refusal (`not_plan_v2`), never v1 behavior.

**Goals made before the weekly tests went** keep their stored `RoadmapWeek.target`, `test`, `testResult`,
`retestOfWeek`, `updateStatus` and `Goal.roadmap.finalTest`, `checkpoints`, `loweredTargets`. Nothing reads or writes
them any more (the safety limits read an old week's number target when the goal has no `measure`), the goal response
leaves them out (`presentGoal`), and a stored test day is an ordinary session. Dropping the columns is backlog B-111.

## Decisions

### Clarify
- Multiple choice with a "write your own" option, so answering is low-stress.
- Answers are never pre-filled.
- Every question has a visible "Skip this". The first skip (or an empty custom answer) re-asks it once with
  different wording (`retry`, returned up front by prompt 1, so no extra call). A second skip records it as
  skipped.
- Skipped answers get safe defaults in prompt 2: beginner, basic equipment, no number the user did not give.
  Never block someone from getting a plan.
- Daily minutes and active days are required schedule fields, never defaulted.
- Removed: `canonicalKey`, `capabilities`, `scientificFrameworks`, `verificationCriteria` (prompt and wizard).

### Method + roadmap
- The model chooses the method; the user does not. The method screen is view-only: method, why it was chosen,
  runner-up.
- No code scoring of methods. Only the code safety gate: safety < 3 → retry once.
- Phases (2-4) are decided by the method, not fixed to Foundation/Acceleration/Mastery.
- Each week has a `focus`: what it works on, in the method's order (an empty one takes its phase's purpose).
- `measure` (`metric`, `unit`, `direction`) only for a goal counted in one number; `startingPoint.value` is today's
  level in it, and null without a measure. A next plan holds the starting point to the level the person typed.
- Safety < 3 twice: the goal gets no plan (422), custom goal and preset alike; there is no fixed-plan fallback
  (ND-21). A goal blocked by the safety screen gets no plan either.

### Week call
- Once per week, including week 1. The goal, method and focus are fixed inputs.
- No test day: every practice day is an ordinary session, and the prompt says "No tests".
- 1-2 key sessions per week, mid-week.
- Each practice day has a 10-minute `minimumVersion`.
- Each step has a unique `priority` (1 = most important that day).
- Rest days: optionally one light step of 15 minutes at most.
- The user can swap today with another day in the week, or set today aside. They cannot edit numbers.
- Code, not the model, decides which days are practice and rest (from the days-a-week choice or the chosen rest
  weekdays), fits step minutes, ranks priorities, and picks key sessions when the model marks none or too many.
- Break steps are dropped (breaks belong in a step's instructions). A rest day the model leaves out is filled in by
  code.
- **Last week, and the pace (section 7 of the no-weekly-tests plan).** From week 2 the writer gets LAST WEEK
  (`lastWeekOf` in `lib/planV2.ts`): practice sessions done of planned (rest days and days not offered left out),
  the key sessions skipped (a 10-minute version counts as skipped), how many done sessions were tapped too easy,
  just right or too hard, every day's note word for word ("Tuesday: my knee hurts"; one line, at most 400 characters), the review's reflection
  when there is one (at most 1,000), and the pace line code picks (`paceOf` in `lib/ai/weekPlan.ts`): 80% or more done and mostly too easy,
  a bigger step; 80% or more otherwise, move on as the method says; 50% to 79%, or mostly too hard, the same level with
  a small step; under 50%, repeat last week's level a little lighter. A shorter plan's ready week is told to stay
  lighter whatever last week was. The running week is never rewritten.
- On a physical goal (a load goal, from the goal's `measure` and the pathway) code holds the week to numbers
  (plan-safety-limits M2.2a, RULE-5): the week's running total against the base week (last week planned, or done
  when under 70% was done) plus 10% or 10 minutes / 1 km, the longest run, at most 2 hard runs, and each step's
  deficit, intake and (weeks 1 to 3) lifting load (`backend/src/lib/safety/weekLoad.ts`). A breach is a retry reason;
  a second one fails the week. A first week back after a break (M2.2b, RULE-7) is held instead to the newest week
  with done running, by what was done, with no allowance, half of it after 21 days or more away, never below
  30 minutes / 5 km.
- If the week call fails twice, nothing is saved and the user is asked to retry.

### How a session felt
- After a session is done, Today asks "How did it feel?": Too easy, Just right, Too hard (`FeelPicker`). Optional;
  a tap saves at once (`PATCH /api/goal/tasks/:id` with `feel`, stored on `DailyTask.feel`), only on a done task, and
  marking the task not done clears it. "Add a note" opens the day's notes, which the writer also reads.
- Used only when the next week is written. Changing the rest of the running week after two "too hard" taps is idea
  I-32.

### Missed sessions
- No pile-up: a day that doesn't happen never makes another day longer. A moved step replaces the receiving day's
  lowest-priority steps.
- What moves depends on the step's kind (see "Recovery profiles and step kinds" below). A step without a kind, a
  goal without a valid profile, or the method switch off follows missed sessions' rules: only the day's
  priority-1 step moves, to one fixed receiving day (the next practice day), and a high-load step is dropped,
  not moved.
- Carry writes happen only when `MISSED_SESSIONS_CARRY_ENABLED` is exactly `true` (ND-15).
- The 10-minute minimum version is always available.
- Two closed weeks in a row under half done → the goal response sends `dailyTimeCheck` (`minutes`, `shorter`,
  `lib/weekClose/dailyTime.ts`), and Today asks once per run of hard weeks (never in the last week) whether the daily
  time still works (`POST /api/goal/daily-time`; a shorter time is read when the next week is written, the current
  week is unchanged).
- Tone: neutral and encouraging, never firm. After a miss, one line that moves forward; never ask why.

### Recovery profiles and step kinds
Spec: `docs/archive/method-aware-recovery/02-feature.md`. Code: `backend/src/lib/recovery/`. Code decides every
action; the model only tags steps (and, when switched on, writes a custom profile).
- **Profile.** Every plan v2 goal stores a checked profile under `recovery` in `Goal.roadmap`: 2 to 8 kinds plus a
  catch-all, Weekly test and Fixed-time session; each kind has one action and may be hard or in order; a rest gap
  of 0 to 2 days; a return rule. Weekly test stays for steps stored before the weekly tests went and is never offered
  to the week writer. A pathway gets its hand-written profile (its domain template). A custom goal gets one of the
  13 templates, picked by keywords and used unchanged; the profile call that adjusts it (reading each week's focus and
  the measure) runs only when `CUSTOM_RECOVERY_PROFILES_ENABLED` is exactly `true` (on since 2026-10-28).
- **Kinds.** The week call tags every practice-day step with a kind from the profile's menu; a missing or unknown
  kind fails the week (one retry). Code makes a `highLoad` step hard. Rest-day steps have no kind; the 10-minute
  version takes the kind of the day's priority-1 step.
- **Actions.** Move: the day's highest-priority step of a move kind goes to the first later practice day this week
  where it fits, or it has no room this week; then the week writer is told, and a non-hard step takes next week's
  first session of its kind when it fits (a hard one is only told, MR-32). Continue: nothing moves; the next session
  of that kind gets a "Pick up where {Weekday} stopped." marker. Let go: nothing moves. Fixed: nothing moves, and no
  swap, carry or move-now ever moves it.
- **In-order kinds.** Steps of an in-order move kind are never lost: for the week holding today and the week
  before it, the remaining sessions of the kind hold the steps not done yet, in order (older weeks keep the
  ordinary move rules). What does not fit goes to next week, where code places it in the first sessions of the kind
  and tells the week writer where the person is; a new step it displaces moves to the end of the queue, never lost.
  Nothing is carried out of the last week.
- **Rest gap.** A carry, swap or move-now never puts two hard steps closer than the profile's rest gap, and never
  makes a closeness that is already there smaller, counted in calendar days over every done or open day of the
  goal. A hard step that takes the place of a hard step is only checked for sharing that day (MR-29).
- **After a break.** The first hard step back starts with "First hard session after a few days off: keep the effort
  easy today." once (RULE-21). A moved physical step starts with a short warm-up line. The week writer is told the
  return rule's restart level ("go back one week: the level of the week before their last one").
- **Switches.** All of this runs only when `METHOD_RECOVERY_ENABLED` is exactly `true` (on in production since
  2026-10-16). Off, the plan and the reconcile body are exactly missed sessions'. Writes still need
  `MISSED_SESSIONS_CARRY_ENABLED`. Both are set in the Render dashboard only, never from code or tests.

### The end of a plan
- The closing stretch (the days after the last week) has no final test: what they did, a reflection, "Complete my
  journey". The end screen says "You finished 11 of 12 weeks: 52 of 60 sessions." (`journeyResult`, `lib/nextPlan.ts`).
- A next plan of a goal counted in a number always asks where they are now (nothing is measured by the plan); any
  other goal starts from what they did.

## Prompt 1: clarify

**System**

```text
You help a person start a 90-day goal. You do not write the plan. Your only job is to understand the goal
well enough to ask four questions whose answers will shape the plan.

Respond with one JSON object that matches the schema.
```

**Prompt**

```text
The goal as the user typed it: "${rawGoal}"

1. "workingTitle": restate the goal as a short, plain action title (4 to 10 words), keeping the user's meaning.
   Do not add targets or numbers the user did not give; the user defines success in question 2.
   Good: "Become a live streamer", "Bake sourdough bread at home". Bad: "Master the art of streaming by Day 90".

2. "domain": the activity in 1 to 3 words, named by what the person actually does ("Live streaming",
   "Bread baking", "Touch typing"), never by adjectives or nationalities in the title
   ("French sourdough" is "Bread baking").

3. "questions": exactly 4, in this order. Each has "id", "question", "subtitle" (one short line on why we ask),
   3 to 5 "options" written for THIS goal, "allowCustom": true, and "retry": the same question asked a
   different, easier way ("question" and "subtitle"), shown if they skip it the first time.

   a. id "current_level": where they are now, as something they can measure or state as a fact,
      not a self-rating. Ask for a count, a time, a result, or what they have already done.
   b. id "success": "In 90 days, what would make you say this worked?" Options are concrete, checkable outcomes
      for this goal at different sizes, from modest to ambitious.
   c. id "equipment": what they have or can use for this goal (tools, gear, space, access), from minimal to full.
   d. id "obstacle": the thing most likely to stop them, specific to this goal, not only "time" and "motivation".

Keep every question short enough to read in one glance. No jargon the user would have to look up.
```

(The implemented prompt in `backend/src/lib/ai/clarify.ts` also carries the good/bad examples for each question.)

**Code checks:** 4 questions with exactly these ids in this order; 3-5 distinct, non-empty options each; a
non-empty `retry`; the title is 2-12 words. One retry with the reason, then an error.

## Prompt 2: method + roadmap

The prompt is `buildRoadmapPrompt` and `roadmapSystem` in `backend/src/lib/ai/roadmap.ts`; the check is
`checkRoadmapAnswer` (phases cover the weeks with no gaps, exactly the plan's weeks, 5 to 8 rules, safety 3 or more,
the chosen method among the candidates, a clean `measure` or none, and a next plan's starting point held to the level
the person typed). No target, test or final test is asked for or kept.

## Prompt 3: week call

The prompt is `buildWeekPrompt` and `weekSystem` in `backend/src/lib/ai/weekPlan.ts` (pinned for a typing goal in
`backend/test/fixtures/weekPrompt.before-m2.1.txt`, with a profile in `weekPrompt.with-profile.txt`, and for a run10k
load goal in `weekPrompt.run10k-m2.2a.txt`); the check is `checkWeekAnswer`. The blocks it adds: LAST WEEK (above),
SAFETY LIMITS on a load goal, KINDS OF STEP with a profile, WHERE THEY ARE when last week hands on in-order steps, and
FIRST WEEK BACK after a break.

## Removed prompts

Prompt 4 (the weekly update, which set the remaining targets after each weekly test) and prompt 5 (the proof judge
for photo and video tests) went with the weekly tests on 2026-10-30.
