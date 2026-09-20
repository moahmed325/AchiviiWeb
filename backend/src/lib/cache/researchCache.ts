import { prisma } from '../prisma.js';
import { generateEmbedding } from '../ai/gemini.js';

export const COSINE_SIMILARITY_THRESHOLD = 0.88;

/**
 * Living dictionary of technical and domain aliases.
 * This is an open floor, not a ceiling. Cases where Tier 1 misses after normalization
 * are logged via logTier1MissForAliasDiscovery to surface missing aliases from real usage.
 */
export const ALIAS_DICTIONARY: Record<string, string> = {
  k8s: 'kubernetes',
  kube: 'kubernetes',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  golang: 'go',
  ml: 'machine_learning',
  ai: 'artificial_intelligence',
};

export function logTier1MissForAliasDiscovery(canonicalKey: string, rawGoal?: string): void {
  console.info(
    `[ResearchCache:AliasDiscovery] Tier 1 Miss for canonicalKey="${canonicalKey}" (rawGoal="${rawGoal || ''}"). Flagged for potential alias dictionary expansion.`
  );
}

/**
 * Normalizes raw input text for Part B exact duplicate checking.
 */
export function normalizeRawInput(rawGoal: string): string {
  return rawGoal
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a canonical key:
 * 1. Preserves hierarchical dot-structure (<broad_domain>.<sub_domain>.<specific_goal>).
 *    Broad and sub domains are strictly preserved so cross-domain collisions are impossible.
 * 2. Replaces known aliases in tokens using ALIAS_DICTIONARY.
 * 3. Sorts tokens alphabetically strictly within the leaf segment (<specific_goal>)
 *    to guarantee that commutative word-order choices (e.g. conversational_b1 vs b1_conversational)
 *    always resolve to the exact same string without changing semantics or losing distinguishing tokens.
 */
export function normalizeCanonicalKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string') return '';
  const parts = rawKey.toLowerCase().trim().split('.');
  if (parts.length < 2) return rawKey.toLowerCase().trim();

  const normalizedParts = parts.map((part, index) => {
    const isLeaf = index === parts.length - 1;
    let tokens = part
      .replace(/[^a-z0-9_]/g, '')
      .split('_')
      .filter(Boolean);

    // Map known aliases
    tokens = tokens.map((t) => ALIAS_DICTIONARY[t] || t);

    // Only sort tokens within the leaf segment (the specific goal) to neutralize word-order variations
    if (isLeaf && tokens.length > 1) {
      tokens = Array.from(new Set(tokens)).sort();
    }

    return tokens.join('_');
  });

  return normalizedParts.join('.');
}

export interface CachedMethodData {
  methodName?: string;
  authority?: string;
  sourceUrl?: string;
  confidence?: 'high_consensus' | 'medium_consensus' | 'first_principles' | string;
  velocityTable?: any;
  rawFindings?: any;
  rawInputs?: string[];
  cachedClarification?: any;
  [key: string]: any;
}

export interface CacheResolutionResult {
  hit: boolean;
  tier?: 'tier0_raw_exact' | 'tier1_exact' | 'tier2_vector';
  similarity?: number;
  entry?: {
    id: string;
    canonicalKey: string;
    outcomeEmbedding: string;
    canonicalMethod: any;
    hitCount: number;
    lastUsedAt: Date;
    readyForPromotion: boolean;
  };
}

/**
 * Computes standard cosine similarity between two numerical vectors.
 * Returns a value between -1.0 and 1.0 (or 0 for zero vectors).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface CacheResolutionOptions {
  embedder?: (text: string) => Promise<number[]>;
  threshold?: number;
  rawGoal?: string;
  skipTier0?: boolean;
}

/**
 * Helper to record rawInput onto an existing cache entry's canonicalMethod for future Tier 0 fast-path hits.
 */
async function attachRawInputToEntry(entry: any, rawInput: string): Promise<any> {
  if (!rawInput || !entry) return entry;
  try {
    const canonicalMethod = typeof entry.canonicalMethod === 'string'
      ? JSON.parse(entry.canonicalMethod)
      : { ...entry.canonicalMethod };

    const rawInputs: string[] = Array.isArray(canonicalMethod.rawInputs)
      ? canonicalMethod.rawInputs
      : [];

    if (!rawInputs.includes(rawInput)) {
      rawInputs.push(rawInput);
      canonicalMethod.rawInputs = rawInputs;
      return await prisma.researchCache.update({
        where: { id: entry.id },
        data: {
          canonicalMethod,
          lastUsedAt: new Date(),
        },
      });
    }
  } catch (err) {
    // Non-fatal if attachment fails
  }
  return entry;
}

/**
 * Stage 1.5 — Cache Resolution
 * Checks if a goal has already been researched:
 * 0. Tier 0: Pre-LLM Raw Input Match (bypasses Stage 1 LLM & embedding calls entirely on literal duplicates)
 * 1. Tier 1: Exact normalized canonicalKey match (with alias expansion & leaf token sorting)
 * 2. Tier 2: In-memory cosine similarity fallback (threshold 0.88) on outcomeEmbedding
 *
 * On a cache hit: increments hitCount and updates lastUsedAt.
 */
