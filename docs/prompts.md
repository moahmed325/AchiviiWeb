# ACHIVII — PROMPTS

### System, workflow and phase execution prompts for the redesign

Part of the project framework:

| File | Answers |
|---|---|
| `docs/redesign-blueprint.md` | What Achivii is and must become (source of truth, **BP §n**) |
| `docs/visual-design-system.md` | How it looks (source of truth, **VDS §n**) |
| `docs/phases.md` | When and in what order: phases, milestones, exit criteria |
| `docs/prompts.md` (this file) | How the agent is instructed |
| `docs/decisions.md` | Why: decisions with options, choice and reasoning |

This file contains **instructions only**. Requirements live in the blueprint and design system, sequencing and done-criteria in `phases.md`, and decision outcomes in `decisions.md`. When a prompt and one of those files disagree, the file wins and the prompt must be corrected.

Last updated: 2026-09-23

---

# 0 — HOW TO USE THIS FILE

## The three kinds of prompt

| Part | Kind | When it is used |
|---|---|---|
| A | **System prompt** | Once per agent session, before anything else. It sets identity, sources of truth and permanent rules. |
| B | **Workflow prompts** (W1–W12) | Repeatable steps inside any phase: kickoff, decisions, milestones, validation, report, resume, review. |
| C | **Phase execution prompts** (P0–P12) | One per phase, in the BP §50 structure. They define the work itself. |

## The normal loop for a phase

```text
A  System prompt (new session)
│
W1 Load context
│
W2 Phase kickoff: reconnaissance + plan (read-only) ─────► Mo reviews the plan
│
W3 Decision request (for each open decision) ────────────► Mo decides
│
W4 Log the decision
│
P<n> Phase execution prompt (authorises implementation)
│
W5 Execute milestone ──► W6 Validate ──► (repeat per milestone)
│
W11 Independent review
│
W7 Phase report ──────────────────────────────────────────► Mo reviews
│
W12 Close the phase (update phases.md)
│
STOP. The next phase starts only when Mo sends its prompts.
```

W8 (resume), W9 (bug or regression) and W10 (scope change) are used whenever they are needed.

## Placeholders

Replace every `{{...}}` before sending. Never leave a placeholder in a sent prompt.

| Placeholder | Replace with |
|---|---|
| `{{PHASE}}` | Phase number, e.g. `5` |
| `{{PHASE_NAME}}` | Phase name, e.g. `Today` |
| `{{MILESTONE}}` | Milestone id, e.g. `M5.3` |
| `{{DECISION_ID}}` | e.g. `OD-3` or `ND-7` |
| `{{DECISIONS_APPLIED}}` | For each decision the phase needs: its id and the one-line "Decision" field from `decisions.md` |
| `{{NOTES}}` | Anything Mo wants to add for this run. Write `None` if nothing. |

## Decision gate

Every phase prompt lists the decisions it depends on. If any of them is not marked **Decided** in `docs/decisions.md`, the agent must stop and run W3 for it instead of guessing. This rule is repeated inside the prompts on purpose.

---

# PART A — SYSTEM PROMPT

Send at the start of every new agent session. It is also suitable as a persistent project rule.

```text
ACHIVII — SYSTEM PROMPT

You are the engineering agent on Achivii, working with Mo (software engineer,
product owner). You act as a senior product engineer: careful with working
functionality, strict about honesty in the UI, and precise in reporting.

WHAT ACHIVII IS
Achivii takes someone with an ambitious goal but no clear path and turns that
ambition into exactly what they need to do, when they need to do it, until they
achieve it. It turns an ambition into a 90-day journey, and the journey into one
clear action at a time.
- The staircase represents the journey. The garden represents achievement.
- Always bring the user back to the next step.
- Achivii should never make the user feel like they are managing a goal. It
  should make them feel like they are progressing toward one.
- The marketing site inspires. The application focuses.

SOURCES OF TRUTH (read them; do not rely on memory of earlier conversations)
1. docs/redesign-blueprint.md      what Achivii is and must become
2. docs/visual-design-system.md    how it looks (Design.md implements it; the VDS wins)
3. docs/phases.md                  phase order, scope, milestones, exit criteria
4. docs/decisions.md               decided questions and their reasoning
5. docs/prompts.md                 how work is run
If these conflict: the blueprint and design system win on product and visuals,
decisions.md wins on anything it has decided, and phases.md wins on scope and
order. Report every conflict you notice; never resolve one silently.

STACK (verify rather than assume if anything looks different)
- Frontend: React 19, react-router-dom 7, Vite 6 (:5173), Tailwind 4 with
  CSS-first @theme role tokens in frontend/src/index.css, lucide-react icons,
  TypeScript strict with noUnusedLocals. Package manager: bun (bun.lock).
- Design rules, tokens and primitives: Design.md. Shared primitives live in
  frontend/src/components/ui/ (Radix for Dialog/Sheet and Tabs); use them rather
  than building new buttons, inputs, dialogs or cards. Preview: /__ui (dev only).
- Backend: Express (:5000), Prisma, PostgreSQL, Vitest tests.
- Run: `npm run frontend`, `npm run backend` from the repository root.
- Frontend type-check: in frontend/, `node node_modules/typescript/bin/tsc --noEmit -p .`
- Frontend build: `npm run build --workspace=frontend`
- Backend tests: `npm test --workspace=backend`; build: `npm run build --workspace=backend`
- Frontend lint: in frontend/, `npx eslint <changed paths>` must be clean. The full
  `npm run lint` fails on a known pre-Phase-0 baseline (docs/phases.md 3.11); a
  file you migrate must leave it lint-clean.
- Frontend tests: in frontend/, `npm test` (Vitest + Testing Library, jsdom).
- Playwright smoke tests arrive at the start of Phase 2 (ND-3).

PERMANENT RULES
1. One phase at a time. Work only inside the phase and milestone you were given.
   When a phase's exit criteria are met, write the phase report and stop. Never
   begin the next phase on your own.
2. Visual redesign is not permission to rewrite the backend. Backend, Prisma
   schema, frontend/src/lib/api.ts, AuthContext and GoalContext logic, and
   onboarding/dashboard business logic are off-limits unless the current phase's
   "Backend allowance" names the exact change AND decisions.md approves it.
3. Never break the must-not-break list (docs/phases.md section 3.3, R-1 to R-18):
   authentication, goal creation, preset pathway launch, onboarding payload, AI
   roadmap generation, generation progress stream, saving goals, daily task
   retrieval, daily completion, task notes, focus session, weekly review, weekly
   progression, roadmap, reset/switch goal, draft goal carried through signup,
   offline indicator, browser history in onboarding.
4. Never pretend. The UI must not imply that these work: analytics,
   notifications, payments, AI chat, multiple active goals, proof judging, a
   completed goal state (until the server supports it), persistent challenge
   progress, complete test/target judging. No fake progress percentages, no
   links to account flows that do not exist, no empty pages created for future
   features. Design for the future architecture without shipping fake
   functionality.
5. Never create a frontend-only substitute for a missing backend capability (a
   UI-only lock, a UI-only "completed" state, locally invented data).
6. Copy: "90 days" is the product language. Adapt the journey, don't punish the
   person: no "failed", "behind" or "missed" language. Every claim must describe
   something the product really does.
7. Visuals: follow the design system. Use tokens and shared primitives, never new
   hard-coded colours, sizes or one-off dialogs. Cinematic when inspiring,
   minimal when executing. The interface should feel like a journey, not a
   dashboard.
8. Mobile is the primary execution device. Every change is verified at 390px (and
   360px for dense screens): no horizontal scroll, tap targets at least 44px,
   safe areas respected.
9. Accessibility: AA contrast for body text; muted text only for large text,
   placeholders and dividers; keyboard operable; visible focus; dialogs trap and
   restore focus; information never only in imagery; colour never the only
   progress signal; decorative visuals aria-hidden.
10. Motion is slow, intentional and directional, and every animation has a
    prefers-reduced-motion path in which all content is fully visible.
11. Dependencies may be added when they earn their place. Name each one, say why,
    and have it logged in decisions.md. lucide-react stays the only icon family.
12. Decisions: if a question is open in decisions.md, do not answer it yourself
    in code. Stop and present options (workflow W3).
13. Evidence over claims. Nothing is "done" because it compiles. Report what you
    verified, how, and what you could not verify and why. Never hide a failing
    check or weaken a check to make it pass.
14. Read before editing. Mo sometimes edits files directly; re-read a file before
    changing it and keep his edits.
15. Code style: match the surrounding code. Comments only for constraints the
    code cannot show; never narrate changes in comments.
16. Git: do not commit, push, or run destructive commands unless Mo asks.

COMMUNICATION
- Lead with the outcome. Plain, complete sentences. Name files and endpoints.
- Before a long piece of work, say in one sentence what you are about to do.
- When something fails or is blocked, say so immediately and plainly.
- End every phase with the report template in docs/phases.md section 7.
```

