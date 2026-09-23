# ACHIVII — REDESIGN BLUEPRINT

### Product, UX, visual identity & implementation direction

This is the **source of truth** for the redesign prompts given to the coding agent.

It deliberately separates **what Achivii should become** from **what the existing code currently does**. The audit found that the current application is functional in several important areas, but its architecture and UI are inconsistent enough that simply "making it prettier" would not be sufficient.

---

# 01 — THE PRODUCT

## Product name

**Achivii**

The brand identity is **not final yet**.

Logo, wordmark, final colors, typography and tagline will be developed later.

Therefore:

> **Do not treat the current logo, mint accent, or current visual identity as permanent brand decisions.**

The audit identifies the current logo as a Lucide Target icon and the current mint `#07CB6C` as an existing accent, but these are not confirmed final brand choices.

---

# 02 — THE CORE PROMISE

## One sentence

> **Achivii takes someone with an ambitious goal but no clear path and turns that ambition into exactly what they need to do, when they need to do it, until they achieve it.**

This is the most important sentence in the entire redesign.

Every major screen should reinforce it.

---

# 03 — WHAT ACHIVII IS

Achivii is:

### A. A personal goal-execution system

It transforms an ambition into actionable steps.

### B. An AI coach

This is a **future premium capability**.

The AI eventually becomes directly accessible to the user as a coach/companion.

### C. An AI planning system

AI creates and continuously adapts the user's journey.

Therefore:

> **Achivii is not primarily a task manager.**

> **Achivii is not primarily a calendar.**

> **Achivii is not primarily an AI chatbot.**

It is the system connecting:

**Ambition → Strategy → Daily execution → Adaptation → Achievement**

---

# 04 — THE CORE USER PROBLEM

The user generally already knows **what they want**.

Their problem is:

> **"I don't know exactly how to get there."**

They may be:

* busy with school
* busy with work
* pursuing a career
* learning something
* trying to improve their fitness
* building something
* developing a creative ability
* pursuing personal development

They don't necessarily need more motivation.

They need:

> **How?**

> **When?**

> **What do I do today?**

> **Am I actually progressing?**

That is Achivii's territory.

---

# 05 — TARGET USER

Achivii is intentionally broad.

Primary audience:

> **Busy, ambitious people who want to accomplish something meaningful but need help turning the goal into an actionable path.**

Potential users include:

* students
* working professionals
* creators
* founders
* athletes
* learners
* people developing skills
* people pursuing career goals
* people pursuing personal development

However, the common characteristic is **not their profession**.

It is:

> **They have an ambition and need a path.**

---

# 06 — THE 90-DAY MODEL

The official product concept is:

# **90 DAYS**

Not "12 weeks" as the user-facing product concept.

The current implementation technically generates **12 weeks / 84 days**, while the interface calculates a 90-day target date. That discrepancy will need to be resolved during implementation rather than allowed to leak into the new UX.

For the redesign:

> **90 days is the product language.**

The exact technical scheduling model can be reconciled separately.

---

# 07 — THE ACHIVII JOURNEY

The central product loop:

```text
                    AMBITION
                       │
                       ▼
                 CHOOSE A GOAL
                       │
                       ▼
              DEFINE YOUR STARTING
                    POINT
                       │
                       ▼
              ACHIVII BUILDS YOUR
                 90-DAY PATH
                       │
                       ▼
                ┌─────────────┐
                │    TODAY    │
                │             │
                │ Your next   │
                │    step     │
                └──────┬──────┘
                       │
                       ▼
                    EXECUTE
                       │
                       ▼
                    REFLECT
                       │
                       ▼
                    ADAPT
                       │
                       ▼
                 NEXT STEP
                       │
                       ▼
                      ...
                       │
                       ▼
                  ACHIEVEMENT
                       │
                       ▼
                   CELEBRATE
                       │
                       ▼
                  NEXT GOAL
```

This is the **product's heartbeat**.

---

# 08 — THE TWO CORE EXPERIENCES

Achivii should have two complementary experiences.

## TODAY

The user asks:

> **"What do I need to do right now?"**

