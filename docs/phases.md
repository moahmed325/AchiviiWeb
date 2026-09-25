# ACHIVII — IMPLEMENTATION PHASES

### Roadmap, milestones and exit criteria for the redesign

Companion to the two source-of-truth documents:

* `docs/redesign-blueprint.md` — **what** Achivii is and must become (cited as **BP §n**).
* `docs/visual-design-system.md` — **how** it looks (cited as **VDS §n**, implementation notes as **VDS note n**).

The project framework is three files:

| File | Answers |
|---|---|
| `docs/phases.md` (this file) | **When and in what order** — phases, milestones, dependencies, what "done" means |
| `docs/prompts.md` | **How the agent is instructed** — system, execution and workflow prompts per phase (BP §50 structure) |
| `docs/decisions.md` | **Why** — architecture, technology and design decisions, including the open ones listed here |

This file does not invent product requirements. Where the source documents leave something open, it is listed as a decision to make, not answered here.

Last updated: 2026-09-25 · Current position: **Phases 0, 1, 2, 3 and 4 complete. Phase 5 (Today) is `IN PROGRESS`: M5.1, M5.2, M5.3, M5.4, M5.5 and M5.6 done.** M5.7 has not started. Step completion lighting, next step preview, and structured focus wins are live on Today; `/dashboard` is not redirected.

---

# 0 — HOW TO READ THIS FILE

## Status legend

| Status | Meaning |
|---|---|
| `NOT STARTED` | No work done |
| `IN PROGRESS` | Being worked on now |
| `PARTIAL` | Some milestones delivered; the rest are listed |
| `COMPLETE` | Exit criteria met, verified, and reviewed by Mo |
| `BLOCKED` | Waiting on a decision listed under "Decisions required" |

## Identifiers

* **M&lt;phase&gt;.&lt;n&gt;** — a milestone, e.g. `M5.3`.
* **OD-n** — an Open Decision from the end of the blueprint (BP "Open Decisions", numbered 1–12).
* **ND-n** — a New Decision raised while planning phases. Not answered here; to be logged in `decisions.md`.
* **R-n** — a regression check from the must-not-break list (section 3.3).

## Anatomy of a phase

Every phase in section 4 uses the same fields:

1. **Status**
2. **Source** — the blueprint and design-system sections it implements
3. **Objective** — one sentence
4. **Narrative line** — its place in the story of BP §47
5. **Current state** — what exists in the code today, with file names
6. **Decisions required before starting**
7. **In scope** and **Out of scope**
8. **Backend allowance** — the only backend changes permitted (see rule 3.2)
9. **Files likely affected**
10. **Milestones**
11. **Regression checks**
12. **Mobile acceptance**
13. **Validation**
14. **Exit criteria**
15. **Risks**

---

# 1 — STATUS AT A GLANCE

| # | Phase | Status | Depends on | Decisions blocking start | Backend allowance |
|---|---|---|---|---|---|
| 0 | Global design foundation | `COMPLETE` | — | — | None |
| 1 | Marketing homepage | `COMPLETE` | 0 (marketing scope) | — | None |
| 2 | Authentication | `COMPLETE` | 0 | — (OD-4, ND-4, ND-12 Decided) | None |
| 3 | Onboarding | `COMPLETE` | 0, 2 | — (OD-11, ND-5, ND-6, ND-13–16 Decided) | None |
| 4 | Journey generation | `COMPLETE` | 3 | — (OD-8, ND-17 Decided) | None remaining. ND-17 matching shipped in M4.2. Stream labels unused |
| 5 | Today | `IN PROGRESS` | 0, 4 | — (OD-3, OD-9, ND-7, ND-18 Decided) | None |
| 6 | Journey | `NOT STARTED` | 5 | OD-2, OD-7 | None |
| 7 | Weekly review + adaptation | `NOT STARTED` | 5 | OD-1 (test results) | Named: weekly test result storage |
| 8 | Progress | `NOT STARTED` | 6, 7 | ND-8 | None beyond Phase 7 |
| 9 | Achievement | `NOT STARTED` | 6, 7 | OD-1 (completion), OD-2 | Named: goal completion transition |
| 10 | Premium architecture | `NOT STARTED` | 5, 6 | OD-1 (gating), ND-9, ND-10 | Named: entitlement + server-side gate |
| 11 | Mobile | `NOT STARTED` | 2–10 | OD-5 | None |
| 12 | Global polish | `NOT STARTED` | 0–11 | — | None |

---

# 2 — ORDER AND DEPENDENCIES

The blueprint's order (BP §49) is kept. The dependency graph shows which phases truly block others and which could, in principle, overlap. Overlap is **not** the default; one phase at a time remains the rule (3.1).

```text
PHASE 0  Foundation (tokens, type, primitives, Design.md)
   │
   ├──► PHASE 1  Marketing ✔
   │
   ▼
PHASE 2  Authentication
   │
   ▼
PHASE 3  Onboarding
   │
   ▼
PHASE 4  Journey generation
   │
   ▼
PHASE 5  Today  ◄── app shell + navigation are born here
   │
   ├──────────────┐
   ▼              ▼
PHASE 6        PHASE 7
Journey        Weekly review + adaptation
   │              │
   └──────┬───────┘
          ▼
      PHASE 8  Progress
          │
          ▼
      PHASE 9  Achievement
          │
          ▼
      PHASE 10 Premium architecture (Coach + Custom Journeys)
          │
          ▼
      PHASE 11 Mobile sweep
          │
          ▼
      PHASE 12 Global polish
```

**Why this order holds:**

* Phase 0 must finish before Phase 2 because authentication is the first screen inside the product world that needs the shared primitives (inputs, buttons, dialogs, error states). Phase 1 was allowed to precede it only because the marketing page could use a marketing-scoped slice of the foundation.
* Phase 5 creates the application shell. Journey, Progress and Coach entry points attach to that shell, so they come after it.
* Phases 7, 9 and 10 are the only phases that need backend work that does not exist today (OD-1). Each has a named, minimal backend allowance that must be approved before the phase starts.
* Mobile is **not** deferred to Phase 11 (OD-5). Every phase carries mobile acceptance criteria. Phase 11 is a final cross-product sweep.

---

# 3 — RULES FOR EVERY PHASE

## 3.1 One phase at a time

* Work only on the phase named in the prompt.
* When the exit criteria are met, write the phase report (section 7) and **stop**. Do not begin the next phase automatically.
* A phase is `COMPLETE` only after Mo reviews it.

## 3.2 Backend scope rule (BP §40, OD-1)

> **Do not confuse visual redesign with permission to rewrite the backend.**

* The backend, Prisma schema, API client (`frontend/src/lib/api.ts`), auth and goal contexts, and the onboarding and dashboard business logic are off-limits by default.
* A phase may make a backend change only if it is **named in that phase's "Backend allowance"** and approved in `decisions.md` before work starts.
* Anything not named stays off-limits, including "small" refactors.
* Never create a frontend-only substitute for a missing backend capability. For example, a lock that only exists in the UI is bypassable, and a completion screen that the server doesn't know about is fake.

## 3.3 Must not break (BP §41)

Every phase lists which of these it touches. Every touched item is re-verified before the phase ends.

| ID | Capability | Where it lives today | How to verify |
|---|---|---|---|
| R-1 | Authentication | `AuthContext.tsx`, `AuthModal.tsx`, `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` | Sign up, sign out, sign in, reload while signed in |
| R-2 | Goal creation | `OnboardingWizard.tsx` → `POST /api/goal/create` | Create a custom goal and a preset goal end to end |
| R-3 | Preset pathway launch | `certifiedPresets.ts`, navigation state `{ presetGoal, isPreset, switchGoal }` | Start from a pathway; the onboarding shows it preselected |
| R-4 | Onboarding payload | `OnboardingWizard.tsx` → `POST /api/goal/clarify`, `POST /api/goal/create` | Request bodies match the pre-change baseline field for field |
| R-5 | AI roadmap generation | `POST /api/goal/create` | A goal is created with roadmap, weeks and week-1 tasks |
| R-6 | Generation progress stream | SSE on `POST /api/goal/create` when `Accept: text/event-stream` | `step`, `done` and `error` events render; the slow flag appears after 20s |
| R-7 | Saving goals | `saveV2Goal` / `saveV1PresetGoal` in `routes/goal.ts` | `GET /api/goal/active` returns the new goal after reload |
| R-8 | Daily task retrieval | `GoalContext.tsx` → `GET /api/goal/active` | Today shows the correct day's task |
| R-9 | Daily completion | `PATCH /api/goal/tasks/:taskId` | Complete a task; the state persists after reload |
| R-10 | Task notes | `PATCH /api/goal/tasks/:taskId` (`notes`) | Save a note; it persists after reload |
| R-11 | Focus session | `FocusSessionModal.tsx` | Start, pause, resume and finish the timer; completion is recorded |
| R-12 | Weekly review | `POST /api/goal/weeks/:weekNumber/review` | Submit a reflection; the review is stored |
| R-13 | Weekly progression | Same endpoint (writes next week, runs the phase gate) | The next week's tasks appear and `currentWeek` advances |
| R-14 | Roadmap | `RoadmapPage.tsx`, `PlanV2Panel.tsx` | v1 and v2 goals both render their roadmap |
| R-15 | Reset / switch goal | `DELETE /api/goal/active`; `switchGoal` state; create archives the previous active goal | Switch goals; the old one is archived and the new one is active |
| R-16 | Draft goal carried through signup | `localStorage['achivii_draft_goal']`; `pendingPathway` handoff in `Home.tsx` | Pick a pathway signed out → sign up → onboarding has it preselected |
| R-17 | Offline indicator | `GoalContext` `apiStatus`; marketing nav chip; the app shell's chip (`components/app`, the `Navbar` until M5.2) | Stop the backend; the offline state is shown and nothing crashes |
| R-18 | Browser history in onboarding | `OnboardingWizard.tsx` | Back and forward move between steps without losing answers |

## 3.4 Do not pretend (BP §43)

The UI must never imply that any of these work today:

* analytics
* notifications
* payments
* AI chat
* multiple active goals
* fully implemented proof judging
* a completed goal state (until Phase 9 ships its backend allowance)
* persistent challenge progress (`StepChallengeWidget` progress is not stored)
* complete test/target judging

The principle: **design for the future architecture without shipping fake functionality** (BP §23). Also:

* no empty pages created only because a feature will exist one day
* no fake progress percentages during generation
* no "Forgot password", OAuth, or email-verification links while those flows don't exist

## 3.5 Voice and copy

* **90 days** is the product language (BP §06). Never "12 weeks" in user-facing copy until OD-2 decides what the UI says about days 85–90.
* **Adapt the journey, don't punish the person** (BP §18). There is no "failed", "behind" or "missed" language.
* Every claim must describe something the product really does. Phase 1 copy was checked against the real features (weekly review, "why today", the 10-minute version, phases with milestones); later phases hold the same standard.

## 3.6 Visual rules (VDS §33)

1. The interface should feel like a journey, not a dashboard.
2. The staircase represents progress; the garden represents achievement.
3. Cinematic when inspiring, minimal when executing.

The visual intensity levels (VDS §26) set the budget for each phase:

| Level | Surface | Phases |
|---|---|---|
| High drama | Marketing | 1 |
| Cinematic → focused | Auth, onboarding, generation | 2, 3, 4 |
| Level 1: minimal, immediate | Today | 5 |
| Level 2: more visual, strategic | Journey | 6 |
| Level 3: analytical | Progress, weekly review | 7, 8 |
| Level 4: cinematic | Achievement | 9 |

## 3.7 Mobile acceptance in every phase (OD-5, BP §44)

Mobile is the primary execution device. Every phase must meet these before it ends:

* Layout verified at **390px**, plus **360px** for dense screens.
* No horizontal scroll.
* Tap targets are at least **44×44px**.
* Safe-area insets respected (the app shell already uses `env(safe-area-inset-*)` in `App.tsx`).
* Dialogs become bottom sheets where appropriate; long content scrolls inside the sheet, not behind it.
* The on-screen keyboard doesn't cover the active input in forms.
* No `backdrop-blur` over large moving imagery on mobile; use a pre-darkened image layer (VDS note 10).

## 3.8 Accessibility baseline (VDS §29, notes 2–3)

* Body text contrast is at least 4.5:1 (AA).
* Muted text `#6F6D67` (≈3.8:1 on the background) is only for large text (≥18px, or ≥14px bold), placeholders and decorative dividers.
* MICRO text (11–12px) uses the secondary colour, never muted.
* On the light surface `#F1EFE8`, green text, icons and focus rings use the darker accent variant, because `#7FA58B` there is ≈2.4:1.
* Everything is reachable and operable by keyboard. Focus is visible (`:focus-visible`). Dialogs trap and restore focus.
* Important information never exists only in imagery, and colour is never the only progress indicator.
* Decorative visuals are `aria-hidden`. Meaningful visuals have a text alternative.
* Headings form a correct outline, and landmarks (`nav`, `main`, `footer`) are present.

## 3.9 Motion (VDS §19, BP §37)

* Motion is slow, intentional, physical and directional: ascent, emergence, unfolding, arrival. No bounce, spin, pop or shake.
* Every animation has a `prefers-reduced-motion` path. Content must be fully visible without animation.
* Motion must mean something: progress, a transition, entering focus, or arrival.

## 3.10 Dependencies (VDS note 9)

* New packages are allowed where they earn their place.
* Each one is named in the phase that introduces it, with the reason, and logged in `decisions.md`.
* `lucide-react` stays the single icon family at stroke width 1.5 (VDS note 11). Do not add a second icon set.

## 3.11 Validation baseline (every phase)

Run whichever apply:

| Check | Command / method |
|---|---|
| Frontend type-check | In `frontend/`: `node node_modules/typescript/bin/tsc --noEmit -p .` |
| Frontend lint | In `frontend/`: `npx eslint <changed paths>` must be clean. `npm run lint` (everything) is informational until the pre-Phase-0 baseline is fixed (6) |
| Frontend tests | In `frontend/`: `npm test` (Vitest with Testing Library, jsdom) |
| Browser tests | In `frontend/`: `npx playwright test` (desktop 1440 and mobile 390 projects; the API is mocked in `e2e/mockApi.ts`, axe runs on the auth screens; `e2e/onboarding.spec.ts` compares the onboarding request bodies with the M3.1 baseline in `e2e/fixtures/onboarding/`). Specs under `e2e/live/` use the real backend and run only with `LIVE_API=1` (`$env:LIVE_API='1'; npx playwright test e2e/live --project=desktop`) |
| Frontend build | `npm run build --workspace=frontend` |
| Backend tests (if the backend was touched) | `npm test --workspace=backend` (Vitest) |
| Backend build (if the backend was touched) | `npm run build --workspace=backend` |
| Run the app | `npm run frontend` (Vite, :5173) and `npm run backend` (Express, :5000) |
| Browser verification | Desktop 1440px and mobile 390px; console free of errors and warnings; reduced motion emulated |
| Regression | Every R-n the phase touches (3.3) |

Phase 0 added ESLint and Vitest with Testing Library (ND-3). Phase 2 added Playwright with axe-core. Phase 3 added the onboarding payload test and the first real-backend specs (M3.1), the pathway specs (`e2e/pathways.spec.ts`, M3.6) and the onboarding state specs (`e2e/onboardingStates.spec.ts`, M3.7). Determinism check for a phase's specs: `npx playwright test <specs> --repeat-each=3`. End-to-end creates with real AI generation, and stopping the real backend, are run by hand (or a throwaway script) and recorded as manual evidence; they are not specs, because generation is slow and costly. Browser verification remains required evidence for every screen.

**Lint baseline (2026-09-23):** 48 errors and 6 warnings in 14 files that predate Phase 0: `AuthModal`, `ExecutionDashboard`, `FocusSessionModal`, `OnboardingWizard`, `PlanV2Panel`, `SaaSBuilderModal`, `StepChallengeWidget`, `marketing/StaircaseScene`, `marketing/hooks`, `AuthContext`, `GoalContext`, `lib/api`, `Home`, `RoadmapPage`. By rule: `no-explicit-any` 15, `set-state-in-effect` 8, `preserve-manual-memoization` 7, `only-export-components` 7, `exhaustive-deps` 6, `rules-of-hooks` 4, `no-unused-vars` 2, `no-empty` 2, `purity` 2, `use-memo` 1. A phase that migrates one of these files leaves it lint-clean.

**Now (end of Phase 3, 2026-09-23):** 30 errors and 4 warnings in 11 files. `AuthModal` was deleted and `AuthContext` cleaned in Phase 2; `OnboardingWizard` is clean since Phase 3 (its 14 errors and 2 warnings are gone, and its successors in `components/onboarding/` are clean). `Home` (1 error, 1 warning) and `ExecutionDashboard` (6 errors, 1 warning) have exactly the rules they had before Phase 3; they belong to Phase 5. By rule: `no-explicit-any` 9, `preserve-manual-memoization` 7, `set-state-in-effect` 5, `exhaustive-deps` 4, `rules-of-hooks` 4, `only-export-components` 3, `no-unused-vars` 1, `use-memo` 1.

---

# 4 — THE PHASES

---

## PHASE 0 — GLOBAL DESIGN FOUNDATION

**Status:** `COMPLETE` (2026-09-23; Mo accepted the phase report after the review fixes). The marketing-scoped slice shipped with Phase 1. "Current state" below is the kickoff snapshot; "What shipped" records the result.

**Source:** BP §35, §38, §39, §49 (Phase 0), OD-6, OD-10, OD-12 · VDS §2–5, §10–12, §19, §23–25, §29, notes 1–6, 9–11

**Objective:** give every later phase one shared set of tokens, typography, primitives and rules, so no screen invents its own.

**Narrative line:** none (infrastructure).

### Current state

* **Two token sets live side by side in `frontend/src/index.css` `@theme`:**
  * *Legacy (the old mint identity):* `--color-canvas #050807`, `--color-surface #0c1210`, `--color-surface-elevated`, `--color-accent-mint #07CB6C` and its variants, `--color-warning-amber`, `--font-sans` (Plus Jakarta Sans), `--font-mono` (JetBrains Mono).
  * *New (added in Phase 1):* `ink`, `panel`, `panel-raised`, `paper`, `fg`, `fg-secondary`, `fg-muted`, `accent`, `accent-bright`, `accent-deep`, `achievement`, `line`, `line-strong`, `--font-grotesk` (Geist), `--font-grotesk-mono` (Geist Mono), `--radius-panel: 14px`, `--radius-block: 4px`, `--ease-ascend`.
