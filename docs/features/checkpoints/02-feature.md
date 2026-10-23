# Achivii Checkpoints — Feature Definition

**Status:** DRAFT
**Date:** 2026-10-23
**Builds on:** `01-brief.md` (direction chosen, CP-1 to CP-4)
**Decisions:** docs/features/checkpoints/decisions.md

## 1. Summary
At the close of weeks 4 and 8, code checks whether someone's pace will get them to their day-90 target. If it clearly won't, Today shows one honest card: what they'll reach at this pace, and the choice to keep the target or aim for a realistic one. The plan always ends on day 90. People on track see nothing.

**Main idea:** be honest early, let the person choose once, and never decide for them (I-9, CP-1, CP-3).

## 2. User journey
1. Week 4 closes, through the weekly review or the automatic close. The weekly update runs as today.
2. Code reads week 4's measured result and works out the pace and the day-90 forecast (RULE-3, RULE-4).
3. On track: nothing changes and nothing is shown.
4. Clearly behind: Today shows the checkpoint card above the day (RULE-7). The plan is never held up; the person can train and ignore it.
5. "Aim for {realistic}": week 12 takes the realistic target and the weeks between are spread up to it (RULE-9). The card goes and one line confirms it. The Roadmap, Today's closing stretch and the review show the day-90 target with their goal beside it (RULE-11).
6. "Keep my goal", dismissing the card, or not answering before week 5 closes: nothing changes (RULE-8).
7. Week 8 closes and checks again against week 12 as it is now (RULE-10). Clearly behind again: one last offer. Lowered at week 4 and caught up: an offer to go back to the full goal.

## 3. Words we use
**Checkpoint:** the check at the close of week 4 or week 8. At most one offer each, so at most two per plan.
**Day-90 target:** week 12's target as stored (as `safeGoalTargets` reads it). This is what the check measures against.
**Full goal:** week 12's target when the first offer was made. It is the number "Your goal" shows.
**Result:** that week's measured test result as a number in the target's unit (`resultNumber`). On a light-test goal, the big test of week 4 or 8.
**Starting point:** `Goal.roadmap.startingPoint.value`.
**Pace:** how far the result has moved from the starting point per week done.
**Forecast:** where the pace gets them by the end of week 12.
**Realistic target:** the forecast, rounded toward the easier side to a clean number (RULE-5).
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

**RULE-3 — Pace and forecast.** Every number is in the target's direction: for lower-is-better, "more" means lower.
- *Weeks done:* the closing week's number minus the jumped weeks before it.
- *Pace:* (result − starting point) ÷ weeks done.
- *Forecast:* result + pace × (12 − closing week).
- For a target with a family, the forecast is never past the safe climb: `nextSafeStep` applied once per week left, starting from the result (CP-5).
- The forecast is never past the full goal, or past the day-90 target when it is not a raise.

**RULE-4 — Clearly behind.**
- *Climb:* day-90 target − starting point.
- *Share:* (forecast − starting point) ÷ climb.
- Clearly behind when the share is under `CHECKPOINT_BEHIND_PERCENT` (75), a number kept with the limit numbers (CP-5).
- A result at or past the day-90 target is on track.
- The weekly update's status and steps that wait in order never count (CP-5, CP-9).
- Ahead of pace: nothing (CP-13).

**RULE-5 — The realistic target.** The forecast, never below the result, rounded toward the easier side to its unit's step (CP-6):
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

Rounding can't take it below the result (lower-is-better: above the result). If the rounded value is not easier than the day-90 target, there is no offer (on track).

**RULE-6 — What the check decides.** At week 4, and at week 8 unless RULE-10's raise applies, one of:
- *on track:* nothing;
- *lower:* clearly behind, pace above 0, and the realistic target easier than the day-90 target;
- *line only:* clearly behind with pace 0 or backwards. There's no realistic target, only the honest line and "Got it" (CP-6).

**RULE-7 — The card.** One card on Today, above the day, from the close until it is answered, dismissed or expires (CP-10). It never blocks Today, the week, reconcile or any other screen. The words are code's fixed lines (section 6, CP-14). The amount is shown as the weekly update's safe-step line shows it (`nextWeekSentence`: no metric label, " or less" for lower-is-better). Week 8's card is worded as the last check. The weekly review modal doesn't change.

**RULE-8 — Keep, dismiss, expire.** "Keep my goal", "Got it", dismissing the card and "Keep {target}" all store the answer `keep` and change nothing. An offer still open when the next week closes is stored as `keep` with `by: expired` before that close's own checkpoint runs. Answers are final (CP-11).

