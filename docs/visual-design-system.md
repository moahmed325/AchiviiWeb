# ACHIVII VISUAL DESIGN SYSTEM v1

Companion to `docs/redesign-blueprint.md`. The blueprint defines what Achivii is; this document defines how it looks.

Built from two references used together:

* **An impossible architectural staircase** (monochrome, surreal, a lone figure climbing through light and darkness) — *how you get there*.
* **A Roman garden landing page** (dreamlike, vintage, cinematic imagery with translucent dark panels over it) — *where you arrive*.

The unifying idea:

> **A monumental journey from ambition to achievement.**

The Roman garden represents **where you arrive**.
The staircase represents **how you get there**.

That gives a much stronger identity than copying either reference.

---

# 1. Overall aesthetic

### Direction: **Dark, cinematic, architectural, premium, intelligent**

Target intensity: **7/10**

The visual language should feel:

* sophisticated
* mysterious
* ambitious
* spacious
* powerful
* calm
* slightly surreal
* technologically intelligent

But **not**:

* cyberpunk
* neon-heavy
* gamer-like
* generic "AI purple gradient"
* overly futuristic
* corporate SaaS
* luxury-fashion pretentious

The staircase reference gives us the **architecture and progression**.

The Roman garden gives us the **world and destination**.

Achivii sits between those two.

---

# 2. Color system

The current bright mint green is **not** kept as the dominant identity.

### Primary background

**Near-black / charcoal** — `#0B0B0A`

Not pure black. This gives us the architectural darkness of the staircase.

### Primary surface

`#141413`

### Elevated surface

`#1C1C1A`

### Light surface

For occasional contrast sections: `#F1EFE8`

### Primary text

`#F5F3EC`

### Secondary text

`#A7A59E`

### Muted text

`#6F6D67`

---

## Accent color

Borrowed from the Roman garden image.

### **Ancient / botanical green**

`#7FA58B`

Not fluorescent. Not "tech green." More like:

> **deep botanical green + modern refinement**

A slightly brighter version for interactive states: `#A8C8A9`

This keeps a subtle connection to the natural garden without making Achivii look like a fitness app.

---

## Achievement accent

For major achievement moments:

### Warm stone / antique gold

`#C8A96B`

Used **very sparingly**. Not gold everywhere. It should mean:

> **You've arrived.**

The semantic system:

**Green = growth / progression**

**Gold = achievement**

**White = clarity**

**Black = depth / potential**

---

# 3. Color philosophy

The site should mostly live in:

> **black + off-white + muted botanical green**

with:

> **warm stone/gold reserved for meaningful moments.**

That is much more premium than throwing five accent colors into the UI.

---

# 4. Typography

We need a contrast between **human ambition** and **machine precision**.

Primary typeface: a **modern grotesk/sans-serif**, in the family of:

* Inter
* Geist
* Söhne-style grotesk
* Neue Montreal-style grotesk

The exact font is decided during implementation.

### Headlines

Large. Bold. Confident.

> **Your ambition deserves a path.**

or:

> **Know where you're going.
> Know what to do next.**

### Body

Quiet and highly readable.

### Numbers

Large numbers such as:

> **27 / 90**

> **73%**

> **12 DAYS**

get a slightly distinctive typographic treatment. The Roman reference's oversized `50,000+` statistic shows how large numbers can become visual objects rather than ordinary UI text. Achivii uses that principle.

---

# 5. Typography hierarchy

```text
DISPLAY
72–96px

H1
48–64px

H2
32–44px

H3
22–28px

BODY
16–18px

SMALL
13–14px

MICRO
11–12px
```

These are **starting ranges**, not rigid values.

The key is:

> **Large typography + enormous breathing room.**

---

# 6. The hero section

Lesson from the Roman-garden reference:

### Don't put the entire website inside a boring white container.

The visual itself is the environment. The hero should feel like a **portal into the product's world**.

Potential composition:

```text
┌───────────────────────────────────────────────┐
│ ACHIVII                  Product  Pricing     │
│                                               │
│                                               │
│              [architectural scene]            │
│                                               │
│                                               │
│       YOUR AMBITION                           │
│       DESERVES A PATH.                        │
│                                               │
│       Turn an ambitious goal into             │
│       a 90-day path, one step at a time.      │
│                                               │
│       [ Start your journey ]                  │
│                                               │
└───────────────────────────────────────────────┘
```

