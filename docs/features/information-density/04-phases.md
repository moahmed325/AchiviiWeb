# Achivii Core Experience — IMPLEMENTATION PHASES
### Detailed roadmap, milestones, dependencies, evidence, and exit criteria

**Status:** IN PROGRESS (checked 2026-10-08 against the milestone reports and git history): P1 to P4 COMPLETE (2026-09-30), P5 NOT STARTED.
**Version:** 3.0
**Date:** 2026-09-30
**Problem Definition:** docs/features/information-density/01-problem.md
**Solution Exploration:** docs/features/information-density/02-solution.md
**Feature Definition:** docs/features/information-density/03-feature.md
**Template:** the old phases template (retired 2026-10-08; it is in git history)

---

# 0 — HOW TO READ THIS FILE

This file is the execution roadmap and source of truth for implementation order.
It converts the approved Feature Definition into ordered phases and independently verifiable milestones.
The Prompt Engineer consumes one milestone plus current repository evidence to create an implementation prompt.
No milestone authorizes unrelated work.

## 0.1 Status legend
| Status | Meaning |
|---|---|
| NOT STARTED | No implementation work has begun. |
| IN PROGRESS | Work is actively being implemented. |
| PARTIAL | Some milestones are complete; phase exit criteria are not met. |
| COMPLETE | Milestones, evidence, regressions, and review are complete. |
| BLOCKED | A required dependency or decision prevents safe progress. |

## 0.2 Identifier system
- P1–P5 = phases.
- M1.1 etc. = milestones.
- OD-n = inherited open decisions.
- ND-n = decisions discovered during implementation.
- AC-n = Feature Definition acceptance criteria.
- SC-n = Feature Definition success criteria.
- R-n = regression requirements.
- EV-n = required implementation evidence.
- RC-n = roadmap risk controls.

## 0.3 Completion rule
Code existing is not completion.
A milestone is complete only when its objective has observable evidence, touched regressions pass, scope stayed bounded, and unresolved work is recorded.

---

# 1 — APPROVED PRODUCT DIRECTION

## 1.1 Problem
Achivii can expose more information, actions, numbers, cards, and sections than users can easily prioritize at once. Users need to understand a page's purpose and most important next understanding/action immediately.

## 1.2 Selected solution
**Purpose-first, progressive-depth core workspace.**

Combine:
1. page-role-first restructuring,
2. stronger information hierarchy,
3. selective progressive disclosure.

Do not pursue minimalism as an aesthetic goal. Pursue clarity, hierarchy, concise content, predictable interaction, complete state handling, and restrained premium craft.

## 1.3 Core page contract
| Experience | User question | Dominant job |
|---|---|---|
| Today | What do I do now? | Execute today's session. |
| Journey | Where am I going, and how does my current week fit into the bigger 12-week journey? | Understand the journey and current position. |
| Progress | Am I actually getting closer, and what evidence shows that? | Understand progress through meaningful evidence. |

No new general-purpose dashboard is authorized.

---

# 2 — ROADMAP AT A GLANCE

| Phase | Name | Depends on | Backend allowance |
|---|---|---|---|
| P1 | Design Foundation & Experience Contract | Feature Definition | None |
| P2 | Today — Execution Experience | P1 | None |
| P3 | Journey — Orientation Experience | P1 | None |
| P4 | Progress — Evidence Experience | P1 | None |
| P5 | Cross-Experience Polish, Accessibility & QA | P2, P3, P4 | None |

Status (2026-10-08): P1, P2, P3 and P4 COMPLETE (2026-09-30); P5 NOT STARTED. M4.1 has no report in `milestones/`; it shipped as commit `b8ab112` ("feat(progress): establish evidence-first hierarchy").

## 2.1 Dependency graph
```
Feature Definition
       ↓
P1 — Foundation / information contract
       ↓
 ┌─────┼─────┐
 ▼     ▼     ▼
P2    P3    P4
Today Journey Progress
 └─────┼─────┘
       ▼
P5 — consistency / responsive / accessibility / regression
```

## 2.2 Ordering rationale
P1 resolves information boundaries and shared visual rules before page implementation.
P2/P3/P4 are independent after P1 and must use the same foundation.
P5 requires all three experiences to validate cross-product consistency.
Migration, authentication, AI, payments, and unrelated infrastructure are not dependencies.

---

