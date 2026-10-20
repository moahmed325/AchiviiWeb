# Plan Safety Limits — Feature Definition

**Status:** APPROVED (2026-10-17)
**Date:** 2026-10-17
**Builds on:** `01-brief.md` (option C), `docs/backlog.md` B-62, B-63
**Decisions:** `docs/features/plan-safety-limits/decisions.md`

## 1. Summary
Code, not the model, keeps a physical plan within safe limits: the 12 weekly targets climb no faster than a safe step, and each week's running, lifting and calorie steps stay inside fixed numbers. It is for everyone on run10k or recomp and anyone with a custom running, weight-loss or strength goal. The weekly update uses the same limits when it moves a target (weekly-update RULE-10, WU-23).

**Main idea:** the model proposes, code checks numbers it can read. An unsafe target is lowered; an unsafe week is never saved.

## 2. User journey
1. The person creates a goal. The roadmap model writes 12 targets. Code checks each against the one before (week 1 against the starting point) and lowers any that climbs too fast. If week 12 ends below the number the person asked for, the plan says so plainly.
2. Week 1 is written. Every high-load step carries its load as numbers (minutes or km run, hard or easy, kcal deficit, % of 1RM, reps in reserve). Code checks them; a breach gets one retry, then the week is not saved and the person sees the existing "Couldn't write your first week right now" message.
3. Each later week is written after the review the same way, with last week's planned and done load as the base for the ramp.
4. After a break, the first week back is checked against what the person last did, not what was planned (WU-29).
5. When the weekly update raises a target, it can raise it only to the next safe step.

## 3. Words we use
**Physical goal:** a goal on the run10k or recomp pathway; or a goal whose targets are in a limited family (below); or a goal with any step flagged high-load.
**Target family:** what a number target measures, read from its metric and unit: running distance, running time, lift load, body weight, body fat, calorie deficit. Pace (min/km, lower) is running time; continuous running minutes (higher) uses the running distance rule in minutes; a time or minutes target is running only on run10k or when the metric names a run. Waist, cumulative weight lost, % of 1RM and RIR targets have no family (PSL-10). Any other target has no family and no target limit.
**Safe step:** the largest change from one week's target to the next that the limits allow.
**Load:** the numbers on a high-load step that code reads (section 7).
**Running total:** a week's running, in km when every run gives km, otherwise in minutes.
**Base week:** the week a ramp is counted from: last week's planned running total, or what was done when less than 70% of it was done.
**Breach:** a target or a step outside a limit.

## 4. Rules

**RULE-1 — One limits module.** Every limit lives in one place and is used by the roadmap, the week call and the weekly update. The numbers in the table below are the only limit numbers in code; `safetyClamps.ts`'s velocity-table clamps are retired with it.

**RULE-2 — Targets climb by safe steps.** For a number target in a family, each week's target is at most one safe step beyond the week before; week 1 is checked against the starting point. Code lowers a breaching target to the safe step and re-checks the following weeks from it. A target that gets easier is never changed. A deficit target above 600 kcal is lowered to 600; one below 250 is left alone (PSL-6). New goals are checked on the model's 12 targets before light weeks copy them; a stored split-pathway goal is checked on weeks 4, 8 and 12 only, four safe steps apart (PSL-11).

**RULE-3 — Safety wins over the stated number.** When lowering leaves week 12 below a number the person named in the goal (`statedTarget.ts`), week 12 keeps the highest safe step, the stated-target check accepts it, and the plan shows the honest line from section 6 (as WU-23 does for the weekly update). `statedTarget.ts` is widened to read kg, km, lb, percent, "lose N" and "in N minutes" (PSL-5).

**RULE-4 — Physical steps carry their load.** On a physical goal, every step the model flags `highLoad` and every step of a run or lift kind returns its load as numbers next to its text, and so does the test step of a running goal; other steps (warm-ups, food logging) need none (PSL-8). A missing load on such a step is a retry reason; on the last attempt the step is kept and RULE-8's text scan decides.

**RULE-5 — Week limits.** A week of a physical goal is checked as a whole: its running total against the base week (with the allowance), its longest run, its hard runs, and every step's deficit, intake, % of 1RM and reps in reserve. Week 1 of a goal has no base week; only the per-step and per-week counts apply.

