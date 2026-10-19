# Weekly Update — Logic check, past the limit (2026-10-19)

Checked `02-feature.md` and the decision lines in `decisions.md` as of `e370f7e`, focused on M1.5b (RULE-15: the choice card, "Keep going" with jumped weeks, the fresh plan). Code was read once, to answer one question: the test card shows whenever the closing week's test isn't logged, however long the gap (`frontend/src/context/GoalContext.tsx:188`, `backend/src/routes/goal.ts:1232`).

Example used below: week 5 closes. The gap is the number of days from week 6's planned start to the first open that tried to close week 5; the room is `28 − movedDays`; the overflow is the gap minus the room.

**Summary:** 13 stories. 9 findings: 3 Clash, 3 Silly, 3 Undefined, plus 4 smaller points. 4 stories OK. Mo took every recommendation (2026-10-19): WU-37 to WU-41 in `decisions.md`.

## Findings, worst first

1. **"The first week back starts today" against the limit (Clash) → WU-37 (1).** Away 45 days, nothing moved: the plan moves 28, the calendar is on day 4 of week 8, so week 8's first 3 days would be not offered and the test comes in 4 days. RULE-14 says the first week back starts today. *Decided: move the most days the limit allows that make a week start today (here 24: weeks 6 to 8 jumped, week 9 starts today); if no such number exists, move what fits and the passed days of the week holding today are not offered.*
2. **A week wholly in the past closes again (Clash, M1.5a review) → WU-37 (2).** With an overflow of 7 or more, M1.5a writes week 6 wholly in the past; the next open closes it again as another break (another model call, another welcome back). *Decided: no week is written until the person chooses; "Keep going" writes the week holding today, never one in the past.*
3. **The card for an 8-day absence (Silly) → WU-37 (3).** 25 days already moved, away 8: the limit stops the move, so the card offers a fresh plan after a week away. *Decided: the card shows only when at least one whole week would be jumped (overflow 7 or more); below that, M1.4's partial move with days not offered and the welcome-back line stay.*
4. **Other screens while the choice waits (Undefined) → WU-38 (1).** RULE-8 says any screen that loads the goal closes the week; going to another screen counts as Skip for the test card, which here would choose "Keep going" for them, and that can't be undone. *Decided: while a choice waits nothing closes and reconcile waits; any screen that loads the goal sends them to Today's card.*
5. **The move lands past week 12 (Undefined) → WU-38 (2).** Week 10 closes, away 7 weeks: after 28 days the calendar is past week 12. *Decided: the card offers a fresh plan or "Do my final week"; the final week is week 12, starting today, even past the 28-day limit (the only exception).*
6. **"Last week's test" after weeks away (Silly) → WU-39.** After 6 weeks away Today asks "Did you do last week's test?" about a week that ended 6 weeks ago, whose test day often came after the break started. Applies to M1.5a's breaks too. *Decided: a close that is a break (gap 7 or more) shows no test card and closes as unlogged.*
7. **Jumped weeks on Roadmap and Progress (Undefined) → WU-40 (1).** Weeks with no tasks and no review; no rule says how they look, and the copy rules leave no word. *Decided: shown muted with the label "Paused", no score, no review row, left out of any average.*
8. **The welcome-back line hides the jump (Silly) → WU-40 (2).** "Your plan picks up from here" says nothing about the weeks skipped. *Decided: "Welcome back. Your plan picks up at week {n} and now ends on {date}."*
9. **The first week back can be a big-test week (Clash, safety) → WU-41.** A jump (or an ordinary break) can land on week 4 or 8; for run10k the stored test may be a time trial after weeks off. B-63 refuses max tests only in weeks 1 to 3, and a sentence copied from the stored test is only logged. *Decided: in a first week back of a high-load goal, the writer is told the weekly test is a light version (no time trial, no max, nothing to failure), and the weeks 1 to 3 rules of `safetyScan.ts` apply to that week's steps, copied test sentences included.*

## Smaller points
- **The fresh-plan copy promised the level** ("from where you are now"), which WU-24 doesn't carry over. *WU-40 (3): "Start a fresh 12-week plan".*
- **A custom goal with lapsed Pro:** "Start a fresh plan" leads to the upgrade screen; "Keep going" still works. Fine as it is; the prompt says so.
- **A pathway goal's fresh plan:** the goal stores no pathway id, so the text goes through goal creation and `findPresetForGoal` decides, as for any typed goal. Fine as it is.
- **Hidden assumption: the card is answered on the first open.** Tab closed, back 3 days later: the gap counts from the first try (RULE-9), so those days are not offered. Matches WU-28; fine.

## Stories that were OK
- Two tabs pick different answers: RULE-9's guard closes once; a finished fresh plan archives the old goal.
- Leaving goal creation halfway: nothing saved, the card shows again.
- A second long break with all 28 days used: nothing moves, the card shows, "Keep going" jumps the weeks.
- A break while week 12 is open: RULE-11, the closing stretch, no break logic.
