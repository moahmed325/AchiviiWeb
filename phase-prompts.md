# Phase-by-Phase Prompts

Copy one block at a time to your coding agent, in order. Wait for review/testing before sending the next.
Each prompt assumes the agent has access to `golden-rail-pipeline-spec.md` and `TODO.md` in the repo — reference both explicitly so it doesn't re-derive requirements from memory of this conversation.

---

## Phase 1 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md in full before starting.

Implement ONLY Phase 1 (Foundation) from TODO.md:
- Tavily client wrapper (search + extract endpoints), reading TAVILY_API_KEY from env
- Enable pgvector extension on Postgres
- Prisma migration adding the new Goal fields and the ResearchCache model exactly as specified in golden-rail-pipeline-spec.md's "Database Schema Changes" section
- A standalone test script that calls Tavily search + extract for a sample query and prints the raw result shape

Do NOT touch goalDecomposer.ts or any existing pipeline logic in this phase — this is infrastructure only.

When done:
1. Update TODO.md, checking off completed items in Phase 1
2. Show me the raw Tavily test output so I can confirm the shape matches what we need
3. Stop and wait for my review before starting Phase 2
```

---

## Phase 2 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phase 1 is complete and reviewed.

Implement ONLY Phase 2 (Cache Layer) from TODO.md:
- Update the Stage 1 clarifyGoalWithAI prompt to emit a canonicalKey per the spec's format
- Implement Stage 1.5 cache resolution: Tier 1 exact canonicalKey match, Tier 2 pgvector 
  cosine similarity fallback (threshold 0.88) on the embedded clarifiedOutcome
- Wire up embedding generation for clarifiedOutcome
- On a cache hit, increment hitCount and update lastUsedAt on the ResearchCache row

Do NOT implement Stage 2 research or Stage 3 velocity derivation yet — for this phase, 
a cache hit can return placeholder/stub data, we're only testing that matching works.

When done:
1. Update TODO.md
2. Demonstrate: submit the same goal twice (and one reworded variant) and show me that 
   the second/third submissions hit cache (hitCount increments, no new Tavily calls fire)
3. Stop and wait for my review before starting Phase 3
```

---

## Phase 3 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phases 1-2 are complete and reviewed.

Implement ONLY Phase 3 (Research Core) from TODO.md — this is Stage 2 and Stage 3 
from the spec:
- Generate 2-3 genuinely distinct search query variants from the clarified outcome
- Run them against Tavily in parallel, extract content from top results
- Apply the blacklist filter (build an initial list per the spec's examples — crash diets, 
  extreme leverage trading, etc. — and note in your response that this list is a starting 
  point, not exhaustive)
- Apply trust-tiering in CODE (not by asking the LLM to self-rank) — HIGH/MEDIUM/LOW per 
  the spec's heuristics
- LLM synthesis call: only claim methodConfidence high_consensus/medium_consensus if 2+ 
  independent HIGH/MEDIUM sources actually agree; otherwise first_principles
- Derive the velocityTable (week1Targets, week12Targets, progressionFormula) from the 
  research findings — never invent numbers not traceable to a source
- Sanity check pass; regenerate once on failure, downgrade to first_principles on second failure

When done:
1. Update TODO.md
2. Run this against two test goals: one well-documented (e.g. "run a 10k") and one genuinely 
   niche/novel. Show me the full output for both, including methodConfidence and the reasoning 
   for why it landed where it did
3. Stop and wait for my review before starting Phase 4
```

---

## Phase 4 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phases 1-3 are complete and reviewed.

Implement ONLY Phase 4 (Safety Clamps) from TODO.md:
- Implement the clamp functions listed in the spec's Stage 4 section (running volume cap, 
  caloric deficit range, 1RM/RIR restriction in early weeks)
- These clamps must run on BOTH fresh Stage 3 output AND on any velocityTable retrieved 
  from a cache hit — do not skip clamping just because data came from cache
- Log every clamp event (goal id, field, original value, clamped value) somewhere reviewable 
  (a table, a log file — your call, just make it inspectable)

When done:
1. Update TODO.md
2. Show me a test where you feed the clamp functions deliberately unsafe input values and 
   confirm they get clamped, not passed through
3. Stop and wait for my review before starting Phase 5
```

---

## Phase 5 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phases 1-4 are complete and reviewed.

Implement ONLY Phase 5 (Generation Integration) from TODO.md:
- Update the Stage 5 generate12WeekPlanWithAI prompt to inject the velocityTable and 
  milestone data as mandatory grounding, per the spec
- Fix resourceUrl generation: the model may ONLY use URLs that came back from this request's 
  actual Tavily results in Stage 2. If no real URL exists for a given step, omit resourceUrl 
  entirely rather than inventing one. Enforce this in code if possible (validate any 
  resourceUrl in the output against the set of URLs actually returned by Tavily this run), 
  not just via prompt instruction.
- Implement Stage 7: write a new ResearchCache row after a successful cache-miss completion

When done:
1. Update TODO.md
2. Generate a full plan for a test goal and show me: does the daily task content reflect 
   real terminology from the research? Pull 5-10 resourceUrl values from the output and 
   confirm each one is traceable to an actual Tavily result from that same run
3. Stop and wait for my review before starting Phase 6
```

---

## Phase 6 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phases 1-5 are complete and reviewed.

Implement ONLY Phase 6 (Weekly Adaptation + Frontend Badge) from TODO.md:
- Update adaptUpcomingWeekTasksWithAI to receive and respect the stored velocityTable and 
  canonicalMethodName/canonicalAuthority from the Goal record on every weekly review call
- Build the frontend badge component: high/medium_consensus version and first_principles 
  version, exact copy per the spec's Stage 6 section
- The badge must only ever render the high-confidence version when methodConfidence 
  genuinely earned it — wire it directly to the stored field, no separate/duplicated logic

When done:
1. Update TODO.md
2. Show me a week 6 adaptation output for a Golden Rail goal and confirm it still references 
   the original method/numbers rather than generic language
3. Stop and wait for my review before starting Phase 7
```

---

## Phase 7 Prompt

```
Read golden-rail-pipeline-spec.md and TODO.md. Phases 1-6 are complete and reviewed.

Implement ONLY Phase 7 (Streaming + Real Benchmarking) from TODO.md:
- Build an SSE endpoint emitting progress events through the pipeline stages
- Build the frontend research-stepper UI consuming that stream
- Run a REAL timed benchmark of the full pipeline — both cache-hit and cache-miss paths — 
  and report actual P50/P90 latency numbers, not estimates
- Adjust the stepper's copy and pacing to match the real measured numbers

When done:
1. Update TODO.md
2. Give me the actual benchmark numbers you measured
3. This is the last phase — give me a final summary of what shipped, and flag anything 
   from the "Deferred / Not Yet Scoped" section of TODO.md that should be prioritized next
```
