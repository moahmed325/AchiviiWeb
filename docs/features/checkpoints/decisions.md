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
