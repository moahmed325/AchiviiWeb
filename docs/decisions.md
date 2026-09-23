# ACHIVII — DECISION LOG

### Architecture, technology, product and design decisions for the redesign

Part of the project framework:

| File | Answers |
|---|---|
| `docs/redesign-blueprint.md` | What Achivii is and must become (source of truth, **BP §n**) |
| `docs/visual-design-system.md` | How it looks (source of truth, **VDS §n**) |
| `docs/phases.md` | When and in what order |
| `docs/prompts.md` | How the agent is instructed |
| `docs/decisions.md` (this file) | **Why** — every decision, its options, the choice and its consequences |

A phase may not start while a decision it depends on is **Open** or **Proposed**. `docs/prompts.md` enforces this with a decision gate at the top of every phase prompt.

Last updated: 2026-09-23

---

# 0 — HOW THIS LOG WORKS

## Statuses

| Status | Meaning |
|---|---|
| **Open** | The question is known; no option has been chosen |
| **Proposed** | Options and a recommendation are written; waiting for Mo |
| **Decided** | Mo has chosen. The "Decision" line is binding |
| **Superseded** | Replaced by a later entry (linked) |
| **Rejected** | Considered and deliberately not done |

**Recommendation** is the agent's advice. It is never binding. Only the **Decision** line is.

## Identifiers

| Prefix | Meaning |
|---|---|
| **D-n** | Foundational decisions already made (source documents, Phase 1, framework setup) |
| **OD-n** | Open Decisions from the end of `docs/redesign-blueprint.md` (numbered 1–12 there) |
| **ND-n** | New decisions raised in `docs/phases.md` |

OD-1 is split into three parts, because each part gates a different phase:

* **OD-1a** — weekly test results (Phase 7; called "OD-1, Phase 7 part" in the prompts)
* **OD-1b** — goal completion (Phase 9)
* **OD-1c** — custom-journey entitlement (Phase 10)

## Categories

**Product** · **Design** · **Architecture** · **Technology** · **Process**

## Entry format

Every entry uses this structure. W3 in `docs/prompts.md` drafts entries in this format; W4 records the outcome.

```text
### <ID> — <Title>

| Field | Value |
|---|---|
| Status | Open / Proposed / Decided / Superseded / Rejected |
| Category | Product / Design / Architecture / Technology / Process |
| Needed by | Phase(s) |
| Raised | <date> — <source> |
| Decided | <date> — <who> (or —) |

**Context.** What in the product and the code makes this matter.

**Question.** One sentence.

**Options.**
- **A — <name>.** What it means. Pros. Cons. What it touches (R-n, files, backend).
- **B — ...**

**Recommendation.** The agent's advice and why. Not binding.

**Decision.** One line. "—" while Open or Proposed.

**Consequences.** What changes because of the decision: scope, backend allowances,
milestones, follow-up work.

**Related.** Other entries, BP/VDS sections, phases.
```

## Changing a decision

A Decided entry is never silently edited. To change it, add a new entry that supersedes it, mark the old one **Superseded** with a link, and update `docs/phases.md`.

---

# 1 — INDEX

| ID | Title | Category | Status | Needed by |
|---|---|---|---|---|
| D-1 | Source-of-truth hierarchy | Process | Decided | All |
| D-2 | "90 days" is the product language | Product | Decided | All |
| D-3 | Dark only; light surfaces are compositional | Design | Decided | All |
| D-4 | Colour palette values | Design | Decided | 0 |
| D-5 | Tokens named by role, not colour | Design | Decided | 0 |
| D-6 | The design system supersedes `Design.md` | Design | Decided | 0 |
| D-7 | Geist and Geist Mono as the typefaces | Design | Decided | 0 |
| D-8 | New dependencies are allowed when they earn their place | Technology | Decided | All |
| D-9 | lucide-react is the only icon family | Technology | Decided | All |
| D-10 | Phase order follows BP §49 | Process | Decided | All |
| D-11 | Backend scope rule: named, approved allowances only | Architecture | Decided | All |
| D-12 | Mobile acceptance in every phase | Process | Decided | All |
| D-13 | Framework documents live in `docs/` | Process | Decided | — |
| D-14 | Brand master images and where they live | Design | Decided | 1, 9, 12 |
| D-15 | Hero staircase is an SVG scene, not the photo | Design | Decided | 1 |
| D-16 | Marketing motion uses IntersectionObserver and CSS, no library | Technology | Decided | 1 |
| D-17 | No pricing in the marketing nav while no pricing exists | Product | Decided | 1, 10 |
| D-18 | Landing page presents Custom Journeys as future Premium; no free-text goal box | Product | Decided | 1, 3, 10 |
| D-19 | Pathway choice carries through signup, waiting for the goal to load | Architecture | Decided | 1, 2 |
| OD-1a | Store weekly test results | Architecture | Open | 7 |
| OD-1b | Goal completion transition | Architecture | Open | 9 |
| OD-1c | Server-side entitlement for Custom Journeys | Architecture | Open | 10 |
| OD-2 | 90 vs 84 days | Product | Proposed | 5, 6, 9 |
| OD-3 | Which dashboard becomes Today | Architecture | Proposed | 5 |
| OD-4 | Dedicated `/login` and `/signup` routes | Architecture | Decided (A) | 2 |
| OD-5 | Mobile in every phase | Process | Decided (see D-12) | All |
| OD-6 | Rewrite `Design.md` | Design | Decided (see D-6) | 0 |
| OD-7 | The Journey supports 2–4 method-named phases | Design | Decided | 6 |
| OD-8 | Honest generation stages | Product | Decided (A amended) | 4 |
| OD-9 | Every Today state | Product | Proposed | 5 |
| OD-10 | Meaning of "dark/light contrast" | Design | Decided (see D-3) | — |
| OD-11 | Onboarding categories vs free presets | Product | Decided (A) | 3 |
| OD-12 | Semantic token names | Design | Decided (see D-5) | 0 |
| ND-1 | Token migration strategy | Architecture | Decided | 0 |
| ND-2 | Primitive strategy | Technology | Decided | 0 |
| ND-3 | Frontend verification tooling | Technology | Decided | 0, 2, 3 |
| ND-4 | Pathway handoff and redirects with auth routes | Architecture | Decided (A) | 2 |
| ND-5 | Pathway display copy | Product | Decided (A) | 3 |
| ND-6 | Free custom-goal entry before Phase 10 | Product | Decided (A) | 3 |
| ND-7 | Application shell and navigation | Design | Proposed | 5 |
| ND-8 | Progress: separate page or Journey layer | Design | Proposed | 8 |
| ND-9 | Payments in scope or not | Product | Proposed | 10 |
| ND-10 | Custom-goal gating | Product | Proposed | 10 |
| ND-11 | Coach scope | Product | Proposed | 10 |
| ND-12 | Phase 2 frontend scope additions (`api.ts` status, `GoalContext` failure flag) | Architecture | Decided (A) | 2 |
| ND-13 | Onboarding step order around the clarify wait | Design | Decided (A) | 3 |
| ND-14 | Grouping clarify questions into "starting point" and "success" | Design | Decided (A) | 3 |
| ND-15 | Scope of the single pathway library | Architecture | Decided (A) | 3 |
| ND-16 | Pre-existing onboarding bugs fixed in Phase 3 | Architecture | Decided (A) | 3 |
| ND-17 | TED-style speech pathway matching | Product | Decided (A) | 4 |

**What blocks the next phase:** Phase 3 is complete (accepted by Mo, 2026-09-23). Phase 4 is no longer blocked. M4.1 is done: OD-8 is Decided (A amended) and ND-17 is Decided (A). M4.2 may start when Mo sends it. Phase 4 is not complete.

---

# 2 — FOUNDATIONAL DECISIONS (ALREADY MADE)

### D-1 — Source-of-truth hierarchy

| Field | Value |
|---|---|
| Status | Decided |
| Category | Process |
| Needed by | All |
| Raised | 2026-09-23 — blueprint and framework setup |
| Decided | 2026-09-23 — Mo |

**Context.** Several older planning documents exist or existed (`Design.md`, `TODO.md`, `best-roadmap.md`, `golden-rail-pipeline-spec.md`, `plan-v2-spec.md`, and the old root `phases.md` and `prompts.md`, which Mo has since removed). Agents need one unambiguous authority.

**Decision.** The redesign's sources of truth are `docs/redesign-blueprint.md` (product) and `docs/visual-design-system.md` (visuals). `docs/phases.md`, `docs/prompts.md` and `docs/decisions.md` implement them. On conflict:
* the blueprint and design system win on product and visuals;
* this log wins on anything it has decided;
* `phases.md` wins on scope and order.

**Consequences.** Other documents are context, not instructions, for the redesign. Every conflict an agent notices must be reported, never resolved silently (system prompt).

**Related.** D-6, D-13.

---

### D-2 — "90 days" is the product language

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | All |
| Raised | BP §06 |
| Decided | Blueprint |

**Decision.** User-facing copy says "90 days", not "12 weeks".

**Consequences.** The technical 84-day plan must be reconciled in OD-2 rather than leaking into the UX. Phase 1 copy uses "90 days" and avoids "twelve weeks".

**Related.** OD-2.

---

### D-3 — Dark only; light surfaces are compositional

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | All |
| Raised | BP §51 ("dark/light contrast"), BP Open Decision 10 |
| Decided | VDS §27 and implementation note 5 |

**Decision.** Achivii is dark only, with no theme toggle. The light surface `#F1EFE8` is used compositionally (sections, achievement), not as a light mode.

**Consequences.** Tokens need no light-theme variants. Any text, icon or focus ring on the light surface uses a darker accent variant (VDS note 3).

**Related.** OD-10, D-4.

---

### D-4 — Colour palette values

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 0 |
| Raised | VDS §2–3 |
| Decided | VDS |

**Decision.**

