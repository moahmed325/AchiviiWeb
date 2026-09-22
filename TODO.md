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

**✅ Stub removed in Phase 3.** `autoPopulateStubOnMiss` and its fabricated `methodName`/`authority`/`example.com` sourceUrl are gone from `resolveStage1WithCache`. `demo-phase2-cache.ts` now seeds its own clearly-labelled demo row directly, so the library can no longer invent authority it did not research.

**Acceptance:** submitting a goal twice (or two close phrasings of the same goal) results in a cache hit on the second submission, verified by checking `hitCount` incremented and no new Tavily calls were made.

---

## Phase 3 — Research Core
**Goal:** on a cache miss, the system actually researches and derives a grounded velocity table.

- [x] Simplify deterministic fallback: custom goals fail honestly with retry state when dual AI providers fail (no silent degraded generation; keyword generator removed). Certified presets unaffected.
All Stage 2/3 code lives in `backend/src/lib/research/`. Not yet wired into `routes/goal.ts` — that is Phase 5's job, same as the cache layer.

- [x] Stage 2: generate 2-3 distinct search queries from clarified outcome (`queryPlanner.ts`). Distinctness is enforced in code via token-overlap de-duplication, not left to the prompt — models reliably return three rewordings of one angle, and each angle costs a real search call. Falls back to three deterministic template angles if the LLM is unavailable.
- [x] Stage 2: run queries against Tavily in parallel, extract top results. Results are merged and **de-duplicated by URL before extraction** — distinct angles routinely surface the same authoritative page, and fetching it three times buys nothing. Extraction is a single batched `extract` call over the best-ranked survivors, capped at `MAX_EXTRACT_URLS` (6). Net cost is 3 search + 1 extract per researched goal.
- [x] Stage 2: blacklist filter on queries/domains (`safetyFilter.ts`). Screens outgoing queries *before* they become paid calls, plus returned domains and surfaced title/snippet text. Patterns target unsafe **framing**, not subject matter — "lose 30 pounds in 2 weeks" is blocked, "how to lose weight safely" is not; a topic-blind filter would gut legitimate fitness and finance research. Starting list, explicitly a floor.
- [x] Stage 2: trust-tier results in code (`trustTier.ts`). Explicit LOW listings beat generous TLD rules, so `medium.com` and a `.edu` personal page (`/~user`, `/people/`, `/blog/`) cannot reach HIGH. **Unrecognised domains default to MEDIUM, not LOW** — see the live-run findings below for why the original allowlist-only design was abandoned.
- [x] Stage 2: LLM synthesis call — cross-check agreement, set methodConfidence, extract methodName/authority/sourceUrl (real URL only)
- [x] Stage 3: derive velocityTable (week1Targets, week12Targets, progressionFormula) from research. Originally gated on `methodConfidence` not being first_principles; that gate was removed after the live runs — see below.
- [x] Stage 3: sanity check pass — regenerate once on failure, downgrade to first_principles on second failure

**Guardrails enforced in code, not by prompt:**
- Consensus is **recounted after the model answers**. Independence is measured by distinct hostname, so three articles from one site count as one voice. Below 2 independent non-LOW hosts the synthesis call is *skipped entirely* — asking anyway invites the model to manufacture an authority.
- `high_consensus` additionally requires at least one HIGH-tier corroborating source; two MEDIUM sources yield `medium_consensus`.
- Any `sourceUrl` not in the set of URLs actually retrieved this run is discarded. `allowedUrls` is carried on the result as the allowlist Phase 5 will validate `resourceUrl` against.
- A velocity table that fails validation twice downgrades the whole result to `first_principles` and sets `flaggedForReview`, rather than serving unsound numbers under a named method.

**Sanity check detail — metric direction.** Each target carries `direction: higher_is_harder | lower_is_harder`. A naive "week12 > week1" rule would pass a plan that makes a runner's 10K time *slower*; the check normalises to "harder ÷ easier" so both directions validate correctly. It also enforces matching metric names, consistent units, positive finite values, and a progression ratio between 1.02x and 10x. The 10x ceiling is an explicit heuristic: two data points cannot reveal a discontinuity *between* them, so it catches the observed failure — an absurd endpoint no source supports.

**Retry detail.** The provider cascade runs at temperature 0 with a fixed seed, so a bare retry of an identical prompt returns the identical broken table. The regeneration attempt is therefore sent the specific validation failures; that feedback is the only thing making attempt two different from attempt one.

**Velocity tables are method-level** (decided here, carried over from the Phase 2 deferral). One table serves everyone pursuing a method, so the table records an `assumptions` string stating the starting point the sources assumed — required by the validator, not optional. Per-individual scaling belongs to Stage 5 personalisation in Phase 5.

**Credit discipline.** `npm run research:capture -- "<goal>"` performs the real Tavily calls once and records every request/response to `test/fixtures/research/`, **including the planned queries**. `npm run research:replay -- "<goal>"` re-runs the pipeline against that recording with zero Tavily spend. Replay reuses the recorded queries via `presetQueries`; without that it re-planned different queries and matched nothing, which made the first replay silently meaningless. `npm run research:velocity -- "<goal>" --method "<name>"` drives Stage 3 alone against recorded pages, which is the only way to exercise it for goals that legitimately stop at `first_principles`.

