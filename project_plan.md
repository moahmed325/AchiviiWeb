Achivii — Project Plan (v2)
This document is the single source of truth for Achivii. Every AI session and every human contributor should read this before writing code. Code follows documentation, not the other way around.

This is a revision of the original project plan. It incorporates a full audit against the current codebase (`AchiviiWeb`) and a formal fixes pass (Decision Log entries D1–D20). Where this version conflicts with anything built previously, this document wins — the codebase should be brought into alignment with it, not the reverse.

---
## 1. Project Overview

**What is being built?**
Achivii is a personal AI achievement coach. Users pick a goal from a curated catalog, and Achivii builds a personalized, adaptive 3-month (12-week) plan around their real routine — then coaches them daily, adapts the plan when life gets in the way, and helps them actually finish.

**Why does it exist?**
Most productivity and habit apps assume unlimited time, perfect discipline, and a stable routine. Real users don't have that. They fail not from lack of ambition but because their plan wasn't built for their actual life, and because missing a few days usually kills momentum entirely. Achivii's reason to exist is the belief that consistency is recovering quickly, not being perfect — and that no existing product is built around that idea.

**Who is it for?**
Busy, ambitious people with real constraints — demanding jobs, families, limited free time — who know what they want to achieve but struggle to build a realistic plan and stay consistent with it.

**What problem does it solve?**
It replaces a single rigid, idealized plan with a plan that (a) fits the user's actual routine from day one, (b) adapts automatically when the user's life changes, and (c) treats lapses as expected and recoverable rather than as failure.

---
## 2. Goals

### MVP Goals
- Let a user select a goal from a **fixed catalog of pre-scoped goals** (not free-text, not a two-level journey/outcome hierarchy — see Decision Log, 2026-09-08).
- Run a fast onboarding that captures the user's real weekly routine (Mon–Sat busy blocks; Sunday auto-free).
- Generate 2–3 differentiated roadmap options for the chosen goal and let the user choose one.
- Auto-generate a full 12-week time-blocked schedule from the chosen roadmap.
- Provide daily/weekly coaching views: a clear "what to do today/this week" experience.
- Implement the tiered recovery mechanism as a real, user-facing mechanism (1–2 missed days = silent shift; 3+ missed days = explicit check-in + replan choice).
- Implement a lapse circuit breaker for repeated relapse patterns.
- Implement adaptive weekly reflection (lightweight by default, full reflection only when signal indicates a rough week).
- Track task completion and behavioral signal (missed days, completion rate, slippage) per user.

### Long-Term Vision
Achivii becomes a Personal Achievement Operating System — a durable coach a user returns to for every major goal, not just one. Each completed 12-week journey should make the next one faster to set up and better personalized, via a continuously updated user profile.

### Success Criteria
- A meaningful share of users who start a plan reach the end still engaged (exact target TBD post-launch).
- Users who lapse (3+ missed days) re-engage via the recovery check-in at a materially higher rate than users of comparable apps re-engage after breaking a streak.
- A measurable share of users who complete or abandon a first goal start a second goal within the graduation window.

### Out of Scope (for MVP)
- Free-text/fully open-ended goal entry (fixed catalog only — see Section 3.1).
- The six-flagship-journey / outcome hierarchy from the original concept (explicitly dropped — see Decision Log).
- Social features (sharing, leaderboards, friends).
- Multiple concurrent active goals per user.
- Native wearable integrations (Apple Health, Fitbit, etc.).
- Team/coach-assigned plans (B2B) — consumer-only at launch.
- Monetization/subscription billing (tracked separately, not blocking MVP functionality).

---
## 3. Product Decisions (locked in)

