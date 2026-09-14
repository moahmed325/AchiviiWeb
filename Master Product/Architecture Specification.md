# MASTER IMPLEMENTATION PROMPT

## Pivot the Existing Product into an Adaptive Daily Life Operating System

You have already implemented a substantial Adaptive 90-Day Execution System in this repository.

The product direction has now evolved.

The final product is NOT primarily a 90-day goal planner.

It is a **Daily Life Operating System for ambitious, busy people**, where the user's ambitions are intelligently integrated into their existing daily life.

The existing Adaptive 90-Day architecture remains extremely valuable and should become the strategic intelligence layer underneath this product.

Your job is to **integrate, refactor, replace, migrate, and remove** the existing implementation as necessary so the final application reflects this new product architecture.

Do NOT simply bolt a daily planner onto the existing product.

Do NOT preserve legacy architecture merely because it already works.

Do NOT create permanent parallel systems.

The final product must feel like one coherent system.

---

# 1. THE NEW PRODUCT VISION

The core product experience is:

> The user tells us what they want to accomplish, tells us a few simple things about their current situation and normal life, and the system figures out how to integrate that ambition into their actual life.

The user should not have to become their own coach, planner, scheduler, or project manager.

The system handles the strategic complexity.

The user should primarily experience:

**My life → structured intelligently → with my ambitions built into it.**

The core product loop is:

CHOOSE AMBITION
→ SIMPLE GOAL-SPECIFIC ONBOARDING
→ SIMPLE LIFE/Routine INPUT
→ MASTER PLANNING PROMPT
→ PERSONALIZED 90-DAY ROADMAP
→ INTEGRATE ROADMAP INTO DAILY LIFE
→ DAILY SCHEDULE
→ EXECUTE
→ OBSERVE REALITY
→ ADAPT
→ UPDATED DAILY SCHEDULE / TRAJECTORY

---

# 2. IMPORTANT: DO NOT THROW AWAY THE EXISTING ADAPTIVE SYSTEM

The previously implemented architecture should NOT be discarded simply because the product positioning has changed.

The existing systems for:

* Goal Engine
* Capability Graph
* Evidence
* Bottleneck detection
* Critical Path
* MED
* Reliability Margin
* Trajectory Engine
* Telemetry
* Deviation Detection
* Diagnostics
* Adaptive Rescheduler
* Forecast
* Goal Integrity
* Behavioral Execution
* Trajectory Versioning
* No-Debt Principle

should become the **strategic ambition engine** underneath the new product.

However, audit every existing implementation.

For every existing component classify it as:

* KEEP
* REFACTOR
* REPLACE
* MIGRATE
* REMOVE

Do not assume that an existing implementation should remain just because it passes tests.

---

# 3. NEW ARCHITECTURAL CENTER

The application should conceptually become:

PERSON
│
├── LIFE STRUCTURE
│   ├── Daily routines
│   ├── Fixed commitments
│   ├── Work / school
│   ├── Sleep
│   ├── Meals
│   ├── Commute
│   ├── Existing activities
│   ├── Available windows
│   ├── Preferred windows
│   ├── Energy patterns
│   └── Life constraints
│
└── AMBITIONS
├── Goal A
├── Goal B
└── Goal C
│
↓
ADAPTIVE 90-DAY ENGINE
│
↓
REQUIRED INTERVENTIONS
│
↓
LIFE INTEGRATION / SCHEDULING
│
↓
DAILY LIFE PLAN

The person's life is now the primary user-facing object.

The ambition engine determines what needs to happen.

The life scheduling engine determines where and when it should happen.

---

# 4. SINGLE SOURCE OF TRUTH

The final application must have canonical sources of truth.

There must NOT be competing:

* goal systems
* planning systems
* schedules
* progress systems
* task systems
* forecast systems
* recovery systems

The canonical architecture should be approximately:

## Goal

Canonical ambition/outcome definition.

## State

Canonical representation of the user's current capability/state.

## Trajectory

Canonical representation of the current strategic route toward the outcome.

## Life Structure

Canonical representation of the user's normal life and scheduling constraints.

## Daily Schedule

Canonical projection of life structure + trajectory into actual time.

## Execution

Canonical record of what actually happened.

## Telemetry/Evidence

Canonical evidence about changing state.

## Forecast

Canonical estimate of outcome timing/probability.

