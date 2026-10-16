# Plan safety limits — Brief

**Status:** DRAFT
**Date:** 2026-10-17
**Links:** `docs/backlog.md` B-62; `docs/features/weekly-update/decisions.md` WU-23, WU-25 (6), WU-29; weekly-update M1.1 report section 7 (`docs/features/weekly-update/milestones/m1.1-check-the-code.md`); `docs/decisions.md` ND-5, ND-21; `docs/architecture/plan-v2.md`
**Solves:** B-62

## 1. The problem
The app writes running, weight-loss and lifting plans with no number checked by code. The old safety limits (running volume up at most 10% a week, a calorie deficit of 250 to 600 kcal a day, no heavy lifting in weeks 1 to 3) still exist, but they only act on a kind of data no goal has any more. So today the model alone decides how hard a plan gets, for every goal created since plan v2.

## 2. Who and when
- Everyone on the **run10k** and **recomp** pathways, from week 1, and every new week written after a weekly review.
- Anyone with a **custom** running, weight-loss or strength goal (Pro).
- Later: the weekly update (weekly-update P3) will move targets up and down each week. RULE-10 and WU-23's "highest safe step" assume a limit exists. It doesn't yet, so M3.1 can't start until this lands (WU-29).

## 3. What we know
- **Fact:** `applySafetyClamps` reads only `Goal.velocityTable` and runs only in `presentGoal` when a goal is returned (`backend/src/routes/goal.ts:62-70`). No code writes a velocity table, so it never acts on a plan v2 goal, and every goal is v2 (ND-21). (source: `backend/src/lib/research/safetyClamps.ts`, M1.1 report section 7)
- **Fact:** even when it ran, it clamped the stored table and only changed what the goal screen showed. It never changed a task or a week.
- **Fact:** the only safety checks on a v2 plan are `screenQuery` on the goal text (`research/safetyFilter.ts`) and the roadmap model rating its own method (below 3 out of 5 is refused, `ai/roadmap.ts:588-593`). The week prompt has one soft line: "Never assign loads beyond what is safe for their level" (`ai/weekPlan.ts:288`).
- **Fact:** the roadmap's 12 weekly targets are numbers with a metric, unit and direction (`WeekTarget`, `ai/roadmap.ts:11-13`), written by the model, pathway goals included. A pathway fixes the method, not the targets.
- **Fact:** targets don't change after creation today ("targets stay as planned", `planV2.ts:151`). The weekly update will be the first code to change them.
- **Fact:** a week's sessions have only one number code can read: `durationMinutes` per step. Distance, pace, kcal, %1RM and reps in reserve appear only in free text (`instructions`, `passMark`) (`DetailedStep`, `ai/goalDecomposer.ts:44-70`).
- **Fact:** week 1 (goal create) and every later week (`writeNextWeek`) both go through `generateWeekPlan` in `ai/weekPlan.ts`, and both pass `highLoadGoal` (`routes/goal.ts:330`, `planV2.ts:191`). `generateWeekPlan` already retries once with a reason when `checkWeekAnswer` finds a problem.
- **Fact:** `isHighLoadGoal` is true only for the run10k and recomp pathways, recognised from the goal text (`lib/highLoad.ts`). A custom running or cutting goal is not a high-load goal; only the model's own `highLoad` flag on each step marks it.
- **Fact:** the recomp pathway's own method allows 1 to 3 reps in reserve and a 250 to 500 kcal deficit (`ai/presets/recomp.ts:25, 36, 97-127`). The old weeks 1 to 3 limit was at least 3 reps in reserve, so the two disagree.
- **Guess:** most run10k roadmaps use a time target ("10K time", minutes, lower is better), not weekly distance. If so, a ramp limit on targets would rarely fire for run10k, and the real load sits in the sessions. A sample of stored roadmaps would settle this.
- **Fact (B-63 report):** preset text that reaches the prompts conflicts with the limits: recomp's framework description "close to muscular failure (1–3 Reps in Reserve)" (`ai/presets/recomp.ts:41`, roadmap prompt), its rule 1 "1–3 RIR" (`recomp.ts:287`, roadmap METHOD DETAIL, often copied into `method.rules`), and a quiz option "high-rep failure focus" (`recomp.ts:75`, both prompts when chosen). Recomp's capabilities, weekly themes and guidance lines say 1–2 RIR (UI only). Run10k's text has no clear conflict.
- **Fact (B-63, PSL-3):** stored weekly tests on older goals were never checked; the stopgap logs a breach that comes from them as `test_text` and does not refuse it.
- **Guess:** no one has been hurt or complained yet. Nothing in the logs or reports says either way.

## 4. How bad it is, and why now
It's a safety gap on live users, not a bug in how things look. A too-steep running ramp or a crash deficit is the kind of harm the product promised to prevent. It's also on the critical path: weekly-update M3.1 depends on it.

## 5. What good looks like
Whatever the model writes, a run10k, recomp or physical custom plan never asks for more than the agreed limits, in its targets or in its daily sessions. When the model goes over a limit, code catches it before anything is saved, and the person never sees the unsafe version. The same limits hold when the weekly update changes targets later.

## 6. Options we looked at

### Option A: limits on roadmap targets only
Port the old rules to the 12 `WeekTarget`s: week-to-week ramp for distance metrics, deficit bounds, weeks 1 to 3 %1RM and reps in reserve. Code clamps the number after the roadmap call (`roadmap.ts`), and the weekly update calls the same function later. Cheap and fully deterministic, because targets are already numbers. **Lost on its own:** the sessions carry the real load and stay unchecked, and a time target (the likely run10k case) has no ramp to clamp.

