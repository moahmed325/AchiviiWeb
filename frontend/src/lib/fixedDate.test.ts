import { describe, expect, it } from 'vitest';
import {
  FIXED_DATE_FITS,
  FIXED_DATE_HINT,
  FIXED_DATE_INVALID,
  FIXED_DATE_TOO_CLOSE,
  checkFixedDate,
  fixedDateBlocks,
  fixedDateError,
  fixedDateHint,
  fixedDateKey,
  fixedDateLine,
  lastDaysLine,
} from './fixedDate';

// B-106: the optional fixed date a goal must be ready by.
describe('checkFixedDate', () => {
  const today = '2026-10-28';

  it('is empty with no date, invalid on or before today or for a date that is not real', () => {
    expect(checkFixedDate('', today)).toBe('empty');
    expect(checkFixedDate('2026-10-28', today)).toBe('invalid');
    expect(checkFixedDate('2026-10-01', today)).toBe('invalid');
    expect(checkFixedDate('2026-13-01', today)).toBe('invalid');
    expect(checkFixedDate('2027-02-30', today)).toBe('invalid');
    expect(checkFixedDate('soon', today)).toBe('invalid');
  });

  it('B-109: too close under 4 whole weeks, short under 12, fits from 12 weeks on (as the server counts)', () => {
    expect(checkFixedDate('2026-10-29', today)).toBe('too_close');
    expect(checkFixedDate('2026-11-24', today)).toBe('too_close');
    expect(checkFixedDate('2026-11-25', today)).toBe('short');
    expect(checkFixedDate('2027-01-19', today)).toBe('short');
    expect(checkFixedDate('2027-01-20', today)).toBe('fits');
    expect(checkFixedDate('2027-06-01', today)).toBe('fits');
  });

  it('gives the hint for each state; a short plan names its weeks and its final test week', () => {
    expect(fixedDateHint('empty')).toBe(FIXED_DATE_HINT);
    expect(fixedDateHint('short', '2026-12-15', today)).toBe('Your plan will be 6 weeks, with the final test in week 5, the week before your date.');
    expect(fixedDateHint('fits')).toBe(FIXED_DATE_FITS);
  });

  it('a date that is not real or too close blocks the plan, with its own error', () => {
    expect(fixedDateError('invalid')).toBe(FIXED_DATE_INVALID);
    expect(fixedDateError('too_close')).toBe(FIXED_DATE_TOO_CLOSE);
    expect(FIXED_DATE_TOO_CLOSE).toBe('Your date is too close for a full plan. Choose a date at least 4 weeks away, or leave it empty.');
    expect(fixedDateError('short')).toBeUndefined();
    expect(['invalid', 'too_close', 'short', 'fits', 'empty'].map((check) => fixedDateBlocks(check as never))).toEqual([true, true, false, false, false]);
  });
});

describe('fixedDateLine', () => {
  const now = new Date('2026-10-28T10:00:00Z');
  // Plan end (day 90) is the day before targetDate: January 25.
  const targetDate = '2027-01-26T00:00:00.000Z';

  it('is null with no fixed date', () => {
    expect(fixedDateLine({ targetDate, fixedDate: null }, now, 'UTC', 'en-US')).toBeNull();
    expect(fixedDateLine({ targetDate }, now, 'UTC', 'en-US')).toBeNull();
  });

  it('is null once the date has passed, read in the person\'s time zone', () => {
    const fixedDate = '2026-10-27T00:00:00.000Z';
    expect(fixedDateLine({ targetDate, fixedDate }, now, 'UTC', 'en-US')).toBeNull();
    // 10:00 UTC is still October 27 in Pago Pago (UTC-11).
    expect(fixedDateLine({ targetDate, fixedDate }, now, 'Pacific/Pago_Pago', 'en-US')).not.toBeNull();
  });

  it('fixedDateKey reads the stored date as the field value', () => {
    expect(fixedDateKey({ fixedDate: '2027-05-10T00:00:00.000Z' })).toBe('2027-05-10');
    expect(fixedDateKey({ fixedDate: null })).toBe('');
    expect(fixedDateKey({})).toBe('');
  });

  it('names the date and the plan end', () => {
    expect(fixedDateLine({ targetDate, fixedDate: '2027-02-10T00:00:00.000Z' }, now, 'UTC', 'en-US')).toBe(
      'Your date: February 10, 2027. Your plan ends on January 25, 2027.',
    );
    expect(fixedDateLine({ targetDate, fixedDate: '2027-01-25T00:00:00.000Z' }, now, 'UTC', 'en-US')).toBe(
      'Your date: January 25, 2027. Your plan ends on January 25, 2027.',
    );
  });

  it('says so honestly when the plan ends after the date', () => {
    expect(fixedDateLine({ targetDate, fixedDate: '2026-12-15T00:00:00.000Z' }, now, 'UTC', 'en-US')).toBe(
      "Your date: December 15. Your plan ends on January 25, 2027, after it, and won't move any later.",
    );
  });
});

describe('lastDaysLine (B-109)', () => {
  // A 6-week plan from October 28: its last day is December 8; the exam is December 12.
  const goal = { startDate: '2026-10-28T00:00:00.000Z', fixedDate: '2026-12-12T00:00:00.000Z', totalWeeks: 6 };
  const at = (date: string) => new Date(`${date}T10:00:00Z`);

  it('is null while the plan runs, on a 12-week plan, and once the date is here', () => {
    expect(lastDaysLine(goal, at('2026-12-08'), 'UTC')).toBeNull();
    expect(lastDaysLine({ ...goal, totalWeeks: 12 }, at('2026-12-10'), 'UTC')).toBeNull();
    expect(lastDaysLine(goal, at('2026-12-12'), 'UTC')).toBeNull();
    expect(lastDaysLine({ ...goal, fixedDate: null }, at('2026-12-10'), 'UTC')).toBeNull();
  });

  it('counts the days to the date after the last week', () => {
    expect(lastDaysLine(goal, at('2026-12-09'), 'UTC')).toBe('Your date is in 3 days. Rest, and trust the work.');
    expect(lastDaysLine(goal, at('2026-12-11'), 'UTC')).toBe('Your date is tomorrow. Rest, and trust the work.');
  });
});