| Role | Value |
|---|---|
| Background | `#0B0B0A` |
| Surface | `#141413` |
| Elevated surface | `#1C1C1A` |
| Light surface | `#F1EFE8` |
| Text | `#F5F3EC` |
| Secondary text | `#A7A59E` |
| Muted text | `#6F6D67` |
| Accent (botanical green) | `#7FA58B` |
| Accent hover | `#A8C8A9` |
| Achievement (warm stone/gold, used sparingly) | `#C8A96B` |

Phase 1 also introduced a darker accent, `#3F6B4E` (`accent-deep`), for use on light surfaces.

**Consequences.**
* Muted text (≈3.8:1) is restricted to large text, placeholders and dividers.
* Accent on the light surface (≈2.4:1) needs the darker variant.
* The legacy mint `#07CB6C` is retired as the identity.

**Related.** D-5, ND-1, VDS notes 2–3.

---

### D-5 — Tokens named by role, not colour

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 0 |
| Raised | BP Open Decision 12 |
| Decided | VDS note 4 |

**Decision.** Tokens are named by role: `background`, `surface`, `surface-elevated`, `surface-inverse`, `text`, `text-secondary`, `text-muted`, `accent`, `accent-hover`, `achievement`, `border`. A rebrand must be a one-file change in `frontend/src/index.css`.

**Consequences.** The Phase 1 tokens (`ink`, `panel`, `paper`, `fg`, …) and the legacy tokens must be reconciled with these names (ND-1). The global radius override (`--radius-xl/2xl/3xl: 0.375rem`) is to be removed.

**Related.** OD-12, ND-1.

---

### D-6 — The design system supersedes `Design.md`

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 0 |
| Raised | BP Open Decision 6 |
| Decided | VDS implementation note 1 |

**Decision.** `docs/visual-design-system.md` supersedes `Design.md`. `Design.md` is rewritten in Phase 0 (M0.10): it keeps its still-valid mobile, scroll and touch-target rules, adopts the design system's direction (light glass over imagery, deep shadows, the ✦ destination mark, moderate radii), and states that the design system wins on conflict.

**Consequences.** Until the rewrite, agents follow the design system wherever `Design.md` disagrees.

**Implemented** 2026-09-23 (Phase 0, M0.10). `Design.md` now states VDS precedence, the token reference, the contrast table, the primitives' usage, and the retained mobile, touch and scroll rules.

**Related.** OD-6, D-1.

---

### D-7 — Geist and Geist Mono as the typefaces

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 0 |
| Raised | VDS §4 ("exact font is decided during implementation"), VDS note 6 |
| Decided | 2026-09-23 — chosen during Phase 1; confirmed for the whole app by Mo at the Phase 0 gate |

**Context.** The design system asks for a modern grotesk with a matching mono and tabular figures, and names Geist + Geist Mono as an example.

**Decision.** Geist for the interface, Geist Mono for numeric and technical accents. Both are loaded from Google Fonts in `frontend/index.html`.

**Consequences.**
* Plus Jakarta Sans and JetBrains Mono stay loaded until the app is migrated, then are removed in Phase 12.
* Self-hosting is decided in Phase 12.

**Related.** VDS §4–5, Phase 12.

---

### D-8 — New dependencies are allowed when they earn their place

| Field | Value |
|---|---|
| Status | Decided |
| Category | Technology |
| Needed by | All |
| Raised | Visual design system discussion |
| Decided | 2026-09-23 — Mo ("feel free to add dependencies"); VDS note 9 |

**Decision.** Packages may be added where they clearly earn their place.

**Consequences.** Each addition is named in the phase that introduces it, with the reason, and logged here. Every animation, whatever library drives it, still needs a reduced-motion path.

**Packages added:**

| Phase | Package | Kind | Why |
|---|---|---|---|
| 0 | `@radix-ui/react-dialog` | runtime | Dialog and Sheet: focus trap, Escape, scroll lock, inert background, focus restore (ND-2). Needed by Phases 2, 3 and 5 to replace the hand-rolled modals. |
| 0 | `@radix-ui/react-tabs` | runtime | The Tabs primitive in Phase 0's scope: roving focus and arrow keys (ND-2). No screen uses it yet. |
| 0 | `@radix-ui/react-slot` | runtime | `Button asChild`, so router links get button styling without nesting. |
| 0 | `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` | dev | Linting (ND-3). |
| 0 | `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event` | dev | Component tests (ND-3). |
| 2 | `@playwright/test` (with Chromium) | dev | Browser tests for the auth routes and redirects at desktop and mobile widths (ND-3, approved in ND-12). |
| 2 | `@axe-core/playwright` | dev | Automated WCAG checks inside the Playwright suite (approved in ND-12). |

No Radix Select or Tooltip was added: `Select` is native, and no phase up to 5 needs a tooltip yet.

**Related.** ND-2, ND-3, D-16.

---

### D-9 — lucide-react is the only icon family

| Field | Value |
|---|---|
| Status | Decided |
| Category | Technology |
| Needed by | All |
| Raised | VDS §24 |
| Decided | VDS note 11 |

**Decision.** Keep lucide-react (stroke width 1.5 fits "thin, geometric, understated"). Do not add a second icon set.

---

### D-10 — Phase order follows BP §49

| Field | Value |
|---|---|
| Status | Decided |
| Category | Process |
| Needed by | All |
| Raised | BP §49 |
| Decided | Blueprint; adopted in `docs/phases.md` on 2026-09-23 |

**Decision.** The order is:

0. Foundation
1. Marketing
2. Authentication
3. Onboarding
4. Generation
5. Today
6. Journey
7. Weekly review
8. Progress
9. Achievement
10. Premium
11. Mobile
12. Polish

One phase at a time. Each ends with a report and Mo's review.

**Consequences.** Phase 1 ran before Phase 0 finished, using a marketing-scoped foundation. The rest of Phase 0 must finish before Phase 2. (Phase 0 was delivered on 2026-09-23 and awaits review.)

---

### D-11 — Backend scope rule: named, approved allowances only

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | All |
| Raised | BP §40 and Open Decision 1 |
| Decided | Adopted in `docs/phases.md` rule 3.2 on 2026-09-23 |

**Decision.** Backend, schema, API client, auth and goal contexts, and onboarding/dashboard business logic are off-limits by default. A phase may change the backend only where its "Backend allowance" names the exact change **and** a Decided entry here approves it. Frontend-only substitutes for missing backend capabilities are forbidden.

**Consequences.** Phases 7, 9 and 10 each need an approval (OD-1a, OD-1b, OD-1c). Phase 4's optional stream-label allowance is not used (OD-8 A). Phase 4 also has one named matching-only allowance: `findPresetForGoal` / the speech preset's `matchingPatterns`, so the frontend TED title matches `ted_speech_15min` (ND-17 A). Nothing else.

---

### D-12 — Mobile acceptance in every phase

| Field | Value |
|---|---|
| Status | Decided |
| Category | Process |
| Needed by | All |
| Raised | BP Open Decision 5 |
| Decided | Adopted in `docs/phases.md` rule 3.7 on 2026-09-23 |

**Decision.** Every phase is verified at 390px (and 360px for dense screens): no horizontal scroll, tap targets at least 44px, safe areas respected, sheets on mobile. Phase 11 is a final sweep, not the first time mobile is considered.

**Related.** OD-5.

---

### D-13 — Framework documents live in `docs/`

| Field | Value |
|---|---|
| Status | Decided |
| Category | Process |
| Needed by | — |
| Raised | 2026-09-23 |
| Decided | 2026-09-23 — Mo (removed the old root `phases.md` and `prompts.md`) |

**Decision.** `phases.md`, `prompts.md` and `decisions.md` live in `docs/`, next to the blueprint and the design system.

---

### D-14 — Brand master images and where they live

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 1, 9, 12 |
| Raised | Visual design system discussion |
| Decided | 2026-09-23 — Mo supplied the images |

**Decision.** Two master images live in `frontend/public/images/brand/`:
* `staircase.jpg` — the journey; 735×985 portrait, heavily compressed.
* `garden.jpg` — the destination; 682×1024 portrait.

The Roman-garden website screenshot is a layout reference only, not an asset.

**Consequences.** Neither image may be relied on to look crisp at full desktop width (VDS note 8). Higher-resolution versions are an open asset request for Phase 12.

---

### D-15 — Hero staircase is an SVG scene, not the photo

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 1 |
| Raised | Phase 1 |
| Decided | 2026-09-23 — implemented in Phase 1, accepted with the Phase 1 report |

**Context.** VDS §7 says not to simply put a staircase image in the hero. VDS note 8 says the staircase photo is too small for a sharp desktop hero.

**Decision.** The hero uses an isometric SVG staircase (`components/marketing/StaircaseScene.tsx`) that rises to a lit doorway. The photo appears in the Journey section on large screens only.

**Consequences.** The hero is resolution-independent and animatable, with a reduced-motion path. The same visual language can inform the in-app Journey (Phase 6), but must not be copied as a template (BP §10).

---

### D-16 — Marketing motion uses IntersectionObserver and CSS, no library

| Field | Value |
|---|---|
| Status | Decided |
| Category | Technology |
| Needed by | 1 |
| Raised | Phase 1 |
| Decided | 2026-09-23 — implemented in Phase 1 |

**Decision.** Scroll reveals, count-ups and staircase animation use `IntersectionObserver` hooks (`components/marketing/hooks.ts`) and CSS transitions and keyframes. No animation library was added.

**Consequences.** A library such as Motion remains allowed under D-8 if a later phase needs orchestrated or scroll-linked motion (for example the Journey animation in VDS §20). Adding one is a new decision.

---

### D-17 — No pricing in the marketing nav while no pricing exists

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | 1, 10 |
| Raised | Phase 1 (VDS §13 lists "Pricing") |
| Decided | 2026-09-23 — Phase 1 prompt ("Pricing is not faked") |