| Decision | Choice |
|---|---|
| Goal source | Predefined catalog only (currently 6 goals; can grow), not free text, not a journey/outcome tree |
| Task breakdown | Pre-authored per catalog goal (phases + task templates), not generated live per user |
| Roadmap variation | An LLM (Planner) selects/adjusts structured numeric parameters (pace, session distribution, phase emphasis) that modulate the deterministic scheduler — the LLM never freehand-generates tasks or dates (see Section 13, and Decision Log D5/D10) |
| Concurrent goals | One active goal per user at a time (v1) |
| Availability input | User marks **busy** blocks Mon–Sat; rest is inferred free |
| Sunday | Not asked about — treated as free (capped to a reasonable default window) |
| Task/date storage | Relative (`day_number`, `sequence_order`) with a rolling offset, not absolute dates on unmaterialized future sessions (Decision Log D2) |
| Rescheduling engine (Tier 1 & 2) | Deterministic rules-based logic, NOT a live AI call |
| Custom replan (Tier 2c) & Weekly Review | LLM call, used sparingly per the cost-tiering table in Section 13 |
| Stack | JS/TS full-stack — React frontend, Node/Express backend, Prisma ORM |

---
## 4. Features

### 4.1 Goal Selection
**Purpose:** Give the user a fast, structured way to declare what they're trying to achieve, without the paralysis of a blank text field, and without a decision tree that adds friction the fixed-catalog model doesn't need.
**User benefit:** Removes the "what do I even ask for" barrier; ensures the AI is working with a goal type it has planning logic for.
**Requirements:** A curated catalog of pre-scoped goals (launch with the current 6; expandable later). Each catalog entry has a title, description, category, icon, and estimated weekly time commitment, authored by phases + task templates ahead of time (not generated live).
**Edge cases:** None of the original "Something Else" / cross-journey edge cases apply under this model — catalog browsing replaces them. If a desired goal isn't in the catalog, that's an explicit out-of-scope gap to surface honestly in the UI (e.g., a "request a goal" link), not something the system tries to route.
**Dependencies:** None (entry point of the app).

### 4.2 Fast Onboarding
**Purpose:** Capture just enough routine data to generate a credible first plan, without a long profiling survey.
**User benefit:** User sees a real plan almost immediately instead of abandoning during setup.
**Requirements:** Goal selection → confirm/adjust start date (defaults to today) → Mon–Sat busy-block input (grid or list-based time picker). Sunday is not asked about.
**Edge cases:** User has an irregular schedule — needs a "varies"/flexible option that defaults to a looser roadmap. User leaves a day fully blank — treat as fully busy that day, not fully free (safer default).
**Dependencies:** Goal Selection.

### 4.3 Roadmap Generation & Selection
**Purpose:** Present 2–3 distinct, honestly-described paths to the same goal instead of one prescribed plan.
**User benefit:** Creates ownership and commitment; lets the user self-select the approach that fits their life and working style.
**Requirements:** The Planner (LLM role, see Section 13) returns 2–3 structured roadmap variants per goal instance, each with a name, one-line description, explicit trade-offs, and machine-readable numeric parameters (e.g. `days_per_week`, `daily_minutes_variance`, `phase_emphasis`). These parameters modulate the existing deterministic scheduler — the Planner does not invent tasks or write dates directly. This keeps roadmap variety genuinely structural (Decision Log D5) while keeping scheduling deterministic, fast, and testable (Decision Log D4/D10).
**Edge cases:** All roadmap variants are infeasible given the user's stated available time — system surfaces a warning and routes directly into a scope/timeline adjustment flow (extend timeline or reduce commitment), not a dead end (Decision Log D18). Generated parameters must be validated in code against the user's stated constraints before being used to schedule anything (Decision Log D10) — on violation, reject and re-request from the Planner rather than silently clamping the user's plan.
**Dependencies:** Fast Onboarding, Goal Selection.

