import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter, validateWeeklyTestResult } from '../src/routes/goal.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    weeklyReview: {
      upsert: vi.fn(),
    },
    roadmapWeek: {
      update: vi.fn(),
    },
    dailyTask: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

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

describe('Weekly Review Test Result Storage & Validation (Milestone M7.5 — OD-1a)', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
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
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateWeeklyTestResult unit checks', () => {
    it('accepts valid numeric test result with unit and note', () => {
      const res = validateWeeklyTestResult({ value: 10, unit: 'km', passed: true, note: 'Felt strong' });
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.result).toEqual({ value: 10, unit: 'km', passed: true, note: 'Felt strong' });
      }
    });

    it('accepts valid string test result without optional unit or note', () => {
      const res = validateWeeklyTestResult({ value: 'Chapter 3 draft finished', passed: true });
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.result).toEqual({ value: 'Chapter 3 draft finished', passed: true });
      }
    });

    it('rejects null or non-object input', () => {
      expect(validateWeeklyTestResult(null).valid).toBe(false);
      expect(validateWeeklyTestResult(undefined).valid).toBe(false);
      expect(validateWeeklyTestResult('string').valid).toBe(false);
      expect(validateWeeklyTestResult(123).valid).toBe(false);
      expect(validateWeeklyTestResult([]).valid).toBe(false);
    });

    it('rejects missing or empty value', () => {
      expect(validateWeeklyTestResult({ passed: true }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: '', passed: true }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: '   ', passed: true }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: NaN, passed: true }).valid).toBe(false);
    });

    it('rejects missing or non-boolean passed field', () => {
      expect(validateWeeklyTestResult({ value: 50 }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: 50, passed: 'true' }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: 50, passed: 1 }).valid).toBe(false);
    });

    it('rejects non-string unit or note', () => {
      expect(validateWeeklyTestResult({ value: 50, passed: true, unit: 123 }).valid).toBe(false);
      expect(validateWeeklyTestResult({ value: 50, passed: true, note: {} }).valid).toBe(false);
    });
  });

  describe('POST /api/goal/weeks/:weekNumber/review endpoint tests', () => {
    const mockUser = { id: 'usr-101', email: 'runner@example.com' };
    const mockGoalV2 = {
      id: 'goal-v2-101',
      userId: 'usr-101',
      planVersion: 2,
      status: 'active',
      currentWeek: 1,
      roadmapWeeks: [
        { id: 'rw-1', goalId: 'goal-v2-101', weekNumber: 1, status: 'active', testResult: null },
        { id: 'rw-2', goalId: 'goal-v2-101', weekNumber: 2, status: 'pending', testResult: null },
      ],
      dailyTasks: [
        { id: 't-1', weekNumber: 1, dayNumber: 1, isRestDay: false, status: 'completed' },
        { id: 't-2', weekNumber: 1, dayNumber: 2, isRestDay: false, status: 'completed' },
      ],
    };

    it('1. Submitting review with valid testResult persists JSON object to RoadmapWeek.testResult', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockGoalV2);
      (prisma.weeklyReview.upsert as any).mockResolvedValueOnce({
        id: 'rev-1',
        scorePercentage: 100,
        reflection: 'Strong consistency throughout the week.',
        aiAdaptationInsight: '2 of 2 sessions done.',
      });
      (prisma.roadmapWeek.update as any).mockResolvedValue({
        id: 'rw-1',
        status: 'completed',
        testResult: { value: 10, unit: 'km', passed: true, note: 'Felt strong' },
      });
      (prisma.goal.update as any).mockResolvedValueOnce(mockGoalV2);

      const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          reflection: 'Strong consistency throughout the week.',
          testResult: { value: 10, unit: 'km', passed: true, note: 'Felt strong' },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.testResult).toEqual({ value: 10, unit: 'km', passed: true, note: 'Felt strong' });

      // Verify Prisma roadmapWeek.update was called with the persisted JSON object
      expect(prisma.roadmapWeek.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { goalId_weekNumber: { goalId: 'goal-v2-101', weekNumber: 1 } },
          data: expect.objectContaining({
            status: 'completed',
            testResult: { value: 10, unit: 'km', passed: true, note: 'Felt strong' },
          }),
        })
      );
    });

    it('2. Submitting review without testResult leaves RoadmapWeek.testResult as null (backward compatibility)', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);
      (prisma.goal.findFirst as any).mockResolvedValueOnce(mockGoalV2);
      (prisma.weeklyReview.upsert as any).mockResolvedValueOnce({
        id: 'rev-2',
        scorePercentage: 100,
        reflection: 'Just practicing without benchmark.',
        aiAdaptationInsight: '2 of 2 sessions done.',
      });
      (prisma.roadmapWeek.update as any).mockResolvedValue({
        id: 'rw-1',
        status: 'completed',
        testResult: null,
      });
      (prisma.goal.update as any).mockResolvedValueOnce(mockGoalV2);

      const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          reflection: 'Just practicing without benchmark.',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.testResult).toBeNull();

      // Verify Prisma roadmapWeek.update was called with DbNull for testResult
      expect(prisma.roadmapWeek.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { goalId_weekNumber: { goalId: 'goal-v2-101', weekNumber: 1 } },
          data: expect.objectContaining({
            status: 'completed',
            testResult: Prisma.DbNull,
          }),
        })
      );
    });

    it('3. Submitting malformed testResult returns HTTP 400 with descriptive error', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);

      // Malformed testResult: missing 'passed' boolean
      const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          reflection: 'Almost did the test.',
          testResult: { value: 10 },
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/passed.*boolean/i);

      // Verify Prisma was never updated
      expect(prisma.roadmapWeek.update).not.toHaveBeenCalled();
    });

    it('3b. Submitting malformed testResult with empty value returns HTTP 400', async () => {
      (getAuthUser as any).mockResolvedValueOnce(mockUser);

      const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-jwt-token',
        },
        body: JSON.stringify({
          reflection: 'Almost did the test.',
          testResult: { value: '   ', passed: true },
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/value.*empty/i);
      expect(prisma.roadmapWeek.update).not.toHaveBeenCalled();
    });

    it('4. Unauthorized request (no token or invalid user) returns HTTP 401', async () => {
      (getAuthUser as any).mockResolvedValueOnce(null);

      const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reflection: 'No authorization header provided.',
        }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toMatch(/Unauthorized/i);
    });
  });
});
