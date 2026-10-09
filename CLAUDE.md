# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Achivii turns a goal into a 12-week (90-day) deliberate-practice plan. It is an npm workspaces monorepo:
`frontend/` (React 19, Vite, Tailwind v4, deployed to Vercel) and `backend/` (Express, Prisma, PostgreSQL with pgvector, deployed to Render via `render.yaml`).

## Commands

From the repo root:

```bash
npm install                 # all workspaces
npm run backend             # API on :5000 (tsx watch)
npm run frontend            # Vite on :5173 (the e2e and CORS defaults expect 5173)
npm run build               # build both workspaces
```

Backend (`cd backend`):

```bash
npm test                                  # vitest run (node env; GEMINI/GROQ keys are blanked in vitest.config.ts)
npx vitest run test/safetyClamps.test.ts  # one file
npx vitest run -t "daily limit"           # by test name
npm run build                             # tsc -> dist/
npx prisma migrate dev                    # new migration
npx prisma migrate deploy                 # apply migrations (never `db push`, see below)
npm run ping:llm | test:groq             # live provider probes (need real keys)
```

Backend tests live in two places: `backend/test/*.test.ts` (plan engine, safety and scheduling logic) and next to the code in `backend/src/**/*.test.ts` (billing and routes).

Backend tests mock `lib/prisma.js`, so none need a database. In a fresh checkout run `npx prisma generate` first, or `tsc` reports missing Prisma types.

Frontend (`cd frontend`):

```bash
npm test                                 # vitest + Testing Library in jsdom (src/**/*.test.{ts,tsx})
npx vitest run src/components/ui/Button.test.tsx
npm run lint                             # whole frontend; baseline is 0 errors, 2 warnings
npx eslint <changed files>               # files you touch must be lint-clean
npm run build                            # tsc && vite build
npm run e2e                              # same as npx playwright test: e2e/*.spec.ts, API mocked via e2e/mockApi.ts; starts Vite itself
npm run e2e -- e2e/today.spec.ts          # args pass through; CI runs the Today specs (see .github/workflows/ci.yml)
# e2e runs on port 5174 (E2E_PORT to change it) with a fake Supabase; sign in with signIn() from e2e/mockApi.ts
npx playwright test e2e/today.spec.ts --project=mobile
LIVE_API=1 npx playwright test e2e/live  # real backend on :5000, creates accounts
```

Playwright runs with one worker on purpose (parallel workers stall the Vite dev server) and has `desktop` (1440x900) and `mobile` (390x844, touch) projects.

## Database

- Postgres is required everywhere, local included; there is no SQLite mode. The database must allow the pgvector extension, because the migrations run `CREATE EXTENSION vector` for the `research_cache` table's `vector(768)` column.
- Always use `prisma migrate deploy`, never `prisma db push`. `db push` skips the migrations folder, which holds `CREATE EXTENSION vector` and the raw-SQL indexes, so the database drifts from the migration history.
- For Supabase use the session pooler connection string; the direct host is IPv6-only.
- Models: `User`, `Subscription`, `WebhookEvent`, `Goal`, `RoadmapWeek`, `DailyTask`, `WeeklyReview`, `ResearchCache` (`backend/prisma/schema.prisma`). No code reads or writes `ResearchCache` any more (the live research pipeline was removed); the table and its migrations stay until dropping them is decided separately.

## Backend architecture

`src/index.ts` mounts `/api/health`, `/api/auth`, `/api/goal`, `/api/billing`. The Lemon Squeezy webhook (`/api/billing/webhook`) is mounted **before** `express.json()` with `express.raw()` so its signature can be verified against the raw body; keep that order. CORS allows `CLIENT_ORIGIN` (comma-separated), localhost :5173/:3000, and any `*.vercel.app` origin.

Auth: the frontend signs in with Supabase and sends the access token as `Authorization: Bearer`. `lib/supabaseAuth.ts` verifies it, and `routes/auth.ts` resolves it to a Prisma `User` by `auth_user_id`, linking an existing user by email the first time.

Goal creation (`POST /api/goal/create` in `routes/goal.ts`):