### 4.4 Schedule Generation
**Purpose:** Turn the chosen roadmap + user availability into an actual calendar of sessions.
**User benefit:** The user sees their full plan immediately, not week-by-week.
**Requirements:** Deterministic engine (no LLM call): compute free windows per day (full day minus busy blocks; Sunday = fixed default window) → for each week, for each active phase's task templates (adjusted by the chosen roadmap's parameters), place the required sessions into free windows, spreading them across the week and respecting `preferred_time_of_day` where set → persist as session records. Generate the full plan horizon upfront at onboarding completion.
**Requirements (storage):** Sessions are tagged with a `tier` (`core` / `buffer` / `reflect`) at generation time (Decision Log D1) and stored with a relative `day_number`/`sequence_order`, not a hardcoded calendar date, except for the currently-materialized rolling window (Decision Log D2).
**Edge cases:** A week doesn't have enough free time to fit all required sessions — flag it during generation and surface the same infeasibility flow as 4.3, rather than silently overloading days.
**Dependencies:** Roadmap Generation & Selection.

### 4.5 Daily / Weekly Coaching View
**Purpose:** Remove decision-making about what to work on.
**User benefit:** One clear action per day/week; no planning overhead for the user.
**Requirements:** "This Week" view showing scheduled sessions day by day, each with expected time commitment and completion state. Mark-done / edit-time / skip actions. Day-detail view for a focused single-day look.
**Edge cases:** No task scheduled today (rest day, or Sunday) — view says so explicitly, not appear broken. User completes a task early — pulling the next task forward is a post-MVP consideration; MVP keeps strictly sequential within the week.
**Dependencies:** Schedule Generation.

