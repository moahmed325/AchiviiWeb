import type { DetailedStep } from './goalDecomposer.js';
import type { WeekLoadRule } from '../safety/weekLoad.js';
import {
  CALORIE_DEFICIT_MAX,
  CALORIE_DEFICIT_MIN,
  EARLY_WEEK_MAX_1RM_PERCENT,
  EARLY_WEEK_MIN_RIR,
  EARLY_WEEKS,
} from '../safety/limits.js';

/**
 * B-63 (PSL-1, PSL-2): a narrow stopgap scan of high-load step text for clear breaches of the old safety limits,
 * until docs/features/plan-safety-limits lands. Patterns stay narrow: safe wording must never count.
 */
export type ScanRule = 'deficit_over_600' | 'over_80_percent_1rm' | 'rir_below_3' | 'to_failure' | 'max_test' | 'time_trial';

/**
 * Every `[Safety]` rule: the text scan's, plus plan-safety-limits M1.2's roadmap target rules (RULE-2, RULE-10):
 * `target_step` (a target lowered to the safe step), `unknown_family` (a number target no family reads, logged once per
 * goal) and `no_start` (no starting point, so week 1 is not checked). M2.1 (RULE-4): `load_missing`, a step that
 * needed its load kept without it on the week call's last attempt. M2.2a (RULE-5, RULE-10): a load number past a week
 * limit (`WeekLoadRule`, and the scan's own rules when read from a number), `no_base` (the base week's running isn't
 * known, so the running total is not checked) and `run_minutes_over_step` (a step's `runMinutes` above its minutes,
 * counted as written).
 */
export type SafetyRule = ScanRule | WeekLoadRule | 'target_step' | 'unknown_family' | 'no_start' | 'load_missing' | 'no_base' | 'run_minutes_over_step' | 'first_week_back_base';

/**
 * Weekly update M1.5b (WU-41): how a week is scanned. `light`: a first week back of a high-load goal, whose test is a
 * light version: the weeks 1 to 3 rules apply whatever the week number, and so does the time-trial rule, which applies
 * nowhere else. Without it the scan is exactly B-63's.
 */
export interface ScanOptions {
  light?: boolean;
}

export interface SafetyHit {
  rule: ScanRule;
  /** The sentence that matched, at most 120 characters. */
  matched: string;
}

/** Weeks 1 to 3 hold the early-week limits (PSL-2); from week 4 the method's own range applies. Defined in the limits module. */
export { EARLY_WEEKS };