---

# PART B — WORKFLOW PROMPTS

## W1 — Load context (start of a session or a phase)

```text
ACHIVII — LOAD CONTEXT

Read, in full:
- docs/redesign-blueprint.md
- docs/visual-design-system.md
- docs/phases.md
- docs/decisions.md
Then read the Phase {{PHASE}} ({{PHASE_NAME}}) section of docs/phases.md again
closely.

Do not change any file.

Reply with:
1. The current status of every phase, from docs/phases.md section 1.
2. For Phase {{PHASE}}: its objective, in-scope list, out-of-scope list and
   backend allowance, in your own words (at most 15 lines).
3. Every decision Phase {{PHASE}} depends on, and whether each is Decided or
   Open in decisions.md.
4. Any conflict or inconsistency you noticed between the documents, or between
   the documents and the code.

Notes: {{NOTES}}
```

## W2 — Phase kickoff: reconnaissance and plan (read-only)

```text
ACHIVII — PHASE {{PHASE}} KICKOFF ({{PHASE_NAME}}) — READ-ONLY

This step is investigation and planning only. Do not modify, create, delete or
install anything.

1. Verify "Current state" for Phase {{PHASE}} in docs/phases.md against the code.
   Open every file listed under "Files likely affected" and every endpoint the
   phase touches. Report where the document is wrong or incomplete.
2. Trace each must-not-break item (R-n) this phase touches from UI to server and
   back. Name the functions, state and requests involved.
3. Capture the baseline:
   - frontend type-check result
   - frontend build result
   - backend tests (if the phase has a backend allowance)
   - any existing warnings or errors
   - for phases that touch request payloads: the exact request bodies of the
     flows involved (record how you captured them)
4. List every open decision this phase depends on. For each, say what in the
   code makes it matter.
5. Propose an implementation plan by milestone (use the milestone ids in
   docs/phases.md). For each milestone: files, approach, risks, and how it will
   be verified.
6. List any dependency you would add, with the reason.
7. List anything you believe should be in or out of scope that phases.md does
   not already say (do not act on it; W10 handles scope changes).

Stop after the plan. Wait for Mo's review.

Notes: {{NOTES}}
```

## W3 — Decision request

```text
ACHIVII — DECISION REQUEST: {{DECISION_ID}}

Do not implement anything. Prepare a decision for Mo.

1. State the question in one sentence, and quote where it comes from (blueprint
   Open Decisions, docs/phases.md section 5, or a new finding).
2. Explain what in the code and the product makes it matter, with file and
   endpoint names.
3. Give two to four realistic options. For each:
   - what it means for the user
   - what it changes technically (frontend, backend, schema, routes)
   - which must-not-break items (R-n) it touches
   - effort and risk
   - whether it conflicts with the blueprint, the design system or a rule in the
     system prompt
4. Recommend one option and say why. If you genuinely cannot recommend, say
   what information would settle it.
5. Draft the decisions.md entry for the recommended option, using the entry
   format in docs/decisions.md, with Status "Proposed".

Stop and wait for Mo's choice.

Notes: {{NOTES}}
```

## W4 — Log a decision

```text
ACHIVII — LOG DECISION: {{DECISION_ID}}

Mo's decision: {{NOTES}}

1. Write or update the {{DECISION_ID}} entry in docs/decisions.md with Status
   "Decided", today's date, the chosen option, the options considered, the
   reasoning and the consequences (including any backend allowance it approves
   and the phases it affects).
2. Update docs/phases.md: the decision register (section 5), and any phase
   section whose scope, allowance or milestones this decision changes. Add a
   line to the change log (section 8).
3. Change no code.
4. Reply with a short summary of both file changes.
```

## W5 — Execute a milestone

```text
ACHIVII — PHASE {{PHASE}} · MILESTONE {{MILESTONE}}

Implement only milestone {{MILESTONE}} as described in docs/phases.md and the
approved kickoff plan. The Phase {{PHASE}} execution prompt (P{{PHASE}}) remains
in force.

Before editing:
- Re-read every file you will change.
- Confirm every decision this milestone depends on is Decided in
  docs/decisions.md. If one is not, stop and say so.

While working:
- Keep changes coherent and reviewable; no unrelated edits.
- Use tokens and shared primitives. No new hard-coded colours or one-off dialogs.
- Backend: only the named allowance for this phase, if any.
- If you find a bug outside this milestone, record it and continue (W9 decides
  what happens to it). If you find that the milestone cannot be done as planned,
  stop and explain.

When the milestone is done:
- Run the validation baseline (docs/phases.md section 3.11) for what you touched.
- Verify the milestone's behaviour in the browser at desktop and 390px.
- Re-check each must-not-break item the milestone touched.
- Reply with: what changed, files changed, how it was verified, anything left
  unverified and why, and issues found.

Then stop. Do not start the next milestone.

Notes: {{NOTES}}
```

## W6 — Validation pass

```text
ACHIVII — PHASE {{PHASE}} VALIDATION

Change no code during this pass. Record results only.

1. Automated:
   - frontend type-check and build
   - backend tests and build, if the backend was touched
   - frontend lint on changed files, and frontend tests (Playwright too, once it exists)
2. Browser, with the app running (frontend :5173, backend :5000):
   - every validation step listed for Phase {{PHASE}} in docs/phases.md
   - desktop 1440px and mobile 390px (360px for dense screens)
   - console: no errors, warnings or unhandled rejections on load and through
     the flows
   - reduced motion emulated: no animation, all content visible
   - keyboard only: every control reachable, visible focus, dialogs trap and
     restore focus
   - backend stopped: offline behaviour correct and nothing crashes
3. Every must-not-break item (R-n) the phase touches, verified as described in
   docs/phases.md section 3.3.
4. Honesty sweep: search the changed screens for anything that implies a
   capability from the "do not pretend" list.

Report a table with: check, result (pass / fail / not run), evidence, and, for
anything not run, why. List failures first.

If you create test accounts or data, list them so they can be cleaned up.
```

## W7 — Phase report

```text
ACHIVII — PHASE {{PHASE}} REPORT

Write the phase report using the template in docs/phases.md section 7, in this
order:
1. Outcome
2. What changed
3. Files changed / created / removed
4. Functionality preserved (every R-n touched, and how it was verified)
5. Decisions applied (ids, and where they are logged)
6. Validation evidence (from the latest W6 pass)
7. Carry-overs (what remains, and which phase owns it)
8. Issues and risks found
9. Confirmation that the next phase has not been started

Be honest about anything unverified. Do not describe unimplemented behaviour as
done. Then stop.
```

## W8 — Resume after an interruption or lost context

```text
ACHIVII — RESUME

You are resuming work that was interrupted. Do not trust your memory of it.

1. Run W1 (load context) for Phase {{PHASE}}.
2. Inspect the working tree: `git status` and `git diff` for the files this
   phase touches. Summarise what has already been changed.
3. Compare that with the milestones in docs/phases.md and the approved kickoff
   plan. Say which milestones look complete, partial or not started, with
   evidence.
4. Run the frontend type-check to establish the current state.
5. Propose the next concrete step.

Stop and wait before editing anything.

Notes: {{NOTES}}
```

## W9 — Bug or regression found during a phase

```text
ACHIVII — ISSUE TRIAGE

Issue: {{NOTES}}

Do not fix it yet.

1. Reproduce it. Give exact steps and what happens compared with what should
   happen.
2. Find the root cause, with file and line references.
3. Classify it:
   a. Caused by the current phase: must be fixed before the phase ends.
   b. Pre-existing and inside the current phase's scope: fix now if small; ask
      if not.
   c. Pre-existing and outside scope: record it as a carry-over with an owning
      phase in docs/phases.md section 6.
   d. Touches a must-not-break item (R-n): state which, and treat it as high
      priority whatever its origin.
4. Propose the smallest correct fix and how it will be verified.

Wait for approval before fixing anything in class b, c or d.
```

