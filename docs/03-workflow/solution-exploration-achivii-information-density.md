# Solution Exploration — Achivii Information Density
**Status:** READY FOR FEATURE DEFINITION
**Version:** 1.0
**Date:** 2026-09-30
**Problem Definition:** docs/03-workflow/problem-definition-achivii-information-density.md
**Problem Version:** 1.0

## 1. Problem Being Solved
Achivii can expose more information, actions, and visual sections than users can easily prioritize at once. This makes page purpose and the most important next understanding/action harder to identify.

**Problem IDs:** P-1, E-1–E-4, CAUSE-1–CAUSE-4, FD-1
**User:** Active Achivii user navigating core destinations
**Desired outcome:** Understand the page's job immediately, identify what matters now, and deliberately explore deeper information when needed.

## 2. Evidence Used
- E-1: User reports excessive text, cards, statistics, actions, simultaneous content, cramped sections, weak emphasis, and overwhelm.
- E-2: Progress currently composes five explicit information layers.
- E-3: Journey currently composes multiple layers including phases, weeks, daily steps, closing stretch, and destination.
- E-4: Active-goal Home routes to Today as the execution destination.
- Today.tsx is a substantial stateful workspace containing goal context, day/week context, review prompts, today's step, benchmarks, completion actions, notes, resources, and optional details.
## 3. Current Design Benchmark — 2026

This solution was cross-checked against current published guidance from Apple and Vercel before Feature Definition. The benchmark is used as a design-quality reference, not as a request to copy another product's visual style.

### Benchmark findings
- **Clarity over minimalism:** simplicity means removing unnecessary interpretation, not merely hiding functionality. Apple's 2026 guidance emphasizes clarity through hierarchy, order, spacing, and contrast.
- **Progressive disclosure:** current Apple guidance explicitly recommends disclosure when too much content or too many choices make information harder to find.
- **Content hierarchy:** important content should appear first; alignment, grouping, spacing, and indentation should communicate relationships.
- **Concise content:** dense lists should use succinct text, with detail available through a deeper view where appropriate.
- **State completeness:** Vercel's current interface guidance explicitly calls for designed empty, sparse, dense, and error states, not just the ideal state.
- **Recovery and next steps:** every screen should provide a clear next step or recovery path.
- **Accessible status:** meaning must not depend on color alone; labels and accessible names must preserve meaning.
- **System consistency:** a coherent design system should encode typography, color, spacing, motion, and component rules so quality does not depend on one-off styling.
- **Craft and restraint:** current Vercel design-engineering guidance emphasizes usefulness, whole-experience ownership, accessibility, and making complexity available without making it required.

### Design implication for Achivii
The benchmark strengthens the selected SOL-4 direction. We should not pursue "minimalism" as an aesthetic goal. We should pursue **clarity, hierarchy, progressive depth, concise content, predictable interaction, and complete state handling**.

**Sources:** Apple Human Interface Guidelines — Layout (updated September 2026); Apple WWDC25/WWDC26 design guidance; Vercel Web Interface Guidelines; Vercel Design Engineer Principles.

## 4. Solution Requirements
REQ-1: Each core page must communicate one dominant job immediately.
Source: P-1, E-1, E-4

REQ-2: The primary information or action required by that page must be visually and cognitively distinguishable from supporting detail.
Source: CAUSE-1, FD-1

REQ-3: Secondary information must remain available when it is useful, rather than being indiscriminately removed.
Source: Desired future state

REQ-4: The default experience should minimize unnecessary interpretation while allowing intentional exploration.
Source: Problem Definition principle

REQ-5: Page behavior must account for different journey states rather than assuming one static information priority.
Source: Time/state considerations

REQ-6: Existing useful execution, orientation, progress, recovery, and review behavior must be preserved unless a feature-level decision explicitly changes it.
Source: Constraints, PRESERVATION requirement

REQ-7: The solution must work responsively and preserve accessibility.
Source: Constraints

