# Achivii Checkpoints — Feature Definition

**Status:** DRAFT
**Date:** 2026-10-23 (logic check fixes 2026-10-24, `logic-check-2026-10-24.md`)
**Builds on:** `01-brief.md` (direction chosen, CP-1 to CP-4)
**Decisions:** docs/features/checkpoints/decisions.md

## 1. Summary
At the close of weeks 4 and 8, code checks whether someone's progress will get them to their day-90 target. If it clearly won't, Today shows one honest card: what they'll reach at this pace, and the choice to keep the target or aim for a realistic one. The plan always ends on day 90. People on track see nothing.

**Main idea:** be honest early, let the person choose once, and never decide for them (I-9, CP-1, CP-3).

## 2. User journey
1. Week 4 closes, through the weekly review or the automatic close. The weekly update runs as today.
2. Code compares week 4's measured result with week 4's planned target and works out the day-90 forecast (RULE-3, RULE-4).
3. On track: nothing changes and nothing is shown.
4. Clearly behind: Today shows the checkpoint card (RULE-7). The plan is never held up; the person can train and ignore it.
5. "Aim for {offered}": week 12 takes that target and the weeks between are spread up to it (RULE-9). The card goes and one line confirms it. The Roadmap, Today's closing stretch and the review show the day-90 target with their goal beside it (RULE-11).
6. "Keep my goal", dismissing the card, or not answering before week 5 closes: nothing changes (RULE-8).
7. Week 8 closes and checks again against week 12 as it is now (RULE-10). Clearly behind again: one last offer. Lowered at week 4 and now ahead of that: an offer to raise it again, up to the full goal.

## 3. Words we use
**Checkpoint:** the check at the close of week 4 or week 8. At most one offer each, so at most two per plan.
**Day-90 target:** week 12's target as stored (as `safeGoalTargets` reads it). This is what the check measures against.
**Full goal:** week 12's target when the first offer was made. It is the most a raise can go back up to.
**Goal shown:** the number "Your goal" shows. It is `week12Line`'s goal when safety lowered week 12 (WU-23), otherwise the full goal (changed 2026-10-24, logic check finding 4).
**Result:** that week's measured test result as a number in the target's unit (`resultNumber`). On a light-test goal, the big test of week 4 or 8.
**Planned target:** that week's own target as stored (as `safeGoalTargets` reads it).
**Starting point:** `Goal.roadmap.startingPoint.value`.
**Progress share:** how much of the planned progress up to this week the result made.
**Forecast:** where that share of the whole climb gets them by the end of week 12.
**Offered target:** the forecast, rounded toward the easier side to a clean number (RULE-5). It is lower than the day-90 target in a lower offer, higher in a raise.
**Clearly behind:** the forecast covers less than 75% of the climb (RULE-4).
**Offer:** the open question on Today, until it is answered, dismissed or expires.

## 4. Rules
**RULE-1 — Only with the weekly update.** Checkpoints run only when `weeklyUpdateEnabled()` is true: both `WEEK_CLOSE_ENABLED` and `WEEKLY_UPDATE_ENABLED` exactly `true` (CP-8). With either switch off nothing is checked, stored or shown, and the goal response has no offer and no day-90 line.

**RULE-2 — When a checkpoint runs.** Only at the close of week 4 or week 8 (review or automatic), after the weekly update has decided the targets, and inside the close's one transaction. There is none when:
- the close is a break (gap of 7 days or more), or week 4 or 8 was jumped (CP-7);
- that week has no result: test not logged, a light test, or a unit `resultNumber` can't read (CP-7);
- the target is a deliverable, or the starting point is missing (CP-5);
- the climb is not in the target's direction (week 12 not beyond the starting point).

A re-test result logged later never starts one. Week 8 still checks when week 4 had none. A lost close race stores nothing.

**RULE-3 — Progress share and forecast.** Every number is in the target's direction: for lower-is-better, "more" means lower. (Changed 2026-10-24, CP-15.)
- *Climb:* day-90 target − starting point.
- *Planned progress:* planned target − starting point.
- *Progress share:* (result − starting point) ÷ planned progress. Someone exactly on plan has a share of 1, however the plan curves.
- *Forecast:* starting point + progress share × climb.
- *Flat start:* when planned progress is under `CHECKPOINT_FLAT_PLAN_PERCENT` (10) of the climb, the share means nothing. The forecast then uses the straight line instead: result + (result − starting point) ÷ weeks done × (12 − closing week). Weeks done is the closing week's number minus the jumped weeks before it.
- For a target with a family, the forecast is never past the safe climb: `nextSafeStep` applied once per week left, starting from the result (CP-5).
- The forecast is never past the full goal. It is never past the day-90 target, except in RULE-10's raise check.