**Decision.** The marketing nav has How it works, Journeys, Coach, Sign in and Start. There is no Pricing link.

**Consequences.** Revisit in Phase 10, if ND-9 brings real pricing.

---

### D-18 — Landing page presents Custom Journeys as future Premium; no free-text goal box

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | 1, 3, 10 |
| Raised | Phase 1 |
| Decided | 2026-09-23 — implemented in Phase 1, accepted with the Phase 1 report |

**Context.** BP §22 says custom goals are intended to be paid. The code lets anyone create one free. BP §43 forbids pretending payments exist.

**Decision.**
* The landing page lists the 10 guided pathways, and shows Custom Journeys as "Planned for Premium", with no button.
* The old free-text goal box on the landing page was removed.
* The page states that there is no paid plan yet and everything available today is free.

**Consequences.** Custom goals remain free inside onboarding until ND-6 and ND-10 say otherwise. The marketing copy must be updated whenever availability changes (Phase 10, M10.6).

---

### D-19 — Pathway choice carries through signup, waiting for the goal to load

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 1, 2 |
| Raised | Phase 1 (bug: a pathway chosen while signed out was lost at signup) |
| Decided | 2026-09-23 — implemented in Phase 1 |

**Context.** `GoalContext` loads the goal in an effect when the token changes. On the first render after login, `loadingGoal` is still false and `activeGoal` is null, so an immediate redirect would wrongly send a returning user to onboarding.

**Decision.**
* `Home.tsx` keeps `pendingPathway` and a `goalFetchSeen` ref.
* After login it waits until a goal fetch has been observed.
* It then navigates to `/onboarding` with `{ presetGoal, isPreset: true, switchGoal: true }` (writing `achivii_draft_goal`), but only if there is no active goal.

**Consequences.**
* This mechanism lives in component state and would not survive navigation to a dedicated auth route. ND-4 must replace or extend it in Phase 2.
* The returning-user case was checked by reading the code, not live. It is part of Phase 2's validation.

**Related.** ND-4, OD-4, R-16.

---

# 3 — OPEN DECISIONS FROM THE BLUEPRINT

### OD-1 — Backend scope per phase (umbrella)

The rule itself is Decided as **D-11**. The three allowances it anticipates are separate entries, below, because each gates a different phase.

---

### OD-1a — Store weekly test results

| Field | Value |
|---|---|
| Status | Open |
| Category | Architecture |
| Needed by | 7 (and 8, which displays results) |
| Raised | BP Open Decision 1 |
| Decided | — |

**Context.**
* `RoadmapWeek.test` stores `{ type, instructions, passIf }` and `RoadmapWeek.target` stores a metric or a deliverable, so every v2 week already defines a test.
* No result is ever stored. `POST /api/goal/weeks/:weekNumber/review` accepts a reflection, not a result.
* Without results, BP §17's "Results — is the user actually improving?" and §33's "How did your result compare with the target?" cannot be shown honestly.

**Question.** Should Phase 7 add storage for the user's weekly test result?

**Options.**
- **A — Add result storage.**
  * What it adds: a nullable `RoadmapWeek.testResult` JSON field (for example `{ value, unit, passed, note }`), an optional field on the review request, validation, and a Vitest test.
  * Adaptation logic is unchanged.
  * Pros: Progress (Phase 8) gets real results; the review can compare against the target.
  * Cons: a migration; a contract extension (backward compatible, because the field is optional).
- **B — Add storage and feed results into adaptation.**
  * As A, and the next-week generation also receives the result.
  * Pros: moves toward BP §19's adaptive loop.
  * Cons: changes AI behaviour. That is beyond a visual redesign and needs its own evaluation.
- **C — No storage.**
  * The review shows completion and reflection only; Progress has no results layer.
  * Pros: zero backend risk.
  * Cons: a weaker product, and BP §17 remains unmet.

**Recommendation.** **A.** It is small, optional and backward compatible, and it unlocks honest results in Phases 7 and 8 without changing AI behaviour. Treat B as a later, separate decision with its own evaluation.

**Decision.** —

**Consequences.** If A: Phase 7 milestone M7.5 is in scope, and Phase 8 can show results. If C: M7.5 is dropped and Phase 8's results layer is removed.

**Related.** D-11, ND-8, BP §17, §19, §33.

---

### OD-1b — Goal completion transition

| Field | Value |
|---|---|
| Status | Open |
| Category | Architecture |
| Needed by | 9 |
| Raised | BP Open Decision 1 |
| Decided | — |

**Context.** `Goal.status` is `active` or `archived`; nothing sets `completed`. The achievement experience (BP §34, VDS §17–18) needs the server to know a goal is complete. A frontend-only state is forbidden (D-11).

**Question.** What marks a goal as completed, and where is that written?

**Options.**
- **A — Completing the final week's review.** The week-12 review (or the last week under OD-2) sets `Goal.status = 'completed'`.
  * Pros: uses an existing, deliberate user action; one code path.
  * Cons: a user who never submits the last review never "arrives".
- **B — A dedicated "complete journey" endpoint.** Called from the final-stretch screen after the final test (`roadmap.finalTest`).
  * Pros: an explicit arrival moment; works with OD-2's closing stretch.
  * Cons: a new endpoint and the edge cases around it.
- **C — Date-based.** The goal completes automatically when day 90 passes.
  * Pros: no user action needed.
  * Cons: completion without achievement; contradicts "adapt, don't punish" in reverse (an unearned celebration).

For every option: specify how `GET /api/goal/active` behaves for a completed goal, whether to add a `completedAt` timestamp (migration), and add Vitest coverage.

**Recommendation.** **B, paired with OD-2's closing-stretch option.** Arrival is a deliberate act after the final test, which matches the narrative ("You made it"). A fallback may complete the goal once the final review is submitted, if the user skips the final screen.

**Decision.** —

**Consequences.** It sets Phase 9 milestone M9.2, and decides how Today and Journey behave after the last week.

**Related.** OD-2, D-11, BP §34, VDS §17–18.

---

### OD-1c — Server-side entitlement for Custom Journeys

| Field | Value |
|---|---|
| Status | Open — depends on ND-9 and ND-10 |
| Category | Architecture |
| Needed by | 10 |
| Raised | BP Open Decision 1, BP §22 |
| Decided | — |

**Context.** `POST /api/goal/create` accepts custom goals from anyone. `User` has no plan or entitlement field. A frontend-only lock is bypassable, and it would also remove an existing free capability.

**Question.** Should Phase 10 add a server-side entitlement and enforce it for custom goals?

**Options.**
- **A — Add it.**
  * What it adds: an entitlement field on `User` (or a separate table), exposed read-only on `GET /api/auth/me`; a check in `/create` for non-preset goals; a migration; tests for allowed and refused cases.
  * Only meaningful if ND-10 decides to gate.
- **B — Do not add it yet.** Custom goals stay free. Phase 10 ships placement and honest copy only.

**Recommendation.** Decide after ND-9 and ND-10. Adding an entitlement without a way to obtain it (payments) would lock users out of a free feature for no benefit. Only if ND-10 gates custom goals, choose A.

**Decision.** —

**Related.** ND-9, ND-10, D-18.

---

### OD-2 — 90 vs 84 days

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Product |
| Needed by | 5 (copy), 6 (Journey), 9 (completion) |
| Raised | BP §06 and Open Decision 2 |
| Decided | — |

**Context.** Plans are 12 weeks (84 days; `TOTAL_WEEKS` in `backend/src/lib/ai/roadmap.ts`). The UI calculates a 90-day target date and shows "Day N of 90". The product language is 90 days (D-2). v2 roadmaps already contain a `finalTest`.

**Question.** What does the user experience on days 85–90, and how are day numbers shown?

**Options.**
- **A — A closing stretch (days 85–90).**
  * After week 12's review, days 85–90 become a designed "final stretch": take the final test (`roadmap.finalTest`), reflect, and arrive.
  * No new generated tasks are needed.
  * Pros: honest; meaningful; fits Phase 9 (OD-1b option B).
  * Cons: needs a designed state, and completion storage for the arrival.
- **B — Generate a 13th, shorter week.**
  * Pros: 90 real planned days.
  * Cons: changes plan generation (a backend and AI change) and every preset.
- **C — Stretch the mapping.** Map 84 plan days onto a 90-day counter (each "day" is slightly longer than a day).
  * Pros: no new content.
  * Cons: the counter no longer matches the calendar. Dishonest and confusing.
- **D — Call it 84 days.**
  * Pros: accurate.
  * Cons: contradicts D-2 and the whole marketing narrative.

**Recommendation.** **A.** It keeps "90 days" true without changing plan generation. Day N counts calendar days from the start date. Days 1–84 are the planned weeks; 85–90 are the closing stretch.

**Decision.** —

**Consequences.** If A:
* Phase 5 defines the final-stretch state (part of OD-9).
* Phase 6 draws a 90-day journey with the last six days as the approach to the destination.
* Phase 9 uses OD-1b option B.
* `targetDate` must equal start + 90 days everywhere.

**Related.** D-2, OD-1b, OD-9.

---

### OD-3 — Which dashboard becomes Today

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Architecture |
| Needed by | 5 |
| Raised | BP Open Decision 3 |
| Decided | — |

**Context.**
* `/` (signed in) renders a simplified dashboard inside `pages/Home.tsx`.
* `/dashboard` renders `ExecutionDashboard.tsx` (1,209 lines), the fuller experience (focus sessions, challenge widget, routine timeline, plan panel).
* The Navbar's "Today" points to `/`.
* `ProtectedRoute` redirects depend on this choice.

**Question.** Which route and which implementation become Today?

**Options.**
- **A — Today at `/`, built from the richer capabilities.**
  * One new Today at `/` for signed-in users, assembled from `ExecutionDashboard`'s capabilities (decomposed), presented with the simplified hierarchy of BP §09.
  * `/dashboard` redirects to `/`.
  * Pros: one screen; the natural post-login landing; deep links preserved by the redirect.
  * Cons: the largest decomposition in the redesign.
