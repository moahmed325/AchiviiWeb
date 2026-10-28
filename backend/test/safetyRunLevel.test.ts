import { describe, it, expect } from 'vitest';
import { runLevelOf } from '../src/lib/safety/targetSteps.js';
import { loadGoalFor } from '../src/lib/safety/stepLoad.js';
import type { WeekTarget } from '../src/lib/ai/roadmap.js';

// Plan safety limits M3.1 (PSL-19): what they already run in one go, read from the roadmap's starting point.

const target = (metric: string, unit: string, direction: 'higher_is_better' | 'lower_is_better' = 'higher_is_better'): WeekTarget => ({
  kind: 'number',
  metric,
  value: 10,
  unit,
  direction,
});

describe('runLevelOf', () => {
  it('reads a running distance in km, miles counted as km', () => {
    expect(runLevelOf(target('Longest continuous run', 'km'), 8)).toEqual({ km: 8 });
    expect(runLevelOf(target('Longest run', 'miles'), 5)?.km).toBeCloseTo(8.05, 2);
  });

  it('reads continuous running minutes and a race time in minutes', () => {
    expect(runLevelOf(target('Continuous running', 'minutes'), 40)).toEqual({ minutes: 40 });
    expect(runLevelOf(target('10K time', 'min', 'lower_is_better'), 55, { run10k: true })).toEqual({ minutes: 55 });
    expect(runLevelOf(target('Half marathon run time', 'hours', 'lower_is_better'), 2)).toEqual({ minutes: 120 });
  });

  it('gives nothing for a pace, another family, another sport or no starting point', () => {
    expect(runLevelOf(target('Run pace', 'min/km', 'lower_is_better'), 6)).toBeNull();
    expect(runLevelOf(target('Squat', 'kg'), 80)).toBeNull();
    expect(runLevelOf(target('Cycling distance', 'km'), 40)).toBeNull();
    expect(runLevelOf(target('Longest run', 'km'), null)).toBeNull();
    expect(runLevelOf(target('Longest run', 'km'), 0)).toBeNull();
    expect(runLevelOf({ kind: 'deliverable', description: 'A finished race' }, 5)).toBeNull();
  });

  it('loadGoalFor carries it on a running goal only', () => {
    const goal = { rawGoal: 'Run a half marathon', clarifiedOutcome: 'Run a half marathon' };
    expect(loadGoalFor(goal, target('Longest run', 'km'), 12)).toEqual({ running: true, runLevel: { km: 12 } });
    expect(loadGoalFor(goal, target('Longest run', 'km'))).toEqual({ running: true });
    expect(loadGoalFor({ rawGoal: 'Squat 100 kg', clarifiedOutcome: 'Squat 100 kg' }, target('Squat', 'kg'), 80)).toEqual({ running: false });
  });
});
