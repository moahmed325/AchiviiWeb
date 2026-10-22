import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Weekly update M3.3b (WU-58 (1), (4), RULE-6, RULE-18, AC-5, AC-19): the goal response's `retest` and
// `dailyTimeCheck`, and POST /api/goal/daily-time. Prisma is a small in-memory store.

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

const SWITCHES = ['WEEK_CLOSE_ENABLED', 'WEEKLY_UPDATE_ENABLED'] as const;
const RESULT = { value: 26, unit: 'min', passed: false };

const week = (weekNumber: number, status: string, extra: Record<string, unknown> = {}) => ({
  id: `w${weekNumber}`,
  goalId: 'g1',
  weekNumber,
  status,
  retestOfWeek: null,
  updateStatus: null,
  testResult: null,
  dailyTimeAskedAt: null,
  jumped: false,
  ...extra,
});

/** Weeks 2 and 3 far_behind, week 3 logged, week 4 open and re-testing week 3. */
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
    week(1, 'completed', { updateStatus: 'on_track' }),
    week(2, 'completed', { updateStatus: 'far_behind' }),
    week(3, 'completed', { updateStatus: 'far_behind', testResult: RESULT }),
    week(4, 'active', { retestOfWeek: 3 }),
    week(5, 'pending'),
  ],
  dailyTasks: [],
  weeklyReviews: [],
});

describe('Daily time and the re-test in goal responses (weekly update M3.3b)', () => {
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

  const switchesOn = () => {
    vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
    vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
  };
  const active = async () => (await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json()).activeGoal;
  const answer = (body: unknown) =>
    fetch(`${baseUrl}/api/goal/daily-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    });

  describe('GET /active', () => {
    it('sends the re-test and the daily-time check with both switches on', async () => {
      switchesOn();
      const goal = await active();
      expect(goal.retest).toEqual({ ofWeek: 3, reason: 'two_hard_weeks', logged: false });
      expect(goal.dailyTimeCheck).toEqual({ minutes: 60, shorter: [30, 45] });
    });

    it('logged once the re-tested week holds a result logged in the open week', async () => {
      switchesOn();
      store.goal.roadmapWeeks[2].testResult = { ...RESULT, retestLoggedInWeek: 4 };
      expect((await active()).retest).toEqual({ ofWeek: 3, reason: 'two_hard_weeks', logged: true });
    });

    it('both null with no re-test', async () => {
      switchesOn();
      store.goal.roadmapWeeks[3].retestOfWeek = null;
      const goal = await active();
      expect(goal.retest).toBeNull();
      expect(goal.dailyTimeCheck).toBeNull();
    });

    it('AC-19: both null with both switches unset, even with a stored re-test, and with only one on', async () => {
      let goal = await active();
      expect(goal.retest).toBeNull();
      expect(goal.dailyTimeCheck).toBeNull();
      vi.stubEnv('WEEK_CLOSE_ENABLED', 'true');
      goal = await active();
      expect(goal.retest).toBeNull();
      expect(goal.dailyTimeCheck).toBeNull();
    });
  });

  describe('POST /daily-time', () => {
    it('409 weekly_update_disabled with both switches unset, before reading the goal', async () => {
      const res = await answer({ minutes: 30 });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe('weekly_update_disabled');
      expect(store.prisma.goal.findFirst).not.toHaveBeenCalled();
    });

    it('409 weekly_update_disabled with only WEEKLY_UPDATE_ENABLED on', async () => {
      vi.stubEnv('WEEKLY_UPDATE_ENABLED', 'true');
      expect((await (await answer({ minutes: 30 })).json()).reason).toBe('weekly_update_disabled');
      expect(store.prisma.goal.findFirst).not.toHaveBeenCalled();
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
      store.goal.roadmapWeeks[1].updateStatus = 'a_bit_behind';
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
