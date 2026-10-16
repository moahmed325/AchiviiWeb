import type { DetailedStep } from './goalDecomposer.js';

/**
 * B-63 (PSL-1, PSL-2): a narrow stopgap scan of high-load step text for clear breaches of the old safety limits,
 * until docs/features/plan-safety-limits lands. Patterns stay narrow: safe wording must never count.
 */
export type SafetyRule = 'deficit_over_600' | 'over_80_percent_1rm' | 'rir_below_3' | 'to_failure' | 'max_test';

export interface SafetyHit {
  rule: SafetyRule;
  /** The sentence that matched, at most 120 characters. */
  matched: string;
}

/** Weeks 1 to 3 hold the early-week limits (PSL-2); from week 4 the method's own range applies. */
export const EARLY_WEEKS = 3;

export const SAFETY_LIMIT_TEXT: Record<SafetyRule, string> = {
  deficit_over_600: 'a calorie deficit of 250 to 600 kcal a day, never more',
  over_80_percent_1rm: 'in weeks 1 to 3, no lift above 80% of 1RM',
  rir_below_3: 'in weeks 1 to 3, at least 3 reps in reserve',
  to_failure: 'in weeks 1 to 3, nothing to failure',
  max_test: 'in weeks 1 to 3, no max or 1RM test',
};

/** The step fields a breach is looked for in. Not pitfallToAvoid: it names what to avoid by design. */
const SCANNED_FIELDS = ['title', 'instructions', 'passMark', 'focusCue', 'output', 'timing'] as const;

const NUMBER_WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5 };
const N = String.raw`(\d+(?:\.\d+)?|zero|one|two|three|four|five)`;
const TO = String.raw`\s*(?:-|–|—|to)\s*`;

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const word = NUMBER_WORDS[value.toLowerCase()];
  if (word !== undefined) return word;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

const KCAL_NUMBER = String.raw`(\d{1,2},\d{3}|\d{3,4})`;
const KCAL_UNIT = String.raw`(?:kcal|k?cals?|calories?)`;
/** "800 kcal deficit", "500-700 kcal/day deficit", "a 700 calorie daily deficit". */
const DEFICIT_AFTER = new RegExp(
  String.raw`${KCAL_NUMBER}(?:${TO}${KCAL_NUMBER})?\s*${KCAL_UNIT}(?:\s*(?:\/|a|per)\s*day)?(?:\s+daily)?\s+deficit`,
  'gi'
);
/** "deficit of 700 kcal", "deficit of about 500-700 calories". */
const DEFICIT_BEFORE = new RegExp(
  String.raw`deficit\s+(?:of\s+)?(?:about\s+|around\s+|roughly\s+|up\s+to\s+)?${KCAL_NUMBER}(?:${TO}${KCAL_NUMBER})?\s*${KCAL_UNIT}`,
  'gi'
);
/** "85% of 1RM", "under 90% 1RM", "75-85% of your one-rep max". The upper end of a range counts. */
const PERCENT_1RM = new RegExp(
  String.raw`(\d{2,3}(?:\.\d+)?)\s*%?(?:${TO}(\d{2,3}(?:\.\d+)?))?\s*%\s*(?:of\s+)?(?:(?:your|the|a|an|estimated)\s+)?(?:1\s*-?\s*RM|one[\s-]rep[\s-]max)`,
  'gi'
);
/** Reps in reserve; the lower end of a range counts. */
const RIR_PATTERNS = [
  new RegExp(String.raw`\bRIR\s*(?:of\s+|=\s*|:\s*|@\s*)?${N}(?:${TO}${N})?`, 'gi'),
  new RegExp(String.raw`\b${N}(?:${TO}${N})?\s*RIR\b`, 'gi'),
  new RegExp(String.raw`\b${N}(?:${TO}${N})?\s+reps?\s+in\s+(?:the\s+)?reserve`, 'gi'),
  new RegExp(String.raw`\b${N}(?:${TO}${N})?\s+reps?\s+(?:short\s+of|before|from|shy\s+of)\s+failure`, 'gi'),
];
const FAILURE = /\b(?:to|until|till)\s+(?:(?:momentary|muscular|technical|complete|total|absolute)\s+)?failure\b|\bAMRAP\b|\bas many reps as possible\b/i;
const MAX_TEST =
  /\b(?:1\s*-?\s*RM|one[\s-]rep[\s-]max)\s+test|\btest\s+(?:your|a|the)\s+(?:new\s+)?(?:1\s*-?\s*RM|one[\s-]rep[\s-]max|max)\b|\bmax(?:es|ed|ing)?\s+out\b|\bmax(?:imal|imum)?\s+single\b|\btrue\s+max\b/i;