### Option B: limits on week sessions only
Check what each high-load step actually asks for. This needs numbers code can read. Either (B1) the week call returns structured load fields on high-load steps (for example `distanceKm`, `effort`, `kcalDeficit`, `percent1RM`, `rir`) and code checks them against last week's, or (B2) code reads the numbers out of the step text. B1 is reliable but adds fields to the stored `detailedSteps` JSON (no migration, but a change to stored data, so it needs Mo's OK). B2 needs no new fields but is brittle. **Lost on its own:** targets could still climb past a safe level, and the week writer is told to reach them.

### Option C: both (recommended)
Targets clamped in code (A), and sessions checked through structured load fields (B1): retry once with the reason, then a code fix (scale the step down) or an honest failure. One shared limits module replaces `safetyClamps.ts`, used by the roadmap, the week call and later the weekly update. It costs the most, about 3 to 4 milestones, but it's the only option that limits both what the plan aims for and what a day asks.

### Option D: tell the model only
Put the numbers in the roadmap and week prompts and check nothing. **Lost:** this is guidance, not a limit. It's the same "told, not checked" gap WU-29 already flags. It's only good as a stopgap (below).

## 7. Chosen direction
Not chosen yet. I recommend C, with the stopgap below shipped first. Agreed by Mo on —.

## 8. Limits
**In scope:** run10k and recomp; custom goals whose steps are high-load (see question 2); the 12 roadmap targets; every week the week call writes; a single limits module the weekly update can call.
**Out of scope:** medical screening (injuries, pregnancy, conditions); changing the methods themselves; checkpoints; the weekly update's own rules (weekly-update P3).
**Must not break:** R-7 (`weekPlan.test.ts` prompt fixture changes only on purpose, `taskRules`, `highLoad`); the honest 503 with nothing saved (CLAUDE.md step 7); the stated-target rule (week 12 reaches a number named in the goal), except where safety wins (WU-23); method-aware recovery's rest gaps and easy line; carry-forward never makes a day longer.

## 9. Product numbers and choices Mo needs to make
1. **Running: what is measured.** Weekly running minutes (code can read these today) or weekly distance (needs a new structured field)? Recommendation: distance when known, minutes otherwise.
2. **Which goals.** The two pathways only, or also custom goals whose steps the model marks `highLoad` or whose goal text matches running, cutting or lifting words?
3. **Running ramp.** 10% a week as before? Plus a small fixed allowance at low volumes (for example +10 minutes or +1 km), since 10% of 60 minutes is 6 minutes. A cap on the longest single run (for example at most 30% of the week)? At most 2 hard sessions (intervals, tempo, race pace) a week?
4. **First week back after a break** (WU-29): at or below the last completed week, or a fixed cut (for example 70%)?
5. **Calories.** Deficit 250 to 600 kcal a day as before, or 250 to 500 to match the recomp method? A floor on daily intake (for example never below 1,500 kcal for men and 1,200 for women; that needs sex or weight, which we don't ask for), or a cap on rate of loss (for example at most 1% of body weight a week)?
6. **Lifting, weeks 1 to 3.** At most 80% of 1RM as before? Reps in reserve: at least 3 in weeks 1 to 3, the method's range from week 4 (decided, PSL-2). A cap on weekly hard sets per muscle (the method says 10 to 20)?
7. **When a limit is broken:** code lowers the number (targets: yes), the model retries, or the week fails with the honest 503? For sessions I recommend retry, then a code fix where there is a number, else fail.
8. **Goals already stored:** clamp their roadmap targets on read too (like the old clamps), or only from the next write?

## 10. Stopgap for live run10k and recomp users (a quick fix, within days)
**Recommended:** one quick fix in `backend/src/lib/ai/weekPlan.ts`, plus the weeks 1 to 3 test check in `roadmap.ts` (no `planV2.ts`, no `routes/goal.ts`). Because both the create and review paths call `generateWeekPlan`, it protects every week written from the day it ships, including the next week of every existing run10k and recomp goal.
- **Told:** when `highLoadGoal` is true, the week prompt gets a fixed SAFETY LIMITS block with today's old numbers: running this week at most 10% more than last week; at most 2 hard runs; calorie deficit 250 to 600 kcal a day, never more; weeks 1 to 3 no lift above 80% of 1RM and at least 3 reps in reserve, never "to failure" or a max.
- **Checked:** in `checkWeekAnswer`, a narrow scan of high-load step text for numbers that clearly break those limits: a deficit above 600 kcal; "% 1RM" above 80, "RIR" below 3, "to failure" or "1RM test" or "max" in weeks 1 to 3. A hit is a retry reason. If the second answer still breaks one, the week fails: the honest 503 at create, the existing failure at review. That matches "no fallback plan". The patterns stay narrow so a normal plan never fails, and each hit is logged as `[SafetyCheck]`.
- **Also covered (2026-10-17, Mo):** the scan checks any step flagged `highLoad`, custom goals included (the flag is already on every step the week call returns), and `roadmap.ts` refuses a max test or to-failure test in weeks 1 to 3, so a goal never fails every week call on its own test. In weeks 1 to 3 the safety block says plainly that it overrides the method's reps-in-reserve range (recomp says 1 to 3).
- **What it doesn't cover:** the running ramp is only told (code has no last-week minutes without touching `planV2.ts`); roadmap targets aren't clamped; a custom step the model doesn't flag `highLoad` isn't checked, and custom goals don't get the prompt block. These belong to the feature.
- **Decided (PSL-1, PSL-2):** a second breach fails the week; safe wording never counts, with tests; every hit logged as `[Safety]`. Weeks 1 to 3 keep at least 3 reps in reserve; the method's range applies from week 4. Built as B-63.
- Left out: clamping new roadmaps' number targets in `roadmap.ts` with the old rules. Worth it only if the sample in section 3 shows distance or kcal targets.
