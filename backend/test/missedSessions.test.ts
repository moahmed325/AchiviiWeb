import { describe, it, expect } from 'vitest';
import {
  classifyDays,
  dayCloseInstant,
  findOpenGap,
  GAP_MIN_DAYS,
  type ClassifiableTask,
  type DayClassification,
} from '../src/lib/missedSessions.js';

const close = (date: string, sleepTime: unknown, tz?: unknown) => dayCloseInstant(date, sleepTime, tz).toISOString();

/** The UTC instant of a local wall time in a fixed-offset zone. */
const local = (date: string, time: string, offsetHours: number) =>
  new Date(Date.parse(`${date}T${time}:00Z`) - offsetHours * 3_600_000).toISOString();

let nextId = 0;
const task = (date: string, over: Partial<ClassifiableTask> = {}): ClassifiableTask => ({
  id: `t${++nextId}`,
  date,
  weekNumber: 1,
  dayNumber: 1,
  status: 'pending',
  isRestDay: false,
  isKeySession: false,
  isTestDay: false,
  ...over,
});

describe('dayCloseInstant (OD-1: bedtime + 2 hours, capped at 04:00 the next morning)', () => {
  const D = '2026-09-23';
  const D1 = '2026-09-24';
  // [sleepTime, close date, close time]
  const examples: Array<[string, string, string]> = [
    ['23:00', D1, '01:00'],
    ['22:30', D1, '00:30'],
    ['01:00', D1, '03:00'],
    ['03:00', D1, '04:00'], // capped
    ['09:00', D1, '04:00'], // a daytime sleeper is after midnight, so capped
    ['19:00', D, '21:00'],
    ['18:00', D, '20:00'], // the earliest any day can close
    ['17:59', D1, '04:00'],
    ['02:00', D1, '04:00'],
  ];
  const zones: Array<[string, number]> = [
    ['Africa/Addis_Ababa', 3],
    ['America/Los_Angeles', -7], // PDT in September
    ['Pacific/Kiritimati', 14],
    ['UTC', 0],
  ];

  for (const [tz, offset] of zones) {
    it(`gives every worked example in ${tz} (UTC${offset >= 0 ? '+' : ''}${offset})`, () => {
      for (const [sleep, date, time] of examples) {
        expect(close(D, sleep, tz), `sleepTime ${sleep}`).toBe(local(date, time, offset));
      }
    });
  }

  it('closes at 04:00 the next morning when sleepTime is missing, empty or malformed', () => {
    for (const sleep of [undefined, null, '', '25:00', '7pm', '23:5', 2300]) {
      expect(close(D, sleep, 'Africa/Addis_Ababa'), `sleepTime ${String(sleep)}`).toBe(local(D1, '04:00', 3));
    }
  });

  it('reads a missing or invalid timezone as UTC', () => {
    expect(close(D, '23:00', undefined)).toBe('2026-09-24T01:00:00.000Z');
    expect(close(D, '23:00', 'Not/AZone')).toBe('2026-09-24T01:00:00.000Z');
    expect(close(D, '23:00', '')).toBe('2026-09-24T01:00:00.000Z');
  });

  it('is correct on the spring-forward night (New York, 8 Mar 2026)', () => {
    // 01:00 on 8 Mar is still EST (UTC-5).
    expect(close('2026-03-07', '23:00', 'America/New_York')).toBe('2026-03-08T06:00:00.000Z');
    // 02:30 on 8 Mar does not exist: the close is the change itself, 03:00 EDT.
    expect(close('2026-03-07', '00:30', 'America/New_York')).toBe('2026-03-08T07:00:00.000Z');
    // The 04:00 cap is EDT (UTC-4).
    expect(close('2026-03-07', '03:00', 'America/New_York')).toBe('2026-03-08T08:00:00.000Z');
  });

  it('is correct on the fall-back night (New York, 1 Nov 2026)', () => {
    // 01:30 happens twice; the later one (EST) is used.
    expect(close('2026-10-31', '23:30', 'America/New_York')).toBe('2026-11-01T06:30:00.000Z');
    // The 04:00 cap is EST (UTC-5).
    expect(close('2026-10-31', '03:00', 'America/New_York')).toBe('2026-11-01T09:00:00.000Z');
    // 00:30 is before the change, still EDT.
    expect(close('2026-10-31', '22:30', 'America/New_York')).toBe('2026-11-01T04:30:00.000Z');
  });
});