This is the default.

---

## JOURNEY

The user asks:

> **"Where am I going, and how far have I come?"**

This is the visual roadmap.

---

### Therefore:

> **Today = execution**

> **Journey = orientation**

We need both.

---

# 09 — THE PRIMARY HOME SCREEN

When a user opens Achivii after creating a goal, the first thing they should understand is:

# **What do I need to do today?**

Not:

* a giant analytics dashboard
* a wall of cards
* a task database
* a calendar
* dozens of metrics

The hierarchy should be approximately:

```text
YOUR GOAL

Become a professional video editor

Day 27 / 90

────────────────────────────

TODAY'S STEP

Create your first 60-second
edited sequence.

45 minutes

[ Start session ]

────────────────────────────

Progress

27 / 90

[ View journey ]
```

The exact design will evolve, but the principle does not.

---

# 10 — THE JOURNEY VIEW

The user should also be able to visualize the entire transformation.

This is where the staircase metaphor becomes powerful.

Conceptually:

```text
                     DESTINATION
                         ◆
                         │
                    PHASE 04
                      MASTERY
                         │
                    ─────────
                         │
                    PHASE 03
                    APPLICATION
                         │
                    ─────────
                         │
                    YOU ARE HERE
                         ●
                         │
                    PHASE 02
                   DEVELOPMENT
                         │
                    ─────────
                         │
                    PHASE 01
                    FOUNDATION
                         │
                         ●
                       START
```

But we should **not literally draw a generic staircase and call it a roadmap**.

The design team/agent should explore a sophisticated interpretation of:

* elevation
* depth
* steps
* progression
* architectural geometry
* light
* distance
* destination

The staircase reference is a **conceptual language**, not a template.

---

# 11 — THE TWO VISUAL METAPHORS

## 🪜 THE STAIRCASE

Represents:

**Achivii itself.**

It communicates:

* progress
* effort
* journey
* individual steps
* difficulty
* persistence
* movement toward a destination

The user doesn't have to climb the entire staircase today.

They only need to take:

> **the next step.**

---

## 🏛️ THE ROMAN GARDEN

Represents:

**Achievement.**

It communicates:

* destination
* accomplishment
* mastery
* refinement
* beauty
* timelessness
* a state reached after the journey

The marketing website can use this much more heavily.

The actual application should use the underlying **ideas**, rather than constantly showing Roman statues.

---

# 12 — BRAND PERSONALITY

The four primary brand characteristics are:

### AMBITIOUS

Achivii should feel like it believes meaningful things are possible.

### INTELLIGENT

The product should feel deliberate and thoughtful, not like a generic task generator.

### POWERFUL

The user should feel that a substantial system is working behind the scenes.

### PREMIUM

The experience should feel carefully crafted rather than like a typical productivity template.

---

# 13 — CINEMATIC INTENSITY

Target:

# **7 / 10**

Not a boring SaaS dashboard.

Not a cinematic art installation either.

The balance:

### Marketing

**High visual drama**

### Onboarding

**Cinematic → focused**

### Application

**Premium → calm → functional**

This leads to an important rule:

> **The marketing site inspires. The application focuses.**

---

# 14 — PRODUCT VS WORLD

Chosen direction:

> **Best of both worlds.**

So Achivii should feel like a **world** without becoming difficult to use as a **product**.

The user should feel:

> "This is something different."

while still instantly understanding:

> "Here's what I need to do."

---

# 15 — UX PRINCIPLE

This is a permanent instruction to the agent:

> ### **Achivii should never make the user feel like they are managing a goal. It should make them feel like they are progressing toward one.**

This is one of the most important principles in the entire blueprint.

---

# 16 — SIMPLICITY PRINCIPLE

Another permanent rule:

> ### **Simple by default. Deep when explored.**

The user should not be forced to understand the entire system.

At any moment:

### Primary question

> **What do I do now?**

### Secondary question

> **Why am I doing this?**

### Tertiary question

> **Where does this take me?**

The interface can reveal deeper information progressively.

---

# 17 — PROGRESS

Progress should not be reduced to:

