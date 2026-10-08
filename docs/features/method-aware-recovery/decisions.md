# Method-Aware Recovery — Decisions

**Prefix:** MR

How this log works: `docs/templates/decisions.md`.

**Inherited:** started on 2026-10-08 from Mo's review of missed sessions' recovery rules (`docs/archive/missed-sessions/03-feature.md`), which treat every task the same. The weekly update is paused for it (`docs/features/weekly-update/decisions.md` WU-10).

### MR-1 — A small fixed set of actions (2026-10-08)
**Question:** what can the app do with a step whose day didn't happen?
**Decision:** four actions: move, continue, let go, fixed. Plus two week-level rules: keep the order, keep the rest gaps. Every goal uses the same set; goals differ in which kinds of step get which action.
**Why:** few enough to build and test thoroughly; together they cover the patterns real methods use.
**Changes:** the feature definition's rules.

### MR-2 — The method sets the rules, in a recovery profile made at goal creation (2026-10-08)
**Question:** who decides what each kind of task does?
**Decision:** each goal gets a recovery profile when it is created: its kinds of step and each kind's action, its order and rest-gap rules, and its return-after-a-break rule (from the weekly update). Pathway profiles are written by us; custom goals' come from a model call (MR-4).
**Why (Mo):** the type of goal and task decides how it is dealt with.
**Changes:** goal creation; the weekly update's RULE-12 (WU-10).

### MR-3 — The week writer categorises; code decides (2026-10-08)
**Question:** does the model choose the action for each step?
**Decision:** no. When writing a week, the model tags each step with one kind from the goal's profile. Code maps the kind to its action and enforces the hard limits whatever the tag says: the test is always fixed, high-load work never lands next to other high-load work, and a deliverable's work always continues.
**Why:** saying what a step is is easier and safer than deciding recovery; the result stays predictable and testable.
**Changes:** the week call; the carry and swap code.

### MR-4 — Custom profiles start from domain templates, with their own call and checks (2026-10-08)
**Question:** how do we make custom goals' profiles as good as possible?
**Decision:** we write about 12 domain templates. A dedicated model call picks the closest one and adjusts it for the goal. Code checks the profile (every kind has an action, the roadmap's work maps to the kinds, high-load is never moved without a rest gap, the test is fixed). On failure: one retry, then the template unchanged. A half-made profile is never saved.
**Why (Mo):** the profile is where quality is won or lost, especially for custom goals.
**Changes:** goal creation.

### MR-5 — No silent "let go" (2026-10-08)
**Question:** what happens to a step without a usable tag?
**Decision:** it cannot be saved. The tag is a fixed menu of the goal's kinds, and a missing or unknown tag fails the week's check and the week is retried. Every profile has a catch-all kind with an action the method chose. Let go happens only when the method says so.
**Why (Mo):** letting go of unlabeled work is not professional; every step must have a deliberate answer.
**Changes:** the week call's checks; the profile format.

### MR-6 — Existing steps keep today's behavior until rewritten (2026-10-08)
**Question:** what about weeks written before this feature?
**Decision:** their steps keep missed sessions' current, tested behavior until the goal's next week is written. The goal's profile is made the first time it is needed.
**Why:** no migration, and the gap closes within a week.
**Changes:** the carry and swap code.

### MR-7 — Measured before switch-on (2026-10-08)
**Question:** how do we know custom profiles are good enough?
**Decision:** hand-write the correct profile for 20 to 30 varied custom goals and score the model against them; it goes live only when the score is good enough (threshold set in the feature definition).
**Why:** measure instead of guessing.
**Changes:** a milestone before release.