**RULE-4 — Clearly behind.**
- *Share of the climb:* (forecast − starting point) ÷ climb.
- Clearly behind when that share is under `CHECKPOINT_BEHIND_PERCENT` (75). The number is kept with the limit numbers (CP-5).
- A result at or past the day-90 target is on track.
- The weekly update's status and steps that wait in order never count (CP-5, CP-9).
- Ahead of pace: nothing (CP-13), apart from RULE-10's raise.

**RULE-5 — The offered target.** The forecast, never on the wrong side of the result, rounded toward the easier side to its unit's step (CP-6):
- km or mi: 0.5
- metres: 100
- minutes: 1
- seconds: 5
- hours: 0.25
- kg on a lift: 2.5
- lb on a lift: 5
- body weight: 0.5 kg or 1 lb
- body fat: 0.5 point
- kcal: 50
- anything else: 1 when the value is 10 or more, otherwise 0.5

A lower offer is made only when the rounded value is easier than the day-90 target. A raise is made only when it is at least one step harder than the day-90 target.

**RULE-6 — What the check decides.** At week 4, and at week 8 unless RULE-10's raise applies, one of:
- *on track:* nothing;
- *lower:* clearly behind, the result above the starting point, and the offered target easier than the day-90 target;
- *line only:* clearly behind with the result at or behind the starting point. There's no offered target, only the honest line and "Got it" (CP-6).

**RULE-7 — The card.** One card on Today, from the close until it is answered, dismissed or expires (CP-10).
- *Never blocks:* it never holds up Today, the week, reconcile or any other screen.
- *When hidden:* it is not shown while a close is held (the test card first), a break choice is waiting, or the close failed. It comes back once they are gone.
- *Position:* otherwise it is the first card on Today, above the re-test line, the daily-time card and the week's insight line (changed 2026-10-24, logic check finding 5).
- *Words:* the words are code's fixed lines (section 6, CP-14). Amounts show as the weekly update's safe-step line shows them (`nextWeekSentence`: no metric label, " or less" for lower-is-better). Week 8's lower card is worded as the last check.
- The weekly review modal doesn't change.

**RULE-8 — Keep, dismiss, expire.** "Keep my goal", "Got it", "Keep {target}" and dismissing the card all store the answer `keep` and change nothing. An offer still open when the next week closes is stored as `keep` with `by: expired` before anything else in that close. Answers are final (CP-11).

**RULE-9 — Accepting an offer.**
- Week 12 takes the offered target. Each week after the open week, up to week 11, is spread evenly from the open week's target to the new week 12 and rounded easier with RULE-5's steps. After a lower, no week is harder than it was; after a raise, no week is easier than it was, and each must pass the safe climb from the week before, or no raise is offered (RULE-10).
- The open week keeps its target, tasks and test.
- On a light-test goal only the big weeks are set, and each light week shows its next big week's target, as today (the open light week too; its tasks and test don't change).
- Changed weeks get their code-written text the way the weekly update stores targets (`withTargetText`). On a pathway, week 12's `finalTest` is refilled from the preset.
- `Goal.roadmap.finalGoal` is never changed.
- It is all saved in one transaction with the answer (CP-11).

**RULE-10 — Week 8.** Week 8 measures against the day-90 target as it is now (CP-12).
- *Lowered at week 4:* the raise check comes first. The forecast may go past the day-90 target, up to the full goal and the safe climb. If the offered target is at least one step harder than the day-90 target, the offer is a raise to it, at most the full goal. It can be a partial raise (changed 2026-10-24, CP-16). Otherwise RULE-6 applies against the lowered target.
- *Kept or no offer at week 4:* RULE-6, worded as the last check.
- No checkpoint after week 8.

**RULE-11 — The day-90 line.** While an accepted offer leaves week 12 below the full goal, the goal response sends `dayNinetyLine` with the day-90 target and the goal shown. Every place that shows `week12Line` shows this line instead: the Roadmap's current week 12 and the Destination, Today's closing stretch, and the review's next week. A raise all the way to the full goal clears it. When it is null, `week12Line` shows as today.

**RULE-12 — The weekly update and the week writer after a choice.**
- The weekly update treats the stored week 12 as fixed, as today (WU-15). Its lower bound, holds and safe climb run on the stored targets. It never moves week 12.
- While `dayNinetyLine` is set, the weekly update's prompt and the week writer's prompt both get one line after the goal: "Day-90 target: {target} (their goal: {goal}); aim the plan at the day-90 target."
- With no choice standing, both prompts are byte-for-byte unchanged (changed 2026-10-24, logic check finding 3).

