import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// When the AI cannot write plan v2, goal create answers honestly and saves nothing, for presets too. It used to
// fall back silently to a preset's fixed v1 plan, which hid a missing AI key and gave users a plan without the plan
// v2 features (missed sessions, weekly targets).

const writes = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { create: writes.goalCreate, updateMany: writes.goalUpdateMany },
    roadmapWeek: { createMany: writes.weeksCreateMany },
    dailyTask: { createMany: writes.tasksCreateMany },
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

const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const target = { kind: 'number', metric: 'Pace', value: 5, unit: 'min/km', direction: 'lower_is_better' };
const test = { type: 'time_trial', instructions: 'Run 5 km as fast as you can', passIf: 'Under 26 minutes' };
const roadmapOk = {
  ok: true,
  roadmap: {
    finalGoal: RUN_10K.clarifiedOutcome,
    method: { name: 'Easy miles', creator: '', rules: ['Most runs easy'] },
    phases: [{ name: 'Base', purpose: 'Build the engine.' }],
    weeks: [{ focus: 'Easy runs', target, test }],
  },
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
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
});

const create = async () => {
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({ ...RUN_10K, answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
  });
  return { status: res.status, body: await res.json() };
};

const expectNothingSaved = () => {
  for (const write of Object.values(writes)) expect(write).not.toHaveBeenCalled();
};

describe('goal create without a silent v1 fallback', () => {
  it('a preset whose roadmap cannot be written gets an honest 503 and nothing is saved', async () => {
    vi.mocked(generateRoadmap).mockResolvedValue({ ok: false, reason: "Couldn't design your roadmap right now. Please try again." });
    const { status, body } = await create();
    expect(status).toBe(503);
    expect(body.error).toBe("Couldn't design your roadmap right now. Please try again.");
    expect(generateWeekPlan).not.toHaveBeenCalled();
    expectNothingSaved();
  });

  it('a preset whose first week cannot be written gets an honest 503 and nothing is saved', async () => {
    vi.mocked(generateRoadmap).mockResolvedValue(roadmapOk as never);
    vi.mocked(generateWeekPlan).mockResolvedValue(null);
    const { status, body } = await create();
    expect(status).toBe(503);
    expect(body.error).toBe("Couldn't write your first week right now. Please try again.");
    expectNothingSaved();
  });

  it('an unsafe goal still answers 422', async () => {
    vi.mocked(generateRoadmap).mockResolvedValue({ ok: false, reason: 'This goal is outside what Achivii can plan safely.', unsafe: true });
    const { status } = await create();
    expect(status).toBe(422);
    expectNothingSaved();
  });

  it('logs why, so a missing or broken AI key is visible in the logs', async () => {
    vi.mocked(generateRoadmap).mockResolvedValue({ ok: false, reason: "Couldn't design your roadmap right now. Please try again." });
    await create();
    expect(console.warn).toHaveBeenCalledWith('[GoalRouter] Plan v2 could not be written:', expect.stringContaining("Couldn't design"));
  });
});
