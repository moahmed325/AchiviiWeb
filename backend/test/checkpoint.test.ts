import { describe, it, expect } from 'vitest';
import { formatTarget, keyMilestoneText, measuredPathwayTest, pathwayFor, type WeekTarget } from '../src/lib/ai/roadmap.js';
import {
  acceptedWeeks,
  checkpointFor,
  expireOpen,
  openCheckpoint,
  readCheckpoints,
  roundEasier,
  spreadIsSafe,
  type CheckInput,
  type NumberTarget,
  type StoredCheckpoint,
} from '../src/lib/weekClose/checkpoint.js';
import { CHECKPOINT_BEHIND_PERCENT, CHECKPOINT_FLAT_PLAN_PERCENT } from '../src/lib/safety/limits.js';

// Checkpoints M1 (RULE-3 to RULE-6, RULE-9, RULE-10, CP-15, CP-16, AC-3, AC-4, AC-8): the pure check, its rounding, the
// spread after an accepted offer and the stored list.

const num = (metric: string, unit: string, value: number, direction: NumberTarget['direction'] = 'higher_is_better'): NumberTarget => ({ kind: 'number', metric, value, unit, direction });
const km = (value: number) => num('Weekly running distance', 'km', value);
const check = (over: Partial<CheckInput>) => checkpointFor({ target: km(10), start: 0, planned: 2, day90: 10, fullGoal: 10, result: 2, week: 4, weeksDone: 4, ...over });

describe('the limit numbers (RULE-4, CP-15)', () => {
  it('are kept with the limit numbers', () => {
    expect(CHECKPOINT_BEHIND_PERCENT).toBe(75);
    expect(CHECKPOINT_FLAT_PLAN_PERCENT).toBe(10);
  });
});

describe('AC-3: the worked examples', () => {
  it('start 0, week-4 target 2, week 12 10 km: a result of 2 is on track', () => {
    expect(check({ result: 2 })).toMatchObject({ outcome: 'on_track', forecast: 10, share: 1, offered: null });
  });

  it('a result of 1.2 is an offer of 6 km', () => {
    expect(check({ result: 1.2 })).toEqual({ outcome: 'lower', reason: null, forecast: 6, share: 0.6, offered: 6 });
  });

  it('start 3, week-4 target 5, a result of 4 is an offer of 6.5 km', () => {
    expect(check({ start: 3, planned: 5, result: 4 })).toEqual({ outcome: 'lower', reason: null, forecast: 6.5, share: 0.5, offered: 6.5 });
  });
});

describe('RULE-3, RULE-4: both directions', () => {
  it('a lower-is-better running time: more is faster, the offer rounds up to a whole minute', () => {
    const time = num('5 km run time', 'min', 25, 'lower_is_better');
    const result = check({ target: time, start: 30, planned: 28.5, day90: 25, fullGoal: 25, result: 29.5 });
    expect(result.outcome).toBe('lower');
    expect(result.share).toBeCloseTo(1 / 3, 5);
    expect(result.forecast).toBeCloseTo(28.333, 2);
    expect(result.offered).toBe(29);
  });

  it('body weight, losing: the offer rounds up to 0.5 kg', () => {
    const weight = num('Body weight', 'kg', 80, 'lower_is_better');
    expect(check({ target: weight, start: 90, planned: 88, day90: 80, fullGoal: 80, result: 89.5 })).toEqual({ outcome: 'lower', reason: null, forecast: 87.5, share: 0.25, offered: 87.5 });
  });

  it('a lower-is-better result at or past the day-90 target is on track', () => {
    const time = num('5 km run time', 'min', 25, 'lower_is_better');
    expect(check({ target: time, start: 30, planned: 28.5, day90: 25, fullGoal: 25, result: 24.5 }).outcome).toBe('on_track');
  });

  it('a plan whose week 12 is not beyond the starting point has none', () => {
    expect(check({ start: 10, day90: 10 })).toMatchObject({ outcome: 'none', reason: 'no_climb' });
    expect(check({ start: 12, day90: 10 })).toMatchObject({ outcome: 'none', reason: 'no_climb' });
  });
});

