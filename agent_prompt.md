# Agent Kickoff Prompt — Achivii Realignment

Paste this to your coding agent to start the work. It's written to be pasted as-is.

---

You are working on an existing repository called `AchiviiWeb`. This is not a greenfield project — a working full-stack app already exists (React/Vite frontend, Node/Express/Prisma backend). Your job is to bring it into alignment with an updated project plan, not to rewrite it from scratch.

Two documents in the repo root are your source of truth:

- `project_plan.md` — defines what the product is, what it's supposed to do, the data model, the architecture, and every product/technical decision made so far, including a Decision Log explaining *why*.
- `project_progress.md` — the phased implementation roadmap. It already reflects an audit of the current codebase: a "Phase -1 — Legacy Baseline" section documents what's already built (marked `[Done]`, with some items flagged "needs rework in Phase N" where the existing implementation conflicts with the plan), followed by Phases 0 through 6 covering everything still to be done.

## Before doing anything else

1. Read `project_plan.md` in full.
2. Read `project_progress.md` in full.
3. Read the actual current codebase — don't trust the docs' description of "Legacy Baseline" blindly, verify it against what's actually in the repo (check `backend/src/`, `frontend/src/`, `backend/prisma/schema.prisma`). If something in the docs doesn't match what you find in the code, flag the discrepancy before proceeding rather than silently picking one version.
4. Identify the current phase: the first phase in `project_progress.md` that has any `[Todo]` or `[In Progress]` item. Confirm no earlier phase has unfinished items — if it does, that's where work resumes, not wherever seems most interesting.

## How to work

- **One phase at a time, strictly bounded.** Work only within the active phase. Do not start work on any subsequent phase until you have received explicit human sign-off on your Phase Handover Report.
- **One task at a time within a phase.** Pick the next `[Todo]` item, implement it, verify it, mark it `[Done]` in `project_progress.md`, commit with a message referencing the task, then move to the next.
- **Verify before marking done.** "Verify" means: relevant automated tests pass (write them if coverage is missing), and for any UI components, explicitly describe the manual verification steps taken.
- **Update documentation continuously.** If an implementation deviates from the initial task spec, document what changed and why in `project_progress.md` before committing. Never perform unrecorded work.
- **Never implement ahead of scope.** Do not touch items from later phases or Section 15 ("Future Ideas") unless instructed.
- **Ask before destructive or ambiguous changes.** Specifically: any schema change risking data loss, altering `rescheduler.ts` behavior before Phase 2, or deciding unaddressed architectural paths.
- **Keep commits atomic.** One commit per completed task whenever practical.

## Mandatory Phase Handover Checkpoint

When all `[Todo]` items within the current phase are marked `[Done]` and verified:
1. Ensure all code is committed and the working tree is clean.
2. Push your commits to `origin`.
3. **STOP working immediately.** Do not begin the next phase.
4. Output a **Phase Handover Report** following this exact format:

```text
### Phase [N] Handover Report: [Phase Title]
- **Summary of Changes:** 2–3 concise sentences explaining what was built or refactored.
- **Verification & Test Results:** Terminal output or summary showing test pass/fail counts and coverage.
- **Files Modified/Created:** Bulleted list of affected files.
- **Doc Updates:** Confirmation that `project_progress.md` reflects all `[Done]` states and any deviations.
- **Blockers / Notes for Next Phase:** Any edge cases or considerations for the upcoming phase.