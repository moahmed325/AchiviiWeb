# Plan Safety Limits — Decisions

**Prefix:** PSL

How this log works: `docs/templates/decisions.md`.

### PSL-1 — A stopgap in the week call ships first, and a second breach fails the week (2026-10-17)
**Question:** what protects live run10k and recomp users while the feature is built (`01-brief.md` section 10), and what happens when the model's second answer still breaks a limit?
**Decision:** (1) A quick fix (B-63) in `backend/src/lib/ai/weekPlan.ts` and `backend/src/lib/ai/roadmap.ts` (changed 2026-10-17): a safety-limits block in the week prompt for high-load goals (run10k, recomp), which in weeks 1 to 3 says plainly that it overrides the method's reps-in-reserve range; a narrow scan of the text of every high-load step, meaning a step of a high-load goal or any step flagged `highLoad`, custom goals included; and the same max-test and to-failure scan on weeks 1 to 3's tests in the roadmap. A hit is a hard reason: it gives one retry, and if the second answer still breaks a limit the week fails (the honest 503 at goal create; "This week is unchanged" 503 at review). (2) The scan must not count safe wording ("stop 3 reps before failure", "never train to failure", "no max test this week", "keep it under 80% of 1RM"), with tests that show it. (3) Every hit is logged as a `[Safety]` line with the goal, the week, the rule and the matched text, so the false-alarm rate can be checked in production.
**Why (Mo):** an unsafe week must never reach the person, and a false alarm that blocks a safe week must be visible and rare.
**Changes:** `01-brief.md` section 10; `docs/backlog.md` B-63. Changed 2026-10-17 (Mo): roadmap tests, custom goals' flagged steps and the recomp override line added.

### PSL-2 — Weeks 1 to 3: at least 3 reps in reserve (2026-10-17)
**Question:** the old limit says at least 3 reps in reserve in weeks 1 to 3; the recomp method allows 1 to 3. Which holds?
**Decision:** at least 3 reps in reserve in weeks 1 to 3, for the stopgap and as the starting number for the feature (`01-brief.md` section 9, question 6). From week 4 the method's own range applies (recomp: 1 to 3).
**Why (Mo):** 3 is inside recomp's own 1 to 3 range, the easy end while the body adapts, so it tightens the start without contradicting the method.
**Changes:** `01-brief.md` sections 9 and 10.

### PSL-3 — The stored weekly test is logged, not refused (2026-10-17)
**Question:** B-63 review: the test day runs the roadmap's test as written, and a goal stored before B-63 may hold a week 2 or 3 test that breaks a limit ("Test your 1RM squat"). Refusing it would fail that week's call on every review. What happens?
**Decision:** in the week call, a breach that the week's stored test itself holds is logged as `[Safety]` with outcome `test_text` and not refused (on the test step for any rule the test breaks; elsewhere only for a sentence copied from it). New roadmaps cannot store such a test: the roadmap refuses a week test that breaks any rule the week call checks, in every week. Fixing stored tests on older goals belongs to the feature.
**Why:** a refusal there leaves the person stuck at the review for good; the log shows which goals hold such a test.
**Changes:** `backend/src/lib/ai/weekPlan.ts` (`safetyBreaches`), `roadmap.ts`; CLAUDE.md step 6.

### PSL-4 — The limit numbers, step load and no switch (2026-10-17)
**Question:** `02-feature.md` section 4 proposed every limit number; section 7 adds load fields to stored steps; should the limits have an on/off switch?
**Decision:** (1) All the numbers in `02-feature.md` section 4's table, as proposed: running distance target +10% a week or +1 km; running time target at most 2% faster a week; lift load target +5% a week or +2.5 kg; body weight loss at most 1% a week, gain at most 0.5%; body fat at most 0.5 points a week; deficit 250 to 600 kcal a day; daily intake never below 1,200 kcal; running total +10% on the base week or +10 minutes / +1 km; longest run at most 50% of the week; at most 2 hard runs a week; weeks 1 to 3 lifting as PSL-2; base week = last week's planned total, or what was done when under 70% of it. (2) High-load steps store an optional `load` (additive keys in the stored step JSON, no migration). (3) No switch: the limits are always on.
**Why (Mo):** agreed as proposed; a safety rule should not be possible to turn off.
**Changes:** `02-feature.md` sections 4, 5 and 7 (status APPROVED).


### PSL-5 — The stated-target reader is widened in M1.2 (2026-10-19)
**Question:** M1.1 Q3: `extractStatedTargets` (`backend/src/lib/research/statedTarget.ts`) reads nothing from "lose 10 kg", "squat 100 kg", "run 5 km" or "15% body fat", and reads "lose 10 pounds" and "5 km in 25 minutes" with the wrong bound, so RULE-3's honest line would almost never show. Fix it here or in the backlog?
**Decision:** in M1.2. The reader learns two-letter units (kg, km, lb), percent, "lose N", and "in N minutes" as an at-most time, with tests for each phrase above. The scope of M1.2 grows by this.
**Why (Mo):** RULE-3 and AC-3 depend on it for every physical goal except a 10K time.
**Changes:** `02-feature.md` RULE-3; `03-phases.md` M1.2.