describe('RULE-3: the flat start and the safe climb', () => {
  it('a plan nearly flat by week 4 uses the straight line, not the share', () => {
    // Planned progress 0.5 of a 10 km climb is under 10%: the share (1.6) would say on track.
    expect(check({ planned: 0.5, result: 0.8 })).toMatchObject({ outcome: 'lower', forecast: 2.4, offered: 2 });
  });

  it('jumped weeks are left out of weeks done', () => {
    expect(check({ planned: 0.5, result: 0.8, weeksDone: 2 })).toMatchObject({ outcome: 'lower', forecast: 4, offered: 4 });
  });

  it('the forecast is never past the safe climb from the result, one safe step a week left', () => {
    // On plan (share 1) toward 20 km, but 8 safe steps from 7 km reach only 16 km, 73% of the climb.
    expect(check({ start: 5, planned: 7, day90: 20, fullGoal: 20, result: 7 })).toMatchObject({ outcome: 'lower', forecast: 16, offered: 16 });
  });

  it('a target with no family has no safe-climb cap', () => {
    const reps = num('Push-ups in a row', 'reps', 40);
    expect(check({ target: reps, start: 5, planned: 10, day90: 40, fullGoal: 40, result: 10 }).outcome).toBe('on_track');
  });
});

describe('RULE-5, RULE-6: the offered target', () => {
  it('a result at or behind the starting point is line only', () => {
    expect(check({ start: 3, planned: 5, result: 2.5 })).toMatchObject({ outcome: 'line_only', offered: null });
    expect(check({ start: 3, planned: 5, result: 3 })).toMatchObject({ outcome: 'line_only', offered: null });
  });

  it('never lands on the wrong side of the result', () => {
    // The forecast 10.2 rounds easier to 10, below the result 10.1, so the offer is the result rounded harder (11).
    const reps = num('Push-ups in a row', 'reps', 12);
    expect(check({ target: reps, start: 10, planned: 11, day90: 12, fullGoal: 12, result: 10.1 })).toMatchObject({ outcome: 'lower', offered: 11 });
  });

  it('no lower offer when the offered target is not easier than the day-90 target', () => {
    const reps = num('Push-ups in a row', 'reps', 11);
    expect(check({ target: reps, start: 10, planned: 10.5, day90: 11, fullGoal: 11, result: 10.1 })).toMatchObject({ outcome: 'none', reason: 'not_easier', offered: null });
  });

  it.each([
    ['km', km(0), 7.3, 7],
    ['miles', num('Weekly running distance', 'mi', 0), 4.7, 4.5],
    ['metres', num('Swim distance', 'm', 0), 1550, 1500],
    ['minutes, higher', num('Continuous running minutes', 'min', 0), 27.6, 27],
    ['minutes, lower', num('5 km run time', 'min', 0, 'lower_is_better'), 27.2, 28],
    ['seconds, lower', num('400 m run time', 's', 0, 'lower_is_better'), 62, 65],
    ['hours', num('Deep work', 'hours', 0), 3.4, 3.25],
    ['kg on a lift', num('Squat 1RM', 'kg', 0), 61, 60],
    ['lb on a lift', num('Squat 1RM', 'lb', 0), 133, 130],
    ['body weight kg, losing', num('Body weight', 'kg', 0, 'lower_is_better'), 81.2, 81.5],
    ['body weight lb, losing', num('Body weight', 'lb', 0, 'lower_is_better'), 180.4, 181],
    ['body fat', num('Body fat', '%', 0, 'lower_is_better'), 18.2, 18.5],
    ['kcal', num('Daily calorie deficit', 'kcal', 0), 430, 400],
    ['anything else, 10 or more', num('Pages read', 'pages', 0), 12.7, 12],
    ['anything else, under 10', num('Pages read', 'pages', 0), 7.7, 7.5],
  ])('rounds easier to the step: %s', (_name, target, value, rounded) => {
    expect(roundEasier(value, target)).toBe(rounded);
  });
});

