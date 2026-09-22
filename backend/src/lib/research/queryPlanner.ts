import { generateStructuredContent } from '../ai/gemini.js';
import { screenQuery, normalizeForMatching } from './safetyFilter.js';
import type { RejectedQuery } from './types.js';

export const MAX_QUERIES = 3;

/**
 * Above this token overlap two queries are treated as the same angle.
 *
 * The spec requires "genuinely distinct angles, not near-duplicates", and a prompt alone
 * cannot guarantee that — models happily return three rewordings of one question. Since
 * every query costs a real search call, distinctness is enforced here in code.
 */
const DUPLICATE_OVERLAP_THRESHOLD = 0.7;

/** Words too common in goal phrasing to signal that two queries share an angle. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'and', 'or', 'how', 'what', 'best',
  'guide', 'with', 'from', 'by', 'at', 'is', 'are', 'your', 'you',
]);

function contentTokens(query: string): Set<string> {
  return new Set(
    normalizeForMatching(query)
      .split(' ')
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  );
}

/** Jaccard overlap of content words. */
export function queryOverlap(a: string, b: string): number {
  const tokensA = contentTokens(a);
  const tokensB = contentTokens(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) if (tokensB.has(token)) shared++;

  const unionSize = tokensA.size + tokensB.size - shared;
  return unionSize === 0 ? 0 : shared / unionSize;
}

/** Keeps the first of any pair of queries that cover the same angle. */
export function dropNearDuplicates(queries: string[]): string[] {
  const kept: string[] = [];
  for (const query of queries) {
    const trimmed = query.trim();
    if (!trimmed) continue;
    if (kept.some((existing) => queryOverlap(existing, trimmed) >= DUPLICATE_OVERLAP_THRESHOLD)) {
      continue;
    }
    kept.push(trimmed);
  }
  return kept;
}

/**
 * Words too generic to identify the skill. If a query drops the real skill words and
 * keeps only these, search matches the wrong field — "weekly schedule milestones"
 * turned stone skipping into children learning to hop.
 */
const SKILL_GENERIC = new Set([
  ...STOPWORDS,
  'get', 'good', 'build', 'learn', 'become', 'practice', 'reduce', 'under', 'over',
  'minutes', 'minute', 'hours', 'hour', 'days', 'day', 'weeks', 'week', 'make',
  'start', 'want', 'able', 'well', 'more', 'less', 'improve', 'better', 'achieve',
  'competitive', 'professional', 'advanced', 'beginner', 'official',
]);

/**
 * A lone one of these words matches a different activity. "skipping" without "stone"
 * is hopscotch; "running" without "10k" is generic jogging advice.
 */
const AMBIGUOUS_SKILL_WORDS = new Set([
  'skip', 'skipping', 'run', 'running', 'play', 'playing', 'set', 'train', 'training',
  'race', 'practice', 'program', 'programme', 'plan', 'schedule',
]);

const INVENTED_ORG_PATTERN =
  /\b(association|federation|college of|institute of|society of|governing body)\b/i;

function hasToken(haystack: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack);
}

/** Distinctive tokens from the goal, longest first. `10k` is kept even though it is short. */
export function skillTokens(goal: string): string[] {
  const raw = normalizeForMatching(goal)
    .split(' ')
    .filter(
      (token) =>
        !SKILL_GENERIC.has(token) && (token.length > 3 || /^\d+[a-z]{0,2}$/.test(token))
    );
  return [...new Set(raw)]
    .sort((a, b) => {
      const aCode = /^\d+[a-z]{0,2}$/.test(a) ? 1 : 0;
      const bCode = /^\d+[a-z]{0,2}$/.test(b) ? 1 : 0;
      if (aCode !== bCode) return bCode - aCode;
      return b.length - a.length;
    })
    .slice(0, 4);
}

/**
 * Whether a query still talks about this goal's skill.
 *
 * Must keep the most specific token, and one more if the goal has one. That is what
 * stopped "World Stone Skipping Association training guidelines" from being replaced by
 * a query that named a made-up club and dropped the skill.
 */
export function queryKeepsSkill(query: string, goal: string): boolean {
  const required = skillTokens(goal);
  if (required.length === 0) return true;

  const hay = normalizeForMatching(query);
  const present = required.filter((token) => hasToken(hay, token));
  if (present.length === 0) return false;
  // "10k" / "5k" already pins the topic. Requiring "road" as well dropped a good
  // interval-training query in a live 10K run.
  if (present.some((token) => /^\d+[a-z]{0,2}$/.test(token))) return true;
  if (!hasToken(hay, required[0])) return false;
  if (required.length === 1) return true;

  return required.slice(1).some((token) => hasToken(hay, token));
}

/**
 * Whether a search result is about this skill, not a look-alike topic.
 *
 * Looser than `queryKeepsSkill` so a Mayo Clinic page titled only "Meditation" still
 * counts. Stricter when the goal uses an ambiguous word: "skipping" must appear with
 * another skill word ("stone"), or the kids-learning-to-hop pages come back.
 */
