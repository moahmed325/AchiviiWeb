import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M3.3b (WU-58 (1), (4), RULE-6, RULE-18, AC-5, AC-19): the goal response's `dailyTimeCheck`, and
// POST /api/goal/daily-time. No weekly tests (2026-10-30): a hard week is a closed week under half done
// (`executionScore`), and the check follows WEEK_CLOSE_ENABLED alone. Prisma is a small in-memory store.

const store = vi.hoisted(() => ({
  goal: null as any,
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn((store as any).prisma)),
    goal: { findFirst: vi.fn(), update: vi.fn() },
    roadmapWeek: { updateMany: vi.fn() },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: store.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { dailyTimeCheckOf } from '../src/lib/weekClose/dailyTime.js';

const SWITCHES = ['WEEK_CLOSE_ENABLED'] as const;

const week = (weekNumber: number, status: string, extra: Record<string, unknown> = {}) => ({
  id: `w${weekNumber}`,
  goalId: 'g1',
  weekNumber,
  status,
  executionScore: null,
  target: { kind: 'number', metric: 'Old target', value: 5, unit: 'km', direction: 'higher_is_better' },
  test: { type: 'skill', instructions: 'An old stored test', passIf: 'old' },
  testResult: null,
  dailyTimeAskedAt: null,
  jumped: false,
  ...extra,
});

/** Weeks 2 and 3 under half done, week 4 open. */
const hardGoal = (dailyMinutes = 60) => ({
  id: 'g1',
  userId: 'u1',
  status: 'active',
  planVersion: 2,
  currentWeek: 4,
  rawGoal: 'Learn guitar',
  routine: JSON.stringify({ dailyMinutes, planVariant: 'steady', preferredSlot: 'evening' }),
  roadmap: null,
  velocityTable: null,
  roadmapWeeks: [
    week(1, 'completed', { executionScore: 90 }),
    week(2, 'completed', { executionScore: 40 }),
    week(3, 'completed', { executionScore: 20, testResult: { value: 26, unit: 'min', passed: false } }),
    week(4, 'active'),
    week(5, 'pending'),
  ],
  dailyTasks: [{ id: 't22', weekNumber: 4, dayNumber: 22, date: '2026-10-19', detailedSteps: '[]' }],
  weeklyReviews: [],
});

describe('dailyTimeCheckOf (two weeks under half done)', () => {
  const weeks = (...scores: Array<number | null>) => [
    ...scores.map((executionScore, index) => week(index + 1, 'completed', { executionScore })),
    week(scores.length + 1, 'active'),
  ];

  it('asks after two closed weeks under half done, offering only shorter times', () => {
    expect(dailyTimeCheckOf(weeks(90, 49, 0), 60)).toEqual({ minutes: 60, shorter: [30, 45] });
  });

  it('not when either week reached half, had no day offered, or was jumped', () => {
    expect(dailyTimeCheckOf(weeks(90, 50, 10), 60)).toBeNull();
    expect(dailyTimeCheckOf(weeks(90, null, 10), 60)).toBeNull();
    const jumped = weeks(90, 10, 10);
    jumped[1].jumped = true;
    expect(dailyTimeCheckOf(jumped, 60)).toBeNull();
  });

  it('not in the last week, nor on the shortest time', () => {
    expect(dailyTimeCheckOf(weeks(10, 10, 10), 60, 4)).toBeNull();
    expect(dailyTimeCheckOf(weeks(10, 10), 30)).toBeNull();
  });

  it('once per run of hard weeks', () => {
    const run = weeks(10, 10, 10);
    run[2].dailyTimeAskedAt = new Date() as any;
    expect(dailyTimeCheckOf(run, 60)).toBeNull();
  });
});

describe('Daily time in goal responses (weekly update M3.3b)', () => {
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
    for (const name of SWITCHES) vi.stubEnv(name, '');
    store.goal = hardGoal();
    store.prisma.goal.findFirst.mockImplementation(async (args: any) =>
      store.goal && args.where.status === store.goal.status ? structuredClone(store.goal) : null
    );
    store.prisma.goal.update.mockImplementation(async (args: any) => {
      Object.assign(store.goal, args.data);
      return store.goal;
    });
    store.prisma.roadmapWeek.updateMany.mockImplementation(async (args: any) => {
      const row = store.goal.roadmapWeeks.find((w: any) => w.id === args.where.id);
      if (!row || ('dailyTimeAskedAt' in args.where && row.dailyTimeAskedAt !== args.where.dailyTimeAskedAt)) return { count: 0 };
      Object.assign(row, args.data);
      return { count: 1 };
    });
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u1@achivii.com' } as any);
  });

  afterEach(() => vi.unstubAllEnvs());

  const switchesOn = () => vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
  const active = async () => (await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json()).activeGoal;
  const answer = (body: unknown) =>
    fetch(`${baseUrl}/api/goal/daily-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    });

  describe('GET /active', () => {
    it('sends the daily-time check with the week close on', async () => {
      switchesOn();
      const goal = await active();
      expect(goal.dailyTimeCheck).toEqual({ minutes: 60, shorter: [30, 45] });
      expect(goal).not.toHaveProperty('retest');
    });

    it('no week carries updateStatus or an old stored target, test or result; the server still has them (RULE-3, no weekly tests)', async () => {
      store.goal.roadmapWeeks[1].updateStatus = 'far_behind';
      const goal = await active();
      expect(goal.roadmapWeeks).toHaveLength(store.goal.roadmapWeeks.length);
      for (const key of ['updateStatus', 'target', 'test', 'testResult', 'retestOfWeek']) {
        expect(goal.roadmapWeeks.some((w: Record<string, unknown>) => key in w), key).toBe(false);
      }
      expect(store.goal.roadmapWeeks[2].testResult).not.toBeNull();
    });

    it('an old roadmap is sent without its final test, checkpoints and lowered targets', async () => {
      store.goal.roadmap = { finalGoal: 'Play a song', method: { name: 'm' }, finalTest: { type: 'skill' }, checkpoints: [], loweredTargets: [], phases: [] };
      const goal = await active();
      expect(goal.roadmap).toEqual({ finalGoal: 'Play a song', method: { name: 'm' }, phases: [] });
    });

    it('AC-19: null with the week close unset', async () => {
      expect((await active()).dailyTimeCheck).toBeNull();
    });
  });

  describe('POST /daily-time', () => {
    it('409 week_close_disabled with the switch unset, before reading the goal, and nothing is written', async () => {
      const res = await answer({ minutes: 30 });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe('week_close_disabled');
      expect(store.prisma.goal.findFirst).not.toHaveBeenCalled();
      expect(store.prisma.roadmapWeek.updateMany).not.toHaveBeenCalled();
    });

    it('a shorter time sets dailyTimeAskedAt and routine.dailyMinutes, keeping the rest of the routine', async () => {
      switchesOn();
      const res = await answer({ minutes: 45 });
      expect(res.status).toBe(200);
      expect((await res.json()).dailyMinutes).toBe(45);
      expect(store.goal.roadmapWeeks[3].dailyTimeAskedAt).toBeInstanceOf(Date);
      expect(JSON.parse(store.goal.routine)).toEqual({ dailyMinutes: 45, planVariant: 'steady', preferredSlot: 'evening' });
      expect(store.prisma.$transaction).toHaveBeenCalledTimes(1);
      // Only the open week changed: no other week, and no task, is rewritten.
      expect(store.prisma.roadmapWeek.updateMany).toHaveBeenCalledTimes(1);
      expect(store.goal.roadmapWeeks.filter((w: any) => w.dailyTimeAskedAt)).toHaveLength(1);
    });

    it('keep sets dailyTimeAskedAt only', async () => {
      switchesOn();
      const res = await answer({ minutes: 60 });
      expect(res.status).toBe(200);
      expect(store.goal.roadmapWeeks[3].dailyTimeAskedAt).toBeInstanceOf(Date);
      expect(store.prisma.goal.update).not.toHaveBeenCalled();
      expect(JSON.parse(store.goal.routine).dailyMinutes).toBe(60);
    });

    it('asked once: a second answer is refused 409 no_daily_time_check, and the check is then null', async () => {
      switchesOn();
      expect((await answer({ minutes: 60 })).status).toBe(200);
      const again = await answer({ minutes: 30 });
      expect(again.status).toBe(409);
      expect((await again.json()).reason).toBe('no_daily_time_check');
      expect(JSON.parse(store.goal.routine).dailyMinutes).toBe(60);
      expect((await active()).dailyTimeCheck).toBeNull();
    });

    it('409 no_daily_time_check without two hard weeks, or on the shortest daily time', async () => {
      switchesOn();
      store.goal.roadmapWeeks[1].executionScore = 60;
      expect((await (await answer({ minutes: 30 })).json()).reason).toBe('no_daily_time_check');
      store.goal = hardGoal(30);
      expect((await (await answer({ minutes: 30 })).json()).reason).toBe('no_daily_time_check');
      expect(store.prisma.roadmapWeek.updateMany).not.toHaveBeenCalled();
    });

    it('400 for minutes that are neither the current time nor a shorter option, and nothing is written', async () => {
      switchesOn();
      for (const minutes of [90, 20, '30', null, undefined]) {
        const res = await answer({ minutes });
        expect(res.status).toBe(400);
      }
      expect(store.prisma.roadmapWeek.updateMany).not.toHaveBeenCalled();
      expect(store.prisma.goal.update).not.toHaveBeenCalled();
    });

    it('404 with no active goal, 401 without a user', async () => {
      switchesOn();
      store.goal.status = 'archived';
      expect((await answer({ minutes: 30 })).status).toBe(404);
      vi.mocked(getAuthUser).mockResolvedValue(null as any);
      expect((await answer({ minutes: 30 })).status).toBe(401);
    });
  });
});