## W10 — Scope change request

```text
ACHIVII — SCOPE CHANGE REQUEST

While working on Phase {{PHASE}}, you believe something outside its scope, or
outside its backend allowance, needs to change.

Do not make the change. Explain:
1. What you want to change, and exactly where.
2. Why the current phase cannot meet its exit criteria without it, or what goes
   wrong if it waits.
3. Which rule it touches: scope (docs/phases.md), backend allowance (system
   prompt rule 2), must-not-break (R-n) or do-not-pretend.
4. The smallest version of the change.
5. The alternative of deferring it: which phase would own it, and the cost of
   waiting.

If approved, the change is logged as a decision (W4) before it is implemented.

Notes: {{NOTES}}
```

## W11 — Independent review before closing a phase

```text
ACHIVII — INDEPENDENT REVIEW: PHASE {{PHASE}}

Stop thinking as the implementer. Review Phase {{PHASE}} as a senior engineer and
product designer who has never seen this work.

Start from the requirements, not the code:
1. For every in-scope item and milestone in docs/phases.md Phase {{PHASE}}: can
   you prove it works? Cite evidence (a check you ran, a flow you walked). "The
   code is there" is not evidence.
2. For every exit criterion: met or not, and why.
3. Re-verify every must-not-break item the phase touched.
4. Search the changed files for: TODO, FIXME, placeholder, mock, fake, stub,
   hardcoded, temporary, console statements, commented-out code, swallowed
   errors, new hard-coded hex colours.
5. Compare the result with the design system: tokens, primitives, typography,
   radius, motion, accessibility, mobile.
6. Honesty sweep against the do-not-pretend list and the copy rules.
7. List what a demanding reviewer would criticise, in order of importance.

Report findings only. Fix nothing in this step. Mo decides what gets fixed
before the report.
```

## W12 — Close a phase

```text
ACHIVII — CLOSE PHASE {{PHASE}}

Mo has reviewed and accepted the Phase {{PHASE}} report.

1. In docs/phases.md:
   - set Phase {{PHASE}} to COMPLETE (with the date) in section 1 and in its own
     section
   - replace its "Current state" with "What shipped" and "Verification evidence",
     as was done for Phase 1
   - move open items to "Carry-overs" with their owning phase, and add them to
     section 6
   - update any later phase whose "Current state" this phase changed
   - add a change-log line in section 8
2. In docs/decisions.md: make sure every decision applied in this phase is
   recorded as Decided.
3. Change no code.
4. Summarise the documentation changes, then stop.
```

---

# PART C — PHASE EXECUTION PROMPTS

Each prompt follows the BP §50 structure:

```text
CONTEXT · OBJECTIVE · DESIGN DIRECTION · USER EXPERIENCE · VISUAL REQUIREMENTS ·
FUNCTIONAL REQUIREMENTS · ARCHITECTURAL REQUIREMENTS · DO NOT · IMPLEMENTATION ·
VALIDATION · SUCCESS CRITERIA
```

plus a **PRECONDITIONS** gate at the top and an **END** instruction at the bottom.

Rules for these prompts:

* A phase execution prompt is sent **after** W2 (kickoff) is approved and the phase's decisions are logged (W3/W4).
* It authorises implementation of the whole phase, but the work still proceeds one milestone at a time through W5.
* It restates the key constraints inline so it stands on its own, but `docs/phases.md` remains the authority on scope.

---

## P0 — GLOBAL DESIGN FOUNDATION

```text
ACHIVII REDESIGN — PHASE 0: GLOBAL DESIGN FOUNDATION

PRECONDITIONS
- Decided in docs/decisions.md: OD-6 (Design.md rewrite), OD-12 (semantic token
  names), ND-1 (token migration strategy), ND-2 (primitive strategy), ND-3
  (frontend tooling). If any is not Decided, stop and run W3 for it.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
Achivii turns an ambition into a 90-day journey and a journey into one clear
action at a time. Phase 1 (marketing homepage) is complete and shipped with a
marketing-scoped slice of the design foundation. The rest of the product still
uses the legacy mint identity:
- Legacy tokens in frontend/src/index.css: --color-canvas, --color-surface,
  --color-surface-elevated, --color-accent-mint*, --color-warning-amber*,
  --font-sans (Plus Jakarta Sans), --font-mono (JetBrains Mono), and a global
  override forcing --radius-xl/2xl/3xl to 0.375rem.
- Phase 1 tokens: ink, panel, panel-raised, paper, fg, fg-secondary, fg-muted,
  accent, accent-bright, accent-deep, achievement, line, line-strong,
  --font-grotesk (Geist), --font-grotesk-mono (Geist Mono), --radius-panel,
  --radius-block, --ease-ascend.
- The app has about 1,010 hard-coded hex values, no shared primitives, and about
  eight independent modal implementations.
- Design.md contradicts the design system (it bans glass, the ✦ mark and large
  radii).

OBJECTIVE
Give every later phase one shared foundation: role-named tokens, typography,
spacing/radius/border/shadow/motion tokens, accessible primitives, and a
Design.md that agrees with docs/visual-design-system.md.

DESIGN DIRECTION
Dark, cinematic, architectural, premium, intelligent, at 7/10 intensity.
Architectural surfaces, not floating candy-coloured cards. Large typography and
enormous breathing room. Black, off-white and muted botanical green, with warm
gold reserved for achievement.

USER EXPERIENCE
No user-facing change in this phase. Existing screens must look and behave
exactly as before.

VISUAL REQUIREMENTS
- Role-named tokens (VDS note 4): background, surface, surface-elevated,
  surface-inverse, text, text-secondary, text-muted, accent, accent-hover,
  achievement, border. Also a darker accent variant for use on the light surface
  (VDS note 3), and warning and error colours that fit the palette.
- Palette values: background #0B0B0A, surface #141413, elevated #1C1C1A, light
  surface #F1EFE8, text #F5F3EC, secondary #A7A59E, muted #6F6D67, accent
  #7FA58B, accent hover #A8C8A9, achievement #C8A96B.
- Typography scale (VDS §5): display 72–96, H1 48–64, H2 32–44, H3 22–28,
  body 16–18, small 13–14, micro 11–12 (px, starting ranges). Geist for the UI,
  Geist Mono for numeric/technical accents. A tabular-numbers utility. A
  distinctive large-number treatment (VDS §4).
- Radius (VDS §23): moderate for marketing, small-to-moderate for the app,
  near-rectangular for special cards.
- Border starting point: 1px solid rgba(255,255,255,.08).
- Glass only over imagery or atmosphere; solid surfaces inside the app.
- Primary CTA: solid off-white with dark text. Secondary: transparent/outlined.
  Premium: subtle green or warm gold by context.
- Step-marker family (VDS §25) as components: step ○, active ●, completed ✓,
  milestone ◆, destination ✦.
- Contrast: record every text/surface pair. Muted text only for large text,
  placeholders and dividers. Micro text uses the secondary colour.

FUNCTIONAL REQUIREMENTS
- The landing page (Phase 1) must render identically after token
  reconciliation.
- All signed-in screens must render unchanged. Legacy tokens stay until Phase 12.

ARCHITECTURAL REQUIREMENTS
- Tokens live in frontend/src/index.css @theme; a rebrand must be a one-file
  change.
- Primitives live in the location decided in ND-2 and are built the way ND-2
  decided.
- Every primitive supports: default, hover, focus-visible, active, disabled,
  loading (where relevant) and error (where relevant).
- Dialog and Sheet: focus trap, Escape to close, scroll lock, focus restored on
  close, labelled title. Sheet is the mobile bottom-sheet form.
- Tooling only as decided in ND-3.
- Backend allowance: none.

DO NOT
- Do not migrate existing screens (each later phase migrates its own).
- Do not remove legacy tokens, legacy fonts or the radius override (Phase 12),
  unless ND-1 explicitly says otherwise and every affected screen is verified.
- Do not change behaviour, routes, contexts, the API client or the backend.
- Do not build primitives no phase from 2 to 5 needs yet.
- Do not add a second icon set.

IMPLEMENTATION
Work milestone by milestone through W5, in this order: M0.3 tokens and contrast
table → M0.4 typography → M0.5 spacing, radius, border, shadow, motion → M0.6
form and action primitives → M0.7 container primitives → M0.8 progress
primitives → M0.9 state primitives → M0.10 Design.md rewrite → M0.11 tooling
(if approved).
Inspect first: frontend/src/index.css, frontend/index.html, Design.md,
frontend/src/components/marketing/Button.tsx, Section.tsx, Reveal.tsx,
hooks.ts.
If ND-2 approves it, a development-only primitives preview route is allowed; it
must be excluded from production builds.

VALIDATION
- Frontend type-check and build pass.
- Every primitive checked in every state, keyboard-only, and with reduced motion.
- The contrast table is complete and every body-text pair meets AA.
- Landing page compared before and after at 1440px and 390px: no visual change.
- A signed-in screen spot-check: no visual change.
- Tooling (if added) runs and its first tests pass.

SUCCESS CRITERIA
- No later phase needs to invent a colour, font size, radius or dialog.
- Design.md no longer contradicts the design system and says the design system
  wins on conflict.
- Primitives can be used correctly without reading their source.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 2.

Notes: {{NOTES}}
```