- **B — Today at `/dashboard`.** Signed-in `/` redirects there.
  * Pros: the fullest code is kept in place.
  * Cons: an extra hop; `/` becomes a router; the URL reads as "a dashboard", against BP §09.
- **C — Keep both.** A simple Today and an "advanced" dashboard.
  * Pros: the least work.
  * Cons: two sources of truth; contradicts "simple by default, deep when explored" (BP §16), because depth belongs inside Today, not on a second screen.

**Recommendation.** **A.** `/` is already where "Today" points and where users land. The session depth from `ExecutionDashboard` is kept but revealed progressively (BP §31), not left on a separate route.

**Decision.** —

**Consequences.** If A: Phase 5 milestone M5.8 retires `/dashboard` with a redirect. `ProtectedRoute` and Navbar links are updated. The landing page's signed-out branch at `/` is untouched.

**Related.** ND-7, OD-9.

---

### OD-4 — Dedicated `/login` and `/signup` routes

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 2 |
| Raised | BP §49 (Phase 2) and Open Decision 4 |
| Decided | 2026-09-23 — Mo, at the Phase 2 gate |

**Context.** Auth is a globally mounted modal (`AuthModal.tsx`) opened with `openAuthModal`. BP §49 says to move away from modal-dependent architecture "where appropriate". Routes affect `ProtectedRoute` and the pathway handoff (R-16, D-19).

**Question.** Should authentication move to dedicated routes, and does the modal survive?

**Options.**
- **A — Routes only.**
  * `/signup` and `/login` pages; the modal is retired.
  * Pros: one pattern; linkable; browser history works; one fewer overlay implementation (BP §39); room for the cinematic → focused treatment.
  * Cons: the pathway handoff must be rebuilt (ND-4).
- **B — Routes, plus the modal for in-context moments.**
  * Pros: no navigation away when choosing a pathway.
  * Cons: two implementations of the same forms to keep in sync.
- **C — Modal only, restyled.**
  * Pros: least change.
  * Cons: keeps the modal dependency the blueprint wants to leave; not linkable.

**Recommendation.** **A.** It is the cleanest architecture, and the handoff is solved properly by ND-4 rather than by keeping state in memory.

**Decision.** **A — routes only.** Sign-up and sign-in move to `/signup` and `/login`, and `AuthModal` is retired. Every `openAuthModal` call site becomes a link to the matching route.

**Consequences.** If A: Phase 2 updates `App.tsx` routes, `ProtectedRoute`, and every `openAuthModal` call site (landing CTAs, pathway rows, Navbar). R-1, R-3 and R-16 are regression-checked.

**Implemented** 2026-09-23 (Phase 2). `/signup` and `/login` are live (`frontend/src/pages/auth/`); `AuthModal.tsx` and `openAuthModal` are gone. `ProtectedRoute` sends signed-out visitors to `/login?next=<path>`. R-1, R-3 and R-16 were verified against the real backend (`docs/phases.md` Phase 2).

**Related.** ND-4, D-19.

---

### OD-5 — Mobile in every phase

**Decided** as D-12.

---

### OD-6 — Rewrite `Design.md`

**Decided** as D-6. The rewrite itself is Phase 0 milestone M0.10.

---

### OD-7 — The Journey supports 2–4 method-named phases

| Field | Value |
|---|---|
| Status | Decided (constraint) |
| Category | Design |
| Needed by | 6 |
| Raised | BP Open Decision 7 |
| Decided | Adopted in `docs/phases.md` on 2026-09-23 |

**Decision.**
* The Journey view handles any number of phases from 2 to 4, with method-chosen names, for v2 goals, and the 3 fixed phases (Foundation, Acceleration, Mastery) for v1 goals.
* One adapter normalises both.
* Nothing assumes four fixed phases; the BP §10 sketch is conceptual.

**Consequences.** Phase 6 validation covers 2, 3 and 4 phases, and v1.

---

### OD-8 — Honest generation stages

| Field | Value |
|---|---|
| Status | Decided (A amended) |
| Category | Product |
| Needed by | 4 |
| Raised | BP §30 and Open Decision 8 |
| Decided | 2026-09-23 — Mo, at Phase 4 M4.1 |

**Context.** Confirmed at the Phase 4 kickoff (2026-09-23) against `backend/src/routes/goal.ts` and three live creates.
* `POST /api/goal/create` emits at most three `step` ids, then `done` or `error`. The ids stay `search`, `method` and `plan`.
* `search` is labelled "Using a proven method for this goal" or "Comparing methods for your answers". The live route (`generateRoadmap`) runs no web research, so `search` is only an id.
* `method` carries the method name and why it was chosen. It is sent only after `generateRoadmap` returns ok. On that path the roadmap (phases and weeks) already exists. On v2 success, `method` and `plan` are sent in the same tick; the wait after that is `generateWeekPlan`.
* **v1 fallback skips `method`.** A preset whose roadmap fails, and is not unsafe, goes `search` → `plan` → `done`. Live 10K on 2026-09-23 took this path (`planVersion: 1`, `canonicalMethodName: null`). There is no streamed method name.
* Custom failure is `search` → `error`. No v1 fallback.
* `slow` is a flag on an event, stamped at send time when `elapsedMs` exceeds 20 seconds. There is no heartbeat. A long silence does not produce `slow: true` until the next event.
* Goal understanding happened earlier, in onboarding, through `/clarify`. It is not a create-stream event.
* The current screen's pending label "Search sources" describes nothing the system does.

**Question.** Which stages does the user see, and what are they called?

**Options.**
- **A amended — Four stages mapped onto real events, including the v1 fallback.**

  | Stage | When it shows |
  |---|---|
  | **Understanding your goal** | Already complete on entry (`/clarify` ran during onboarding). Not a create-stream event. |
  | **Choosing your method** | From the `search` event until `method`, or until `plan` if `method` never arrives (v1 fallback) |
  | **Building your 90-day journey** | Completes on `method` when that event exists; reveal the streamed method name and whyChosen. If `method` never arrives, do not invent a method name and do not leave this stage pending. |
  | **Designing your first steps** | From `plan` until `done` |

  * Every in-flight stage maps onto a real event.
  * No "searching", "researching" or "Search sources".
  * No fake percentages, no timed fake stages, no invented durations.
  * The frontend uses its own labels. The optional stream-label backend allowance is not used. The `search` / `method` / `plan` ids do not change.
- **B — Mirror the backend labels exactly** (three stages).
  * Pros: no interpretation.
  * Cons: flatter; "Using a proven method" reads oddly as a progress stage. A missing `method` still has to be handled.
- **C — The BP §30 list verbatim**, including "Mapping your starting point".
  * Cons: no event corresponds to that stage, so it would be fake.

**Recommendation.** **A amended.** It is the closest honest match to BP §30, and the v1 path observed live is designed rather than left as a pending method row.

**Decision.** **A amended.** The stage table above is binding. Every in-flight stage maps onto a real event. No "searching", "researching" or "Search sources". No fake percentages, no timed fake stages, no invented durations. The optional stream-label backend allowance is not used. The `search`, `method` and `plan` ids do not change.

**Consequences.** No stream-label backend change. Frontend labels only. The v1 fallback must not show a pending method stage, and must not invent a method name. If later work adds real research to the live route, a genuine "researching" stage can be added then.

**Related.** D-11, ND-17, BP §30, VDS §7, §19.

---

### OD-9 — Every Today state

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Product |
| Needed by | 5 |
| Raised | BP Open Decision 9 |
| Decided | — |

**Context.** The redesign must not design only the normal practice day. `DailyTask` has `isRestDay`, `isKeySession`, `isTestDay`, `minimumVersion` and `status`. The weekly review can fail with a 503. Behaviour after the last week is undefined.

**Question.** Which states does Today design for, and what is the intent of each?

**Options.**
- **A — Adopt this state matrix.** Copy is written in Phase 5, in the encouraging voice.

| State | Trigger | Intent |
|---|---|---|
| Loading | Goal fetch in flight | Calm skeleton in the Today layout |
| No active goal | Signed in, no goal | Invite the user to choose a pathway (onboarding) |
| Practice day | Pending task | The BP §09 hierarchy, with Start |
| Key session | `isKeySession` | Same, marked as the week's key session |
| Test day | `isTestDay` | Show the week's test (`RoadmapWeek.test`); result entry only if OD-1a approves |
| Rest day | `isRestDay` | Rest as part of the plan; a glance at tomorrow |
| Short on time | User opts in | `minimumVersion`, the 10-minute step |
| Done for today | Task completed | Quiet confirmation; the step lit; tomorrow previewed |
| Not completed yesterday | Previous task still pending | "Here's how we can recover", never "missed" |
| Review due | The week's days have passed | Lead into the weekly review |
| Review failed | Review returned 503 | "Your week wasn't changed", with retry |
| Final stretch | Days 85–90 (per OD-2) | Final test and approach to the destination |
| Completed goal | Per OD-1b | Hand off to Achievement |
| API offline | `apiStatus === 'offline'` | Clear status; nothing crashes; no writes attempted |
| Error | A request failed | ErrorState with retry |

- **B — A smaller set now** (loading, practice, rest, done, offline, error), with the rest added later.
  * Cons: leaves real states undesigned. The blueprint raised this decision specifically to prevent that.

**Recommendation.** **A.** Rows that depend on other decisions (test result entry, final stretch, completed goal) follow those decisions.

**Decision.** —

**Consequences.** Phase 5 milestone M5.7 covers every row. Validation documents how each state was produced.

**Related.** OD-1a, OD-1b, OD-2, OD-3.

---

### OD-10 — Meaning of "dark/light contrast"

**Decided** as D-3.

