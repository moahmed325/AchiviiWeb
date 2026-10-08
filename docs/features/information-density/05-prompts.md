# Achivii — IMPLEMENTATION PROMPTS
**Version:** 1.0 | **Date:** 2026-09-30
**Roadmap:** docs/features/information-density/04-phases.md
**Feature:** docs/features/information-density/03-feature.md
**Solution:** docs/features/information-density/02-solution.md
**Template:** the old prompts template (retired 2026-10-08). Shared rules for implementing a milestone: `CLAUDE.md` ("Working on a milestone")

# 0 — PURPOSE & OPERATING CONTRACT
This document translates every roadmap milestone into a detailed, copy-paste-ready implementation prompt. The roadmap defines WHAT/WHY/ORDER; this document defines HOW an implementation agent should execute one approved milestone.

## Universal role
You are an implementation agent working on Achivii. You are responsible only for the milestone named in the prompt. Inspect the repository before editing and use current repository evidence rather than stale assumptions.

## Source-of-truth order
1. Current repository = what exists now.
2. Feature Definition = approved product behavior.
3. Solution Exploration = selected direction, principles, tradeoffs.
4. Phases = implementation order, milestone scope, acceptance, regressions.
5. Decisions/design/testing docs = persistent project rules when present.

If sources conflict, stop, identify the discrepancy, and ask for clarification when it materially affects scope. Never silently invent requirements.

## Universal execution sequence
1. Inspect git status.
2. Read assigned milestone and relevant source documents.
3. Inspect actual files/routes/components/data/tests.
4. Confirm current state and previous milestone evidence.
5. Implement only the assigned milestone.
6. Verify preservation and acceptance criteria.
7. Run repository-supported validation.
8. Record evidence, limitations, carry-overs, and git status.
9. Do not commit/push unless explicitly instructed.

## Universal preservation
Do not change backend/API/database/auth/data contracts unless explicitly permitted. This redesign has **no backend allowance by default**. Do not delete useful information merely to make a page look cleaner. Deferred information must remain discoverable.

## Universal quality
Premium = typography + composition + spacing + hierarchy + restrained color + coherent surfaces + polished controls + meaningful feedback + subtle motion + consistency. Do not add decoration that competes with the primary job.

## Universal stop conditions
Stop before implementation if a blocking product decision is unresolved; current behavior contradicts a requirement materially; backend/data work appears necessary; useful functionality would need deletion without evidence; unrelated refactoring becomes necessary; a critical regression appears; or scope must expand.

## Universal final report
Report milestone/status; objective; requirements completed/not completed; files changed; behavior/data preserved; implementation summary; exact tests/type-check/build/lint/E2E/manual/browser/responsive/accessibility results where applicable; acceptance evidence; regression evidence; documentation changes; carry-overs; risks/limitations; git status; final COMPLETE/PARTIAL/BLOCKED state.

# 1 — P1 FOUNDATION

## M1.1 — Repository & Current-State Verification
### ROLE
You are the repository-verification and implementation-planning agent for Achivii P1/M1.1. Do not redesign anything.

### CONTEXT
The approved direction is Purpose-first, progressive-depth core workspace. Today = execution, Journey = orientation, Progress = evidence. The current product has substantial information density and the repository must be verified before redesign.

### OBJECTIVE
Create an evidence-backed map of current routes, components, information layers, states, actions, reusable UI, styling, responsive behavior, accessibility patterns, tests, and validation tooling.

### INSPECT FIRST
Verify:
- frontend/src/pages/Home.tsx
- frontend/src/pages/RoadmapPage.tsx
- frontend/src/pages/ProgressPage.tsx
- frontend/src/components/today/
- frontend/src/components/journey/
- frontend/src/components/progress/
- frontend/src/components/ui/
- frontend/src/index.css
- package/workspace scripts
- routing and relevant tests/configuration