### 4.6 Adaptive Recovery
**Purpose:** Implement the "recovery, not perfection" philosophy as an actual, user-facing mechanism — not a silent background process the user never sees or chooses.
**User benefit:** Missing days doesn't feel like failure and doesn't require the user to manually fix their plan, but the user retains agency over how the fix happens.
**Requirements:**
- **Tier 1 (1–2 consecutive missed days):** Silent same-week reallocation — move the missed session(s) to the next available free window later in the current week. No message, no check-in.
- **Tier 2 (3+ consecutive missed days, or no free slots left this week):** A non-blocking, non-judgmental inline check-in (never a modal alert) with two explicit choices — "shrink this week" (drop `buffer`-tier sessions first, never compress `core`-tier sessions, never exceed the user's declared session-length cap) or "shift the whole timeline" (roll the remaining plan forward via the offset field from 4.4, not a bulk row rewrite). Whichever is chosen, the plan recalculates automatically and a `RecoveryEvent` is logged.
- **Tier 2c (repeated relapse — Lapse Circuit Breaker):** If 3+ `RecoveryEvent`s occur within a rolling 28-day window, replace the standard Tier 2 check-in with an explicit scope-reduction offer ("dial back this goal, or pause until next month") instead of repeating the same prompt indefinitely.
**Edge cases:** Offline completions (airplane mode, gym without signal) must reconcile against lapse flags before any check-in is served — a completion timestamped during the "missed" window retroactively clears the flag (Decision Log D8). Day-boundary evaluation must use the user's actual local timezone, evaluated lazily on app open/API request, not a global cron in server time (Decision Log D7).
**Dependencies:** Daily/Weekly Coaching View (source of completion/miss signal), Schedule Generation (tiering + offset storage).

### 4.7 Adaptive Weekly Reflection
**Purpose:** Capture qualitative signal only when it's actually needed, to avoid check-in fatigue.
**User benefit:** Minimal friction in normal weeks; real support in rough weeks.
**Requirements:** If weekly completion rate ≥ 70% (configurable threshold, not hardcoded), show a single tap: "Good week — same plan next week?" If below threshold, show a short 4-question reflection (what went well / what got in the way / difficulty / schedule change). Responses feed the Reviewer/Optimizer roles (Section 13) for the coming week.
**Edge cases:** First week of a goal (no baseline) defaults to the lightweight single-tap version. If a recovery check-in (4.6 Tier 2) and a weekly reflection would both fire in the same session, the recovery check-in takes priority and the reflection is deferred or folded into that week's copy rather than double-prompting.
**Dependencies:** Daily/Weekly Coaching View, Adaptive Recovery (shares the completion signal).

### 4.8 Progress View
**Purpose:** Give the user a clear read on where they stand.
**User benefit:** Answers "am I actually going to finish this" without digging.
**Requirements:** Overall completion %, current phase, days/weeks remaining vs. original estimate, current slippage in plain language, pace status (on track / behind / guardrail).
**Dependencies:** Schedule Generation, Adaptive Recovery.

### 4.9 Graduation Flow
**Purpose:** Proactively address the natural drop-off point at the end of a 12-week journey.
**User benefit:** User isn't left wondering what's next; the app converts a likely churn point into a decision point.
**Requirements:** Trigger relative to remaining plan length (not a fixed calendar day, since recovery events can push the real end date out), prompting three options: start a new goal (fast setup using existing profile), switch to maintenance mode, or pause.
**Edge cases:** Graduation only evaluates for `active` goals; on resume from a `paused` state, recompute the trigger point based on remaining days at resume time. If the user ignores the prompt, it reappears at the actual end date rather than being a one-time nag.
**Dependencies:** Adaptive Recovery (affects actual plan length), user profile/history.

### 4.10 Continuous Profile Learning
**Purpose:** Make each subsequent goal faster to set up and better personalized than the last.
**User benefit:** Reduces onboarding friction over time; plans get more accurate.
**Requirements:** Track inferred signal over time — best working hours (derived from completion timestamps), lapse pattern (streak-length distribution), which roadmap-parameter styles the user tends to complete. Feed this into onboarding defaults and Planner context for subsequent goals.
**Edge cases:** User's life circumstances change significantly between goals — profile defaults are presented as editable suggestions at the next onboarding, never silently applied without visibility.
**Dependencies:** All prior features (this is the aggregation layer) — meaningfully only testable once a user has been through at least one full recovery/reflection cycle.

---
## 5. User Flows

### 5.1 First-Time Onboarding & Plan Creation
1. User signs up/logs in.
2. User browses the goal catalog and picks a goal.
3. User confirms/adjusts start date.
4. User enters Mon–Sat busy blocks.
5. Backend (Planner) generates 2–3 roadmap variants; user picks one.
6. Backend generates the full session schedule from the chosen roadmap and routine.
7. User lands on the This Week view.

### 5.2 Daily/Weekly Use
1. User opens app → sees this week's sessions.
2. User completes a session and marks it done, or leaves it and the window passes.
3. App updates completion signal in the background.

### 5.3 Recovery Flow
1. User misses 1–2 consecutive days → silent same-week shift, no message.
2. User misses 3+ consecutive days (or no free slots remain this week) → on next app open, a non-blocking inline check-in appears: "Life happened. Want me to shrink this week's plan, or shift the whole timeline?"
3. User selects an option → plan recalculates → `RecoveryEvent` logged.
4. If this is the 3rd such event in a rolling 28 days → scope-reduction offer instead of the standard check-in.

### 5.4 Weekly Reflection Flow
1. At the end of each week, app evaluates completion rate.
2. If healthy: single-tap "Good week — same plan next week?"
3. If not: full 4-question reflection.
4. Responses feed the Reviewer/Optimizer, which may adjust the coming week.

### 5.5 Graduation Flow
1. Near the end of the plan (relative to remaining days), app surfaces a graduation prompt.
2. User chooses: start a new goal, enter maintenance mode, or pause.
3. If "new goal": user re-enters Goal Selection, with onboarding pre-filled from their existing profile and editable.

### 5.6 Account & Settings (baseline, not detailed at plan stage)
- Authentication (sign up / log in)
- Notification preferences
- Profile / data view
- Account deletion

(Full detail for these flows should be added before they're implemented — currently out of scope for this version of the plan.)

---
## 6. Technical Architecture

**Frontend:** React 19 + TypeScript, Vite build/dev server, React Router, Tailwind CSS v4.
**Backend:** Node.js/Bun runtime, Express, REST API.
**AI Layer:** LLM roles — Planner, Coach, Reviewer, Optimizer — implemented as a backend pipeline (prompted calls to the Anthropic API with role-specific context), not as separate user-facing agents. The user only ever experiences a single voice, "your coach." See Section 13 for role-to-trigger mapping and the cost-tiering model.
**Storage:** Relational database via Prisma ORM. SQLite for local dev, PostgreSQL for production (see Decision Log — this divergence must be resolved before deployment, not discovered at deploy time).
**Background/scheduling jobs:** Day-boundary evaluation happens lazily on app-wake/API request, keyed to the user's stored local timezone — not a global cron in server time (Decision Log D7). A queue-based system (BullMQ/Inngest/Temporal) is an explicit v2 optimization, not required for MVP scale.
**Notifications:** Push notification service for daily reminders and recovery/graduation check-ins. Because recovery and graduation both currently trigger "on next app open," notifications are a load-bearing MVP dependency, not a peripheral settings item — minimal notification scope must ship with MVP, with frequency capped to avoid nagging the target "busy" user.
**Authentication:** Custom email/password with JWT (current implementation) — acceptable for MVP; revisit only if a managed provider becomes worth the integration cost.

---
## 7. Tech Stack

| Category | Choice | Reasoning |
|---|---|---|
| Frontend framework | React 19 + TypeScript | Already implemented; modern, well-supported |
| Build tool | Vite 6 | Fast dev/build, already implemented |
| Routing | React Router 7 | Already implemented |
| Styling | Tailwind CSS v4 | Already implemented |
| Icons | Lucide React | Already implemented |
| Backend runtime | Node.js / Bun | Bun for fast local dev; must remain Node-portable (see Section 14 gap) |
| Backend framework | Express | Already implemented |
| ORM | Prisma | Already implemented |
| Database (dev) | SQLite | Zero-dependency local dev |
| Database (prod) | PostgreSQL | Must be finalized before any deployment — see Decision Log |
| Authentication | Custom JWT (HS256) + scrypt password hashing | Already implemented, no third-party lock-in |
| AI provider | Anthropic API (Claude) | Powers Planner/Coach/Reviewer/Optimizer roles |
| Testing | Vitest (to be added) | Zero coverage today — first priority, see Section 14 |
| Hosting | TBD | Frontend candidate: Vercel; backend+DB candidate: Render/Railway/Neon |
| CI/CD | TBD | — |
| Monitoring | TBD | — |
| Analytics | TBD (must support the three leading indicators defined in Section 2 Success Criteria) | — |

---
## 8. Project Structure

Reflects the current, already-scaffolded repository (`AchiviiWeb`). New work extends this structure; it is not being rebuilt from scratch.

```
AchiviiWeb/
├── .gitignore
├── README.md
├── project_plan.md              # this document
├── project_progress.md
├── package.json
│
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── test/                    # NEW — Vitest suite, does not exist yet
│   └── src/
│       ├── index.ts
│       ├── lib/
│       │   ├── prisma.ts
│       │   ├── scheduler.ts          # deterministic 12-week generator
│       │   ├── rescheduler.ts        # to be reworked per Section 4.6
│       │   ├── planner.ts            # NEW — LLM roadmap-variant generation
│       │   ├── coach.ts              # NEW — LLM presentation layer
│       │   ├── reviewer.ts           # NEW — weekly-signal LLM analysis
│       │   └── optimizer.ts          # NEW — custom-replan LLM logic (Tier 2c only)
│       └── routes/
│           ├── auth.ts
│           ├── catalog.ts
│           ├── health.ts
│           ├── onboarding.ts
│           ├── progress.ts
│           ├── sessions.ts
│           ├── roadmaps.ts           # NEW — roadmap generation/selection endpoints
│           ├── recovery.ts           # NEW — recovery check-in endpoints
│           └── reflection.ts         # NEW — weekly reflection endpoints
│
└── frontend/
    ├── .env.example
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── context/AuthContext.tsx
        ├── lib/api.ts
        ├── types/index.ts
        ├── components/
        │   ├── Navbar.tsx
        │   ├── AuthModal.tsx
        │   ├── GoalCard.tsx
        │   ├── GoalDetailDrawer.tsx
        │   ├── CalendarWeekView.tsx
        │   ├── DayDetailModal.tsx
        │   ├── SessionDetailModal.tsx
        │   ├── SlippageBanner.tsx
        │   ├── RoadmapSelector.tsx        # NEW
        │   ├── RecoveryCheckIn.tsx        # NEW — non-blocking inline card, per 4.6
        │   └── WeeklyReflection.tsx       # NEW
        └── pages/
            ├── Home.tsx
            ├── OnboardingPage.tsx         # extended with roadmap selection step
            ├── SchedulePage.tsx
            └── ProgressPage.tsx
```

---
## 9. Database Design

Reflects the current Prisma schema plus required additions. Fields marked **NEW** do not exist in the current implementation.

```
User
  id, email, password_hash, created_at
  timezone (IANA string)                          -- NEW, Decision Log D7
  -- aggregated profile fields, populated by 4.10:
  best_working_hours (JSON)                        -- NEW
  lapse_pattern_summary (JSON)                      -- NEW

GoalCatalog          -- admin-authored, shared across all users
  id, title, description, category, icon, est_weekly_hours

Phase                -- belongs to GoalCatalog
  id, goal_catalog_id, order, title, duration_weeks

TaskTemplate          -- belongs to Phase
  id, phase_id, title, sessions_per_week, session_duration_minutes,
  preferred_time_of_day (optional)

UserGoal              -- a user's instance of a catalog goal
  id, user_id, goal_catalog_id, start_date, target_end_date,
  status (active/paused/completed/abandoned), slippage_days (default 0)
  current_plan_day_offset (int, default 0)          -- NEW, Decision Log D2
  selected_roadmap_id                                -- NEW

Roadmap                -- Planner-generated variants for a UserGoal, pre-selection
  id, user_goal_id, name, description, trade_offs (text)
  days_per_week, daily_minutes_variance, phase_emphasis (JSON)  -- NEW table, Decision Log D5

AvailabilitySlot       -- user's fixed busy blocks
  id, user_id, day_of_week (Mon–Sat), start_time, end_time, label (optional)

Session                -- generated instances of TaskTemplates for a user
  id, user_goal_id, task_template_id,
  day_number, sequence_order                        -- NEW, replaces reliance on absolute dates, Decision Log D2
  scheduled_date, start_time, end_time               -- materialized only for the current rolling window
  status (upcoming/done/missed/rescheduled)
  tier (core/buffer/reflect)                         -- NEW, Decision Log D1
  completed_at_utc, idempotency_token                -- NEW, Decision Log D8

RecoveryEvent           -- NEW table, Decision Log D3
  id, user_goal_id, timestamp, trigger_condition,
  user_choice (shrink_week/shift_timeline/scope_reduction), resulting_adjustment

WeeklyReview             -- NEW table, Section 4.7
  id, user_goal_id, week_number, completion_rate,
  reflection_type (single_tap/full), reflection_responses (JSON, nullable)
```

**Relationships:** a user has many goals; a goal has many roadmap variants (pre-selection) and one selected roadmap; a goal has many sessions, recovery_events, and weekly_reviews.

**Migration note:** the existing schema already has `User`, `GoalCatalog`, `Phase`, `TaskTemplate`, `UserGoal`, `AvailabilitySlot`, `Session`. The additions above are incremental Prisma migrations, not a schema rewrite — see `project_progress.md` Phase 1 for sequencing.

---
## 10. API Design

At minimum, the API needs endpoints for:
- Goal catalog browsing (`GET /api/catalog`) — exists
- Auth (`/api/auth`) — exists
- Onboarding submission (`/api/onboarding`) — exists, will need a roadmap-selection step inserted before final schedule generation
- Roadmap generation & selection (`POST /api/roadmaps/generate`, `POST /api/roadmaps/:id/select`) — **NEW**
- Session retrieval and completion (`/api/sessions`) — exists
- Recovery check-in retrieval and response (`GET/POST /api/recovery`) — **NEW**
- Weekly reflection retrieval and submission (`GET/POST /api/reflection`) — **NEW**
- Graduation flow response — **NEW**, deferred to Phase 5 (see progress doc)
- Progress (`/api/progress`) — exists

---
## 11. Coding Standards

To be established with the team/tooling as work proceeds. At minimum should cover naming conventions, file organization, component structure, error handling, logging, testing expectations, and documentation requirements. Every new backend module (scheduler, rescheduler, planner, coach, reviewer, optimizer) requires accompanying Vitest coverage before being considered complete — this is a hard requirement given the current zero-test baseline, not a nice-to-have.

---
## 12. Non-Functional Requirements

- **Performance:** The This Week view should load near-instantly — it's the highest-frequency screen in the product.
- **Reliability:** Recovery and graduation triggers must fire correctly even after long periods of user inactivity — these are core to the product's differentiation and cannot silently fail.
- **Security:** Standard protection of personal routine/behavioral data; this data is sensitive in aggregate even if individual fields seem low-risk.
- **Accessibility:** Standard mobile/web accessibility support (screen readers, dynamic text sizing) — not yet detailed at plan stage.
- **Scalability:** Not a near-term concern at MVP scale, but LLM-role calls (Planner, Optimizer, Reviewer especially) must be designed with cost-per-call in mind from the start, per the tiering model in Section 13 — most of the recovery/scheduling logic must remain zero-cost deterministic code.
- **Maintainability:** The AI role pipeline should remain cleanly separated by trigger/responsibility (see role boundary rule, Section 13).

---
## 13. AI System — Roles, Triggers, and Cost Tiering

Four backend LLM roles, never exposed to the user as separate personas — the user only ever experiences a single voice, "your coach."

| Role | Responsibility | Trigger |
|---|---|---|
| Planner | Generates 2–3 structured roadmap variants (numeric parameters, not raw tasks) for a chosen goal | Once, after onboarding, before schedule generation |
| Coach | Translates structured system state (today's session, streaks, recovery outcomes) into the unified user-facing voice | Continuously (daily/weekly view, notifications) |
| Reviewer | Assesses weekly signal (adherence, skip patterns) when completion < 70% | Weekly, conditionally |
| Optimizer | Handles Tier 2c custom replans only, after the lapse circuit breaker fires | On 3rd recovery event within a rolling 28-day window |

**Role boundary rule:** Optimizer and Reviewer output structured metadata/instructions only, never user-facing text directly — Coach is the sole presentation layer, translating their output into the unified voice. This prevents tone drift across roles (Decision Log D9).

**Cost/latency tiering** — most of the system must remain zero-cost deterministic code; LLM calls are reserved for genuinely differentiated reasoning:

| Layer | Trigger | Implementation | Cost |
|---|---|---|---|
| Tier 1 recovery (1–2 day lapse) | Daily boundary | Deterministic same-week reallocation | $0 |
| Tier 2 "shift timeline" | Recovery choice | Offset field update (Section 9, `current_plan_day_offset`) | $0 |
| Tier 2 "shrink week" | Recovery choice | Deterministic tier filter (drop `buffer` sessions) | $0 |
| Tier 2c "custom replan" | Circuit breaker (3rd event/28 days) | Optimizer LLM call, compressed context | Track actual cost; validate against real prompt sizes before treating any $/call figure as a locked budget assumption |
| Weekly review | Completion < 70% | Reviewer LLM call, current milestone only | Same validation caveat as above |
| Roadmap generation | Once, post-onboarding | Planner LLM call, structured JSON output only | Same validation caveat as above |

**Constraint validation:** All Planner output must be validated in code against the user's stated onboarding constraints (session-length caps, available days) before being used to generate any session. On violation, reject and re-request from the Planner rather than silently clamping or splitting the plan (Decision Log D10).

---
## 14. Known Technical Debt (carried over from current implementation, to resolve per progress doc)

- **Database divergence:** local dev runs SQLite; `.env.example`/README reference PostgreSQL. Must be resolved (Prisma provider switch + migration) before any deployment.
- **Zero automated test coverage** on `scheduler.ts` or `rescheduler.ts` — no `test` script in either `package.json`.
- **Execution script discrepancy:** backend/frontend scripts assume Bun; must also work under plain Node/npm (`tsx`, `npx vite`) for portability.
- **No background rescheduling job:** recovery/rescheduling currently only runs on-demand when a user hits the sessions endpoint — acceptable for MVP given the lazy-evaluation approach in Section 6, but notification-driven re-engagement (Section 6) is the actual mitigation and must ship alongside this, not be treated as separately optional.
- **Timezone normalization:** current date handling uses raw `toISOString()` string manipulation with no stored user timezone — direct cause of Decision Log D7.

---
## 15. Future Ideas (not to be implemented yet)

- Wearable integrations.
- Expanding the goal catalog beyond the initial set.
- Multiple concurrent goals.
- Social/community features.
- B2B/team-assigned plans.
- Pulling the next task forward when a user finishes early.
- Queue-based per-user background scheduling (BullMQ/Inngest/Temporal) if lazy evaluation stops scaling.

---
## 16. Decision Log

| Date | Decision | Reasoning |
|---|---|---|
| 2026-08-08 | Project name set to Achivii | Working name "90" replaced. |
| 2026-08-08 | Recovery mechanism defined as a 2-tier threshold (1–2 days silent, 3+ days check-in) | Turns "recovery > perfection" into a concrete, buildable state machine. |
| 2026-08-08 | Weekly reflection made conditional (threshold-based) | Reduces check-in fatigue while preserving support for rough weeks. |
| 2026-08-08 | AI roles confirmed as backend-only, single user-facing voice | Prevents the product from feeling gimmicky with multiple "AI personalities." |
| 2026-08-08 | Day-N graduation flow added as an explicit feature | Addresses the identified churn risk at the natural end of a journey. |
| 2026-09-08 | Six-flagship-journey / outcome hierarchy dropped in favor of a flat, pre-scoped goal catalog | Matches the actually-built and preferred product direction; journeys added onboarding complexity without a corresponding user benefit for this product's target user. |
| 2026-09-08 | Tasks stored with relative `day_number`/`sequence_order` and a rolling plan offset, not absolute dates on unmaterialized future sessions | O(1) timeline shifts instead of rewriting dozens of rows; only the current week is materialized to calendar dates (D2). |
| 2026-09-08 | Sessions tagged `core`/`buffer`/`reflect` at generation time | Makes "shrink this week" a deterministic, safe filter instead of naive compaction that overloads the user (D1). |
| 2026-09-08 | Recovery Tier 2 rebuilt as a real, non-blocking, user-facing check-in with two explicit choices | The mechanism was previously fully automatic with no user-facing moment at all — this is core to the product's actual differentiation and cannot remain invisible (D11). |
| 2026-09-08 | Lapse Circuit Breaker added: 3rd recovery event in a rolling 28-day window triggers a scope-reduction offer instead of repeating the standard check-in | Prevents unbounded timeline drift and protects the "recovery re-engagement" success metric from being undermined by an endless loop (D3). |
| 2026-09-08 | Planner LLM outputs structured numeric parameters that modulate the existing deterministic scheduler, rather than generating tasks or dates directly | Preserves deterministic, testable, cheap scheduling while still giving genuinely differentiated roadmaps (D5 + D4 + D10 reconciled). |
| 2026-09-08 | Optimizer/Reviewer restricted to structured output only; Coach is the sole user-facing presentation layer | Prevents tone drift across five originally-separate role prompts (D9). |
| 2026-09-08 | User timezone stored explicitly (IANA); day-boundary evaluation moved to lazy, on-request evaluation instead of a global UTC cron | Prevents false "missed day" flags for non-UTC users, which would corrupt the core recovery signal (D7). |
| 2026-09-08 | Vitest coverage for `scheduler.ts`/`rescheduler.ts` made the first priority of the realignment effort, ahead of any feature work | Zero test coverage currently exists; refactoring the data model (D2) and recovery logic (D11) blind is high-risk without it. |
