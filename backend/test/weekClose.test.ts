import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M1.2a (RULE-8, RULE-9, RULE-11, RULE-18, WU-27, WU-30): the review's guard in every switch state, and
// POST /api/goal/close-week behind WEEK_CLOSE_ENABLED. Prisma is the in-memory store in weekCloseStore.ts, so the real
// saveWeekTasks and writeNextWeek run; only the model call (generateWeekPlan) is replaced.

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
import { weekCloseEnabled, weeklyUpdateEnabled } from '../src/lib/weekClose/switch.js';
import { AUTO_CLOSE_INSIGHT, gapDays } from '../src/lib/weekClose/close.js';
import { FALLBACK_HOLD_INSIGHT } from '../src/lib/weekClose/update.js';

const USER = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };
const START = new Date('2026-09-21T00:00:00Z'); // a Monday
const target = { kind: 'number', metric: 'Words', value: 100, unit: 'words', direction: 'higher_is_better' };
const test = { type: 'quiz', instructions: 'Take the quiz', passIf: '80%' };
const SWITCHES = ['WEEK_CLOSE_ENABLED', 'WEEKLY_UPDATE_ENABLED'] as const;

/** Week 1 closes at 01:00 on Monday 2026-09-28 (bedtime 23:00 plus 2 hours, UTC). */
const BEFORE_CLOSE = '2026-09-28T00:30:00Z';
const MORNING_AFTER = '2026-09-28T08:00:00Z';

function dayPlans(weekStart: Date): WeekDayPlan[] {
  return weekLayout('steady', weekStart).map((day) => ({
    ...day,
    title: `Session ${day.date}`,
    durationMinutes: day.isRestDay ? 0 : 30,
    slotTime: '19:30',
    implementationIntention: '',
    detailedSteps: day.isRestDay ? [] : [{ stepNumber: 1, title: `Practice ${day.date}`, durationMinutes: 30, instructions: 'Practice.', focusCue: '', pitfallToAvoid: '', priority: 1 }],
    isKeySession: false,
    whyToday: '',
    minimumVersion: null,
  }));
}

