import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal } from '../types';
import { firstStepShareText, isFirstStep } from './firstStep';

const day = (id: string, extra: Partial<DailyTask> = {}) => ({ id, status: 'pending', isRestDay: false, ...extra }) as DailyTask;
const goal = (dailyTasks: DailyTask[], currentWeek = 1) => ({ currentWeek, dailyTasks }) as Pick<Goal, 'currentWeek' | 'dailyTasks'>;

describe('isFirstStep', () => {
  it('is the first practice day of week 1 while no other practice day is done', () => {
    const today = day('t2');
    expect(isFirstStep(goal([day('t1'), today]), today)).toBe(true);
    // A logged rest day doesn't count as a practice step.
    expect(isFirstStep(goal([day('t1', { isRestDay: true, status: 'completed' }), today]), today)).toBe(true);
    // It stays the first step once it is done itself.
    const done = day('t2', { status: 'completed' });
    expect(isFirstStep(goal([day('t1'), done]), done)).toBe(true);
  });

  it('is not a rest day, a later week, or a day after another practice day is done', () => {
    const today = day('t2');
    expect(isFirstStep(goal([day('t1', { status: 'completed' }), today]), today)).toBe(false);
    expect(isFirstStep(goal([today], 2), today)).toBe(false);
    const rest = day('t3', { isRestDay: true });
    expect(isFirstStep(goal([rest]), rest)).toBe(false);
    expect(isFirstStep(goal([]), null)).toBe(false);
  });
});

it('writes the share line from the goal and the day', () => {
  expect(firstStepShareText('  Run a 10K ', 1)).toBe('Day 1 of 90 done: Run a 10K. One step a day.');
});
