# Achivii Checkpoints — Brief

**Status:** DIRECTION CHOSEN
**Date:** 2026-10-08 (stub); direction 2026-10-23
**Links:** `docs/architecture/plan-v2.md` (Weekly update: checkpoints), `docs/features/weekly-update/02-feature.md`, `docs/features/weekly-update/decisions.md` (WU-2, WU-12, WU-23), `docs/ideas.md` (I-9, I-10, I-11), `docs/features/plan-safety-limits/02-feature.md`

## 1. The problem
At weeks 4 and 8 someone may be so far off pace that the final goal is out of reach by day 90. Today the plan keeps aiming at the original goal anyway. The weekly update holds and spreads targets, but it cannot change the goal, so the last weeks can become an impossible climb and the person only finds out at the end. For a high-load goal, safety already caps week 12 at the highest safe step (WU-23), so the plan quietly ends below the goal it promised.

> "90 days stays the promise: someone who does every session reaches the goal on day 90." (Mo, I-9)

## 2. Who and when
People who are clearly behind after weeks 4 or 8: missed sessions, results well under the target, or a long break. It shows at the week close (the weekly review or the automatic close) on Today. People on track never see it.

## 3. What we know
- **Fact:** plan-v2 specifies a lower goal or a 1-week extension at weeks 4 and 8, at most 2 extensions (source: `docs/architecture/plan-v2.md`, "Weekly update"). Never built (WU-2).
- **Fact:** the 12-week, 90-day length is assumed widely: about 59 non-test uses of `TOTAL_WEEKS` in the backend, "Day N of 90", the closing stretch from day 85, the roadmap, progress and achievement screens (source: grep, 2026-10-23).
- **Fact:** the only things that move the plan's end are breaks and gaps, at most 28 days (`movedDays`), plus "Do my final week" (source: weekly-update RULE-14, M1.4, M1.5b).
- **Fact:** the weekly update gives each week a status `on_track`, `a_bit_behind` or `far_behind`, stored as `RoadmapWeek.updateStatus`, never sent to the app (source: `backend/src/lib/ai/weeklyUpdate.ts`, B-95). It sets the weeks left but keeps week 12 as the final goal (WU-15), except WU-23's safe-step case.
- **Fact:** code already knows the safe climb: `nextSafeStep` and `safeTargetClimb` (`backend/src/lib/safety/targetSteps.ts`) give the highest target reachable in N weeks for the six target families.
- **Fact:** on run10k, recomp, speech and spanish, weeks 4 and 8 are the big test weeks (`BIG_TEST_WEEKS`), so a checkpoint there has a measured result. Other pathways and custom goals test every week (weekly-update M2.1).
- **Fact:** `WEEKLY_UPDATE_ENABLED` stays off in production until this feature ships (WU-23, weekly-update O2).
- **Fact:** the goal's final goal is text in `Goal.roadmap.finalGoal`, plus week 12's target and `finalTest` (source: `backend/prisma/schema.prisma`, `lib/ai/roadmap.ts`).
- **Guess:** for goals without a target family (deliverables, custom number targets), code can't count safe steps, so "clearly behind" has to come from the trend of results against targets.

## 4. How bad it is, and why now
It blocks turning on the weekly update (WU-23). Without a checkpoint, the update moves the impossible climb into one visible last week. With it, someone behind hears it at week 4 or 8 and can choose a target they can actually reach.

## 5. What good looks like
Someone clearly behind at week 4 or 8 sees one honest line, for example "At this pace you'll reach 8 km around day 90", and chooses once: keep the full goal, or aim for a realistic day-90 target. The plan still ends on day 90. Someone on track sees nothing. Nobody is ever told off, and nothing is decided for them.

## 6. Options we looked at
### Option A: one choice, no extension (I-9)
The plan always ends on day 90. If clearly behind, give a forecast and let them pick once between the full goal (only if still safe) and a realistic day-90 target. Only targets change, no screen has to show a longer plan. **Chosen.**

### Option B: lower goal or a 1-week extension (plan-v2)
More flexible, but an extra week touches every screen and rule that assumes 12 weeks, and "at most 2 extensions" opens the door to a plan that keeps sliding. Lost: big cost, and it breaks the 90-day promise.

### Option C: lower the goal automatically
Code quietly sets week 12 to what is reachable and says so in one line. Simplest, but takes the choice away from the person. Lost: the choice is the point.

### Option D: do nothing
Keep the weekly update off, or turn it on with WU-23's honest week 12 line only. Lost: the person still finds out at the end, and the update stays off.

## 7. Chosen direction
Option A, with these choices (CP-1 to CP-4):
- **Code decides** whether someone is clearly behind, from the logged results, the targets and the safe-step limits. The model only writes the forecast line, and code checks it as it checks the weekly update's sentence (CP-2).
- **Ignored means no change.** Dismissing or ignoring the offer keeps the full goal. Ignored at week 4 means asked again at week 8 if still behind. Ignored at week 8 means the full goal stays, with WU-23's safe-step week 12 on a high-load goal (CP-3).
- **Day 90 and the next plan** (I-10, I-11) are their own later feature. The checkpoint copy may say the rest of the goal is the next plan (CP-4).

Agreed by Mo on 2026-10-23.

## 8. Limits
**In scope:** the checks at the close of weeks 4 and 8; the forecast; the one choice; storing the realistic target as week 12 and the weeks before it, with the final goal text; showing the new day-90 target on Today, the Roadmap and the review.
**Out of scope:** extensions or any change to the plan's length; the day-90 celebration and the next plan (I-10); pricing (I-11); extra sessions for a long backlog (I-7); changing practice days.
**Must not break:** the plan safety limits (a realistic target is never above the safe climb, RULE-1 to RULE-3); the weekly update and the week close in all four switch states (WU-62); breaks and jumped weeks; the 90-day screens; goals that never reach a checkpoint behind.

## 9. Open questions for the feature definition
1. What exactly is "clearly behind": a number rule per target family (the safe climb from the last result can't reach week 12), and what for deliverables and custom targets? Does a `far_behind` status count, or only results?
2. Should being behind on an in-order sequence count (a carried lesson can wait weeks; WU-12)?
3. How is the realistic target worked out: the safe climb, the person's own trend, or the lower of the two? Is it rounded to a clean number?
4. When the checkpoint week's test isn't logged, or the week ended in a break, is there a checkpoint at all?
5. Does the checkpoint need `WEEKLY_UPDATE_ENABLED` on, or a switch of its own? Production has the update off until this ships.
6. Where does the offer appear: on Today after the close, inside the review, or both? What if the week closed automatically?
7. What changes when they choose the realistic target: week 12's target and `finalTest`, the weeks between, `finalGoal` text, the `week12Line`, achievement screens? Can they change their mind later?
8. If they keep the full goal at week 4 and are still behind at week 8, is the second offer worded differently? If they picked the realistic target at week 4, is there still a week-8 check (it could go down again, or up)?
9. What about someone ahead of pace? (I-9 says no forecast when on track; "Go further" belongs to I-10.)

## 10. Handed over from other features
- Split out of the weekly update by WU-2 (2026-10-08); the weekly update never returns `checkpointOffer`.
- Open question 2 comes from WU-12.
- WU-23: `WEEKLY_UPDATE_ENABLED` stays off in production until this feature ships.
