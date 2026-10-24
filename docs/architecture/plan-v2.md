# Plan v2 spec

Custom goal → 12-week plan, rebuilt around weekly targets that adapt to real results.
Every decision below was agreed in chat before any code was written.

## Flow

1. User types a goal → **Prompt 1 (clarify)** runs in the background while they fill in their schedule.
2. User answers 4 questions → **Prompt 2 (method + roadmap)**: final goal, method, rules, phases, 12 weekly targets.
3. **Prompt 3 (week call)** writes week 1.
4. Each week: the user logs the weekly test → **Prompt 4 (weekly update)** sets the remaining targets →
   **Prompt 3** writes the next week. A week whose review is skipped closes automatically on the first open after
   its last day closed (weekly update, `WEEK_CLOSE_ENABLED`); on Today the test card comes first when its test isn't
   logged, and the close then runs with the test logged or marked not logged. After a break (a gap of 7 days or
   more) there is no test card: the week closes at once as not logged, on every screen. While a choice past the
   28-day limit waits ("Keep going" or "Do my final week"), nothing closes on any screen. Prompt 4 runs on both paths only with
   `WEEK_CLOSE_ENABLED` and `WEEKLY_UPDATE_ENABLED` both `true`; otherwise the targets stay as planned and only
   prompt 3 runs. With `WEEK_CLOSE_ENABLED` off nothing closes a week but the review.
5. Photo/video tests → **Prompt 5 (proof judge)**.

Presets (guitar, chess, 10K and others) skip the method part of prompt 2: their method is fixed; their roadmap is
built from their own routine and questions.

Plan v2 is the only plan model (docs/decisions.md ND-21). Every goal is created with `planVersion: 2`; plan v1 and
its code were removed. A goal that is not plan v2 gets a refusal (`not_plan_v2`), never v1 behavior.

## Decisions

### Clarify
- Multiple choice with a "write your own" option, so answering is low-stress.
- Answers are never pre-filled.
- Every question has a visible "Skip this". The first skip (or an empty custom answer) re-asks it once with
  different wording (`retry`, returned up front by prompt 1, so no extra call). A second skip records it as
  skipped.
- Skipped answers get safe defaults in prompt 2: beginner, basic equipment, no target the user did not give.
  Never block someone from getting a plan.
- Daily minutes and active days are required schedule fields, never defaulted.
- Removed: `canonicalKey`, `capabilities`, `scientificFrameworks`, `verificationCriteria` (prompt and wizard).

### Method + roadmap
- The model chooses the method; the user does not. The method screen is view-only: method, why it was chosen,
  runner-up.
- No code scoring of methods. Only the code safety gate: safety < 3 → retry once.
- Phases (2-4) are decided by the method, not fixed to Foundation/Acceleration/Mastery.
- 12 weekly targets, each a number or a deliverable, each with an in-app test.
- The dashboard shows the current week's target and the final goal, with a progress bar. A "full plan" view shows
  all weeks but is not the default.
- Replaces: the old method call, the velocity table, the 12-week half of the old plan writer, the block menu.
- `startingPoint` (today's level in the targets' metric) anchors week 1 and the progress bar.
- Safety < 3 twice: the goal gets no plan (422), custom goal and preset alike; there is no fixed-plan fallback
  (ND-21). A goal blocked by the safety screen gets no plan either.
- A number target of 0 is rejected: weeks with nothing countable yet mean deliverables for all 12 weeks.

### Week call
- Once per week, including week 1. The goal, method and target are fixed inputs.
- The last practice day is the test day: short warm-up, the test, short review.
- 1-2 key sessions per week, mid-week, never on the test day.
- Each practice day has a 10-minute `minimumVersion`.
- Each step has a unique `priority` (1 = most important that day).
- Rest days: optionally one light step of 15 minutes at most.
- The user can swap today with another day in the week, or set today aside. They cannot edit numbers.
- Code, not the model, decides which days are practice, rest and test (from the days-a-week choice), fits step
  minutes, ranks priorities, and picks key sessions when the model marks none or too many.