## 5. Solution Principles
PRINC-1 — Page job first: organize each destination around the user's immediate question.
PRINC-2 — Primary before secondary: the user should not need to scan the entire page to discover what matters.
PRINC-3 — Simple by default, deep when explored.
PRINC-4 — Reduce decisions, not useful capability.
PRINC-5 — State-aware priority: what matters first may change by user state.
PRINC-6 — Preserve valuable depth without forcing all depth into the initial view.
PRINC-7 — Do not solve density by blindly deleting information.
PRINC-8 — Clarity over visual minimalism: simple means easy to understand and use, not merely sparse.
PRINC-9 — Design every meaningful state: loading, empty, sparse, active, dense, error, recovery, and completion states must have intentional hierarchy.
PRINC-10 — Complexity available, not required: advanced detail should remain accessible without becoming mandatory to understand the page.
PRINC-11 — Content before decoration: typography, spacing, grouping, and contrast should carry hierarchy before cards, borders, badges, or ornament do.
PRINC-12 — System before one-offs: recurring decisions should become reusable design-system rules rather than page-specific styling.
PRINC-13 — Accessibility is part of hierarchy: status and importance must remain understandable without relying on color, motion, or visual position alone.
## 6. Candidate Solution Directions

### SOL-1 — Stronger Information Hierarchy
Make the existing content hierarchy much clearer so primary content dominates and supporting content recedes.

**Addresses:** CAUSE-1, CAUSE-3
**User job:** Quickly identify what matters on the current page.
**Changes:** relative visual prominence, grouping, ordering, emphasis.
**Preserves:** most existing information and functionality.
**Unknown:** Whether hierarchy alone is enough to resolve the reported overwhelm.

### SOL-2 — Progressive Disclosure
Keep useful depth available but move secondary information out of the default attention path until the user chooses to explore it.

**Addresses:** CAUSE-2, CAUSE-4
**User job:** Understand the essential state first without losing access to detail.
**Changes:** visibility and exploration behavior.
**Preserves:** information, if discoverability remains strong.
**Unknown:** Which content users actually need immediately.

### SOL-3 — Page-Role-First Restructuring
Rebuild the information architecture of Today, Journey, and Progress around one dominant user question each.

**Addresses:** CAUSE-1, CAUSE-3
**User job:** Know what this destination is for before interpreting its details.
**Changes:** page composition and content relationships.
**Preserves:** capabilities that support the page's job.
**Unknown:** Exact minimum content per page/state.
### SOL-4 — Combined Direction
Combine page-role-first restructuring with stronger hierarchy and selective progressive disclosure.

**Addresses:** CAUSE-1, CAUSE-2, CAUSE-3, and potentially CAUSE-4.
**User job:** Immediately understand the page purpose, then act or explore without losing useful depth.
**Changes:** page structure, hierarchy, and default visibility.
**Preserves:** deeper capability through deliberate exploration.
**Risk:** The combination could itself become over-engineered if every section receives a new interaction or presentation layer.

## 7. Candidate Evaluation

| Criterion | SOL-1 | SOL-2 | SOL-3 | SOL-4 |
|---|---|---|---|---|
| Problem fit | Strong | Strong | Strong | Strong |
| Cause coverage | Partial | Partial | Strong | Broad |
| User-job fit | Strong | Strong | Strong | Strong |
| Desired outcome | Partial–Strong | Strong | Strong | Strong |
| Preservation | High | High | Medium–High | High if disciplined |
| Complexity | Lower | Medium | Medium–High | Medium–High |
| Main concern | May not reduce density enough | Hidden content may hurt discoverability | Scope can expand into redesign | Can recreate complexity |
| Validation | Straightforward | Requires discoverability testing | Requires page-level comparison | Requires both hierarchy and disclosure validation |
## 8. Tradeoffs

### TRADE-1 — Visibility vs discoverability
Hiding secondary information reduces initial load but can make useful detail harder to find. Any progressive disclosure must make exploration understandable.

### TRADE-2 — Consistency vs state-specific priority
A consistent page structure is easier to learn, but different states may legitimately require different primary content. The solution should preserve a stable mental model while allowing state-specific emphasis.

### TRADE-3 — Preservation vs simplification
Removing existing sections can reduce density but can also remove information users rely on. Simplification should first change prioritization and presentation before deleting useful capability.

### TRADE-4 — Broad redesign vs controlled change
Restructuring all core pages may address the shared problem more coherently, but it increases regression and scope risk. Feature Definition must establish boundaries per page and state.