### REQUIREMENTS
R1. Map Today entry and active-goal behavior.
R2. Map Journey route and desktop/mobile renderers.
R3. Map Progress layers and child components.
R4. Record default visible information and actions.
R5. Record meaningful loading/empty/error/recovery/completion/state variants.
R6. Inventory reusable UI primitives and repeated patterns.
R7. Inventory typography, spacing, surfaces, colors, controls, focus, responsive, motion conventions.
R8. Identify tests and actual supported validation commands.
R9. Record constraints/discrepancies relevant to P2–P5.
R10. Do not alter runtime behavior.

### OUT OF SCOPE
No page redesign, backend change, global cleanup, new components, new dashboard, unrelated bug fixes.

### DELIVERABLE
EV-1: repository-grounded report containing route/component/state/action maps, reusable UI inventory, design inventory, responsive/accessibility inventory, validation inventory, discrepancies and risks.

### DONE
M1.1 is complete only when every material assumption needed by M1.2/M1.3 is verified or explicitly marked unknown.

## M1.2 — Information-Priority Matrix
### ROLE
You are the product/UX implementation agent for P1/M1.2. Do not implement the page redesign.

### OBJECTIVE
Translate EV-1 plus the Feature Definition into explicit primary, secondary, and exploratory information rules for every representative state.

### REQUIREMENTS
R1. For each state define the primary user question.
R2. Define primary content.
R3. Define primary action/next step.
R4. Define secondary content.
R5. Define exploratory content.
R6. Define discoverability path for deferred content.
R7. Mark content that must remain visible.
R8. Mark genuinely redundant content only when evidence supports it.
R9. Record unresolved decisions instead of guessing.
R10. Account for state-specific priority.

### STATE COVERAGE
Today: loading, no goal, practice, key, test, rest, minimum, done, recovery, review due/failed, closing stretch, completed, offline/error.
Journey: loading, no journey, active, active phase/week, completed phases, upcoming, closing stretch, completed.
Progress: loading, no journey, early/little evidence, active evidence, dense history, completed, error.

### OUT OF SCOPE
No full redesign, API/database changes, new persisted state, blind deletion, or blanket accordion strategy.

### DELIVERABLE
EV-2: state-by-state priority matrix + decision register mapping relevant ACs/regressions.

### DONE
Every representative state has an explicit priority model and all blocking information-boundary decisions are resolved or explicitly non-blocking.

## M1.3 — Premium Visual Foundation
### ROLE
You are the UI/design-system implementation agent for P1/M1.3.

### OBJECTIVE
Establish reusable visual rules for P2–P4 so Achivii feels premium, calm, modern, intentional and visually appealing without recreating density.

### REQUIREMENTS
R1. Inspect existing tokens/primitives first.
R2. Define/refine typography hierarchy.
R3. Define/refine spacing/rhythm and content width.
R4. Define alignment and grouping rules.
R5. Define surface/border/radius/elevation hierarchy.
R6. Define semantic color roles and non-color status cues.
R7. Define controls and focus.
R8. Define disclosure patterns.
R9. Define responsive composition rules.
R10. Define motion/reduced-motion rules.
R11. Prefer reusable patterns over one-offs.

### PREMIUM CONSTRAINT
Hierarchy must work before decoration. Do not add gradients/glass/badges/animation merely to appear premium.

### OUT OF SCOPE
No full page redesign, backend/data changes, UI-library introduction without evidence, or unrelated global cleanup.

### DELIVERABLE
EV-3: implementable visual foundation/reusable-pattern specification; make only minimum shared primitive changes required by verified repository state.

### DONE
P2–P4 agents can implement consistently without inventing a new visual language.

# 2 — P2 TODAY / EXECUTION

## M2.1 — Today Default Hierarchy
### ROLE
You are the frontend agent for P2/M2.1.

### OBJECTIVE
Recompose Today so the first attention path answers “What do I do now?” with goal context, today's session, and the primary action.