The hero should feel **immersive**.

---

# 7. The staircase

One of Achivii's signature assets.

Do **not** simply put a staircase image in the hero and call it done. Use the concept in three ways:

### 1. Marketing

Actual cinematic staircase imagery.

### 2. Journey visualization

An abstracted staircase / ascending-path interface.

### 3. Motion

Steps subtly reveal themselves as the user progresses.

This gives the metaphor actual product meaning.

---

# 8. The staircase represents progress

A user's journey:

**Day 1** — they are at the bottom.

**Day 30** — they're visibly higher.

**Day 60** — they're entering another architectural section.

**Day 90** — they're at the destination.

Eventually:

> **The user's journey itself becomes a staircase.**

That is much more interesting than another progress bar.

---

# 9. Conventional progress indicators stay

Don't eliminate `27 / 90` or a progress bar. They are useful.

### Quick understanding

`27 / 90`

### Emotional understanding

The staircase.

### Strategic understanding

The journey map.

Three layers of progress.

---

# 10. Cards

The Roman reference uses translucent dark cards over imagery. Adopt the principle, **not the exact design.**

Achivii cards are:

* dark
* slightly translucent where appropriate
* subtle borders
* low-radius or moderately rounded
* deep shadows
* generous padding

Border starting point: `1px solid rgba(255,255,255,.08)`

The goal:

> **Architectural surfaces, not floating candy-colored cards.**

---

# 11. Glassmorphism

### Use lightly.

Allowed:

* backdrop blur
* translucent surfaces
* atmospheric overlays

Not allowed:

> "Every element is glass."

Glass appears primarily when a component sits **over an image or atmospheric environment**. Inside the application, solid dark surfaces dominate.

---

# 12. Buttons

### Primary CTA

Solid off-white with dark text.

> **Start your journey →**

The main CTA is not necessarily green. The Roman reference demonstrates the principle:

> **Neutral CTA + dramatic environment.**

### Secondary

Transparent / outlined.

### Premium

Subtle botanical green or warm gold, depending on context.

---

# 13. Marketing navigation

### Floating navigation

Rather than a giant SaaS navbar:

```text
ACHIVII

          How it works
          Journeys
          Coach
          Pricing

                    [ Start ]
```

Potentially contained in a subtle translucent pill when over imagery.

The application navigation is much more functional.

---

# 14. Application navigation

### Desktop

A restrained persistent navigation:

```text
ACHIVII

Today
Journey
Progress

──────────

Coach ✦

──────────

Account
```

### Mobile

Bottom navigation or a similarly accessible compact system.

The rule:

> **Navigation should disappear into the experience, not compete with it.**

---

# 15. Imagery

Imagery should feel:

* monumental
* timeless
* surreal
* architectural
* atmospheric
* natural
* slightly dreamlike

### Good

Roman gardens, ancient architecture, long staircases, monumental corridors, stone structures, mountains, paths, fog, sunlight through architecture, silhouettes.

### Avoid

Generic smiling business people, stock photos of laptops, people shaking hands, generic AI robots, purple neural-network graphics, overly obvious productivity imagery.

---

# 16. Image treatment

Images belong to the same universe.

The Roman reference is **dreamlike / vintage / cinematic**.

The staircase is **monochromatic / architectural / surreal**.

### Marketing imagery

**Rich + atmospheric**

### Product imagery

**Monochrome + restrained**

This creates a transition:

**World → System**

---

# 17. The Roman garden

The garden is a **destination language**, not a recurring decoration.

Use it primarily around:

* the hero
* achievement
* major brand storytelling
* completion

On completing 90 days the environment changes: the darkness opens, the architecture becomes warmer, the garden appears. The user has arrived.

---

# 18. Achievement screen

Not "🎉 Congratulations!" with confetti everywhere. Instead:

```text
                    90 DAYS

                 COMPLETE

            ────────────────

            You reached the
              destination.

          [ Your results ]

          [ Begin another journey ]
```

with an atmospheric garden slowly appearing behind the interface.

---

# 19. Motion

Motion is:

### Slow

### Intentional

### Physical

### Directional

Think: ascent, emergence, unfolding, revealing, arriving.

Not: bounce, spin, pop, shake.

---

# 20. Journey animation

When the user completes a task, the step illuminates, then the next step appears.

```text
      ○
      │
      │
     ● ← YOU
      │
      │
      ○
```

After completion:

