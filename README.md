# Achivii — 90-Day Deliberate Practice & Goal Execution Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38b2ac.svg)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2d3748.svg)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-729b1b.svg)](https://vitest.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-3.5_Flash_Lite-4285f4.svg)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-Fallback-f55036.svg)](https://groq.com/)

**Achivii** is an intelligent, full-stack deliberate practice platform engineered to transform open-ended human ambitions into concrete, high-velocity 90-day execution trajectories. 

Unlike conventional to-do apps that generate generic, ungrounded task lists, Achivii synthesizes battle-tested cognitive and behavioral science—**The 12-Week Year** (Moran & Lennington), **Deliberate Practice** (K. Anders Ericsson), **Implementation Intentions** (Peter Gollwitzer)—with an adaptive plan engine: 10 certified pathways with fixed methods, a 12-week roadmap with a measurable target and test for every week, plans written one week at a time from your weekly results, deterministic safety clamps, and structured LLM inference via Google Gemini, with Groq as the fallback.

---

## 🏗️ Architecture & Monorepo Structure

Achivii is organized as a clean TypeScript monorepo with strict separation of concerns between the client interface and the backend execution engine:

```
AchiviiWeb/
├── frontend/                     # React 19 + Vite + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                       # Shared primitives (Button, Field, Dialog, Surface, Tabs, ...)
│   │   │   ├── app/                      # App shell: desktop rail, mobile bottom bar, account menu
│   │   │   ├── onboarding/               # Onboarding steps: goal, questions, schedule, review, generation
│   │   │   ├── today/                    # Today screen
│   │   │   ├── focus/                    # Focus session runner and timer
│   │   │   ├── journey/                  # 12-week roadmap (desktop staircase, mobile vertical journey)
│   │   │   ├── review/                   # Weekly review and adaptation
│   │   │   ├── progress/                 # Progress page cards
│   │   │   ├── achievement/              # 90-day achievement screen
│   │   │   ├── pathways/                 # Certified pathway library and launch
│   │   │   ├── billing/ coach/ marketing/
│   │   │   ├── FocusSessionModal.tsx     # Fullscreen focus session
│   │   │   ├── StepChallengeWidget.tsx   # Domain-tailored micro-drills (motor reps, recall, checklist)
│   │   │   └── ProtectedRoute.tsx        # Route authorization guard
│   │   ├── context/              # AuthContext (Supabase session) and GoalContext (active goal)
│   │   ├── pages/                # Home, Dashboard, OnboardingPage, RoadmapPage, ProgressPage,
│   │   │                         # AchievementPage, auth/ (login, signup), dev/ (/__ui preview)
│   │   ├── lib/                  # API client, Supabase client, presets catalogue, date utilities
│   │   ├── types/                # TypeScript API contracts
│   │   └── index.css             # Tailwind CSS v4 design tokens (@theme)
│   ├── e2e/                      # Playwright tests (mocked API; e2e/live hits a real backend)
│   ├── .env.example              # Frontend environment configuration template
│   └── vite.config.ts
├── backend/                      # Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma         # User, Subscription, WebhookEvent, Goal, RoadmapWeek, DailyTask, WeeklyReview,
│   │   │                         # ResearchCache (kept in the schema; no code uses it any more)
│   │   └── migrations/           # Includes CREATE EXTENSION vector and the research_cache indexes
│   ├── src/
│   │   ├── routes/               # REST API endpoints:
│   │   │   ├── auth.ts               # Supabase token verification and user profile
│   │   │   ├── goal.ts               # Clarification, plan generation, tasks, weekly reviews, completion
│   │   │   ├── billing.ts            # Lemon Squeezy checkout and entitlement
│   │   │   ├── webhook.ts            # Lemon Squeezy webhooks (raw body, signature checked)
│   │   │   └── health.ts             # Health check & database probe endpoint
│   │   ├── lib/
│   │   │   ├── ai/
│   │   │   │   ├── gemini.ts             # LLM cascade: Gemini primary, then Groq
│   │   │   │   ├── groq.ts               # Groq fallback (openai/gpt-oss-120b, then gpt-oss-20b)
│   │   │   │   ├── clarify.ts            # Goal clarification and follow-up questions
│   │   │   │   ├── roadmap.ts            # Plan v2: method, phases, and each week's target and test
│   │   │   │   ├── weekPlan.ts           # Plan v2: writes one week of daily tasks
│   │   │   │   ├── goalDecomposer.ts     # Shared plan types (DailyTaskPlan, DetailedStep); re-exports clarify
│   │   │   │   └── presets/              # 10 Certified Master Blueprints (VDOT, CAGED, Lean Startup, etc.)
│   │   │   ├── research/             # Unsafe-goal screen, stated targets, safety clamps, basis badge
│   │   │   ├── planV2.ts             # Writes the next week after each weekly review
│   │   │   ├── billing/              # Entitlement, checkout, webhook handling
│   │   │   ├── timezone.ts           # IANA timezone conversion helpers (zero naive UTC splitting)
│   │   │   └── prisma.ts             # Prisma ORM client singleton
│   │   └── index.ts              # Express API server entry point
│   ├── scripts/                  # Diagnostics (LLM ping, Groq probe, plan v2 live run)
│   ├── test/                     # Vitest unit tests for the plan engine, safety and scheduling
│   └── .env.example              # Backend environment configuration template
├── docs/                         # Project documentation (start at docs/README.md):
│   ├── product/                  # Product blueprint and visual design system
│   ├── architecture/             # How the systems work (custom-goal engine, plan v2)
│   ├── features/                 # One folder per feature: problem, solution, feature, phases, prompts
│   ├── templates/                # Blank templates, numbered like a feature folder
│   ├── archive/                  # Finished or replaced work
│   └── decisions.md              # The single decision log
├── Design.md                     # Design source of truth for agents
├── CLAUDE.md                     # Guidance for Claude Code
├── package.json                  # Root monorepo workspace scripts
└── README.md
```

