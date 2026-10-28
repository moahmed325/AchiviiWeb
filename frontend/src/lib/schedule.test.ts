import { describe, expect, it } from 'vitest';
import { defaultRestWeekdays, goalSchedule, validRestWeekdays, weekdayOf } from './schedule';

// Edit my schedule (B-108): the days mirrored from the server's weekLayout.
describe('schedule', () => {
  it('the variants\' own rest days follow the plan\'s start weekday, as the server places them', () => {
    // A Monday start: steady rests on plan days 4 and 7 (Thursday, Sunday).
    expect(defaultRestWeekdays('steady', 1)).toEqual([0, 4]);
    expect(defaultRestWeekdays('minimal', 1)).toEqual([0, 3, 5]);
    expect(defaultRestWeekdays('accelerated', 1)).toEqual([0]);
    // A Thursday start: days 4 and 7 are Sunday and Wednesday.
    expect(defaultRestWeekdays('steady', 4)).toEqual([0, 3]);
  });

  it('validRestWeekdays matches the server: whole weekdays, no repeats, the right count', () => {
    expect(validRestWeekdays('steady', [6, 0])).toEqual([0, 6]);
    expect(validRestWeekdays('steady', [0])).toBeNull();
    expect(validRestWeekdays('steady', [0, 0])).toBeNull();
    expect(validRestWeekdays('steady', [0, 7])).toBeNull();
    expect(validRestWeekdays('steady', null)).toBeNull();
  });

  it('weekdayOf reads a date key or a stored date, Monday when unreadable', () => {
    expect(weekdayOf('2026-09-21')).toBe(1);
    expect(weekdayOf('2026-09-27T00:00:00.000Z')).toBe(0);
    expect(weekdayOf(undefined)).toBe(1);
    expect(weekdayOf('soon')).toBe(1);
  });

  it('goalSchedule reads the stored routine, the chosen rest days or the variant\'s own', () => {
    const startDate = '2026-09-21T00:00:00.000Z';
    expect(goalSchedule({ startDate, routine: JSON.stringify({ planVariant: 'steady', dailyMinutes: 45, preferredSlot: 'morning', restWeekdays: [6, 0] }) })).toEqual({
      planVariant: 'steady',
      dailyMinutes: 45,
      preferredSlot: 'morning',
      restWeekdays: [0, 6],
    });
    expect(goalSchedule({ startDate, routine: JSON.stringify({ planVariant: 'minimal', restWeekdays: [0, 6] }) }).restWeekdays).toEqual([0, 3, 5]);
    expect(goalSchedule({ startDate, routine: 'not json' })).toEqual({ planVariant: 'steady', dailyMinutes: 30, preferredSlot: 'evening', restWeekdays: [0, 4] });
  });
});
