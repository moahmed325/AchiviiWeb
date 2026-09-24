import { describe, expect, it } from 'vitest';
import type { DailyTask, Goal } from '../types';
import {
  currentRoadmapWeek,
  currentWeekTasks,
  dayNumber,
  isToday,
  parseIntention,
  parseSteps,
  selectTodayTask,
  todayKey,
  weekProgress,
} from './today';

const task = (overrides: Partial<DailyTask>): DailyTask =>
  ({
    id: 't',
    goalId: 'g',
    weekNumber: 1,
    dayNumber: 1,
    date: '2026-09-21',
    dayOfWeek: 'Monday',
    title: 'Session',
    detailedSteps: '[]',
    implementationIntention: '',
    durationMinutes: 30,
    isRestDay: false,
    status: 'pending',
    created_at: '2026-09-21',
    ...overrides,
  }) as DailyTask;

const week = [
  task({ id: 'mon', dayNumber: 1, date: '2026-09-21', status: 'completed' }),
  task({ id: 'tue', dayNumber: 2, date: '2026-09-22', status: 'completed' }),
  task({ id: 'wed', dayNumber: 3, date: '2026-09-23' }),
  task({ id: 'thu', dayNumber: 4, date: '2026-09-24' }),
  task({ id: 'sun', dayNumber: 7, date: '2026-09-27', isRestDay: true }),
];

describe('currentWeekTasks', () => {
  it('keeps the current week only, in day order', () => {
    const goal = {
      currentWeek: 2,
      dailyTasks: [task({ id: 'b', weekNumber: 2, dayNumber: 9 }), task({ id: 'x', weekNumber: 1 }), task({ id: 'a', weekNumber: 2, dayNumber: 8 })],
    } as Goal;
    expect(currentWeekTasks(goal).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('treats a missing week as week 1 and missing tasks as none', () => {
    expect(currentWeekTasks({ currentWeek: 0, dailyTasks: [task({ id: 'x' })] } as Goal).map((t) => t.id)).toEqual(['x']);
    expect(currentWeekTasks({ currentWeek: 1 } as Goal)).toEqual([]);
  });
});

describe('selectTodayTask', () => {
  const wednesdayNoon = new Date('2026-09-23T12:00:00Z');

  it('prefers the chosen task, then today, then the first pending, then the first', () => {
    expect(selectTodayTask(week, wednesdayNoon, 'thu')?.id).toBe('thu');
    expect(selectTodayTask(week, wednesdayNoon, 'gone')?.id).toBe('wed');
    expect(selectTodayTask(week, wednesdayNoon)?.id).toBe('wed');
    expect(selectTodayTask(week, new Date('2026-10-30T12:00:00Z'))?.id).toBe('wed');
    const allDone = week.map((t) => ({ ...t, status: 'completed' as const }));
    expect(selectTodayTask(allDone, new Date('2026-10-30T12:00:00Z'))?.id).toBe('mon');
    expect(selectTodayTask([], wednesdayNoon)).toBeNull();
  });

  // Task dates are UTC dates (backend routes/goal.ts:215, :691; lib/ai/weekPlan.ts:52), so the UTC date decides.
  it('uses the UTC date at the day boundary, the calendar the task dates are written in', () => {
    // 00:30 on Thursday in UTC+3 is still Wednesday 21:30 UTC.
    const halfPastMidnightUtcPlus3 = new Date('2026-09-23T21:30:00Z');
    expect(todayKey(halfPastMidnightUtcPlus3)).toBe('2026-09-23');
    expect(selectTodayTask(week, halfPastMidnightUtcPlus3)?.id).toBe('wed');
    // 23:30 on Wednesday in UTC-5 is already Thursday 04:30 UTC.
    const lateEveningUtcMinus5 = new Date('2026-09-24T04:30:00Z');
    expect(selectTodayTask(week, lateEveningUtcMinus5)?.id).toBe('thu');
    expect(isToday(week[3], lateEveningUtcMinus5)).toBe(true);
  });
});

describe('dayNumber', () => {
  const goal = { targetDate: '2026-12-22T00:00:00.000Z' } as Goal;

  it('counts down from 90 to the target date and clamps to 1–90', () => {
    expect(dayNumber(goal, new Date('2026-06-01T00:00:00Z'))).toBe(1); // before the start
    expect(dayNumber(goal, new Date('2026-09-23T00:00:00Z'))).toBe(1); // 90 days out
    expect(dayNumber(goal, new Date('2026-09-25T00:00:00Z'))).toBe(3);
    expect(dayNumber(goal, new Date('2026-12-21T00:00:00Z'))).toBe(90); // the last day
    expect(dayNumber(goal, new Date('2027-02-01T00:00:00Z'))).toBe(90); // after the target date
  });
});

describe('parseSteps and parseIntention', () => {
  it('returns no steps for missing, broken or non-list JSON', () => {
    expect(parseSteps(undefined)).toEqual([]);
    expect(parseSteps('{not json')).toEqual([]);
    expect(parseSteps('{"stepNumber":1}')).toEqual([]);
    expect(parseSteps('[{"stepNumber":1,"title":"Warm up"}]')).toEqual([{ stepNumber: 1, title: 'Warm up' }]);
  });

  it('splits when, where and action, or keeps the raw text', () => {
    expect(parseIntention('When: 7am | Where: park | Action: run')).toEqual({ when: '7am', where: 'park', action: 'run' });
    expect(parseIntention('Run after work')).toEqual({ raw: 'Run after work' });
    expect(parseIntention('')).toBeNull();
  });
});

describe('currentRoadmapWeek and weekProgress', () => {
  it('finds the current roadmap week, else the first', () => {
    const weeks = [{ weekNumber: 1, phase: 'Base' }, { weekNumber: 2, phase: 'Build' }] as Goal['roadmapWeeks'];
    expect(currentRoadmapWeek({ currentWeek: 2, roadmapWeeks: weeks } as Goal)?.phase).toBe('Build');
    expect(currentRoadmapWeek({ currentWeek: 9, roadmapWeeks: weeks } as Goal)?.phase).toBe('Base');
    expect(currentRoadmapWeek({ currentWeek: 1 } as Goal)).toBeUndefined();
  });

  it('counts practice days only', () => {
    expect(weekProgress(week)).toEqual({ practiceDays: 4, practiceDone: 2 });
  });
});