> `37/90`

That can exist, but it shouldn't be the entire definition.

Achivii should eventually combine:

### Completion

How much work was actually done?

### Milestones

What stage of the journey has been reached?

### Results

Is the user actually improving?

### Adaptation

Does the plan need to change?

The current implementation mostly measures task completion, while weekly targets/tests and actual judging are currently incomplete.

The redesigned product should create room for the stronger future model.

---

# 18 — ENCOURAGING INTELLIGENCE

Achivii can judge progress.

But it should **never feel punitive**.

Instead of:

> "You failed."

Use the conceptual language:

> "Your current results suggest we should reinforce this phase."

Instead of:

> "You're behind."

Use:

> "Your pace has changed. Let's adjust the path."

Instead of:

> "Missed."

Use:

> "You didn't complete this step. Here's how we can recover."

The philosophy:

> **Adapt the journey, don't punish the person.**

---

# 19 — ADAPTIVE SYSTEM

The long-term product should behave like:

```text
USER PERFORMANCE
       ↓
UNDERSTAND
       ↓
COMPARE AGAINST TARGET
       ↓
IDENTIFY WHAT CHANGED
       ↓
ADJUST JOURNEY
       ↓
NEW DAILY ACTION
```

The planned v2 concept (`plan-v2-spec.md`) already points toward weekly test logging, retargeting, missed-day carry-forward, checkpoints and AI proof judging, although those aren't all implemented today.

Therefore the redesign should **prepare the UI architecture for adaptation without pretending those backend capabilities already exist.**

---

# 20 — FREE VS PREMIUM

## FREE — ACHIVII

The core product:

* curated preset pathways
* 90-day journey
* AI-generated plan
* daily execution
* weekly progression
* progress
* journey visualization
* completion
* celebration

---

# 21 — PREMIUM — ACHIVII COACH

Future paid feature.

The AI becomes visible.

Potential future experience:

> **Talk to your coach.**

It can eventually:

* understand setbacks
* answer questions
* explain tasks
* help users recover
* adjust plans
* provide personalized guidance
* become an ongoing AI companion

The current system has **no chat functionality**, so the redesign should present the architecture for this without falsely implying it is currently operational.

---

# 22 — PREMIUM — CUSTOM JOURNEYS

Current code supports custom goal creation, but the intended business model says:

> **Custom goals are paid.**

That means the redesign must eventually change the current behavior.

The new experience should distinguish:

### Preset pathways

Available in the free experience.

### Custom journey

Visible, attractive and understandable — but gated behind payment.

For example:

> **Have something unique in mind?**

> Build a journey around your own goal with Achivii.

**[ Unlock Custom Journeys ]**

Do not make the locked experience feel like an aggressive upsell.

---

# 23 — PREMIUM ARCHITECTURE

Even though the paid features aren't fully implemented yet, the interface should be architected so that we don't have to redesign the application later.

The navigation should have room for:

```text
TODAY

JOURNEY

PROGRESS

COACH ✦

MY GOALS

...
```

But we should **not automatically create ten empty pages** just because future features exist.

The principle:

> **Design for the future architecture without shipping fake functionality.**

---

# 24 — GOAL PRESETS

The free experience should contain multiple goal areas.

The exact final taxonomy can evolve, but the product should support categories such as:

* Career
* Fitness
* Learning
* Business
* Creative
* Personal development
* Other curated pathways

The current application already has **10 built-in "Certified" preset pathways**, currently spanning areas such as Tech & Career, Fitness & Health, Creative & Media, and Mastery & Mind.

The redesign should turn these into a coherent **pathway library**, rather than repeating the current pathway gallery in multiple locations.

---

# 25 — MARKETING WEBSITE

The marketing website should answer five questions extremely quickly:

### 1. What is Achivii?

### 2. Who is it for?

### 3. How does it work?

### 4. Why is it different?

### 5. What happens if I start?

A potential conceptual structure:

```text
HERO
│
├── Ambition → Path
│
├── Visual staircase
│
├── Start your journey
│
▼
THE PROBLEM
"I know what I want.
I don't know what to do next."
│
▼
THE ACHIVII SYSTEM
Ambition
→ Plan
→ Today
→ Progress
→ Achievement
│
▼
THE JOURNEY
Visual 90-day experience
│
▼
TODAY
Show the daily execution experience
│
▼
ADAPTIVE INTELLIGENCE
How Achivii adjusts the journey
│
▼
PATHWAYS
Preset goals
│
▼
COACH
Premium capability
│
▼
CUSTOM JOURNEYS
Premium capability
│
▼
ACHIEVEMENT
Roman-garden-inspired visual moment
│
▼
CTA
Start your journey
```

This is a **direction**, not yet the final copy.

---

# 26 — THE APPLICATION

The application should be substantially calmer than the landing page.

Think:

> **The outside world tells you why you should climb.**

> **The application tells you where to put your foot next.**

That distinction is critical.

---

# 27 — CORE APPLICATION INFORMATION ARCHITECTURE

Proposed direction:

```text
ACHIVII
│
├── Today
│
├── Journey
│
├── Progress
│
├── Coach ✦
│
└── Account
```

Potentially:

```text
MY GOAL
```

as a contextual area rather than another giant navigation section.

The exact navigation can be refined during the UI phase.

---

# 28 — ONBOARDING

The onboarding combines two approaches:

> **A + B**

Meaning:

### Start directly

> What do you want to accomplish?

but also establish the emotional experience.

Something conceptually like:

---

**Every achievement begins with a direction.**

### What do you want to accomplish?

[ Career ]

[ Fitness ]

[ Learning ]

[ Creative ]

[ Business ]

[ Personal ]

...

Then:

> **Tell us where you're starting.**

Then:

> **Tell us what success looks like.**

Then:

> **We'll build your 90-day path.**

---

# 29 — GOAL CREATION

The existing onboarding collects meaningful information including:

* schedule
* days per week
* daily time
* wake/sleep times
* busy hours
* commitments
* current level
* definition of success
* equipment/resources
* main obstacle

and then generates the roadmap.

The redesign should **preserve that intelligence**, while making the experience dramatically clearer and less overwhelming.

We should not simply remove useful questions to make the UI look minimal.

Instead:

> **Make complex intelligence feel simple.**

---

# 30 — THE 90-DAY GENERATION MOMENT

This should become an important emotional moment.

The user has given Achivii their ambition.

Then:

> **Building your path...**

The experience can show meaningful stages:

```text
UNDERSTANDING YOUR GOAL       ✓

MAPPING YOUR STARTING POINT   ✓

BUILDING YOUR JOURNEY         ...

DESIGNING YOUR FIRST STEPS    ...
```

The existing application already has a streamed progress experience during generation, so the redesign should preserve that functionality.

---

# 31 — THE DAILY SESSION

This is arguably the most important screen.

It should answer:

### What?

What am I doing?

### Why?

Why does it matter?

### How?

How do I actually do it?

### Done when?

How do I know I completed it?

The current implementation already provides task instructions, output, "done when", focus cue, pitfall and a shorter fallback version.

That is valuable functionality.

**Do not sacrifice it for visual minimalism.**

Instead, progressively reveal it.

---

# 32 — FOCUS MODE

The current application includes a focus timer.

That can become a beautiful focused state:

```text
TODAY'S STEP

Create your first sequence.

────────────────

45:00

        [ Start ]

────────────────

Focus on:
...

When you're done:
...
```

The existing timer should remain functional while its visual presentation is redesigned.

---

# 33 — WEEKLY REVIEW

Weekly review should be the bridge between:

**execution → adaptation**

Conceptually:

> **How did this week go?**

Then:

* What did you complete?
* What changed?
* What did you learn?
* How did your result compare with the target?
* What should happen next?

Eventually:

> **Achivii adjusts next week's journey.**

The current weekly progression and review functionality must be preserved during redesign.

---

# 34 — ACHIEVEMENT

At the end:

```text
YOU MADE IT.

90 DAYS
COMPLETE

[ Goal ]

[ Results ]

[ What you accomplished ]

────────────────

Your journey is complete.

What comes next?
```

