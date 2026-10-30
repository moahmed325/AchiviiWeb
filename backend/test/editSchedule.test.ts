import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Edit my schedule (B-108): PATCH /api/goal/schedule saves the days, minutes and time of day; the next week written
// follows them and the open week stays as written. The real route, close and writeNextWeek run on the in-memory store;
// only the model call is replaced.

vi.mock('../src/lib/prisma.js', async () => ({ prisma: (await import('./weekCloseStore.js')).db.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { db } from './weekCloseStore.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { generateWeekPlan, validRestWeekdays, weekLayout, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { goalScheduleOf, readRoutine } from '../src/lib/planV2.js';
import { nextRoutine, readScheduleChange } from '../src/routes/goal/schedule.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { weekStartFor } from '../src/lib/planV2.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const TARGET = new Date('2026-12-20T00:00:00Z');
const DAY = 86_400_000;
const LANGUAGE = RECOVERY_TEMPLATES.language;
const target = { kind: 'number', metric: 'Minutes', value: 50, unit: 'min', direction: 'lower_is_better' };
const test = { type: 'run', instructions: 'Log the long run', passIf: 'done' };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shifted = (date: Date, days: number) => new Date(date.getTime() + days * DAY);

/** A week as the model writes it: one general step on each practice day. */
function modelWeek(weekStart: Date, restWeekdays?: number[]): WeekDayPlan[] {
  // As the real week call does: the days come from the layout, with the chosen rest days.
  return weekLayout('steady', weekStart, restWeekdays).map((day) => ({
    ...day,
    title: day.isRestDay ? 'Rest' : 'Practice',
    durationMinutes: day.isRestDay ? 0 : 40,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay
      ? []
      : [{ stepNumber: 1, title: 'Lesson', durationMinutes: 30, instructions: 'Do the lesson.', focusCue: '', pitfallToAvoid: '', priority: 1, kind: 'general' }],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

/**
 * Week `open` open (every earlier week closed by review), `movedDays` already moved; its practice days all done.
 * `fixedDate` (B-106): the goal's fixed date, null for none.
 */
function seed(open: number, movedDays = 0, fixedDate: Date | null = null, routine: Record<string, unknown> = {}) {
  const start = shifted(START, movedDays);
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: open,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: start,
    targetDate: shifted(TARGET, movedDays),
    routine: JSON.stringify({ dailyMinutes: 40, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening', ...routine }),
    roadmap: {
      finalGoal: 'The goal',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Method', creator: '', rules: ['One step at a time'] },
      phases: [{ name: 'Build', purpose: 'Grow.', startWeek: 1, endWeek: 12 }],
      answers: [],
      recovery: LANGUAGE,
    },
    movedDays,
    closeTriedAt: null,
    closeTriedWeek: null,
    fixedDate,
  });
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: 'Build',
      theme: `Theme ${weekNumber}`,
      target: { ...target, value: 60 - weekNumber },
      test,
      status: weekNumber < open ? 'completed' : weekNumber === open ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber < open ? 'review' : null,
      closedAt: null,
      breakDays: null,
      jumped: false,
    });
  }
  const days = weekLayout('steady', weekStartFor(start, open));
  days.forEach((day) => {
    db.state.tasks.push({
      id: `g1-w${open}-d${day.dayNumber}`,
      goalId: 'g1',
      weekNumber: open,
      dayNumber: (open - 1) * 7 + day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.isRestDay ? 'Rest' : 'Practice',
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: day.isRestDay ? 'pending' : 'completed',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: 40,
      detailedSteps: JSON.stringify(day.isRestDay ? [] : [{ stepNumber: 1, title: 'Practice', durationMinutes: 40, instructions: '', focusCue: '', pitfallToAvoid: '', priority: 1, kind: 'general' }]),
      implementationIntention: '',
      whyToday: null,
      minimumVersion: null,
    });
  });
}

/** 08:00 UTC, `gap` days after week `open + 1`'s planned start (from the seeded, already moved, start). */
const atGap = (open: number, gap: number, movedDays = 0) => `${iso(shifted(weekStartFor(shifted(START, movedDays), open + 1), gap))}T08:00:00Z`;

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/goal', goalRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => modelWeek(input.weekStart, input.restWeekdays));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  for (const name of ['WEEK_CLOSE_ENABLED', 'MISSED_SESSIONS_CARRY_ENABLED', 'METHOD_RECOVERY_ENABLED']) vi.stubEnv(name, '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function post(path: string, at: string, body: unknown = {}, method = 'POST') {
  vi.setSystemTime(new Date(at));
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const closeOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
const logLines = (needle: string) => vi.mocked(console.log).mock.calls.map((c) => String(c[0])).filter((line) => line.includes(needle));
const close = (at: string) => post('/close-week', at);
const schedule = (at: string, body: unknown) => post('/schedule', at, body, 'PATCH');
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const restWeekdaysOf = (week: number) => db.tasksOf(week).filter((t) => t.isRestDay).map((t) => weekdayOf(t.date)).sort();
/** 12:00 UTC on day `day` (1 to 7) of week `week`. */
const onDay = (week: number, day: number) => `${iso(shifted(weekStartFor(START, week), day - 1))}T12:00:00Z`;

describe('the chosen rest days (B-108)', () => {
  it('validRestWeekdays: whole weekdays, no repeats, as many as the days a week leave free; two in a row allowed', () => {
    expect(validRestWeekdays('steady', [6, 0])).toEqual([0, 6]);
    expect(validRestWeekdays('minimal', [1, 3, 5])).toEqual([1, 3, 5]);
    expect(validRestWeekdays('accelerated', [0])).toEqual([0]);
    expect(validRestWeekdays('steady', [0])).toBeNull();
    expect(validRestWeekdays('steady', [0, 0])).toBeNull();
    expect(validRestWeekdays('steady', [0, 7])).toBeNull();
    expect(validRestWeekdays('steady', [0, 1.5])).toBeNull();
    expect(validRestWeekdays('steady', 'weekend')).toBeNull();
  });

  it('weekLayout rests on the chosen weekdays from any start day, with no test day (no weekly tests)', () => {
    // START is a Monday: a weekend off rests on days 6 and 7.
    const weekend = weekLayout('steady', START, [0, 6]);
    expect(weekend.filter((d) => d.isRestDay).map((d) => d.dayOfWeek)).toEqual(['Saturday', 'Sunday']);
    expect(weekend.some((d) => d.isTestDay)).toBe(false);
    // A Thursday start, Wednesday and Sunday off.
    const thursday = weekLayout('steady', new Date('2026-09-24T00:00:00Z'), [0, 3]);
    expect(thursday.filter((d) => d.isRestDay).map((d) => d.dayOfWeek)).toEqual(['Sunday', 'Wednesday']);
    expect(thursday.some((d) => d.isTestDay)).toBe(false);
  });

  it('with none chosen (or ones that do not fit), the layout is exactly as before', () => {
    expect(weekLayout('steady', START, undefined)).toEqual(weekLayout('steady', START));
    expect(weekLayout('steady', START, [0])).toEqual(weekLayout('steady', START));
    expect(weekLayout('steady', START).filter((d) => d.isRestDay).map((d) => d.dayNumber)).toEqual([4, 7]);
  });

  it('readRoutine keeps the rest days only while they fit the days a week', () => {
    expect(readRoutine({ routine: JSON.stringify({ planVariant: 'steady', restWeekdays: [0, 6] }) }).restWeekdays).toEqual([0, 6]);
    expect(readRoutine({ routine: JSON.stringify({ planVariant: 'minimal', restWeekdays: [0, 6] }) }).restWeekdays).toBeUndefined();
    expect(readRoutine({ routine: JSON.stringify({ planVariant: 'steady' }) }).restWeekdays).toBeUndefined();
  });
});

describe('goalScheduleOf: the schedule the app is sent (B-108, code review)', () => {
  it('names the rest days in force, chosen or by position, and the time of day as the week writer reads it', () => {
    expect(goalScheduleOf({ startDate: START, routine: JSON.stringify({ planVariant: 'steady', dailyMinutes: 45 }) })).toEqual({
      planVariant: 'steady',
      dailyMinutes: 45,
      preferredSlot: 'evening',
      // A Monday start: plan days 4 and 7.
      restWeekdays: [0, 4],
      restWeekdaysChosen: false,
    });
    expect(goalScheduleOf({ startDate: START, routine: JSON.stringify({ planVariant: 'steady', preferredSlot: 'morning', restWeekdays: [6, 0] }) })).toMatchObject({
      preferredSlot: 'morning',
      restWeekdays: [0, 6],
      restWeekdaysChosen: true,
    });
  });
});

describe('readScheduleChange and nextRoutine (B-108)', () => {
  const stored = { dailyMinutes: 40, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening', wakeTime: '07:00', restWeekdays: [0, 6] };
  const now = readRoutine({ routine: JSON.stringify(stored) });

  it('checks each field and needs one', () => {
    expect(readScheduleChange({})).toEqual({ error: 'Nothing to change.' });
    expect(readScheduleChange({ planVariant: 'daily' })).toEqual({ error: 'Choose how many days a week you can practise.' });
    expect(readScheduleChange({ dailyMinutes: 5 })).toEqual({ error: 'Choose how many minutes a day you can practise.' });
    expect(readScheduleChange({ dailyMinutes: '60' })).toEqual({ error: 'Choose how many minutes a day you can practise.' });
    expect(readScheduleChange({ preferredSlot: 'night' })).toEqual({ error: 'Choose a time of day: morning, afternoon or evening.' });
    expect(readScheduleChange({ restWeekdays: 'weekend' })).toHaveProperty('error');
    expect(readScheduleChange({ dailyMinutes: 60, preferredSlot: 'morning' })).toEqual({ change: { dailyMinutes: 60, preferredSlot: 'morning' } });
  });

  it('keeps every other stored field, and the rest days while they still fit', () => {
    expect(nextRoutine(stored, now, { dailyMinutes: 60 })).toEqual({ routine: { ...stored, dailyMinutes: 60 } });
    // From 5 to 4 days: two rest days no longer fit, so the variant's own apply.
    const { restWeekdays: _r, ...noRest } = stored;
    expect(nextRoutine(stored, now, { planVariant: 'minimal' })).toEqual({ routine: { ...noRest, planVariant: 'minimal' } });
    expect(nextRoutine(stored, now, { planVariant: 'minimal', restWeekdays: [0, 3, 6] })).toEqual({ routine: { ...stored, planVariant: 'minimal', restWeekdays: [0, 3, 6] } });
    expect(nextRoutine(stored, now, { restWeekdays: null })).toEqual({ routine: noRest });
    expect(nextRoutine(stored, now, { restWeekdays: [1] })).toHaveProperty('error');
  });
});

describe('PATCH /api/goal/schedule (B-108)', () => {
  it('saves the change and the pending weeks\' planned minutes, answers the week it starts in, and logs it', async () => {
    seed(2);
    const res = await schedule(onDay(2, 3), { planVariant: 'minimal', restWeekdays: [2, 4, 6], dailyMinutes: 60, preferredSlot: 'morning' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ startsWeek: 3, startsOn: iso(weekStartFor(START, 3)), routine: { planVariant: 'minimal', restWeekdays: [2, 4, 6], dailyMinutes: 60, preferredSlot: 'morning' } });
    expect(JSON.parse(db.goal().routine)).toEqual({ dailyMinutes: 60, planVariant: 'minimal', sleepTime: '23:00', preferredSlot: 'morning', restWeekdays: [2, 4, 6] });
    expect(db.state.weeks.filter((w) => w.status === 'pending').every((w) => w.plannedMinutes === 240)).toBe(true);
    expect(logLines('[Schedule]')).toEqual(['[Schedule] goal g1 from week 3: steady rest default 40 min evening -> minimal rest 2,4,6 60 min morning']);
  });

  it('refuses bad fields (400), a goal in its final week (409 last_week), and a missing goal (404)', async () => {
    seed(2);
    expect((await schedule(onDay(2, 3), { restWeekdays: [0] })).status).toBe(400);
    expect((await schedule(onDay(2, 3), {})).status).toBe(400);
    db.reset();
    seed(12);
    expect((await schedule(onDay(12, 2), { dailyMinutes: 60 })).body).toMatchObject({ reason: 'last_week' });
    db.reset();
    expect((await schedule(onDay(2, 3), { dailyMinutes: 60 })).status).toBe(404);
  });

  it('waits while the open week is over and its close not yet saved (409 week_closing), with the week close on', async () => {
    closeOn();
    seed(2);
    const res = await schedule(atGap(2, 0), { dailyMinutes: 60 });
    expect(res.status).toBe(409);
    expect(res.body.reason).toBe('week_closing');
    expect(JSON.parse(db.goal().routine).dailyMinutes).toBe(40);
    // Once the close is saved, the change is taken for the week after.
    expect((await close(atGap(2, 0))).status).toBe(200);
    expect((await schedule(atGap(2, 0), { dailyMinutes: 60 })).body).toMatchObject({ startsWeek: 4 });
  });

  it('the open week stays as written; the next week follows the new days, minutes and time of day', async () => {
    closeOn();
    seed(2);
    const before = structuredClone(db.tasksOf(2));
    expect((await schedule(onDay(2, 3), { restWeekdays: [0, 6], dailyMinutes: 60, preferredSlot: 'morning' })).status).toBe(200);
    expect(db.tasksOf(2)).toEqual(before);
    expect((await close(atGap(2, 0))).status).toBe(200);
    expect(restWeekdaysOf(3)).toEqual([0, 6]);
    expect(db.tasksOf(3).filter((t) => t.isRestDay).map((t) => t.dayOfWeek)).toEqual(['Saturday', 'Sunday']);
    const input = vi.mocked(generateWeekPlan).mock.calls[0][0];
    expect(input).toMatchObject({ restWeekdays: [0, 6], dailyMinutes: 60, planVariant: 'steady', slotTime: '07:30' });
  });

  it('a goal that never chose keeps the variant\'s rest days on the next week', async () => {
    closeOn();
    seed(2);
    expect((await close(atGap(2, 0))).status).toBe(200);
    expect(db.tasksOf(3).filter((t) => t.isRestDay).map((t) => t.dayNumber)).toEqual([18, 21]);
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0].restWeekdays).toBeUndefined();
  });
});
