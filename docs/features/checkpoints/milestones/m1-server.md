# M1 — Server

**Feature:** docs/features/checkpoints/02-feature.md
**Branch:** cp-m1-server
**Prompt written:** 2026-10-24

## Prompt

### Context
Checkpoints are the honest check at the close of weeks 4 and 8 (`02-feature.md`). This milestone builds everything the server decides and stores; M2 builds the screens. Verify these against the code, don't trust this prompt:
- The close: `saveWeekClose` in `backend/src/lib/weekClose/close.ts` (one transaction), `updateThenWrite` and `nextWeekSentence` in `lib/weekClose/update.ts` (also `resultNumber`, `isLogged`, and the week-12 read-modify-write of `Goal.roadmap.loweredTargets`), `weeklyUpdateEnabled()` in `lib/weekClose/switch.ts`, breaks and jumps in `lib/weekClose/breaks.ts`.
- Targets: `safeGoalTargets`, `withTargetText`, `week12LineFor` in `lib/safety/storedTargets.ts`; `nextSafeStep`, `harder`, `targetFamily` in `lib/safety/targetSteps.ts`; limit numbers in `lib/safety/limits.ts`.
- Prompts: the weekly update's in `lib/ai/weeklyUpdate.ts`, the week writer's in `lib/ai/weekPlan.ts` (via `writeNextWeek` in `lib/planV2.ts`).
- The goal response: `presentGoal` in `routes/goal.ts`.

### Goal
With both switches on, a week 4 or 8 close stores an offer when someone is clearly behind (or, at week 8, ahead of a lowered target); the answer route applies it; the goal response sends `checkpoint` and `dayNinetyLine`; with either switch off nothing changes.

### Read first
- `docs/features/checkpoints/02-feature.md`: sections 3, 4 (all rules), 5, 7, 9.
- `docs/features/checkpoints/decisions.md`: the Decision lines of CP-5 to CP-16.
- `docs/features/weekly-update/decisions.md`: WU-15, WU-23 (search by ID).

### Requirements
1. **The check, as pure code.** Progress share, flat-start straight line, forecast with the safe-climb cap, share of the climb, the offered target with RULE-5's rounding, and the outcome (`lower`, `raise`, `line_only`, `on_track`, `none` with its reason), both directions. `CHECKPOINT_BEHIND_PERCENT` (75) and `CHECKPOINT_FLAT_PLAN_PERCENT` (10) in `limits.ts`. (RULE-3 to RULE-6, RULE-10, CP-15, CP-16)
2. **In the close.** Only with `weeklyUpdateEnabled()`, only at the close of week 4 or 8, after the weekly update has decided the targets, inside the close's transaction; none on a break, a jumped week, no result, a light test, an unreadable unit, a deliverable or no starting point. An offer is appended to `Goal.roadmap.checkpoints` (section 7's fields); an open offer is stored as `keep` / `expired` first at any later close. A lost race stores nothing. (RULE-1, RULE-2, RULE-8)
3. **`POST /api/goal/checkpoint`** `{ week, answer: 'keep' | 'accept' }` with section 7's 409s and 400. `accept` changes week 12 and spreads the weeks between (RULE-9: open week unchanged, light weeks follow, `withTargetText`, pathway `finalTest`, `finalGoal` untouched, raise only inside the safe climb); answer and targets in one transaction; the first answer wins. (RULE-8, RULE-9)
4. **Goal response.** `checkpoint` (the open offer) and `dayNinetyLine` (goal = `week12Line`'s goal when there is one), both null with either switch off. (RULE-11, section 7)
5. **Prompt line.** While `dayNinetyLine` is set, both prompts get RULE-12's line, word for word; otherwise byte-for-byte unchanged. (RULE-12)
6. **Logs.** RULE-13's two lines, word for word.
7. **Tests.** AC-3's three worked examples plus a lower-is-better time, body weight, the flat start, the safe-climb cap, a jumped week, each skip reason; rounding for every unit step; expiry; accept for lower, partial raise and full raise (including a light-test goal and a pathway `finalTest`); 409s and the two-answer race; the response fields; the prompt line and the unchanged fixtures; every switch state off stores and sends nothing.

### Out of scope
Any screen or frontend type change (M2). CLAUDE.md and plan-v2 rewrites beyond what this milestone makes wrong (M2 does the full pass).

### Checks
- Must not break: R-1, R-2, R-3, R-5, R-6.
- Run: backend `npm test`, `npm run build`. Measure on your starting commit first.

### Done when
Every requirement has a test, the backend suite and build pass against the baseline, and the report lists the files and evidence.

### Stop if
The code disagrees with `02-feature.md` in a way that changes the work (for example, where the open week's target or week 12's entry is stored), a migration seems needed, or `routes/goal.ts` / `planV2.ts` has an open plan-safety-limits branch.

## Report

## Review