---

### OD-11 — Onboarding categories vs free presets

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | 3 |
| Raised | BP §28 and Open Decision 11 |
| Decided | 2026-09-23 — Mo, at the Phase 3 gate |

**Context.** BP §28 lists Career, Fitness, Learning, Creative, Business and Personal. There are 10 free presets. Phase 1's pathway section already groups them:

| Category | Presets |
|---|---|
| Creative | Guitar, YouTube channel, book |
| Fitness | 10K run, body recomposition |
| Learning | Spanish, chess |
| Business | SaaS app |
| Career | TED-style speech |
| Personal | Deep work |

Every category has at least one preset, but Business, Career and Personal have only one each.

A second category system exists in the code (found at the Phase 3 gate): each preset in `frontend/src/lib/certifiedPresets.ts` has a `category` field with four values — Tech & Career (SaaS, speech), Fitness & Health (10K, recomposition), Creative & Media (guitar, YouTube, book), Mastery & Mind (Spanish, deep work, chess). The in-app galleries (`Home.tsx`, `PathwaysExplorerModal.tsx`) use these four; the landing page hard-codes the six above in `marketing/sections/Pathways.tsx`.

**Question.** How does the onboarding category step map onto the presets?

**Options.**
- **A — The six categories, using the Phase 1 grouping.**
  * Pros: matches the blueprint and the landing page; consistent everywhere.
  * Cons: three one-item categories make a category tap feel like a formality there.
- **B — Merge thin categories** (for example "Career & Business", "Mind & Focus").
  * Pros: denser choices.
  * Cons: diverges from the blueprint and the landing page.
- **C — No category step.** A single pathway library with category labels or filters.
  * Pros: one step fewer; 10 items fit on one screen.
  * Cons: loses the "direction first" moment of BP §28.

**Recommendation.** **A**, with one refinement: if a category has a single pathway, choosing the category shows that pathway directly (plus the custom option, per ND-6). Revisit when the preset library grows.

**Decision.** **A — the six categories, using the Phase 1 grouping**, with the refinement: a category with a single pathway shows that pathway directly, alongside the custom option (ND-6). The four-value `category` field is superseded by the six.

**Consequences.** The category mapping lives in one shared data source, used by the landing page and onboarding (Phase 3 milestone M3.6). The landing page's hard-coded groups and the in-app galleries both read it, so the in-app galleries move from four categories to six. No landing copy changes. Preset ids and titles, and so preset matching, are unaffected.

**Related.** ND-5, ND-6, D-18.

---

### OD-12 — Semantic token names

**Decided** as D-5. The migration is ND-1.

---

# 4 — NEW DECISIONS RAISED BY THE ROADMAP

### ND-1 — Token migration strategy

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 0 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 0 |
| Decided | 2026-09-23 — Mo, at the Phase 0 gate |

**Context.** `frontend/src/index.css` has three overlapping vocabularies:
* the legacy mint tokens (`--color-canvas`, `--color-surface #0c1210`, `--color-surface-elevated`, `--color-accent-mint*`, …);
* the Phase 1 marketing tokens (`ink`, `panel`, `panel-raised`, `paper`, `fg`, `fg-secondary`, `fg-muted`, `accent`, `accent-bright`, `accent-deep`, `achievement`, `line`, `line-strong`), used under `components/marketing/`;
* the role names D-5 requires.

**Phase 0 kickoff measurement (2026-09-23):**
* The legacy colour tokens are **defined but used nowhere** in `frontend/src`. The legacy helper classes (`.surface-panel`, `.glass-panel`, `.gradient-text`, `.border-hairline*`) are also unused.
* The signed-in app styles itself with **1,109 hard-coded hex literals** instead.
* The marketing tokens have **162 utility usages**, all under `components/marketing/`.
* The legacy radius override (`--radius-xl/2xl/3xl: 0.375rem`) **does** affect **28 usages**: 26 in `OnboardingWizard.tsx`, 2 in `FocusSessionModal.tsx`.
* `font-mono` (JetBrains Mono) is used **212 times**. The app body uses `font-sans` (Plus Jakarta Sans) through the base styles.

The feared name collision is therefore theoretical: no screen reads the legacy `surface` token.

**Question.** How do the three reconcile, without visual regressions to unmigrated screens?

**Options.**
- **A — Role names become canonical; unused legacy tokens are deleted; marketing is renamed.**
  1. Delete the unused legacy colour tokens and unused helper classes. This is zero visual change, because nothing references them; verify with a search and a screen check.
  2. Define the role tokens with the D-4 values.
  3. Rename the 162 marketing usages to role names (for example `bg-ink` → `bg-background`, `text-fg-secondary` → `text-text-secondary`), with a before/after visual check of the landing page.
  4. Keep, for now, the things that still affect legacy screens: the base `body` colours and font, `font-mono`, and the radius override. They are removed when those screens migrate (radius in Phases 3 and 5) or in Phase 12.

  * Pros: one vocabulary immediately; no legacy screen changes; the rebrand becomes a one-file change.
  * Cons: a mechanical 162-usage diff in marketing files.
- **B — Role names canonical, marketing tokens kept as aliases.** The same as A, but `ink`, `panel` and so on stay defined as aliases of the role tokens instead of being renamed.
  * Pros: no marketing diff.
  * Cons: two names for every colour until someone removes the aliases; the rebrand is still one file, but the vocabulary is duplicated.
- **C — Keep the marketing tokens as their own layer**, and add role names only for the app.
  * Pros: no churn.
  * Cons: two vocabularies with different names for the same values; contradicts the spirit of D-5.

**Recommendation.** **A.** The measurement shows the migration is cheaper and safer than expected.

**Decision.** **A.** Role names are canonical. Unused legacy tokens and helper classes are deleted, and the marketing usages are renamed to role names. The radius override, base body styles and legacy fonts stay until their screens migrate.

**Consequences.** Phase 0 milestone M0.3 deletes the unused legacy tokens and classes and renames the marketing tokens. The radius override, base body styles and legacy fonts stay until their screens migrate.

