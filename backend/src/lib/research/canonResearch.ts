import { getTavilyClient, TavilyClient, TavilySearchResult } from '../tavily.js';
import { screenResults } from './safetyFilter.js';
import {
  rankSourcesByTrust,
  isInstructionalVideoHost,
  isNeverExtractHost,
  TrustTier,
  RankedSource,
} from './trustTier.js';
import { distillContent } from './distill.js';
import { planSearchQueries, resultKeepsSkill } from './queryPlanner.js';
import { buildPlanSpine, emptySpineFields } from './spine.js';
import type {
  CanonResearchResult,
  ResearchSource,
  RejectedSource,
} from './types.js';

/** Results requested per search. Kept low — trust ranking matters more than volume. */
const RESULTS_PER_QUERY = 5;

/**
 * URLs sent to `extract`. Extraction is the expensive half of Stage 2, so only the
 * best-ranked survivors are fetched, in ONE batched call rather than one call per URL.
 */
export const MAX_EXTRACT_URLS = 6;

/**
 * Pages taken from any one host.
 *
 * An authority's own site frequently occupies several top slots — halhigdon.com returned
 * four in a live 10K search. Independence is counted per host, so letting one site fill
 * the extract budget buys no additional corroboration while crowding out every other
 * viewpoint.
 */
const MAX_PER_HOST = 2;

/**
 * Tavily relevance below which a result is not worth downloading whatever its domain.
 * Calibrated against live data: on-topic 10K plans scored 0.76-0.88, while generic
 * "ACSM Official Statements" scored 0.34.
 */
const MIN_RELEVANCE_SCORE = 0.4;

/**
 * Relevance advantage granted for being a recognised authority.
 *
 * Deliberately small. Trust breaks ties between comparably relevant pages; it must never
 * promote an off-topic one. A live run ranked two ACSM pages about physical-activity and
 * resistance-training guidelines above the article literally titled "Sub 50 10K: Pace,
 * Plan + How To Do It" purely because ACSM was on an allowlist.
 */
const TRUST_BONUS: Record<TrustTier, number> = { HIGH: 0.1, MEDIUM: 0, LOW: -1 };

/** Bonus per additional query angle that surfaced the same page, capped. */
const MULTI_ANGLE_BONUS = 0.03;

function emptyResearch(
  partial: Omit<CanonResearchResult, 'teachings' | 'velocityTable'>
): CanonResearchResult {
  return { ...partial, ...emptySpineFields(), velocityTable: null };
}

export interface CanonResearchOptions {
  tavily?: Pick<TavilyClient, 'search' | 'extract'>;
  primaryDomain?: string;
  maxExtractUrls?: number;
  /**
   * Use these queries instead of planning new ones.
   *
   * Query generation is not reproducible across runs, so replaying recorded search results
   * against freshly planned queries matches nothing. Reusing the captured plan is what
   * makes a recorded run genuinely repeatable.
   */
  presetQueries?: string[];
}

interface MergedResult {
  result: TavilySearchResult;
  queryHits: number;
  /** Position within its own query's result list, used to interleave angles fairly. */
  rankInQuery: number;
  /** Best Tavily relevance score this URL achieved across all query angles. */
  score: number;
}

/**
 * Combined desirability of a page: relevance first, trust as a modifier.
 *
 * Exported so the weighting can be tested directly rather than inferred from selection.
 */
export function scoreCandidate(
  relevance: number,
  tier: TrustTier,
  queryHits: number
): number {
  const multiAngle = Math.min(queryHits - 1, 2) * MULTI_ANGLE_BONUS;
  return relevance + TRUST_BONUS[tier] + multiAngle;
}

/** One video is enough to teach a technique. More of them crowd out written sources. */
const MAX_VIDEO_EXTRACTS = 2;

/**
 * Chooses which pages to pay to download.
 *
 * Relevance leads. Written HIGH/MEDIUM pages fill first. Instructional videos may fill
 * leftover slots — they are real evidence for many goals, but cannot earn a named-method
 * badge. Social posts and document dumps are never fetched.
 */
