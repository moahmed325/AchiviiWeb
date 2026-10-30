import { describe, expect, it } from 'vitest';
import { comingUp, formatMetric, shortTarget } from './plan';
import type { Goal } from '../types';

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
});

describe('comingUp (ND-33)', () => {
  const goal = {
    targetDate: '2026-12-22T00:00:00.000Z',
    currentWeek: 6,
    roadmap: {
      finalTest: 'Run 10K on a flat course.',
      phases: [
        { name: 'Foundation', startWeek: 1, endWeek: 4 },
        { name: 'Acceleration', startWeek: 5, endWeek: 8 },
        { name: 'Mastery', startWeek: 9, endWeek: 12 },
      ],
    },
    roadmapWeeks: [{ weekNumber: 6, test: { type: 'timer', instructions: 'Run 10K hard.', passIf: 'Under' }, target: { kind: 'number', metric: '10K time', value: 55, unit: 'min', direction: 'lower_is_better' } }],
    dailyTasks: [{ weekNumber: 6, date: '2026-11-02', isTestDay: true }],
  } as unknown as Goal;

  it("this week's check, the next phase and the finish line, in that order", () => {
    const items = comingUp(goal, '2026-10-30');
    expect(items.map((item) => item.kind)).toEqual(['check', 'phase', 'finish']);
    expect(items[0]).toMatchObject({ title: 'Week 6 check', detail: '55:00 or less' });
    expect(items[1]).toMatchObject({ title: 'Mastery begins', when: 'in 3 weeks' });
    expect(items[2]).toMatchObject({ title: 'Finish line', detail: 'Run 10K on a flat course.' });
  });

  it('no check once its day has passed; "Today" on the day', () => {
    expect(comingUp(goal, '2026-11-03').map((item) => item.kind)).toEqual(['phase', 'finish']);
    expect(comingUp(goal, '2026-11-02')[0].when).toBe('Today');
  });
});
