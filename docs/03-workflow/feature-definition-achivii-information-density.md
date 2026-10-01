# Achivii Core Experience — FEATURE DEFINITION

**Status:** READY FOR PHASE DEFINITION
**Version:** 1.0
**Date:** 2026-09-30
**Problem Definition:** docs/03-workflow/problem-definition-achivii-information-density.md
**Solution Exploration:** docs/03-workflow/solution-exploration-achivii-information-density.md

## 1. Overview

### Feature
Purpose-first, progressive-depth redesign of Achivii's three core experiences: Today, Journey, and Progress.

### Problem
Achivii can expose more information, actions, and visual sections than users can easily prioritize at once. The result can feel full, cramped, and difficult to interpret.

### Desired outcome
Each core destination should communicate its job immediately, feel premium and visually intentional, and let users explore useful depth without requiring that depth to be understood upfront.

### Target user
An authenticated Achivii user with an active goal/journey.

### Motivation
Achivii should feel like a polished premium product while remaining calm, useful, and easy to understand. Visual appeal must reinforce hierarchy rather than compete with it.

## 2. User Goal

As an Achivii user, I want each page to make its purpose and most important content immediately obvious, so that I can act or understand my progress without feeling overwhelmed while still being able to explore deeper information when I want it.

## 3. Core User Actions

- **Today:** understand today's task and start/complete the session.
- **Journey:** understand the 12-week destination, current position, and how the current week fits the larger journey.
- **Progress:** understand whether progress is being made and inspect meaningful evidence.
- **Explore:** intentionally reveal secondary information when it is useful.
- **Navigate:** move between Today, Journey, and Progress without losing context.
## 4. Primary User Journey

### Today
Open Achivii → immediately recognize today's purpose → understand the current goal/session → start the session → complete or recover from the day → optionally explore secondary detail.

### Journey
Open Journey → immediately understand the destination and current position → understand the current week in the 12-week arc → optionally explore phases/weeks and deeper roadmap detail.

### Progress
Open Progress → immediately understand the overall progress state → see the most meaningful evidence → optionally inspect detailed breakdowns, benchmarks, and adaptation history.

## 5. Entry Points

| ID | Entry point | Required behavior |
|---|---|---|
| EP-1 | Today / home | Remains the primary execution destination for an active goal. |
| EP-2 | Journey / roadmap | Opens the orientation experience. |
| EP-3 | Progress | Opens the evidence/analytics experience. |
| EP-4 | Contextual links | Preserve useful navigation between core experiences. |

No new dashboard destination is introduced.

## 6. Core Concepts

**Today:** the user's execution workspace.

**Journey:** the user's orientation through the 12-week plan.

**Progress:** the user's evidence of movement toward the goal.

**Primary content:** information/action required to fulfill the page's immediate job.

**Secondary content:** useful context that supports the page job but should not compete with it.

**Exploratory content:** valuable depth that is intentionally available after the primary experience is understood.

**Premium visual system:** a coherent visual language using typography, spacing, surfaces, hierarchy, restrained color, interaction feedback, and responsive composition to create a polished experience.

## 7. Lifecycle

This feature changes presentation and information architecture; it does not introduce a new user-owned lifecycle object.

Existing goal/session/journey lifecycle remains intact.

The redesign must not change whether existing records are created, completed, reviewed, adapted, or retained unless explicitly required by a separate approved feature.
## 8. Experiences / Screens

| ID | Experience | Purpose | Required |
|---|---|---|---|
| UX-1 | Today | Answer “What do I do now?” and enable today's execution. | Yes |
| UX-2 | Journey | Answer “Where am I going, and how does my current week fit?” | Yes |
| UX-3 | Progress | Answer “Am I actually getting closer, and what evidence shows that?” | Yes |
| UX-4 | Today secondary detail | Make useful session detail available without overwhelming the default view. | Yes |
| UX-5 | Journey deeper exploration | Make full journey detail available without forcing all detail into the first view. | Yes |
| UX-6 | Progress deeper evidence | Make detailed evidence available after the primary progress story is understood. | Yes |