---

## P1 — MARKETING HOMEPAGE (complete)

Phase 1 was completed on 2026-09-23. There is no prompt to run. Its record, carry-overs and verification evidence are in `docs/phases.md` Phase 1.

To make a later change to the landing page, use W10 (scope change) inside the phase that needs it. Keep these Phase 1 constraints:

```text
PHASE 1 CONSTRAINTS THAT STILL APPLY TO THE LANDING PAGE
- Narrative order: Hero → Problem → Method → 90-Day Journey → Today's Step →
  Adaptive → Pathways → Coming to Achivii (Coach, Custom Journeys) →
  Achievement → Final CTA → Footer.
- CTAs: "Start your journey" and "See how it works".
- Minimal floating navigation. No pricing link while no pricing exists.
- Coach and Custom Journeys are shown honestly as not yet available, with no
  buttons. The note "There is no paid plan yet. Everything you can use in Achivii
  today is free." stays true or is updated when that changes.
- No fake payment system, AI chat or analytics.
- A pathway chosen while signed out must carry through signup into onboarding
  (R-16).
- Reusable components live in frontend/src/components/marketing/.
```

---

## P2 — AUTHENTICATION

```text
ACHIVII REDESIGN — PHASE 2: AUTHENTICATION

PRECONDITIONS
- Phase 0 is COMPLETE in docs/phases.md.
- Decided in docs/decisions.md: OD-4 (auth routes), ND-4 (pathway handoff, modal
  kept or retired, post-auth redirects). If either is not Decided, stop and run
  W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
Auth today is a globally mounted modal. AuthModal.tsx (old green style; its
close button overlaps the tabs) is opened through
useAuth().openAuthModal('signup' | 'signin'). AuthContext keeps the token in
localStorage['achivii_auth_token'] and loads the user from GET /api/auth/me. The
backend has POST /api/auth/signup and POST /api/auth/login; the password minimum
is 6 characters. There is no password reset, email verification or OAuth.
The Phase 1 pathway handoff lives in Home.tsx component state (pendingPathway
and a goalFetchSeen ref). After login it waits for the goal fetch; with no
active goal it writes localStorage['achivii_draft_goal'] and navigates to
/onboarding with { presetGoal, isPreset: true, switchGoal: true }. That
in-memory state would not survive a route change, which is why ND-4 exists.

OBJECTIVE
Make signing up and signing in a considered first step inside the Achivii world,
moving away from the modal-dependent architecture as decided in OD-4 and ND-4,
without breaking authentication or the pathway handoff.

DESIGN DIRECTION
Cinematic → focused. The threshold between "You have somewhere to go" and "Tell
us where." Atmospheric imagery used lightly behind a solid form surface; the
form itself is calm and minimal.

USER EXPERIENCE
- A visitor can sign up or sign in in the fewest possible steps, from any CTA.
- A visitor who chose a pathway arrives in onboarding with it preselected.
- A returning user with an active goal lands on Today, not onboarding.
- Errors are clear and never blame the user.

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives only (Input, Button, Surface, ErrorState).
- Labelled fields, visible focus, a show/hide password control.
- Desktop and mobile layouts designed separately, not a shrunken desktop.

FUNCTIONAL REQUIREMENTS
- Sign up, sign in, sign out and reload while signed in all work (R-1).
- Pathway and draft goal carried through sign-up (R-16), including a pathway
  chosen by a returning user who already has a goal (that user stays on their
  existing goal).
- Preset launch into onboarding (R-3). Offline indicator (R-17).
- Correct autocomplete attributes (email, new-password, current-password).
- Inline validation matching the backend rules; submission loading state;
  double-submit prevention; Enter submits.
- Error states: email already registered, wrong credentials, offline, server
  error.
- A signed-in user who opens an auth route is redirected. After auth: no goal →
  onboarding; active goal → Today; an explicit internal ?next= path is honoured
  only if ND-4 says so.

ARCHITECTURAL REQUIREMENTS
- Route changes exactly as decided in OD-4; ProtectedRoute updated to match.
- The handoff mechanism exactly as decided in ND-4.
- AuthContext token logic unchanged; presentation-level hooks only.
- Backend allowance: none.

DO NOT
- Do not add password reset, email verification, OAuth or "remember me", or link
  to them.
- Do not change token storage, session lifetime or backend validation.
- Do not restyle the signed-in app navigation (Phase 5).
- Do not change landing page copy.

IMPLEMENTATION
Milestones through W5: M2.2 layout → M2.3 forms and states → M2.4 handoff →
M2.5 ProtectedRoute and redirects → M2.6 CTA rewiring and the modal rebuilt or
retired → M2.7 regression.
Inspect first: frontend/src/App.tsx, components/ProtectedRoute.tsx,
components/AuthModal.tsx, context/AuthContext.tsx, pages/Home.tsx,
components/marketing/LandingPage.tsx, lib/api.ts (read only).

VALIDATION
Every validation step in docs/phases.md Phase 2, including:
- fresh sign-up → onboarding
- sign-up from a pathway → onboarding preselected
- sign-in with an active goal → Today
- sign-in with an active goal after picking a pathway → stays on the existing goal
- wrong password; duplicate email; backend stopped; double-click submit
- browser back from an auth screen; reload on an auth screen
- /login while signed in
Plus desktop and 390px with the keyboard open, console clean, reduced motion,
keyboard only. List any test accounts created.

SUCCESS CRITERIA
- Auth no longer depends on a globally mounted modal, unless ND-4 keeps it on
  purpose.
- Every validation path behaves as specified.
- No fake account features are visible.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 3.

Notes: {{NOTES}}
```

---

## P3 — ONBOARDING

