/**
 * Stage 2 blacklist filtering.
 *
 * Runs in code, before anything reaches the LLM, on both the outgoing query strings and
 * the returned result domains.
 *
 * This list is a FLOOR, NOT A CEILING. It will always be incomplete. Adding to it is an
 * improvement, never a completion — treat every new production observation as a candidate
 * entry rather than assuming the current list is sufficient.
 *
 * Scope note: this filter governs what the pipeline is willing to *read*, not whether a
 * user may pursue a goal. An unsafe-sounding goal still produces a plan; the numbers in it
 * are brought back into range by the Stage 4 clamps. Refusing goals outright is deliberately
 * not this module's job.
 */

export type UnsafeCategory =
  | 'crash_diet'
  | 'extreme_fasting'
  | 'disordered_eating'
  | 'high_leverage_trading'
  | 'unregulated_substances'
  | 'overtraining'
  | 'self_harm_adjacent';

interface BlacklistRule {
  category: UnsafeCategory;
  /** Matched against a normalized, lowercased, punctuation-stripped string. */
  patterns: RegExp[];
}

/**
 * Patterns target the *unsafe framing*, not the topic. "lose weight" is fine;
 * "lose 30 pounds in 2 weeks" is not. Being topic-blind here would block legitimate
 * nutrition and training research wholesale.
 */
const BLACKLIST_RULES: BlacklistRule[] = [
  {
    category: 'crash_diet',
    patterns: [
      /\bcrash diets?\b/,
      /\bstarvation diets?\b/,
      /\b(lose|drop|shed)\s+\d{2,}\s*(lbs?|pounds?|kgs?|kilos?)\s+in\s+\d+\s*(day|days|week|weeks)\b/,
      /\b\d{3,}\s*calorie diet\b/,
      /\bvery low calorie diet\b/,
      /\bvlcd\b/,
    ],
  },
  {
    category: 'extreme_fasting',
    patterns: [
      /\bdry fasting\b/,
      /\bextended fast(ing)?\b/,
      /\b\d{2,}\s*day (water )?fast\b/,
      /\bprolonged water fast(ing)?\b/,
    ],
  },
  {
    category: 'disordered_eating',
    patterns: [
      /\bpro ?ana\b/,
      /\bpro ?mia\b/,
      /\bthinspo\b/,
      /\bappetite suppress(ant|ion)\b/,
      /\bpurg(e|ing)\b/,
    ],
  },
  {
    category: 'high_leverage_trading',
    patterns: [
      /\b\d{2,}x leverage\b/,
      /\bhigh leverage (trading|crypto|forex)\b/,
      /\bmartingale strateg(y|ies)\b/,
      /\byolo (trade|trading|options)\b/,
      /\bget rich quick\b/,
      /\bguaranteed returns?\b/,
    ],
  },
  {
    category: 'unregulated_substances',
    patterns: [
      /\bsarms?\b/,
      /\banabolic steroids?\b/,
      /\bclenbuterol\b/,
      /\bdnp\b/,
      /\bresearch chemicals?\b/,
      /\bnootropic stacks? without\b/,
      /\bpeptides? for (bulking|cutting)\b/,
    ],
  },
  {
    category: 'overtraining',
    patterns: [
      /\btrain(ing)? (twice|2x|3x) a day every day\b/,
      /\bno rest days?\b/,
      /\bmax(imum)? (out )?every (day|session)\b/,
      /\bpush through the pain\b/,
    ],
  },
  {
    category: 'self_harm_adjacent',
    patterns: [/\bself harm\b/, /\bsuicid(e|al)\b/],
  },
];

/**
 * Patterns indicating a page ADVOCATES harm, applied to retrieved source bodies.
 *
 * Far narrower than the query rules above, because a source body is not a request we
 * control — it is evidence, and responsible material discusses dangerous topics in order
 * to warn about them.
 *
 * Learned from a live run: a Tulane University MBSR page was discarded because it said
 * "if you are experiencing ... suicidal feelings, please reach out to the instructor".
 * That safeguarding notice is the most responsible sentence on the page, and rejecting it
 * both lost an accredited source and stripped the "8 weekly 2.5-hour sessions" detail that
 * Stage 3 needed. Screening bodies for bare clinical mentions removes exactly the sources
 * most worth having.
 *
 * Stage 4's deterministic clamps, not this filter, are the real safety guarantee.
 */
