import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';
import { logRoadmapTargets, nextSafeStep, safeTargetClimb, targetFamily } from '../src/lib/safety/targetSteps.js';
import * as limits from '../src/lib/safety/limits.js';
import { SAFETY_LIMIT_TEXT } from '../src/lib/ai/safetyScan.js';

// Plan safety limits M1.2 (RULE-1, RULE-2, PSL-6, PSL-10, PSL-11): one limits module, the target families, the next
// safe step, and the climb lowered to safe steps.

type Direction = 'higher_is_better' | 'lower_is_better';
const number = (metric: string, unit: string, direction: Direction, value = 1): WeekTarget => ({ kind: 'number', metric, value, unit, direction });
const series = (metric: string, unit: string, direction: Direction, values: number[]): WeekTarget[] =>
  values.map((value) => number(metric, unit, direction, value));
const valuesOf = (targets: WeekTarget[]) => targets.map((target) => (target.kind === 'number' ? target.value : NaN));

afterEach(() => vi.restoreAllMocks());

describe('the limits module (RULE-1)', () => {
  it('holds every number in the table', () => {
    expect(limits).toMatchObject({
      RUN_DISTANCE_STEP_PERCENT: 10,
      RUN_DISTANCE_STEP_MIN_KM: 1,
      RUN_DURATION_STEP_MIN_MINUTES: 10,
      RUN_TIME_STEP_PERCENT: 2,
      LIFT_STEP_PERCENT: 5,
      LIFT_STEP_MIN_KG: 2.5,
      BODY_WEIGHT_LOSS_STEP_PERCENT: 1,
      BODY_WEIGHT_GAIN_STEP_PERCENT: 0.5,
      BODY_FAT_STEP_POINTS: 0.5,
      CALORIE_DEFICIT_MIN: 250,
      CALORIE_DEFICIT_MAX: 600,
      DAILY_INTAKE_MIN_KCAL: 1200,
      RUNNING_TOTAL_STEP_PERCENT: 10,
      RUNNING_TOTAL_STEP_MIN_MINUTES: 10,
      RUNNING_TOTAL_STEP_MIN_KM: 1,
      LONGEST_RUN_MAX_PERCENT: 50,
      HARD_RUNS_MAX: 2,
      EARLY_WEEKS: 3,
      EARLY_WEEK_MAX_1RM_PERCENT: 80,
      EARLY_WEEK_MIN_RIR: 3,
      BASE_WEEK_DONE_PERCENT: 70,
    });
  });

  it('is what the text scan states (no behaviour change)', () => {
    expect(SAFETY_LIMIT_TEXT.deficit_over_600).toBe('a calorie deficit of 250 to 600 kcal a day, never more');
    expect(SAFETY_LIMIT_TEXT.over_80_percent_1rm).toBe('in weeks 1 to 3, no lift above 80% of 1RM');
    expect(SAFETY_LIMIT_TEXT.rir_below_3).toBe('in weeks 1 to 3, at least 3 reps in reserve');
  });
});

describe('target families (section 3, PSL-10)', () => {
  it.each([
    ['10K time', 'minutes', 'lower_is_better', 'running_time'],
    ['5 km time', 'min', 'lower_is_better', 'running_time'],
    ['Pace', 'min/km', 'lower_is_better', 'running_time'],
    ['Pace', 'min/mile', 'lower_is_better', 'running_time'],
    ['Longest continuous run', 'km', 'higher_is_better', 'running_distance'],
    ['Weekly mileage', 'miles', 'higher_is_better', 'running_distance'],
    ['Continuous running', 'minutes', 'higher_is_better', 'running_distance'],
    ['Squat', 'kg for 5', 'higher_is_better', 'lift_load'],
    ['Bench press', 'lb', 'higher_is_better', 'lift_load'],
    ['Body weight', 'kg', 'lower_is_better', 'body_weight'],
    ['Body weight', 'lb', 'higher_is_better', 'body_weight'],
    ['Body fat', 'percent', 'lower_is_better', 'body_fat'],
    ['Body fat', '%', 'lower_is_better', 'body_fat'],
    ['Daily calorie deficit', 'kcal', 'higher_is_better', 'calorie_deficit'],
  ] as const)('%s in %s (%s) is %s', (metric, unit, direction, family) => {
    expect(targetFamily(number(metric, unit, direction))).toBe(family);
  });

  it.each([
    ['Waist', 'cm', 'lower_is_better'],
    ['Weight lost', 'kg', 'higher_is_better'],
    ['Squat percent of 1RM', '%', 'higher_is_better'],
    ['Bench RIR', 'rir', 'lower_is_better'],
    ['Typing speed', 'words per minute', 'higher_is_better'],
    ['Plank hold', 'minutes', 'higher_is_better'],
    ['Time', 'minutes', 'lower_is_better'],
    ['Cycling distance', 'km', 'higher_is_better'],
  ] as const)('%s in %s (%s) has no family', (metric, unit, direction) => {
    expect(targetFamily(number(metric, unit, direction))).toBeNull();
  });

  it('a time or minutes target counts as running on run10k, not elsewhere (PSL-10 (3))', () => {
    expect(targetFamily(number('Time', 'minutes', 'lower_is_better'), { run10k: true })).toBe('running_time');
    expect(targetFamily(number('Time', 'minutes', 'higher_is_better'), { run10k: true })).toBe('running_distance');
    expect(targetFamily(number('Time', 'minutes', 'lower_is_better'))).toBeNull();
  });

  it('a deliverable has no family', () => {
    expect(targetFamily({ kind: 'deliverable', description: 'Run 10 km' })).toBeNull();
  });
});

