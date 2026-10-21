import { describe, expect, it } from 'vitest';
import { checkWeeklyUpdate, sentenceReason, type WeeklyUpdateInput } from '../../src/lib/ai/weeklyUpdate.js';
import { aboveSafeMaxOf, directionOf, holdsFromPrompt } from './facts.js';
import { agreementOf, median, reasonCheck, rejectionOf, scoreRun, splitReasons, statusWords, type CaseFacts, type Expected } from './score.js';

const km = (value: number) => ({ kind: 'number' as const, metric: 'Weekly running distance', value, unit: 'km', direction: 'higher_is_better' as const });

function input(overrides: Partial<WeeklyUpdateInput> = {}): WeeklyUpdateInput {
  return {
    finalGoal: 'Run 30 km a week',
    method: { name: 'Base building', rules: ['Add at most 10% a week'] },
    weekNumber: 10,
    target: km(26),
    lightTest: false,
    lightTestGoal: false,
    result: 'not logged',
    testLogged: false,
    lowerBound: 24,
    counts: { practiceDone: 5, practicePlanned: 5, detail: null },
    reflection: '',
    history: [],
    weeksLeft: [
      { weekNumber: 11, target: km(28), light: false },
      { weekNumber: 12, target: km(30), light: false },
    ],
    safeMax: { weekNumber: 11, value: 28.6 },
    ...overrides,
  };
}

/** The product's own reasons for an answer, so the grouping is tested against the real wording. */
function reasonsFor(raw: Record<string, unknown>, overrides: Partial<WeeklyUpdateInput> = {}): string[] {
  const verdict = checkWeeklyUpdate(raw, input(overrides));
  return 'reasons' in verdict ? verdict.reasons : [];
}

describe('reasonCheck', () => {
  it('groups every RULE-4 reason the product writes', () => {
    const good = { weekNumber: 11, kind: 'number', metric: 'Weekly running distance', value: 26, unit: 'km' };
    const week12 = { weekNumber: 12, kind: 'number', metric: 'Weekly running distance', value: 30, unit: 'km' };
    const msg = 'Next week holds at 26 km.';
    expect(reasonsFor({ status: 'nope', nextTargets: [good, week12], messageToUser: msg }).map(reasonCheck)).toEqual(['status']);
    expect(reasonsFor({ status: 'on_track', nextTargets: [good], messageToUser: msg }).map(reasonCheck)).toContain('count');
    expect(reasonsFor({ status: 'on_track', nextTargets: [{ ...good, unit: 'miles' }, week12], messageToUser: msg }).map(reasonCheck)).toEqual(['kind_metric_unit']);
    expect(reasonsFor({ status: 'on_track', nextTargets: [good, week12], messageToUser: 'You missed it.' }).map(reasonCheck)).toEqual(['sentence']);
    expect(reasonsFor({ status: 'on_track', nextTargets: [{ ...good, value: 20 }, week12], messageToUser: msg }).map(reasonCheck)).toContain('below_last_result');
    expect(reasonsFor({ status: 'on_track', nextTargets: [{ ...good, value: 31 }, week12], messageToUser: msg }).map(reasonCheck)).toEqual(
      expect.arrayContaining(['above_week12', 'backwards', 'not_logged_hold'])
    );
    expect(reasonsFor({ status: 'on_track', nextTargets: [good, { ...week12, value: 29 }], messageToUser: msg }).map(reasonCheck)).toEqual(['week12_changed']);
    expect(reasonsFor({ status: 'far_behind', nextTargets: [{ ...good, value: 25 }, week12], messageToUser: msg }, { testLogged: true, lowerBound: null }).map(reasonCheck)).toEqual([
      'far_behind_hold',
    ]);
  });

  it('names the week-behind hold and the deliverable hold', () => {
    expect(reasonCheck("week 6's target must not be higher than this week's (2 songs) because they are a week behind in new piece or section.")).toBe('week_behind_hold');
    expect(reasonCheck("week 6's target must not be higher than this week's (2 songs) because the test was not logged and they are a week behind in x.")).toBe(
      'not_logged_and_week_behind_hold'
    );
    expect(reasonCheck('week 4 must repeat this week\'s target exactly ("A") because the status is far_behind.')).toBe('deliverable_hold');
    expect(reasonCheck('no_answer')).toBe('no_answer');
    expect(reasonCheck('something new')).toBe('other');
  });
});