describe('RULE-10 (CP-16): the raise check at week 8', () => {
  const week8 = (over: Partial<CheckInput>) => check({ week: 8, weeksDone: 8, start: 0, planned: 4.5, day90: 7, fullGoal: 10, raiseCheck: true, ...over });

  it('a partial raise to the rounded forecast', () => {
    expect(week8({ result: 6 })).toMatchObject({ outcome: 'raise', offered: 9 });
  });

  it('a raise up to the full goal, never past it', () => {
    expect(week8({ result: 7 })).toMatchObject({ outcome: 'raise', offered: 10 });
  });

  it('no raise when the spread weeks fail the safe climb; then RULE-6 against the lowered target', () => {
    expect(week8({ result: 7, raiseIsSafe: () => false })).toMatchObject({ outcome: 'on_track', offered: null });
  });

  it('no raise unless it is at least one step harder than the day-90 target', () => {
    // Forecast 7.16 rounds to 7.0, not 7.5 or more.
    expect(week8({ result: 4.6 })).toMatchObject({ outcome: 'on_track' });
  });

  it('without a week-4 lower, a result past the day-90 target is only on track', () => {
    expect(week8({ result: 7, raiseCheck: false })).toMatchObject({ outcome: 'on_track' });
  });

  it('behind again after a lower: one more lower offer against the lowered target', () => {
    expect(week8({ result: 2 })).toMatchObject({ outcome: 'lower' });
  });
});