**RULE-13 — Logs.** Each checkpoint logs one line: `[Checkpoint] goal <id> week <n> result <r|none> planned <p|none> forecast <f|none> share <s|none> outcome <lower|raise|line_only|on_track|none> reason <why|none>`. Each answer logs `[Checkpoint] goal <id> week <n> answer <keep|accept> by <person|expired>`.

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Either switch off | No check, no card, no `dayNinetyLine`; exactly today (RULE-1) |
| Exactly on plan, plan starts slowly | Progress share 1, on track (RULE-3) |
| Plan nearly flat for the first weeks | Straight-line forecast (RULE-3) |
| Week 4 test not logged | No checkpoint; the re-test shows as today; week 8 still checks |
| Week 4 closed as a break, or jumped by "Keep going" | No checkpoint at week 4 |
| Short gap (under 7 days) moved the plan | Checkpoint runs; weeks done counts the week numbers, not the days |
| Light-test goal (run10k, recomp, speech, spanish) | Weeks 4 and 8 are big tests, so their results and targets are used |
| Custom deliverable goal, or no starting point | No checkpoint (logged with its reason) |
| Week 12 already lowered by safety (WU-23) | The day-90 target is the lowered week 12; "Your goal" still shows the named goal |
| Result unit differs from the target's | No checkpoint (`resultNumber` reads nothing) |
| Result fell below the starting point (sick) | Line-only card if clearly behind |
| Offer open, person never opens the app | Expires as keep at the next close |
| Test card or break choice on Today | Checkpoint card waits until they're gone |
| Two tabs answer at once | The first answer wins; the second gets 409 and the card goes |
| Goal switched or abandoned with an offer open | The offer goes with the goal; nothing else is stored |
| Lowered at week 4, week 8 test not logged | No week 8 checkpoint; the lowered target stands |
| Lowered at week 4, ahead of it at week 8 | Raise offer, partial or up to the full goal |
| Lowered at week 4, behind again at week 8 | One more lower offer against the lowered target |
| Kept at week 4, on track at week 8 | Nothing |

