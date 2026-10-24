# Next plan — Decisions

**Prefix:** NP

How this log works: `docs/templates/decisions.md`.

**Inherited:** split out of checkpoints by `docs/features/checkpoints/decisions.md` CP-4; ideas I-10 and I-11; weekly update WU-9 (a fresh plan after a long break).

The feature: on day 90 the screen shows what the person reached, against their full goal. With Pro they can start a new 90-day plan from their real level: "Keep going" (same goal) or "Go further" (a new goal they write). "Start a fresh plan" after a long break uses the same path. Free users keep the celebration, their full record, and can restart any pathway from the start. Agreed with Mo on 2026-10-24 ("yes to all, 7 = no Pro line").

### NP-1 — The day-90 screen leads with what they reached (2026-10-24)
**Question:** what does the day-90 screen show first?
**Decision:** one line: "You went from 3 km to 8 km." The start is the plan's starting point; the result is week 12's test, else the latest measured week (light and jumped weeks don't count). The old stats move below it. A deliverable goal shows "You finished 11 of 12 weeks." and names the last piece of work they finished. Code works the numbers out on the server (`journeyResultOf`, `backend/src/lib/nextPlan.ts`), sent as `journeyResult` on every goal response.
**Why:** what someone reached is the thing worth celebrating, in their own numbers.

### NP-2 — Judged against the full goal; a lowered week 12 is named beside it (2026-10-24)
**Question:** "made it" against what, and how is a week 12 lowered by a checkpoint (CP-11) worded?
**Decision:** against the full goal, never a target a checkpoint or the safe climb lowered. Made it: "You reached your goal: 10 km." A checkpoint lowered week 12 and they reached it: "You reached your day-90 target: 7.5 km. Your goal: 10 km. That's your next plan." Not reached: "Day-90 target: 7.5 km. Your goal: 10 km. That's your next plan." Otherwise: "Your goal: 10 km. That's your next plan." "You made it." shows only when they did. Never "failed" or "missed".
**Why:** honest, and the rest of the goal is the next plan (CP-1), not a failure.

### NP-3 — "Keep going": same goal, from the measured result (2026-10-24)
**Question:** how does "Keep going to 10 km" build the new plan?
**Decision:** a new 90-day plan with the same goal, starting from the last measured result. Goal creation opens with the goal's text and every earlier answer filled in; the custom goals' "where are you now" question is not asked. The server adds the level as one more answer (`measured_level`) and the roadmap check holds `startingPoint.value` to it when the targets are in its unit (sent back once, replaced on the last attempt).
**Why:** least typing, and the starting point never comes from a guess.

### NP-4 — "Go further": they write the next goal (2026-10-24)
**Question:** how does "Go further" build the new plan?
**Decision:** they write the next goal themselves; it starts from their result. The earlier answers are filled in, except the success answer. The AI does not suggest a next goal (for now).
**Why:** the next ambition is theirs.

### NP-5 — A small gap: "Go further" leads (2026-10-24)
**Question:** what if they fell short by very little (9.5 of 10 km)? The plan is always 90 days (CP-1).
**Decision:** within one safe step of the goal (`nextSafeStep`, or one rounding step for a target with no family), "Go further" is the main choice and "Keep going" second.
**Why:** a whole plan for half a kilometre is silly; both stay available.

### NP-6 — Pathways (2026-10-24)
**Question:** how do the choices work for a pathway?
**Decision:** "Keep going" restarts the same pathway from the measured level. "Go further" is a custom goal (Pro anyway).
**Why:** the pathway's method stays; a goal past the pathway is no longer the pathway.

### NP-7 — Pro only; free users see no Pro line on day 90 (2026-10-24)
**Question:** what do free users see?
**Decision:** both choices are Pro for every goal (I-11), checked on the server (`authorizeNextPlan`, 403 `NEXT_PLAN_REQUIRES_PRO`) and hidden in the app without Pro. Free users see the same screen whether they made it or not: the celebration, their record, "Start {pathway} again from the start" on a pathway, and "Choose another pathway". No Pro line on day 90 at all (Mo).
**Why:** the upgrade is never shown as a result of falling short.

### NP-8 — One create path, history kept, no migration (2026-10-24)
**Question:** how does it reuse goal creation and keep history?
**Decision:** `POST /api/goal/create` takes `nextPlan: { fromGoalId, mode, level? }`. The server checks Pro, loads the old plan (the person's own: completed for keep going and go further, active for a fresh plan), reads its result itself, and stores `{ goalId, number, mode, summary }` as `Goal.roadmap.previousPlan`. The old plan keeps every week, task and review. The new plan's Progress shows "Plan 2. Plan 1: 3 km → 8 km." A full list of earlier plans is left for later.
**Why:** one tested create path; JSON in `Goal.roadmap` needs no migration (as CP-11).

### NP-9 — "Start a fresh plan" after a long break uses the same path (2026-10-24)
**Question:** does WU-9's fresh plan carry the level over?
**Decision:** yes, with Pro: it asks "Your last result was 6 km, in week 7. Where are you now?" with that result filled in, and starts from what they give. Without Pro it stays as WU-9 (the goal's text only).
**Why:** after weeks away the last result may be out of date. The week is named instead of "5 weeks ago" because the stored result has no date.

### NP-10 — No result logged: ask the level (2026-10-24)
**Question:** what if week 12 (and every other week) has no measured result?
**Decision:** as NP-9: ask their level now, with the latest result filled in when there is one. A deliverable goal asks nothing; the server words what they finished.
**Why:** no data, no guess.