### Live-run findings — six real flaws the offline tests could not have caught

Running real Tavily searches invalidated several design assumptions. Every fix below is covered by a regression test built from the actual live data.

1. **The trust allowlist had near-zero recall.** A search for sub-50 10K training returned `halhigdon.com` — Hal Higdon's own site, one of the most published running coaches alive — in the top three results. The allowlist scored it "unrecognised domain" (LOW), ranked it last, and the 6-item cap dropped it entirely, while keeping a YouTube video and a Steemit post. No hand-maintained list can cover running, chess, guitar, Spanish and SaaS at once. **Unknown now means unverified (MEDIUM), not untrustworthy.** LOW became an explicit judgement — open-publishing platforms or marketing language — and rigour moved to checks that generalise.
2. **Consensus was taken on trust from the model.** It reported which URLs agreed with it, which is a claim, not evidence. `corroboration.ts` now recounts agreement from the retrieved page text, requiring the method or authority to be named on 2+ independent hosts. `authorityOwnsDomain` supplies the allowlist-free HIGH signal: "Hal Higdon" owning `halhigdon.com` identifies a primary source in any field. Authority names also match on surname alone, because live pages write "the Daniels formula", never "the Jack Daniels formula" — a licence deliberately not extended to method titles, where one shared word like "running" would match almost anything.
3. **Trust was outranking relevance.** Tavily returns a relevance score that the ranking ignored completely. A query aimed at a governing body returned ACSM pages on *physical activity guidelines* (0.584) and *resistance training* (0.568), and those outranked the article titled "Sub 50 10K: Pace, Plan + How To Do It" (0.877) purely because ACSM was allowlisted. Selection is now relevance-led with a small trust bonus, a 0.4 relevance floor, and a 2-page-per-host cap so one site cannot fill the budget. Query 3 was also retargeted at progression rather than a second authority guess, which is what produced the off-topic results.
4. **The consensus precondition ran after extraction.** A dead end paid for a 6-page download and then discarded it. It needs only URL, title and snippet, so it now runs first. Confirmed live: the niche goal spent 3 Tavily calls instead of 4 and downloaded nothing.
5. **The safety filter discarded the best clinical sources.** A Tulane University MBSR page was rejected for the sentence *"if you are experiencing ... suicidal feelings, please reach out to the instructor"* — a safeguarding notice, the most responsible line on the page. It also held the "8 weekly 2.5-hour sessions" detail Stage 3 needed, so one false positive degraded the plan twice. Query screening (outgoing, ours to control) is now separate from source screening (incoming evidence): the full ruleset applies to titles, which state what a page promotes, while bodies are checked only for outright advocacy. Stage 4's clamps, not this filter, are the real safety guarantee.
6. **Naive truncation was feeding the models navigation menus.** Sources were cut at the first N characters of Tavily's markdown. On a marathonhandbook.com page the first 3000 characters were logo and menu links containing **zero** numeric mentions, while the discarded remainder held **61**. Stage 3's "this goal has no numeric dimension" was a correct reading of a nav bar — for a goal that is almost entirely numbers. `distill.ts` strips boilerplate and selects by signal, biasing toward quantities for Stage 3. This was the single most damaging bug; it silently starved every downstream stage.

**Velocity tables no longer require a named method.** "Run a 10K under 50 minutes" has many competing published plans, so no single method reaches consensus — yet its sources state paces and weekly volumes precisely. Tying Stage 3 to a method name discarded that evidence for a whole class of goals. `methodConfidence` still reports `first_principles` honestly; only the numbers are kept, and only if they pass the same sanity check. The prompt also forbids using the goal's own fixed target as a metric: a live attempt offered "race pace 8.02 → 8.02 min/mile", which is constant by definition. The validator caught it, then the prompt was fixed to prevent it.

**Acceptance — met.**
- *Well-documented goal:* "Build a mindfulness meditation practice to reduce stress" → `high_consensus`, **Mindfulness-Based Stress Reduction (MBSR)**, authority **Jon Kabat-Zinn**, sourced to `care.tulane.edu/mbsr`, corroborated in the text of 5 independent hosts, velocity table **30 → 45 minutes daily practice** with assumptions recording that it is an 8-week programme mapped onto 12 weeks.
- *Many-competing-methods goal:* "Run a 10K in under 50 minutes" → honest `first_principles` (no single named canon), but retains grounded numbers: **long run 5 → 8 miles**, traceable to the Outside Online 12-week plan.
- *Niche goal:* "Get good at competitive stone skipping" → `first_principles`, no invented authority, and no pages downloaded.

**Known issue — Groq rate limiting dominates latency.** Live runs repeatedly hit 429s with automatic waits of 12s, 28s, 38s and 48s. Research needs 2-3 LLM calls, so a cold goal can take minutes on the free tier. The retry logic is correct and no run failed, but this must be measured against the Phase 7 latency budget; it is a capacity limit, not a bug.

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
