# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Achivii turns a goal into a 12-week (90-day) deliberate-practice plan, or a shorter one (4 to 11 weeks) when a fixed date is closer (B-109, `lib/planLength.ts`). It is an npm workspaces monorepo:
`frontend/` (React 19, Vite, Tailwind v4, deployed to Vercel) and `backend/` (Express, Prisma, PostgreSQL with pgvector, deployed to Render via `render.yaml`).

## Commands

From the repo root:

```bash
npm install                 # all workspaces
npm run backend             # API on :5000 (tsx watch)
npm run frontend            # Vite on :5173 (the e2e and CORS defaults expect 5173)
npm run build               # build both workspaces
```

The root `package-lock.json` is the only lockfile and is committed. CI, Vercel and Render install with `npm ci`, so they get exactly what it pins and fail if it is out of date. To change a dependency, run `npm install` at the repo root and commit `package-lock.json` with the `package.json` change.

Node 22 everywhere, pinned as `"engines": { "node": "22.x" }` (major only). Vercel reads the root `package.json`; Render reads `backend/package.json`, because its `rootDir` is `backend` (it installs from the root lockfile, but takes the Node version from the package.json in its rootDir). CI's `setup-node` reads the same two files (`node-version-file`) and fails if they differ, so change both together. Vercel builds from the root `vercel.json` (`cd frontend && npm ci`); there is no other Vercel config.

Backend (`cd backend`):

```bash
npm test                                  # vitest run (node env; the GEMINI key is blanked in vitest.config.ts)
npx vitest run test/safetyClamps.test.ts  # one file
npx vitest run -t "daily limit"           # by test name
npm run build                             # tsc -> dist/
npx prisma migrate dev                    # new migration
npx prisma migrate deploy                 # apply migrations (never `db push`, see below)
npm run ping:llm                          # live provider probe (needs a real key)
```

Backend tests live in two places: `backend/test/*.test.ts` (plan engine, safety and scheduling logic) and next to the code in `backend/src/**/*.test.ts` (billing and routes).

Backend tests mock `lib/prisma.js`, so none need a database. In a fresh checkout run `npx prisma generate` first, or `tsc` reports missing Prisma types.

Frontend (`cd frontend`):

```bash
npm test                                 # vitest + Testing Library in jsdom (src/**/*.test.{ts,tsx}); at most 6 workers, `vmThreads` pool (vitest.config.ts, B-36, B-41)
npx vitest run src/components/ui/Button.test.tsx
npm run lint                             # whole frontend; baseline is 0 errors, 2 warnings
npx eslint <changed files>               # files you touch must be lint-clean
npm run build                            # tsc && vite build
npm run e2e                              # same as npx playwright test: e2e/*.spec.ts, API mocked via e2e/mockApi.ts; starts Vite itself
npm run e2e -- e2e/today.spec.ts          # args pass through; CI runs every e2e spec (not e2e/live), split into 3 shards (see .github/workflows/ci.yml)
# e2e runs on port 5174 (E2E_PORT to change it) with a fake Supabase; sign in with signIn() from e2e/mockApi.ts; the browser runs in UTC (timezoneId, B-75)
# Vite serves the worktree's live files: take an e2e baseline from a separate clean checkout, not the worktree you are editing
npx playwright test e2e/today.spec.ts --project=mobile
LIVE_API=1 npx playwright test e2e/live  # real backend on :5000, creates accounts
```

Playwright runs with one worker on purpose (parallel workers stall the Vite dev server) and has `desktop` (1440x900) and `mobile` (390x844, touch) projects.

## Database

- Postgres is required everywhere, local included; there is no SQLite mode. The database must allow the pgvector extension, because the older migrations run `CREATE EXTENSION vector` (for the `research_cache` table, since dropped).
- Always use `prisma migrate deploy`, never `prisma db push`. `db push` skips the migrations folder, which holds `CREATE EXTENSION vector` and the raw-SQL indexes, so the database drifts from the migration history.
- For Supabase use the session pooler connection string; the direct host is IPv6-only.
- Models: `User`, `Subscription`, `WebhookEvent`, `Goal`, `RoadmapWeek`, `DailyTask`, `WeeklyReview` (`backend/prisma/schema.prisma`). The unused `research_cache` table, four old `Goal` columns and the Stripe-era `User` columns were dropped on 2026-10-24 (B-8, B-14, B-16). `User.remindersEnabled` and `lastReminderAt` hold the reminder email setting (ND-28).

## Backend architecture

`src/index.ts` mounts `/api/health`, `/api/auth`, `/api/goal`, `/api/billing`, `/api/reminders`. The Lemon Squeezy webhook (`/api/billing/webhook`) is mounted **before** `express.json()` with `express.raw()` so its signature can be verified against the raw body; keep that order.

Every request gets an id (`lib/requestContext.ts`, header `X-Request-Id`), and every log line inside a request starts with `[req <id>]`. Routes may throw the typed errors in `lib/httpErrors.ts` (`ValidationError`, `UnauthorizedError`, `PolicyError`, `ExternalServiceError`); `errorHandler`, mounted last, answers them and any unhandled error (a 500 with the request id) (B-105). Stored JSON is read through one checked reader per field in `lib/planV2.ts` (`readRoutine`, `routineRecord`, `readStoredRoadmap`, `startingPointValue`) and `parseStoredSteps` in `lib/carryForward.ts` (B-103).

Auth: the frontend signs in with Supabase and sends the access token as `Authorization: Bearer`; `lib/supabaseAuth.ts` verifies it and `routes/auth.ts` resolves it to a Prisma `User`.

Main areas (details in `docs/architecture/backend-details.md`; read the part you need before changing that area):