### REQUIREMENTS
R1. Establish one dominant attention path.
R2. Keep goal context visible without competing with execution.
R3. Make current session unmistakable.
R4. Make Start/primary action immediately identifiable.
R5. Preserve required session details.
R6. Reduce simultaneous secondary content only where EV-2 permits.
R7. Preserve navigation and persistent context.
R8. Apply the P1 visual foundation without decorative overload.

### PRESERVE
Goal loading, current session, steps, notes, timer/focus, required resources, completion, review, recovery, navigation, persistent state.

### LIKELY AREAS
Verify Today.tsx, Today child components, Home.tsx, shared UI, tests.

### OUT OF SCOPE
No generation/task model, API/data changes, analytics, new dashboard, Journey/Progress redesign, unrelated refactor.

### VALIDATION
Verify first-view purpose/action, start/complete flow, required detail, representative desktop/mobile, keyboard/focus.

### EVIDENCE
EV-4 hierarchy walkthrough + primary-flow regression evidence.

### DONE
Today is clearly execution-first and existing execution behavior remains functional.

## M2.2 — Today Progressive Depth
### ROLE
You are the frontend agent for P2/M2.2.

### OBJECTIVE
Move approved secondary Today information out of the initial attention path while keeping it discoverable and functional.

### REQUIREMENTS
R1. Use EV-2; do not redefine priorities.
R2. Identify approved secondary content.
R3. Select disclosure by content type.
R4. Make deferred content discoverable with clear labels/affordances.
R5. Keep primary session/action visible.
R6. Preserve context when expanded.
R7. Preserve keyboard/focus semantics.
R8. Preserve non-color status meaning.
R9. Preserve reduced-motion equivalence.
R10. Never hide must-remain-visible information.

### OUT OF SCOPE
No backend/persistence changes, blanket accordion behavior, blind deletion, new dashboard, Journey/Progress changes.

### VALIDATION
Default state, explored state, navigation, keyboard, mobile, long content, affected error/recovery.

### EVIDENCE
EV-5 default/explored walkthrough + discoverability/accessibility/regression results.

### DONE
Secondary information is findable without competing with Today’s primary job.

## M2.3 — Today State Coverage
### ROLE
You are the frontend state-coverage agent for P2/M2.3.

### OBJECTIVE
Apply purpose-first hierarchy to every meaningful Today state.

### STATES
Loading; no goal; practice; key session; test; rest; minimum version; done; yesterday pending/recovery; review due/failed; closing stretch; completed goal; API offline; goal-load error.

### REQUIREMENTS
R1. Every state has a clear primary message.
R2. Actionable states have an obvious next step.
R3. State-specific primary needs may change.
R4. Existing execution/review/recovery behavior remains.
R5. Errors explain and recover.
R6. Completion remains honest.
R7. Deferred information remains discoverable.
R8. Responsive/accessibility behavior remains coherent.

### OUT OF SCOPE
No new lifecycle states, generation changes, review-rule changes, backend work, unrelated pages.

### VALIDATION
Exercise every deterministic state possible with existing fixtures/mocks/live-safe methods. Distinguish inspected states from actually exercised states.

### EVIDENCE
EV-6 state matrix + tests/manual results + regressions.

### DONE
All required states have intentional hierarchy and no critical execution/recovery regression.

# 3 — P3 JOURNEY / ORIENTATION

## M3.1 — Journey Orientation Hierarchy
### ROLE
You are the frontend agent for P3/M3.1.

### OBJECTIVE
Make Journey immediately communicate destination, current position, current week, and the current week’s role in the 12-week arc.

### INSPECT
Verify RoadmapPage.tsx, JourneyHeader, StrategicRoadmap, DesktopStaircase, MobileVerticalJourney, journey data/hooks, shared UI, tests.

### REQUIREMENTS
R1. Destination is clear.
R2. Current position is clear.
R3. Current week is unmistakable.
R4. Current week’s role in the larger journey is understandable.
R5. User need not scan the full roadmap for these answers.
R6. Preserve meaningful 12-week journey.
R7. Preserve future-content honesty.
R8. Preserve equivalent desktop/mobile hierarchy.

