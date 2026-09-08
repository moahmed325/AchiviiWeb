# Achivii — 3-Month Goal Execution Engine (Phase 0 Scaffold)

Achivii is a web application designed to help ambitious individuals accomplish 3-month goals using an auto-generated, adaptive time-blocked weekly schedule with automated missed-session rescheduling.

---

## 🏗️ Architecture & Project Structure

The project is scaffolded as two clean, independent services within subdirectories:

```
AchiviiWeb/
├── frontend/             # React 19 + Vite + TypeScript + Tailwind CSS v4
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route page views (Home page placeholder)
│   │   ├── lib/          # API services & client helpers
│   │   ├── App.tsx       # React Router configuration
│   │   └── index.css     # Styling & Tailwind directives
│   ├── .env.example      # Environment variables template
│   └── vite.config.ts
├── backend/              # Node.js + Express + TypeScript + Prisma ORM
│   ├── prisma/
│   │   └── schema.prisma # Full relational PostgreSQL schema & enums
│   ├── src/
│   │   ├── routes/       # API routers (GET /api/health)
│   │   ├── lib/          # Singleton Prisma client instance
│   │   └── index.ts      # Express app entry point & CORS
│   └── .env.example      # Environment variables template
└── README.md
```

---

## ⚙️ Requirements & Prerequisites

- **Node.js**: `v18+` or `v20+`
- **npm** or **pnpm**
- **PostgreSQL**: A running PostgreSQL database instance (local PostgreSQL server, Docker container, or cloud DB such as Neon / Railway / Supabase).

---

## 🚀 Quickstart Guide

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit backend/.env to configure your DATABASE_URL
# DATABASE_URL="postgresql://user:password@localhost:5432/achivii_db?schema=public"

# Generate Prisma Client types
npm run prisma:generate

# Push schema to PostgreSQL database (when database is running)
npm run prisma:migrate -- --name init

# Start dev server
npm run dev
```

The Express API will start on **`http://localhost:5000`**.  
Health check endpoint: **`http://localhost:5000/api/health`**

---

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start Vite dev server
npm run dev
```

The React frontend will start on **`http://localhost:5173`**.  
Open **`http://localhost:5173`** in your browser to view the Phase 0 dashboard and verify live API health status.

---

## 📊 Database Schema Summary (`backend/prisma/schema.prisma`)

* **Enums**:
  * `DayOfWeek`: `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`
  * `GoalStatus`: `ACTIVE`, `COMPLETED`, `ABANDONED`
  * `SessionStatus`: `UPCOMING`, `DONE`, `MISSED`, `RESCHEDULED`

* **Models**:
  1. `User` — User accounts & credentials (`users`)
  2. `GoalCatalog` — Catalog of predefined goals (`goal_catalogs`)
  3. `Phase` — Sequential goal phases with `phase_order` (`phases`)
  4. `TaskTemplate` — Phase-level session blueprints (`task_templates`)
  5. `UserGoal` — Active/completed user goal instances with `slippage_days` (`user_goals`)
  6. `AvailabilitySlot` — Mon–Sat fixed busy blocks (`availability_slots`)
  7. `Session` — Generated scheduled session instances (`sessions`)

---

## 🧪 Verification & Health Check

* **Backend Test**: Run `curl http://localhost:5000/api/health` — should return:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-21T10:55:00.000Z",
    "service": "Achivii API"
  }
  ```
* **Frontend Test**: Open `http://localhost:5173`. The home page automatically calls `/api/health` and displays an "API OPERATIONAL" badge with timestamp.