- The test day may be shorter than the daily time; it is never padded. Break steps are dropped (breaks belong in a
  step's instructions). A rest day the model leaves out is filled in by code.
- On a physical goal (a load goal) code holds the week to numbers (plan-safety-limits M2.2a, RULE-5): the week's
  running total against the base week (last week planned, or done when under 70% was done) plus 10% or 10 minutes /
  1 km, the longest run, at most 2 hard runs, and each step's deficit, intake and (weeks 1 to 3) lifting load
  (`backend/src/lib/safety/weekLoad.ts`). A breach is a retry reason; a second one fails the week. A first week back
  after a break (M2.2b, RULE-7) is held instead to the newest week with done running, by what was done, with no
  allowance, half of it after 21 days or more away, never below 30 minutes / 5 km.
- If the week call fails twice, nothing is saved and the user is asked to retry.

### Weekly update
- A separate model call. The model sets the status and the targets for the weeks left.
- Status guide: on_track = hit the target; a_bit_behind = missed, 50%+ sessions; far_behind = under 50% sessions or
  skipped the key sessions. Weigh the trend over the last 3 weeks.
- The user only sees the one-sentence message, never a status label. If a target is lowered or held, the message
  says so plainly.
- Targets can be raised when someone clearly beats one, but never above the final goal before the last week.
- Checkpoints at weeks 4 and 8 (being built; `docs/features/checkpoints/02-feature.md`, CP-1): if code's forecast says the day-90 target is
  clearly out of reach, Today offers once to keep it or aim for a realistic day-90 target; week 8 can raise a lowered target again. No
  extensions: the plan always ends on day 90 (only breaks move it).

### Missed sessions
- No pile-up: a day that doesn't happen never makes another day longer, and the test day is protected. A moved
  step replaces the receiving day's lowest-priority steps.
- What moves depends on the step's kind (see "Recovery profiles and step kinds" below). A step without a kind, a
  goal without a valid profile, or the method switch off follows missed sessions' rules: only the day's
  priority-1 step moves, to one fixed receiving day (the next practice day), and a high-load step is dropped,
  not moved.
- Carry writes happen only when `MISSED_SESSIONS_CARRY_ENABLED` is exactly `true` (ND-15).
- The 10-minute minimum version is always available.
- Two far_behind weeks in a row → the next week starts with a re-test, and the app checks whether their daily time
  is realistic. Code decides the re-test after the weekly update and places the step (weekly update M3.3a, below).
  The goal responses send `retest` (`ofWeek`, `reason`, `logged`, and the re-test day's `taskId` and `date`) and
  `dailyTimeCheck` (`minutes`, `shorter`), worked out on the server (M3.3b, WU-58); Today shows the re-test line and
  its result entry, and asks once per run of hard weeks (with or without a re-test, never in week 12) whether the daily
  time still works (`POST /api/goal/daily-time`; a shorter time is read when the next week is
  written, the current week is unchanged).
- Tone: neutral and encouraging, never firm. After a miss, one line that moves forward; never ask why.
- Reminders before sessions: a later phase.

### Recovery profiles and step kinds
Spec: `docs/archive/method-aware-recovery/02-feature.md`. Code: `backend/src/lib/recovery/`. Code decides every
action; the model only tags steps (and, when switched on, writes a custom profile).
- **Profile.** Every plan v2 goal stores a checked profile under `recovery` in `Goal.roadmap`: 2 to 8 kinds plus a
  catch-all, Weekly test and Fixed-time session; each kind has one action and may be hard or in order; a rest gap
  of 0 to 2 days; a return rule. A pathway gets its hand-written profile (its domain template). A custom goal
  gets one of the 13 templates, picked by keywords and used unchanged; the profile call that adjusts it runs only
  when `CUSTOM_RECOVERY_PROFILES_ENABLED` is exactly `true` (off). An older goal gets its profile at its next
  weekly review.
- **Kinds.** The week call tags every practice-day step with a kind from the profile's menu; a missing or unknown
  kind fails the week (one retry). Code makes every test-day step Weekly test and a `highLoad` step hard. Rest-day
  steps have no kind; the 10-minute version takes the kind of the day's priority-1 step.
- **Actions.** Move: the day's highest-priority step of a move kind goes to the first later practice day this week
  (not the test day) where it fits, or it has no room this week; then the week writer is told, and a non-hard
  step takes next week's first session of its kind when it fits (a hard one is only told, MR-32). Continue:
  nothing moves; the next session of that kind gets a "Pick up where {Weekday} stopped." marker. Let go: nothing
  moves. Fixed: nothing moves, and no swap, carry or move-now ever moves it.
- **In-order kinds.** Steps of an in-order move kind are never lost: for the week holding today and the week
  before it, the remaining sessions of the kind hold the steps not done yet, in order (older weeks keep the
  ordinary move rules). What does not fit goes to next week, where code places it in the first
  sessions of the kind and tells the week writer where the person is. Nothing is carried out of week 12.
- **Rest gap.** A carry, swap or move-now never puts two hard steps closer than the profile's rest gap, and never
  makes a closeness that is already there smaller, counted in calendar days over every done or open day of the
  goal. A hard step that takes the place of a hard step is only checked for sharing that day (MR-29).
- **After a break.** The first hard step back starts with "First hard session after a few days off: keep the effort
  easy today." once (RULE-21). A moved physical step starts with a short warm-up line.
- **Switches.** All of this runs only when `METHOD_RECOVERY_ENABLED` is exactly `true` (on in production since
  2026-10-16). Off, the plan and the reconcile body are exactly missed sessions'. Writes still need
  `MISSED_SESSIONS_CARRY_ENABLED`. Both are set in the Render dashboard only, never from code or tests.

### In-app tests
- Types: `typing_test`, `quiz`, `timer`, `count`, `photo`, `video`. No `link` (the model cannot open links).
- Timer and count are judged by code. Photo and video are judged by prompt 5.
- Proof judge: pass / fail / unsure, always with a reason. On unsure, the user decides with "what to look for".
  If Gemini is out of quota (there is no fallback provider), the proof is stored and judged later.
- Files: Cloudflare R2 with signed upload URLs; Postgres stores only the key.

### Process
- Build in the user's path order: 1) clarify, 2) method + roadmap, 3) week call, 4) weekly update + missed
  sessions, 5) timer/count tests, 6) photo/video tests with R2, 7) cleanup of unused code.