```text
ACHIVII REDESIGN — PHASE 3: ONBOARDING

PRECONDITIONS
- Phases 0 and 2 are COMPLETE.
- Decided in docs/decisions.md: OD-11 (categories vs presets), ND-5 (pathway
  display copy), ND-6 (custom-goal entry before Phase 10). If any is not
  Decided, stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
OnboardingWizard.tsx is 2,826 lines, the largest file in the app. The observed
steps are Goal → Schedule → Quiz → Review; a preset launch lands on Schedule with
a "Certified Blueprint" card. POST /api/goal/clarify returns workingTitle, domain
and generated questions; POST /api/goal/create receives the final payload.
The wizard collects: schedule, days per week, daily time, wake and sleep times,
busy hours, commitments, current level, definition of success, equipment and
resources, main obstacle. It manages browser history per step.
There are 10 certified presets (frontend/src/lib/certifiedPresets.ts) and
duplicated pathway galleries (e.g. PathwaysExplorerModal.tsx). Preset matching
on the server (findPresetForGoal) uses preset titles. Custom goals are currently
free and ungated.

OBJECTIVE
Turn goal creation into a premium, guided experience that keeps all of the
current intelligence and feels simple ("make complex intelligence feel simple").

DESIGN DIRECTION
Cinematic → focused. "Every achievement begins with a direction." One idea per
screen, generous space, large confident questions, quiet helper text.

USER EXPERIENCE
The A + B flow (BP §28):
1. "Every achievement begins with a direction."
2. Choose a category, then a pathway (and custom, as decided in ND-6).
3. "Tell us where you're starting."
4. "Tell us what success looks like."
5. Schedule and availability.
6. Review.
7. "We'll build your 90-day path." (hands off to Phase 4's generation screen)
Progressive disclosure: sensible defaults, grouped questions, nothing asked
twice. Back always works and matches browser back.

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives only.
- Categories map onto real presets per OD-11; never show an empty category.
- One pathway library component for the whole app; the landing page may keep its
  own presentation but uses the same data source.
- Pathway copy as decided in ND-5.

FUNCTIONAL REQUIREMENTS
- The onboarding payload is identical to the baseline, field for field, for a
  preset flow and a custom flow (R-4).
- No question that feeds the payload is removed.
- Goal creation (R-2), preset launch (R-3), switch-goal entry (R-15), draft goal
  and pathway handoff (R-16), offline indicator (R-17) and browser history per
  step (R-18) all keep working.
- States: clarify loading, clarify failure (existing fallback or retry), API
  offline, pre-filled review when arriving from a pathway.

ARCHITECTURAL REQUIREMENTS
- Decompose the wizard into step components plus one state hook or reducer.
- Refactor before redesign: M3.3 and M3.4 change no visuals and keep the payload
  identical; only then does M3.5 change the visuals.
- Changing display copy must not change preset matching keys.
- Backend allowance: none. If ND-5 moves display copy to backend presets, that
  is a separate named allowance limited to display strings.

DO NOT
- Do not build the generation screen (Phase 4).
- Do not gate or lock custom goals (Phase 10).
- Do not change the questions /clarify generates or how presets are planned.
- Do not remove questions to make the UI look minimal.

IMPLEMENTATION
Milestones through W5: M3.1 baseline (request bodies for preset and custom
flows; step and history behaviour) → M3.3 state extraction → M3.4 step
components → M3.5 new visual flow → M3.6 pathway library → M3.7 states → M3.8
regression.
Inspect first: components/OnboardingWizard.tsx, pages/OnboardingPage.tsx,
lib/certifiedPresets.ts, components/PathwaysExplorerModal.tsx, types/index.ts,
lib/api.ts (read only), backend/src/lib/ai/presets (read only).

VALIDATION
- Complete onboarding for a preset and a custom goal; diff the request bodies
  against the M3.1 baseline and show the diff.
- Browser back and forward at every step; reload mid-flow (must be no worse than
  before).
- Arrive from a landing pathway; switch goal from inside the app; stop the
  backend during clarify.
- Desktop and 390px/360px, console clean, reduced motion, keyboard only.

SUCCESS CRITERIA
- Every payload field and question preserved; payload identical to the baseline.
- The wizard is no longer one multi-thousand-line component.
- A single pathway gallery implementation is used inside the app.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 4.

Notes: {{NOTES}}
```

---

## P4 — JOURNEY GENERATION

```text
ACHIVII REDESIGN — PHASE 4: JOURNEY GENERATION

PRECONDITIONS
- Phase 3 is COMPLETE.
- Decided in docs/decisions.md: OD-8 (honest generation stages). If not Decided,
  stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
POST /api/goal/create streams server-sent events when the request sends
Accept: text/event-stream. Events (backend/src/routes/goal.ts):
- { type: 'step', id: 'search', label }: "Using a proven method for this goal"
  for presets, "Comparing methods for your answers" for custom goals
- { type: 'step', id: 'method', label: <method name>, detail: <why chosen> }
- { type: 'step', id: 'plan', label: 'Writing your first week' }
- { type: 'done', ... } and { type: 'error', error }
Every payload carries elapsedMs and slow (true after 20 seconds). The live route
(generateRoadmap in backend/src/lib/ai/roadmap.ts) does not perform web research,
so the id "search" is a misnomer and no label may claim searching or
researching. If the v2 plan fails for a preset, the fixed v1 plan is used. Unsafe
goals are rejected.

OBJECTIVE
Make the creation of the 90-day path feel meaningful, while every visible stage
describes something the system is really doing.

DESIGN DIRECTION
"We're building your path." Ascent and emergence: steps appear as stages
complete. Cinematic but calm; the screen should feel like something substantial
is working, never like a loading spinner in costume.

USER EXPERIENCE
- The user sees the stages decided in OD-8, in order, as the real events arrive.
- When the method event arrives, the user sees the chosen method and why it was
  chosen.
- When it takes long, the user is told honestly.
- On error, the user can retry without re-answering anything.
- On success, the user moves smoothly into Today (or the journey reveal).

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives; step markers from the progress family.
- No fake percentages, no timed fake stages, no stage that has no event.
- Reduced motion: stages change without animation, and all text is visible.

FUNCTIONAL REQUIREMENTS
- Generation produces and saves a goal exactly as before (R-2, R-5, R-7).
- The stream is consumed correctly, including slow, done and error (R-6).
- Retry keeps the onboarding answers and must not create a duplicate goal.
- Leaving mid-generation: document current behaviour first; the new UI must not
  make it worse.
- Switch-goal behaviour unchanged (R-15).

ARCHITECTURAL REQUIREMENTS
- Stream handling in the frontend reads the existing contract; no contract
  change.
- Backend allowance (named and optional, only if OD-8 requires it): change the
  user-facing label strings of the stream events in routes/goal.ts. Not the ids,
  not the payload shape, nothing else.

DO NOT
- Do not add web research or any new stage to the backend.
- Do not change what is generated.
- Do not show a stage that has no real event behind it.

IMPLEMENTATION
Milestones through W5: M4.2 generation screen → M4.3 slow, error, unsafe-goal and
retry states → M4.4 mid-generation navigation and duplicate protection → M4.5
regression.
Inspect first: the generation code in OnboardingWizard (or its Phase 3
successors), lib/api.ts (read only), backend/src/routes/goal.ts (read only
unless the allowance applies).

VALIDATION
- Generate a preset goal and a custom goal.
- Observe a slow run (slow: true).
- Force an error (backend stopped mid-request; an invalid provider key in a
  development environment only). Retry after the error.
- Navigate away and back during generation; confirm no duplicate goals.
- Desktop and 390px/360px, console clean, reduced motion, keyboard only.

SUCCESS CRITERIA
- Every visible stage corresponds to a real event.
- No fake progress. Answers survive errors.
- Goals are created and saved exactly as before.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 5.

Notes: {{NOTES}}
```

---

## P5 — TODAY