# 3 — RULES FOR EVERY PHASE

## 3.1 Repository-first
Before implementation:
- inspect current files,
- verify current behavior,
- inspect reusable primitives,
- inspect relevant tests and scripts,
- distinguish current state from planned state.

Never implement from stale path assumptions.

## 3.2 Scope discipline
The assigned milestone is the maximum implementation scope unless a blocking dependency is discovered.
Convenient refactors are not automatically permitted.

## 3.3 Backend / architecture rule
Default allowance is **None**.
Backend, database, API, auth, or persistent-state changes require evidence that the Feature Definition cannot be satisfied otherwise and a narrow explicit decision.

## 3.4 Preservation rule
Do not solve information density by blind deletion.
Secondary information should usually be prioritized or disclosed before it is removed.
Only remove genuinely redundant content when evidence proves redundancy.

## 3.5 Honesty rule
Do not imply functionality exists when it does not.
No fake analytics, persistence, progress, completion, AI, adaptation, notifications, permissions, or benchmark outcomes.

## 3.6 Premium rule
Premium comes from:
- typography,
- composition,
- spacing,
- alignment,
- restrained color,
- coherent surfaces,
- polished controls,
- meaningful feedback,
- subtle motion,
- consistency.

Decoration must never compete with hierarchy.

## 3.7 Mobile rule
Mobile is a first-class composition, not a squeezed desktop.
Same page job and priority; composition may differ.
No horizontal overflow.

## 3.8 Accessibility rule
Applicable UI work must preserve:
- semantic structure,
- heading hierarchy,
- keyboard operation,
- visible focus,
- accessible names,
- non-color status,
- contrast,
- reduced motion,
- usable error/recovery states.

## 3.9 Motion rule
Motion is subordinate to comprehension and must have an equivalent reduced-motion experience.

## 3.10 Validation rule
Do not invent commands.
Inspect package scripts and existing test configuration immediately before choosing validation.
Use frontend build/type/test/lint/browser/accessibility checks only where the repository supports them.

---

# 4 — REGRESSION REGISTER

| ID | Existing capability | Required verification |
|---|---|---|
| R-1 | Authentication/session access | Authenticated user can reach core app. |
| R-2 | Active-goal loading | Goal loads or honest recovery appears. |
| R-3 | Today execution | Session can be accessed and completed. |
| R-4 | Session details | Steps, notes, timer/resources remain usable. |
| R-5 | Weekly review | Existing review remains reachable and functional. |
| R-6 | Recovery/save errors | User can understand/retry failures. |
| R-7 | Full Journey | Meaningful 12-week journey remains accessible. |
| R-8 | Future honesty | Future daily sessions are not fabricated. |
| R-9 | Progress evidence | Meaningful metrics/benchmark/adaptation evidence remains accessible. |
| R-10 | Navigation | Core navigation remains functional and understandable. |
| R-11 | Persistence | Refresh/navigation does not discard persistent state. |
| R-12 | Responsive behavior | Core experiences remain operable on supported widths. |
| R-13 | Accessibility | Keyboard/screen-reader/focus/status behavior does not regress. |
| R-14 | Completed goal | Existing completed-goal behavior remains honest/reachable. |

Each phase must state which R-n items it touches.

---

# 5 — PHASE ANATOMY

Every phase uses this structure:
1. Status
2. Source
3. Objective
4. Narrative
5. Current state
6. Decisions required
7. In scope
8. Out of scope
9. Backend/architecture allowance
10. Files/areas likely affected
11. Milestones
12. Regression checks
13. Mobile acceptance
14. Accessibility considerations
15. Validation
16. Exit criteria
17. Risks
18. Completion evidence

“Files likely affected” are starting points only; implementation must verify them.

---

# 6 — P1 DESIGN FOUNDATION & EXPERIENCE CONTRACT

**Status:** COMPLETE (2026-09-30: M1.1, M1.2, M1.3; reports in `milestones/`)

## 6.1 Source
Feature Definition UX-1…UX-6, RULE-1…RULE-10, N-1…N-12, AC-1…AC-24, R-1…R-10.
Solution Exploration DEC-1, PRINC-1…PRINC-13.
Repository evidence from current Today, Journey, Progress, shared UI, and test configuration.

## 6.2 Objective
Establish the concrete information-priority, disclosure, visual, responsive, accessibility, and reusable-pattern foundation that P2–P4 must consume.