- Each phase: Mo clicks through anything user-facing, then commit and push.

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

**System**

```text
You design the 12-week roadmap for one person's goal. You do not write daily tasks; another step does that.

Your job, in order:
1. Turn their goal and answers into one specific, checkable 90-day goal.
2. Choose the method with the best record of getting people like this person to this outcome.
3. Lay out 12 weeks, each with one target, that climb from where they are now to the goal.

Respond with one JSON object that matches the schema.
```

**Prompt**

```text
Goal as typed: "${workingTitle}" (${domain})
Time: ${dailyMinutes} minutes a day, ${activeDays} days a week, for 12 weeks.
Their answers:
- Where they are now: ${answers.current_level}
- What success looks like to them: ${answers.success}
- Equipment and environment: ${answers.equipment}
- Biggest obstacle: ${answers.obstacle}
(Skipped answers: assume a beginner, basic equipment, and no target they did not give.)

1. THE GOAL
   "finalGoal": their success answer as one specific outcome that can be checked on day 90.
   Keep their ambition exactly. If their answer is vague ("get better"), make it concrete at the level they
   described, using a real, recognised marker for this domain when one exists (e.g. "Twitch Affiliate",
   "25 words per minute", "a loaf with an open crumb"). Never raise or lower it.
   "finalTest": how they prove it on day 90, in one sentence.

2. THE METHOD
   List 2 or 3 real, established methods people use to reach this outcome. For each: "name", "creator"
   ("" if none or unsure), "summary", and "strengths" / "weaknesses" for THIS person.
   Choose the one most likely to get THIS person to the goal. What matters, in order:
   - Results: people who follow it actually reach this kind of outcome.
   - Sticking with it: people at their level keep doing it for 12 weeks with their time and days.
   - Fit: it matches where they are now, their equipment, and their obstacle.
   When an established, well-known program fits equally well, prefer it; it has a track record.
   A method built for a different starting level does not fit.
   "whyChosen": one or two sentences that cite their own answers.
   "runnerUp": the second-best, and in one sentence why it lost.
   "safety": 1 to 5, the risk of injury, burnout, or harm for this person on the chosen method (5 = very safe).
   "rules": 5 to 8 rules of the chosen method that every week must follow, e.g. "Hold 95% accuracy before
   adding speed". Rules, not tasks. No motivation lines.
   Names: name a program or creator only if you are sure it exists. Never invent a person, program, or book.

3. THE 12 WEEKS
   "phases": 2 to 4 phases in the order the method uses them. Each has "name", "startWeek", "endWeek",
   and "purpose" (one sentence). Together they cover weeks 1 to 12 with no gaps.
   "weeks": exactly 12. Each has:
   - "weekNumber", "phase" (a phase name from above).
   - "focus": what this week works on, in a few words.
   - "target": what they must reach by the end of the week. Either
       { "kind": "number", "metric", "value", "unit", "direction": "higher_is_better" | "lower_is_better" }
     or
       { "kind": "deliverable", "description" }, e.g. "one loaf with an even, open crumb".
     Use numbers whenever the goal can be counted and every week, week 1 included, has a count above 0 in that
     unit. Otherwise use deliverables for all 12 weeks. Never mix number weeks and deliverable weeks.
     Keep the same metric and unit every week, week 12 included, even when the final test reports on another scale.
     Counts that stay at 0 until late (sales, users, subscribers, customers, orders) can't be counted in week 1: use
     deliverables for all 12 weeks, and make week 12's the number, e.g. "50 sales of the template".
     Exams: one measure every week, e.g. metric "Practice test score", unit "percent".
   - "test": { "type": "typing_test" | "quiz" | "timer" | "count" | "photo" | "video", "instructions", "passIf" }.
     Prefer tests the app runs itself, then proof (photo, video), then a count. Use the same type every week.
   How the targets climb:
   - Week 1 starts just above where they are now: an early win, not a leap.
   - Steps are small in weeks 1 to 3, larger in the middle, and smaller again before the final test.
   - Never go backwards: a lighter week (a taper, a deload, a review week) or a harder test keeps the previous
     week's target. Week 12's target is the finalGoal.
   - A target is what they can do on that week's test, not how much they train that week.
   - Realistic for ${dailyMinutes} minutes a day and ${activeDays} days a week.
```

