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
**Changes:** `01-brief.md` section 7; open question 1 asks for the exact rule.

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
**Changes:** `01-brief.md` section 9, question 1 answered.

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
