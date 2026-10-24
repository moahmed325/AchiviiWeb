# Checkpoints — Decisions

**Prefix:** CP

How this log works: `docs/templates/decisions.md`.

**Inherited:** split out of the weekly update by `docs/features/weekly-update/decisions.md` WU-2 (2026-10-08).

### CP-1 — One choice, no extension (2026-10-23)
**Question:** what does a checkpoint at weeks 4 and 8 offer someone who is clearly behind: plan-v2's lower goal or 1-week extension, an automatic lower goal, or one choice?
**Decision:** one choice, no extension (I-9). The plan always ends on day 90 (only breaks move it). If clearly behind, give an honest forecast and let the person choose once between the full goal (only while still safe) and a realistic day-90 target. This replaces plan-v2's 1-week extension and "at most 2 extensions".
**Why (Mo):** 90 days is the promise; an extension touches every screen that assumes 12 weeks and opens the door to a plan that keeps sliding; an automatic change takes the choice away.
**Changes:** `01-brief.md` sections 6 to 8; plan-v2's checkpoint line (to update when the feature definition is written); I-9 moved here.

### CP-2 — Code decides "clearly behind", the model only words it (2026-10-23)
**Question:** who decides that the goal is out of reach by day 90?
**Decision:** code, from the logged results, the targets and the safe-step limits. The model only writes the forecast line, and code checks it like the weekly update's sentence.
**Why:** testable and the same every time; for target families code can already count the safe climb (`safeTargetClimb`).
**Changes:** `01-brief.md` section 7; open question 1 asks for the exact rule. The "model only words it" half is replaced by CP-14.

### CP-3 — Ignored means the full goal stays (2026-10-23)
**Question:** what happens if the person ignores or dismisses the offer?
**Decision:** nothing changes. Ignored at week 4: asked again at week 8 if still behind. Ignored at week 8: the full goal stays, with WU-23's safe-step week 12 on a high-load goal. Never decided for them, and the offer never blocks the plan.
**Why:** the choice is theirs; someone who just wants to train is never held up.
**Changes:** `01-brief.md` section 7.

### CP-4 — Day 90 and the next plan are a separate feature (2026-10-23)
**Question:** are the day-90 celebration and the next plan from their real level (I-10), and its pricing (I-11), part of this feature?
**Decision:** no, their own later feature. The checkpoint copy may say the rest of the goal is the next plan.
**Why:** keeps checkpoints small so `WEEKLY_UPDATE_ENABLED` can be turned on sooner (WU-23); pricing waits on billing M2.5 anyway.
**Changes:** `01-brief.md` section 8 (out of scope).

### CP-5 — "Clearly behind" is a pace forecast under 75% of the climb (2026-10-23)
**Question:** what exact rule says someone is clearly behind at week 4 or 8?
**Decision:** code works out their pace = (result − starting point) ÷ weeks done (jumped weeks not counted), and a forecast = result + pace × weeks left to 12, never past what the safe climb allows from the result (`nextSafeStep`, for the six target families). Clearly behind when the forecast covers less than 75% of the climb from the starting point to the final goal (one tunable number, kept with the limit numbers), or when the safe climb alone can't reach the final goal. It needs a number target, a starting point and a usable result (`resultNumber`); deliverable targets and goals with no starting point get no checkpoint in this feature. The weekly update's `far_behind` status doesn't count (it may be logged).
**Why:** the safe climb alone is a ceiling that rarely bites (running distance can climb 10% a week); stored week targets are lowered by the update's holds, so they hide the gap; the person's own pace against the final goal doesn't depend on either. Example: 3 → 10 km, 4.5 km at week 4 forecasts 7.5 km (64%), an offer; 5 km forecasts 9 km (86%), none.
**Changes:** `01-brief.md` section 9, question 1 answered. Pace and forecast replaced by CP-15.

### CP-6 — The realistic target is their forecast, rounded easier (2026-10-23)
**Question:** what realistic day-90 target is offered?
**Decision:** the CP-5 forecast (already capped by the safe climb), never below the current result and never above the final goal, rounded toward the easier side to a clean number for its unit (for example km to 0.5, minutes to whole, lift kg to 2.5; exact steps in the feature definition). With no progress at all (pace 0 or backwards) no realistic target is offered, only the honest line.
**Why:** honest and reachable at the pace they've shown; a target halfway to the goal would again be one their pace may miss.
**Changes:** `01-brief.md` section 9, question 3 answered.

### CP-7 — No measured result, a break or a jumped week: no checkpoint at that close (2026-10-23)
**Question:** is there a checkpoint when the week 4 or 8 test isn't logged, the close is a break, or the week was jumped?
**Decision:** no. A checkpoint needs a measured result of that week (on a light-test goal the big test at week 4 or 8). A close that is a break (gap of 7 days or more), or a jumped week 4 or 8, has none either; the welcome back and the re-test come first. Week 8 still checks when week 4 had none. A re-test result logged later does not start one.
**Why:** no data, no forecast; one place where the offer starts (the week close) keeps it simple.
**Changes:** `01-brief.md` section 9, question 4 answered.

### CP-8 — Checkpoints run only with the weekly update (2026-10-23)
**Question:** does the checkpoint get its own switch, or run with `WEEKLY_UPDATE_ENABLED`?
**Decision:** no new switch: checkpoints run only when the weekly update runs (`weeklyUpdateEnabled()`, both `WEEK_CLOSE_ENABLED` and `WEEKLY_UPDATE_ENABLED` exactly `true`). Weekly-update O2 turns both on together.
**Why:** WU-23 says the update must never run in production without checkpoints; no new switch states beyond WU-62's four.
**Changes:** `01-brief.md` section 9, question 5 answered; weekly-update O2 note.