```text
      ○
      │
     ● ← COMPLETED
      │
      │
     ◉ ← NEXT
```

Very subtle. No game-like XP explosion.

---

# 21. Scroll behavior

The landing page can use cinematic scroll transitions:

**Hero**

↓ The staircase begins appearing.

↓ **Your goal becomes a path.**

↓ Steps unfold.

↓ **Every day has a purpose.**

↓ The user sees the Today interface.

↓ **The path adapts.**

↓ The environment changes.

↓ **Then you arrive.**

This gives the marketing site a narrative.

---

# 22. Negative space

The staircase image has enormous amounts of black empty space. Borrow that.

Don't fill every inch. Large empty areas make:

* typography more powerful
* imagery more dramatic
* progress feel larger
* premium design feel intentional

The website should breathe.

---

# 23. Border radius

Avoid giant rounded rectangles everywhere.

### Marketing

Moderate radius.

### Application

Small-to-moderate radius.

### Special cards

Almost architectural / rectangular.

The staircase reference is very geometric; that geometry influences the UI.

---

# 24. Icons

A single coherent icon family:

* simple
* thin
* geometric
* understated

Avoid colorful icons, emoji-like icons, and overly detailed illustrations.

Icons support the hierarchy; they are not decoration.

---

# 25. Progress components

An Achivii-specific family:

| Element | Symbol |
|---|---|
| Step | `○` |
| Active step | `●` |
| Completed | `✓` |
| Milestone | `◆` |
| Destination | `✦` |

These become **visual components**, not literal symbols everywhere.

> **Achivii has its own visual grammar for progression.**

---

# 26. Visual levels

The visual intensity changes depending on what the user is doing.

### Level 1 — Today

Minimal. Immediate. Focused.

### Level 2 — Journey

More visual. Strategic.

### Level 3 — Progress

Analytical.

### Level 4 — Achievement

Cinematic.

---

# 27. Dark vs light

## Marketing

Primarily **dark**.

## Application

Primarily **dark**, with controlled light surfaces where useful.

## Achievement

Potentially transitions toward warmer / lighter imagery.

The narrative:

> **Darkness → movement → arrival → light.**

---

# 28. Responsive behavior

Do **not** simply shrink desktop down to mobile.

On mobile, hide complexity. Prioritize:

**Today → Start → Complete → Progress**

Journey becomes a vertically navigable experience; the staircase becomes a vertical progression.

Desktop can show more environmental depth.

---

# 29. Accessibility

Despite the cinematic aesthetic:

* text must remain readable
* contrast must be strong
* buttons must have adequate touch targets
* motion respects reduced-motion preferences
* important information never exists only in imagery
* color is never the only progress indicator

Premium never means inaccessible.

---

# 30. The final visual formula

```text
ACHIVII

        ARCHITECTURE
             +
          NATURE
             +
         DARKNESS
             +
           LIGHT
             +
        PROGRESSION
             +
        INTELLIGENCE
             +
        HUMAN AMBITION
             =
        ACHIVII WORLD
```

And visually:

```text
STAIRCASE
   ↓
JOURNEY
   ↓
PROGRESS
   ↓
ACHIEVEMENT
   ↓
ROMAN GARDEN
```

---

# 31. What we are explicitly NOT doing

The agent must **not**:

* ❌ Copy the Roman-garden reference website.
* ❌ Copy the staircase artwork.
* ❌ Turn Achivii into a Roman-themed website.
* ❌ Use generic AI gradients.
* ❌ Make everything neon green.
* ❌ Put glassmorphism everywhere.
* ❌ Create a dashboard full of cards.
* ❌ Add unnecessary charts.
* ❌ Use excessive animation.
* ❌ Make the product feel like a game.
* ❌ Sacrifice usability for cinematic visuals.
* ❌ Replace working functionality simply to make the code cleaner.

---

# 32. The Achivii visual identity

With the logo removed, someone should eventually be able to say **"That's Achivii"** because of the combination of:

* deep architectural darkness
* warm natural imagery
* massive typography
* geometric progression
* botanical green
* warm achievement tones
* extreme negative space
* subtle motion
* staircase language

---

# 33. The three most important visual rules

### RULE 1

> **The interface should feel like a journey, not a dashboard.**

### RULE 2

> **Use the staircase to represent progress and the garden to represent achievement.**

### RULE 3

> **Cinematic when inspiring, minimal when executing.**

---