(Abridged; `buildRoadmapPrompt` in `backend/src/lib/ai/roadmap.ts` is the exact text. When the goal names a number,
`research/statedTarget.ts`, the prompt names it too.)

**Code checks:** 12 weeks; phases cover weeks 1-12 with no gaps; all 12 targets numbers or all deliverables, never a
mix; for numbers, the same metric and unit every week ("%" and "percent" count as one), above 0, never backwards
(flat is allowed), week 12 = final goal, week 1 a small step; safety < 3 → retry once with the reason; a number the
user typed in the goal must appear in week 12 (as the number target, or named in a deliverable week 12). A mix, a
unit change, a 0 target, a step backwards, low safety and a missed stated number are refused even on the last
attempt; the other checks give way on it.

**Safe steps (plan-safety-limits M1.2):** after those checks, code lowers any number target that climbs faster than
the limits allow (`safeTargetClimb` in `backend/src/lib/safety/targetSteps.ts`, numbers in `safety/limits.ts`): week 1
against the starting point, each later week against the (lowered) week before; an easier week is never changed. The
model's values are kept as `loweredTargets` in `Goal.roadmap`. A stated number the model's own week 12 met but the
lowering put out of reach is accepted at the highest safe step, and `finalGoal` is not asked for again then.

**Older goals on read (plan-safety-limits M1.3):** a goal stored before M1.2 is checked whenever it is read, by
`safeGoalTargets` in `backend/src/lib/safety/storedTargets.ts`, in `presentGoal` (every route that sends a goal) and in
`writeNextWeek` (what the week call is told). Nothing stored changes. A goal with no light test is checked on all 12
weeks; one with light tests on weeks 4, 8 and 12 only, four safe steps apart (`safeCheckWeekClimb`), and each light week
then takes its big week's lowered target. For a week whose target changed, `objective` is rebuilt; a pathway's measured
test, `keyMilestone` and (for week 12) `finalTest` are refilled from the preset when the stored test is the preset's
own; a model-written test (a custom goal, or an older pathway goal) keeps its text and `finalTest`, and only its pass
mark changes. A goal created since M1.2 comes back unchanged. A closed week (`completed` or jumped) keeps its stored
target, because its result was judged against it: the check starts from the last closed week's stored target (on a
light-test goal, the last closed of weeks 4 and 8, four safe steps to the next checked week), or from the starting
point when none is closed. Both readers use the same rule (the week `writeNextWeek` closes is still active).
`presentGoal` also sends `week12Line` (`{ safe, goal }` or null; for "lose N", `goal` is the starting point minus N)
whenever week 12 was lowered, at create or on read; the app shows the honest line
from it on the Roadmap, Today's closing stretch and the review. `writeNextWeek` logs one `[Safety]` `target_step` line
with outcome `lowered_on_read` when the week it writes was lowered on read.