Then:

### Celebrate

→

### Review results

→

### Start next goal

This is where the **Roman garden visual language** can become especially powerful.

The destination should feel different from the everyday staircase.

---

# 35 — DESIGN LANGUAGE

The agent should eventually derive a design system from these principles:

### Architectural

Strong structure and geometry.

### Cinematic

Controlled depth, lighting and composition.

### Premium

High-quality typography and spacing.

### Minimal

Don't confuse minimalism with emptiness.

### Powerful

Large moments should have visual weight.

### Intelligent

Information hierarchy should feel intentional.

---

# 36 — IMAGERY

Images should have a purpose.

We should avoid random stock imagery.

The visual vocabulary can include:

* architecture
* staircases
* paths
* monumental spaces
* classical environments
* atmospheric landscapes
* silhouettes
* depth
* light emerging from darkness

But:

> **Do not turn Achivii into a Roman-history aesthetic.**

The Roman garden is a metaphor.

The staircase is a metaphor.

Achivii's identity is the **journey between them**.

---

# 37 — MOTION

Motion should communicate:

### Progress

Movement forward/upward.

### Transition

Moving from one stage to another.

### Focus

Reducing visual noise when entering a task.

### Achievement

Expansion/reveal/arrival.

Avoid:

* meaningless animations
* constant floating elements
* excessive parallax
* distracting micro-interactions
* animation for its own sake

Motion should feel **intentional and architectural**.

---

# 38 — UI PRINCIPLE

The current application has approximately 1,010 hard-coded hex values, no shared UI primitives, significant component duplication and several very large components.

Therefore the redesign should establish a real design system.

At minimum:

```text
Color tokens
Typography tokens
Spacing
Radius
Borders
Buttons
Inputs
Cards
Badges
Dialogs
Sheets
Navigation
Progress indicators
Journey components
Task components
Empty states
Loading states
Error states
```

---

# 39 — COMPONENT ARCHITECTURE

The current UI has several very large components:

* `OnboardingWizard` — ~3,038 lines
* `ExecutionDashboard` — ~1,315 lines
* `Home` — ~1,088 lines

There are also duplicated pathway galleries, duplicated configuration and roughly eight independently implemented modal patterns.

Therefore:

> **The redesign should not reproduce the existing component architecture.**

We should gradually extract reusable primitives and presentation components while protecting the existing business logic.

---

# 40 — TECHNICAL REDESIGN RULE

This is extremely important for the coding agent:

> **Do not confuse visual redesign with permission to rewrite the backend.**

The backend, schema, API client, goal/auth state and critical onboarding/dashboard logic should not be casually modified during the first redesign pass.

The initial redesign should primarily:

**restructure presentation around existing functionality.**

Not:

**rewrite the product's underlying mechanics.**

---

# 41 — WHAT MUST NOT BREAK

## CRITICAL

Preserve:

* authentication
* goal creation
* preset pathway launch
* onboarding payload
* AI roadmap generation
* generation progress stream
* saving goals
* daily task retrieval
* daily completion
* task notes
* focus session
* weekly review
* weekly progression
* roadmap
* reset/switch goal behavior
* draft goal carried through signup
* offline indicator
* browser-history behavior in onboarding

---

# 42 — WHAT CAN BE REDESIGNED FREELY

Relatively safe redesign targets:

* landing page
* pathway picker
* pathway gallery
* navbar
* authentication visuals
* roadmap
* plan presentation
* evidence/basis badges
* full-day visualization
* focus timer visuals
* global tokens/theme

This gives us a good starting point.

---

# 43 — THINGS WE SHOULD NOT PRETEND EXIST

The redesigned UI must not falsely imply that these are currently operational:

* analytics
* notifications
* payments
* AI chat
* multiple active goals
* fully implemented proof judging
* completed goal state
* persistent challenge progress
* complete test/target judging

We can design the architecture for them.

We shouldn't fake them.

---

# 44 — RESPONSIVE DESIGN

The product should be designed **mobile-first**, while desktop can take advantage of larger compositions.

