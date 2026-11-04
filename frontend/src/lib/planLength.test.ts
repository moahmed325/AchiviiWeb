import { describe, expect, it } from 'vitest';
import { closingStartDay, planDays, planLengthLabel, planWeeks, weeksBefore } from './planLength';
import { dayNumber } from './today';
import { journeyHeadline } from './nextPlan';
import type { JourneyResult } from '../types';

// B-109: the app reads a goal's own plan length, as the server works it out (`backend/src/lib/planLength.ts`).
describe('plan length', () => {
  it('a goal without totalWeeks, or with one out of range, is a 12-week plan, exactly as before', () => {
    for (const goal of [{}, { totalWeeks: 3 }, { totalWeeks: 13 }, null]) {
      expect(planWeeks(goal)).toBe(12);
      expect(planLengthLabel(goal)).toBe('90-day');
      expect(closingStartDay(goal)).toBe(85);
    }
  });

  it('a 7-week plan', () => {
    const goal = { totalWeeks: 7 };
    expect(planWeeks(goal)).toBe(7);
    expect(planLengthLabel(goal)).toBe('7-week');
    expect(closingStartDay(goal)).toBe(50);
  });

  it('the plan\'s days: the span from start to end when it fits the weeks, else the usual length', () => {
    const start = '2026-10-28T00:00:00.000Z';
    expect(planDays({ startDate: start, targetDate: '2027-01-26T00:00:00.000Z' })).toBe(90);
    expect(planDays({ startDate: start, targetDate: '2027-01-21T00:00:00.000Z' })).toBe(85);
    expect(planDays({ startDate: start, targetDate: '2026-12-15T00:00:00.000Z', totalWeeks: 6 })).toBe(48);
    // A span that doesn't fit (a test double's dates): the usual length.
    expect(planDays({ startDate: start, targetDate: '2027-06-01T00:00:00.000Z' })).toBe(90);
    expect(planDays({ totalWeeks: 6 })).toBe(42);
  });

  it('weeksBefore counts whole weeks to the day before the date, as the server does', () => {
    expect(weeksBefore('2026-10-28', '2026-11-24')).toBe(3);
    expect(weeksBefore('2026-10-28', '2026-11-25')).toBe(4);
    expect(weeksBefore('2026-10-28', '2027-06-01')).toBe(12);
  });

  it('the day number counts down from a shorter plan\'s own days', () => {
    const goal = { startDate: '2026-10-28T00:00:00.000Z', targetDate: '2026-12-15T00:00:00.000Z', totalWeeks: 6 };
    expect(dayNumber(goal, new Date('2026-10-28T10:00:00Z'), 'UTC')).toBe(1);
    expect(dayNumber(goal, new Date('2026-12-14T10:00:00Z'), 'UTC')).toBe(48);
    expect(dayNumber({ targetDate: '2027-01-26T00:00:00.000Z' }, new Date('2027-01-25T10:00:00Z'), 'UTC')).toBe(90);
  });
});

describe('the copy on a shorter plan', () => {
  it("the end screen counts a shorter plan's weeks", () => {
    const result = { kind: 'other', weeksFinished: 5, totalWeeks: 6, sessionsDone: 0, sessionsPlanned: 0 } as JourneyResult;
    expect(journeyHeadline(result)).toBe('You finished 5 of 6 weeks.');
    expect(journeyHeadline({ ...result, totalWeeks: undefined })).toBe('You finished 5 of 12 weeks.');
  });
});