---

## ⚙️ Prerequisites & Runtime Portability

Achivii runs cleanly across modern JavaScript runtimes without proprietary lock-in:

- **Node.js**: `v18.0.0+` or `v20.0.0+` (LTS recommended)
- **npm**: `v9.0.0+`
- **Optional**: [Bun](https://bun.sh) (`v1.2+`) is supported for ultra-fast local script execution and test runs.
- **Database**: **PostgreSQL**, in every environment including local development; there is no SQLite mode. The database must allow the `pgvector` extension, because the migrations create it for the `research_cache` table (no code uses that table any more, but it stays in the schema). [Supabase](https://supabase.com) is recommended, as pgvector ships ready to enable on the free tier.

---

## 🚀 Quickstart Guide

### 1. Repository Setup

Clone the repository and install dependencies across the monorepo workspace:

```bash
# Clone the repository
git clone https://github.com/moahmed325/AchiviiWeb.git
cd AchiviiWeb

# Install all workspace dependencies
npm install
```

---

### 2. Backend Configuration & Database

```bash
cd backend

# Copy backend environment template
cp .env.example .env
```

Configure your `backend/.env` file:

```env
PORT=5000
CLIENT_ORIGIN="http://localhost:5173"

# --- Database: PostgreSQL with pgvector available (required in all environments) ---
# Use Supabase's SESSION POOLER string, not "Direct connection" — the direct host
# (db.[project-ref].supabase.co) is IPv6-only and unreachable from IPv4-only networks.
DATABASE_URL="postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

# --- Supabase Auth (backend verifies the user's access token) ---
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-supabase-anon-key"

# --- Primary LLM Engine: Google Gemini ---
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-3.5-flash-lite"

# --- Fallback LLM Engine: Groq (Optional) ---
GROQ_API_KEY="gsk_..."
GROQ_MODEL="openai/gpt-oss-120b"
GROQ_BACKUP_MODEL="openai/gpt-oss-20b"

# --- Billing: Lemon Squeezy (test mode by default; see backend/.env.example) ---
LEMON_SQUEEZY_ENVIRONMENT="test"
```

#### Database Synchronization:

```bash
# Applies the schema AND enables the pgvector extension.
# Use migrate deploy rather than db push — db push ignores the migrations folder,
# which would skip CREATE EXTENSION vector and the raw-SQL indexes.
npx prisma migrate deploy
```

---

### 3. Frontend Configuration

```bash
cd ../frontend

# Copy frontend environment template
cp .env.example .env
```

Ensure `VITE_API_BASE_URL` points to your backend and the Supabase values match your project:

```env
VITE_API_BASE_URL="http://localhost:5000"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

---

### 4. Running the Development Servers

From the **root** of the monorepo, launch the servers concurrently:

```bash
# Start backend API (http://localhost:5000)
npm run backend

# Start frontend client (http://localhost:5173) in a separate terminal
npm run frontend
```

*Tip: You can also run both commands directly from their respective directories (`npm run dev` in `backend` and `frontend`).*

---

## 🔑 Environment Variables Reference

| Variable | Scope | Required | Description |
| :--- | :--- | :---: | :--- |
| `PORT` | Backend | Optional | Port for the Express server (defaults to `5000`). |
| `CLIENT_ORIGIN` | Backend | Optional | CORS allowed origin (defaults to `http://localhost:5173`). |
| `DATABASE_URL` | Backend | **Yes** | PostgreSQL connection string. Must be a database with `pgvector` available. Use Supabase's session pooler URL. |
| `SUPABASE_URL` | Backend | **Yes** | Supabase project URL, used to verify access tokens. |
| `SUPABASE_ANON_KEY` | Backend | **Yes** | Supabase anon/publishable key. Never the service-role key. |
| `GEMINI_API_KEY` | Backend | Recommended | Primary LLM provider via `@google/genai`. Without Gemini or Groq, every new goal (certified pathway or custom) gets a 503 and nothing is saved. |
| `GEMINI_MODEL` | Backend | Optional | Target Gemini model (defaults to `gemini-3.5-flash-lite`). |
| `GROQ_API_KEY` | Backend | Optional | Fallback LLM provider when Gemini fails. |
| `GROQ_MODEL` | Backend | Optional | Groq fallback model (defaults to `openai/gpt-oss-120b`). |
| `GROQ_BACKUP_MODEL` | Backend | Optional | Second Groq model with its own daily budget (defaults to `openai/gpt-oss-20b`). || `LEMON_SQUEEZY_*` | Backend | For billing | Lemon Squeezy store, API key, webhook secret and variant IDs, with separate `TEST_` and `LIVE_` sets. See `backend/.env.example`. |
| `VITE_API_BASE_URL` | Frontend | **Yes** | Base URL for backend API requests (e.g. `http://localhost:5000`). |
| `VITE_SUPABASE_URL` | Frontend | **Yes** | Supabase project URL for the browser client. |
| `VITE_SUPABASE_ANON_KEY` | Frontend | **Yes** | Supabase anon key for the browser client. |

---

## 🌟 How a Goal Becomes a Plan

Every goal, certified or custom, goes through the same plan v2 flow (`backend/src/routes/goal.ts`). There is no live web research step: the plan is built from the user's answers, a chosen method and the week-by-week results they log.

```
[ Raw User Goal ] ──> ( 1. Clarify: outcome, domain, follow-up questions )
                                │
                                v
               [ 2. Preset match ]
                ├── Certified pathway? ──> its fixed method is used
                └── Custom goal ────────> needs Pro
                                │
                                v
               [ 3. Roadmap (one model call) ]
                ├── Unsafe goal text is refused before any call (422)
                ├── Method chosen for this person, rated on safety (< 3 is rejected)
                └── 12 weeks: phases, a measurable target and a test for every week;
                    a number named in the goal must be the week-12 target
                                │
                                v
               [ 4. One week at a time ]
                ├── Week 1 written now, checked and polished in code
                └── Each later week written after the user logs that week's test
                                │
                                v
               [ 5. Deterministic Safety Clamps (TypeScript) ]
                ├── Running volume: Max 10% week-over-week ramp
                ├── Caloric deficit: Clamped to 250 - 600 kcal/day
                └── Resistance training: Zero 0-RIR / 100% 1RM in Weeks 1-3
```

The safety clamps run on a goal's stored numbers whenever the goal is returned or used for planning, whatever the model produced.

### Honest Fallback Protection
If both Gemini and Groq fail while the roadmap or the first week is being written, a certified pathway falls back to its fixed, pre-written 12-week plan with no model call. A custom goal does **not** get a fabricated or degraded plan: the API returns an explicit, honest HTTP 503 with retry guidance.

---

## 🏆 The 10 Certified Master Pathways

For popular mastery pursuits, Achivii provides 10 pre-engineered, evidence-backed master blueprints. Each pathway fixes the method the roadmap uses, and its pre-written 12-week plan is the fallback when the AI providers are unavailable:

| # | Master Pathway | Canonical Methodology | Core Scientific Authority | Capstone Day 90 Metric |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **10K Running** | VDOT Periodization & 80/20 Polarized Training | Jack Daniels, PhD & Stephen Seiler, PhD | Sub-50 min 10K race or benchmark test |
| **2** | **Fingerstyle Guitar** | CAGED System, Metronome Pacing & Kinesthetic Chunking | Justin Sandercoe & David Leisner | Flawless 4-chord fingerstyle arrangement at tempo |
| **3** | **Micro-SaaS Launch** | Customer Discovery, Lean Canvas & Build-in-Public | Rob Walling, Eric Ries & Rob Fitzpatrick (*The Mom Test*) | Working Stripe checkout & first 5 paying users |
| **4** | **Conversational Spanish** | Comprehensible Input & Spaced Lexical Frequency | Stephen Krashen, PhD & FSI Language Scales | 15-minute unscripted conversation with native speaker |
| **5** | **Body Recomposition** | Hypertrophy Pyramid, RPE Loading & Energy Balance | Eric Helms, PhD, CSCS & Brad Schoenfeld, PhD | Measurable LBM increase & verified DEXA / caliper drop |
| **6** | **YouTube Channel** | Narrative Hook Pacing & Retention Curve Architecture | George Hillier & Paddy Galloway | 6 published long-form videos with >40% retention |
| **7** | **Non-Fiction Book** | Swain Scene/Sequel Architecture & Daily Output Lock | Dwight Swain & Stephen King | Complete 40,000-word first draft manuscript |
| **8** | **Deep Work & Output** | Attention Residue Auditing & Bi-Phasic Time Blocking | Cal Newport, PhD (*Deep Work*) | 4 hours of uninterrupted daily high-order output |
| **9** | **Chess 1200 Rating** | Woodpecker Tactical Re-seeding & Silman Imbalances | Hans Tikkanen, GM & Jeremy Silman, IM | Verified Chess.com / Lichess 1200+ rapid rating |
| **10** | **TED-Style Keynote** | 18-Minute Rule, Story Spine & Vocal Dynamics | Carmine Gallo (*Talk Like TED*) & Toastmasters Int. | Live 15-minute memorized presentation delivered |

---

## 🧘 Deliberate Practice & Execution Stack

Achivii bridges the gap between high-level ambition and daily execution through four integrated modules:

1. **24-Hour Autonomous Circadian Slotting (onboarding `StepSchedule` and `RoutineTimeline`)**:
   - Gathers your natural wake time, sleep window, and busy hours.
   - Automatically slots practice sessions into optimal cognitive windows (morning cortisol peak, midday recharge, or post-work transition) without manual calendar entry.
2. **Zen Focus Chamber (`FocusSessionModal`)**:
   - Fullscreen distraction-free timer with Web Audio API Tibetan singing bowl chimes.
   - Built-in ambient soundscapes (binaural alpha waves, rainfall, coffee shop white noise).
   - Step-by-step breakdown of micro-drills with individual countdown clocks.
3. **Domain-Tailored Micro-Drills (`StepChallengeWidget`)**:
   - Adapts to the activity modality: physical repetition clickers (guitar, fitness), active recall cards (languages), or verification checklists (software engineering, writing).
4. **Interactive 2-Way Onboarding Wizard (`OnboardingWizard`)**:
   - Dynamic 4-question diagnostic quiz tailored to baseline experience, equipment availability, and historical friction points.
   - Segmented progress indicator with back/forward history support.

---

## 🧪 Testing & Quality Assurance

Both workspaces use Vitest. The frontend also has Playwright browser tests:

```bash
# Run full backend test suite via Vitest (Prisma is mocked; no database needed)
npm test --workspace=backend

# Run with Bun (optional)
cd backend && bun test

# Frontend unit tests (Vitest + Testing Library)
npm test --workspace=frontend

# Frontend browser tests (Playwright, mocked API)
cd frontend && npx playwright test
```

### Diagnostic Scripts:
```bash
# Check that the primary LLM (Gemini) answers
npm run ping:llm --workspace=backend

# Test Groq structured JSON output (fallback provider)
npm run test:groq --workspace=backend
```

---

## 🔒 Security & Best Practices

- **Zero Naive UTC Splitting**: Date calculations utilize strict IANA timezone identifiers (`Intl.DateTimeFormat`) to prevent international date-line session drift.
- **Prisma Relational Safety**: Foreign keys feature cascading deletes across user goals, daily tasks, and weekly reviews.
- **Strict CORS Origin Isolation**: Backend API rejects requests originating outside configured client domains.
- **Deterministic Clamping**: Algorithmic safety clamps execute in deterministic TypeScript, preventing dangerous fitness or dietary routines regardless of model outputs.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