# IMPLEMENTATION NOTES (from the codebase review)

Constraints the master prompt should carry so the agent doesn't have to rediscover them.

1. **This document supersedes `Design.md`.** `Design.md` bans glassmorphism, sparkle-style icons (✦) and large radii, and prefers borders over shadows. Sections 10, 11, 14 and 25 here deliberately allow light glass, deep shadows and the ✦ destination mark. Rewrite `Design.md` in Phase 0 so it keeps its still-valid mobile, scroll and touch-target rules and adopts this visual direction.
2. **Muted text fails body-text contrast.** On `#0B0B0A`: primary `#F5F3EC` ≈ 18:1, secondary `#A7A59E` ≈ 8:1, accent `#7FA58B` ≈ 7:1, gold `#C8A96B` ≈ 9:1 — all fine. Muted `#6F6D67` is ≈ 3.8:1, below the 4.5:1 AA minimum for normal text. Restrict it to large text (≥ 18px, or ≥ 14px bold), placeholders and decorative dividers, or lighten it. The current UI uses 9–11px text about 190 times; MICRO (11–12px) should use secondary text color, never muted.
3. **Green on the light surface fails.** `#7FA58B` on `#F1EFE8` is ≈ 2.4:1. Light sections need a darker green variant for any text, icons or focus rings.
4. **Tokens are named by role, not color.** Brand values aren't final (blueprint §01). Define `background`, `surface`, `surface-elevated`, `surface-inverse`, `text`, `text-secondary`, `text-muted`, `accent`, `accent-hover`, `achievement`, `border` in `index.css` `@theme`, so a rebrand is a one-file change. Replace the current mint tokens; remove the global `--radius-xl/2xl/3xl` override that forces every large radius to 0.375rem.
5. **Dark only, no theme toggle.** Section 27 settles blueprint open decision 10: light surfaces are compositional (sections, achievement), not a light mode.
6. **Numbers need tabular figures.** Whatever font is chosen, it must support `font-variant-numeric: tabular-nums` so `27 / 90` doesn't shift width as it counts. A grotesk with a matching mono (for example Geist + Geist Mono) covers both the UI and the distinctive numeric treatment. Current fonts are Plus Jakarta Sans + JetBrains Mono via Google Fonts in `index.html`.
7. **The staircase can be driven by real data today.** Step = a day's task (`DailyTask.status`), landing = a phase boundary from `Goal.roadmap.phases` (2–4 phases, method-named; v1 goals use 3 fixed phases), destination = `roadmap.finalGoal`. The completion animation in section 20 can use the existing `PATCH /api/goal/tasks/:id`. The achievement transition in sections 17–18 cannot, because no goal ever reaches a completed state (blueprint open decision 1).
8. **Brand imagery.** Two master images are provided and live in `frontend/public/images/brand/`:
   - `garden.jpg` — the destination (colonnade, hanging gardens, emerald pool, night sky), 682×1024 portrait.
   - `staircase.jpg` — the journey (monochrome impossible staircase, lone climber), 735×985 portrait, heavily compressed (33 KB).

   Both are portrait and under 1,100 px on the long edge. That suits mobile heroes, split layouts (image in one column), cropped panels and blurred or darkened backgrounds. It does **not** suit a sharp full-bleed desktop hero: at 1440–2560 px wide they would be upscaled 2–3.5× and look soft. Until higher-resolution versions exist, compositions must not rely on either image being crisp at full desktop width. The Roman-garden website screenshot is a layout reference only and is not an asset.

   The existing per-pathway photos (`frontend/public/images/goals/*`, chosen by `getGoalImage`) and `images/blueprints/*` don't match "product imagery = monochrome + restrained" and need replacing or a monochrome treatment.
9. **Dependencies may be added.** New packages are allowed where they earn their place (for example Motion for the scroll-driven narrative in section 21 and the journey animation in section 20, shadcn/ui primitives, a self-hosted font package). Each addition is named in the phase that introduces it. Every animation still needs a `prefers-reduced-motion` path; `index.css` already has a reduced-motion base rule.
10. **Performance budget for cinematic visuals.** Serve hero imagery as responsive AVIF/WebP with explicit dimensions. Avoid `backdrop-blur` over large moving images on mobile; use a pre-darkened image layer instead.
11. **Icons.** lucide-react is already the single icon family and fits "thin, geometric, understated" at stroke width 1.5. Keep it; don't add a second set.
