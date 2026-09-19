# Golden Rail Pipeline — Build Tracker

Full spec: `golden-rail-pipeline-spec.md` (source of truth for all implementation details).
Work through phases in order. Do not start a phase until the previous one is reviewed and checked off.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/needs review

---

## Phase 1 — Foundation
**Goal:** infra pieces exist and work standalone, nothing wired into the pipeline yet.

- [x] Add `TAVILY_API_KEY` env var + Tavily client wrapper (search + extract endpoints)
- [x] Enable `pgvector` extension on Postgres
- [x] Prisma migration: add fields to `Goal` model (isGoldenRail, canonicalMethodName, canonicalAuthority, canonicalSourceUrl, methodConfidence, velocityTable, canonicalKey)
- [x] Prisma migration: create `ResearchCache` model (with vector column)
- [x] Standalone test script: call Tavily search + extract for a sample query, confirm raw JSON shape

**Acceptance:** can run a search against Tavily from the backend and get back real, structured results. DB has the new tables/fields. Nothing in `goalDecomposer.ts` touched yet.

---

## Phase 2 — Cache Layer
**Goal:** goal requests can be matched against prior research.

- [ ] Update Stage 1 (`clarifyGoalWithAI`) prompt to emit `canonicalKey`
- [ ] Build Stage 1.5 cache resolution: Tier 1 exact key match, Tier 2 pgvector similarity (threshold 0.88)
- [ ] Wire embedding generation for `clarifiedOutcome` (text-embedding-004 or equivalent)
- [ ] On cache hit: increment `hitCount`, update `lastUsedAt`, return cached `canonicalMethod`

**Acceptance:** submitting a goal twice (or two close phrasings of the same goal) results in a cache hit on the second submission, verified by checking `hitCount` incremented and no new Tavily calls were made.

---

## Phase 3 — Research Core
**Goal:** on a cache miss, the system actually researches and derives a grounded velocity table.

- [ ] Stage 2: generate 2-3 distinct search queries from clarified outcome
- [ ] Stage 2: run queries against Tavily in parallel, extract top results
- [ ] Stage 2: blacklist filter on queries/domains (unsafe category list — starting list, not final)
- [ ] Stage 2: trust-tier results in code (HIGH/MEDIUM/LOW heuristics)
- [ ] Stage 2: LLM synthesis call — cross-check agreement, set methodConfidence, extract methodName/authority/sourceUrl (real URL only)
- [ ] Stage 3: derive velocityTable (week1Targets, week12Targets, progressionFormula) from research, only if methodConfidence isn't first_principles
- [ ] Stage 3: sanity check pass (week1 < week12, units consistent) — regenerate once on failure, downgrade to first_principles on second failure

**Acceptance:** a genuinely well-documented goal (e.g. "learn to run a 10k") produces a real methodName + authority + plausible velocity numbers. A genuinely novel/niche goal correctly falls back to first_principles instead of forcing a fake authority.

---

## Phase 4 — Safety Clamps
**Goal:** numeric outputs can never bypass hard safety limits, regardless of source.

- [ ] Implement clamp functions (running volume 10%/week cap, caloric deficit 250-600kcal, no 100%1RM/0RIR weeks 1-3)
- [ ] Run clamps on Stage 3 output AND on any cache-hit velocityTable before it reaches Stage 5
- [ ] Log clamp events (goal id, original value, clamped value) to a reviewable location

**Acceptance:** feed the clamp function intentionally unsafe values (e.g. 1500kcal deficit) and confirm it clamps rather than passes through. Confirm cache hits also pass through clamps, not just fresh research.

---

## Phase 5 — Generation Integration
**Goal:** the actual daily plan reflects grounded research instead of free invention.

- [ ] Update Stage 5 (`generate12WeekPlanWithAI`) prompt to inject velocityTable/milestones as mandatory grounding
- [ ] Fix `resourceUrl`: only usable if sourced from real Stage 2 Tavily results; omit field otherwise (no invented URLs)
- [ ] Stage 7: write new `ResearchCache` row on successful cache-miss completion

**Acceptance:** generated tasks contain real terminology from Stage 2 research where applicable. Spot-check 5-10 generated `resourceUrl` values — every one must resolve to a real, working page returned by Tavily earlier in that same request. No hallucinated links.

---

## Phase 6 — Weekly Adaptation + Frontend Badge
**Goal:** grounding persists past day one, and the user sees an honest confidence signal.

- [ ] Update `adaptUpcomingWeekTasksWithAI` to receive and respect stored velocityTable/method across weekly reviews
- [ ] Frontend: high_consensus/medium_consensus badge ("🛡️ Anchored to...")
- [ ] Frontend: first_principles badge ("⚡ First-Principles Trajectory...")

**Acceptance:** a week 6 adaptation call for a Golden Rail goal still references the original method/numbers, not generic advice. Badge only ever shows high-confidence copy when methodConfidence genuinely earned it.

---

## Phase 7 — Streaming + Real Benchmarking
**Goal:** UX matches real latency, not estimates.

- [ ] Build SSE endpoint emitting stage-progress events
- [ ] Frontend research-stepper UI consuming the SSE stream
- [ ] Run real timed benchmark of full pipeline (cache hit + cache miss paths), P50/P90
- [ ] Adjust stepper copy/pacing to match actual measured latency, not the earlier guessed numbers

**Acceptance:** stepper UI reflects real backend progress in real time, and its pacing/copy was written after seeing actual timing data, not before.

---

## Deferred / Not Yet Scoped
- User feedback collection mechanism (needed before `userFeedbackScore` can gate promotion)
- Expansion process for the safety clamp list over time
- Auto-promotion of `readyForPromotion` cache entries into full certified presets (flagging only, for now — no auto-export yet)