The calendar is a VIEW of the current schedule/trajectory.

It must not independently own planning logic.

---

# 5. ONBOARDING MUST CHANGE: THE RULE OF 3–4 QUESTIONS

The user first chooses an ambition (either a vetted Predefined Blueprint or a Custom Ambition).

Example predefined goals:
* Run a 10K / Half Marathon
* Learn Conversational Spanish
* Master Distributed Systems
* Write & Publish a Book
* Build & Launch a SaaS MVP
* Daily Mindfulness Habit

The predefined goal blueprint provides the vetted, domain-specific ground truth (the capability DAG, scientific progression, and failure-prevention guardrails).

After selecting the goal, the user receives strictly **3 to 4 high-leverage onboarding questions**.

### Core Constraints on Questions:
1. **Never Duplicate Life Routines:**
   Do NOT ask the user about their sleep, wake times, work hours, preferred time of day, or schedule fragility in Step 2. Those belong strictly to **Step 3 (Life Structure & Routines)**, which canonically owns calendar reality.
2. **Never Interrogate Failure ("How will you fail?"):**
   Do NOT ask users why they failed before or how they might fail. Busy people fail for predictable, well-documented domain reasons (e.g., runners ramping mileage too fast and hurting tendons; coders spending weeks tweaking CSS instead of shipping). **The Blueprint itself must bake in failure prevention for busy people from day one** (volume caps, vertical slices, mandatory rest).
3. **Keep Every Question Determinative:**
   Every single question must alter an operational engine variable (starting DAG node, baseline score, volume budget, or prerequisite skips). If an answer does not change the generated roadmap, the question must be eliminated.

Do NOT create a long planning questionnaire.
Do NOT ask the user about bottlenecks, critical paths, MED, capability graphs, feasibility calculations, intervention selection, or progression models. Those are system responsibilities.

---

# 6. THE 3-TO-4 QUESTION BLUEPRINT FORMULA

The question set should strictly follow this 3-to-4 question formula across both predefined blueprints and custom AI-generated ambitions:

### Question 1: Objective Verifiable Baseline Gate
* **Purpose:** Determines where in the Capability DAG the user enters (e.g., skipping introductory crawl nodes or requiring prerequisite foundation).
* **Format:** Observable, objective benchmarks (e.g., *"What is the furthest you have run continuously in the last 30 days without stopping?"*), never vague self-perception.

### Question 2: Skill Asymmetry / Starting Comfort Zone
* **Purpose:** Identifies where the user has existing intuitive strength vs. where they need guided structure.
* **Format:** Practical comfort zone options (e.g., *"I can read dialogues okay, but freeze when speaking"* vs *"I can pronounce words well, but grammar charts confuse me"*).

### Question 3: Sustainable Weekly Target Cadence
* **Purpose:** Sets the weekly workload budget and determines standard session count (3 vs 4 vs 5 days per week).
* **Format:** Clear time commitments calibrated to the domain (e.g., Light: 3.5h/wk, Balanced: 5h/wk, Accelerated: 7h/wk).

### Question 4 (Optional / Goal-Specific): Milestone Specifics or Core Tooling
* **Purpose:** Tunes the concrete deliverables of the capstone phase (e.g., target event distance: 10K vs Half-Marathon; or distribution format: Kindle eBook vs Web).

The objective is:
> Collect the smallest amount of information necessary for the Master Planning Prompt to generate a high-quality personalized 90-day roadmap without survey fatigue.

---

# 7. LIFE/Routine INPUT

After or alongside goal onboarding, collect a very small amount of information about the user's normal life.

The system needs to understand:

* approximate wake/sleep pattern
* work/school blocks
* recurring commitments
* available days
* preferred times
* approximate available capacity
* schedule predictability
* relevant existing routines

Again, keep this simple.

The user should NOT have to manually construct their entire calendar before receiving value.

Use simple choices and quick setup.

The goal is:

> Understand enough of the user's normal life to intelligently place ambition-related work inside it.

---

# 8. THE MASTER PLANNING PROMPT

Create or refactor the existing Master Prompt so that it receives:

GOAL BLUEPRINT
+
USER GOAL ANSWERS
+
CURRENT STATE
+
LIFE STRUCTURE
+
CAPACITY
+
CONSTRAINTS
+
PREFERENCES

