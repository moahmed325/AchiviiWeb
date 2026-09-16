import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { userGoalRouter, goalsRouter } from '../src/routes/userGoal.js';
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
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    weeklyReview: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    roadmap: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dailyScheduleItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    replanAudit: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    weeklyStrategicReview: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    goalCapability: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    trajectoryVersion: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    milestoneProgress: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    habitProgress: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    milestone: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    habit: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  return {
    prisma: {
      userGoal: {
        findFirst: vi.fn(),
      },
      routine: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      weeklyReview: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      session: {
        deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      recoveryEvent: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      weeklyStrategicReview: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      goalCapability: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      trajectoryVersion: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      milestoneProgress: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      habitProgress: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      milestone: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      habit: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
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

describe('Single Active Goal & Discard Enforcement', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
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