### PSL-6 — A calorie-deficit target is held to the range (2026-10-19)
**Question:** M1.1 Q6: the deficit limit is a range (250 to 600 kcal a day), not a step size. What does RULE-2 do with a deficit target?
**Decision:** a deficit target above 600 is lowered to 600; one below 250 is left alone (easier is never changed).
**Why (Mo):** agreed as recommended.
**Changes:** `02-feature.md` RULE-2.

### PSL-7 — Older goals: lower the number, rebuild only code-written text (2026-10-19)
**Question:** M1.1 Q7: the target number is also stored as text (`RoadmapWeek.objective`, `keyMilestone`, `test.passIf`, `test.instructions`, `Goal.roadmap.finalGoal`/`finalTest`, `Goal.clarifiedOutcome`). What does RULE-9's lowering on read change?
**Decision:** lower in `presentGoal` and `writeNextWeek` only. Rebuild `objective` and `passIf` from the lowered target with `formatTarget`; on a pathway, refill the test from the preset template. A model-written test on an older custom goal stays as stored, even if it names the old number. `finalGoal` and `clarifiedOutcome` keep the person's goal; the honest line says the rest. Nothing stored is rewritten.
**Why (Mo):** a small wording mismatch on older custom goals is better than rewriting text code did not write.
**Changes:** `02-feature.md` RULE-9; `03-phases.md` M1.3.

### PSL-8 — Load is required only on run and lift steps (2026-10-19)
**Question:** M1.1 Q11: `isHighLoadStep` counts every step of a run10k or recomp goal (warm-ups, food logging), and the stored `highLoad` flag depends on goal age. Which steps must carry `load` (RULE-4)?
**Decision:** steps the model flags `highLoad` and steps of a run or lift kind. Not every step of a pathway goal: a "log your meals" or warm-up step needs no load. The test step on a running goal gives its load whatever its flag (Q9, PSL-11).
**Why (Mo):** otherwise ordinary steps cause retries.
**Changes:** `02-feature.md` RULE-4; `03-phases.md` M2.1.

### PSL-9 — Where the honest week 12 line shows (2026-10-19)
**Question:** M1.1 Q12: section 6 names "the roadmap and journey views"; the journey components are not mounted.
**Decision:** the Roadmap page (the current week's target when it is week 12, and the Destination), Today's closing stretch (days 85 to 90, the Summit Target), and the review's next-week target when week 12 is next.
**Why (Mo):** these are the screens in use that show week 12's target.
**Changes:** `02-feature.md` section 6; `03-phases.md` M1.3.

### PSL-10 — The target families (2026-10-19)
**Question:** M1.1 Q4, Q5, Q16: pace, continuous running minutes, waist, cumulative weight lost, % of 1RM and RIR targets fit no family as written.
**Decision:** (1) Pace (min/km, lower) is the running time family. (2) Continuous running minutes (higher) uses the running distance rule in minutes (+10% or +10 minutes). (3) A time or minutes target counts as running only on run10k or when the metric names a run; otherwise `unknown_family`. (4) Waist and cumulative weight lost: no family, logged `unknown_family`. (5) Body fat in `%` or `percent` is the body fat family (percentage points). (6) % of 1RM and RIR targets: no family; RULE-5 covers them on steps.
**Why (Mo):** agreed as recommended.
**Changes:** `02-feature.md` sections 3 and 5.

### PSL-11 — M1.1's other answers, as recommended (2026-10-19)
**Question:** M1.1 report section 8, Q1, Q2, Q8 to Q10, Q13 to Q15, Q17.
**Decision:** as the report recommends: (Q1) new goals are checked on the model's 12 targets inside `checkRoadmapAnswer`, so light weeks copy the lowered values; a stored split-pathway goal is checked on weeks 4, 8 and 12 only, with four safe steps between each (start→4, 4→8, 8→12). (Q2) the check runs after the unit is unified (`roadmap.ts:691`), the stated-target check accepts a number the lowering alone put out of reach, the `finalGoal` mention check is skipped when week 12 was lowered, and `[Safety]` is logged only for the accepted answer. (Q8) done load counts completed, offered days: their steps' load, or the 10-minute version's when `usedMinimumVersion`; `carriedFrom`/`shiftedFrom` copies count once (`isDoneCopy`'s rule); planned is the same over every offered practice day. (Q9) a step with `load.runMinutes` or `load.runKm` is a run, `load.hardRun` decides hard runs, not the kind; a code-made test step on a running goal counts its minutes as running. (Q10) when code rescales a step's minutes, `load.runMinutes` scales by the same ratio. (Q13) the first week back reads older weeks by `goalId`/`weekNumber` in `writeWeekAfter`; a week without load falls back to running kinds' minutes, else the text scan only. (Q14) with no starting point, week 1 is not checked, `[Safety]` logs `no_start`, and the check runs from week 2. (Q15) `RoadmapWeek.target` keeps its shape; the model's original values go under an additive key in `Goal.roadmap` (`{ week, model, safe }` entries). (Q17) M2.2 builds the prompt's running line from the limits module.
**Why (Mo):** agreed as recommended.
**Changes:** `02-feature.md` sections 5 and 7; `03-phases.md` M1.2, M1.3, M2.2.