**RULE-9 — Choosing the realistic target.**
- Week 12 takes the realistic target. Each week after the open week, up to week 11, is spread evenly from the open week's target to the new week 12 and rounded easier with RULE-5's steps. A lowered week is never harder than it was.
- The open week keeps its target, tasks and test.
- On a light-test goal only the big weeks are set, and each light week shows its next big week's target, as today (the open light week too; its tasks and test don't change).
- Changed weeks get their code-written text the way the weekly update stores targets (`withTargetText`). On a pathway, week 12's `finalTest` is refilled from the preset.
- `Goal.roadmap.finalGoal` is never changed.
- It is all saved in one transaction with the answer (CP-11).

**RULE-10 — Week 8.** Week 8 measures against the day-90 target as it is now (CP-12):
- *Kept or no offer at week 4:* RULE-6 as at week 4, worded as the last check.
- *Lowered at week 4:* if the forecast reaches the full goal (inside the safe climb, RULE-3), the offer is to go back up ("raise"). "Aim for {full goal}" sets week 12 back to the full goal and spreads the weeks between up to it by RULE-9. Each changed week must pass the safe climb from the week before; if it can't, there's no raise offer. Otherwise RULE-6 applies against the lowered target.
- No checkpoint after week 8.

**RULE-11 — The day-90 line.** While a lower answer stands (a later raise clears it), the goal response sends `dayNinetyLine` with the realistic target and the full goal. Every place that shows `week12Line` shows this line instead: the Roadmap's current week 12 and the Destination, Today's closing stretch, and the review's next week. When it is null, `week12Line` shows as today.

**RULE-12 — The weekly update after a choice.** It treats the stored week 12 as fixed, as today (WU-15). Its lower bound, holds and safe climb run on the stored targets. It never moves week 12 back toward the full goal.

**RULE-13 — Logs.** Each checkpoint logs one line: `[Checkpoint] goal <id> week <n> result <r|none> forecast <f|none> share <p|none> outcome <lower|raise|line_only|on_track|none> reason <why|none>`. Each answer logs `[Checkpoint] goal <id> week <n> answer <keep|realistic|full_goal> by <person|expired>`.

## 5. States and edge cases
| Situation | What happens |
|---|---|
| Either switch off | No check, no card, no `dayNinetyLine`; exactly today (RULE-1) |
| Week 4 test not logged | No checkpoint; the re-test shows as today; week 8 still checks |
| Week 4 closed as a break, or jumped by "Keep going" | No checkpoint at week 4 |
| Short gap (under 7 days) moved the plan | Checkpoint runs; weeks done counts the week numbers, not the days |
| Light-test goal (run10k, recomp, speech, spanish) | Weeks 4 and 8 are big tests, so their results are used |
| Custom deliverable goal, or no starting point | No checkpoint (logged with its reason) |
| Week 12 already lowered by safety (WU-23) | The day-90 target is the lowered week 12; the full goal is that number |
| Result unit differs from the target's | No checkpoint (`resultNumber` reads nothing) |
| Offer open, person never opens the app | Expires as keep at the next close |
| Two tabs answer at once | The first answer wins; the second gets 409 and the card goes |
| Goal switched or abandoned with an offer open | The offer goes with the goal; nothing else is stored |
| Lowered at week 4, week 8 test not logged | No week 8 checkpoint; the lowered target stands |
| Lowered at week 4, behind again at week 8 | One more lower offer against the lowered target |
| Kept at week 4, on track at week 8 | Nothing |