describe('splitReasons and rejectionOf', () => {
  const prompt = 'THE PLAN\n...\n\nYOUR PREVIOUS ANSWER WAS REJECTED: a. b.\nReturn the complete JSON again with that problem fixed.';

  it('reads the first attempt\'s rejection from the retry prompt', () => {
    expect(rejectionOf(['THE PLAN', prompt])).toBe('a. b.');
    expect(rejectionOf(['THE PLAN'])).toBeNull();
  });

  it('splits on the shortest prefix that joins to the rejection', () => {
    expect(splitReasons(['a.', 'b.', 'c.'], 'a. b.')).toEqual({ first: ['a.', 'b.'], retry: ['c.'] });
    expect(splitReasons(['no_answer', 'x.'], 'busy')).toEqual({ first: ['no_answer'], retry: ['x.'] });
    expect(splitReasons([], null)).toEqual({ first: [], retry: [] });
  });
});

describe('statusWords', () => {
  it('finds status names and words that mean failed', () => {
    expect(statusWords('You are on track; next week holds.')).toEqual(['on track']);
    expect(statusWords('You fell short this week, and are a bit behind.')).toEqual(['fell short', 'a bit behind']);
    expect(statusWords('Next week aims at 26 km, a safe step.')).toEqual([]);
  });
});

describe('facts helpers', () => {
  it('reads the direction of next week against this week', () => {
    expect(directionOf(km(26), km(28))).toBe('raise');
    expect(directionOf(km(26), km(26))).toBe('hold');
    expect(directionOf({ ...km(56), direction: 'lower_is_better' }, { ...km(55), direction: 'lower_is_better' })).toBe('raise');
    expect(directionOf({ kind: 'deliverable', description: 'A' }, { kind: 'deliverable', description: 'A' })).toBe('hold');
    expect(directionOf({ kind: 'deliverable', description: 'A' }, { kind: 'deliverable', description: 'B' })).toBe('raise');
  });

  it('reads the holds in force from the prompt the product sent', async () => {
    const { buildWeeklyUpdatePrompt } = await import('../../src/lib/ai/weeklyUpdate.js');
    const notLogged = buildWeeklyUpdatePrompt(input());
    expect(holdsFromPrompt(notLogged, 'on_track')).toEqual(['not_logged']);
    expect(holdsFromPrompt(notLogged, 'far_behind')).toEqual(['far_behind', 'not_logged']);
    const behind = buildWeeklyUpdatePrompt(input({ testLogged: true, kinds: [{ name: 'new material', position: 'Lesson 3', stepsBehind: 3, sessions: 3, weekBehind: true }] }));
    expect(holdsFromPrompt(behind, 'on_track')).toEqual(['week_behind']);
    // WU-15: closing week 11, no hold at all.
    const last = buildWeeklyUpdatePrompt(input({ weekNumber: 11, weeksLeft: [{ weekNumber: 12, target: km(30), light: false }] }));
    expect(holdsFromPrompt(last, 'far_behind')).toEqual([]);
  });

  it('checks the first asked week against safeMax in each answer', async () => {
    const { buildWeeklyUpdatePrompt } = await import('../../src/lib/ai/weeklyUpdate.js');
    const prompt = buildWeeklyUpdatePrompt(input());
    const answer = (value: number) => JSON.stringify({ nextTargets: [{ weekNumber: 11, value }, { weekNumber: 12, value: 30 }] });
    const calls = [
      { prompt, answer: answer(29), status: 200, ms: 1 },
      { prompt, answer: answer(28), status: 200, ms: 1 },
      { prompt, answer: null, status: 503, ms: 1 },
    ];
    expect(aboveSafeMaxOf(calls, 'higher_is_better')).toEqual([true, false]);
    expect(aboveSafeMaxOf(calls, null)).toEqual([]);
  });
});