Its job is to determine:

1. Desired outcome
2. Current state
3. Required capabilities
4. Capability gaps
5. Bottlenecks
6. Critical path
7. Appropriate interventions
8. Minimum sufficient dose
9. Progression
10. Reliability margin
11. 90-day trajectory
12. State gates
13. Evidence requirements
14. Forecast
15. Scheduling requirements
16. Best placement of work inside the user's normal life
17. Mandatory "Why This Matters" (Purpose) & MVS Fallback for every single execution item

### Mandatory Task Item Contract:
Every intervention item generated by the Master Planning Prompt MUST include:
* `title`: Clear, action-oriented session name.
* `why_this_matters`: Plain English 1–2 sentence explanation of the tangible return-on-investment / biological or technical purpose of this specific session (e.g. *"Running slow builds capillary density so your heart rate doesn't spike when running faster later"*).
* `standard_duration_minutes`: Full nominal session dose.
* `mvs_duration_minutes`: Minimum Viable Session dose (emergency fallback).
* `mvs_fallback_description`: Exact concrete 10–15 min micro-task if user is completely out of time or energy.

The Master Prompt should optimize for:

* probability of achieving the ambition
* sustainable execution
* compatibility with the user's life
* low friction
* reliability
* sufficient progression
* preservation of the actual outcome

Do not optimize for maximum workload.
Do not optimize for calendar compliance.
Do not optimize for streaks.
Do not optimize for task count.

---

# 9. THE CENTRAL NEW PRINCIPLE

Add this as a core system rule:

> DO NOT BUILD THE USER'S LIFE AROUND THE GOAL.
> BUILD THE GOAL AROUND THE USER'S LIFE.

The system should attempt to preserve the user's normal routines and existing commitments whenever possible.

Goal interventions should be intelligently inserted into available life windows.

For example:

If the user works 9–5 and normally has reliable evening availability, the system should place appropriate goal work into those windows.

If the user has a long reliable Saturday morning window, deeper work may be placed there.

If Tuesday evenings are consistently unreliable, the system should learn that and stop depending on Tuesday evenings.

---

# 10. CREATE A LIFE STRUCTURE ENGINE

Add a new canonical Life Structure model.

It should represent things such as:

* fixed blocks
* recurring routines
* flexible blocks
* available windows
* preferred windows
* energy windows
* existing commitments
* sleep
* work
* commute
* meals
* personal time
* scheduling constraints

Do not make this a simple task list.

The system needs to understand the difference between:

FIXED
PREFERRED
FLEXIBLE
AVAILABLE
UNAVAILABLE

Where appropriate, also model:

* duration
* recurrence
* priority
* flexibility
* time window
* energy requirement

---

# 11. CREATE A LIFE INTEGRATION / DAILY SCHEDULING ENGINE

The Adaptive 90-Day Engine determines:

> WHAT needs to happen.

The Life Integration Engine determines:

> WHERE and WHEN it should happen.

Every strategic intervention should have scheduling requirements such as:

* duration
* frequency
* intensity
* preferred conditions
* flexibility
* priority
* dependencies
* recovery requirements
* latest acceptable window

The scheduler then places it into the user's real life.

It must consider:

* existing commitments
* available time
* preferred times
* energy
* capacity
* transitions
* recovery
* friction
* schedule reliability
* other ambitions

Do NOT simply distribute goal tasks evenly across days.

---

# 12. DAILY LIFE MUST BECOME THE PRIMARY USER EXPERIENCE

The main dashboard should no longer primarily look like a project tracker.

The user should primarily see:

# TODAY

Example:

6:30 AM
Wake up

7:00 AM
Morning routine

8:30 AM – 5:30 PM
Work

5:30 PM – 6:15 PM
Commute

6:30 PM
Dinner

7:30 PM – 8:15 PM
Half Marathon Training

8:15 PM – 10:00 PM
Personal Time

10:00 PM
Wind down

10:30 PM
Sleep

Goal interventions should be visually integrated into the day rather than appearing as detached tasks.

---

# 13. THE DAILY VIEW SHOULD SHOW CONTEXT

For goal-related activities, show enough information to make them meaningful without overwhelming the user.

Example:

7:30 PM

RUN — 45 MIN

Easy aerobic run

Half Marathon · Week 4

Purpose:
Build aerobic capacity

