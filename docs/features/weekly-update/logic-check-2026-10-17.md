# Weekly Update — Logic check (2026-10-17)

Checked `02-feature.md` as of `c7b58b9` (after WU-11, WU-12), the decision lines in `decisions.md` and the parts of `docs/decisions.md` that touch the weekly update. Code was read once, to answer one question: the test day is always the week's last practice day (`backend/src/lib/ai/weekPlan.ts:60`); rest days can follow it.

**Summary:** 15 stories. 8 findings: 3 Clash, 2 Silly, 3 Undefined, plus 3 smaller points and 3 hidden assumptions. 7 stories OK. Decisions taken: WU-13 to WU-20 in `decisions.md`.

## Findings, worst first

1. **A short absence after the week ends (Silly) → WU-13.** Back 6 days after the week ended: not a break (RULE-13), so the new week is written starting 6 days ago, 6 days count as missed, carry crowds the one day left, and the test is tomorrow. Back 8 days: a clean restart. The person is "missing" days they never saw. *Decided: days before the week is written are never missed; a 2 to 6 day gap moves the plan (counted toward 28), falling back to "not offered" when the limit is used up.*
2. **The automatic close loses a test that was done (Silly) → WU-14.** Test on the week's last day, app opened the next morning: the week has closed (bedtime plus 2 hours), the late-test card is gone, they're told the test wasn't logged. *Decided: a "Log last week's test" card with Skip before the close; it never blocks the app; unanswered, the week closes as unlogged at the day's close.*
3. **Week 12's final goal against the holds (Clash) → WU-15.** Week 11 `far_behind` or unlogged: the hold says week 12 equals week 11's target, RULE-4 says week 12 is the final goal. Every answer is rejected. *Decided: no hold applies before week 12.*
4. **The restart level against "never below what they achieved" (Clash) → WU-16.** A "back 2 weeks" return rule sets a target RULE-4 rejects. *Decided: in the first week back, the restart level is the lower bound.*
5. **Order of the week close and missed sessions' carry (Clash/Undefined) → WU-17.** On a return, reconcile's carry and the automatic close both act on the old week's missed days. *Decided: the close is saved first, then reconcile with its shipped scope (the week holding today and the week before); with nobody away the carry result is unchanged.*
6. **Where the re-test result goes (Undefined) → WU-17.** RULE-5's re-test and the week's own test both land in one week. *Decided: the re-test is the earlier week's late `testResult`; the next update reads it as trend.*
7. **When a break starts (Undefined) → WU-18.** Counting from the week's end picks "1-2 weeks" for someone away 3.5 weeks, and grades that week `far_behind`, which can trigger RULE-6 after the return. *Decided: count from the last done step (the week's start if none); that week does not count toward RULE-6.*
8. **Weeks jumped under "keep going" (Undefined) → WU-19.** RULE-1 would run an update for each week that never happened. *Decided: jumped weeks close with no update; the break's one update spreads the targets.*

## Smaller points and hidden assumptions → WU-20
- The daily-time question with no shorter option left; "asks once" undefined. *Ask only when a shorter option exists, again at each new run of two hard weeks.*
- "Back 2 weeks" in week 1 or 2. *Week 1 is the lowest restart level.*
- Deliverable targets "in words": code can't compare words. *List the checks code runs.*
- Assumes they open Today. *Any screen that loads the goal starts the close.*
- Assumes the model is up. *Days waiting on a failed write count toward neither a gap nor a break.*
- Assumes the test day is the last practice day. True in code; findings 2 and 6 rely on it.

## Stories that were OK
- Normal week, review submitted on test day.
- Two tabs at the week change: one close (RULE-9).
- Two sessions in one day, or tomorrow's step today: no effect on the update.
- Time zone change: the close uses the current time zone.
- Custom goal with 2 sessions a week, one step behind: no hold (WU-11's "at least 2").
- Deliverable goal with an in-order kind a week behind: target held, kind named.
- Away 6 weeks, "Start a fresh plan": text prefilled, old goal archived, Pro still needed (WU-9).
