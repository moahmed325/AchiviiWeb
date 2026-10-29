import { describe, expect, it } from 'vitest';
import { bigTestWeeks, closingStartDay, finalDayPhrase, finalWeekOf, nextCheckWeekOf, planDays, planLengthLabel, planWeeks, readyWeekOf, weeksBefore } from './planLength';
import { nextCheckLine, weekTargetText } from './lightTest';
import { dayNumber } from './today';
import { acceptedLine, checkpointCopy } from './checkpoint';
import { dayNinetyLineText, week12LineText, week12NoteText } from './week12Line';
import { journeyHeadline } from './nextPlan';
import type { Checkpoint, JourneyResult, WeekTarget } from '../types';

// B-109: the app reads a goal's own plan length, as the server works it out (`backend/src/lib/planLength.ts`).
describe('plan length', () => {
  it('a goal without totalWeeks, or with one out of range, is a 12-week plan, exactly as before', () => {
    for (const goal of [{}, { totalWeeks: 3 }, { totalWeeks: 13 }, null]) {
      expect(planWeeks(goal)).toBe(12);
      expect(finalWeekOf(goal)).toBe(12);
      expect(readyWeekOf(goal)).toBeNull();
      expect(bigTestWeeks(goal)).toEqual([4, 8, 12]);
      expect(planLengthLabel(goal)).toBe('90-day');
      expect(finalDayPhrase(goal)).toBe('day 90');
      expect(closingStartDay(goal)).toBe(85);
    }
  });

  it('a 7-week plan: the final test in week 6, week 7 ready, one big test', () => {
    const goal = { totalWeeks: 7 };
    expect([planWeeks(goal), finalWeekOf(goal), readyWeekOf(goal)]).toEqual([7, 6, 7]);
    expect(bigTestWeeks(goal)).toEqual([6]);
    expect(bigTestWeeks({ totalWeeks: 10 })).toEqual([5, 9]);
    expect([1, 6, 7].map((week) => nextCheckWeekOf(week, goal))).toEqual([6, 6, 6]);
    expect(planLengthLabel(goal)).toBe('7-week');
    expect(finalDayPhrase(goal)).toBe('the end of week 6');
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

const target: WeekTarget = { kind: 'number', metric: 'Practice test score', value: 70, unit: 'percent', direction: 'higher_is_better' };

describe('the copy on a shorter plan', () => {
  it('a light week names its next check; the ready week its final target', () => {
    expect(nextCheckLine(3, target)).toBe('Next check, week 4: Practice test score: 70 percent');
    expect(nextCheckLine(3, target, { totalWeeks: 7 })).toBe('Next check, week 6: Practice test score: 70 percent');
    expect(nextCheckLine(7, target, { totalWeeks: 7 })).toBe('Ready week, your final target: Practice test score: 70 percent');
    expect(weekTargetText(7, target, { type: 'quiz', instructions: 'x', passIf: 'Done as written', light: true }, undefined, { totalWeeks: 7 })).toBe(
      'Ready week, your final target: Practice test score: 70 percent'
    );
  });

  it('a checkpoint names the final week instead of day 90', () => {
    const card: Checkpoint = { week: 3, kind: 'lower', target: '70 percent', offered: '66 percent', goal: '70 percent', last: true, toFullGoal: false };
    expect(checkpointCopy(card).body).toBe("At this pace you'll reach about 66 percent by day 90. Your day-90 target is 70 percent.");
    expect(checkpointCopy({ ...card, finalWeek: 7 }).body).toBe("At this pace you'll reach about 66 percent by the end of week 7. Your final target is 70 percent.");
    expect(acceptedLine(card)).toBe('Your day-90 target is now 66 percent.');
    expect(acceptedLine({ ...card, finalWeek: 7 })).toBe('Your final target is now 66 percent.');
  });

  it('the honest line names the final week', () => {
    expect(week12LineText({ safe: '66 percent', goal: null })).toBe('Week 12 aims at 66 percent, a safe step.');
    expect(week12NoteText({ week12Line: { safe: '66 percent', goal: null }, dayNinetyLine: null, totalWeeks: 7 })).toBe('Week 6 aims at 66 percent, a safe step.');
    expect(dayNinetyLineText({ target: '66 percent', goal: '70 percent', finalWeek: 7 })).toBe('Final target: 66 percent. Your goal: 70 percent.');
  });

  it('the end screen counts a shorter plan\'s weeks', () => {
    const result = { kind: 'deliverable', weeksFinished: 5, totalWeeks: 6 } as JourneyResult;
    expect(journeyHeadline(result)).toBe('You finished 5 of 6 weeks.');
    expect(journeyHeadline({ ...result, totalWeeks: undefined })).toBe('You finished 5 of 12 weeks.');
  });
});