## Prompt 3: week call

**System**

```text
You write one week of daily practice for a person following a 90-day plan. The goal, the method and this week's
target are already decided. Do not change them. Every day must move the person toward this week's target.
Respond with one JSON object that matches the schema.
```

**Prompt**

```text
THE PERSON
Goal: {finalGoal}
Current level: {answers.current_level}
Equipment: {answers.equipment}
Main obstacle: {answers.obstacle}
Time: {dailyMinutes} minutes a day on {activeDays}

THE METHOD
{method.name} by {method.creator}
Rules (follow every one):
{rules, one per line}

THIS WEEK
Week {n} of {totalWeeks}, phase "{phase.name}": {phase.purpose}
Focus: {week.focus}
Target: {target}
Weekly test: {test.instructions}. Pass if: {test.passIf}

LAST WEEK                                   (only from week 2)
Target: {prevTarget}. Result: {prevResult}. Sessions done: {done} of {planned}.
Key sessions skipped: {list or "none"}.
Coach's note: {guidanceForNextWeek from prompt 4}

WRITE THE WEEK
- 7 days, dayNumber 1-7. Days that fall on {activeDays} are practice days. The others are rest days.
- The last practice day is the test day. Its main step is the weekly test exactly as written above, with a
  short warm-up before it and a short review after it.
{with a re-test (weekly update M3.3a), on the first offered practice day before the test day:}
- Day {d} ({weekday}) starts with a re-test of week {N}'s test ({its instructions}), which
  code adds as its first step ({half} minutes).   (first in order, ranked right after the day's own lead) Plan the rest of that day around it, shorter: steps adding up to
  {dailyMinutes - half} minutes, and none that repeats the test.{on a running load goal: " The re-test counts as a hard run."}
- Mark 1-2 practice days (not the test day) as key sessions: the hardest sessions that matter most for the
  target. Put them mid-week.
- Each practice day has:
  - title: what they get done, e.g. "Hold a 3-minute conversation about your weekend", not "Speaking practice"
  - whyToday: one sentence on how this day moves them toward the target
  - 2-4 steps that each do something different, with minutes adding up to {dailyMinutes} (±5)
  - minimumVersion: one 10-minute step for days they can't do the full session. It must still move them
    toward the target.
- Each step has:
  - title and instructions: specific enough to start without looking anything up
  - minutes
  - output: what they end up with
  - doneWhen: the check that it's good enough
  - focusCue and pitfall
  - priority: 1 = most important today, no ties
  - timing (optional)
- No two practice days are the same. Most practice days include doing the real thing, not only preparing for it.
- Only use equipment they have. Match their level. Never assign loads beyond what is safe for their level.
- Rest days: no required steps. Optionally one light step of 15 minutes at most.
```

**Code checks:** 7 days; practice days match the active days; the test is on the last practice day; 1-2 key
sessions, not the test day; minutes add up; unique priorities per day; no identical practice days;
`minimumVersion` ≤ 10 minutes; rest steps ≤ 15 minutes; the existing vague-title and filler-step checks.

**Method-aware recovery (only with `METHOD_RECOVERY_ENABLED` on):** a goal with a recovery profile also gets the
`KINDS OF STEP` block (every step tags a kind, M2.1), and from M3.1d a `WHERE THEY ARE` block when last week hands
something on: per in-order kind, the steps not done yet (which code will place, where the person is and how far
behind), unfinished continue work, and moved steps that found no room. Nothing in it is checked; after the call,
code places the carried steps itself (`lib/recovery/handoff.ts`, RULE-20, MR-32).