### OUT OF SCOPE
No plan-generation changes, new roadmap model, backend/data changes, fabricated future sessions, new dashboard.

### VALIDATION
Desktop/mobile orientation walkthrough, future-honesty check, navigation/persistence, relevant accessibility.

### EVIDENCE
EV-7.

### DONE
Destination/current position/current week are understandable without full-roadmap scanning.

## M3.2 — Journey Progressive Depth
### ROLE
You are the frontend agent for P3/M3.2.

### OBJECTIVE
Preserve meaningful Journey depth while making it intentional rather than simultaneously demanding attention.

### REQUIREMENTS
R1. Preserve phases.
R2. Preserve weeks.
R3. Preserve meaningful generated daily detail.
R4. Preserve milestones/important roadmap detail.
R5. Preserve closing stretch.
R6. Preserve destination/summit context.
R7. Apply EV-2 disclosure decisions.
R8. Make exploration discoverable.
R9. Preserve context when detail opens.
R10. Never fabricate future daily sessions.
R11. Preserve same hierarchy across desktop/mobile.

### OUT OF SCOPE
No AI planning changes, missing-task generation, persistence changes, backend work, blind deletion.

### VALIDATION
Default Journey, current week, deeper views, future weeks, daily detail, closing stretch, mobile, keyboard, refresh/navigation.

### EVIDENCE
EV-8.

### DONE
Full meaningful Journey remains accessible without recreating simultaneous-density overload.

## M3.3 — Journey State Coverage
### ROLE
You are the frontend state-coverage agent for P3/M3.3.

### OBJECTIVE
Apply orientation-first hierarchy to all Journey states.

### STATES
Loading; no journey; active; completed phases; active phase/week; upcoming weeks; closing stretch; completed journey; relevant errors/recovery discovered in current implementation.

### REQUIREMENTS
R1. Each state has an intentional primary orientation message.
R2. Active state clearly communicates position.
R3. Empty state explains missing state and next step.
R4. Completed state is honest.
R5. Upcoming content never implies unavailable daily detail.
R6. Closing stretch remains understandable.
R7. Desktop/mobile hierarchy is equivalent.
R8. Accessibility remains usable.

### OUT OF SCOPE
No lifecycle expansion, planning/backend changes, fabricated content, unrelated pages.

### EVIDENCE
EV-9 state matrix + responsive/accessibility/regression results.

### DONE
Journey states preserve orientation, honesty, and discoverability.

# 4 — P4 PROGRESS / EVIDENCE

## M4.1 — Progress Evidence Hierarchy
### ROLE
You are the frontend agent for P4/M4.1.

### OBJECTIVE
Make Progress immediately answer “Am I actually getting closer, and what evidence shows that?”

### CURRENT CONTEXT
Progress currently composes CompletionOverview, PhaseMilestonesCard, WeekBreakdownList, BenchmarkResultsCard, and AdaptationHistoryList. CompletionOverview exposes multiple metrics. Do not assume metric quantity equals importance.

### REQUIREMENTS
R1. Establish the primary progress story using existing evidence.
R2. Establish current position.
R3. Show meaningful supporting evidence first.
R4. Do not promote metrics merely because they exist.
R5. Preserve meaningful completion evidence.
R6. Preserve meaningful benchmark evidence.
R7. Preserve meaningful adaptation evidence.
R8. Never imply stronger evidence than the data supports.

### OUT OF SCOPE
No new analytics, metric algorithms, benchmark/adaptation logic, invented scores, backend changes.

### VALIDATION
Representative active journey; identify progress story/evidence without scanning full page.

### EVIDENCE
EV-10 first-view walkthrough + evidence rationale + regression.

### DONE
Main progress story is obvious and evidence remains meaningful.

## M4.2 — Progress Progressive Depth
### ROLE
You are the frontend agent for P4/M4.2.

### OBJECTIVE
Keep detailed breakdowns, historical metrics, benchmarks and adaptation history available without forcing them into the initial attention path.

