import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { generateEmbedding } from '../ai/gemini.js';
import { clampVelocityOnCacheHit } from '../research/safetyClamps.js';

export const COSINE_SIMILARITY_THRESHOLD = 0.88;

/**
 * Tier 1 guarantees keys from different broad domains can never collide, but Tier 2's
 * nearest-neighbour search is global and would happily cross that boundary on text
 * similarity alone. A shared broad domain is corroborating evidence; without it we demand
 * a markedly stronger signal rather than refusing outright, because a legitimate reason
 * Tier 1 missed is that Stage 1 filed the same goal under two different domains.
 */
export const CROSS_DOMAIN_SIMILARITY_THRESHOLD = 0.93;

/**
 * Tier 2 inspects several neighbours rather than only the closest one: if the single
 * nearest row fails the domain guard, a slightly-further same-domain row may still be a
 * legitimate hit, and LIMIT 1 would have discarded it unseen.
 */
const TIER2_CANDIDATE_LIMIT = 5;

/** Leading segment of a hierarchical key, e.g. "fitness" from "fitness.running.10k". */
function broadDomainOf(canonicalKey: string): string {
  return (canonicalKey || '').split('.')[0]?.trim() ?? '';
}

let embeddingFailureCount = 0;

/**
 * Number of lookups that fell back to a miss because the embedding provider failed.
 * A degraded lookup is indistinguishable from a genuine miss to the caller's logic, so
 * without this counter an embedding outage silently becomes a 100% miss rate — and from
 * Phase 3 onward that means re-running paid research on every single request.
 */
export function getEmbeddingFailureCount(): number {
  return embeddingFailureCount;
}

export function resetEmbeddingFailureCount(): void {
  embeddingFailureCount = 0;
}

/**
 * Hit count at which an entry is flagged for review as a candidate certified preset.
 * Deliberately NOT gated on userFeedbackScore — that field stays informational until a
 * real feedback-collection mechanism ships. Flagging only; no auto-export.
 */
export const PROMOTION_HIT_THRESHOLD = 10;

/**
 * Cap on distinct raw phrasings remembered per entry. rawInputs lives inside the
 * canonicalMethod JSON, so an uncapped list would grow without limit, inflating every
 * row read and slowing the Tier 0 containment lookup it exists to accelerate.
 * Oldest entries are dropped first; Tier 1 and Tier 2 still catch evicted phrasings.
 */
export const MAX_RAW_INPUTS_PER_ENTRY = 50;

function appendRawInput(existing: unknown, rawInput: string): string[] {
  const list = Array.isArray(existing) ? (existing as string[]) : [];
  if (list.includes(rawInput)) return list;
  return [...list, rawInput].slice(-MAX_RAW_INPUTS_PER_ENTRY);
}

/**
 * Update payload applied on every cache hit. `currentHitCount` is the pre-increment
 * value, so the promotion flag reflects the hit being recorded right now.
 */
function buildCacheHitUpdate(currentHitCount: number) {
  return {
    hitCount: { increment: 1 },
    lastUsedAt: new Date(),
    readyForPromotion: currentHitCount + 1 >= PROMOTION_HIT_THRESHOLD,
  };
}

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
  entry?: CachedEntry;
  /**
   * True when Tier 2 could not run because the embedding provider failed. The result is
   * still a miss, but an unreliable one — callers should not treat it as proof that no
   * cached research exists.
   */
  degraded?: boolean;
  degradedReason?: string;
  /** Set when a Tier 2 match was accepted across a broad-domain boundary. */
  crossDomain?: boolean;
}

export interface CachedEntry {
  id: string;
  canonicalKey: string;
  canonicalMethod: any;
  hitCount: number;
  lastUsedAt: Date;
  readyForPromotion: boolean;
}

/** Clamp stored numbers on the way out. The row on disk is left as written. */
function withClampedVelocity(entry: CachedEntry): CachedEntry {
  if (!entry.canonicalMethod || typeof entry.canonicalMethod !== 'object') return entry;
  return {
    ...entry,
    canonicalMethod: clampVelocityOnCacheHit(entry.canonicalMethod, entry.id),
  };
}