## 6. Screens and copy
**Today:** the checkpoint card (a `Surface` with the primitives' buttons), the one-line confirmation after an answer, and the day-90 line in the closing stretch. **Roadmap and review:** the day-90 line where `week12Line` shows today.

**Copy rules:** neutral and encouraging (plan-v2 tone). Never "behind", "failed", "off track", "missed" or "fall short", and never a question about why. `{target}`, `{realistic}` and `{goal}` are amounts as RULE-7 shows them.

| Situation | Exact words |
|---|---|
| Card title, week 4 | "A check on your pace" |
| Card title, week 8 | "Last check on your pace" |
| Lower offer, body | "At this pace you'll reach about {realistic} by day 90. Your day-90 target is {target}." |
| Lower offer, buttons | "Aim for {realistic}" · "Keep my goal" |
| Line only, body | "Your result hasn't moved yet. Your day-90 target stays at {target}, and the next weeks build toward it." |
| Line only, button | "Got it" |
| Raise title | "You've caught up" |
| Raise body | "At this pace you'll reach {goal} by day 90." |
| Raise buttons | "Aim for {goal}" · "Keep {target}" |
| After "Aim for {realistic}" | "Your day-90 target is now {realistic}." |
| After "Aim for {goal}" (raise) | "Your day-90 target is back to {goal}." |
| Day-90 line | "Day-90 target: {realistic}. Your goal: {goal}." |
| Answer failed (5xx or network) | "Couldn't save your choice. Please try again." |

After keep or dismiss nothing new is shown. A 409 answer refreshes the goal and the card goes.

## 7. Data and system changes
- **Stored, no migration:** `Goal.roadmap.checkpoints`, a list with one entry per checkpoint that made an offer: `week`, `kind` (`lower`, `raise`, `line_only`), `result`, `forecast`, `target` (the day-90 target at the offer), `fullGoal`, `realistic` (null for line only), `answer` (null, `keep`, `realistic`, `full_goal`), `by` (`person`, `expired`), `answeredAt`. A missing list means none. On-track and no-checkpoint outcomes are only logged. It is written in the close's transaction, with the same read-modify-write the week-12 entry uses (WU-23).
- **Goal response** (`presentGoal`, both switches on): `checkpoint: { week, kind, target, realistic, fullGoal, last } | null` (the open offer) and `dayNinetyLine: { target, goal } | null`. Both are null with either switch off.
- **`POST /api/goal/checkpoint`** `{ week, answer }`, where answer is `keep`, `realistic` or `full_goal`:
  - 409 `weekly_update_disabled` with either switch off;
  - 409 `no_checkpoint` when no open offer matches the week, or the answer doesn't fit its kind;
  - 400 for any other body.
  - A conditional write makes the first answer win (RULE-8, RULE-9).
- **`CHECKPOINT_BEHIND_PERCENT`** (75) goes with the limit numbers (CP-5).
- `docs/architecture/plan-v2.md`'s checkpoint line is rewritten to this feature (CP-1).

**Must not break:**
- Plan safety limits: no target past the safe climb (RULE-1 to RULE-3 there).
- The weekly update and week close in WU-62's four switch states. State D equals A, and A, B and C stay byte-for-byte for goals that make no offer.
- Breaks, jumped weeks and the choice card (M1.5b).
- The re-test and the daily-time card.
- `week12Line` when no realistic target was chosen.
- The achievement screens (they read week 12's stored target as today; their day-90 wording is CP-4's feature).
- Goal creation.

## 8. Scope
**In scope:** the check at the close of weeks 4 and 8; the card and its answer; the target changes; the day-90 line; logs.
**Out of scope:** extensions or any change to the plan's length (CP-1); deliverable and custom-target forecasts (CP-5); in-order sequences as a signal (CP-9); undo (CP-11); anything for people ahead of pace (CP-13).
**Later:** the day-90 celebration and the next plan from their real level (I-10), and its pricing (I-11) (CP-4); forecasts for deliverable goals.

## 9. Acceptance criteria
- **AC-1** With either switch off, a close of week 4 or 8 stores no checkpoint, the goal response has `checkpoint` and `dayNinetyLine` null, and `POST /checkpoint` answers 409 `weekly_update_disabled`. WU-62's state A is unchanged. (RULE-1)
- **AC-2** A checkpoint runs only at the close of week 4 or 8, never on a break, a jumped week, an unlogged or light result, an unreadable unit, a deliverable target or a missing starting point. Each skip logs its reason. (RULE-2, RULE-13)
- **AC-3** Pace, forecast and share follow RULE-3 and RULE-4 for both directions, including the safe-climb cap for every target family and jumped weeks left out of weeks done. Tested with the brief's examples: 3 → 10 km, 4.5 km at week 4 is an offer of 7.5 km; 5 km is none. (RULE-3, RULE-4)
- **AC-4** The realistic target is rounded easier with RULE-5's steps, is never below the result, and gives no offer when it isn't easier than the day-90 target. Pace 0 or backwards gives the line-only card. (RULE-5, RULE-6)
- **AC-5** Today shows the card with the exact words of section 6 on desktop and mobile. It never blocks Today or another screen, and the review modal is unchanged. (RULE-7)
- **AC-6** Keep, "Got it", dismiss and expiry at the next close each store `keep` and change no target; an expired offer is stored before the next checkpoint runs. (RULE-8)
- **AC-7** "Aim for {realistic}" sets week 12, spreads the weeks between with no week harder than before, leaves the open week, light weeks and `finalGoal` as RULE-9 says, refills a pathway's `finalTest`, and saves it all in one transaction. A second answer gets 409. (RULE-9)
- **AC-8** Week 8 checks against the current week 12; a raise is offered only after a week-4 lower when the forecast reaches the full goal inside the safe climb; there are at most two offers per plan. (RULE-10)
- **AC-9** `dayNinetyLine` replaces `week12Line` in every place `week12Line` shows, and goes after a raise. (RULE-11)
- **AC-10** The weekly update after a choice keeps the stored week 12 and never climbs past the safe climb. (RULE-12)
- **AC-11** Every copy line and the log lines match sections 4 and 6 word for word. (RULE-7, RULE-13)
