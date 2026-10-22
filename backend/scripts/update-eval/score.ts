/**
 * Weekly update M3.2: pure scoring of the recorded runs. Everything here works on plain facts (`CaseFacts`, built from
 * a run file by `facts.ts`), so the review can re-score the saved runs without a model call or a database.
 */

export type Direction = 'raise' | 'hold' | 'lower';
export type Hold = 'far_behind' | 'not_logged' | 'week_behind';
export type Outcome = 'accepted' | 'retry_accepted' | 'fallback' | 'did_not_run';

/** One case of one run, as the scoring reads it. */
export interface CaseFacts {
  caseId: string;
  goalId: string;
  outcome: Outcome;
  status: string | null;
  insight: string;
  /** Reasons the first attempt was rejected for, then the retry's (empty when there was none). */
  reasonsFirst: string[];
  reasonsRetry: string[];
  /** Next week's target as the goal shows it after the update, against this week's as shown. */
  direction: Direction | null;
  /** Next week's target against the plan as read before the update. */
  vsPlan: 'above_plan' | 'as_planned' | 'below_plan' | null;
  /** The holds in force: code's (from the prompt it sent) and far_behind when the status set it. */
  holds: Hold[];
  /** M3.2b (WU-48): the holds a fallback kept, from the log line; missing in runs 1 and 2. */
  fallbackHeld?: Hold[];
  /** Weeks code lowered (safety), with the model's and the safe value. */
  lowered: Array<{ week: number; model: number; safe: number }>;
  /** Week 12 after the update equals week 12 as planned before it. */
  week12Kept: boolean;
  /** Per answer that had a readable target for the first asked week: was it past `safeMax`. */
  aboveSafeMax: boolean[];
  /** Weeks a read of the goal as saved would show differently from what the update returned (a climb past a safe step). */
  climbBreaks: number[];
  /** `countsOf` fell back to the sessions count ("not counted" in the prompt). */
  detailNull: boolean;
  /** Stand-in calls it could not answer. */
  standInMisses: number;
  ms: number;
  /** Time spent in calls of the retry attempt. */
  retryMs: number;
}

export interface Expected {
  caseId: string;
  status: 'on_track' | 'a_bit_behind' | 'far_behind';
  direction: Direction;
  /** Every hold that must apply; empty for none. */
  holds: Hold[];
  /** Weeks code must lower; empty for none. */
  lower: number[];
  /** Week 12 must stay the final goal (false only where WU-23 lowers it). */
  week12Final: boolean;
}

export interface WordingTag {
  caseId: string;
  run: number;
  /** The sentence matches what happened to next week's target (says held when held, lowered when lowered). */
  matchesTarget: boolean;
  /** For a week-behind hold: the sentence names the kind; null when there is no such hold. */
  namesKind: boolean | null;
  note?: string;
}