/** Columns safe to select through Prisma Client — deliberately excludes the vector column. */
const ENTRY_SELECT = {
  id: true,
  canonicalKey: true,
  canonicalMethod: true,
  hitCount: true,
  lastUsedAt: true,
  readyForPromotion: true,
} as const;

/** pgvector's text input format, e.g. "[0.1,0.2,0.3]". */
function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
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

    const rawInputs = appendRawInput(canonicalMethod.rawInputs, rawInput);

    if (rawInputs !== canonicalMethod.rawInputs) {
      canonicalMethod.rawInputs = rawInputs;
      return await prisma.researchCache.update({
        where: { id: entry.id },
        data: {
          canonicalMethod,
          lastUsedAt: new Date(),
        },
        select: ENTRY_SELECT,
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
 * 2. Tier 2: pgvector cosine similarity fallback (threshold 0.88) on outcomeEmbedding
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
    // Raw SQL on purpose: Prisma's array_contains compiles to
    // ("canonicalMethod" #> ARRAY['rawInputs'])::jsonb @> $1, and Postgres only uses an
    // expression index when the expression matches exactly — so that form can never hit
    // research_cache_raw_inputs_idx and always degrades to a sequential scan.
    // The "->" form below matches the index expression and produces a Bitmap Index Scan.
    const matches = await prisma.$queryRaw<Array<CachedEntry>>`
      SELECT "id", "canonicalKey", "canonicalMethod", "hitCount", "lastUsedAt", "readyForPromotion"
      FROM "research_cache"
      WHERE "canonicalMethod" -> 'rawInputs' @> ${JSON.stringify(normalizedInput)}::jsonb
      LIMIT 1
    `;

    const match = matches[0];
    if (match) {
      const updated = await prisma.researchCache.update({
        where: { id: match.id },
        data: buildCacheHitUpdate(match.hitCount),
        select: ENTRY_SELECT,
      });

      return {
        hit: true,
        tier: 'tier0_raw_exact',
        similarity: 1.0,
        entry: withClampedVelocity(updated),
      };
    }
  }

  // --------------------------------------------------------------------------
  // Tier 1 — Exact Normalized Key Match (Part A)
  // --------------------------------------------------------------------------
  const normalizedKey = normalizeCanonicalKey(canonicalKey);
  if (normalizedKey && normalizedKey.trim()) {
    const exactMatch = await prisma.researchCache.findUnique({
      where: { canonicalKey: normalizedKey.trim() },
      select: ENTRY_SELECT,
    });

    if (exactMatch) {
      const updated = await prisma.researchCache.update({
        where: { id: exactMatch.id },
        data: buildCacheHitUpdate(exactMatch.hitCount),
        select: ENTRY_SELECT,
      });

      const entryWithInput = normalizedInput
        ? await attachRawInputToEntry(updated, normalizedInput)
        : updated;

      return {
        hit: true,
        tier: 'tier1_exact',
        similarity: 1.0,
        entry: withClampedVelocity(entryWithInput),
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
    embeddingFailureCount++;
    console.error(
      `[ResearchCache] Embedding generation failed (total failures: ${embeddingFailureCount}); ` +
        `Tier 2 skipped and reported as a DEGRADED miss: ${err.message}`
    );
    return { hit: false, degraded: true, degradedReason: err.message };
  }

  if (!queryEmbedding || queryEmbedding.length === 0) {
    embeddingFailureCount++;
    console.error(
      `[ResearchCache] Embedding returned no values (total failures: ${embeddingFailureCount}); ` +
        'Tier 2 skipped and reported as a DEGRADED miss.'
    );
    return { hit: false, degraded: true, degradedReason: 'empty embedding' };
  }

  // pgvector resolves ordering with the <=> cosine-distance operator against the HNSW
  // index; cosine distance is 1 - cosine similarity.
  const candidates = await prisma.$queryRaw<
    Array<{ id: string; canonicalKey: string; hitCount: number; similarity: number }>
  >`
    SELECT
      "id",
      "canonicalKey",
      "hitCount",
      1 - ("outcomeEmbedding" <=> ${toVectorLiteral(queryEmbedding)}::vector) AS "similarity"
    FROM "research_cache"
    WHERE "outcomeEmbedding" IS NOT NULL
    ORDER BY "outcomeEmbedding" <=> ${toVectorLiteral(queryEmbedding)}::vector
    LIMIT ${TIER2_CANDIDATE_LIMIT}
  `;

  const queryDomain = broadDomainOf(normalizedKey);
  const crossDomainThreshold = Math.max(threshold, CROSS_DOMAIN_SIMILARITY_THRESHOLD);

  let bestMatch: (typeof candidates)[number] | undefined;
  let matchedCrossDomain = false;

  // Candidates arrive closest-first, so the first one clearing its bar is the best match.
  for (const candidate of candidates) {
    const similarity = Number(candidate.similarity);
    // With no query domain (e.g. the Tier 0 pre-check path) there is nothing to corroborate
    // against, so fall back to the plain threshold rather than inventing a stricter one.
    const sameDomain = !queryDomain || broadDomainOf(candidate.canonicalKey) === queryDomain;
    const required = sameDomain ? threshold : crossDomainThreshold;

    if (similarity >= required) {
      bestMatch = candidate;
      matchedCrossDomain = !sameDomain;
      break;
    }

    if (!sameDomain && similarity >= threshold) {
      console.info(
        `[ResearchCache:Tier2] Rejected cross-domain match "${candidate.canonicalKey}" for ` +
          `"${normalizedKey}" at similarity ${similarity.toFixed(4)} (needs ${crossDomainThreshold}).`
      );
    }
  }

  if (bestMatch) {
    const updated = await prisma.researchCache.update({
      where: { id: bestMatch.id },
      data: buildCacheHitUpdate(bestMatch.hitCount),
      select: ENTRY_SELECT,
    });

    const entryWithInput = normalizedInput
      ? await attachRawInputToEntry(updated, normalizedInput)
      : updated;

    return {
      hit: true,
      tier: 'tier2_vector',
      similarity: Number(bestMatch.similarity),
      entry: withClampedVelocity(entryWithInput),
      crossDomain: matchedCrossDomain,
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

  const rawInputs = rawGoal
    ? appendRawInput(canonicalMethod.rawInputs, normalizeRawInput(rawGoal))
    : Array.isArray(canonicalMethod.rawInputs)
      ? [...(canonicalMethod.rawInputs as string[])]
      : [];

  const methodToStore: CachedMethodData = {
    ...canonicalMethod,
    rawInputs,
    cachedClarification: cachedClarification || canonicalMethod.cachedClarification || null,
  };

  // Prisma Client can't write Unsupported("vector") columns, so the whole upsert runs as
  // raw SQL. Doing it in one statement also keeps the write atomic.
  const rows = await prisma.$queryRaw<Array<CachedEntry>>`
    INSERT INTO "research_cache" (
      "id", "canonicalKey", "outcomeEmbedding", "canonicalMethod",
      "hitCount", "createdAt", "updatedAt", "lastUsedAt"
    )
    VALUES (
      ${randomUUID()},
      ${normalizedKey},
      ${toVectorLiteral(embedding)}::vector,
      ${JSON.stringify(methodToStore)}::jsonb,
      1, NOW(), NOW(), NOW()
    )
    ON CONFLICT ("canonicalKey") DO UPDATE SET
      "outcomeEmbedding" = EXCLUDED."outcomeEmbedding",
      "canonicalMethod"  = EXCLUDED."canonicalMethod",
      "updatedAt"        = NOW(),
      "lastUsedAt"       = NOW()
    RETURNING "id", "canonicalKey", "canonicalMethod", "hitCount", "lastUsedAt", "readyForPromotion"
  `;

  return rows[0];
}