## 9. States

All meaningful existing states remain supported. Their information priority may differ.

### Today states
- Loading
- No active goal
- Practice day
- Key session
- Test day
- Rest day
- Short on time / minimum version
- Done for today
- Yesterday pending / recovery
- Review due
- Review failed
- Closing stretch
- Completed goal
- API offline
- Goal-load error

### Journey states
- Loading
- No active journey
- Active journey
- Completed phases
- Active phase/week
- Upcoming weeks
- Closing stretch
- Completed journey

### Progress states
- Loading
- No active journey
- Early journey / little evidence
- Active progress with evidence
- Dense historical evidence
- Goal completed
- Load error

Every state must retain a clear primary message/action and an appropriate recovery or next step where applicable.
## 10. Edge Cases

- Very long goal or outcome text must not dominate the page.
- A page with little data must still feel intentional rather than empty or broken.
- A page with substantial historical data must remain navigable without recreating the original density problem.
- Secondary content must remain discoverable after being deferred.
- Refresh/navigation must not silently discard user-owned data or meaningful completed state.
- Mobile and desktop may present information differently, but must preserve the same product hierarchy.
- Reduced-motion users must receive the same information and state meaning without required animation.
- Error states must not leave the user at a dead end.
- Existing closing-stretch and completed-goal experiences must remain coherent with the new hierarchy.

## 11. Data Behavior

The feature is presentation/information-architecture work.

Existing goal, roadmap, daily-task, review, benchmark, and adaptation data should be reused where it already supports the experience.

No information should be deleted from persistence merely because it is deferred visually.

If a displayed field is removed from the default view, it must either remain accessible through intentional exploration or be proven redundant during implementation verification.

## 12. Persistent / Temporary / Derived State

### Persistent
Existing user goal, journey, task, review, benchmark, completion, and adaptation records remain persistent according to existing behavior.

### Temporary
Disclosure/expanded UI state may be temporary unless existing behavior establishes persistence as necessary.

### Derived
Page summaries, progress presentation, current phase/week, status labels, and visibility priority may be derived from existing data.

No new persisted redesign state is required by this definition.

## 13. Time-Based Rules

Existing journey timing semantics remain unchanged.

The redesign must respect the existing distinction between the 12-week plan and the closing stretch.

It must not fabricate future daily tasks or alter existing day/week progression rules.

The UI should present current day/week context consistently wherever that context is necessary to orient the user.
## 14. Product Rules

**RULE-1 — One dominant job:** Each core destination has one immediately understandable primary job.

**RULE-2 — Primary before secondary:** Primary information/action must visually and cognitively outrank supporting information.

**RULE-3 — Progressive depth:** Secondary/exploratory information may be deferred when showing it upfront would compete with the page job.

**RULE-4 — Discoverability:** Deferred information must have an understandable, accessible path to reveal it.

**RULE-5 — No blind deletion:** Information is not removed solely to make a page look cleaner.

**RULE-6 — State-aware priority:** A state may change what is primary while preserving the page's stable mental model.

**RULE-7 — No dashboard duplication:** Do not create another general-purpose dashboard surface.

**RULE-8 — Premium through restraint:** Visual richness comes from composition, typography, spacing, surfaces, imagery where appropriate, and interaction craft—not from decorative clutter.

**RULE-9 — Content before decoration:** Visual styling must reinforce meaning and hierarchy.

**RULE-10 — Consistency:** Repeated visual/interaction patterns should behave and look consistently across the core experiences.

## 15. Permissions

Use the existing authenticated user's access model.

No new roles or permissions are introduced.

A user must not gain access to another user's private goal, journey, task, review, or progress information through the redesign.
## 16. Mobile Requirements

Mobile is required.

Mobile must preserve:
- the same page job
- the same primary/secondary/exploratory hierarchy
- readable typography
- comfortable touch targets
- clear primary actions
- usable disclosure controls
- accessible navigation
- no horizontal overflow caused by redesign content