### REQUIREMENTS
R1. Preserve useful detailed evidence.
R2. Defer dense history where EV-2 permits.
R3. Keep deeper information findable.
R4. Use clear exploration labels/affordances.
R5. Preserve context when expanded.
R6. Keep historical evidence understandable.
R7. Do not automatically create disclosure everywhere.
R8. Do not delete useful evidence solely for density.
R9. Ensure mobile exploration is operable.

### OUT OF SCOPE
No analytics, metric calculation, persistence, fabricated history, blind hiding.

### VALIDATION
Normal active evidence, dense history, default/explored state, mobile, keyboard/focus, completion where affected.

### EVIDENCE
EV-11 default/explored + dense-history + discoverability + regression.

### DONE
History remains accessible while Progress stays evidence-first.

## M4.3 — Progress State Coverage
### ROLE
You are the frontend state-coverage agent for P4/M4.3.

### OBJECTIVE
Keep Progress meaningful and honest across sparse, active, dense, complete and error states.

### STATES
Loading; no journey; early/little evidence; active evidence; dense historical evidence; completed goal; load error.

### REQUIREMENTS
R1. Sparse evidence is honest.
R2. Never manufacture confidence/progress.
R3. Early journey explains available evidence and next step.
R4. Active evidence preserves main story.
R5. Dense history does not dominate.
R6. Completion is honest.
R7. Errors explain and recover.
R8. Responsive/accessibility behavior remains intact.

### OUT OF SCOPE
No new metrics/analytics, data generation, completion lifecycle, backend changes.

### EVIDENCE
EV-12 state matrix + sparse/dense/completion/error verification + regression/accessibility.

### DONE
Progress remains meaningful and honest in every required state.

# 5 — P5 CROSS-EXPERIENCE QA

## M5.1 — Cross-Experience Consistency
### ROLE
You are the cross-experience UI quality agent for P5/M5.1.

### OBJECTIVE
Make Today, Journey and Progress feel like one coherent premium product without making their jobs identical.

### REQUIREMENTS
R1. Compare typography.
R2. Compare spacing/rhythm.
R3. Compare content width/alignment.
R4. Compare surfaces/borders/radii/elevation.
R5. Compare controls/focus.
R6. Compare disclosure.
R7. Compare status treatment.
R8. Compare navigation.
R9. Compare loading/empty/error patterns.
R10. Preserve Today=execution, Journey=orientation, Progress=evidence.
R11. Fix only scoped inconsistency that improves coherence.

### OUT OF SCOPE
No generic dashboard, unrelated global refactor, or decorative consistency that weakens hierarchy.

### VALIDATION
Review all three experiences at representative desktop/mobile states and verify that shared patterns are consistent while page roles remain distinct.

### EVIDENCE
EV-13: cross-page consistency review, exceptions/rationale, regression results.

### DONE
Shared patterns are coherent, page jobs remain distinct, and no consistency change recreates information overload.

---

## M5.2 — Responsive Validation
### ROLE
You are the responsive validation agent for P5/M5.2.

### OBJECTIVE
Verify hierarchy and operability across repository-supported desktop/mobile widths and realistic content.

### REQUIREMENTS
R1. Inspect project viewport conventions before testing.
R2. Validate desktop.
R3. Validate mobile.
R4. Validate narrow widths.
R5. Check horizontal overflow.
R6. Check wrapping of long goals, labels, buttons and content.
R7. Check touch-target operability.
R8. Check scrolling/sticky elements where present.
R9. Check disclosure and navigation.
R10. Confirm mobile is intentional, not merely compressed desktop.
R11. Confirm same information priority across responsive compositions.

### CONSTRAINT
Do not invent viewport standards. Use repository standards or record an explicit decision.

### VALIDATION
Exercise realistic long content and all three core experiences. Record exact viewports used.

### EVIDENCE
EV-14: viewport matrix, findings, fixes, remaining issues, exact results.

### DONE
No critical overflow/operability issue remains and hierarchy survives responsive composition.

---

