# Achivii Migration Brief — Render PostgreSQL → Supabase PostgreSQL & Custom Auth → Supabase Auth

**Status:** READ-ONLY INVESTIGATION. Nothing in the repository, database, or any deployment was modified by this investigation.
**Prepared:** 2026-09-30 · Repository: `moahmed325/AchiviiWeb` · Branch: `main` @ `263c116`
**Audience:** the technical agent that will plan and execute the migration.

Evidence tags used throughout:
- **[VERIFIED]** — read directly from repository files/commands.
- **[INFERRED]** — deduced from code; high confidence but not literally written in the repo.
- **[UNKNOWN]** — cannot be determined from the repository; requires external/account information.

---

## 1. EXECUTIVE SUMMARY

Achivii is a two-workspace npm monorepo: a React 19 + Vite 6 SPA (Vercel, `achiviiweb.vercel.app`) and an Express 4 + TypeScript API on Render (`achivii-api.onrender.com`) using Prisma 6.4.1 against a Render PostgreSQL database (`achivii-db`, database `achivii`, defined in [render.yaml](render.yaml)) **with the `pgvector` extension and a `vector(768)` column plus HNSW/GIN indexes** — this is the single most important technical constraint of the database move.

Authentication is **fully custom**: email/password with Node `crypto.scryptSync` hashes stored in `users.password_hash`, a hand-rolled HS256 JWT (14-day expiry) issued by [backend/src/routes/auth.ts](backend/src/routes/auth.ts), stored in `localStorage['achivii_auth_token']`, sent as `Authorization: Bearer`, and resolved to the internal `User` row via `getAuthUser(req)`. There are **no** refresh tokens, password reset, email verification, OAuth, or MFA [VERIFIED].

Lemon Squeezy billing is complete and webhook-driven. Its identity contract is: backend-created checkout embeds **`custom.user_id = Achivii User.id`**; the signed webhook resolves `meta.custom_data.user_id` to `users.id` and upserts a row in `subscriptions` keyed by unique `providerSubscriptionId`; entitlement is evaluated from local rows only. **None of this needs to change in either migration — the entire integration is keyed on the internal `User.id`, which must be preserved.**

Key findings:

1. **Database move is low-risk and mostly configuration.** Prisma 6 + plain PostgreSQL + pgvector (an extension Supabase ships natively) is fully compatible. `prisma migrate deploy` can rebuild the schema on Supabase from the existing 12-migration history; the data moves via `pg_dump`. The main hazards are connection pooling mode, SSL, the IPv4/IPv6 reachability of Supabase from Render, and the vector/JSONB indexes being rebuilt on import.
2. **One schema drift issue exists today:** production `users` still carries orphaned Stripe columns (`stripeCustomerId`, `stripeSubscriptionId` + unique indexes, `plan`, `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`) created by migration `20260928171500_add_user_billing_fields` but absent from the current `schema.prisma`. Nothing reads them [VERIFIED]. This must be resolved (resolve-drift or baseline) before trusting `migrate deploy` on a fresh database.
3. **Auth migration is the hard part** because Supabase Auth supports importing **bcrypt and Argon2** hashes only; Achivii's scrypt hashes cannot be imported directly [VERIFIED against Supabase docs]. The safe strategy is a **rolling/lazy import**: keep legacy scrypt verification during a transition window, and on each successful legacy login create the Supabase Auth user (hashing the just-entered plaintext) and link it via a new `users.auth_user_id` column. `users.id`, all FKs, and the Lemon Squeezy `custom_data.user_id` contract stay untouched.
4. **The internal `User.id` is the backbone.** Goals, subscriptions, checkout custom data, and webhook resolution all hang off it. It must not be replaced by Supabase Auth UUIDs.
5. **Urgency flag:** `render.yaml` declares the database as `plan: free`. Render free PostgreSQL instances expire ~30 days after creation [VERIFIED Render policy; UNKNOWN whether this instance is actually free in the dashboard]. The repo's first commit is 2026-09-08. If the production database is genuinely on the free plan, it is at/near expiry — take a backup immediately regardless of migration timing.

Recommended order (details in §15): **(A)** fix schema drift → **(B)** migrate database to Supabase with custom auth untouched → **(C)** add `auth_user_id` and roll auth over incrementally → **(D)** retire the custom JWT stack. The database cutover is a short controlled freeze; the auth migration is zero-downtime and incremental.

---

## 2. CURRENT ARCHITECTURE

| Layer | Technology | Version | Evidence |
|---|---|---|---|
| Frontend framework | React | ^19.0.0 | [frontend/package.json](frontend/package.json) [VERIFIED] |
| Frontend build | Vite + TypeScript | ^6.1.1 / ^5.7.3 | same [VERIFIED] |
| Routing | react-router-dom | ^7.2.0 | same [VERIFIED] |
| Styling | Tailwind CSS | v4 (`@tailwindcss/vite`) | same [VERIFIED] |
| HTTP client | **native `fetch`** (no axios despite README) | — | [frontend/src/lib/api.ts](frontend/src/lib/api.ts) [VERIFIED] |
| Backend framework | Express | ^4.21.2 (CommonJS-style ESM, `"type": "module"`) | [backend/package.json](backend/package.json) [VERIFIED] |
| Language (both) | TypeScript | ^5.7.3 | both package.json [VERIFIED] |
| ORM | Prisma + @prisma/client | ^6.4.1 | both [VERIFIED] |
| Database | PostgreSQL + `pgvector` extension | — | [backend/prisma/schema.prisma](backend/prisma/schema.prisma), migrations [VERIFIED] |
| Auth | Custom email/password, scrypt, hand-rolled HS256 JWT | — | [backend/src/routes/auth.ts](backend/src/routes/auth.ts) [VERIFIED] |
| Billing | Lemon Squeezy REST + webhooks (currently **test mode**) | — | [backend/src/config/billing.ts](backend/src/config/billing.ts), render.yaml [VERIFIED] |
| AI deps (not migration-relevant) | Groq, Google Gemini, Tavily | — | backend/.env.example [VERIFIED] |

### Deployment architecture

```
Browser
  → Vercel SPA (achiviiweb.vercel.app; project config also in root vercel.json + frontend/vercel.json)
  → fetch JSON/Bearer → Render web service "achivii-api" (https://achivii-api.onrender.com)
       ├─ Render PostgreSQL "achivii-db" (db "achivii", oregon, free) — DATABASE_URL injected via fromDatabase
       ├─ Lemon Squeezy API (checkout create, subscription fetch, reconciliation)
       └─ Lemon Squeezy webhook → POST https://achivii-api.onrender.com/api/billing/webhook
```

- **Frontend hosting config:** root [vercel.json](vercel.json) (`framework: vite`, install/build commands `cd frontend && …`, output `frontend/dist`, SPA rewrite, `VITE_API_BASE_URL`/`VITE_API_URL` = `https://achivii-api.onrender.com`) and a duplicate [frontend/vercel.json](frontend/vercel.json) (output `dist`). A committed [frontend/.env.production](frontend/.env.production) pins the same values, and [frontend/vite.config.ts](frontend/vite.config.ts) **hard-codes** the Render URL via `define` as a final fallback. [VERIFIED]
- **Backend hosting config:** [render.yaml](render.yaml) — `type: web`, `name: achivii-api`, `runtime: node`, `plan: free`, `region: oregon`, `rootDir: backend`, `buildCommand: npm install --include=dev && npx prisma migrate deploy && npm run build`, `startCommand: npm run start`, `healthCheckPath: /api/health`. Git history shows the Blueprint was actually applied (`9eaf255 deploy: add achivii-db and production env wiring to render blueprint`) and once repaired (`83706c0 deploy: restore original build command after successful migration recovery`, `c25ec9e … rolled back to clear P3009`, `0657b94 fix: strip UTF-8 BOM from billing migration files`). [VERIFIED]
- **Database hosting config:** `render.yaml` `databases:` block — `name: achivii-db`, `databaseName: achivii`, `region: oregon`, `plan: free`. [VERIFIED]
- **Build/deploy commands:**
  - Backend build/start: `tsc` → `node dist/index.js` (scripts `build`, `start` in [backend/package.json](backend/package.json)).
  - Migrations on deploy: `npx prisma migrate deploy` inside the Render build command [VERIFIED].
  - Frontend build: `tsc && vite build` [VERIFIED].
  - Tests: `vitest run` both workspaces; Playwright e2e in `frontend/e2e` (API mocked; `e2e/live/` empty). [VERIFIED]
- **Environment-variable architecture:** backend reads `process.env` at startup (`dotenv.config()` in [backend/src/index.ts](backend/src/index.ts)); Render injects `DATABASE_URL` from the database resource and the rest from Blueprint/dashboard; frontend reads `VITE_*` build-time vars. No config service, no vault. [VERIFIED]

### Files responsible for each concern

| Concern | Files |
|---|---|
| Express app, CORS, raw-body webhook mount | [backend/src/index.ts](backend/src/index.ts) |
| Auth (signup/login/me, hashing, JWT, `getAuthUser`) | [backend/src/routes/auth.ts](backend/src/routes/auth.ts) |
| Goal API (clarify/create/active/complete/tasks/weekly review/delete) | [backend/src/routes/goal.ts](backend/src/routes/goal.ts) |
| Billing API (entitlement/account/reconcile/checkout) | [backend/src/routes/billing.ts](backend/src/routes/billing.ts) |
| LS webhook handler | [backend/src/routes/webhook.ts](backend/src/routes/webhook.ts) |
| Billing config/env resolution | [backend/src/config/billing.ts](backend/src/config/billing.ts) |
| Billing domain logic | [backend/src/lib/billing/](backend/src/lib/billing) — `entitlement.ts`, `accountState.ts`, `lemonSqueezyCheckout.ts`, `lemonSqueezyReconciliation.ts`, `lemonSqueezyState.ts`, `webhookEvents.ts`, `webhookIdentity.ts`, `webhookSignature.ts`, `goalAuthorization.ts` |
| Prisma client singleton | [backend/src/lib/prisma.ts](backend/src/lib/prisma.ts) |
| Health endpoint | [backend/src/routes/health.ts](backend/src/routes/health.ts) |
| Frontend API client | [frontend/src/lib/api.ts](frontend/src/lib/api.ts) |
| Frontend auth state | [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx), [frontend/src/lib/authFlow.ts](frontend/src/lib/authFlow.ts) |
| Frontend route guard | [frontend/src/components/ProtectedRoute.tsx](frontend/src/components/ProtectedRoute.tsx) |
| Billing UI | [frontend/src/components/billing/CustomGoalGate.tsx](frontend/src/components/billing/CustomGoalGate.tsx), [frontend/src/components/billing/ProPresentation.tsx](frontend/src/components/billing/ProPresentation.tsx), [frontend/src/pages/CheckoutReturnPage.tsx](frontend/src/pages/CheckoutReturnPage.tsx), [frontend/src/components/app/AccountMenu.tsx](frontend/src/components/app/AccountMenu.tsx) |
| Deployment | [render.yaml](render.yaml), [vercel.json](vercel.json), [frontend/vercel.json](frontend/vercel.json) |

---

## 3. CURRENT DATABASE

Source of truth: [backend/prisma/schema.prisma](backend/prisma/schema.prisma) and [backend/prisma/migrations/](backend/prisma/migrations) (12 migrations + `migration_lock.toml`, provider `postgresql`).

### 3.1 Models/tables (snake_case `@@map`)

| Model | Table | PK | Notes |
|---|---|---|---|
| `User` | `users` | `id String @id @default(uuid())` — **TEXT UUID generated by Prisma Client, not by Postgres** | `email @unique`, `password_hash`, `timezone @default("UTC")`, `created_at` |
| `Goal` | `goals` | uuid TEXT | 20+ columns incl. many `Json?` fields, `planVersion`, `status` (`active`/`completed`/`paused`/`archived`), `completedAt` |
| `RoadmapWeek` | `roadmap_weeks` | uuid TEXT | `@@unique([goalId, weekNumber])` |
| `DailyTask` | `daily_tasks` | uuid TEXT | `date` is **TEXT** (`YYYY-MM-DD`), `detailedSteps` TEXT (JSON string) |
| `WeeklyReview` | `weekly_reviews` | uuid TEXT | `@@unique([goalId, weekNumber])` |
| `ResearchCache` | `research_cache` | uuid TEXT | `canonicalKey @unique`; **`outcomeEmbedding Unsupported("vector(768)")?`** |
| `Subscription` | `subscriptions` | uuid TEXT | `providerSubscriptionId @unique`; FK → users cascade |
| `WebhookEvent` | `webhook_events` | uuid TEXT | `deliveryKey @unique` (SHA-256 of raw body) |