Mobile may use different composition patterns when they improve comprehension.

Dense desktop information must not simply be compressed into a smaller viewport.

## 17. Accessibility Requirements

- Semantic headings must communicate page structure.
- Interactive disclosure controls must expose expanded/collapsed state.
- Keyboard users must reach and operate all primary and exploratory controls.
- Focus must remain visible and logical.
- Status must not rely on color alone.
- Important states must have text or semantic equivalents.
- Controls must have accessible names.
- Motion must respect reduced-motion preferences.
- Contrast must support readable text and meaningful UI boundaries.
- Touch targets must remain comfortably operable.
- Error and recovery messages must be announced/structured appropriately.
- Visual hierarchy must remain understandable without relying solely on position, color, animation, or imagery.

## 18. Design Requirements

### Visual direction
Achivii should feel **premium, calm, modern, intentional, and visually appealing**.

Premium does not mean maximal decoration or excessive glass effects.

The design should create visual appeal through:
- exceptional typography
- generous and consistent spacing
- strong composition
- restrained, sophisticated color
- deliberate surfaces and depth
- polished controls
- subtle interaction feedback
- high-quality imagery where it adds meaning
- consistent alignment and rhythm

### Hierarchy
Typography, spacing, grouping, contrast, and position should communicate priority before decorative elements.

### Surfaces
Cards, borders, shadows, radii, and backgrounds must form a coherent system rather than page-specific styling.

### Motion
Motion should explain state changes or provide satisfying feedback. It must never be required to understand the product.

### Design-system consistency
Recurring visual decisions should be expressed through the existing design system/primitives where possible. One-off styling should not become the default.

### Brand experience
A first-time visitor/user should perceive care and quality immediately, while an active user should never feel that visual polish slows down execution.
## 19. Existing System Integrations

| Existing capability | Relationship |
|---|---|
| Authentication | Preserve existing authenticated access and session behavior. |
| Goal context | Supplies the active goal used by Today, Journey, and Progress. |
| Daily sessions | Today remains the execution surface for current work. |
| Weekly review | Remains accessible from the appropriate Today/review context. |
| Roadmap data | Journey continues to represent the 12-week plan. |
| Progress data | Progress continues to expose meaningful evidence from existing records. |
| App navigation | Preserve clear movement among Today, Journey, and Progress. |

## 20. Backend / Persistence Requirement

**No backend redesign is required by this Feature Definition.**

The default requirement is to reuse existing data and behavior.

A backend/data change is allowed only if implementation investigation proves an existing requirement cannot be fulfilled with current data/state.

Such a change must be separately justified and must not be invented as part of visual redesign.

## 21. External Services

No new external service is required.

Existing services remain unchanged unless a separate approved requirement affects them.

## 22. Notifications

No new notification behavior is introduced.

Existing notification/review behavior, if any, must not be broken by the redesign.

## 23. Analytics

No new analytics events are required by this Feature Definition.

If existing analytics are present, the redesign should not intentionally invalidate them without an explicit decision.

## 24. Performance Requirements

- Core pages should remain responsive during normal interaction.
- Visual polish must not introduce unnecessary heavy assets or blocking behavior.
- Deferred content should not make the initial experience slower merely because it exists.
- Images, if retained, should not unnecessarily delay primary content.
- Interaction feedback should feel immediate under normal conditions.
## 25. Security / Privacy

The redesign must preserve existing authorization boundaries.

Private goal, task, review, benchmark, and progress information must remain private to the authorized user.

No new data exposure is permitted through exploratory views, navigation, client state, or responsive variants.

## 26. Failure Behavior

For each core destination:

**Normal outcome:** the page clearly communicates its primary job and offers the appropriate primary action or understanding.

**Failure outcome:** the user receives a concise explanation of what failed.

**Recovery:** where recovery is possible, the user receives a clear next step such as retrying or returning to a useful destination.

