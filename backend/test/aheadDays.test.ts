import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { writeNextWeek } from '../src/lib/planV2.js';

vi.mock('../src/lib/prisma.js', async () => {
  const { vi } = await import('vitest');
  const prisma: any = {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    goal: { findFirst: vi.fn(), update: vi.fn() },
    weeklyReview: { upsert: vi.fn() },
    roadmapWeek: { update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    dailyTask: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  };
  return { prisma };
});

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../src/lib/planV2.js', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/planV2.js')>('../src/lib/planV2.js');
  return {
    ...actual,
    writeNextWeek: vi.fn().mockResolvedValue([{ dayNumber: 8, title: 'Session 1', isRestDay: false }]),
    saveWeekTasks: vi.fn().mockResolvedValue([]),
    readStoredRoadmap: vi.fn().mockReturnValue(null),
    readRoutine: vi.fn().mockReturnValue({ preferredSlot: 'morning' }),
  };
});

// 23:30 UTC on Sunday 25 October: still the 25th in UTC, already Monday the 26th in Tokyo.
const NOW = new Date('2026-10-25T23:30:00Z');
const utcUser = { id: 'usr-ahead', email: 'ahead@achivii.com', timezone: 'UTC' };
const tokyoUser = { ...utcUser, timezone: 'Asia/Tokyo' };

describe('ahead days: no completing a day before it comes', () => {
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

  afterAll(async () => {
    vi.useRealTimers();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    (prisma.roadmapWeek.updateMany as any).mockResolvedValue({ count: 1 });
  });

  describe('PATCH /api/goal/tasks/:taskId', () => {
    const task = (overrides: Record<string, unknown> = {}) => ({
      id: 'task-1',
      goalId: 'goal-1',
      date: '2026-10-26',
      status: 'pending',
      completedAt: null,
      notes: null,
      slotTime: null,
      minimumVersion: null,
      usedMinimumVersion: false,
      isRestDay: false,
      goal: { id: 'goal-1', userId: utcUser.id, status: 'active' },
      ...overrides,
    });

    const patch = (body: unknown) =>
      fetch(`${baseUrl}/api/goal/tasks/task-1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-jwt-token' },
        body: JSON.stringify(body),
      });

    beforeEach(() => {
      (prisma.dailyTask.update as any).mockImplementation(async ({ data }: any) => ({ ...task(), ...data }));
    });

    it('refuses completing a day still ahead in the person\'s time zone, and writes nothing', async () => {
      (getAuthUser as any).mockResolvedValue(utcUser);
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

      const res = await patch({ status: 'completed' });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "This day hasn't started yet.", reason: 'not_yet' });
      expect(prisma.dailyTask.update).not.toHaveBeenCalled();
    });

    it('allows the same day once it has started locally', async () => {
      (getAuthUser as any).mockResolvedValue(tokyoUser);
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

      const res = await patch({ status: 'completed' });

      expect(res.status).toBe(200);
      expect((await res.json()).task.status).toBe('completed');
    });

    it('allows today and past days', async () => {
      (getAuthUser as any).mockResolvedValue(utcUser);
      for (const date of ['2026-10-25', '2026-10-20']) {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ date }));
        expect((await patch({ status: 'completed' })).status).toBe(200);
      }
    });

    it('still allows notes and slot time on an ahead day, and marking it not done', async () => {
      (getAuthUser as any).mockResolvedValue(utcUser);
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());
      expect((await patch({ notes: 'Plan: pack shoes', slotTime: '07:00' })).status).toBe(200);

      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: 'completed', completedAt: new Date() }));
      expect((await patch({ status: 'pending' })).status).toBe(200);
    });

    it('keeps an ahead day already stored as completed when it is sent completed again', async () => {
      (getAuthUser as any).mockResolvedValue(utcUser);
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: 'completed', completedAt: new Date() }));
      expect((await patch({ status: 'completed' })).status).toBe(200);
    });
  });

});
