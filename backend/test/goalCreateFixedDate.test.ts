import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// B-106: goal create takes an optional fixed date (an exam, a race, a talk), checks it and saves it on the goal. The
// plan stays 90 days.

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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  vi.mocked(generateRoadmap).mockResolvedValue(roadmapOk as never);
  vi.mocked(generateWeekPlan).mockResolvedValue([] as never);
  db.transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
  db.goalCreate.mockResolvedValue({ id: 'g1' });
  db.goalFindUniqueOrThrow.mockResolvedValue({ id: 'g1', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

async function create(extra: Record<string, unknown> = {}) {
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({
      rawGoal: 'Bake sourdough bread at home',
      clarifiedOutcome: 'Bake sourdough bread at home',
      answers: {},
      answerList: [{ id: 'current_level', question: 'Level?', answer: 'New' }],
      routine: { dailyMinutes: 30, planVariant: 'steady' },
      ...extra,
    }),
  });
  return { status: res.status, body: await res.json() };
}

const savedGoal = () => db.goalCreate.mock.calls[0][0].data;

describe('goal create with a fixed date (B-106)', () => {
  it('saves the date as that day at 00:00 UTC and keeps the plan at 90 days', async () => {
    expect((await create({ fixedDate: '2026-12-15' })).status).toBe(201);
    expect(savedGoal()).toMatchObject({
      startDate: new Date('2026-10-28T00:00:00Z'),
      targetDate: new Date('2027-01-26T00:00:00Z'),
      fixedDate: new Date('2026-12-15T00:00:00Z'),
    });
  });

  it.each([['no field', {}], ['null', { fixedDate: null }], ['an empty string', { fixedDate: '' }]])('%s saves no date', async (_name, extra) => {
    expect((await create(extra)).status).toBe(201);
    expect(savedGoal().fixedDate).toBeNull();
  });

  it.each([
    ['not a real date', '2027-02-30', 'Choose a real date for your fixed date, or leave it empty.'],
    ['not a date string', 20261215, 'Choose a real date for your fixed date, or leave it empty.'],
    ['the start date itself', '2026-10-28', 'Your fixed date needs to be after the day your plan starts.'],
    ['before the start', '2026-10-01', 'Your fixed date needs to be after the day your plan starts.'],
  ])('%s answers 400 before any model call and saves nothing', async (_name, fixedDate, error) => {
    const { status, body } = await create({ fixedDate });
    expect(status).toBe(400);
    expect(body.error).toBe(error);
    expect(generateRoadmap).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

// Edit my schedule (B-108): onboarding may send the chosen rest days with the routine.
describe('goal create with chosen rest days (B-108)', () => {
  it('saves valid rest days on the routine and passes them to week 1', async () => {
    expect((await create({ routine: { dailyMinutes: 30, planVariant: 'steady', restWeekdays: [6, 0] } })).status).toBe(201);
    expect(JSON.parse(savedGoal().routine).restWeekdays).toEqual([0, 6]);
    expect(vi.mocked(generateWeekPlan).mock.calls[0][0].restWeekdays).toEqual([0, 6]);
  });

  it('none sent keeps the variant\'s rest days; ones that do not fit answer 400 before any model call', async () => {
    expect((await create()).status).toBe(201);
    expect(JSON.parse(savedGoal().routine).restWeekdays).toBeUndefined();
    vi.mocked(generateRoadmap).mockClear();
    const res = await create({ routine: { dailyMinutes: 30, planVariant: 'steady', restWeekdays: [0] } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Choose your rest days again: as many as the days a week leave free.');
    expect(generateRoadmap).not.toHaveBeenCalled();
  });
});

