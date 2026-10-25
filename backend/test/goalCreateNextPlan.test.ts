import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Next plan (docs/features/next-plan, NP-3, NP-7 to NP-10): `POST /api/goal/create` with `nextPlan` is Pro for every
// goal, reads the level from the old plan itself, adds it as one answer, holds the roadmap's starting point to it, and
// stores the link under `Goal.roadmap.previousPlan`.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFind: vi.fn(),
  goalFindFirst: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
}));

const auth = vi.hoisted(() => ({ custom: vi.fn(), next: vi.fn() }));

vi.mock('../src/lib/prisma.js', () => {
  const prisma: any = {
    goal: { create: db.goalCreate, updateMany: db.goalUpdateMany, findUniqueOrThrow: db.goalFind, findFirst: db.goalFindFirst },
    roadmapWeek: { createMany: db.weeksCreateMany },
    dailyTask: { createMany: db.tasksCreateMany },
  };
  // B-100: goal create saves in one transaction, on the same mocks.
  prisma.$transaction = async (fn: (tx: unknown) => unknown) => fn(prisma);
  return { prisma };
});

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../src/lib/billing/goalAuthorization.js', () => ({
  authorizeNewCustomGoal: auth.custom,
  authorizeNextPlan: auth.next,
}));

vi.mock('../src/lib/ai/gemini.js', () => ({ generateStructuredContent: vi.fn() }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { goalRouter } from '../src/routes/goal.js';

const GOAL = 'Run 10 km without stopping';

function modelAnswer(start: number) {
  return {
    finalGoal: GOAL,
    finalTest: 'Run 10 km.',
    startingPoint: { value: start, description: 'Today' },
    candidates: [
      { name: 'Run-walk', creator: '', summary: 'Run and walk.', strengths: 'Easy.', weaknesses: 'Slow.' },
      { name: 'Steady runs', creator: '', summary: 'Run steady.', strengths: 'Simple.', weaknesses: 'Hard.' },
    ],
    chosen: 'Run-walk',
    whyChosen: 'Fits.',
    runnerUp: { name: 'Steady runs', whyLost: 'Harder.' },
    safety: 4,
    rules: ['One', 'Two', 'Three', 'Four', 'Five'],
    phases: [
      { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Base.' },
      { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build.' },
      { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Peak.' },
    ],
    weeks: [7.5, 7.5, 8, 8, 8.5, 8.5, 9, 9, 9.5, 9.5, 10, 10].map((value, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: 'Run',
      target: { kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' },
      test: { type: 'count', instructions: 'Run as far as you can.', passIf: `${value} km` },
    })),
  };
}

/** The old plan: 3 km to 10 km, week 12 tested at 7 km. */
function oldGoal(status: string, roadmapExtra: Record<string, unknown> = {}) {
  return {
    id: 'goal-old',
    userId: 'u1',
    status,
    rawGoal: GOAL,
    clarifiedOutcome: GOAL,
    roadmap: { method: { name: 'Run-walk' }, finalTest: 'Run 10 km.', startingPoint: { value: 3, description: '3 km' }, ...roadmapExtra },
    roadmapWeeks: [3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10].map((value, index) => ({
      weekNumber: index + 1,
      target: { kind: 'number', metric: 'Continuous run distance', value, unit: 'km', direction: 'higher_is_better' },
      test: { type: 'count', instructions: 'Run.', passIf: `${value} km` },
      objective: `${value} km`,
      keyMilestone: 'Run',
      status: 'completed',
      ...(index === 11 ? { testResult: { value: 7, unit: 'km', passed: false } } : {}),
    })),
  };
}

const DAY = {
  dayNumber: 1,
  date: '2026-10-25',
  dayOfWeek: 'Sunday',
  title: 'Easy run',
  isRestDay: false,
  durationMinutes: 30,
  slotTime: '07:00',
  implementationIntention: 'At 07:00: Easy run.',
  detailedSteps: [],
  isKeySession: false,
  isTestDay: false,
  whyToday: 'Base.',
  minimumVersion: null,
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
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  vi.mocked(generateWeekPlan).mockResolvedValue([DAY] as never);
  auth.custom.mockResolvedValue({ allowed: false, code: 'CUSTOM_GOAL_REQUIRES_PRO', message: 'Custom Goals require Achivii Pro.' });
  auth.next.mockResolvedValue({ allowed: true });
  db.goalFindFirst.mockResolvedValue(oldGoal('completed'));
  db.goalCreate.mockImplementation(async () => ({ id: 'goal-new' }));
  db.goalFind.mockResolvedValue({ id: 'goal-new', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
  vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: modelAnswer(7) } as never);
});

const create = async (nextPlan: unknown) => {
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({
      rawGoal: GOAL,
      clarifiedOutcome: GOAL,
      answers: {},
      answerList: [{ id: 'current_level', question: 'Where are you now?', answer: 'I can run 3 km' }],
      routine: { dailyMinutes: 30, planVariant: 'steady' },
      nextPlan,
    }),
  });
  return { status: res.status, body: await res.json() };
};

const stored = () => db.goalCreate.mock.calls[0][0].data.roadmap;
const prompt = (call = 0) => vi.mocked(generateStructuredContent).mock.calls[call][0] as string;

describe('goal create with nextPlan', () => {
  it('keep going: Pro check only, the measured level as one answer, the link stored (NP-3, NP-7, NP-8)', async () => {
    const { status } = await create({ fromGoalId: 'goal-old', mode: 'keep_going' });
    expect(status).toBe(201);
    expect(auth.next).toHaveBeenCalledWith('u1');
    expect(auth.custom).not.toHaveBeenCalled();
    expect(db.goalFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'goal-old', userId: 'u1' } }));
    expect(prompt()).toContain('7 km (that plan started at 3 km). This is where they are now');
    expect(stored().startingPoint.value).toBe(7);
    expect(stored().previousPlan).toEqual({ goalId: 'goal-old', number: 2, mode: 'keep_going', summary: '3 km → 7 km' });
    expect(stored().answers.map((item: { id: string }) => item.id)).toEqual(['current_level', 'measured_level']);
  });

  it('the roadmap’s own starting point is sent back once (NP-3)', async () => {
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({ success: true, data: modelAnswer(3) } as never)
      .mockResolvedValueOnce({ success: true, data: modelAnswer(7) } as never);
    const { status } = await create({ fromGoalId: 'goal-old', mode: 'keep_going' });
    expect(status).toBe(201);
    expect(prompt(1)).toContain('"startingPoint.value" must be 7 km');
    expect(stored().startingPoint.value).toBe(7);
  });

  it('a third plan counts on from the old link', async () => {
    db.goalFindFirst.mockResolvedValue(oldGoal('completed', { previousPlan: { goalId: 'g0', number: 2, mode: 'keep_going', summary: 'x' } }));
    await create({ fromGoalId: 'goal-old', mode: 'go_further', level: 7 });
    expect(stored().previousPlan).toMatchObject({ number: 3, mode: 'go_further' });
  });

  it('not Pro: 403 with its own code, nothing read or written (NP-7)', async () => {
    auth.next.mockResolvedValue({ allowed: false, code: 'NEXT_PLAN_REQUIRES_PRO', message: 'Pro.' });
    const { status, body } = await create({ fromGoalId: 'goal-old', mode: 'keep_going' });
    expect(status).toBe(403);
    expect(body.code).toBe('NEXT_PLAN_REQUIRES_PRO');
    expect(db.goalFindFirst).not.toHaveBeenCalled();
    expect(db.goalCreate).not.toHaveBeenCalled();
  });

  it('a fresh plan needs the active plan and a typed level (NP-9)', async () => {
    expect((await create({ fromGoalId: 'goal-old', mode: 'fresh', level: 5 })).status).toBe(409);
    db.goalFindFirst.mockResolvedValue(oldGoal('active'));
    expect((await create({ fromGoalId: 'goal-old', mode: 'fresh' })).status).toBe(400);
    const { status } = await create({ fromGoalId: 'goal-old', mode: 'fresh', level: 7 });
    expect(status).toBe(201);
    expect(stored().previousPlan).toMatchObject({ mode: 'fresh' });
  });

  it('refuses a plan that is not theirs, a bad body, or keep going from an active plan', async () => {
    db.goalFindFirst.mockResolvedValueOnce(null);
    expect((await create({ fromGoalId: 'goal-x', mode: 'keep_going' })).status).toBe(404);
    expect((await create({ fromGoalId: 'goal-old', mode: 'again' })).status).toBe(400);
    expect((await create({ fromGoalId: 'goal-old', mode: 'keep_going', level: -1 })).status).toBe(400);
    db.goalFindFirst.mockResolvedValueOnce(oldGoal('active'));
    expect((await create({ fromGoalId: 'goal-old', mode: 'keep_going' })).status).toBe(409);
    expect(db.goalCreate).not.toHaveBeenCalled();
  });

  it('without nextPlan the custom-goal check runs as before', async () => {
    const res = await fetch(`${baseUrl}/api/goal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ rawGoal: 'Learn to juggle', clarifiedOutcome: 'Juggle 3 balls', answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
    });
    expect(res.status).toBe(403);
    expect(auth.custom).toHaveBeenCalled();
    expect(auth.next).not.toHaveBeenCalled();
  });
});
