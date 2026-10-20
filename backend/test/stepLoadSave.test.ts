import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Plan safety limits M2.1 (RULE-4, PSL-4): a step's load reaches the stored step JSON, through goal create and through
// writeNextWeek and saveWeekTasks. Only the model and the database are mocked.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(async () => ({ id: 'g1' })),
  goalUpdateMany: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
  tasksDeleteMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => {
  const tx = { dailyTask: { deleteMany: db.tasksDeleteMany, createMany: db.tasksCreateMany } };
  return {
    prisma: {
      goal: { create: db.goalCreate, updateMany: db.goalUpdateMany },
      roadmapWeek: { createMany: db.weeksCreateMany },
      dailyTask: { createMany: db.tasksCreateMany, findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    },
  };
});

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

vi.mock('../src/lib/ai/gemini.js', () => ({
  generateStructuredContent: vi.fn(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { generateRoadmap } from '../src/lib/ai/roadmap.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { goalRouter } from '../src/routes/goal.js';
import { saveWeekTasks, writeNextWeek } from '../src/lib/planV2.js';
import { PATHWAY_PROFILES } from '../src/lib/recovery/pathways.js';

const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const target = { kind: 'number', metric: 'Pace', value: 5, unit: 'min/km', direction: 'lower_is_better' };
const test = { type: 'time_trial', instructions: 'Run 5 km at a steady effort and log your time', passIf: 'Under 26 minutes' };
const method = { name: 'Easy miles', creator: '', rules: ['Most runs easy'] };
const phase = { name: 'Base', purpose: 'Build the engine.' };

function step(title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) {
  return {
    title,
    instructions: `${title}: keep it relaxed and steady from the first minute to the last one.`,
    minutes,
    output: 'Distance and time written down',
    doneWhen: 'Done at the planned effort',
    focusCue: 'Relaxed shoulders',
    pitfall: 'Starting too fast',
    priority,
    highLoad: false,
    ...extra,
  };
}

const RUN_LOAD = { runMinutes: 20, runKm: 3, hardRun: false };

/** Steady: days 1-3 and 5-6 practice, 4 and 7 rest, day 6 the test; 30 minutes a day. */
function runWeek() {
  return {
    days: Array.from({ length: 7 }, (_, index) => {
      const dayNumber = index + 1;
      if (dayNumber === 4 || dayNumber === 7) return { dayNumber, isKeySession: false, title: 'Rest and recover', whyToday: 'Recovery.', steps: [] };
      const steps =
        dayNumber === 6
          ? [
              step('Jog gently before the test', 2, 5, { kind: 'weekly_test' }),
              step('Weekly test: 5 km at a steady effort', 1, 25, { kind: 'weekly_test', highLoad: true, load: { runKm: 5, hardRun: false } }),
            ]
          : [
              step(`Easy run ${dayNumber}`, 1, 20, { kind: 'easy_session', highLoad: true, load: RUN_LOAD }),
              step(`Calf and hip circuit ${dayNumber}`, 2, 10, { kind: 'strength_and_mobility' }),
            ];
      return {
        dayNumber,
        isKeySession: dayNumber === 2,
        title: `Run day ${dayNumber}`,
        whyToday: 'Builds easy running time.',
        steps,
        minimumVersion: { ...step(`Short easy run ${dayNumber}`, 1, 10), load: { runMinutes: 10, hardRun: false } },
      };
    }),
  };
}

/** The stored rows' step JSON, as Prisma would get it. */
const storedDay1 = () => {
  const rows = db.tasksCreateMany.mock.calls.at(-1)![0].data as Array<{ detailedSteps: string; minimumVersion: unknown }>;
  return { steps: JSON.parse(rows[0].detailedSteps), minimumVersion: rows[0].minimumVersion as Record<string, unknown> };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(generateStructuredContent).mockResolvedValue({ success: true, data: runWeek() } as never);
});

describe('goal create stores the load', () => {
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

  it('in week 1 step JSON and the 10-minute version', async () => {
    vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
    vi.mocked(generateRoadmap).mockResolvedValue({
      ok: true,
      roadmap: { finalGoal: RUN_10K.clarifiedOutcome, method, phases: [phase], weeks: [{ weekNumber: 1, phase: 'Base', focus: 'Easy runs', target, test }] },
    } as never);
    await fetch(`${baseUrl}/api/goal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
      body: JSON.stringify({ ...RUN_10K, answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
    });
    // The load schema was asked for: run10k is a load goal.
    expect(JSON.stringify(vi.mocked(generateStructuredContent).mock.calls[0][3])).toContain('"load"');
    expect(db.tasksCreateMany).toHaveBeenCalledTimes(1);
    const day1 = storedDay1();
    expect(day1.steps[0].load).toEqual(RUN_LOAD);
    expect(day1.steps[1].load).toBeUndefined();
    expect(day1.minimumVersion.load).toEqual({ runMinutes: 10, hardRun: false });
  });
});

describe('writeNextWeek and saveWeekTasks store the load', () => {
  it('in the next week step JSON', async () => {
    const goal = {
      ...RUN_10K,
      id: 'g1',
      startDate: new Date('2026-09-21T00:00:00Z'),
      routine: JSON.stringify({ dailyMinutes: 30, planVariant: 'steady' }),
      roadmap: { finalGoal: RUN_10K.clarifiedOutcome, finalTest: '', startingPoint: {}, method, phases: [phase], answers: [], recovery: PATHWAY_PROFILES.run10k },
      roadmapWeeks: [
        { weekNumber: 1, phase: 'Base', theme: 'Easy runs', target, test },
        { weekNumber: 2, phase: 'Base', theme: 'Longer runs', target, test },
      ],
    } as never;
    const days = await writeNextWeek(goal, 1, [], '19:30');
    expect(days).not.toBeNull();
    await saveWeekTasks('g1', 2, days!);
    const day1 = storedDay1();
    expect(day1.steps[0].load).toEqual(RUN_LOAD);
    expect(day1.minimumVersion.load).toEqual({ runMinutes: 10, hardRun: false });
  });
});