1. **Clarify** (`lib/ai/clarify.ts`, `POST /api/goal/clarify`) turns the raw goal into a clarified outcome, a domain and follow-up questions.
2. **Preset match** (`findPresetForGoal`): the 10 certified pathways in `lib/ai/presets/` (run10k, guitar, saas, spanish, recomp, youtube, book, deepwork, chess, speech) give the roadmap a fixed method. Any other goal is custom and needs Pro (`authorizeNewCustomGoal`).
3. **Roadmap** (`lib/ai/roadmap.ts`, `generateRoadmap`): one model call picks the method (or keeps the preset's) and writes the phases and each of the 12 weeks' target and test. Goal text that matches the unsafe-framing rules in `research/safetyFilter.ts` (`screenQuery`) is refused with a 422 before any model call, and a method the model rates below 3 on safety is rejected. A number named in the goal (`research/statedTarget.ts`) must appear in the week-12 target.
4. **One week at a time** (`lib/ai/weekPlan.ts`, `generateWeekPlan`): only week 1 is written at creation, polished and checked by `taskRules.ts` and `scheduleRepair.ts`; `highLoad.ts` marks strain steps. Each later week is written after the weekly review (`lib/planV2.ts`, `writeNextWeek`).
5. **Deterministic safety clamps** (`research/safetyClamps.ts`, `applySafetyClamps`) run in TypeScript on a goal's stored velocity table whenever the goal is returned or used for planning, regardless of model output (running-volume ramps, calorie-deficit bounds, early-week lifting intensity).
6. **No fallback plan**: if the roadmap or week 1 can't be written, goal create answers an honest 503 ("Couldn't design your roadmap right now" / "Couldn't write your first week right now. Please try again.") and saves nothing, for certified presets and custom goals alike. An unsafe goal answers 422. No new plan v1 goal is ever created (docs/decisions.md ND-21).

`goalDecomposer.ts` now only holds the shared plan types (`DailyTaskPlan`, `DetailedStep`, `UserRoutineInput`) and re-exports `clarifyGoalWithAI`. `lib/research/` holds the unsafe-goal screen, stated targets, safety clamps and `formatBasisBadge` (`planGrounding.ts`); there is no live web search, research cache or embedding call.

LLM providers: `lib/ai/gemini.ts` holds the cascade, **Gemini first, then Groq** (primary and backup models), then a miss. `groq.ts` tracks daily-limit 429s and skips Groq for a cooldown. `modelJson.ts` repairs and parses model JSON, `retry.ts` gives one retry.

Plan v2 (`lib/planV2.ts`, `ai/weekPlan.ts`, `ai/roadmap.ts`, spec in `docs/architecture/plan-v2.md`): weekly targets that adapt. Each week the user logs a weekly test (`POST /api/goal/weeks/:weekNumber/review`), the remaining targets are updated, and the next week is written. Plan v2 is the only plan model (ND-21): every goal is created with `planVersion: 2` and plan v1 code is gone. Endpoints that need a roadmap refuse a goal that is not v2 with `409 not_plan_v2` (weekly review, test result, reconcile and the missed-session actions); the frontend gives such a goal no phases and no late-test card. Don't add v1 branches back. The `planVersion` column and its default of 1 stay in the schema for now.

Missed sessions (`lib/missedSessions.ts`, `lib/carryForward.ts`, `POST /api/goal/reconcile`): carry-forward writes happen only when `MISSED_SESSIONS_CARRY_ENABLED` is exactly `true`. It is unset by default (`sync: false` in `render.yaml`, managed in the Render dashboard) and stays off until the notice that explains a moved step is live (ND-15); never turn it on from code or tests.

Billing (`lib/billing/`, `config/billing.ts`): Lemon Squeezy, test mode by default, selected by `LEMON_SQUEEZY_ENVIRONMENT` with separate `_TEST_` / `_LIVE_` variables. Custom (non-preset) goals are a Pro entitlement (`goalAuthorization.ts`, `entitlement.ts`). Webhooks are deduplicated through `WebhookEvent`.

Dates use IANA time zones via `lib/timezone.ts`; don't split dates in naive UTC.

Backend is ESM with `NodeNext` resolution, so relative imports need the `.js` extension (`'./routes/goal.js'`).

## Frontend architecture

- `App.tsx`: `AuthProvider` > `GoalProvider` > `BrowserRouter` > `AppShell`. Secondary pages are lazy-loaded. `ProtectedRoute requireGoal` gates routes on having an active goal.
- `lib/api.ts` is the fetch client; `resolveApiBaseUrl()` uses `VITE_API_BASE_URL` (falls back to localhost:5000 in dev, the Render URL in production).
- `context/GoalContext.tsx` holds the active goal; `lib/journeyAdapter.ts` and `hooks/useJourneyData.ts` shape it for the journey and roadmap views.
- Feature folders under `components/` (`today`, `focus`, `journey`, `review`, `progress`, `achievement`, `coach`, `billing`, `onboarding`, `pathways`, `marketing`); shared primitives in `components/ui/`.
- `/__ui` (dev server only) previews every primitive in every state.

### Frontend rules (from `Design.md`, read it before frontend work)

- Use the primitives from `components/ui` (Button, Field/Input, Dialog, Surface, Tabs, ProgressBar, StepMarker, states). Don't build another button, input, dialog or card; if a variant is missing, add it to the primitive and to `/__ui`.
- Tokens are role-named in `@theme` in `src/index.css`. Never hard-code hex, font size, radius or shadow; add a token instead.
- Dark only. No gradients or gradient text, one icon family (lucide-react, stroke 1.5), motion always has a reduced-motion path.
- `ui-root` on the outermost element of each screen; `focus-ring` on any custom focusable element; `cx()` for class merging; `className` on primitives is for layout only.
- Pathway data lives only in `lib/certifiedPresets.ts`; galleries use `PathwayLibrary`/`PathwayStrip` and launches go through `usePathwayLaunch`.
- Tests sit next to the component as `*.test.tsx` and query by role and accessible name, not class names.

## Docs

`docs/README.md` explains the layout and rules. When docs disagree, trust in this order: `docs/product/redesign-blueprint.md` (product), `docs/product/visual-design-system.md` (visual), `docs/decisions.md` and the feature's `decisions.md`, the feature's `02-feature.md`, its `03-phases.md`, then code (authoritative for what is actually built).

Each feature has one folder under `docs/features/<name>/`: `01-brief.md` (problem and chosen direction, optional), `02-feature.md` (rules and acceptance criteria), `03-phases.md` (the plan and the only status table), `decisions.md` (the feature's decisions, with its own ID prefix such as `MS-1`) and `milestones/` (one file per milestone holding its prompt, report and review). Templates are in `docs/templates/`. Features started before 2026-10-08 keep the old layout (`01-problem.md` ... `05-prompts.md`) until they finish. Finished features move to `docs/archive/`. Decisions that affect the whole product go in `docs/decisions.md`; only the "Decision" line of an entry is binding. Known problems and leftover work that no feature owns go in `docs/backlog.md` (`B-n`); small items are fixed as quick fixes (below), big ones become features.

### Working on a milestone

When you are given a milestone to implement:

1. Your instructions are the **Prompt** section of the milestone file. Also read what it lists under "Read first". Do only that milestone.
2. Run `git status` first and note anything already changed. Work on the branch you were given; never commit or push to `main`.
3. Check the code before trusting the prompt or the docs. If they disagree in a way that changes the work, stop and report it.
4. Stop and report, instead of working around it, when: a decision the work needs is not made; a schema migration or new dependency is needed that the prompt does not allow; unrelated refactoring is needed; or the scope would have to grow.
5. Before changing anything, run the checks the prompt lists on your starting commit, using the repo's own scripts (see Commands); those numbers are your baseline. Run them again at the end and compare.
6. Write your results in the **Report** section of the same milestone file; screenshots go in `milestones/<id>-evidence/`. Give evidence for every requirement, and never claim a check you did not run.
7. Do not edit `03-phases.md`, `02-feature.md`, any `decisions.md` or `docs/backlog.md`; the reviewing chat updates them. Put anything they should change under "Differences from the docs" in your report.
8. List every problem you notice under "Problems found" in your report, even outside the milestone, with where you would put it. Do not fix problems outside the milestone.
9. Keep the shared docs true. If your change makes `CLAUDE.md`, `Design.md` or a doc in `docs/architecture/` wrong, update it in the same branch and list it in your report.

### Quick fixes

A quick fix is a small item from `docs/backlog.md` (`B-n`), given to you as a short prompt instead of a milestone file. Follow steps 2 to 5, 8 and 9 above, and also:

- Fix only the backlog items named in the prompt, and name them in the commit message (`fix(today): show the 10-minute version's minutes (B-1)`).
- Stop and report if the fix needs a product decision the prompt does not make, a change to stored data, or more than one branch of work. It then becomes a feature.
- Report in your reply, not in a file: what changed and where, the evidence for "fixed", commands and results against the baseline, and any problems found.