describe('nextSafeStep (RULE-2, AC-11)', () => {
  it.each([
    ['running distance, the 1 km allowance', number('Long run', 'km', 'higher_is_better'), 5, 6],
    ['running distance, 10%', number('Long run', 'km', 'higher_is_better'), 20, 22],
    ['running distance in miles, the allowance converted', number('Weekly mileage', 'miles', 'higher_is_better'), 3, 3.6],
    ['running distance in metres', number('Long run', 'm', 'higher_is_better'), 3000, 4000],
    ['continuous running minutes, +10 minutes', number('Continuous running', 'minutes', 'higher_is_better'), 20, 30],
    ['continuous running minutes, 10%', number('Continuous running', 'minutes', 'higher_is_better'), 150, 165],
    ['running time, 2% faster', number('10K time', 'minutes', 'lower_is_better'), 70, 68.6],
    ['pace, rounded toward slower', number('Pace', 'min/km', 'lower_is_better'), 6, 5.9],
    ['lift load, the 2.5 kg allowance', number('Squat', 'kg', 'higher_is_better'), 40, 42.5],
    ['lift load, 5%', number('Squat', 'kg', 'higher_is_better'), 100, 105],
    ['lift load in lb, the allowance converted', number('Bench press', 'lb', 'higher_is_better'), 100, 105.5],
    ['body weight loss, 1%', number('Body weight', 'kg', 'lower_is_better'), 80, 79.2],
    ['body weight gain, 0.5%', number('Body weight', 'kg', 'higher_is_better'), 60, 60.3],
    ['body fat down, 0.5 points', number('Body fat', 'percent', 'lower_is_better'), 28, 27.5],
    ['body fat up, 0.5 points', number('Body fat', 'percent', 'higher_is_better'), 15, 15.5],
    ['calorie deficit, the range top', number('Daily calorie deficit', 'kcal', 'higher_is_better'), 300, 600],
  ])('%s', (_name, target, previous, expected) => {
    expect(nextSafeStep(target, previous)).toBe(expected);
  });

  it('is null for a target with no family', () => {
    expect(nextSafeStep(number('Typing speed', 'words per minute', 'higher_is_better'), 20)).toBeNull();
    expect(nextSafeStep(number('Waist', 'cm', 'lower_is_better'), 90)).toBeNull();
    expect(nextSafeStep({ kind: 'deliverable', description: 'A loaf' }, 1)).toBeNull();
  });
});

