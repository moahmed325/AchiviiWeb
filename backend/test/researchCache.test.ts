import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  cosineSimilarity,
  resolveResearchCache,
  saveResearchCacheEntry,
  COSINE_SIMILARITY_THRESHOLD,
  CROSS_DOMAIN_SIMILARITY_THRESHOLD,
  PROMOTION_HIT_THRESHOLD,
  MAX_RAW_INPUTS_PER_ENTRY,
  getEmbeddingFailureCount,
  resetEmbeddingFailureCount,
  normalizeCanonicalKey,
  normalizeRawInput,
} from '../src/lib/cache/researchCache.js';
import {
  clarifyGoalWithAI,
  resolveStage1WithCache,
  getPresetCanonicalKey,
  deriveDeterministicCanonicalKey,
  sanitizeCanonicalKey,
} from '../src/lib/ai/goalDecomposer.js';

describe('Phase 2 — ResearchCache & Cosine Similarity Layer', () => {
  beforeEach(async () => {
    // Clean up test cache entries before each test
    await prisma.researchCache.deleteMany({
      where: {
        canonicalKey: {
          startsWith: 'test.',
        },
      },
    });
  });

  describe('cosineSimilarity function', () => {
    it('calculates 1.0 for identical vectors', () => {
      const vec = [0.1, 0.5, -0.3, 0.8];
      expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0, 5);
    });

    it('calculates 1.0 for scaled parallel vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [2, 4, 6];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 5);
    });

    it('calculates 0.0 for orthogonal vectors', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0, 5);
    });

    it('calculates -1.0 for opposite vectors', () => {
      const vecA = [1, 2, 3];
      const vecB = [-1, -2, -3];
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0, 5);
    });

    it('handles empty or zero-length vectors safely without errors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
      expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('Stage 1 canonicalKey generation', () => {
    it('provides dot-separated hierarchical key for certified presets', async () => {
      expect(getPresetCanonicalKey('run10k')).toBe('fitness.running.10k');
      expect(getPresetCanonicalKey('guitar')).toBe('music.guitar.acoustic_songs');
      expect(getPresetCanonicalKey('saas')).toBe('tech.software.saas');
      expect(getPresetCanonicalKey('spanish')).toBe('lang.spanish.conversational');
      expect(getPresetCanonicalKey('recomp')).toBe('fitness.bodybuilding.recomposition');

      const presetClarification = await clarifyGoalWithAI('Run a 10k in under 50 minutes');
      expect(presetClarification.canonicalKey).toBe('fitness.running.10k');
    });

    it('derives distinct slug canonicalKey for custom goals without keyword-domain guessing', () => {
      // Slugs longer than 30 chars keep a readable prefix plus a digest of the full
      // string, so goals sharing a prefix stay distinct.
      const key1 = deriveDeterministicCanonicalKey('Train for marathon distance race');
      expect(key1).toMatch(/^custom\.goal\.train_for_marathon_distance_ra_[0-9a-f]{6}$/);

      // Short enough to need no digest.
      const key2 = deriveDeterministicCanonicalKey('Learn conversational Japanese');
      expect(key2).toBe('custom.goal.learn_conversational_japanese');

      const key3 = deriveDeterministicCanonicalKey('Master acoustic guitar fingerpicking');
      expect(key3).toMatch(/^custom\.goal\.master_acoustic_guitar_fingerp_[0-9a-f]{6}$/);
    });

    it('does not collide when two different goals share a long common prefix', () => {
      // Both slugs exceed the 30-char cut and are identical up to it. Without a digest
      // suffix these produce the same key, and an identical key is an exact Tier 1 hit —
      // the React goal would silently be served the Vue goal's research.
      const react = deriveDeterministicCanonicalKey('Build a full stack web application with React');
      const vue = deriveDeterministicCanonicalKey('Build a full stack web application with Vue');

      expect(react).not.toBe(vue);
      expect(normalizeCanonicalKey(react)).not.toBe(normalizeCanonicalKey(vue));

      // Same input must still be perfectly stable, or caching breaks entirely.
      expect(deriveDeterministicCanonicalKey('Build a full stack web application with React')).toBe(react);
    });

    it('leaves short goals unhashed so keys stay readable', () => {
      expect(deriveDeterministicCanonicalKey('Learn conversational Japanese')).toBe(
        'custom.goal.learn_conversational_japanese'
      );
    });

    it('sanitizes canonicalKey to lowercase dot-separated format', () => {
      expect(sanitizeCanonicalKey('Fitness.Running.10K', 'run 10k')).toBe('fitness.running.10k');
      expect(sanitizeCanonicalKey('fitness.running.marathon')).toBe('fitness.running.marathon');
      expect(
        sanitizeCanonicalKey(undefined, 'Learn Spanish', 'Language Acquisition', 'Conversational Spanish in 90 Days')
      ).toMatch(/^language_acquisition\.conversational_spanish_in_90_d_[0-9a-f]{6}$/);
      expect(sanitizeCanonicalKey(undefined, 'Learn Spanish')).toBe('custom.goal.learn_spanish');
    });
  });

  describe('Stage 1.5 Cache Resolution (Tier 1 & Tier 2)', () => {
    const createSampleVector = (seed: number): number[] => {
      const vec = new Array(768).fill(0);
      for (let i = 0; i < 768; i++) {
        vec[i] = Math.sin(seed + i * 0.05);
      }
      return vec;
    };

    it('hits Tier 1 exact match, increments hitCount, and updates lastUsedAt', async () => {
      const initialVector = createSampleVector(1);
      const testKey = 'test.fitness.running.10k';

      const beforeSave = new Date(Date.now() - 5000);
      const saved = await saveResearchCacheEntry({
        canonicalKey: testKey,
        clarifiedOutcome: 'Run 10K road race under 50 minutes',
        canonicalMethod: {
          methodName: 'Jack Daniels VDOT Pacing System',
          authority: 'Dr. Jack Daniels',
          sourceUrl: 'https://vdoto2.com',
          confidence: 'high_consensus',
        },
        outcomeEmbedding: initialVector,
      });

      expect(saved.hitCount).toBe(1);

      // Perform Tier 1 lookup
      const result = await resolveResearchCache(testKey, 'Run 10K road race under 50 minutes', {
        embedder: async () => initialVector,
      });

      expect(result.hit).toBe(true);
      expect(result.tier).toBe('tier1_exact');
      expect(result.similarity).toBe(1.0);
      expect(result.entry?.hitCount).toBe(2);
      expect(result.entry?.canonicalMethod?.methodName).toBe('Jack Daniels VDOT Pacing System');
      expect(new Date(result.entry!.lastUsedAt).getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());

      // Perform second Tier 1 lookup to verify subsequent increment
      const secondResult = await resolveResearchCache(testKey, 'Run 10K road race under 50 minutes', {
        embedder: async () => initialVector,
      });
      expect(secondResult.entry?.hitCount).toBe(3);
    });

    it('hits Tier 2 cosine similarity fallback when canonicalKey differs but similarity >= 0.88', async () => {
      const baseVector = createSampleVector(42);
      // Create a slightly perturbed vector with cosine similarity > 0.95
      const rewordedVector = baseVector.map((val) => val + (Math.random() * 0.02 - 0.01));
      const sim = cosineSimilarity(baseVector, rewordedVector);
      expect(sim).toBeGreaterThanOrEqual(COSINE_SIMILARITY_THRESHOLD);

      const cachedKey = 'test.lang.japanese.n3';
      await saveResearchCacheEntry({
        canonicalKey: cachedKey,
        clarifiedOutcome: 'Pass JLPT N3 Examination in 90 Days',
        canonicalMethod: {
          methodName: 'Tadoku Graded Readers & Anki Core 2k',
          authority: 'All Japanese All The Time (AJATT)',
          sourceUrl: 'https://example.com/jlpt-n3',
          confidence: 'high_consensus',
        },
        outcomeEmbedding: baseVector,
      });

      // Query with a DIFFERENT canonicalKey (so Tier 1 misses), but semantic similarity >= 0.88
      const differentKey = 'test.lang.japanese.jlpt_test_intermediate';
      const result = await resolveResearchCache(differentKey, 'Clear Japanese JLPT Level 3 certification', {
        embedder: async () => rewordedVector,
      });

      expect(result.hit).toBe(true);
      expect(result.tier).toBe('tier2_vector');
      expect(result.similarity).toBeGreaterThanOrEqual(COSINE_SIMILARITY_THRESHOLD);
      expect(result.entry?.canonicalKey).toBe(cachedKey);
      expect(result.entry?.hitCount).toBe(2);
    });

    it('returns cache miss when canonicalKey differs and semantic similarity < 0.88', async () => {
      const vectorA = createSampleVector(10);
      // Vector with alternating components and different frequency
      const vectorB = new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1) * Math.cos(i * 0.7));

      const sim = cosineSimilarity(vectorA, vectorB);
      expect(sim).toBeLessThan(COSINE_SIMILARITY_THRESHOLD);

      await saveResearchCacheEntry({
        canonicalKey: 'test.fitness.powerlifting.squat',
        clarifiedOutcome: 'Squat 315 lbs for 5 clean reps',
        canonicalMethod: {
          methodName: 'Starting Strength Linear Progression',
          authority: 'Mark Rippetoe',
          confidence: 'high_consensus',
        },
        outcomeEmbedding: vectorA,
      });

      // Different key AND completely different vector (< 0.88)
      const result = await resolveResearchCache('test.cooking.baking.sourdough', 'Bake artisanal sourdough bread', {
        embedder: async () => vectorB,
      });

      expect(result.hit).toBe(false);
      expect(result.entry).toBeUndefined();
    });

    it('flags readyForPromotion once hitCount reaches the threshold', async () => {
      const vector = createSampleVector(3);
      const testKey = 'test.fitness.cycling.century_ride';

      const saved = await saveResearchCacheEntry({
        canonicalKey: testKey,
        clarifiedOutcome: 'Complete a 100 mile century ride',
        canonicalMethod: { methodName: 'Base Build Periodization', authority: 'Joe Friel' },
        outcomeEmbedding: vector,
      });
      expect(saved.readyForPromotion).toBe(false);

      // Jump to one hit below the threshold so the next lookup crosses it.
      await prisma.researchCache.update({
        where: { id: saved.id },
        data: { hitCount: PROMOTION_HIT_THRESHOLD - 1 },
      });

      const justBelow = await resolveResearchCache(testKey, 'Complete a 100 mile century ride', {
        embedder: async () => vector,
      });
      expect(justBelow.entry?.hitCount).toBe(PROMOTION_HIT_THRESHOLD);
      expect(justBelow.entry?.readyForPromotion).toBe(true);
    });

    it('hits Tier 0 raw input match (Part B) and increments hitCount without embeddings', async () => {
      const rawGoal = 'Learn Docker and Kubernetes microservices';
      const testKey = 'test.devops.containerization.kubernetes_microservices';

      await saveResearchCacheEntry({
        canonicalKey: testKey,
        clarifiedOutcome: 'Deploy production microservices with Docker and Kubernetes',
        canonicalMethod: {
          methodName: 'Docker & K8s Production Architecture',
          authority: 'Cloud Native Computing Foundation',
        },
        outcomeEmbedding: createSampleVector(7),
        rawGoal,
        cachedClarification: {
          canonicalKey: testKey,
          clarifiedOutcome: 'Deploy production microservices with Docker and Kubernetes',
          primaryDomain: 'DevOps & Cloud Engineering',
        },
      });

      let embedderCalled = false;
      const result = await resolveResearchCache('', '', {
        rawGoal,
        embedder: async () => {
          embedderCalled = true;
          return createSampleVector(99);
        },
      });

      expect(result.hit).toBe(true);
      expect(result.tier).toBe('tier0_raw_exact');
      expect(result.similarity).toBe(1.0);
      expect(embedderCalled).toBe(false); // Proves zero embedding calls on Part B
      expect(result.entry?.hitCount).toBe(2);
    });
  });

  describe('Stage 1.5 hit accounting', () => {
    const presetGoal = 'Run a 10k in under 50 minutes';
    const presetKey = getPresetCanonicalKey('run10k');

    const cleanup = () => prisma.researchCache.deleteMany({ where: { canonicalKey: presetKey } });

    beforeEach(cleanup);
    afterEach(cleanup);

    it('counts exactly one hit per request when the cached entry has no stored clarification', async () => {
      // A Stage 7 cache write that omits cachedClarification is legal, and is what Phase 3+
      // will produce. The resolver must still only count one hit for one user request.
      const saved = await saveResearchCacheEntry({
        canonicalKey: presetKey,
        clarifiedOutcome: 'Run a 10K road race under 50 minutes',
        canonicalMethod: {
          methodName: 'Jack Daniels VDOT Pacing System',
          authority: 'Dr. Jack Daniels',
        },
        outcomeEmbedding: new Array(768).fill(0).map((_, i) => Math.sin(i * 0.05)),
        rawGoal: presetGoal,
      });

      expect(saved.hitCount).toBe(1);

      const result = await resolveStage1WithCache(presetGoal);
      expect(result.cacheHit).toBe(true);

      const after = await prisma.researchCache.findUnique({
        where: { canonicalKey: presetKey },
        select: { hitCount: true },
      });
      expect(after?.hitCount).toBe(2);
    });
  });

  describe('Tier 2 domain guard', () => {
    // These keys deliberately omit the shared "test." prefix used elsewhere: that prefix
    // would make every key's broad domain identical ("test") and the guard untestable.
    const QUERY_KEY = 'fitness.running.guardtest_10k';
    const SAME_DOMAIN_KEY = 'fitness.running.guardtest_half_marathon';
    const OTHER_DOMAIN_KEY = 'culinary.baking.guardtest_sourdough';

    const cleanup = () =>
      prisma.researchCache.deleteMany({
        where: { canonicalKey: { in: [QUERY_KEY, SAME_DOMAIN_KEY, OTHER_DOMAIN_KEY] } },
      });

    beforeEach(cleanup);
    afterEach(cleanup);

    const createSampleVector = (seed: number): number[] =>
      new Array(768).fill(0).map((_, i) => Math.sin(seed + i * 0.05));

    /** A vector similar enough to clear 0.88 but not the 0.93 cross-domain bar. */
    const perturb = (v: number[]) => v.map((value, i) => value + (i % 3 === 0 ? 0.42 : -0.3));

    it('rejects a near-identical match from a different broad domain', async () => {
      const baseVector = createSampleVector(123);
      const queryVector = perturb(baseVector);
      const similarity = cosineSimilarity(baseVector, queryVector);
      expect(similarity).toBeGreaterThanOrEqual(COSINE_SIMILARITY_THRESHOLD);
      expect(similarity).toBeLessThan(CROSS_DOMAIN_SIMILARITY_THRESHOLD);

      await saveResearchCacheEntry({
        canonicalKey: OTHER_DOMAIN_KEY,
        clarifiedOutcome: 'Bake artisan sourdough at home',
        canonicalMethod: { methodName: 'Tartine Method', authority: 'Chad Robertson' },
        outcomeEmbedding: baseVector,
      });

      const result = await resolveResearchCache(QUERY_KEY, 'Run a 10K road race under 50 minutes', {
        embedder: async () => queryVector,
      });

      expect(result.hit).toBe(false);
    });

    it('accepts the same similarity when the broad domain agrees', async () => {
      const baseVector = createSampleVector(321);
      const queryVector = perturb(baseVector);
      const similarity = cosineSimilarity(baseVector, queryVector);
      expect(similarity).toBeGreaterThanOrEqual(COSINE_SIMILARITY_THRESHOLD);
      expect(similarity).toBeLessThan(CROSS_DOMAIN_SIMILARITY_THRESHOLD);

      await saveResearchCacheEntry({
        canonicalKey: SAME_DOMAIN_KEY,
        clarifiedOutcome: 'Finish a half marathon',
        canonicalMethod: { methodName: 'Daniels VDOT', authority: 'Jack Daniels' },
        outcomeEmbedding: baseVector,
      });

      const result = await resolveResearchCache(QUERY_KEY, 'Run a 10K road race under 50 minutes', {
        embedder: async () => queryVector,
      });

      expect(result.hit).toBe(true);
      expect(result.tier).toBe('tier2_vector');
      expect(result.crossDomain).toBe(false);
      expect(result.entry?.canonicalKey).toBe(SAME_DOMAIN_KEY);
    });
  });

  describe('Embedding outage reporting', () => {
    it('reports a degraded miss rather than a clean miss when embedding fails', async () => {
      resetEmbeddingFailureCount();

      const result = await resolveResearchCache('test.any.key.here', 'Some clarified outcome', {
        embedder: async () => {
          throw new Error('embedding provider unavailable');
        },
      });

      expect(result.hit).toBe(false);
      expect(result.degraded).toBe(true);
      expect(result.degradedReason).toMatch(/unavailable/);
      expect(getEmbeddingFailureCount()).toBe(1);
    });

    it('does not mark an ordinary miss as degraded', async () => {
      resetEmbeddingFailureCount();

      const result = await resolveResearchCache('test.unmatched.key.xyz', 'Totally unrelated outcome', {
        embedder: async () => new Array(768).fill(0).map((_, i) => Math.cos(i * 0.9)),
      });

      expect(result.hit).toBe(false);
      expect(result.degraded).toBeUndefined();
      expect(getEmbeddingFailureCount()).toBe(0);
    });
  });

  describe('rawInputs growth control', () => {
    it('caps remembered phrasings so the entry JSON cannot grow without bound', async () => {
      const key = 'test.capped.rawinputs';
      const vector = new Array(768).fill(0).map((_, i) => Math.cos(i * 0.03));

      const seeded = Array.from({ length: MAX_RAW_INPUTS_PER_ENTRY }, (_, i) => `phrasing number ${i}`);
      await saveResearchCacheEntry({
        canonicalKey: key,
        clarifiedOutcome: 'Capped raw inputs check',
        canonicalMethod: { methodName: 'X', rawInputs: seeded },
        outcomeEmbedding: vector,
      });

      const saved = await saveResearchCacheEntry({
        canonicalKey: key,
        clarifiedOutcome: 'Capped raw inputs check',
        canonicalMethod: { methodName: 'X', rawInputs: seeded },
        outcomeEmbedding: vector,
        rawGoal: 'a brand new phrasing that should evict the oldest',
      });

      const stored = saved.canonicalMethod.rawInputs as string[];
      expect(stored).toHaveLength(MAX_RAW_INPUTS_PER_ENTRY);
      expect(stored).toContain('a brand new phrasing that should evict the oldest');
      expect(stored).not.toContain('phrasing number 0');
    });
  });

  describe('Part A: Key Normalization & Token-Sorting Safety', () => {
    it('normalizes known aliases in canonicalKey', () => {
      expect(normalizeCanonicalKey('devops.containerization.k8s_microservices')).toBe(
        'devops.containerization.kubernetes_microservices'
      );
      expect(normalizeCanonicalKey('tech.frontend.js_react')).toBe('tech.frontend.javascript_react');
      expect(normalizeCanonicalKey('tech.backend.py_django')).toBe('tech.backend.django_python');
    });

    it('normalizes leaf word-order commutatively without cross-domain collisions', () => {
      const key1 = normalizeCanonicalKey('lang.spanish.conversational_b1');
      const key2 = normalizeCanonicalKey('lang.spanish.b1_conversational');
      expect(key1).toBe(key2);
      expect(key1).toBe('lang.spanish.b1_conversational');

      // Crucial: different domains and sub-domains NEVER collide
      const frenchKey = normalizeCanonicalKey('lang.french.b1_conversational');
      const musicKey = normalizeCanonicalKey('music.theory.b1_conversational');
      expect(key1).not.toBe(frenchKey);
      expect(key1).not.toBe(musicKey);

      // Distinct goals within same sub-domain remain distinct
      const halfMarathon = normalizeCanonicalKey('fitness.running.half_marathon');
      const fullMarathon = normalizeCanonicalKey('fitness.running.full_marathon');
      const tenK = normalizeCanonicalKey('fitness.running.10k');
      expect(halfMarathon).not.toBe(fullMarathon);
      expect(halfMarathon).not.toBe(tenK);
    });
  });
});