The redesign must not create dead-end error, empty, loading, or unavailable states.

## 27. In Scope

### Core experience
- Reprioritize Today, Journey, and Progress around their defined page jobs.
- Establish primary/secondary/exploratory information boundaries.
- Apply selective progressive disclosure.
- Improve visual hierarchy and composition.
- Improve spacing, typography, grouping, surfaces, controls, and interaction polish.
- Make the overall experience visually premium and appealing.
- Preserve useful depth through deliberate exploration.
- Design meaningful states, not only the happy path.
- Maintain responsive and accessible behavior.
- Remove or combine genuinely redundant presentation only when verified.
- Establish reusable visual patterns where repeated design decisions occur.

### Validation
- Validate default and representative states.
- Validate desktop and mobile.
- Validate disclosure discoverability.
- Validate preservation of useful existing functionality.
- Validate the original information-density symptoms.
## 28. Out of Scope

- Backend migration or Supabase/Render infrastructure work.
- Authentication redesign.
- AI generation-quality changes.
- Payment infrastructure.
- New analytics capabilities.
- New reminder/notification systems.
- New social/gamification systems.
- New goal-planning capabilities unrelated to information presentation.
- Creating a separate dashboard to replace the core destinations.
- Changing the underlying 12-week planning model.
- Inventing future daily tasks for weeks not yet generated.
- Unrelated technical defects unless the redesign cannot safely function without addressing them.
- Broad product rebrand unrelated to the defined premium visual direction.

## 29. Future / Deferred

The following are not requirements for this feature:
- advanced personalization of visual themes
- large-scale motion system expansion
- new illustration/3D asset pipeline
- new social experiences
- additional analytics products
- notification redesign
- unrelated page redesigns outside the core experiences

These may be considered later without becoming implicit implementation requirements.

## 30. Non-Negotiables

**N-1:** Today remains the primary execution experience.

**N-2:** Journey remains the orientation experience for the 12-week plan.

**N-3:** Progress remains the evidence/analytics experience.

**N-4:** Useful existing functionality and user data must remain intact.

**N-5:** Primary content must be understandable without first exploring secondary detail.

**N-6:** Secondary useful information must remain discoverable.

**N-7:** The experience must feel premium and visually intentional, not merely sparse.

**N-8:** Premium visual design must not reintroduce information overload.

**N-9:** Mobile and desktop must preserve the same underlying hierarchy.

**N-10:** Accessibility must not regress.

**N-11:** No new general-purpose dashboard is introduced.

**N-12:** No backend/data-model change is assumed without evidence.
## 31. Success Criteria

**SC-1:** A reviewer can identify the purpose of Today without scanning its full content.

**SC-2:** On Today, the user's goal, current session, and primary session action form the dominant experience.

**SC-3:** On Journey, the destination, current position, and current week's relationship to the 12-week journey are immediately understandable.

**SC-4:** On Progress, the overall progress story and meaningful evidence are understandable before detailed history is explored.

**SC-5:** Secondary information remains available and discoverable.

**SC-6:** The redesign feels visually premium through coherent typography, spacing, surfaces, hierarchy, and interaction craft rather than decorative excess.

**SC-7:** The original reported symptoms—competing cards, excessive simultaneous content, weak emphasis, cramped areas, and uncertainty about where to look first—are materially reduced in representative states.

**SC-8:** Existing execution, journey, progress, review, recovery, and completion behavior remains usable.

**SC-9:** Mobile and desktop remain coherent and usable.

**SC-10:** Accessibility requirements remain satisfied.

## 32. Acceptance Criteria

### Page purpose and hierarchy
**AC-1**  
Given the user opens Today with an active goal, when the page renders, then the page's primary purpose and primary session action are visually obvious before secondary content is explored.

**AC-2**  
Given the user opens Journey, when the page renders, then the destination, current position, and current week context are understandable without requiring the user to inspect every phase/week.

