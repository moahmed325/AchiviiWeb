import { describe, expect, it } from 'vitest';
import { comingUp, formatMetric } from './plan';
import type { Goal } from '../types';

describe('formatMetric (ND-31)', () => {
  it('shows a time in minutes as minutes and seconds', () => {
    expect(formatMetric(54.6667, 'min')).toBe('54:40');
    expect(formatMetric(50, 'minutes')).toBe('50:00');
    expect(formatMetric(0.5, 'min')).toBe('0:30');
  });

  it('rounds anything else and keeps its unit', () => {
    expect(formatMetric(42.456, 'wpm')).toBe('42.46 wpm');
    expect(formatMetric(12, '')).toBe('12');
  });
});

describe('comingUp (ND-33)', () => {
  const goal = {
    targetDate: '2026-12-22T00:00:00.000Z',
    currentWeek: 6,
    roadmap: {
      phases: [
        { name: 'Foundation', startWeek: 1, endWeek: 4 },
        { name: 'Acceleration', startWeek: 5, endWeek: 8 },
        { name: 'Mastery', startWeek: 9, endWeek: 12 },
      ],
    },
    dailyTasks: [{ weekNumber: 6, date: '2026-11-02', isTestDay: true }],
  } as unknown as Goal;

  it('the next phase and the finish line, and no weekly check even on an old stored test day (ND-35)', () => {
    const items = comingUp(goal);
    expect(items.map((item) => item.kind)).toEqual(['phase', 'finish']);
    expect(items[0]).toMatchObject({ title: 'Mastery begins', when: 'in 3 weeks' });
    expect(items[1]).toMatchObject({ title: 'Finish line', detail: 'The last day of week 12' });
  });
});