## 6. Screens and copy
**Today:** the checkpoint card (a `Surface` with the primitives' buttons), the one-line confirmation after an answer, and the day-90 line in the closing stretch. **Roadmap and review:** the day-90 line where `week12Line` shows today.

**Copy rules:** neutral and encouraging (plan-v2 tone). Never "behind", "failed", "off track", "missed" or "fall short", and never a question about why. `{target}` (the day-90 target), `{offered}` and `{goal}` (the goal shown) are amounts as RULE-7 shows them.

| Situation | Exact words |
|---|---|
| Card title, week 4 | "A check on your pace" |
| Card title, week 8 lower or line only | "Last check on your pace" |
| Lower offer, body | "At this pace you'll reach about {offered} by day 90. Your day-90 target is {target}." |
| Lower offer, buttons | "Aim for {offered}" · "Keep my goal" |
| Line only, body | "Your result hasn't improved yet. Your day-90 target stays at {target}, and the next weeks build toward it." |
| Line only, button | "Got it" |
| Raise title | "You've caught up" |
| Raise body, up to the full goal | "At this pace you'll reach {offered} by day 90." |
| Raise body, partial | "At this pace you'll reach about {offered} by day 90. Your day-90 target is {target}." |
| Raise buttons | "Aim for {offered}" · "Keep {target}" |
| After accepting a lower or partial raise | "Your day-90 target is now {offered}." |
| After a raise to the full goal | "Your day-90 target is back to {offered}." |
| Day-90 line | "Day-90 target: {target}. Your goal: {goal}." |
| Answer failed (5xx or network) | "Couldn't save your choice. Please try again." |

After keep or dismiss nothing new is shown. A 409 answer refreshes the goal and the card goes.

## 7. Data and system changes
- **Stored, no migration:** `Goal.roadmap.checkpoints`, a list with one entry per checkpoint that made an offer:
  - `week`, `kind` (`lower`, `raise`, `line_only`);
  - `result`, `planned`, `forecast`;
  - `target` (the day-90 target at the offer), `fullGoal`, `offered` (null for line only);
  - `answer` (null, `keep`, `accept`), `by` (`person`, `expired`), `answeredAt`.

  A missing list means none. On-track and no-checkpoint outcomes are only logged. It is written in the close's transaction, with the same read-modify-write the week-12 entry uses (WU-23).
- **Goal response** (`presentGoal`, both switches on): `checkpoint: { week, kind, target, offered, goal, last } | null` (the open offer, `goal` the goal shown) and `dayNinetyLine: { target, goal } | null`. Both are null with either switch off.
- **`POST /api/goal/checkpoint`** `{ week, answer }`, where answer is `keep` or `accept`:
  - 409 `weekly_update_disabled` with either switch off;
  - 409 `no_checkpoint` when no open offer matches the week, or `accept` on a line-only offer;
  - 400 for any other body.
  - A conditional write makes the first answer win (RULE-8, RULE-9).
- **`CHECKPOINT_BEHIND_PERCENT`** (75) and **`CHECKPOINT_FLAT_PLAN_PERCENT`** (10) go with the limit numbers (CP-5, CP-15).
- **The weekly update and week writer prompts** get RULE-12's day-90 line while a choice stands.
- `docs/architecture/plan-v2.md`'s checkpoint line is rewritten to this feature (CP-1).

**Must not break:**
- Plan safety limits: no target past the safe climb (RULE-1 to RULE-3 there).
- The weekly update and week close in WU-62's four switch states. State D equals A, and A, B and C stay byte-for-byte for goals that make no offer, prompts included.
- Breaks, jumped weeks and the choice card (M1.5b).
- The re-test and the daily-time card.
- `week12Line` when no offer was accepted.
- The achievement screens (they read week 12's stored target as today; their day-90 wording is CP-4's feature).
- Goal creation.

## 8. Scope
**In scope:** the check at the close of weeks 4 and 8; the card and its answer; the target changes; the day-90 line and the prompt line; logs.
**Out of scope:** extensions or any change to the plan's length (CP-1); deliverable and custom-target forecasts (CP-5); in-order sequences as a signal (CP-9); undo (CP-11); anything for people ahead of pace apart from the week-8 raise (CP-13).
**Later:** the day-90 celebration and the next plan from their real level, Pro for every goal (I-10, I-11, CP-4), including how the achievement screens word a lowered week 12; forecasts for deliverable goals.

## 9. Acceptance criteria
- **AC-1** With either switch off, a close of week 4 or 8 stores no checkpoint, the goal response has `checkpoint` and `dayNinetyLine` null, and `POST /checkpoint` answers 409 `weekly_update_disabled`. WU-62's state A is unchanged. (RULE-1)
- **AC-2** A checkpoint runs only at the close of week 4 or 8, never on a break, a jumped week, an unlogged or light result, an unreadable unit, a deliverable target or a missing starting point. Each skip logs its reason. (RULE-2, RULE-13)
- **AC-3** Progress share, forecast and share of the climb follow RULE-3 and RULE-4 for both directions, including the flat-start straight line, the safe-climb cap for every target family and jumped weeks left out of weeks done. Tested at least with: start 0, week-4 target 2, week 12 10 km, result 2 is on track; result 1.2 is an offer of 6 km; start 3, week-4 target 5, result 4 is an offer of 6.5 km. (RULE-3, RULE-4)
- **AC-4** The offered target is rounded easier with RULE-5's steps and never lands on the wrong side of the result. There is no lower offer when it isn't easier than the day-90 target. A result at or behind the starting point gives the line-only card. (RULE-5, RULE-6)
- **AC-5** Today shows the card with the exact words of section 6 on desktop and mobile, first among Today's cards. It is hidden while the test card, a break choice or a failed close shows. It never blocks Today or another screen, and the review modal is unchanged. (RULE-7)
- **AC-6** Keep, "Got it", dismiss and expiry at the next close each store `keep` and change no target. An expired offer is stored before anything else in that close. (RULE-8)
- **AC-7** Accepting a lower offer sets week 12, spreads the weeks between with no week harder than before, leaves the open week, light weeks and `finalGoal` as RULE-9 says, refills a pathway's `finalTest`, and saves it all in one transaction. A second answer gets 409. (RULE-9)
- **AC-8** Week 8 checks against the current week 12. After a week-4 lower it offers a raise, partial or to the full goal, only when the offered target is at least one step harder and every spread week passes the safe climb. There are at most two offers per plan. (RULE-9, RULE-10)
- **AC-9** `dayNinetyLine` replaces `week12Line` in every place `week12Line` shows. Its goal is `week12Line`'s goal when safety lowered week 12, and it goes after a raise to the full goal. (RULE-11)
- **AC-10** The weekly update after a choice keeps the stored week 12 and never climbs past the safe climb. While `dayNinetyLine` is set, both prompts carry RULE-12's line; without a choice both prompts match their fixtures byte for byte. (RULE-12)
- **AC-11** Every copy line and the log lines match sections 4 and 6 word for word. (RULE-7, RULE-13)
