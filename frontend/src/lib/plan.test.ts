import { describe, expect, it } from 'vitest';
import { formatMetric, shortTarget, stairSteps } from './plan';
import type { RoadmapWeek } from '../types';

describe('formatMetric and shortTarget (ND-31)', () => {
  it('shows a time in minutes as minutes and seconds', () => {
    expect(formatMetric(54.6667, 'min')).toBe('54:40');
    expect(formatMetric(50, 'minutes')).toBe('50:00');
    expect(formatMetric(0.5, 'min')).toBe('0:30');
  });

  it('rounds anything else and keeps its unit', () => {
    expect(formatMetric(42.456, 'wpm')).toBe('42.46 wpm');
    expect(formatMetric(12, '')).toBe('12');
  });

  it('says which way a target points', () => {
    expect(shortTarget({ kind: 'number', metric: '10K time', value: 54.5, unit: 'min', direction: 'lower_is_better' })).toBe('54:30 or less');
    expect(shortTarget({ kind: 'number', metric: 'Push-ups', value: 40, unit: 'reps', direction: 'higher_is_better' })).toBe('40 reps or more');
    expect(shortTarget({ kind: 'deliverable', description: 'A one-page brief' })).toBe('A one-page brief');
  });

  it('the staircase takes the number targets in week order and skips the rest', () => {
    const week = (weekNumber: number, target: RoadmapWeek['target']) => ({ weekNumber, target }) as RoadmapWeek;
    const steps = stairSteps({
      roadmapWeeks: [week(2, { kind: 'number', metric: 'm', value: 9, unit: 'u', direction: 'higher_is_better' }), week(1, { kind: 'number', metric: 'm', value: 8, unit: 'u', direction: 'higher_is_better' }), week(3, { kind: 'deliverable', description: 'x' })],
    });
    expect(steps).toEqual([{ weekNumber: 1, target: 8 }, { weekNumber: 2, target: 9 }]);
  });
});