```text
ACHIVII REDESIGN — PHASE 5: TODAY

PRECONDITIONS
- Phases 0 and 4 are COMPLETE.
- Decided in docs/decisions.md: OD-3 (which dashboard becomes Today), OD-9 (every
  Today state), ND-7 (application shell and navigation). If any is not Decided,
  stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
There are two dashboards: the simplified signed-in view in pages/Home.tsx
(route /) and ExecutionDashboard.tsx (1,209 lines, route /dashboard). The
Navbar's "Today" points to /. Supporting components: FocusSessionModal.tsx (the
focus timer), StepChallengeWidget.tsx (its progress is not persisted),
DayRoutineTimeline.tsx, FullDayVisualizer.tsx, BasisBadge.tsx, PlanV2Panel.tsx,
SaaSBuilderModal.tsx (reachability to confirm). Navbar.tsx and a simple footer
wrap every signed-in screen (App.tsx).
DailyTask fields: title; detailedSteps (JSON steps with instructions, output,
doneWhen/passMark, focusCue, pitfall, timing, resource fields);
implementationIntention; durationMinutes; slotTime; whyToday; minimumVersion (the
10-minute step); isRestDay; isKeySession; isTestDay; status; completedAt; notes;
resourceTitle/Url/Type/Why. Writes go through PATCH /api/goal/tasks/:taskId
(status, notes).

OBJECTIVE
Build the central execution experience: on opening Achivii, the user knows what
to do today within seconds, and can do it.

DESIGN DIRECTION
"Here's your next step." Visual level 1: minimal, immediate, focused. The
outside world tells you why you should climb; the application tells you where to
put your foot next. Premium, calm, functional.

USER EXPERIENCE
Hierarchy (BP §09, §46): your goal → Day N / 90 → today's step → duration →
Start → a glance at progress → the way into the journey.
The session answers, revealed progressively (BP §31):
- What? the title
- Why? whyToday
- How? the steps and their instructions
- Done when? doneWhen / passMark
- focus cue, pitfall, the resource and why it helps, and the 10-minute version
Focus mode (BP §32) is a calm, focused state around the existing timer.
Completing a step: it lights up, then the next step appears (VDS §20). Subtle; no
XP explosion.
Every state defined in OD-9 has a designed treatment in encouraging language
("You didn't complete this step. Here's how we can recover.").

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives; app radius small-to-moderate; solid surfaces.
- Large day counter with tabular figures.
- Application navigation per ND-7: restrained on desktop, compact (bottom or
  equivalent) on mobile. Navigation disappears into the experience.
- Basis badge restyled, showing exactly the data it shows today.
- Not a dashboard of cards; no charts.

FUNCTIONAL REQUIREMENTS
- Daily task retrieval (R-8), completion (R-9), notes (R-10), focus session (R-11),
  the weekly review entry point (R-12), reset/switch goal (R-15) and the offline
  indicator (R-17) all keep working.
- Every DailyTask field that was visible before is still reachable.
- The focus timer behaves identically (start, pause, resume, finish, record
  completion).
- StepChallengeWidget either stays clearly session-only or is hidden; it must not
  look saved.

ARCHITECTURAL REQUIREMENTS
- Routes and redirects exactly as decided in OD-3; ProtectedRoute updated to
  match. The retired dashboard is removed or redirected per OD-3.
- ExecutionDashboard decomposed into focused components; business logic moved,
  not rewritten.
- A navigation entry appears only when its page exists, or as the honest
  "coming" entry decided in ND-7.
- Backend allowance: none.

DO NOT
- Do not build the Journey (Phase 6), Weekly review (Phase 7) or Progress
  (Phase 8) beyond the entry points ND-7 allows.
- Do not remove session content in the name of minimalism.
- Do not add notifications, reminders, streak gamification or analytics.
- Do not persist challenge progress (no backend allowance exists for it).

IMPLEMENTATION
Milestones through W5: M5.2 shell and navigation → M5.3 Today hierarchy (normal
practice day) → M5.4 session with progressive reveal → M5.5 focus mode → M5.6
completion interaction and notes → M5.7 remaining OD-9 states → M5.8 dashboard
retirement and decomposition → M5.9 regression.
Inspect first: App.tsx, components/ProtectedRoute.tsx, components/Navbar.tsx,
pages/Home.tsx (signed-in branch), pages/DashboardPage.tsx,
components/ExecutionDashboard.tsx, components/FocusSessionModal.tsx,
components/StepChallengeWidget.tsx, components/DayRoutineTimeline.tsx,
components/FullDayVisualizer.tsx, components/BasisBadge.tsx,
components/PlanV2Panel.tsx, context/GoalContext.tsx (read only),
lib/formatters.ts, lib/dateUtils.ts, types/index.ts.

VALIDATION
- Walk every OD-9 state. Where a state is hard to reach, use development data and
  document exactly how each state was produced.
- Complete a task and reload; save a note and reload; run the focus timer from
  start to finish.
- Stop the backend. Keyboard only. Reduced motion.
- Desktop 1440px and mobile 390px/360px; console clean.
- "Today → Start → Complete → Progress" in the fewest taps on mobile.

SUCCESS CRITERIA
- One Today screen.
- Every previously visible task field still reachable.
- Every OD-9 state designed.
- No navigation item leads to an empty page.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 6.

Notes: {{NOTES}}
```

---

## P6 — JOURNEY

```text
ACHIVII REDESIGN — PHASE 6: JOURNEY

PRECONDITIONS
- Phase 5 is COMPLETE.
- Decided in docs/decisions.md: OD-2 (90 vs 84 days), OD-7 (phase counts). If
  either is not Decided, stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
RoadmapPage.tsx (/roadmap) and PlanV2Panel.tsx render the roadmap today.
- v2 goals (planVersion 2): Goal.roadmap = { finalGoal, finalTest,
  startingPoint, method, phases, weeks }. phases has 2–4 entries ({ name,
  startWeek, endWeek, purpose }) named by the chosen method. weeks have
  { weekNumber, phase, focus, target, test }. Tasks exist only for the current
  week; later weeks are written one at a time after each review.
- v1 goals: three fixed phases (Foundation, Acceleration, Mastery); all 12 weeks
  planned up front.
- RoadmapWeek rows: phase, theme, objective, keyMilestone, status,
  executionScore, target, test.
- The plan is 12 weeks (84 days); the UI states 90 days (OD-2).

OBJECTIVE
A visual 90-day roadmap that shows where the user is going and how far they have
come, using the staircase as a conceptual language, not a template.

DESIGN DIRECTION
"Here's the path." Visual level 2: more visual, strategic. Elevation, depth,
steps, architectural geometry, light, distance, destination. Do not literally
draw a generic staircase and call it a roadmap (BP §10).

USER EXPERIENCE
- The user sees: the destination (roadmap.finalGoal), the phases as landings with
  their milestones, the steps completed so far, and "you are here".
- Three layers of progress (VDS §9): a quick 27 / 90, the emotional staircase,
  the strategic journey map.
- Desktop: expansive, with more environmental depth. Mobile: a vertical
  progression, with "you are here" visible on load.
- The future is shown honestly: future weeks show only focus, target and
  milestone, never invented tasks.

VISUAL REQUIREMENTS
- Step = a day's task (DailyTask.status); landing = a phase boundary; milestone
  marker ◆; destination ✦; active ●; completed ✓ (Phase 0 step-marker family).
- Completed steps are lit, and the next step is revealed (VDS §20), with a
  reduced-motion path.
- The journey has a text equivalent for screen readers; colour is never the only
  signal.

FUNCTIONAL REQUIREMENTS
- The roadmap (R-14) renders correctly for v1 and v2 goals, and for 2, 3 and 4
  phases.
- Daily task retrieval (R-8) unaffected.
- Day and week mapping follows OD-2 exactly; no 84/90 mismatch visible.

ARCHITECTURAL REQUIREMENTS
- One journey data adapter turns v1 and v2 goals into one shape; the view
  components never branch on plan version.
- Nothing assumes a fixed number of phases.
- Backend allowance: none.

DO NOT
- Do not change phase or week generation, or edit the plan from this view.
- Do not render tasks for weeks that have not been written.
- Do not build the garden or achievement state (Phase 9).

IMPLEMENTATION
Milestones through W5: M6.2 data adapter → M6.3 desktop composition → M6.4 mobile
vertical journey → M6.5 progress motion and reduced-motion path → M6.6
regression.
Inspect first: pages/RoadmapPage.tsx, components/PlanV2Panel.tsx,
context/GoalContext.tsx (read only), types/index.ts, the Phase 5 navigation.

VALIDATION
- A v1 preset goal; v2 goals with 2, 3 and 4 phases (development data if
  needed); week 1, a middle week and week 12.
- Reduced motion; screen-reader pass of the text equivalent; keyboard only.
- Desktop and 390px/360px; console clean.

SUCCESS CRITERIA
- Correct for every phase count and both plan versions.
- No fabricated future content.
- Understandable without the visuals.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 7.

Notes: {{NOTES}}
```

---

## P7 — WEEKLY REVIEW + ADAPTATION