export function resultKeepsSkill(text: string, goal: string): boolean {
  const required = skillTokens(goal);
  if (required.length === 0) return true;

  const hay = normalizeForMatching(text);
  const present = required.filter((token) => hasToken(hay, token));
  if (present.length === 0) return false;

  const usedAmbiguous = required.some((token) => AMBIGUOUS_SKILL_WORDS.has(token));
  if (usedAmbiguous) {
    return present.some((token) => !AMBIGUOUS_SKILL_WORDS.has(token)) || present.length >= 2;
  }

  return present.length >= 1;
}

/**
 * Queries that name a club or college the goal never mentioned. Live runs invented
 * "World Stone Skipping Association" and "American College of Sports Medicine" and
 * then searched for those, which returned generic or empty results.
 */
export function namesInventedOrganisation(query: string, goal: string): boolean {
  if (!INVENTED_ORG_PATTERN.test(query)) return false;
  return !INVENTED_ORG_PATTERN.test(goal);
}

/**
 * Deterministic angles used when the LLM is unavailable or returns nothing usable.
 *
 * Each query keeps the full goal wording so the skill cannot fall off.
 */
export function templateQueries(clarifiedOutcome: string): string[] {
  const subject = clarifiedOutcome.trim().replace(/\.$/, '');
  return [
    subject,
    `${subject} technique established program`,
    `${subject} training plan timeline`,
  ];
}

const QUERY_SYSTEM_INSTRUCTION = `You plan web research. You produce search queries that find
real pages and videos about THIS skill — not a look-alike topic, not a club you guessed.

Return JSON: { "queries": string[] }

Rules:
- Exactly 3 queries.
- Each must attack a DIFFERENT angle. Do not reword the same question three times.
- Query 1: the goal in plain words. Name NO person, book, brand, club or method.
- Query 2: how people get better at this skill (technique, training, how-to, or an
  established program). Name NO person, club, college, association or governing body.
  Never invent an organisation. You may use a well-known program name only if it is
  already in the goal text.
- Query 3: a plan or timeline. You MUST repeat the distinctive skill words from the goal
  (e.g. "stone skipping", "10K", "mindfulness meditation") so search cannot match a
  different activity.
- Write them as search queries, not questions. No filler words.
- Never include a year unless the goal itself is time-bound.`;

export interface QueryPlan {
  queries: string[];
  rejectedQueries: RejectedQuery[];
  usedFallback: boolean;
}

/**
 * Produces up to MAX_QUERIES distinct, safety-screened search queries.
 *
 * Screening happens here rather than after searching so a blocked phrasing never becomes
 * a paid API call.
 */
export async function planSearchQueries(
  clarifiedOutcome: string,
  primaryDomain?: string
): Promise<QueryPlan> {
  const rejectedQueries: RejectedQuery[] = [];
  let candidates: string[] = [];
  let usedFallback = false;

  const prompt = `Goal: "${clarifiedOutcome}"${primaryDomain ? `\nDomain: ${primaryDomain}` : ''}

Produce 3 distinct search queries for this goal.
Query 1 = the goal in plain words. Query 2 = technique / how to get better. Query 3 = a plan, repeating the skill words. Name no person or organisation.`;

  try {
    const result = await generateStructuredContent<{ queries: string[] }>(
      prompt,
      QUERY_SYSTEM_INSTRUCTION
    );
    if (result.success && Array.isArray(result.data?.queries)) {
      candidates = result.data.queries.filter((q) => typeof q === 'string');
    }
  } catch (err: any) {
    console.warn(`[Stage2:QueryPlanner] Query generation failed: ${err.message}`);
  }

  // Drop guesses and off-topic phrasing before they become paid searches.
  candidates = candidates.filter((query) => {
    if (namesInventedOrganisation(query, clarifiedOutcome)) {
      console.warn(`[Stage2:QueryPlanner] Dropped invented-organisation query "${query}"`);
      return false;
    }
    if (!queryKeepsSkill(query, clarifiedOutcome)) {
      console.warn(`[Stage2:QueryPlanner] Dropped query that lost the skill words "${query}"`);
      return false;
    }
    return true;
  });

  if (candidates.length === 0) {
    usedFallback = true;
    candidates = templateQueries(clarifiedOutcome);
  }

  const distinct = dropNearDuplicates(candidates);

  // If the model collapsed into near-duplicates, top up from the templates rather than
  // searching fewer angles than the spec calls for.
  if (distinct.length < MAX_QUERIES) {
    usedFallback = true;
    for (const fallback of templateQueries(clarifiedOutcome)) {
      if (distinct.length >= MAX_QUERIES) break;
      if (!distinct.some((q) => queryOverlap(q, fallback) >= DUPLICATE_OVERLAP_THRESHOLD)) {
        distinct.push(fallback);
      }
    }
  }

  const safe: string[] = [];
  for (const query of distinct.slice(0, MAX_QUERIES)) {
    const verdict = screenQuery(query);
    if (verdict.blocked) {
      rejectedQueries.push({ query, categories: verdict.categories });
      console.warn(
        `[Stage2:QueryPlanner] Blocked query "${query}" (${verdict.categories.join(', ')})`
      );
      continue;
    }
    safe.push(query);
  }

  return { queries: safe, rejectedQueries, usedFallback };
}
