# Weekly Update — Decisions

**Prefix:** WU

How this log works: `docs/templates/decisions.md`.

**Inherited:** this feature was started by `docs/archive/missed-sessions/04-phases.md` ND-19 (2026-10-08), which moved missed sessions' M4.2 (week-close handoff, AC-9, AC-11) here. See `01-brief.md`, section 10.

### WU-1 — Weeks close automatically (2026-10-08)
**Question:** a week ends today only when the review is submitted. What if it never is?
**Decision:** on the first app open after the week's last day has closed, the app closes the week by itself, runs the weekly update with what it knows and writes the next week.
**Why:** nobody should be stuck on an old week because they skipped a screen.
**Changes:** RULE-8, RULE-9; AC-6, AC-7.

### WU-2 — Checkpoints are a separate feature (2026-10-08)
**Question:** build the week 4 and week 8 checkpoint offers (lower goal or extension) now?
**Decision:** later, as their own feature. The problem is written up in `docs/features/checkpoints/01-brief.md`.
**Why:** an extension changes the plan's length, which touches many screens; the weekly update is useful without it.
**Changes:** section 8 (out of scope). The weekly update never returns `checkpointOffer`.

### WU-3 — An unlogged test means a re-test next week (2026-10-08)
**Question:** missed sessions' copy says "Take it now and we'll adjust". How does "take it now" work?
**Decision:** the target is held, and the next week's first practice day starts with the test that was not logged. Its result shapes the following week like any test.
**Why:** one path, no second update mid-week.
**Changes:** RULE-5; copy "Test not logged" replaces the missed-sessions wording; AC-4.

### WU-4 — A break follows the goal's own return rule (2026-10-08)
**Question:** someone is away for weeks. Jump to the current week, pause, or something else?
**Decision:** not a jump. Each goal has its own return rule (how its method says to come back after a break), and the plan follows it: the restart level comes from the rule, and the plan's dates move later so the same 12 weeks remain.
**Why (Mo):** every goal has its own way of dealing with missed time; the plan must use that goal's way.
**Changes:** RULE-12 to RULE-16; AC-9 to AC-12.

### WU-5 — At most 4 weeks of moving in total (2026-10-08)
**Question:** how far can breaks push the plan back?
**Decision:** 28 days in total per plan. A break beyond that offers a fresh plan from where they are, or continuing with the dates moved only up to the limit.
**Why:** a plan cannot stretch forever; matches plan-v2's "beyond that, start a revised plan".
**Changes:** RULE-15; AC-12.

### WU-6 — Breaks are part of this feature (2026-10-08)
**Question:** build breaks here, or as their own feature?
**Decision:** here, as the last phase, after the normal week close works.
**Why:** without it, the first person back from a break gets a broken plan.
**Changes:** scope (section 8).
