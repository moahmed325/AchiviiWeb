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

