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

Last updated: 2026-09-23 · Current position: **Phases 0, 1 and 2 complete; Phase 3 in progress** (kickoff approved; M3.1 baseline, M3.3 state extraction, M3.4 step components, M3.5 new visual flow, M3.6 pathway library and M3.7 states and hardening done; awaiting Mo's review of M3.7 before M3.8).

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
| 3 | Onboarding | `IN PROGRESS` | 0, 2 | — (OD-11, ND-5, ND-6, ND-13–16 Decided) | None |
| 4 | Journey generation | `NOT STARTED` | 3 | OD-8 | Stream labels only, if approved |
| 5 | Today | `NOT STARTED` | 0, 4 | OD-3, OD-9, ND-7 | None |
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
| R-17 | Offline indicator | `GoalContext` `apiStatus`; marketing nav chip; app `Navbar` | Stop the backend; the offline state is shown and nothing crashes |
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

Phase 0 added ESLint and Vitest with Testing Library (ND-3). Phase 2 added Playwright with axe-core. Phase 3 (M3.1) added the onboarding payload test and the first real-backend specs. Browser verification remains required evidence for every screen.

**Lint baseline (2026-09-23):** 48 errors and 6 warnings in 14 files that predate Phase 0: `AuthModal`, `ExecutionDashboard`, `FocusSessionModal`, `OnboardingWizard`, `PlanV2Panel`, `SaaSBuilderModal`, `StepChallengeWidget`, `marketing/StaircaseScene`, `marketing/hooks`, `AuthContext`, `GoalContext`, `lib/api`, `Home`, `RoadmapPage`. By rule: `no-explicit-any` 15, `set-state-in-effect` 8, `preserve-manual-memoization` 7, `only-export-components` 7, `exhaustive-deps` 6, `rules-of-hooks` 4, `no-unused-vars` 2, `no-empty` 2, `purity` 2, `use-memo` 1. A phase that migrates one of these files leaves it lint-clean.

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

**Status:** `IN PROGRESS` (kickoff approved 2026-09-23; M3.1 to M3.7 done)

**Source:** BP §16, §24, §28–29, §41, §47, §49 (Phase 3), OD-11 · VDS §4–5, §22, §26, §28

**Objective:** turn goal creation into a premium, guided experience that keeps all of the current intelligence while feeling simple.

**Narrative line:** *"Tell us where."*

### Current state

* **Size:** `OnboardingWizard.tsx` was 3,038 lines (the largest file in the app); since M3.4 it is a 233-line coordinator over `components/onboarding/`. `OnboardingPage.tsx` wraps it.
* **Steps:** 1 Goal → 2 Schedule → 3 Questions → 4 Review → 5 Generation (Phase 4). A preset launch lands on Schedule, with a "Certified Blueprint" card and a "Change" action. `goToStep` refuses to leave step 5. **Since M3.5:** named steps in the ND-13 order (pathway: direction → starting point → success → schedule → review; custom: direction → schedule → starting point → success → review), then generation (unchanged). A preset launch lands on the starting point. The questions are inline, one per screen; the quiz modal is gone.
* **Answers collected (BP §29):** plan variant (Light / Steady / Intensive = `minimal` / `steady` / `accelerated`), daily minutes, wake and sleep times, busy hours and preferred slot (defaults `07:00`, `23:00`, `09:00 - 17:00`, `evening`), commitments, then the clarify questions. There is no days-per-week field.
* **Clarify endpoint:** `POST /api/goal/clarify` with `{ rawGoal }` returns `clarifiedOutcome`, `primaryDomain` and `followUpQuestions` (presets also return `evidenceTriad`). A custom goal gets four AI questions with fixed ids `current_level`, `success`, `equipment`, `obstacle` (about 17 s). A preset gets its own questions instantly from preset data, with its own ids and count (10K: `baseline5k`, `environment`, `injury_history`; no `success` question). The wizard re-runs clarify on every mount of a preset (six identical calls in one dev session with a reload).
* **Offline and failure:** the wizard does not read `apiStatus`. A clarify failure keeps the user on Schedule and shows the raw browser message ("Failed to fetch"). **Since M3.7:** failures are classified (`components/onboarding/requestErrors.ts`): Achivii unreachable, clarify failed, or create failed, each with plain copy and a retry; the app's health check and every request result drive an honest connection notice; a create retry after a lost connection first checks whether the plan was finished.
* **Presets:** 10 certified presets in `frontend/src/lib/certifiedPresets.ts`, with `findPathwayBySlug` (Phase 2). Each has a `category` field with four values (Tech & Career, Fitness & Health, Creative & Media, Mastery & Mind) used by the in-app galleries, while the landing page hard-codes six groups in `marketing/sections/Pathways.tsx`. OD-11 settles on the six. **Since M3.6:** `category` and `tag` are gone; `direction` is the only grouping, `PATHWAY_GROUPS` holds the non-empty directions, and the landing page reads them too.
* **Duplicated galleries:** five inside the app (BP §24, §39): the wizard's step-1 grid, the `Home` no-goal gallery, a six-card strip in `Home`, a six-card strip in `ExecutionDashboard`, and `PathwaysExplorerModal.tsx` (193 lines; opened from `Home`, `Navbar` and `ExecutionDashboard`). **Since M3.6:** all five are `components/pathways/` (`PathwayLibrary`, its compact `PathwayStrip`, and the modal as an 84-line Dialog around the library), and every launch goes through `usePathwayLaunch`.
* **Launch state:** `{ presetGoal, isPreset, switchGoal }` through router state, and `localStorage['achivii_draft_goal']`. Since Phase 2, a landing pathway reaches onboarding through `/signup?pathway=<id>` and `usePostAuthRedirect` (`frontend/src/pages/auth/`), which sets both.
* **Browser history:** onboarding manages browser history per step (R-18): `goToStep` pushes `{ wizardStep }`, a `popstate` handler calls `goToStep(target, false)`, and mount calls `replaceState`, which also drops React Router's `usr` state.
* **Custom goals:** free and ungated (`POST /api/goal/create` doesn't check entitlement).

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
| M3.8 | Regression and phase report |

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

---

## PHASE 4 — JOURNEY GENERATION

**Status:** `NOT STARTED`

**Source:** BP §30, §41, §47, §49 (Phase 4), OD-8 · VDS §7, §19–21

**Objective:** make the creation of the 90-day path feel meaningful, while every visible stage describes something the system is really doing.

**Narrative line:** *"We're building your path."*

### Current state

* **Transport:** `POST /api/goal/create` streams server-sent events when the request sends `Accept: text/event-stream`.
* **Events (`routes/goal.ts`):**
  * `{ type: 'step', id: 'search', label }`. The label is "Using a proven method for this goal" (preset) or "Comparing methods for your answers" (custom).
  * `{ type: 'step', id: 'method', label: <method name>, detail: <why chosen> }`.
  * `{ type: 'step', id: 'plan', label: 'Writing your first week' }`.
  * `{ type: 'done', ... }` and `{ type: 'error', error }`.
  * Every payload carries `elapsedMs` and `slow`, which is true after 20 seconds.
* **Research:** the live route (`generateRoadmap` in `lib/ai/roadmap.ts`) does **not** perform web research. The step id `search` is therefore a misnomer, and no user-facing label may say "searching" or "researching" (OD-8).
* **Fallback:** if the v2 plan fails for a preset, the fixed v1 preset plan is used (a `plan` step is still emitted).
* **Rejection:** an unsafe goal is rejected.
* **Real content available:** the method name and why it was chosen. This is content the user can be shown as it arrives.

### Decisions required before starting

* **OD-8: honest stage mapping.** The BP §30 stages ("Understanding your goal", "Mapping your starting point", "Building your journey", "Designing your first steps") may be shown only where each maps onto a real event. Decide the final stage list and labels.

### In scope

* A generation screen that follows the three real events:
  * reveal the chosen method and the reason for it when the `method` event arrives;
  * move to "Writing your first week" on `plan`;
  * transition into Today (or the journey reveal) on `done`.
* The motion language: ascent and emergence (VDS §19). Steps may "appear" as stages complete (VDS §7, "steps subtly reveal themselves").
* **Slow state** (`slow: true`). An honest message that it's taking longer, with no fake percentage.
* **Error state.** A retry that keeps all onboarding answers; the unsafe-goal message in encouraging language.
* **Leaving mid-generation.** Document what happens today (the request continues or is aborted). The new UI must not make it worse and must not create duplicate goals on retry.
* **Reduced motion:** stages change without animation.

### Out of scope

* Adding real web research to the live route. That is a backend and product decision outside this redesign.
* Changing what is generated.

### Backend allowance

**Named and optional:** change the user-facing `label` strings of the stream events in `routes/goal.ts` (not ids, not payload shape), and only if OD-8 needs it. Nothing else.

### Files likely affected

* The generation part of `OnboardingWizard.tsx` (or its Phase 3 successor)
* `frontend/src/lib/api.ts` (reading the stream only; no contract change)
* new `frontend/src/components/generation/*`

### Milestones

| ID | Milestone |
|---|---|
| M4.1 | OD-8 decided: final stage list mapped to real events |
| M4.2 | Generation screen: stages, method reveal, transition out |
| M4.3 | Slow, error, unsafe-goal and retry states |
| M4.4 | Mid-generation navigation behaviour verified; no duplicate goals |
| M4.5 | Regression and phase report |

### Regression checks

R-2, R-5, R-6, R-7, R-15.

### Mobile acceptance

3.7 applies, plus:

* The screen stays readable at 360px.
* The generation screen stays active and readable if the phone locks and wakes (document the behaviour).

### Validation

* Generate a preset goal and a custom goal.
* Force a slow run (observe `slow`).
* Force an error (stop the backend mid-request; use an invalid provider key in a development environment only).
* Retry after an error.
* Navigate away and come back.

### Exit criteria

* Every visible stage corresponds to a real event.
* No fake progress.
* Answers survive errors.
* Generation still produces and saves a goal exactly as before.

### Risks

* Misleading stage copy (OD-8).
* A retry creating a second goal.

---

## PHASE 5 — TODAY

**Status:** `NOT STARTED`

**Source:** BP §08–09, §15–18, §23, §26–27, §31–32, §41, §43–46, §48, OD-3, OD-9 · VDS §9, §14, §20, §24–26, §28

**Objective:** build the central execution experience. On opening Achivii, the user knows what to do today within seconds.

**Narrative line:** *"Here's your next step."* ("Always bring the user back to the next step", BP §48.)

### Current state

* **Two dashboards:**
  * `/` signed-in: the simplified dashboard inside `Home.tsx` (768 lines in total, including the landing wiring).
  * `/dashboard`: `DashboardPage.tsx` → `ExecutionDashboard.tsx` (1,209 lines).
  * The Navbar's "Today" points to `/` (OD-3).
* **Supporting components:**
  * `FocusSessionModal.tsx` (593 lines, the focus timer)
  * `StepChallengeWidget.tsx` (386 lines; its progress is **not persisted**, BP §43)
  * `DayRoutineTimeline.tsx`, `FullDayVisualizer.tsx`
  * `BasisBadge.tsx`
  * `PlanV2Panel.tsx`
  * `SaaSBuilderModal.tsx` (715 lines; purpose and reachability to be confirmed)
* **App navigation:** `Navbar.tsx` (245 lines) plus a simple footer, rendered in `App.tsx` for every non-landing screen.
* **Task data (`DailyTask`):**
  * `title`, `detailedSteps` (JSON string of steps: instructions, output, doneWhen/passMark, focusCue, pitfall, timing, resource fields)
  * `implementationIntention`, `durationMinutes`, `slotTime`, `whyToday`
  * `minimumVersion` (the 10-minute step)
  * `isRestDay`, `isKeySession`, `isTestDay`
  * `status`, `completedAt`, `notes`
  * `resourceTitle`, `resourceUrl`, `resourceType`, `resourceWhy`
* **Writes:** `PATCH /api/goal/tasks/:taskId` (status, notes).

### Decisions required before starting

* **OD-3: which dashboard becomes Today.** Decide the route, what happens to the other dashboard, and the `ProtectedRoute` redirects.
* **OD-9: every Today state.** Define:
  * a normal practice day
  * a key session
  * a test day
  * a rest day
  * the minimum-version day
  * a completed day
  * week complete / review due
  * a review that failed (503, week unchanged)
  * after week 12
  * no active goal
  * API offline
  * loading and error
* **ND-7: the application shell.**
  * Desktop: persistent restrained navigation (VDS §14; BP §45 sidebar not yet committed).
  * Mobile: bottom navigation or equivalent.
  * Which items appear before their pages exist. BP §23 says no empty pages, so a Journey, Progress or Coach entry is shown only when that page exists, or Coach ✦ appears as an honest "coming" entry. Decide which.

### In scope

* **The application shell and navigation** per ND-7, replacing `Navbar.tsx` and the app footer for signed-in screens.
* **The Today hierarchy** (BP §09, §46): goal → Day N / 90 → today's step → duration → Start → progress glance → the way into the Journey.
* **The daily session with progressive reveal** (BP §31):
  * *What:* the title.
  * *Why:* `whyToday`.
  * *How:* the steps, with their instructions.
  * *Done when:* `doneWhen` / `passMark`.
  * *Focus cue*, *pitfall*, the resource with its reason, and the 10-minute version.
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
| M5.1 | OD-3, OD-9 and ND-7 decided; state matrix written |
| M5.2 | Application shell and navigation (desktop and mobile) |
| M5.3 | Today hierarchy for the normal practice day |
| M5.4 | Daily session with progressive reveal (every field preserved) |
| M5.5 | Focus mode redesigned; timer behaviour identical |
| M5.6 | Completion interaction and notes |
| M5.7 | Every remaining OD-9 state |
| M5.8 | The unused dashboard retired or redirected per OD-3; `ExecutionDashboard` decomposed |
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
| OD-3 | Which dashboard becomes Today | Open | 5 |
| OD-4 | Phase 2 route changes (`/login`, `/signup`) | **Decided (A):** routes only, modal retired | 2 |
| OD-5 | Mobile in every phase | Adopted (3.7) | All |
| OD-6 | Rewrite `Design.md` | Done in Phase 0 (M0.10) | 0 |
| OD-7 | The Journey handles 2–4 method-named phases | Constraint adopted; design open | 6 |
| OD-8 | Honest generation stages | Open | 4 |
| OD-9 | Every Today state defined | Open | 5 |
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
| ND-7 | Application shell: desktop navigation form, mobile navigation form, and which entries appear before their pages exist | 5 |
| ND-8 | Progress as its own page or as a Journey layer | 8 |
| ND-9 | Payments: in scope or not; provider; billing model | 10 |
| ND-10 | Custom-goal gating: timing, server-side entitlement, grandfathering existing goals | 10 |
| ND-11 | Coach scope: architecture-only or a real chat build | 10 |
| ND-12 | Phase 2 frontend scope additions — **Decided (A):** `api.ts` attaches HTTP status to errors; `GoalContext` exposes `goalLoadFailed` | 2 |
| ND-13 | Onboarding step order — **Decided (A):** spec order for presets; custom goals do Schedule while clarify runs, then the questions | 3 |
| ND-14 | Question grouping — **Decided (A):** "success" = editable clarified outcome plus the `success` question; everything else is "starting point" | 3 |
| ND-15 | Pathway library scope — **Decided (A):** one `PathwayLibrary` for all five in-app galleries; the modal becomes a Dialog around it | 3 |
| ND-16 | Pre-existing onboarding bugs — **Decided (A):** fix the blank step after reload and the switch-goal reload in M3.3; clear the draft key after create | 3 |

---

# 6 — KNOWN ISSUES AND CARRY-OVERS

| Issue | Source | Owner |
|---|---|---|
| ~~AuthModal uses the old style; its close button overlaps the tabs~~ | Phase 1 validation | Done in Phase 2 (modal retired) |
| ~~Pathway descriptions are jargon-heavy (onboarding uses the plain `summary` since M3.5; the landing page and in-app galleries don't yet)~~ | Phase 1 review | Done in M3.6 (every gallery and the landing page show `summary`) |
| ~~Returning user with a goal choosing a pathway, then signing in, is unverified live~~ | Phase 1 validation | Done in Phase 2 (verified live) |
| Legacy fonts, base body styles, mint focus rule and the radius override remain for unmigrated screens (role tokens are canonical since Phase 0) | Phase 0 | Phase 12 |
| `RoadmapPage.tsx` calls hooks after an early return (`rules-of-hooks`) | Phase 0 lint | Phase 6 |
| Lint baseline: 48 errors, 6 warnings in 14 pre-Phase-0 files | Phase 0 lint | Each file's migrating phase |
| Four font families loaded | Phase 1 | Phase 12 |
| The stream step id `search` describes no search | OD-8 | Phase 4 |
| `StepChallengeWidget` progress isn't persisted | BP §43 | Phase 5 |
| Two dashboards (`/` and `/dashboard`) | OD-3 | Phase 5 |
| No completed-goal state on the server | OD-1 | Phase 9 |
| Weekly test results aren't stored | OD-1 | Phase 7 |
| Custom goals are free and ungated on the server | BP §22 | Phase 10 (ND-10) |
| Low-resolution brand images; per-pathway photos off-style | VDS note 8 | Phase 12 |
| ~~No Playwright smoke tests yet~~ (added in Phase 2); ~~no onboarding payload test yet~~ (added in M3.1) | ND-3 | Done in Phase 3 |
| Test accounts in the local development database (Phase 1: one; Phase 2: `phase2-w6-{a,b,c}-1790142962485@example.com`; Phase 3: every `LIVE_API=1` run adds two `phase3-live-*@example.com`) | Phase 1–3 validation | Housekeeping |
| Intermittent forced sign-out: `getAuthUser` answers 401 when its database lookup throws, and `AuthContext` drops the token on any `/me` failure (seen twice during the Phase 3 kickoff; likely brief Supabase pooler outages) | Phase 3 kickoff | Unassigned (backend; W9) |
| React warns of a `<button>` nested in a `<button>` in `FullDayVisualizer` (dashboard task row) | Phase 3 kickoff | Phase 5 |
| ~~Onboarding quiz modal at 390 and 360 px: the footer's "Next Question" button runs past the right edge of the dialog (clipped by the fixed overlay; the page doesn't scroll). Present before M3.4~~ | M3.4 | Done in M3.5 (modal replaced by inline question screens; Playwright checks 360 and 390) |
| ~~`react-hooks/set-state-in-effect` in `useOnboardingState.ts`: one of three removed in M3.5 (`maxStepReached` is gone; reachability is derived from the answers). Two remain on purpose: the mount effect that starts clarify for a preset or draft, and the effect that leaves the schedule once a pending clarify returns. Moving either into an event changes when clarify starts or when the step changes, which R-4 and R-18 depend on~~ | M3.4 | Done in M3.7 (mount state initialised, the schedule transition moved into the clarify callback; hook timing tests first; no disables) |
| The generation screen keeps its legacy look; M3.7 only made its failure copy honest and announced | M3.7 | Phase 4 |
| A pathway chosen inside onboarding doesn't write the draft key, so a reload returns to the goal step (M3.3 behaviour); custom answers live only on the page | M3.7 | M3.8 (confirm) or Mo's decision |
| Create recovery after a lost connection is skipped when the current goal failed to load, so a retry then could create a second goal (the first archived) | M3.7 | Phase 5 (goal-load error state) |
| Soft-keyboard states can't be emulated in Playwright (the onboarding footer is sticky, not fixed) | M3.7 | Phase 11 (on-device check) |
| ~~Landing `marketing/sections/Pathways.tsx` still hard-codes its six groups; onboarding now reads `direction` and `summary` from `certifiedPresets.ts` (OD-11, ND-5)~~ | M3.5 | Done in M3.6 (reads `PATHWAY_GROUPS`) |
| Onboarding has no skip link; the legacy navbar (and the offline indicator, R-17) sits above it | M3.5 | Phase 5 (app shell) |
| Main JS chunk 560.90 KB (163.32 KB gzipped), above Vite's 500 KB warning since before Phase 0 | M3.5 build | Phase 12 (code splitting) |
| Failed goal fetch lands on a goal-less Today; "Explore Goals" vs "Pathways" naming; legacy palette on the Today notice | Phase 2 | Phase 5 |
| Offline status is a one-time health check; the signed-in redirect has no timeout | Phase 2 | Phase 12 |
| ~~No real-backend Playwright specs (`e2e/live/` is empty)~~ | Phase 2 | Done in Phase 3 (M3.1) |
| No inverse variants for `Button`, `Badge`, `StepMarker`, fields or choice controls; light surfaces hold text and `TextLink` only | Phase 0 review | First phase needing a control on a light surface |
| ~~Focus rings can be clipped by `overflow` on tab lists and dialog edges (the auth screens use neither, so Phase 2 didn't reach it). The first Dialog in the app (M3.5's commitment editor) keeps its controls inside the body's padding; tab lists are unreached~~ | Phase 0 review | Done in M3.6 (`TabsTrigger` uses `.focus-ring-inset`; the strip pads its scroll track; the explorer keeps its controls inside the body's padding) |
| The navbar's goal links (Today, Roadmap, Goals and the account button) overflow by 7 px at 360 px when a goal is active; present before M3.6 (`Navbar.tsx` untouched) | M3.6 | Phase 5 (app shell) |
| Pathway counts are hard-coded: "Explore Goals (10)" (`Home`, `ExecutionDashboard`), "Pathways (10)" and "Explore 10 Pathways" (`Navbar`), "Ten journeys, ready to begin." (landing) | M3.6 | Phase 5 (naming); landing Phase 12 |
| `certifiedPresets.ts` keeps expert fields no screen shows (`outcome`, `desc`, `coach`, `p1`–`p3`, `sampleDay`); `SaaSBuilderModal.tsx` is unused | M3.6 | Phase 4 (whether generation shows the method), else Phase 12 |
| M3.6 review items: search and the four-category filter left the `Home` gallery (direction navigation replaces them); a strip tile now opens the explorer instead of switching at once | M3.6 | Mo's review of M3.6 |
| ~~A `Dialog` opened from state (no `DialogTrigger`) didn't return focus on close~~ | M3.5 | Done in M3.5 (`DialogContent` returns focus to the element focused when it opened; unit test added) |
| ~~No automated accessibility check~~ | Phase 0 review | Done in Phase 2 (axe in Playwright) |
| `Design.md` gaps (dialog initial focus, `Spinner`, `ChoiceGroup` columns, milestone colour, navigation rule vs ND-7, logs/table/code rules without primitives) | Phase 0 review | Next `Design.md` pass |
| Type-scale minimums below some VDS ranges; micro tracking baked in (not taken up in the Phase 2 review) | Phase 0 review | Next `Design.md` pass |
| `--duration-reveal` unused; glass has no mobile blur guard | Phase 0 review | Phase 12; first phase using glass |
| `StaircaseScene` literal hex and `hover:bg-white`; `marketing/Button` duplicates `ui/Button`; `vite` `dedupe` masks a broken install | Phase 0 review | Phase 12; housekeeping |

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