**AC-3**  
Given the user opens Progress, when the page renders, then the user can understand the main progress story before encountering the full historical/detail surface.
**AC-4**  
Given a core page contains secondary information, when the default view renders, then that information does not visually compete with the primary job.

**AC-5**  
Given secondary information has been deferred, when the user intentionally chooses to explore it, then the information is revealed through a clear and understandable interaction.

**AC-6**  
Given a user expands secondary content, when it is displayed, then the expanded content remains readable and does not obscure the primary context unnecessarily.

### Premium visual quality
**AC-7**  
Given any redesigned core page, when viewed at supported desktop widths, then typography, spacing, alignment, surfaces, controls, and hierarchy form a coherent visual system.

**AC-8**  
Given any redesigned core page, when viewed on mobile, then the composition remains intentional and premium rather than appearing as a compressed desktop layout.

**AC-9**  
Given a visual element is decorative, when it competes with primary content, then the hierarchy takes precedence over decoration.

**AC-10**  
Given a state transition has meaningful user feedback, when the state changes, then motion/feedback reinforces the change without being required to understand it.

**AC-11**  
Given the user prefers reduced motion, when the page renders or transitions, then all information and state meaning remain available without non-essential animation.

### State completeness
**AC-12**  
Given a core page is loading, when the user waits for content, then the loading experience communicates what is loading without presenting misleading content.

**AC-13**  
Given a core page is empty or has little data, when it renders, then the page remains intentional and provides an appropriate next step.

**AC-14**  
Given a core page encounters an error, when the error is shown, then the user receives a clear explanation and an available recovery path.

**AC-15**  
Given the user is in a special state such as review due, recovery, rest day, closing stretch, or completed goal, when the page renders, then the state-specific primary need is more prominent than unrelated detail.
### Responsive and accessibility
**AC-16**  
Given the user operates a core page with keyboard navigation, when they move through interactive controls, then primary actions and disclosure controls are reachable with visible focus.

**AC-17**  
Given a status is visually represented by color, when the user cannot distinguish that color, then text/icon/semantic information still communicates the status.

**AC-18**  
Given a core page is rendered on a narrow viewport, when the user interacts with primary and disclosure controls, then there is no redesign-caused horizontal overflow and controls remain comfortably operable.

### Preservation
**AC-19**  
Given existing Today functionality is used, when the redesign is applied, then users can still access the current session, complete it, use required session details, and reach relevant review/recovery behavior.

**AC-20**  
Given existing Journey information exists, when the redesign is applied, then users can still access the meaningful 12-week journey and current position.

**AC-21**  
Given existing Progress evidence exists, when the redesign is applied, then meaningful completion/progress evidence remains accessible.

**AC-22**  
Given a user refreshes or navigates between core pages, when they return, then the redesign has not silently discarded persistent user data or completed state.

### Problem validation
**AC-23**  
Given representative Today, Journey, and Progress states, when reviewed against the original symptom list, then the redesign materially reduces competing information, simultaneous visibility, weak emphasis, and first-look uncertainty.

**AC-24**  
Given the redesigned experience is reviewed as a whole, when comparing visual quality with the existing system, then the result is coherent and intentionally premium rather than merely less dense.
## 33. Decisions Already Made

**D-1**  
Today, Journey, and Progress have distinct jobs:
- Today = execution
- Journey = orientation
- Progress = evidence/analytics

**D-2**  
The selected solution direction is **Purpose-first, progressive-depth core workspace**.

**D-3**  
The solution combines page-role-first restructuring, stronger hierarchy, and selective progressive disclosure.

**D-4**  
Achivii follows the principle **Simple by default. Deep when explored.**

**D-5**  
Premium visual quality is a first-class product requirement. The goal is not bare minimalism; the interface should be visually appealing, polished, calm, and intentional.

**D-6**  
Current design benchmarks are guidance, not templates to copy. Achivii should retain its own product identity.

**D-7**  
No new dashboard destination is part of this redesign.

**D-8**  
The redesign should prefer existing data and UI primitives where they support the desired experience.