* **Kickoff measurement (2026-09-23):**
  * The legacy colour tokens and helper classes (`.surface-panel`, `.glass-panel`, `.gradient-text`, `.border-hairline*`) are **defined but unused**. The app uses 1,109 hard-coded hex literals instead.
  * The marketing tokens have 162 usages.
  * The radius override affects 28 usages (`OnboardingWizard.tsx` 26, `FocusSessionModal.tsx` 2).
  * `font-mono` is used 212 times.
  * Baseline: type-check and build pass; the main JS chunk is 517 KB (Vite's 500 KB warning); CSS is 93 KB.
* **Naming doesn't follow VDS note 4.** The new tokens are role-like but not the role names the note specifies (`background`, `surface`, `surface-elevated`, `surface-inverse`, `text`, `text-secondary`, `text-muted`, `accent`, `accent-hover`, `achievement`, `border`). The legacy `--color-surface` name collides with the target role name.
* **Radius override:** a global override still forces `--radius-xl`, `--radius-2xl` and `--radius-3xl` to `0.375rem` (VDS note 4 says remove it).
* **Fonts:** `frontend/index.html` loads Geist, Geist Mono, Plus Jakarta Sans and JetBrains Mono from Google Fonts. The app still uses the legacy pair.
* **Shared primitives:** only marketing-scoped ones exist, in `frontend/src/components/marketing/` (`Button`, `Section`/`Eyebrow`, `Reveal`, `Wordmark`, plus the hooks `usePrefersReducedMotion`, `useInView`, `useCountUp`, `useScrolledPast`). The app has no shared primitives.
* **Hard-coded styling:** about 1,010 hex values across the app (BP §38).
* **Modal overlays:** six components implement their own `fixed inset-0` overlay — `AuthModal`, `ExecutionDashboard`, `FocusSessionModal`, `OnboardingWizard`, `PathwaysExplorerModal`, `SaaSBuilderModal` (BP §39 counts about eight modal patterns).
* **`Design.md`:** still states the old rules (no glassmorphism, no sparkle icons, no large radii). It is superseded by the VDS but not yet rewritten (OD-6).
* **Tooling:** the frontend has no ESLint, no Vitest and no Playwright.

### Decisions required before starting

* **OD-6:** the `Design.md` rewrite. The direction is settled by the VDS; the rewrite is this phase's deliverable.
* **OD-12:** semantic token naming. Settled in principle by VDS note 4.
* **ND-1: token migration strategy.** Options include renaming the Phase 1 marketing tokens to the role names, aliasing role names to them, or keeping marketing tokens as a separate layer. It also covers how the legacy `--color-surface` collision is resolved without breaking unmigrated screens.
* **ND-2: primitive strategy.** Hand-built primitives on Tailwind 4, or shadcn/ui (or Radix) primitives restyled to the VDS. This affects dialog and sheet accessibility, bundle size and maintenance.
* **ND-3: frontend verification tooling.** Whether to add ESLint, Vitest with Testing Library (component tests), and Playwright (critical-flow smoke tests). If yes, which flows are covered first.

### In scope

* A role-named token layer (VDS note 4), including:
  * a darker accent variant for light surfaces (VDS note 3);
  * warning and error semantic colours that fit the palette (the legacy amber has no successor yet).
* A typography scale (VDS §5), including display, H1–H3, body, small and micro. Also a `tabular` numeric utility (VDS note 6) and a distinctive large-number treatment (VDS §4).
* Spacing, radius, border, shadow and motion tokens:
  * radius per VDS §23: moderate for marketing, small-to-moderate for the app, near-rectangular for special cards;
  * border starting point `1px solid rgba(255,255,255,.08)` (VDS §10);
  * motion: durations and easing.
* App primitives, each with every state it needs (default, hover, focus-visible, active, disabled, loading, error):
  * Button (primary off-white, secondary outlined, quiet, premium; VDS §12)
  * IconButton
  * Input, Textarea, Select, Checkbox/Radio, SegmentedControl
  * Surface/Card (solid; translucent only over imagery; VDS §10–11)
  * Badge
  * Dialog and Sheet (mobile bottom sheet), with focus trap, Escape to close, scroll lock and restored focus
  * Tabs
  * ProgressBar
  * the Step-marker family (VDS §25): step `○`, active `●`, completed `✓`, milestone `◆`, destination `✦`, built as components
  * EmptyState, LoadingState/Skeleton, ErrorState (with retry)
  * VisuallyHidden, SkipLink
* The `Design.md` rewrite. Keep its still-valid mobile, scroll and touch-target rules; adopt the VDS direction; state that the VDS wins on any conflict.
* A contrast check of every text/surface token pair, recorded in `Design.md`.
* Optional: a **development-only** primitives preview route, excluded from production builds, to verify primitives visually.

### Out of scope

* Migrating existing screens. Each later phase migrates the screens it owns.
* Removing the legacy fonts, the base body styles or the radius override. That happens in Phase 12, once nothing uses them. The override may move earlier only if every affected screen is verified. (Unused legacy colour tokens and helper classes were deleted in Phase 0 under ND-1, because nothing referenced them.)
* Any behaviour or backend change.

### Backend allowance

None.

### Files likely affected

* `frontend/src/index.css`
* `frontend/index.html` (font loading, only if ND-2/ND-3 require it)
* a new `frontend/src/components/ui/` (or the path chosen in ND-2)
* `Design.md`
* `frontend/package.json` (only for packages approved in ND-2/ND-3)

### Milestones

| ID | Milestone |
|---|---|
| M0.1 | ✔ Marketing-scoped palette, Geist fonts, radius, ease, grain, reveal and reduced-motion utilities (delivered with Phase 1) |
| M0.2 | ✔ ND-1, ND-2 and ND-3 decided and logged |
| M0.3 | ✔ Role-named token layer added; marketing tokens reconciled per ND-1; contrast table recorded |
| M0.4 | ✔ Typography scale and tabular-number utility |
| M0.5 | ✔ Spacing, radius, border, shadow and motion tokens |
| M0.6 | ✔ Form and action primitives: Button, IconButton, Input family, SegmentedControl |
| M0.7 | ✔ Container primitives: Surface/Card, Badge, Dialog, Sheet, Tabs |
| M0.8 | ✔ Progress primitives: ProgressBar and the Step-marker family |
| M0.9 | ✔ State primitives: EmptyState, LoadingState, ErrorState |
| M0.10 | ✔ `Design.md` rewritten |
| M0.11 | ✔ Tooling per ND-3, with the first tests passing |

### Regression checks

The marketing landing page renders identically after the token reconciliation (a Phase 1 visual check). The signed-in app renders unchanged, because legacy tokens stay in place.

### Mobile acceptance

Primitives meet 44px targets. Sheet behaviour verified at 390px. Inputs don't trigger iOS zoom (font size ≥16px).

### Validation

* Type-check and build (3.11).
* Every primitive checked in every state, by keyboard and with reduced motion.
* The contrast table is complete.
* The landing page is visually unchanged at 1440px and 390px.

### Exit criteria

* No later phase needs to invent a colour, font size, radius or dialog.
* `Design.md` no longer contradicts the VDS.
* Primitives are documented well enough to use without reading their source.

### Risks

* Token renames silently changing Phase 1 visuals. Mitigate by comparing before and after.
* Over-building primitives nobody uses yet. Build only what Phases 2–5 need; add the rest when a phase needs it.

### What shipped

* **Tokens** (`frontend/src/index.css` `@theme`), by role per ND-1:
  * colours: `background`, `surface`, `surface-elevated`, `surface-inverse`, `scrim`, `text`, `text-secondary`, `text-muted`, `text-on-inverse`, `accent`, `accent-hover`, `accent-on-inverse`, `achievement`, `caution`, `danger`, `border`, `border-strong`, `border-control` (the 3:1 boundary for form controls);
  * type scale `display`, `h1`–`h3`, `body-lg`, `body`, `small`, `micro`, `numeral`, each with its line height, tracking and weight;
  * `gutter` and `section` spacing, four radii (`block`, `control`, `card`, `panel`), two shadows, two easings, four durations and the overlay, dialog and sheet animations.
* **Legacy cleanup (ND-1):** the unused legacy colour tokens and the `.glass-panel`, `.surface-panel`, `.gradient-text` and `.border-hairline*` classes were deleted. The 173 marketing usages were renamed to role names (`ink` → `background`, `fg` → `text`, `line` → `border`, `font-grotesk` → `font-ui`, and so on). The legacy fonts, base body styles and radius override remain.
* **Conventions:** `ui-root` (Geist on migrated screens and portals), `focus-ring` (an outline in `--focus-ring-color` that beats the legacy mint rule), `on-inverse` (switches `--focus-ring-color` and `TextLink` to dark green on light surfaces, which hold text and `TextLink` only for now).
* **Primitives** in `frontend/src/components/ui/`, exported from `index.ts`: `Button`, `IconButton`, `Spinner`, `TextLink`, `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `ChoiceGroup`, `ChoiceCard`, `SegmentedControl`, `Surface`, `Badge`, `Dialog` (with `DialogTrigger`, `DialogClose`, `DialogContent`, `SheetContent`), `Tabs` (with `TabsList`, `TabsTrigger`, `TabsContent`), `ProgressBar`, `StepMarker`, `EmptyState`, `LoadingState`, `Skeleton`, `ErrorState`, `VisuallyHidden`, `SkipLink`. Dialog, Tabs and `asChild` use Radix (ND-2); the rest are hand-built. Dialogs become bottom sheets below 768px.
* **Tooling (ND-3):** ESLint (flat config), Vitest with Testing Library in jsdom, and the scripts `lint`, `test` and `test:watch`. 41 tests across 6 files cover every exported primitive.
* **Review fixes (W11, the groups Mo selected):**
  * *Accessibility:* inputs, textareas, selects, checkboxes and radios use `border-control` (3.28–3.35:1 instead of 1.5:1). The contrast table gained border rows and every status colour on the light surface; muted text on the light surface is recorded as a fail (4.496:1).
  * *Light surface:* documented as text and `TextLink` only. Choice cards, segmented tracks and the checkbox box draw their ring from `--focus-ring-color`, so they adapt.
  * *States:* `error` (and `required`) on `ChoiceGroup`, `SegmentedControl` and `Checkbox`; `TextLink`; `Input` `trailing` slot; `Button` and `IconButton` `loading` keep focus (`aria-disabled` instead of native `disabled`, no submit while loading); `asChild` links honour `disabled`; every error sits in an always-mounted live region, so it is announced.
  * *Copy:* the preview no longer shows "Missed", notification examples, a Coach/sparkles button or a "Day 88" bar; `Design.md` examples follow.
* **Development preview:** `/__ui` renders every primitive in every state. It is loaded only when `import.meta.env.DEV`, so production builds contain no trace of it.
* **`Design.md`** rewritten: VDS precedence, token reference, contrast table, conventions, primitive usage, and the retained mobile, touch, scroll and accessibility rules.
* **Files:**
  * `frontend/src/index.css`, `frontend/src/App.tsx` (dev route only), `frontend/vite.config.ts` (`dedupe` for React), `frontend/package.json`, `frontend/bun.lock`
  * new: `frontend/src/components/ui/**`, `frontend/src/pages/dev/UiPreviewPage.tsx`, `frontend/src/test/setup.ts`, `frontend/src/vite-env.d.ts`, `frontend/eslint.config.js`, `frontend/vitest.config.ts`
  * token rename only: `frontend/src/components/marketing/**`
  * `Design.md`, `docs/decisions.md`, `docs/phases.md`, `docs/prompts.md`

### Verification evidence

* Type-check passes. 41 of 41 tests pass. `components/ui` and `pages/dev` are lint-clean; the full-lint baseline is unchanged (48 errors, 6 warnings). The build passes, with the main JS chunk at 516.76 KB (+0.23 KB, the dev-route guard) and CSS at 112.19 KB (+18.8 KB raw, about +2.3 KB gzipped, from the primitives' utilities and the new tokens). The dist contains no preview code.
* No file references a deleted legacy token or class, and no unmigrated screen uses the new role utilities (static search).
* Signed in with the test account: the signed-in home and onboarding render in their legacy style (Plus Jakarta Sans, mint) with no horizontal overflow at 772px and 390px. `/dashboard` and `/roadmap` redirect to onboarding because the account has no goal, which is existing behaviour. There is no pre-Phase-0 screenshot of these screens, so this confirms they render, not that they are pixel-identical.
* Keyboard in the browser: arrow keys move focus across tabs, skip the disabled tab and loop. The SkipLink, with focus forced, is a 140×45px pill at the top left with the focus ring. (The embedded browser has no window focus, so native Tab and focus events can't be driven there; Tab order, radio arrows and selection-follows-focus are covered by the user-event tests.)
* New states in the browser: `border-control` on the input and checkbox; the password toggle sits inside the input (44×44px, 52px right padding); `TextLink` is `accent-on-inverse` on the light surface; `--focus-ring-color` switches inside `.on-inverse`; forced focus on a choice card, segment and checkbox draws the accent-hover ring; invalid controls turn `danger` with an icon and sentence. At 390px, all 46 controls on `/__ui` are at least 44px and nothing overflows.
* The landing page is unchanged after the token rename: 0 computed-style differences across 665 elements at 1440px, and visually unchanged at 390px with no horizontal overflow.
* At 390px on `/__ui`: no horizontal overflow, no interactive element under 44px, and every input is 16px.
* The dialog opens with its title as its name, focus inside and the body scroll-locked. Tab wraps within it; Escape closes it, releases the lock and returns focus to the trigger. Below 768px it is a full-width bottom sheet with stacked 48px actions; above, a centred dialog.
* The focus ring renders as a 2px accent-hover outline, overriding the legacy mint rule (checked by forcing `:focus-visible`).
* Loading buttons keep full opacity with a progress cursor; disabled buttons fade to 45% with a not-allowed cursor.
* Under reduced motion, dialog, sheet and spinner animations run at 0.00001s.
* No console errors or warnings while opening and closing every dialog variant, switching tabs and retrying.

### Carry-overs

| Item | Owner |
|---|---|
| `RoadmapPage.tsx` calls hooks after an early return (`rules-of-hooks` at lines 31, 51, 57, 76): a latent crash if the early-return condition changes between renders | Phase 6 |
| Lint baseline in 14 pre-Phase-0 files (3.11) | The phase that migrates each file |
| No screen uses the primitives yet; the six hand-rolled modal overlays remain | Phases 2–10, per screen |
| Legacy fonts, base body styles, mint focus rule, scrollbar colours and the radius override | Phase 12 |
| `frontend/node_modules` held stale folders from an older install that shadowed bun's links and caused a duplicate-React crash; the affected folders were deleted and relinked. A clean `bun install` on a fresh clone is the reliable setup. `vite.config.ts` `dedupe` also masks a broken install; remove it once installs are clean | Housekeeping |
| `Button`, `Badge`, `StepMarker`, fields and choice controls have no inverse variant; the light surface holds text and `TextLink` only | The first phase that needs a control on a light surface |
| Focus rings on the first and last tab and on dialog edges can be clipped by `overflow` on their container | Phase 2 (first dialog and tabs in a screen) |
| No automated accessibility check (for example `vitest-axe`) | Phase 2, with Playwright |
| `Design.md` gaps from the review (not selected for Phase 0): dialog initial focus lands on ✕, not the first field; `Spinner` undocumented; "1 column on mobile" while `ChoiceGroup` uses `sm:grid-cols-2`; gold "marks milestones" while `StepMarker` milestone is white; the navigation rule pre-empts ND-7; the logs, table and code rules have no primitive behind them | Next `Design.md` pass, before Phase 2 screens use them |
| Type-scale minimums sit below some VDS ranges; micro tracking (0.16em) is baked into `text-micro` | Phase 2 review against VDS §10–11 |
| `--duration-reveal` is defined but nothing uses it yet | Phase 12 (use it for marketing reveals or remove it) |
| `Surface tone="glass"` has no mobile blur guard, only a documented rule | The first phase that uses glass over imagery |
| `StaircaseScene` keeps literal hex values and `hover:bg-white`; `marketing/Button` duplicates `ui/Button` | Phase 12 (marketing migration to primitives) |

---

## PHASE 1 — MARKETING HOMEPAGE

**Status:** `COMPLETE` (2026-09-23)

**Source:** BP §11–13, §24–25, §36–37, §43, §47 · VDS §6–9, §12–13, §15–17, §19, §21–22, §29

**Objective:** turn the signed-out landing page into the Achivii world.

**Narrative line:** *"You have somewhere to go."*

### What shipped

* **Section order:** Hero → Problem → Method → 90-Day Journey → Today's Step → Adaptive → Pathways → Coming to Achivii (Coach, Custom Journeys) → Achievement → Final CTA → Footer.
* **Hero:** an isometric SVG staircase (`StaircaseScene.tsx`) that rises to a lit doorway.
* **Journey section:** the path lights up to "You are here".
* **Today section:** a mock-up of a daily step, based on the YouTube pathway.
* **Achievement section:** a garden arch.
* **CTAs:** "Start your journey" and "See how it works".
* **Navigation:** a floating pill nav with How it works, Journeys, Coach, Sign in and Start. Pricing is deliberately left out because no pricing exists (BP §43).
* **Premium honesty:** Coach is labelled "In development" and Custom Journeys "Planned for Premium". There are no buttons, and a note says there is no paid plan yet and everything is free.
* **Bug fixed:** a pathway picked while signed out now carries through signup into onboarding. The handoff waits for the goal to load after login.
* **Files:**
  * `frontend/src/components/marketing/**`
  * `frontend/src/App.tsx` (hides the app Navbar and footer on the signed-out landing)
  * `frontend/src/pages/Home.tsx` (signed-out branch replaced; signed-in branch untouched)
  * `frontend/src/index.css`, `frontend/index.html`
  * `frontend/public/images/brand/*`

### Verification evidence

* Type-check passes.
* Layout verified at 1440px and 390px, with no horizontal overflow and all tap targets at least 44px.
* Console clean over a full scroll.
* Fonts and images load.
* Reduced motion disables all animation and shows all content.
* Anchor links clear the nav.
* All CTAs open the correct auth mode.
* Pathway → signup → `/onboarding` preselected the pathway ("Certified Blueprint: Run a 10K Under 50 Minutes").
* Signing out restores the landing page.

### Carry-overs (owned by later phases)

| Item | Owner |
|---|---|
| AuthModal still uses the old green style, and its close button overlaps the tabs | Phase 2 |
| Pathway descriptions are jargon-heavy ("170+ SPM cadence", "RIR hypertrophy", "Silman LPDO scans"); the copy comes from preset data | Phase 3 (ND-5) |
| Returning user with an active goal who picks a pathway then signs in: verified by reading the code, not live | Phase 2 regression (R-16) |
| ~~Marketing tokens named `ink`/`panel`/`paper`… rather than VDS role names~~ | Done in Phase 0 (ND-1) |
| Brand images are low resolution (735×985, 682×1024) | Phase 12 (asset request) |
| Test account `phase1-landing-test-0923@example.com` exists in the local development database | Housekeeping |
| The free-text custom-goal box was removed from the landing page; custom goals remain free inside onboarding | Phases 3 and 10 (ND-6, ND-10) |

---

## PHASE 2 — AUTHENTICATION

**Status:** `COMPLETE` (2026-09-23; Mo accepted the phase report after the review fixes). The sections from "Decisions required" down are the kickoff plan; "What shipped" records the result.

**Source:** BP §13, §41–42, §47, §49 (Phase 2), OD-4 · VDS §10–12, §16, §26, §29

**Objective:** move sign-up and sign-in out of a modal-dependent architecture, where that helps, into a considered first step inside the Achivii world.

**Narrative line:** the threshold between *"You have somewhere to go"* and *"Tell us where."*

### What shipped

* **Routes (OD-4 A):** `/signup` and `/login` replace `AuthModal`, which is deleted along with `openAuthModal` and the modal state in `AuthContext`. The token logic is unchanged.
* **Auth screens** (`frontend/src/pages/auth/`):
  * `AuthLayout`: staircase image beside the form on desktop, a faint image band on mobile; names the chosen journey when a pathway is in the URL, otherwise "You have somewhere to go."
  * `AuthScreen`: Phase 0 `Field`, `Input`, `IconButton`, `Button`, `LoadingState`; `autocomplete` `email` / `new-password` / `current-password`; show/hide password; validation matching the backend (email needs "@", sign-up password at least 6); loading state and double-submit guard; Enter submits.
  * Errors: duplicate email (with "Sign in instead", email and pathway kept), wrong credentials, offline, server error, plus an up-front notice when the health check fails.
* **Handoff and redirects (ND-4 A):** pathway CTAs link to `/signup?pathway=<id>`. `usePostAuthRedirect` and `lib/authFlow.ts` decide the destination once the goal state is known:
  * pathway and no goal → `/onboarding` with `{ presetGoal, isPreset, switchGoal }` and `achivii_draft_goal`;
  * pathway and a goal → Today with a "journey in progress" notice; the goal is untouched;
  * goal fetch failed → Today, never onboarding (ND-12);
  * otherwise an internal, non-auth `?next=`, else Today (goal) or onboarding (no goal).
  * A signed-in visitor to an auth route is moved on.
* **`ProtectedRoute`:** a signed-out visitor goes to `/login?next=<path>`.
* **CTAs:** every landing CTA, the pathway rows and the app `Navbar`'s signed-out buttons are route links. Copy unchanged. Sign-out returns to the landing page.
* **ND-12 changes:** `ApiError` with the HTTP status in `lib/api.ts`; `goalLoadFailed` in `GoalContext`.
* **Tooling (ND-3):** Playwright and axe-core; `e2e/auth.spec.ts` against a mocked API (`e2e/mockApi.ts`), desktop 1440 and mobile 390.
* **Removed from `Home.tsx`:** the in-memory pathway handoff (`pendingPathway`, `goalFetchSeen`).

### Verification evidence

* Type-check and build pass (main JS chunk 531.54 KB, +14.8 KB since Phase 0; CSS 114.29 KB). Vitest 73 of 73. Playwright 40 of 40 (2 intentional viewport skips).
* Lint: changed files add no errors; the remaining errors in `api.ts`, `GoalContext.tsx` and `Home.tsx` are the pre-Phase-0 baseline. Full lint 44 errors and 6 warnings in 12 files (from 48 and 6 in 14): `AuthModal` removed, `AuthContext` now clean.
* All 11 validation steps pass against the real backend (throwaway Playwright script, three test accounts):
  * fresh sign-up → `/onboarding`; pathway sign-up → onboarding at Schedule with "Run a 10K Under 50 Minutes" preselected and `achivii_draft_goal` set;
  * sign-in with a goal → Today; with a goal after choosing a pathway → Today with the notice, same goal id before and after, no draft written;
  * wrong password and duplicate email show the right messages and keep the email;
  * a double click sends one sign-up request;
  * back returns to the landing page; reload keeps the screen and pathway; `/login` and `/signup` while signed in redirect to Today (a full load with a token, so this also covers reload while signed in).
* Backend stopped: simulated by blocking :5000 in the test browser; the notice and the submit error appear and nothing crashes. The real backend was not stopped.
* 390px: no horizontal overflow on `/signup`, `/login`, `/signup?pathway=run10k`. At 390×664 with the password focused, the 56px submit button stays on screen.
* axe (WCAG 2.2 AA tags): no violations on the three auth URLs at both widths. Keyboard order checked: skip link, home, email, password, show/hide, submit, switch.
* Reduced motion: no running animations and nothing hidden. Console: only Chromium's resource lines for the expected 409, 401 and refused responses.
* Sign-out to the landing page is verified in the mocked Playwright suite only.
* Review fix: the Today notice's dismiss button is 44×44 (asserted in Playwright).

### Carry-overs (owned by later phases)

| Item | Owner |
|---|---|
| A failed goal fetch lands on Today, which then shows the goal-less pathway gallery; it needs an error state driven by `goalLoadFailed` | Phase 5 |
| The notice says "Explore Goals" while the app nav says "Pathways (10)" | Phase 5 |
| The Today notice uses `Home.tsx`'s legacy hex palette until Today is migrated | Phase 5 |
| The offline status is one health check on mount, so it can be stale in either direction (R-17) | Phase 12 |
| The signed-in redirect has no timeout if the goal fetch never resolves | Phase 12 |
| ~~`e2e/live/` is empty; the real-backend checks were not kept as specs~~ Done in M3.1 (`e2e/live/onboarding.live.spec.ts`) | Phase 3 (with the payload test) |
| Test accounts `phase2-w6-{a,b,c}-1790142962485@example.com` (account a has a goal) | Housekeeping |

### Decisions required before starting

* **OD-4:** adding `/login` and `/signup` routes. This touches `ProtectedRoute` and the draft-goal-through-signup flow. The prompt must permit the route change and list R-1, R-3 and R-16 for regression.
* **ND-4: how a chosen pathway survives navigation to an auth route.** Options include a URL parameter (for example `/signup?pathway=<id>`), the existing `achivii_draft_goal` localStorage key, or both. The decision also covers:
  * whether the modal stays for in-context moments (for example clicking a pathway);
  * the redirect rules after auth: no goal → onboarding; active goal → Today; an explicit `?next=` path honoured only if it's internal.

**Decided 2026-09-23:** OD-4 **A** (routes only; the modal is retired) and ND-4 **A** (`/signup?pathway=<slug>`, cleared once consumed; the redirect rules above). See `docs/decisions.md`.

### In scope

* Dedicated sign-up and sign-in screens (if OD-4 approves routes):
  * cinematic → focused (BP §13);
  * atmospheric imagery used lightly behind a solid form surface (VDS §11, §16).
* The AuthModal either rebuilt on Phase 0 primitives, or retired in favour of the routes, per ND-4. The close-button overlap is fixed either way.
* Form UX:
  * labelled fields with correct `autocomplete` (`email`, `new-password`, `current-password`);
  * a show/hide password toggle;
  * inline validation that matches the backend rules;
  * submission loading state; double-submit prevention;
  * Enter to submit.
* Error states, in encouraging language: email already registered, wrong credentials, network offline, server error.
* A signed-in user who visits an auth route is redirected.
* Marketing CTAs point at the new entry points. Copy stays unchanged.
* Signing out returns to the landing page.

### Out of scope

* Password reset, email verification, OAuth, "remember me". They don't exist and must not be linked (3.4).
* Changing the token storage mechanism, session lifetime or backend validation.
* Restyling the signed-in app Navbar (Phase 5).

### Backend allowance

None.

### Files likely affected

* `frontend/src/App.tsx` (routes)
* `frontend/src/components/ProtectedRoute.tsx`
* `frontend/src/components/AuthModal.tsx`
* new `frontend/src/pages/SignupPage.tsx` and `LoginPage.tsx` (if routes are approved)
* `frontend/src/context/AuthContext.tsx` (presentation hooks only; no changes to token logic)
* `frontend/src/pages/Home.tsx` (the handoff, per ND-4)
* `frontend/src/components/marketing/LandingPage.tsx` and its CTA wiring

### Milestones

| ID | Milestone |
|---|---|
| M2.1 | OD-4 and ND-4 decided; route table and redirect rules written down |
| M2.2 | Auth screen layout (desktop and mobile) on Phase 0 primitives |
| M2.3 | Sign-up and sign-in forms, with validation, loading and every error state |
| M2.4 | Pathway and draft-goal handoff re-implemented per ND-4 |
| M2.5 | `ProtectedRoute` and post-auth redirects updated |
| M2.6 | Landing CTAs rewired; AuthModal rebuilt or retired |
| M2.7 | Full regression and phase report |

### Regression checks

R-1, R-3, R-16, R-17. Also the Phase 1 CTAs (every CTA reaches the correct auth mode).

### Mobile acceptance

3.7 applies, plus:

* The form is usable with the keyboard open at 390×664 (visible viewport with keyboard).
* The primary button stays reachable.

### Validation

1. Sign up fresh → onboarding.
2. Sign up from a pathway → onboarding preselected.
3. Sign in with an active goal → Today, not onboarding.
4. Sign in with an active goal after picking a pathway → stays on the existing goal (the untested Phase 1 case).
5. Wrong password.
6. Duplicate email.
7. Backend stopped.
8. Double-click submit.
9. Browser back from an auth screen.
10. Reload on an auth screen.
11. Visit `/login` while signed in.

### Exit criteria

* Auth no longer depends on a globally mounted modal (unless ND-4 keeps it deliberately).
* Every path in the validation list behaves as specified.
* No fake account features are shown.

### Risks

* Losing the pathway handoff. This is the main risk; see ND-4.
* Redirect loops between `ProtectedRoute` and the auth routes.

---

## PHASE 3 — ONBOARDING

**Status:** `COMPLETE` (2026-09-23; Mo accepted the phase report). "Current state" describes the code at the end of the phase; "What shipped", "Verification evidence" and "Carry-overs" record the result; the sections from "Baseline" down are the kickoff plan and the milestone reports, kept as written.

**Source:** BP §16, §24, §28–29, §41, §47, §49 (Phase 3), OD-11 · VDS §4–5, §22, §26, §28

**Objective:** turn goal creation into a premium, guided experience that keeps all of the current intelligence while feeling simple.

**Narrative line:** *"Tell us where."*

### Current state

The code at the end of Phase 3 (M3.8, 2026-09-23). The kickoff snapshot it replaces is summarised in the M3.1 baseline below (the wizard was one 3,038-line component with five steps, five pathway galleries, two category systems and a raw "Failed to fetch" on failure).

* **Structure:** `OnboardingPage.tsx` (41 lines) passes the token, the id of the goal active when onboarding opened (`null` if its load failed) and the app's health-check result to `OnboardingWizard.tsx` (311 lines), which coordinates `components/onboarding/`: flow state, history and requests in `useOnboardingState.ts` (385), the create body in `payload.ts` (43), step order and question grouping in `steps.ts` (48), one question step in `questionFlow.ts` (104), error copy in `requestErrors.ts` (44), day planning in `schedule.ts` (419), and the step components `StepGoal`, `StepQuestions` / `QuestionCard`, `StepSuccess`, `StepSchedule` (with `RoutineTimeline`, `CommitmentsPanel`, `CommitmentEditor`), `StepReview` and `StepGeneration`, laid out by `OnboardingShell`, `OnboardingProgress` and `StepLayout`.
* **Steps (ND-13):** pathway: direction → starting point → success → schedule → review; custom: direction → schedule (while clarify runs) → starting point → success → review; then generation (the legacy screen, Phase 4). A pathway launched from outside onboarding opens on the starting point. One question per screen. "Success" holds the editable outcome and the `success` question when there is one (ND-14).
* **Answers collected (BP §29):** unchanged: plan variant (`minimal` / `steady` / `accelerated`), daily minutes, wake and sleep times, busy hours, preferred slot (defaults `07:00`, `23:00`, `09:00 - 17:00`, `evening`), commitments, then the clarify answers; a skipped question is sent as `"Skipped"`. The create body is identical to the M3.1 baseline.
* **Clarify:** unchanged endpoint and ids. Custom goals get `current_level`, `success`, `equipment`, `obstacle` from the AI; presets get their own questions from preset data (9 of the 10 pathways; the TED-style speech pathway is not matched by the backend and gets the custom questions, see carry-overs). Each goal is sent once; a response for a goal the user has since changed is ignored.
* **Offline and failure:** `requestErrors.ts` tells "We can't reach Achivii right now" (network) from "We couldn't prepare your questions" and "We couldn't build your plan" (Achivii's own message). The health check and every request result drive a connection notice. A create retry after a lost connection first checks the active goal, so a plan the server finished is not built twice. No raw browser error is shown.
* **Pathways:** one catalogue (`lib/certifiedPresets.ts`, 322 lines: `direction` is the only grouping, `PATHWAY_GROUPS` the non-empty directions) and one library (`components/pathways/`: `PathwayLibrary`, `PathwayStrip`, `PathwayCustomGoal`, `usePathwaySelection`, `usePathwayLaunch`), used by onboarding, `Home` without a goal, the Today and dashboard strips, and `PathwaysExplorerModal.tsx` (84 lines, a Dialog that is a bottom sheet under 768 px, opened from `Navbar`, Today and the dashboard). The landing page reads `PATHWAY_GROUPS`.
* **Launch state:** unchanged: `{ presetGoal, isPreset, switchGoal }` through router state plus `localStorage['achivii_draft_goal']`, written by every launch outside onboarding (landing via `/signup?pathway=<id>`, `Home`, the strips, the explorer). The draft key is kept until a plan is created or recovered. A pathway chosen inside onboarding does not write it, so a reload returns to the goal step; custom answers live only on the page (confirmed behaviour, M3.7 review outcome 1).
* **Browser history (R-18):** each step change pushes `{ wizardStep }` and keeps React Router's state; the Back buttons push too (as at M3.1). `popstate` moves to the target step or, if its data is gone, the furthest reachable one. Generation locks the history.
* **Custom goals:** free, visible and secondary to the pathways (ND-6); `POST /api/goal/create` doesn't check entitlement.

### What shipped

* **Onboarding flow (M3.5):** a cinematic-to-focused shell (staircase and an ascending step rail on desktop, a progress bar on mobile); the direction step with six directions, their pathways as radio cards and the custom goal beneath (OD-11, ND-6); inline one-question screens with options, "in your own words" and a two-stage skip (the quiz modal is gone); the success step with the editable 90-day outcome; the schedule with plan, minutes, day shape, a keyboard-operable timeline and commitments in a Dialog / bottom sheet; a review with an Edit per section ending in "Build my 90-day path". Every step starts at its heading.
* **Architecture (M3.3, M3.4):** the wizard split into a state hook, a pure payload builder and step components. ND-16 fixes: no blank step after a reload, a switch-goal reload stays in onboarding, the draft key is kept until create.
* **Pathways (M3.6):** one catalogue with plain-language `summary` (ND-5), one library in five places, one launch; the landing page reads the same groups. The Home search box and four-category filter are replaced by direction navigation, and a strip tile opens the explorer on that pathway (both accepted at the M3.6 review).
* **States (M3.7):** every state in the state matrix below has plain copy and a way on: classified clarify and create failures with retry, the connection notice, stale-response and wait fixes, duplicate-safe create retry, commitment-name validation, a blank outcome falling back, and the compact question header at 360 px (accepted at the M3.7 review). The legacy generation screen only had its failure copy made honest.
* **M3.8:** regression, audits and this report. One cleanup: `schedule.ts` dropped the unused colour fields (`color`, `bg`, `border`, `accentColor`, `bgColor`, `borderColor`) that nothing has read since M3.5. The file went from 500 to 419 lines. The type-check proves nothing else used them; the schedule results and the payload are unchanged.
* **Primitives touched:** `Dialog` returns focus to the element focused when a state-opened dialog opened (M3.5); `TabsTrigger` uses `.focus-ring-inset` (M3.6); `SegmentedControl` pads less below 640 px (M3.5).
* **Tests:** Vitest 73 → 156 tests (22 files); Playwright `e2e/onboarding.spec.ts`, `e2e/onboardingStates.spec.ts`, `e2e/pathways.spec.ts` with the M3.1 fixtures, `e2e/onboardingFlow.ts` helpers and new `mockApi` failure options (defaults unchanged); `e2e/live/onboarding.live.spec.ts` (`LIVE_API=1`).
* **Files:** see the Phase 3 report, section 3. Backend: none.

### Verification evidence

* Type-check clean. Vitest 156 of 156 in 22 files. ESLint clean on all 57 Phase 3 files other than `Home` and `ExecutionDashboard`, which keep exactly their pre-Phase-3 errors; full lint 30 errors and 4 warnings (3.11). Build passes: main JS 565.85 KB (166.99 KB gzipped), +4.95 KB since M3.5; CSS 102.48 KB.
* Playwright, mocked: 117 passed, 3 skipped (the three project skips) — desktop 59 + 1 skipped, mobile 58 + 2 skipped. The onboarding, state and pathway specs with `--repeat-each=3` on both projects: 231 passed, 3 skipped, 0 failed, 0 flaky.
* Playwright, live (`LIVE_API=1`): 3 runs, 6 of 6 passed; no forced sign-out.
* Real backend, end to end (throwaway script, real AI generation): a landing pathway to a created goal (29 s), a custom goal with a skipped question (48 s, double click sent one create), a switch from the Today strip (29 s; the old goal `archived` in the database, not deleted), abandoning switch goal by Back and by closing the tab (goal untouched), and the backend process killed during clarify (pathway and custom) and before Build, then restarted (21 of 21 checks).
* Browser audit at 1440, 390 and 360 over every onboarding state and pathway surface: axe (WCAG 2.2 AA tags), heading outline, landmarks, overflow, 44 px targets, nested controls, live regions announced once, keyboard-only flows, focus traps and restoration, reduced motion, console. Onboarding and Phase 3 surfaces pass; findings outside Phase 3 are carry-overs.
* Details: the M3.8 regression matrix, the before-and-after table and the Phase 3 report below.

### Carry-overs (owned by later phases)

| Item | Owner |
|---|---|
| ~~The TED-style speech pathway isn't matched by the backend~~. A new clarify for "Deliver a 15-Minute TED-Style Speech" now hits `ted_speech_15min`. The goal already stored with that title was not rewritten | Done in M4.2 (ND-17) |
| ~~The generation screen keeps its legacy look~~. M4.2 replaced the in-flight screen. M4.3 added the 20-second silence copy and kept failures on that screen | Done in M4.3 |
| Create recovery after a lost connection is skipped when the current goal failed to load | Phase 5 (goal-load error state) |
| Onboarding has no skip link; the legacy navbar sits above it. Navbar targets under 44 px ("Achivii" 87×28, account button 62×34); goal links overflow 7 px at 360 px | Phase 5 (app shell) |
| `/roadmap` overflows by 17 px at 390 and 47 px at 360 with an empty roadmap; `/roadmap` and `/dashboard` have no `main` landmark | Phase 6 (Journey), Phase 5 (dashboard) |
| The UI Back button pushes a history entry (as at M3.1), so browser Back straight after it returns to the step just left; both reach the previous step when the step was entered going forward | Phase 11 (mobile sweep; changing it touches R-18) |
| Soft-keyboard states can't be emulated in Playwright | Phase 11 (on-device check) |
| Reloading while the backend is unreachable signs the user out (`AuthContext` drops the token on any `/me` failure) — the deterministic trigger of the forced sign-out | Unassigned (backend and `AuthContext`; section 6) |
| Hard-coded pathway counts; undisplayed expert catalogue fields; unused `SaaSBuilderModal`; the strip inside the legacy Today and dashboard | Phase 5 / Phase 12; Phase 12 (Phase 4 does not show them as the generated method); Phase 12; Phase 5 |
| Main JS chunk above Vite's 500 KB warning | Phase 12 |

### Baseline (M3.1, 2026-09-23)

Captured on the live dev stack with Playwright (clarify passed through to the backend, create recorded and not answered), then committed as fixtures in `frontend/e2e/fixtures/onboarding/`. `e2e/onboarding.spec.ts` replays them with the API mocked; `e2e/live/onboarding.live.spec.ts` repeats both flows against the real backend.

* **Preset flow** (`/signup?pathway=run10k` → sign up → Steady, 45 min → first option of each question): `create-run10k.json`.
* **Custom flow** ("Bake sourdough bread at home" → Steady, 45 min → option, typed answer, skipped twice, option): `create-custom-sourdough.json`. A skipped question is sent as `"Skipped"`; `clarifiedOutcome` equals `rawGoal`.
* **Both:** headers `Content-Type: application/json`, `Accept: text/event-stream`, `Authorization: Bearer`. Commitment ids come from `Date.now()` and are normalised before comparing.

Step and history behaviour recorded (the redesign must be no worse):

| Situation | Behaviour today |
|---|---|
| Back and forward through steps 1–4 | Works; the goal text and every answer are kept |
| Back from step 1 | Leaves onboarding (previous page, or out of the app) |
| Back while the generation error shows | The history entry changes; the error screen stays (step 5 is locked) |
| Reload on a preset at step 2 | Stays on step 2 with the preset. The draft key was read without router state once and then removed, so a second reload lost the preset |
| Reload on a custom goal at step 2–4 | Returns to step 1 with an empty goal; later history entries remain |
| Forward into step 3 or 4 after that reload | **Blank page**: `popstate` skips `canJumpToStep` and the clarify result is gone |
| Reload during switch goal (user with a goal) | Redirects to `/dashboard`; the `switchGoal` router state was dropped by `replaceState`. The current goal is untouched |
| Clarify unreachable | Stays on Schedule with "Failed to fetch"; nothing crashes |

**Changed by M3.3 (ND-16):** forward into a step that can't be shown now lands on the furthest reachable step (and the entry is rewritten to match); a reload during switch goal stays in onboarding with the pathway, because history entries keep React Router's state; the draft key is kept until `/api/goal/create` succeeds, so every reload on a preset keeps it. A reload also rewrites the current entry to the step actually shown. Everything else in the table is unchanged.

### Decisions required before starting

* **OD-11: category step.** Career, Fitness, Learning, Creative, Business and Personal cover the 10 presets unevenly (Career and Personal are thin). The category step must map onto real presets; an empty category must never be shown.
* **ND-5: pathway copy.** Should titles and descriptions be rewritten in plain language (the Phase 1 carry-over)? Where does display copy live — the frontend `certifiedPresets.ts`, the backend presets, or a shared source? Rewriting display copy must not change the preset *matching* keys (`findPresetForGoal` matches on titles).
* **ND-6: custom goals before Phase 10.** Keep the free custom-goal entry exactly as today (the current behaviour, no regression), or de-emphasise it? It must not be locked until Phase 10 delivers a real server-side entitlement.

**Decided 2026-09-23 (M3.2):** OD-11 **A** (the six landing categories, in one shared data source; a one-pathway category goes straight to that pathway), ND-5 **A** (plain-language display fields in `certifiedPresets.ts`; titles and matching keys unchanged) and ND-6 **A** (custom goals free and visible, secondary to pathways, no lock or badge). See `docs/decisions.md`.

**Decided 2026-09-23 (after M3.1):** ND-13 **A** (custom goals do Schedule while clarify runs, then the questions; presets follow the spec order), ND-14 **A** ("success" = the editable clarified outcome plus the `success` question when present; all other questions are "starting point"), ND-15 **A** (one `PathwayLibrary` for all five in-app galleries) and ND-16 **A** (M3.3 fixes the blank step after a reload and the switch-goal reload; the draft key is cleared after a goal is created).

### In scope

* The A + B flow (BP §28):
  1. "Every achievement begins with a direction."
  2. Choose a category, then a pathway (or custom, per ND-6).
  3. "Tell us where you're starting."
  4. "Tell us what success looks like."
  5. Schedule and availability.
  6. Review.
  7. "We'll build your 90-day path."
* **Progressive disclosure.** Keep every question that feeds the payload; group, sequence and default them so the flow feels short (BP §29 — "make complex intelligence feel simple").
* **One pathway library component** (BP §24). Per ND-15 it replaces all five in-app galleries (the wizard grid, the `Home` gallery and strip, the `ExecutionDashboard` strip, and `PathwaysExplorerModal`, which becomes a Dialog around it). The landing page keeps its own presentation, but uses the same data source.
* **Step order** per ND-13 (custom goals: Schedule before the questions) and **question grouping** per ND-14.
* **Recorded bug fixes** per ND-16: the blank step after a reload, the switch-goal reload, and clearing the draft key after create.
* **Decomposing the wizard.** Split it into step components plus one state hook or reducer. **The payload stays identical** (R-4): capture baseline request bodies for a preset flow and a custom flow before refactoring, and compare after.
* **Browser history per step** preserved (R-18).
* **States:** clarify loading, clarify failure (with a fallback path that already exists or a retry), API offline, and a pre-filled review when arriving from a pathway.

### Out of scope

* The generation screen (Phase 4).
* Gating custom goals (Phase 10).
* Changing the questions the backend asks through `/clarify`.
* Changing how presets are matched or planned.

### Backend allowance

None. If ND-5 moves display copy to the backend presets, that is a **named** allowance that must be approved separately, limited to display strings.

### Files likely affected

* `frontend/src/components/OnboardingWizard.tsx` (decomposed into, for example, `frontend/src/components/onboarding/*`)
* `frontend/src/pages/OnboardingPage.tsx`
* `frontend/src/lib/certifiedPresets.ts`
* `frontend/src/components/PathwaysExplorerModal.tsx`
* `frontend/src/pages/Home.tsx` and `frontend/src/components/ExecutionDashboard.tsx` (gallery markup only, ND-15)
* `frontend/src/components/marketing/sections/Pathways.tsx` (data source only, OD-11)
* `frontend/src/types/index.ts` (types only)

### Milestones

| ID | Milestone |
|---|---|
| M3.1 | Baseline captured: request bodies for preset and custom flows; step and history behaviour recorded (done 2026-09-23) |
| M3.2 | OD-11, ND-5 and ND-6 decided (done 2026-09-23) |
| M3.3 | Wizard state extracted into a hook or reducer with no visual change; payload identical; the ND-16 fixes (done 2026-09-23: `components/onboarding/useOnboardingState.ts` and `payload.ts`; wizard 3,038 → 2,814 lines) |
| M3.4 | Step components split out with no visual change; payload identical (done 2026-09-23: `OnboardingWizard.tsx` is now a 233-line coordinator (was 2,814) over `components/onboarding/` step components plus `schedule.ts` and `questionFlow.ts`; rendered DOM identical at 1440 and 390 in 38 states; CSS bundle byte-identical) |
| M3.5 | New visual flow: direction → category → pathway → starting point → success → schedule → review (custom: Schedule before the questions, ND-13; grouping per ND-14) (done 2026-09-23: onboarding shell with a staircase progress rail on desktop and a progress bar on mobile; six directions with their pathways and the custom goal as a secondary path on one step; inline one-question screens replace the modal; a success step with the editable outcome; schedule, timeline (now keyboard-operable) and a commitment Dialog/sheet on the Phase 0 primitives; a review that ends in "Build my 90-day path". Payload identical to the M3.1 baseline, mocked and live. Generation screen unchanged) |
| M3.6 | Pathway library component; all five in-app galleries use it (ND-15) (done 2026-09-23: `components/pathways/` with `PathwayLibrary` (direction cards or tabs, then pathways as radios, then one action), `PathwayStrip`, `PathwayCustomGoal`, `usePathwaySelection` and `usePathwayLaunch`; onboarding, `Home` (no goal and strip), `ExecutionDashboard` and `PathwaysExplorerModal` use it; the landing page reads `PATHWAY_GROUPS`. Launch state and payload unchanged. See the M3.6 report below) |
| M3.7 | Every state (loading, clarify failure, offline, preset pre-fill) (done 2026-09-23: state matrix in the M3.7 report; classified clarify/create failures with plain copy and retry; connection notice; stale clarify answers ignored and a changed goal's questions dropped at once; leaving the schedule cancels a pending wait; a create retry after a lost connection can't build the plan twice; blank outcome falls back; commitment names required; 360 px question screens fixed; both `set-state-in-effect` errors fixed. Payload identical, mocked and live) |
| M3.8 | Regression and phase report (done 2026-09-23: regression matrix and before-and-after table below; R-2, R-3, R-4, R-15, R-16, R-17, R-18 pass mocked and live; preset, custom and switch-goal goals created end to end on the real backend, the old goal archived; double submit creates one goal; the real backend stopped during clarify and before Build; specs deterministic under `--repeat-each=3`; audits pass; unused legacy colours removed from `schedule.ts`; Phase 3 report written. Awaiting Mo's review) |

### Regression checks

R-2, R-3, R-4, R-15 (the switch-goal entry into onboarding), R-16, R-17, R-18.

### Mobile acceptance

3.7 applies, plus:

* One question per screen where the content is dense.
* Option lists are thumb-reachable.
* Back is always available and matches browser back.

### Validation

* Complete onboarding for a preset and a custom goal.
* Diff the request bodies against the M3.1 baseline.
* Use browser back and forward at every step.
* Reload mid-flow (document current behaviour; must not be worse).
* Arrive from a landing pathway.
* Switch goal from inside the app.
* Stop the backend during clarify.

### Exit criteria

* No question that feeds the payload has been lost.
* The payload is identical to the baseline.
* The wizard is no longer a single multi-thousand-line component.
* Only one pathway gallery implementation is used inside the app.

### Risks

* Silent payload drift during decomposition. Mitigate with the M3.1 baseline and step-by-step refactors (M3.3 and M3.4 change no visuals).
* Browser-history regressions (R-18).

### M3.6 report — Pathway Library (2026-09-23)

```text
ACHIVII REDESIGN — PHASE 3 — M3.6 REPORT

1. Outcome
   There is one pathway catalogue, one pathway library and one way to choose. Wherever a
   pathway is offered in the app (onboarding, Today without a goal, the Today and dashboard
   strips, and the explorer opened from the navbar, Today and the dashboard), the user picks
   a direction, then a pathway (a radio card), then confirms with a single action. A direction
   with one pathway selects it straight away. A goal of the user's own stays free and visible
   beneath the pathways. The landing page keeps its layout but reads the same groups and
   plain-language summaries. Pathway ids, titles, slugs, the launch state and the onboarding
   payload are unchanged.

2. What changed
   Catalogue (lib/certifiedPresets.ts)
   - The only pathway data. `direction` is the only grouping: the four-value `category` and
     the `tag` field are removed, and `PATHWAY_GROUPS` (via `groupPathways`) lists the six
     OD-11 directions that hold at least one pathway, so an empty one can't render.
   - New helpers: `pathwaysInDirection`, `findPathwayByTitle` (exact title, trimmed and
     case-insensitive). The old "current pathway" test, `rawGoal.includes(label)`, missed 6 of
     10 pathways and could match custom goals; it is replaced everywhere.
   - The interface is documented: `id` and `title` are frozen identity (slug and backend
     matching key, ND-5); `summary`, `badge`, `dailyMinutes` and `direction` are display.
   Shared module (components/pathways/)
   - `PathwayLibrary`: `navigation="cards"` (direction ChoiceCards, then that direction's
     pathways, then the action; the M3.5 onboarding interaction) or `navigation="tabs"`
     (Radix Tabs, one panel per direction, for dialogs). Pathways are ChoiceCards showing the
     title, summary, "Built on …", minutes a day, and "Current pathway" as a Badge. Props:
     `defaultSelectedId`, `selection` (lift selection to a parent), `currentId`, `action`,
     `customGoal`.
   - `usePathwaySelection` / `selectionForDirection`: direction plus selected id; changing
     direction clears the choice unless the direction has one pathway.
   - `PathwayStrip`: the compact form for screens with a goal. Every pathway in a swipeable
     row of single buttons (no nested controls), with the direction, summary, minutes and a
     "Current" badge; scroll buttons (44 px, disabled at the ends) and "Explore all". A tile
     opens the explorer with that pathway selected, so switching always ends at the same
     confirm step.
   - `PathwayCustomGoal`: the "Something else in mind?" section (ND-6).
   - `usePathwayLaunch` / `pathwayLaunch` / `CUSTOM_GOAL_LAUNCH`: the one launch. It writes
     or clears `achivii_draft_goal` and navigates with exactly the state the four copies sent.
   Screens
   - Onboarding `StepGoal`: composes `PathwayLibrary` and `PathwayCustomGoal` (same copy,
     roles and keyboard order as M3.5). `StepReview` uses `findPathwayByTitle`.
   - `Home`, no goal: the library replaces the legacy searchable gallery, in a `ui-root`
     screen ("Choose a pathway"), with "Describe my own goal" as the custom route.
   - `Home` and `ExecutionDashboard`, with a goal: `PathwayStrip` replaces the six-card
     strips and their "Switch" buttons. "Explore Goals (10)" opens the explorer.
   - `PathwaysExplorerModal`: a Dialog (a bottom sheet under 768 px) around the tabbed
     library, with Cancel and one primary action: "Start this pathway" (no goal), "Switch to
     this pathway", or "Restart this pathway" (current one selected). With a goal, it says the
     current journey stays as it is until a new one is set up. Each opening starts fresh from
     the pathway it was opened on. Same props for `Navbar` plus `initialPathwayId`.
   - Landing `Pathways.tsx`: the hard-coded groups are gone; it renders `PATHWAY_GROUPS`
     (largest first, for the three-column grid) with `summary` instead of the jargon `desc`.
     Links are still `/signup?pathway=<id>`.
   - Tabs: `TabsTrigger` draws the new `.focus-ring-inset`, so the scrolling list no longer
     clips the ring (Design.md §3 and Tabs updated).

3. Files changed / created / removed
   Created: frontend/src/components/pathways/{PathwayLibrary.tsx, PathwayStrip.tsx,
     PathwayCustomGoal.tsx, usePathwaySelection.ts, launch.ts, index.ts}
   Created (tests): src/lib/certifiedPresets.test.ts, src/lib/pathwayCatalogue.guard.test.ts,
     src/components/pathways/{PathwayLibrary,PathwayStrip}.test.tsx,
     src/components/pathways/launch.test.tsx, src/components/PathwaysExplorerModal.test.tsx,
     src/components/onboarding/StepGoal.test.tsx,
     src/components/marketing/sections/Pathways.test.tsx, e2e/pathways.spec.ts
   Changed: src/lib/certifiedPresets.ts (275 → 322 lines; data values unchanged apart from
     the removed category/tag), src/components/PathwaysExplorerModal.tsx (208 → 84),
     src/pages/Home.tsx (806 → 586), src/components/ExecutionDashboard.tsx (1,315 → 1,228),
     src/components/onboarding/StepGoal.tsx, src/components/onboarding/StepReview.tsx,
     src/components/marketing/sections/Pathways.tsx, src/components/ui/Tabs.tsx,
     src/index.css (.focus-ring-inset), src/test/setup.ts (jsdom stubs for matchMedia and
     scrollIntoView), e2e/onboarding.spec.ts (switch-goal test uses the new explorer),
     Design.md, docs/phases.md
   Removed: nothing. Backend: no files touched.

4. Functionality preserved
   R-2  Goal creation: "a pathway chosen inside onboarding" and "a custom goal" mocked specs
        replay the M3.1 baseline bodies; both live specs pass against the real backend.
   R-3  Preset launch: every entry sends { presetGoal: title, isPreset: true, switchGoal:
        true } and writes the draft key, the same as the four removed copies (unit test on
        pathwayLaunch; Home, Today strip, explorer and dashboard e2e land on "Where are you
        starting?" with the pathway and a clarify body of { rawGoal: title }).
   R-15 Switch goal: from the explorer and from a strip tile, onboarding opens with the new
        pathway, no DELETE is sent and nothing is created; back returns to Today with the
        current goal still marked; a reload stays in onboarding (existing test, now stricter:
        it switches to a different pathway and checks the exact draft). Archive-on-create is
        backend behaviour and unchanged; not re-run live in M3.6.
   R-16 Signup handoff: unit test asserts resolvePostAuthDestination(pathway) equals
        pathwayLaunch(pathway); auth.spec landing → /signup?pathway=run10k → onboarding and
        the live landing-pathway spec pass.
   R-4, R-18 (touched through StepGoal): all onboarding payload and history specs pass
        unchanged, including back/forward and reload.
   Also: current-goal protection (signed-in /login?pathway keeps the goal), browser history
   (back/forward from Home and Today into onboarding), modal open/close with Escape and
   Cancel and focus return.

5. Decisions applied (docs/decisions.md)
   OD-11 A (§ OD-11): six directions from one source; a one-pathway direction selects its
     pathway; an empty direction never renders (groupPathways; unit tested with a reduced list).
   ND-5 A (§ ND-5): plain-language `summary` shown everywhere, including the landing page;
     ids, titles, slugs and backend matching untouched (identity snapshot test).
   ND-6 A (§ ND-6): custom goal visible on onboarding and Home, secondary to the pathways,
     never locked; tests assert no lock, price or premium text.
   ND-15 A (§ ND-15): one library for all five in-app galleries; the modal is a Dialog
     around it; a source-scan test fails if pathway titles, id lists or the old categories
     appear outside the catalogue.

6. Validation evidence
   - Type-check (tsc --noEmit): clean. Build (tsc && vite build): passes; only the existing
     500 KB chunk warning.
   - Lint: every new and changed pathway file is clean. Home.tsx and ExecutionDashboard.tsx
     show the same 7 errors and 2 warnings as at HEAD (same rules, unrelated code).
   - Vitest: 133 passed in 19 files (43 new), no warnings.
   - Playwright, mocked: 93 passed, 3 skipped (the existing project-specific skips), desktop
     1440 and mobile 390. e2e/pathways.spec.ts adds 10 tests per project: Home selection and
     start, one-pathway direction, custom goal, Home at 390 and 360 (no overflow, 44 px
     targets, axe), reduced motion, strip → explorer → switch with back/forward, "Explore
     all" and Cancel with focus return, strip and sheet at 390 and 360 (44 px targets, axe),
     navbar entry (desktop "Pathways (10)", mobile "Goals"), dashboard strip.
   - Playwright, live (LIVE_API=1, desktop): 2 passed.
   - Browser screenshots at 1440, 390 and 360: Home library, Today strip, explorer dialog
     and sheet; keyboard focus visible on tabs and panels; no console errors (every spec
     asserts this).

7. Carry-overs
   - Navbar goal links overflow by 7 px at 360 px with an active goal (pre-existing;
     Navbar untouched) → Phase 5 (app shell).
   - Hard-coded "10" in "Explore Goals (10)", "Pathways (10)", "Explore 10 Pathways" and the
     landing "Ten journeys" → Phase 5 naming pass (landing: Phase 12).
   - Undisplayed expert fields in the catalogue (`outcome`, `desc`, `coach`, `p1`–`p3`,
     `sampleDay`) → Phase 4 decides whether generation shows the method; else Phase 12.
   - `SaaSBuilderModal.tsx` is unused (its own SaaS starter list, not pathways) → Phase 12.
   - The strip sits inside the legacy Today and dashboard layouts → Phase 5.

8. Issues and risks found
   - For Mo's review: the Home gallery's search box and the four-category filter are gone;
     with 10 pathways in six directions (at most 3 each), direction navigation replaces them.
   - For Mo's review: a strip tile used to switch immediately; it now opens the explorer on
     that pathway, so switching takes one more, deliberate, click and always shows the
     reassurance copy.
   - Landing group order is now largest first (Creative, Fitness, Learning, Career,
     Business, Personal); Business and Career swapped places.
   - The explorer doesn't offer a custom goal (as before); onboarding and Home do.

9. Not started
   M3.7 has NOT started.
   Phase 4 — Journey Generation has NOT started.
```

### M3.7 state matrix (2026-09-23)

Built from `useOnboardingState.ts` and the step components after M3.7. "Kept" means held in memory on this page; nothing in onboarding is saved on the server until the plan is created, except the draft goal in `localStorage`.

| State | Trigger | What the user sees | Available action | Data preserved | Recovery |
|---|---|---|---|---|---|
| Normal entry | `/onboarding` without launch state | "Where are you going?": directions, pathways, custom goal (ND-6) | Start a pathway, or continue with own goal | — | Back leaves onboarding (R-18) |
| Preset pre-fill | Launch state `{ presetGoal, isPreset, switchGoal }` or the draft key | Starting point with the pathway in "Your goal"; questions loading, then the first | Answer; Change goal; Back | Draft key | Reload returns here with the pathway |
| Custom entry | Own goal submitted | Schedule while clarify runs (ND-13) | Fill the schedule; Change goal | Goal text | Change returns to the goal step with the text |
| Clarify loading | Request in flight | "Preparing your questions" skeleton (`role="status"`); on the schedule, a busy Continue and "Preparing your questions. Your schedule is kept while you wait." | Back, Change goal, keep editing the schedule | Everything entered | Continue can't pass until the questions are back |
| Clarify success | Response for the current goal | First question, focused | Answer, type, skip | — | — |
| Clarify failed (Achivii) | 4xx/5xx | Alert "We couldn't prepare your questions" with Achivii's message (schedule: "Your schedule is kept.") | Try again; custom: Continue also retries; Back; Change goal | Goal, schedule, commitments, draft | Retry sends the same goal once |
| Achivii unreachable | Network failure, or the health check failed at load | Alert "We can't reach Achivii right now" on the step that needs it; elsewhere a notice: "You can keep going, and your answers stay on this page, but your questions and your plan need a connection." | Try again; keep filling in | As above | Notice clears once any request succeeds |
| Retry | Try again, or Continue after a failure | Loading again | — | Everything | Only the latest response is applied; no second request while one is in flight |
| Changed goal mid-flight | Change goal while clarify runs | The old goal's questions and answers are dropped at once | — | New goal text | A late answer for the old goal is ignored |
| Waiting, then Back | Back or browser back from the schedule while waiting | The step the user chose | — | Schedule | The questions arriving later don't pull the user forward |
| Skipped question | Skip this, then Skip anyway | Reworded question, then "You skipped this one" | Answer anyway | `"Skipped"` in the payload (unchanged) | — |
| Editable outcome | Edit outcome | Focused textarea; Done | Edit | Kept across Back/Forward and to review and payload | A blank edit falls back to clarify's outcome |
| Schedule | Days and minutes not chosen | Continue disabled, with the reason as a status | Choose | — | — |
| Commitment editor | Add or Edit | Dialog, a bottom sheet under 768 px | Done, Cancel, Escape, Delete | Cancel and Escape discard edits | A blank name is caught; focus returns to the opener (or the heading when it's gone) |
| Review | Every step complete | Summary with an Edit per section | Build my 90-day path | — | Edit returns to that step |
| Generation handoff | Build | Generation screen (unchanged, Phase 4) | — | One request (double click guarded) | — |
| Generation failed (Achivii) | Error event or 4xx/5xx | "We couldn't build your plan", Achivii's message (including safety refusals), "No plan was made, and your current journey, if you have one, is unchanged." | Try again; Review your answers | Answers, schedule, draft | Try again sends once more |
| Connection lost while building | Network failure | "We lost the connection. Your plan wasn't confirmed… We'll check whether it was created before building it again." | Try again; Review your answers | As above | Before re-sending, the active goal is checked; a plan the server finished is used, not built twice |
| Reload | Browser reload | Pathway: its first question step; custom: the goal step (M3.3) | — | Draft key | — |
| Reachable-step recovery | Forward into a step whose data is gone | The furthest reachable step; the entry is rewritten | — | — | No blank step |
| Switch-goal entry | Launch from the app with an active goal | Onboarding, admitted by `switchGoal` | — | Current goal untouched: no DELETE, no create until Build | Reload stays in onboarding |
| Draft goal | Launch or signup handoff | — | — | Kept through reloads, signup and every failure | Cleared only after a plan is created or recovered |

### M3.7 report — Onboarding states and hardening (2026-09-23)

```text
ACHIVII REDESIGN — PHASE 3 — M3.7 REPORT

1. Outcome
   Every onboarding state now has a deliberate, honest treatment (see the state matrix above).
   The user can tell "Achivii can't be reached" from "Achivii couldn't prepare your
   questions" and from "we couldn't build your plan", never sees a raw browser error, and
   always has a way on: retry, go back, change the goal, or review answers. Retries keep
   every answer, send one request, and can't build the plan twice after a lost connection.
   The first answer on a question step now starts above the footer at 360 px. The flow,
   questions, payload and history are otherwise as M3.5 left them.

2. What changed
   State (components/onboarding/useOnboardingState.ts)
   - Stale-response guard: only the latest clarify request may change state.
   - A new goal drops the previous goal's questions and answers immediately. Before, a
     failed clarify after a goal change could leave the review step blank.
   - The same goal is never sent twice while it is still being prepared; clarify on mount
     runs once, even under StrictMode's double effects.
   - Leaving the schedule cancels a pending wait. Before, the questions arriving later could
     pull a user who had gone Back forward to the starting point.
   - Errors are objects ({ kind, title, message }) from requestErrors.ts, and a `connection`
     value ('unknown' | 'online' | 'offline') is kept from request results.
   - Create: after a lost connection, the active goal is checked (GET /api/goal/active,
     existing endpoint) before offering or sending a retry; a goal that is not the one active
     when onboarding opened, with the same goal text, is taken as the plan the server
     finished. Skipped when the current goal is unknown (its load failed).
   - A blank edited outcome falls back to clarify's when the step is left.
   - Lint: both `react-hooks/set-state-in-effect` errors fixed without disables. The mount
     effect now only sends the request (the "clarifying" state is initialised); the effect
     that left the schedule became part of the clarify callback, reading the current step
     through a ref refreshed after every render. Timing test first: the hook tests below.
   Copy and UI
   - requestErrors.ts: network failures → offline copy; Achivii's own messages (written for
     users, including safety refusals) shown; parsing and programming errors → plain copy.
   - ConnectionNotice (StepLayout): shown when the health check failed or the last request
     couldn't reach Achivii, except where the step's own alert already says so.
   - StepQuestions, StepSchedule: classified error titles and messages; the waiting copy no
     longer promises "a few seconds".
   - StepGeneration (legacy, Phase 4): only the failure copy changed. It no longer claims
     "Both AI providers were temporarily unavailable" for every failure or prints the raw
     error. It is announced (role="alert"), buttons are 44 px ("Review your answers",
     "Try again").
   - CommitmentEditor: Done with a blank name shows a field error and focuses the name.
   - 360 px: StepHeader `compact` (starting point and success only): below 640 px the
     eyebrow (already named by the progress bar) is hidden and the description is left to
     screen readers; the gap above the question is 32 px instead of 48. Tablet and desktop
     unchanged. Measured at 360×740: the first answer's top moved from 702 px (under the
     footer at 626 px) to about 580 px.
   - OnboardingPage passes `currentGoalId` and `apiOffline` from GoalContext (read only).

3. Files changed / created / removed
   Created: src/components/onboarding/requestErrors.ts; tests:
     src/components/onboarding/{requestErrors.test.ts, useOnboardingState.test.tsx,
     CommitmentEditor.test.tsx}, e2e/onboardingStates.spec.ts
   Changed: src/components/onboarding/{useOnboardingState.ts, StepLayout.tsx,
     StepQuestions.tsx, StepSuccess.tsx, StepSchedule.tsx, StepGeneration.tsx,
     CommitmentEditor.tsx}, src/components/OnboardingWizard.tsx, src/pages/OnboardingPage.tsx,
     e2e/mockApi.ts (new failure options; existing ones unchanged), e2e/onboarding.spec.ts,
     docs/phases.md
   Removed: nothing. Backend, API client, GoalContext, AuthContext and the M3.1 fixtures:
     untouched.
   Test changes: two assertions in e2e/onboarding.spec.ts ("a clarify failure keeps the user
     on the schedule step", "a pathway whose clarify fails offers a retry") expected "We
     couldn't prepare your questions" for a refused connection; that copy is now reserved for
     failures on Achivii's side, so they expect "We can't reach Achivii right now" and also
     assert that "Failed to fetch" never appears. Their behavioural assertions are unchanged.

4. Functionality preserved
   R-2  Preset and custom onboarding complete; the plan is created (mocked, and live up to
        the recorded create request).
   R-3  Pathway launch from landing (signup), Home and Today lands on the starting point
        with the preset; clarify body { rawGoal: title }.
   R-4  Both M3.1 baseline payload specs pass unchanged (mocked and live); a retried create
        sends the identical body; "Skipped" unchanged.
   R-15 Switch goal: no DELETE and no create until Build; reload stays in onboarding.
   R-16 Draft through signup, reloads, clarify failure and create failure; cleared after a
        created or recovered plan (unit and e2e).
   R-17 Navbar indicator unchanged; onboarding adds its own notice.
   R-18 All history specs pass; Back/Forward keep answers and the edited outcome; a pending
        wait no longer overrides Back.

5. Decisions applied (docs/decisions.md)
   ND-13 (order unchanged; custom schedule stays usable while clarify fails), ND-14
   (grouping unchanged), ND-16 (draft kept until create; reachable-step recovery), ND-6
   (custom goal untouched and free), OD-11 / ND-5 / ND-15 (pathway entry from M3.6
   unchanged). No new decisions.

6. Validation evidence
   - Type-check: clean. Build: passes (existing 500 KB chunk warning only).
   - ESLint: src/components/onboarding, OnboardingWizard, OnboardingPage and the changed
     e2e files are clean (the onboarding folder had 2 errors before M3.7).
   - Vitest: 156 passed in 22 files (23 new: hook timing and state tests under StrictMode,
     error classification, commitment editor).
   - Playwright, mocked: 117 passed, 3 skipped (existing project skips), desktop 1440 and
     mobile 390. onboardingStates.spec.ts adds 12 per project: custom clarify offline →
     recovery (2 requests, schedule kept, Back/Forward), pathway clarify failure → reload
     (draft kept) → retry after recovery, Achivii error message, wait cancelled by Back,
     offline notice (axe) clearing after a success, create failure → review → retry (2
     identical bodies, draft cleared), lost connection → finished plan recovered (1 create),
     lost connection with nothing finished (honest copy, draft kept), edited outcome through
     Back/Forward into the payload, blank outcome, commitment sheet (blank name, Cancel,
     Escape, focus return, no scroll lock left), 360 px first answer above the footer.
   - Playwright, live (LIVE_API=1, desktop): 2 passed. The preset test failed once at the
     redirect straight after the real sign-up (before onboarding code runs) and passed on
     the re-run; consistent with the recorded intermittent forced sign-out.
   - Browser screenshots at 1440, 390 and 360: offline notice, pathway clarify offline,
     question step, schedule clarify error. Consoles clean (asserted by every spec).

7. Carry-overs
   - The generation screen keeps its legacy look; only its failure copy changed → Phase 4.
   - Choosing a pathway inside onboarding doesn't write the draft key, so a reload returns
     to the goal step (M3.3 behaviour, unchanged); custom answers live only on the page → M3.8
     to confirm, or a decision for Mo.
   - Recovery after a lost connection is skipped when the current goal failed to load; a
     retry then could create a second goal (the first archived) → Phase 5 (goal-load error
     state) removes the case.
   - Soft-keyboard states can't be emulated in Playwright; the footer is sticky, not fixed
     → Phase 11 on-device check.
   - The navbar's Offline chip is a one-time check and stays after recovery (existing
     Phase 12 row).

8. Issues and risks found
   - Fixed (found by reading the flow, then covered by tests): blank review after a goal
     change and a failed clarify; the pending wait pulling
     a user forward after Back; a late clarify answer for an old goal overwriting the new
     one; duplicate clarify on mount in development; commitments with blank names; the
     generation failure claiming AI providers were down for a network error.
   - The 360 px compaction hides the step description visually on phones for the two
     question steps (kept for screen readers); judged a net gain, but it is a small visual
     change to M3.5.
   - The schedule's clarify alert sits below the long schedule on phones. It is announced
     immediately and Continue retries, so it was left in place.

9. Not started
   M3.8 has NOT started.
   Phase 4 — Journey Generation has NOT started.
```

### M3.8 regression matrix (2026-09-23)

Every row below was run in this milestone. Mocked Playwright is `npx playwright test` (desktop 1440 and mobile 390): 117 passed, 3 skipped. The onboarding, state and pathway specs with `--repeat-each=3` on both projects: 231 passed, 3 skipped, 0 failed, 0 flaky. Live is `LIVE_API=1`, desktop, three runs, 6 of 6 passed. "Manual" is a throwaway script against the real backend and real AI generation (logs outside the repo, not committed). The generation screen was only observed.

| Check | Result | Evidence |
|---|---|---|
| R-2 preset onboarding creates a plan | Pass | `onboarding.spec.ts` preset baseline; live suite preset (3 runs); manual preset create, generation 29 s, lands on `/dashboard` |
| R-2 custom onboarding creates a plan | Pass | `onboarding.spec.ts` custom baseline; live suite custom (3 runs); manual custom create, generation 48 s |
| R-3 landing → signup → onboarding | Pass | `auth.spec.ts` pathway sign-up; `onboarding.spec.ts` landing pathway; live suite preset through a real sign-up |
| R-3 Home without a goal | Pass | `pathways.spec.ts` Home directions, one-pathway direction, custom goal (ND-6), axe, reduced motion |
| R-3 Today strip | Pass | `pathways.spec.ts` strip tile opens the explorer on that pathway; manual switch from the Today strip |
| R-3 dashboard strip | Pass | `pathways.spec.ts` dashboard strip and explorer |
| R-3 explorer from the navbar | Pass | `pathways.spec.ts` navbar opens the same explorer |
| R-3 existing user with a goal, `?pathway=` | Pass | `auth.spec.ts` sign-in with a goal goes to Today and the pathway does not replace it |
| R-4 preset payload, mocked | Pass | `onboarding.spec.ts` both landing and in-onboarding pathway bodies match `create-run10k.json`; commitment ids normalised |
| R-4 custom payload, mocked, including `"Skipped"` | Pass | `onboarding.spec.ts` matches `create-custom-sourdough.json` |
| R-4 both payloads, live | Pass | `onboarding.live.spec.ts`: preset exact match, custom shape match; 3 green runs |
| R-4 retried create | Pass | `onboardingStates.spec.ts` failed build retries once with the same body; hook test for the lost-connection retry |
| R-15 no DELETE and no create before Build | Pass | `onboarding.spec.ts` switch goal; `pathways.spec.ts` Today switch; manual switch (no DELETE, no create until Build) |
| R-15 abandon leaves the original goal | Pass | Manual: Back out of switch, and closing the tab mid-onboarding; the original goal stayed active and no create was sent |
| R-15 after Build the previous goal is archived | Pass | Manual switch: new goal active after reload; the previous goal `archived` in the database, not deleted |
| R-16 draft through signup, reloads and failures | Pass | `onboarding.spec.ts` saved pathway; `onboardingStates.spec.ts` draft kept across clarify and create failure; live suite |
| R-16 draft cleared after create | Pass | `onboarding.spec.ts`; hook test; manual preset, custom and retried create (draft gone, active goal returned by `GET /api/goal/active`) |
| R-17 navbar Offline chip unchanged | Pass | Manual: chip absent after the backend was stopped on an already-loaded page (it is a one-time check). Not fixed |
| R-18 Back and Forward, both orders | Pass | `onboarding.spec.ts` custom and preset orders; browser check at 1440 and 360: UI Back and browser Back both reach the previous step when the step was entered going forward |
| R-18 Back from the first step | Pass | Leaves onboarding. Same as M3.1 |
| R-18 Back and Forward while a generation error shows | Pass | Generation locks history: the URL stays `/onboarding` and the error stays. Same as M3.1 |
| R-18 Forward into a step whose data is gone | Pass | `onboarding.spec.ts` lands on the furthest reachable step. No blank page |
| R-1 | Not exercised as a change | Live sign-up used the existing auth flow. Auth code was not changed |
| Exit: no payload-feeding question lost | Pass, with one recorded exception | Custom ids are always `current_level`, `success`, `equipment`, `obstacle`. Nine pathways return their own three questions in preset-source order, and the 10K questions equal the M3.1 fixture. The TED-style speech pathway is not matched by the backend and gets the custom four (present before Phase 3; Phase 4, needs Mo) |
| Exit: payload identical, mocked and live, including a retry | Pass | R-4 rows above |
| Exit: wizard is no longer one multi-thousand-line file | Pass | `OnboardingWizard.tsx` is 311 lines (was 3,038). Largest successors: `schedule.ts` 419 (calculation only; was 500), `useOnboardingState.ts` 385, `RoutineTimeline.tsx` 304 |
| Exit: only one pathway gallery | Pass | `pathwayCatalogue.guard.test.ts`; onboarding, Home, Today, the dashboard and the explorer all use `components/pathways/` |
| M3.7 state: normal entry | Pass | Goal step "Where are you going?"; reload probe |
| M3.7 state: preset pre-fill | Pass | `onboarding.spec.ts` reload keeps the preset; reload probe |
| M3.7 state: custom entry | Pass | `onboarding.spec.ts` custom flow |
| M3.7 state: clarify loading | Pass | Hook test; `onboardingStates.spec.ts` wait cancelled by Back (`waitForTimeout` 300 ms to prove the user was not pulled forward) |
| M3.7 state: clarify success | Pass | Both payload specs |
| M3.7 state: clarify failed (Achivii) | Pass | `onboardingStates.spec.ts` shows Achivii's own message |
| M3.7 state: Achivii unreachable | Pass | `onboardingStates.spec.ts`; manual backend process killed during clarify (pathway and custom): "We can't reach Achivii right now", schedule kept, no "Failed to fetch" |
| M3.7 state: retry | Pass | `onboardingStates.spec.ts`; manual restart then Try again shows the questions |
| M3.7 state: changed goal mid-flight | Pass | Hook tests: stale answer ignored; previous questions dropped at once |
| M3.7 state: waiting, then Back | Pass | `onboardingStates.spec.ts` and the matching hook test |
| M3.7 state: skipped question | Pass | Custom payload sends `"Skipped"`; manual custom flow skipped one question |
| M3.7 state: editable outcome | Pass | `onboardingStates.spec.ts` Back/Forward and blank fallback |
| M3.7 state: schedule | Pass | Continue disabled until days and minutes are chosen (`onboarding.spec.ts`) |
| M3.7 state: commitment editor | Pass | `onboarding.spec.ts` body shape; `onboardingStates.spec.ts` blank name, Cancel, Escape, focus return |
| M3.7 state: review | Pass | Both flows reach review and build from it |
| M3.7 state: generation handoff | Pass | Double click sends one create (`onboarding.spec.ts`, `waitForTimeout` 500 ms to prove no second request; hook test; manual custom double click: exactly one goal) |
| M3.7 state: generation failed | Pass | `onboardingStates.spec.ts` honest copy, answers and draft kept, one retry. Screen look is Phase 4 |
| M3.7 state: connection lost while building | Pass | `onboardingStates.spec.ts` recovered plan and nothing-finished; manual Build with the backend stopped, then one retry after restart |
| M3.7 state: reload | Pass | Reload probe, below |
| M3.7 state: reachable-step recovery | Pass | `onboarding.spec.ts` |
| M3.7 state: switch-goal entry | Pass | `onboarding.spec.ts` (desktop; mobile skip is the known project skip); reload probe; manual |
| M3.7 state: draft goal | Pass | `onboarding.spec.ts`; reload twice, below |
| In scope: A+B flow, progressive disclosure, one library, ND-13, ND-14, ND-16, decomposition, history, states | Pass | Delivered. The generation screen is out of scope; only its failure copy changed (M3.7) |
| Copy audit (3.4, 3.5) | Pass | No analytics, notifications, payments, AI chat, multiple goals or proof judging. "90 days" throughout. No "failed / behind / missed" aimed at the person, no raw errors, no fake percentages |
| Design-system audit of Phase 3 surfaces | Pass | One cleanup: unused colour strings removed from `schedule.ts`. Remaining legacy hex, raw buttons and radii are on `StepGeneration.tsx` (Phase 4) and the landing page (Phase 1). `OnboardingProgress` and `PathwayStrip` use a raw button because each is one control, not a nested button |
| Accessibility | Pass on Phase 3 surfaces | axe (WCAG 2.2 AA tags) at 1440, 390 and 360 on every onboarding state and on Home, the strip (scrolled into view), the explorer and the landing Pathways section. Keyboard-only: both flows, the timeline, the commitment sheet (trap, Escape restores the opener) and the strip. Live regions announced once. Generation-screen contrast, missing `main` and sub-44 targets are Phase 4. Navbar targets and the 7 px overflow at 360 with a goal are Phase 5 |
| Reduced motion | Pass | `onboarding.spec.ts` and `pathways.spec.ts`. With `prefers-reduced-motion`, step content is fully visible once animations settle; the sheet duration is effectively zero |
| Mobile 390 and 360 | Pass | Every onboarding step: no overflow, targets at least 44×44, one question per screen, Back present. Commitment sheet scrolls inside itself with the page scroll-locked. First answer sits 70 px above the footer at 360×740. `/roadmap` overflow and the navbar are carry-overs |
| Console | Pass | Specs assert no unexpected console errors. Live runs showed only the known `FullDayVisualizer` nested-button warning (Phase 5) |
| Landing Pathways links | Pass | Ten links to `/signup?pathway=<id>`, unchanged; the section passes axe; no overflow and no sub-44 links at 360 |

### Before and after, against the M3.1 baseline (2026-09-23)

Reload rows are from a mocked desktop probe that started each case from `/` (a same-URL reload inherits the current history entry, so that one contaminated row was discarded). Nothing is worse than M3.1.

| Situation | At M3.1 | Now | Verdict |
|---|---|---|---|
| Back and Forward through the steps | Goal text and every answer kept | Both orders, UI Back and browser Back, at 1440 and 360: the previous step, answers kept | Same |
| Back from the first step | Leaves onboarding | Leaves onboarding | Same |
| Back and Forward while the generation error shows | The history entry changes; the error screen stays | The URL stays `/onboarding` and the error stays (generation locks history) | Same |
| UI Back, then browser Back immediately | The UI Back already pushed an entry, so browser Back returned to the step just left | Unchanged. Both reach the true previous step when the step was entered going forward. Carried to Phase 11 | Same |
| Reload on a launched pathway, starting point | Stayed on that step with the preset. A second reload lost the preset | Stays on "Where are you starting?" with the draft `Run a 10K Under 50 Minutes`, including a second reload | Better |
| Reload on a launched pathway at success, schedule and review | The draft was removed on read, so a later reload lost the preset | Returns to "Where are you starting?" with the pathway and the draft kept. Answers from later steps live on the page, as they did | Better |
| Reload during switch goal, twice | Redirected to `/dashboard`. The current goal was untouched | Stays on `/onboarding` at "Where are you starting?". No DELETE | Better |
| Forward into a step whose data is gone | Blank page | The furthest reachable step; the entry is rewritten | Better |
| Clarify unreachable | Stayed on Schedule with "Failed to fetch" | "We can't reach Achivii right now". The schedule is kept. No raw error | Better |
| Reload on a pathway chosen inside onboarding, every step (goal, starting, success, schedule, review) | An in-page choice wrote no draft, so a reload returned to the first step | Returns to "Where are you going?" with an empty goal and no draft. Confirmed behaviour (M3.7 review, ND-16) | Same |
| Reload on a custom goal, every step (goal, schedule, starting, success, review) | Returned to step 1 with an empty goal | Returns to "Where are you going?" with an empty goal field and no draft | Same |

### Phase 3 report (2026-09-23)

```text
ACHIVII REDESIGN — PHASE 3 REPORT

1. Outcome
   Choosing a goal is now a guided flow: a direction, then a pathway or a goal of your
   own, then where you are starting, what success looks like, when you can make time,
   and a review that builds the 90-day path. The same pathway library is used everywhere
   a pathway can be chosen. Failures say what happened and offer a way on, and a reload
   no longer loses a launched pathway or shows a blank step. The plan that is sent is
   the same one the M3.1 baseline recorded.

2. What changed
   Onboarding (M3.3–M3.5, M3.7)
   - The 3,038-line wizard is a 311-line coordinator over components/onboarding/.
   - Order (ND-13): pathway goal → starting → success → schedule → review; custom
     goal → schedule (while clarify runs) → starting → success → review; then the
     legacy generation screen.
   - Grouping (ND-14): success is the editable outcome plus the success question.
   - History (ND-16, R-18): each step pushes wizardStep and keeps React Router's state;
     a step whose data is gone falls back to the furthest reachable step; generation
     locks history. The UI Back button still pushes, as it did at M3.1.
   - Failures are classified (requestErrors.ts). A connection notice covers the steps
     that don't already have their own alert. A create retry after a lost connection
     checks the active goal first. Commitment names are required. Question steps use
     the compact header below 640 px.
   Pathways (M3.6)
   - One catalogue (certifiedPresets.ts, direction only) and one library
     (components/pathways/), used by onboarding, Home without a goal, the Today and
     dashboard strips, and the explorer Dialog. The landing page reads PATHWAY_GROUPS.
   - A strip tile opens the explorer on that pathway. Home no longer has a search box
     or a four-category filter. Both were accepted at the M3.6 review.
   M3.8
   - Regression, the audits and this report. One cleanup: schedule.ts lost the colour
     strings nothing has read since M3.5 (500 → 419 lines). Calculation unchanged.

3. Files changed / created / removed
   Phase 3 commit 3097016: 67 files, +7,279 / −3,680, no backend files. Working tree
   on top of it: schedule.ts (this cleanup), docs/phases.md, docs/decisions.md,
   Design.md.
   Created: components/onboarding/ (state, payload, steps, questions, schedule, each
   step, tests), components/pathways/, e2e/onboarding.spec.ts, e2e/onboardingStates.spec.ts,
   e2e/pathways.spec.ts, e2e/onboardingFlow.ts, e2e/live/onboarding.live.spec.ts,
   e2e/fixtures/onboarding/ (the four M3.1 fixtures, unchanged since they were recorded),
   lib/pathwayCatalogue.guard.test.ts.
   Changed: OnboardingWizard.tsx, OnboardingPage.tsx, certifiedPresets.ts,
   PathwaysExplorerModal.tsx, Home.tsx and ExecutionDashboard.tsx (gallery markup),
   marketing/sections/Pathways.tsx (data source), Dialog.tsx, Tabs.tsx, Choice.tsx,
   mockApi.ts (failure options; defaults unchanged).
   Removed: the quiz modal, the second category system, the five separate galleries.
   Backend, API contracts, GoalContext, AuthContext and the generation screen's
   behaviour: untouched. M3.7 changed only the generation failure copy.

4. Functionality preserved
   R-2   Preset and custom plans created. Mocked specs, live suite (3 runs) and manual
         end-to-end creates on the real backend.
   R-3   Every in-app entry (onboarding, Home, Today, dashboard, navbar explorer) and
         the landing → signup handoff. An existing user with a goal keeps that goal.
   R-4   Both M3.1 bodies match mocked and live, including a retried create. Commitment
         ids are normalised. "Skipped" is unchanged.
   R-15  No DELETE and no create before Build. Abandoning (Back, or closing the tab)
         leaves the original goal active. After Build the previous goal is archived.
   R-16  The draft key survives signup, reloads and failures, and is cleared once a
         plan is created or recovered.
   R-17  The navbar Offline chip is still a one-time health check. Verified, not fixed.
   R-18  Back and Forward keep every answer in both orders. A missing step recovers.
         Generation stays locked on its error.
   R-1   Not modified. Live sign-up used the existing auth flow.

5. Decisions applied (docs/decisions.md)
   OD-11 A, ND-5 A, ND-6 A, ND-13 A, ND-14 A, ND-15 A, ND-16 A. Each matches what
   shipped; confirmed in the decisions.md changelog at M3.8, without new decision ids.
   M3.7 review outcomes, logged there rather than as new decisions:
   - A pathway chosen inside onboarding does not write the draft key (ND-16 reviewed
     note). Confirmed by reloading every step.
   - The compact question header at 360 px is accepted, and documented in Design.md.
   - The Home search box and four-category filter stay removed, and a strip tile opens
     the explorer. The section 6 row is closed.
   OD-8 is still open and blocks Phase 4. It was not decided.

6. Validation evidence
   - Type-check: clean.
   - Vitest: 156 passed in 22 files.
   - ESLint: clean on all 57 Phase 3 files other than Home and ExecutionDashboard,
     which keep exactly their pre-Phase-3 rules. Full lint: 30 errors, 4 warnings in
     11 files (3.11). OnboardingWizard was a baseline file and is now clean.
   - Build: main JS 565.85 KB (166.99 KB gzipped), +4.95 KB since the M3.5 560.90 KB.
     CSS 102.48 KB (17.89 KB gzipped). The chunk warning remains (Phase 12).
   - Playwright mocked: 117 passed, 3 skipped. --repeat-each=3 on the three Phase 3
     specs, both projects: 231 passed, 3 skipped, 0 flaky. No .only. No retries added.
     The three skips are the known project skips (auth keyboard order is desktop-only,
     auth keyboard-open viewport is mobile-only, switch-goal explorer entry is
     desktop-only). Live also skips mobile, on purpose, and runs once on desktop.
   - Playwright live: 3 runs, 6 of 6. No forced sign-out in these runs.
   - Manual, real backend: preset from a landing link (29 s), custom with one skip and
     a double click (48 s, one goal), switch from Today (29 s, previous goal archived),
     abandon by Back and by closing the tab, backend process killed during clarify
     (pathway and custom) and before Build, then restarted (21 of 21).
   - Browser: 1440, 390 and 360 over every onboarding state and the pathway surfaces.
     Screenshots were not committed.
   - The matrix and the before-and-after table above.

7. Carry-overs
   See "Carry-overs (owned by later phases)" above. The one that needs Mo before
   Phase 4 starts: the TED-style speech title is "Deliver a 15-Minute TED-Style Speech"
   on the frontend and "Deliver an Unforgettable 15-Minute TED-Style Speech" in the
   backend, and no pattern matches, so clarify returns the custom questions. Present
   before Phase 3. Fixing it needs a backend matching allowance or a superseding ND-5.
   OD-8 (honest generation stages) is open and blocks Phase 4. Not decided here.

8. Issues and risks found
   - Fixed: schedule.ts still carried accent, background and border colour strings
     from before M3.5, including one legacy hex. Nothing read them (the type-check
     proves it). Removed. Payload and schedule results unchanged. Suite re-run after
     the edit: Vitest 156, mocked Playwright 117 passed and 3 skipped, build as above.
   - Kept, and why: the exhaustive-deps disable on the mount history effect
     (useOnboardingState.ts). Empty deps is the behaviour R-18 depends on; the effect
     must not re-write history on every render. The mount clarify disable is the one
     the pre-Phase-3 wizard already had. The e2e no-empty-pattern disables match
     auth.spec.ts (Playwright requires an object pattern). No new disable was added
     for a lint error that could be fixed properly.
   - Kept: the two waitForTimeout calls (500 ms after a double click, 300 ms after a
     delayed clarify). Each proves that a second request or a step change did not
     happen. They are not hiding a race.
   - Characterised, not fixed: reloading while the backend is unreachable signs the
     user out. getAuthUser returns null when its lookup throws, /me answers 401, and
     AuthContext drops the token on any /me failure. Deterministic. Owner: unassigned
     (backend and AuthContext). The three live runs did not hit it.
   - Dead code left in place on purpose: expert catalogue fields and SaaSBuilderModal
     (the prompt keeps them). Exported types used by callers or tests stay.

9. Not started
   M3.8 is complete. All Phase 3 milestones have been delivered.
   Phase 3 is awaiting Mo's review and is NOT marked COMPLETE.
   Phase 4 — Journey Generation has NOT started.
```

---

## PHASE 4 — JOURNEY GENERATION

**Status:** `COMPLETE` (2026-09-23; Mo accepted the phase report). "Current state" describes the code at the end of the phase; "What shipped", "Verification evidence", "Carry-overs" and "Review outcomes" record the result; the sections from "Decisions required" down are the kickoff plan and the milestone reports, kept as written.

**Source:** BP §30, §41, §47, §49 (Phase 4), OD-8, ND-17 · VDS §7, §19–21

**Objective:** make the creation of the 90-day path feel meaningful, while every visible stage describes something the system is really doing.

**Narrative line:** *"We're building your path."*

### Current state

The code at the end of Phase 4 (M4.5, 2026-09-23). The stream facts below include the kickoff. M4.2 replaced the in-flight screen. M4.3 added the silence wait and kept failures on that same screen. M4.4 checks for a finished plan before every create.

* **Screen (M4.2):** `frontend/src/components/onboarding/StepGeneration.tsx`, rendered by `OnboardingWizard.tsx` outside the M3.5 `OnboardingShell` (no progress rail, its own `main`) when the step is `generation`. The OD-8 stages come from `generationStages.ts`. "Understanding your goal" is already complete. "Choosing your method" is active from `search` and completes on `method`, or on `plan` when `method` never arrives. "Building your 90-day journey" appears only with the `method` event, and shows that event's name and whyChosen. On the v1 path it is omitted. "Designing your first steps" is active from `plan` until `done`, which still navigates to `/dashboard`. "Search sources" is gone. There is no spinning progress ring. Failure copy, "Review your answers" and "Try again" are the M3.7 words, on Phase 0 buttons. If a stream event had already arrived, the stages stay visible and the error sits beneath them. Designing your first steps is not marked done unless `plan` arrived. No method name is invented. If nothing arrived, the error screen stands alone.
* **Request:** `handleGeneratePlan` in `components/onboarding/useOnboardingState.ts` builds the body with `buildCreatePayload` (`payload.ts`, R-4) and calls `createGoalPlan` in `lib/api.ts`. `createGoalPlan` sends `Accept: text/event-stream` and reads the stream. There is no `AbortController`. Unmount does not cancel the fetch, and `POST /api/goal/create` does not abort when the client disconnects. An `isCreating` ref makes a double click send one request in this mount only. Each `step` replaces any earlier step with the same `id` in `planSteps`. On `done`, `finishWithGoal` removes `achivii_draft_goal` (R-16) and calls `onGoalCreated`; `OnboardingPage` sets the active goal and navigates to `/dashboard`.
* **Transport:** `POST /api/goal/create` streams server-sent events when the request sends `Accept: text/event-stream` (`wantsPlanStream` / `openPlanStream` in `backend/src/routes/goal.ts`). The status is 200 for the whole stream, including errors. The frontend reacts to `step`, `error` and `done`.
* **Events.** Ids are `search`, `method` and `plan`.
  * `search` — "Using a proven method for this goal" when `findPresetForGoal(rawGoal)` or `findPresetForGoal(clarifiedOutcome)` hits; otherwise "Comparing methods for your answers".
  * `method` — the method name and why it was chosen (`detail`). Sent only after `generateRoadmap` returns ok.
  * `plan` — "Writing your first week".
  * `done` — `{ type, goal, roadmapWeeks, dailyTasks, elapsedMs, slow }`. `goal` is `presentGoal(saved)`.
  * `error` — `{ type, error, elapsedMs, slow }`. The frontend throws `new Error(event.error)`.
  * A stream that ends with neither `done` nor `error` throws "Plan stream ended before a plan was ready." and is treated as a server create error.
* **Orders (kickoff, including live creates on 2026-09-23):**
  * **v2 success:** `search` → `method` and `plan` in the same tick → `generateWeekPlan` → `saveV2Goal` → `done`. `planVersion: 2`. `isGoldenRail` is true only when a preset matched. The live TED create took this path as a custom goal (below).
  * **v1 fallback** (preset, roadmap failed, not unsafe): `search` → no `method` → `plan` → `saveV1PresetGoal` → `done`. `planVersion: 1`, `isGoldenRail: true`, `canonicalMethodName: null`. The live 10K create took this path: `search` at 0 ms (`slow: false`), `plan` at 87702 ms (`slow: true`), `done` at 90345 ms. The screen completes "Choosing your method" when `plan` arrives and does not show a method stage.
  * **Custom failure:** `search` ("Comparing methods for your answers") → `error`. No v1 fallback. The live sourdough create ended this way (`error` at 54252 ms, `slow: true`). No goal was saved.
* **Slow (M4.3, corrected in M5.1 B2):** `elapsedMs` and `slow` (true after 20 seconds) are still computed in `openPlanStream` at send time. There is no heartbeat and no new SSE event. The client uses the same 20 seconds during silence, counted from the last event, or from entering generation if none has arrived. The line is "This is taking longer than usual. Still working (Ns)." N is whole seconds since this generation attempt started. During silence that is the client clock. An event that already has `slow: true` starts from `Math.round(elapsedMs / 1000)` and then keeps counting whole client seconds since that event arrived, still one line, so the line is not shown twice. It sits on the active stage (`search` → Choosing your method, `plan` → Designing your first steps). A later event with `slow: false` clears it and the 20 seconds start again. The number keeps moving until the next event or an error. No percentage and no estimated time remaining.
* **Research:** `generateRoadmap` in `backend/src/lib/ai/roadmap.ts` does not perform web research. It screens the query, matches a preset, extracts stated targets, then calls the model. The id `search` is a misnomer (OD-8).
* **Archive:** the previous active goal is archived only inside a successful `saveV2Goal` or `saveV1PresetGoal`, after generation succeeds. A failed create leaves the current goal untouched.
* **Unsafe:** rejected on create by `screenQuery`, not during clarify. The message is already user-facing ("This goal is outside what Achivii can plan safely." or the low-safety sentence). The UI title stays "We couldn't build your plan".
* **Failure copy:** `describeOnboardingError(err, 'create')` (`requestErrors.ts`) sorts a failure into `offline` ("We lost the connection…") or `server` ("We couldn't build your plan", with Achivii's own message). Answers, schedule and the draft key are kept. "Review your answers" uses `setStep('review')`, which bypasses the generation history lock. "Try again" calls `handleGeneratePlan` again.
* **Duplicate-safe create (M4.4):** before every `POST /api/goal/create`, and again after any failed create, `findCreatedGoal` calls `GET /api/goal/active`. It accepts a goal whose id is not the one active when this tab first pressed Build, and whose `rawGoal` matches. That id is kept in `sessionStorage` (`achivii_generation_prior_goal`) so a reload that has already loaded the finished plan is not treated as the goal onboarding opened with. It is not a second draft. The draft key is still cleared only in `finishWithGoal`, which also clears the prior id. A same-tab module flag blocks a second mount from sending while the first create is still in flight; a reload clears that flag. The check is skipped when `currentGoalId === null`. That hole stays a Phase 5 carry-over. There is still no `AbortController` and no backend abort.
* **Browser history (R-18):** while the step is `generation` (building, or showing its error), `goToStep`, `canJumpToStep` and the `popstate` handler ignore step changes, and entering generation pushes no entry.
* **TED (ND-17, M4.2):** a speech `matchingPattern` now matches the frontend title "Deliver a 15-Minute TED-Style Speech" to `ted_speech_15min`. The backend title still matches by equality. Frontend titles, ids and slugs are unchanged. The other seven drifted titles were not touched. A new clarify for that title returns `baseline`, `primary_fear` and `speech_context`, not the custom four. The existing dev-database goal with the frontend title was not rewritten (`isGoldenRail: false`, `planVersion: 2`). M3.1 fixtures stay 10K and sourdough.

### What shipped

* **Decisions (M4.1):** OD-8 Decided (A amended) and ND-17 Decided (A). Stream labels unused. The id `search` stays, and it still names no search.
* **Generation screen (M4.2):** "Building your path" outside `OnboardingShell`, with its own `main`. Stages come from `generationStages.ts`. Understanding is already complete. Choosing follows `search`. Building appears only with the streamed method name and whyChosen, and is omitted on v1. Designing is active from `plan` and is not marked done unless `plan` arrived. No invented method name. "Search sources" is gone. No spinning progress ring. `done` still opens `/dashboard`. SSE fixtures and a timed mock stream cover v2, v1 and a custom error. ND-17 is one speech matching pattern.
* **Slow, error, unsafe, retry (M4.3):** after 20 seconds of silence the active stage says "This is taking longer than usual. Still working (Ns)." N is whole seconds since this attempt started. An event that already has `slow: true` uses that event's seconds, so the line is not shown twice. Failures stay on the same screen, with the M3.7 titles and the two actions. Finished stages stay; the error sits beneath them. If nothing arrived, the error stands alone.
* **No duplicate goals (M4.4):** every Build calls `GET /api/goal/active` before `POST /api/goal/create`, and again after any failed create. A matching plan already saved for this goal is opened. The id that was active when this tab first pressed Build is remembered in `sessionStorage` (`achivii_generation_prior_goal`) and cleared only in `finishWithGoal`, with the draft. It is not a second draft. A same-tab module flag blocks a second mount while the first create is in flight. A reload clears that flag and does not resume the request. `currentGoalId === null` still skips the check. There is no `AbortController` and no backend abort.
* **M4.5:** the regression matrix and this report. The two 360 px generation checks now also run axe on `#main`. No generation-only dead code was found, so nothing was removed. The payload, stages, slow line, error actions and the check before create are unchanged.

### Verification evidence

* Frontend type-check is part of the production build, which passes. Main JS 568.24 KB (167.73 KB gzipped), CSS 101.30 KB (17.71 KB gzipped). The chunk warning remains. Since the end of Phase 3 the JS chunk grew by 2.39 KB (gzipped +0.74 KB) and the CSS chunk shrank from 102.48 KB.
* ESLint on the generation files is clean. `api.ts` keeps its five pre-existing `any` errors. Full frontend lint is still 30 errors and 4 warnings (3.11).
* Frontend Vitest: 180 passed / 23 files. Backend Vitest: 229 passed / 20 files. No backend file was changed in M4.5; ND-17 shipped in M4.2.
* Playwright, mocked, both projects (`generation.spec.ts`, `onboardingStates.spec.ts`, `onboarding.spec.ts`): 83 passed, 3 skipped, 0 failed. `generation.spec.ts --repeat-each=3`: 72 passed, 6 skipped (the 360 px checks on the mobile project), 0 failed, 0 flaky.
* Live AI generate was not run in M4.5. The kickoff observations stand: TED title, v2 custom, completed; 10K, v1 fallback, completed; sourdough, custom error, no goal saved. A quota-forced v1 path is not a UI bug. No new accounts.
* Details: the M4.5 regression matrix and the Phase 4 report below.

### Carry-overs (owned by later phases)

| Item | Owner |
|---|---|
| `currentGoalId === null` still skips the active-goal check, so a Build then can create a second goal | Phase 5 (goal-load error state) |
| Two creates already in flight before either save finishes. A second mount in the same page load is blocked. A reload, a second tab, or a killed tab can send again if `GET /api/goal/active` does not yet see the new goal. No second lock was added | Accepted residual (Mo, 2026-09-23). A fix would need server-side create idempotency under a new backend allowance; not planned. |
| Phone lock and wake, from the code, not from a device. No visibility listener. No `AbortController`. A tab that stays in memory continues the request; a killed tab leaves the draft, and the next Build checks first | Phase 11 |
| `done` still opens the legacy `/dashboard` | Phase 5 (OD-3) |
| Catalogue expert fields are not shown as the method | Phase 12 |
| Kickoff accounts in the local database (`phase4-kickoff-*`). M4.5 added none | Housekeeping |
| Main JS chunk 568.24 KB, above Vite's 500 KB warning | Phase 12 |
| Navbar targets, `/dashboard` and `/roadmap` axe and overflow findings | Phase 5 (navbar, `/dashboard`); Phase 6 (`/roadmap`) |

### Review outcomes (Mo, 2026-09-23)

* **Overlapping creates:** accepted as a residual risk (carry-over above).
* **Live evidence:** the new generation screen was not observed against a real stream during Phase 4. All live generation evidence is from the kickoff, on the old screen. The Phase 5 kickoff builds its goal through the real UI on the new screen and records the result below as post-close Phase 4 evidence. A defect found there is reported, not fixed in the kickoff.
* **`search` id:** it names no search. Accepted under OD-8. The labels are unchanged.

### Post-close follow-up (M5.1 B2)

The still-working number froze on a slow event. The Phase 5 kickoff's live run showed "Still working (132s)" unchanged until done at about 181 seconds. M5.1 keeps counting from that event's seconds, in `generationStages.ts` and `StepGeneration.tsx`. This is not a reopened Phase 4 milestone.

### Decisions required before starting

Both are Decided. Neither blocks M4.2.

* **OD-8 — Decided (A amended), 2026-09-23, Mo.** Four honest stages. "Understanding your goal" is already complete on entry. "Choosing your method" runs from `search` until `method`, or until `plan` if `method` never arrives. "Building your 90-day journey" completes on `method` and reveals the streamed name and whyChosen; if `method` never arrives, do not invent a method name and do not leave that stage pending. "Designing your first steps" runs from `plan` until `done`. Stream labels are not changed. Ids stay `search` / `method` / `plan`.
* **ND-17 — Decided (A), 2026-09-23, Mo.** Matching only, so the frontend title "Deliver a 15-Minute TED-Style Speech" hits `ted_speech_15min`. Implement with the generation work (M4.2 or a named sub-step of it). ND-5 titles, ids and slugs stay frozen. The other seven title-drift pathways are not changed. Not implemented in M4.1.

### In scope

* A generation screen on the OD-8 stages. The method name and whyChosen come only from the `method` event. `done` still leads to `/dashboard` until Phase 5 / OD-3.
* **v1 fallback is a first-class path:** `search` → `plan` → `done`, with no `method` event. Do not leave a method stage pending and do not invent a method name.
* The motion language: ascent and emergence (VDS §19). Steps may appear as stages complete (VDS §7). No fake percentages, no timed fake stages, no invented durations.
* **Slow state.** The existing "This is taking longer than usual. Still working (Ns)." copy, including during silence, counted from the last event plus 20 seconds. That is the same contract the server already stamps on events. It is not a new SSE event and not a fake percentage (M4.3).
* **Error state.** A retry that keeps all onboarding answers; the unsafe-goal message in encouraging language.
* **Leaving mid-generation.** The request continues on the server (no `AbortController`, no backend abort-on-disconnect). `GET /api/goal/active` before every create send, so a finished create is not sent again (M4.4). The new UI must not create duplicate goals on retry.
* **SSE fixtures and a mock stream** in M4.2, so a timed `search` → `method` → `plan` → `done` sequence (and the v1 path with no `method`) can be tested. Do not regenerate the M3.1 create-body fixtures.
* **Reduced motion:** stages change without animation, and all text stays visible.
* No new npm dependencies.

### Out of scope

* Adding real web research to the live route, or any new stream id or field.
* Changing what is generated.
* Showing catalogue expert fields (`outcome`, `desc`, `coach`, `p1`–`p3`, `sampleDay`, `badge`) as the generated method.
* Backend abort-on-disconnect.
* A Journey reveal (Phase 6). `done` does not pretend to land on Today; Today is Phase 5.
* The Today redesign (Phase 5).
* The other seven title-drift pathways (they already match by pattern).
* Rewriting existing goals in the database.
* Changing frontend titles, ids or slugs (ND-5), or routes, schemas, API responses or the stream shape.

### Backend allowance

* **Stream labels: not used** (OD-8 A). Do not change the user-facing label strings in `routes/goal.ts`, the step ids, or the payload shape.
* **Named (ND-17 A), implement with the generation work, not in M4.1:** in `findPresetForGoal` and/or the speech preset's `matchingPatterns` (or an alias), make the frontend title "Deliver a 15-Minute TED-Style Speech" match `ted_speech_15min`. No routes, schemas, responses, ids or payload shape. Existing TED goals are not rewritten. M3.1 fixtures stay 10K / sourdough.

### Files likely affected

* `frontend/src/components/onboarding/StepGeneration.tsx` (the generation screen)
* `frontend/src/components/OnboardingWizard.tsx` (its `generation` branch only)
* `frontend/src/components/onboarding/useOnboardingState.ts` (generation state only: `handleGeneratePlan`, `planSteps`, `generationError`, `findCreatedGoal`; the payload and history logic stay as they are)
* `frontend/src/components/onboarding/requestErrors.ts` (create copy only)
* `frontend/src/pages/OnboardingPage.tsx` (`done` still navigates to `/dashboard`)
* `frontend/src/lib/api.ts` (reading the stream only; no contract change)
* `frontend/e2e/mockApi.ts` (M4.2: play SSE fixtures; M3.1 create-body fixtures stay)
* new generation components, beside the onboarding step components or in `frontend/src/components/generation/*`
* `backend/src/lib/ai/presets/speech.ts` and `backend/src/lib/ai/presets/index.ts` (ND-17 matching only)

### Milestones

| ID | Milestone |
|---|---|
| M4.1 | **Done** (2026-09-23). OD-8 and ND-17 logged. No generation UI. |
| M4.2 | **Done** (2026-09-23). OD-8 generation screen, SSE fixtures and mock stream, ND-17 matching. |
| M4.3 | **Done** (2026-09-23). Silence slow copy, error and unsafe on the same screen, retry kept. |
| M4.4 | **Done** (2026-09-23). `GET /api/goal/active` before every create. A finished plan is not built again. No backend abort. |
| M4.5 | **Done** (2026-09-23). Regression matrix and the Phase 4 report. Accepted by Mo with three review outcomes (below "Carry-overs"). |

### Regression checks

R-2, R-5, R-6, R-7, R-15.

### Mobile acceptance

3.7 applies, plus:

* The screen stays readable at 360px.
* The generation screen stays active and readable if the phone locks and wakes (document the behaviour).

### Validation

* Generate a preset goal and a custom goal, including a v1 fallback (no `method` event) and a v2 success (`method` then `plan`).
* Force a slow run: an event with `slow: true`, and a silence longer than 20 seconds with no new event.
* Force an error (stop the backend mid-request; use an invalid provider key in a development environment only).
* Retry after an error.
* Navigate away and come back. Confirm a second Build does not send create when the first save already finished.

### Exit criteria

* Every visible stage corresponds to a real event.
* No fake progress.
* Answers survive errors.
* Generation still produces and saves a goal exactly as before.

### Risks

* Showing a pending method stage, or an invented method name, on the v1 fallback (OD-8 forbids both).
* A second Build, from a new mount, while the first create is still running: two saves, one goal archived (M4.4).
* Provider quota can force the v1 path or a custom error. The mock stream has to cover both v2 and v1 so live quota does not decide what the screen can show.
* `done` lands on the legacy `/dashboard` until Phase 5. That drop is real; do not fake Today or a Journey reveal.

### M4.1 report — Log decisions (2026-09-23)

```text
1. Outcome
   OD-8 and ND-17 are Decided and written into the Phase 4 plan.
   Phase 4 is IN PROGRESS. M4.1 is done. M4.2 has NOT started.
   No generation UI was implemented.
   ND-17 matching has NOT been implemented in the backend.

2. What changed (docs only)
   docs/decisions.md: OD-8 is Decided (A amended), with the kickoff corrections
   in its context (v1 skips method; slow is stamped only on events; no heartbeat;
   method and plan are sent together on v2). ND-17 is Decided (A): matching only,
   so "Deliver a 15-Minute TED-Style Speech" hits ted_speech_15min. The index,
   the "what blocks the next phase" line, D-11's Phase 4 allowance note and the
   change log agree.
   docs/phases.md: current position, the status table, the Phase 4 status line,
   current state, decisions, scope, allowance, files and milestones match the
   kickoff and Mo's choices. Section 5 and section 6 agree. Design.md gains a
   short generation-stage note (stage list, reduced motion, no fake progress).

3. Files changed
   docs/decisions.md
   docs/phases.md
   Design.md

4. Functionality preserved
   None coded. R-2, R-5, R-6, R-7 and R-15 are untouched.

5. Decisions applied
   OD-8 A amended — four honest stages; v1 fallback must not show a pending
   method stage; stream labels unused; search / method / plan ids unchanged.
   ND-17 A — matching-only backend allowance, to be implemented with the
   generation work, not in M4.1. ND-5 stays as decided. The other seven
   title-drift pathways are not in scope.

6. Validation evidence
   Re-read of docs/decisions.md and docs/phases.md: the index, the register,
   the Phase 4 section, section 6 and both change logs name the same status
   (Decided A amended / Decided A), the same allowance (matching only; stream
   labels unused) and the same position (IN PROGRESS, M4.1 done, M4.2 not
   started). git status shows no production source and no backend file changed
   by this milestone.

7. Carry-overs
   ND-17 matching is approved and not written. The generation screen is still
   the legacy StepGeneration. The currentGoalId === null hole stays with
   Phase 5. Catalogue expert fields stay unused (Phase 12). Kickoff accounts
   remain in the local development database (section 6).

8. Issues and risks
   The v1 path is a real generation order, observed live, and the screen still
   leaves "Choose the method" pending on it. M4.2 has to treat that path as
   first-class. Duplicate creates across mounts are unchanged until M4.4.

9. Not started
   M4.2 has NOT started.
   No generation UI was implemented.
   ND-17 matching has NOT been implemented in the backend.
   Phase 5 has not started.
```

### M4.2 report — Generation screen (2026-09-23)

```text
1. Outcome
   Pressing "Build my 90-day path" opens an honest generation screen.
   Understanding your goal is already complete. Choosing your method follows
   the search event. Building your 90-day journey appears only when method
   arrives, with that event's name and why it was chosen. On the v1 path that
   stage is omitted and no method name is invented. Designing your first steps
   runs from plan until done, which still opens /dashboard.
   "Search sources" is gone.
   The frontend TED title now matches ted_speech_15min.
   M4.3 has NOT started.
   M4.4 has NOT started.
   Phase 5 — Today has NOT started.

2. What changed
   The in-flight screen uses Phase 0 tokens and StepMarker, outside the
   onboarding rail, with its own main landmark. Stages are derived from
   planSteps. The failure panel keeps the M3.7 copy and the two actions, on
   Button primitives.
   mockApi can play a timed SSE sequence. Fixtures record the kickoff v2, v1
   and error orders. Playback delays are shortened; elapsedMs and slow are the
   observed stamps. The v2 detail sentence is a stand-in: the kickoff logged
   that detail was present and did not quote it.
   ND-17 is one matching pattern on the speech preset. findPresetForGoal,
   routes, schemas, stream ids and payload shape are unchanged.

3. Files changed / created / removed
   Created:
   - frontend/src/components/onboarding/generationStages.ts
   - frontend/src/components/onboarding/StepGeneration.test.tsx
   - frontend/e2e/generation.spec.ts
   - frontend/e2e/fixtures/generation/v2-success.json
   - frontend/e2e/fixtures/generation/v1-fallback.json
   - frontend/e2e/fixtures/generation/custom-error.json
   Changed:
   - frontend/src/components/onboarding/StepGeneration.tsx
   - frontend/src/components/OnboardingWizard.tsx (generation branch only)
   - frontend/e2e/mockApi.ts
   - backend/src/lib/ai/presets/speech.ts
   - backend/test/presetMatch.test.ts
   - docs/phases.md
   - docs/decisions.md (implementation note on ND-17)
   Removed: none.
   M3.1 create-body fixtures were not regenerated.

4. Functionality preserved
   R-2: mocked create still reaches /dashboard on done (v2 and v1 fixtures).
   R-3: the ten frontend pathway titles still match their own presets; TED
   now matches ted_speech_15min and returns baseline, primary_fear,
   speech_context.
   R-4: onboarding payload specs still match the M3.1 10K and sourdough bodies.
   R-5 / R-7: the mocked done payload still carries a goal, one week and one
   task. No live generate was run in this milestone.
   R-6: step, done and error render. Slow-during-silence is not claimed.
   R-15: archive timing is unchanged (no save-path edits).
   R-16: the draft still clears only in finishWithGoal. The error spec keeps
   the review step and its answers.
   R-18: generation still does not use the rail, and the history lock in the
   hook was not changed. "Review your answers" still uses setStep('review').

5. Decisions applied
   OD-8 A amended. Frontend labels only. Stream label strings, ids and payload
   shape were not changed.
   ND-17 A. Matching only, in speech matchingPatterns. Frontend titles, ids
   and slugs unchanged. The other seven title-drift pathways unchanged.
   Existing TED goals were not rewritten.

6. Validation evidence
   Frontend type-check: clean.
   ESLint on the changed frontend files: clean.
   Frontend Vitest: 162 passed / 23 files (was 156 / 22).
   Backend Vitest: 229 passed / 20 files (was 228; the new test is ND-17).
   Frontend build: main JS 566.36 KB (166.99 KB gzipped), CSS 101.19 KB
   (17.70 KB gzipped). The chunk warning remains.
   Backend build: passes.
   Playwright mocked, both projects: 128 passed, 4 skipped (was 117 passed,
   3 skipped). Includes generation v2, v1, error, reduced motion, axe on the
   generating screen at 1440 and 390, no overflow of main at 360, and the
   existing onboarding payload and handoff specs.
   No new live accounts. Fixtures use the kickoff observations.

7. Carry-overs
   M4.3: slow-during-silence (the 20s copy from last-event time, with no new
   SSE event), and the error / unsafe / retry visual pass.
   M4.4: GET /api/goal/active before every create send. The currentGoalId ===
   null hole stays with Phase 5. No abort-on-disconnect.
   The existing dev-database TED goal stays custom v2.

8. Issues and risks
   Provider quota can still force the v1 path. The mock covers both orders.
   A second Build from a new mount can still create a duplicate until M4.4.
   done still lands on the legacy /dashboard until Phase 5.
   The v2 fixture's whyChosen sentence is a stand-in, not the live sentence.

9. Not started
   M4.3 has NOT started.
   M4.4 has NOT started.
   Phase 5 — Today has NOT started.
```

### M4.3 report — Slow, error and retry (2026-09-23)

```text
1. Outcome
   A wait longer than 20 seconds with no new stream event now says
   "This is taking longer than usual. Still working (Ns)." on the active
   stage. N is whole seconds since this generation attempt started.
   A failure stays on the same screen. If a stage event had arrived, the
   finished stages remain and the error sits beneath them. Retry, review
   and the double-click guard behave as they did.
   M4.4 has NOT started.
   M4.5 has NOT started.
   Phase 5 — Today has NOT started.

2. What changed
   The client starts a 20-second timer from the last event, or from entering
   generation if none has arrived. That is the same threshold the server uses
   when it stamps slow. There is no new SSE event, no percentage and no
   estimated time remaining.
   When the latest event already has slow: true, the line uses that event's
   elapsedMs and is not drawn again for the silence. A later event with
   slow: false clears the line. The polite live region mentions the slow fact
   once; the visible line carries the ticking seconds.
   Offline, server, unsafe and "plan stream ended" keep the M3.7 titles and
   sentences. "Review your answers" and "Try again" are unchanged. Try again
   still calls handleGeneratePlan, which clears planSteps before the next send.
   No GET /api/goal/active before the first send.

3. Files changed / created / removed
   Changed:
   - frontend/src/components/onboarding/StepGeneration.tsx
   - frontend/src/components/onboarding/generationStages.ts
   - frontend/src/components/onboarding/StepGeneration.test.tsx
   - frontend/src/components/onboarding/useOnboardingState.test.tsx
   - frontend/e2e/mockApi.ts (a later create can play the next sequence; a mock-only end step closes the stream)
   - frontend/e2e/generation.spec.ts
   - docs/phases.md
   - Design.md (one sentence on the silence line and the error staying on the screen)
   Created: none.
   Removed: none.
   No backend file changed. M3.1 create-body fixtures were not regenerated.
   No new live accounts.

4. Functionality preserved
   R-2: mocked v2 and v1 streams still open /dashboard on done.
   R-4: onboarding payload specs were not modified. The create body builder was not touched.
   R-6: step, done and error still render. Slow now also appears after 20 seconds of silence.
   R-15: the backend was not changed, so archive still happens only inside a successful save.
   R-16: the draft still clears only in finishWithGoal. Review and a failed retry leave it in place.
   R-18: the history lock was not changed. The error actions are still the only way off this screen.
   M4.2: no "Search sources", no invented method name, v1 omits Building your 90-day journey, done opens /dashboard.
   A double click in this mount still sends one create. Offline retry still uses findCreatedGoal, including the currentGoalId === null hole.

5. Decisions applied
   OD-8 A amended. The stage mapping is unchanged. The slow line is a status on the active stage, not a new stage and not a fake duration.

6. Validation evidence
   Frontend type-check: clean (tsc, and again inside the production build).
   ESLint on the changed frontend and e2e files: clean.
   Frontend Vitest: 173 passed / 23 files (was 162).
   Frontend build: main JS 568.07 KB (167.65 KB gzipped), CSS 101.30 KB (17.71 KB gzipped). The chunk warning remains.
   Playwright, both projects: generation.spec.ts and onboardingStates.spec.ts, 44 passed and 2 skipped, then the silence clock test was corrected and passed on desktop and mobile. Includes v2, v1, server error, unsafe, stream-ended, retry, review, reduced motion, axe on the generating screen and the error screen at 1440 and 390, and no overflow of main at 360.
   No live AI generate. No backend tests: no backend change.

7. Carry-overs
   M4.4: GET /api/goal/active before every create send, and leave-mid-generation. A second Build from a new mount can still create a duplicate.
   Phone lock and wake, from the code, not from a device. The page does not listen for visibility changes, and create has no AbortController. If the tab stays in memory, the request continues; a throttled timer can pause the seconds and then jump when the page wakes. If the OS kills the tab, the reload finds the draft still stored, and the create is not resumed. A finished create is noticed only when findCreatedGoal runs, which is still only after an offline failure or an offline retry. That was not checked on a phone. It stays with Phase 11.
   currentGoalId === null still skips findCreatedGoal. That hole stays with Phase 5.

8. Issues and risks
   The still-working number during silence uses the client clock. An event with slow: true uses the server's elapsedMs. They are the same rule (seconds since generation started) measured by different clocks, so a handoff can move the number.
   The hook still console.errors a failed create. The error specs expect that.
   done still lands on the legacy /dashboard until Phase 5.

9. Not started
   M4.4 has NOT started.
   M4.5 has NOT started.
   Phase 5 — Today has NOT started.
```

### M4.4 report — No duplicate goals (2026-09-23)

```text
1. Outcome
   Every Build asks GET /api/goal/active before it sends POST /api/goal/create.
   A plan the server already saved for this goal is opened instead of being built again.
   The goal that was active when this tab first pressed Build is never treated as that new plan.
   The request is still not cancelled. The server still runs to completion.
   M4.5 has NOT started.
   Phase 5 — Today has NOT started.

2. What changed
   findCreatedGoal runs before every send, and again after any failed create, not only after a lost connection.
   The id it compares against is remembered in sessionStorage for this tab (achivii_generation_prior_goal).
   It is cleared in finishWithGoal, together with the draft. It does not store answers.
   A module flag in this page load stops a second mount from sending while the first create is still running.
   A reload clears that flag and checks GET again.
   currentGoalId === null still skips the check.
   The stages, the slow line, and the error layout were not redesigned.

3. Files changed / created / removed
   Changed:
   - frontend/src/components/onboarding/useOnboardingState.ts
   - frontend/src/components/onboarding/useOnboardingState.test.tsx
   - frontend/e2e/mockApi.ts (counts GET /api/goal/active)
   - frontend/e2e/generation.spec.ts
   - frontend/e2e/onboardingStates.spec.ts
   - docs/phases.md
   Created: none.
   Removed: none.
   No backend file changed. payload.ts was not changed. No new live accounts.

4. Functionality preserved
   R-2: when GET finds nothing new, one create still runs and done still opens /dashboard.
   R-4: the onboarding payload specs still match the M3.1 bodies.
   R-5 / R-7: a create response's weeks and week-1 task are still what onGoalCreated receives. The reload recovery uses the active-goal payload the mock returned.
   R-6: the v2, v1, silence, and error specs still pass.
   R-15: a GET that returns the goal already active does not skip create, and no DELETE was added. Archive timing is unchanged because the backend was not touched.
   R-16: the draft is still cleared only in finishWithGoal, including when the plan is recovered instead of created.
   R-18: Back during generation still stays on the generation screen.
   M4.2 / M4.3: no "Search sources", no invented method name, v1 omits the method stage, the 20-second silence line remains, failures stay on the generation screen.

5. Decisions applied
   OD-8 and ND-17 were not reopened. ND-16 is unchanged: a pathway chosen inside onboarding still does not write the draft, and the prior-goal id is not a draft. D-11: no backend change.

6. Validation evidence
   Frontend type-check: clean, including the production build.
   ESLint on the changed files: clean.
   Frontend Vitest: 180 passed / 23 files (was 173).
   Frontend build: main JS 568.24 KB (167.73 KB gzipped), CSS 101.30 KB (17.71 KB gzipped). The chunk warning remains.
   Playwright, both projects: generation.spec.ts, onboardingStates.spec.ts, and onboarding.spec.ts. 81 passed and 3 skipped, then the reduced-motion assertion was narrowed to the visible stage title (it had also matched the live region) and that test passed on desktop and mobile. Includes the reload recovery, Back during generation, v2, v1, silence, error, retry, and the M3.1 payload specs.
   No live AI generate. No backend tests: no backend change.

7. Carry-overs
   Phase 5: currentGoalId === null still skips the check. The hook does not guess.
   Phase 11: phone lock and wake, from the code, not from a device. The page does not listen for visibility changes, and create has no AbortController. If the tab stays in memory, the request continues. If the OS kills the tab, the reload finds the draft, and the next Build checks GET first.
   Residual: two creates already in flight before either save finishes. A second mount in the same page load is blocked. A reload, a second tab, or a killed tab starts a new page load, so the flag is gone. If GET does not yet see the new goal, the next Build can send again. No second lock was added.

8. Issues and risks
   The prior-goal id lives in sessionStorage for the tab. It is cleared when a plan is created or recovered. It is not cleared when the user simply leaves onboarding, so a later Build in that tab still knows which goal was already active.
   done still lands on the legacy /dashboard until Phase 5.

9. Not started
   Leave-mid-generation:

   | Situation | Request | Draft | Previous goal | Next Build |
   | Double click, same mount | one POST | kept until save | untouched until save | blocked by isCreating |
   | Try again after server error, save did not happen | second POST | kept | untouched | GET first, then POST |
   | Try again after server or offline, save did happen | no second POST; finishWithGoal | cleared | archived by that save | recovered |
   | Reload during generation | browser aborts the fetch; server continues | kept if it existed | unchanged until save | GET first; a finished save is used |
   | Browser Back during generation | continues | kept | untouched until save | stays on the generation screen |
   | Navigate away (unmount), same tab | fetch continues | kept until finishWithGoal | untouched until save | a second mount does not send while the first is in flight |
   | Close tab or kill tab | browser abort; server continues | kept | untouched until save | GET first on the next Build |
   | Switch-goal Build | one POST; archive only on save | kept until save | the old id is not treated as the new plan | GET first, then POST |
   | currentGoalId === null | check skipped | kept until save | unknown | create may still be sent |

   M4.5 has NOT started.
   Phase 5 — Today has NOT started.
```

### M4.5 regression matrix (2026-09-23)

Every row was run in this milestone, or is cited from a test that still passes. Mocked Playwright is both projects (desktop 1440 and mobile 390): `generation.spec.ts`, `onboardingStates.spec.ts` and `onboarding.spec.ts`, 83 passed, 3 skipped, 0 failed. `generation.spec.ts --repeat-each=3`: 72 passed, 6 skipped (the 360 px checks on the mobile project), 0 failed, 0 flaky. Frontend Vitest is 180 passed / 23 files. Live AI generate was not run. The kickoff observations are reused where a live path is named: TED v2 custom completed, 10K took the v1 fallback and completed, sourdough ended in a custom error and saved no goal. A quota-forced v1 path is not a UI bug. No new accounts.

| Check | Result | Evidence |
|---|---|---|
| R-2 preset create completes and lands on `/dashboard` | Pass | `generation.spec.ts` v2 stream opens `/dashboard`; `onboarding.spec.ts` landing pathway sends one create. Kickoff 10K create completed (v1) and was not re-run |
| R-2 custom create completes, or fails honestly | Pass | `onboarding.spec.ts` custom body matches `create-custom-sourdough.json` and sends one create. Kickoff: TED custom completed on v2; sourdough failed after `search` and saved no goal. Not re-run |
| R-4 mocked preset payload | Pass | `onboarding.spec.ts` landing and in-onboarding bodies match `create-run10k.json` |
| R-4 mocked custom payload, including `"Skipped"` | Pass | `onboarding.spec.ts` matches `create-custom-sourdough.json` |
| R-4 retried create, when GET finds nothing new, sends one body | Pass | `onboardingStates.spec.ts` failed build: two creates, the second body equals the first. Hook: server failure then retry calls active-goal, then one more create |
| R-5 / R-7 done hands weeks and week-1 tasks to `onGoalCreated` | Pass | Hook: a create response's `roadmapWeeks` and `dailyTasks` are what `onGoalCreated` receives. The reload recovery uses the active-goal payload the mock returned |
| R-6 v2: search, then method and plan, then done | Pass | `generation.spec.ts` v2: Choosing is Now before the method name; Building and whyChosen appear together; then `/dashboard` |
| R-6 v1: search, then plan, then done | Pass | `generation.spec.ts` v1: no "Building your 90-day journey", Choosing becomes Done when plan arrives, then `/dashboard` |
| R-6 custom error: search, then error | Pass | `generation.spec.ts` error after search stays on `/onboarding` with "We couldn't build your plan" |
| OD-8 Understanding complete on entry | Pass | `StepGeneration.test.tsx`; `generation.spec.ts` reduced motion shows Understanding before the method |
| OD-8 Choosing your method from search | Pass | `generation.spec.ts` v2 and the silence spec: Choosing is Now after search |
| OD-8 Building only on method; omitted on v1; no invented name | Pass | `generation.spec.ts` v2 shows the fixture name and whyChosen; v1 and the error spec have a count of 0 for that stage and for the method name |
| OD-8 Designing from plan; not marked done without plan | Pass | `generation.spec.ts` v2 Designing is Now after plan; the error spec Designing is not Done |
| No "Search sources". No fake percentage. No timed fake stages | Pass | `generation.spec.ts` v2, v1, silence and error: "Search sources" count 0; silence asserts no "about N seconds left" |
| Reduced motion: stages change without animation; labels stay visible | Pass | `generation.spec.ts` reduced motion: every stage opacity is 1; Understanding stays visible |
| 20-second silence copy; N is seconds since this attempt | Pass | `generation.spec.ts` clock fast-forward 21s: the line is on Choosing, seconds ≥ 20, Designing does not contain it. `StepGeneration.test.tsx` reaches 20 then 23 |
| An event with `slow: true` replaces the silence line | Pass | `StepGeneration.test.tsx`: one line, the event's seconds, on Designing; the status does not repeat "Still working". v1 fixture shows "Still working (88s)." once |
| Server error and unsafe stay on the generation screen | Pass | `generation.spec.ts`: both use "We couldn't build your plan", Review your answers and Try again. Unsafe shows Achivii's sentence. No "Failed to fetch" |
| Finished stages remain; the error sits beneath them | Pass | `generation.spec.ts` server error: Understanding is Done, Designing is not Done, the alert is present, Building is absent |
| Try again: GET first, then one create, stages cleared | Pass | `generation.spec.ts` retry: the alert is gone, the method name is absent, Choosing is Now, then the method appears, `__achiviiCreates` is 2. Hook: a saved plan on the second GET sends no second POST |
| Review your answers: review, draft kept | Pass | `generation.spec.ts` returns to "Before we build your path". `onboardingStates.spec.ts`: draft still set on the error, answers and schedule still on review, then one more create |
| GET `/api/goal/active` before every create send | Pass | Hook: first Build with nothing saved calls active-goal once, then one create. Server-error and offline retries call it before the next send |
| Matching already-saved plan: `finishWithGoal`, no POST | Pass | Hook: first Build with a new matching goal does not call create, clears the draft, and fires `onGoalCreated`. `onboardingStates.spec.ts` offline recovery: one create, then `/dashboard` |
| The goal active when this tab first pressed Build is not the new plan | Pass | Hook: `currentGoalId` `'old'` and GET returning that id still sends create |
| Double click, same mount: one POST | Pass | Hook. `onboarding.spec.ts` double click creates one goal |
| Second mount, same page load, first still in flight: no second POST | Pass | Hook: a hanging create, then a second mount, does not send and does not enter generation |
| Reload: request not resumed; next Build checks GET first | Pass | `onboardingStates.spec.ts` reload: heading "Building your path" is gone, draft kept, the next Build does not send a second create and opens `/dashboard`. Hook simulates the same with the prior id kept |
| `currentGoalId === null` still skips the check | Pass | Hook: active-goal is not called; create may still be sent. Not changed |
| R-16 draft kept until `finishWithGoal`; prior-goal id cleared with it | Pass | Hook: draft remains after a server error and is cleared on create and on recover. `finishWithGoal` removes `achivii_generation_prior_goal` with `achivii_draft_goal` |
| R-18 Back during generation stays on the generation screen | Pass | `generation.spec.ts` `goBack`: URL stays `/onboarding`, heading stays "Building your path". Hook: `goToStep('review')` during generation stays on generation |
| R-15 switch-goal: no DELETE; old id is not the new plan | Pass | `onboarding.spec.ts` switch opens onboarding without a create (desktop; mobile skip is the known project skip). Hook: the old id does not skip create. Archive timing is unchanged because the backend was not edited. No DELETE was added |
| Leave mid-generation matches the M4.4 matrix | Pass, with the residual named there | Same-mount double click, Try again, recover-after-save, reload, Back, second mount, switch-goal and the `null` skip are the rows above. Close or kill tab is the reload case: the browser aborts the fetch, the server is not given an abort, the draft stays, the next Build checks GET. No `AbortController` was added |
| ND-17 frontend TED title matches `ted_speech_15min` | Pass | `backend/test/presetMatch.test.ts`. Stored goals were not rewritten. Frontend titles, ids and slugs were not edited |
| Readable at 1440, 390 and 360 | Pass | Projects are 1440 and 390. `generation.spec.ts` generating and error screens at 360: overflow ≤ 1 px. Stages and the error title stay on screen |
| Phone lock | Documented from the code. Not an on-device check | No visibility listener. No `AbortController`. A tab that stays in memory continues the request. A killed tab is the reload row. Phase 11 owns the device |
| Generation screen: heading, own `main`, live region, reduced motion, keyboard to the two actions | Pass | The screen's `h1` is "Building your path"; with stages showing, the error title is an `h2`. `main#main` is the axe root. The status region is polite. Reduced-motion and Tab through Review your answers and Try again are in `generation.spec.ts` |
| axe on the generation screen at 1440, 390 and 360 | Pass | `generation.spec.ts` generating and error screens: axe on `#main` at 1440 and 390, and on the same screens after the viewport is set to 360. WCAG 2.2 AA tags. 0 violations |
| Navbar, `/dashboard` and `/roadmap` findings | Not fixed | Left for Phase 5 and Phase 6 |

### M4.5 report — Regression and phase report (2026-09-23)

```text
1. Outcome
   The generation screen was proved against the Phase 4 checks and written up.
   No generation feature was added.
   Phase 4 milestones have been delivered and are awaiting Mo's review.
   Phase 4 is NOT marked COMPLETE.
   Phase 5 — Today has NOT started.

2. What changed
   The two 360 px generation checks now also run axe on #main.
   No production code changed. No dead generation code was removed.
   docs/phases.md gained this matrix, the close-out sections and the Phase 4 report.
   docs/decisions.md index line now says Phase 4 is awaiting Mo and Phase 5 is blocked by OD-3, OD-9 and ND-7.
   OD-8 and ND-17 stay Decided. Those three Phase 5 decisions stay Open.

3. Files changed / created / removed
   Changed:
   - frontend/e2e/generation.spec.ts
   - docs/phases.md
   - docs/decisions.md
   Created: none.
   Removed: none.
   No backend file changed. payload.ts was not changed.

4. Functionality preserved
   R-2, R-4, R-5, R-6, R-7, R-15, R-16 and R-18 pass in the matrix above.
   OD-8 and ND-17 still hold.
   GET /api/goal/active still runs before every create.
   The overlapping in-flight case is still only documented.

5. Decisions applied
   OD-8 A amended and ND-17 A, already shipped. No decision changed status.
   OD-3, OD-9 and ND-7 were not decided.

6. Validation evidence
   Frontend production build (includes tsc): exit 0. JS 568.24 KB (167.73 KB gzipped), CSS 101.30 KB (17.71 KB gzipped).
   ESLint on the generation files: clean. api.ts keeps five pre-existing any errors. Full lint: 30 errors, 4 warnings.
   Frontend Vitest: 180 / 23. Backend Vitest: 229 / 20.
   Playwright: 83 passed, 3 skipped. `generation.spec.ts --repeat-each=3`: 72 passed, 6 skipped (the 360 px checks on the mobile project), 0 failed, 0 flaky.
   No live generate. No new accounts.

7. Carry-overs
   See "Carry-overs (owned by later phases)" above.
   currentGoalId === null → Phase 5.
   Overlapping in-flight creates → residual, no second lock.
   Phone lock on a device → Phase 11.
   done → /dashboard → Phase 5 / OD-3.
   Catalogue fields as the method → Phase 12.

8. Issues and risks
   The bundle is still over Vite's 500 KB warning.
   A second Build from a new page load, before the first save is visible to GET, can still create a second goal.
   done still drops onto the legacy dashboard.

9. Not started
   Phase 5 — Today has NOT started.
   OD-3, OD-9 and ND-7 are still Open.
   Nothing was committed.
```

### Phase 4 report (2026-09-23)

```text
ACHIVII REDESIGN — PHASE 4 REPORT

1. Outcome
   Building a path now shows only stages the system is really doing: understanding
   is already done, a method appears only when one was chosen, and the first steps
   wait for the plan. If it takes more than 20 seconds, the screen says so. If it
   fails, the same screen says so, and the answers are still there. Pressing Build
   again does not create a second goal when the server already saved one.
   done still opens the existing dashboard. Today was not opened.
   Phase 4 milestones have been delivered and are awaiting Mo's review.
   Phase 4 is NOT marked COMPLETE.

2. What changed
   StepGeneration, outside the onboarding shell, lists the OD-8 stages from
   generationStages.ts. The method name and whyChosen come only from the method
   event. v1 omits that stage. Silence uses the same 20-second rule as the server,
   on the client clock, with no new event and no percentage. Errors, including an
   unsafe goal, stay on that screen. Every Build checks the active goal first.
   The speech preset now matches the frontend TED title.

3. Files changed / created / removed
   Across M4.1–M4.5. Created: frontend/src/components/onboarding/generationStages.ts,
   StepGeneration.test.tsx, frontend/e2e/fixtures/generation/ (v2-success, v1-fallback,
   custom-error). Changed: StepGeneration.tsx, useOnboardingState.ts and its test,
   OnboardingWizard.tsx (generation branch), generation.spec.ts, onboardingStates.spec.ts,
   mockApi.ts, backend/src/lib/ai/presets/speech.ts (one matching pattern, M4.2),
   backend/test/presetMatch.test.ts, Design.md, docs/decisions.md, docs/phases.md.
   payload.ts was not changed. No route, schema, or save function was changed.

4. Functionality preserved
   R-2 preset and custom create still complete, or fail with Achivii's own sentence.
   R-4 bodies still match the M3.1 fixtures, including a retry.
   R-5 / R-7 the created goal still carries weeks and week-1 tasks into onGoalCreated.
   R-6 the three orders still render: v2, v1, and search then error.
   R-15 a switch does not delete the current goal, and that goal is not treated as the new plan.
   R-16 the draft is cleared only when a plan is created or recovered.
   R-18 Back during generation stays on the generation screen.
   Verified in the M4.5 matrix.

5. Decisions applied
   OD-8 A amended, logged at M4.1, built in M4.2 and M4.3. Stream labels unused.
   ND-17 A, logged at M4.1, implemented in M4.2. ND-16 unchanged: the prior-goal id
   is not a draft. D-11: the only backend change in the phase is the speech pattern.
   OD-3, OD-9 and ND-7 stay Open and block Phase 5.

6. Validation evidence
   See "Verification evidence" above and the M4.5 matrix.
   Type-check and production build pass. Frontend Vitest 180 / 23. Backend Vitest 229 / 20.
   Mocked Playwright 83 passed, 3 skipped. `generation.spec.ts --repeat-each=3`: 72 passed, 6 skipped (the 360 px checks on the mobile project), 0 failed, 0 flaky.
   Live generate was not repeated. Kickoff: TED v2 custom, 10K v1, sourdough error.
   axe on the generation screen at 1440, 390 and 360. Phone lock is from the code.

7. Carry-overs
   See "Carry-overs (owned by later phases)" above.

8. Issues and risks found
   The id search still names no search. That is accepted (OD-8); the label was not changed.
   A reload or a second tab before the save is visible can still send a second create.
   done still lands on /dashboard. That drop is real.

9. Not started
   Phase 5 — Today has NOT started.
   Phase 4 is NOT marked COMPLETE.
```

---

## PHASE 5 — TODAY

**Status:** `IN PROGRESS` (M5.1 and M5.2 done 2026-09-23; M5.3 and M5.4 done 2026-09-24; M5.5 and M5.6 done 2026-09-25). M5.7 has not started.

**Source:** BP §08–09, §15–18, §23, §26–27, §31–32, §41, §43–46, §48, OD-3, OD-9, ND-7, ND-18 · VDS §9, §14, §20, §24–26, §28

**Objective:** build the central execution experience. On opening Achivii, the user knows what to do today within seconds.

**Narrative line:** *"Here's your next step."* ("Always bring the user back to the next step", BP §48.)

### Current state

* **Generation handoff (from Phase 4):** on `done`, `OnboardingPage` `handleGoalCreated` calls `setActiveGoal(goal)` then `navigate('/dashboard')`. `ProtectedRoute` also sends a signed-in user who has an active goal from `/onboarding` to `<Navigate to="/dashboard" replace />`, unless the router state is an explicit goal selection (`presetGoal`, `draftGoal`, `switchGoal`, `customGoal` or `isPreset`). Every Build checks `GET /api/goal/active` before create. `OnboardingPage` passes `currentGoalId={goalLoadFailed ? null : activeGoal?.id}`; `null` skips that check (the goal-load error state is this phase's). There is no Today screen, and generation does not pretend to land on one. Post-auth (`resolvePostAuthDestination`, ND-4) lands an active goal on `/`, not `/dashboard`.
* **Two dashboards (line counts at the Phase 5 kickoff, 2026-09-23):**
  * `/` signed-in: the simplified dashboard inside `Home.tsx` (586 lines, including the signed-out landing branch). **Since M5.3:** `components/today/Today.tsx` for a signed-in user with a goal, from `lib/today.ts` and `useTaskActions`; `Home.tsx` keeps the landing, the no-goal pathway invitation and the loading skeleton.
  * `/dashboard`: `DashboardPage.tsx` (26 lines) → `ExecutionDashboard.tsx` (1,228 lines).
  * The shell's "Today" points to `/` and is marked current on both `/` and `/dashboard` (OD-3; the Navbar did the same until M5.2).
* **"Today" is a UTC date** (`new Date().toISOString().split('T')[0]`) in both dashboards. `lib/dateUtils.ts` is unused by either. Tasks come from `currentWeek` only. Selection is the chosen id, else that UTC date, else the first pending task, else the first task. The day counter is calendar days until `targetDate`, clamped at 1–90.
* **What each dashboard shows.** `Home` shows the goal title, the day counter, the session title and duration, steps (number, title, duration, instructions, focus cue), notes, focus, the pathway strip, and links to `/roadmap` and `/dashboard`. It does not show `isKeySession`, `isTestDay`, `whyToday`, pass mark, pitfall, output, `minimumVersion`, resources or `BasisBadge`, and it has no weekly review. `ExecutionDashboard` shows those fields when the task has them, `BasisBadge` when `goal.basis.label` is set, `PlanV2Panel` when `planVersion === 2` and `roadmap` is set, the routine visualiser, focus, the challenge widget, the pathway strip and Week Review. `onResetGoal` is accepted and never called.
* **Supporting components:**
  * `FocusSessionModal.tsx` (648 lines). The timer lives in component state. The task is written only on "Save & Return to Dashboard".
  * `StepChallengeWidget.tsx` (429 lines). Progress is component state and is **not persisted** (BP §43). `inferStepChallenge` invents a challenge when none is stored.
  * `FullDayVisualizer.tsx` (245 lines). The header nests a Focus button inside a button.
  * `DayRoutineTimeline.tsx` (154 lines). Imported by nobody.
  * `BasisBadge.tsx` (25 lines). Rendered only from `ExecutionDashboard`, and only when `basis.label` is set.
  * `PlanV2Panel.tsx` (157 lines). Rendered only from `ExecutionDashboard` for a v2 goal that has a roadmap.
  * `SaaSBuilderModal.tsx` (758 lines). Imported by nobody. Phase 12 owns it (section 6).
* **App navigation:** at the kickoff, `Navbar.tsx` (270 lines) plus a footer that was only the copyright line, rendered in `App.tsx` for every screen that is not chromeless. **Since M5.2:** `components/app/AppShell.tsx` (ND-7). The rail (lg and up) or the bottom bar (below lg) on signed-in screens; a minimal top bar on onboarding and generation; nothing on the landing, auth and `/__ui` screens. `Navbar.tsx` and the footer are removed.
* **Task data (`DailyTask`):** matches the Prisma model. `title`, `detailedSteps` (JSON string of steps: instructions, output, doneWhen/passMark, focusCue, pitfall, timing, resource fields), `implementationIntention`, `durationMinutes`, `slotTime`, `whyToday`, `minimumVersion` (the 10-minute step), `isRestDay`, `isKeySession`, `isTestDay`, `status` (`pending`, `completed`, `skipped`; no UI sets `skipped`), `completedAt`, `notes`, `resourceTitle`, `resourceUrl`, `resourceType`, `resourceWhy`.
* **Writes:** `PATCH /api/goal/tasks/:taskId` accepts `status`, `notes` and `slotTime`. Both dashboards send only `status` and/or `notes`. The server sets `completedAt` when status becomes `completed` and clears it when status returns to `pending`. `Home`'s `handleSaveNotes` did not update the in-memory goal, so a later completion from `ExecutionDashboard` could send `notes: null` and clear a note saved on `/`. Since M5.3, every Today write puts the server's task into `GoalContext`; the dashboard's own note save still does not (section 6).
* **Goal load:** a failed fetch sets `activeGoal` to null and `goalLoadFailed` to true. `refreshGoal` is never called. `Home` does not read `goalLoadFailed`, so a failed fetch looks like no goal. `ProtectedRoute` with `requireGoal` sends any missing goal to `/onboarding` and does not check `goalLoadFailed`.
* **Weekly review:** only the Week Review button on `/dashboard`, and it is always available. `POST /api/goal/weeks/:weekNumber/review`. On a v2 plan, a failed next-week write returns 503 ("Couldn't write next week right now. This week is unchanged; please try again.") before any write.
* **Reset and switch:** "Reset 90-Day Plan" (the Navbar until M5.2; the shell's Account menu since, with a Dialog confirm instead of `window.confirm`) calls `DELETE /api/goal/active` (a real delete) and then opens `/onboarding`. "Switch to this pathway" in the explorer does not delete; the current goal is archived only inside a successful save.

### Decisions (Mo, 2026-09-23, M5.1)

* **OD-3 — Decided (A).** Today lives at `/` for signed-in users, built from `ExecutionDashboard`'s capabilities, in the BP §09 hierarchy. The signed-out landing stays at `/`. `/dashboard` redirects to `/`, keeping query and hash. These change together in M5.8, not before: `OnboardingPage` `navigate('/dashboard')`, `ProtectedRoute`'s `<Navigate to="/dashboard">`, Home "Open Full Day View", Roadmap "Back to Today", and every Playwright assertion that lands on `/dashboard`. `safeNext('/dashboard?…#…')` keeps working through the redirect. Until M5.8, `/dashboard` keeps working exactly as today.
* **OD-9 — Decided (A amended).** Every row in the state matrix below. No Phase 5 backend change. Rows that wait on OD-1a, OD-1b or OD-2 say so in the matrix.
* **ND-7 — Decided (A, narrowed).** Desktop: a restrained left rail. Mobile: a bottom bar. At Phase 5 ship: Today (`/`), Roadmap (the existing `/roadmap`, named "Roadmap", not "Journey"), Pathways (the existing explorer, no hard-coded count), Account (a menu: email, Reset 90-Day Plan with its confirm, Sign out). Progress is omitted until Phase 8. Coach ✦ is omitted until Phase 10. No empty page and no "coming soon" page. The offline indicator lives in the shell. The signed-in footer is removed. Onboarding and generation keep a minimal top bar (wordmark and the Account menu with Sign out), not the rail or the bottom bar. Switch goal stays in the explorer (R-15). Skip link, 44 px targets and no 360 px overflow are part of the shell.
* **ND-18 — Decided (A).** Today's heading is `rawGoal`. The stored `clarifiedOutcome` is shown beneath it, exactly as stored. The frontend does not hide or rewrite it. `saveV2Goal` overwriting `clarifiedOutcome` with `roadmap.finalGoal` is a backend issue in section 6.

### State matrix

| State | Trigger in code | Treatment (intent) | Data used | Waits on | How it is produced for validation (no DB writes) | Milestone |
|---|---|---|---|---|---|---|
| Loading | `GoalContext` `loadingGoal` while `GET /api/goal/active` is in flight | Calm skeleton in the Today layout | None yet | — | Playwright delays `/api/goal/active` | M5.3 |
| No active goal | Fetch succeeded, `activeGoal` null, `goalLoadFailed` false | Invite the user to choose a pathway | — | — | Mock `activeGoal: null`, or the existing no-goal kickoff account | M5.3 |
| Goal-load error | `goalLoadFailed` true and `activeGoal` null | Its own state, with retry (`refreshGoal`). Not the empty gallery. `ProtectedRoute` does not send it to onboarding. While the load failed, Build does not send a create: show the error and retry first. This closes the `currentGoalId === null` hole | The failed fetch | — | Playwright answers `GET /api/goal/active` with an error. A real account is not required | M5.7 |
| Practice day | Pending task for today's UTC date in `currentWeek` | BP §09 hierarchy, with Start. Heading is `rawGoal` (ND-18); `clarifiedOutcome` sits beneath, as stored | `DailyTask` title, duration, steps; `rawGoal`; `clarifiedOutcome` | — | Mock a week whose task date is today, or the Phase 5 kickoff goal on a pending day | M5.3 |
| Key session | That task's `isKeySession` | The same hierarchy, marked as the week's key session | `isKeySession` | — | Mock today's task with `isKeySession: true`. The kickoff week already has a key day; waiting until that date also reaches it | M5.7 |
| Test day | That task's `isTestDay` | Show the week's test and `passIf`. No result field and no stored score | `isTestDay`, `RoadmapWeek.test` | OD-1a (Phase 7) for a result | Mock today's task as `isTestDay` with a week test. No score is written | M5.7 |
| Rest day | That task's `isRestDay` | Rest as part of the plan, and a glance at the next step | `isRestDay`, the next task | — | Mock today's task as a rest day | M5.7 |
| Short on time | The task has `minimumVersion` | A clearly offered reveal on the step ("the 10-minute version"). Not hidden and not forced. The data is unchanged | `minimumVersion` | — | Mock or the kickoff v2 tasks, which already carry `minimumVersion`. Open the reveal in the test | M5.4 |
| Done for today | Task `status` is `completed` | Quiet confirmation, the step lit, the next step previewed. No XP | `status`, `completedAt`, the next task | — | Complete through the UI on a throwaway account (a real PATCH), then reload. Mock can show the completed payload without a write | M5.6 |
| Not completed yesterday | The previous day's task in this week is still `pending` | "Here's how we can recover." Never "missed". No rescheduling and no new data | The previous task's `status` | — | Mock yesterday's task `pending` and today's task `pending` | M5.7 |
| Review due | The Week Review entry (R-12), emphasised once every task date in the week is before today | Reachable every day, as it is now. Emphasised after the week's days have passed. Phase 7 owns the screen | Task dates, `currentWeek` | — | The entry is asserted on an ordinary mocked week. The emphasis uses a mocked week whose dates are all in the past. Do not call the model | M5.7 |
| Review failed | `POST /api/goal/weeks/:weekNumber/review` returns 503 | The server's sentence ("Couldn't write next week right now. This week is unchanged; please try again."), with retry. No second write | The 503 body | — | Playwright mocks that 503. Do not submit a real review | M5.7 |
| After week 12 / days 85–90 | `currentWeek` is 12 and the calendar is past the planned days; the day counter clamps at 90 | No invented tasks and no final-stretch content. Copy does not say the goal is complete | `currentWeek`, the day counter, the week-12 tasks | OD-2 | Mock `currentWeek: 12` and task dates in the past. A real account cannot reach this without waiting or a database write; the mock covers it | M5.7 |
| Completed goal | `Goal.status` `completed` is in the type. The server only uses `active` and `archived` | No screen in Phase 5 | — | OD-1b (Phase 9) | Not produced. There is nothing honest to show until the server can mark a goal complete | — |
| API offline | `apiStatus === 'offline'` from the load-time health check, or a write fails because the backend is down | Say so. A failed write never looks successful. The one-time health check and the forced sign-out on reload stay as they are (section 6) | `apiStatus`; the failed PATCH | — | Playwright `healthDown`, or stop the backend on a loaded page and attempt a write. No database write | M5.7 |

### In scope

* **The application shell and navigation** per ND-7, replacing `Navbar.tsx` and the app footer for signed-in screens.
* **The Today hierarchy** (BP §09, §46): goal → Day N / 90 → today's step → duration → Start → progress glance → the way into the Journey.
* **The daily session with progressive reveal** (BP §31):
  * *What:* the title.
  * *Why:* `whyToday`.
  * *How:* the steps, with their instructions.
  * *Done when:* `doneWhen` / `passMark`.
  * *Focus cue*, *pitfall*, the resource with its reason, and the 10-minute version (`minimumVersion` is a reveal the user opens, not a step that is forced and not a step that is hidden).
  * **None of this content is removed; it is revealed on demand.**
* **Focus mode** (BP §32): the existing timer, fully functional, in a focused visual state.
* **Completion interaction:** the step lights up, then the next step appears (VDS §20). Subtle; no XP explosion.
* **Notes** (R-10).
* **Every state from OD-9**, in encouraging language (BP §18).
* **The basis badge**, restyled, showing the same data it shows today.
* **Migration** of the Today-related components onto Phase 0 primitives.

### Out of scope

* The Journey view (Phase 6), Weekly review (Phase 7) and Progress (Phase 8), beyond an entry point that follows ND-7.
* Persisting challenge progress. `StepChallengeWidget` either stays as it is, clearly session-only, or is hidden. It must not look saved.
* Notifications and reminders (BP §43).

### Backend allowance

None.

### Files likely affected

* `frontend/src/App.tsx`
* `frontend/src/components/ProtectedRoute.tsx`
* `frontend/src/components/Navbar.tsx` (replaced)
* `frontend/src/pages/Home.tsx` (signed-in branch)
* `frontend/src/pages/DashboardPage.tsx`
* `frontend/src/components/ExecutionDashboard.tsx` (decomposed)
* `frontend/src/components/FocusSessionModal.tsx`
* `frontend/src/components/StepChallengeWidget.tsx`
* `frontend/src/components/DayRoutineTimeline.tsx`
* `frontend/src/components/FullDayVisualizer.tsx`
* `frontend/src/components/BasisBadge.tsx`
* `frontend/src/lib/formatters.ts`, `frontend/src/lib/dateUtils.ts`
* new `frontend/src/components/app/*` and `frontend/src/components/today/*`

### Milestones

| ID | Milestone |
|---|---|
| M5.1 | **Done** (2026-09-23). OD-3, OD-9, ND-7 and ND-18 decided. State matrix written. The mobile generation-reload spec waits on the create request. The slow line keeps counting after a slow event |
| M5.2 | **Done** (2026-09-23). Application shell and navigation (ND-7): the rail on desktop, the bottom bar on mobile, the onboarding top bar, Account with the Reset confirm, the offline chip, the skip link and one `main#main` per screen. `Navbar.tsx` and the footer removed |
| M5.3 | **Done** (2026-09-24). Today at `/` for the normal practice day, from `lib/today.ts` (task choice, day counter, UTC date rule) and one write path (`useTaskActions`) that puts the server's task into `GoalContext`. Heading is `rawGoal` (ND-18). The note wipe from `/` is closed. "Explore Goals (10)" and the strip left Today |
| M5.4 | **Done** (2026-09-24). Daily session with progressive reveal (every field preserved). The 10-minute version is a reveal the user opens. The extra period after `passIf` is fixed |
| M5.5 | **Done** (2026-09-25). Focus mode redesigned; timer behaviour identical. Deliberate practice step runner with instructions, cues, timing, outputs, pass marks, and collapsible tips. Session-only step challenge widget restyled. Reflection reliably captured into notes; write errors surfaced with retry; Space/Esc shortcuts and 0 axe violations |
| M5.6 | **Done** (2026-09-25). Completion interaction, step lighting, next step preview, and notes redesign. Completed step illuminated with calm botanical highlight (VDS §20, OD-9); next step preview card with day/duration/snippet; structured focus wins presentation alongside free-form practice notes; auto-save on blur and draft persistence across WeekGlance day switches |
| M5.7 | Every remaining OD-9 state, including goal-load error and a failed offline write that is visible |
| M5.8 | `/dashboard` redirects to `/`, keeping query and hash. `done` and `ProtectedRoute` change in this same milestone. What M5.3–M5.6 did not already extract is removed |
| M5.9 | Regression and phase report |

### Regression checks

R-8, R-9, R-10, R-11, R-12 (entry point), R-15, R-17.

### Mobile acceptance

3.7 applies, plus:

* "Today → Start → Complete → Progress" in the fewest taps (VDS §28).
* Start is reachable with the thumb.
* Focus mode is usable in portrait and landscape.

### Validation

* Walk every OD-9 state; use seeded or adjusted development data where a state is hard to reach, and document how each was produced.
* Complete, then reload.
* Save a note, then reload.
* Run the focus timer start to finish.
* Stop the backend.
* Keyboard-only pass.
* Reduced motion.

### Exit criteria

* One Today screen.
* Every DailyTask field that was visible before is still reachable.
* Every OD-9 state has a designed treatment.
* No navigation item leads to an empty page.

### Risks

* Losing session content in the name of minimalism (BP §31 warns against this).
* Dashboard decomposition breaking completion or notes.
* OD-3 redirect changes breaking deep links.

### M5.1 report — Decisions, state matrix, two Phase 4 follow-ups (2026-09-23)

```text
1. Outcome
   OD-3, OD-9, ND-7 and ND-18 are Decided and match this section.
   The Phase 5 state matrix is written. Each row says how it will be produced.
   The milestone table carries the amendments.
   The mobile generation-reload spec is green. The still-working line keeps
   counting after a slow event, still as one line.
   M5.2 has NOT started.
   No Today UI, shell or redirect was implemented.

2. What changed
   Part A is documentation. The four decisions, the state matrix, the amended
   milestones and the section 6 rows are recorded. Nothing on screen changed
   for Today.
   Part B is two follow-ups on the generation handoff, and nothing else in
   generation.
   B1. The heading "Building your path" is shown when the step becomes
   generation, and that happens before GET /api/goal/active returns and before
   POST /api/goal/create is sent. The spec read calls.create at that moment.
   On mobile the POST had not been recorded yet, so the length was 0. Desktop
   was fast enough that the same assertion passed. Separately, the helper's
   click scrolled the "45 min" label only to the bottom edge, where the sticky
   step footer covers the hit target. Other mobile runs reach that control, so
   the user can still scroll to it. The spec now waits until the create request
   and the active-goal GET are recorded, and the helper scrolls the label to
   the centre before the click. No production code was changed.
   B2. Before: a slow event fixed the seconds at Math.round(elapsedMs / 1000)
   and later client time was not added, so "Still working (132s)" stayed at
   132 until done at about 181 seconds. After: the line continues from that
   event's seconds plus whole client seconds since the event arrived, still
   one line on the active stage. A later event with slow: false clears it and
   the 20 seconds start again. Silence before any slow event is unchanged.
   The polite status sentence is still said once, not on every tick.

3. Files changed / created / removed
   Changed:
   - docs/decisions.md
   - docs/phases.md
   - Design.md (one sentence on the still-working line)
   - frontend/src/components/onboarding/generationStages.ts
   - frontend/src/components/onboarding/StepGeneration.tsx
   - frontend/src/components/onboarding/StepGeneration.test.tsx
   - frontend/e2e/generation.spec.ts
   - frontend/e2e/onboardingFlow.ts
   - frontend/e2e/onboardingStates.spec.ts
   Created: none.
   Removed: none.
   No backend file changed. payload.ts was not changed. Home, ExecutionDashboard
   and FocusSessionModal were not changed. Nothing was committed.

4. Functionality preserved
   The stages, the stream ids, the error layout, GET-before-create, the
   sessionStorage prior-goal key and the M3.1 create bodies are unchanged.
   Silence before a slow event still waits 20 seconds and counts from the
   start of the attempt. A slow: false event still clears the line. The live
   region still omits the ticking number. done still opens /dashboard.
   Until M5.8, /dashboard keeps working exactly as today.

5. Decisions applied
   OD-3 Decided (A). OD-9 Decided (A amended). ND-7 Decided (A narrowed).
   ND-18 Decided (A): the heading will be rawGoal, and clarifiedOutcome is
   shown beneath it as stored. They are logged here. They are not built.
   The saveV2Goal overwrite (goal.ts line 145, clarifiedOutcome: roadmap.finalGoal)
   is a section 6 backend issue, owner unassigned.

6. Validation evidence
   Frontend tsc --noEmit: clean (the production build runs it first).
   ESLint on the changed frontend files: clean.
   Frontend Vitest: 181 passed / 23 files.
   Frontend build: main JS 568.52 KB (167.77 KB gzipped), CSS 101.30 KB
   (17.71 KB gzipped). The chunk warning remains.
   B1: onboardingStates.spec.ts:245 --repeat-each=5, both projects: 10 passed,
   0 failed (2.9m). Retries are not configured, so nothing was marked flaky.
   B2: StepGeneration.test.tsx shows 132, then 135 after 3 seconds, one line,
   and a slow: false event clears it. The v1 Playwright fixture, clock
   controlled, shows "Still working (88s)." then "(90s)." then /dashboard,
   one line, on desktop and mobile.
   Full mocked Playwright, both projects: 143 passed, 5 skipped, 0 failed
   (12.2m). The five skips are the same checks as before: the 390 px keyboard
   check is desktop-skipped, the keyboard-order check is mobile-skipped, the
   two 360 px generation checks run only on desktop, and the in-app switch-goal
   check runs only on desktop.
   Backend: not touched, not rerun.

7. Carry-overs
   M5.4: the extra period after passIf.
   M5.5: the focus reflection must be in the completion write.
   M5.6: the Home note wipe. From M5.3, every Today write puts the server's
   result back into GoalContext.
   M5.7: a failed write while the backend is down must be visible, plus the
   remaining OD-9 states.
   M5.8: the /dashboard redirect, done, and ProtectedRoute, together.
   The clarifiedOutcome overwrite stays unassigned until a backend allowance.

8. Issues and risks
   The mobile failure was the spec, not production behaviour. B1 did not change
   production code.
   The frozen counter was production behaviour against the Phase 4 contract.
   It is fixed in the two generation files. Phase 4 was not reopened.
   Today will show a stored outcome that may be the model's finalGoal,
   including a value such as 49.98. That is the ND-18 choice. The frontend
   does not rewrite it.

9. Not started
   M5.2 has NOT started.
   No Today UI, shell or redirect was implemented.
   Nothing was committed.
```

### M5.2 report — Application shell and navigation (2026-09-23)

```text
1. Outcome
   Signed-in screens now share one navigation (ND-7): a left rail from 1024 px,
   a bottom bar below it. The entries are Today, Roadmap (only with a goal),
   Pathways and Account. Every entry opens a real page or an existing dialog.
   Onboarding and generation show only a minimal top bar: the wordmark, the
   offline chip, and Account with Sign out. The old Navbar and the signed-in
   footer are gone. Every signed-in screen starts with the skip link and has
   exactly one main#main. The legacy Home, dashboard and roadmap screens look
   and behave as before inside the shell.
   M5.3 has NOT started.
   No Today UI was implemented. /dashboard was not redirected.

2. What changed
   - components/app: AppShell picks the frame from the path and the session.
     The landing, auth and /__ui screens get none. A signed-out protected path
     gets a bare frame while ProtectedRoute sends it to sign-in. Onboarding
     gets the top bar. Every other signed-in screen gets the rail or the bar.
   - Rail: the wordmark, Today, Roadmap, Pathways, a divider, then the offline
     chip and Account. Bottom bar: Today, Roadmap, Pathways, Account, with the
     offline chip in a line above them. The bar is sticky, 64 px targets, and
     sits above the bottom safe area and under every dialog. Today is current
     on / and /dashboard (until M5.8).
   - Account: on desktop, a disclosure (aria-expanded, a panel of buttons, not
     role="menu"). Escape and an outside click close it and return focus;
     tabbing out closes it. Below 1024 px, the existing Dialog (a sheet under
     768 px). It shows the email and, with a goal, "Your goal · Week N" and
     rawGoal (ND-18). Reset 90-Day Plan opens a Dialog confirm: "This deletes
     your current plan and all of its task progress. It can't be undone."
     Same resetGoal() and navigate('/onboarding'). A failed reset says "We
     couldn't reset your plan. Please try again." and stays. Sign out keeps
     logout and navigate('/') inside React.startTransition. No Reset on
     onboarding.
   - Pathways opens the existing PathwaysExplorerModal with the current goal.
     Switch goal still happens only there (R-15).
   - Landmarks: main#main on Home (both signed-in branches), DashboardPage and
     RoadmapPage (landmark only). SkipLink now moves focus to its target
     itself, without a history entry, so onboarding's history lock (R-18)
     never sees it.
   - index.css: animate-fadeIn and animate-fadeInUp fill backwards instead of
     both. The end state is the element's own style, so nothing looks
     different. A finished entrance no longer leaves a stacking context, and
     focus mode and the dashboard's full-screen dialogs cover the shell again.
     Before this, the bottom bar was painted over focus mode.
   - The content column scrolls sideways when a page is too wide, instead of
     widening the document. A wider document grew the layout viewport past the
     screen, and the bar and taps on it drifted off the bottom edge.
   - Below 1024 px, html gets scroll-padding-bottom while the bar is on
     screen, so a focused control is not hidden under it.
   - Page background: the shell uses the token background. The legacy screens
     read correctly on it (screenshots at 1440, 1024, 768, 390 and 360).

3. Files changed / created / removed
   Created:
   - frontend/src/components/app/AppShell.tsx, AppNavigation.tsx,
     AccountMenu.tsx, ResetPlanDialog.tsx, OfflineChip.tsx, shellEntries.ts
   - frontend/src/components/app/AppShell.test.tsx
   - frontend/e2e/shell.spec.ts, frontend/e2e/shellFixtures.ts
   Changed:
   - frontend/src/App.tsx (AppShell instead of Navbar and the footer)
   - frontend/src/pages/Home.tsx, DashboardPage.tsx, RoadmapPage.tsx
     (main#main only)
   - frontend/src/components/ui/A11y.tsx (SkipLink focus) and
     Primitives.test.tsx
   - frontend/src/index.css (fade fill mode; bottom-bar scroll padding)
   - frontend/e2e/mockApi.ts (activeStatus, resetStatus, calls.resets)
   - frontend/e2e/auth.spec.ts: Sign out is reached through the Account
     button in the Primary navigation, labelled "Sign out" (was
     aria-haspopup="true" and "Sign Out")
   - frontend/e2e/pathways.spec.ts: the explorer opener is "Pathways" in the
     Primary navigation (was "Pathways (10)" / "Goals" in the banner). The
     360 px strip test now also checks the document, because the navbar
     overflow it skipped is gone
   - Design.md (§5 Application shell; SkipLink; breakpoints; legacy fades),
     docs/decisions.md (ND-7 implemented), docs/phases.md
   Removed:
   - frontend/src/components/Navbar.tsx
   No backend file changed. ProtectedRoute, GoalContext and AuthContext were
   not changed. No new dependency. M3.1 fixtures unchanged.

4. Functionality preserved
   R-1: sign out lands on the landing page with no /login flash; sign-in with
   a goal lands on /. R-3: the explorer opens from the shell on desktop and
   mobile, and a pathway chosen there starts switch goal with no create and
   no DELETE (shell.spec.ts, both projects). R-15: Reset asks first; cancel sends nothing; confirm sends one
   DELETE and opens onboarding; a failed reset stays. R-17: the offline chip
   still comes from the load-time check, in the shell and in the onboarding
   top bar; when it appears is unchanged. R-18: onboarding history and the
   generation lock are unchanged, and the skip link adds no history entry.
   done still opens /dashboard. The legacy screens, Home's own "Explore Goals
   (10)", FocusSessionModal and the dashboard are unchanged apart from their
   main landmark.

5. Decisions applied
   ND-7 (A, narrowed): exactly Today, Roadmap, Pathways and Account; no
   Journey, Progress, Coach or "coming soon"; Roadmap named "Roadmap"; the
   offline chip in the shell; the footer removed; the onboarding top bar.
   ND-18: the Account goal line is rawGoal, never clarifiedOutcome.
   OD-3: /dashboard is untouched and Today stays current on it until M5.8.
   ND-2: Radix Dialog for the sheet and the confirm; the disclosure is
   hand-built; no dropdown-menu package.

6. Validation evidence
   Frontend tsc --noEmit: clean.
   ESLint on the changed and new files: clean, apart from the errors Home.tsx
   and RoadmapPage.tsx already had (5 errors, 2 warnings, the same before
   M5.2). Full lint: 30 errors / 4 warnings, unchanged (the Navbar had none).
   Frontend Vitest: 193 passed / 24 files (was 181 / 23).
   Build: main JS 572.62 KB (169.03 KB gzipped), CSS 100.20 KB (17.60 KB
   gzipped), against 568.52 / 101.30 KB. The chunk warning remains.
   Full mocked Playwright, both projects: 199 passed, 9 skipped, 0 failed
   (14.9 min, final run). The skips are the five known ones and four
   layout-only ones in shell.spec.ts: the two bottom-bar checks on desktop,
   and the outside click and the rail's Tab order on mobile.
   An earlier full run had 2 failures: mobile taps on the bottom bar on an
   empty /roadmap, whose main is 407 px wide. That grew the layout viewport
   past the screen. The content column now contains it; a test holds it.
   axe (WCAG 2.2 AA tags), before and after, on / with and without a goal,
   /dashboard, /roadmap and /onboarding at 1440, 390 and 360 (1024 and 375 in
   the spec): the only violation is the known nested-interactive on
   /dashboard (FullDayVisualizer), before and after. With a shorter 800 px
   window, raw axe also reports target-size on one or two legacy controls
   that sit partly under the bottom bar at that scroll position. The spec
   re-checks each one scrolled to the middle, where it passes.
   Overflow at 360, 375 and 390: 0 px on every screen, document and content
   column (the navbar's 7 px is gone). Every shell control is at least
   44 x 44 px; bottom-bar items are 64 px. Focus mode on / and /dashboard
   covers the rail and the bar.
   Browser (real backend, the Phase 5 kickoff account, no writes): rail at
   1440 and 1024, bar at 768, 390 and 360, with the kickoff plan. Account
   shows "Run a 10K Under 50 Minutes", not 49.98. Reset opened and was
   cancelled; the goal was still active afterwards. Pathways from the bar;
   Roadmap current on /roadmap; Today current on /dashboard. Reduced motion:
   the longest shell transition was 0.01 ms. Console clean apart from the
   dashboard's known nested-button warning. Sign out landed on the landing
   page. This webview does not move focus on Tab without OS focus, so the
   keyboard pass is from Playwright (skip link, wordmark, Today, Roadmap,
   Pathways, Account, into the panel, and out).
   Backend: not touched, not rerun.

7. Carry-overs
   M5.3: Today at / (rawGoal heading, stored outcome beneath). Home's
   "Explore Goals (10)" and its legacy notice go with it.
   M5.7: the goal-load error state (the shell already hides Roadmap then),
   and a failed write while offline. The chip is still a one-time check.
   M5.8: the /dashboard redirect, done and ProtectedRoute together; Today is
   current on /dashboard until then.
   Phase 6: /roadmap with an empty roadmap is still 407 px wide; it now
   scrolls inside the content column. Journey replaces the Roadmap entry.
   Phases 8 and 10: Progress and Coach add their entries.

8. Issues and risks
   The fade fill change is global. Nothing uses those utilities with an
   opacity or transform of its own, and the end state is identical.
   The content column hides nothing, but it turns page overflow into a
   sideways scroll inside the page. The specs measure the column as well as
   the document, so new overflow still fails a test.
   Home's loading state and ProtectedRoute's spinner have no main while they
   show. The skip link has no target for that moment.
   A signed-out visitor on a protected path briefly sees no navigation before
   the redirect to sign-in. The old navbar's Sign In and Get Started buttons
   are gone with it; the landing and auth screens have their own.

9. Not started
   M5.3 has NOT started.
   No Today UI was implemented. /dashboard was not redirected.
   Nothing was committed.
```

### M5.2 review outcomes (Mo, 2026-09-24)

* M5.2 accepted.
* Account stays in the desktop rail and in the mobile bottom bar.
* On onboarding and generation, Account shows only the email and Sign out: no goal line and no Reset.

### M5.3 report — Today for the practice day (2026-09-24)

```text
1. Outcome
   A signed-in user with a goal opens / and sees one Today, in this order:
   the goal they chose, Day N / 90, today's step, its duration, Start, a
   glance at the week, then Roadmap and the full day view. The heading is
   rawGoal. The stored outcome sits beneath it exactly as stored.

2. What changed
   Home's signed-in branch with a goal is Today. Loading is TodaySkeleton.
   No goal is still the pathway invitation. Signed-out is still the landing.
   The step shows its real title, "N min" and "· at {slotTime}" when the task
   has one, Start (opens the existing FocusSessionModal) and Mark complete /
   Mark not done. The steps (number, title, duration, instructions, focus
   cue) and the notes (blur and an explicit Save) sit behind plain reveals.
   The week glance is the seven real tasks: done, rest, today, not done.
   Choosing a day shows that day's step. The count is practice days only.
   A failed write says "That didn't save. Try again." and leaves the step.
   Every write sends updateDailyTask and, on success, puts the server's task
   into GoalContext.

   Date rule, unchanged. DailyTask.date is a UTC calendar date:
   toISOString().split('T')[0] in backend/src/routes/goal.ts:215 (v1 save)
   and :691 (the week-review writer), and backend/src/lib/ai/weekPlan.ts:52.
   dayOfWeek uses the server's local clock (weekPlan.ts:53,
   goalDecomposer.ts:984). user.timezone is saved at signup and read by no
   date writer. Today compares UTC dates, the calendar the dates are written
   in. Nothing in the backend changed. The mismatch is a section 6 row,
   owner unassigned.

   What every non-practice OD-9 state shows now:
   - Loading: TodaySkeleton. No main while it shows (the same gap the shell
     already had for the spinner).
   - No active goal: the pathway invitation, unchanged.
   - Goal-load error: still that invitation, because Home only checks that
     there is no goal. The distinct error and retry are M5.7.
   - Rest day: the real title, the duration, Start, and a "Rest day" badge.
     The week's cell says "Rest". No rest sentence and no next-step callout.
   - Key session: the same hierarchy plus a "Key session" badge.
   - Test day: the same hierarchy plus a "Test day" badge. No pass mark and
     no score.
   - Short on time: the same as a practice day. minimumVersion is not
     offered (M5.4).
   - Done: a "Done" badge and "Mark not done". No lighting and no next-step
     preview (M5.6).
   - Not completed yesterday: the same as a practice day. No recovery
     sentence (M5.7).
   - Review due: no emphasis on Today. The caption points at the full day
     view, which still holds the week review (M5.7).
   - After week 12: the day number stays at 90. A week with no task says
     "No step is planned for this week yet." No final-stretch copy.
   - Completed goal: no branch. The server only uses active and archived, so
     there is nothing distinct to show.
   - Offline: the chip is still the one-time health check. A failed write
     shows the sentence above and changes nothing. The rest of the offline
     treatment is M5.7.

   Removed from Today, and where each remains:
   - "Explore Goals (10)": the shell's Pathways entry opens the same
     explorer. onboarding.spec.ts and pathways.spec.ts open it from there.
   - The pathway strip: gone from Today. ExecutionDashboard on /dashboard
     still has it. The small-screen strip test now opens /dashboard.
   Kept on Today: the steps reveal, notes, the week glance, Start (focus
   mode), complete, slot time, the pathway notice ("from Pathways", tokens),
   Roadmap → /roadmap, and "Open full day view" → /dashboard.

3. Files changed / created / removed
   Created:
   - frontend/src/lib/today.ts, today.test.ts
   - frontend/src/components/today/Today.tsx, Today.test.tsx,
     useTaskActions.ts, useTaskActions.test.tsx
   - frontend/e2e/today.spec.ts
   Changed:
   - frontend/src/pages/Home.tsx (signed-in with a goal renders Today)
   - frontend/e2e/mockApi.ts (task writes mutate the saved goal, so a reload
     sees them; taskUpdateStatus)
   - frontend/e2e/shell.spec.ts (Start is the exact name "Start")
   - frontend/e2e/onboarding.spec.ts (the explorer opens from the shell)
   - frontend/e2e/pathways.spec.ts (three tests: the explorer from the shell;
     the strip test on /dashboard)
   - Design.md (§6 Today; later sections renumbered), docs/decisions.md
     (ND-18 implemented), docs/phases.md
   Removed: nothing.
   ExecutionDashboard, FocusSessionModal, GoalContext, the shell, the
   backend and the M3.1 fixtures were not changed. No new dependency.

4. Functionality preserved
   R-8: Start opens focus mode for this step (today.spec.ts). The modal was
   not changed; the reflection-on-Enter bug stays with M5.5. A failed focus
   completion is recorded on Today and does not throw, because the modal
   swallows a throw and would otherwise look saved.
   R-9: Mark complete writes status and the current note, shows the server
   task, and is still done after a reload. Mark not done returns it to
   pending. Both projects.
   R-10: a note saved on Today is in the completion PATCH and is still in
   the field after a reload. A note saved on Today is still in the PATCH
   when the completion happens on /dashboard (the kickoff wipe). The
   dashboard's own note save still does not update GoalContext (section 6).
   R-11: the week glance shows the week's real statuses and selecting a day
   shows that step.
   R-12: the week review stays on /dashboard, reached by "Open full day view".
   R-15 and R-17: the shell is unchanged.
   done still opens /dashboard. /dashboard was not redirected.

5. Decisions applied
   OD-3: Today is at / for a signed-in user with a goal. /dashboard is
   untouched and Today stays current on it until M5.8.
   OD-9: the practice day is the hierarchy above. Every other row renders
   the real title and the real status, or the existing loading and no-goal
   screens, and does not invent copy. The rows that wait are named in
   point 2.
   ND-18: the h1 is rawGoal. "90-day outcome:" plus clarifiedOutcome, as
   stored, never through formatGoalTitle. Logged as implemented in
   docs/decisions.md.

6. Validation evidence
   Frontend tsc --noEmit: clean.
   ESLint on the changed and new files: clean. Full lint: 29 errors /
   3 warnings (was 30 / 4). Home's signed-in branch took its errors with it.
   RoadmapPage's pre-existing hook errors are unchanged.
   Frontend Vitest: 215 passed / 27 files (was 193 / 24).
   Build: main JS 569.38 KB (169.01 KB gzipped), CSS 99.83 KB (17.57 KB
   gzipped), against 572.62 / 100.20 KB. The chunk warning remains.
   Full mocked Playwright, both projects: 225 passed, 9 skipped, 0 failed
   (14.7 min). The skips are the same nine as M5.2.
   today.spec.ts, both projects: hierarchy order, the rawGoal heading, Day
   N / 90, Start opens focus, complete survives a reload, a note survives
   complete and a reload, the cross-screen wipe, a failed write, the steps
   reveal, the week glance, Roadmap and the full day view, the empty week.
   Layout: 1440, 390 and 360, overflow at most 1 px, every visible control
   in main at least 44 px, axe (WCAG 2.2 AA) empty, Start above the bottom
   bar at 390×844, keyboard from the skip link to Start to focus mode,
   reduced motion with no visible animation.
   Browser on the kickoff account
   (phase5-kickoff-1790182044713@example.com, no task writes): `/` is the
   new Today. One h1: "Run a 10K Under 50 Minutes". Beneath it, as stored:
   "90-day outcome: 49.98". Day 1 of 90. Week 1 with the stored phase and
   theme. Today's step is already Done from the kickoff (Wednesday,
   "Establish easy base pace on outdoor asphalt", 30 min · at 19:30,
   "Mark not done"). The week glance: 2 of 5 practice days done; Saturday
   and Tuesday are Rest. Choosing Friday shows "Friday's step" and that
   day's title; choosing Saturday shows "Rest day" and a Rest day badge;
   choosing Wednesday again restores today. No "Explore Goals (10)", no
   strip. Rail at 1440 and 1024; bottom bar at 390×844 and 360×740. Overflow
   0 px. Start is in the first screen and above the bar at 390 and 360
   (height 48 px). No visible control in main is under 44 px. Console: no
   Vite overlay; `/api/health`, `/api/auth/me` and `/api/goal/active` all
   200. This webview does not move focus on Tab without OS focus, so the
   keyboard pass is from Playwright (skip link, Start, focus mode). No
   complete, un-complete or note was saved on this account.
   Backend: not touched.

7. Carry-overs
   M5.4: the progressive reveal (why, done when, pitfall, resource, the
   10-minute version) and the extra period after passIf.
   M5.5: focus mode's look, and the reflection included in the write.
   M5.6: completion lighting and the notes design. The wipe from / is
   already closed.
   M5.7: the remaining OD-9 states in point 2, including the goal-load
   error and a failed write while offline.
   M5.8: the /dashboard redirect, and the dashboard's own note save.
   The UTC date mismatch (section 6) needs a backend allowance. Unassigned.

8. Issues and risks
   Near UTC midnight a user far from UTC sees the neighbouring day's task,
   and a plan created then can label a date with the wrong weekday. Today
   follows the dates as written.
   A focus completion that fails is visible only after the modal closes,
   because the modal does not surface the error.
   Loading still has no main, so the skip link has no target for that moment.

9. Not started
   M5.4 has NOT started.
   /dashboard was not redirected.
   Nothing was committed.
```

### M5.4 report — Daily session with progressive reveal (2026-09-24)

```text
1. Outcome
   Every session field from BP §31 that exists in the stored task is now
   reachable on Today (/), revealed on demand rather than dumped into a wall
   of copy. Nothing is removed; empty fields add zero chrome. whyToday appears
   directly under the session title/duration without pushing Start below the
   first screen at 390 × 844. Steps progressively reveal instructions, focus
   cue, timing, output, passMark ("Done when: ..."), and step-level resources
   (with external links and reasons, without YouTube embeds). Task-level
   resource, implementation intention (when / where / action or raw), and the
   10-minute version (OD-9 short on time) are distinct, closed-by-default
   reveals. PlanV2Panel no longer duplicates terminal periods. Onward copy
   accurately reflects what still lives only on /dashboard.

2. What changed
   - Today (frontend/src/components/today/Today.tsx):
     - whyToday: rendered under duration when present; never uses fallback
       copy; omitted if null or empty.
     - How (the steps): "Show the N steps" expands each step card to show
       instructions, focus cue, timing ("Timing: "), output ("Output: "),
       passMark ("Done when: "), and step-level resource (title, link if valid
       HTTP(S) URL, reason). Empty fields omit their labels completely.
     - The 10-minute version: offered as a quiet reveal ("The 10-minute
       version"), closed by default, rendered only when minimumVersion is
       present. Reveals stored title, duration, instructions, and passMark.
       No second Start button.
     - Implementation intention: parsed using parseIntention; rendered only
       when non-empty. Shows structured when/where/action grid or raw string.
     - Resource: task-level reveal showing title, external link if valid URL,
       badge type, and why reason. No YouTube iframes on Today (level 1 calm).
     - Onward copy: updated from "The full day view shows why today matters,
       pass marks, resources..." to "The full day view shows the week review,
       plan panel and routine visualiser when your plan has them."
   - PlanV2Panel (frontend/src/components/PlanV2Panel.tsx & lib/formatters.ts):
     - Extracted and exported formatPassIf helper to test terminal
       punctuation ([.!?]$) before appending a period.
     - Unit tests added in PlanV2Panel.test.tsx.
   - Tests:
     - Today.test.tsx: 11 tests covering full session fixture, empty fixture,
       raw implementation intention, and updated onward copy.
     - today.spec.ts: 30 tests covering whyToday present/absent, detailed step
       fields on demand, 10-minute version closed by default, layout at 1440,
       390, 360 with whyToday set (Start above bar at 390×844), targets ≥ 44px,
       and reduced motion.

   Field availability on Today:

| Field | On Today | How it is reached | Omitted when empty? |
|---|---|---|---|
| rawGoal | Yes | Page h1 (ND-18) | No (required) |
| clarifiedOutcome | Yes | Under h1 as stored | Yes (omitted if empty) |
| dayNumber | Yes | "Day N / 90" numeral | No (clamped 1–90) |
| currentWeek / phase / theme | Yes | Beside day number | Yes (omits missing phase/theme) |
| title | Yes | Step h2 | No |
| durationMinutes / slotTime | Yes | Step duration line | Yes (slotTime omitted if empty) |
| whyToday | Yes | Below duration | Yes (omitted if empty; no fallback) |
| Start / Complete | Yes | Action buttons | No |
| detailedSteps | Yes | "Show the N steps" reveal | Yes (hidden if 0 steps) |
| step.instructions | Yes | Inside step card | Yes |
| step.focusCue | Yes | Inside step card ("Focus: ") | Yes |
| step.timing | Yes | Inside step card ("Timing: ") | Yes |
| step.output | Yes | Inside step card ("Output: ") | Yes |
| step.pitfallToAvoid | Yes | Inside step card ("Pitfall: ") | Yes |
| step.passMark | Yes | Inside step card ("Done when: ") | Yes (no duplicate period) |
| step.resourceTitle / Url / Why | Yes | Inside step card ("Resource: ") | Yes (no iframe embed) |
| minimumVersion | Yes | "The 10-minute version" reveal | Yes (omitted if null) |
| implementationIntention | Yes | "Implementation intention" reveal | Yes (omitted if empty) |
| task.resourceTitle / Url / Type / Why | Yes | "Resource" reveal | Yes (omitted if empty) |
| notes | Yes | "Notes" reveal | No |
| weekGlance | Yes | 7-day row | Yes (omitted if 0 tasks) |
| Roadmap link | Yes | Onward nav | No |
| Full day view link | Yes | Onward nav | No |

3. Files changed / created / removed
   Created:
   - frontend/src/components/PlanV2Panel.test.tsx
   Changed:
   - frontend/src/components/PlanV2Panel.tsx
   - frontend/src/lib/formatters.ts
   - frontend/src/pages/RoadmapPage.tsx (import formatTarget from lib/formatters)
   - frontend/src/components/today/Today.tsx
   - frontend/src/components/today/Today.test.tsx
   - frontend/e2e/today.spec.ts
   - Design.md (§6 Today)
   - docs/phases.md (M5.4 report, milestone table, Section 6, change log)
   Removed: nothing.
   Backend and M3.1 fixtures were not changed. No new dependencies.

4. Functionality preserved
   R-8: Start remains primary action; focus session opens directly from Today.
   R-9: Mark complete and Mark not done continue to write through useTaskActions
   and update GoalContext.
   R-10: Note saves and survives completion and reload.
   R-11: Week glance displays 7 days; selecting a day displays that day's step
   and its progressive reveals.
   R-12: Full day view link opens /dashboard with updated explanatory copy.
   R-15, R-17: Shell and navigation unchanged.
   /dashboard was NOT redirected.

5. Decisions applied
   OD-3: Today remains at /; /dashboard remains untouched and unredirected.
   OD-9: Short on time is an opt-in reveal ("The 10-minute version"), closed by
   default, not forced, and not hidden. Shows stored minimumVersion data.
   ND-18: Heading is rawGoal; outcome is clarifiedOutcome as stored.

6. Validation evidence
   Frontend tsc --noEmit: clean (0 errors).
   ESLint on changed files: clean (0 errors, 0 warnings).
   Full lint: 28 errors / 3 warnings (improved from 29 / 3 baseline by
   resolving PlanV2Panel fast-refresh violation).
   Frontend Vitest: 224 passed / 28 files (was 215 / 27).
   Build: main JS 574.95 KB (170.28 KB gzipped), CSS 99.83 KB (17.57 KB
   gzipped).
   Full mocked Playwright: 229 passed, 9 skipped, 0 failed across desktop
   and mobile (17.6 min).
   today.spec.ts: 30 passed across desktop and mobile (54.6s).
   Live browser test on kickoff account (phase5-kickoff-1790182044713@example.com,
   no writes):
   - whyToday visible on screen ("Locks in the 174-180 SPM cadence target...").
   - 10-minute version offered closed by default ("The 10-minute version").
   - Click opens to stored copy: "Short cadence jog", 10 min, instructions
     and passMark ("Done when: Cadence target maintained for the full duration").
   - Steps reveal expands to instructions and passMark.
   - Start is above the bottom bar at 390 × 844.
   - No writes performed (read-only).

7. Carry-overs
   M5.5: focus mode redesign (Enter-saves-before-text, reflection included
   in completion write).
   M5.6: completion lighting and notes redesign.
   M5.7: remaining OD-9 states (rest day, test day, review due, goal-load error,
   offline write failure).
   M5.8: /dashboard redirect to /.

8. Issues and risks
   None new. Playwright driver download requires local cache; verified and
   cleanly executed.

9. Not started
   M5.5 has NOT started.
   /dashboard was not redirected.
   Nothing was committed.
```

### M5.5 report — Focus mode redesign (2026-09-25)

```text
1. Outcome
   Focus mode is redesigned as a distraction-free, Level 1 execution surface
   (BP §32) built entirely on Phase 0 tokens and primitives. Legacy mint (#07CB6C)
   and deleted dark hexes (#050807, #0c1210, #1a2824) are completely replaced.
   Timer mechanics (1-second tick loop, pause/resume, reset, spacebar toggle,
   Web Audio sound effects via audio.ts, mute toggle) are strictly preserved.
   The Deliberate Practice Step Runner presents instructions, focus cues, timing,
   outputs, pass marks ("Done when: ..."), and collapsible tips. StepChallengeWidget
   is restyled with Phase 0 tokens and verified as strictly session-only (no backend
   writes or persistence, BP §43). Reflection capture into task notes is reliable:
   multi-line Textarea prevents premature submission on Enter; failed network/server
   writes (500, network drop) display an inline accessible alert (role="alert"), keep
   the modal open, preserve the entered reflection text, and allow safe retry via
   "Try again". Full WCAG 2.2 AA compliance verified with 0 axe violations.

2. What changed
   - Step challenge library & widget:
     - Extracted pure inferStepChallenge helper to frontend/src/lib/stepChallenge.ts
       (satisfies react-refresh/only-export-components).
     - Restyled frontend/src/components/StepChallengeWidget.tsx with Phase 0 tokens
       (bg-surface, border-border, text-accent, Button primitive, targets ≥ 44px).
       Maintained strictly session-only scope (BP §43).
   - Focus components (frontend/src/components/focus/):
     - FocusHeader.tsx: Day N of 90 • Focus Mode (h1 provides dialog accessible name),
       mute toggle, duration badge, exit button (Esc).
     - FocusTimer.tsx: Monospace tabular countdown (font-ui-mono tabular), circular
       SVG progress indicator (stroke-border track, stroke-accent progress), In Flow /
       Paused status indicator, Pause/Resume button, Reset button, step navigation pills.
     - FocusStepRunner.tsx: Step index and duration target, step title, instructions,
       evidence layer badges (focus cue, timing, output, pass mark), StepChallengeWidget,
       collapsible guidance tips, previous/next controls with disabled boundaries, and
       clean fallback card for tasks without parsed steps.
     - FocusCompletion.tsx: Deliberate Practice Complete badge, Day N Mastered heading,
       quick stats (Time Logged, Day N / 90), reflection Field with Textarea (explicit
       button or Ctrl+Enter save, preventing accidental submit on Enter), inline error
       alert (role="alert"), Save & Return button with loading state.
   - FocusSessionModal (frontend/src/components/FocusSessionModal.tsx):
     - Refactored to mount FocusSessionContent keyed on task.id, cleanly initializing
       state on mount without set-state-in-effect.
     - Full accessibility: focus trap on mount and restoration to trigger on unmount;
       Escape key listener; Spacebar toggle for pause/resume (bypassed when focused
       on inputs/textareas); body scroll locked cleanly and restored.
     - Completion write error handling (R6): wraps onCompleteSession in try/catch;
       surfaces saveError and keeps modal open on failure with retry available.
   - Caller error rethrow:
     - Updated onFinishFocus in Today.tsx and handleCompleteFocusSession in
       ExecutionDashboard.tsx to throw write errors back to the modal, enabling
       the retry UI.
   - Tests:
     - FocusSessionModal.test.tsx: 11 Vitest unit tests covering countdown loop,
       pause/resume, reset, step navigation, celebration transition, reflection submit,
       write error retry, mute toggle, Escape close, and fallback.
     - e2e/focus.spec.ts: 14 Playwright E2E tests covering timer controls, step runner,
       completion write with reflection, 500 error retry, spacebar typing safety,
       zero axe violations on active stage and celebration screen, and responsive
       verification at 1440, 390, and 360 px viewports.

3. Files changed / created / removed
   Created:
   - frontend/src/lib/stepChallenge.ts
   - frontend/src/components/focus/FocusHeader.tsx
   - frontend/src/components/focus/FocusTimer.tsx
   - frontend/src/components/focus/FocusStepRunner.tsx
   - frontend/src/components/focus/FocusCompletion.tsx
   - frontend/src/components/FocusSessionModal.test.tsx
   - frontend/e2e/focus.spec.ts
   Changed:
   - frontend/src/components/FocusSessionModal.tsx
   - frontend/src/components/StepChallengeWidget.tsx
   - frontend/src/components/today/Today.tsx (rethrow on write failure)
   - frontend/src/components/ExecutionDashboard.tsx (rethrow on write failure)
   - Design.md (§11 Focus Mode & Deliberate Practice Runner)
   - docs/phases.md (M5.5 report, milestone table, Section 6, change log)
   Removed: nothing.
   Backend was not changed. Zero backend changes permitted.

4. Functionality preserved
   R-8: Daily task retrieval and start focus session on Today (/) and ExecutionDashboard
   (/dashboard) identical.
   R-9: Completing session marks task completed, updates GoalContext, and persists.
   R-10: Reflection note appends as "• Focus win: ..." when existing notes exist, or
   becomes the note when empty.
   R-11: Focus session countdown timer, step navigation, audio effects, and mute toggle
   behave identically to the baseline.
   R-12: Full day view and review entry points remain intact.
   R-15, R-17: Shell, account reset, and offline status indicators unaffected.
   /dashboard was NOT redirected.

5. Decisions applied
   BP §32: Focus Mode Level 1 calm execution surface using Phase 0 semantic tokens.
   BP §43: StepChallengeWidget remains session-only with zero backend persistence.
   R5, R6: Multi-line reflection capture with explicit save and inline error surfacing.
   D-7: Geist and Geist Mono typography (font-ui and font-ui-mono tabular).

6. Validation evidence
   Frontend tsc --noEmit: clean (0 errors).
   ESLint on changed/created files: clean (0 errors, 0 warnings).
   Frontend Vitest: 235 passed / 29 files (was 224 / 28).
   Build: main JS 576.80 KB (170.86 KB gzipped), CSS 99.59 KB (17.49 KB gzipped).
   Playwright e2e/focus.spec.ts: 14 passed across desktop and mobile (22.5s).
   Playwright e2e/today.spec.ts: 30 passed across desktop and mobile (39.2s).
   Axe-core scan: 0 violations on active timer view and celebration view across
   1440px and 390px viewports.
   Responsive check: 0 horizontal overflow and touch targets ≥ 44px verified at
   1440px, 390px, and 360px widths.

7. Carry-overs
   M5.6: completion lighting and notes redesign.
   M5.7: remaining OD-9 states (rest day, test day, review due, goal-load error,
   offline write failure).
   M5.8: /dashboard redirect to /.

8. Issues and risks
   None. High-contrast tokens (text-text-secondary for micro labels and pills)
   safeguard WCAG 2.2 AA compliance against the dark background.

9. Not started
   M5.6 has NOT started.
   /dashboard was not redirected.
   Nothing was committed.
```

### M5.6 report — Completion interaction, step lighting, next step preview & notes redesign (2026-09-25)

```text
1. Outcome
   Completion interaction and notes redesign (BP §31, VDS §20, OD-9 "Done for today")
   are delivered on Today (/):
   - Completed Step Lighting: when task.status === 'completed', the active step card
     enters an illuminated state with subtle botanical accent highlight (border-accent/40
     bg-surface/95 ring-1 ring-accent/20 shadow-sm), StepMarker completed, Done badge,
     and a calm, non-punitive confirmation ("Step completed. Deliberate practice logged
     for today."). Strictly zero gamified XP explosions, confetti, or streak popups.
   - Next Step Preview: when today's step is complete, an upcoming practice task preview
     card shows the next chronological practice day (e.g. "Tomorrow · Thursday"), title,
     duration, whyToday snippet, and an action to inspect that day's step. If completing
     the last practice day of the week, renders a bridge ("Week N practice complete.
     Weekly review ready in the full day view.") linking to /dashboard.
   - Reversibility: completion remains instant and reversible via "Mark not done", cleanly
     restoring the active state and removing the preview while preserving all notes.
   - Notes Redesign: parses stored task notes into structured Focus Wins (rendered as
     distinct highlight cards with botanical sparkles) and free-form practice notes in
     the textarea. Recombines and serializes both on save, ensuring focus wins are never
     wiped when editing freeform notes. Preserves uncommitted drafts across WeekGlance
     day switches and includes typed drafts in completion writes.

2. What changed
   - Helpers (frontend/src/lib/today.ts & today.test.ts):
     - Added parseTaskNotes to cleanly separate "• Focus win: ..." lines from free-form text.
     - Added serializeTaskNotes to recombine free-form text and focus reflections.
     - Added findNextTask to retrieve the next chronological non-rest practice day in the week.
     - Added comprehensive unit tests in today.test.ts (16 tests total).
   - Today Component (frontend/src/components/today/Today.tsx):
     - Illuminated step card styling when done (border-accent/40 bg-surface/95 ring-1 ring-accent/20).
     - StepMarker state="completed" and quiet confirmation line beside eyebrow.
     - Next step preview card with upcoming day label, title, duration, snippet, and view button.
     - Week completion bridge when the final practice day of the week is completed.
     - Redesigned notes section displaying structured focus wins logged, textarea with
       auto-save on blur, explicit save button with loading state, and draft persistence.
     - onToggle and onSaveNote preserve serialized focus wins and user notes seamlessly.
   - Tests:
     - Today.test.tsx: expanded to 14 tests covering step lighting, quiet confirmation,
       next step preview navigation, week completion bridge, focus wins display, and notes saving.
     - today.spec.ts: expanded to 32 tests covering completion interaction, step lighting,
       next step preview, focus wins display, notes persistence, and zero axe violations.
     - focus.spec.ts: 14 tests re-verified for regression safety.
   - Design System Documentation (Design.md):
     - Added Section 12 documenting step lighting, quiet confirmation, next step preview,
       and notes serialization conventions.

3. Files changed / created / removed
   Changed:
   - frontend/src/lib/today.ts
   - frontend/src/lib/today.test.ts
   - frontend/src/components/today/Today.tsx
   - frontend/src/components/today/Today.test.tsx
   - frontend/e2e/today.spec.ts
   - Design.md (§12 Step Lighting, Next Step Preview & Notes)
   - docs/phases.md (M5.6 report, milestone table, Section 6, change log)
   Created / Removed: none.
   Backend was not changed. Zero backend changes permitted.

4. Functionality preserved
   R-8: Today loads active day's task and duration.
   R-9: Completing task marks completed and updates GoalContext; fully reversible.
   R-10: Notes and focus wins are never wiped across / and /dashboard; draft notes
   persist across day switching and completions.
   R-11: Focus session completes and lands on the new illuminated completion state.
   R-12: Full day view and review entry points remain intact.
   R-15, R-17: Shell, account reset, and offline status indicators unaffected.
   /dashboard was NOT redirected.

5. Decisions applied
   BP §18: Calm, non-punitive tone; no gamification explosions, XP or confetti.
   BP §31: All session fields reachable on demand.
   VDS §20: Calm botanical step illumination (border-accent/40 ring-1 ring-accent/20).
   OD-9: "Done for today" state with quiet confirmation and next step preview.
   R-10: Structured focus wins presentation and reliable notes serialization.

6. Validation evidence
   Frontend tsc --noEmit: clean (0 errors).
   ESLint on changed files: clean (0 errors, 0 warnings).
   Frontend Vitest: 245 passed / 29 files (was 235 / 29).
   Build: main JS 579.85 KB (171.59 KB gzipped), CSS 100.24 kB (17.57 KB gzipped).
   Playwright e2e/today.spec.ts: 32 passed across desktop and mobile (45.8s).
   Playwright e2e/focus.spec.ts: 14 passed across desktop and mobile (25.7s).
   Axe-core scan: 0 violations on pending and completed Today screens across 1440px and 390px.
   Responsive check: 0 horizontal overflow and touch targets ≥ 44px at 1440px, 390px, and 360px widths.

7. Carry-overs
   M5.7: remaining OD-9 states (rest day, test day, review due, goal-load error,
   offline write failure).
   M5.8: /dashboard redirect to /.

8. Issues and risks
   None. Notes serialization guarantees that user notes and automated focus reflections
   co-exist cleanly without risk of accidental data overwrite.

9. Not started
   M5.7 has NOT started.
   /dashboard was not redirected.
   Nothing was committed.
```

---

## PHASE 6 — JOURNEY

**Status:** `NOT STARTED`

**Source:** BP §08, §10–11, §17, §47, OD-2, OD-7 · VDS §7–9, §20, §25–26, §28, note 7

**Objective:** a visual 90-day roadmap that shows where the user is going and how far they have come, using the staircase as a conceptual language rather than a template.

**Narrative line:** *"Here's the path."*

### Current state

* **Views:** `RoadmapPage.tsx` (290 lines, `/roadmap`) and `PlanV2Panel.tsx` (145 lines).
* **v2 goals (`planVersion = 2`):**
  * `Goal.roadmap = { finalGoal, finalTest, startingPoint, method, phases, weeks }`.
  * `phases` has 2–4 entries (`{ name, startWeek, endWeek, purpose }`), named by the chosen method.
  * `weeks` have `{ weekNumber, phase, focus, target, test }`.
  * **Tasks exist only for the current week**; later weeks are written one at a time after each review.
* **v1 goals:** three fixed phases (Foundation, Acceleration, Mastery); all 12 weeks are planned up front.
* **`RoadmapWeek` rows:** `phase`, `theme`, `objective`, `keyMilestone`, `status`, `executionScore`, `target`, `test`.
* **Length:** the plan is 12 weeks (84 days); the UI calculates a 90-day target date (OD-2).

### Decisions required before starting

* **OD-2: 90 vs 84 days.** What fills days 85–90: a final-test week, a closing stretch, or mapping day 84 to day 90 in the UI? The Journey view cannot be designed without it.
* **OD-7: phase counts.** The Journey must handle 2–4 method-named phases for v2 and 3 fixed phases for v1. Nothing may assume four fixed phases (the BP §10 sketch is conceptual).

### In scope

* **The staircase journey** (VDS §7–8, note 7):
  * step = a day's task (`DailyTask.status`);
  * landing = a phase boundary;
  * milestone = a phase or week milestone;
  * destination = `roadmap.finalGoal`;
  * a "you are here" marker.
* **Three layers of progress** (VDS §9): quick `27 / 90`, the emotional staircase, the strategic journey map.
* **Honest future:** future weeks show only what exists (focus, target, milestone). Never invented tasks for weeks not yet written.
* **Desktop:** expansive, with more environmental depth.
* **Mobile:** vertical progression (VDS §28).
* **Motion:** completed steps lit; the next step revealed (VDS §20), with a reduced-motion path.
* **Parity:** v1 and v2 goals both render correctly.

### Out of scope

* Changing phase or week generation.
* Editing the plan from the Journey view.
* The garden or achievement state (Phase 9).

### Backend allowance

None.

### Files likely affected

* `frontend/src/pages/RoadmapPage.tsx`
* `frontend/src/components/PlanV2Panel.tsx`
* new `frontend/src/components/journey/*`
* the navigation entry per ND-7

### Milestones

| ID | Milestone |
|---|---|
| M6.1 | OD-2 and OD-7 decided; the day/week/phase mapping written down |
| M6.2 | Journey data adapter: one shape for v1 and v2 goals |
| M6.3 | Desktop journey composition |
| M6.4 | Mobile vertical journey |
| M6.5 | Progress motion and reduced-motion path |
| M6.6 | Regression and phase report |

### Regression checks

R-8, R-14.

### Mobile acceptance

3.7 applies, plus:

* The journey scrolls vertically.
* "You are here" is visible on load, without searching.

### Validation

* v1 preset goal.
* v2 goals with 2, 3 and 4 phases (use development data if needed).
* Week 1, a middle week and week 12.
* Reduced motion.
* Screen-reader pass: the journey has a text equivalent (VDS §29).

### Exit criteria

* Correct for every phase count and both plan versions.
* No fabricated future content.
* Readable without the visuals.

### Risks

* Designing around a four-phase sketch (OD-7).
* Leaving the 84/90 mismatch visible (OD-2).

---

## PHASE 7 — WEEKLY REVIEW + ADAPTATION

**Status:** `NOT STARTED`

**Source:** BP §17–19, §33, §41, §43, OD-1 · VDS §26

**Objective:** the bridge between execution and adaptation. A short weekly moment after which next week visibly reflects what really happened.

**Narrative line:** between *"Here's your next step"* and *"Here's the path"*: the path bends to the week.

### Current state

* **Endpoint:** `POST /api/goal/weeks/:weekNumber/review` with a reflection.
* **Stored in `WeeklyReview`:** `tasksPlanned`, `tasksCompleted`, `scorePercentage`, `reflection`, `aiAdaptationInsight`.
* **What the endpoint does:**
  * marks the week completed with its `executionScore`;
  * writes the next week from the actual completions;
  * runs a phase-gate milestone check.
* **Failure:** if adaptation fails it returns 503 and leaves the week unchanged.
* **Weekly tests:** `RoadmapWeek.test` holds `{ type, instructions, passIf }` and `target` holds a metric or deliverable, but **no test result is ever stored** (OD-1).
* **Not implemented (must not appear, BP §43):** retargeting, missed-day carry-forward, and proof judging from `plan-v2-spec.md`.

### Decisions required before starting

* **OD-1, Phase 7 part: weekly test results.** Is a result-storage backend change approved?
  * If **yes**, the named allowance below applies and the review can compare the result with the target.
  * If **no**, the review shows completion and reflection only, with no target comparison.

### In scope

* **The review flow** (BP §33), limited to what is stored or computed:
  * *How did this week go?*
  * what you completed (from task statuses);
  * the reflection;
  * the test result compared with the target (only with the approved allowance);
  * what happens next (`aiAdaptationInsight` and next week's focus).
* **The adaptation moment:** show that next week was rebuilt, and why, from the real insight. No invented reasoning.
* **The phase-gate outcome** in encouraging language (BP §18): "Your current results suggest we should reinforce this phase."
* **Failure (503):** say plainly that the week was not changed; retry; the reflection is kept.
* **The "review due" entry point** from Today (the Phase 5 state).

### Out of scope

* Proof judging, photo/video tests, retargeting, carry-forward.
* Changing the adaptation logic.

### Backend allowance

**Named, only if OD-1 approves it:** store a weekly test result, for example a nullable `RoadmapWeek.testResult` JSON field plus an optional field on the review request. Include:

* a Prisma migration;
* validation;
* a Vitest test for the new field;
* no change to how adaptation behaves unless separately decided.

### Files likely affected

* The review UI inside `ExecutionDashboard.tsx` / Home (or its Phase 5 successor)
* new `frontend/src/components/review/*`
* With the allowance: `backend/prisma/schema.prisma` plus a migration, `backend/src/routes/goal.ts` (the review handler), backend tests, `frontend/src/types/index.ts`

### Milestones

| ID | Milestone |
|---|---|
| M7.1 | OD-1 (Phase 7 part) decided |
| M7.2 | Review flow UI |
| M7.3 | Adaptation moment and phase-gate language |
| M7.4 | Failure, retry and review-due states |
| M7.5 | (With the allowance) test-result storage, a backend test, and the UI comparison |
| M7.6 | Regression and phase report |

### Regression checks

R-9, R-12, R-13. R-8 (next week's tasks appear on Today).

### Mobile acceptance

3.7 applies, plus:

* The review can be finished one-handed in under two minutes.
* The reflection textarea stays above the keyboard.

### Validation

* Review a full week, a partial week and an empty week.
* Force a 503 (development only) and confirm the week is unchanged and the reflection is kept.
* Double-submit.
* Reload mid-review.
* The last week (week 12) review.

### Exit criteria

* Review and progression behave exactly as before.
* The user sees why next week changed.
* No unimplemented capability is implied.

### Risks

* Showing target comparison without stored results.
* Making the review feel like an assessment rather than a reflection.

---

## PHASE 8 — PROGRESS

**Status:** `NOT STARTED`

**Source:** BP §17, §27, §43 · VDS §9, §25–26, §31

**Objective:** meaningful progress (completion, milestones, results, adaptation) rather than superficial statistics.

**Narrative line:** *"How far have I come?"* (the orientation half of BP §08).

### Current state

* **Available data:**
  * `DailyTask.status` and `completedAt`;
  * `RoadmapWeek.status` and `executionScore`;
  * `WeeklyReview` rows (planned, completed, score, reflection, insight);
  * phase boundaries;
  * test results only if Phase 7's allowance shipped.
* **No page:** there is no dedicated Progress page today.

### Decisions required before starting

* **ND-8:** is Progress a separate page (BP §27 lists it) or a layer of the Journey view? This decides the navigation.

### In scope

* **Completion:** work actually done, by week and by phase.
* **Milestones:** the phase gates reached.
* **Results:** stored test results against targets, only if they exist.
* **Adaptation history:** the insight from each week.
* **The analytical level** (VDS §26): restrained, typographic, big numbers as visual objects (VDS §4). No charts unless one explains something the numbers can't (VDS §31).
* **Empty and early states:** week 1 with nothing done yet; a goal with no reviews.

### Out of scope

* Analytics, streak gamification, comparisons with other users, exports (BP §43; VDS §31).

### Backend allowance

None beyond what Phase 7 shipped.

### Files likely affected

* new `frontend/src/pages/ProgressPage.tsx` or a Journey layer (per ND-8)
* `frontend/src/components/progress/*`
* navigation

### Milestones

| ID | Milestone |
|---|---|
| M8.1 | ND-8 decided |
| M8.2 | Completion and milestones |
| M8.3 | Results and adaptation history (data permitting) |
| M8.4 | Empty and early states |
| M8.5 | Regression and phase report |

### Regression checks

R-8, R-14.

### Mobile acceptance

3.7 applies, plus: large numbers stay legible at 360px, with tabular figures and no layout shift.

### Validation

* A goal at week 1, week 6 and week 12.
* A goal with no reviews.
* Numbers checked against the database for one real goal.

### Exit criteria

* Every figure is traceable to stored data.
* Nothing looks like analytics that don't exist.

### Risks

* Drifting into a card-heavy dashboard (VDS §31).

---

## PHASE 9 — ACHIEVEMENT

**Status:** `NOT STARTED`

**Source:** BP §07, §11, §34, §43, §47, OD-1, OD-2 · VDS §17–18, §26–27, note 7

**Objective:** the completion and celebration experience, the arrival at the garden. After it, the user can start their next goal.

**Narrative line:** *"You made it."*

### Current state

* **Goal status:** `Goal.status` is `active` or `archived`. **Nothing ever sets `completed`** (OD-1).
* **After the final week:** behaviour after week 12 is undefined in the UI (an OD-9 state).
* **Starting another goal:** creating a new goal archives the previous active one; `DELETE /api/goal/active` exists for reset.
* **One goal at a time:** multiple active goals are not supported (BP §43).

### Decisions required before starting

* **OD-1, Phase 9 part: goal completion.** Approve a named backend transition. What completes a goal: the final review, the final test, or day 90 reached (tied to OD-2)?
* **OD-2:** must already be decided in Phase 6. The achievement date depends on it.

### In scope

* **The achievement screen** (BP §34, VDS §18):
  * 90 DAYS COMPLETE;
  * the goal;
  * results (real, from Phase 7 and 8 data);
  * what you accomplished;
  * "Your results";
  * "Begin another journey".
* **The environment change** (VDS §17, §27): the darkness opens, the architecture warms, the garden appears. Achievement gold (`#C8A96B`) is used here, sparingly. Reduced-motion path required.
* **"Begin another journey"** reuses the existing archive-and-create flow into onboarding.
* **After week 12, before completion:** a designed "final stretch" state (from OD-2).

### Out of scope

* A history of past goals, sharing and certificates, unless separately decided.
* Multiple active goals.

### Backend allowance

**Named, only if OD-1 approves it:** a goal completion transition that sets `Goal.status = 'completed'`, for example inside the final week's review or a dedicated endpoint. Include:

* a migration only if a completion timestamp field is added;
* `GET /api/goal/active` behaviour for completed goals specified and tested;
* Vitest coverage.

### Files likely affected

* new `frontend/src/components/achievement/*`
* the Today and Journey terminal states
* `frontend/public/images/brand/garden.jpg` usage
* With the allowance: `backend/src/routes/goal.ts`, `backend/prisma/schema.prisma` (optional), backend tests, `frontend/src/context/GoalContext.tsx` (reading the new status only)

### Milestones

| ID | Milestone |
|---|---|
| M9.1 | OD-1 (Phase 9 part) decided; completion rule written down |
| M9.2 | Backend completion transition with tests |
| M9.3 | Achievement screen and garden transition |
| M9.4 | Final-stretch state; "Begin another journey" flow |
| M9.5 | Regression and phase report |

### Regression checks

R-7, R-8, R-12, R-13, R-15.

### Mobile acceptance

3.7 applies, plus: the garden image is served at a suitable resolution and cropped for portrait. The brand images are portrait already (VDS note 8).

### Validation

* Drive a development goal to completion.
* Reload on the achievement screen.
* Start another journey; confirm the old goal is `completed` (not deleted) and the new one is `active`.
* Reduced motion.

### Exit criteria

* The server knows a goal is complete.
* The celebration is real, calm and not confetti (VDS §18).
* The next goal can be started.

### Risks

* A frontend-only "completed" state (forbidden by 3.2).
* Completion racing with the final review.

---

## PHASE 10 — PREMIUM ARCHITECTURE

**Status:** `NOT STARTED`

**Source:** BP §03, §20–23, §27, §43, OD-1 · VDS §12, §14, §25

**Objective:** give Achivii Coach and Custom Journeys their place in the product, attractive and understandable, without faking availability or payment.

**Narrative line:** *"More ways to climb"* (introduced honestly on the marketing site in Phase 1).

### Current state

* **Chat:** there is no chat functionality.
* **Custom goals:** created free through `POST /api/goal/create`, with no entitlement check. A frontend-only lock would be bypassable (OD-1) and would also remove a feature free users currently have.
* **Accounts:** `User` has no plan or entitlement field.
* **Payments:** there is no payment system.
* **Marketing:** Coach is "In development"; Custom Journeys is "Planned for Premium".

### Decisions required before starting

* **ND-9: payments.** Are payments in scope for this redesign at all? If yes, which provider, and which billing model? If no, this phase ships only honest, non-purchasable placements.
* **ND-10: custom-goal gating.** When and how does the free custom-goal path become paid (BP §22)? What happens to existing users and goals created for free? It requires the server-side entitlement below.
* **ND-11: Coach scope.** Is this phase architecture-only (navigation placement, a "coming" state, a waitlist only if it's real), or does it build a real chat? A real chat is a new backend capability and needs its own named allowance and plan.
* **OD-1, Phase 10 part:** the entitlement allowance below.

### In scope (architecture-only baseline; extended only by ND-9 to ND-11)

* **Coach ✦ in the application navigation** (VDS §14) with an honest "coming" state. No fake conversation UI.
* **Custom Journeys in the pathway library:** "Have something unique in mind?" (BP §22), styled as premium but not an aggressive upsell. If it's locked:
  * the lock is enforced by the server;
  * the copy states the real availability;
  * no "Unlock" button leads to a fake checkout.
* **Premium visual treatment:** subtle botanical green or warm gold, depending on context (VDS §12).

### Out of scope (unless ND-9 to ND-11 approve them)

* Checkout, billing, invoices.
* AI chat.
* Notifications.

### Backend allowance

**Named, only if ND-10 approves it:**

* an entitlement field on `User` (or a separate table);
* a server-side check in `POST /api/goal/create` for non-preset goals;
* a migration;
* Vitest coverage for allowed and denied cases.

Payment-provider integration is a **separate** named allowance, only if ND-9 approves it.

### Files likely affected

* Navigation (the Phase 5 shell)
* the pathway library (Phase 3)
* `frontend/src/components/marketing/sections/Premium.tsx` (only if availability changes)
* With the allowances: `backend/prisma/schema.prisma`, `backend/src/routes/goal.ts`, `backend/src/routes/auth.ts` (exposing the entitlement on `/me`), backend tests, `frontend/src/context/AuthContext.tsx` (reading only)

### Milestones

| ID | Milestone |
|---|---|
| M10.1 | ND-9, ND-10 and ND-11 decided |
| M10.2 | Coach placement and honest state |
| M10.3 | Custom Journeys placement in the pathway library |
| M10.4 | (With the allowance) server-side entitlement and gate, with tests |
| M10.5 | (With the allowance) payments integration, per its own plan |
| M10.6 | Marketing copy updated to match reality |
| M10.7 | Regression and phase report |

### Regression checks

R-2, R-3, R-4. Existing custom goals keep working (grandfathering per ND-10).

### Mobile acceptance

3.7 applies.

### Validation

* A free user, and (if built) an entitled user.
* A direct API call to `/create` with a custom goal while not entitled is refused by the server.
* Marketing and in-app copy agree.

### Exit criteria

* Nothing implies a feature or purchase that doesn't work.
* Any lock is enforced by the server.

### Risks

* Accidentally removing free custom goals before gating is decided.
* Copy that over-promises Coach.

---

## PHASE 11 — MOBILE

**Status:** `NOT STARTED`

**Source:** BP §44–46, OD-5 · VDS §28–29, note 10

**Objective:** a final cross-product mobile sweep. Mobile has been considered in every phase; this phase verifies the whole journey end to end on small screens.

**Narrative line:** the whole story, in one hand.

### In scope

* **Journey walks** at 390, 375 and 360px, on iOS Safari and Android Chrome (real devices where possible):
  * landing → sign-up → onboarding → generation → Today → focus → complete → review → Journey → Progress → Achievement.
* **Safe areas, keyboard overlap, sheets and scroll containment.** Nothing scrolls behind an open sheet.
* **Touch targets and gestures:** at least 44px targets; no hover-only affordances.
* **Performance on a mid-range device:**
  * no `backdrop-blur` over large imagery;
  * image sizes appropriate for mobile;
  * animation cost checked with reduced motion both off and on.
* **Orientation:** portrait-first; landscape doesn't break focus mode.
* **Open questions:** decide PWA or installability (a new decision if raised) — not assumed.

### Backend allowance

None.

### Milestones

| ID | Milestone |
|---|---|
| M11.1 | Device and browser matrix agreed |
| M11.2 | End-to-end walk; issues logged |
| M11.3 | Fixes |
| M11.4 | Re-walk and phase report |

### Exit criteria

Every issue from the walk is fixed or explicitly deferred with a reason.

---

## PHASE 12 — GLOBAL POLISH

**Status:** `NOT STARTED`

**Source:** BP §38–39, §41, §49 (Phase 12) · VDS §29, §31–32, notes 1, 4, 8, 10, 11

**Objective:** consistency, accessibility, performance, complete states and full regression. Leave nothing half-migrated.

### In scope

* **Legacy removal:**
  * legacy mint tokens;
  * the `--radius-xl/2xl/3xl` override;
  * the Plus Jakarta Sans and JetBrains Mono fonts;
  * the old `Navbar` and footer, if still present;
  * duplicated pathway galleries and modal implementations.
  Each removal is made only after confirming nothing uses it.
* **Dead code:** components confirmed unreachable (for example, verify the reachability of `SaaSBuilderModal.tsx` and `PathwaysExplorerModal.tsx` before deciding).
* **Hard-coded colours:** outside the token files, reduced to effectively zero (baseline about 1,010, BP §38).
* **Imagery** (VDS notes 8 and 10):
  * responsive AVIF/WebP with explicit dimensions;
  * higher-resolution brand images (an asset request);
  * per-pathway photos (`frontend/public/images/goals/*`, `images/blueprints/*`) replaced or given a monochrome treatment ("product imagery = monochrome + restrained", VDS §16).
* **Fonts:** decide whether to self-host.
* **Accessibility audit:** automated (axe or equivalent) plus manual keyboard and screen-reader passes across all screens.
* **Performance:** bundle size, route-level code splitting where justified, and LCP/CLS on the landing page and Today.
* **Copy consistency:** 90-day language, encouraging voice, no stale feature claims.
* **Full regression:** R-1 to R-18.
* **Documentation:** `Design.md` final pass.

### Backend allowance

None.

### Milestones

| ID | Milestone |
|---|---|
| M12.1 | Legacy inventory (what's still used, where) |
| M12.2 | Legacy removal, verified screen by screen |
| M12.3 | Imagery pipeline and asset replacement |
| M12.4 | Accessibility audit and fixes |
| M12.5 | Performance pass |
| M12.6 | Full regression and final report |

### Exit criteria

* One design system in use everywhere.
* R-1 to R-18 verified.
* Accessibility and performance findings fixed or explicitly deferred.

---

# 5 — DECISION REGISTER

This register is here so every phase can see what blocks it. The decisions themselves, with options, the choice and the reasoning, belong in `docs/decisions.md`.

## Open decisions from the blueprint

| ID | Decision | Status | Needed by |
|---|---|---|---|
| OD-1 | Backend scope per phase. Proposed rule: only named, approved allowances (adopted as rule 3.2; D-11 in `decisions.md`). The allowances are split into OD-1a weekly test results, OD-1b goal completion and OD-1c custom-journey entitlement. | Rule adopted; the allowances are open | 7, 9, 10 |
| OD-2 | 90 vs 84 days: what fills days 85–90 | Open | 6 (also 5 copy, 9) |
| OD-3 | Which dashboard becomes Today | **Decided (A):** Today at `/`; `/dashboard` redirects in M5.8, query and hash kept | 5 |
| OD-4 | Phase 2 route changes (`/login`, `/signup`) | **Decided (A):** routes only, modal retired | 2 |
| OD-5 | Mobile in every phase | Adopted (3.7) | All |
| OD-6 | Rewrite `Design.md` | Done in Phase 0 (M0.10) | 0 |
| OD-7 | The Journey handles 2–4 method-named phases | Constraint adopted; design open | 6 |
| OD-8 | Honest generation stages | **Decided (A amended):** four stages on real events; v1 fallback (no `method`) must not leave a method stage pending or invent a method name; stream labels unused | 4 |
| OD-9 | Every Today state defined | **Decided (A amended):** the Phase 5 state matrix. Test results wait on OD-1a, completion on OD-1b, days 85–90 on OD-2 | 5 |
| OD-10 | Dark/light meaning | **Resolved** (VDS §27: dark only; light surfaces are compositional) | — |
| OD-11 | Onboarding categories vs free presets | **Decided (A):** the six landing categories from one shared source; a one-pathway category shows that pathway directly | 3 |
| OD-12 | Semantic token names | Done in Phase 0 (role tokens, ND-1) | 0 |

## New decisions raised by this roadmap

| ID | Decision | Needed by |
|---|---|---|
| ND-1 | Token migration strategy — **Decided (A):** role names canonical, unused legacy tokens deleted, marketing renamed | 0 |
| ND-2 | Primitive strategy — **Decided (B):** Radix headless for the stateful parts, hand-built for the rest | 0 |
| ND-3 | Frontend tooling — **Decided (A, gradual):** ESLint + Vitest in Phase 0, Playwright in Phase 2, payload test in Phase 3 | 0, 2, 3 |
| ND-4 | How a chosen pathway survives navigation to auth routes; modal retained or retired; post-auth redirect rules — **Decided (A):** `/signup?pathway=<slug>`, cleared once used; no goal → onboarding, active goal → Today, internal `?next=` only | 2 |
| ND-5 | Pathway display copy — **Decided (A):** plain-language display fields in `certifiedPresets.ts`; titles and matching keys unchanged | 3 |
| ND-6 | The free custom-goal entry before Phase 10 — **Decided (A):** free and visible, secondary to pathways, no lock or badge | 3 |
| ND-7 | Application shell — **Decided (A, narrowed):** left rail and mobile bottom bar; Today, Roadmap, Pathways, Account. No Journey, Progress or Coach until those phases. No signed-in footer | 5 |
| ND-8 | Progress as its own page or as a Journey layer | 8 |
| ND-9 | Payments: in scope or not; provider; billing model | 10 |
| ND-10 | Custom-goal gating: timing, server-side entitlement, grandfathering existing goals | 10 |
| ND-11 | Coach scope: architecture-only or a real chat build | 10 |
| ND-12 | Phase 2 frontend scope additions — **Decided (A):** `api.ts` attaches HTTP status to errors; `GoalContext` exposes `goalLoadFailed` | 2 |
| ND-13 | Onboarding step order — **Decided (A):** spec order for presets; custom goals do Schedule while clarify runs, then the questions | 3 |
| ND-14 | Question grouping — **Decided (A):** "success" = editable clarified outcome plus the `success` question; everything else is "starting point" | 3 |
| ND-15 | Pathway library scope — **Decided (A):** one `PathwayLibrary` for all five in-app galleries; the modal becomes a Dialog around it | 3 |
| ND-16 | Pre-existing onboarding bugs — **Decided (A):** fix the blank step after reload and the switch-goal reload in M3.3; clear the draft key after create | 3 |
| ND-17 | TED-style speech pathway matching — **Decided (A):** matching only, so the frontend title "Deliver a 15-Minute TED-Style Speech" hits `ted_speech_15min`; titles, ids and slugs stay (ND-5); implement with the generation work | 4 |
| ND-18 | What Today shows as "your goal" — **Decided (A):** the heading is `rawGoal`; `clarifiedOutcome` is shown beneath it, as stored. The frontend does not rewrite it | 5 |

---

# 6 — KNOWN ISSUES AND CARRY-OVERS

| Issue | Source | Owner |
|---|---|---|
| ~~AuthModal uses the old style; its close button overlaps the tabs~~ | Phase 1 validation | Done in Phase 2 (modal retired) |
| ~~Pathway descriptions are jargon-heavy (onboarding uses the plain `summary` since M3.5; the landing page and in-app galleries don't yet)~~ | Phase 1 review | Done in M3.6 (every gallery and the landing page show `summary`) |
| ~~Returning user with a goal choosing a pathway, then signing in, is unverified live~~ | Phase 1 validation | Done in Phase 2 (verified live) |
| Legacy fonts, base body styles, mint focus rule and the radius override remain for unmigrated screens (role tokens are canonical since Phase 0) | Phase 0 | Phase 12 |
| `RoadmapPage.tsx` calls hooks after an early return (`rules-of-hooks`) | Phase 0 lint | Phase 6 |
| Lint baseline: 30 errors, 4 warnings in 11 files (was 48 and 6 in 14; see 3.11). `OnboardingWizard` is clean | Phase 0 lint | Each file's migrating phase |
| Four font families loaded | Phase 1 | Phase 12 |
| ~~The stream step id `search` describes no search~~ | OD-8 | Accepted under OD-8 at the Phase 4 close (Mo, 2026-09-23); the id and labels stay |
| `StepChallengeWidget` progress isn't persisted | BP §43 | Phase 5 |
| Two dashboards (`/` and `/dashboard`) | OD-3 | Phase 5 |
| No completed-goal state on the server | OD-1 | Phase 9 |
| Weekly test results aren't stored | OD-1 | Phase 7 |
| Custom goals are free and ungated on the server | BP §22 | Phase 10 (ND-10) |
| Low-resolution brand images; per-pathway photos off-style | VDS note 8 | Phase 12 |
| ~~No Playwright smoke tests yet~~ (added in Phase 2); ~~no onboarding payload test yet~~ (added in M3.1) | ND-3 | Done in Phase 3 |
| Test accounts in the local development database. Phase 1: one. Phase 2: `phase2-w6-{a,b,c}-1790142962485@example.com`. Phase 3 live suite: every `LIVE_API=1` run adds two `phase3-live-*@example.com` (create is held open, so they have no goal; three M3.8 runs added six). M3.8 manual runs: `phase3-m38-preset-1790165635864@example.com` (Run a 10K archived, Master Deep Work active), `phase3-m38-custom-1790165778826@example.com` (one active goal), `phase3-m38-offline-1790165967256@example.com` (one active goal, after a failed then retried create), `phase3-m38-offline-1790165886259@example.com` (no goal; the aborted first stop). Phase 4 kickoff: `phase4-kickoff-custom-1790170753203@example.com` (no goal), `phase4-kickoff-ted-1790170753203@example.com` (v2 custom TED), `phase4-kickoff-preset-1790171135241@example.com` (v1 10K). M4.5 added none. Phase 5 kickoff: `phase5-kickoff-1790182044713@example.com` (v2 10K, one active goal; Wednesday completed and its note cleared; Thursday completed with a saved note). Do not delete that goal | Phase 1–5 validation | Housekeeping |
| Forced sign-out when the backend is unreachable: `getAuthUser` answers 401 when its database lookup throws, and `AuthContext` drops the token on any `/me` failure. M3.8 confirmed it is deterministic on a reload with the backend stopped (the three live-suite runs did not hit it). Seen twice during the Phase 3 kickoff, then put down to brief pooler outages | Phase 3 kickoff; M3.8 | Unassigned (backend and `AuthContext`) |
| React warns of a `<button>` nested in a `<button>` in `FullDayVisualizer` (dashboard task row) | Phase 3 kickoff | Phase 5 |
| ~~Onboarding quiz modal at 390 and 360 px: the footer's "Next Question" button runs past the right edge of the dialog (clipped by the fixed overlay; the page doesn't scroll). Present before M3.4~~ | M3.4 | Done in M3.5 (modal replaced by inline question screens; Playwright checks 360 and 390) |
| ~~`react-hooks/set-state-in-effect` in `useOnboardingState.ts`: one of three removed in M3.5 (`maxStepReached` is gone; reachability is derived from the answers). Two remain on purpose: the mount effect that starts clarify for a preset or draft, and the effect that leaves the schedule once a pending clarify returns. Moving either into an event changes when clarify starts or when the step changes, which R-4 and R-18 depend on~~ | M3.4 | Done in M3.7 (mount state initialised, the schedule transition moved into the clarify callback; hook timing tests first; no disables) |
| ~~The in-flight generation screen was replaced in M4.2 (OD-8 stages). Slow-during-silence and the error / unsafe visual pass were still open~~ | M3.7; M4.2 | Done in M4.3 |
| ~~A pathway chosen inside onboarding doesn't write the draft key, so a reload returns to the goal step; custom answers live only on the page~~ | M3.7 | Done (confirmed behaviour, ND-16) |
| `currentGoalId === null` still skips `findCreatedGoal` before every create and after a failure, so a Build then can create a second goal | M3.7; M4.4 | Phase 5 (goal-load error state) |
| Two creates already in flight before either save finishes. A second mount in the same page load is blocked. A reload, a second tab, or a killed tab can send again if GET does not yet see the new goal. No second lock | M4.4 | Accepted residual (Mo, 2026-09-23). A fix would need server-side create idempotency under a new backend allowance; not planned. |
| Phone lock and wake were not checked on a device. The page does not listen for visibility changes, and create has no AbortController | M4.3 | Phase 11 |
| `done` still opens the legacy `/dashboard` | M4.2 | Phase 5 (OD-3) |
| Soft-keyboard states can't be emulated in Playwright (the onboarding footer is sticky, not fixed) | M3.7 | Phase 11 (on-device check) |
| ~~Landing `marketing/sections/Pathways.tsx` still hard-codes its six groups; onboarding now reads `direction` and `summary` from `certifiedPresets.ts` (OD-11, ND-5)~~ | M3.5 | Done in M3.6 (reads `PATHWAY_GROUPS`) |
| ~~Onboarding has no skip link; the legacy navbar (and the offline indicator, R-17) sits above it. Navbar targets under 44 px ("Achivii" 87×28, account button 62×34)~~ | M3.5; M3.8 audit | Done in M5.2 (the shell renders the skip link on every signed-in screen and on onboarding; every shell control is at least 44 px; the offline chip sits in the onboarding top bar) |
| ~~The TED-style speech pathway wasn't matched by the backend~~ | M3.8; ND-17 | Done in M4.2 (matching pattern only). Existing goals were not rewritten |
| `/roadmap` overflows by 17 px at 390 and 47 px at 360 with an empty roadmap (`main` is 407 px when the stored title is long). Since M5.2 it scrolls sideways inside the shell's content column instead of widening the document | M3.8 audit; M5.2 | Phase 6 (`/roadmap`) |
| ~~`/roadmap` and `/dashboard` have no `main` landmark~~ | M3.8 audit | Done in M5.2 (`main#main` at each page wrapper; landmark only) |
| The onboarding UI Back button pushes a history entry (as at M3.1), so browser Back straight after it returns to the step just left | M3.8 | Phase 11 (touches R-18) |
| ~~The pathway strip still sits inside the legacy Today (`Home`)~~ | M3.6 | Done in M5.3 (Today has no strip; the shell's Pathways entry opens the same explorer) |
| The pathway strip still sits inside `ExecutionDashboard` | M3.6 | Phase 5 (M5.8) |
| Main JS chunk 568.24 KB (167.73 KB gzipped) at the end of Phase 4; 565.85 KB (166.99 KB gzipped) at the end of Phase 3. Above Vite's 500 KB warning since before Phase 0 | M3.5 build; M4.5 | Phase 12 (code splitting) |
| Failed goal fetch lands on a goal-less Today | Phase 2 | Phase 5 (goal-load error, M5.7) |
| ~~Legacy palette on the Today notice~~ | Phase 2 | Done in M5.3 (Today's pathway notice uses the tokens and says "from Pathways") |
| "Explore Goals" vs "Pathways" naming. The shell and Today say "Pathways"; `ExecutionDashboard` still says "Explore Goals (10)" | Phase 2 | Phase 5 (M5.8) |
| Offline status is a one-time health check; the signed-in redirect has no timeout | Phase 2 | Phase 12 |
| ~~No real-backend Playwright specs (`e2e/live/` is empty)~~ | Phase 2 | Done in Phase 3 (M3.1) |
| No inverse variants for `Button`, `Badge`, `StepMarker`, fields or choice controls; light surfaces hold text and `TextLink` only | Phase 0 review | First phase needing a control on a light surface |
| ~~Focus rings can be clipped by `overflow` on tab lists and dialog edges (the auth screens use neither, so Phase 2 didn't reach it). The first Dialog in the app (M3.5's commitment editor) keeps its controls inside the body's padding; tab lists are unreached~~ | Phase 0 review | Done in M3.6 (`TabsTrigger` uses `.focus-ring-inset`; the strip pads its scroll track; the explorer keeps its controls inside the body's padding) |
| ~~The navbar's goal links (Today, Roadmap, Goals and the account button) overflow by 7 px at 360 px when a goal is active; present before M3.6 (`Navbar.tsx` untouched)~~ | M3.6 | Done in M5.2 (`Navbar.tsx` removed; 0 px at 360, 375 and 390 on `/`, `/dashboard`, `/roadmap` and onboarding) |
| ~~The shell's hard-coded counts: "Pathways (10)" and "Explore 10 Pathways" (`Navbar`)~~ | M3.6 | Done in M5.2 (the shell entry is "Pathways", with no count) |
| Pathway counts still hard-coded: "Explore Goals (10)" (`ExecutionDashboard`; gone from Today in M5.3), "Ten journeys, ready to begin." (landing) | M3.6 | Phase 5 (M5.8); landing Phase 12 |
| `certifiedPresets.ts` keeps expert fields no screen shows (`outcome`, `desc`, `coach`, `p1`–`p3`, `sampleDay`). Phase 4 did not show them as the generated method. `SaaSBuilderModal.tsx` is unused | M3.6; M4.5 | Phase 12 |
| ~~M3.6 review items: search and the four-category filter left the Home gallery (direction navigation replaces them); a strip tile opens the explorer instead of switching at once~~ | M3.6 | Done (accepted at the M3.6 review) |
| ~~A `Dialog` opened from state (no `DialogTrigger`) didn't return focus on close~~ | M3.5 | Done in M3.5 (`DialogContent` returns focus to the element focused when it opened; unit test added) |
| ~~No automated accessibility check~~ | Phase 0 review | Done in Phase 2 (axe in Playwright) |
| `Design.md` gaps (dialog initial focus, `Spinner`, `ChoiceGroup` columns, milestone colour, logs/table/code rules without primitives) | Phase 0 review | Next `Design.md` pass |
| ~~`Design.md` navigation rule pre-empts ND-7~~ | Phase 0 review | Done in M5.2 (`Design.md` "Application shell") |
| The legacy entrance utilities (`animate-fadeIn`, `animate-fadeInUp`) filled `both`, so a finished entrance kept each page wrapper a stacking context (and, for `fadeInUp`, the containing block of its fixed children). Focus mode and the dashboard's full-screen dialogs sat under the shell | M5.2 | Done in M5.2 (`index.css` fills `backwards`; the end state is the element's own style, so nothing looks different) || Type-scale minimums below some VDS ranges; micro tracking baked in (not taken up in the Phase 2 review) | Phase 0 review | Next `Design.md` pass |
| `--duration-reveal` unused; glass has no mobile blur guard | Phase 0 review | Phase 12; first phase using glass |
| `StaircaseScene` literal hex and `hover:bg-white`; `marketing/Button` duplicates `ui/Button`; `vite` `dedupe` masks a broken install | Phase 0 review | Phase 12; housekeeping |
| `saveV2Goal` sets `clarifiedOutcome` to `roadmap.finalGoal` (`backend/src/routes/goal.ts`, the create data). The user's edited outcome is overwritten. The Phase 5 kickoff goal's title rendered as `49.98` because that was `finalGoal`. Today shows `rawGoal` as the heading and the stored outcome beneath it (ND-18); the frontend does not rewrite the stored value | Phase 5 kickoff; ND-18 | Unassigned (a fix needs a backend allowance; Phase 5 has none) |
| ~~Saving a note on `/` does not update `GoalContext`. A later completion from `/dashboard` can PATCH `notes: null` and clear it. Seen on the Phase 5 kickoff goal (Wednesday)~~ | Phase 5 kickoff | Done in M5.3 (Today writes through `useTaskActions`, which puts the server's task into `GoalContext`; `today.spec.ts` saves a note on Today, completes on `/dashboard` and checks the note is in the PATCH). M5.6 designs notes |
| `/dashboard`'s own note save still does not update `GoalContext`. A completion on Today in the same session, after a note saved on `/dashboard`, sends the older note | M5.3 | Phase 5 (M5.6 notes; M5.8 removes the dashboard's own writes) |
| `DailyTask.date` is a UTC calendar date (`routes/goal.ts:215`, `:691`; `lib/ai/weekPlan.ts:52`), but `dayOfWeek` comes from the server's local clock (`weekPlan.ts:53`, `goalDecomposer.ts:984`), and `user.timezone` (saved at signup) is read by no date writer. Near UTC midnight a user far from UTC sees the neighbouring day's task as today, and a plan created then can label a date with the wrong weekday. Today compares UTC dates, the calendar the dates are written in | M5.3 | Unassigned (a fix writes dates in the user's timezone; needs a backend allowance) |
| ~~A focus reflection can be missing from the completion write: Enter starts "Save & Return" before the typed text is in the request. The Phase 5 kickoff reflection was not stored~~ | Phase 5 kickoff | Done in M5.5 (`FocusCompletion.tsx`, multi-line `Textarea` with explicit or Ctrl+Enter save, preserved text on failure) |
| Stopping the backend on an open page does not show the Offline chip, and a failed task write only reaches `console.error`. The button re-enables and the screen still looks saved | Phase 5 kickoff | Phase 5 (M5.7) |
| ~~PlanV2Panel renders `Pass if {passIf}.`, so a `passIf` that already ends with a period shows two~~ | Phase 5 kickoff | Done in M5.4 (`formatPassIf` helper in `formatters.ts` tests terminal punctuation before adding a period; unit tests added) |
| ~~Mobile `onboardingStates` "reload during generation" asserted `calls.create` while "Building your path" was already visible, which is before `POST /api/goal/create` (GET runs first). A phone click on "45 min" could also land under the sticky step footer~~ | M5.1 B1 | Done in M5.1 (the spec waits for the create request; the option is scrolled to the centre before the click). Not a production change |
| ~~After a `slow: true` event the still-working seconds froze at `Math.round(elapsedMs / 1000)` until the next event~~ | M5.1 B2 | Done in M5.1 (`generationStages.ts`, `StepGeneration.tsx`). The line keeps counting from that event's seconds. One line |

---

# 7 — PHASE REPORT TEMPLATE

Every phase ends with this report (the format used for Phase 1), then stops for review.

```text
ACHIVII REDESIGN — PHASE X REPORT

1. Outcome
   One paragraph: what the user can now see or do.

2. What changed
   Per screen or component.

3. Files changed / created / removed

4. Functionality preserved
   Every R-n touched, with how it was verified.

5. Decisions applied
   The OD-n / ND-n entries used, and where they're logged in decisions.md.

6. Validation evidence
   Type-check, build, tests, browser checks at desktop and mobile widths,
   console, reduced motion, keyboard.

7. Carry-overs
   What remains, and which phase owns it.

8. Issues and risks found

9. Not started
   Confirmation that the next phase has not begun.
```

---

# 8 — CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-23 | First version. Phase 1 recorded as complete, Phase 0 as partial. Decision register and carry-overs established. |
| 2026-09-23 | OD-1 register row now points to its three parts (OD-1a/b/c) and to D-11, matching `docs/decisions.md`. |
| 2026-09-23 | Phase 0 gate cleared: ND-1, ND-2 and ND-3 Decided (M0.2). |
| 2026-09-23 | Phase 0 milestones M0.2–M0.11 delivered; status awaits Mo's review. OD-6 and OD-12 done. Lint and test commands added to 3.11, with the lint baseline. "What shipped", evidence and carry-overs drafted. |
| 2026-09-23 | Phase 0 review fixes applied (accessibility, light surface, states, evidence, copy). Evidence updated (41 tests, signed-in spot-check, browser keyboard checks). Unselected review items added as carry-overs. Phase 1's token-rename carry-over marked done. Status still awaits Mo's review. |
| 2026-09-23 | Phase 0 accepted by Mo: `COMPLETE`. |
| 2026-09-23 | Phase 0's review carry-overs added to section 6. OD-4 and ND-4 Decided (both A); Phase 2 `IN PROGRESS` pending its kickoff plan. |
| 2026-09-23 | Phase 2 kickoff plan approved; ND-12 Decided (A) and added to the register. |
| 2026-09-23 | Phase 2 accepted by Mo: `COMPLETE`. "Current state" replaced by "What shipped", verification evidence and carry-overs. Playwright added to 3.11. Section 6 updated (AuthModal, R-16 and automated accessibility done; new Phase 2 carry-overs; two Phase 0 items reassigned). Phase 3 "Current state" updated for the Phase 2 handoff and the two category systems. |
| 2026-09-23 | OD-11, ND-5 and ND-6 Decided (all A); Phase 3 M3.2 done and its gate cleared. |
| 2026-09-23 | Phase 3 kickoff approved: `IN PROGRESS`. "Current state" corrected (size, five steps, clarify shape, preset questions, schedule fields, five galleries, offline and failure). M3.1 done: baseline section with the recorded step and history behaviour; payload and live specs added to 3.11. Section 6: payload test and `e2e/live` done; forced sign-out and nested-button findings added. |
| 2026-09-23 | ND-13 to ND-16 Decided (all A) and added to the register. Phase 3 scope, files and milestones updated: custom step order, question grouping, the library for all five in-app galleries (`Home`, `ExecutionDashboard` and `Pathways.tsx` added to the files), and the recorded bug fixes in M3.3. |
| 2026-09-23 | Phase 3 M3.3 done: state hook and pure payload builder extracted, ND-16 fixes applied; the baseline table notes what changed. |
| 2026-09-23 | Phase 3 M3.4 done: wizard split into step components with no behaviour or visual change; payload identical to the M3.1 baseline. Section 6: modal footer clipping on narrow screens and the `useOnboardingState` lint errors added. |
| 2026-09-23 | Phase 3 M3.5 done: the new onboarding flow (ND-13 order, ND-14 grouping, OD-11/ND-5/ND-6 applied) on the Phase 0 primitives; payload identical to the M3.1 baseline, mocked and live. "Current state" notes the new steps. Section 6: modal clipping and the Dialog focus bug done; one onboarding lint error removed, two kept for M3.7; landing groups, skip link and bundle size added. Awaiting Mo's review. |
| 2026-09-23 | Phase 3 M3.6 done: one pathway catalogue (`direction` only; `category` and `tag` removed) and `components/pathways/` used by all five in-app galleries and the explorer Dialog; the landing page reads the same groups; launch state and payload unchanged. M3.6 report added under Phase 3; "Current state" notes the change. Section 6: jargon copy, landing groups and tab focus-ring clipping done; navbar overflow at 360 px, hard-coded counts, unused catalogue fields and the review items added. M3.7 and Phase 4 not started. Awaiting Mo's review. |
| 2026-09-23 | Phase 3 M3.7 done: onboarding state matrix and M3.7 report added under Phase 3; classified clarify/create failures, connection notice, stale-response and wait fixes, duplicate-safe create retry, 360 px question screens, commitment name validation; payload identical, mocked and live. "Current state" notes the new failure handling. Section 6: the onboarding lint errors done; generation look, in-onboarding draft, recovery edge and soft-keyboard checks added. M3.8 and Phase 4 not started. Awaiting Mo's review. |
| 2026-09-23 | Phase 3 M3.8 done: regression matrix, before-and-after table and the Phase 3 report added under Phase 3. R-2, R-3, R-4, R-15, R-16, R-17 and R-18 pass mocked and live; preset, custom and switch-goal plans created on the real backend; the real backend was stopped during clarify and before Build. Section 6: the in-onboarding draft and the M3.6 review items closed as confirmed; lint baseline, bundle size, test accounts and the forced sign-out updated. Unused colours removed from `schedule.ts`. `Design.md` notes the compact step header, the connection notice and dialog focus return. Status stays `IN PROGRESS` awaiting Mo's review. Phase 4 has not started. |
| 2026-09-23 | Phase 3 accepted by Mo: `COMPLETE` (section 1, the Phase 3 status line, current position). "What shipped", "Verification evidence" and "Carry-overs" kept as drafted at M3.8. Section 6: the TED-style speech matching, the `/roadmap` overflow and missing landmarks, the UI Back history push, the navbar target sizes and the legacy strips added, so every Phase 3 carry-over has a row and an owning phase; the catalogue-fields row now says Phase 4 decides whether generation shows catalogue content. Phase 4 "Current state" updated for Phase 3 (the screen in `StepGeneration.tsx`, the create request and stream from `useOnboardingState.ts`, the failure copy, the M3.7 duplicate-safe retry, the history lock) and "Files likely affected" names the real Phase 3 successors. Phase 4 kickoff under way; no Phase 4 implementation has started. |
| 2026-09-23 | Phase 4 M4.1 done. Kickoff plan accepted. OD-8 Decided (A amended) and ND-17 Decided (A) in the register. Phase 4 is `IN PROGRESS` (not blocked, not complete): current state rewritten from the kickoff (v1 skips `method`; slow has no heartbeat; archive only on successful save; `currentGoalId === null` hole; TED unmatched until ND-17 is implemented). In scope adds the v1 path, client 20s slow during silence, the active-goal check before every create, and SSE fixtures in M4.2. Stream labels unused. Backend allowance is matching-only for the TED speech title. Catalogue-as-method moves to Phase 12. Kickoff throwaway accounts added to section 6. M4.2 has not started. No generation UI. |
| 2026-09-23 | Phase 4 M4.2 done. OD-8 generation screen, timed SSE fixtures (v2, v1, error) and ND-17 matching (speech pattern only). `done` still opens `/dashboard`. M4.3 and M4.4 have not started. |
| 2026-09-23 | Phase 4 M4.3 done. The client shows the existing still-working line after 20 seconds of silence, on the active stage. Failures stay on that screen. Retry behaviour is unchanged. No backend change. M4.4 has not started. |
| 2026-09-23 | Phase 4 M4.4 done. GET /api/goal/active runs before every create, and a plan the server already saved is opened instead of being built again. No abort, and no second draft. M4.5 has not started. |
| 2026-09-23 | Phase 4 M4.5 done: regression matrix, "What shipped", verification evidence, carry-overs and the Phase 4 report. R-2, R-4, R-5, R-6, R-7, R-15, R-16 and R-18 pass mocked. Section 6: the `search` id accepted under OD-8; `currentGoalId === null`, the overlapping in-flight residual, phone lock, `done` → `/dashboard`, catalogue fields and the bundle size updated. Status stays `IN PROGRESS` awaiting Mo's review. Phase 4 is not marked complete. Phase 5 has not started. |
| 2026-09-23 | Phase 4 accepted by Mo: `COMPLETE` (section 1, the Phase 4 status line, current position). "What shipped", "Verification evidence" and "Carry-overs" kept as drafted at M4.5. Review outcomes recorded: the overlapping in-flight create is an accepted residual (server-side create idempotency would need a new backend allowance; not planned), the new generation screen is observed live at the Phase 5 kickoff as post-close evidence, and the `search` id is accepted under OD-8. Section 6 rows match. Phase 5 "Current state" names the `OnboardingPage` and `ProtectedRoute` handoff to `/dashboard`. `Design.md`: N in the still-working line is whole seconds since this attempt started. Phase 5 kickoff under way; no Phase 5 implementation has started. |
| 2026-09-23 | Phase 5 kickoff corrections to "Current state" (status stays `NOT STARTED`): line counts, UTC "today", which dashboard shows which fields, unreachable `DayRoutineTimeline` and `SaaSBuilderModal`, PATCH writers, the goal-load hole, weekly review only on `/dashboard`. The generation handoff to `/dashboard` is unchanged. Section 6 records the kickoff account. No Phase 5 implementation. |
| 2026-09-23 | Phase 5 M5.1. Status `IN PROGRESS`. OD-3, OD-9, ND-7 and ND-18 Decided (Mo). State matrix, amended milestone table and the M5.1 report are in the Phase 5 section. Section 6 records the outcome overwrite, the note wipe, the lost focus reflection, the silent offline write and the `passIf` period. The mobile generation-reload spec waits for the create request (10 passed under repeat, both projects). The still-working line keeps counting after a slow event (post-close follow-up, not a reopened Phase 4 milestone). Mocked Playwright: 143 passed, 5 skipped, 0 failed. M5.2 has not started. No Today UI, shell or redirect. |
| 2026-09-23 | Phase 5 M5.2 done: the ND-7 shell (`components/app`). A rail from 1024 px, a bottom bar below it, and the onboarding top bar. Entries are Today, Roadmap (with a goal), Pathways and Account (a disclosure on desktop, the Dialog below; the goal line is `rawGoal`; Reset with a Dialog confirm). The offline chip, the skip link and one `main#main` on every signed-in screen. `Navbar.tsx` and the footer removed. The legacy fades fill `backwards`, so full-screen overlays cover the shell. The content column contains a page that is too wide. Section 6: skip link, navbar targets, the 7 px overflow, the missing `main`, the shell's counts and the `Design.md` navigation gap closed; the fade row added; the naming, counts and `/roadmap` rows split and re-owned. `Design.md` §5 Application shell. Mocked Playwright: 199 passed, 9 skipped, 0 failed. M5.3 has not started. No Today UI; `/dashboard` not redirected. |
| 2026-09-24 | Phase 5 M5.3 done: Today at `/` for the practice day (`components/today`, `lib/today.ts`). Heading is `rawGoal` (ND-18); the stored outcome sits beneath, as stored. One write path puts the server's task into `GoalContext`, so the note wipe from `/` is closed. "Explore Goals (10)" and the strip left Today; the strip remains on `/dashboard`. Task dates stay UTC (`goal.ts:215`, `:691`; `weekPlan.ts:52`). `Design.md` §6 Today. M5.4 has not started. `/dashboard` was not redirected. |
| 2026-09-24 | Phase 5 M5.4 done: progressive reveal on Today (whyToday on screen, steps with timing/output/pitfall/passMark/resource, 10-minute version, implementation intention, task resource). Start remains in first viewport at 390×844. PlanV2Panel double period fixed and unit tested. Full day view copy updated. Design.md §6 updated. M5.5 not started. /dashboard not redirected. |
| 2026-09-25 | Phase 5 M5.5 done: Focus mode redesigned on Phase 0 tokens and primitives (`components/focus/`, `FocusSessionModal.tsx`, `StepChallengeWidget.tsx`, `lib/stepChallenge.ts`). Countdown timer, pause/resume, reset, spacebar toggle, audio effects and mute toggle preserved identically. Deliberate practice step runner with instructions, cues, timing, outputs, pass marks, and collapsible tips. Session-only step challenge widget. Reliable reflection capture into task notes; failed network/server writes surface inline error alert (`role="alert"`), preserve reflection text, and allow safe retry. 0 axe violations. `Design.md` §11. M5.6 not started. `/dashboard` was not redirected. |
| 2026-09-25 | Phase 5 M5.6 done: Completion interaction, step lighting, next step preview & notes redesign on Today (`components/today/Today.tsx`, `lib/today.ts`). Active step card illuminated with calm botanical highlight (`border-accent/40 bg-surface/95 ring-1 ring-accent/20 shadow-sm`), `StepMarker` completed, and quiet non-punitive confirmation. Next step preview card with upcoming practice day, title, duration, snippet, and inspection link; week completion bridge linking to review. Reversible via "Mark not done". Notes redesign parses and displays structured focus wins alongside free-form notes, auto-saves on blur, and preserves drafts across `WeekGlance` switches. 0 axe violations. `Design.md` §12. M5.7 not started. `/dashboard` was not redirected. |

