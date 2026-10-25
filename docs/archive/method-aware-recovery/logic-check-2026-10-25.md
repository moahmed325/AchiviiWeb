# Logic check: missed days and recovery, after B-38, B-39, B-51, B-53 (2026-10-25)

Part of B-46 (1). Covers what changed since the 2026-10-11 check: restart (B-38), due dates (B-39), lessons coming
back from "next week" (B-51) and hidden done copies (B-53). All findings were fixed the same day (Mo: "fix them all,
choose the best option"), on `fix/backlog-final`.

## Findings and what was decided

| # | Finding | Grade | Outcome |
|---|---|---|---|
| 1 | Next week's handoff could place a due-dated "no room" step after its date. | Clash | Fixed: the handoff never places a step after its `dueDate`; it is only told to the writer (`placeHandoff`). |
| 2 | A swap could move a due-dated step past its date. | Clash | Fixed: an open swap that would put a step after its `dueDate` is refused with `past_due` ("That step is due before then, so it cannot move there."), in every switch state (`openSwapRefusal`). |
| 3 | Restart marks only the next session ("start again") on a step whose own text says "day 2", and later steps keep their numbers. | Silly | Decided: option B (wording), not A (a restart queue). A would need new planner logic that resets an order, the riskiest kind of change for the "never lose a step" rule. The lead line now reads "{Weekday} was missed, so start the process again from its first step today, in place of this step." Next week's writer is told to restart from the first step. Revisit A if people find it confusing. |
| 4 | A deadline that passed during an open gap was never mentioned. | Undefined | Fixed: the welcome-back line adds "The deadline for "{step}" passed while you were away." for a not-done step in the gap whose `dueDate` is before today. |
| 5 | Restarts were counted as "continued" in the week's counts. | Silly | Fixed: `DayOutcome.restart` and a separate `restarted` count in `weekCounts`. |

## Assumptions the rules make

- The writer adds `dueDate` only for real outside deadlines (told, not checked); code drops one on or before the step's own day.
- A process has a clear first step; vague steps make "start from the first step" unclear.
- People read a step's lead line.

## Stories that were OK

- A due-dated step missed Monday moves to the earliest day on or before its date.
- A due-dated step whose date passed moves nothing and says the deadline passed; a closed last chance also says so.
- Restart missed twice in a row: the newest marker wins.
- A missed Friday process step has its restart handed to next week's writer.
- "Set today aside", then doing the day anyway: the lesson listed for next week comes back this week (B-51).
- A lesson waiting from last week's handoff stays waiting when that day is done.
- A step hidden because it was done elsewhere blocks neither moves nor rest gaps (B-53).
- A hard process kind is refused by the profile checks.