**First week back (weekly update M1.5a, only with `WEEK_CLOSE_ENABLED` on):** after a break (a close 7 or more days
late) the week call ends with a `FIRST WEEK BACK` block: the days away and the return rule's "first week back" note,
plus "Keep every session at or below what they last completed." for a high-load goal. Told, never checked; never a
target. For a high-load goal, code then puts "First week back: keep the effort easy today." first on every hard
high-load step (`lib/recovery/firstWeekBack.ts`, WU-29, WU-35).

## Prompt 4: weekly update (after each weekly test, weeks 1-11)

As built in weekly update M3.1 (`backend/src/lib/ai/weeklyUpdate.ts`, read and saved by `lib/weekClose/update.ts`). It
runs on the weekly review and (M3.3a) the automatic close, only with `WEEK_CLOSE_ENABLED` and `WEEKLY_UPDATE_ENABLED`
both exactly `true`, only for weeks 1 to 11, and never before a choice past the limit (a break gets it since M3.4). The model
call (both attempts) has a 15 s limit (`WEEKLY_UPDATE_TIME_LIMIT_MS`, WU-52); past it the retry is not started. No checkpoint offer (WU-2) and no
`retestFirst`: code decides the re-test after the update (M3.3a).

**Schema (M3.3a):** a number week keeps `WEEKLY_UPDATE_SCHEMA` (each `nextTargets` item `kind` `number` or
`deliverable`). When this week's target and every week the model sets are deliverables, `WEEKLY_UPDATE_DELIVERABLE_SCHEMA`: items with `kind` fixed to
`deliverable` and `description` required, no `metric`, `value` or `unit`.

**System**

```text
You review one week of a person's 90-day plan and set the targets for the weeks that are left. You do not write
daily tasks. Respond with one JSON object that matches the schema.
```

**Prompt** (lines in brackets appear only when they apply)

```text
THE PLAN
Goal: {finalGoal}
Method: {method.name}. Rules: {rules}
Weeks left, as currently planned:
- Week {k}: {target}            (a light week: "light test week; shows week {big}'s target (code fills it in)")
[Only weeks {big weeks left} have the big test that measures the target. Each other week shows its next big week's
target; code fills those in.]

THIS WEEK (week {n})
Target: {target}                (a light week: "Next check: {target}. This week's test was the light test, ...")
Test result: {logged result, "light test done; their note: ...", or the not-logged line}
Sessions done: {done} of {planned}. Key sessions: {done} done, {skipped} skipped ({names}). A key session done only as
the 10-minute version counts as skipped.
10-minute versions used: {count}. Missed days: {count}, of which {count} not moved (B-96: each missed day counted once).
(when reconcile can't count the week: "Sessions done: {done} of {planned}. Key sessions, 10-minute versions, missed and
dropped days: not counted.")
Their note: {reflection or "none"}

[WHERE THEY ARE in each in-order kind of step (the first step not done yet):
- {kind name}: at "{step}", {k} steps still to do ({s} sessions of it this week)[; a week behind]]
  ({kind name}: the profile `name` in lower case, or its plain word from `KIND_WORDS` in `weekClose/update.ts` when it reads
  badly in "catch up on {name}", e.g. "strength workouts"; M4.1a, WU-61 (5); a name that fails the copy check, a
  forbidden word or a question, is sent as "one kind of step" and its hold line below says "without naming it
  ("...so you can catch up")", RULE-7)

LAST 3 WEEKS
- Week {w}: target {target}; result: {result}; sessions done: {done of planned}; status: {status or none}

[BREAK                          (M3.4: only on a break with a restart)
- They were away {d} days. The method's return rule for a break this long: {restart at the last level reached | go back
  1 week | go back 2 weeks} (week {k}'s target).
- {Held} must be exactly {level}. Spread the remaining weeks from there up to week 12; none easier than it.
- The app already welcomes them back, so the message must not greet them or say "welcome back".]
                                (when `restartLevel` fell back, the first line is "They were away {d} days. The restart
                                stays at this week's target (week {n})."; SAFETY then names the first week the model sets
                                after the restart week, one safe step above the level, four on a light-test goal, none when
                                that week is week 12)

[SAFETY
- The most week {k} may be: {nextSafeStep} (one safe step). Code lowers anything past it.]

DECIDE
1. status: on_track / a_bit_behind / far_behind, as before. Weigh the trend.
2. nextTargets: one target for each of weeks {asked}, in order: { weekNumber, kind: "number", metric, value, unit } or
   { weekNumber, kind: "deliverable", description }.   (only deliverables to set: only the deliverable shape, M3.3a)
   - on_track: keep the plan; raise only if they clearly beat the target, never above week 12's target before week 12.
   - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
   - far_behind: {held}'s target equals this week's target.   (when next week shows week 12's target: "Week {n+1}
     shows week 12's target: it keeps the goal whatever the status, and the message says the final week aims at the goal.")
     (M3.4, on a break: "After the break, {held}'s target equals {level} whatever the status." instead, and none of
     the hold lines below)
   - [The test was not logged: {held}'s target must not be higher than this week's.]   (not after a light week, WU-54)
   - [They are a week behind in {kinds}: {held}'s target must not be higher than this week's; the message names it.]
   - Never easier than what they last achieved ({bound}, at most week 12's target); no week easier than the week before
     it. [A held {held} may stay at this week's target instead.] (only when the bound is above this week's target)
     (M3.4, on a break: "Never set a target easier than the restart level ({level}), ...")
   ({held} is the week the model sets (WU-49): "week {n+1}", or on a light-test goal when next week is a light week
   "week {big} (next week shows it)", its next big week; the retry reasons name the same week.)
   - Week 12 stays exactly {week 12's current target}. Keep each week's kind, metric and unit.
   - In the message, don't say held, kept or stays when next week's target moves on, or goes up, raised or rises when
     it stays the same.   (M3.3a: WU-51's rule, told as well as checked)
   - For a target where lower is better, say it "gets harder" or "moves to" the new amount, never "goes up".
     (M4.1a, WU-61 (4): told only; `directionReason` is unchanged)
3. messageToUser: one sentence, neutral and encouraging; say plainly if next week is held or lowered. Never a question,
   never "missed", "behind", "failed" or "fail".
4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks.
```