const facts = (overrides: Partial<CaseFacts> = {}): CaseFacts => ({
  caseId: 'a',
  goalId: 'g',
  outcome: 'accepted',
  status: 'on_track',
  insight: 'Next week holds at 26 km.',
  reasonsFirst: [],
  reasonsRetry: [],
  direction: 'hold',
  vsPlan: 'below_plan',
  holds: ['not_logged'],
  lowered: [],
  week12Kept: true,
  aboveSafeMax: [false],
  climbBreaks: [],
  detailNull: false,
  standInMisses: 0,
  ms: 1000,
  retryMs: 0,
  ...overrides,
});
const expected = (overrides: Partial<Expected> = {}): Expected => ({ caseId: 'a', status: 'on_track', direction: 'hold', holds: ['not_logged'], lower: [], week12Final: true, ...overrides });

describe('agreementOf', () => {
  it('agrees field by field; a lowering agrees when every expected week was lowered', () => {
    expect(agreementOf(facts(), expected())).toEqual({ caseId: 'a', status: true, direction: true, holds: true, lowering: true, week12: true });
    const lowered = facts({ lowered: [{ week: 11, model: 30, safe: 28.6 }, { week: 12, model: 30, safe: 29 }], week12Kept: false });
    expect(agreementOf(lowered, expected({ lower: [12], week12Final: false }))).toMatchObject({ lowering: true, week12: true });
    expect(agreementOf(lowered, expected())).toMatchObject({ lowering: false, week12: false });
    expect(agreementOf(facts({ status: null, holds: [] }), expected())).toMatchObject({ status: false, holds: false });
  });
});

describe('scoreRun', () => {
  it('counts outcomes, ranks reasons, and flags wording, safety, stand-in and time', () => {
    const list = [
      facts(),
      facts({ caseId: 'b', outcome: 'retry_accepted', reasonsFirst: ['"messageToUser" uses the word "missed"; never "missed", "behind", "failed" or "fail".'], ms: 3000, retryMs: 1500, insight: 'You are on track.' }),
      facts({ caseId: 'c', outcome: 'fallback', status: null, reasonsFirst: ['no_answer'], reasonsRetry: ['no_answer'], detailNull: true, ms: 2000, climbBreaks: [9], aboveSafeMax: [true] }),
    ];
    const score = scoreRun(list, [expected(), expected({ caseId: 'b' }), expected({ caseId: 'c' })], [{ caseId: 'a', run: 1, matchesTarget: true, namesKind: null }], sentenceReason);
    expect(score.outcomes).toEqual({ accepted: 1, retry_accepted: 1, fallback: 1, did_not_run: 0 });
    expect(score.reasons.first).toEqual([
      { key: 'no_answer', count: 1 },
      { key: 'sentence', count: 1 },
    ]);
    expect(score.reasons.retry).toEqual([{ key: 'no_answer', count: 1 }]);
    expect(score.wording.statusWords).toEqual([{ caseId: 'b', words: ['on track'] }]);
    expect(score.wording.sentenceFails).toEqual([]);
    expect(score.safety.climbBreaks).toEqual([{ caseId: 'c', weeks: [9] }]);
    expect(score.safety.aboveSafeMax).toEqual({ answers: 3, above: 1 });
    expect(score.standIn.detailNull).toEqual(['c']);
    expect(score.agreement).toMatchObject({ status: 2, of: 3 });
    expect(score.time).toMatchObject({ medianMs: 2000, slowestMs: 3000, slowestCase: 'b', retryCases: 2 });
    expect(score.time.retryTimeShare).toBeCloseTo(1500 / 6000);
  });

  it('takes the median of an even list', () => {
    expect(median([1, 4, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
