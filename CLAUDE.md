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
npm run verify:pgvector                   # check extension, vector(768) column and indexes
npm run ping:llm | test:groq | test:tavily   # live provider probes (need real keys)
npm run research:capture|replay|velocity  # record/replay research fixtures in test/fixtures/research
npm run eval:goals                        # live evaluation over a goal set
```

Backend tests live in two places: `backend/test/*.test.ts` (engine and research logic) and next to the code in `backend/src/**/*.test.ts` (billing and routes).

Backend tests mock `lib/prisma.js` (`researchCache.test.ts` uses an in-memory stand-in for the `research_cache` table), so none need a database. In a fresh checkout run `npx prisma generate` first, or `tsc` reports missing Prisma types.

Frontend (`cd frontend`):

```bash
npm test                                 # vitest + Testing Library in jsdom (src/**/*.test.{ts,tsx})
npx vitest run src/components/ui/Button.test.tsx
npm run lint                             # whole frontend; baseline is 0 errors, 2 warnings
npx eslint <changed files>               # files you touch must be lint-clean
npm run build                            # tsc && vite build
npx playwright test                      # e2e/*.spec.ts, API mocked via e2e/mockApi.ts; starts Vite itself
npx playwright test e2e/today.spec.ts --project=mobile
LIVE_API=1 npx playwright test e2e/live  # real backend on :5000, creates accounts
```

Playwright runs with one worker on purpose (parallel workers stall the Vite dev server) and has `desktop` (1440x900) and `mobile` (390x844, touch) projects.

## Database

- Postgres with pgvector is required everywhere, local included. There is no SQLite mode: the research cache stores goal embeddings as `vector(768)`.
- Always use `prisma migrate deploy`, never `prisma db push`. `db push` skips the migrations folder, which holds `CREATE EXTENSION vector` and the pgvector indexes, so cache matching breaks silently.
- For Supabase use the session pooler connection string; the direct host is IPv6-only.
- Models: `User`, `Subscription`, `WebhookEvent`, `Goal`, `RoadmapWeek`, `DailyTask`, `WeeklyReview`, `ResearchCache` (`backend/prisma/schema.prisma`).

## Backend architecture

`src/index.ts` mounts `/api/health`, `/api/auth`, `/api/goal`, `/api/billing`. The Lemon Squeezy webhook (`/api/billing/webhook`) is mounted **before** `express.json()` with `express.raw()` so its signature can be verified against the raw body; keep that order. CORS allows `CLIENT_ORIGIN` (comma-separated), localhost :5173/:3000, and any `*.vercel.app` origin.

Auth: the frontend signs in with Supabase and sends the access token as `Authorization: Bearer`. `lib/supabaseAuth.ts` verifies it, and `routes/auth.ts` resolves it to a Prisma `User` by `auth_user_id`, linking an existing user by email the first time.

Goal creation (`routes/goal.ts` -> `lib/ai/goalDecomposer.ts`), the "Golden Rail" pipeline:

1. **Clarify** (`lib/ai/clarify.ts`, `POST /api/goal/clarify`) produces a canonical key.
2. **Preset match**: the 10 certified pathways in `lib/ai/presets/` (run10k, guitar, saas, spanish, recomp, youtube, book, deepwork, chess, speech) skip research and use fixed methods and velocity tables.
3. **Research cache** (`lib/cache/researchCache.ts`): Tier 1 exact canonical key, Tier 2 cosine similarity on the embedding.
4. **Live research** (`lib/research/`): Tavily queries, trust-tier ranking, safety filter, corroboration, velocity table, plan spine. `research/index.ts` is the public surface (`researchGoal`).
5. **Deterministic safety clamps** (`research/safetyClamps.ts`) run in TypeScript regardless of model output (for example running volume ramps and calorie deficit bounds).
6. **Plan generation** with schemas in `ai/planSchema.ts`, then post-processing: `taskRules.ts` (quality checks and polish), `scheduleRepair.ts`, and `planGrounding.ts` (`stripUnallowedUrls`: resource URLs may only come from verified research sources).
7. If the model fails, `spineFallbackPlan.ts` builds a plan from the research spine. When nothing grounded is possible the API returns an honest 503 rather than a fabricated plan.

LLM providers: `lib/ai/gemini.ts` holds the cascade, **Gemini first, then Groq** (primary and backup models), then a miss. `groq.ts` tracks daily-limit 429s and skips Groq for a cooldown. `modelJson.ts` repairs and parses model JSON, `retry.ts` gives one retry.

Plan v2 (`lib/planV2.ts`, `ai/weekPlan.ts`, `ai/roadmap.ts`, spec in `docs/architecture/plan-v2.md`): weekly targets that adapt. Each week the user logs a weekly test (`POST /api/goal/weeks/:weekNumber/review`), the remaining targets are updated, and the next week is written. New goals are flagged `planVersion: 2`; older goals must keep working on the old code path.

Missed sessions (`lib/missedSessions.ts`, `lib/carryForward.ts`, `POST /api/goal/reconcile`): carry-forward writes happen only when `MISSED_SESSIONS_CARRY_ENABLED` is exactly `true`. It is `"false"` in `render.yaml` and stays off until the notice that explains a moved step is live (ND-15); never turn it on from code or tests.

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

`docs/README.md` explains the layout and rules. When docs disagree, trust in this order: `docs/product/redesign-blueprint.md` (product), `docs/product/visual-design-system.md` (visual), `docs/decisions.md`, the feature's `04-phases.md`, then code (authoritative for what is actually built). Each feature has one folder under `docs/features/<name>/` with fixed numbered files (`01-problem.md` ... `05-prompts.md`); finished features move to `docs/archive/`. Decisions are appended to `docs/decisions.md`; only the "Decision" line of an entry is binding.
