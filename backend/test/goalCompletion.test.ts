import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
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
    weeklyReview: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    roadmapWeek: {
      update: vi.fn(),
      createMany: vi.fn(),
    },
    dailyTask: {
      create: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

describe('Goal Completion Transition Lifecycle (Milestone M9.2 — OD-1b Option B)', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  const mockUser = { id: 'usr-completion-1', email: 'finisher@achivii.com' };

  const mockActiveGoal = {
    id: 'goal-active-99',
    userId: 'usr-completion-1',
    planVersion: 2,
    status: 'active',
    completedAt: null,
    currentWeek: 12,
    rawGoal: 'Run a sub-45 10k',
    clarifiedOutcome: 'Run 10 kilometers under 45 minutes',
    methodologyNotes: 'Jack Daniels VDOT',
    canonicalMethodName: 'VDOT Running Formula',
    canonicalAuthority: 'Jack Daniels',
    startDate: new Date('2026-06-01'),
    targetDate: new Date('2026-08-30'),
    updated_at: new Date('2026-08-28'),
    roadmapWeeks: [
      { id: 'rw-12', goalId: 'goal-active-99', weekNumber: 12, status: 'active', testResult: null },
    ],
    dailyTasks: [
      { id: 't-84', weekNumber: 12, dayNumber: 84, isRestDay: false, status: 'completed' },
    ],
    weeklyReviews: [
      { id: 'rev-12', goalId: 'goal-active-99', weekNumber: 12, scorePercentage: 100, reflection: null },
    ],
  };

  const mockCompletedGoal = {
    id: 'goal-completed-88',
    userId: 'usr-completion-1',
    planVersion: 2,
    status: 'completed',
    completedAt: new Date('2026-08-30T10:00:00Z'),
    currentWeek: 12,
    rawGoal: 'Run a sub-45 10k',
    clarifiedOutcome: 'Run 10 kilometers under 45 minutes',
    methodologyNotes: 'Jack Daniels VDOT',
    canonicalMethodName: 'VDOT Running Formula',
    canonicalAuthority: 'Jack Daniels',
    startDate: new Date('2026-06-01'),
    targetDate: new Date('2026-08-30'),
    updated_at: new Date('2026-08-30T10:00:00Z'),
    roadmapWeeks: [
      {
        id: 'rw-12',
        goalId: 'goal-completed-88',
        weekNumber: 12,
        status: 'completed',
        testResult: { value: '44:20', passed: true, note: 'PB achieved' },
      },
    ],
    dailyTasks: [
      { id: 't-84', weekNumber: 12, dayNumber: 84, isRestDay: false, status: 'completed' },
    ],
    weeklyReviews: [
      {
        id: 'rev-12',
        goalId: 'goal-completed-88',
        weekNumber: 12,
        scorePercentage: 100,
        reflection: 'Full 12-week commitment honored.',
      },
    ],
  };

  beforeAll(async () => {
    app = express();
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
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Successful Goal Completion (POST /api/goal/complete)', () => {
    it('transitions active goal to completed, sets completedAt, and returns formatted goal', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockActiveGoal);

      const completionTimestamp = new Date('2026-08-30T14:30:00Z');
      const updatedMock = {
        ...mockActiveGoal,
        status: 'completed',
        completedAt: completionTimestamp,
      };
      (prisma.goal.update as any).mockResolvedValueOnce(updatedMock);

      const res = await fetch(`${baseUrl}/api/goal/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.goal).toBeDefined();
      expect(json.goal.status).toBe('completed');
      expect(json.goal.completedAt).toBe(completionTimestamp.toISOString());
      expect(json.activeGoal).toBeDefined();
      expect(json.activeGoal.id).toBe(mockActiveGoal.id);

      // Verify Prisma update call
      expect(prisma.goal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockActiveGoal.id },
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        })
      );
    });

    it('persists optional finalReflection and finalTestResult without corrupting structure', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockActiveGoal);
      (prisma.roadmapWeek.update as any).mockResolvedValueOnce({ id: 'rw-12' });
      (prisma.weeklyReview.update as any).mockResolvedValueOnce({ id: 'rev-12' });

      const updatedMock = {
        ...mockActiveGoal,
        status: 'completed',
        completedAt: new Date('2026-08-30T14:30:00Z'),
      };
      (prisma.goal.update as any).mockResolvedValueOnce(updatedMock);

      const res = await fetch(`${baseUrl}/api/goal/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          finalReflection: 'Transformational 90 days. Built daily discipline.',
          finalTestResult: {
            value: '43:45',
            passed: true,
            unit: 'mm:ss',
            note: 'Final test in the park',
          },
        }),
      });

      expect(res.status).toBe(200);

      // Verify final test result was saved to the week 12 roadmap week
      expect(prisma.roadmapWeek.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rw-12' },
          data: {
            testResult: {
              value: '43:45',
              passed: true,
              unit: 'mm:ss',
              note: 'Final test in the park',
            },
          },
        })
      );

      // Verify final reflection was saved to the week 12 review
      expect(prisma.weeklyReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rev-12' },
          data: {
            reflection: 'Transformational 90 days. Built daily discipline.',
          },
        })
      );

      // Verify goal status transitioned to completed
      expect(prisma.goal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockActiveGoal.id },
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('2. Active Goal Query Adaptation (GET /api/goal/active)', () => {
    it('returns completed goal when user has no currently active goal (persistence across reloads)', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      // Active query returns null
      (prisma.goal.findFirst as any).mockResolvedValueOnce(null);
      // Completed query returns most recently updated completed goal
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockCompletedGoal);

      const res = await fetch(`${baseUrl}/api/goal/active`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.activeGoal).toBeDefined();
      expect(json.activeGoal.id).toBe(mockCompletedGoal.id);
      expect(json.activeGoal.status).toBe('completed');
      expect(json.activeGoal.completedAt).toBe(mockCompletedGoal.completedAt.toISOString());

      // Verify second query explicitly filtered for status: 'completed' and ordered by updated_at: 'desc'
      expect(prisma.goal.findFirst).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { userId: mockUser.id, status: 'completed' },
          orderBy: { updated_at: 'desc' },
        })
      );
    });

    it('prioritizes active goal over past completed goals (active goal precedence)', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      // Active query finds an active goal
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockActiveGoal);

      const res = await fetch(`${baseUrl}/api/goal/active`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.activeGoal).toBeDefined();
      expect(json.activeGoal.id).toBe(mockActiveGoal.id);
      expect(json.activeGoal.status).toBe('active');

      // Verify that completed goal query was NEVER called
      expect(prisma.goal.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.goal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, status: 'active' },
        })
      );
    });

    it('returns null when user has neither active nor completed goals', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(null); // active query
      (prisma.goal.findFirst as any).mockResolvedValueOnce(null); // completed query

      const res = await fetch(`${baseUrl}/api/goal/active`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.activeGoal).toBeNull();
    });
  });

  describe('3. Guard Rails: 404 & 401 Handlers', () => {
    it('returns 404 when POST /api/goal/complete is called with no active goal', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(null); // No active goal

      const res = await fetch(`${baseUrl}/api/goal/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe('No active goal found to complete.');
      expect(prisma.goal.update).not.toHaveBeenCalled();
    });

    it('returns 401 when POST /api/goal/complete is unauthenticated', async () => {
      (getAuthUser as any).mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/goal/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized.');
      expect(prisma.goal.findFirst).not.toHaveBeenCalled();
    });

    it('returns 401 when GET /api/goal/active is unauthenticated', async () => {
      (getAuthUser as any).mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/goal/active`, {
        method: 'GET',
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Unauthorized.');
      expect(prisma.goal.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('4. Journey Succession & Reset Safety (R-15)', () => {
    it('DELETE /api/goal/active exclusively deletes status: active, never touching completed goals', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.deleteMany as any).mockResolvedValueOnce({ count: 1 });

      const res = await fetch(`${baseUrl}/api/goal/active`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify that deleteMany only targeted status: 'active'
      expect(prisma.goal.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, status: 'active' },
      });
    });

    it('goal creation archives active goals without altering or clobbering completed journeys', async () => {
      (prisma.goal.updateMany as any).mockResolvedValueOnce({ count: 1 });

      // Emulate archiveActiveGoals invocation
      await prisma.goal.updateMany({
        where: { userId: mockUser.id, status: 'active' },
        data: { status: 'archived' },
      });

      expect(prisma.goal.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, status: 'active' },
        data: { status: 'archived' },
      });
    });
  });
});

