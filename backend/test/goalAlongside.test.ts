import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// ND-42: one guided skill can run alongside the main plan (Pro). It is saved as `alongside` and leaves the main plan
// as it is; requests about it carry the plan header; it becomes the main plan only when the main one is reset, or by
// choice once the main plan has finished.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFindFirst: vi.fn(),
  goalFindUniqueOrThrow: vi.fn(),
  goalDeleteMany: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
  transaction: vi.fn(),
  access: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: {
      findFirst: db.goalFindFirst,
      findUniqueOrThrow: db.goalFindUniqueOrThrow,
      updateMany: db.goalUpdateMany,
      deleteMany: db.goalDeleteMany,
    },
    $transaction: db.transaction,
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../src/lib/billing/goalAuthorization.js', () => ({ authorizeNewPlan: vi.fn().mockResolvedValue({ allowed: true }) }));
vi.mock('../src/lib/billing/access.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/billing/access.js')>()),
  accessFor: db.access,
}));

vi.mock('../src/lib/ai/roadmap.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/roadmap.js')>()),
  generateRoadmap: vi.fn(),
}));
vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { generateRoadmap } from '../src/lib/ai/roadmap.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { goalRouter } from '../src/routes/goal.js';
import { planOf, statusOf } from '../src/lib/plans.js';

const roadmapOk = {
  ok: true,
  roadmap: {
    finalGoal: 'Run a 10K',
    finalTest: 'Run it',
    startingPoint: { value: null, description: 'Now' },
    method: { name: 'Daniels', creator: '', summary: 'Easy miles.', whyChosen: 'Fits.', rules: ['Run easy'] },
    phases: [{ name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 12 }],
    weeks: Array.from({ length: 12 }, (_, index) => ({ weekNumber: index + 1, phase: 'Base', focus: 'Focus' })),
  },
};

const tx = {
  goal: { create: db.goalCreate, updateMany: db.goalUpdateMany },
  roadmapWeek: { createMany: db.weeksCreateMany },
  dailyTask: { createMany: db.tasksCreateMany },
  user: { updateMany: vi.fn() },
};

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

const MAIN = { id: 'main', routine: JSON.stringify({ dailyMinutes: 60, planVariant: 'steady' }) };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  vi.mocked(generateRoadmap).mockResolvedValue(roadmapOk as never);
  vi.mocked(generateWeekPlan).mockResolvedValue([] as never);
  db.access.mockResolvedValue({ state: 'pro', trial: null });
  db.transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
  db.goalCreate.mockResolvedValue({ id: 'skill' });
  db.goalFindUniqueOrThrow.mockResolvedValue({ id: 'skill', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
  // The main plan, then no skill alongside yet.
  db.goalFindFirst.mockImplementation(async ({ where }: { where: { status: string } }) => (where.status === 'active' ? MAIN : null));
});

const createAlongside = (over: Record<string, unknown> = {}) =>
  fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({
      rawGoal: 'Run a 10K Under 50 Minutes',
      clarifiedOutcome: 'Run a 10K Under 50 Minutes',
      answers: {},
      answerList: [],
      routine: { dailyMinutes: 30, planVariant: 'minimal' },
      alongside: true,
      ...over,
    }),
  });

describe('a skill alongside the main plan (ND-42)', () => {
  it('reads the plan from the header: the main plan unless it names the alongside one', () => {
    expect(planOf({ headers: {} })).toBe('main');
    expect(planOf({ headers: { 'x-achivii-plan': 'alongside' } })).toBe('alongside');
    expect(statusOf('alongside')).toBe('alongside');
    expect(statusOf('main')).toBe('active');
  });

  it('is saved as alongside and leaves the main plan running', async () => {
    const res = await createAlongside();
    expect(res.status).toBe(201);
    expect(db.goalCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'alongside' }) }));
    expect(db.goalUpdateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'archived' } }));
  });

  it('needs Pro, a guided skill, a main plan, no skill alongside yet, and time within the daily limit', async () => {
    db.access.mockResolvedValueOnce({ state: 'trial', trial: null });
    expect(await (await createAlongside()).json()).toMatchObject({ reason: 'SKILLS_REQUIRE_PRO' });

    const notSkill = await createAlongside({ rawGoal: 'Learn to juggle', clarifiedOutcome: 'Learn to juggle' });
    expect(notSkill.status).toBe(400);
    expect(await notSkill.json()).toMatchObject({ reason: 'not_a_skill' });

    db.goalFindFirst.mockImplementation(async () => null);
    expect(await (await createAlongside()).json()).toMatchObject({ reason: 'no_main_plan' });

    db.goalFindFirst.mockImplementation(async () => MAIN);
    expect(await (await createAlongside()).json()).toMatchObject({ reason: 'alongside_running' });

    db.goalFindFirst.mockImplementation(async ({ where }: { where: { status: string } }) => (where.status === 'active' ? MAIN : null));
    const tooMuch = await createAlongside({ routine: { dailyMinutes: 450, planVariant: 'minimal' } });
    expect(tooMuch.status).toBe(400);
    expect(await tooMuch.json()).toMatchObject({ reason: 'too_much_time' });
    expect(db.goalCreate).not.toHaveBeenCalled();
  });

  it('GET /active sends the skill alongside with the main plan', async () => {
    db.goalFindFirst.mockImplementation(async ({ where }: { where: { status: string } }) =>
      where.status === 'active'
        ? { id: 'main', status: 'active', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] }
        : where.status === 'alongside'
          ? { id: 'skill', status: 'alongside', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] }
          : null,
    );
    const json = await (await fetch(`${baseUrl}/api/goal/active`, { headers: { Authorization: 'Bearer t' } })).json();
    expect(json.activeGoal.id).toBe('main');
    expect(json.alongsideGoal.id).toBe('skill');
  });

  it('resetting the main plan makes the skill alongside the main plan; resetting the skill leaves the main one', async () => {
    db.goalFindFirst.mockResolvedValue(null);
    await fetch(`${baseUrl}/api/goal/active`, { method: 'DELETE', headers: { Authorization: 'Bearer t' } });
    expect(db.goalDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', status: 'active' } });
    expect(db.goalUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u1', status: 'alongside' }, data: { status: 'active' } });

    vi.clearAllMocks();
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
    await fetch(`${baseUrl}/api/goal/active`, { method: 'DELETE', headers: { Authorization: 'Bearer t', 'X-Achivii-Plan': 'alongside' } });
    expect(db.goalDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', status: 'alongside' } });
    expect(db.goalUpdateMany).not.toHaveBeenCalled();
  });

  it('becomes the main plan by choice only once the main plan is not running', async () => {
    db.goalFindFirst.mockResolvedValue({ id: 'main' });
    const running = await fetch(`${baseUrl}/api/goal/alongside/promote`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    expect(running.status).toBe(409);

    db.goalFindFirst.mockResolvedValue(null);
    db.goalUpdateMany.mockResolvedValue({ count: 1 });
    const promoted = await fetch(`${baseUrl}/api/goal/alongside/promote`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    expect(promoted.status).toBe(200);
    expect(db.goalUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u1', status: 'alongside' }, data: { status: 'active' } });
  });
});
