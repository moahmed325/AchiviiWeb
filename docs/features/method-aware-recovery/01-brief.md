# Achivii Method-Aware Recovery — Brief

**Status:** DIRECTION CHOSEN
**Date:** 2026-10-08
**Links:** `docs/archive/missed-sessions/03-feature.md` (the recovery rules this changes), `docs/architecture/plan-v2.md`, `docs/features/weekly-update/02-feature.md` (paused for this, WU-10), `docs/features/method-aware-recovery/decisions.md`

## 1. The problem
When a day doesn't happen, the app treats every task the same way: move the most important step to the next open day, offer a swap for key sessions, and let the person swap days or move a step. It never asks what kind of task the step is, or what the goal's method says about doing it on another day. So the app can follow its own rules perfectly and still do something the method would never allow: harmful (injury risk), wasteful (broken order or timing) or pointless (making up a habit).

> "These things never consider what type of task they are … some tasks can't just be juggled around, the type of goal/task determines how it is dealt with." (Mo, 2026-10-08)

## 2. Who and when
Every plan v2 user, whenever a day doesn't happen, they set today aside, swap two days or move a step. Most visible on goals whose methods care about order, rest or timing: running, strength, languages, instruments, writing and building.

## 3. What we know
- **Fact:** the carry planner moves a day's priority-1 step to the next open practice day, replacing that day's lowest-priority steps so the day never gets longer (`fitCarriedStep`, `planCarries` in `backend/src/lib/carryForward.ts`).
- **Fact:** the only things it looks at are the step's priority, the test day, key sessions and one high-load flag (`isHighLoadStep`, `backend/src/lib/highLoad.ts`). High-load is all-or-nothing for `run10k` and `recomp` goals, or set per step by the week call (`highLoad` in `WEEK_RESPONSE_SCHEMA`, `backend/src/lib/ai/weekPlan.ts`).
- **Fact:** a swap exchanges two open practice days in the same week; it only protects the test day and key sessions (missed sessions M2.4).
- **Fact:** the week call already returns structured steps (title, minutes, priority, highLoad, ...) checked by code, with one retry (`weekPlan.ts`). A new per-step field fits the same path.
- **Fact:** Gemini can hold the answer to a schema, including a fixed list of allowed values (`responseJsonSchema`, `backend/src/lib/ai/gemini.ts`); Groq only guarantees JSON (`json_object`, `groq.ts`). So code must check the field too.
- **Fact:** the 10 certified pathways are in `backend/src/lib/ai/presets/`; their weekly steps are written by the model (v2), not by the preset.
- **Fact:** steps are stored as JSON in `DailyTask.detailedSteps`, so a new step field needs no migration.
- **Guess:** most custom goals fall into about 12 domains that our pathways already mostly cover.

Different kinds of work react differently when their day doesn't happen:
- **Steps that build on each other** (Lesson 4 needs Lesson 3): moving or swapping can break the order.
- **Steps that need rest between them** (two hard runs or heavy lifting days in a row): a swap can create exactly that.
- **Steps where timing is the method** (spaced repetition): moving one changes what it does.
- **Habits** (daily deep work, journalling): yesterday's session is simply gone; doing it twice isn't the method.
- **Ongoing work** (a chapter, a feature): it rolls into the next session; it is never a "step to move".
- **Fixed-time steps** (a group run, a class, a call): can't move at all.
- **Steps that only work together** (warm-up, main set, cool-down): moving one part breaks the unit.

## 4. How bad it is, and why now
It is live: carry-forward is switched on in production. Each wrong move contradicts the promise that the plan follows a real method, and some can hurt people. The weekly update's break rule (`docs/features/weekly-update/02-feature.md`, RULE-12) needs the same per-goal knowledge, so this has to come first (WU-10).

## 5. What good looks like
When a day doesn't happen, the app does what that goal's method would do for that kind of task, every time, and it can explain it in one kind line. Nothing harmful, nothing out of order, nothing made up that shouldn't be, and nothing silently dropped without the method saying so.

