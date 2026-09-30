# ACHIVII — DASHBOARD / TODAY REDESIGN PROMPTS

### Agent prompts for the focused Today redesign

These prompts execute `dashboard-redesign-phases.md` one phase at a time.

## Shared instructions

You are modifying the Achivii signed-in Today experience.

Read first:

- `docs/01-product/redesign-blueprint.md`
- `docs/01-product/visual-design-system.md`
- `docs/03-workflow/decisions.md`
- `docs/03-workflow/dashboard-redesign-phases.md`

The existing decision that Today lives at `/` is binding. Do not create another dashboard route.

The existing Today state matrix is binding. Do not remove behavior to make the UI simpler.

Use the existing UI primitives and design tokens. Do not create a second design system.

Do not make backend changes unless a phase explicitly permits them. Do not invent target-result data, progress metrics, or product capabilities.

Before editing, inspect the actual repository state. Do not rely on this prompt for filenames that may have changed.

After the assigned phase:

1. Run the required validation.
2. Summarize files changed.
3. Record regressions checked.
4. Record carry-overs or unresolved decisions.
5. Stop. Do not begin the next phase.

## P0 — Baseline & UX contract

```text
ACHIVII DASHBOARD REDESIGN — PHASE 0

OBJECTIVE
Define the new Today hierarchy before implementation.

INSPECT FIRST
- Current signed-in route and Home/Today composition.
- Today component and its supporting components/hooks.
- App navigation.
- Progress page and Journey page.
- OD-3 and OD-9 in decisions.md.
- Current visual design system.

TASK
Map the current Today screen into:
- goal context
- today's session
- weekly context
- week glance
- progressive details
- secondary destinations

Identify every existing interaction/state that must survive the redesign.

PROPOSED HIERARCHY
1. Goal context
2. Today's session
3. This week's target/progress
4. 7-day glance
5. Deep details
6. Secondary navigation

Do not code the redesign yet unless a tiny inspection-only change is required.

DELIVERABLE
Update `dashboard-redesign-phases.md` with any repository-specific findings,
exact component boundaries, responsive considerations, and decisions required.
If an existing decision must change, stop and identify the required decision-log update.

VALIDATION
No implementation validation is required beyond confirming the inspected paths.

END
Stop after the baseline report.
```

## P1 — Dashboard structure

```text
ACHIVII DASHBOARD REDESIGN — PHASE 1

PRECONDITIONS
Phase 0 is complete and the hierarchy is recorded.

OBJECTIVE
Recompose Today so the user immediately sees what to do now and how the week is going.

RULES
- Today remains `/`.
- Preserve all existing Today state branches and actions.
- Preserve task data and API contracts.
- Do not reintroduce the retired `/dashboard` experience.
- Do not turn the dashboard into an analytics page.

IMPLEMENTATION
Build the approved hierarchy:
1. Goal context
2. Today's session as the dominant surface
3. Weekly target/progress context using only existing trustworthy data
4. 7-day glance
5. Secondary actions

Extract components when doing so improves clarity and maintainability.
Do not perform unrelated refactors.

VALIDATION
- Existing Today tests.
- Frontend type-check/build.
- Practice day.
- Completed task.
- Rest day.
- Test/key session.
- Offline/error state.
- Review entry.

Check desktop and narrow mobile before declaring complete.

END
Run validation, write the completion report, and stop.
```

## P2 — Progressive detail & interaction polish

```text
ACHIVII DASHBOARD REDESIGN — PHASE 2

PRECONDITIONS
Phase 1 is complete.

OBJECTIVE
Make Today feel simple by default and deep when explored.

TASK
Refine the existing progressive disclosures for:
- detailed steps
- minimum/10-minute version
- implementation intention
- resources
- notes
- focus session
- weekly review

Preserve their current data and actions.

Also refine the visual hierarchy of:
- Start session
- Complete
- Review week
- Roadmap
- Progress

Do not hide essential information behind unnecessary interaction.
Do not invent new capabilities.

VALIDATION
Keyboard navigation, focus visibility, reduced motion, mobile touch targets,
loading/error/offline states, and all relevant existing tests.

END
Run validation, write the completion report, and stop.
```

## P3 — Responsive refinement & validation

```text
ACHIVII DASHBOARD REDESIGN — PHASE 3

PRECONDITIONS
Phase 2 is complete.

OBJECTIVE
Finish the visual refinement and prove the redesign works across real states.

VALIDATE
Desktop:
- representative large viewport
- normal laptop viewport

Mobile:
- 390px
- 360px

States:
- loading
- no active goal
- practice day
- key session
- test day
- rest day
- minimum version
- completed today
- yesterday recovery
- review due
- review failure
- API offline
- goal-load failure
- closing stretch
- completed goal flow where applicable

CHECK
- no horizontal overflow
- clear hierarchy
- readable text
- usable touch targets
- keyboard navigation
- visible focus
- reduced motion
- console cleanliness
- existing tests/build/type-check

DELIVERABLE
Record evidence and any remaining carry-overs in `dashboard-redesign-phases.md`.
Do not claim completion if a required validation path was not actually checked.

END
Run validation, write the completion report, and stop.
```
