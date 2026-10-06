import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// M2.1 (ND-5): both callers of the week call pass `highLoadGoal` from `isHighLoadGoal`.

vi.mock('../src/lib/prisma.js', () => ({ prisma: {} }));

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
import { writeNextWeek } from '../src/lib/planV2.js';

const weekCall = vi.mocked(generateWeekPlan);

const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const CUSTOM = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy on keybr.com' };

const target = { kind: 'number', metric: 'Pace', value: 5, unit: 'min/km', direction: 'lower_is_better' };
const test = { type: 'time_trial', instructions: 'Run 5 km as fast as you can', passIf: 'Under 26 minutes' };
const method = { name: 'Easy miles', creator: '', rules: ['Most runs easy'] };
const phase = { name: 'Base', purpose: 'Build the engine.' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // The callers' input is all these tests need; the rest of goal create is out of their scope.
  weekCall.mockRejectedValue(new Error('stop after the week call'));
});

describe('goal create passes highLoadGoal to the week call', () => {
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

  const create = async (goal: { rawGoal: string; clarifiedOutcome: string }) => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
    vi.mocked(generateRoadmap).mockResolvedValue({
      ok: true,
      roadmap: { finalGoal: goal.clarifiedOutcome, method, phases: [phase], weeks: [{ focus: 'Easy runs', target, test }] },
    } as never);
    await fetch(`${baseUrl}/api/goal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ ...goal, answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
    });
    expect(weekCall).toHaveBeenCalledTimes(1);
    return weekCall.mock.calls[0][0];
  };

  it('true for a run10k goal', async () => {
    expect((await create(RUN_10K)).highLoadGoal).toBe(true);
  });

  it('false for a custom goal', async () => {
    expect((await create(CUSTOM)).highLoadGoal).toBe(false);
  });
});

describe('writeNextWeek passes highLoadGoal to the week call', () => {
  const stored = (goal: { rawGoal: string; clarifiedOutcome: string }) =>
    ({
      ...goal,
      id: 'g1',
      startDate: new Date('2026-09-21T00:00:00Z'),
      routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
      roadmap: { finalGoal: goal.clarifiedOutcome, finalTest: '', startingPoint: {}, method, phases: [phase], answers: [] },
      roadmapWeeks: [
        { weekNumber: 1, phase: 'Base', theme: 'Easy runs', target, test },
        { weekNumber: 2, phase: 'Base', theme: 'Longer runs', target, test },
      ],
    }) as never;

  const next = async (goal: { rawGoal: string; clarifiedOutcome: string }) => {
    await writeNextWeek(stored(goal), 1, [], '19:30').catch(() => null);
    expect(weekCall).toHaveBeenCalledTimes(1);
    return weekCall.mock.calls[0][0];
  };

  it('true for a run10k goal', async () => {
    expect((await next(RUN_10K)).highLoadGoal).toBe(true);
  });

  it('false for a custom goal', async () => {
    expect((await next(CUSTOM)).highLoadGoal).toBe(false);
  });
});