### CP-9 — Sequences don't count, results only (2026-10-23)
**Question:** does being behind on an in-order sequence (lessons that wait, WU-12) count toward "clearly behind"?
**Decision:** no. CP-5 reads the measured result only.
**Why:** steps that wait already slow the result, and the weekly update's week-behind hold (WU-11) already holds targets; a second signal would be hard to explain and has no number to forecast.
**Changes:** `01-brief.md` section 9, question 2 answered; closes WU-12's note for this feature.

### CP-10 — The offer is a Today card until the next close (2026-10-23)
**Question:** where does the offer appear, and for how long?
**Decision:** after the close of week 4 or 8 (weekly review or automatic close), Today shows one card: the honest forecast line, "Keep my goal" and "Aim for {realistic}". It never blocks the plan. Dismissed, or not answered by the next week close, counts as keep (CP-3). The review modal is unchanged.
**Why:** one place for both close paths; the week after the checkpoint is already written by the close, so the choice only changes later weeks anyway.
**Changes:** `01-brief.md` section 9, question 6 answered.

### CP-11 — Choosing the realistic target changes targets only, and is final (2026-10-23)
**Question:** what changes when they choose the realistic target, and can they change their mind?
**Decision:** week 12 takes the realistic target; code spreads the weeks between (after the open week, which keeps its target) evenly up to it, never harder than stored and always inside the safe climb; on a light-test goal only the big weeks are set and the light weeks follow; on a pathway week 12's `finalTest` is refilled from the preset. `Goal.roadmap.finalGoal` is kept; the screens show the day-90 target with the goal beside it, as `week12Line` does ("Day-90 target: 7.5 km. Your goal: 10 km."). The offer and the answer are stored in `Goal.roadmap` (no migration). No undo; week 8 may still check (CP-12).
**Why:** the person's own goal stays in the app (the rest is the next plan, I-10); one state, no exact put-back to test.
**Changes:** `01-brief.md` section 9, question 7 answered.

### CP-12 — Week 8 checks against the current week 12 (2026-10-23)
**Question:** how do the week 4 and week 8 checkpoints work together?
**Decision:** week 8 always measures against the current week 12 (the full goal, or the realistic target chosen at week 4). Clearly behind again: one more offer, worded as the last check. If they lowered at week 4 and their week 8 forecast now reaches the full goal, week 8 offers to go back up to it, only inside the safe climb. At most one offer per checkpoint, so at most two per plan.
**Why:** CP-3 asks again at week 8; someone who catches up after lowering is not stuck with a too-easy week 12 (the weekly update never changes week 12, WU-15).
**Changes:** `01-brief.md` section 9, question 8 answered. The raise rule is replaced by CP-16.

### CP-13 — Ahead of pace: nothing (2026-10-23)
**Question:** what happens for someone ahead of pace at a checkpoint?
**Decision:** nothing: no forecast and no offer (I-9). "Go further" belongs to the day-90 feature (I-10, CP-4).
**Why:** no forecast when on track; keeps this feature to people who are behind.
**Changes:** `01-brief.md` section 9, question 9 answered. Proposed in the review chat; Mo did not object.

### CP-14 — Code writes the forecast line (2026-10-23)
**Question:** who writes the checkpoint's forecast line: the model (CP-2) or code?
**Decision:** code, from fixed lines in the copy table with code's numbers filled in. No model call. Replaces the "the model only words it" half of CP-2; code still decides everything (CP-2's first half stands).
**Why:** every number in the line is code's anyway; no time limit, fallback or wording check to build, and the words are testable exactly.
**Changes:** CP-2 (second half replaced); `02-feature.md` RULE-7 and section 6.

### CP-15 — The forecast follows the plan's own shape (2026-10-24)
**Question:** the straight-line pace of CP-5 tells someone exactly on a slow-starting plan that they won't make it (logic check 2026-10-24, finding 1). How should the forecast read progress?
**Decision:** compare the result with that week's planned target: progress share = (result − starting point) ÷ (planned target − starting point), forecast = starting point + progress share × the climb to the day-90 target, with CP-5's safe-climb cap and 75% line. When the planned progress up to that week is under 10% of the climb (`CHECKPOINT_FLAT_PLAN_PERCENT`), the share means nothing and CP-5's straight line is used. Replaces CP-5's pace and forecast; the rest of CP-5 stands.
**Why (Mo):** someone who did exactly what the plan asked is always on track, however the plan curves; a week the update held makes the check a little gentler, which fits "only when clearly behind".
**Changes:** CP-5 (pace and forecast replaced); `02-feature.md` section 3, RULE-3, RULE-4, AC-3.

### CP-16 — Week 8 can raise part of the way back (2026-10-24)
**Question:** someone who lowered at week 4 and is now ahead of the lowered target, but not on course for the full goal, is stuck aiming below what they already do (logic check 2026-10-24, finding 2). Raise only to the full goal, or part of the way?
**Decision:** part of the way: at week 8, after a week-4 lower, the forecast may go past the day-90 target (up to the full goal and the safe climb), and when the rounded forecast is at least one step harder than the day-90 target the offer is a raise to it, at most the full goal. Replaces CP-12's "only back up to the full goal"; the rest of CP-12 stands.
**Why (Mo):** week 12 should never sit below what someone already does; the weekly update can't raise week 12 (WU-15).
**Changes:** CP-12 (raise rule replaced); `02-feature.md` RULE-9, RULE-10, section 6 (raise copy), AC-8.