const SOURCE_HARM_PATTERNS: Array<{ category: UnsafeCategory; pattern: RegExp }> = [
  { category: 'disordered_eating', pattern: /\bpro ?ana\b/ },
  { category: 'disordered_eating', pattern: /\bpro ?mia\b/ },
  { category: 'disordered_eating', pattern: /\bthinspo\b/ },
  { category: 'disordered_eating', pattern: /\bhow to purge\b/ },
  { category: 'unregulated_substances', pattern: /\b(buy|order) (sarms?|clenbuterol|steroids?)\b/ },
  { category: 'unregulated_substances', pattern: /\bsarms? for sale\b/ },
  { category: 'unregulated_substances', pattern: /\bsteroid cycle for\b/ },
  { category: 'high_leverage_trading', pattern: /\bguaranteed returns?\b/ },
  { category: 'high_leverage_trading', pattern: /\bget rich quick\b/ },
  { category: 'high_leverage_trading', pattern: /\b\d{2,}x leverage\b/ },
  { category: 'extreme_fasting', pattern: /\bdry fasting\b/ },
];

/**
 * Domains rejected regardless of what they say. Matched on the registrable host and any
 * subdomain of it, so "forum.example.com" is caught by an "example.com" entry.
 */
const BLACKLISTED_DOMAINS = new Set<string>([
  'pro-ana.com',
  'myproana.com',
  'thinspiration.com',
  'steroid.com',
  'steroids.com',
  'sarmsstore.com',
  'binaryoptions.com',
  'forexsignals-guaranteed.com',
]);

export function normalizeForMatching(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface BlacklistVerdict {
  blocked: boolean;
  categories: UnsafeCategory[];
  matchedPattern?: string;
}

/**
 * Screens an outgoing search query. A blocked query is dropped before it is ever sent,
 * so the pipeline never pays for, or ingests, results it would have to discard anyway.
 */
export function screenQuery(query: string): BlacklistVerdict {
  const normalized = normalizeForMatching(query);
  const categories: UnsafeCategory[] = [];
  let matchedPattern: string | undefined;

  for (const rule of BLACKLIST_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        if (!categories.includes(rule.category)) categories.push(rule.category);
        matchedPattern ??= pattern.source;
      }
    }
  }

  return { blocked: categories.length > 0, categories, matchedPattern };
}

/** Extracts a lowercased hostname, tolerating malformed input. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isBlacklistedDomain(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return false;
  if (BLACKLISTED_DOMAINS.has(host)) return true;
  // Subdomain match: "forum.myproana.com" must be caught by "myproana.com".
  return [...BLACKLISTED_DOMAINS].some((blocked) => host.endsWith(`.${blocked}`));
}

export interface ScreenableResult {
  url: string;
  title?: string;
  content?: string;
}

export interface ResultScreenOutcome<T extends ScreenableResult> {
  kept: T[];
  rejected: Array<{ result: T; reason: 'domain' | 'content'; categories: UnsafeCategory[] }>;
}

/**
 * Screens returned search results.
 *
 * Three separate checks, deliberately asymmetric:
 *  1. Domain blacklist.
 *  2. The full query ruleset applied to the TITLE only. A title states what a page is for,
 *     so "Lose 40 Pounds In 3 Weeks" is promoting it, not warning about it.
 *  3. The narrow advocacy ruleset applied to the body, which may legitimately discuss
 *     dangerous topics in order to caution against them.
 */
export function screenResults<T extends ScreenableResult>(results: T[]): ResultScreenOutcome<T> {
  const kept: T[] = [];
  const rejected: ResultScreenOutcome<T>['rejected'] = [];

  for (const result of results) {
    if (isBlacklistedDomain(result.url)) {
      rejected.push({ result, reason: 'domain', categories: [] });
      continue;
    }

    const titleVerdict = screenQuery(result.title || '');
    if (titleVerdict.blocked) {
      rejected.push({ result, reason: 'content', categories: titleVerdict.categories });
      continue;
    }

    const body = normalizeForMatching(`${result.title || ''} ${result.content || ''}`);
    const advocacy = SOURCE_HARM_PATTERNS.filter(({ pattern }) => pattern.test(body));
    if (advocacy.length > 0) {
      rejected.push({
        result,
        reason: 'content',
        categories: [...new Set(advocacy.map(({ category }) => category))],
      });
      continue;
    }

    kept.push(result);
  }

  return { kept, rejected };
}
