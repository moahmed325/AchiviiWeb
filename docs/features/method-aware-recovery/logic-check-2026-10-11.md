# Logic check — method-aware recovery, the week-end handoff (2026-10-11)

**Focus:** what next week's writer is told and how (M3.1d), plus RULE-20 and RULE-21. Read: `02-feature.md`, `decisions.md` (MR-29 to MR-31), and one code question (`writeNextWeek` runs only from the weekly review and dates the week from the goal's start).

**Result:** 14 stories: 5 OK, 4 Silly, 3 Undefined, 2 Clash. Mo's answers are recorded in MR-32.

## Findings and what was decided

| # | Finding | Grade | Outcome |
|---|---|---|---|
| 1 | A strict check that the model repeats steps by kind and title can fail twice and block the weekly review ("Couldn't write your next week"). | Clash | MR-32 (1): code places the carried steps itself; the model is only told. No check can fail. |
| 2 | Nothing bounds the backlog: a slow learner falls further behind each week while targets keep asking for new material. | Silly | MR-32 (2): track position, not a cap. Next week's sessions of the kind continue from the first step not done; extra steps wait (stored in the new week); the writer is told where the person is and how far behind the plan. |
| 3 | Week 12 has no next week, so "next week starts with it" would be false. | Undefined | M3.1d requirement and new copy: in the final week, leftovers are left out and the line says so. |
| 4 | A hard move with no room would be added on top of next week's own hard sessions. | Clash (safety) | MR-32 (3): hard no-room steps are told to the writer as information only. |
| 5 | A new phase starting with the old phase's lessons. | Undefined | MR-32 (4): carried if the kind still exists in the goal's profile, otherwise let go. |
| 6 | Next week is written only when the person logs the weekly review, possibly late and with past dates. | Silly | Note on B-37 (the weekly update's automatic close fixes it). |
| 7 | RULE-21 skips the test day, so a person can come back to a maximum-effort test. | Silly (safety) | MR-32 (5): the easy line also goes on a hard test step when the test day is the first day back. |
| 8 | The same lesson keeps landing on a day the person never trains. | Silly | Note for the weekly update. |
| 9 | Across a week change, a handed-on step could be counted in last week's list and again in the new week. | Undefined | M3.1d requirement: a step handed on is no longer listed in last week's queue. |
| 10 | Unfinished continue work is told to the writer but not checked, unlike in-order steps. | Clash (wording) | RULE-20 wording: told, not checked. |

## Stories that were OK
- An old goal whose weeks have no kinds: RULE-18, nothing new told.
- A custom goal with only a catch-all kind: no in-order steps, nothing handed on.
- A break inside the week: lessons reorder, first hard session back gets the easy line once.
- A lesson missed twice inside the week stays in the queue.
- With `METHOD_RECOVERY_ENABLED` off, `writeNextWeek` behaves as today (Mo's requirement for M3.1d).