But keep strategic complexity hidden unless the user asks for it.

The user should understand:

* what to do
* when to do it
* how long it takes
* why it matters (clear, motivating ROI)
* what the 1-click MVS fallback is if today gets chaotic

### 13.1 MVS Mechanics & The Zero-Debt Law
* **Daily Completion:** Executing an MVS dose counts as 100% valid completion for that day. The habit streak is preserved.
* **Zero Backlog Debt:** Tomorrow's schedule NEVER increases or doubles because an MVS was performed today.
* **Gate-Based Adaptation:** The 12-week roadmap is governed by **Adaptive State Gates**, not calendar checklists. If a user utilizes MVS repeatedly for 3 weeks, the engine does not punish or fail them; at the 4-week gate review, it automatically smooths the next phase's pacing to ensure foundational capabilities are solidly verified before scaling volume.

### 13.2 Micro-Rewards & Progression Feedback
Every completed dose provides immediate tangible feedback:
* Advancement on the active **Capability Gate Progress**.
* Maintained **Reliability Score**.
* Acknowledgment of streak and zero-debt momentum.

---

# 14. THE 90-DAY ROADMAP STILL EXISTS

The 90-day roadmap should remain available as the strategic layer.

But it should not dominate the daily experience.

The user should be able to move between:

TODAY
→ THIS WEEK
→ 90-DAY ROADMAP
→ AMBITIONS

The roadmap should show:

* major phases
* current focus
* upcoming milestones
* projected completion
* goal status
* confidence
* important capability progress

Do not turn it into a giant 90-day checklist.

---

# 15. MULTIPLE AMBITIONS

The architecture must support more than one ambition.

Do not assume the user has only one goal.

If a user has:

* Run a Half Marathon
* Learn Spanish
* Build a SaaS

the system must consider their combined life capacity.

Do not independently schedule each ambition without coordination.

The system must reason about:

TOTAL LIFE CAPACITY
+
AMBITION PRIORITIES
+
INTERVENTION LOAD
+
RECOVERY
+
EXISTING COMMITMENTS

and create one coherent daily structure.

If the combined ambitions exceed sustainable capacity, the system should intelligently reduce, defer, reorder, or otherwise adapt lower-priority work rather than silently overloading the user.

---

# 16. ADAPTATION NOW HAPPENS AT TWO LEVELS

The system must distinguish:

## Strategic adaptation

Is the user still on track to achieve the ambition?

Goal
→ State
→ Evidence
→ Trajectory
→ Forecast
→ Replan

## Life adaptation

Is the plan actually fitting into the user's life?

Schedule
→ Execution
→ Friction
→ Capacity
→ Routine changes
→ Reschedule

These two layers must communicate.

Example:

Repeatedly missed Wednesday sessions:

Do NOT simply mark them incomplete.

Investigate whether:

* Wednesday is unreliable
* work is extending
* the session is too long
* the intervention creates too much fatigue
* the schedule is poorly placed
* the overall goal load is too high

Then adapt.

---

# 17. NO-DEBT PRINCIPLE REMAINS

Never automatically turn a missed activity into backlog.

Ask:

> What does the missed activity mean for the current state and probability of achieving the outcome?

Possible responses:

* absorb
* move
* reduce
* replace
* reorder
* remove
* replan

Do not create guilt-driven catch-up schedules.

Do not punish the user for living their life.

---

# 18. LIFE FRICTION BECOMES TELEMETRY

Repeated schedule failures should be treated as information.

Examples:

Repeated evening failures may mean:

* evening availability was incorrectly modeled
* work schedule is too unpredictable
* user has insufficient energy
* session duration is too long
* transition friction is high

The system should learn from this.

The user should never feel like the application is judging them for failing to follow the schedule.

---

# 19. PRESERVE THE EXISTING ADAPTIVE PRINCIPLES

All of the following remain mandatory:

* No-Debt Principle
* Goal Integrity
* State-driven planning
* Capability-based progress
* Evidence-based state updates
* Bottleneck identification
* Critical Path
* MED
* Reliability Margin
* Dynamic Forecast
* Adaptive Rescheduling
* Resume / Compress / Reorder / Replace / Remove / Extend
* Trajectory Versioning
* Explainable strategic changes
* AI is not the database/source of truth
* Calendar is a projection, not the strategic source of truth

---

