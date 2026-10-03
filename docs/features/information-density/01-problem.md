# Problem Definition — Achivii Information Density

**Status:** READY FOR FEATURE DEFINITION
**Version:** 1.0
**Date:** 2026-09-30

## 1. Problem Summary

Achivii presents too much information at the same visual level, making it difficult for users to immediately understand what a page is for and identify what matters most.

The problem is reported across almost all pages. The clearest product-level expression is that each core destination needs one immediately understandable job, while secondary depth remains available without competing with that job.

## 2. Original Problem Report

> “i feel like pages of achivvii's websites are very full of information”

The user clarified that “full” means:
- too much text
- too many cards/sections
- too many numbers/statistics
- too many buttons/actions
- too many things visible at the same time
- sections feel cramped
- uncertainty about where to look first
- important things do not stand out
- the experience feels overwhelming

## 3. User Job / Desired Outcome

When a user opens a core Achivii page, they should be able to understand what that page is meant for and act accordingly without first interpreting many competing pieces of information.

The desired outcome is not “see less information” by itself. It is: **understand the page's purpose, identify what matters now, and act or explore deliberately.**

## 4. Current User Journey

A user opens an Achivii destination and may encounter multiple information groups, metrics, cards, actions, and explanatory content in sequence. The user must visually interpret these elements to determine which content deserves attention first.

For the active-goal experience, the current core destinations are:
- Today at / — the execution workspace.
- Journey at the roadmap destination — orientation around the 12-week journey.
- Progress at /progress — progress and evidence.

## 5. Expected User Journey

The user opens a page, immediately understands its purpose, identifies the primary information or action, and then chooses whether to explore secondary detail.

The experience should be **simple by default, deep when explored**.

## 6. Current vs Desired Gap

| Area | Current | Desired | Gap |
|---|---|---|---|
| Purpose | Multiple information layers can compete for attention | One clear page job | Purpose is not consistently dominant |
| First attention | Several elements may appear important | One obvious starting point | Attention is harder to direct |
| Action | Multiple visible actions/information paths | Primary action is obvious where action is required | Decision effort is higher |
| Detail | Much information can be visible together | Detail remains available through exploration | Progressive disclosure may be insufficient |
| Hierarchy | Content can share similar visual importance | Important content clearly outranks supporting detail | Information hierarchy needs investigation |

## 7. Symptoms

The reported symptoms are the strongest evidence of the user experience problem. They are not, by themselves, proof of a particular implementation cause.

## 8. Observable Behaviors

Confirmed repository structure shows Progress renders five explicit information layers: completion metrics, phase/milestones, week breakdown, benchmark results, and adaptation history. Journey renders three explicit layers: journey header, journey visualization, and strategic roadmap.

These are implementation observations, not direct evidence of how users behave.

## 9. User Impact

The direct reported impact is cognitive and navigational: the user does not know where to look first, important information does not stand out, and the experience feels overwhelming.

Potential downstream effects such as reduced completion or abandonment are **not established** by the current evidence and must not be treated as facts.

## 10. User Cost

Known cost:
- additional visual scanning
- additional interpretation before deciding what matters
- increased cognitive effort
- uncertainty about the intended starting point

Quantitative time/click cost is unknown.

## 11. Frequency

The user reports the issue across “almost all pages.” No analytics or population-level measurement is currently available in this investigation.

**Confidence:** Medium for the user's own experience; unknown for broader user population frequency.

## 12. Severity / Consequence

The problem directly affects comprehension and navigation of core product experiences. Exact severity across users is not yet measured.

## 13. Evidence

**E-1 — User report:** The user explicitly reports that Achivii pages feel too full and provided the symptom list above.

**E-2 — Repository evidence:** ProgressPage.tsx composes five named information layers in one page.

**E-3 — Repository evidence:** RoadmapPage.tsx composes three named information layers in one page.

**E-4 — Repository evidence:** Home.tsx routes an active-goal user to Today, indicating Today is the primary execution destination rather than a separate analytics dashboard.