**RULE-6 — A breach gets one retry, then the week is not saved.** As the stopgap (PSL-1): the retry reason names the step, the limit and the number. A second breach fails the week with the existing 503 at goal create or review. Nothing unsafe is ever stored.

**RULE-7 — First week back.** After a break (weekly-update RULE-13), the base week is the last week the person did any running, counted by what was done, and the running total may not exceed it.

**RULE-8 — The text scan stays.** B-63's scan of step text runs as well, for any limit a load number did not cover. The roadmap's week tests are checked by the same rules (B-63). A breach that the week's stored test itself holds is logged, not refused (PSL-3).

**RULE-9 — Older goals.** A goal stored before this feature is checked on read: what the week writer is told and what the plan shows use the lowered targets, and nothing stored is rewritten. Lowering happens in `presentGoal` and `writeNextWeek`; `objective` and `passIf` are rebuilt from the lowered target, a pathway's test is refilled from the preset, and a model-written test on an older custom goal stays as stored (PSL-7). Their stored weeks have no load, so their first base week comes from the text scan only (told, not counted). A closed week keeps its stored target, and the weeks after the last closed one are checked from its stored target (PSL-13).

**RULE-10 — Every action is logged.** Each lowered target and each breach writes one `[Safety]` line (goal, week, rule, the number or sentence, the outcome), as B-63 does.

### The numbers (PSL-4)
| Limit | Value | Notes |
|---|---|---|
| Running distance target, safe step | +10% a week, or +1 km when that is more | the old ramp; the allowance stops a 3 km base from creeping by 0.3 km |
| Running time target (lower is better), safe step | at most 2% faster a week | a 60 to 50 minute 10K is about 1.6% a week |
| Lift load target, safe step | +5% a week, or +2.5 kg when that is more | |
| Body weight loss target, safe step | at most 1% of last week's target a week | |
| Body weight gain target, safe step | at most 0.5% a week | |
| Body fat target, safe step | at most 0.5 percentage points a week | recomp's 5 points in 12 weeks is about 0.4 |
| Calorie deficit (target or step) | 250 to 600 kcal a day | PSL-1; the recomp method itself uses 300 to 500 |
| Daily intake written in a step | never below 1,200 kcal | we don't ask sex or weight, so one floor |
| Running total against the base week | +10%, or +10 minutes / +1 km when that is more | |
| Longest run | at most 50% of the week's running total | |
| Hard runs (intervals, tempo, race pace) | at most 2 a week | already told by the stopgap |
| Weeks 1 to 3 lifting | at most 80% of 1RM, at least 3 reps in reserve, nothing to failure, no max test | PSL-2; from week 4 the method's own range |
| Base week | last week's planned total, or what was done when under 70% of it | |

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Target with no family ("chess rating", deliverables) | No target limit; the week's step limits still apply when its steps are high-load. |
| Mixed metric and unit the families can't read | No family; logged once as `[Safety]` `unknown_family`, never refused. |
| Starting point missing (person skipped the level question) | Week 1 is checked against the roadmap's cautious beginner value. If the roadmap still has no starting point (accepted on its last attempt), week 1 is not checked, `[Safety]` logs `no_start`, and the check runs from week 2 (PSL-11). |
| A custom goal with no high-load step and no family | Nothing in this feature applies. |
| Recomp with a stated "lose 10 kg" (read since PSL-5) | Weight steps of 1% a week; week 12 shows the honest line if 10 kg is out of reach. |
| Person did 0 runs last week, no break | Base week is 0 done, so the running total may be at most the allowance (10 minutes or 1 km). |
| Week 12 test day | Week limits apply; a max test is allowed from week 4. |
| Steps moved by carry-forward or the handoff | Already checked in their own week; moving never adds load to a day (missed-sessions rules). |
| The test step | Its load counts in the running total; its text follows PSL-3. |
| Kill switch | None: limits are always on, like the stopgap (PSL-4). |

