# Plan v2 spec

Custom goal → 12-week plan, rebuilt around weekly targets that adapt to real results.
Every decision below was agreed in chat before any code was written.

## Flow

1. User types a goal → **Prompt 1 (clarify)** runs in the background while they fill in their schedule.
2. User answers 4 questions → **Prompt 2 (method + roadmap)**: final goal, method, rules, phases, 12 weekly targets.
3. **Prompt 3 (week call)** writes week 1.
4. Each week: the user logs the weekly test → **Prompt 4 (weekly update)** sets the remaining targets →
   **Prompt 3** writes the next week. If the test is never logged, this runs the first time they open the app in
   the new week, with the test marked missing.
5. Photo/video tests → **Prompt 5 (proof judge)**.

Presets (guitar, chess, 10K and others) skip the method part of prompt 2: their method is fixed; their roadmap is
built from their own routine and questions.

Old goals (made before v2) keep working on the old code. New goals are flagged `planVersion: 2`.

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
- Safety < 3 twice: custom goals get "try a smaller goal"; presets fall back to their fixed plan (v1). Only a goal
  blocked by the safety screen gets no plan at all.
- A number target of 0 is rejected: weeks with nothing countable yet mean deliverables for all 12 weeks.

### Week call
- Once per week, including week 1. The goal, method and target are fixed inputs.
- The last practice day is the test day: short warm-up, the test, short review.
- 1-2 key sessions per week, mid-week, never on the test day.
- Each practice day has a 10-minute `minimumVersion`.
- Each step has a unique `priority` (1 = most important that day).
- Rest days: optionally one light step of 15 minutes at most.
- The user can swap today with another day in the week, or mark today missed. They cannot edit numbers.
- Code, not the model, decides which days are practice, rest and test (from the days-a-week choice), fits step
  minutes, ranks priorities, and picks key sessions when the model marks none or too many.
- The test day may be shorter than the daily time; it is never padded. Break steps are dropped (breaks belong in a
  step's instructions). A rest day the model leaves out is filled in by code.
- If the week call fails twice, nothing is saved and the user is asked to retry.

### Weekly update
- A separate model call. The model sets the status and the targets for the weeks left.
- Status guide: on_track = hit the target; a_bit_behind = missed, 50%+ sessions; far_behind = under 50% sessions or
  skipped the key sessions. Weigh the trend over the last 3 weeks.
- The user only sees the one-sentence message, never a status label. If a target is lowered or held, the message
  says so plainly.
- Targets can be raised when someone clearly beats one, but never above the final goal before the last week.
- Checkpoints at weeks 4 and 8: if the goal is out of reach at their pace, offer a lower goal or a 1-week
  extension. At most 2 extensions per plan; beyond that, re-run the questions and start a revised plan.

### Missed sessions
- No pile-up: only the missed day's priority-1 step moves to the next practice day, replacing that day's
  lowest-priority step. The day never gets longer.
- The 10-minute minimum version is always available.
- Two far_behind weeks in a row → the next week starts with a re-test (`retestFirst`), and the app checks whether
  their daily time is realistic.
- Tone: neutral and encouraging, never firm. After a miss, one line that moves forward; never ask why.
- Reminders before sessions: a later phase.

### In-app tests
- Types: `typing_test`, `quiz`, `timer`, `count`, `photo`, `video`. No `link` (the model cannot open links).
- Timer and count are judged by code. Photo and video are judged by prompt 5.
- Proof judge: pass / fail / unsure, always with a reason. On unsure, the user decides with "what to look for".
  If Gemini is out of quota (the Groq models cannot see images), the proof is stored and judged later.
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
     Use numbers whenever the goal can be counted. Keep the same metric and unit every week.
   - "test": { "type": "typing_test" | "quiz" | "timer" | "count" | "photo" | "video", "instructions", "passIf" }.
     Prefer tests the app runs itself, then proof (photo, video), then a count. Use the same type every week.
   How the targets climb:
   - Week 1 starts just above where they are now: an early win, not a leap.
   - Steps are small in weeks 1 to 3, larger in the middle, and ease off before the final test.
   - Never go backwards. Week 12's target is the finalGoal.
   - Realistic for ${dailyMinutes} minutes a day and ${activeDays} days a week.
```

**Code checks:** 12 weeks; phases cover weeks 1-12 with no gaps; for numbers, the same metric and unit every week,
never backwards, week 12 = final goal, week 1 a small step; safety < 3 → retry once with the reason; a number the
user typed in the goal must appear in week 12.

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
{if retestFirst:} "Their last two weeks were weak. Make the first practice day a re-test using the weekly test,
so the plan resets to their real level."

WRITE THE WEEK
- 7 days, dayNumber 1-7. Days that fall on {activeDays} are practice days. The others are rest days.
- The last practice day is the test day. Its main step is the weekly test exactly as written above, with a
  short warm-up before it and a short review after it.
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

## Prompt 4: weekly update (after each weekly test, weeks 1-11)

**System**

```text
You review one week of a person's 90-day plan and set the targets for the weeks that are left. You do not write
daily tasks. Respond with one JSON object that matches the schema.
```

**Prompt**

```text
THE PLAN
Goal: {finalGoal}
Method: {method.name}. Rules: {rules}
Weeks left, as currently planned: {week n+1 … last week, each with target}
Extensions used: {0-2} of 2

THIS WEEK (week {n})
Target: {target}
Test result: {result or verdict + reason, or "not logged"}
Sessions done: {done} of {planned}. Key sessions: {done/skipped, by name}
10-minute versions used: {count}. Missed days: {count}
Their note (optional): {note}

LAST 3 WEEKS
{week, target, result, sessions done, status}

DECIDE
1. status:
   - on_track: they hit the target
   - a_bit_behind: they missed it but did 50%+ of sessions
   - far_behind: they did under 50%, or skipped the key sessions
   Weigh the trend. One bad week after good ones is not the same as three weeks declining.
2. nextTargets: targets for every week left.
   - on_track: keep the plan. Raise it only if they clearly beat the target, never above the goal before the
     last week.
   - a_bit_behind: make the next step smaller and spread the remaining climb over the weeks left.
   - far_behind: next week's target equals this week's target.
   - Never set a target below what they just achieved. The last week must equal the goal.
3. messageToUser: one sentence, neutral and encouraging. Say what happens next, and say plainly if next week's
   target is held or lowered. Never ask why they missed.
4. guidanceForNextWeek: 1-2 sentences for the person writing next week's tasks.
5. retestFirst: true if this week and last week were both far_behind.
6. Only at week 4 and week 8: if the goal is no longer reachable at their pace, add checkpointOffer:
   - lowerGoal: a realistic final goal value
   - extend: true if extensions used < 2
```

**Code checks:** the number of targets equals the weeks left; same metric and unit; nothing below the latest
result, nothing backwards; the last target equals the goal (unless the user accepted a lower one); no target above
the goal before the last week; `retestFirst` matches the real history; `checkpointOffer` only at weeks 4 and 8.
One retry; if it fails again, the targets stay as planned and next week gets a neutral note.

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
