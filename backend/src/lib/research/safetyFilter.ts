/**
 * Unsafe-goal screen.
 *
 * Runs in code before any model call: generateRoadmap (lib/ai/roadmap.ts) refuses a goal
 * whose text matches these rules, so no plan is written for it.
 *
 * This list is a FLOOR, NOT A CEILING. It will always be incomplete. Adding to it is an
 * improvement, never a completion: treat every new production observation as a candidate
 * entry rather than assuming the current list is sufficient.
 *
 * The numbers in plans that do get written are kept in range by the deterministic clamps
 * in safetyClamps.ts, not by this filter.
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
 * nutrition and training goals wholesale.
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

/** Screens goal text (or any short request) against the unsafe-framing rules. */
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