## 6. Screens and copy
No new screen. One line where week 12's target shows when RULE-3 lowered it: the Roadmap page (the current week's target when it is week 12, and the Destination), Today's closing stretch (Summit Target), and the review's next-week target when week 12 is next (PSL-9). The journey components are not mounted.

**Copy rules:** plain, calm, no blame; never "unsafe" or "dangerous" about the person's goal; name the safe number and the goal.

| Situation | Exact words |
|---|---|
| Week 12 lowered below the stated goal (RULE-3) | "Week 12 aims at {safe}, a safe step. Your {goal} goal is the next step." |
| Week 12 lowered, and the goal text names no number it misses (PSL-12) | "Week 12 aims at {safe}, a safe step." |
| Week could not be written (RULE-6) | existing: "Couldn't write your first week right now. Please try again." / "Couldn't write next week right now. This week is unchanged; please try again." |

## 7. Data and system changes
- **Step load:** a high-load step stores an optional `load` next to its text: `runMinutes`, `runKm`, `hardRun` (yes/no), `kcalDeficit`, `kcalIntake`, `percent1RM`, `rir`, `toFailure` (yes/no), `maxTest` (yes/no). Additive keys in the stored step JSON; no migration. Older steps have none. Agreed as a change to stored data (PSL-4).
- **Targets:** lowered targets are stored as lowered for new goals; the original model value is kept on the roadmap for the log and the honest line, as `{ week, model, safe }` entries under an additive key in `Goal.roadmap`; `RoadmapWeek.target` keeps its shape (PSL-11). Older goals are lowered on read only (RULE-9).
- **Week call input:** gets last week's planned and done load (from stored steps and task status) and the goal id for the log (B-64). Done counts completed, offered days (the 10-minute version's load when it was used; carried copies once); planned counts every offered practice day (PSL-11).
- **Logs:** `[Safety]` lines as RULE-10.

**Must not break:** R-7 (week prompt fixture only on purpose, `taskRules`, `highLoad`); the honest 503s and nothing saved; method-aware recovery's rest gaps, easy line and handoff; carry-forward never makes a day longer; the stated-target rule for goals without a family; B-63's tests.

## 8. Scope
**In scope:** the limits module and its numbers; target checks at roadmap time and on read; step load in the week call; week checks; first week back; the weekly update's safe step (as a function it calls); the honest line.
**Out of scope:** medical screening; diet plans beyond deficit and intake; other endurance sports (cycling, swimming), which keep only the text scan; changing preset text (listed in `01-brief.md` section 3).
**Later:** per-person intake floors (needs sex and weight); weekly hard sets per muscle; fixing stored tests on older goals.

## 9. Acceptance criteria
- **AC-1** Every limit number lives in one module, and the roadmap, week call and weekly update call it; no other code holds a limit number. (RULE-1)
- **AC-2** A roadmap whose distance, time, load, weight, body-fat or deficit targets climb too fast is stored with each breaching week lowered to the safe step, and later weeks re-checked from it; an easier target is untouched. (RULE-2)
- **AC-3** A stated number out of safe reach leaves week 12 at the highest safe step, goal create succeeds, and the plan shows the honest line with both numbers. (RULE-3)
- **AC-4** A high-load step without load gives a retry; on the last attempt it is kept and the text scan decides. (RULE-4, RULE-8)
- **AC-5** Each week limit in the table is refused by a test at one step past it and passed at the limit, for week 1 and a later week. (RULE-5)
- **AC-6** A second breach returns no week, and goal create and review answer their existing 503s with nothing stored. (RULE-6)
- **AC-7** The first week back after a break is held to the last done running total. (RULE-7)
- **AC-8** B-63's tests still pass, and a roadmap test outside a limit is refused. (RULE-8)
- **AC-9** An older goal's breaching targets are lowered in the week prompt and the plan view, and its stored roadmap is unchanged. (RULE-9)
- **AC-10** Each lowered target and breach writes one `[Safety]` line with the goal id. (RULE-10)
- **AC-11** The weekly update can raise a target only to the value the module returns as the next safe step. (RULE-1, RULE-2)

## 10. Other concerns
**Privacy:** `[Safety]` lines hold the goal id, numbers and model sentences, never the person's own answers.
**Cost:** load fields add output tokens to each week call; no new model call.