const NEGATION = /\b(?:never|no|not|don'?t|don’t|do\s+not|avoid|without)\b/i;
/** "stop 3 reps before failure": 3 or more reps short of failure is safe wording. */
const SAFE_SHORT_OF_FAILURE = new RegExp(String.raw`\b${N}(?:\s+or\s+more)?\s+reps?\s+(?:short\s+of|before|from|shy\s+of)\s+failure`, 'i');

function sentences(value: string): string[] {
  return value
    .split(/(?<=[.!?;])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clip(sentence: string): string {
  return sentence.length > 120 ? `${sentence.slice(0, 117)}...` : sentence;
}

/** Failure and max-test wording is safe when the sentence negates it before the match, or keeps 3+ reps in reserve. */
function negated(sentence: string, matchIndex: number): boolean {
  if (NEGATION.test(sentence.slice(0, matchIndex))) return true;
  const safe = SAFE_SHORT_OF_FAILURE.exec(sentence);
  return safe !== null && (toNumber(safe[1]) ?? 0) >= 3;
}

function anyMatch(patterns: RegExp[], sentence: string, broken: (match: RegExpExecArray) => boolean): boolean {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(sentence); match; match = pattern.exec(sentence)) {
      if (broken(match)) return true;
    }
  }
  return false;
}

const upperEnd = (match: RegExpExecArray) => toNumber(match[2]) ?? toNumber(match[1]) ?? 0;
const lowerEnd = (match: RegExpExecArray) => {
  const values = [toNumber(match[1]), toNumber(match[2])].filter((value): value is number => value !== null);
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY;
};

/** The early-week max-test and to-failure rules, also used on the roadmap's weeks 1 to 3 tests. */
export function maxOrFailureHits(value: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  for (const sentence of sentences(value)) {
    const failure = FAILURE.exec(sentence);
    if (failure && !negated(sentence, failure.index)) hits.push({ rule: 'to_failure', matched: clip(sentence) });
    const max = MAX_TEST.exec(sentence);
    if (max && !negated(sentence, max.index)) hits.push({ rule: 'max_test', matched: clip(sentence) });
  }
  return hits;
}

/** Every breach in one piece of text: one hit per rule, the first sentence that breaks it. */
export function textSafetyHits(value: string, weekNumber: number): SafetyHit[] {
  const hits: SafetyHit[] = [];
  const add = (hit: SafetyHit) => {
    if (!hits.some((item) => item.rule === hit.rule)) hits.push(hit);
  };
  const early = weekNumber <= EARLY_WEEKS;
  for (const sentence of sentences(value)) {
    if (anyMatch([DEFICIT_AFTER, DEFICIT_BEFORE], sentence, (match) => upperEnd(match) > 600)) {
      add({ rule: 'deficit_over_600', matched: clip(sentence) });
    }
    if (!early) continue;
    if (anyMatch([PERCENT_1RM], sentence, (match) => upperEnd(match) > 80)) add({ rule: 'over_80_percent_1rm', matched: clip(sentence) });
    if (anyMatch(RIR_PATTERNS, sentence, (match) => lowerEnd(match) < 3)) add({ rule: 'rir_below_3', matched: clip(sentence) });
  }
  if (early) for (const hit of maxOrFailureHits(value)) add(hit);
  return hits;
}

/** One step's breaches, across the scanned fields. */
export function stepSafetyHits(step: Pick<DetailedStep, (typeof SCANNED_FIELDS)[number]>, weekNumber: number): SafetyHit[] {
  const value = SCANNED_FIELDS.map((field) => step[field] ?? '')
    .filter(Boolean)
    .join('\n');
  return textSafetyHits(value, weekNumber);
}

export interface SafetyLogLine {
  goalId: string | null;
  week: number;
  attempt: number;
  rule: SafetyRule;
  step: string;
  matched: string;
  outcome: 'retry' | 'failed';
}

/** PSL-1 (3): one line per hit, so the false-alarm rate can be checked in production. */
export function logSafetyHit(line: SafetyLogLine): void {
  console.warn('[Safety]', JSON.stringify(line));
}
