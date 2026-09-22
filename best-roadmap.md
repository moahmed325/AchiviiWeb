# Best Possible Roadmap

**Mission:** for any custom goal, find the best method we can honestly back, then build the user’s 12-week roadmap from that method.

This file is the working plan from here on. `golden-rail-pipeline-spec.md` is still useful for *rules we must not break*. `phase-prompts.md` and the old Phase 1–7 list in `TODO.md` are history. Do not follow them as the build order.

---

## The one belief

For almost any goal, someone has already written it down — an article, a book, a course, a Wikipedia page, a YouTube video, a champion interview. Our job is to **find the best of that**, and **turn it into a plan**.

We do not invent a guru.  
We do not give the user nothing.  
We do not call something “the official method” unless the pages actually support that.

“Best method we found” means: the strongest path that real sources support **in this search**. It is not a human coach. It is much better than a plan invented from the model’s memory.

---

## What we keep from Golden Rail

These rules stay. They are how we stay honest.

1. **Search for real pages.** Do not let the model invent a method from memory.
2. **Never invent a name, a coach, or a link.** Every name and URL must come from a page we actually retrieved.
3. **Check agreement in code**, not by trusting the model’s word.
4. **Unsafe advice gets cut or capped** (crash diets, fake “guaranteed returns”, dangerous training loads). Safety beats “the source said so.”
5. **Tell the user the basis.** If we found a named program, say so. If we built from a shared technique, say that. Never show a gold badge we did not earn.
6. **Remember research** so the same goal is not researched from scratch every time.
7. **Stay on that method** when the weekly plan updates. Do not drift back to generic advice.

---

## Where we are right now

**What a real user gets today:** certified presets unchanged. A custom goal researches a spine, writes the 12-week plan from it, caps unsafe numbers, and shows an honest basis line. Later weeks stay on that method. Cache **write** is still Phase 5.

**What already works:**

- Tavily search + page download + replay fixtures
- Spine kinds: named program / shared pattern / technique / single source
- Goal create route: `researchGoal` → plan writer → golden-rail fields
- Gemini is the primary LLM (`gemini-3.5-flash-lite`). Groq is fallback only; a daily-limit 429 skips Groq instead of blocking the request.

**Still not done:**

- Cache write + live stepper (Phase 5)

---

## How we pick “the best method we found”

After search, we always choose **one spine** for the plan. We never leave empty-handed if we retrieved any on-topic page.

| What the pages show | Spine we use | What we tell the user |
|---|---|---|
| Several independent sites name the same program | That program (e.g. MBSR) | “Anchored to MBSR (Jon Kabat-Zinn)” |
| Many plans, same shape, no single name | The shared pattern (e.g. 4 runs / week, easy + speed + long run) | “Built from common practice — no single official method” |
| A technique, no curriculum | That technique + a practice ladder | “No official program. Built from these sources” |
| Only one decent page or video | That source, used carefully | “Based on this source — thin evidence” |

**Numbers rule:** prefer a figure that **more than one page** supports. A number from one page may be used only if we say which page it came from. Never present one article’s schedule as “what all experts agree.”

**Source rule:** articles, institution pages, books, and videos all count as evidence. Open-publishing junk (random social posts, SEO listicles that sell a crash diet) still does not. A video can teach the method. It cannot, alone, earn the high “anchored to” badge.

---

## New phases

Do these in order. Each phase has a user-facing test. Do not start the next phase until that test passes.

### Phase 1 — Search so we actually find the method

**Goal:** for any goal, the searches return the real pages and videos about *that* skill.

- [x] Query 1: the goal in plain words. No person, no club, no invented body.
- [x] Query 2: how people get better (technique / training / how-to).
- [x] Query 3: a plan or timeline, but **keep the skill words** in the query so “skipping” cannot mean hopscotch.
- [x] Never search for an organisation the model just invented.
- [x] Still download useful pages even if we do not yet have two “official” sites. Wikipedia, a how-to, a champion interview, a strong video — read them.

**Test (live, 2026-09-22):**

1. Meditation — on-topic: Harvard, Johns Hopkins, mindful.org, Washington. Queries named no invented club. (These pages talk mindfulness, not always the MBSR brand — that is a Phase 2 spine job.)
2. 10K under 50 — real 10K plans only (Run Motion, Marathon Handbook, Active, Still I Run). No ACSM gym-generic pages.
3. Stone skipping — Wikipedia, Kurt Steiner / Outside, stoneskipping.com, physics write-up. No child-development “learn to skip.” Pages were downloaded (was 0 extracts before).

---

### Phase 2 — Always leave research with a spine

**Goal:** research never returns “nothing.” It returns the best method we found, plus the facts the plan will use.