- Routes: `routes/goal.ts` holds the router, the active-goal routes and reconcile; each area's routes live in `routes/goal/` (`present.ts` presentGoal, `create.ts` clarify and create, `actions.ts` mark missed, carry now and swap, `tasks.ts` task updates, `weeks.ts` review, close and the week routes, `schedule.ts` editing the schedule, B-108) (B-102).
- Goal creation: `routes/goal/create.ts` (`POST /api/goal/create`): clarify (`lib/ai/clarify.ts`), preset match (10 pathways in `lib/ai/presets/`; other goals are custom and need Pro), roadmap (`lib/ai/roadmap.ts`), recovery profile (`lib/recovery/`), week 1 (`lib/ai/weekPlan.ts`). If the roadmap or week 1 can't be written, answer 503 and save nothing; an unsafe goal answers 422. No fallback plan.
- Plan v2 is the only plan model (`lib/planV2.ts`, spec in `docs/architecture/plan-v2.md`). Don't add plan v1 code back.
- Plan length: `Goal.totalWeeks` (default 12) through `shapeOf(goal)` in `lib/planLength.ts`; never assume 12 weeks or day 90 in new code (B-109).
- Safety limits: every number lives in `lib/safety/limits.ts`. Code, not the model, decides how fast targets climb and holds weekly load.
- Missed sessions and recovery: `lib/missedSessions.ts`, `lib/carryForward.ts`, `lib/recovery/`, `POST /api/goal/reconcile`.
- Week close and weekly update: `lib/weekClose/`, `lib/ai/weeklyUpdate.ts`.
- Billing: `lib/billing/`, `config/billing.ts` (Lemon Squeezy, test mode by default).
- Missed-day reminder email: `lib/reminders/`, `routes/reminders.ts` (`/api/reminders`), run hourly by `.github/workflows/reminders.yml` (`docs/architecture/reminders.md`).
- LLM: `lib/ai/gemini.ts` (Gemini only, no fallback provider).

Feature switches, all managed in the Render dashboard only (`sync: false`, unset means off). **Never turn them on or off from code or tests:** `MISSED_SESSIONS_CARRY_ENABLED` (on), `METHOD_RECOVERY_ENABLED` (on), `WEEK_CLOSE_ENABLED` (on), `WEEKLY_UPDATE_ENABLED` (on, also turns on checkpoints), `CUSTOM_RECOVERY_PROFILES_ENABLED` (on), `MISSED_DAY_REMINDERS_ENABLED` (off until Resend is set up, `docs/architecture/reminders.md`). They are read through `lib/flags.ts` (`flagOn`, exactly `true`, per request), and the server logs them all at startup (`[Flags]`).

The routes that call the model are rate limited in memory (`lib/rateLimit.ts`): `POST /api/goal/clarify` 10 a minute per IP, `POST /api/goal/create` 10 per 10 minutes per person; over it, 429 `rate_limited`.

Dates use IANA time zones via `lib/timezone.ts`; don't split dates in naive UTC.

Backend is ESM with `NodeNext` resolution, so relative imports need the `.js` extension (`'./routes/goal.js'`).

## Frontend architecture

- `App.tsx`: `AuthProvider` > `GoalProvider` > `BrowserRouter` > `AppShell`. Secondary pages are lazy-loaded. `ProtectedRoute requireGoal` gates routes on having an active goal.
- `lib/api.ts` is the fetch client; `resolveApiBaseUrl()` uses `VITE_API_BASE_URL` (falls back to localhost:5000 in dev, the Render URL in production).
- `context/GoalContext.tsx` holds the active goal; `lib/journeyAdapter.ts` and `hooks/useJourneyData.ts` shape it for the journey and roadmap views.
- Feature folders under `components/` (`today`, `dashboard`, `focus`, `journey`, `review`, `achievement`, `coach`, `billing`, `onboarding`, `pathways`, `marketing`); shared primitives in `components/ui/`.
- `/__ui` (dev server only) previews every primitive in every state.

### Frontend rules (from `Design.md`, read it before frontend work)

- Use the primitives from `components/ui` (Button, Field/Input, Dialog, Surface, Tabs, ProgressBar, StepMarker, states). Don't build another button, input, dialog or card; if a variant is missing, add it to the primitive and to `/__ui`.
- Tokens are role-named in `@theme` in `src/index.css`. Never hard-code hex, font size, radius or shadow; add a token instead.
- Dark only. No gradients or gradient text, one icon family (lucide-react, stroke 1.5), motion always has a reduced-motion path.
- `ui-root` on the outermost element of each screen; `focus-ring` on any custom focusable element; `cx()` for class merging; `className` on primitives is for layout only.
- Pathway data lives only in `lib/certifiedPresets.ts`; galleries use `PathwayLibrary`/`PathwayStrip` and launches go through `usePathwayLaunch`.
- Tests sit next to the component as `*.test.tsx` and query by role and accessible name, not class names.

## Docs

- `docs/backlog.md`: known problems and leftover work (`B-n`), used as a simple to-do list.
- `docs/ideas.md`: good-to-have ideas (`I-n`).
- `docs/decisions.md`: product-wide decisions. Add an entry only for a real product decision.
- `docs/architecture/`: how things work. Keep it true when a change makes it wrong.
- `docs/features/` and `docs/archive/`: older feature specs and milestone files, kept for reference. The milestone process is no longer used.

## How we work

Mo works in one chat: talk, decide, build. For each change: make it on a branch (never commit straight to `main` unless asked), run the relevant tests, give a short summary, and merge or push only when Mo says so. Pushing `main` deploys to production. Run code review only for risky changes (stored data, billing, auth, safety).