export const SAFETY_LIMIT_TEXT: Record<ScanRule, string> = {
  deficit_over_600: `a calorie deficit of ${CALORIE_DEFICIT_MIN} to ${CALORIE_DEFICIT_MAX} kcal a day, never more`,
  over_80_percent_1rm: `in weeks 1 to 3, no lift above ${EARLY_WEEK_MAX_1RM_PERCENT}% of 1RM`,
  rir_below_3: `in weeks 1 to 3, at least ${EARLY_WEEK_MIN_RIR} reps in reserve`,
  to_failure: 'in weeks 1 to 3, nothing to failure',
  max_test: 'in weeks 1 to 3, no max or 1RM test',
  time_trial: 'in the first week back after a break, no time trial or all-out effort',
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
/** "800 kcal deficit", "500-700 kcal/day deficit", "a 700 calorie daily deficit", "an 800-calorie deficit". */
const DEFICIT_AFTER = new RegExp(
  String.raw`${KCAL_NUMBER}(?:${TO}${KCAL_NUMBER})?\s*-?\s*${KCAL_UNIT}(?:\s*(?:\/|a|per)\s*day)?(?:\s+daily)?\s+deficit`,
  'gi'
);
/** "deficit of 700 kcal", "deficit of about 500-700 calories", "Deficit: 750 kcal". */
const DEFICIT_BEFORE = new RegExp(
  String.raw`deficit\s*(?::\s*|=\s*|\s+of\s+|\s+)(?:about\s+|around\s+|roughly\s+|up\s+to\s+)?${KCAL_NUMBER}(?:${TO}${KCAL_NUMBER})?\s*${KCAL_UNIT}`,
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
  // "Week 1 RIR target: 3", "Set 2 RIR 3": a week, set or day number is not the reps in reserve.
  new RegExp(String.raw`(?<!\b(?:week|set|day|phase|round|block)\s+)\b${N}(?:${TO}${N})?\s*RIR\b`, 'gi'),
  new RegExp(String.raw`\b${N}(?:${TO}${N})?\s+reps?\s+in\s+(?:the\s+)?reserve`, 'gi'),
  new RegExp(String.raw`\b${N}(?:${TO}${N})?\s+reps?\s+(?:short\s+of|before|from|shy\s+of)\s+failure`, 'gi'),
];
const FAILURE = /\b(?:to|until|till)\s+(?:(?:momentary|muscular|technical|complete|total|absolute)\s+)?failure\b|\bAMRAP\b|\bas many reps as possible\b/i;
const MAX_TEST =
  /\b(?:1\s*-?\s*RM|one[\s-]rep[\s-]max)\s+test|\btest\s+(?:your|a|the)\s+(?:new\s+)?(?:1\s*-?\s*RM|one[\s-]rep[\s-]max|max\b(?!\s*(?:heart|hr\b|pace|speed|wpm|words|typing|score|cadence|distance|time|power|watts|vo2)))\b|\bmax(?:es|ed|ing)?\s+out\b|\bmax(?:imal|imum)?\s+single\b|\btrue\s+max\b/i;
/**
 * M1.5b (WU-41): a time trial, or an all-out effort over a distance ("all-out 3 km", "run 5K as fast as you can").
 * Narrow on purpose: "as fast as you can" alone (a sprint drill, typing) does not count without a distance.
 */
const TIME_TRIAL = /\btime[\s-]?trials?\b/i;
const ALL_OUT = /\ball[\s-]out\b|\bas\s+fast\s+as\s+(?:you\s+)?(?:can|possible)\b|\bflat[\s-]out\b/i;
const DISTANCE = /\b\d+(?:\.\d+)?\s*(?:k|km|kms|kilomet(?:er|re)s?|mi|miles?|m|meters?|metres?)\b/i;
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

/** How many words before a match a negation may stand: "never let any set go to failure". */
const NEGATION_WORDS = 5;

/**
 * Failure and max-test wording is safe when its own clause (between commas, semicolons or colons) negates it in the
 * few words before the match, or keeps 3+ reps in reserve. "No rest, last set to failure" still counts.
 */
function negated(sentence: string, matchIndex: number): boolean {
  const before = sentence.slice(0, matchIndex);
  const start = Math.max(before.lastIndexOf(','), before.lastIndexOf(';'), before.lastIndexOf(':')) + 1;
  const rest = sentence.slice(matchIndex);
  const endAt = rest.search(/[,;:]/);
  const clause = sentence.slice(start, endAt === -1 ? sentence.length : matchIndex + endAt);
  const lead = before.slice(start).trim().split(/\s+/).slice(-NEGATION_WORDS).join(' ');
  if (NEGATION.test(lead)) return true;
  const safe = SAFE_SHORT_OF_FAILURE.exec(clause);
  return safe !== null && (toNumber(safe[1]) ?? 0) >= EARLY_WEEK_MIN_RIR;
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

/** The early-week max-test and to-failure rules. */
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

/** M1.5b (WU-41): the time-trial rule, for a light week only. A negated clause ("no time trial this week") is safe. */
export function timeTrialHits(value: string): SafetyHit[] {
  for (const sentence of sentences(value)) {
    const trial = TIME_TRIAL.exec(sentence);
    if (trial && !negated(sentence, trial.index)) return [{ rule: 'time_trial', matched: clip(sentence) }];
    const allOut = ALL_OUT.exec(sentence);
    if (allOut && DISTANCE.test(sentence) && !negated(sentence, allOut.index)) return [{ rule: 'time_trial', matched: clip(sentence) }];
  }
  return [];
}

/** Every breach in one piece of text: one hit per rule, the first sentence that breaks it. */
export function textSafetyHits(value: string, weekNumber: number, options: ScanOptions = {}): SafetyHit[] {
  const hits: SafetyHit[] = [];
  const add = (hit: SafetyHit) => {
    if (!hits.some((item) => item.rule === hit.rule)) hits.push(hit);
  };
  const early = weekNumber <= EARLY_WEEKS || options.light === true;
  for (const sentence of sentences(value)) {
    if (anyMatch([DEFICIT_AFTER, DEFICIT_BEFORE], sentence, (match) => upperEnd(match) > CALORIE_DEFICIT_MAX)) {
      add({ rule: 'deficit_over_600', matched: clip(sentence) });
    }
    if (!early) continue;
    if (anyMatch([PERCENT_1RM], sentence, (match) => upperEnd(match) > EARLY_WEEK_MAX_1RM_PERCENT)) add({ rule: 'over_80_percent_1rm', matched: clip(sentence) });
    if (anyMatch(RIR_PATTERNS, sentence, (match) => lowerEnd(match) < EARLY_WEEK_MIN_RIR)) add({ rule: 'rir_below_3', matched: clip(sentence) });
  }
  if (early) for (const hit of maxOrFailureHits(value)) add(hit);
  if (options.light === true) for (const hit of timeTrialHits(value)) add(hit);
  return hits;
}

/** One step's breaches, across the scanned fields. */
export function stepSafetyHits(step: Pick<DetailedStep, (typeof SCANNED_FIELDS)[number]>, weekNumber: number, options: ScanOptions = {}): SafetyHit[] {
  const value = SCANNED_FIELDS.map((field) => step[field] ?? '')
    .filter(Boolean)
    .join('\n');
  return textSafetyHits(value, weekNumber, options);
}

export interface SafetyLogLine {
  goalId: string | null;
  week: number;
  /** The model call's attempt; left out of the roadmap target lines, which are logged once after goal create (M1.2). */
  attempt?: number;
  rule: SafetyRule;
  step: string;
  matched: string;
  /** `target_step` only: the model's target and the safe value it was lowered to. */
  model?: number;
  safe?: number;
  /** M2.2a: a load number's breach: the number and the limit it passed. */
  value?: number;
  limit?: number;
  /**
   * `test_text`: the sentence is the roadmap's own weekly test, which the week must run as written; logged, not refused.
   * `light_test` (M1.5b, WU-41): on the last attempt of a light week the test step was replaced by the fixed light step.
   * `lowered` (M1.2): a roadmap target was lowered to the safe step. `logged` (M1.2): told only, never refused
   * (`unknown_family`, `no_start`). `lowered_on_read` (M1.3, PSL-12 (2)): an older goal's target, lowered on read, in the
   * week being written; nothing stored changed. `kept` (M2.1, RULE-4): `load_missing` on the last attempt; the step is
   * kept without a load and B-63's scan decides. `counted` (M2.2a, PSL-15 (2)): `run_minutes_over_step` on the accepted
   * answer; the run is counted as written. `first_answer` (M2.2a follow-up): the last answer was refused for this rule,
   * and the first answer, checked again as a last attempt, passed every check and is the week.
   */
  outcome: 'retry' | 'failed' | 'test_text' | 'light_test' | 'lowered' | 'logged' | 'lowered_on_read' | 'kept' | 'counted' | 'first_answer';
}

/** PSL-1 (3): one line per hit, so the false-alarm rate can be checked in production. */
export function logSafetyHit(line: SafetyLogLine): void {
  console.warn('[Safety]', JSON.stringify(line));
}
