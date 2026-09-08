Achivii — Progress Tracker
This file contains the complete implementation roadmap, broken into phases. Read `project_plan.md` first — this file tracks *what has been done, what's in progress, and what's next* against that plan.

Status values: `[Done]` `[In Progress]` `[Todo]` `[Blocked]`

Work one phase at a time, in order. Do not start a phase until the previous one is marked complete, unless explicitly instructed otherwise. Update this file immediately after finishing any task — mark it Done, note any deviation from the plan, and commit.

---
## Phase -1 — Legacy Baseline (already built, before this realignment)

This is what exists today in the `AchiviiWeb` repository, carried over from the original build. Nothing here needs to be rebuilt from scratch — Phase 0 onward either extends it, refactors it, or wraps it. Items marked "needs rework" are addressed explicitly in a later phase; don't touch them until that phase.

- [Done] Repo scaffold: React 19 + Vite frontend, Node/Express backend, Prisma
- [Done] Auth (signup/login, custom JWT + scrypt)
- [Done] Goal catalog (6 seeded goals, phases, task templates) — read-only browse
- [Done] Onboarding flow: goal selection → start date → Mon–Sat busy blocks
- [Done] Deterministic scheduling engine (`scheduler.ts`) generating a full 12-week `Session` calendar upfront
- [Done — needs rework in Phase 1] Session storage uses absolute calendar dates on all future sessions, not relative offsets (violates plan Section 9 / Decision Log D2)
- [Done] This Week interactive calendar view (`CalendarWeekView.tsx`)
- [Done] Session mark-done / edit / day-detail modal
- [Done — needs rework in Phase 2] Rescheduler (`rescheduler.ts`): detects missed sessions, auto-reallocates within the week, or cascades the plan +7 days on zero free slots — fully automatic, no user-facing check-in exists (violates plan Section 4.6 / Decision Log D11)
- [Done — partial, needs extension in Phase 2] `SlippageBanner` component shows cumulative slippage at ≥14 days — this is a passive readout, not the Tier 2c circuit breaker from Section 4.6
- [Done] Progress page: completion %, phase breakdown, pace status
- [Done] TypeScript passes cleanly on both frontend and backend; Vite production build compiles
- [Todo, carried in] Zero automated test coverage — becomes Phase 0 below
- [Todo, carried in] SQLite/PostgreSQL divergence between dev config and documented prod config
- [Todo, carried in] Bun-only scripts, not portable to plain Node/npm
- [Todo, carried in] No stored user timezone; date handling via raw `toISOString()` string manipulation
- [Not built] Roadmap generation/selection step (plan Section 4.3) — onboarding currently goes straight to schedule generation
- [Not built] Any LLM/AI role (Planner, Coach, Reviewer, Optimizer) — the entire AI layer described in plan Section 13 does not exist yet
- [Not built] Weekly reflection flow (plan Section 4.7)
- [Not built] Graduation flow (plan Section 4.9)
- [Not built] Continuous profile learning (plan Section 4.10)

---
## Phase 0 — Safety Net

**Goal:** Get test coverage on the two modules everything else in this roadmap will touch, before touching them.

- [Todo] Add Vitest to `backend/package.json`, add a working `npm test` / `bun test` script
- [Todo] Write tests for `scheduler.ts`: interval subtraction, tight schedules (<15 min slots), full weeks with zero availability, `preferred_time_of_day` respected when set
- [Todo] Write tests for `rescheduler.ts` **as it currently behaves** (baseline coverage before Phase 2 changes its logic) — same-week reallocation, +7 cascade, slippage accumulation
- [Todo] Confirm both test suites run cleanly in CI-equivalent conditions (plain `node`/`npm`, not just Bun)
- [Todo] Update this file: mark Phase 0 complete, commit

---
## Phase 1 — Data Model Correction

**Goal:** Bring the schema in line with plan Section 9 before building any new user-facing behavior on top of it. This is a migration, not a rewrite.