**Production-only drift [VERIFIED]:** migration `20260928171500_add_user_billing_fields` added to `users`: `plan` (default `'free'`), `stripeCustomerId` (+unique index), `stripeSubscriptionId` (+unique index), `subscriptionStatus`, `currentPeriodEnd`, `cancelAtPeriodEnd`. These are **not** in `schema.prisma` and **no code references them** (repo-wide search finds only the migration file). The live DB therefore has columns the schema doesn't know about. This is a "migrations are ahead of schema" drift and matters for the baseline/migrate strategy (§5.2, §15).

### 3.2 Relationships / foreign keys [VERIFIED from SQL]

- `goals.userId` → `users.id` — `ON DELETE CASCADE ON UPDATE CASCADE`
- `roadmap_weeks.goalId` → `goals.id` — cascade
- `daily_tasks.goalId` → `goals.id` — cascade
- `weekly_reviews.goalId` → `goals.id` — cascade
- `subscriptions.userId` → `users.id` — cascade
- `research_cache`, `webhook_events` — **no FKs** (global, not user-scoped)

### 3.3 Unique constraints [VERIFIED]

| Table | Constraint |
|---|---|
| `users` | `users_email_key` on `email` |
| `users` *(drift, prod only)* | `users_stripeCustomerId_key`, `users_stripeSubscriptionId_key` |
| `roadmap_weeks` | `roadmap_weeks_goalId_weekNumber_key` on (`goalId`,`weekNumber`) |
| `weekly_reviews` | `weekly_reviews_goalId_weekNumber_key` on (`goalId`,`weekNumber`) |
| `research_cache` | `research_cache_canonicalKey_key` on `canonicalKey` |
| `subscriptions` | `subscriptions_providerSubscriptionId_key` on `providerSubscriptionId` |
| `webhook_events` | `webhook_events_deliveryKey_key` on `deliveryKey` |

### 3.4 Indexes [VERIFIED]

| Table | Index | Type |
|---|---|---|
| `daily_tasks` | (`goalId`,`weekNumber`) | btree |
| `subscriptions` | `userId`; (`userId`,`status`); `providerCustomerId`; `providerVariantId` | btree |
| `webhook_events` | (`resourceType`,`resourceId`); (`status`,`receivedAt`) | btree |
| `research_cache` | `research_cache_outcome_embedding_idx` **USING hnsw (`outcomeEmbedding` vector_cosine_ops)** | HNSW |
| `research_cache` | `research_cache_raw_inputs_idx` **USING gin ((`canonicalMethod` -> 'rawInputs') jsonb_path_ops)** | GIN (expression) |

### 3.5 PostgreSQL extensions [VERIFIED]

- **`vector` (pgvector)** — the only extension. Enabled by `CREATE EXTENSION IF NOT EXISTS vector;` in migration `20260922120000_enable_pgvector_and_convert_outcome_embedding` (the earlier `20260919000000_…` folder is *named* "enable_pgvector" but does **not** run the statement — a naming trap noted in the migration comment).
- No PostGIS, no pg_cron, no pg_stat_statements dependency, no triggers, no stored procedures, no RLS, no views, no materialized views, no custom schemas (everything in `public`). [VERIFIED — grep across migrations and src]

### 3.6 pgvector usage — exact mechanics [VERIFIED]

File: [backend/src/lib/cache/researchCache.ts](backend/src/lib/cache/researchCache.ts) (all vector access is **raw SQL** because Prisma Client cannot read/write `Unsupported("vector")`):

