import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';

// Missed sessions M4.1 (ND-4, RULE-7): PUT /weeks/:weekNumber/test-result logs the week's test without closing the
// week, and the weekly review keeps a stored result when it is submitted without one.
// Prisma is replaced by a small in-memory store, so the endpoint and the review read and write the same rows.

const store = vi.hoisted(() => ({
  goals: [] as any[],
  prisma: {
    goal: { findFirst: vi.fn(), update: vi.fn() },
    roadmapWeek: { update: vi.fn() },
    weeklyReview: { upsert: vi.fn() },
    dailyTask: { create: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: store.prisma }));
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

import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

const OWNER = { id: 'u1', email: 'u1@achivii.com' };
const OTHER = { id: 'u2', email: 'u2@achivii.com' };
const RESULT = { value: 26.5, unit: 'min', passed: true, note: 'Felt steady' };

const week = (goalId: string, weekNumber: number, status: string, testResult: unknown = null) => ({
  id: `${goalId}-w${weekNumber}`,
  goalId,
  weekNumber,
  status,
  theme: `Week ${weekNumber}`,
  objective: 'Build',
  executionScore: null,
  reviewNotes: null,
  test: { type: 'time_trial', instructions: 'Run 5 km', passIf: 'under 27 min' },
  testResult,
});

const goalFor = (userId: string, id: string, planVersion: number) => ({
  id,
  userId,
  status: 'active',
  planVersion,
  currentWeek: 1,
  rawGoal: 'Run a 10K',
  routine: '{}',
  startDate: new Date('2026-09-21T00:00:00Z'),
  roadmapWeeks: [week(id, 1, 'active'), week(id, 2, 'pending'), week(id, 3, 'completed')],
  dailyTasks: [
    { id: `${id}-t1`, weekNumber: 1, dayNumber: 1, dayOfWeek: 'Monday', title: 'Run', isRestDay: false, status: 'completed', detailedSteps: '[]', notes: null },
    { id: `${id}-t2`, weekNumber: 1, dayNumber: 2, dayOfWeek: 'Tuesday', title: 'Run', isRestDay: false, status: 'pending', detailedSteps: '[]', notes: null },
  ],
});

const weekRow = (goalId: string, weekNumber: number) =>
  store.goals.find((g) => g.id === goalId)!.roadmapWeeks.find((w: any) => w.weekNumber === weekNumber);

function findFirst(args: any) {
  const goal = store.goals.find((g) => g.userId === args.where.userId && g.status === args.where.status);
  if (!goal) return null;
  if (args.select) {
    const n = args.select.roadmapWeeks.where.weekNumber;
    return {
      planVersion: goal.planVersion,
      roadmapWeeks: goal.roadmapWeeks.filter((w: any) => w.weekNumber === n).map((w: any) => ({ id: w.id, status: w.status })),
    };
  }
  const n = args.include?.dailyTasks?.where?.weekNumber;
  return structuredClone({ ...goal, dailyTasks: goal.dailyTasks.filter((t: any) => n === undefined || t.weekNumber === n) });
}

function updateWeek(args: any) {
  const row = args.where.id
    ? store.goals.flatMap((g) => g.roadmapWeeks).find((w: any) => w.id === args.where.id)
    : weekRow(args.where.goalId_weekNumber.goalId, args.where.goalId_weekNumber.weekNumber);
  if (!row) throw new Error('row not found');
  for (const [key, value] of Object.entries(args.data)) row[key] = value === Prisma.DbNull ? null : value;
  return { ...row };
}

describe('Late test result (missed sessions M4.1)', () => {
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
    store.goals = [goalFor(OWNER.id, 'g1', 2), goalFor(OTHER.id, 'g2', 2)];
    store.prisma.goal.findFirst.mockImplementation(async (args: any) => findFirst(args));
    store.prisma.roadmapWeek.update.mockImplementation(async (args: any) => updateWeek(args));
    store.prisma.weeklyReview.upsert.mockImplementation(async () => ({ id: 'rev', aiAdaptationInsight: 'x' }));
    store.prisma.goal.update.mockImplementation(async () => ({}));
    store.prisma.dailyTask.deleteMany.mockImplementation(async () => ({ count: 0 }));
    vi.mocked(getAuthUser).mockResolvedValue(OWNER as any);
  });

  const put = (weekNumber: number | string, body: unknown) =>
    fetch(`${baseUrl}/api/goal/weeks/${weekNumber}/test-result`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    });

  const review = (weekNumber: number, body: Record<string, unknown>) =>
    fetch(`${baseUrl}/api/goal/weeks/${weekNumber}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    });

  describe('PUT /api/goal/weeks/:weekNumber/test-result', () => {
    it('stores the result and answers 200 { testResult }', async () => {
      const res = await put(1, RESULT);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ testResult: RESULT });
      expect(weekRow('g1', 1).testResult).toEqual(RESULT);
    });

    it('writes testResult and nothing else: no status change, no review, no next week, no goal change', async () => {
      await put(1, { value: ' 26:30 ', passed: false, unit: '', note: '' });
      expect(store.prisma.roadmapWeek.update).toHaveBeenCalledTimes(1);
      expect(store.prisma.roadmapWeek.update).toHaveBeenCalledWith({ where: { id: 'g1-w1' }, data: { testResult: { value: '26:30', passed: false } } });
      expect(weekRow('g1', 1).status).toBe('active');
      expect(weekRow('g1', 2).status).toBe('pending');
      expect(store.prisma.weeklyReview.upsert).not.toHaveBeenCalled();
      expect(store.prisma.goal.update).not.toHaveBeenCalled();
      expect(store.prisma.dailyTask.create).not.toHaveBeenCalled();
      expect(store.prisma.dailyTask.deleteMany).not.toHaveBeenCalled();
    });

    it('a repeat overwrites the stored result (the latest wins)', async () => {
      await put(1, RESULT);
      const res = await put(1, { value: 25, unit: 'min', passed: true });
      expect(res.status).toBe(200);
      expect(weekRow('g1', 1).testResult).toEqual({ value: 25, unit: 'min', passed: true });
    });

    it('400 with the validation message for an invalid result, and nothing is written', async () => {
      for (const [body, message] of [
        [{ value: 10 }, /passed.*boolean/i],
        [{ value: '  ', passed: true }, /value.*empty/i],
        [[1, 2], /must be an object/i],
      ] as const) {
        const res = await put(1, body);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(message);
      }
      expect(store.prisma.roadmapWeek.update).not.toHaveBeenCalled();
    });

    it("404 for another user's week, a week that does not exist, or no active goal", async () => {
      vi.mocked(getAuthUser).mockResolvedValue(OTHER as any);
      store.goals = store.goals.filter((g) => g.userId === OWNER.id);
      expect((await put(1, RESULT)).status).toBe(404);
      vi.mocked(getAuthUser).mockResolvedValue(OWNER as any);
      expect((await put(13, RESULT)).status).toBe(404);
      expect((await put('abc', RESULT)).status).toBe(404);
      expect(store.prisma.roadmapWeek.update).not.toHaveBeenCalled();
      expect(weekRow('g1', 1).testResult).toBeNull();
    });

    it('409 week_closed when the week was already reviewed', async () => {
      const res = await put(3, RESULT);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'This week has already been reviewed.', reason: 'week_closed' });
      expect(store.prisma.roadmapWeek.update).not.toHaveBeenCalled();
    });

    it('409 not_plan_v2 for an old goal', async () => {
      store.goals = [goalFor(OWNER.id, 'g1', 1)];
      const res = await put(1, RESULT);
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe('not_plan_v2');
      expect(store.prisma.roadmapWeek.update).not.toHaveBeenCalled();
    });

    it('401 without a user', async () => {
      vi.mocked(getAuthUser).mockResolvedValue(null);
      expect((await put(1, RESULT)).status).toBe(401);
    });
  });

  describe('the weekly review', () => {
    beforeEach(() => {
      store.goals = [goalFor(OWNER.id, 'g1', 2)];
    });

    it('409 not_plan_v2 for a goal that is not plan v2, and writes nothing (ND-21)', async () => {
      store.goals = [goalFor(OWNER.id, 'g1', 1)];
      weekRow('g1', 1).testResult = RESULT;
      const res = await review(1, { reflection: 'Good week' });
      expect(res.status).toBe(409);
      expect((await res.json()).reason).toBe('not_plan_v2');
      expect(store.prisma.weeklyReview.upsert).not.toHaveBeenCalled();
      expect(store.prisma.roadmapWeek.update).not.toHaveBeenCalled();
      expect(weekRow('g1', 1).status).toBe('active');
    });

    it('keeps a stored result when submitted without one, and still closes the week', async () => {
      weekRow('g1', 1).testResult = RESULT;
      const res = await review(1, { reflection: 'Good week' });
      expect(res.status).toBe(200);
      expect(weekRow('g1', 1).testResult).toEqual(RESULT);
      expect(weekRow('g1', 1).status).toBe('completed');
      expect(weekRow('g1', 1).reviewNotes).toBe('Good week');
    });

    it('keeps it when the request sends testResult: null', async () => {
      weekRow('g1', 1).testResult = RESULT;
      expect((await review(1, { reflection: '', testResult: null })).status).toBe(200);
      expect(weekRow('g1', 1).testResult).toEqual(RESULT);
    });

    it('replaces it when the review sends one', async () => {
      weekRow('g1', 1).testResult = RESULT;
      const res = await review(1, { reflection: '', testResult: { value: 24, unit: 'min', passed: true } });
      expect(res.status).toBe(200);
      expect((await res.json()).testResult).toEqual({ value: 24, unit: 'min', passed: true });
      expect(weekRow('g1', 1).testResult).toEqual({ value: 24, unit: 'min', passed: true });
    });
  });

  it('end to end: logged late, then reviewed without a result, the result survives', async () => {
    expect((await put(1, RESULT)).status).toBe(200);
    expect((await review(1, { reflection: 'Done' })).status).toBe(200);
    expect(weekRow('g1', 1)).toMatchObject({ status: 'completed', testResult: RESULT });
    // The week is closed now, so a late log is refused.
    expect((await put(1, { value: 1, passed: true })).status).toBe(409);
    expect(weekRow('g1', 1).testResult).toEqual(RESULT);
  });
});
