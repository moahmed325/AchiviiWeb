import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

// Missed sessions M2.3: `signals` on the POST /api/goal/reconcile response (ND-16).

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    weeklyReview: { upsert: vi.fn(), update: vi.fn() },
    roadmapWeek: { update: vi.fn(), createMany: vi.fn() },
    dailyTask: { create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

const SWITCH = 'MISSED_SESSIONS_CARRY_ENABLED';
const user = { id: 'usr-signals', email: 'signals@achivii.com', timezone: 'UTC' };
const updateMany = prisma.dailyTask.updateMany as unknown as ReturnType<typeof vi.fn>;

const step = (title: string, priority: number, minutes: number) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: '',
  focusCue: '',
  pitfallToAvoid: '',
  priority,
});
const day = (id: string, date: string, dayNumber: number) => ({
  id,
  date,
  weekNumber: 1,
  dayNumber,
  status: 'pending',
  isRestDay: false,
  isKeySession: false,
  isTestDay: false,
  durationMinutes: 30,
  detailedSteps: JSON.stringify([step(`${id} lead`, 1, 15), step(`${id} second`, 2, 10), step(`${id} third`, 3, 5)]),
});
const tasks = () => [day('mon', '2026-09-21', 1), day('tue', '2026-09-22', 2), day('wed', '2026-09-23', 3)];
const goal = (over: Record<string, unknown> = {}) => ({
  id: 'goal-v2',
  planVersion: 2,
  routine: JSON.stringify({ sleepTime: '23:00' }),
  rawGoal: 'Type 40 words per minute',
  clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
  dailyTasks: tasks(),
  ...over,
});

describe('POST /api/goal/reconcile signals (M2.3)', () => {
  let server: Server;
  let baseUrl: string;
  const saved = process.env[SWITCH];

  const reconcile = async () => {
    const res = await fetch(`${baseUrl}/api/goal/reconcile`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    return res.json();
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
    if (saved === undefined) delete process.env[SWITCH];
    else process.env[SWITCH] = saved;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[SWITCH];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-22T10:00:00Z'));
    (getAuthUser as any).mockResolvedValue(user);
  });

  afterEach(() => vi.useRealTimers());

  it('switch off: signals are added, the planned carry is not reported as moved, nothing is written', async () => {
    (prisma.goal.findFirst as any).mockResolvedValue(goal());
    const body = await reconcile();
    expect(body.carry.carries).toHaveLength(1);
    expect(body.signals).toEqual({ carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('switch on: the carry this request wrote is reported, with one notice', async () => {
    process.env[SWITCH] = 'true';
    updateMany.mockResolvedValue({ count: 1 });
    (prisma.goal.findFirst as any).mockResolvedValue(goal());
    const body = await reconcile();
    expect(body.signals.carried).toEqual([
      { fromDate: '2026-09-21', fromTaskId: 'mon', toDate: '2026-09-22', toTaskId: 'tue', stepTitle: 'mon lead' },
    ]);
    expect(body.signals.notice).toBe('carried');
  });

  it('switch on, race lost: nothing written, so nothing reported as moved', async () => {
    process.env[SWITCH] = 'true';
    updateMany.mockResolvedValue({ count: 0 });
    (prisma.goal.findFirst as any).mockResolvedValue(goal());
    const body = await reconcile();
    expect(body.carry.written).toEqual([]);
    expect(body.signals.carried).toEqual([]);
  });

  it('applies: false responses are unchanged: no signals, no carry', async () => {
    (prisma.goal.findFirst as any).mockResolvedValue(goal({ planVersion: 1 }));
    expect(await reconcile()).toEqual({ applies: false, reason: 'not_plan_v2' });
    (prisma.goal.findFirst as any).mockResolvedValue(null);
    expect(await reconcile()).toEqual({ applies: false, reason: 'no_active_goal' });
  });
});
