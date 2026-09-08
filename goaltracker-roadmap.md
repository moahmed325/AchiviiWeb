# 3-Month Goal App — Full Build Roadmap

## 1. Product Summary

A webapp that helps ambitious but inconsistent people achieve a goal in 3 months by:
- Letting them pick from a **curated catalog of pre-scoped goals**
- Learning their **real weekly routine** (Mon–Sat busy blocks, Sunday auto-free)
- Auto-generating a **time-blocked daily schedule** for the full 3 months
- Letting them view/edit the **current week** in detail
- **Auto-rescheduling** missed sessions, extending the timeline if needed, instead of just letting the user fail

Core differentiator: adaptive rescheduling logic, not just a static planner.

---

## 2. Core Product Decisions (locked in)

| Decision | Choice |
|---|---|
| Goal source | Predefined catalog only (5–6 goals at launch), not free text |
| Task breakdown | Pre-authored per catalog goal (phases + task templates), not generated live per user |
| Concurrent goals | One active goal per user at a time (v1) |
| Availability input | User marks **busy** blocks Mon–Sat; rest is inferred free |
| Sunday | Not asked about — treated as free (capped to a reasonable window, e.g. 8am–9pm) |
| Rescheduling engine | Deterministic rules-based logic, NOT a live AI call |
| Stack | JS/TS full-stack — React frontend, Node backend |

---

## 3. User Flow

1. **Sign up / log in**
2. **Onboarding**
   - Pick a goal from catalog (browse 5–6 cards, see description + time commitment estimate)
   - Confirm/adjust start date (defaults to today)
   - Enter Mon–Sat busy blocks (simple grid or list-based time picker)
3. **Schedule generation**
   - Backend takes goal's phase/task templates + user availability → generates full 3-month `Session` calendar
4. **Home / This Week view**
   - Shows current week, day by day, with scheduled sessions
   - User can mark session done, edit time, or skip
5. **Missed session handling**
   - If a session passes without being marked done, backend reschedule job kicks in (see §6)
6. **Progress view**
   - Overall goal progress %, phase they're in, days remaining vs. original estimate, current slippage

---

## 4. Data Model

```
User
  id, email, password_hash, created_at

GoalCatalog          -- admin-authored, shared across all users
  id, title, description, category, icon, est_weekly_hours

Phase                -- belongs to GoalCatalog
  id, goal_catalog_id, order, title, duration_weeks

TaskTemplate          -- belongs to Phase
  id, phase_id, title, sessions_per_week, session_duration_minutes,
  preferred_time_of_day (optional: morning/afternoon/evening)

UserGoal              -- a user's instance of a catalog goal
  id, user_id, goal_catalog_id, start_date, target_end_date,
  status (active/completed/abandoned), slippage_days (default 0)

AvailabilitySlot       -- user's fixed busy blocks
  id, user_id, day_of_week (Mon–Sat), start_time, end_time, label (optional)

Session                -- generated instances of TaskTemplates for a user
  id, user_goal_id, task_template_id, scheduled_date, start_time, end_time,
  status (upcoming/done/missed/rescheduled)
```

Relationships:
`GoalCatalog 1—N Phase 1—N TaskTemplate` (the "template" side, admin-authored, reused across all users)
`User 1—N UserGoal`, `UserGoal 1—N Session` (the "instance" side, generated per user)

---

## 5. Scheduling Engine (initial generation)

Input: `TaskTemplate[]` for the goal (with `sessions_per_week`, `duration_minutes`) + `AvailabilitySlot[]` for the user.

Logic (deterministic, no AI call needed):
1. Compute free time windows per day = full day minus busy blocks (Sunday = fixed default window).
2. For each week of the plan, for each active phase's task templates, place the required number of sessions into free windows, spreading them across the week (avoid stacking all sessions on one day where possible).
3. Respect `preferred_time_of_day` if set, else fill greedily.
4. If a week doesn't have enough free time to fit all required sessions, flag it (edge case — see §8).
5. Persist as `Session` rows with `status = upcoming`.