## 9. Repository / Architecture Implications
ARCH-1: Today is already a stateful execution workspace; the solution should refine its information hierarchy rather than create another dashboard destination.
ARCH-2: Journey has distinct desktop and mobile renderers; any selected direction must specify equivalent information priority across both.
ARCH-3: Progress is composed from separate components, making selective restructuring possible without assuming a backend rewrite.
ARCH-4: The current problem is primarily presentation/information architecture based on available evidence. No backend or data-model change is justified yet.
ARCH-5: Existing UI primitives should be reused where they support the selected experience.
## 10. UX Implications
UX-1: Today should answer **“What do I do now?”** with the user's goal as context, today's session as the main content, and the primary session action clearly identifiable.
UX-2: Journey should answer **“Where am I going, and how does my current week fit into the bigger 12-week journey?”**
UX-3: Progress should answer **“Am I actually getting closer to my goal, and what evidence shows that?”**
UX-4: Secondary content should not compete with the answer to the page's primary question.
UX-5: Empty, loading, error, recovery, review-due, closing-stretch, and completed states need their own information priorities.
UX-6: Mobile and desktop may use different presentation patterns while preserving the same hierarchy and page job.

## 11. Data / State Implications
DATA-1: Prefer existing data where it already supports the user's job.
DATA-2: Do not introduce new data merely to make a page look more informative.
DATA-3: If a proposed solution needs a new persisted state, Feature Definition must justify why existing state is insufficient.
DATA-4: Current evidence does not justify removing or restructuring backend data as part of the solution.
## 12. Preservation
PRESERVE-1: Today's ability to start/complete sessions and access necessary session detail.
PRESERVE-2: Journey's ability to understand the full 12-week plan and current position.
PRESERVE-3: Progress's meaningful evidence, including completion, benchmarks, and adaptation history where applicable.
PRESERVE-4: Recovery, review, test-day, rest-day, and closing-stretch states.
PRESERVE-5: Responsive and accessible behavior.
PRESERVE-6: Intentional access to secondary information that remains valuable.

## 13. Risks
RISK-SOL-1: Over-simplification hides information users need.
Mitigation: define preservation and discoverability requirements before implementation.

RISK-SOL-2: Progressive disclosure creates "where did that go?" confusion.
Mitigation: validate labels, affordances, and findability.

RISK-SOL-3: A broad redesign introduces unrelated visual changes.
Mitigation: keep the solution scoped to the defined information-density problem.

RISK-SOL-4: Different pages receive inconsistent hierarchy.
Mitigation: establish shared principles plus page-specific primary questions.

RISK-SOL-5: The combined direction becomes as complex as the original experience.
Mitigation: use disclosure selectively; do not create an interaction for every secondary section.
## 14. Assumptions / Unknowns
ASSUMP-SOL-1: Users generally benefit from retaining deeper information when they intentionally seek it.
ASSUMP-SOL-2: The problem can be materially improved without a backend rewrite.
ASSUMP-SOL-3: The three core page jobs are stable product concepts.
ASSUMP-SOL-4: The perceived problem is partly caused by presentation/hierarchy rather than only by content quality.

Blocking unknowns for exact implementation:
- minimum first-view information per page/state
- which secondary sections are genuinely used
- exact mobile/desktop differences in perceived density
- whether any information is redundant across destinations
## 15. Validation Plan
VAL-1: Compare each page against its single immediate question. A reviewer should be able to state the page's job without scanning the full page.
VAL-2: Test whether the primary action/understanding can be identified before secondary content is explored.
VAL-3: Test whether secondary information remains findable after disclosure.
VAL-4: Review representative states, not only the default active state.
VAL-5: Verify mobile and desktop preserve the same information priority.
VAL-6: Run existing frontend tests plus targeted tests for changed interaction/state behavior.
VAL-7: Re-check the original symptom list after implementation: text volume, competing cards/sections, numbers, actions, simultaneous visibility, cramped areas, first-look uncertainty, weak emphasis, and overwhelm.

Validation does not require proving that the page is aesthetically better. It requires evidence that the defined problem is reduced without unacceptable loss of useful capability.

## 16. Decision
**DEC-1 — SELECTED WITH CONDITIONS**

Selected direction: **SOL-4, the combined direction**, constrained by page-role-first restructuring and selective progressive disclosure.

