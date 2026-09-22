# Achivii — 90-Day Deliberate Practice & Goal Execution Engine

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38b2ac.svg)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.4-2d3748.svg)](https://www.prisma.io/)
[![Vitest](https://img.shields.io/badge/Vitest-5.0-729b1b.svg)](https://vitest.dev/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-f55036.svg)](https://groq.com/)
[![Tavily](https://img.shields.io/badge/Tavily-Live_Canon_Research-4f46e5.svg)](https://tavily.com/)

**Achivii** is an intelligent, full-stack deliberate practice platform engineered to transform open-ended human ambitions into concrete, high-velocity 90-day execution trajectories. 

Unlike conventional to-do apps that generate generic, ungrounded task lists, Achivii synthesizes battle-tested cognitive and behavioral science—**The 12-Week Year** (Moran & Lennington), **Deliberate Practice** (K. Anders Ericsson), **Implementation Intentions** (Peter Gollwitzer)—with **The Golden Rail Pipeline**: real-time live research via Tavily Search, trust-tier domain authority ranking, dual-tier vector caching, deterministic safety clamps, and blazing fast structured LLM inference via Groq and Google Gemini.

---

## 🏗️ Architecture & Monorepo Structure

Achivii is organized as a clean TypeScript monorepo with strict separation of concerns between the client interface and the backend execution engine:

```
AchiviiWeb/
├── frontend/                     # React 19 + Vite + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── components/           # Deliberate practice & interactive UI components:
│   │   │   ├── OnboardingWizard.tsx      # 2-way visual wizard with modal diagnostics & calendar slotting
│   │   │   ├── ExecutionDashboard.tsx    # Live 90-day command center, streak metrics & phase gates
│   │   │   ├── FocusSessionModal.tsx     # Fullscreen Zen focus chamber with Web Audio chimes & ambient audio
│   │   │   ├── FullDayVisualizer.tsx     # 24-hour circadian routine timeline & autonomous practice slotting
│   │   │   ├── DayRoutineTimeline.tsx    # Interactive daily drill schedule visualizer
│   │   │   ├── StepChallengeWidget.tsx   # Domain-tailored micro-drills (motor reps, recall, checklist)
│   │   │   ├── PathwaysExplorerModal.tsx # Catalog explorer for the 10 Certified Master Blueprints
│   │   │   ├── SaaSBuilderModal.tsx      # Interactive SaaS launch blueprint & asset generator
│   │   │   ├── AuthModal.tsx             # Frictionless login & signup dialog
│   │   │   ├── Navbar.tsx                # Dynamic top navigation with auth state & pathway shortcuts
│   │   │   └── ProtectedRoute.tsx        # Route authorization guard
│   │   ├── context/              # Auth & reactive goal application state providers
│   │   ├── pages/                # View routes:
│   │   │   ├── Home.tsx                  # High-conversion landing page & pathway showcase
│   │   │   ├── OnboardingPage.tsx        # Wizard host route for custom goals and preset blueprints
│   │   │   ├── DashboardPage.tsx         # Active goal execution command center
│   │   │   └── RoadmapPage.tsx           # 12-week periodized curriculum & milestone gate inspector
│   │   ├── lib/                  # Axios API client and IANA timezone utilities
│   │   ├── types/                # Strict TypeScript schemas and API contracts
│   │   └── index.css             # Tailwind CSS v4 design tokens and custom glassmorphism utilities
│   ├── .env.example              # Frontend environment configuration template
│   └── vite.config.ts
├── backend/                      # Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma         # Relational schema (User, Goal, RoadmapWeek, DailyTask, WeeklyReview, ResearchCache)
│   │   └── seed.ts               # Preloaded certified master pathways and test fixtures
│   ├── src/
│   │   ├── routes/               # REST API endpoints:
│   │   │   ├── auth.ts               # JWT registration, authentication & profile management
│   │   │   ├── goal.ts               # Clarification, Golden Rail plan generation, tasks, reviews & adaptation
│   │   │   └── health.ts             # Health check & database probe endpoint
│   │   ├── lib/                  # Core algorithmic engines:
│   │   │   ├── ai/
│   │   │   │   ├── groq.ts               # Groq primary inference engine (llama-3.3-70b-versatile, structured JSON)
│   │   │   │   ├── gemini.ts             # Google Gemini fallback engine (@google/genai, gemini-1.5-flash / 2.0-flash)
│   │   │   │   ├── goalDecomposer.ts     # Stage 1 clarification, Stage 5 plan generation & adaptation
│   │   │   │   └── presets/              # 10 Certified Master Blueprints (VDOT, CAGED, Lean Startup, etc.)
│   │   │   ├── cache/
│   │   │   │   └── researchCache.ts      # Stage 1.5 ResearchCache (Tier 1 exact match & Tier 2 vector cosine similarity)
│   │   │   ├── tavily.ts             # Tavily Search & Extract wrapper with trust-tier heuristics & safety filter
│   │   │   ├── timezone.ts           # IANA timezone conversion helpers (zero naive UTC splitting)
│   │   │   └── prisma.ts             # Prisma ORM client singleton
│   │   └── index.ts              # Express API server entry point
│   ├── scripts/                  # Diagnostic utilities (Tavily probe, pgvector verifier, cache demo)
│   ├── test/                     # 49 unit tests covering Tavily, timezone, decomposer, and vector cache
│   └── .env.example              # Backend environment configuration template
├── docs/                         # In-depth technical specifications:
│   └── CUSTOM_GOAL_EXECUTION_ARCHITECTURE.md
├── golden-rail-pipeline-spec.md  # Golden Rail live research specification
├── package.json                  # Root monorepo workspace scripts
└── README.md
```

---

## ⚙️ Prerequisites & Runtime Portability

Achivii runs cleanly across modern JavaScript runtimes without proprietary lock-in:

- **Node.js**: `v18.0.0+` or `v20.0.0+` (LTS recommended)
- **npm**: `v9.0.0+`
- **Optional**: [Bun](https://bun.sh) (`v1.2+`) is supported for ultra-fast local script execution and test runs.
- **Database**: **PostgreSQL with the `pgvector` extension**, in every environment including local development. The Golden Rail research cache matches goals using a `vector(768)` similarity search, which SQLite cannot represent — so there is no SQLite mode. [Supabase](https://supabase.com) is recommended, as pgvector ships ready to enable on the free tier.

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

# --- Database: PostgreSQL + pgvector (required in all environments) ---
# Use Supabase's SESSION POOLER string, not "Direct connection" — the direct host
# (db.[project-ref].supabase.co) is IPv6-only and unreachable from IPv4-only networks.
DATABASE_URL="postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres"

# --- Primary LLM Engine: Groq (Recommended for lightning-fast structured generation) ---
GROQ_API_KEY="gsk_..."
GROQ_MODEL="llama-3.3-70b-versatile"

# --- Live Canon Research: Tavily Search (Free tier: 1,000 queries/month) ---
TAVILY_API_KEY="tvly-..."

# --- Fallback LLM Engine: Google Gemini (Optional) ---
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-1.5-flash"
```

#### Database Synchronization:

```bash
# Applies the schema AND enables the pgvector extension.
# Use migrate deploy rather than db push — db push ignores the migrations folder,
# which would skip CREATE EXTENSION vector and leave cache matching broken.
npx prisma migrate deploy

# Confirms the extension, the vector(768) column and both indexes are live,
# and that the Tier 2 lookup actually hits the vector index.
npm run verify:pgvector

npm run db:seed
```

---

### 3. Frontend Configuration

```bash
cd ../frontend

# Copy frontend environment template
cp .env.example .env
```

Ensure `VITE_API_BASE_URL` points to your backend:

```env
VITE_API_BASE_URL="http://localhost:5000"
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
| `GROQ_API_KEY` | Backend | Recommended | Fast structured JSON output via `llama-3.3-70b-versatile`. |
| `GROQ_MODEL` | Backend | Optional | Target Groq model (defaults to `llama-3.3-70b-versatile`). |
| `TAVILY_API_KEY` | Backend | Recommended | Live web research engine for custom goal verification and canon synthesis. |
| `GEMINI_API_KEY` | Backend | Optional | Secondary fallback provider via `@google/genai`. |
| `GEMINI_MODEL` | Backend | Optional | Target Gemini model (defaults to `gemini-1.5-flash`). |
| `VITE_API_BASE_URL` | Frontend | **Yes** | Base URL for backend API requests (e.g. `http://localhost:5000`). |

---

## 🌟 The Golden Rail Custom Goal Pipeline

Most AI goal platforms fail because they generate ungrounded, hallucinated routines from static model memory. Achivii's **Golden Rail Pipeline** subjects every custom goal to live, empirical canon research before writing a single task:

```
[ Raw User Goal ] ──> ( Stage 1: Clarification & CanonicalKey )
                                │
                                v
               [ Stage 1.5: ResearchCache Resolution ]
                ├── Tier 1: Exact canonicalKey match? ────> ( Hit: Fast-forward to Stage 4 )
                └── Tier 2: 768-dim Cosine Sim >= 0.88? ──> ( Hit: Alias Discovery & Fast-forward )
                                │
                                v (Miss)
               [ Stage 2: Multi-Angle Tavily Live Search ]
                ├── 2-3 Distinct queries executed in parallel
                ├── Trust-tier ranking: HIGH / MEDIUM / LOW (deterministic heuristics)
                └── Safety blacklist filter (crash diets, extreme risks)
                                │
                                v
               [ Stage 3: Velocity Table Derivation ]
                └── Extracts concrete Week 1 -> Week 12 metric progression
                                │
                                v
               [ Stage 4: Deterministic Safety Clamps (TypeScript) ]
                ├── Running volume: Max 10% week-over-week ramp
                ├── Caloric deficit: Clamped to 250 - 600 kcal/day
                └── Resistance training: Zero 0-RIR / 100% 1RM in Weeks 1-3
                                │
                                v
               [ Stage 5: Grounded 12-Week Roadmap Generation ]
                ├── 3 evidence layers: Physiological, Cognitive, Adherence
                ├── Implementation intentions + modality-specific micro-drills
                └── Zero URL hallucinations: resourceUrl ONLY from verified Tavily sources
                                │
                                v
               [ Stage 6 & 7: Confidence Badging & Cache Write ]
                ├── Badges: "🛡️ Anchored to: {Method}" or "⚡ First-Principles"
                └── Persists findings into ResearchCache for instant future reuse
```

### Honest Fallback Protection
If both Groq and Gemini fail during custom goal generation, Achivii does **not** fabricate a broken or degraded plan. Instead, the pipeline returns an explicit, honest HTTP 503 failure state with retry guidance, maintaining system integrity.

---

## 🏆 The 10 Certified Master Pathways

For popular mastery pursuits, Achivii provides 10 pre-engineered, evidence-backed master blueprints. These pathways bypass external search and load instantly with zero prompt drift:

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

1. **24-Hour Autonomous Circadian Slotting (`FullDayVisualizer`)**:
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

Achivii features an automated Vitest test suite with **100% pass rate across 49 unit tests**, validating all core engines:

```bash
# Run full backend test suite via Vitest
npm test --workspace=backend

# Run with Bun (optional)
cd backend && bun test
```

### Diagnostic Scripts:
```bash
# Test Tavily Search API, extraction & trust-tier heuristics
npm run test:tavily --workspace=backend

# Test Groq LLaMA 3.3 70B structured JSON output
npm run test:groq --workspace=backend

# Demo Phase 2 ResearchCache resolution (Tier 1 & Tier 2 vector matching)
npm run demo:cache --workspace=backend
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