### PSL-12 — Older goals on read: the honest line, the log and the rebuilt text (2026-10-20)
**Question:** writing M1.3's prompt: when does the week 12 line show and what fills it; how does RULE-10's "each lowered target" apply when an older goal is lowered on every read; what of `keyMilestone` and a pathway's tests is rebuilt?
**Decision:** (1) The line shows whenever week 12 was lowered, on a new or an older goal. When the goal text names a number the safe week 12 no longer meets, it is the full line with that number as {goal}; otherwise only "Week 12 aims at {safe}, a safe step." (the lowered number was the model's, not theirs). {safe} and {goal} are the rounded amount and unit, with no metric and no "or less". (2) For older goals, RULE-10 is read as: one `[Safety]` `target_step` line, outcome `lowered_on_read`, when a week whose target was lowered on read is written (`writeNextWeek`); nothing is logged when a goal is only shown (`presentGoal`). (3) Only weeks whose target changed are rebuilt. On a pathway with tests, the measured week's test is refilled from the preset, and `finalTest` too when week 12 changed. `keyMilestone` is rebuilt from the refilled test; on a custom goal (and an older pathway goal whose stored test is not the preset's own) only the pass mark changes, in `keyMilestone` and in `test.passIf` as PSL-7 says, and the test's instructions and `finalTest` stay (M1.3 review). For "lose N", {goal} is the weight it implies (starting point minus N), or the short line with no starting point (M1.3 review). (4) Everything that compares a result with a target uses the lowered target (on 2026-10-20 only the app compares, and it reads targets from `presentGoal`).
**Why (Mo):** the full line would credit the person with a number they never asked for; logging on every read would flood the log; text code did not write stays as stored.
**Changes:** `02-feature.md` section 6; `milestones/m1.3-older-goals-honest-line.md` Prompt.

### PSL-13 — Older goals: closed weeks stay as stored, and the climb is checked from the last one (2026-10-20)
**Question:** M1.3 report, Stop-if (2) and the review's round 2: lowering every week on read puts a closed week's lowered target beside the result logged against the stored one, and checking from the starting point can show an open week below a week already done.
**Decision:** a closed week (`completed`, or jumped) keeps its stored target and text and is never lowered. The weeks after the last closed week are checked from its stored target, one safe step a week (on a light-test goal, from the last closed of weeks 4 and 8, four safe steps to the next big week; a closed light week is never the starting value); with none closed, from the starting point. `presentGoal` and `writeNextWeek` use the same rule. A week 12 lowered only on read gets the line only when this rule lowers it; one lowered at create keeps it.
**Why (Mo):** a result keeps the target it was judged against, and the rest of the plan climbs safely from where the person is, not from a past they already lived through. M2.2's base week (what was done) guards a closed week that was itself too steep.
**Changes:** `02-feature.md` RULE-9; `milestones/m1.3-older-goals-honest-line.md` Review.

### PSL-14 — Load on cardio steps, the hard-run mark, and km as written (2026-10-20)
**Question:** M2.1 review: a custom weight-loss goal gets the strength template, whose cardio kind is `conditioning`, not a run kind, so its runs were asked for a load only if the model flagged them `highLoad`. And code shortens a step's minutes after the model; should `runKm` shrink too?
**Decision:** (1) On a load goal, every run step and every lift step needs a load whatever the target's family, and a `conditioning` step needs some load (option A). (2) Any load that names `runMinutes` or `runKm` also gives `hardRun`, whatever the step's need. (3) `runMinutes` scales with the step's minutes (PSL-11 Q10); `runKm` stays as written, and M2.2 must not scale it down.
**Why (Mo):** otherwise a weight-loss goal's runs and strength sessions are left out and M2.2 cannot check them; keeping km as written while the minutes shrink over-counts the planned distance, which is the safe side.
**Changes:** `02-feature.md` RULE-4; `03-phases.md` M2.2; `backend/src/lib/safety/stepLoad.ts`.
