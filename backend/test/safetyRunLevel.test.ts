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

  it('reads continuous running minutes', () => {
    expect(runLevelOf(target('Continuous running', 'minutes'), 40)).toEqual({ minutes: 40 });
    expect(runLevelOf(target('Longest non-stop run', 'hours'), 1.5)).toEqual({ minutes: 90 });
  });

  it('never reads a race time: the roadmap\'s cautious guess for a time is a larger number (code review)', () => {
    expect(runLevelOf(target('10K time', 'min', 'lower_is_better'), 75, { run10k: true })).toBeNull();
    expect(runLevelOf(target('Half marathon run time', 'hours', 'lower_is_better'), 2)).toBeNull();
  });

  it('never reads a week\'s running as one run, or a distance that names no single run (code review)', () => {
    expect(runLevelOf(target('Weekly mileage', 'km'), 25)).toBeNull();
    expect(runLevelOf(target('Weekly running minutes', 'minutes'), 120)).toBeNull();
    expect(runLevelOf(target('Total running distance', 'km'), 25)).toBeNull();
    expect(runLevelOf(target('Running distance', 'km'), 25)).toBeNull();
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