## 6. Options we looked at
### Option A: method-aware recovery profiles (chosen)
Each goal gets a recovery profile from its method: its kinds of step, and what each kind does when its day doesn't happen. The week writer tags each step with one of the goal's kinds. Code applies the action and enforces the hard limits.

### Option B: let the AI decide each time
Ask the model what to do whenever a day doesn't happen. Unpredictable, untestable, slow, and costs a model call per miss. Rejected.

### Option C: per-step action chosen by the week writer
The model picks "move" or "let go" per step directly. Simpler, but the model then decides recovery itself, and a mistake is unchecked. Rejected: describing what a step *is* is a far easier and safer judgement (MR-3).

### Option D: keep one rule for all, add more exceptions
More special cases like `highLoad`. Never covers order, timing, habits or fixed steps. Rejected.

## 7. Chosen direction
Option A, as discussed with Mo on 2026-10-08:

- **A small fixed set of actions (MR-1):** move, continue, let go, fixed. Plus two week-level rules: keep the order, keep the rest gaps.
- **The method sets the rules, at goal creation (MR-2):**
  - Certified pathways have profiles we write by hand.
  - Custom goals get theirs from their own model call, starting from one of about 12 domain templates we write, then adjusted for the goal (MR-4).
  - Code checks every profile. A failed profile falls back to its template, never to a half-made profile.
- **The week writer only categorises (MR-3):** each step is tagged with one kind from the goal's list, as a fixed menu. Code maps the kind to its action and enforces the hard limits: the test is always fixed, high-load work never lands next to other high-load work, and a deliverable's work always continues.
- **No silent "let go" (MR-5):** a step without a valid tag fails the week's check and the week is retried, so it is never saved. Every profile has a catch-all kind whose action the method chose. Let go happens only when the method says so.
- **Steps must stand alone:** a step that can move carries its own short warm-up in its instructions.
- **Existing goals (MR-6):** steps written before this feature keep today's tested behavior, until their next week is written. Their profile is made the first time it is needed.
- **Measured before switch-on (MR-7):** hand-written correct profiles for 20 to 30 varied custom goals, and the model scored against them before this goes live.

Agreed by Mo on 2026-10-08.

## 8. Limits
**In scope:**
- Recovery profiles: the format, the domain templates, the 10 pathway profiles, and the model call for custom goals with its checks.
- Step kinds in the week call.
- Carry, swap, mark today missed and move now following kinds, order and rest gaps.
- Today and Focus copy and buttons per action.
- How the weekly review and progress count let-go and continued work.
- Making pathway and onboarding prose match.
- The labelling eval.

**Out of scope:**
- The weekly update itself (paused, WU-10).
- Breaks across weeks: their return rule joins the profile here (MR-2), but the week close and moving dates stay in the weekly update.
- Reminders; plan v1 (retired, ND-21).

**Must not break:**
- Missed sessions' guarantees: no day longer, no pile-up, the test day protected, idempotent and guarded writes, the switch (ND-15).
- Goal creation, the week call, Today, Focus, the weekly review, the late test, the closing stretch, Pro gating.

## 9. Open questions for the feature definition
1. The exact domain templates: their kinds, actions and catch-alls, checked with Mo.
2. How "keep the order" works when a step that others depend on doesn't happen: do the later ones wait, or move with it?
3. How rest gaps are expressed (hours, days, "not on consecutive days") and checked on swaps.
4. Where "continue" leaves its unfinished work: the next session's own step, or an added note?
5. What the person sees for each action, word for word, and which buttons each action allows.
6. How let-go and continued steps count in the weekly review and progress, so they are not shown as failures.
7. The eval: which 20 to 30 goals, and what score is good enough to switch on.

## 10. Handed over from other features
- **From the weekly update (WU-10):** the per-goal return rule (`docs/features/weekly-update/02-feature.md`, RULE-12) becomes part of the recovery profile. The weekly update resumes once this feature is done, and reads it from there.