describe('classifyDays (ND-2: derived, never stored)', () => {
  const tz = 'Africa/Addis_Ababa';
  const ctx = (now: string, sleepTime: unknown = '23:00') => ({ now: new Date(now), timezone: tz, sleepTime });
  const kinds = (tasks: ClassifiableTask[], now: string, sleepTime?: unknown) =>
    classifyDays(tasks, ctx(now, sleepTime)).map((d) => d.kind);

  it('handles a late-evening session: open until the close, missed from the close, done whenever completed', () => {
    const pending = task('2026-09-23');
    const completed = task('2026-09-23', { status: 'completed' });
    const at0040 = local('2026-09-24', '00:40', 3);
    const at0100 = local('2026-09-24', '01:00', 3);
    expect(kinds([pending, completed], at0040)).toEqual(['planned', 'done']);
    expect(kinds([pending, completed], at0100)).toEqual(['missed', 'done']);
    expect(kinds([pending], local('2026-09-24', '00:59', 3))).toEqual(['planned']);
  });

  it('never calls a rest day missed or done (RULE-5, AC-5)', () => {
    const past = '2026-09-20';
    const later = local('2026-09-25', '12:00', 3);
    expect(kinds([task(past, { isRestDay: true })], later)).toEqual(['rest']);
    expect(kinds([task(past, { isRestDay: true, status: 'completed' })], later)).toEqual(['rest']);
    expect(kinds([task('2026-09-30', { isRestDay: true })], later)).toEqual(['rest']);
  });

  it('treats today and future practice days as planned, and any status other than completed as not done', () => {
    const now = local('2026-09-24', '15:00', 3);
    expect(
      kinds(
        [
          task('2026-09-22', { status: 'skipped' }),
          task('2026-09-23', { status: '' }),
          task('2026-09-24'),
          task('2026-09-25'),
          task('2026-09-26', { status: 'completed' }), // done ahead of time
        ],
        now
      )
    ).toEqual(['missed', 'missed', 'planned', 'planned', 'done']);
  });

  it('classifies test days and key sessions like any practice day and carries their flags', () => {
    const now = local('2026-09-25', '12:00', 3);
    const result = classifyDays(
      [task('2026-09-23', { isTestDay: true, weekNumber: 2, dayNumber: 6 }), task('2026-09-24', { isKeySession: true, status: 'completed' })],
      ctx(now)
    );
    expect(result.map((d) => [d.kind, d.isTestDay, d.isKeySession, d.weekNumber, d.dayNumber])).toEqual([
      ['missed', true, false, 2, 6],
      ['done', false, true, 1, 1],
    ]);
  });

  it('uses the 04:00 close when sleepTime is missing, so a session at 03:30 still counts', () => {
    const pending = task('2026-09-23');
    const noSleepTime = (now: string) => classifyDays([pending], { now: new Date(now), timezone: tz })[0].kind;
    expect(noSleepTime(local('2026-09-24', '03:30', 3))).toBe('planned');
    expect(noSleepTime(local('2026-09-24', '04:00', 3))).toBe('missed');
    expect(kinds([pending], local('2026-09-24', '03:30', 3), 'not a time')).toEqual(['planned']);
  });

  it('closes at the capped 04:00 for an after-midnight sleeper', () => {
    const pending = task('2026-09-23');
    expect(kinds([pending], local('2026-09-24', '03:59', 3), '03:00')).toEqual(['planned']);
    expect(kinds([pending], local('2026-09-24', '04:00', 3), '03:00')).toEqual(['missed']);
  });

  it('follows the user timezone, not UTC: the same instant is still open in Los Angeles', () => {
    const now = new Date('2026-09-24T07:00:00Z'); // 10:00 in Addis Ababa, 00:00 in Los Angeles
    const pending = task('2026-09-23');
    expect(classifyDays([pending], { now, timezone: 'Africa/Addis_Ababa', sleepTime: '23:00' })[0].kind).toBe('missed');
    expect(classifyDays([pending], { now, timezone: 'America/Los_Angeles', sleepTime: '23:00' })[0].kind).toBe('planned');
    // No timezone: UTC, where the 23rd closed at 01:00 UTC on the 24th.
    expect(classifyDays([pending], { now, sleepTime: '23:00' })[0].kind).toBe('missed');
  });

  it('never calls a task with an unreadable date missed', () => {
    expect(kinds([task('23/09/2026'), task('')], local('2027-01-01', '12:00', 3))).toEqual(['planned', 'planned']);
  });

  it('keeps the input order and returns one entry per task', () => {
    const tasks = [task('2026-09-25'), task('2026-09-23'), task('2026-09-24', { isRestDay: true })];
    const result = classifyDays(tasks, ctx(local('2026-09-24', '12:00', 3)));
    expect(result.map((d) => d.taskId)).toEqual(tasks.map((t) => t.id));
    expect(result.map((d) => d.date)).toEqual(['2026-09-25', '2026-09-23', '2026-09-24']);
  });

  it('gives identical results whatever timezone the server runs in', () => {
    const tasks = [
      task('2026-03-06'),
      task('2026-03-07'),
      task('2026-03-08', { isRestDay: true }),
      task('2026-03-09', { status: 'completed' }),
      task('2026-03-10'),
    ];
    const now = new Date('2026-03-10T05:30:00Z');
    const original = process.env.TZ;
    try {
      const results = ['UTC', 'America/Los_Angeles', 'Pacific/Auckland', 'Pacific/Kiritimati'].map((serverTz) => {
        process.env.TZ = serverTz;
        return JSON.stringify({
          days: classifyDays(tasks, { now, timezone: 'America/New_York', sleepTime: '00:30' }),
          close: dayCloseInstant('2026-03-07', '00:30', 'America/New_York').toISOString(),
        });
      });
      expect(new Set(results).size).toBe(1);
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
  });
});

describe('findOpenGap (RULE-8: 3+ missed practice days in a row)', () => {
  let n = 0;
  const day = (kind: DayClassification['kind'], date: string, weekNumber = 1): DayClassification => ({
    taskId: `d${++n}`,
    date,
    weekNumber,
    dayNumber: Number(date.slice(8)),
    isKeySession: false,
    isTestDay: false,
    kind,
  });

  it('uses a threshold of 3', () => {
    expect(GAP_MIN_DAYS).toBe(3);
  });

  it('finds no gap for exactly 2 missed days', () => {
    expect(findOpenGap([day('done', '2026-09-20'), day('missed', '2026-09-21'), day('missed', '2026-09-22'), day('planned', '2026-09-23')])).toBeNull();
  });

  it('finds a gap of 3 missed days', () => {
    const days = [day('done', '2026-09-20'), day('missed', '2026-09-21'), day('missed', '2026-09-22'), day('missed', '2026-09-23')];
    expect(findOpenGap(days)).toEqual({
      firstDate: '2026-09-21',
      lastDate: '2026-09-23',
      length: 3,
      taskIds: days.slice(1).map((d) => d.taskId),
    });
  });

  it('lets a rest day sit inside a run without counting or breaking it', () => {
    const gap = findOpenGap([day('missed', '2026-09-21'), day('rest', '2026-09-22'), day('missed', '2026-09-23'), day('missed', '2026-09-24')]);
    expect(gap).toMatchObject({ firstDate: '2026-09-21', lastDate: '2026-09-24', length: 3 });
  });

  it('is broken by a done day', () => {
    expect(findOpenGap([day('missed', '2026-09-21'), day('done', '2026-09-22'), day('missed', '2026-09-23'), day('missed', '2026-09-24')])).toBeNull();
  });

  it('is closed once the user is back: a done day after the run means no open gap', () => {
    expect(findOpenGap([day('missed', '2026-09-21'), day('missed', '2026-09-22'), day('missed', '2026-09-23'), day('done', '2026-09-24')])).toBeNull();
  });

  it('runs across a week boundary', () => {
    const gap = findOpenGap([
      day('done', '2026-09-26', 1),
      day('missed', '2026-09-27', 1),
      day('rest', '2026-09-28', 2),
      day('missed', '2026-09-29', 2),
      day('missed', '2026-09-30', 2),
    ]);
    expect(gap).toMatchObject({ firstDate: '2026-09-27', lastDate: '2026-09-30', length: 3 });
  });

  it('ends at the most recent closed day when today is still planned', () => {
    const gap = findOpenGap([
      day('missed', '2026-09-21'),
      day('missed', '2026-09-22'),
      day('missed', '2026-09-23'),
      day('planned', '2026-09-24'),
      day('planned', '2026-09-25'),
    ]);
    expect(gap).toMatchObject({ firstDate: '2026-09-21', lastDate: '2026-09-23', length: 3 });
  });

  it('does not depend on the input order', () => {
    const gap = findOpenGap([day('missed', '2026-09-23'), day('planned', '2026-09-24'), day('missed', '2026-09-21'), day('missed', '2026-09-22')]);
    expect(gap).toMatchObject({ firstDate: '2026-09-21', lastDate: '2026-09-23', length: 3 });
  });

  it('works end to end from tasks: four days away after a rest day', () => {
    const tasks = [
      task('2026-09-20', { status: 'completed' }),
      task('2026-09-21'),
      task('2026-09-22', { isRestDay: true }),
      task('2026-09-23'),
      task('2026-09-24'),
      task('2026-09-25'),
    ];
    const days = classifyDays(tasks, { now: new Date(local('2026-09-25', '18:00', 3)), timezone: 'Africa/Addis_Ababa', sleepTime: '23:00' });
    expect(days.map((d) => d.kind)).toEqual(['done', 'missed', 'rest', 'missed', 'missed', 'planned']);
    expect(findOpenGap(days)).toMatchObject({ firstDate: '2026-09-21', lastDate: '2026-09-24', length: 3 });
  });
});