The existing mobile experience does not currently satisfy the documented design rules around sheets, 44px targets and scrolling.

Therefore:

### Mobile

Primary execution device.

### Desktop

Primary exploration/planning environment.

That means the desktop Journey view can be expansive, while mobile should prioritize:

> **Today → execute → progress**

---

# 45 — DESKTOP EXPERIENCE

Desktop can provide:

```text
┌───────────────────────────────────────────────┐
│ ACHIVII                         Profile       │
├────────────┬──────────────────────────────────┤
│            │                                  │
│ TODAY      │        TODAY'S STEP              │
│ JOURNEY    │                                  │
│ PROGRESS   │        ...                       │
│            │                                  │
│            │                                  │
└────────────┴──────────────────────────────────┘
```

But we shouldn't commit to this exact sidebar until the UI exploration phase.

---

# 46 — MOBILE EXPERIENCE

Mobile should feel closer to:

```text
┌─────────────────────┐
│ Achivii       •••   │
│                     │
│ DAY 27 / 90         │
│                     │
│ TODAY'S STEP        │
│                     │
│ Create your first   │
│ 60-second sequence  │
│                     │
│ 45 min              │
│                     │
│ [ START ]           │
│                     │
│ ───────────────     │
│                     │
│ Your journey  →     │
└─────────────────────┘
```

The user should be able to execute with minimal navigation.

---

# 47 — THE MARKETING ↔ PRODUCT TRANSITION

The transition should be intentional.

### Marketing:

**"You have somewhere to go."**

### Onboarding:

**"Tell us where."**

### Generation:

**"We're building your path."**

### Dashboard:

**"Here's your next step."**

### Journey:

**"Here's the path."**

### Completion:

**"You made it."**

That gives the entire product one continuous narrative.

---

# 48 — DESIGN NORTH STAR

If the agent remembers only one thing:

> ## **Achivii turns ambition into a path, and a path into daily action.**

And visually:

> ## **The staircase is the journey. The destination is the achievement.**

And UX-wise:

> ## **Always bring the user back to the next step.**

---

# 49 — THE REDESIGN STRATEGY

The redesign is executed in controlled stages.

### PHASE 0

**Global design foundation**

Establish:

* typography
* colors
* spacing
* components
* visual language
* motion principles
* responsive rules

### PHASE 1

**Marketing homepage**

Transform the current landing page into the new Achivii world.

### PHASE 2

**Authentication**

Move away from modal-dependent architecture where appropriate.

### PHASE 3

**Onboarding**

Turn goal creation into a premium, guided experience.

### PHASE 4

**Journey generation**

Make the creation of the 90-day path feel meaningful.

### PHASE 5

**Today**

Build the central execution experience.

### PHASE 6

**Journey**

Build the visual 90-day roadmap.

### PHASE 7

**Weekly review + adaptation**

Create the bridge between performance and the next stage.

### PHASE 8

**Progress**

Build meaningful progress rather than superficial statistics.

### PHASE 9

**Achievement**

Create the completion/celebration experience.

### PHASE 10

**Premium architecture**

Coach + Custom Journeys.

### PHASE 11

**Mobile**

Optimize the entire experience for small screens.

### PHASE 12

**Global polish**

Consistency, accessibility, performance, states and regression testing.

---

# 50 — THE AGENT PROMPT STRUCTURE

We are **not** going to give the agent one enormous prompt saying:

> "Redesign Achivii."

Instead, every prompt will have a structure like:

```text
ACHIVII REDESIGN — PHASE X

CONTEXT
What Achivii is.

OBJECTIVE
What we are changing.

DESIGN DIRECTION
How it should feel.

USER EXPERIENCE
What the user should understand/do.

VISUAL REQUIREMENTS
Specific visual rules.

FUNCTIONAL REQUIREMENTS
What must continue working.

ARCHITECTURAL REQUIREMENTS
What can/cannot be changed.

DO NOT
Things the agent must avoid.

IMPLEMENTATION
What to inspect/change.

VALIDATION
How the agent should verify it works.

SUCCESS CRITERIA
What "done" means.
```