export async function resolveResearchCache(
  canonicalKey: string,
  clarifiedOutcome: string,
  options?: CacheResolutionOptions
): Promise<CacheResolutionResult> {
  const threshold = options?.threshold ?? COSINE_SIMILARITY_THRESHOLD;
  const rawGoal = options?.rawGoal;
  const normalizedInput = rawGoal ? normalizeRawInput(rawGoal) : '';

  // --------------------------------------------------------------------------
  // Tier 0 — Pre-LLM Raw Input Match (Part B Fast Path)
  // --------------------------------------------------------------------------
  if (!options?.skipTier0 && normalizedInput) {
    const allCached = await prisma.researchCache.findMany();
    for (const item of allCached) {
      try {
        const method = typeof item.canonicalMethod === 'string'
          ? JSON.parse(item.canonicalMethod)
          : item.canonicalMethod;

        if (Array.isArray(method?.rawInputs) && method.rawInputs.includes(normalizedInput)) {
          const updated = await prisma.researchCache.update({
            where: { id: item.id },
            data: {
              hitCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });

          return {
            hit: true,
            tier: 'tier0_raw_exact',
            similarity: 1.0,
            entry: updated,
          };
        }
      } catch {
        continue;
      }
    }
  }

  // --------------------------------------------------------------------------
  // Tier 1 — Exact Normalized Key Match (Part A)
  // --------------------------------------------------------------------------
  const normalizedKey = normalizeCanonicalKey(canonicalKey);
  if (normalizedKey && normalizedKey.trim()) {
    const exactMatch = await prisma.researchCache.findUnique({
      where: { canonicalKey: normalizedKey.trim() },
    });

    if (exactMatch) {
      const updated = await prisma.researchCache.update({
        where: { id: exactMatch.id },
        data: {
          hitCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      const entryWithInput = normalizedInput
        ? await attachRawInputToEntry(updated, normalizedInput)
        : updated;

      return {
        hit: true,
        tier: 'tier1_exact',
        similarity: 1.0,
        entry: entryWithInput,
      };
    }

    // Tier 1 miss post-normalization: log for alias expansion visibility
    logTier1MissForAliasDiscovery(normalizedKey, rawGoal);
  }

  // --------------------------------------------------------------------------
  // Tier 2 — Embedding Similarity Fallback (threshold 0.88)
  // --------------------------------------------------------------------------
  if (!clarifiedOutcome || !clarifiedOutcome.trim()) {
    return { hit: false };
  }

  const embedFn = options?.embedder || generateEmbedding;
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedFn(clarifiedOutcome.trim());
  } catch (err: any) {
    console.warn('[ResearchCache] Embedding generation failed for outcome:', err.message);
    return { hit: false };
  }

  if (!queryEmbedding || queryEmbedding.length === 0) {
    return { hit: false };
  }

  const allCached = await prisma.researchCache.findMany();
  let bestMatch: typeof allCached[0] | null = null;
  let highestSimilarity = -1;

  for (const item of allCached) {
    try {
      const storedVector: number[] = JSON.parse(item.outcomeEmbedding);
      const sim = cosineSimilarity(queryEmbedding, storedVector);
      if (sim > highestSimilarity) {
        highestSimilarity = sim;
        bestMatch = item;
      }
    } catch {
      // Ignore unparseable embeddings
      continue;
    }
  }

  if (bestMatch && highestSimilarity >= threshold) {
    const updated = await prisma.researchCache.update({
      where: { id: bestMatch.id },
      data: {
        hitCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });

    const entryWithInput = normalizedInput
      ? await attachRawInputToEntry(updated, normalizedInput)
      : updated;

    return {
      hit: true,
      tier: 'tier2_vector',
      similarity: highestSimilarity,
      entry: entryWithInput,
    };
  }

  return { hit: false };
}

export interface SaveResearchCacheInput {
  canonicalKey: string;
  clarifiedOutcome: string;
  canonicalMethod: CachedMethodData;
  outcomeEmbedding?: number[];
  embedder?: (text: string) => Promise<number[]>;
  rawGoal?: string;
  cachedClarification?: any;
}

/**
 * Stores or updates a research cache entry with a 768-dimensional outcome embedding.
 */
export async function saveResearchCacheEntry(
  input: SaveResearchCacheInput
): Promise<any> {
  const {
    canonicalKey,
    clarifiedOutcome,
    canonicalMethod,
    outcomeEmbedding,
    embedder,
    rawGoal,
    cachedClarification,
  } = input;

  const normalizedKey = normalizeCanonicalKey(canonicalKey);

  let embedding = outcomeEmbedding;
  if (!embedding || embedding.length === 0) {
    const embedFn = embedder || generateEmbedding;
    embedding = await embedFn(clarifiedOutcome);
  }

  const outcomeEmbeddingStr = JSON.stringify(embedding);

  const rawInputs: string[] = Array.isArray(canonicalMethod.rawInputs)
    ? [...canonicalMethod.rawInputs]
    : [];
  if (rawGoal) {
    const norm = normalizeRawInput(rawGoal);
    if (!rawInputs.includes(norm)) {
      rawInputs.push(norm);
    }
  }

  const methodToStore: CachedMethodData = {
    ...canonicalMethod,
    rawInputs,
    cachedClarification: cachedClarification || canonicalMethod.cachedClarification || null,
  };

  return prisma.researchCache.upsert({
    where: { canonicalKey: normalizedKey },
    create: {
      canonicalKey: normalizedKey,
      outcomeEmbedding: outcomeEmbeddingStr,
      canonicalMethod: methodToStore as any,
      hitCount: 1,
      lastUsedAt: new Date(),
    },
    update: {
      outcomeEmbedding: outcomeEmbeddingStr,
      canonicalMethod: methodToStore as any,
      lastUsedAt: new Date(),
    },
  });
}