## 6.3 Narrative
> Decide what deserves attention before deciding how to decorate it.

## 6.4 Current state
- Home.tsx routes authenticated active-goal users to Today.
- Today.tsx is a large stateful execution workspace.
- RoadmapPage.tsx combines JourneyHeader, desktop/mobile journey renderers, and StrategicRoadmap.
- ProgressPage.tsx presents header plus CompletionOverview, PhaseMilestonesCard, WeekBreakdownList, BenchmarkResultsCard, and AdaptationHistoryList.
- Shared UI primitives exist under frontend/src/components/ui/.
- Tailwind/theme tokens exist, but audit evidence found inconsistent direct styling.
- Journey has distinct desktop/mobile implementations.

## 6.5 Decisions required
OD-1: minimum first-view information per page/state.
OD-2: disclosure pattern per secondary category.
OD-3: reusable/refinable visual tokens/primitives.
OD-4: genuinely redundant content.
OD-5: state-specific priority changes.

A decision blocks implementation only when unresolved meaningfully changes scope or expected behavior.

## 6.6 In scope
- repository/design inspection,
- information-priority matrix,
- disclosure strategy,
- shared visual foundation,
- responsive principles,
- accessibility baseline,
- reusable patterns.

## 6.7 Out of scope
- full page redesign,
- backend migration,
- auth/AI/payment changes,
- new analytics,
- new dashboard,
- unrelated cleanup.

## 6.8 Backend allowance
**None.**

## 6.9 Likely areas
- frontend/src/components/ui/
- frontend/src/index.css
- frontend/src/pages/Home.tsx
- frontend/src/pages/RoadmapPage.tsx
- frontend/src/pages/ProgressPage.tsx
- frontend/src/components/today/
- frontend/src/components/journey/
- frontend/src/components/progress/

## 6.10 M1.1 — Repository & Current-State Verification

### Objective
Produce a verified implementation map of current page structure, states, reusable UI, visual rules, responsive behavior, and validation tooling.

### Tasks
- Inspect Today, Journey, Progress entry points and child components.
- Map current information layers and actions.
- Identify reusable primitives and one-off styling.
- Inspect loading/empty/error/completion states.
- Inspect responsive renderers.
- Inspect tests, package scripts, and browser/accessibility tooling.
- Record relevant known bugs/constraints without fixing unrelated issues.

### Outputs
- current component/experience map,
- current state matrix,
- reusable UI inventory,
- validation inventory,
- implementation constraints.

### Acceptance
- Current behavior is evidence-backed.
- No key implementation assumption is unverified.
- Likely files for P2–P5 are identified.
- Actual test/build commands are known.

### Regression
R-1, R-2, R-3, R-7, R-9, R-10, R-11, R-12, R-13.

### Evidence
EV-1: repository-grounded investigation report.

## 6.11 M1.2 — Information-Priority Matrix

### Objective
Define primary, secondary, and exploratory information for representative page states.

### Today states
Practice, key session, test, rest, minimum version, done, recovery, review due, closing stretch, completed, error/offline.

### Journey states
Loading, no journey, active, active phase/week, completed phases, upcoming weeks, closing stretch, completed journey.

### Progress states
Loading, no journey, early/little evidence, active evidence, dense history, completed goal, error.

### For each state define
- primary user question,
- primary content,
- primary action/next step,
- secondary content,
- exploratory content,
- discoverability path,
- content that must remain visible,
- content whose redundancy is unresolved.

### Acceptance
- Every representative state has one dominant job.
- Primary content is distinguishable.
- Secondary content remains discoverable.
- No deletion is justified only by visual preference.

### Evidence
EV-2: completed priority matrix and decision register.

## 6.12 M1.3 — Premium Visual Foundation

### Objective
Define/refine shared visual rules so implementation can produce premium, calm, intentional experiences without decorative overload.

### Define
- typography hierarchy,
- spacing/rhythm,
- content width,
- alignment,
- surface hierarchy,
- borders/radii/elevation,
- semantic color roles,
- controls,
- focus,
- status,
- disclosure,
- responsive composition,
- motion.

### Acceptance
- Repeated visual decisions have reusable rules.
- Hierarchy works before decoration.
- Focus/status are intentional.
- Rules work across desktop/mobile.
- Existing primitives are reused where suitable.