**After a break (M3.4, RULE-16, WU-16, WU-59):** "next week" is the week the close writes (`WeekMove.weekBack`; after
"Keep going" the weeks between are read as closed and jumped, so the weeks left are `weekBack` to 12 and none of them is
ever stored), `{n+1}` above reads as that week, and the climb starts as `safeStoredTargets` reads the goal after the save.
The restart level (`restartLevel` in `weekClose/breaks.ts`) is the stored target of week `max(1, n - back)` (`back` 0,
1 or 2 from the return rule's entry for `breakDays`; no profile or entry: `last level`), never harder than week `n`'s
(week `n`'s is used when it is, or when the kind or unit differs); on a light-test goal the target that week shows. None
when next week shows week 12's target ("Do my final week" included); the update still runs then. The week the model
sets for next week must be exactly the level (a number within 1e-9, a deliverable's text exactly), the level is the
lower bound of every week left, and the `far_behind`, unlogged and week-behind holds are not applied. No status is
stored. A fallback (rejected twice, timed out, a call error) sets that week and the light weeks before it to the level
through the same climb and storing path, with "Next week picks up at {level}." as its line ("Week {w} picks up at {level}." naming the big week when next week
is a light week; the amount as `nextWeekSentence` shows it). On a break a sentence saying "welcome back" is a retry reason. The re-test gains reason
`break` (one re-test; the easy one from the start on a high-load goal).

Its inputs: the week's stored or sent test result; `weekCounts` from the day kinds and carry plan reconcile works out
(read only); the last 3 closed weeks with their review rows and `updateStatus`; the weeks left from `safeGoalTargets`;
with `METHOD_RECOVERY_ENABLED` on, each in-order kind from the finished week's handoff (`weekHandoff`), a week behind
when its steps still to do are at least its sessions that week (the test day not counted) and at least 2 (WU-11).

**Code checks (RULE-4, WU-15, WU-20 (3), WU-45):** the weeks returned are exactly the weeks asked, in order (on a
light-test goal only the big weeks left; code then fills each light week with its next big week's target); a week's
kind and unit do not change (WU-50: the metric is not compared; a missing unit or the same unit through its aliases is
accepted, and code keeps the week's own metric and unit, taking only the value); no target easier than the last usable result (the newest measured week up to
this one, a light test never counts; no bound without one; the unit read as the stated-target reading unifies it, so
"min" is "minutes"), never above week 12's current target (WU-46 (2)), and a held next week may go down to this week's
target even when the result is higher (WU-46 (1)); no week easier than the one before; no week before 12
harder than week 12's current target; week 12 is its current target; `far_behind` holds next week at this week's
target; a kind a week behind and an unlogged test block a raise of next week; none of the holds applies when next week
shows week 12's target (week 12 itself, or a light week whose next check is week 12, WU-47); the sentence is not empty, asks no question and has no forbidden word, and (WU-51) does not say
"held", "kept" or "stays" while next week's target (the one next week shows) went up, or "goes up", "went up", "moves
up", "rises" or "raised" while it stayed the same (never a bare "up"; a deliverable with new text has gone up). Deliverables: the count, still a
deliverable, week 12's text unchanged, and a held week (any hold) repeats this week's text exactly. One retry with every
reason; a second rejection, no answer, a time out (`time_limit`) or an error from the call (`error`) is the fallback: targets as planned, no status stored, no coach's note, and
"Next week is ready. Your targets stay as planned." Except (WU-48): when an unlogged test or a kind a week behind holds
(never `far_behind`, the model's call; none when next week shows week 12's target), the week next week shows is kept
at this week's target when it was planned harder (on a light-test goal the next big week, with the light weeks before
it), those targets go through the safety climb and storing below as accepted ones do, and the line is "Next week keeps
this week's target." whenever next week then shows this week's target (week 12's safe-step sentence wins when the hold
forces week 12 down). The `[WeeklyUpdate]` line names the holds as `held <...|none>`.

**Safety (RULE-10, WU-45 (3)):** after the checks pass, the targets go through the same climb `safeGoalTargets` runs
once the week is closed (`safeTargetClimb` from this week's target; on a light-test goal `safeCheckWeekClimb` on the big
weeks from the last big week up to this one, or the starting point), so a read never lowers what was stored. A week
past a safe step is lowered to it (`[Safety]` `target_step` `lowered_on_update`, after the close is saved). Week 12
lowered this way is accepted: its `Goal.roadmap.loweredTargets` entry is set, a pathway's `Goal.roadmap.finalTest`
follows its rebuilt week 12 test (whenever week 12 is stored, also one lowered on read that the read-back stores), and the sentence is code's ("Week 12 aims at {safe}, a safe step. Your {goal} goal is
the next step.", the second sentence only when the person named a number; when the week next week shows is held at this week's
target, " Next week stays at {amount}." follows, M4.1a, WU-61 (3)). When safety lowers next week and not week
12, the sentence is "Next week aims at {amount}, a safe step." (WU-46 (3); the amount with no metric label, " or less" for a
lower-is-better target, M3.2b). A week only lowered on read that the update
leaves as it was is not stored; a week the read would climb differently once an earlier week changed is stored at the
update's value, so the read and the update agree.

**Saved:** the update runs before the week is written; the week call gets the new targets and `guidanceForNextWeek` as
"Coach's note". In the close's transaction, after the conditional update: the closing week's `updateStatus`, each
changed week's `target`, `objective`, `keyMilestone` and `test` (the code-written text, as plan-safety-limits M1.3
rebuilds it), week 12's `loweredTargets` entry and `finalTest` (one read-modify-write of `Goal.roadmap`), and the review
row's insight = the sentence. One
`[WeeklyUpdate] goal <id> week <n> status <s|none> restart <last level|back 1 week|back 2 weeks|none> outcome <accepted|retry_accepted|fallback> held <...|none> lowered <k> stored <weeks|none> readBack <weeks|none> retest <break|not_logged|two_hard_weeks, comma-joined|none> reasons <json|none>`
line per update.

## Prompt 5: proof judge (photo and video tests only)

**System**

```text
You check a person's proof for their weekly test. Judge only against the pass rule. Always give a reason.
Respond with one JSON object that matches the schema.
```

**Prompt**

```text
Goal: {finalGoal}
This week's target: {target}
Test: {test.instructions}
Pass if: {test.passIf}
Their proof: [image or video attached]  {optional note they typed}

Return:
- verdict: "pass" | "fail" | "unsure"
- reason: 1-2 sentences about what you can actually see
- fix: if fail, one concrete thing to change next time
- whatToLookFor: if unsure, what the person should check themselves to decide
Use "unsure" if the proof is unclear, cut off, or doesn't show what the test asks for. Never guess a pass.
```
