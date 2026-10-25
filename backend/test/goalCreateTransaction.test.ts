import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// B-100: goal create archives the active goal and saves the new goal, its 12 weeks and week 1's tasks in one
// transaction. The writes go to the transaction client only, so a failed write leaves nothing archived or half saved.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFindUniqueOrThrow: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    // Outside the transaction only the read back is allowed; a write here would throw (no such method).
    goal: { findUniqueOrThrow: db.goalFindUniqueOrThrow },
    $transaction: db.transaction,
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../src/lib/billing/goalAuthorization.js', () => ({
  authorizeNewCustomGoal: vi.fn().mockResolvedValue({ allowed: true }),
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

const number = { kind: 'number', metric: 'Loaves', value: 1, unit: 'loaves', direction: 'higher_is_better' };
const roadmapOk = {
  ok: true,
  roadmap: {
    finalGoal: 'The goal',
    finalTest: 'The final test',
    startingPoint: { value: null, description: 'Now' },
    method: { name: 'Tartine method', creator: '', summary: 'Long fermentation.', whyChosen: 'Fits.', rules: ['Feed the starter'] },
    phases: [{ name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 12 }],
    weeks: Array.from({ length: 12 }, (_, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: 'Focus',
      target: number,
      test: { type: 'checklist', instructions: 'Do the test', passIf: 'Done' },
    })),
  },
};

const tx = {
  goal: { create: db.goalCreate, updateMany: db.goalUpdateMany },
  roadmapWeek: { createMany: db.weeksCreateMany },
  dailyTask: { createMany: db.tasksCreateMany },
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
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  vi.mocked(generateRoadmap).mockResolvedValue(roadmapOk as never);
  vi.mocked(generateWeekPlan).mockResolvedValue([] as never);
  db.transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
  db.goalCreate.mockResolvedValue({ id: 'g1' });
  db.goalFindUniqueOrThrow.mockResolvedValue({ id: 'g1', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
});

async function create() {
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({
      rawGoal: 'Bake sourdough bread at home',
      clarifiedOutcome: 'Bake sourdough bread at home',
      answers: {},
      answerList: [{ id: 'current_level', question: 'Level?', answer: 'New' }],
      routine: { dailyMinutes: 30, planVariant: 'steady' },
    }),
  });
  return { status: res.status, body: await res.json() };
}

describe('goal create saves in one transaction (B-100)', () => {
  it('archives the active goal and writes the goal, its weeks and week 1 inside one transaction', async () => {
    const { status } = await create();
    expect(status).toBe(201);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.goalUpdateMany).toHaveBeenCalledWith({ where: { userId: 'u1', status: 'active' }, data: { status: 'archived' } });
    expect(db.goalCreate).toHaveBeenCalledTimes(1);
    expect(db.weeksCreateMany).toHaveBeenCalledTimes(1);
    expect(db.tasksCreateMany).toHaveBeenCalledTimes(1);
    // The archive comes first, inside the transaction.
    expect(db.goalUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(db.goalCreate.mock.invocationCallOrder[0]);
  });

  it('a failed write fails the transaction: no goal is read back and the person gets the honest error', async () => {
    db.tasksCreateMany.mockRejectedValue(new Error('connection lost'));
    const { status } = await create();
    expect(status).toBe(503);
    await expect(db.transaction.mock.results[0].value).rejects.toThrow('connection lost');
    expect(db.goalFindUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('nothing is written when the roadmap fails', async () => {
    vi.mocked(generateRoadmap).mockResolvedValue({ ok: false, reason: "Couldn't design your roadmap right now. Please try again." });
    const { status } = await create();
    expect(status).toBe(503);
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