### Evidence
EV-3: visual foundation and reusable pattern specification.

## 6.13 P1 exit criteria
- M1.1, M1.2, M1.3 complete.
- OD-1…OD-5 resolved or explicitly non-blocking.
- Information boundaries are concrete.
- Shared visual foundation is implementable.
- EV-1…EV-3 exist.
- No critical carry-over blocks P2–P4.

## 6.14 P1 risks
- Treating design-system assumptions as facts.
- Turning token cleanup into global refactoring.
- Creating disclosure everywhere.
- Making “premium” synonymous with decoration.

---

# 7 — P2 TODAY / EXECUTION EXPERIENCE

**Status:** COMPLETE (2026-09-30: M2.1, M2.2, M2.3; reports in `milestones/`)

## 7.1 Source
Feature Definition UX-1, FD-1, FD-4…FD-6, RULE-1…RULE-10, AC-1, AC-2, AC-4…AC-24, R-1…R-6, R-10…R-14.

## 7.2 Objective
Make Today immediately answer “What do I do now?” with goal context, today’s session, and primary action dominant.

## 7.3 Narrative
> Today should make the next meaningful action obvious.

## 7.4 Current state
Today.tsx combines goal context, current task/session, week glance, review behavior, steps, focus/timer, notes, resources, completion, recovery, and closing-stretch behavior.

## 7.5 In scope
Default hierarchy, supporting detail, disclosure, state-specific composition, responsive/accessibility behavior.

## 7.6 Out of scope
Session generation changes, new task model, weekly-target judging, backend migration, new dashboard, unrelated refactoring.

## 7.7 Backend allowance
**None.**

## 7.8 Likely areas
Today.tsx, Today child components, Home.tsx, shared UI, relevant tests.

## 7.9 M2.1 — Today Default Hierarchy

**Objective:** Make goal context, current session, and primary action immediately identifiable.

**Requirements**
- Establish one dominant attention path.
- Keep goal as context, not competition.
- Make current session unmistakable.
- Make Start/primary action obvious.
- Reduce simultaneous secondary content without deleting capability.
- Preserve existing session behavior.

**Preserve:** R-2, R-3, R-4, R-5, R-6, R-10, R-11.

**Acceptance:** AC-1, AC-2, AC-4, AC-7, AC-19, AC-23, AC-24.

**Evidence:** EV-4 hierarchy walkthrough plus primary-flow regression.

## 7.10 M2.2 — Today Progressive Depth

**Objective:** Defer appropriate supporting information while keeping it findable.

**Evaluate:** detailed instructions, resources, notes/context, week detail, non-primary metrics, supporting benchmark/context.

**Rules**
- Do not add a disclosure control to every section.
- Disclosure must have understandable labeling.
- Primary action remains immediately available.
- Expanded detail retains context.
- Keyboard and reduced-motion behavior remain equivalent.

**Acceptance:** AC-4, AC-5, AC-6, AC-10, AC-11, AC-16, AC-17.

**Evidence:** EV-5 closed/default and explored states on desktop/mobile.

## 7.11 M2.3 — Today State Coverage

**Objective:** Apply hierarchy to all meaningful Today states.

**States:** loading, no goal, practice, key session, test, rest, minimum version, done, yesterday pending/recovery, review due/failed, closing stretch, completed goal, offline/error.

**Rules**
- State-specific primary need may change.
- Visual language remains coherent.
- Errors provide explanation/recovery.
- Completion states remain honest.

**Acceptance:** AC-12…AC-15, AC-22…AC-24.

**Evidence:** EV-6 state matrix and regression results.

## 7.12 P2 exit
- M2.1–M2.3 complete.
- Today’s job/action obvious.
- Detail discoverable.
- Execution/review/recovery preserved.
- Responsive/accessibility pass.
- EV-4…EV-6 exist.
- No critical regression.

---

# 8 — P3 JOURNEY / ORIENTATION EXPERIENCE

**Status:** COMPLETE (2026-09-30: M3.1, M3.2, M3.3; reports in `milestones/`)

## 8.1 Source
Feature Definition UX-2, FD-2, FD-4…FD-6, RULE-1…RULE-10, AC-3…AC-24, R-7, R-8, R-10…R-13.

## 8.2 Objective
Make destination, current position, and current week’s role in the 12-week journey immediately understandable without forcing the full roadmap into the first attention path.