# 20. REMOVE OBSOLETE PRODUCT MECHANICS

Audit and remove anything that conflicts with the new product.

Potential legacy mechanisms include:

* static 12-week schedules
* static task calendars
* checklist-first progress
* completion percentage as primary progress
* calendar slippage
* "Regenerate 12-Week Schedule"
* old planner logic
* old rescheduler
* old recovery mechanism
* duplicated task systems
* duplicate goal models
* duplicate schedule sources
* old onboarding assumptions
* UI that treats the product as a conventional task planner

Do not remove something merely because it is old.

Remove it when its responsibility has been replaced by the new canonical architecture.

---

# 21. REQUIRED REPOSITORY AUDIT

Before making changes:

Inspect the entire repository.

Map:

* frontend
* backend
* database
* API
* onboarding
* planner
* scheduler
* calendar
* dashboard
* progress
* recovery
* telemetry
* adaptive engine
* AI/LLM integration
* authentication
* tests

Produce an internal migration map:

COMPONENT
→ CURRENT RESPONSIBILITY
→ NEW RESPONSIBILITY
→ KEEP / REFACTOR / REPLACE / MIGRATE / REMOVE
→ DEPENDENCIES
→ MIGRATION PLAN

Do not stop after inspecting the obvious files.

---

# 22. DATABASE MIGRATION

Do not create duplicate models unnecessarily.

Extend or refactor the existing schema where appropriate.

Preserve existing user data where it remains meaningful.

Create canonical models for:

* Life Structure
* Routine / Recurring Blocks
* Availability
* Ambition
* Goal Blueprint
* Trajectory
* Daily Schedule
* Execution

Reuse existing adaptive models where appropriate.

Use proper migrations.

Do not create temporary duplicate sources of truth.

---

# 23. FRONTEND MIGRATION

The frontend must be rebuilt around the new mental model.

Audit and refactor:

* onboarding
* dashboard
* calendar
* schedule
* goal pages
* progress
* recovery
* navigation

The primary navigation should make sense for a person managing their life and ambitions.

Potential structure:

TODAY
MY DAY
AMBITIONS
ROADMAP
REVIEW

Use whatever structure best fits the existing application, but the mental model must be:

**Life first. Ambitions integrated into life.**

---

# 24. API MIGRATION

The frontend must actually consume the canonical adaptive/life APIs.

Do not leave the sophisticated backend disconnected from the UI.

Trace every major user action:

Onboarding
→ API
→ Goal
→ Master Prompt
→ Trajectory
→ Life Integration
→ Daily Schedule
→ Execution
→ Telemetry
→ State
→ Adaptation

No fake frontend data.

No static placeholder schedules.

No legacy API silently controlling the product.

---

# 25. MASTER PROMPT OUTPUT MUST BE STRUCTURED

Do not allow the LLM to simply return free-form prose as the canonical plan.

The LLM should produce structured data that can be validated and persisted.

At minimum:

* goal
* outcome
* assumptions
* current state
* capabilities
* interventions
* trajectory
* schedule requirements
* evidence requirements
* state gates
* forecast
* confidence
* explanation

The application validates and persists this.

The LLM is the reasoning layer.

The application/database is the source of truth.

---

# 26. IMPORTANT: DO NOT OVER-QUESTION THE USER

If the system can infer something safely from:

* selected goal
* predefined goal blueprint
* onboarding answers
* existing life structure
* observed execution

do not ask the user again.

Questions exist to reduce meaningful uncertainty.

They are not a substitute for system intelligence.

---

# 27. USER EXPERIENCE PRINCIPLE

The user should feel:

> "I told the system what I want to achieve and what my life looks like. It figured out the rest."

Not:

> "I spent 20 minutes configuring a productivity system."

The product should absorb complexity.

---

# 28. REQUIRED TEST SCENARIOS

Create or update end-to-end tests for:

### Scenario A

User chooses a goal → completes 5–7 question onboarding → receives personalized 90-day roadmap.

### Scenario B

Goal roadmap is automatically integrated into daily life.

### Scenario C

Existing fixed commitment prevents a goal intervention from fitting → system finds another suitable window.

### Scenario D

User misses a low-priority intervention → no catch-up debt.

### Scenario E

User repeatedly misses the same time window → system detects scheduling friction and moves the intervention.

### Scenario F