## M5.3 — Accessibility Validation
### ROLE
You are the accessibility validation agent for P5/M5.3.

### OBJECTIVE
Prove redesigned hierarchy/interactions remain accessible.

### REQUIREMENTS
R1. Semantic headings/landmarks.
R2. Keyboard navigation.
R3. Visible focus.
R4. Accessible names.
R5. Disclosure semantics.
R6. Status beyond color.
R7. Contrast using supported tooling.
R8. Reduced motion.
R9. Error/recovery communication.
R10. Hierarchy must not depend solely on position, color, imagery or motion.

### VALIDATION
Use configured automated tooling where available and manual checks where automation cannot establish behavior. Never claim a pass from static inspection alone.

### EVIDENCE
EV-15: automated results where available, manual checks, issues/fixes/limitations.

### DONE
Required accessibility checks pass with no critical accessibility regression.

---

## M5.4 — Regression & Acceptance Validation
### ROLE
You are the final acceptance/regression validation agent for P5/M5.4.

### OBJECTIVE
Validate the entire redesign against the Feature Definition acceptance/success criteria and roadmap regression contract.

### REQUIREMENTS
R1. Map AC-1…AC-24 to actual evidence.
R2. Map SC-1…SC-10 to actual evidence.
R3. Map R-1…R-14 to actual verification.
R4. Re-check original symptoms: excessive text; cards/sections; numbers; actions; simultaneous visibility; cramped layout; unclear first place; weak emphasis; overwhelm.
R5. Validate Today execution.
R6. Validate Journey completeness and future honesty.
R7. Validate Progress evidence.
R8. Validate navigation/persistence.
R9. Validate relevant loading/empty/error/recovery/completion states.
R10. Use repository-supported commands only.

### RESULT CLASSIFICATION
Each criterion must be PASS, FAIL, BLOCKED or N/A with evidence. Never mark PASS without verification.

### VALIDATION LAYERS
Use applicable type-check, unit/component/integration tests, E2E, build, lint, browser/manual, responsive, accessibility and safe live checks.

### EVIDENCE
EV-16: acceptance + regression matrix.

### DONE
Every applicable criterion has evidence and no critical regression remains.

---

## M5.5 — Premium Quality Review
### ROLE
You are the final product-quality reviewer for P5/M5.5.

### OBJECTIVE
Review Today, Journey and Progress as one premium product.

### REVIEW
Typography; composition; spacing; hierarchy; surfaces; restrained color; controls; feedback; motion; responsive behavior; accessibility; consistency; information density; execution friction.

### REQUIREMENTS
R1. Verify each page purpose is immediately understandable.
R2. Verify primary content is obvious before exploration.
R3. Verify deeper information is discoverable.
R4. Verify premium craft reinforces hierarchy.
R5. Identify visual polish that accidentally recreates density.
R6. Identify simplification that removed useful capability.
R7. Verify the three experiences feel related without becoming identical.
R8. Verify sparse/dense/error states remain calm and useful.

### OUT OF SCOPE
No new features, backend/data changes, unrelated redesign, or decoration-only work.

### EVIDENCE
EV-17: final quality review, issue register, before/after observations, acceptance impact, limitations. Separate objective defects from subjective preferences.

### DONE
The complete experience meets the roadmap's premium quality bar without sacrificing clarity, functionality, responsiveness or accessibility.

# 6 — PHASE PROMPT MODE

If asked for a phase prompt, do not automatically merge all milestones into one implementation task. Inspect the current phase status, identify the next incomplete milestone, and generate that milestone prompt.

Only create a full-phase orchestration prompt when explicitly requested. It must:
- execute milestones in dependency order;
- verify after each milestone;
- preserve carry-overs;
- stop at blockers;
- never let one milestone silently absorb the next;
- use current repository state before every implementation step.

# 7 — DYNAMIC PROMPT GENERATION