/** A plan v2 goal on `currentWeek`, with that week written and `active`, earlier weeks closed by review. */
function seed(currentWeek = 1, over: Record<string, unknown> = {}) {
  db.state.goals.push({
    id: 'g1',
    userId: USER.id,
    status: 'active',
    planVersion: 2,
    currentWeek,
    rawGoal: 'Learn Spanish',
    clarifiedOutcome: 'Hold a conversation',
    startDate: START,
    targetDate: new Date('2026-12-14T00:00:00Z'),
    routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady', sleepTime: '23:00', preferredSlot: 'evening' }),
    roadmap: {
      finalGoal: 'Hold a conversation',
      finalTest: '',
      startingPoint: {},
      method: { name: 'Lessons', creator: '', rules: ['One lesson at a time'] },
      phases: [{ name: 'Base', purpose: 'Build.' }],
      answers: [],
      recovery: RECOVERY_TEMPLATES.language,
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
      phase: 'Base',
      theme: `Theme ${weekNumber}`,
      target,
      test,
      status: weekNumber < currentWeek ? 'completed' : weekNumber === currentWeek ? 'active' : 'pending',
      testResult: null,
      executionScore: null,
      reviewNotes: null,
      closedBy: weekNumber < currentWeek ? 'review' : null,
      closedAt: null,
    });
  }
  const weekStart = new Date(START.getTime() + (currentWeek - 1) * 7 * 86_400_000);
  dayPlans(weekStart).forEach((day, index) => {
    db.state.tasks.push({
      id: `w${currentWeek}d${day.dayNumber}`,
      goalId: 'g1',
      weekNumber: currentWeek,
      dayNumber: (currentWeek - 1) * 7 + day.dayNumber,
      date: day.date,
      dayOfWeek: day.dayOfWeek,
      title: day.title,
      isRestDay: day.isRestDay,
      isKeySession: false,
      isTestDay: day.isTestDay,
      status: !day.isRestDay && index < 3 ? 'completed' : 'pending',
      usedMinimumVersion: false,
      notOffered: false,
      notes: null,
      durationMinutes: day.durationMinutes,
      detailedSteps: JSON.stringify(day.detailedSteps),
    });
  });
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
  vi.setSystemTime(new Date(MORNING_AFTER));
  vi.mocked(getAuthUser).mockResolvedValue(USER as never);
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => dayPlans(input.weekStart));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const name of SWITCHES) vi.stubEnv(name, '');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const post = async (path: string, body: unknown = {}) => {
  const res = await fetch(`${baseUrl}/api/goal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};
const review = (weekNumber = 1, body: unknown = { reflection: 'Went fine' }) => post(`/weeks/${weekNumber}/review`, body);
const closeWeek = (body: unknown = {}) => post('/close-week', body);
const snapshot = () => structuredClone(db.state);
const closeLines = () => vi.mocked(console.log).mock.calls.map((args) => String(args[0])).filter((line) => line.startsWith('[WeekClose]'));

/** Lets the model call return only once `count` calls are waiting, so racing requests both pass the guard. */
function holdModelCalls(count: number) {
  let waiting = 0;
  let release!: () => void;
  const all = new Promise<void>((resolve) => (release = resolve));
  vi.mocked(generateWeekPlan).mockImplementation(async (input) => {
    if (++waiting === count) release();
    await all;
    return dayPlans(input.weekStart);
  });
}

describe('the switches (RULE-18)', () => {
  it('each is on only when exactly "true"; the update switch acts only with the week close on', () => {
    expect(weekCloseEnabled()).toBe(false);
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'TRUE');
    expect(weekCloseEnabled()).toBe(false);
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
    expect(weeklyUpdateEnabled()).toBe(false);
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    expect(weekCloseEnabled()).toBe(true);
    expect(weeklyUpdateEnabled()).toBe(true);
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', '1');
    expect(weeklyUpdateEnabled()).toBe(false);
  });
});

describe.each([
  ['both switches off', {}],
  ['only WEEK_CLOSE_ENABLED on', { WEEK_CLOSE_ENABLED: 'true' }],
  ['both switches on', { WEEK_CLOSE_ENABLED: 'true', WEEKLY_UPDATE_ENABLED: 'true' }],
])('the review guard (B-59, WU-27), %s', (_name, env: Record<string, string>) => {
  beforeEach(() => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  });

  it('an on-time review closes the week once, in one save, marked as closed by review', async () => {
    seed(1);
    vi.setSystemTime(new Date('2026-09-27T15:00:00Z'));
    const res = await review();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nextWeekNumber: 2, scorePercentage: 60, testResult: null });
    expect(res.body.nextWeekTasks).toHaveLength(7);
    expect(db.week(1)).toMatchObject({ status: 'completed', closedBy: 'review', closedAt: new Date('2026-09-27T15:00:00Z'), reviewNotes: 'Went fine', executionScore: 60 });
    expect(db.week(2).status).toBe('active');
    expect(db.goal().currentWeek).toBe(2);
    expect(db.tasksOf(2)).toHaveLength(7);
    // M3.1: with both switches on the review runs the weekly update; with no model here it is the fallback, and the test
    // was not logged, so it keeps next week at this week's target with its own line (WU-48).
    const insight = env.WEEKLY_UPDATE_ENABLED ? FALLBACK_HOLD_INSIGHT : '3 of 5 sessions done.';
    expect(db.state.reviews).toEqual([expect.objectContaining({ weekNumber: 1, reflection: 'Went fine', aiAdaptationInsight: insight })]);
    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(closeLines()).toEqual([expect.stringMatching(/^\[WeekClose\] goal g1 week 1 by review gapDays 0 ms \d+$/)]);
  });

  it('a repeat review is refused with week_closed and makes no model call', async () => {
    seed(1);
    expect((await review()).status).toBe(200);
    const after = snapshot();
    const repeat = await review();
    expect(repeat).toEqual({ status: 409, body: { error: 'This week has already been reviewed.', reason: 'week_closed' } });
    expect(generateWeekPlan).toHaveBeenCalledTimes(1);
    expect(db.state).toEqual(after);
  });

  it('an old or a future week is refused with week_closed and makes no model call', async () => {
    seed(2);
    const before = snapshot();
    expect(await review(1)).toMatchObject({ status: 409, body: { reason: 'week_closed' } });
    expect(await review(3)).toMatchObject({ status: 409, body: { reason: 'week_closed' } });
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('two racing reviews: both may call the model, the loser of the conditional update saves nothing', async () => {
    seed(1);
    holdModelCalls(2);
    const results = await Promise.all([review(1, { reflection: 'First' }), review(1, { reflection: 'Second' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)!.body.reason).toBe('week_closed');
    expect(generateWeekPlan).toHaveBeenCalledTimes(2);
    expect(db.state.reviews).toHaveLength(1);
    expect(db.tasksOf(2)).toHaveLength(7);
    expect(db.week(1).reviewNotes).toBe(db.state.reviews[0].reflection);
    expect(closeLines()).toHaveLength(1);
  });

  it('a failure inside the save saves nothing, and the next try closes the week', async () => {
    seed(1);
    const before = snapshot();
    db.failCreate = true;
    expect((await review()).status).toBe(500);
    expect(db.state).toEqual(before);
    expect(closeLines()).toEqual([]);

    db.failCreate = false;
    expect((await review()).status).toBe(200);
    expect(db.week(1).status).toBe('completed');
  });

  it('week 12 closes with its review row and writes no week', async () => {
    seed(12);
    vi.setSystemTime(new Date('2026-12-13T15:00:00Z'));
    const res = await review(12);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nextWeekNumber: null, nextWeekTasks: [] });
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.week(12)).toMatchObject({ status: 'completed', closedBy: 'review' });
    expect(db.state.reviews).toHaveLength(1);
    expect(db.goal().currentWeek).toBe(12);
    expect((await review(12)).status).toBe(409);
  });
});

describe('POST /api/goal/close-week (RULE-8, RULE-9)', () => {
  const closeOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');

  it('switch off: { due: false }, reads nothing and writes nothing, even when a close is due', async () => {
    seed(1);
    const before = snapshot();
    for (const value of ['', 'TRUE', '1', 'yes']) {
      vi.stubEnv('WEEK_CLOSE_ENABLED', value);
      vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
      expect(await closeWeek()).toEqual({ status: 200, body: { due: false } });
    }
    expect(db.prisma.goal.findFirst).not.toHaveBeenCalled();
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('M4.1b, AC-19 state A: with both switches unset, { due: false } in both modes, reading and writing nothing', async () => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', '');
    seed(1);
    const before = snapshot();
    expect(await closeWeek({ mode: 'check' })).toEqual({ status: 200, body: { due: false } });
    expect(await closeWeek()).toEqual({ status: 200, body: { due: false } });
    expect(db.prisma.goal.findFirst).not.toHaveBeenCalled();
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('a goal that is not plan v2 is refused with not_plan_v2', async () => {
    closeOn();
    seed(1, { planVersion: 1 });
    expect(await closeWeek()).toMatchObject({ status: 409, body: { reason: 'not_plan_v2' } });
  });

  it('not due before the last day has closed: { due: false } and no writes', async () => {
    closeOn();
    seed(1);
    const before = snapshot();
    vi.setSystemTime(new Date(BEFORE_CLOSE));
    expect(await closeWeek()).toEqual({ status: 200, body: { due: false } });
    expect(await closeWeek({ mode: 'check' })).toEqual({ status: 200, body: { due: false } });
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('due: closes the week as the review would, with no reflection, the neutral line and closedBy auto', async () => {
    closeOn();
    seed(1);
    const res = await closeWeek();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ due: true, closedBy: 'auto', nextWeekNumber: 2, scorePercentage: 60, isMilestoneCheckpoint: false, testResult: null });
    expect(res.body.review).toMatchObject({ weekNumber: 1, reflection: '', aiAdaptationInsight: AUTO_CLOSE_INSIGHT });
    expect(AUTO_CLOSE_INSIGHT).toBe('Next week is ready. Your targets stay as planned.');
    expect(res.body.nextWeekTasks).toHaveLength(7);
    const now = new Date(MORNING_AFTER);
    expect(db.week(1)).toMatchObject({ status: 'completed', closedBy: 'auto', closedAt: now, reviewNotes: '', executionScore: 60 });
    expect(db.week(2).status).toBe('active');
    expect(db.goal()).toMatchObject({ currentWeek: 2, closeTriedAt: now, closeTriedWeek: 1 });
    expect(closeLines()).toEqual([expect.stringMatching(/^\[WeekClose\] goal g1 week 1 by auto gapDays 0 ms \d+$/)]);
  });

  it('a close and a review store the week the same, apart from the reflection, the line and closedBy', async () => {
    seed(1);
    await review(1, { reflection: '' });
    const reviewed = snapshot();
    const reviewInput = vi.mocked(generateWeekPlan).mock.calls[0][0];

    db.reset();
    vi.clearAllMocks();
    closeOn();
    seed(1);
    await closeWeek();
    const closed = snapshot();
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0]).toEqual(reviewInput);

    const strip = (state: ReturnType<typeof snapshot>) => ({
      weeks: state.weeks.map(({ closedBy, closedAt, ...week }) => week),
      tasks: state.tasks.map(({ id, ...task }) => task),
      goals: state.goals.map(({ closeTriedAt, closeTriedWeek, ...goal }) => goal),
      reviews: state.reviews.map(({ id, aiAdaptationInsight, ...row }) => row),
    });
    expect(strip(closed)).toEqual(strip(reviewed));
    expect(reviewed.weeks[0].closedBy).toBe('review');
    expect(closed.weeks[0].closedBy).toBe('auto');
  });

  it('a close and a review answer with the same fields for the same week (closeAnswer)', async () => {
    seed(1);
    const reviewed = await review(1, { reflection: '' });
    db.reset();
    closeOn();
    seed(1);
    const closed = await closeWeek();
    const { due, closedBy, ...shared } = closed.body;
    expect({ due, closedBy }).toEqual({ due: true, closedBy: 'auto' });
    expect(Object.keys(shared)).toEqual(Object.keys(reviewed.body));
    const withoutReview = ({ review: _review, ...rest }: Record<string, unknown>) => rest;
    expect(withoutReview(shared)).toEqual(withoutReview(reviewed.body));
    const { id: _a, aiAdaptationInsight: _b, ...reviewRow } = reviewed.body.review;
    const { id: _c, aiAdaptationInsight: _d, ...closeRow } = shared.review;
    expect(closeRow).toEqual(reviewRow);
  });

  it('the save runs with a 15 s transaction timeout', async () => {
    closeOn();
    seed(1);
    await closeWeek();
    expect(db.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 15_000 });
  });

  it('check mode answers due, the week and whether its test is logged, and closes nothing', async () => {
    closeOn();
    seed(1);
    expect(await closeWeek({ mode: 'check' })).toEqual({ status: 200, body: { due: true, weekNumber: 1, testLogged: false, break: false, choice: null } });
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.week(1).status).toBe('active');
    expect(db.goal()).toMatchObject({ currentWeek: 1, closeTriedAt: new Date(MORNING_AFTER), closeTriedWeek: 1 });

    db.week(1).testResult = { value: 12, passed: true };
    expect((await closeWeek({ mode: 'check' })).body).toEqual({ due: true, weekNumber: 1, testLogged: true, break: false, choice: null });
  });

  it('the first try is kept: a failed week write saves only the try, and later tries keep its time', async () => {
    closeOn();
    seed(1);
    vi.mocked(generateWeekPlan).mockResolvedValue(null);
    expect(await closeWeek()).toEqual({ status: 503, body: { error: "Couldn't get your next week ready. Please try again." } });
    expect(db.week(1)).toMatchObject({ status: 'active', closedBy: null });
    expect(db.tasksOf(2)).toEqual([]);
    expect(db.state.reviews).toEqual([]);
    expect(db.goal()).toMatchObject({ currentWeek: 1, closeTriedAt: new Date(MORNING_AFTER), closeTriedWeek: 1 });

    vi.setSystemTime(new Date('2026-09-30T09:00:00Z'));
    expect((await closeWeek()).status).toBe(503);
    vi.mocked(generateWeekPlan).mockImplementation(async (input) => dayPlans(input.weekStart));
    expect((await closeWeek()).status).toBe(200);
    expect(db.goal()).toMatchObject({ currentWeek: 2, closeTriedAt: new Date(MORNING_AFTER), closeTriedWeek: 1 });
    expect(closeLines()).toEqual([expect.stringMatching(/week 1 by auto gapDays 2 ms/)]);
  });

  it('week 12: marks it closed automatically, writes no week and no review row', async () => {
    closeOn();
    seed(12);
    vi.setSystemTime(new Date('2026-12-14T08:00:00Z'));
    const res = await closeWeek();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ due: true, closedBy: 'auto', review: null, nextWeekNumber: null, nextWeekTasks: [] });
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expect(db.week(12)).toMatchObject({ status: 'completed', closedBy: 'auto', closedAt: new Date('2026-12-14T08:00:00Z') });
    expect(db.state.reviews).toEqual([]);
    expect(db.goal().currentWeek).toBe(12);
    expect(await closeWeek()).toEqual({ status: 200, body: { due: false } });
  });

  it('a repeat after the close is not due and writes nothing', async () => {
    closeOn();
    seed(1);
    expect((await closeWeek()).status).toBe(200);
    const after = snapshot();
    expect(await closeWeek()).toEqual({ status: 200, body: { due: false } });
    expect(generateWeekPlan).toHaveBeenCalledTimes(1);
    expect(db.state).toEqual(after);
  });

  it('two racing closes close once; the loser saves nothing and answers with the week as already closed', async () => {
    closeOn();
    seed(1);
    holdModelCalls(2);
    const results = await Promise.all([closeWeek(), closeWeek()]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    const bodies = results.map((r) => r.body);
    expect(bodies).toContainEqual(expect.objectContaining({ due: true, closedBy: 'auto', nextWeekNumber: 2 }));
    expect(bodies).toContainEqual({ due: false, alreadyClosed: true, weekNumber: 1 });
    expect(generateWeekPlan).toHaveBeenCalledTimes(2);
    expect(db.state.reviews).toHaveLength(1);
    expect(db.tasksOf(2)).toHaveLength(7);
    expect(db.goal()).toMatchObject({ currentWeek: 2, closeTriedWeek: 1, closeTriedAt: new Date(MORNING_AFTER) });
    expect(closeLines()).toHaveLength(1);
  });

  it('a review racing an automatic close: one closes the week, the other saves nothing', async () => {
    closeOn();
    seed(1);
    holdModelCalls(2);
    const [byReview, byClose] = await Promise.all([review(1, { reflection: 'Late' }), closeWeek()]);
    const reviewWon = byReview.status === 200;
    expect(reviewWon ? byClose.body : byReview.body).toEqual(reviewWon ? { due: false, alreadyClosed: true, weekNumber: 1 } : { error: 'This week has already been reviewed.', reason: 'week_closed' });
    expect(db.state.reviews).toHaveLength(1);
    expect(db.tasksOf(2)).toHaveLength(7);
    expect(db.week(1).closedBy).toBe(reviewWon ? 'review' : 'auto');
  });
});

describe('gapDays (WU-30 log line)', () => {
  it('counts days from the new week planned start to now in the person time zone', () => {
    expect(gapDays(START, 1, new Date('2026-09-28T08:00:00Z'), 'UTC')).toBe(0);
    expect(gapDays(START, 1, new Date('2026-09-27T20:00:00Z'), 'UTC')).toBe(0);
    expect(gapDays(START, 1, new Date('2026-10-01T08:00:00Z'), 'UTC')).toBe(3);
    // 23:30 UTC on the 28th is already the 29th in Tokyo.
    expect(gapDays(START, 1, new Date('2026-09-28T23:30:00Z'), 'Asia/Tokyo')).toBe(1);
    expect(gapDays(new Date('invalid'), 1, new Date(), 'UTC')).toBe(0);
  });
});

describe('the close line and a late reflection (weekly update M1.2b, WU-28, WU-31)', () => {
  const lineSeen = (weekNumber = 1) => post(`/weeks/${weekNumber}/close-line-seen`);
  const reflect = (weekNumber = 1, reflection: unknown = 'It went well') => post(`/weeks/${weekNumber}/reflection`, { reflection });
  const closedAuto = async () => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    seed(1);
    expect((await closeWeek()).body).toMatchObject({ due: true, closedBy: 'auto' });
  };

  describe.each([[''], ['TRUE'], ['1']])('with WEEK_CLOSE_ENABLED=%j', (value) => {
    it('both refuse and read nothing (RULE-18)', async () => {
      await closedAuto();
      vi.stubEnv('WEEK_CLOSE_ENABLED', value);
      vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
      const before = snapshot();
      vi.mocked(db.prisma.goal.findFirst).mockClear();
      for (const answer of [await lineSeen(), await reflect()]) {
        expect(answer).toEqual({ status: 409, body: { error: 'This action is not available yet.', reason: 'week_close_disabled' } });
      }
      expect(db.prisma.goal.findFirst).not.toHaveBeenCalled();
      expect(db.state).toEqual(before);
    });
  });

  it('M4.1b, AC-19 state A: with both switches unset, both refuse and read nothing', async () => {
    await closedAuto();
    vi.stubEnv('WEEK_CLOSE_ENABLED', '');
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', '');
    const before = snapshot();
    vi.mocked(db.prisma.goal.findFirst).mockClear();
    for (const answer of [await lineSeen(), await reflect()]) {
      expect(answer).toEqual({ status: 409, body: { error: 'This action is not available yet.', reason: 'week_close_disabled' } });
    }
    expect(db.prisma.goal.findFirst).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('records the line as seen once; a repeat keeps the first time', async () => {
    await closedAuto();
    expect(db.week(1).closeLineSeenAt ?? null).toBeNull();
    const first = await lineSeen();
    expect(first).toEqual({ status: 200, body: { closeLineSeenAt: new Date(MORNING_AFTER).toISOString() } });
    vi.setSystemTime(new Date('2026-09-28T09:00:00Z'));
    const again = await lineSeen();
    expect(again).toEqual({ status: 200, body: { closeLineSeenAt: new Date(MORNING_AFTER).toISOString() } });
    expect(db.week(1).closeLineSeenAt).toEqual(new Date(MORNING_AFTER));
  });

  it('the line: refuses a week the review closed, an open week and a week that is not there', async () => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    seed(2);
    const before = snapshot();
    expect(await lineSeen(1)).toEqual({ status: 409, body: { error: 'This week did not close on its own.', reason: 'not_auto_closed' } });
    expect((await lineSeen(2)).body.reason).toBe('not_auto_closed');
    expect((await lineSeen(13)).status).toBe(400);
    db.state.weeks = db.state.weeks.filter((w) => w.weekNumber !== 5);
    expect((await lineSeen(5)).status).toBe(404);
    expect(db.state.goals).toEqual(before.goals);
    expect(db.state.weeks.every((w) => (w.closeLineSeenAt ?? null) === null)).toBe(true);
  });

  it('only the signed-in person goal: another person closed week is never touched', async () => {
    await closedAuto();
    db.state.goals[0].userId = 'someone-else';
    expect((await lineSeen()).status).toBe(404);
    expect((await reflect()).status).toBe(404);
    expect(db.week(1).closeLineSeenAt ?? null).toBeNull();
    expect(db.week(1).reviewNotes).toBe('');
  });

  it('saves a lost review reflection onto the week closed automatically, and its review row; a repeat is fine', async () => {
    await closedAuto();
    expect(db.week(1).reviewNotes).toBe('');
    expect(await reflect(1, 'Typed in the other tab')).toEqual({ status: 200, body: { reflection: 'Typed in the other tab' } });
    expect(db.week(1).reviewNotes).toBe('Typed in the other tab');
    expect(db.state.reviews[0]).toMatchObject({ weekNumber: 1, reflection: 'Typed in the other tab', aiAdaptationInsight: AUTO_CLOSE_INSIGHT });
    expect(await reflect(1, 'Typed in the other tab')).toEqual({ status: 200, body: { reflection: 'Typed in the other tab' } });
    // A second, different reflection never replaces the first.
    expect(await reflect(1, 'Something else')).toEqual({ status: 409, body: { error: 'This week already has a reflection.', reason: 'reflection_saved' } });
    expect(db.week(1).reviewNotes).toBe('Typed in the other tab');
    expect(db.state.reviews[0].reflection).toBe('Typed in the other tab');
  });

  it('the reflection: refuses a week the review closed, an open week, and an empty reflection', async () => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    seed(2);
    const before = snapshot();
    expect(await reflect(1)).toEqual({ status: 409, body: { error: 'This week did not close on its own.', reason: 'not_auto_closed' } });
    expect((await reflect(2)).body.reason).toBe('not_auto_closed');
    expect((await reflect(1, '   ')).status).toBe(400);
    expect((await reflect(1, 42)).status).toBe(400);
    expect(db.state).toEqual(before);
  });
});
