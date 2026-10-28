import { describe, expect, it } from 'vitest';
import { FIXED_DATE_FITS, FIXED_DATE_HINT, FIXED_DATE_SHORT, checkFixedDate, fixedDateHint, fixedDateLine } from './fixedDate';

// B-106: the optional fixed date a goal must be ready by.
describe('checkFixedDate', () => {
  const today = '2026-10-28';

  it('is empty with no date, invalid on or before today or for a date that is not real', () => {
    expect(checkFixedDate('', today)).toBe('empty');
    expect(checkFixedDate('2026-10-28', today)).toBe('invalid');
    expect(checkFixedDate('2026-10-01', today)).toBe('invalid');
    expect(checkFixedDate('2026-13-01', today)).toBe('invalid');
    expect(checkFixedDate('soon', today)).toBe('invalid');
  });

  it('is short before day 90 (today + 89) and fits from day 90 on', () => {
    expect(checkFixedDate('2026-10-29', today)).toBe('short');
    expect(checkFixedDate('2027-01-24', today)).toBe('short');
    expect(checkFixedDate('2027-01-25', today)).toBe('fits');
    expect(checkFixedDate('2027-06-01', today)).toBe('fits');
  });

  it('gives the hint for each state', () => {
    expect(fixedDateHint('empty')).toBe(FIXED_DATE_HINT);
    expect(fixedDateHint('short')).toBe(FIXED_DATE_SHORT);
    expect(fixedDateHint('fits')).toBe(FIXED_DATE_FITS);
  });
});

describe('fixedDateLine', () => {
  const now = new Date('2026-10-28T10:00:00Z');
  // Plan end (day 90) is the day before targetDate: January 25.
  const targetDate = '2027-01-26T00:00:00.000Z';

  it('is null with no fixed date', () => {
    expect(fixedDateLine({ targetDate, fixedDate: null }, now, 'en-US')).toBeNull();
    expect(fixedDateLine({ targetDate }, now, 'en-US')).toBeNull();
  });

  it('names the date and the plan end', () => {
    expect(fixedDateLine({ targetDate, fixedDate: '2027-02-10T00:00:00.000Z' }, now, 'en-US')).toBe(
      'Your date: February 10, 2027. Your plan ends on January 25, 2027.',
    );
    expect(fixedDateLine({ targetDate, fixedDate: '2027-01-25T00:00:00.000Z' }, now, 'en-US')).toBe(
      'Your date: January 25, 2027. Your plan ends on January 25, 2027.',
    );
  });

  it('says so honestly when the plan ends after the date', () => {
    expect(fixedDateLine({ targetDate, fixedDate: '2026-12-15T00:00:00.000Z' }, now, 'en-US')).toBe(
      "Your date: December 15. Your plan ends on January 25, 2027, after it, and won't move any later.",
    );
  });
});