## 8.3 Narrative
> Show the destination first; let the user explore the path.

## 8.4 Current state
RoadmapPage.tsx renders JourneyHeader, desktop/mobile journey renderers, and StrategicRoadmap.
DesktopStaircase.tsx and MobileVerticalJourney.tsx contain substantial journey detail.
Future-honesty behavior is an explicit preservation requirement.

## 8.5 In scope
Destination, position, current week, phases/weeks, meaningful daily detail, closing stretch, completed state, responsive/accessibility.

## 8.6 Out of scope
Plan generation, new roadmap model, backend migration, fabricated future sessions, unrelated redesign.

## 8.7 Backend allowance
**None.**

## 8.8 Likely areas
RoadmapPage.tsx, JourneyHeader, DesktopStaircase, MobileVerticalJourney, StrategicRoadmap, journey hook, shared UI, relevant tests.

## 8.9 M3.1 — Journey Orientation Hierarchy

**Objective:** Make destination/current position/current week relationship understandable before deep detail.

**Requirements**
- Destination is clear.
- Current position is clear.
- Current week is clear.
- Current week’s role in the larger arc is clear.
- Full journey does not need to be scanned to answer those questions.

**Preserve:** R-7, R-8, R-10, R-12, R-13.

**Acceptance:** AC-3, AC-4, AC-7, AC-20, AC-23, AC-24.

**Evidence:** EV-7 desktop/mobile orientation walkthrough.

## 8.10 M3.2 — Journey Progressive Depth

**Objective:** Preserve meaningful journey depth through deliberate exploration.

**Explore:** phases, weeks, daily steps, milestones, closing stretch, destination detail.

**Future honesty:** never imply specific future daily actions exist when they have not been generated.

**Acceptance:** AC-4, AC-5, AC-6, AC-20, AC-22.

**Evidence:** EV-8 findability and future-honesty verification.

## 8.11 M3.3 — Journey State Coverage

**Objective:** Apply the orientation principle to loading, empty, active, completed phases, upcoming, closing, completed journey, and error/recovery states.

**Acceptance:** state-specific primary message, clear next step for empty/error, honest completion, equivalent desktop/mobile priority.

**Evidence:** EV-9 state matrix and responsive walkthrough.

## 8.12 P3 exit
- M3.1–M3.3 complete.
- Destination/current position/current week obvious.
- Full meaningful journey accessible.
- Future daily content honest.
- Desktop/mobile hierarchy equivalent.
- Accessibility passes.
- EV-7…EV-9 exist.
- No critical regression.

---
# 9 — P4 PROGRESS / EVIDENCE EXPERIENCE

**Status:** COMPLETE (2026-09-30: M4.1 as commit `b8ab112`, no report; M4.2, M4.3 reports in `milestones/`)

## 9.1 Source
Feature Definition UX-3, FD-3, FD-4…FD-6, RULE-1…RULE-10, AC-3…AC-24, R-9…R-13.
Solution Exploration DEC-1 and PRINC-8…PRINC-13.

## 9.2 Objective
Make Progress immediately communicate whether the user is getting closer and what evidence supports that understanding.

## 9.3 Narrative
> Show what the work is adding up to; let the history explain it.

## 9.4 Current state
ProgressPage.tsx currently presents a header followed by CompletionOverview, PhaseMilestonesCard, WeekBreakdownList, BenchmarkResultsCard, and AdaptationHistoryList.
CompletionOverview exposes current day, practice sessions, execution adherence, and total practice time.
PhaseMilestonesCard exposes phase status, milestones, and execution scores.
The redesign must not assume every available metric deserves first-view prominence.

## 9.5 In scope
- primary progress story,
- meaningful evidence,
- metric hierarchy,
- phase/benchmark/adaptation detail,
- historical detail,
- sparse/dense/completion states,
- responsive/accessibility.

## 9.6 Out of scope
- new analytics products,
- new measurement systems,
- new benchmarking algorithms,
- new adaptation logic,
- unrelated data-model work.

## 9.7 Backend / architecture allowance
**None.**