- [Todo] Add `Session.tier` enum (`core` / `buffer` / `reflect`); update `scheduler.ts` to tag every generated session at creation time per plan Section 4.4 (rough default split: 40–50% core / 30% buffer / 20% reflect, tune during implementation)
- [Todo] Add `Session.day_number` and `Session.sequence_order`; add `UserGoal.current_plan_day_offset` (default 0)
- [Todo] Refactor `scheduler.ts` so only the current rolling week is materialized to real `scheduled_date` values; all other sessions are addressed by `day_number`/`sequence_order` relative to the goal's offset
- [Todo] Write a migration script for existing seeded/test data (if any persists) to backfill `tier`, `day_number`, `sequence_order`
- [Todo] Add `Session.completed_at_utc` and an idempotency token field; update the completion endpoint to write these
- [Todo] Add `User.timezone` (IANA string); capture it client-side at signup/onboarding (browser `Intl.DateTimeFormat().resolvedOptions().timeZone` is a reasonable default source) and persist it
- [Todo] Replace all `toISOString().split('T')[0]`-style date-boundary logic with timezone-aware evaluation using the stored `User.timezone`, evaluated lazily on request (no cron introduced yet)
- [Todo] Extend Phase 0 tests to cover the new fields: tier assignment correctness, offset math, timezone-aware boundary evaluation
- [Todo] Update this file: mark Phase 1 complete, commit

---
## Phase 2 — Real Recovery UX

**Goal:** Replace the fully-automatic rescheduler with the actual tiered, user-facing mechanism from plan Section 4.6. This is the single most important gap relative to the product's stated differentiation.

- [Todo] Rework `rescheduler.ts`: Tier 1 (1–2 missed days) stays fully automatic/silent, using the offset/tier fields from Phase 1
- [Todo] Implement Tier 2 trigger detection (3+ consecutive missed days, or zero free slots left this week) — do **not** auto-resolve; instead surface a pending recovery state
- [Todo] Add `RecoveryEvent` table per plan Section 9
- [Todo] Backend: new `recovery.ts` routes — `GET` pending recovery state, `POST` user's choice (`shrink_week` / `shift_timeline`)
- [Todo] Implement `shrink_week`: deterministic filter dropping `buffer`-tier sessions first, respecting the session-length cap, never touching `core`-tier sessions
- [Todo] Implement `shift_timeline`: update `current_plan_day_offset`, roll remaining plan forward — confirm this is an O(1) write, not a bulk session-row update
- [Todo] Frontend: `RecoveryCheckIn.tsx` — non-blocking inline card (not a modal), warm/neutral copy, one-tap defaults, per plan Section 4.6 and Decision Log D11
- [Todo] Implement offline reconciliation: on sync, check for completions timestamped within a currently-pending lapse window and retroactively clear the flag before serving any check-in (Decision Log D8)
- [Todo] Implement the Lapse Circuit Breaker: query `RecoveryEvent` count in a rolling 28-day window per goal; on the 3rd event, serve a scope-reduction prompt instead of the standard Tier 2 check-in
- [Todo] Retire or repurpose `SlippageBanner` — decide whether it becomes a passive summary alongside the new check-in, or is superseded by it
- [Todo] Tests: Tier 1 silent behavior, Tier 2 trigger conditions, shrink/shift correctness against tiered sessions, circuit breaker firing at exactly the 3rd event, offline reconciliation clearing a flag correctly
- [Todo] Update this file: mark Phase 2 complete, commit

---
## Phase 3 — Weekly Reflection

**Goal:** Build the deterministic reflection flow (no LLM needed yet) — this produces signal the AI layer will later consume.

- [Todo] Add `WeeklyReview` table per plan Section 9
- [Todo] Backend: weekly completion-rate evaluation job (triggered lazily, consistent with the Phase 1 timezone approach — not a new cron)
- [Todo] Backend: `reflection.ts` routes — `GET` pending reflection (type: single-tap or full), `POST` response
- [Todo] Implement the ≥70% threshold as a configurable value (not hardcoded), first week of a goal defaults to single-tap regardless of signal
- [Todo] Implement trigger precedence: if a recovery check-in (Phase 2) is also pending, it takes priority and the reflection is deferred or merged into that week's copy — do not double-prompt
- [Todo] Frontend: `WeeklyReflection.tsx` — single-tap variant and full 4-question variant
- [Todo] Tests: threshold logic, first-week default, precedence-vs-recovery behavior
- [Todo] Update this file: mark Phase 3 complete, commit

---
## Phase 4 — AI Layer

**Goal:** Build the actual LLM-backed roles. This is the first phase that calls the Anthropic API. Do not start this phase until Phases 0–3 are complete and tested — the deterministic substrate these roles plug into needs to be correct first.

