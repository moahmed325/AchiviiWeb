import type { TrustTier } from './trustTier.js';
import type { UnsafeCategory } from './safetyFilter.js';

export type MethodConfidence = 'high_consensus' | 'medium_consensus' | 'first_principles';

/**
 * What kind of spine we actually found. This is what the plan-writer follows.
 * `methodConfidence` is only the badge: a named program can earn high/medium;
 * everything else stays first_principles so we never show a gold badge we did not earn.
 */
export type MethodKind = 'named_program' | 'shared_pattern' | 'technique' | 'single_source';

/**
 * Whether a larger or smaller number represents the harder target.
 *
 * Without this, a sanity check cannot tell progress from regression: weekly mileage should
 * rise over 12 weeks, but a 10K finish time should fall. Asserting "week12 > week1" would
 * pass a plan that makes the runner slower.
 */
export type MetricDirection = 'higher_is_harder' | 'lower_is_harder';

export interface VelocityTarget {
  metric: string;
  value: number;
  unit: string;
  direction: MetricDirection;
}

export interface VelocityTable {
  week1Targets: VelocityTarget[];
  week12Targets: VelocityTarget[];
  progressionFormula: string;
  /**
   * Who these numbers are for, in the source's own terms (e.g. "an adult running roughly
   * 10 miles per week already").
   *
   * The cache is keyed by method, not by the individual, so one stored table is served to
   * everyone pursuing that method. Recording the starting point the research assumed keeps
   * that honest and gives Stage 5 something concrete to personalise against.
   */
  assumptions: string;
}

export interface ResearchSource {
  url: string;
  title: string;
  tier: TrustTier;
  trustReason: string;
  /** Extracted page text where available, otherwise the search snippet. */
  content: string;
  /** How many of the distinct query angles surfaced this URL — a crude relevance signal. */
  queryHits: number;
}

export interface RejectedQuery {
  query: string;
  categories: UnsafeCategory[];
}

export interface RejectedSource {
  url: string;
  reason: 'domain' | 'content' | 'duplicate';
  categories: UnsafeCategory[];
}

export interface ResearchBudget {
  searchCalls: number;
  extractCalls: number;
  extractedUrls: number;
}

export interface CanonResearchResult {
  methodConfidence: MethodConfidence;
  /**
   * How we will build the plan. Always set when any on-topic page was retrieved.
   * Missing only when search returned nothing usable.
   */
  methodKind?: MethodKind;
  methodName?: string;
  authority?: string;
  sourceUrl?: string;
  /** Concrete steps or rules taken from the pages. Empty only when search found nothing. */
  teachings: string[];
  /** Who the advice was written for, in the sources' own terms. */
  assumptions?: string;
  velocityTable: VelocityTable | null;

  /** Everything that survived filtering, best-trust-first. */
  sources: ResearchSource[];
  /**
   * Every URL the pipeline genuinely retrieved this run. Stage 5 may only emit a
   * `resourceUrl` that appears here — it is the allowlist that makes invented links
   * impossible rather than merely discouraged.
   */
  allowedUrls: string[];

  queries: string[];
  rejectedQueries: RejectedQuery[];
  rejectedSources: RejectedSource[];

  /** Plain-language account of why the confidence landed where it did. */
  reasoning: string;
  /** Set when the velocity table was discarded and confidence downgraded. */
  flaggedForReview?: string;

  budget: ResearchBudget;
}
