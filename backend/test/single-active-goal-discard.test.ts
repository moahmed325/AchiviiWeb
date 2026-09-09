import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { onboardingRouter, userGoalRouter, goalsRouter } from '../src/routes/onboarding.js';
import { prisma } from '../src/lib/prisma.js';
import * as authModule from '../src/routes/auth.js';

vi.mock('../src/lib/prisma.js', () => {
  const mockTx = {
    availabilitySlot: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    userGoal: {
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
    },
    recoveryEvent: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    weeklyReview: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    roadmap: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  };

  return {
    prisma: {
      goalCatalog: {
        findUnique: vi.fn(),
      },
      userGoal: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
      },
      session: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      recoveryEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      weeklyReview: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      roadmap: {
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      availabilitySlot: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockTx);
        }
        return Promise.all(cb);
      }),
    },
    mockTx,
  };
});

// Mock scheduler so onboarding doesn't try to generate schedules in test
vi.mock('../src/lib/scheduler.js', () => ({
  generateThreeMonthSchedule: vi.fn().mockResolvedValue(60),
}));

describe('Single Active Goal & Discard Enforcement', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/onboarding', onboardingRouter);
    app.use('/api/user-goal', userGoalRouter);
    app.use('/api/goals', goalsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authModule, 'getAuthUser').mockResolvedValue({
      id: 'user-active-1',
      email: 'pilot@achivii.internal',
    } as any);
  });

  it('rejects goal creation with 409 Conflict when an active goal already exists', async () => {
    // Catalog goal requested
    (prisma.goalCatalog.findUnique as any).mockResolvedValue({
      id: 'catalog-goal-new',
      title: 'Run Half Marathon',
      phases: [{ id: 'phase-1' }],
    });

    // Existing active goal with a different catalog ID
    (prisma.userGoal.findFirst as any).mockResolvedValue({
      id: 'user-goal-existing',
      user_id: 'user-active-1',
      goal_catalog_id: 'catalog-goal-old',
      status: 'ACTIVE',
    });

    const res = await fetch(`${baseUrl}/api/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
      body: JSON.stringify({
        goal_catalog_id: 'catalog-goal-new',
        start_date: '2026-09-10',
        availability_slots: [
          { day_of_week: 'MON', start_time: '08:00', end_time: '09:00' },
        ],
      }),
    });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe('ACTIVE_GOAL_EXISTS');
    expect(data.message).toContain('Only one active protocol can run concurrently');
  });

  it('allows routine adjustment when goal_catalog_id matches active goal', async () => {
    (prisma.goalCatalog.findUnique as any).mockResolvedValue({
      id: 'catalog-goal-same',
      title: 'SaaS MVP',
      phases: [{ id: 'phase-1' }],
    });

    (prisma.userGoal.findFirst as any).mockResolvedValue({
      id: 'user-goal-existing',
      user_id: 'user-active-1',
      goal_catalog_id: 'catalog-goal-same',
      status: 'ACTIVE',
      start_date: new Date('2026-09-01'),
      target_end_date: new Date('2026-11-24'),
    });

    const res = await fetch(`${baseUrl}/api/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
      body: JSON.stringify({
        goal_catalog_id: 'catalog-goal-same',
        start_date: '2026-09-01',
        availability_slots: [
          { day_of_week: 'TUE', start_time: '09:00', end_time: '10:00' },
        ],
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.is_adjustment).toBe(true);
  });

  it('discards active goal and cascade-purges associated sessions via DELETE /api/goals/:id', async () => {
    (prisma.userGoal.findFirst as any).mockResolvedValue({
      id: 'goal-to-discard',
      user_id: 'user-active-1',
      status: 'ACTIVE',
    });

    const res = await fetch(`${baseUrl}/api/goals/goal-to-discard`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.discarded_goal_id).toBe('goal-to-discard');
  });

  it('discards current active goal via DELETE /api/goals/current', async () => {
    (prisma.userGoal.findFirst as any).mockResolvedValue({
      id: 'active-goal-current',
      user_id: 'user-active-1',
      status: 'ACTIVE',
    });

    const res = await fetch(`${baseUrl}/api/goals/current`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.discarded_goal_id).toBe('active-goal-current');
  });

  it('returns 404 when discarding a non-existent goal', async () => {
    (prisma.userGoal.findFirst as any).mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/goals/non-existent-id`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-123' },
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('GOAL_NOT_FOUND');
  });
});