Reasoning:
- The evidence indicates a cross-page problem, so treating only individual styling/hierarchy is unlikely to address the full issue.
- Page purpose is central to the desired experience and provides a stable organizing principle.
- Progressive disclosure directly addresses the complaint that too many things are visible simultaneously.
- Stronger hierarchy prevents disclosure from becoming the only mechanism and keeps the primary content obvious.
- The combination must remain disciplined so that the solution itself does not introduce unnecessary interactions or complexity.
## 17. Accepted Tradeoffs
- Some secondary information may require an intentional exploration step.
- Different states may expose different primary content.
- Page restructuring may require changes across multiple existing components.
- The first implementation may need validation and iteration before the information boundary is correct.

## 18. Rejected / Deferred Alternatives

ALT-1 — "Just delete information"
Status: Rejected
Reason: The problem is prioritization and comprehension, not proven information redundancy. Deletion could remove valuable capability.

ALT-2 — "Only restyle cards"
Status: Deferred
Reason: Styling may help, but the evidence points to page purpose, hierarchy, and simultaneous visibility as broader concerns.

ALT-3 — "Build a new dashboard"
Status: Rejected
Reason: The problem affects the relationship between existing core destinations. Adding another information surface risks increasing duplication.

ALT-4 — "Redesign everything at once"
Status: Deferred
Reason: The solution should address the defined problem without turning it into unrelated product-wide redesign.

## 19. Selected Solution Direction
**Name:** Purpose-first, progressive-depth core workspace

**Core approach:** Reorganize each core destination around one dominant user question; establish a strong default hierarchy; selectively defer secondary detail until intentional exploration.

**Primary behavior change:** Users should understand what the page is for and what matters first without scanning all available information.

**Secondary behavior:** Users can deliberately explore deeper plan, journey, or progress information without losing access to it.

**Intentionally not solved:** unrelated dashboard duplication, weekly target data-model gaps, AI quality, migration, payment infrastructure, and unrelated technical defects.

**Dependencies:** Feature Definition must inspect the relevant page states and determine exact information priority.

**Constraints:** preserve useful functionality, accessibility, responsive behavior, and intentional access to valuable detail.
## 20. Feature Definition Handoff
FD-1: Define the minimum information required for Today to fulfill "What do I do now?" across its relevant states.
FD-2: Define the minimum information required for Journey to fulfill "Where am I going?" while retaining meaningful 12-week context.
FD-3: Define the minimum information required for Progress to fulfill "How am I doing?" using meaningful evidence rather than indiscriminate metrics.
FD-4: Define which information is primary, secondary, and exploratory for each page/state.
FD-5: Define disclosure behavior and discoverability for secondary information.
FD-6: Define exact states, rules, responsive behavior, accessibility requirements, and preservation requirements.
FD-7: Identify any content that is genuinely redundant versus merely secondary.
FD-8: Define acceptance criteria tied back to the original problem symptoms.
FD-9: Determine whether any architecture/data changes are actually required after feature-level investigation.
FD-10: Keep implementation details out until the feature behavior is fully specified.

## 21. Readiness
**READY FOR FEATURE DEFINITION**

Quality gate:
- [x] Problem Definition referenced
- [x] Evidence separated from hypotheses
- [x] Multiple materially different directions considered
- [x] Solution principles explicit
- [x] Tradeoffs explicit
- [x] Constraints respected
- [x] Preservation explicit
- [x] Architecture implications understood at decision level
- [x] Data/state implications identified
- [x] Risks recorded
- [x] Validation defined
- [x] Rejected/deferred alternatives recorded
- [x] Feature Definition handoff complete
## 22. Traceability
```
P-1
 ↓
E-1 / E-2 / E-3 / E-4
 ↓
USER-1 / desired future state
 ↓
CAUSE-1 / CAUSE-2 / CAUSE-3 / CAUSE-4
 ↓
REQ-1 … REQ-7
 ↓
PRINC-1 … PRINC-7
 ↓
SOL-1 / SOL-2 / SOL-3 / SOL-4
 ↓
TRADE-1 … TRADE-4
 ↓
DEC-1
 ↓
FD-1 … FD-10
```

## 23. Core Product Principle
> **Simple by default. Deep when explored.**

## Handoff Contract
This artifact selects a defensible product solution direction. It does not yet define the exact feature behavior.

Feature Definition now owns the exact capability, states, rules, information boundaries, interactions, responsive behavior, acceptance criteria, preservation, and done definition.

Phases must consume the resulting Feature Definition rather than reinterpret this solution decision.

Implementation prompts must consume the approved Feature Definition and current repository state rather than inventing product behavior.