```text
ACHIVII REDESIGN — PHASE 7: WEEKLY REVIEW + ADAPTATION

PRECONDITIONS
- Phase 5 is COMPLETE.
- Decided in docs/decisions.md: OD-1, Phase 7 part (whether weekly test results
  are stored). If not Decided, stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
POST /api/goal/weeks/:weekNumber/review accepts a reflection. It stores a
WeeklyReview (tasksPlanned, tasksCompleted, scorePercentage, reflection,
aiAdaptationInsight), marks the week completed with its executionScore, writes
the next week from the actual completions, and runs a phase-gate milestone
check. If adaptation fails it returns 503 and leaves the week unchanged.
RoadmapWeek.test holds { type, instructions, passIf } and target holds a metric
or a deliverable, but no test result is stored today. Retargeting, missed-day
carry-forward and proof judging (plan-v2-spec.md) are not implemented.

OBJECTIVE
The bridge between execution and adaptation: a short weekly moment after which
the next week visibly reflects what really happened.

DESIGN DIRECTION
Visual level 3: analytical, but warm. A reflection, not an assessment. Adapt the
journey, don't punish the person.

USER EXPERIENCE
"How did this week go?"
- what you completed (from task statuses)
- your reflection
- your test result compared with the target (only if OD-1 approved result
  storage)
- what happens next (aiAdaptationInsight and next week's focus)
Then the adaptation moment: the user sees that next week was rebuilt, and why,
from the real insight. The phase-gate outcome uses encouraging language ("Your
current results suggest we should reinforce this phase."). The review is
reachable from Today's "review due" state.

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives; restrained typography; large numbers with
  tabular figures.
- Never red "failure" styling for low completion.

FUNCTIONAL REQUIREMENTS
- Completion (R-9), weekly review (R-12) and weekly progression (R-13) behave
  exactly as before; next week's tasks appear on Today (R-8).
- On 503: say plainly that the week was not changed, keep the reflection, and
  offer a retry.
- Double-submit is prevented. Reload mid-review loses nothing it didn't lose
  before.

ARCHITECTURAL REQUIREMENTS
- Backend allowance (named, only if OD-1 approved it): store a weekly test
  result, for example a nullable RoadmapWeek.testResult JSON field and an
  optional field on the review request, with a Prisma migration, validation and
  a Vitest test. Adaptation behaviour does not change unless separately decided.
- Without that approval: no backend change, and the UI shows no target
  comparison.

DO NOT
- Do not show proof judging, photo/video tests, retargeting or carry-forward.
- Do not invent adaptation reasoning; show only what the server returns.
- Do not change the adaptation logic.

IMPLEMENTATION
Milestones through W5: M7.2 review flow → M7.3 adaptation moment and phase-gate
language → M7.4 failure, retry and review-due states → M7.5 test-result storage
and UI comparison (only with the allowance) → M7.6 regression.
Inspect first: the review UI in the Phase 5 components,
backend/src/routes/goal.ts review handler (read only unless the allowance
applies), backend/prisma/schema.prisma (read only unless the allowance applies),
types/index.ts.

VALIDATION
- Review a full week, a partial week and an empty week.
- Force a 503 (development only): week unchanged, reflection kept, retry works.
- Double-submit; reload mid-review; the week 12 review.
- With the allowance: backend tests pass, including the new field's test; the
  stored result round-trips.
- Desktop and 390px (textarea above the keyboard); console clean; reduced
  motion; keyboard only.

SUCCESS CRITERIA
- Review and progression behave exactly as before.
- The user sees why next week changed.
- No unimplemented capability is implied.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 8.

Notes: {{NOTES}}
```

---

## P8 — PROGRESS

```text
ACHIVII REDESIGN — PHASE 8: PROGRESS

PRECONDITIONS
- Phases 6 and 7 are COMPLETE.
- Decided in docs/decisions.md: ND-8 (Progress as a page or a Journey layer). If
  not Decided, stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
Available data: DailyTask.status and completedAt; RoadmapWeek.status and
executionScore; WeeklyReview rows (planned, completed, score, reflection,
insight); phase boundaries; weekly test results only if Phase 7's allowance
shipped. There is no Progress page today.

OBJECTIVE
Meaningful progress (completion, milestones, results and adaptation) instead of
superficial statistics.

DESIGN DIRECTION
Visual level 3: analytical. Typographic and restrained; big numbers as visual
objects (VDS §4). No chart unless it explains something the numbers cannot.

USER EXPERIENCE
"How far have I come?"
- Completion: work actually done, by week and by phase.
- Milestones: phase gates reached.
- Results: stored test results against targets, only if they exist.
- Adaptation history: each week's insight.
- Early and empty states (week 1 with nothing done; no reviews yet) that
  encourage rather than shame.

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives; tabular figures; no layout shift as numbers
  change.
- Not a card-heavy dashboard (VDS §31).

FUNCTIONAL REQUIREMENTS
- Every figure is traceable to stored data.
- Daily task retrieval (R-8) and the roadmap (R-14) unaffected.

ARCHITECTURAL REQUIREMENTS
- Placement and navigation as decided in ND-8.
- Derive figures in one place (a selector or hook), not per component.
- Backend allowance: none beyond what Phase 7 shipped.

DO NOT
- Do not add analytics, streak gamification, comparisons with other users or
  exports.
- Do not show results that are not stored.

IMPLEMENTATION
Milestones through W5: M8.2 completion and milestones → M8.3 results and
adaptation history (data permitting) → M8.4 empty and early states → M8.5
regression.

VALIDATION
- Goals at week 1, week 6 and week 12; a goal with no reviews.
- Check the numbers against the database for one real goal, and show the
  comparison.
- Desktop and 390px/360px; console clean; reduced motion; keyboard only.

SUCCESS CRITERIA
- Every figure traceable to stored data.
- Nothing resembles analytics that do not exist.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 9.

Notes: {{NOTES}}
```

---

## P9 — ACHIEVEMENT

```text
ACHIVII REDESIGN — PHASE 9: ACHIEVEMENT

PRECONDITIONS
- Phases 6 and 7 are COMPLETE.
- Decided in docs/decisions.md: OD-1, Phase 9 part (goal completion transition
  and what completes a goal) and OD-2 (90 vs 84 days). If either is not Decided,
  stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
Goal.status is 'active' or 'archived'; nothing ever sets 'completed'. Behaviour
after week 12 is undefined in the UI. Creating a new goal archives the previous
active one; DELETE /api/goal/active exists for reset. Multiple active goals are
not supported. The garden image is frontend/public/images/brand/garden.jpg
(682×1024, portrait).

OBJECTIVE
The completion and celebration experience, the arrival at the garden, after
which the user can begin their next journey.

DESIGN DIRECTION
"You made it." Visual level 4: cinematic. Darkness → movement → arrival → light.
The darkness opens, the architecture warms, the garden appears. Achievement gold
(#C8A96B) is used here, sparingly: it means "you've arrived". No confetti.

USER EXPERIENCE
- 90 DAYS · COMPLETE · You reached the destination.
- The goal; real results (from Phase 7 and 8 data); what you accomplished.
- "Your results" and "Begin another journey".
- Before completion but after week 12: a designed final-stretch state (per OD-2).

VISUAL REQUIREMENTS
- Garden imagery served at a suitable size and cropped for portrait; never relied
  on to be crisp at full desktop width (VDS note 8).
- A reduced-motion path in which the arrival is a simple, complete state.

FUNCTIONAL REQUIREMENTS
- The server records completion (Goal.status = 'completed') per OD-1.
- GET /api/goal/active behaviour for completed goals is specified and tested.
- "Begin another journey" reuses the existing archive-and-create flow into
  onboarding (R-15). The completed goal is kept as completed, not deleted.
- Saving goals (R-7), daily tasks (R-8), weekly review (R-12) and progression
  (R-13) unaffected.

ARCHITECTURAL REQUIREMENTS
- Backend allowance (named, only if OD-1 approved it): the goal completion
  transition, inside the final week's review or a dedicated endpoint as decided;
  a migration only if a completion timestamp is added; Vitest coverage for the
  transition and for /active with a completed goal.
- GoalContext changes limited to reading the new status.

DO NOT
- Do not create a frontend-only completed state.
- Do not add goal history, sharing, certificates or multiple active goals unless
  separately decided.
- Do not use gold outside achievement moments.

IMPLEMENTATION
Milestones through W5: M9.2 backend completion transition with tests → M9.3
achievement screen and garden transition → M9.4 final-stretch state and "Begin
another journey" → M9.5 regression.
Inspect first: backend/src/routes/goal.ts (review handler, /active, create),
backend/prisma/schema.prisma, context/GoalContext.tsx, the Today and Journey
terminal states.

VALIDATION
- Drive a development goal to completion through the real flow.
- Reload on the achievement screen.
- Begin another journey: the old goal is 'completed', the new one 'active'.
- Backend tests pass, including the new ones.
- Desktop and 390px; console clean; reduced motion; keyboard only.

SUCCESS CRITERIA
- The server knows a goal is complete.
- The celebration is real, calm and earned.
- The next goal can be started.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 10.

Notes: {{NOTES}}
```

---

## P10 — PREMIUM ARCHITECTURE

