import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';
import { targetFamily } from '../src/lib/safety/targetSteps.js';
import * as limits from '../src/lib/safety/limits.js';
import { SAFETY_LIMIT_TEXT } from '../src/lib/ai/safetyScan.js';

// Plan safety limits M1.2 (RULE-1, PSL-6, PSL-10): one limits module and the families that pick the week load limits.
// No weekly tests (2026-10-30): the safe target step and climb went with the targets.

type Direction = 'higher_is_better' | 'lower_is_better';
const number = (metric: string, unit: string, direction: Direction, value = 1): WeekTarget => ({ kind: 'number', metric, value, unit, direction });

afterEach(() => vi.restoreAllMocks());

describe('the limits module (RULE-1)', () => {
  it('holds every number in the table', () => {
    expect(limits).toMatchObject({
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
    ['Cycling 40 km time', 'minutes', 'lower_is_better'],
    ['Swim 5 km time', 'minutes', 'lower_is_better'],
    ['Bike ride', 'km', 'higher_is_better'],
    ['Rowing pace', 'min/km', 'lower_is_better'],
  ] as const)('%s in %s (%s) has no family', (metric, unit, direction) => {
    expect(targetFamily(number(metric, unit, direction))).toBeNull();
  });

  it('another sport is not running even on run10k; "5 km time" on run10k is running time (M1.2 review)', () => {
    expect(targetFamily(number('Cycling 40 km time', 'minutes', 'lower_is_better'), { run10k: true })).toBeNull();
    expect(targetFamily(number('Swim 5 km time', 'minutes', 'lower_is_better'), { run10k: true })).toBeNull();
    expect(targetFamily(number('5 km time', 'minutes', 'lower_is_better'), { run10k: true })).toBe('running_time');
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
