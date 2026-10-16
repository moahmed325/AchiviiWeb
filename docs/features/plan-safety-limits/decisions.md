# Plan Safety Limits — Decisions

**Prefix:** PSL

How this log works: `docs/templates/decisions.md`.

### PSL-1 — A stopgap in the week call ships first, and a second breach fails the week (2026-10-17)
**Question:** what protects live run10k and recomp users while the feature is built (`01-brief.md` section 10), and what happens when the model's second answer still breaks a limit?
**Decision:** (1) A quick fix (B-63) in `backend/src/lib/ai/weekPlan.ts` only: a safety-limits block in the week prompt for high-load goals, and a narrow scan of high-load steps' text. A hit is a hard reason: it gives one retry, and if the second answer still breaks a limit the week fails (the honest 503 at goal create; "This week is unchanged" 503 at review). (2) The scan must not count safe wording ("stop 3 reps before failure", "never train to failure", "no max test this week", "keep it under 80% of 1RM"), with tests that show it. (3) Every hit is logged as a `[Safety]` line with the goal, the week, the rule and the matched text, so the false-alarm rate can be checked in production.
**Why (Mo):** an unsafe week must never reach the person, and a false alarm that blocks a safe week must be visible and rare.
**Changes:** `01-brief.md` section 10; `docs/backlog.md` B-63.

### PSL-2 — Weeks 1 to 3: at least 3 reps in reserve (2026-10-17)
**Question:** the old limit says at least 3 reps in reserve in weeks 1 to 3; the recomp method allows 1 to 3. Which holds?
**Decision:** at least 3 reps in reserve in weeks 1 to 3, for the stopgap and as the starting number for the feature (`01-brief.md` section 9, question 6). From week 4 the method's own range applies (recomp: 1 to 3).
**Why (Mo):** 3 is inside recomp's own 1 to 3 range, the easy end while the body adapts, so it tightens the start without contradicting the method.
**Changes:** `01-brief.md` sections 9 and 10.
