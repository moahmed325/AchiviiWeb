import { describe, it, expect } from 'vitest';
import { normalizeTimezone, resolveGoalStart } from '../src/lib/timezone.js';
import { weekLayout } from '../src/lib/ai/weekPlan.js';
import { weekStartFor } from '../src/lib/planV2.js';

const iso = (d: Date) => d.toISOString();

describe('resolveGoalStart (ND-1: the goal starts on the user\'s local day, stored at 00:00 UTC)', () => {
  it('uses the local date in Addis Ababa (UTC+3) after local midnight', () => {
    // 01:30 on 23 Sep in Addis Ababa is still 22 Sep in UTC.
    expect(iso(resolveGoalStart('Africa/Addis_Ababa', undefined, new Date('2026-09-22T22:30:00Z')))).toBe('2026-09-23T00:00:00.000Z');
  });

  it('uses the previous local date for a western timezone (UTC-7) late in the evening', () => {
    // 22:00 on 22 Sep in Los Angeles is already 23 Sep in UTC.
    expect(iso(resolveGoalStart('America/Los_Angeles', undefined, new Date('2026-09-23T05:00:00Z')))).toBe('2026-09-22T00:00:00.000Z');
  });

  it('handles UTC+14', () => {
    // 02:00 on 23 Sep in Kiritimati is 12:00 on 22 Sep in UTC.
    expect(iso(resolveGoalStart('Pacific/Kiritimati', undefined, new Date('2026-09-22T12:00:00Z')))).toBe('2026-09-23T00:00:00.000Z');
  });

  it('handles a goal created at 23:30 and just after local midnight', () => {
    expect(iso(resolveGoalStart('Africa/Addis_Ababa', undefined, new Date('2026-09-23T20:30:00Z')))).toBe('2026-09-23T00:00:00.000Z'); // 23:30 local
    expect(iso(resolveGoalStart('Africa/Addis_Ababa', undefined, new Date('2026-09-23T21:05:00Z')))).toBe('2026-09-24T00:00:00.000Z'); // 00:05 next day local
  });

  it('is correct across a DST change (America/New_York, 1 Nov 2026)', () => {
    // 00:30 EDT on 1 Nov, and 23:30 EST the same day (which is 2 Nov in UTC).
    expect(iso(resolveGoalStart('America/New_York', undefined, new Date('2026-11-01T04:30:00Z')))).toBe('2026-11-01T00:00:00.000Z');
    expect(iso(resolveGoalStart('America/New_York', undefined, new Date('2026-11-02T04:30:00Z')))).toBe('2026-11-01T00:00:00.000Z');
  });

  it('falls back to UTC when the timezone is missing or invalid', () => {
    const now = new Date('2026-09-22T23:30:00Z');
    expect(iso(resolveGoalStart(normalizeTimezone(undefined), undefined, now))).toBe('2026-09-22T00:00:00.000Z');
    expect(iso(resolveGoalStart(normalizeTimezone('Not/AZone'), undefined, now))).toBe('2026-09-22T00:00:00.000Z');
  });

  it('keeps a plain YYYY-MM-DD start date exactly as given, in any timezone', () => {
    expect(iso(resolveGoalStart('America/Los_Angeles', '2026-10-05'))).toBe('2026-10-05T00:00:00.000Z');
    expect(iso(resolveGoalStart('Pacific/Kiritimati', '2026-10-05'))).toBe('2026-10-05T00:00:00.000Z');
  });

  it('turns an instant into the user\'s local day, and ignores values it cannot read', () => {
    expect(iso(resolveGoalStart('America/Los_Angeles', '2026-10-05T03:00:00Z'))).toBe('2026-10-04T00:00:00.000Z');
    expect(iso(resolveGoalStart('Africa/Addis_Ababa', 'not a date', new Date('2026-09-22T22:30:00Z')))).toBe('2026-09-23T00:00:00.000Z');
  });
});

describe('week dates and weekdays use calendar days, not the server timezone', () => {
  const start = new Date('2026-09-23T00:00:00.000Z'); // a Wednesday

  it('writes seven consecutive local dates with the right weekday names', () => {
    const days = weekLayout('steady', start);
    expect(days.map((d) => d.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']);
    expect(days.map((d) => d.dayOfWeek)).toEqual(['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday']);
  });

  it('starts week 2 exactly seven days later, also across a DST change', () => {
    expect(iso(weekStartFor(start, 2))).toBe('2026-09-30T00:00:00.000Z');
    expect(iso(weekStartFor(new Date('2026-10-31T00:00:00.000Z'), 2))).toBe('2026-11-07T00:00:00.000Z');
    expect(weekLayout('steady', weekStartFor(new Date('2026-10-31T00:00:00.000Z'), 1)).map((d) => d.date)).toEqual([
      '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    ]);
  });

  it('gives identical results whatever timezone the server runs in', () => {
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati'].map((tz) => {
        process.env.TZ = tz;
        return JSON.stringify({
          layout: weekLayout('steady', start).map((d) => [d.date, d.dayOfWeek]),
          week3: iso(weekStartFor(start, 3)),
        });
      });
      expect(new Set(results).size).toBe(1);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});
