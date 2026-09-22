# Golden Rail Pipeline — Build Tracker

Full spec: `golden-rail-pipeline-spec.md` (source of truth for all implementation details).
Work through phases in order. Do not start a phase until the previous one is reviewed and checked off.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked/needs review

---

## Phase 1 — Foundation
**Goal:** infra pieces exist and work standalone, nothing wired into the pipeline yet.

- [x] Add `TAVILY_API_KEY` env var + Tavily client wrapper (search + extract endpoints)
- [x] Enable `pgvector` extension on Postgres — done in `20260922120000_enable_pgvector_and_convert_outcome_embedding`. (The earlier `20260919000000_enable_pgvector_...` folder is misnamed: despite the name its SQL never ran `CREATE EXTENSION`. Left renamed-in-place to avoid breaking Prisma's applied-migration history.)
- [x] Prisma migration: add fields to `Goal` model (isGoldenRail, canonicalMethodName, canonicalAuthority, canonicalSourceUrl, methodConfidence, velocityTable, canonicalKey)
- [x] Prisma migration: create `ResearchCache` model with a real `vector(768)` column, an HNSW cosine index, and a GIN index for Tier 0 raw-input lookups
- [x] Drop SQLite entirely — Postgres everywhere so local matches production
- [x] Standalone test script: call Tavily search + extract for a sample query, confirm raw JSON shape
- [x] Tavily client: retry with exponential backoff on 429/5xx/network faults, no retry on auth or timeout

**Acceptance:** can run a search against Tavily from the backend and get back real, structured results. DB has the new tables/fields. Nothing in `goalDecomposer.ts` touched yet.

**Verified:** live Tavily search + extract confirmed returning real `{title, url, content, score}` results and full page text. Note Tavily is geo-blocked in Ethiopia — local runs need the VPN on; this is a dev-environment constraint only, not a production one. Tavily also deprecated the in-body `api_key` field; the wrapper now authenticates via the `Authorization: Bearer` header only, asserted in `test/tavily.test.ts`.

---

## Phase 2 — Cache Layer
**Goal:** goal requests can be matched against prior research.

- [x] Update Stage 1 (`clarifyGoalWithAI`) prompt to emit `canonicalKey`
- [x] Build Stage 1.5 cache resolution: Tier 1 exact key match, Tier 2 cosine similarity fallback (threshold 0.88)
- [x] Wire embedding generation for `clarifiedOutcome` (gemini-embedding-001 with 768 dims)
- [x] On cache hit: increment `hitCount`, update `lastUsedAt`, return cached `canonicalMethod`
- [x] Flag `readyForPromotion` at `hitCount >= 10` (flagging only, not gated on `userFeedbackScore`)
- [x] Fix hitCount double-counting: a Tier 0 hit whose entry had no stored `cachedClarification` fell through and re-ran cache resolution, counting one request as three hits. Regression test: "counts exactly one hit per request when the cached entry has no stored clarification".
- [x] Fix canonicalKey collisions: slugs were truncated to 30 chars, so two different goals sharing a prefix ("...web application with React" / "...with Vue") produced an identical key — an exact Tier 1 hit serving one goal another's research. Over-length slugs now carry a short digest of the full string.
- [x] Fix Tier 0 index bypass: `prisma.findFirst` with `array_contains` compiles to `("canonicalMethod" #> ARRAY[...])::jsonb @> $1`, which cannot use an index built on the `->` expression — every lookup seq-scanned. Tier 0 now uses raw SQL matching the index expression. `npm run verify:pgvector` asserts both indexes remain usable.
- [x] Cap `rawInputs` at 50 phrasings per entry — it lives inside the `canonicalMethod` JSON and previously grew without bound, inflating every row read.
- [x] Tier 2 cross-domain guard: a shared broad domain keeps the 0.88 threshold; crossing a domain boundary requires 0.93 (`CROSS_DOMAIN_SIMILARITY_THRESHOLD`). Graduated rather than a hard filter, because a legitimate reason Tier 1 missed is Stage 1 filing one goal under two domains. Tier 2 now also inspects the 5 nearest rows instead of 1, so a rejected top candidate no longer hides a valid same-domain match behind it. Rejections are logged and accepted cross-domain hits set `crossDomain: true`.
- [x] Embedding outages are no longer silent: `resolveResearchCache` returns `{ degraded: true, degradedReason }` instead of a bare miss, increments `getEmbeddingFailureCount()`, and logs at error level. `resolveStage1WithCache` propagates it and refuses to write a cache entry on a degraded miss, since "unknown" is not "confirmed absent" and writing would duplicate research under a second key.

**⚠️ Not yet wired into the app.** `routes/goal.ts` calls `clarifyGoalWithAI` directly, not `resolveStage1WithCache`, so the cache layer never runs for a real goal submission — it is currently exercised only by tests and `scripts/demo-phase2-cache.ts`. Harmless today (nothing writes cache entries in production yet, so every lookup would miss anyway), but Stage 7's cache write in Phase 5 is meaningless until this call site is switched over. Do it as part of Phase 5.

**⚠️ Remove the stub before Phase 3 ships.** `resolveStage1WithCache`'s `autoPopulateStubOnMiss` option writes a fabricated `methodName`/`authority` with `sourceUrl: "https://example.com/canonical-method"` and `confidence: "medium_consensus"`. It is demo-only scaffolding and currently unreachable from the app, but it writes exactly the kind of fake authority the spec's guardrails forbid. Phase 3 replaces it with real Stage 2/3 output — delete the stub then rather than leaving it behind.

**Acceptance:** submitting a goal twice (or two close phrasings of the same goal) results in a cache hit on the second submission, verified by checking `hitCount` incremented and no new Tavily calls were made.

---

## Phase 3 — Research Core
**Goal:** on a cache miss, the system actually researches and derives a grounded velocity table.

- [x] Simplify deterministic fallback: custom goals fail honestly with retry state when dual AI providers fail (no silent degraded generation; keyword generator removed). Certified presets unaffected.
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
- ~~pgvector / Tier 2 similarity search at scale~~ — **resolved.** Tier 2 now runs as a pgvector nearest-neighbour query (`<=>` cosine distance) returning a single row, and Tier 0 uses an indexed JSONB containment lookup; neither reads the full table any more. Verified against the live database with `npm run verify:pgvector`, including an `EXPLAIN` confirming the planner uses `research_cache_outcome_embedding_idx` rather than a sequential scan.
- **Same-goal / different-target sharing — spec-level question for Phase 3.** Stage 1 is instructed to map close variants onto the same `canonicalKey`, so "Run a 10K under 50 minutes" and "Run a 10K under 60 minutes" intentionally share a cache entry, and Tier 2's embedding of `clarifiedOutcome` treats them as near-identical too. That is correct for the *method* (VDOT is VDOT), but both users then inherit the same stored `velocityTable`. Whether a velocity table is method-level or target-level is genuinely undecided in the spec, and it affects Tier 1 exactly as much as Tier 2 — so it was deliberately not "fixed" at the Tier 2 layer alone. Decide it in Phase 3, when velocity numbers first become real.
- **pgvector recall tuning at scale.** HNSW is an *approximate* index, so at large row counts a Tier 2 lookup can in principle miss a borderline match near the 0.88 threshold. Not a concern at current volume, but if cache hit rate ever looks lower than expected, tune `hnsw.ef_search` before suspecting the threshold.
- **Prisma cannot read or write `Unsupported("vector(768)")` columns.** All access to `outcomeEmbedding` goes through raw SQL in `lib/cache/researchCache.ts`. Any future code touching that column must do the same — Prisma Client will silently omit it, not error.
