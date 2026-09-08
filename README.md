# Achivii — 3-Month Goal Execution Engine

Achivii is an intelligent goal execution platform designed to guide users through 90-day mastery goals using auto-generated time-blocked weekly schedules, adaptive non-blocking recovery, weekly reflections, continuous profile learning, and Google Gemini AI assistance.

---

## 🏗️ Architecture & Project Structure

The project is structured as a TypeScript monorepo with clean separation between the frontend interface and backend API:

```
AchiviiWeb/
├── frontend/                 # React 19 + Vite + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── components/       # Accessible UI components (Recovery, Reflection, Graduation, Roadmaps)
│   │   ├── context/          # Auth & application state providers
│   │   ├── pages/            # View routes (Home, Onboarding, Dashboard, Profile, GoalDetails)
│   │   ├── lib/              # API client and timezone utilities
│   │   └── types/            # TypeScript schemas and shared interfaces
│   ├── .env.example          # Frontend environment variables template
│   └── vite.config.ts
├── backend/                  # Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma     # Supabase PostgreSQL relational schema
│   │   └── seed.ts           # Preloaded 3-month goal catalogs and phase blueprints
│   ├── src/
│   │   ├── routes/           # REST endpoints (auth, goals, sessions, recovery, reflection, graduation, ai, notifications, analytics)
│   │   ├── lib/              # Core algorithmic engines:
│   │   │   ├── scheduler.ts      # Rolling window schedule materialization
│   │   │   ├── rescheduler.ts    # Missed session detection & silent reallocation
│   │   │   ├── recovery.ts       # Tier 2 recovery & circuit breaker logic
│   │   │   ├── reflection.ts     # Lazy weekly reflection engine
│   │   │   ├── graduation.ts     # Graduation milestone triggers & choice handling
│   │   │   ├── profile.ts        # Continuous profile aggregation (peak hours & lapse patterns)
│   │   │   ├── notifications.ts  # Notification scaffolding & frequency caps
│   │   │   ├── analytics.ts      # Section 2 product success criteria telemetry
│   │   │   ├── timezone.ts       # IANA timezone conversion helpers
│   │   │   └── ai/               # Gemini AI integration with deterministic fallback
│   │   └── index.ts          # Express API server entry point
│   ├── scripts/              # Migration backfill & database switching utilities
│   ├── test/                 # Comprehensive Vitest / Bun test suites (99+ unit tests)
│   └── .env.example          # Backend environment variables template
├── package.json              # Monorepo root workspace scripts
├── project_plan.md           # Master technical specification
└── README.md
```

---

## ⚙️ Prerequisites & Runtime Portability

Achivii runs smoothly in standard Node.js environments without requiring any proprietary runtimes:

- **Node.js**: `v18.0.0+` or `v20.0.0+`
- **npm**: `v9.0.0+`
- **Optional**: [Bun](https://bun.sh) (`v1.2+`) is also fully supported for ultra-fast script execution and test runs.

---

## 🚀 Quickstart Guide

### 1. Repository Setup

Clone the repository and install dependencies across the monorepo:

```bash
# Clone repository
git clone https://github.com/moahmed325/AchiviiWeb.git
cd AchiviiWeb

# Install all workspace dependencies
npm install
```

---

### 2. Backend Configuration & Database

```bash
cd backend

# Copy environment variables template
cp .env.example .env
```

Edit `backend/.env` to configure your environment variables:

```env
PORT=5000
CLIENT_ORIGIN="http://localhost:5173"

# Supabase PostgreSQL connection string:
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?schema=public"

# Google Gemini API key (optional — falls back to deterministic algorithms if unset):
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-1.5-flash"
```

#### Database Synchronization:
- **Supabase PostgreSQL (Production / Staging)**:
  ```bash
  npm run db:push
  npm run db:seed
  ```
- **Zero-Config Local SQLite Mode**:
  ```bash
  npm run use:sqlite
  npm run db:push
  npm run db:seed
  ```
  *(To switch back to PostgreSQL at any time: `npm run use:postgres`)*

---

### 3. Frontend Configuration

```bash
cd ../frontend

# Copy environment variables template
cp .env.example .env
```

Ensure `VITE_API_BASE_URL="http://localhost:5000"` is set in `frontend/.env`.

---

### 4. Running the Development Servers

From the root of the project:

```bash
# Run both backend and frontend concurrently (or run separately):
npm run dev:backend   # Starts Express API at http://localhost:5000 (via tsx watch)
npm run dev:frontend  # Starts React Vite client at http://localhost:5173
```

*(Bun alternative: `npm run dev:bun` in `backend`)*

---

## 🧪 Running Tests & Production Builds

### Run Unit & Integration Tests (100% Test Passing)

Achivii comes with a comprehensive suite of 99 unit tests covering schedulers, timezones, recovery mechanics, weekly reflections, Gemini AI boundaries, graduation lifecycles, frequency caps, and product analytics:

```bash
# Using Node.js (Vitest)
npm test --workspace=backend

# Using Bun (optional)
cd backend && bun test
```

### Build for Production

```bash
# Build both frontend and backend bundles
npm run build
```

---

## 🌟 Core System Features

### 1. Adaptive Scheduling & Rolling Materialization
- Monotonic sequence ordering (`sequence_order`) and relative day numbers (`day_number`) safeguard schedules against timezone shifts and DST transitions.
- Dynamically classifies sessions into **Core** (non-negotiable practice), **Buffer** (spillover catch-up), and **Reflect** (weekly review).

### 2. Real Recovery UX (§7 & Phase 2)
- **Tier 1 Silent Recovery**: 1–2 missed sessions are automatically reallocated into open weekly buffer slots without user guilt or interruption.
- **Tier 2 Non-Blocking Check-In**: At 3+ consecutive missed days or exhausted slots, a non-blocking banner gives the user full control:
  - *Shrink Week*: Drops non-essential buffer sessions while protecting core progress and keeping target end-dates intact.
  - *Shift Timeline*: Rolls the entire plan forward by 7 days via an $O(1)$ `current_plan_day_offset` increment.
- **Pacing Circuit Breaker**: Activates on the 3rd recovery adjustment within 28 rolling days to offer structured goal-scope reduction or a penalty-free pause.

### 3. Weekly Reflection (§9 & Phase 3)
- Evaluated lazily on app wake using user IANA timezones.
- High completion rates ($\ge 70\%$) receive a frictionless **single-tap confirmation**.
- Sub-threshold completion rates trigger a thoughtful 4-question retro to optimize upcoming routines.
- Recovery precedence: Tier 2 recovery check-ins take precedence to avoid overwhelming users.

### 4. Google Gemini AI Assistance (§13 & Phase 4)
- Uses `@google/genai` targeting `gemini-1.5-flash` / `gemini-2.0-flash` on the free tier.
- Strict role boundaries: Planner generates structured roadmap variants (`responseMimeType: "application/json"`) with strict validation.
- Zero-cost deterministic fallbacks ensure 100% platform availability even without an API key or under rate limits.

### 5. Graduation & Continuous Profile Learning (§4.9, §4.10 & Phase 5)
- Milestone triggers at $\le 15$ remaining days or $\ge 75$ elapsed days.
- User choices: *Start New Goal*, *Enter Maintenance Mode*, or *Pause Goal*.
- Profile aggregation learns peak completion hours and lapse patterns to auto-tune future goal onboarding.

### 6. Notifications & Frequency Caps (§11 & Phase 6)
- Scaffolding for daily reminders, recovery nudges, weekly reflections, and graduation milestones.
- Strictly enforced frequency limits (e.g. max 1 recovery nudge per 48 hours) to prevent alert fatigue.

### 7. Product Success Analytics (§2 & Phase 6)
- Built-in metrics computation targeting core Section 2 targets:
  - **Day-90 Engagement Rate**: Users active on day 90+ of their active goal.
  - **3+ Day Lapse Recovery Rate**: Users who successfully log sessions within 7 days after entering a Tier 2 recovery state.
  - **Graduation Re-enrollment Rate**: Graduated users who start a new goal or maintenance plan within 14 days.

---

## 🔒 Security & Deployment

- **Supabase PostgreSQL**: Configured with relational cascades and additive schema migrations.
- **CORS Protection**: Scoped to designated client origins with configurable environment parameters.
- **Zero Naive UTC Splitting**: Date calculations utilize IANA timezone strings (`Intl.DateTimeFormat`) to prevent international date line discrepancies.