## 9.8 Likely areas
Verify immediately before editing:
- frontend/src/pages/ProgressPage.tsx
- frontend/src/components/progress/CompletionOverview.tsx
- frontend/src/components/progress/PhaseMilestonesCard.tsx
- frontend/src/components/progress/WeekBreakdownList.tsx
- frontend/src/components/progress/BenchmarkResultsCard.tsx
- frontend/src/components/progress/AdaptationHistoryList.tsx
- shared UI and relevant tests.

## 9.9 M4.1 — Progress Evidence Hierarchy

**Objective:** Establish the smallest meaningful first-view evidence story.

**Required behavior**
1. Explain what progress means in the current journey.
2. Show the most meaningful evidence first.
3. Establish where the user currently stands.
4. Do not promote metrics merely because they exist.

**Preserve:** meaningful progress, completion, benchmark, and adaptation evidence.

**Acceptance:** AC-3, AC-4, AC-7, AC-21, AC-23, AC-24.

**Regression:** R-9, R-10, R-11, R-13.

**Verification:** Review a representative active journey and identify the progress story and evidence without scanning the full page.

**Evidence:** EV-10 first-view walkthrough and evidence rationale.

## 9.10 M4.2 — Progress Progressive Depth

**Objective:** Keep detailed breakdowns, historical metrics, benchmarks, and adaptation history accessible without forcing them into the initial attention path.

**Requirements**
- dense history must not dominate,
- deeper information must remain findable,
- expanded detail retains context,
- historical evidence remains understandable,
- useful evidence is not removed solely for density.

**Acceptance:** AC-4, AC-5, AC-6, AC-21, AC-22, AC-24.

**Regression:** R-9, R-10, R-11, R-12, R-13.

**Verification:** Test default and explored states with a history-heavy representative dataset.

**Evidence:** EV-11 discoverability and dense-history checks.

## 9.11 M4.3 — Progress State Coverage

**Objective:** Keep the progress story meaningful when evidence is sparse, active, dense, unavailable, or complete.

**States**
- loading,
- no active journey,
- early journey/little evidence,
- active evidence,
- dense historical evidence,
- completed goal,
- load error.

**Honesty rule:** Never manufacture progress or confidence when evidence is absent.

**Acceptance:** AC-12…AC-15, AC-21…AC-24.

**Regression:** R-2, R-9, R-10…R-14.

**Evidence:** EV-12 state matrix, sparse-data verification, dense-history verification.

## 9.12 P4 exit
- M4.1–M4.3 complete.
- Main progress story precedes detailed history.
- Meaningful evidence remains accessible.
- Sparse data is honest.
- Dense history does not recreate the original problem.
- Completion is honest.
- Responsive/accessibility checks pass.
- EV-10…EV-12 exist.
- No critical regression remains.

---

# 10 — P5 CROSS-EXPERIENCE POLISH, ACCESSIBILITY & QA

**Status:** NOT STARTED

## 10.1 Source
Feature Definition AC-1…AC-24, SC-1…SC-10, R-1…R-10.
Solution Exploration PRINC-8…PRINC-13.
P2/P3/P4 completion evidence.

## 10.2 Objective
Make Today, Journey, and Progress feel like one coherent premium product and prove the redesign reduces the original density problem without unacceptable regression.

## 10.3 Narrative
> Three destinations, one clear product language.

## 10.4 Preconditions
P2, P3, and P4 must satisfy their exit criteria.
Any cross-page blocking carry-over must be classified before P5 begins.

## 10.5 In scope
- cross-experience consistency,
- responsive validation,
- accessibility validation,
- acceptance validation,
- regression validation,
- premium quality review,
- final evidence/documentation.

## 10.6 Out of scope
- backend migration,
- authentication redesign,
- AI changes,
- payments,
- new product features,
- new dashboard,
- unrelated cleanup.

## 10.7 Backend / architecture allowance
**None.**

## 10.8 M5.1 — Cross-Experience Consistency

**Objective:** Harmonize recurring visual and interaction patterns while preserving each page's distinct job.

**Inspect**
- typography,
- spacing,
- content width,
- surfaces,
- controls,
- disclosure,
- status,
- navigation,
- headings,
- focus,
- loading/empty/error treatment.

**Acceptance**
- repeated patterns are coherent,
- Today remains execution-first,
- Journey remains orientation-first,
- Progress remains evidence-first,
- decoration never weakens hierarchy.

**Regression:** R-10, R-12, R-13.

**Evidence:** EV-13 cross-page consistency review.

## 10.9 M5.2 — Responsive Validation