User's available weekly capacity decreases → system protects critical ambition work and removes lower-value work.

### Scenario G

User has multiple ambitions → system coordinates them within total life capacity.

### Scenario H

User's routine changes → daily schedule adapts.

### Scenario I

Goal trajectory falls behind → adaptive engine replans from current state rather than old calendar.

### Scenario J

Goal accelerates → system does not add pointless extra work.

### Scenario K

Soft deadline moves → destination remains intact.

### Scenario L

Hard deadline becomes threatened → system does not silently lower the outcome.

### Scenario M

Goal integrity is challenged → system prevents silent goal degradation.

### Scenario N

Deleting legacy planner/scheduler/progress logic does not break the final architecture because the new canonical system owns those responsibilities.

---

# 29. THE MOST IMPORTANT LITMUS TEST

After migration, ask:

> If the old static planner, static schedule generator, old progress system, old recovery system, and old calendar logic were deleted, would the application still fundamentally work?

The answer MUST be YES.

If the answer is NO, the migration is incomplete.

---

# 30. FINAL ARCHITECTURE

The final architecture should clearly communicate:

```text
USER
 ↓
CHOOSE PREDEFINED AMBITION
 ↓
5–7 GOAL-SPECIFIC QUESTIONS
 ↓
LIFE / ROUTINE INPUT
 ↓
MASTER PLANNING PROMPT
 ↓
ADAPTIVE AMBITION ENGINE
 ├── Goal
 ├── State
 ├── Capability Graph
 ├── Evidence
 ├── Bottleneck
 ├── Critical Path
 ├── MED
 ├── Reliability Margin
 ├── Trajectory
 └── Forecast
 ↓
LIFE INTEGRATION ENGINE
 ↓
DAILY SCHEDULE
 ↓
EXECUTION
 ↓
TELEMETRY
 ↓
STATE UPDATE
 ↓
ADAPTATION
 ├── Strategic replan
 └── Daily schedule adaptation
 ↓
UPDATED LIFE + AMBITION PLAN
```

---

# 31. IMPLEMENTATION INSTRUCTIONS

Do NOT merely report what needs to change.

Actually implement the migration.

For every change:

* inspect existing implementation
* reuse what is structurally sound
* refactor where necessary
* replace conflicting architecture
* migrate data
* update APIs
* update frontend
* update tests
* remove obsolete mechanisms

Avoid unnecessary rewrites.

But if an existing implementation encodes the wrong product mental model, replace it.

---

# 32. ACCEPTANCE CRITERIA

Do not claim completion because:

* unit tests pass
* backend exists
* adaptive endpoints exist
* the LLM can generate a roadmap
* the calendar renders
* the old application still works

The system is complete only when the actual user experience demonstrates:

1. User selects a predefined ambition.
2. User answers 5–7 simple goal-specific questions.
3. User provides minimal life/routine information.
4. Master Prompt creates a personalized strategic roadmap.
5. Roadmap is integrated into the user's actual life.
6. User can visualize their entire day.
7. Goal work appears naturally inside that day.
8. Existing commitments are respected.
9. Execution generates telemetry.
10. The system understands meaningful deviations.
11. The system adapts both the trajectory and daily schedule.
12. No-debt behavior works.
13. Goal integrity works.
14. Forecast works.
15. Multiple ambitions can coexist without blindly overloading capacity.
16. Legacy planning mechanisms no longer control the product.

---

# 33. FINAL DELIVERABLE

When implementation is complete, provide:

## A. Architecture changes

What was added, changed, replaced, migrated, and removed.

## B. Legacy purge

Every obsolete system removed or deprecated.

## C. Data model

New/changed canonical models.

## D. Master Prompt

Final production Master Prompt and how structured context is supplied to it.

## E. User journey

From goal selection → onboarding → roadmap → daily life → execution → adaptation.

## F. API trace

Actual frontend → backend → database flow.

## G. End-to-end verification

Results for all required scenarios.

## H. Remaining issues

Only genuine remaining issues.

## I. Final verdict

Choose exactly one:

NOT READY

READY FOR HUMAN QA

FULLY VERIFIED

Do not use "FULLY VERIFIED" unless the new Life + Ambition architecture is actually the canonical product and the old planner architecture no longer controls the application.

The objective is not to make the old application slightly better.

The objective is to transform it into the product described above.