# Achivii Checkpoints — Brief

**Status:** STUB. The problem, recorded so it can be worked through later (`docs/features/weekly-update/decisions.md` WU-2). Fill in the rest with `docs/templates/01-brief.md` before planning.
**Date:** 2026-10-08
**Links:** `docs/architecture/plan-v2.md` (Weekly update: checkpoints), `docs/features/weekly-update/02-feature.md`

## 1. The problem
At weeks 4 and 8 someone may be so far off pace that the final goal is out of reach in 12 weeks. Today the plan keeps aiming at the original goal anyway. The weekly update (the feature before this one) holds and spreads targets, but it cannot change the goal or the plan's length, so the last weeks can become an impossible climb, and the person only finds out at the end.

## 3. What we know
- **Fact:** `plan-v2.md` specifies the answer: at weeks 4 and 8, if the goal is out of reach at their pace, offer a lower final goal or a 1-week extension. At most 2 extensions per plan; beyond that, re-run the questions and start a revised plan.
- **Fact:** the 12-week length is assumed in many places (`TOTAL_WEEKS` in `backend/src/lib/ai/roadmap.ts`, "Day N of 90", the closing stretch from day 85, the roadmap and progress screens, the achievement screens).
- **Fact:** the weekly update moves a plan's dates after a break without changing its length (`docs/features/weekly-update/02-feature.md`, RULE-14). An extension needs more than that: an extra week.
- **Guess:** a lower goal is simpler to build than an extension (only targets change), so it may come first.

## 9. Open questions
1. Is an extension really needed, or is "lower goal" plus moving dates (weekly update) enough?
2. How does "out of reach" get decided: by the model, by code from the trend, or both?
3. What does the person see and choose, and what happens if they ignore the offer?
4. How do the screens that assume 90 days show a 97-day plan?
5. Someone far behind on an in-order sequence (a carried lesson can wait weeks, method-aware recovery M3.1d) still gets week 12 = the final goal (weekly update RULE-4). Should being behind on a sequence count toward "out of reach"? (weekly update WU-12)
6. Mo's direction (2026-10-17), not decided yet: keep the 90-day promise, give an honest forecast at weeks 4 and 8 only when clearly behind, and let the person choose once between the full goal and a realistic day-90 target; no extensions and never an open-ended plan (`docs/ideas.md` I-9). This would replace plan-v2's 1-week extension (question 1).
7. What happens on day 90 and after: a celebration of what they reached and a new plan from their real level (I-10), and which parts are Pro (I-11). Is that this feature or its own?