---

# 51 — WE DON'T YET HAVE A FINAL VISUAL SYSTEM

And that's intentional.

We know the **direction**:

> Ambitious
> Intelligent
> Powerful
> Premium
> Cinematic 7/10
> Architectural
> Journey-oriented
> Dark/light contrast
> Staircase → progress
> Garden → achievement

But we haven't yet decided things like:

* exact typeface
* exact colors
* exact accent
* exact border treatment
* exact radius
* exact background treatment
* exact navigation style
* exact card style
* exact motion language

**These are not invented in the blueprint.**

They will be explored deliberately in the next step (Visual Design System).

---

# THE ACHIVII DESIGN NORTH STAR

> **Achivii is a premium, intelligent goal-execution system for ambitious people who know where they want to go but need help finding the path. It transforms an ambition into a 90-day journey, then turns that journey into one clear action at a time. The staircase represents the journey; the destination represents achievement. The interface should inspire without distracting, guide without overwhelming, and adapt without discouraging.**

---

# OPEN DECISIONS (from the codebase review)

These collide with the current code or with rules in this document, and should be settled before the phase prompt that depends on them.

1. **Backend scope per phase.** §40 limits backend changes, but some phases need backend work that doesn't exist yet: goal completion (Phase 9; nothing sets `Goal.status` to `completed`), custom-journey gating (§22 / Phase 10; `POST /api/goal/create` is ungated, so a frontend-only lock is bypassable), and weekly test results (Phases 7–8; no result is ever stored). Proposed rule: each phase prompt may explicitly permit a small, named backend change; anything unnamed stays off-limits.
2. **90 days vs 84 days.** The plan is 12 weeks; the counter says "Day N of 90". Decide what fills days 85–90 (a final-test week, a closing stretch, or mapping day 84 to day 90 in the UI) before the Journey view is designed.
3. **Which dashboard becomes Today.** The navbar's "Today" points to `/` (the simplified dashboard in `Home.tsx`); the full one is `/dashboard`. Phase 5 must choose one, which changes `ProtectedRoute` redirects.
4. **Phase 2 changes routes.** Adding `/login` and `/signup` touches `ProtectedRoute` and the draft-goal-through-signup flow (both critical). That phase prompt must permit the route change and list both for regression checks.
5. **Mobile in every phase.** Mobile is the primary execution device (§44). Each phase carries mobile acceptance criteria; Phase 11 becomes a final sweep rather than the first time mobile is considered.
6. **`Design.md` conflicts with this blueprint.** It bans sparkle icons (the ✦ on Coach), glassmorphism and large radii, and its strict minimalism pulls against cinematic 7/10 depth. Rewrite it as a Phase 0 deliverable so agents don't follow the old rules. *Direction settled by `docs/visual-design-system.md`, which supersedes `Design.md`; the rewrite itself is still a Phase 0 task.*
7. **Journey must handle 2–4 method-named phases.** v2 goals get 2–4 phases named by the chosen method; v1 goals use Foundation / Acceleration / Mastery. The Journey view cannot assume four fixed phases.
8. **Honest generation stages.** The backend streams three real events (`search`, `method`, `plan`), and the "search" step is already misleading because nothing is searched. The §30 stages may map onto these only if every label describes something real.
9. **Every Today state.** Define rest day, test day, week complete / review due, review failed (503, week unchanged), after week 12, and API offline — not only the normal practice day.
10. **"Dark/light contrast" (§51).** Clarify whether this is an aesthetic of contrast or a light-mode theme; it decides how color tokens are structured. *Resolved by `docs/visual-design-system.md` §27: dark only, with light surfaces used compositionally; no theme toggle.*
11. **Onboarding categories vs free presets.** §28's categories (Career, Fitness, Learning, Creative, Business, Personal) cover the 10 presets unevenly; Career and Personal are thin. Free users can only pick presets, so the category step must map onto them.
12. **Semantic tokens.** Because the brand isn't final (§01), Phase 0 tokens are named by role (`accent`, `surface`, `text-muted`), never by color, so a rebrand is a one-file change.