describe('safeTargetClimb (RULE-2)', () => {
  // One step past the limit is lowered; at the limit it is left alone. Both directions where a direction applies.
  it.each([
    ['running distance', 'Long run', 'km', 'higher_is_better', 5, 6, 6.1],
    ['running time', '10K time', 'minutes', 'lower_is_better', 70, 68.6, 68.5],
    ['lift load', 'Squat', 'kg', 'higher_is_better', 100, 105, 105.1],
    ['body weight loss', 'Body weight', 'kg', 'lower_is_better', 80, 79.2, 79.1],
    ['body weight gain', 'Body weight', 'kg', 'higher_is_better', 60, 60.3, 60.4],
    ['body fat down', 'Body fat', 'percent', 'lower_is_better', 28, 27.5, 27.4],
    ['body fat up', 'Body fat', 'percent', 'higher_is_better', 15, 15.5, 15.6],
    ['calorie deficit', 'Daily calorie deficit', 'kcal', 'higher_is_better', 300, 600, 601],
  ] as const)('%s: at the limit kept, one step past lowered', (_name, metric, unit, direction, start, atLimit, past) => {
    const kept = safeTargetClimb([number(metric, unit, direction, atLimit)], start);
    expect(valuesOf(kept.targets)).toEqual([atLimit]);
    expect(kept.lowered).toEqual([]);
    const lowered = safeTargetClimb([number(metric, unit, direction, past)], start);
    expect(valuesOf(lowered.targets)).toEqual([atLimit]);
    expect(lowered.lowered).toEqual([{ week: 1, model: past, safe: atLimit }]);
  });

  it('re-checks the following weeks from the lowered value', () => {
    const climb = safeTargetClimb(series('Long run', 'km', 'higher_is_better', [7, 8, 9, 9]), 5);
    expect(valuesOf(climb.targets)).toEqual([6, 7, 8, 9]);
    expect(climb.lowered).toEqual([
      { week: 1, model: 7, safe: 6 },
      { week: 2, model: 8, safe: 7 },
      { week: 3, model: 9, safe: 8 },
    ]);
  });

  it('never changes a target that gets easier', () => {
    const climb = safeTargetClimb(series('10K time', 'minutes', 'lower_is_better', [69, 69, 69.5]), 70);
    expect(valuesOf(climb.targets)).toEqual([69, 69, 69.5]);
    expect(climb.lowered).toEqual([]);
  });

  it('holds a deficit to the range: above 600 lowered to 600, below 250 left alone (PSL-6)', () => {
    const climb = safeTargetClimb(series('Daily calorie deficit', 'kcal', 'higher_is_better', [200, 500, 700, 650]), 100);
    expect(valuesOf(climb.targets)).toEqual([200, 500, 600, 600]);
    expect(climb.lowered.map((item) => item.week)).toEqual([3, 4]);
  });

  it('with no starting point, skips week 1 and checks from week 2 (PSL-11 Q14)', () => {
    const climb = safeTargetClimb(series('Long run', 'km', 'higher_is_better', [9, 12, 13]), null);
    expect(climb.noStart).toBe(true);
    expect(valuesOf(climb.targets)).toEqual([9, 10, 11]);
    expect(climb.lowered.map((item) => item.week)).toEqual([2, 3]);
  });

  it('leaves a target with no family as it is', () => {
    const targets = series('Typing speed', 'words per minute', 'higher_is_better', [20, 40, 60]);
    const climb = safeTargetClimb(targets, 10);
    expect(climb).toMatchObject({ family: null, lowered: [], noStart: false });
    expect(valuesOf(climb.targets)).toEqual([20, 40, 60]);
  });

  it('does not change the targets it was given', () => {
    const targets = series('Long run', 'km', 'higher_is_better', [9]);
    safeTargetClimb(targets, 5);
    expect(valuesOf(targets)).toEqual([9]);
  });
});

describe('logRoadmapTargets (RULE-10, AC-10)', () => {
  const lines = () =>
    vi.mocked(console.warn).mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string));

  it('logs one line per lowered target with the goal id', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRoadmapTargets('goal-1', {
      startingPoint: { value: 5 },
      weeks: [{ target: number('Long run', 'km', 'higher_is_better', 6) }],
      loweredTargets: [
        { week: 1, model: 7, safe: 6 },
        { week: 2, model: 8, safe: 7 },
      ],
    });
    expect(lines()).toEqual([
      expect.objectContaining({ goalId: 'goal-1', week: 1, rule: 'target_step', model: 7, safe: 6, outcome: 'lowered' }),
      expect.objectContaining({ goalId: 'goal-1', week: 2, rule: 'target_step', model: 8, safe: 7, outcome: 'lowered' }),
    ]);
  });

  it('logs unknown_family once for a physical target no family reads, never for a typing goal', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRoadmapTargets('goal-2', { startingPoint: { value: 95 }, weeks: [{ target: number('Waist', 'cm', 'lower_is_better', 94) }, { target: number('Waist', 'cm', 'lower_is_better', 93) }] });
    logRoadmapTargets('goal-3', { startingPoint: { value: 14 }, weeks: [{ target: number('Typing speed', 'wpm', 'higher_is_better', 16) }] });
    expect(lines()).toEqual([expect.objectContaining({ goalId: 'goal-2', rule: 'unknown_family', outcome: 'logged' })]);
  });

  it('logs no_start when a family target has no starting point', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    logRoadmapTargets('goal-4', { startingPoint: { value: null }, weeks: [{ target: number('10K time', 'minutes', 'lower_is_better', 65) }] });
    expect(lines()).toEqual([expect.objectContaining({ goalId: 'goal-4', week: 1, rule: 'no_start', outcome: 'logged' })]);
  });
});
