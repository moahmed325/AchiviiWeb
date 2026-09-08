# Agent Kickoff Prompt — Achivii Realignment

You are working on an existing repository called `AchiviiWeb`. This is not a greenfield project — a working full-stack app already exists (React/Vite frontend, Node/Express/Prisma backend). Your job is to bring it into alignment with an updated project plan, not to rewrite it from scratch.

Two documents in the repo root are your source of truth:

- `project_plan.md` — defines what the product is, what it's supposed to do, the data model, the architecture, and every product/technical decision made so far, including a Decision Log explaining *why*.
- `project_progress.md` — the phased implementation roadmap. It already reflects an audit of the current codebase: a "Phase -1 — Legacy Baseline" section documents what's already built (marked `[Done]`, with some items flagged "needs rework in Phase N" where the existing implementation conflicts with the plan), followed by Phases 0 through 6 covering everything still to be done.

## Before doing anything else

1. Read `project_plan.md` in full.
2. Read `project_progress.md` in full.
3. Read the actual current codebase — don't trust the docs' description of "Legacy Baseline" blindly, verify it against what's actually in the repo (check `backend/src/`, `frontend/src/`, `backend/prisma/schema.prisma` or `prisma/schema.prisma`). If something in the docs doesn't match what you find in the code, flag the discrepancy before proceeding rather than silently picking one version.
4. Identify the current phase: the first phase in `project_progress.md` that has any `[Todo]` or `[In Progress]` item. Confirm no earlier phase has unfinished items — if it does, that's where work resumes, not wherever seems most interesting.

## How to work

- **One phase at a time, strictly bounded.** Work only within the active phase. Do not start work on any subsequent phase until you have received explicit human sign-off on your Phase Handover Report.
- **One task at a time within a phase.** Pick the next `[Todo]` item, implement it, verify it, mark it `[Done]` in `project_progress.md`, commit locally with a message referencing the task, then move to the next.
- **Verify before marking done.** "Verify" means: relevant automated tests pass (write them if coverage is missing), and for any UI components, explicitly describe the manual verification steps taken.
- **Update documentation continuously.** If an implementation deviates from the initial task spec, document what changed and why in `project_progress.md` before committing. Never perform unrecorded work.
- **Never implement ahead of scope.** Do not touch items from later phases or Section 15 ("Future Ideas") unless instructed.
- **Ask before destructive or ambiguous changes.** Specifically: any schema change risking data loss, altering `rescheduler.ts` behavior before Phase 2, or deciding unaddressed architectural paths.

## Commit and push — read this carefully, it's different from a normal repo

This project has a **live production deployment** already running: backend on Render, frontend on Vercel, database on Supabase Postgres, wired to auto-deploy on every push to `main`. This means `git push origin main` is not a safe, reviewable-later action here — it immediately builds and deploys to real, live URLs, and **it automatically runs any pending Prisma migration against the live production database**, with no manual approval step in between.

Because of that:
- **Commit locally after every verified task**, same as you would in any repo — small, atomic commits, ideally one per `project_progress.md` item.
- **Only push to `main` when the change is actually safe to go live**: local tests pass, the build succeeds, and — critically — if the change touches `prisma/schema.prisma`, the migration has been tested against a real Postgres instance (not SQLite), since this now migrates a live database on push. Full detail is in `project_progress.md` under "Commit & Deployment Protocol" and the caution note at the top of Phase 1 — read both before your first schema change.
- **Treat any schema migration as higher-stakes than an ordinary code push.** Prefer additive changes (new nullable columns, new tables) over destructive ones. If a task genuinely needs a destructive migration, say so explicitly and pause for confirmation before pushing it, rather than pushing it as part of routine task completion.
- **You can batch a few local commits before pushing** if they're all part of finishing one task — you don't need to push after every commit. But push at natural checkpoints (end of a task or end of a phase) rather than letting verified work sit unpushed indefinitely.
- **After any push, a lightweight manual check against the live URLs is worth doing** for user-facing changes: `https://achivii-api.onrender.com` (API) and `https://frontend-two-roan-35.vercel.app` (frontend). This supplements, but never replaces, the automated tests you should already have passing before pushing.
- **If something breaks in production after a push, stop and report it before starting anything new.** Don't push a fix on top of a failure you don't yet understand.

## Mandatory Phase Handover Checkpoint

When all `[Todo]` items within the current phase are marked `[Done]` and verified:
1. Ensure all code is committed locally, working tree is clean, and passing tests are verified.
2. Push your commits to `origin main` following the safety protocol above.
3. **STOP working immediately.** Do not begin the next phase.
4. Output a **Phase Handover Report** following this exact format:

### Phase [N] Handover Report: [Phase Title]
- **Summary of Changes:** 2–3 concise sentences explaining what was built or refactored.
- **Verification & Test Results:** Terminal output or summary showing test pass/fail counts and coverage.
- **Files Modified/Created:** Bulleted list of affected files.
- **Doc Updates:** Confirmation that `project_progress.md` reflects all `[Done]` states and any deviations.
- **Blockers / Notes for Next Phase:** Any edge cases or considerations for the upcoming phase.

Wait for explicit confirmation to proceed before touching the next phase.

## Right now

Start with Phase 0 in `project_progress.md`. 

First, confirm your understanding by providing:
1. A brief summary of Phase 0 objectives.
2. The exact first task you will execute.
3. Verification that `project_plan.md` and `project_progress.md` are accessible in the workspace root.

If at any point the actual codebase state contradicts the "Legacy Baseline" section's description, stop and report the discrepancy before continuing.