When the user asks “Give me the prompt for M<X.Y>”:
1. Read phases.md.
2. Read the exact milestone.
3. Read relevant Feature Definition sections.
4. Read relevant Solution Exploration decisions/principles.
5. Inspect current repository state.
6. Inspect previous completion evidence and carry-overs.
7. Verify files, routes, scripts and tests.
8. Start from the matching prompt in this document.
9. Replace stale repository assumptions with current verified facts.
10. Produce ONE copy-paste-ready prompt.

The stored prompts are structured baselines, not substitutes for current-state inspection.

# 8 — IMPLEMENTATION TEMPLATE COMPLIANCE

Every generated prompt must contain, where relevant:
- ROLE
- PROJECT CONTEXT
- CURRENT STATE
- OBJECTIVE
- NUMBERED REQUIREMENTS
- EXISTING BEHAVIOR THAT MUST REMAIN UNCHANGED
- FILES / AREAS TO INSPECT
- IMPLEMENTATION GUIDANCE
- EXPLICIT OUT OF SCOPE
- DEPENDENCIES
- VALIDATION
- REGRESSION CHECKS
- DOCUMENTATION
- STOP CONDITIONS
- FINAL REPORT

Do not omit a section merely because the milestone seems simple. State “None” when a category genuinely has no requirements.

# 9 — IMPLEMENTATION GUIDANCE RULES

The coding agent should:
- inspect before editing;
- prefer existing components/primitives;
- avoid unnecessary dependencies;
- preserve current architecture;
- make the smallest coherent change that satisfies the milestone;
- add tests when existing test strategy supports them;
- verify visual changes manually when automated tests cannot establish hierarchy;
- avoid broad refactoring;
- record decisions instead of guessing.

For UI work, solve information hierarchy before decoration.

# 10 — DOCUMENTATION & COMPLETION

After implementation, update the phase milestone completion report according to workflow.

Update design.md only if a persistent design rule was established.
Update decisions.md for material product/architecture decisions.
Update testing.md only if testing strategy changed.

A milestone is COMPLETE only when:
- requirements pass;
- required validation passes;
- manual evidence required by the milestone exists;
- regressions are acceptable;
- carry-overs are recorded;
- required docs are updated;
- git status is reported.

# 11 — TRACEABILITY

```
Problem Definition
  ↓
Solution Exploration / DEC-1
  ↓
Feature Definition
  ↓
Phases
  ↓
P1: M1.1 → EV-1 | M1.2 → EV-2 | M1.3 → EV-3
P2: M2.1 → EV-4 | M2.2 → EV-5 | M2.3 → EV-6
P3: M3.1 → EV-7 | M3.2 → EV-8 | M3.3 → EV-9
P4: M4.1 → EV-10 | M4.2 → EV-11 | M4.3 → EV-12
P5: M5.1 → EV-13 | M5.2 → EV-14 | M5.3 → EV-15
    M5.4 → EV-16 | M5.5 → EV-17
  ↓
Code
  ↓
Verification
  ↓
Updated Project State
  ↓
Next Prompt
```

# 12 — MASTER QUALITY GATE

Before emitting any implementation prompt, verify:
- [ ] Exact milestone exists in phases.md.
- [ ] Current status is known.
- [ ] Previous milestone/carry-over context is known.
- [ ] Objective is explicit.
- [ ] Requirements are numbered.
- [ ] Preservation is explicit.
- [ ] Scope and non-scope are explicit.
- [ ] Affected areas are repository-verified.
- [ ] Backend/architecture allowance is explicit.
- [ ] Validation is repository-aware.
- [ ] Regression risks are explicit.
- [ ] Stop conditions are explicit.
- [ ] Final report is explicit.
- [ ] No invented requirements exist.
- [ ] No stale repository facts are presented as current truth.

# HANDOFF

**READY FOR MILESTONE PROMPT GENERATION**

First executable milestone:
**P1 / M1.1 — Repository & Current-State Verification**

The next prompt must always be regenerated against the latest repository state and completion evidence.

**Core principle:** Simple by default. Deep when explored.
**Quality ambition:** Premium by design, clear by default, rewarding to use.