- **Write:** `saveResearchCacheEntry()` — one `INSERT … ON CONFLICT ("canonicalKey") DO UPDATE` `$queryRaw` with `${toVectorLiteral(embedding)}::vector` (literal format `[0.1,0.2,…]`), plus `canonicalMethod::jsonb`.
- **Tier 2 read:** `resolveResearchCache()` — `ORDER BY "outcomeEmbedding" <=> $1::vector LIMIT 5` with similarity `1 - (a <=> b)`, thresholds `0.88` same-domain / `0.93` cross-domain (`CROSS_DOMAIN_SIMILARITY_THRESHOLD`).
- **Tier 0 read:** raw `WHERE "canonicalMethod" -> 'rawInputs' @> …` written to exactly match the GIN expression index (a comment explains Prisma's compiled `#>` form can't use the index).
- **Embeddings:** Gemini `gemini-embedding-001`, `outputDimensionality: 768` ([backend/src/lib/ai/gemini.ts:316-342](backend/src/lib/ai/gemini.ts#L316)).
- **Verifier:** `npm run verify:pgvector` ([backend/scripts/verify-pgvector.ts](backend/scripts/verify-pgvector.ts)) — checks extension, column udt, HNSW + GIN presence, `<=>` works, and that both query plans can use their indexes with `enable_seqscan=off`. **Reuse this script as the primary post-migration vector check.**
- **Tests** ([backend/test/researchCache.test.ts](backend/test/researchCache.test.ts)) hit a real database with pgvector — the backend unit suite is partially DB-integration. Tests need a `DATABASE_URL` with pgvector to run [VERIFIED from test code].

### 3.7 Raw SQL inventory [VERIFIED]

`$queryRaw` / `$executeRaw` occur only in: `backend/src/lib/cache/researchCache.ts` (3 sites), `backend/scripts/verify-pgvector.ts` (7 sites, diagnostic). No other raw SQL anywhere. This is good news: the only raw SQL that must work identically on Supabase is the research-cache SQL, which is vanilla Postgres + pgvector.

### 3.8 Render-specific database features? [VERIFIED]

**None.** No Render-specific extensions, no `render` schema, no connection flags, no Render CLI usage. The only Render coupling is that `DATABASE_URL` *value* is injected by Render (`fromDatabase:` in render.yaml). The database itself is plain PostgreSQL 15/16 + pgvector.

### 3.9 Prisma ↔ Supabase compatibility [VERIFIED + INFERRED]

- Provider `postgresql`, `migration_lock.toml` provider `postgresql` — identical on Supabase. [VERIFIED]
- Prisma 6.x officially supports Supabase; nothing in the schema uses unsupported features. [VERIFIED docs]
- `Unsupported("vector(768)")` works on any Postgres with pgvector ≥ 0.5 (HNSW requires pgvector ≥ 0.5.0; Supabase ships a recent version — exact version on the target project is account-side [UNKNOWN]).
- The hand-written SQL (HNSW, GIN expression, `<=>`) is vanilla and portable. [VERIFIED]
- Conclusion: **Prisma is fully compatible; no schema or client changes are required for the database move.**

### 3.10 Can migration history be applied cleanly to a fresh Supabase DB? [VERIFIED with one caveat]

Replaying migrations 0_init → … → 20260929173000 on an empty Supabase `public` schema **would succeed as written**: `CREATE SCHEMA IF NOT EXISTS "public"` is a no-op there, `CREATE EXTENSION IF NOT EXISTS vector` works (Supabase pre-packages the extension), and no statement targets Render-specific objects. Two caveats:

1. **Drift:** replaying migrations produces the schema *with* the Stripe columns (they come from `20260928171500`), which does **not** match `schema.prisma`. `prisma migrate deploy` doesn't check drift, so deploys succeed — but any future `prisma migrate dev` on this database would want to generate a "drop Stripe columns" migration. Decide explicitly whether to (a) leave the columns, (b) add a drop migration, or (c) baseline (§5.2). The P3009 migration-repair history shows the team already had to reconcile production once; don't rediscover that during the cutover.
2. The two `20260919…`/`20260922…` migration names are confusing but harmless — the actual `CREATE EXTENSION` lives in `20260922…` and is idempotent.

### 3.11 Data that must be preserved [VERIFIED — everything]

All of it, but with special attention to:

- **`users`**: `id` (PK for everything below), `email`, `password_hash` (needed for the legacy-login path during auth migration), `timezone`, `created_at`, plus the orphaned Stripe columns if present (copy them even though unused — zero cost, avoids restore errors on NOT NULL/defaults).
- **`goals`** incl. all Json columns (`teachings`, `workBlocks`, `allowedUrls`, `velocityTable`, `roadmap`, `answers`, `routine`), `planVersion`, `status`, `startDate`/`targetDate`/`currentWeek`/`completedAt`.
- **`roadmap_weeks`** incl. `target`, `test`, `testResult` Json and per-week status/scores.
- **`daily_tasks`** incl. `detailedSteps` (TEXT-JSON), `minimumVersion`, resource fields, `slotTime`, completion state.
- **`weekly_reviews`** (scores, reflections, insights).
- **`subscriptions`**: `userId` (FK integrity), `providerCustomerId`, `providerSubscriptionId` (unique — the dedup key for webhooks), `providerProductId`, `providerVariantId`, `plan`, `billingInterval`, `status`, period timestamps, `cancelAtPeriodEnd`/`cancelledAt`/`pausedAt`.
- **`webhook_events`**: `deliveryKey` unique — **losing this table would re-admit already-processed deliveries** (idempotency fence) and could double-process lifecycle events. Must be copied exactly.
- **`research_cache`**: `outcomeEmbedding` vector data + `canonicalMethod` JSONB (`rawInputs`, `velocityTable`, `cachedClarification`), `hitCount`, `readyForPromotion`, `lastUsedAt`. Losing embeddings = re-running paid Tavily/Gemini research per the code's own comments.
- **All UUIDs, all timestamps** (`TIMESTAMP(3)` without timezone — UTC by convention; pg_dump preserves bytes so no conversion issues), all relationship edges.

### 3.12 Database-adjacent code that must keep working

- `backend/src/lib/timezone.ts` — user-timezone day math (uses `users.timezone`).
- `backend/src/lib/planV2.ts` — roadmap/week/task row writers (plain Prisma).
- Backend tests that require a live pgvector DB (see §3.6).

---

## 4. RENDER DATABASE CONFIGURATION

### 4.1 How Render provides DATABASE_URL [VERIFIED]

```yaml
# render.yaml (excerpt)
services:
  - type: web
    name: achivii-api
    rootDir: backend
    buildCommand: npm install --include=dev && npx prisma migrate deploy && npm run build
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: achivii-db
          property: connectionString   # internal connection string, injected at runtime
      ...
databases:
  - name: achivii-db
    databaseName: achivii
    region: oregon
    plan: free
```

- Service `achivii-api` (free plan, oregon) receives the Render **internal** connection string for database resource `achivii-db`, database name **`achivii`**. [VERIFIED]
- `fromDatabase` injection means the value is managed by Render and **never appears in the repo** [VERIFIED]. Whether the dashboard additionally has a manually-set `DATABASE_URL` override is [UNKNOWN] (Render shows Blueprint-managed vars as synced).
- `DATABASE_URL` is referenced **only** by `schema.prisma` (`env("DATABASE_URL")`) — no other source file reads it, no `DIRECT_URL`/`SHADOW_DATABASE_URL` exists, and no code parses it. [VERIFIED]
- **Prisma uses `DATABASE_URL` directly** — no `connection_limit`, `pool_timeout`, `pgbouncer`, `sslmode`, `schema=` or any query parameter is set anywhere; the client is constructed bare: `new PrismaClient()` in [backend/src/lib/prisma.ts](backend/src/lib/prisma.ts). [VERIFIED]
- **Connection pooling:** none configured — Prisma's default pool (default `connection_limit` = num_cpus × 2 + 1) against a single free-plan instance with expected low traffic. [VERIFIED absence; INFERRED adequacy]
- **SSL:** nothing configured. Render internal connections don't require SSL, so the default driver behavior has been sufficient. [VERIFIED absence]
- **Hardcoded Render hostnames:** the database hostname is nowhere in code. The Render *API URL* `https://achivii-api.onrender.com` is hardcoded in [vercel.json](vercel.json) (×2), [frontend/vercel.json](frontend/vercel.json), [frontend/.env.production](frontend/.env.production), and as a fallback in [frontend/vite.config.ts](frontend/vite.config.ts) `define` — that's the API URL, not the DB, and it doesn't change in this migration. [VERIFIED]
- **Health check** `/api/health` returns static JSON and **does not touch the database** [VERIFIED — backend/src/routes/health.ts], so Render's health-based deploys will stay green even if `DATABASE_URL` is wrong. **This means a broken DB cutover would NOT fail the deploy** — verification must be explicit (§17).

Relevant snippets (secrets never appear in the repo — `sync: false` placeholders and `generateValue: true` only) [VERIFIED]:

```yaml
      - key: CLIENT_ORIGIN
        value: https://achiviiweb.vercel.app
      - key: LEMON_SQUEEZY_ENVIRONMENT
        value: test
      - key: LEMON_SQUEEZY_TEST_STORE_ID
        sync: false          # value entered in dashboard, not committed
      # … 3 more TEST_* vars with sync: false
      # LEMON_SQUEEZY_TEST_WEBHOOK_SIGNING_SECRET intentionally NOT in the blueprint
      - key: JWT_SECRET
        generateValue: true  # Render-generated base64 256-bit value
```

### 4.2 Other database environment variables [VERIFIED]

None. There is exactly one database variable (`DATABASE_URL`), one consumer (Prisma), and no pooling/SSL/replica/backup configuration anywhere in the repo.

---

## 5. SUPABASE DATABASE MIGRATION

### 5.1 What changes and what doesn't

| Item | Change? | Detail |
|---|---|---|
| `render.yaml` `databases:` block | **REMOVE** (after cutover) | The `achivii-db` resource becomes unused; delete to avoid confusion. Do this only after rollback confidence. |
| `render.yaml` `DATABASE_URL` | **CHANGE** | Replace `fromDatabase:` with a `sync: false` env var whose dashboard value is the chosen Supabase connection string (never commit the value). |
| `schema.prisma` | **NO CHANGE** for the DB move | `provider = "postgresql"`, `url = env("DATABASE_URL")` already correct. |
| Prisma client code | **NO CHANGE** | `new PrismaClient()` works; optionally add `?connection_limit=` sizing later. |
| Migration files | **NO CHANGE** (replay as-is) | `prisma migrate deploy` on the empty Supabase DB rebuilds everything including `CREATE EXTENSION vector` and both special indexes. |
| Extensions | **VERIFY, not add** | pgvector must be present (Supabase: Database → Extensions, or run the migration which `CREATE EXTENSION IF NOT EXISTS vector` — requires the role to have rights; the dashboard `postgres` role does). [VERIFIED migration SQL; Supabase availability is standard] |
| pgvector | **REQUIRED, unchanged** | Same `vector(768)`, same HNSW/GIN indexes; `verify:pgvector` must pass on Supabase. |
| SSL | **ADD (connection-string level)** | Append `?sslmode=require` (minimum). Prisma handles SSL automatically for Supabase URLs; explicit is better. `verify-full` + Supabase root CA is the hardened option. |
| Pooling | **DECISION REQUIRED** | See 5.4. |
| Frontend / Vercel | **NO CHANGE** | API URL unchanged. |
| Lemon Squeezy | **NO CHANGE** | Webhook URL, secrets, variant IDs, data — untouched. |

### 5.2 Handling the schema drift before/with the move

Pick one, explicitly, before cutover [INFERRED recommendation on VERIFIED facts]:

1. **(Recommended) Replay history + reconcile:** run `prisma migrate deploy` on Supabase (schema will include the orphaned Stripe columns), copy data, then — later, in a normal change — add a small migration dropping the Stripe columns if desired. Lowest risk; keeps `migrations` as the single truth and avoids touching `schema.prisma` during the move.
2. Baseline: squash migrations into a new `0_init` matching `schema.prisma` (without Stripe columns) and `prisma migrate resolve --applied`. Cleaner, but changes migration identity during a high-stakes window — not advised simultaneously with the move.
3. Leave exactly as-is (option 1 without the later cleanup). The columns are inert.

### 5.3 Deployment ordering (database move only)

1. Create Supabase project (region as close to `oregon`/us-east as available — account-side decision, see §19).
2. `npx prisma migrate deploy` against the Supabase **direct/session** URL from a machine that can reach it (never run migrations through the transaction pooler — DDL + prepared statements).
3. Copy data (§13).
4. `npm run verify:pgvector` against Supabase + row-count verification (§13.5).
5. Update Render env: `DATABASE_URL` → Supabase string (keep the Render URL value noted for rollback).
6. Redeploy/await restart; verify app paths (§17); watch webhook deliveries (`webhook_events.status`) for 24–48 h.
7. After rollback window: remove `databases:` block from render.yaml; eventually suspend the Render DB (see §13.10 for the deletion caution).

### 5.4 Connection mode decision — direct vs session pooler vs transaction pooler

Facts [VERIFIED from Supabase docs and repo]:

- Supabase **direct** (`db.[ref].supabase.co:5432`) is IPv6-only unless the project has the IPv4 add-on.
- **Shared pooler session mode** (`aws-…-….pooler.supabase.com:5432`, user `postgres.[ref]`) is IPv4 on every plan and supports prepared statements and session state.
- **Shared pooler transaction mode** (`…:6543`) is for serverless; **does not support prepared statements** (Prisma needs `?pgbouncer=true`), and loses session-level state between transactions.
- Achivii's backend is a **long-lived Node process on Render** opening a modest Prisma pool, and uses **`prisma.$transaction` (interactive transactions)** in the webhook handler ([backend/src/routes/webhook.ts](backend/src/routes/webhook.ts)) and long-running request scopes in goal generation.

Assessment:

- **Direct connection** is the technically cleanest fit for a persistent backend (Prisma's own recommendation for VMs/long-running containers). Risk: Render's egress IPv6 support is not documented in the repo and must be verified; the direct host is IPv6-only without the add-on. **[UNKNOWN — needs external verification]**
- **Session pooler (port 5432)** is the safe default that works regardless of IPv6: full prepared-statement support, session state survives (important for `SET enable_seqscan` in the verifier script, cursors, temp state), interactive transactions fine. Slight latency overhead; on the shared pooler there are connection-count ceilings per plan.
- **Transaction pooler (6543)** is the worst fit here: requires `pgbouncer=true`, degrades prepared statements the research-cache raw SQL may use, adds interactive-transaction risk to the webhook path, and buys nothing for a persistent backend.

The repository itself biases toward the session pooler: both [backend/.env.example](backend/.env.example) and the README instruct developers to use the *session pooler* string because the direct host is IPv6-only. **Evidence is insufficient to make the final call between direct and session pooler for production** — it hinges on the Render egress IPv6 check and the chosen Supabase plan (IPv4 add-on, pooler limits). Recommendation: **default to the shared session pooler for the cutover; upgrade to direct (+ IPv4 add-on) later if the IPv6 check passes and latency matters.** Either way: `?sslmode=require` on the URL, and do migrations via direct/session, never transaction mode.

### 5.5 Production environment-variable changes (database move)

| Var | Action |
|---|---|
| `DATABASE_URL` | Value changes from Render-injected to Supabase (manual, secret, `sync: false`). Append `?sslmode=require` (and `?pgbouncer=true` **only** if transaction mode were ever chosen — not recommended). |
| everything else | Unchanged. |

### 5.6 Data migration requirements

See §13 (full plan). Summary: `pg_dump`/`pg_restore` (or dump→`psql`) for data with schema built by `prisma migrate deploy`; vector data survives a dump/restore byte-for-byte once the extension exists; verify with `verify:pgvector` + counts.

---

## 6. CURRENT AUTH SYSTEM

All facts in this section are **[VERIFIED]** from code unless tagged.

### 6.1 Exact flow (browser → backend → DB)

1. **Signup:** `AuthScreen.handleSubmit` → `AuthContext.signup(email, password)` → `signupUser()` in [frontend/src/lib/api.ts](frontend/src/lib/api.ts) → `POST /api/auth/signup` with `{ email, password, timezone }` (timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`). Backend ([auth.ts](backend/src/routes/auth.ts)): validates email contains `@`, password ≥ 6 chars, lowercases/trims email, rejects duplicate email with **409**, hashes with `hashPassword()`, `prisma.user.create`, returns `{ message, token, user: { id, email, timezone, created_at } }`. Frontend stores token in `localStorage['achivii_auth_token']` (key constant `TOKEN_STORAGE_KEY` in AuthContext).
2. **Login:** same shape → `POST /api/auth/login` → lookup by normalized email → `verifyPassword()` → 401 on any failure (same generic message for unknown email and bad password) → returns token + user.
3. **Session restore:** on mount, `AuthProvider` reads token from localStorage; if present calls `GET /api/auth/me` with Bearer; on success sets `user`; **on any failure it silently deletes the token and logs the user out** (`catch` → `localStorage.removeItem`). [AuthContext.tsx lines 24–43]
4. **Authenticated requests:** every protected call passes the raw token explicitly (`fetchCurrentUser(token)`, `fetchActiveGoal(token)`, `updateDailyTask(…, token)`, etc.) and sets `Authorization: Bearer <token>` — there is no axios instance, no interceptor; ~12 explicit header constructions in api.ts.
5. **Backend resolution:** `getAuthUser(req)` (auth.ts:64) extracts Bearer → `verifyToken()` (manual HMAC-SHA256 compare + `exp` check) → `prisma.user.findUnique({ where: { id: payload.userId } })` → returns `{ id, email, timezone, created_at }` or `null`. Callers translate `null` → **401**.
6. **Identity:** the JWT payload is `{ userId, email, exp }` — the `userId` **is** `users.id`.

### 6.2 Passwords

- Stored in `users.password_hash` (TEXT).
- Algorithm: **Node scrypt** — `crypto.scryptSync(password, salt, 64)`, salt = 16 random bytes hex, storage format `"<saltHex>:<hashHex>"` (N/r/p left at Node defaults: N=16384, r=8, p=1). Verification via `crypto.timingSafeEqual`. [auth.ts:20-36]

### 6.3 JWT

- **Algorithm:** HS256, implemented manually (base64url header/body + `crypto.createHmac('sha256', JWT_SECRET)`). Note: signature comparison in `verifyToken` is a plain string `!==`, not timing-safe (minor, hardening candidate; irrelevant post-migration since these functions are removed).
- **Payload:** `{ userId, email, exp }` — no `iat`, no `iss`/`aud`, no `jti`.
- **Expiration:** `exp = now + 14 days`.
- **Secret:** `JWT_SECRET` env; ≥ 32 chars enforced; Render `generateValue: true`; dev fallback hard-coded `'achivii-secret-key-development-only-2026'` when `NODE_ENV !== 'production'`; **hard throw in production if missing**.

### 6.4 Token storage

- `localStorage['achivii_auth_token']` — persistent across browser restarts (consistent with a 14-day token). No cookies, no in-memory refresh, no sessionStorage.

### 6.5 How protected requests authenticate / how the backend identifies the internal User

- `Authorization: Bearer` header on every call; `getAuthUser` → JWT → `users.id` lookup. **The database row is the identity; the JWT is only a transport for `userId`.**

### 6.6 Feature inventory

| Feature | Present? | Detail |
|---|---|---|
| Refresh tokens | **No** | Single 14-day JWT; nothing refreshes it. |
| Password reset | **No** | Confirmed by [docs/archive/redesign-v1/prompts.md:693](docs/archive/redesign-v1/prompts.md#L693): "There is no password reset, email verification or OAuth." |
| Email verification | **No** | Same. |
| OAuth / social | **No** | Same. |
| MFA | **No** | No reference anywhere. |
| Session revocation / logout-all | **No** | Logout is purely client-side (`localStorage.removeItem`); server has no session state; existing JWTs stay valid until expiry. |
| Rate limiting / lockout | **No** | Not present on auth routes. |
| Change email / change password | **No** | No routes exist. |
| Account deletion | **No** | No route. |

### 6.7 Auth-related security concerns [VERIFIED observations]

1. 6-character minimum password; no complexity, no breach check.
2. No rate limiting/lockout on `/signup`, `/login` → credential stuffing surface.
3. Non-timing-safe JWT signature comparison; no `iat`/`iss`/`aud` claims; tokens irrevocable for 14 days.
4. Login/signup not behind the raw-body or any throttling middleware; standard `express.json()` applies.
5. `/api/goal/clarify` is **unauthenticated** (intentional — used pre-signup) and triggers LLM cost; no rate limit. Noted for completeness; migration doesn't change it.
6. Email uniqueness is case-safe (lowercased before lookup/write) — good; this matters for the Supabase email-matching plan (§14.4).
7. `localStorage` tokens are XSS-readable; standard tradeoff, unchanged in kind by Supabase (whose JS SDK also persists in localStorage by default).

### 6.8 Every file depending on the current auth implementation

**Backend:** [backend/src/routes/auth.ts](backend/src/routes/auth.ts) (whole file), [backend/src/routes/goal.ts](backend/src/routes/goal.ts) (6 `getAuthUser` call sites: `/create`, `/active`, `/complete`, `/tasks/:taskId`, `/weeks/:weekNumber/review`, `DELETE /active`), [backend/src/routes/billing.ts](backend/src/routes/billing.ts) (4 call sites), [backend/src/index.ts](backend/src/index.ts) (router wiring; no auth itself), [backend/src/routes/webhook.ts](backend/src/routes/webhook.ts) (not header-auth, but resolves `custom_data.user_id` → `users.id` — auth-adjacent identity dependency).

**Frontend:** [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx), [frontend/src/lib/api.ts](frontend/src/lib/api.ts), [frontend/src/lib/authFlow.ts](frontend/src/lib/authFlow.ts), [frontend/src/pages/auth/AuthScreen.tsx](frontend/src/pages/auth/AuthScreen.tsx), [frontend/src/pages/auth/LoginPage.tsx](frontend/src/pages/auth/LoginPage.tsx), [frontend/src/pages/auth/SignupPage.tsx](frontend/src/pages/auth/SignupPage.tsx), [frontend/src/pages/auth/usePostAuthRedirect.ts](frontend/src/pages/auth/usePostAuthRedirect.ts), [frontend/src/components/ProtectedRoute.tsx](frontend/src/components/ProtectedRoute.tsx), [frontend/src/context/GoalContext.tsx](frontend/src/context/GoalContext.tsx), plus consumers of `useAuth()` listed in §9.

---

## 7. INTERNAL USER IDENTITY

All **[VERIFIED]**.

- **Primary key:** `users.id` — `String @id @default(uuid())` → **TEXT column holding a UUID generated by Prisma Client at creation time** (crypto-random UUID v4 in JS), not `gen_random_uuid()` in the DB. Format matches standard UUIDs, so string comparison with Supabase Auth UUIDs would work mechanically — **but they must not be conflated** (see below).
- **Email:** `@unique` (Postgres unique index `users_email_key`); application lowercases/trims before write and lookup, so stored emails are lower-case.
- **No external auth/provider ID is stored anywhere today.** There is no `auth_user_id`, no `providerId`, no `supabaseUserId` column on `users` (the only provider-ish columns are the orphaned Stripe ones). Grep across the repo confirms: the only place an external identifier enters the system is the reverse direction — Achivii's `User.id` pushed *out* to Lemon Squeezy as `custom.user_id`.

### 7.1 What references `User.id` [VERIFIED]

| Consumer | Mechanism |
|---|---|
| `goals.userId` (+cascade → weeks/tasks/reviews) | FK |
| `subscriptions.userId` | FK |
| Backend authz | `getAuthUser` → `prisma.user.findUnique({ id })`; goal routes filter `where: { userId: user.id }`; task PATCH checks `task.goal.userId === user.id`; webhook resolves `custom_data.user_id` → `users.id` before upserting subscriptions |
| Lemon Squeezy checkout | `checkout_data.custom.user_id = user.id` ([lemonSqueezyCheckout.ts](backend/src/lib/billing/lemonSqueezyCheckout.ts)) — and [docs/features/billing/reference/lemonsqueezy-checkout-identity-contract.md](docs/features/billing/reference/lemonsqueezy-checkout-identity-contract.md) declares `User.id` the canonical billing identifier |
| Lemon Squeezy webhook | `meta.custom_data.user_id` → `users.id` lookup; **if it doesn't resolve, the event is marked FAILED and no entitlement is granted** |
| Frontend | Only type-level (`Goal.userId` in [types/index.ts](frontend/src/types/index.ts)); no rendering, routing, or localStorage use of `user.id` was found — the UI keys off `user` presence and `token`, not the ID value. [VERIFIED by search; low blast radius] |

### 7.2 Where a Supabase Auth user ID must be associated [INFERRED — the central design decision]

Add a nullable, unique `users.auth_user_id` column (UUID, referencing `auth.users(id)` by convention — a hard FK into the Supabase-managed schema is possible but optional; recommend a plain unique column + lookup by value to keep Prisma simple). Then:

- `users.id` **remains the internal PK forever** — every existing FK, subscription row, and Lemon Squeezy contract keeps working untouched.
- `auth_user_id` is the *authentication* link: `getAuthUser` verifies the Supabase token, then resolves the internal user via `auth_user_id` (with a legacy-JWT fallback during the transition window).
- Backfill: each legacy user's `auth_user_id` is set at first post-migration login (rolling import), or in a bulk import (§14).
- Checkout/webhook keep passing **`users.id`** in `custom_data` — **not** the Supabase ID — so Lemon Squeezy data already in production never needs remapping.

---

## 8. LEMON SQUEEZY INTEGRATION

### 8.1 Component map [VERIFIED]

| Piece | File(s) |
|---|---|
| Config/env resolution (test vs live namespaces, fail-closed) | [backend/src/config/billing.ts](backend/src/config/billing.ts) |
| Checkout creation (LS REST `/v1/checkouts`) | [backend/src/lib/billing/lemonSqueezyCheckout.ts](backend/src/lib/billing/lemonSqueezyCheckout.ts) |
| Entitlement evaluation | [backend/src/lib/billing/entitlement.ts](backend/src/lib/billing/entitlement.ts) |
| Account state + customer-portal URL fetch | [backend/src/lib/billing/accountState.ts](backend/src/lib/billing/accountState.ts) |
| Reconciliation (local vs provider) | [backend/src/lib/billing/lemonSqueezyReconciliation.ts](backend/src/lib/billing/lemonSqueezyReconciliation.ts) |
| Provider status mapping | [backend/src/lib/billing/lemonSqueezyState.ts](backend/src/lib/billing/lemonSqueezyState.ts) |
| Webhook idempotency record | [backend/src/lib/billing/webhookEvents.ts](backend/src/lib/billing/webhookEvents.ts) + [webhookIdentity.ts](backend/src/lib/billing/webhookIdentity.ts) |
| Webhook signature verification | [backend/src/lib/billing/webhookSignature.ts](backend/src/lib/billing/webhookSignature.ts) |
| Pro gate for custom goals | [backend/src/lib/billing/goalAuthorization.ts](backend/src/lib/billing/goalAuthorization.ts) → used in [goal.ts](backend/src/routes/goal.ts) `/create` |
| Routes | [backend/src/routes/billing.ts](backend/src/routes/billing.ts): `GET /api/billing/entitlement`, `GET /api/billing/account`, `POST /api/billing/reconcile`, `POST /api/billing/checkout` |
| Webhook route | [backend/src/routes/webhook.ts](backend/src/routes/webhook.ts) at `POST /api/billing/webhook` (mounted **before** `express.json()` with `express.raw({ type: 'application/json' })` in [index.ts](backend/src/index.ts)) |
| Frontend | [CustomGoalGate.tsx](frontend/src/components/billing/CustomGoalGate.tsx), [CheckoutReturnPage.tsx](frontend/src/pages/CheckoutReturnPage.tsx), [AccountMenu.tsx](frontend/src/components/app/AccountMenu.tsx), [ProPresentation.tsx](frontend/src/components/billing/ProPresentation.tsx) |
| Docs | [docs/features/billing/reference/lemonsqueezy-billing-configuration.md](docs/features/billing/reference/lemonsqueezy-billing-configuration.md), [docs/features/billing/reference/lemonsqueezy-checkout-identity-contract.md](docs/features/billing/reference/lemonsqueezy-checkout-identity-contract.md), [docs/features/billing/reference/lemonsqueezy-webhook-idempotency.md](docs/features/billing/reference/lemonsqueezy-webhook-idempotency.md), [docs/features/billing/reference/launch-rollback-readiness.md](docs/features/billing/reference/launch-rollback-readiness.md) |
| Tests | `backend/src/routes/billing*.test.ts`, `backend/src/routes/webhook.test.ts`, `backend/src/lib/billing/*.test.ts` (17 files) — pure unit tests with mocked Prisma/fetch |

### 8.2 Current flow [VERIFIED]

```
User (authenticated, Bearer JWT)
 → frontend POST /api/billing/checkout { interval }
 → backend getAuthUser → user.id + user.email
 → LS API: create checkout (store, variant from env; checkout_data.email = user.email;
    checkout_data.custom.user_id = user.id; redirect_url = CLIENT_ORIGIN + /billing/return?checkout=success)
 → browser redirect to LS-hosted checkout → payment
 → LS signed webhook POST /api/billing/webhook (X-Signature HMAC-SHA256 hex over raw body)
 → verify signature (timing-safe) → parse → event in SUPPORTED_EVENTS (10 subscription_* events)?
 → recordWebhookDelivery: INSERT webhook_events (deliveryKey = SHA-256(rawBody), unique) → duplicates answered {duplicate:true};
    existing RECEIVED/FAILED rows are retryable
 → meta.custom_data.user_id must resolve to users.id (else event FAILED, no entitlement)
 → mapLemonSqueezyStatus → internal state (ACTIVE / CANCELLED_ENDING / PAST_DUE_RECOVERY / UNPAID / PAUSED / EXPIRED / UNKNOWN)
 → $transaction: subscriptions.upsert (by providerSubscriptionId) + webhook_events → PROCESSED
 → entitlement: hasProEntitlement(userId) reads local subscriptions (plan='pro'), status ∈ {ACTIVE, CANCELLED_ENDING,
    PAST_DUE_RECOVERY, UNPAID, PAUSED}, and currentPeriodEnd > now → PRO_ENTITLED
 → frontend: CheckoutReturnPage polls /api/billing/entitlement (never trusts the redirect);
    AccountMenu shows /api/billing/account state + manageUrl
```

Provider IDs stored: `providerCustomerId`, `providerSubscriptionId` (**unique**, local key), `providerProductId`, `providerVariantId` (+ env-configured monthly/yearly variant IDs). Provider: fixed string `'lemon_squeezy'`. Mode: **test** (`LEMON_SQUEEZY_ENVIRONMENT=test` in render.yaml; live namespace reserved for post-onboarding).

### 8.3 WHAT MUST REMAIN UNCHANGED (the "do not touch" list) [VERIFIED + INFERRED]

1. **`User.id` values** — the anchor for `subscriptions.userId`, checkout `custom_data.user_id`, and webhook resolution. Never regenerate, never swap for Supabase IDs.
2. **`subscriptions` table and its unique `providerSubscriptionId`** — webhook upsert semantics depend on it.
3. **`webhook_events` and `deliveryKey` uniqueness** — the idempotency fence; must be migrated with data intact.
4. **Webhook endpoint URL, signature verification, raw-body middleware** (`X-Signature` hex HMAC-SHA256 over the exact raw body; `express.raw` mounted before `express.json()`).
5. **`LEMON_SQUEEZY_*` environment variables and the test/live namespace logic** — including the fact that `LEMON_SQUEEZY_TEST_WEBHOOK_SIGNING_SECRET` is dashboard-only.
6. **`CLIENT_ORIGIN`** — it doubles as the checkout `redirect_url` base (`/billing/return?checkout=success`) and CORS origin.
7. **Entitlement logic** (`ENTITLED_STATUSES`, period-end boundary rule, unpaid/pause semantics) and the Pro gate on custom goals.
8. **`BILLING_CHECKOUT_ENABLED` kill switch semantics** (503 on checkout only; does not touch existing subs).
9. **Reconciliation endpoint behavior** (never fabricates state; provider outage → 503 with local state intact).

### 8.4 How the migration could accidentally break each of these — and the prevention

| Hazard | Mechanism | Prevention |
|---|---|---|
| Break subscriptions / lose provider IDs | Data copy misses `subscriptions` or mangles `providerSubscriptionId` uniqueness | Full-table copy + uniqueness verification (§13.5); never recreate subscriptions from LS API |
| Duplicate users | Re-importing users with new IDs, or auth import creating second rows for the same email | Copy `users` verbatim; auth import links via `auth_user_id`, never inserts into `users` by email match alone; keep email-unique constraint |
| Lose webhook events / double-process | `webhook_events` not copied, or copied with altered `deliveryKey`s | Copy table byte-for-byte; verify count + unique index |
| Change Pro entitlement | Rows copied but `status`/period fields altered, or timezone/precision drift in `TIMESTAMP(3)` | pg_dump preserves types/bytes; verify with SQL: list of entitled users identical pre/post |
| Disconnect LS customers from users | `subscriptions.userId` FK integrity broken by re-ordered import | Import with FK constraints present (single dump) or `SET session_replication_role`-free ordering via `--disable-triggers` in one transaction; verify FK `NOT VALID`/orphans = 0 |
| Webhook silently broken during cutover | `DATABASE_URL` flip while LS retries a delivery → handler down or pointed at empty DB | Cutover inside a short freeze; LS retries automatically (docs note retries + dashboard resend); optionally set `BILLING_CHECKOUT_ENABLED=false` during the window (webhook path itself stays up) |
| Checkout identity drift after auth migration | New code passing Supabase `sub` instead of `users.id` into `custom_data` | Freeze the checkout/webhook code path in the auth PRs; add a regression test asserting `custom.user_id === internal user.id` |

**Dependency chain (exact):** *Authentication* → resolves a `users` row → `users.id` → *subscriptions rows* (FK) → *entitlement* → Pro gates. *Lemon Squeezy* ↔ `users.id` via `custom_data` (outbound) and webhook resolution (inbound). Therefore: **auth may change how the user is *authenticated* but must never change *which row* is resolved; the database move may change *where* rows live but never *which* rows.**

---

## 9. FRONTEND AUTH DEPENDENCIES

Every file below **[VERIFIED]** to touch auth. Migration-likely list with reasons:

| File | Why it depends on current auth | Migration impact |
|---|---|---|
| [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) | Owns token state, localStorage key, login/signup/logout, session restore via `/me` | **Rewrite core**: supabase-js session (`onAuthStateChange`, `getSession`), keep exposing `user` (internal shape) + a token for API calls |
| [frontend/src/lib/api.ts](frontend/src/lib/api.ts) | All `Authorization: Bearer` headers (12 sites), `signupUser`, `loginUser`, `fetchCurrentUser` | Token source changes (likely passed from AuthContext still); `signupUser`/`loginUser` call sites replaced by supabase-js; keep every *other* function signature unchanged |
| [frontend/src/lib/authFlow.ts](frontend/src/lib/authFlow.ts) | Client validation mirroring backend (`PASSWORD_MIN_LENGTH = 6`, email `@` rule), error taxonomy mapped to backend status codes (409/401/400) | Validation moves to Supabase policy (min length configurable — decide target); error mapping changes (Supabase error codes/messages) |
| [frontend/src/pages/auth/AuthScreen.tsx](frontend/src/pages/auth/AuthScreen.tsx) | Submits to login/signup via context; duplicate-email 409 flow with "Sign in instead" | Same UX goals; calls change; Supabase "email not confirmed" states may need UI |
| [frontend/src/pages/auth/LoginPage.tsx](frontend/src/pages/auth/LoginPage.tsx) / [SignupPage.tsx](frontend/src/pages/auth/SignupPage.tsx) | Thin wrappers hosting AuthScreen | Minor |
| [frontend/src/pages/auth/usePostAuthRedirect.ts](frontend/src/pages/auth/usePostAuthRedirect.ts) | Redirect-once logic keyed on `token` identity transitions | Must key off the new session/user identity signal; grace-timer logic may need rework with async session restore |
| [frontend/src/components/ProtectedRoute.tsx](frontend/src/components/ProtectedRoute.tsx) | Guard: `user && token` else `/login?next=`; goal-aware onboarding redirect | Keep API; token/user now come from Supabase session; consider `loading` semantics (access-token refresh) |
| [frontend/src/context/GoalContext.tsx](frontend/src/context/GoalContext.tsx) | Fetches goal whenever `token` changes; health check | Token provenance change only; keep `token`-in-effects pattern or switch to user-id trigger |
| [frontend/src/components/app/AccountMenu.tsx](frontend/src/components/app/AccountMenu.tsx) | `logout()` (client-side clear + navigate), billing state fetch with token | `logout` → `supabase.auth.signOut()`; token passed to billing calls |
| [frontend/src/components/app/AppShell.tsx](frontend/src/components/app/AppShell.tsx) | Shell mode from `Boolean(token)` | Source of token truth change |
| [frontend/src/components/billing/CustomGoalGate.tsx](frontend/src/components/billing/CustomGoalGate.tsx) | Entitlement + checkout with token | Token provenance only — logic must not change |
| [frontend/src/pages/CheckoutReturnPage.tsx](frontend/src/pages/CheckoutReturnPage.tsx) | Polls entitlement with token; waits for `authLoading` | Token provenance only |
| [frontend/src/pages/OnboardingPage.tsx](frontend/src/pages/OnboardingPage.tsx), [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx) | `useAuth()` for token/user gating | Token provenance only |
| [frontend/src/components/today/Today.tsx](frontend/src/components/today/Today.tsx), [frontend/src/components/today/useTaskActions.ts](frontend/src/components/today/useTaskActions.ts) | Task updates with token | Token provenance only |
| Tests: [AuthScreen.test.tsx](frontend/src/pages/auth/AuthScreen.test.tsx), [ProtectedRoute.test.tsx](frontend/src/components/ProtectedRoute.test.tsx), [AppShell.test.tsx](frontend/src/components/app/AppShell.test.tsx), [Home.test.tsx](frontend/src/pages/Home.test.tsx), [ProgressPage.test.tsx](frontend/src/pages/ProgressPage.test.tsx), [Today.test.tsx](frontend/src/components/today/Today.test.tsx), [useTaskActions.test.tsx](frontend/src/components/today/useTaskActions.test.tsx), [api.billing.test.ts](frontend/src/lib/api.billing.test.ts) | Seed `localStorage['achivii_auth_token']` / mock login API | Update fixtures to mock the new session mechanism |
| [frontend/e2e/auth.spec.ts](frontend/e2e/auth.spec.ts) (+ `mockApi.ts`) | Full auth journey incl. 401/409/offline copy, `next` param, sign-out | Rework to the new auth UI/SDK; keep the excellent UX assertions |

Also **non-auth localStorage usage that must not be disturbed** during the auth rework: `achivii_draft_goal` ([usePostAuthRedirect.ts](frontend/src/pages/auth/usePostAuthRedirect.ts), [pathways/launch.ts](frontend/src/components/pathways/launch.ts), [useOnboardingState.ts](frontend/src/components/onboarding/useOnboardingState.ts)), review drafts ([lib/reviewDraft.ts](frontend/src/lib/reviewDraft.ts)), closing reflections ([today/ClosingStretchView.tsx](frontend/src/components/today/ClosingStretchView.tsx)).

**New files the migration will add (expected):** a Supabase client module (`frontend/src/lib/supabase.ts`), possibly a token-getter used by api.ts, and env plumbing (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

---

## 10. BACKEND AUTH DEPENDENCIES

| File | Why [VERIFIED] | Migration impact |
|---|---|---|
| [backend/src/routes/auth.ts](backend/src/routes/auth.ts) | Everything: `JWT_SECRET` bootstrap, `hashPassword`/`verifyPassword` (scrypt), `createToken`/`verifyToken` (HS256), `getAuthUser` (Bearer→DB), `/signup`, `/login`, `/me` | **Primary rewrite**: verify Supabase access token (JWKS/asymmetric or HS256 secret per project config), resolve internal user by `auth_user_id`; keep `/me` response shape; add `/auth/bootstrap`-style internal-user creation for new Supabase signups; keep legacy scrypt `/login` during transition |
| [backend/src/routes/goal.ts](backend/src/routes/goal.ts) | 6 × `getAuthUser` + 401 handling; custom-goal Pro gate uses resolved `user.id` | **Should not change** if `getAuthUser` contract (same return shape, same `user.id` semantics) is preserved — this is the key compatibility constraint |
| [backend/src/routes/billing.ts](backend/src/routes/billing.ts) | 4 × `getAuthUser`; handlers derive identity from `user.id`/`user.email` only | **Should not change** under the same contract |
| [backend/src/routes/webhook.ts](backend/src/routes/webhook.ts) | No header auth, but resolves `custom_data.user_id` → `users.id`; rejects unknown users | **Must not change**; depends only on `users.id` stability |
| [backend/src/index.ts](backend/src/index.ts) | Mounts routers; CORS allow-list; webhook raw-body order | Only if auth needs middleware (e.g. optional-JWT for transition), CORS may need the Supabase redirect/origin handled (it already allows `*.vercel.app`) |
| [backend/src/lib/prisma.ts](backend/src/lib/prisma.ts) | Prisma singleton used by `getAuthUser` | Unchanged for DB move; no auth coupling |
| Tests: [backend/test/timezone.test.ts](backend/test/timezone.test.ts) (auth router mocked-Prisma signup tests), route-level billing/webhook tests | Exercise auth shapes indirectly | Update where signup/login contract changes |

**Compatibility requirement (the one-sentence contract):** every route must continue to receive a resolved internal user `{ id, email, timezone, created_at }` whose `id` is the legacy `users.id`, regardless of what token type authenticated the request.

---

## 11. ENVIRONMENT VARIABLES

Full inventory [VERIFIED from `.env.example` files, render.yaml, vercel.json, vite.config.ts, and source grep]. Values never shown.

| Name | Purpose | Current location | Secret? | Migration action |
|---|---|---|---|---|
| `DATABASE_URL` | Postgres connection for Prisma | render.yaml `fromDatabase` + backend/.env.example | **SECRET** | **CHANGE** value → Supabase connection string (+`sslmode=require`) |
| `JWT_SECRET` | Custom-JWT signing (auth.ts; ≥32 chars; prod-required) | render.yaml `generateValue`, dashboard | **SECRET** | **REMOVE** (final cleanup phase, after legacy-token window closes) |
| `CLIENT_ORIGIN` | CORS origin; also checkout `redirect_url` base | render.yaml (prod), backend/.env.example (dev) | No | **KEEP** (`https://achiviiweb.vercel.app`) |
| `PORT` | Express port (Render `10000`) | render.yaml, backend/.env.example | No | **KEEP** |
| `NODE_ENV` | prod flag (JWT dev-fallback gate) | render.yaml | No | **KEEP** |
| `LEMON_SQUEEZY_ENVIRONMENT` | `test`/`production` namespace switch | render.yaml, backend/.env.example | No | **KEEP** |
| `LEMON_SQUEEZY_TEST_STORE_ID`, `_API_KEY`, `_WEBHOOK_SIGNING_SECRET`, `_PRO_MONTHLY_VARIANT_ID`, `_PRO_YEARLY_VARIANT_ID` | Test-mode LS config (5 vars, all-or-nothing fail-closed) | render.yaml (`sync:false` except signing secret = dashboard-only), backend/.env.example | **SECRET** (API key, signing secret) | **KEEP — untouched** |
| `LEMON_SQUEEZY_LIVE_*` (same 5) | Live-mode LS config | backend/.env.example + dashboard | **SECRET** | **KEEP** |
| `BILLING_CHECKOUT_ENABLED` | Checkout kill switch (`"false"` → 503) | Runtime dashboard only (docs; referenced in billing.ts) | No | **KEEP** — use during cutover windows |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL` (optional, read in gemini.ts) | LLM + 768-dim embeddings | backend/.env.example + dashboard | **SECRET** (key) | **KEEP** |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_BACKUP_MODEL` | LLM fallback chain | backend/.env.example + dashboard | **SECRET** (key) | **KEEP** |
| `TAVILY_API_KEY` | Live research | backend/.env.example + dashboard | **SECRET** | **KEEP** |
| `VITE_API_BASE_URL`, `VITE_API_URL` | Frontend → Render API URL | vercel.json (×2), frontend/.env.example, frontend/.env.production, vite.config.ts define | No | **KEEP** (API host unchanged) |
| *(new)* `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase JS client in frontend | — | Anon key not secret | **ADD** (auth phase) |
| *(new)* Supabase backend verification material — `SUPABASE_JWT_SECRET` (if HS256) **or** JWKS URL/signing keys (asymmetric) | Verifying Supabase access tokens on the API | — | **SECRET** (HS256 case) | **ADD** (auth phase; depends on the project's JWT signing-key configuration — see §19) |
| *(new, optional)* `DIRECT_URL` | Prisma migrations endpoint if `DATABASE_URL` becomes pooled | — | **SECRET** | **ADD only if** transaction-pooler URL is ever used for runtime; recommended pattern: migrations via session/direct |

Categorically: **KEEP** — all Lemon Squeezy vars, `CLIENT_ORIGIN`, `PORT`, `NODE_ENV`, AI keys, `VITE_API_*`. **CHANGE** — `DATABASE_URL`. **REMOVE** — `JWT_SECRET` (phase 3 cleanup). **ADD** — Supabase URL/anon key (frontend) + backend verification material; nothing else.

---

## 12. DEPLOYMENT ARCHITECTURE

[VERIFIED unless noted]

- **Frontend deploy:** Vercel (project `achiviiweb`); two vercel.json configs; build `cd frontend && npm install && npm run build` → `frontend/dist`; SPA rewrites; build-time `VITE_API_*` injected from vercel.json. Custom domain/status [UNKNOWN — dashboard].
- **Backend deploy:** Render Blueprint (`render.yaml`): build with `prisma migrate deploy` embedded; start `node dist/index.js` on `PORT=10000`; health check `/api/health` (static — DB-independent, so deploys won't fail on DB misconfig).
- **Migrations on deploy:** `npx prisma migrate deploy` runs on **every** deploy inside `buildCommand`; pending migrations apply automatically. Git history proves this path is exercised and fragile to non-SQL issues (BOM in migration files once broke it → `0657b94`; a failed migration needed `migrate resolve` → `c25ec9e`). Any new migration (e.g. `auth_user_id`) rides this same path.
- **How Render connects to the DB:** internal `fromDatabase` injection today → becomes a dashboard-managed secret after cutover.
- **How Vercel connects to the backend:** plain HTTPS fetch to `https://achivii-api.onrender.com`.
- **CORS:** [index.ts](backend/src/index.ts) — allow-list = `CLIENT_ORIGIN` (+comma-split) ∪ dev defaults ∪ **any `*.vercel.app`**; `credentials: true`; methods incl. PATCH; headers `Content-Type, Authorization, Accept`. Webhook callers (LS) send no Origin → allowed via `!origin` branch. **Nothing about the Supabase DB move changes CORS; the auth migration also needs no CORS change** (frontend talks to Supabase directly over its own domain, and to the API exactly as today). If a custom production domain exists, it must be added to `CLIENT_ORIGIN` [UNKNOWN whether one exists].
- **Production URLs:** API `https://achivii-api.onrender.com` [VERIFIED]; frontend `https://achiviiweb.vercel.app` [VERIFIED from render.yaml comment]; LS webhook `https://achivii-api.onrender.com/api/billing/webhook` [INFERRED from index.ts mount + docs; actual LS dashboard config UNKNOWN].
- **What breaks if `DATABASE_URL` changes incorrectly:** every DB-backed route (auth, goals, billing handlers, webhook processing) fails at runtime while **the health check still passes** — i.e., Render shows a healthy deploy over a broken app. Frontend shows `apiStatus: offline` and auth screens announce it, but protected pages just fail fetches. Mitigation: post-deploy verification checklist (§17) + quick rollback by reverting the env value.
- **Deploy-time environment supply:** Render Blueprint env vars + `sync: false` dashboard values + `generateValue`; Vercel build env from vercel.json (+ dashboard overrides [UNKNOWN]).

---

## 13. DATA MIGRATION PLAN (informational — do not execute from this brief alone)

### 13.1 Export from Render

- Render exposes external connection strings for PostgreSQL resources (dashboard → connection info; TLS required on external URLs). From any machine with `pg_dump` ≥ Postgres 16 client: `pg_dump "<RENDER_EXTERNAL_URL>" -Fc -f achivii.dump` (custom format; includes schema + data + indexes; extension `vector` is included as `CREATE EXTENSION` — Supabase tolerates it; keep the dump even if you rebuild schema via Prisma).
- **Take the dump regardless of plan and before anything else.** If the DB is on Render's free plan it is subject to the ~30-day expiry deletion — the dump may be the only copy. [Render policy VERIFIED; instance plan UNKNOWN]

### 13.2 Import into Supabase — two viable approaches

- **Option A (recommended): Prisma schema + data-only dump.**
  1. `npx prisma migrate deploy` against Supabase (session/direct URL) — builds tables, FKs, indexes, HNSW, GIN, extension.
  2. `pg_dump --data-only --disable-triggers --exclude-table='auth.*' --exclude-table='storage.*' --exclude-table='realtime.*' … "<RENDER_URL>" | psql "<SUPABASE_URL>"` — or restore a data-only custom-format dump with `pg_restore --data-only --disable-triggers`. FK-safe because all data restores inside the transaction with triggers disabled; UUIDs/timestamps/Json/vector literals copy byte-for-byte.
  3. Supabase's `auth`/`storage` schemas already exist in the target — exclude them from any full restore. **Do not pg_restore the `auth` schema from Render (it doesn't exist there) and never overwrite Supabase-managed schemas.**
- **Option B: full dump/restore.** `pg_restore` the whole Render DB into Supabase `postgres` DB. Works (objects are plain `public`), but drags the orphaned Stripe columns along (fine per §5.2 option 1) and risks colliding with Supabase-managed objects if flags are wrong. Option A is cleaner and keeps Prisma's migration ledger (`_prisma_migrations`) populated by the tool itself.

**pg_dump/pg_restore appropriateness [VERIFIED design, INFERRED suitability]:** yes — dataset is small (weeks-old startup, free-tier plans), single schema, no Postgres-version-specific features beyond pgvector. Prisma migrations alone are **not** a data-migration tool (schema only) — they complement, not replace, the dump.

### 13.3 Vector data specifics

- `outcomeEmbedding` is a real `vector(768)` in the dump; after `CREATE EXTENSION vector` (via migration step 1) the restore accepts it natively. No re-embedding needed **if** dimensions match (they will — 768 in, 768 out).
- HNSW index is created by the migration *before* data load (migrate deploy first, data second) → inserts build the index incrementally; slower but safe. Alternative for speed: create data first and add the HNSW index after — but then migration history diverges; not worth it at this scale.
- GIN expression index likewise rebuilt by migration.

### 13.4 Verification of relationships/row counts — write one script

Suggested checks (SQL, runnable against both DBs for diffing):

```sql
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'goals', count(*) FROM goals
UNION ALL SELECT 'roadmap_weeks', count(*) FROM roadmap_weeks
UNION ALL SELECT 'daily_tasks', count(*) FROM daily_tasks
UNION ALL SELECT 'weekly_reviews', count(*) FROM weekly_reviews
UNION ALL SELECT 'subscriptions', count(*) FROM subscriptions
UNION ALL SELECT 'webhook_events', count(*) FROM webhook_events
UNION ALL SELECT 'research_cache', count(*) FROM research_cache;
-- FK orphans (must be 0 everywhere)
SELECT count(*) FROM goals g LEFT JOIN users u ON u.id=g."userId" WHERE u.id IS NULL;
SELECT count(*) FROM subscriptions s LEFT JOIN users u ON u.id=s."userId" WHERE u.id IS NULL;
SELECT count(*) FROM daily_tasks d LEFT JOIN goals g ON g.id=d."goalId" WHERE g.id IS NULL;
-- entitlement snapshot for diff
SELECT s."userId", s.status, s."currentPeriodEnd" FROM subscriptions s WHERE s.plan='pro' ORDER BY 1;
-- vector sanity
SELECT count(*) AS rows, count("outcomeEmbedding") AS with_vector FROM research_cache;
```

Plus: `npm run verify:pgvector` (HNSW/GIN + `<=>` + plan checks), and a Tier-2 hit test against a known cached goal (run `researchCache.test.ts` against Supabase `DATABASE_URL`).

### 13.5 Subscription/user-specific verification

- Users: count, and per-user email set equality (`md5(string_agg(email,',' ORDER BY email))` diff between old/new).
- Subscriptions: count; `providerSubscriptionId` uniqueness intact; every `userId` resolves; status distribution identical; entitled-user list identical (§13.4).
- Webhook events: count; `deliveryKey` unique index present; no `status='RECEIVED'` stragglers processed twice (compare `processedAt` max).

### 13.6 Rollback (database move)

- **Do not delete or pause the Render database** during the rollback window (also protects against the free-tier expiry trap — pause *never*; keep it until confidence is declared, then take a final dump before decommission).
- Rollback = flip Render `DATABASE_URL` back to the Render connection string and redeploy. The custom auth stack is untouched by the DB move, so rollback is total and trivial.
- Any writes that landed on Supabase during the failure window are lost on rollback — keep the window short and consider a second delta dump if the window exceeds minutes.
- LS webhook retry behavior covers brief handler downtime automatically; use `BILLING_CHECKOUT_ENABLED=false` if the window must exceed a few minutes (new purchases pause; existing subs and webhooks unaffected).

---

## 14. AUTH MIGRATION PLAN (strategy — implementation comes later)

### 14.1 The password-hash problem [VERIFIED against Supabase docs]

Supabase Auth's admin user-creation API accepts `hashed_password` in **bcrypt** or **Argon2** (or plaintext, which it then hashes). Achivii's scrypt strings (`salt:hash`, Node defaults) are **not** importable — Supabase cannot verify them. Therefore:

| Option | Mechanism | Users impacted | Assessment |
|---|---|---|---|
| **A. Rolling/lazy import (recommended)** | Keep legacy `/login` (scrypt) active. On successful legacy login, the backend calls Supabase Admin `createUser` with the **plaintext just submitted** (Supabase hashes it), sets `email_confirm: true`, stores `auth_user_id`. Frontend signs the user into Supabase with those same credentials (`signInWithPassword`) — or the backend mints the Supabase session — and the app proceeds on Supabase tokens. Users who never log in during the window get bulk-imported/forced-reset at the end. | Zero disruption for active users; inactive users handled by sweep | Best UX; requires a transition window where both verifiers exist; passwords are only ever in memory at login time |
| B. Force password reset for everyone | Bulk-create Supabase users (email only, `email_confirm: true`), send reset/magic links | 100% of users | Simplest backend, worst UX; risky for conversion; acceptable fallback |
| C. Plaintext import | Export nothing — impossible: only hashes exist | — | Not applicable [VERIFIED: only scrypt hashes are stored] |

UNKNOWN (external): whether the Supabase admin API's `password` field is available for a "set known plaintext at creation" path on the target plan/version — Option A uses it; verify current API semantics during planning.

### 14.2 Linking and identity

- Add `users.auth_user_id` (uuid, nullable, **unique**) via a normal Prisma migration (rides the existing `migrate deploy` deploy path; rollback = drop column).
- **Email as the temporary matching key is safe here** [VERIFIED preconditions]: emails are unique by constraint and lowercased by the app before storage, so `users.email` ↔ Supabase Auth email matching is 1:1. Residual risks: (a) users who signed up with mixed-case intent — moot, stored lowercase; (b) Supabase Auth config must not auto-uppercase/alter emails (default: lowercase); (c) Supabase signups *after* cutover must create the internal user transactionally so `users.email` stays the single source of truth for uniqueness (also keep Supabase's own uniqueness on).
- **`users.id` must remain unchanged** — this is what preserves goals, subscriptions, webhook resolution, and the LS contract (§7, §8).
- Existing Lemon Squeezy subscriptions remain attached because nothing about `subscriptions.userId` changes; checkout continues to embed `users.id`.
- Existing goals remain attached for the same reason — the auth layer only changes *how* `getAuthUser` resolves the row.

### 14.3 API/session changes

- **Backend:** replace `verifyToken`/`createToken` with Supabase JWT verification: fetch JWKS (asymmetric keys — Supabase's current default) or share the HS256 secret, verify `exp`/`aud`/`iss`, extract `sub` → `prisma.user.findUnique({ where: { auth_user_id: sub } })` → same return shape as today. Transition window: accept legacy JWTs too (verify old way → fall back), so in-flight 14-day tokens keep working and no one is logged out on deploy day.
- **Frontend:** supabase-js owns the session (`auth.getState()` / `onAuthStateChange`), auto-refreshing 1-hour access tokens; AuthContext exposes the same `{ user, token, loading, login, signup, logout }` surface so most components don't change. `localStorage` key becomes the supabase-js managed key (`sb-<ref>-auth-token`) — the old key should be actively removed on first load to avoid stale sessions.
- **Logout:** `supabase.auth.signOut()` — genuinely revokes the refresh token server-side (an upgrade over today's client-only logout).
- **Protected routes:** `ProtectedRoute` logic unchanged; session restore becomes async-refresh-aware (the current "any /me failure clears the token" behavior must not log users out on a transient refresh hiccup).
- **Signup:** frontend calls `supabase.auth.signUp` → then a backend bootstrap endpoint creates the internal `users` row (id = new app-generated uuid, `auth_user_id`, `timezone` from client) inside a transaction; keep `email_confirm` policy decision explicit (Supabase can require confirmation; Achivii never verified emails before — enabling confirmation changes onboarding UX; recommend **disabled initially** to preserve current behavior, enable later as a product decision).

### 14.4 What becomes possible afterward (out of scope for the migration itself)

Password reset, email verification, OAuth, MFA, real session revocation — all become configuration/feature work rather than re-architecture. Do **not** enable them in the same change window.

---

## 15. RECOMMENDED MIGRATION ORDER (proposal only — not implemented)

**Phase 0 — Safety net (no product change)**
1. Immediate `pg_dump` of production (free-plan expiry risk).
2. Record baseline verification snapshot (§13.4 counts + entitlement list) and store it.
3. Resolve the Stripe-columns drift decision (§5.2 — recommend "replay history, cleanup later").
4. Freeze scope: no feature deploys during the migration window.

**Phase 1 — Database move (custom auth untouched)**
5. Create Supabase project; note region/ref; get session-pooler + direct URLs.
6. Staging rehearsal: replay `prisma migrate deploy` on the empty Supabase DB; restore data dump; run `verify:pgvector` + §13.4 diffs; run backend tests against Supabase.
7. Cutover window (minutes): enable `BILLING_CHECKOUT_ENABLED=false` (optional), final delta dump → restore, flip Render `DATABASE_URL` (+`sslmode=require`), redeploy, run §17 database checklist, re-enable checkout.
8. Burn-in 24–48 h watching webhook_events processing and error logs. Rollback = revert env var.

**Phase 2 — Auth groundwork (still zero behavior change)**
9. Prisma migration: add `users.auth_user_id` (nullable unique). Ship and verify deploy (watch P3009-style failure modes; the repo has been here before).
10. Add Supabase backend token verification **alongside** legacy verification (accept both). No frontend change yet. All routes still resolve to the same `users.id`.

**Phase 3 — Rolling auth cutover (zero downtime)**
11. Frontend: supabase-js client, new AuthContext internals (same external surface), updated auth screens, legacy-token cleanup on load. New signups → Supabase + bootstrap internal user.
12. Backend legacy `/login` becomes the lazy importer (Option A, §14.1). Deploy.
13. Monitor: fraction of users with `auth_user_id IS NOT NULL`; legacy-login volume trending to zero.
14. Sweep: bulk-create Supabase users for remaining stragglers (email-only, confirmed) or targeted reset emails.

**Phase 4 — Cleanup (separate, low-risk deploy)**
15. Remove legacy login path + `hashPassword`/`verifyPassword`/`createToken`/`verifyToken`; remove `JWT_SECRET` from Render. Optionally drop `users.password_hash` (recommend: keep one release cycle, then drop in a final migration).
16. Post-cleanup: consider dropping the orphaned Stripe columns (own migration), documenting Supabase runbooks.

Downtime profile: Phase 1 = single short write freeze (minutes); Phases 2–3 = none; Phase 4 = none. At every step, Lemon Squeezy paths are observable and reversible, and every DB state change is one env-var flip from rollback.

---

## 16. RISK REGISTER

| # | Risk | Severity | Why it matters | Prevention | Verification | Rollback |
|---|---|---|---|---|---|---|
| 1 | **User identity mismatch** (Supabase `sub` treated as `users.id`) | Critical | Webhook `custom_data.user_id` lookups fail → FAILED events → Pro never granted; data corruption | Keep `users.id` as PK; add `auth_user_id`; strict mapping in `getAuthUser`; freeze checkout/webhook code | Login as migrated Pro user → entitlement endpoint returns `pro`; webhook test event resolves | Revert auth deploy; env/DB untouched |
| 2 | **Password migration failure** (scrypt not importable) | High | All existing users locked out | Option A lazy import (§14.1); never delete `password_hash` until legacy path retired | Legacy user logs in post-cutover; new Supabase login works immediately after | Users still know their passwords; re-run import |
| 3 | **Lost users** (import drops rows / splits identities) | Critical | People can't sign in; goals "disappear" (orphaned) | Verbatim table copy; email-based 1:1 link only via `auth_user_id`; no email-match INSERTs into `users` | §13.4 count + email-set hash diff | Restore from dump / flip DATABASE_URL back |
| 4 | **Lost goals/weeks/tasks/reviews** | Critical | Core product data | Single-transaction data restore with FKs present; §13.4 per-table counts + FK-orphan queries | Spot-check a known user's roadmap in UI | Flip DATABASE_URL back |
| 5 | **Lost subscriptions / provider IDs** | Critical | Pro users downgraded; webhooks can't upsert (unique key) | Copy `subscriptions` byte-for-byte; verify uniqueness + counts + entitled list | Existing Pro user sees Pro after cutover; `/api/billing/account` matches pre-move snapshot | Flip DATABASE_URL back |
| 6 | **Broken LS webhooks** | Critical | Entitlement stops updating; purchases lost during window | Keep endpoint/secret/raw-body path untouched; cutover in short window (LS retries); monitor `webhook_events.status` | Test-mode test purchase end-to-end; dashboard resend of a recent event | None needed — LS retries; investigate failures via `processingError` |
| 7 | **Broken entitlements** | High | Free/paid state wrong | Don't touch `entitlement.ts`/`lemonSqueezyState.ts`; verify status distribution unchanged | Entitlement snapshot diff (§13.4) | Revert offending deploy |
| 8 | **pgvector migration failure** (extension missing, HNSW/GIN absent, wrong dim) | High | Cache tier-2 misses → repeated paid research; or restore errors | `migrate deploy` before data load; `verify:pgvector` gate before cutover | Script passes on Supabase; Tier-2 test hits | Re-run extension/migration; flip back if data degraded |
| 9 | **Prisma migration issues on deploy** (P3009-class failures — has happened in this repo) | Medium | Failed deploys, drifted `_prisma_migrations` | Rehearse on staging; keep migrations additive; BOM-free files; know `prisma migrate resolve` runbook | Deploy logs; `migrate status` | `prisma migrate resolve --rolled-back` + fix, as done in `c25ec9e` |
| 10 | **Connection pooling misfit** (transaction mode + interactive tx/prepared stmts) | High | Webhook `$transaction` failures; random query errors | Session pooler (or direct); never transaction mode; `pgbouncer=true` only if forced to 6543 | Soak test webhook + goal generation on final URL | Change URL back |
| 11 | **CORS / origin regressions** | Medium | Frontend can't call API after changes | CORS config untouched by DB move; auth migration adds no cross-origin API calls | Browser console check on prod domain + preview | Revert deploy |
| 12 | **JWT removal too early** | High | In-flight 14-day tokens die mid-window → forced logouts | Dual verification until legacy-login volume ≈ 0; remove in Phase 4 | Monitor legacy accept count; no login-spike in errors after each deploy | Re-enable legacy path (keep code until cleanup) |
| 13 | **Frontend session state regressions** (refresh loops, logout-on-401) | Medium | Users logged out randomly; support load | AuthContext keeps external API; handle token refresh; e2e suite updated first | §17 auth checklist incl. reload/restore paths | Revert frontend deploy |
| 14 | **Production env vars wrong/missing** (typos, forgot `sslmode`, LS namespace) | High | Total API outage with green health check | Change one var at a time; render.yaml review; checklist-driven deploy | §17 deployment checklist (health check is insufficient alone) | Revert env value |
| 15 | **Database rollback incomplete** (Render DB expired/deleted) | Critical | No way back | Dump on day 0; never pause/delete Render DB during window; free-tier expiry calendar | Restore-at-will drill in staging | n/a — prevention is the plan |
| 16 | **Duplicate accounts** (Supabase user + legacy row for same person) | Medium | Split entitlement/data; support nightmare | Unique `auth_user_id` + unique emails on both sides; lazy import keyed on authenticated legacy login | `auth_user_id` uniqueness check; duplicate-email probe | Merge manually via SQL or re-link; prevention is the plan |

---

## 17. FILE CHANGE MAP

### A. DEFINITELY NEEDS CHANGES

| File | Why |
|---|---|
| [render.yaml](render.yaml) | `DATABASE_URL` source: `fromDatabase:` → `sync: false` Supabase value; eventually remove `databases:` block; eventually remove `JWT_SECRET` |
| [backend/.env.example](backend/.env.example) | New DATABASE_URL guidance (Supabase session pooler, `sslmode=require`), later Supabase verification var docs; remove JWT docs in cleanup phase |
| [backend/prisma/schema.prisma](backend/prisma/schema.prisma) | **Auth phase only**: add `auth_user_id String? @unique` on `User`; (optional, later) drop orphaned Stripe columns |
| [backend/prisma/migrations/](backend/prisma/migrations) | New migrations only (auth_user_id; optional column drops). **Existing 12 migrations: untouched.** |
| [backend/src/routes/auth.ts](backend/src/routes/auth.ts) | Supabase token verification; `auth_user_id` resolution; bootstrap endpoint for new signups; legacy scrypt path during transition, removed in Phase 4 |
| [frontend/src/context/AuthContext.tsx](frontend/src/context/AuthContext.tsx) | supabase-js session ownership; same external surface |
| [frontend/src/lib/api.ts](frontend/src/lib/api.ts) | Token source for Bearer headers; signup/login functions → Supabase flows |
| [frontend/src/lib/authFlow.ts](frontend/src/lib/authFlow.ts) | Validation thresholds/error mapping for Supabase |
| [frontend/src/pages/auth/AuthScreen.tsx](frontend/src/pages/auth/AuthScreen.tsx) (+ [LoginPage](frontend/src/pages/auth/LoginPage.tsx)/[SignupPage](frontend/src/pages/auth/SignupPage.tsx)) | Submit through new auth calls; error states |
| [frontend/src/pages/auth/usePostAuthRedirect.ts](frontend/src/pages/auth/usePostAuthRedirect.ts) | Key redirect on new session signal |
| [frontend/.env.example](frontend/.env.example), [frontend/.env.production](frontend/.env.production), vercel env | Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (auth phase) |
| Tests: [frontend/e2e/auth.spec.ts](frontend/e2e/auth.spec.ts) + `mockApi.ts`; the 8 unit-test files seeding `achivii_auth_token` (§9) | Fixtures move to the new session mechanism |
| New: frontend Supabase client module; backend JWKS/secret verification helper | Required by the above |

### B. MAY NEED CHANGES

| File | Why it might |
|---|---|
| [backend/src/index.ts](backend/src/index.ts) | Only if auth middleware/CORS adjustments are needed (likely minimal — CORS already covers prod + previews) |
| [backend/src/routes/goal.ts](backend/src/routes/goal.ts) | **Should stay identical** if `getAuthUser` contract holds; listed here because it's the largest auth-consuming surface — verify, don't rewrite |
| [backend/src/routes/billing.ts](backend/src/routes/billing.ts) | Same contract argument — verify only |
| [frontend/src/components/ProtectedRoute.tsx](frontend/src/components/ProtectedRoute.tsx) | Loading semantics with async refresh; likely small |
| [frontend/src/context/GoalContext.tsx](frontend/src/context/GoalContext.tsx) | Token provenance / effect triggers |
| [frontend/src/components/app/AppShell.tsx](frontend/src/components/app/AppShell.tsx), [AccountMenu.tsx](frontend/src/components/app/AccountMenu.tsx) | Token/user provenance; logout call |
| [frontend/src/components/billing/CustomGoalGate.tsx](frontend/src/components/billing/CustomGoalGate.tsx), [frontend/src/pages/CheckoutReturnPage.tsx](frontend/src/pages/CheckoutReturnPage.tsx) | Token provenance only — behavior must not change |
| [frontend/src/pages/OnboardingPage.tsx](frontend/src/pages/OnboardingPage.tsx), [Home.tsx](frontend/src/pages/Home.tsx), today components using `useAuth()` | Mechanical token provenance updates |
| [frontend/vite.config.ts](frontend/vite.config.ts), [vercel.json](vercel.json), [frontend/vercel.json](frontend/vercel.json) | Only if Supabase env vars need build-time injection alongside existing ones |
| [backend/package.json](backend/package.json) | New dependency(s): Supabase admin client or a JWT/JWKS library (`jose`), frontend `@supabase/supabase-js` in [frontend/package.json](frontend/package.json) |
| [docs/*](docs) | Update auth/billing identity docs to record the migration contract |

### C. SHOULD NOT CHANGE

| File | Why |
|---|---|
| [backend/src/routes/webhook.ts](backend/src/routes/webhook.ts) | LS webhook contract: signature → idempotency → `custom_data.user_id` → upsert. Depends only on `users.id` stability |
| [backend/src/lib/billing/entitlement.ts](backend/src/lib/billing/entitlement.ts), [lemonSqueezyState.ts](backend/src/lib/billing/lemonSqueezyState.ts), [lemonSqueezyCheckout.ts](backend/src/lib/billing/lemonSqueezyCheckout.ts), [lemonSqueezyReconciliation.ts](backend/src/lib/billing/lemonSqueezyReconciliation.ts), [accountState.ts](backend/src/lib/billing/accountState.ts), [webhookEvents.ts](backend/src/lib/billing/webhookEvents.ts), [webhookIdentity.ts](backend/src/lib/billing/webhookIdentity.ts), [webhookSignature.ts](backend/src/lib/billing/webhookSignature.ts), [goalAuthorization.ts](backend/src/lib/billing/goalAuthorization.ts) | Entire billing domain is `users.id`-keyed and provider-facing; any change risks §8.4 hazards |
| [backend/src/config/billing.ts](backend/src/config/billing.ts) | LS env namespace logic — untouched |
| [backend/src/lib/cache/researchCache.ts](backend/src/lib/cache/researchCache.ts) | Raw pgvector SQL is portable and battle-tested; do not rewrite during the move |
| [backend/scripts/verify-pgvector.ts](backend/scripts/verify-pgvector.ts) | Reused as the migration gate, unchanged |
| [backend/src/routes/health.ts](backend/src/routes/health.ts) | Deliberately DB-free |
| Migrations `0_init` … `20260929173000` | Immutable history; replay as-is |
| All LS env vars, `CLIENT_ORIGIN`, `PORT`, `NODE_ENV`, AI keys | §11 KEEP list |
| `subscriptions`/`webhook_events` schema & indexes | Contract-critical (§8.3) |
| [frontend/src/lib/reviewDraft.ts](frontend/src/lib/reviewDraft.ts), draft-goal localStorage machinery, today/closing components' storage keys | Non-auth localStorage that the auth rework must not disturb |

---

## 18. VERIFICATION PLAN

### DATABASE
- [ ] Connection: API boots with Supabase `DATABASE_URL`; one successful query from each workspace; latency acceptable.
- [ ] Migrations: `prisma migrate deploy` idempotent second run; `_prisma_migrations` ledger lists all 12 (+ any new).
- [ ] Tables: all 8 present (`users, goals, roadmap_weeks, daily_tasks, weekly_reviews, subscriptions, webhook_events, research_cache`).
- [ ] Row counts: §13.4 query diff = zero on every table.
- [ ] Relationships: FK-orphan queries = 0 (§13.4); cascade still works (test goal→tasks delete in staging).
- [ ] Indexes: `pg_indexes` shows HNSW `research_cache_outcome_embedding_idx` (vector_cosine_ops) and GIN `research_cache_raw_inputs_idx` (jsonb_path_ops), plus all uniques (§3.3).
- [ ] pgvector: `npm run verify:pgvector` fully green against Supabase.
- [ ] Application queries: Tier-0, Tier-1, Tier-2 cache paths exercised (run `researchCache.test.ts` against Supabase); goal create/read round-trip; weekly-review upsert; webhook upsert inside `$transaction`.

### AUTH
- [ ] Signup: brand-new user via Supabase → internal `users` row created (`auth_user_id` set) → onboarding reachable.
- [ ] Login: **existing legacy user** logs in → lazy import happens → `auth_user_id` set → second login is pure Supabase.
- [ ] Logout: sign-out clears session; protected route redirects to `/login?next=`.
- [ ] Session restoration: reload each protected page with an active session → no logout flash; refresh-token rotation survives >1 h.
- [ ] Protected routes: `/roadmap`, `/progress`, `/achievement`, today flows all resolve the correct internal user.
- [ ] Current user: `/api/auth/me` (or replacement) returns `{ id, email, timezone, created_at }` with **legacy** `users.id`.
- [ ] Existing-user migration: for a Pro user and a free user, goals/subscriptions visible unchanged after login.
- [ ] Password behavior: wrong password rejected; ≥6-char policy (or new Supabase policy — decision recorded); no duplicate accounts created on repeat logins.

### BILLING
- [ ] Checkout: monthly and yearly test-mode purchase completes; `redirect_url` lands on `/billing/return?checkout=success`.
- [ ] Subscription lookup: `/api/billing/account` returns correct state + `manageUrl`.
- [ ] Entitlement: `/api/billing/entitlement` flips to `pro` only after webhook processes (return page shows pending first).
- [ ] Webhook delivery: event lands in `webhook_events` with `status=PROCESSED`; `subscriptions` row upserted for the right `users.id`.
- [ ] Signature verification: tampered body/missing header → 400, nothing persisted.
- [ ] Duplicate webhook: replay identical payload → `{duplicate:true}`; no second subscription mutation.
- [ ] Existing Pro user: entitlement, period end, and manage-URL all correct after both migrations.
- [ ] Cancellation: cancel in LS portal → `subscription_cancelled` → `CANCELLED_ENDING` → access until `currentPeriodEnd` → then `EXPIRED`/not entitled.
- [ ] Renewal: `subscription_payment_success`/`updated` extends `currentPeriodEnd`.

### APPLICATION
- [ ] Goal creation: preset pathway (v2) and custom goal (Pro-gated) both generate; SSE progress streams.
- [ ] Goal loading: `/api/goal/active` returns weeks + week-1 tasks; completed-goal fallback works.
- [ ] Daily tasks: complete/uncomplete, notes, slot time persist.
- [ ] Weekly review: score, next-week generation, milestone gate.
- [ ] Dashboard/journey/progress/achievement pages render for migrated data.
- [ ] All authenticated flows exercised with a **migrated legacy account**, not just a fresh one.

### DEPLOYMENT
- [ ] Vercel: prod deploy green; `VITE_*` values verified in bundle (API URL + Supabase keys).
- [ ] Render: deploy green; **manually verify DB-backed endpoints** (health check alone is not sufficient — §12).
- [ ] Supabase: extension enabled; pooler limits not approached; logs clean.
- [ ] CORS: prod domain + a `*.vercel.app` preview both call the API successfully.
- [ ] Environment variables: §11 table walked one-by-one in the dashboards (incl. LS namespace still `test`).
- [ ] Health check: `/api/health` 200 — **and** remember it proves nothing about the DB.
- [ ] Monitoring: 24–48 h watching `webhook_events.status`, API error logs, Supabase query stats.

---

## 19. UNKNOWN / NEEDS EXTERNAL VERIFICATION

1. **Render DB plan & expiry status** — render.yaml says `plan: free`; free Render Postgres is deleted ~30 days after creation. Confirm the actual plan in the Render dashboard and the instance's creation date. If free and old: **backup immediately**; this may force the migration timeline.
2. **Render egress IPv6 capability** — determines whether Supabase *direct* connection is reachable from the Render service (fallback: session pooler, which is always IPv4). Test with a one-liner from the service environment.
3. **Supabase project parameters** — project ref, region (closest to oregon/us-east), plan (pooler limits, IPv4 add-on availability), database password, and installed pgvector version. All account-side.
4. **Supabase JWT signing configuration** — asymmetric (JWKS) vs legacy HS256 shared secret; determines the backend verification approach and which secret/URL to add. Check Authentication → JWT Keys in the dashboard.
5. **Supabase Admin API "create user with known password" semantics** — needed for lazy import (§14.1 Option A); confirm current `hashed_password`/`password` field behavior on the target project.
6. **Production data volumes** — row counts per table (drives dump/restore timing and freeze length).
7. **Actual LS dashboard state** — whether the test-mode webhook is configured and its URL/secret; whether any real (test-mode) subscriptions/users exist; live-mode onboarding status.
8. **Whether `DATABASE_URL` in the Render dashboard matches the Blueprint** — i.e., no manual override shadowing `fromDatabase`.
9. **Custom frontend domain** — any non-`*.vercel.app` production origin must be added to `CLIENT_ORIGIN`.
10. **Render dashboard plan for the web service** — render.yaml says free (single instance, sleep-on-idle); confirm, since sleep affects webhook latency and pooler connection churn.
11. **User count with non-null `password_hash` anomalies** — e.g., test fixtures or manually created rows whose emails might collide on import; requires a production query.
12. **Supabase Auth email-confirmation policy decision** — product decision (Achivii never verified emails; enabling changes signup UX).

---

## 20. FINAL RECOMMENDATION

1. **Proceed with the database migration first, auth second.** The DB move is configuration + data copy with a proven-compatible stack (Prisma + vanilla Postgres + pgvector, which Supabase supports natively); auth is the delicate part and benefits from the DB already living in the same Supabase project.
2. **Default the runtime connection to the Supabase shared session pooler** (`…pooler.supabase.com:5432`, `sslmode=require`) pending the Render-IPv6 test; run migrations via direct/session, never the transaction pooler. Do not use transaction mode with this codebase's interactive transactions and prepared-statement usage.
3. **Preserve `users.id` as the immutable internal identity.** Add `users.auth_user_id` as the Supabase link. This single decision keeps goals, subscriptions, entitlements, and the Lemon Squeezy `custom_data.user_id` contract intact with zero data remapping.
4. **Migrate passwords by rolling import, not reset:** keep the scrypt login during a transition window, create the Supabase Auth user on first successful legacy login, and sweep stragglers. Supabase cannot import scrypt hashes — plan around it, don't discover it in production.
5. **Freeze the Lemon Squeezy code path entirely.** No file in `src/lib/billing/`, `webhook.ts`, `config/billing.ts`, or any LS env var changes. The only LS-adjacent actions are: verify webhook delivery post-cutover and optionally use the existing `BILLING_CHECKOUT_ENABLED` kill switch during the DB cutover window.
6. **Fix the schema-drift situation explicitly** (recommend: replay history as-is on Supabase; clean up the orphaned Stripe columns in a later, separate migration).
7. **Back up today** — the free-plan expiry question (§19.1) makes the dump urgent independent of everything else in this document.

---

## WHAT YOU NEED FROM ME BEFORE IMPLEMENTATION

1. **Render dashboard facts:** actual plan of `achivii-db` and its creation/expiry date; confirmation that `DATABASE_URL` is Blueprint-managed (or its dashboard value exists); web-service plan.
2. **A fresh production `pg_dump`** (or permission to take one) + current row counts per table.
3. **Supabase project details:** project ref, region, plan, database password (stored securely, never in chat), pgvector version, and the three connection strings (direct / session / transaction) from the Connect dialog.
4. **Supabase JWT signing configuration** (asymmetric JWKS vs HS256 secret) and which verification material you want on the Render service.
5. **Decision: connection mode** — approve session pooler (recommended) or authorize the IPv6 test for direct connection.
6. **Decision: schema drift** — approve "replay history + leave Stripe columns for later cleanup" (recommended) or choose baseline.
7. **Decision: email confirmation** — keep signups unverified (current behavior) or enable Supabase email confirmation at cutover.
8. **Decision: password policy** — keep 6-char minimum or adopt a stronger Supabase-enforced policy (affects `authFlow.ts` copy).
9. **Lemon Squeezy dashboard access confirmation** — ability to view/trigger the test-mode webhook and resend events during verification.
10. **Maintenance window approval** — a short (≤30 min) write freeze for the DB cutover, and whether to flip `BILLING_CHECKOUT_ENABLED=false` during it.
11. **Confirmation of production user reality** — approximate user count and whether any real (test-mode) Pro subscribers exist, so verification thresholds (§18) can be set sensibly.