**Objective:** Verify the hierarchy across supported desktop/mobile widths and realistic content.

**Check**
- project-supported widths,
- narrow viewport behavior,
- overflow,
- wrapping,
- touch targets,
- scrolling,
- sticky controls where present,
- disclosure,
- navigation,
- long goals/labels/content.

Do not invent viewport standards. Use repository/project standards or record a decision.

**Acceptance:** AC-8, AC-18, AC-22, SC-9.

**Evidence:** EV-14 responsive verification record.

## 10.10 M5.3 — Accessibility Validation

**Objective:** Prove redesigned hierarchy and interactions remain accessible.

**Check**
- semantic headings/landmarks,
- keyboard navigation,
- visible focus,
- accessible names,
- disclosure semantics,
- status beyond color,
- contrast,
- reduced motion,
- error/recovery communication.

Use automated tooling where configured and manual checks where automation cannot establish behavior.

**Acceptance:** AC-10, AC-11, AC-16, AC-17, AC-18, SC-10.

**Evidence:** EV-15 accessibility verification record.

## 10.11 M5.4 — Regression & Acceptance Validation

**Objective:** Validate the complete redesign against the Feature Definition acceptance and regression contracts.

**Required**
- map AC-1…AC-24 to evidence,
- map R-1…R-14 to evidence,
- re-check original symptoms:
  - excessive text,
  - competing cards/sections,
  - excessive numbers,
  - excessive actions,
  - excessive simultaneous visibility,
  - cramped sections,
  - unclear first place to look,
  - weak emphasis,
  - overwhelm.

**Validation**
Use repository-confirmed type-check, tests, build, lint if configured, browser checks, responsive checks, accessibility checks, and touched regression checks.

**Evidence:** EV-16 acceptance/regression matrix.

## 10.12 M5.5 — Premium Quality Review

**Objective:** Review the complete experience as one premium product rather than three isolated implementations.

**Review**
- typography,
- composition,
- spacing,
- hierarchy,
- surfaces,
- restrained color,
- controls,
- feedback,
- motion,
- responsiveness,
- accessibility,
- consistency,
- information density.

**Quality test**
The product should feel premium because it is intentional, coherent, and well-composed—not because more visual elements were added.

**Acceptance:** SC-1…SC-10 and applicable AC-1…AC-24.

**Evidence:** EV-17 final quality review and issue register.

## 10.13 P5 exit
- M5.1–M5.5 complete.
- Applicable acceptance criteria have evidence.
- Touched regressions pass.
- Responsive/accessibility checks pass.
- Original density symptoms are materially reduced.
- All three experiences feel coherent.
- No critical carry-over remains.
- Git status is clean after approved commit/push workflow.

---

# 11 — CROSS-PHASE CARRY-OVER

No unresolved work may silently disappear.

Every carry-over records:
- stable issue ID,
- source AC/SC/R/requirement,
- observed evidence,
- impact,
- proposed next milestone,
- blocking status,
- decision.

A carry-over does not automatically expand the next milestone.
Unrelated issues remain out of scope.

---

# 12 — DECISION REGISTER

## OD-1 — Minimum first-view information
Resolve per page/state before page implementation.

## OD-2 — Disclosure mechanism
Choose based on information type and discoverability, not a blanket accordion strategy.

## OD-3 — Visual token refinement
Reuse existing primitives where appropriate; refine only where needed.

## OD-4 — Genuine redundancy
No deletion without evidence.

## OD-5 — State-specific priority
Use the state matrix; do not force one hierarchy onto incompatible states.

## ND rule
Any new decision materially affecting scope, architecture, product behavior, or acceptance must be recorded before implementation proceeds.

---

# 13 — PROMPT ENGINEER CONTRACT

For a selected milestone, Prompt Engineer consumes:
1. this roadmap,
2. the exact milestone,
3. Problem Definition,
4. Solution Exploration,
5. Feature Definition,
6. freshly inspected repository state.

The prompt must include:
- phase/milestone ID,
- objective,
- source requirements,
- current repository evidence,
- exact scope,
- out-of-scope boundaries,
- preservation requirements,
- backend/architecture allowance,
- files/areas to inspect,
- required behavior,
- acceptance criteria,
- repository-confirmed validation,
- regression checks,
- stop conditions,
- carry-over procedure,
- completion report format.