export function selectShortlist(
  ranked: Array<RankedSource<TavilySearchResult>>,
  merged: Map<string, MergedResult>,
  limit: number,
  goal?: string
): Array<RankedSource<TavilySearchResult>> {
  const scored = ranked
    .map((entry) => {
      const stats = merged.get(entry.source.url);
      const relevance = stats?.score ?? entry.source.score ?? 0;
      const text = `${entry.source.title || ''} ${entry.source.url} ${entry.source.content || ''}`;
      return {
        entry,
        relevance,
        composite: scoreCandidate(relevance, entry.assessment.tier, stats?.queryHits ?? 1),
        rankInQuery: stats?.rankInQuery ?? 99,
        onTopic: !goal || resultKeepsSkill(text, goal),
      };
    })
    .filter(({ entry, relevance }) => {
      if (relevance < MIN_RELEVANCE_SCORE) return false;
      if (isNeverExtractHost(entry.assessment.host)) return false;
      return entry.assessment.tier !== 'LOW' || isInstructionalVideoHost(entry.assessment.host);
    });

  const anyOnTopic = scored.some((item) => item.onTopic);
  const usable = (anyOnTopic ? scored.filter((item) => item.onTopic) : scored).sort(
    (a, b) => b.composite - a.composite || a.rankInQuery - b.rankInQuery
  );

  const perHost = new Map<string, number>();
  const shortlist: Array<RankedSource<TavilySearchResult>> = [];
  let videoCount = 0;

  const take = (entry: RankedSource<TavilySearchResult>): boolean => {
    if (shortlist.length >= limit) return false;
    const host = entry.assessment.host;
    const used = perHost.get(host) ?? 0;
    if (used >= MAX_PER_HOST) return false;
    if (isInstructionalVideoHost(host)) {
      if (videoCount >= MAX_VIDEO_EXTRACTS) return false;
      videoCount += 1;
    }
    perHost.set(host, used + 1);
    shortlist.push(entry);
    return true;
  };

  for (const { entry } of usable) {
    if (entry.assessment.tier !== 'LOW') take(entry);
  }
  for (const { entry } of usable) {
    if (entry.assessment.tier === 'LOW') take(entry);
  }

  return shortlist;
}

/**
 * Stage 2 — Canon Research. Runs only on a cache miss.
 *
 * Search results are merged across query angles and de-duplicated by URL *before*
 * extraction, because distinct angles routinely surface the same authoritative page and
 * paying to fetch it three times buys nothing.
 */
