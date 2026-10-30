import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M1.4 (RULE-13, RULE-14, RULE-15's limit, RULE-17, RULE-18, WU-13, WU-26, WU-28 (1), WU-33): a close that
// writes the next week after a gap moves the plan's dates (up to 28 days in total) and marks the new week's days that
// already passed as not offered; reconcile treats those like rest days, except that their in-order steps queue.
// The real review, close, reconcile and writeNextWeek run on the in-memory store; only the model call is replaced.

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
import { generateWeekPlan, weekLayout, type WeekDayPlan } from '../src/lib/ai/weekPlan.js';
import { RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { WELCOME_BACK_INSIGHT } from '../src/lib/weekClose/breaks.js';
import { AUTO_CLOSE_INSIGHT, MOVED_INSIGHT, NOT_OFFERED_WEEK_INSIGHT, PARTIAL_MOVE_INSIGHT, planWeekMove, weekScore } from '../src/lib/weekClose/close.js';
import { classifyDays, findOpenGap } from '../src/lib/missedSessions.js';
import { weekCounts } from '../src/lib/missedSignals.js';
import { weekHandoff } from '../src/lib/recovery/handoff.js';
import { phaseGate } from '../src/lib/planV2.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // week 2 is Mon 2026-09-28 to Sun 2026-10-04; week 3 starts Mon 2026-10-05
const TARGET = new Date('2026-12-20T00:00:00Z'); // START + 90 days
const LANGUAGE = RECOVERY_TEMPLATES.language;
const LESSON = LANGUAGE.kinds.find((k) => k.inOrder && k.action === 'move')!.id;
const NOTES = LANGUAGE.kinds.find((k) => !k.inOrder && k.action === 'let_go')!.id;
const target = { kind: 'number', metric: 'Words', value: 100, unit: 'words', direction: 'higher_is_better' };
const test = { type: 'quiz', instructions: 'Take the quiz', passIf: '80%' };
const DAY = 86_400_000;

const step = (title: string, priority: number, minutes: number, kind: string) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  kind,
});

/** Each practice day holds the next lesson, then notes. */
function lessonDays(weekStart: Date, firstLesson: number, prefix: string): WeekDayPlan[] {
  let lesson = firstLesson;
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: day.isRestDay ? 'Rest' : `${prefix} lesson ${lesson}`,
    durationMinutes: day.isRestDay ? 0 : 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay ? [] : [step(`${prefix} lesson ${lesson++}`, 1, 20, LESSON), step(`Notes ${day.date}`, 2, 10, NOTES)],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

const weekStart = (weekNumber: number) => new Date(START.getTime() + (weekNumber - 1) * 7 * DAY);
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const shifted = (date: Date, days: number) => new Date(date.getTime() + days * DAY);
/** 08:00 UTC, `gap` days after week 3's planned start. */
const atGap = (gap: number) => `${addDays('2026-10-05', gap)}T08:00:00Z`;

/** Week 1 closed by review; week 2 open and every practice day done unless `notOffered` (week 2's rows stored so). */
function seed(over: Record<string, unknown> = {}, week2: { notOffered?: boolean } = {}) {
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek: 2,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: START,
    targetDate: TARGET,
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Hold a conversation',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Lessons', creator: '', rules: ['One lesson at a time'] },
      phases: [
        { name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 2 },
        { name: 'Build', purpose: 'Grow.', startWeek: 3, endWeek: 12 },
      ],
      answers: [],
      recovery: LANGUAGE,
    },
    movedDays: 0,
    closeTriedAt: null,
    closeTriedWeek: null,
    ...over,
  });
  for (let weekNumber = 1; weekNumber <= 12; weekNumber++) {
    db.state.weeks.push({
      id: `w${weekNumber}`,
      goalId: 'g1',
      weekNumber,
      phase: weekNumber <= 2 ? 'Base' : 'Build',
      theme: `Theme ${weekNumber}`,
      target,
      test,
      status: weekNumber === 1 ? 'completed' : weekNumber === 2 ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber === 1 ? 'review' : null,
      closedAt: null,
    });
  }
  for (const weekNumber of [1, 2]) {
    lessonDays(weekStart(weekNumber), weekNumber === 1 ? 1 : 6, 'Planned').forEach((day) => {
      const flagged = weekNumber === 2 && week2.notOffered === true && !day.isRestDay;
      db.state.tasks.push({
        id: `g1-d${(weekNumber - 1) * 7 + day.dayNumber}`,
        goalId: 'g1',
        weekNumber,
        dayNumber: (weekNumber - 1) * 7 + day.dayNumber,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        title: day.title,
        isRestDay: day.isRestDay,
        isKeySession: false,
        isTestDay: day.isTestDay,
        status: day.isRestDay || flagged ? 'pending' : 'completed',
        usedMinimumVersion: false,
        notOffered: flagged,
        notes: null,
        durationMinutes: day.durationMinutes,
        detailedSteps: JSON.stringify(day.detailedSteps),
        implementationIntention: '',
        whyToday: null,
        minimumVersion: null,
      });
    });
  }
}

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
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => lessonDays(input.weekStart, 100, 'Model'));
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