**Implemented** 2026-09-23 (Phase 0, M0.3):
* The 173 marketing usages were renamed, with 0 computed-style differences across 665 landing-page elements.
* Mapping: `ink` → `background`, `panel` → `surface`, `panel-raised` → `surface-elevated`, `paper` → `surface-inverse`, `fg*` → `text*`, `accent-bright` → `accent-hover`, `accent-deep` → `accent-on-inverse`, `line*` → `border*`, `font-grotesk*` → `font-ui*`.
* Roles added beyond D-4, as Phase 0 scoped: `text-on-inverse #0B0B0A`, `border-strong`, `scrim`, and the status colours `caution #D9A05B` (the legacy amber's successor) and `danger #E0897A`. Both status colours exceed 6.5:1 on every dark surface; the full contrast table is in `Design.md` §2.2.
* After the Phase 0 review: `border-control` (`rgba(245,243,236,0.38)`, at least 3.28:1 on every dark surface) was added for form-control boundaries, because `border-strong` is only about 1.5:1. The focus-ring colour became one variable, `--focus-ring-color`, which `.on-inverse` switches.

**Related.** D-4, D-5.

---

### ND-2 — Primitive strategy

| Field | Value |
|---|---|
| Status | Decided |
| Category | Technology |
| Needed by | 0 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 0 |
| Decided | 2026-09-23 — Mo, at the Phase 0 gate |

**Context.**
* There are no shared app primitives, and about eight independent modal implementations exist.
* Dialogs and sheets need focus trapping, scroll lock, Escape to close and restored focus; hand-rolled versions are where accessibility usually breaks.
* The audit-phase instruction "Do NOT install shadcn/ui yet" applied only to the audit. VDS note 9 now allows shadcn/ui.

**Question.** How are primitives built?

**Options.**
- **A — Hand-built everything** on Tailwind 4 and the tokens.
  * Pros: no dependencies; full control.
  * Cons: accessible Dialog, Sheet, Select and Tabs are costly to get right and maintain.
- **B — Headless primitives for the hard parts; hand-built for the rest.**
  * Radix UI primitives (or an equivalent headless library) for Dialog, Sheet, Select, Tabs and Tooltip, styled entirely with Achivii tokens. Button, Input, Card, Badge and state components are hand-built.
  * Pros: proven accessibility where it's hardest; the visual language stays fully custom.
  * Cons: a few dependencies.
- **C — shadcn/ui**: its generated components, restyled.
  * Pros: fast start; a familiar structure.
  * Cons: brings its own conventions (`cva`, `cn`, its token names), which must be rewritten to the Achivii role tokens; risks a generic "shadcn look" (VDS §31).

**Recommendation.** **B.** It gets the accessibility benefit of shadcn/ui's foundations (Radix), without importing another design vocabulary. Each package is named and logged when it is added (D-8).

**Decision.** **B.** Radix headless primitives for the hard, stateful parts; everything else is hand-built. Everything is styled only with Achivii tokens. Radix packages are added only when a phase from 2 to 5 needs them.

**Consequences.** It decides the `components/ui/` structure and the Phase 0 milestones M0.6–M0.9. Later phases replace their modals with the shared Dialog and Sheet.

**Implemented** 2026-09-23 (Phase 0). Dialog/Sheet, Tabs and `Button asChild` use Radix; every other primitive is hand-built. The packages are listed under D-8. After the Phase 0 review, the hand-built `TextLink` was added (with `asChild` through Radix Slot).

**Related.** D-8, ND-3.

---

### ND-3 — Frontend verification tooling

| Field | Value |
|---|---|
| Status | Decided |
| Category | Technology |
| Needed by | 0, 2, 3 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 0 |
| Decided | 2026-09-23 — Mo, at the Phase 0 gate |

**Context.**
* The frontend has no linter and no test runner. Its only automated check is `tsc`.
* The backend uses Vitest (20 test files).
* The riskiest refactors ahead: onboarding payload identity (R-4, Phase 3), the auth handoff (R-16, Phase 2) and the dashboard decomposition (R-9 to R-11, Phase 5). Today they can only be verified by hand.

**Question.** Which verification tooling does the frontend get, and what is covered first?

**Options.**
- **A — Lint, unit/component tests and end-to-end smoke tests.**
  * ESLint (typescript-eslint, react-hooks).
  * Vitest with Testing Library, for primitives and the onboarding payload builder.
  * Playwright smoke tests for the critical flows:
    * pathway → signup → onboarding preselected;
    * onboarding → generation → Today;
    * complete a task → reload.
  * Pros: evidence for the must-not-break list; regression safety for Phases 2–5.
  * Cons: setup time; Playwright needs the backend and database running (a test database or seeded data).
- **B — Lint and Vitest only.**
  * Pros: quick; covers the payload builder.
  * Cons: auth and navigation regressions stay manual.
- **C — Nothing new.**
  * Pros: no setup.
  * Cons: every regression check stays manual for the whole redesign.

**Recommendation.** **A, introduced gradually.**
* ESLint and Vitest in Phase 0.
* The payload test at the start of Phase 3 (built from the M3.1 baseline).
* Playwright at the start of Phase 2, where the first route-level risk appears.

**Decision.** **A, introduced gradually.** ESLint and Vitest with Testing Library are added in Phase 0. Playwright smoke tests come at the start of Phase 2, and the onboarding payload test at the start of Phase 3.

**Consequences.** The validation baseline in `docs/phases.md` §3.11 and the system prompt gain the new commands once they exist.

**Implemented** 2026-09-23 (Phase 0). ESLint and Vitest are set up, and 41 component tests pass (22 at first delivery, 41 after the review fixes). The first full lint run found a baseline of 48 errors and 6 warnings in 14 pre-Phase-0 files, recorded in `docs/phases.md` §3.11. It includes a real `rules-of-hooks` violation in `RoadmapPage.tsx`, carried over to Phase 6. The Phase 3 part is still to come.

**Implemented** 2026-09-23 (Phase 2). Playwright with axe-core: `frontend/e2e/auth.spec.ts`, desktop 1440 and mobile 390 projects. Unlike the option text, the suite mocks the API (`e2e/mockApi.ts`, mirroring `backend/src/routes/auth.ts`) so it runs without a database; `e2e/live/` is reserved for real-backend specs run with `LIVE_API=1`, and is still empty (a Phase 3 carry-over).

**Implemented** 2026-09-23 (Phase 3, M3.1). Onboarding payload test: `frontend/e2e/onboarding.spec.ts` replays recorded clarify responses (`e2e/fixtures/onboarding/`) through `mockApi` and compares every `/api/goal/create` body and header with the recorded baseline, commitment ids normalised; a one-field change fails with a diff. `e2e/live/onboarding.live.spec.ts` runs the preset flow (exact match) and a custom flow (shape match, since AI questions vary) against the real backend with create held open. No package added.

**Related.** D-8, ND-2.

---

### ND-4 — Pathway handoff and redirects with auth routes

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 2 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 2 |
| Decided | 2026-09-23 — Mo, at the Phase 2 gate |

**Context.** D-19's handoff lives in `Home.tsx` component state and would be lost when navigating to `/signup`. `localStorage['achivii_draft_goal']` already exists for carrying a draft into onboarding.

**Question.** How does a chosen pathway survive the auth route? Where does the user land after auth?

**Options.**
- **A — URL parameter, persisted on success.**
  * Pathway CTAs link to `/signup?pathway=<preset id>`. The auth page shows the chosen pathway ("You're starting: Run a 10K").
  * After a successful signup or login, the same wait-for-goal logic from D-19 moves into a small shared hook.
  * Redirects:
    * no active goal → `/onboarding` with the preset (and `achivii_draft_goal` written);
    * active goal → Today, with a quiet note that a journey is already in progress;
    * `?next=` honoured only for internal paths.
  * Pros: survives reloads and new tabs; linkable; visible to the user.
  * Cons: needs a stable preset id (or slug) instead of the title.
- **B — localStorage only.** Write the pathway to `achivii_draft_goal` when chosen, and read it after auth.
  * Pros: minimal.
  * Cons: invisible state that can go stale (a pathway picked weeks ago resurfaces).
- **C — Router state only.**
  * Cons: lost on reload. Not recommended.

**Recommendation.** **A.** Retire the modal (OD-4 option A). Add preset slugs to the shared pathway data. Clear the parameter once it's consumed.

**Decision.** **A — URL parameter, persisted on success.** Pathway CTAs link to `/signup?pathway=<slug>`, and the auth screen names the chosen pathway. The modal is retired (OD-4 A), so there is no in-context modal. After auth:
* no active goal → `/onboarding` with the preset, as D-19 does today;
* an active goal → Today, with a quiet note if a pathway was chosen, and the existing goal is left alone;
* `?next=` is honoured only for internal paths (a single leading `/`, never `//` or a scheme).

The parameter is cleared once consumed. The slugs are the existing pathway `id`s in `certifiedPresets.ts` (confirmed by Mo at the Phase 2 kickoff, ND-12); preset matching (`findPresetForGoal`) is unchanged.

**Consequences.** Phase 2 milestone M2.4 is defined by this entry. Phase 3's pathway library uses the same slugs.

**Implemented** 2026-09-23 (Phase 2). `usePostAuthRedirect` and `resolvePostAuthDestination` (`frontend/src/lib/authFlow.ts`) apply the rules above; the in-memory handoff in `Home.tsx` is removed. A chosen pathway wins over `?next=`, and `?next=` pointing at an auth screen is ignored. The parameter is "cleared" by the `replace` navigation away from the auth screen.

**Related.** OD-4, D-19, ND-5.

---

### ND-5 — Pathway display copy

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | 3 |
| Raised | 2026-09-23 — Phase 1 report |
| Decided | 2026-09-23 — Mo, at the Phase 3 gate |

**Context.**
* Preset descriptions are dense with method jargon, such as "Helms nutrition deficit, 2.0g/kg protein, RIR hypertrophy & 48-hr refeeds" and "Woodpecker spaced repetition puzzles, Silman LPDO scans & CCT pause".
* They are credible to experts but opaque to the target user (BP §05).
* Server-side preset matching (`findPresetForGoal`) uses titles, so titles are functional keys.

**Question.** Should display copy be rewritten, and where does it live?

**Options.**
- **A — Separate display fields in the frontend presets data.**
  * Add plain-language display fields (for example `summary` and `method` lines) to `frontend/src/lib/certifiedPresets.ts`.
  * Keep titles and matching keys unchanged.
  * Show the method names as a secondary "Built on …" line on the pathway detail.
  * Pros: no backend change; credibility is kept but not front-loaded.
  * Cons: display data lives separately from backend presets.
- **B — Rewrite the display strings in the backend presets.**
  * Pros: one source.
  * Cons: a backend allowance; risks touching matching or plan content.
- **C — Keep the current copy.**
  * Cons: works against "simple by default, deep when explored" (BP §16).

**Recommendation.** **A.** Titles may be lightly polished only if the matching keys are preserved; otherwise leave them.

**Decision.** **A — separate display fields in the frontend presets data.** Plain-language display fields go into `frontend/src/lib/certifiedPresets.ts`; the method names become a secondary "Built on …" line. Titles stay unchanged: `findPresetForGoal` (`backend/src/lib/ai/presets/index.ts`) matches on id, title and regex patterns, and onboarding sends the title as `presetGoal`. No backend allowance.

**Consequences.** Phase 3 includes the copy pass. The landing page reads the same fields, so the Phase 1 jargon carry-over is resolved.

**Related.** OD-11, ND-4.

---

### ND-6 — Free custom-goal entry before Phase 10

| Field | Value |
|---|---|
| Status | Decided |
| Category | Product |
| Needed by | 3 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 3 |
| Decided | 2026-09-23 — Mo, at the Phase 3 gate |

**Context.** Custom goals are free and work today. The landing page presents Custom Journeys as future Premium (D-18) and says everything available today is free. Locking custom goals before server-side gating exists is forbidden (D-11), and would break R-2.

**Question.** How does onboarding present custom goals until Phase 10?

**Options.**
- **A — Keep it free and visible, but secondary.**
  * Pathways come first; a quieter "Something else in mind?" path leads to the existing custom flow.
  * No premium badge or lock.
  * Pros: no regression; consistent with "everything today is free".
  * Cons: once gating ships, some users will have had the feature free (grandfathering, ND-10).
- **B — Hide custom goals.**
  * Cons: removes a working feature (a regression of R-2 for custom goals); contradicts "do not remove working features".
- **C — Show it with a "Premium" label but keep it free.**
  * Cons: confusing and misleading.

**Recommendation.** **A.**

**Decision.** **A — free and visible, but secondary.** Pathways come first; a quieter "Something else in mind?" path leads to the existing custom flow, with no premium badge or lock.

**Consequences.** Phase 3 keeps the custom flow and its payload intact (R-2, R-4) and only changes where it sits in the flow. Gating waits for Phase 10's server-side entitlement (ND-10), including how goals created free are treated.

**Related.** D-18, ND-10, OD-11.

---

### ND-7 — Application shell and navigation

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Design |
| Needed by | 5 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 5 |
| Decided | — |

**Context.**
* BP §27 and VDS §14 sketch Today, Journey, Progress, Coach ✦ and Account. BP §45 does not commit to a sidebar yet.
* BP §23 forbids empty pages created for future features.
* `Navbar.tsx` and a simple footer wrap signed-in screens today.

**Question.** What form does navigation take on desktop and mobile, and which entries appear before their pages exist?

**Options.**
- **A — Restrained rail on desktop, bottom bar on mobile; entries appear only when their page exists.**
  * Desktop: a narrow left rail — Today, Journey, (Progress once Phase 8 ships), a divider, Coach ✦, Account.
  * Mobile: a bottom bar with 3–4 items; Account under a menu.
  * Coach ✦ appears as a labelled "Coming soon" item that opens a short information sheet, not a page. That is honest, and gives Coach its architectural place (BP §23).
  * Pros: follows VDS §14; minimal; honest.
  * Cons: the navigation changes as phases ship (expected).
- **B — Top bar on every size**, with the same entries.
  * Pros: closest to today.
  * Cons: competes with content on mobile; weaker thumb reach.
- **C — No persistent navigation.** Today links out contextually.
  * Pros: maximal focus.
  * Cons: Journey and Account become hard to find.

**Recommendation.** **A.** Show Coach ✦ only as an honest "Coming soon" item, or leave it out entirely until Phase 10. Mo's call.

**Decision.** —

**Consequences.** Phase 5 milestone M5.2. Phases 6, 8 and 10 each add their entry.

**Related.** OD-3, ND-8, ND-11.

---

### ND-8 — Progress: separate page or Journey layer

| Field | Value |
|---|---|
| Status | Proposed — depends on OD-1a |
| Category | Design |
| Needed by | 8 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 8 |
| Decided | — |

**Context.** BP §27 lists Progress as its own area, and VDS §26 gives it its own visual level. Its content depends on data: completion, milestones and adaptation insights exist today; results exist only if OD-1a is approved.

**Question.** Is Progress its own page, or a layer of the Journey view?

**Options.**
- **A — A separate page.** Only enough substance with test results (OD-1a option A).
- **B — A Journey layer** (a "Progress" view inside Journey).
  * Pros: avoids a thin page.
  * Cons: departs from the BP §27 navigation.

**Recommendation.** If OD-1a is **A**, choose a **separate page**; otherwise choose a **Journey layer**, promoted to a page later.

**Decision.** —

**Related.** OD-1a, ND-7.

---

### ND-9 — Payments in scope or not

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Product |
| Needed by | 10 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 10 |
| Decided | — |

**Context.** BP §20–22 define free and premium tiers. No payment system exists, and BP §43 forbids pretending one does. Payments bring provider choice, a billing model, webhooks, entitlement sync, tax and legal pages: a project, not a redesign task.

**Question.** Does this redesign include building payments?

**Options.**
- **A — No.** Phase 10 ships placement and honest copy only; payments become their own project after the redesign.
- **B — Yes.** Choose a provider and billing model now; Phase 10 includes a real checkout and entitlement sync.

**Recommendation.** **A.** Keep the redesign focused. Premium placement (Coach ✦, Custom Journeys) gives the architecture room without shipping anything fake.

**Decision.** —

**Consequences.** If A: OD-1c and ND-10 are effectively deferred, and custom goals stay free.

**Related.** OD-1c, ND-10, ND-11, D-17.

---

### ND-10 — Custom-goal gating

| Field | Value |
|---|---|
| Status | Proposed — depends on ND-9 |
| Category | Product |
| Needed by | 10 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 10 |
| Decided | — |

**Context.** BP §22 says custom goals are paid. Today they are free (D-18, ND-6). Gating needs a server-side entitlement (OD-1c) and a way to obtain it (ND-9).

**Question.** When does gating happen, how is it enforced, and what happens to existing custom goals?

**Options.**
- **A — Gate only when payments exist.**
  * Server-side check in `/create`.
  * Existing custom goals grandfathered: they keep working and can be completed.
  * The UI reflects the real availability.
- **B — Gate now, with no way to pay** (for example a waitlist).
  * Cons: removes a free feature for nothing; waitlist copy must be real.
- **C — Never gate; custom goals stay free.**
  * Cons: departs from BP §22's business model.

**Recommendation.** **A.**

**Decision.** —

**Related.** ND-9, OD-1c, ND-6.

---

### ND-11 — Coach scope

| Field | Value |
|---|---|
| Status | Proposed |
| Category | Product |
| Needed by | 10 |
| Raised | 2026-09-23 — `docs/phases.md` Phase 10 |
| Decided | — |

**Context.** BP §21 describes a future AI coach. No chat exists (BP §43). A real coach means a new backend capability (conversation storage, model access, safety, cost controls) and its own product design.

**Question.** What does Phase 10 deliver for Coach?

**Options.**
- **A — Architecture only.** Navigation placement and an honest "Coming soon" state (ND-7); marketing copy unchanged ("In development"). A waitlist only if it is backed by real storage.
- **B — A real Coach MVP.** A conversation UI and backend, with its own blueprint, allowances and evaluation.

**Recommendation.** **A** for the redesign. Treat a real Coach as its own project with its own blueprint.

**Decision.** —

**Related.** ND-7, ND-9, BP §21.

---

### ND-12 — Phase 2 frontend scope additions

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 2 |
| Raised | 2026-09-23 — Phase 2 kickoff (W2) |
| Decided | 2026-09-23 — Mo, at the kickoff review |

**Context.** The kickoff found two frontend files outside Phase 2's list that the auth screens depend on:
* `lib/api.ts` throws only the server's message, so the auth screens could tell duplicate email, wrong credentials, offline and server errors apart only by matching backend text.
* `GoalContext` treats a failed goal fetch as "no goal". A returning user with a goal whose fetch fails after sign-in would be sent to onboarding with `switchGoal`, which can replace their goal (R-15).

**Options.**
- **A — Allow both small frontend changes.** `api.ts` attaches the HTTP status to the errors it throws (the messages are unchanged). `GoalContext` exposes `goalLoadFailed`, and the post-auth redirect lands on Today instead of onboarding when it is set.
- **B — Keep both read-only.** Match error text, and log the failed-fetch risk as a carry-over.

**Decision.** **A.** No backend change, no change to request bodies, token logic or the `GoalContext` fetch itself. In the same review, Mo approved reusing the existing pathway `id`s (`run10k`, `saas`, …) as the ND-4 slugs, and adding `@playwright/test` (with Chromium) and `@axe-core/playwright` as Phase 2 dev dependencies (ND-3).

**Implemented** 2026-09-23 (Phase 2). `ApiError` (message plus `status`) in `lib/api.ts`, thrown by `signupUser` and `loginUser`; `goalLoadFailed` in `GoalContext`. A failed goal fetch after auth lands on Today. Today itself doesn't yet explain the failure; that error state is a Phase 5 carry-over.

**Related.** ND-3, ND-4, R-1, R-15, R-16.

---

### ND-13 — Onboarding step order around the clarify wait

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 3 (M3.5) |
| Raised | 2026-09-23 — Phase 3 kickoff (W2) |
| Decided | 2026-09-23 — Mo, after the M3.1 report |

**Context.** BP §28 asks for the questions before Schedule. The questions come from `/clarify`: instant for a preset (preset data), about 17 s of AI for a custom goal (measured in M3.1). Today the Schedule step covers that wait because clarify runs in the background while the user fills it in.

**Options.**
- **A — Spec order for presets; Schedule first for custom goals.** Custom goals do Schedule while clarify runs, then the questions. One step list in the progress indicator; custom only moves Schedule earlier.
- **B — Spec order for everyone,** with an honest loading screen of about 17 s before a custom goal's questions.
- **C — Today's order for everyone** (goal, schedule, questions, review).

**Decision.** **A.**

**Consequences.** M3.5 builds two orders from the same step components: preset = direction → category → pathway → starting point → success → schedule → review; custom = direction → custom goal → schedule → starting point → success → review. Browser history follows whichever order is active. If clarify is still running when a custom user finishes Schedule, the existing wait-then-advance behaviour applies, with the M3.7 loading state. The payload is unchanged.

**Related.** ND-14, R-4, R-18, BP §28.

---

### ND-14 — Grouping the clarify questions into "starting point" and "success"

| Field | Value |
|---|---|
| Status | Decided |
| Category | Design |
| Needed by | 3 (M3.5) |
| Raised | 2026-09-23 — Phase 3 kickoff (W2) |
| Decided | 2026-09-23 — Mo, after the M3.1 report |

**Context.** Custom goals always get `current_level`, `success`, `equipment`, `obstacle`. Presets get their own ids and count (10K: `baseline5k`, `environment`, `injury_history`), with no `success` question. The editable clarified outcome is already sent as `clarifiedOutcome`.

**Options.**
- **A — "Success" = the editable clarified outcome, plus the `success` question when there is one; every other question goes under "starting point".**
- **B — Split by position** (first half / second half).
- **C — One combined group,** dropping the separate "success" step.

**Decision.** **A.**

**Consequences.** Grouping is by question id, not position, so an unknown preset id always lands under "starting point". Every question is still asked once and in `/clarify` order within its group; `answers` and `answerList` keep the `/clarify` order, so the payload is unchanged (verified by the M3.1 test). The outcome edit moves from Review to the "success" step; Review still shows it.

**Related.** ND-13, R-4, BP §28–29.

---

### ND-15 — Scope of the single pathway library

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 3 (M3.6) |
| Raised | 2026-09-23 — Phase 3 kickoff (W2) |
| Decided | 2026-09-23 — Mo, after the M3.1 report |

**Context.** Phase 3's in-scope list says "one pathway library component used by onboarding"; its exit criterion says "only one pathway gallery implementation is used inside the app". There are five in-app galleries: the wizard's step-1 grid, the `Home` no-goal gallery, the `Home` six-card strip, the `ExecutionDashboard` six-card strip and `PathwaysExplorerModal`.

**Options.**
- **A — All five use one `PathwayLibrary`** (full and compact variants); the modal becomes a Dialog around it.
- **B — Onboarding and the modal only;** the strips wait for Phase 5 and the exit criterion is amended.
- **C — Onboarding only;** the exit criterion is amended.

**Decision.** **A.** The exit criterion stands as written.

**Consequences.** M3.6 touches `Home.tsx` and `ExecutionDashboard.tsx` (gallery markup only) in addition to the listed files. The modal uses the Phase 0 `Dialog` primitive, so the focus-ring clipping carry-over (first phase using Dialog) lands in M3.6. Every entry keeps its current launch state (`presetGoal`, `isPreset`, `switchGoal`, the draft key) so R-3, R-15 and R-16 are unchanged. The landing page keeps its own presentation and reads the same data (OD-11).

**Related.** OD-11, ND-5, R-3, R-15, R-16, BP §24, §39.

---

### ND-16 — Pre-existing onboarding bugs fixed in Phase 3

| Field | Value |
|---|---|
| Status | Decided |
| Category | Architecture |
| Needed by | 3 (M3.3) |
| Raised | 2026-09-23 — Phase 3 kickoff (W2); recorded in the M3.1 baseline |
| Decided | 2026-09-23 — Mo, after the M3.1 report |

**Context.** The M3.1 baseline recorded three defects: (a) forward into step 3 or 4 after a reload renders a blank page (`popstate` skips `canJumpToStep`, and the clarify result is gone); (b) `achivii_draft_goal` is never cleared after a preset launch; (c) a reload during switch goal redirects to `/dashboard`, because the wizard's `replaceState` drops React Router's `usr` state.

**Options.**
- **A — Fix (a) and (c) in M3.3; clear the draft key (b) only after a goal is created.**
- **B — Fix all three, clearing the draft key as soon as onboarding reads it.**
- **C — Fix none; log them for W9.**

**Decision.** **A.**

**Consequences.** M3.3 is "no visual change, payload identical" except for these recorded fixes: a history step that can't be shown falls back to the furthest reachable step, and the wizard's history entries keep the router's state so `ProtectedRoute` still admits a switch-goal reload. The draft key is removed after `/api/goal/create` succeeds, so a reload on a preset still stays on the preset. The M3.1 spec gains tests for all three, and the Phase 3 baseline table is updated as each fix lands.

**Implemented** 2026-09-23 (Phase 3, M3.3) in `frontend/src/components/onboarding/useOnboardingState.ts`. History writes spread `window.history.state` before adding `wizardStep`. The `popstate` handler walks down to the furthest step `canJumpToStep` allows and rewrites the entry. Mount rewrites the current entry to the step shown. The draft key is removed after a successful create, and never on read. The `popstate` listener is subscribed once and calls the latest logic through `useEffectEvent` (React 19.2): React Router re-renders synchronously inside the same `popstate` dispatch, so a listener re-subscribed on every render was skipped by the browser (found by a new preset back/forward test). With each fix reverted, its test fails.

**Reviewed** 2026-09-23 (M3.7 review, confirmed in M3.8). A pathway chosen inside onboarding does not write `achivii_draft_goal`. A reload there returns to the goal step, and custom answers live only on the page. That is the intended reading of this decision: the draft key belongs to launches from outside onboarding (landing, Home, the strips, the explorer, signup). It is confirmed behaviour, not a defect.

**Related.** R-15, R-16, R-18, M3.1 baseline.

---

### ND-17 — TED-style speech pathway matching

| Field | Value |
|---|---|
| Status | Decided (A) |
| Category | Product |
| Needed by | 4 |
| Raised | 2026-09-23 — Phase 4 kickoff (carried from M3.8) |
| Decided | 2026-09-23 — Mo, at Phase 4 M4.1 |

**Context.** Confirmed at the Phase 4 kickoff.
* `findPresetForGoal` (`backend/src/lib/ai/presets/index.ts`) matches id, exact title, then each preset's `matchingPatterns`.
* The frontend title is "Deliver a 15-Minute TED-Style Speech". The backend title on `ted_speech_15min` (`presets/speech.ts`) is "Deliver an Unforgettable 15-Minute TED-Style Speech". The speech patterns (`ted talk`, `give a speech`, and the rest) do not match `TED-Style`.
* Clarify therefore returns the custom four questions. Create uses the custom search label. The live create on 2026-09-23 saved a **v2 custom** goal (`isGoldenRail: false`, `planVersion: 2`) on `phase4-kickoff-ted-1790170753203@example.com`. v1 fallback cannot run for an unmatched goal.
* The dev database has one goal whose `rawGoal` is the frontend title, `isGoldenRail: false`, `planVersion: 2`. Zero goals use the backend title.
* The other seven frontend titles that differ from the backend title already match by pattern. M3.1 fixtures are 10K and sourdough, not TED. ND-5 keeps frontend titles, ids and slugs unchanged.

**Question.** Should this pathway match the backend preset, and how, without breaking ND-5?

**Options.**
- **A — Named backend matching allowance, matching only.** Add whatever is required in `findPresetForGoal` / the speech preset's `matchingPatterns` (or an alias) so the frontend title matches `ted_speech_15min`. No route, schema, API response or stream-shape change. ND-5 titles stay frozen. Existing goals are not rewritten. New TED runs get preset questions and can use the v1 fallback. Touches R-3 and R-5 for new TED creates (preset question ids, not the four custom ids). The M3.1 10K / sourdough fixtures stay as they are.
- **B — Change the frontend title to the backend title.** That supersedes ND-5 ("titles stay unchanged"). The existing TED goal would lose "Current pathway", because `findPathwayByTitle` is an exact frontend-title match.
- **C — Leave it.** Generation stays custom for this listed pathway.

**Recommendation.** **A.** It fixes matching without rewriting ND-5 identity or the stored goal.

**Decision.** **A — matching only.** The frontend title "Deliver a 15-Minute TED-Style Speech" must match `ted_speech_15min`. Frontend titles, ids and slugs stay as ND-5 left them. The other seven title-drift pathways are not changed.

**Consequences.** Phase 4's backend allowance expands from "stream labels only, if OD-8 needs it" to also this matching-only change in `findPresetForGoal` / the speech `matchingPatterns`. Nothing else: no routes, schemas, responses, ids or payload shape. Existing TED goals are not rewritten. M3.1 fixtures stay 10K / sourdough. ND-5 remains Decided (A).

**Implemented** 2026-09-23 (M4.2) in `backend/src/lib/ai/presets/speech.ts`. One pattern matches "Deliver a 15-Minute TED-Style Speech". `findPresetForGoal` itself was not edited. The backend title still matches by equality. No database rewrite.

**Related.** ND-5, OD-8, D-11, R-3, R-5.

---

# 5 — SUPERSEDED AND REJECTED

None yet.

---

# 6 — CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-23 | First version. Foundational decisions D-1 to D-19 recorded. OD-1 split into OD-1a/b/c. All open decisions from the blueprint and `docs/phases.md` entered with options and recommendations. |
| 2026-09-23 | Phase 0 gate: ND-1 → A, ND-2 → B, ND-3 → A (gradual), all Decided by Mo. D-7 (Geist) confirmed for the whole app. ND-1 context updated with the kickoff measurement. |
| 2026-09-23 | Phase 0 delivered. Implementation notes added to D-6, ND-1, ND-2 and ND-3. Packages added in Phase 0 logged under D-8. |
| 2026-09-23 | Phase 0 review fixes: `border-control` and `--focus-ring-color` noted under ND-1, `TextLink` under ND-2, test count updated under ND-3. |
| 2026-09-23 | OD-4 Decided (A, routes only; modal retired) and ND-4 Decided (A, URL parameter with slugs; redirect rules) at the Phase 2 gate. |
| 2026-09-23 | ND-12 Decided (A) at the Phase 2 kickoff review: `api.ts` error status, `GoalContext` `goalLoadFailed`, pathway ids as slugs, Playwright and axe. ND-4 wording updated for the slugs. |
| 2026-09-23 | Phase 2 closed. Implementation notes added to OD-4, ND-3, ND-4 and ND-12; Phase 2 packages logged under D-8. |
| 2026-09-23 | OD-11 → A (six categories, one shared source; the four-value `category` field superseded, context updated), ND-5 → A (frontend display fields, titles unchanged) and ND-6 → A (free, secondary custom entry), all Decided by Mo at the Phase 3 gate. |
| 2026-09-23 | Phase 3 M3.1: implementation note added to ND-3 (payload test and first live specs). |
| 2026-09-23 | ND-13 to ND-16 raised at the Phase 3 kickoff and Decided (all A) by Mo: custom goals do Schedule before the questions; "success" = clarified outcome plus the `success` question; one `PathwayLibrary` for all five in-app galleries; blank-step and switch-goal reload fixed in M3.3, draft key cleared after create. |
| 2026-09-23 | Phase 3 M3.3: implementation note added to ND-16. |
| 2026-09-23 | M3.7 review, recorded at M3.8. ND-16: a pathway chosen inside onboarding does not write the draft key (reviewed note above). The compact question header at 360 px is accepted. The Home gallery search box and four-category filter stay removed, and a strip tile opens the explorer on that pathway. OD-11, ND-5, ND-6 and ND-13 to ND-16 (all A) confirmed against what shipped. The index line now says Phase 4 is blocked by OD-8. OD-8 itself is not decided. |
| 2026-09-23 | Phase 3 closed (Mo accepted the phase report). OD-11, ND-5, ND-6, ND-13, ND-14, ND-15 and ND-16 confirmed Decided (all A). The index line now says Phase 3 is complete and Phase 4 is blocked by OD-8 and by any decision raised at the Phase 4 kickoff. No entry changed status. |
| 2026-09-23 | Phase 4 M4.1. OD-8 → A amended (four honest stages; v1 fallback has no pending method stage; stream labels unused) and ND-17 → A (matching-only so the frontend TED title hits `ted_speech_15min`), both Decided by Mo. D-11 consequences updated for that allowance. The index line now says Phase 4 is no longer blocked; M4.2 may start when Mo sends it. No other entry changed status. |
| 2026-09-23 | Phase 4 M4.2. ND-17 implemented: a speech matching pattern, recorded under that entry. No other decision changed status. |