## 14. Evidence Quality

- E-1: **User-reported, direct** — high confidence for the reported experience of the user.
- E-2/E-3/E-4: **Repository evidence** — high confidence about current code structure.
- Claims about broader users, conversion, retention, abandonment, or task completion: **unknown**.

## 15. Contradictory Evidence

No contradictory user evidence has been collected yet.

The repository does not prove that every visible layer is experienced as overwhelming by every user. Child components and rendered visual states still require inspection before identifying exact UI-level causes.

## 16. Assumptions

- The issue is primarily about information presentation and hierarchy rather than missing core functionality.
- Users benefit from having deeper information available when they intentionally explore it.
- The three core destinations have distinct jobs rather than all serving as general dashboards.

These are working assumptions, not validated universal truths.

## 17. Suspected Causes

**CAUSE-1 — Information hierarchy:** Too many elements may receive comparable visual attention.

**CAUSE-2 — Progressive disclosure:** Secondary information may be exposed before the user asks for it.

**CAUSE-3 — Page-purpose clarity:** Individual destinations may not consistently communicate one dominant job.

**CAUSE-4 — Density within child components:** The page shells alone do not establish whether the underlying components are visually cramped or overly verbose.

All four remain hypotheses pending deeper visual/component investigation.

## 18. Cause Confidence

CAUSE-1: Medium hypothesis.
CAUSE-2: Medium hypothesis.
CAUSE-3: Medium-to-high product hypothesis based on the intended page jobs, but not a proven visual root cause.
CAUSE-4: Low-to-medium until child components are inspected.

## 19. Alternative Explanations

The perceived fullness could also result from typography, spacing, card styling, navigation design, terminology, redundant content, or the amount of information generated by specific goal states. These alternatives must be checked before implementation decisions are made.

## 20. Workarounds

No user workaround has been explicitly reported yet. Possible workarounds such as ignoring sections or navigating away are hypotheses and require observation.

## 21. Failure Modes

- User cannot identify the primary content quickly.
- User sees several plausible starting points.
- Important information competes with supporting detail.
- User must scan multiple sections before understanding page purpose.
- User experiences the page as overwhelming even when the underlying functionality is correct.

## 22. Information Gaps

Unknowns include:
- Which exact Today components create perceived density.
- Which Journey components are essential to the first view versus exploration.
- Which Progress metrics/evidence are necessary immediately and which are secondary.
- Whether there are repeated or redundant pieces of information across pages.
- Whether the problem differs by desktop/mobile or by journey state.

## 23. Decision Gaps

The core decision difficulty is often: **“What am I supposed to understand or do first on this page?”**

## 24. Action Gaps

For Today, the desired primary action is starting today's session. For Journey, the desired primary understanding is where the user is going and how the current week fits into the 12-week journey. For Progress, the desired primary understanding is whether the user is actually getting closer to the goal and what evidence supports that.

## 25. Feedback Gaps

The current investigation does not yet establish whether feedback itself is inadequate. The concern is that useful feedback may compete with too much surrounding information.

## 26. Trust / Expectation Gaps

No explicit trust failure was reported. However, unclear hierarchy can make it harder for users to understand which information is authoritative or important. This remains a hypothesis.

## 27. Time / State Considerations

The information burden may vary by state: new goal, active day, completed day, review due, closing stretch, and completed goal can require different information. Feature Definition must account for state-specific needs rather than assuming one static page layout.

## 28. Data Considerations

The problem is not currently defined as missing data. Existing data may be presented too broadly or without sufficient prioritization. Any data removal must preserve information needed for execution, orientation, progress understanding, and recovery.

## 29. Scope Boundary

**In scope:** information hierarchy, page-purpose clarity, perceived density, prioritization, visibility of secondary information, and the relationship between core destinations.

**Out of scope for this problem definition:** backend migration, authentication, AI generation quality, new analytics capabilities, payment infrastructure, and unrelated technical defects.