**D-9**  
The redesign must not blindly delete useful information.

**D-10**  
Implementation details are intentionally deferred to the Phase/Implementation layers.

## 34. Open Decisions

**OD-1 — Exact information boundary per page/state**  
Question: Which existing elements belong in primary, secondary, and exploratory layers for each state?  
Blocking: Yes for implementation detail; must be resolved during feature-to-phase decomposition.

**OD-2 — Exact disclosure pattern per section**  
Question: Which secondary groups use inline disclosure, separate navigation, or remain visible?  
Blocking: Yes for implementation detail; must be selected from the existing design system and validated for discoverability.

**OD-3 — Exact visual token refinements**  
Question: Which typography, spacing, surface, color, and elevation values should be standardized or refined?  
Blocking: No for product behavior; yes before final visual implementation.

**OD-4 — Redundant content identification**  
Question: Which information is truly redundant across Today, Journey, and Progress versus merely secondary?  
Blocking: No; must be evidence-based before deletion.

**OD-5 — State-specific composition**  
Question: Which special states need a different primary composition while preserving the same page mental model?  
Blocking: Yes for final implementation scope.

## 35. Constraints

- Existing architecture and data contracts are the starting point.
- Existing design primitives should be reused where appropriate.
- No backend rewrite is justified by the current problem.
- Existing user data and functional behavior must be preserved.
- Responsive and accessible behavior are mandatory.
- The redesign must remain scoped to the information-density/premium-experience problem.
- Implementation must be based on the current repository state, not assumptions.
- Any unrelated bug discovered during implementation must be separately assessed rather than silently expanding scope.
## 36. Regression Requirements

**R-1 — Today execution**  
Existing users can still understand, start, and complete today's session.

**R-2 — Session detail**  
Existing useful instructions, steps, focus/timer behavior, minimum version, resources, intention, and notes remain accessible where relevant.

**R-3 — Weekly review**  
Existing review entry and behavior remain accessible from the appropriate context.

**R-4 — Recovery states**  
Existing recovery, missed-day, test-day, rest-day, closing-stretch, and completed-goal behavior remains intact.

**R-5 — Journey completeness**  
The full meaningful 12-week journey remains accessible even when not all of it is shown upfront.

**R-6 — Journey honesty**  
Future weeks must not gain fabricated daily tasks merely because the visual presentation changes.

**R-7 — Progress evidence**  
Existing meaningful progress, benchmark, completion, and adaptation information remains available where applicable.

**R-8 — Navigation**  
Users can move among Today, Journey, and Progress without losing context or encountering duplicate dashboard concepts.

**R-9 — Persistence**  
Presentation changes must not clear or corrupt existing persistent user data.

**R-10 — Accessibility**  
Keyboard, semantic, focus, status, contrast, and reduced-motion behavior must not regress.

## Traceability

```
P-1
 ↓
E-1 / E-2 / E-3 / E-4
 ↓
CAUSE-1 / CAUSE-2 / CAUSE-3 / CAUSE-4
 ↓
REQ-1 … REQ-7
 ↓
SOL-4 / DEC-1
 ↓
D-1 … D-10
 ↓
FD-1 … FD-10
 ↓
UX-1 … UX-6
 ↓
RULE-1 … RULE-10
 ↓
N-1 … N-12
 ↓
AC-1 … AC-24
 ↓
R-1 … R-10
```

## Handoff Contract

This Feature Definition defines **what the redesigned core experience must accomplish and how it should behave**.

The Phase Definition must determine:
- implementation order
- milestones
- dependencies
- exact repository areas to change
- verification strategy
- carry-overs

The Implementation Prompt must consume this approved Feature Definition plus the current repository state.

The implementation must not reinterpret the product direction or invent new requirements.

**Core product principle:**  
> **Simple by default. Deep when explored.**

**Quality ambition:**  
> **Premium by design, clear by default, rewarding to use.**

**Status:** READY FOR PHASE DEFINITION
