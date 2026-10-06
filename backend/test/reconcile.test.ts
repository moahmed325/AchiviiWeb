import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    weeklyReview: { upsert: vi.fn(), update: vi.fn() },
    roadmapWeek: { update: vi.fn(), createMany: vi.fn() },
    dailyTask: { create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

/** Every Prisma method that writes. None may ever be called by reconcile (ND-2). */
const writeMocks = () => [
  prisma.goal.update,
  prisma.goal.updateMany,
  prisma.goal.deleteMany,
  prisma.goal.create,
  prisma.weeklyReview.upsert,
  prisma.weeklyReview.update,
  prisma.roadmapWeek.update,
  prisma.roadmapWeek.createMany,
  prisma.dailyTask.create,
  prisma.dailyTask.createMany,
  (prisma.dailyTask as any).update,
  (prisma.dailyTask as any).updateMany,
  prisma.dailyTask.deleteMany,
];

/** The UTC instant of a local wall time in Addis Ababa (UTC+3, no DST). */
const addis = (date: string, time: string) => new Date(Date.parse(`${date}T${time}:00Z`) - 3 * 3_600_000);

const user = { id: 'usr-reconcile', email: 'reconcile@achivii.com', timezone: 'Africa/Addis_Ababa' };

let n = 0;
const task = (date: string, over: Record<string, unknown> = {}) => ({
  id: `t${++n}`,
  date,
  weekNumber: 1,
  dayNumber: Number(date.slice(8)),
  status: 'pending',
  isRestDay: false,
  isKeySession: false,
  isTestDay: false,
  ...over,
});

const goal = (dailyTasks: unknown[], over: Record<string, unknown> = {}) => ({
  id: 'goal-v2',
  planVersion: 2,
  routine: JSON.stringify({ sleepTime: '23:00', dailyMinutes: 30, planVariant: 'steady' }),
  dailyTasks,
  ...over,
});

describe('POST /api/goal/reconcile (missed sessions M1.3)', () => {
  let server: Server;
  let baseUrl: string;

  const reconcile = async (token: string | null = 'token') => {
    const res = await fetch(`${baseUrl}/api/goal/reconcile`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return { status: res.status, body: await res.json() };
  };

  /** Signs in `user`, serves `activeGoal`, and sets the clock. */
  const given = (activeGoal: unknown, now: Date, who: unknown = user) => {
    (getAuthUser as any).mockResolvedValue(who);
    (prisma.goal.findFirst as any).mockResolvedValue(activeGoal);
    vi.setSystemTime(now);
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/goal', goalRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('Failed to bind ephemeral test server');
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Only Date is faked, so the HTTP server and fetch keep real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    for (const write of writeMocks()) expect(write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns 401 without a signed-in user', async () => {
    (getAuthUser as any).mockResolvedValue(null);
    const { status, body } = await reconcile(null);
    expect(status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized.' });
    expect(prisma.goal.findFirst).not.toHaveBeenCalled();
  });

  it('looks only at the active goal and reports when there is none', async () => {
    given(null, addis('2026-09-24', '10:00'));
    const { status, body } = await reconcile();
    expect(status).toBe(200);
    expect(body).toEqual({ applies: false, reason: 'no_active_goal' });
    const query = (prisma.goal.findFirst as any).mock.calls[0][0];
    expect(query.where).toEqual({ userId: user.id, status: 'active' });
  });

  it('leaves an old (plan v1) goal alone, even with a closed pending day (AC-14)', async () => {
    given(goal([task('2026-09-20')], { planVersion: 1 }), addis('2026-09-24', '10:00'));
    const { status, body } = await reconcile();
    expect(status).toBe(200);
    expect(body).toEqual({ applies: false, reason: 'not_plan_v2' });
  });

  it('EV-2: yesterday is open before its close and missed from it (AC-1)', async () => {
    const tasks = [
      task('2026-09-22', { status: 'completed' }),
      task('2026-09-23'),
      task('2026-09-24'),
    ];

    given(goal(tasks), addis('2026-09-24', '00:40'));
    const before = await reconcile();
    expect(before.status).toBe(200);
    // M2.2 adds `carry`; every field that was there before is unchanged.
    const { carry, ...existing } = before.body;
    expect(carry).toMatchObject({ enabled: false, carries: [], held: [], alreadyCarried: [], written: [] });
    expect(existing).toEqual({
      applies: true,
      goalId: 'goal-v2',
      asOf: '2026-09-23T21:40:00.000Z',
      timezone: 'Africa/Addis_Ababa',
      days: [
        { taskId: tasks[0].id, date: '2026-09-22', weekNumber: 1, dayNumber: 22, isKeySession: false, isTestDay: false, kind: 'done' },
        { taskId: tasks[1].id, date: '2026-09-23', weekNumber: 1, dayNumber: 23, isKeySession: false, isTestDay: false, kind: 'planned' },
        { taskId: tasks[2].id, date: '2026-09-24', weekNumber: 1, dayNumber: 24, isKeySession: false, isTestDay: false, kind: 'planned' },
      ],
      gap: null,
    });

    given(goal(tasks), addis('2026-09-24', '01:00'));
    const after = await reconcile();
    expect(after.body.asOf).toBe('2026-09-23T22:00:00.000Z');
    expect(after.body.days.map((d: any) => d.kind)).toEqual(['done', 'missed', 'planned']);
    expect(after.body.gap).toBeNull();
  });

  it('never reports a rest day as missed (AC-5)', async () => {
    given(goal([task('2026-09-20', { isRestDay: true }), task('2026-09-21', { isRestDay: true, status: 'completed' })]), addis('2026-09-24', '10:00'));
    const { body } = await reconcile();
    expect(body.days.map((d: any) => d.kind)).toEqual(['rest', 'rest']);
  });

  it('reports an open gap after three missed practice days, and none once a later day is done', async () => {
    const tasks = [task('2026-09-20'), task('2026-09-21', { isRestDay: true }), task('2026-09-22'), task('2026-09-23'), task('2026-09-24')];
    given(goal(tasks), addis('2026-09-24', '10:00'));
    const { body } = await reconcile();
    expect(body.gap).toEqual({
      firstDate: '2026-09-20',
      lastDate: '2026-09-23',
      length: 3,
      taskIds: [tasks[0].id, tasks[2].id, tasks[3].id],
    });

    const back = [...tasks.slice(0, 4), task('2026-09-24', { status: 'completed' })];
    given(goal(back), addis('2026-09-24', '10:00'));
    expect((await reconcile()).body.gap).toBeNull();
  });

  it('returns days in date order whatever order the rows come in', async () => {
    const tasks = [task('2026-09-24'), task('2026-09-22'), task('2026-09-23')];
    given(goal(tasks), addis('2026-09-24', '10:00'));
    const { body } = await reconcile();
    expect(body.days.map((d: any) => d.date)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
  });

  it('reads a missing user timezone as UTC', async () => {
    given(goal([task('2026-09-23')]), new Date('2026-09-24T00:59:00Z'), { ...user, timezone: undefined });
    let { body } = await reconcile();
    expect(body.timezone).toBe('UTC');
    expect(body.days[0].kind).toBe('planned'); // closes 01:00 UTC
    given(goal([task('2026-09-23')]), new Date('2026-09-24T01:00:00Z'), { ...user, timezone: 'Not/AZone' });
    ({ body } = await reconcile());
    expect(body.timezone).toBe('UTC');
    expect(body.days[0].kind).toBe('missed');
  });

  it('closes at 04:00 when the routine has no sleep time', async () => {
    for (const routine of ['{}', '', 'not json', JSON.stringify({ sleepTime: '7pm' })]) {
      given(goal([task('2026-09-23')], { routine }), addis('2026-09-24', '03:59'));
      expect((await reconcile()).body.days[0].kind, `routine ${routine}`).toBe('planned');
      given(goal([task('2026-09-23')], { routine }), addis('2026-09-24', '04:00'));
      expect((await reconcile()).body.days[0].kind, `routine ${routine}`).toBe('missed');
    }
  });

  it('is idempotent: repeated calls at the same moment give the same body and write nothing (3.4)', async () => {
    const tasks = [task('2026-09-20'), task('2026-09-21'), task('2026-09-22'), task('2026-09-23', { isRestDay: true }), task('2026-09-24')];
    given(goal(tasks), addis('2026-09-24', '10:00'));
    const first = await reconcile();
    const second = await reconcile();
    const third = await reconcile();
    expect(second.body).toEqual(first.body);
    expect(third.body).toEqual(first.body);
    expect(first.body.gap?.length).toBe(3);
    // afterEach also checks that no write method was called.
  });

  it('answers 500 without detail when loading fails', async () => {
    (getAuthUser as any).mockResolvedValue(user);
    (prisma.goal.findFirst as any).mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await reconcile();
    expect(status).toBe(500);
    expect(body).toEqual({ error: 'Failed to reconcile goal.' });
    spy.mockRestore();
  });
});