## 30. Related Problems

Related but distinct product issues may include dashboard duplication, weekly target/result behavior, goal completion handling, and other previously identified UX/data-model gaps. They should not automatically be merged into this problem.

## 31. Non-Problems / Unproven Claims

We have **not** established that Achivii should simply remove information, eliminate all cards, eliminate metrics, or reduce every page to a minimal screen. Those are solution directions, not problem facts.

## 32. Proposed Solutions Mentioned

No solution is accepted as part of this definition. The principle “simple by default, deep when explored” is a desired experience constraint, not an implementation specification.

## 33. Constraints

- Preserve useful existing information and functionality unless Feature Definition determines it is unnecessary to the user's job.
- Core pages must retain their distinct product roles.
- Accessibility and responsive behavior must not regress.
- Existing functional behavior should not be broken while changing presentation.

## 34. Dependencies

Feature Definition will need to inspect the relevant Today, Journey, and Progress child components and existing navigation/shell behavior before specifying a solution.

## 35. Regression Risks

Potential risks include hiding information users rely on, making secondary details harder to discover, weakening navigation between contexts, or reducing useful progress visibility while attempting to reduce density.

## 36. Safety / Destructive Risks

No destructive data operation is required to address this problem. UI simplification must not silently delete or invalidate user data.

## 37. Desired Future State

Each core page communicates one dominant job immediately, while secondary information remains accessible without competing with the primary purpose.

The intended mental model is:

| Page | Immediate question | Primary content |
|---|---|---|
| Today | **What do I do now?** | Your goal → today's session → Start session |
| Journey | **Where am I going?** | 12-week journey → current week → its place in the journey |
| Progress | **How am I doing?** | Overall progress → meaningful evidence of progress |

## 38. Solution-Neutral Problem Statement

**Achivii users can encounter more information, actions, and visual sections than they can easily prioritize at once, making it difficult to immediately understand the purpose of a page and identify what matters most. The product needs to make the primary purpose and relevant next understanding/action clear while retaining appropriate deeper information for intentional exploration.**

## 39. Main Problem Hypothesis

The strongest current hypothesis is that Achivii's information hierarchy does not consistently distinguish primary content from supporting detail. This may be amplified by the amount of content exposed simultaneously.

This is a hypothesis, not a confirmed root cause.

## 40. Open Questions

1. Which specific Today components create perceived density?
2. Which Journey components are essential to the first view versus exploration?
3. Which Progress metrics/evidence are necessary immediately and which are secondary?
4. Are there repeated or redundant pieces of information across pages?
5. How does perceived density change across mobile and desktop?
6. Do different journey states require different primary information?
7. Can the same information remain available while reducing initial cognitive load?

## 41. Feature Definition Investigation Questions

The next layer should determine:
- What is the minimum information required to fulfill each page's primary job?
- What information is secondary but still valuable?
- What should be immediately visible versus discoverable?
- What visual hierarchy best communicates primary versus supporting information?
- What interactions are necessary for intentional exploration?
- Which existing components/data should be preserved unchanged?
- What responsive/state-specific behavior is required?
- How will the resulting experience be validated against the original problem?

## 42. Problem Readiness

**READY FOR FEATURE DEFINITION**

The problem is sufficiently defined to investigate a solution without pretending the root cause is fully proven. The next phase must validate the suspected causes against the actual child components and rendered experience before committing to specific UI changes.

---

# Traceability

P-1 → E-1/E-2/E-3/E-4 → USER-1 → GAP-1 → CAUSE-1/2/3/4 → SCOPE-1 → FD-1

## Handoff Contract

Problem Definition establishes **what is wrong, who experiences it, the desired outcome, evidence, hypotheses, boundaries, and unknowns**.

Feature Definition must establish **what capability/experience should be built and how it should behave**, without treating the hypotheses above as already-proven implementation requirements.

**Core principle:** Simple by default. Deep when explored.