The prompt must not invent product behavior or unsupported implementation requirements.

## 13.1 Stop conditions
Stop and report if:
- a blocking product decision is unresolved,
- required backend/data work is outside the allowance,
- repository behavior contradicts the roadmap,
- scope must expand,
- a critical regression appears,
- useful functionality would need deletion without evidence.

---

# 14 — PHASE REPORT TEMPLATE

```
Phase:
Status:

Objective:

Milestones completed:

Feature Definition requirements satisfied:

Files/components changed:

Behavior intentionally preserved:

Validation:
- type-check
- tests
- build
- lint if configured
- browser
- mobile
- accessibility
- regression

Evidence:

Carry-overs:

Git status:

Review outcome:
```

Never fabricate evidence.

---

# 15 — OVERALL DEFINITION OF DONE

The redesign is complete only when:
- P1–P5 are COMPLETE.
- Today fulfills execution.
- Journey fulfills orientation.
- Progress fulfills evidence.
- Secondary information remains discoverable.
- Original density symptoms are materially reduced.
- Existing useful behavior/data are preserved.
- State handling is intentional.
- Desktop/mobile hierarchy is coherent.
- Accessibility requirements pass.
- No fabricated functionality exists.
- No unapproved backend/data changes exist.
- Acceptance/regression evidence is recorded.
- No critical carry-over remains.
- Git status is clean after approved commit/push workflow.

---

# 16 — TRACEABILITY

```
Problem Definition
  ↓
Solution Exploration / DEC-1
  ↓
Feature Definition
  ├── UX-1…UX-6
  ├── RULE-1…RULE-10
  ├── N-1…N-12
  ├── AC-1…AC-24
  ├── SC-1…SC-10
  └── R-1…R-10
  ↓
P1 Foundation
  ├── M1.1 current-state verification
  ├── M1.2 information-priority matrix
  └── M1.3 premium visual foundation
  ↓
P2 Today
  ├── M2.1 hierarchy
  ├── M2.2 progressive depth
  └── M2.3 state coverage
  ↓
P3 Journey
  ├── M3.1 orientation hierarchy
  ├── M3.2 progressive depth
  └── M3.3 state coverage
  ↓
P4 Progress
  ├── M4.1 evidence hierarchy
  ├── M4.2 progressive depth
  └── M4.3 state coverage
  ↓
P5 QA
  ├── M5.1 consistency
  ├── M5.2 responsive
  ├── M5.3 accessibility
  ├── M5.4 acceptance/regression
  └── M5.5 premium quality
  ↓
Prompt Engineer
  ↓
Implementation Prompt
  ↓
Code + Verification Evidence
```

---

# 17 — ROADMAP QUALITY GATE

Before any milestone is handed to Prompt Engineer:
- [ ] Source requirements identified.
- [ ] Current repository state freshly verified.
- [ ] Objective is one coherent outcome.
- [ ] Scope is explicit.
- [ ] Out-of-scope boundaries are explicit.
- [ ] Preservation is explicit.
- [ ] Backend/architecture allowance is explicit.
- [ ] Touched regressions are identified.
- [ ] Validation is concrete and repository-backed.
- [ ] Blocking decisions are resolved.
- [ ] No unrelated requirements were added.

Before a phase is COMPLETE:
- [ ] Every milestone is complete.
- [ ] Exit criteria are satisfied.
- [ ] Evidence exists.
- [ ] Regressions pass.
- [ ] Carry-overs are recorded.
- [ ] No critical blocker remains.
- [ ] Git status is reported.

---

# 18 — CHANGE LOG

## Version 3.0 — 2026-09-30
Rebuilt the previous short phase map using the actual docs/templates/04-phases.md contract.
Expanded phases into implementation-ready milestones with source, objective, current state, scope, preservation, backend allowance, acceptance, regression, evidence, responsive/accessibility expectations, risks, exit criteria, carry-over discipline, and Prompt Engineer handoff.
Confirmed that no separate “Milestone Definition” document is required.

---

# HANDOFF

**READY FOR IMPLEMENTATION PROMPT GENERATION**

First target:
**P1 / M1.1 — Repository & Current-State Verification**

Prompt Engineer must inspect the repository immediately before generating the prompt.

**Core principle:** Simple by default. Deep when explored.

**Quality ambition:** Premium by design, clear by default, rewarding to use.