- [x] `methodKind`: `named_program` | `shared_pattern` | `technique` | `single_source`
- [x] `methodName` only if a real name appears on the pages (else a plain label)
- [x] `authority` only if a real person/body appears (else empty)
- [x] `sourceUrl` / `allowedUrls`: only URLs we retrieved
- [x] `teachings`: concrete steps from the pages
- [x] `velocityTable` when numbers pass the sanity check (never a world record as week 12)
- [x] `assumptions`: who the advice was written for
- [x] Badge stays honest: only a corroborated named program can earn high/medium

**Test (replay of Phase 1 fixtures, 2026-09-22):**

1. Meditation — `shared_pattern`, 5 teachings (sit, breath, 5–15 min). These particular pages did not agree on the MBSR brand, so we did not stamp MBSR. Still a usable spine.
2. 10K under 50 — `shared_pattern`, 5 teachings (easy / long run / speed), numbers: long run 45 → 55 min, sourced.
3. Stone skipping — `technique`, 6 teachings (flat stone, spin, ~20°). No invented coach.

---

### Phase 3 — Write the 12-week roadmap from the spine

**Goal:** this is the mission. The user sees a plan built from the method, not from memory.

- [x] Plug research into the real goal route (`POST /api/goal/create`). Cache write stays Phase 5.
- [x] The 12-week writer must use the spine: terminology, teachings, numbers, milestone order.
- [x] Links on tasks may only be URLs we retrieved. No invented links.
- [x] If the user’s starting point is known, scale the spine. If not, use `assumptions` and say so.
- [x] Certified presets stay as they are (already hand-grounded). This path is for custom goals.

**Test (replay fixtures + live plan writer, 2026-09-22):** `npm run plan:from-research -- "<goal>"`

1. Meditation — sit / breath / no-judgment / 15–30 min daily. These pages still do not agree on the MBSR brand, so week 1 does not stamp MBSR. 22 links, 0 illegal.
2. 10K under 50 — that phrasing matches the certified VDOT preset (unchanged). Forced research path: 4 days/week, easy + long run, 12-week build, 5:00/km. 0 illegal links.
3. Stone skipping — stone 3–5", grip, spin, ~20° entry. 19 links, 0 illegal.
4. Every link was on the retrieved allowlist.

Closest API path: `backend/scripts/plan-from-research.ts` (same research → `generate12WeekPlanWithAI` as the create route).

---

### Phase 4 — Keep the plan safe and honest

**Goal:** the best roadmap is still a safe one, and the user knows what it is based on.

- [x] Hard caps in code (running jump per week, calorie deficit range, no max-lift heroics in weeks 1–3). Run on fresh research **and** cache hits.
- [x] Show the basis on the goal: named program / common practice / technique / thin evidence. Never a gold badge on thin evidence.
- [x] Weekly updates stay inside the same method and numbers.

**Test (2026-09-22):** `test/safetyClamps.test.ts`

1. Weekly mileage 10 → 80 miles is clamped to about 28.5 (10% per week). A 10K finish time is left alone.
2. Calorie deficit 100 / 1200 becomes 250 / 600. A cached 1500 kcal deficit is clamped on read.
3. Week-1 squat at 100% 1RM becomes 80%. Week-1 bench at 0 RIR becomes 3 RIR.
4. Stone skipping (`technique`) badge: “No official program. Built from these sources.” It does not say anchored or certified. MBSR with high consensus: “Anchored to MBSR (Jon Kabat-Zinn).”
5. Week 2 of stone skipping is prompted with the same 20° teaching, and an invented link is stripped.

---

### Phase 5 — Remember, stay fast enough, then improve

**Goal:** the second user with the same goal gets the same researched spine quickly. The first user can watch progress instead of a dead spinner.

- Write the spine to the research cache after a successful miss.
- Cache hits still pass safety caps (rules can change after the row was written).
- Show search → method → plan as live steps.
- Measure real time. If it is slow, say so in the UI. Fix Groq waiting if it blocks the mission.

**Test:** same goal twice → second time uses cache, no new Tavily spend, plan still matches the spine. First-time wait has a live stepper. Write down the real times.

---

## What “done” means

A stranger can type any custom goal and get:

1. A 12-week roadmap they can follow this week.
2. A method we can point to in real sources (program, pattern, technique, or one careful source).
3. An honest sentence about how sure we are.
4. No fake coach. No fake link. No dangerous number.

That is the product. Everything else is support.

---

## How to work this file

- One phase at a time.
- Live search is required for Phase 1 and 2 tests (VPN on). Use `research:capture` / `research:replay` so we do not burn credits while tuning.
- If a phase test fails, fix that phase. Do not “make up for it” in a later prompt.
- When a phase is done, tick it in this file and say what the three test goals produced.