async function post(path: string, at: string, body: unknown = {}) {
  vi.setSystemTime(new Date(at));
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const closeWeek = (at: string) => post('/close-week', at);
const reviewWeek2 = (at: string) => post('/weeks/2/review', at, { reflection: 'Back now' });
const reconcile = (at: string) => post('/reconcile', at);
const closeOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
const week3 = () => db.tasksOf(3);
const notOfferedDates = () => week3().filter((t) => t.notOffered).map((t) => t.date);

describe('a close after a gap (RULE-13, RULE-14, WU-13, WU-33 (2)), WEEK_CLOSE_ENABLED on', () => {
  beforeEach(closeOn);

  it.each([
    // gap, days moved, week 3's first date, days not offered
    [0, 0, '2026-10-05', []],
    [1, 0, '2026-10-05', ['2026-10-05']],
    [2, 2, '2026-10-07', []],
    [4, 4, '2026-10-09', []],
    [6, 6, '2026-10-11', []],
    [10, 10, '2026-10-15', []],
  ])('a gap of %i days moves the plan %i days; week 3 starts %s; not offered: %j', async (gap, moved, firstDate, notOffered) => {
    seed();
    const res = await closeWeek(atGap(gap));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ due: true, closedBy: 'auto', nextWeekNumber: 3 });
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: moved, startDate: shifted(START, moved), targetDate: shifted(TARGET, moved) });
    expect(week3()[0].date).toBe(firstDate);
    expect(week3()).toHaveLength(7);
    expect(notOfferedDates()).toEqual(notOffered);
    // Week 2's stored rows don't change (WU-26).
    expect(db.tasksOf(2).map((t) => t.date)).toEqual(lessonDays(weekStart(2), 6, 'Planned').map((d) => d.date));
    // Section 6: the line says so only when the plan moved; `{date}` is stored as written. M1.5a: a gap of 7 or more is a
    // break and says welcome back (weekCloseBreak.test.ts).
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(gap >= 7 ? WELCOME_BACK_INSIGHT : moved > 0 ? MOVED_INSIGHT : AUTO_CLOSE_INSIGHT);
  });

  it('the lines are exact', () => {
    expect(MOVED_INSIGHT).toBe('Your next week starts today. Your plan now ends on {date}.');
    expect(PARTIAL_MOVE_INSIGHT).toBe('Your plan now ends on {date}.');
    expect(NOT_OFFERED_WEEK_INSIGHT).toBe('No practice days were offered this week.');
  });

  it('a full move within the limit keeps the moved-plan line (24 moved, a 4-day gap moves all 4)', async () => {
    seed({ movedDays: 24, startDate: shifted(START, 24), targetDate: shifted(TARGET, 24) });
    expect((await closeWeek('2026-11-02T08:00:00Z')).status).toBe(200);
    expect(db.goal().movedDays).toBe(28);
    expect(notOfferedDates()).toEqual([]);
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(MOVED_INSIGHT);
  });

  it('the limit (RULE-15): 26 already moved and a 4-day gap moves 2; the other 2 days are not offered', async () => {
    seed({ movedDays: 26, startDate: shifted(START, 26), targetDate: shifted(TARGET, 26) });
    // Week 3's planned start is now 2026-10-31; back on 2026-11-04 (a gap of 4).
    expect((await closeWeek('2026-11-04T08:00:00Z')).status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 28, startDate: shifted(START, 28), targetDate: shifted(TARGET, 28) });
    expect(week3()[0].date).toBe('2026-11-02');
    expect(notOfferedDates()).toEqual(['2026-11-02', '2026-11-03']);
    // Review fix 3: a part move means the week didn't start today, so only the end date is said.
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(PARTIAL_MOVE_INSIGHT);
  });

  it('the limit used up: 28 moved moves nothing; the whole gap is not offered and the line stays neutral', async () => {
    seed({ movedDays: 28, startDate: shifted(START, 28), targetDate: shifted(TARGET, 28) });
    expect((await closeWeek('2026-11-06T08:00:00Z')).status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 28, startDate: shifted(START, 28), targetDate: shifted(TARGET, 28) });
    expect(week3()[0].date).toBe('2026-11-02');
    expect(notOfferedDates()).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']); // every row before today, the rest day (Thu) too
    expect(db.state.reviews[0].aiAdaptationInsight).toBe(AUTO_CLOSE_INSIGHT);
  });

  it('a failed write retried 2 days later counts the gap to the first try (RULE-9); the waiting days are not offered', async () => {
    seed();
    vi.mocked(generateWeekPlan).mockResolvedValueOnce(null);
    expect((await closeWeek(atGap(4))).status).toBe(503);
    expect(db.goal()).toMatchObject({ movedDays: 0, startDate: START, closeTriedWeek: 2, closeTriedAt: new Date(atGap(4)) });
    expect(week3()).toEqual([]);

    expect((await closeWeek(atGap(6))).status).toBe(200);
    expect(db.goal()).toMatchObject({ movedDays: 4, startDate: shifted(START, 4), targetDate: shifted(TARGET, 4) });
    expect(week3()[0].date).toBe('2026-10-09');
    expect(notOfferedDates()).toEqual(['2026-10-09', '2026-10-10']);
  });

  it('a losing request saves no shift (WU-27): a review racing an automatic close moves the plan once', async () => {
    seed();
    let waiting = 0;
    let release!: () => void;
    const both = new Promise<void>((resolve) => (release = resolve));
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
      if (++waiting === 2) release();
      await both;
      return lessonDays(input.weekStart, 100, 'Model');
    });
    vi.setSystemTime(new Date(atGap(4)));
    const send = (path: string, body: unknown) =>
      fetch(`${baseUrl}/api/goal${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify(body) });
    const [byReview, byClose] = await Promise.all([send('/weeks/2/review', { reflection: '' }), send('/close-week', {})]);
    const reviewWon = byReview.status === 200;
    expect(reviewWon ? await byClose.json() : (await byReview.json()).reason).toEqual(reviewWon ? { due: false, alreadyClosed: true, weekNumber: 2 } : 'week_closed');
    expect(generateWeekPlan).toHaveBeenCalledTimes(2);
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: 4, startDate: shifted(START, 4), targetDate: shifted(TARGET, 4) });
    expect(week3()).toHaveLength(7);
    expect(db.state.reviews).toHaveLength(1);
  });

  it('a late review moves the plan the same way and keeps its own insight and answer (section 6)', async () => {
    seed();
    const res = await reviewWeek2(atGap(4));
    expect(res.status).toBe(200);
    expect(res.body.review.aiAdaptationInsight).toBe('5 of 5 sessions done.');
    expect(db.goal()).toMatchObject({ movedDays: 4, startDate: shifted(START, 4) });
    expect(week3()[0].date).toBe('2026-10-09');
  });

  it('the gap is counted in the person time zone, once, before the model call', () => {
    const goal = { startDate: START, targetDate: TARGET, movedDays: 0, closeTriedAt: null, closeTriedWeek: null };
    // 23:30 UTC on 10-06 is already 10-07 in Tokyo: a gap of 2 there, 1 in UTC.
    expect(planWeekMove(goal, 2, new Date('2026-10-06T23:30:00Z'), 'Asia/Tokyo')).toMatchObject({ gap: 2, days: 2, writtenOn: '2026-10-07' });
    expect(planWeekMove(goal, 2, new Date('2026-10-06T23:30:00Z'), 'UTC')).toMatchObject({ gap: 1, days: 0, writtenOn: '2026-10-06' });
    // A first try recorded for another week is not this week's.
    expect(planWeekMove({ ...goal, closeTriedWeek: 1, closeTriedAt: new Date('2026-09-28T08:00:00Z') }, 2, new Date(atGap(3)), 'UTC')).toMatchObject({ gap: 3 });
    // Week 12 has no week after it.
    expect(planWeekMove(goal, 12, new Date(atGap(3)), 'UTC')).toBeNull();
  });
});

describe('WEEK_CLOSE_ENABLED off (RULE-18, R-7, AC-19)', () => {
  // M4.1b (WU-62 (1)): state A (the switch unset).
  it.each([
    ['the switch unset', ''],
  ])('%s: a late review closes the week exactly as before: no gap, no move, no days not offered', async (_name, _update) => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    seed();
    expect((await reviewWeek2(atGap(4))).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 3, movedDays: 0, startDate: START, targetDate: TARGET });
    expect(week3()[0].date).toBe('2026-10-05');
    expect(notOfferedDates()).toEqual([]);
    expect(planWeekMove(db.goal(), 2, new Date(atGap(4)), 'UTC')).toBeNull();
  });

  it('reconcile after that review has no new kind', async () => {
    vi.stubEnv('MISSED_SESSIONS_CARRY_ENABLED', 'true');
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
    seed();
    await reviewWeek2(atGap(4));
    const body = (await reconcile(`${addDays('2026-10-05', 4)}T08:01:00Z`)).body;
    expect(body.days.map((d: { kind: string }) => d.kind)).not.toContain('not_offered');
    expect(body.days.filter((d: { kind: string; weekNumber: number }) => d.weekNumber === 3 && d.kind === 'missed')).toHaveLength(3);
  });
});

describe('reconcile with days not offered (RULE-17, WU-33 (1))', () => {
  beforeEach(() => {
    vi.stubEnv('MISSED_SESSIONS_CARRY_ENABLED', 'true');
    vi.stubEnv('METHOD_RECOVERY_ENABLED', 'true');
  });

  it('no miss, no gap, no carry, no line; their in-order steps queue into the days left', async () => {
    closeOn();
    // The limit is used up, so the gap is all days not offered: Mon to Wed of week 3 (Thu is a rest day).
    seed({ movedDays: 28, startDate: shifted(START, 28), targetDate: shifted(TARGET, 28) });
    expect((await closeWeek('2026-11-06T08:00:00Z')).status).toBe(200);
    const res = await reconcile('2026-11-06T08:01:00Z');
    expect(res.status).toBe(200);
    const body = res.body;
    const kinds = Object.fromEntries(body.days.filter((d: { weekNumber: number }) => d.weekNumber === 3).map((d: { date: string; kind: string }) => [d.date, d.kind]));
    expect(kinds).toMatchObject({ '2026-11-02': 'not_offered', '2026-11-03': 'not_offered', '2026-11-04': 'not_offered', '2026-11-05': 'rest', '2026-11-06': 'planned' });
    expect(body.gap).toBeNull();
    expect(body.carry.carries ?? []).toEqual([]);
    expect(body.carry.outcomes).toEqual([]);
    expect(body.signals.line ?? null).toBeNull();
    expect(body.signals.notice).toBeNull();
    // The lessons of the days not offered (100 to 102) queue first: Friday now holds lesson 100.
    const reorder = body.carry.reorders.find((r: { weekNumber: number }) => r.weekNumber === 3);
    expect(reorder.sessions[0]).toMatchObject({ date: '2026-11-06', holds: { title: 'Model lesson 100' }, changed: true });
    const friday = db.tasksOf(3).find((t) => t.date === '2026-11-06')!;
    expect(friday.detailedSteps).toContain('Model lesson 100');
    // Nothing is carried into a day not offered; the queue's records stay on the first one's step, as on a missed day.
    for (const day of db.tasksOf(3).filter((t) => t.notOffered)) {
      expect(JSON.parse(day.detailedSteps).some((s: { carriedFrom?: unknown; shiftedFrom?: unknown; continueFrom?: unknown }) => s.carriedFrom || s.shiftedFrom || s.continueFrom)).toBe(false);
    }
  });

  it('a day not offered holding the queue records stays not offered: no miss, no line, no signal, no swap or carry-now choice', async () => {
    closeOn();
    seed({ movedDays: 28, startDate: shifted(START, 28), targetDate: shifted(TARGET, 28) });
    expect((await closeWeek('2026-11-06T08:00:00Z')).status).toBe(200);
    expect((await reconcile('2026-11-06T08:01:00Z')).status).toBe(200);
    // The run stored the leftovers' records on Monday's lesson (the queue's first step), a day not offered.
    const monday = db.tasksOf(3).find((t) => t.date === '2026-11-02')!;
    expect(monday.notOffered).toBe(true);
    expect(monday.detailedSteps).toContain('toNextWeek');

    // The next open (Saturday), Friday done: Monday is still not offered, and nothing about it is offered or said.
    db.tasksOf(3).find((t) => t.date === '2026-11-06')!.status = 'completed';
    const { body } = await reconcile('2026-11-07T08:00:00Z');
    const notOffered = db.tasksOf(3).filter((t) => t.notOffered && !t.isRestDay).map((t) => t.id);
    expect(body.days.filter((d: { taskId: string }) => notOffered.includes(d.taskId)).map((d: { kind: string }) => d.kind)).toEqual(['not_offered', 'not_offered', 'not_offered']);
    expect(body.gap).toBeNull();
    expect(body.carry.outcomes.filter((o: { taskId: string }) => notOffered.includes(o.taskId))).toEqual([]);
    expect(body.signals.line ?? null).toBeNull();
    expect(body.signals.dropped).toEqual([]);
    expect(body.signals.swapOffer).toBeNull();
    expect(body.carry.held).toEqual([]);
    expect(body.carry.choices.held).toEqual([]);
    expect((body.carry.choices.today?.swapWith ?? []).filter((id: string) => notOffered.includes(id))).toEqual([]);
  });

  it('classifyDays, findOpenGap and weekCounts: a day not offered is like a rest day', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    const task = (id: string, date: string, over: Record<string, unknown> = {}) => ({
      id, date, weekNumber: 3, dayNumber: Number(id.slice(1)), status: 'pending', isRestDay: false, isKeySession: false, isTestDay: false, ...over,
    });
    const tasks = [
      task('d1', '2026-10-05', { notOffered: true }),
      task('d2', '2026-10-06', { notOffered: true }),
      task('d3', '2026-10-07', { notOffered: true, status: 'completed' }),
      task('d4', '2026-10-08'),
      task('d5', '2026-10-09'),
      task('d6', '2026-10-12'),
    ];
    const days = classifyDays(tasks, { now, timezone: 'UTC', sleepTime: '23:00' });
    expect(days.map((d) => d.kind)).toEqual(['not_offered', 'not_offered', 'not_offered', 'missed', 'missed', 'planned']);
    // Two missed days only: not a gap (three not-offered days neither count nor break the run).
    expect(findOpenGap(days)).toBeNull();
    const counts = weekCounts(3, { days, tasks: tasks.map((t) => ({ ...t, usedMinimumVersion: false })), carry: { alreadyCarried: [], drops: [] } } as never);
    expect(counts).toMatchObject({ practicePlanned: 3, practiceDone: 0, missed: 2, keySessions: 0 });
    // Review fix 4: the stored flag alone leaves a day out, whatever the day list says.
    const byFlag = weekCounts(3, { days: days.map((d) => ({ ...d, kind: 'missed' as const })), tasks: tasks.map((t) => ({ ...t, usedMinimumVersion: false })), carry: { alreadyCarried: [], drops: [] } } as never);
    expect(byFlag).toMatchObject({ practicePlanned: 3, missed: 3 });
  });

  it('the handoff: days not offered count as not done for the queue only, never as a gap or no room', () => {
    const parse = (t: { detailedSteps: string }) => JSON.parse(t.detailedSteps);
    const tasks = lessonDays(weekStart(3), 100, 'Model').map((day, i) => ({
      id: `t${i}`, date: day.date, weekNumber: 3, dayNumber: 14 + day.dayNumber, dayOfWeek: day.dayOfWeek, isRestDay: day.isRestDay, isKeySession: false, isTestDay: day.isTestDay,
      // Mon to Wed not offered; the rest done.
      notOffered: !day.isRestDay && i <= 3,
      status: !day.isRestDay && i > 3 ? 'completed' : 'pending',
      steps: parse({ detailedSteps: JSON.stringify(day.detailedSteps) }),
    }));
    const handoff = weekHandoff({ tasks, profile: LANGUAGE });
    expect(handoff.carried.find((k) => k.kind === LESSON)!.steps.map((s) => s.title)).toEqual(['Model lesson 100', 'Model lesson 101', 'Model lesson 102']);
    expect(handoff.noRoom).toEqual([]);
    expect(handoff.unfinished).toEqual([]);
  });
});

describe('the score (WU-33 (3))', () => {
  const row = (over: Record<string, unknown>) => ({ isRestDay: false, notOffered: false, status: 'pending', ...over }) as never;

  it('leaves days not offered out of the planned count', () => {
    const tasks = [row({ notOffered: true }), row({ notOffered: true }), row({ status: 'completed' }), row({}), row({ isRestDay: true })];
    expect(weekScore(tasks)).toEqual({ sessions: 2, planned: 2, completed: 1, score: 50 });
  });

  it('a week whose every day is not offered has no score, never a divide by zero', () => {
    expect(weekScore([row({ notOffered: true }), row({ notOffered: true }), row({ isRestDay: true })])).toEqual({ sessions: 0, planned: 0, completed: 0, score: null });
    // Without days not offered nothing changes (a week with no practice day keeps planned 1, score 0).
    expect(weekScore([row({ isRestDay: true })])).toEqual({ sessions: 0, planned: 1, completed: 0, score: 0 });
  });

  it('phaseGate reports no benchmark for a week with no score', () => {
    const stored = { phases: [{ name: 'Base', purpose: '', startWeek: 1, endWeek: 2 }] } as never;
    expect(phaseGate(stored, 2, null)).toMatchObject({ completedPhase: 'Base', benchmarkMet: null });
    expect(phaseGate(stored, 2, 80)).toMatchObject({ benchmarkMet: true });
  });

  it('closing such a week: executionScore stays empty, the review row stores 0 of 0, the answer has no benchmark', async () => {
    closeOn();
    seed({}, { notOffered: true });
    const res = await closeWeek(atGap(0));
    expect(res.status).toBe(200);
    expect(db.week(2)).toMatchObject({ status: 'completed', executionScore: null });
    expect(db.state.reviews[0]).toMatchObject({ tasksPlanned: 0, tasksCompleted: 0, scorePercentage: 0 });
    expect(res.body).toMatchObject({ scorePercentage: 0, isMilestoneCheckpoint: true, milestoneGateTransition: { completedPhase: 'Base', benchmarkMet: null } });
  });

  it('a review of such a week saves "No practice days were offered this week.", not "0 of 0 sessions done." (review fix 2)', async () => {
    seed({}, { notOffered: true });
    const res = await reviewWeek2(atGap(0));
    expect(res.status).toBe(200);
    expect(res.body.review).toMatchObject({ tasksPlanned: 0, tasksCompleted: 0, scorePercentage: 0, aiAdaptationInsight: NOT_OFFERED_WEEK_INSIGHT });
    expect(db.week(2).executionScore).toBeNull();
  });
});