describe('RULE-9: the weeks after an accepted offer', () => {
  type Row = { weekNumber: number; target: WeekTarget; test: Record<string, unknown>; objective: string; keyMilestone: string; status: string; jumped: boolean };
  const runTest = (target: WeekTarget) => ({ type: 'run', instructions: 'Run the weekly distance', passIf: formatTarget(target) });
  function rows(values: number[], open: number, testFor: (week: number, target: WeekTarget) => Record<string, unknown> = (_w, t) => runTest(t), target = km): Row[] {
    return values.map((value, index) => {
      const weekNumber = index + 1;
      const t = target(value);
      const test = testFor(weekNumber, t);
      return { weekNumber, target: t, test, objective: formatTarget(t), keyMilestone: keyMilestoneText(test as never), status: weekNumber < open ? 'completed' : weekNumber === open ? 'active' : 'pending', jumped: false };
    });
  }
  const valuesOf = (changed: Row[]) => Object.fromEntries(changed.map((week) => [week.weekNumber, (week.target as NumberTarget).value]));

  it('a lower: week 12 takes the offer, the weeks between spread evenly and rounded easier, the open week unchanged', () => {
    const plan = acceptedWeeks(rows([0.5, 1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), 5, 6, 'lower', null)!;
    expect(valuesOf(plan.weeks)).toEqual({ 6: 3, 7: 3.5, 8: 4, 9: 4.5, 10: 5, 11: 5.5, 12: 6 });
    expect(plan.weeks.find((w) => w.weekNumber === 12)).toMatchObject({ objective: 'Weekly running distance: 6 km', test: { passIf: 'Weekly running distance: 6 km' } });
    expect(plan.finalTest).toBeNull();
  });

  it('a lower never makes a week harder than it was', () => {
    const plan = acceptedWeeks(rows([1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 12], 5), 5, 9, 'lower', null)!;
    expect(valuesOf(plan.weeks)).toEqual({ 12: 9 });
  });

  it('a raise never makes a week easier than it was', () => {
    const plan = acceptedWeeks(rows([1, 2, 3, 4, 4.5, 5, 5.5, 6, 6, 8, 6.5, 7], 9), 9, 9, 'raise', null)!;
    // Week 10 keeps 8 (the spread's 7 would be easier); week 11 takes 8.
    expect(valuesOf(plan.weeks)).toEqual({ 11: 8, 12: 9 });
  });

  it('a raise passes the safe climb only when reading the weeks back lowers nothing', () => {
    const before = rows([1, 2, 3, 4, 4.5, 5, 5.5, 6, 6, 6.5, 7, 7], 9);
    const safe = acceptedWeeks(before, 9, 9, 'raise', null)!;
    expect(valuesOf(safe.weeks)).toEqual({ 10: 7, 11: 8, 12: 9 });
    expect(spreadIsSafe(before, safe.weeks, 0, '', null)).toBe(true);
    const tooFar = acceptedWeeks(before, 9, 12, 'raise', null)!;
    expect(spreadIsSafe(before, tooFar.weeks, 0, '', null)).toBe(false);
  });

  describe('a light-test pathway goal (run10k)', () => {
    const run10k = pathwayFor('Run a 10k', null)!;
    const tests = run10k.weeklyTests!;
    const distance = (value: number): WeekTarget => num('Continuous run distance', 'km', value);
    const big = (week: number) => [4, 8, 12].includes(week);
    const light = { type: 'timer', instructions: tests.light.instructions, passIf: 'Done as written', light: true };
    const testFor = (week: number, target: WeekTarget) => (big(week) ? measuredPathwayTest(tests, target) : light);

    it('a lower sets only the big weeks; the light weeks after show week 12; week 12 and finalTest take the preset test', () => {
      // Weeks 1 to 4 show 4 km, 5 to 8 show 6 km, 9 to 12 show 10 km; week 5 is open.
      const before = rows([4, 4, 4, 4, 6, 6, 6, 6, 10, 10, 10, 10], 5, testFor, distance);
      const plan = acceptedWeeks(before, 5, 8, 'lower', run10k)!;
      expect(valuesOf(plan.weeks)).toEqual({ 9: 8, 10: 8, 11: 8, 12: 8 });
      expect(plan.weeks.find((w) => w.weekNumber === 12)!.test).toEqual(measuredPathwayTest(tests, distance(8)));
      expect(plan.finalTest).toBe(measuredPathwayTest(tests, distance(8)).instructions);
      // A light week keeps its light test.
      expect(plan.weeks.find((w) => w.weekNumber === 9)!.test).toEqual(light);
    });

    it('a raise after week 8: the open light week shows the new week 12, its test unchanged', () => {
      const before = rows([4, 4, 4, 4, 6, 6, 6, 6, 8, 8, 8, 8], 9, testFor, distance);
      const plan = acceptedWeeks(before, 9, 10, 'raise', run10k)!;
      expect(valuesOf(plan.weeks)).toEqual({ 9: 10, 10: 10, 11: 10, 12: 10 });
      expect(plan.weeks.find((w) => w.weekNumber === 9)!.test).toEqual(light);
      expect(plan.finalTest).toBe(measuredPathwayTest(tests, distance(10)).instructions);
    });
  });
});

describe('section 7, RULE-8: the stored list', () => {
  const entry = (over: Partial<StoredCheckpoint> = {}): StoredCheckpoint => ({
    week: 4, kind: 'lower', result: 1.2, planned: 2, forecast: 6, target: 10, fullGoal: 10, offered: 6, answer: null, by: null, answeredAt: null, ...over,
  });

  it('a missing list means none', () => {
    expect(readCheckpoints(null)).toEqual([]);
    expect(readCheckpoints({})).toEqual([]);
    expect(readCheckpoints({ checkpoints: 'x' })).toEqual([]);
  });

  it('an open offer expires as keep, by expired; an answered one stays', () => {
    const now = new Date('2026-10-26T10:00:00Z');
    const answered = entry({ answer: 'accept', by: 'person', answeredAt: '2026-10-20T10:00:00.000Z' });
    const { list, expired } = expireOpen([answered, entry({ week: 8 })], now);
    expect(list).toEqual([answered, entry({ week: 8, answer: 'keep', by: 'expired', answeredAt: now.toISOString() })]);
    expect(expired).toEqual([list[1]]);
    expect(openCheckpoint(list)).toBeNull();
  });
});