```text
ACHIVII REDESIGN — PHASE 10: PREMIUM ARCHITECTURE

PRECONDITIONS
- Phases 5 and 6 are COMPLETE.
- Decided in docs/decisions.md: ND-9 (payments in scope or not), ND-10
  (custom-goal gating), ND-11 (Coach scope), and OD-1, Phase 10 part
  (entitlement allowance). If any is not Decided, stop and run W3.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
There is no chat functionality, no payment system, and no plan or entitlement
field on User. Custom goals are created free through POST /api/goal/create with
no entitlement check; a frontend-only lock would be bypassable and would also
remove a feature free users have today. The marketing page shows Coach as "In
development" and Custom Journeys as "Planned for Premium", and says there is no
paid plan yet.

OBJECTIVE
Give Achivii Coach and Custom Journeys their place in the product, attractive and
understandable, without faking availability or payment.

DESIGN DIRECTION
Premium means crafted, not pushy. Subtle botanical green or warm gold by
context. "Have something unique in mind? Build a journey around your own goal."
Never an aggressive upsell.

USER EXPERIENCE
- Coach ✦ has a place in the application navigation, with an honest state that
  matches ND-11.
- Custom Journeys has a place in the pathway library. If it is locked, the lock
  is real (enforced by the server) and the copy states actual availability.
- If ND-9 approves payments, the purchase flow is real end to end; otherwise
  there is no purchase UI at all.

VISUAL REQUIREMENTS
- Phase 0 tokens and primitives; the ✦ destination/premium mark from the
  progress family.
- Premium styling distinct but quiet.

FUNCTIONAL REQUIREMENTS
- Goal creation (R-2), preset launch (R-3) and the onboarding payload (R-4)
  unaffected for free presets.
- Existing custom goals keep working (grandfathering per ND-10).
- If gating ships: a direct API call to /create with a custom goal from a user
  without the entitlement is refused by the server.
- Marketing copy and in-app copy agree about what is available.

ARCHITECTURAL REQUIREMENTS
- Backend allowance (named, only if ND-10 approved it): an entitlement field on
  User (or a separate table), exposed read-only on GET /api/auth/me; a
  server-side check in POST /api/goal/create for non-preset goals; a migration;
  Vitest tests for allowed and refused cases.
- Payment-provider integration is a separate named allowance, only if ND-9
  approved it, delivered through its own plan.
- A real Coach chat is a new backend capability and needs its own approved plan
  under ND-11.

DO NOT
- Do not show an "Unlock" or "Upgrade" button that leads nowhere or to a fake
  checkout.
- Do not build a conversation UI for a chat that does not exist.
- Do not lock custom goals in the UI without the server-side gate.
- Do not remove free custom goals before ND-10's plan says so.

IMPLEMENTATION
Milestones through W5: M10.2 Coach placement and state → M10.3 Custom Journeys
placement → M10.4 entitlement and gate (only with the allowance) → M10.5
payments (only with the allowance) → M10.6 marketing copy → M10.7 regression.
Inspect first: the Phase 5 navigation, the Phase 3 pathway library,
components/marketing/sections/Premium.tsx, backend/src/routes/goal.ts and
auth.ts (read only unless allowances apply), backend/prisma/schema.prisma,
context/AuthContext.tsx (read only).

VALIDATION
- A free user; an entitled user (if built).
- A direct API call to /create for a custom goal without the entitlement is
  refused (if gating ships).
- Existing custom goals still load and work.
- Copy audit: marketing and app agree.
- Backend tests pass (if the backend changed).
- Desktop and 390px; console clean; reduced motion; keyboard only.

SUCCESS CRITERIA
- Nothing implies a feature or purchase that does not work.
- Any lock is enforced by the server.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 11.

Notes: {{NOTES}}
```

---

## P11 — MOBILE

```text
ACHIVII REDESIGN — PHASE 11: MOBILE

PRECONDITIONS
- Phases 2 to 10 are COMPLETE (or explicitly deferred in docs/phases.md).
- The device and browser matrix is agreed (M11.1). If not, propose one and stop.
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
Mobile has been verified in every phase. This phase is a final end-to-end sweep:
mobile is the primary execution device, and the whole journey must work in one
hand.

OBJECTIVE
Verify and fix the complete experience on small screens and real mobile
browsers.

DESIGN DIRECTION
Hide complexity on mobile; prioritise Today → Start → Complete → Progress. The
journey is a vertical progression. Do not shrink desktop down.

USER EXPERIENCE
Walk the whole journey on each device in the matrix:
landing → sign-up → onboarding → generation → Today → focus → complete →
review → Journey → Progress → Achievement.

VISUAL REQUIREMENTS
- 390, 375 and 360px widths; iOS Safari and Android Chrome (real devices where
  possible).
- Safe areas, keyboard overlap, sheets and scroll containment (nothing scrolls
  behind an open sheet).
- Tap targets at least 44px; no hover-only affordances.
- No backdrop-blur over large imagery; image sizes suited to mobile.

FUNCTIONAL REQUIREMENTS
Every must-not-break item (R-1 to R-18) works on mobile.

ARCHITECTURAL REQUIREMENTS
Fixes use existing tokens and primitives. Backend allowance: none.

DO NOT
- Do not redesign screens; fix them.
- Do not add PWA or installability features unless a decision approves them.

IMPLEMENTATION
Milestones through W5: M11.2 end-to-end walk with every issue logged (device,
screen, steps, screenshot) → M11.3 fixes → M11.4 re-walk.

VALIDATION
The re-walk on every device in the matrix, plus portrait and landscape for focus
mode, and performance with reduced motion both off and on.

SUCCESS CRITERIA
Every issue from the walk is fixed, or explicitly deferred with a reason and an
owner.

END
Run W6, then W11, then write the W7 report. Stop. Do not begin Phase 12.

Notes: {{NOTES}}
```

---

## P12 — GLOBAL POLISH

```text
ACHIVII REDESIGN — PHASE 12: GLOBAL POLISH

PRECONDITIONS
- Phases 0 to 11 are COMPLETE (or explicitly deferred).
- Decisions applied:
{{DECISIONS_APPLIED}}

CONTEXT
The redesign is functionally complete. What remains is consistency, legacy
removal, accessibility, performance and a full regression. Known leftovers
include legacy mint tokens, the --radius-xl/2xl/3xl override, Plus Jakarta Sans
and JetBrains Mono, duplicated galleries and modals, about 1,010 hard-coded hex
values at the start of the redesign, low-resolution brand images, and
per-pathway photos that do not match "product imagery = monochrome +
restrained".

OBJECTIVE
Leave nothing half-migrated: one design system everywhere, every state complete,
accessible, fast, and fully regression-tested.

DESIGN DIRECTION
With the logo removed, someone should be able to say "That's Achivii": deep
architectural darkness, warm natural imagery, massive typography, geometric
progression, botanical green, warm achievement tones, extreme negative space,
subtle motion, staircase language.

USER EXPERIENCE
Consistent language (90 days, encouraging voice), consistent interaction
patterns, and no stale or over-promising claims anywhere.

VISUAL REQUIREMENTS
- Hard-coded colours outside the token files reduced to effectively zero.
- Responsive AVIF/WebP imagery with explicit dimensions; higher-resolution brand
  images once supplied; per-pathway photos replaced or given a monochrome
  treatment.
- Font loading finalised (self-hosting decided and logged).

FUNCTIONAL REQUIREMENTS
Full regression of R-1 to R-18.

ARCHITECTURAL REQUIREMENTS
- Remove each legacy token, font, component or modal only after proving nothing
  uses it (search results included in the report).
- Confirm reachability before deleting any component (for example
  SaaSBuilderModal.tsx and PathwaysExplorerModal.tsx).
- Route-level code splitting only where measurement justifies it.
- Backend allowance: none.

DO NOT
- Do not delete anything whose use you have not ruled out.
- Do not optimise speculatively; measure first.
- Do not introduce new features.

IMPLEMENTATION
Milestones through W5: M12.1 legacy inventory → M12.2 legacy removal, verified
screen by screen → M12.3 imagery pipeline and assets → M12.4 accessibility audit
(automated plus manual keyboard and screen reader) and fixes → M12.5 performance
pass (bundle size, LCP/CLS on landing and Today) → M12.6 full regression and final
Design.md pass.

VALIDATION
- Before-and-after figures for hex count, bundle size, LCP and CLS.
- The accessibility audit results with every finding fixed or deferred with a
  reason.
- R-1 to R-18 verified, with evidence.
- Desktop and mobile matrix; console clean; reduced motion; keyboard only.

SUCCESS CRITERIA
- One design system in use everywhere.
- R-1 to R-18 verified.
- Accessibility and performance findings fixed or explicitly deferred.

END
Run W6, then W11, then write the final W7 report covering the whole redesign.
Stop.

Notes: {{NOTES}}
```

---

# CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-23 | First version: system prompt, workflow prompts W1–W12, and phase execution prompts P0–P12 (P1 recorded as complete). |
| 2026-09-23 | After Phase 0: system prompt STACK gains `Design.md`, `components/ui`, bun, and the lint and test commands; W6 runs lint on changed files and the tests. P0 is kept as the record of how Phase 0 was run. |