export async function runCanonResearch(
  clarifiedOutcome: string,
  options: CanonResearchOptions = {}
): Promise<CanonResearchResult> {
  const tavily = options.tavily ?? getTavilyClient();
  const extractLimit = options.maxExtractUrls ?? MAX_EXTRACT_URLS;
  const rejectedSources: RejectedSource[] = [];
  const budget = { searchCalls: 0, extractCalls: 0, extractedUrls: 0 };

  const plan = options.presetQueries?.length
    ? { queries: options.presetQueries, rejectedQueries: [], usedFallback: false }
    : await planSearchQueries(clarifiedOutcome, options.primaryDomain);

  if (plan.queries.length === 0) {
    return emptyResearch({
      methodConfidence: 'first_principles',
      sources: [],
      allowedUrls: [],
      queries: [],
      rejectedQueries: plan.rejectedQueries,
      rejectedSources,
      reasoning:
        'Every generated search query was blocked by the safety filter, so no research was performed.',
      budget,
    });
  }

  // ---------------------------------------------------------------------------
  // Search all angles in parallel. One failing query must not sink the others.
  // ---------------------------------------------------------------------------
  const searches = await Promise.allSettled(
    plan.queries.map((query) => tavily.search(query, { maxResults: RESULTS_PER_QUERY }))
  );
  budget.searchCalls = plan.queries.length;

  const byUrl = new Map<string, MergedResult>();
  const searchFailures: string[] = [];
  for (const [index, settled] of searches.entries()) {
    if (settled.status === 'rejected') {
      const message = String(settled.reason?.message ?? settled.reason);
      searchFailures.push(message);
      console.warn(`[Stage2] Search failed for "${plan.queries[index]}": ${message}`);
      continue;
    }
    for (const [position, result] of (settled.value.results ?? []).entries()) {
      const existing = byUrl.get(result.url);
      if (existing) {
        existing.queryHits++;
        // Appearing high in more than one angle is a stronger signal than either alone.
        existing.rankInQuery = Math.min(existing.rankInQuery, position);
        existing.score = Math.max(existing.score, result.score ?? 0);
        rejectedSources.push({ url: result.url, reason: 'duplicate', categories: [] });
      } else {
        byUrl.set(result.url, {
          result,
          queryHits: 1,
          rankInQuery: position,
          score: result.score ?? 0,
        });
      }
    }
  }

  if (byUrl.size === 0) {
    const blocked = searchFailures.find((message) => /blocked from this network/i.test(message));
    return emptyResearch({
      methodConfidence: 'first_principles',
      sources: [],
      allowedUrls: [],
      queries: plan.queries,
      rejectedQueries: plan.rejectedQueries,
      rejectedSources,
      reasoning: blocked || (searchFailures[0] ? `Search failed: ${searchFailures[0]}` : 'No search results were returned for any query angle.'),
      budget,
    });
  }

  // ---------------------------------------------------------------------------
  // Safety screen, then trust rank. Both before anything reaches the LLM.
  // ---------------------------------------------------------------------------
  const screened = screenResults([...byUrl.values()].map((entry) => entry.result));
  for (const { result, reason, categories } of screened.rejected) {
    rejectedSources.push({ url: result.url, reason, categories });
    console.warn(`[Stage2] Rejected source ${result.url} (${reason})`);
  }

  if (screened.kept.length === 0) {
    return emptyResearch({
      methodConfidence: 'first_principles',
      sources: [],
      allowedUrls: [],
      queries: plan.queries,
      rejectedQueries: plan.rejectedQueries,
      rejectedSources,
      reasoning: 'Every search result was rejected by the safety filter.',
      budget,
    });
  }

  const ranked = rankSourcesByTrust(screened.kept);
  const shortlist = selectShortlist(ranked, byUrl, extractLimit, clarifiedOutcome);

  if (shortlist.length === 0) {
    return emptyResearch({
      methodConfidence: 'first_principles',
      sources: [],
      allowedUrls: [],
      queries: plan.queries,
      rejectedQueries: plan.rejectedQueries,
      rejectedSources,
      reasoning: 'No on-topic readable pages survived filtering, so no pages were downloaded.',
      budget,
    });
  }

  // ---------------------------------------------------------------------------
  // One batched extract for the shortlist. Snippets remain the fallback for any
  // URL extraction could not parse.
  // ---------------------------------------------------------------------------
  const extractedByUrl = new Map<string, string>();
  if (shortlist.length > 0) {
    try {
      const extraction = await tavily.extract(shortlist.map((entry) => entry.source.url));
      budget.extractCalls = 1;
      budget.extractedUrls = extraction.results?.length ?? 0;
      for (const item of extraction.results ?? []) {
        if (item.raw_content) extractedByUrl.set(item.url, item.raw_content);
      }
      for (const failure of extraction.failed_results ?? []) {
        console.warn(`[Stage2] Extract failed for ${failure.url}: ${failure.error}`);
      }
    } catch (err: any) {
      // Extraction is an enrichment step; snippets are still workable research input.
      console.warn(`[Stage2] Extract call failed entirely, continuing on snippets: ${err.message}`);
    }
  }

  const sources: ResearchSource[] = shortlist.map(({ source, assessment }) => ({
    url: source.url,
    title: source.title ?? '',
    tier: assessment.tier as TrustTier,
    trustReason: assessment.reason,
    // Boilerplate is stripped here so corroboration counts words from the article rather
    // than from a navigation menu that happens to link the method's name.
    content: distillContent(extractedByUrl.get(source.url) ?? source.content ?? '', {
      budget: 6000,
    }),
    queryHits: byUrl.get(source.url)?.queryHits ?? 1,
  }));

  const allowedUrls = sources.map((source) => source.url);
  const spine = await buildPlanSpine(clarifiedOutcome, sources);

  return {
    methodConfidence: spine.methodConfidence,
    methodKind: spine.methodKind,
    methodName: spine.methodName,
    authority: spine.authority,
    sourceUrl: spine.sourceUrl,
    teachings: spine.teachings,
    assumptions: spine.assumptions,
    velocityTable: null,
    sources,
    allowedUrls,
    queries: plan.queries,
    rejectedQueries: plan.rejectedQueries,
    rejectedSources,
    reasoning: spine.reasoning,
    budget,
  };
}