This can run as a single backend job when the user finishes onboarding — generate all ~12 weeks upfront rather than week-by-week. Simpler to reason about and lets you show the user their full plan immediately.

---

## 6. Rescheduling Logic (the core differentiator)

Runs as a scheduled job (e.g., nightly) or triggered when a session's date passes without being marked done.

Rules (define these precisely — this is your product's "smarts"):
1. Session passes uncompleted → mark `status = missed`
2. Look for the next available free slot **later in the same week** → move it there, `status = rescheduled`
3. If no slot available this week → push into **next week**, and shift the *whole remaining plan* back by the corresponding amount (this is the "days get extended" behavior)
4. Track cumulative `slippage_days` on `UserGoal` so the user can see "you're now projected to finish X days later than planned"
5. Optional guardrail: if slippage crosses a threshold (e.g., 2 weeks behind), surface a prompt to the user — "you're falling behind, want to adjust your pace or restart this phase?"

Keep this in plain backend code (cron job / triggered function), not an AI call — it needs to be fast, deterministic, and testable.

---

## 7. Tech Stack

- **Frontend:** React (Vite), React Router, a calendar/week-view library (e.g. `react-big-calendar` or build a custom grid), Tailwind for styling
- **Backend:** Node.js + Express (or Fastify), REST API
- **Database:** PostgreSQL (relational fits this data model well — lots of foreign keys)
- **ORM:** Prisma (pairs well with Postgres + TS, makes schema iteration painless)
- **Auth:** Simple email/password with JWT, or use an auth provider (Clerk/Auth0) to save time since this is a portfolio piece
- **AI use:** Only needed once, offline, to help you **author** the GoalCatalog content (phases/task templates) — not called at runtime for scheduling

---

## 8. Build Roadmap (vertical slices, in order)

**Phase 0 — Setup**
- Repo scaffold: React (Vite) frontend, Node/Express backend, Prisma + Postgres
- Deploy skeleton early (e.g., Vercel for frontend, Render/Railway for backend + DB) so you have a live URL from day one

**Phase 1 — Auth + Goal Catalog (read-only)**
- User signup/login
- Seed DB with 2 hand-authored goals (phases + task templates) — don't build the goal-authoring UI, just seed via script/JSON
- Frontend: catalog browse page

**Phase 2 — Onboarding**
- Goal selection → confirm
- Busy-block input UI (Mon–Sat)
- Save `UserGoal` + `AvailabilitySlot` rows

**Phase 3 — Schedule Generation**
- Build the scheduling engine (§5) as a backend function
- Trigger it right after onboarding completes
- Frontend: "This Week" view rendering generated `Session` rows

**Phase 4 — Session Interactions**
- Mark session done / edit time / skip, from the week view
- Basic day-detail view

**Phase 5 — Rescheduling Engine**
- Missed-session detection (cron or on-load check)
- Implement rules from §6
- Surface slippage in the UI ("3 days behind schedule")

**Phase 6 — Progress + Polish**
- Progress view: % complete, current phase, projected finish date
- Empty/edge states: week with no free time, goal completed, goal abandoned
- Visual polish pass — this is a portfolio piece, so this phase matters

**Phase 7 (stretch, only if time allows)**
- More goals in the catalog (scale from 2 → 5-6)
- Notifications/reminders
- Multi-goal support

---

## 9. What to Prompt an AI Coding Agent With

Work **one phase at a time**, not the whole thing at once. For each phase, give the agent:
- This doc (or the relevant section) for context
- The specific slice you're building right now (e.g., "Build Phase 2: onboarding flow — goal selection screen + Mon–Sat busy block input, saving to AvailabilitySlot and UserGoal per the schema in section 4")
- Explicit mention of "no need to build the rescheduling engine yet, that's a separate phase"

This keeps each prompt scoped and reviewable, rather than asking for the whole app in one shot — which tends to produce something you can't fully verify or maintain.