- [Todo] Backend: `planner.ts` — generates 2–3 structured roadmap variants per goal instance (numeric parameters: `days_per_week`, `daily_minutes_variance`, `phase_emphasis`), returned as validated structured JSON, never freehand task/date generation
- [Todo] Add `Roadmap` table per plan Section 9; wire into `UserGoal.selected_roadmap_id`
- [Todo] Backend: constraint validation layer — check Planner output against the user's onboarding constraints (session-length caps, available days) before it's allowed to reach the scheduler; on violation, reject and re-request rather than clamp
- [Todo] Backend: `roadmaps.ts` routes — `POST /generate` (post-onboarding, pre-schedule), `POST /:id/select`
- [Todo] Update the onboarding flow (`OnboardingPage.tsx`) to insert a roadmap-selection step between busy-block input and schedule generation
- [Todo] Frontend: `RoadmapSelector.tsx` — displays the 2–3 variants with name, description, trade-offs
- [Todo] Update `scheduler.ts` to accept the selected roadmap's parameters and modulate task placement accordingly (this connects Phase 4 to the Phase 1 scheduler refactor — do not duplicate scheduling logic in the Planner)
- [Todo] Backend: `optimizer.ts` — handles Tier 2c custom replans only, triggered by the circuit breaker from Phase 2; compressed context, structured output only (no user-facing text)
- [Todo] Backend: `reviewer.ts` — analyzes weekly signal when completion < 70% (from Phase 3); structured output only
- [Todo] Backend: `coach.ts` — sole presentation layer; ingests structured output from Optimizer/Reviewer/Planner and produces the single unified user-facing voice; centralize shared tone/voice guidelines in one shared prompt snippet used by every role
- [Todo] Implement the cost-tiering split from plan Section 13 explicitly in code — confirm Tier 1/2/2b recovery paths still make zero LLM calls after this phase's wiring
- [Todo] Build a small golden-set eval (roughly 20–30 synthetic onboarding profiles + miss patterns) to sanity-check Planner/Optimizer output before this ships
- [Todo] Instrument actual token cost per role call; replace the placeholder $/call figures in plan Section 13 with measured numbers
- [Todo] Tests: constraint-validation rejection path, Coach voice consistency (spot-check, not exhaustive), Planner output schema validation
- [Todo] Update this file: mark Phase 4 complete, commit

---
## Phase 5 — Graduation & Profile Learning

**Goal:** Build the aggregation layer. Only meaningful once a real recovery/reflection loop exists to learn from (Phases 2–4).

- [Todo] Implement graduation trigger evaluation (relative to remaining plan length, only for `active` goals; recompute on resume-from-pause)
- [Todo] Backend + frontend: graduation prompt with three choices (new goal / maintenance mode / pause)
- [Todo] "New goal" path: pre-fill onboarding from existing profile, editable
- [Todo] Implement profile aggregation: `User.best_working_hours` (derived from completion timestamps), `User.lapse_pattern_summary` (derived from `RecoveryEvent` history)
- [Todo] Feed aggregated profile into onboarding defaults and Planner context for a user's second+ goal
- [Todo] Ensure profile-derived defaults are presented as editable suggestions, never silently applied
- [Todo] Tests: graduation trigger timing, pause/resume recompute, profile aggregation correctness
- [Todo] Update this file: mark Phase 5 complete, commit

---
## Phase 6 — Deployment & Remaining Cleanup

**Goal:** Everything needed to actually ship, plus the smaller refine-later items not folded into earlier phases.

- [Todo] Resolve SQLite/PostgreSQL divergence: switch Prisma provider, generate Postgres migrations, update `.env.example`/README to match reality
- [Todo] Ensure `npm run dev` / `npm run build` work under plain Node (`tsx` for backend, `npx vite` for frontend) in addition to Bun
- [Todo] Add Docker Compose or equivalent for local Postgres parity with production
- [Todo] Fix the broken analytics cross-reference (plan originally pointed "3 leading indicators" at the wrong section) — confirm analytics implementation is scoped against the actual Success Criteria in plan Section 2
- [Todo] Implement minimal push notifications (daily reminder + recovery/graduation check-in nudge), with explicit frequency caps
- [Todo] Choose and configure hosting (frontend + backend + DB) and CI/CD
- [Todo] Accessibility pass (screen reader labels, dynamic text sizing) on the new components from Phases 2–5
- [Todo] Update this file: mark Phase 6 complete, commit

---
## How to use this file

- Before starting any work, read this file top to bottom to find the current phase and the next `[Todo]` item.
- Complete one task at a time. Verify it (tests pass, manual check if relevant) before moving to the next.
- Mark the task `[Done]` immediately after verifying it, not at the end of a batch.
- If a task turns out to need a different approach than what's written here, update the task description to reflect what was actually done and note why, rather than silently deviating.
- If you discover new necessary work mid-phase, add it to the current phase's list rather than doing it unrecorded.
- Never start a task from a later phase while an earlier phase still has `[Todo]` or `[In Progress]` items, unless explicitly told to jump ahead.