/** The check a rejection reason comes from (RULE-4's list, the sentence, and the no-answer reasons). */
export function reasonCheck(reason: string): string {
  if (reason === 'no_answer' || reason === 'unreadable_targets' || reason === 'error') return reason;
  if (reason.startsWith('"status" must be')) return 'status';
  if (reason.startsWith('"nextTargets" must have exactly')) return 'count';
  if (reason.startsWith('"nextTargets" could not be read')) return 'unreadable';
  if (/kind changed|metric changed|unit changed|description is empty|value is not a number/.test(reason)) return 'kind_metric_unit';
  if (/^"messageToUser" says "[^"]+", but next week's target (goes up|stays)/.test(reason)) return 'held_or_raised';
  if (reason.startsWith('"messageToUser"')) return 'sentence';
  if (/easier than what they last achieved/.test(reason)) return 'below_last_result';
  if (/easier than the week before it/.test(reason)) return 'backwards';
  if (/is harder than week 12/.test(reason)) return 'above_week12';
  if (/^week 12 must stay/.test(reason)) return 'week12_changed';
  if (/the status is far_behind, so week/.test(reason)) return 'far_behind_hold';
  if (/must repeat this week's target exactly/.test(reason)) return 'deliverable_hold';
  if (/must not be higher than this week's/.test(reason)) {
    const notLogged = reason.includes('the test was not logged');
    const behind = reason.includes('a week behind');
    return notLogged && behind ? 'not_logged_and_week_behind_hold' : notLogged ? 'not_logged_hold' : 'week_behind_hold';
  }
  return 'other';
}

/**
 * Splits the update's `reasons` into the first attempt's and the retry's. The retry prompt carries the first attempt's
 * rejection as the reasons joined by a space, so the first attempt's are the shortest prefix that joins to it.
 */
export function splitReasons(reasons: readonly string[], rejection: string | null): { first: string[]; retry: string[] } {
  if (rejection === null) return { first: [...reasons], retry: [] };
  if (reasons[0] === 'no_answer') return { first: ['no_answer'], retry: reasons.slice(1) };
  for (let k = 1; k <= reasons.length; k++) {
    if (reasons.slice(0, k).join(' ') === rejection) return { first: reasons.slice(0, k), retry: reasons.slice(k) };
  }
  return { first: [...reasons], retry: [] };
}

/** The rejection text the retry prompt carries, or null when there was no retry. */
export function rejectionOf(prompts: readonly string[]): string | null {
  for (const prompt of prompts) {
    const match = prompt.match(/YOUR PREVIOUS ANSWER WAS REJECTED: ([\s\S]*?)\nReturn the complete JSON again/);
    if (match) return match[1];
  }
  return null;
}

/** RULE-3: words in the sentence that name a status or mean "failed" (beyond `sentenceReason`'s forbidden words). */
const STATUS_WORDS =
  /\b(on[ _]track|a[ _]bit[ _]behind|far[ _]behind|behind|off[ _]track|fail(?:ed|s|ing|ure)?|miss(?:ed|es|ing)?|fell short|falling short|short of|didn'?t (?:make|reach|hit)|did not (?:make|reach|hit)|unsuccessful|lagging|slipp(?:ed|ing))\b/gi;

export function statusWords(sentence: string): string[] {
  return [...sentence.matchAll(STATUS_WORDS)].map((match) => match[0].toLowerCase());
}

export function countBy<T>(items: readonly T[], key: (item: T) => string): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const sameSet = <T>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((item) => b.includes(item));

export interface Agreement {
  caseId: string;
  status: boolean;
  direction: boolean;
  holds: boolean;
  lowering: boolean;
  week12: boolean;
}

/** One case against its expected answer. Lowering agrees when both lower nothing, or every expected week was lowered. */
export function agreementOf(facts: CaseFacts, expected: Expected): Agreement {
  const loweredWeeks = facts.lowered.map((item) => item.week);
  const lowering = expected.lower.length === 0 ? loweredWeeks.length === 0 : expected.lower.every((week) => loweredWeeks.includes(week));
  return {
    caseId: facts.caseId,
    status: facts.status === expected.status,
    direction: facts.direction === expected.direction,
    holds: sameSet(facts.holds, expected.holds),
    lowering,
    week12: facts.week12Kept === expected.week12Final,
  };
}

export interface RunScore {
  cases: number;
  outcomes: Record<Outcome, number>;
  reasons: { first: Array<{ key: string; count: number }>; retry: Array<{ key: string; count: number }> };
  safety: {
    loweredCases: Array<{ caseId: string; goalId: string; weeks: number[] }>;
    /** M3.2b (WU-48): fallbacks that kept a hold. */
    fallbackHolds: Array<{ caseId: string; holds: Hold[] }>;
    aboveSafeMax: { answers: number; above: number };
    climbBreaks: Array<{ caseId: string; weeks: number[] }>;
    week12NotKept: string[];
  };
  wording: {
    sentenceFails: Array<{ caseId: string; reason: string }>;
    statusWords: Array<{ caseId: string; words: string[] }>;
    tagged: number;
    matchesTarget: number;
    weekBehindHolds: number;
    namesKind: number;
  };
  agreement: {
    status: number;
    direction: number;
    holds: number;
    lowering: number;
    week12: number;
    of: number;
    disagreements: Array<{ caseId: string; fields: string[] }>;
  };
  standIn: { detailNull: string[]; misses: number };
  time: { medianMs: number | null; slowestMs: number | null; slowestCase: string | null; retryCases: number; retryTimeShare: number };
}

/**
 * One run, or several together (the facts of every run in one list). `sentenceReason` is passed in, so the scoring uses
 * the product's own check without importing it.
 */
export function scoreRun(
  facts: readonly CaseFacts[],
  expected: readonly Expected[],
  tags: readonly WordingTag[],
  sentenceReason: (sentence: string) => string | null
): RunScore {
  const outcomes: Record<Outcome, number> = { accepted: 0, retry_accepted: 0, fallback: 0, did_not_run: 0 };
  for (const item of facts) outcomes[item.outcome]++;
  const answered = facts.filter((item) => item.outcome === 'accepted' || item.outcome === 'retry_accepted');

  const agreements = facts.flatMap((item) => {
    const answer = expected.find((row) => row.caseId === item.caseId);
    return answer ? [agreementOf(item, answer)] : [];
  });
  const fields = ['status', 'direction', 'holds', 'lowering', 'week12'] as const;
  const totalMs = facts.reduce((sum, item) => sum + item.ms, 0);
  const slowest = [...facts].sort((a, b) => b.ms - a.ms)[0];
  const behindHolds = answered.filter((item) => item.holds.includes('week_behind'));

  return {
    cases: facts.length,
    outcomes,
    reasons: {
      first: countBy(facts.flatMap((item) => item.reasonsFirst), reasonCheck),
      retry: countBy(facts.flatMap((item) => item.reasonsRetry), reasonCheck),
    },
    safety: {
      loweredCases: facts.filter((item) => item.lowered.length).map((item) => ({ caseId: item.caseId, goalId: item.goalId, weeks: item.lowered.map((row) => row.week) })),
      fallbackHolds: facts.filter((item) => item.fallbackHeld?.length).map((item) => ({ caseId: item.caseId, holds: item.fallbackHeld! })),
      aboveSafeMax: { answers: facts.reduce((sum, item) => sum + item.aboveSafeMax.length, 0), above: facts.reduce((sum, item) => sum + item.aboveSafeMax.filter(Boolean).length, 0) },
      climbBreaks: facts.filter((item) => item.climbBreaks.length).map((item) => ({ caseId: item.caseId, weeks: item.climbBreaks })),
      week12NotKept: facts.filter((item) => !item.week12Kept).map((item) => item.caseId),
    },
    wording: {
      sentenceFails: answered.flatMap((item) => {
        const reason = sentenceReason(item.insight);
        return reason ? [{ caseId: item.caseId, reason }] : [];
      }),
      statusWords: answered.flatMap((item) => {
        const words = statusWords(item.insight);
        return words.length ? [{ caseId: item.caseId, words }] : [];
      }),
      tagged: tags.length,
      matchesTarget: tags.filter((tag) => tag.matchesTarget).length,
      weekBehindHolds: behindHolds.length,
      namesKind: tags.filter((tag) => tag.namesKind === true).length,
    },
    agreement: {
      status: agreements.filter((row) => row.status).length,
      direction: agreements.filter((row) => row.direction).length,
      holds: agreements.filter((row) => row.holds).length,
      lowering: agreements.filter((row) => row.lowering).length,
      week12: agreements.filter((row) => row.week12).length,
      of: agreements.length,
      disagreements: agreements.flatMap((row) => {
        const wrong = fields.filter((field) => !row[field]);
        return wrong.length ? [{ caseId: row.caseId, fields: [...wrong] }] : [];
      }),
    },
    standIn: { detailNull: facts.filter((item) => item.detailNull).map((item) => item.caseId), misses: facts.reduce((sum, item) => sum + item.standInMisses, 0) },
    time: {
      medianMs: median(facts.map((item) => item.ms)),
      slowestMs: slowest?.ms ?? null,
      slowestCase: slowest?.caseId ?? null,
      retryCases: facts.filter((item) => item.reasonsFirst.length > 0 && item.outcome !== 'did_not_run').length,
      retryTimeShare: totalMs ? facts.reduce((sum, item) => sum + item.retryMs, 0) / totalMs : 0,
    },
  };
}
