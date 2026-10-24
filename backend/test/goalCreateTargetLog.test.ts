import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Plan safety limits M1.2 (RULE-2, RULE-10, AC-2, AC-10, PSL-11 Q15): goal create stores a too-steep climb with safe
// targets and the model's values under `Goal.roadmap.loweredTargets`, and logs one `[Safety]` line per lowered target,
// with the goal id, only after the goal is saved. A retried attempt never logs.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFind: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { create: db.goalCreate, updateMany: db.goalUpdateMany, findUniqueOrThrow: db.goalFind },
    roadmapWeek: { createMany: db.weeksCreateMany },
    dailyTask: { createMany: db.tasksCreateMany },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../src/lib/billing/goalAuthorization.js', () => ({
  authorizeNewCustomGoal: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../src/lib/ai/gemini.js', () => ({ generateStructuredContent: vi.fn() }));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { generateStructuredContent } from '../src/lib/ai/gemini.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { presetMethod } from '../src/lib/ai/roadmap.js';
import { recompPreset, run10kPreset, type CertifiedPresetBlueprint } from '../src/lib/ai/presets/index.js';
import { goalRouter } from '../src/routes/goal.js';

type Direction = 'higher_is_better' | 'lower_is_better';

function modelAnswer(method: CertifiedPresetBlueprint, metric: string, unit: string, direction: Direction, start: number, values: number[], finalGoal: string) {
  return {
    finalGoal,
    finalTest: 'The model wrote its own final test.',
    startingPoint: { value: start, description: 'Where they are today.' },
    candidates: [],
    chosen: presetMethod(method).name,
    whyChosen: 'It fits their answers.',
    runnerUp: { name: '', whyLost: '' },
    safety: 4,
    rules: ['Rule one', 'Rule two', 'Rule three', 'Rule four', 'Rule five'],
    phases: [
      { name: 'Base', startWeek: 1, endWeek: 4, purpose: 'Build the base.' },
      { name: 'Build', startWeek: 5, endWeek: 8, purpose: 'Build on it.' },
      { name: 'Peak', startWeek: 9, endWeek: 12, purpose: 'Get ready.' },
    ],
    weeks: values.map((value, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: `Focus ${index + 1}`,
      target: { kind: 'number', metric, value, unit, direction },
      test: { type: 'count', instructions: 'The model wrote this test.', passIf: `${value} ${unit}` },
    })),
  };
}

const STEEP_10K = [68, 66, 64, 62, 60, 58, 56, 55, 54, 53, 52, 50];
const SAFE_10K = [68.6, 67.3, 66, 64.7, 63.5, 62.3, 61.1, 59.9, 58.8, 57.7, 56.6, 55.5];
const STEEP_FAT = [27.3, 26.6, 25.9, 25.2, 24.5, 23.8, 23.1, 22.4, 21.7, 21, 20.3, 19.6];
const SAFE_FAT = [27.5, 27, 26.5, 26, 25.5, 25, 24.5, 24, 23.5, 23, 22.5, 22];

const DAY = {
  dayNumber: 1,
  date: '2026-10-20',
  dayOfWeek: 'Tuesday',
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
  db.goalCreate.mockImplementation(async () => ({ id: 'goal-new' }));
  db.goalFind.mockResolvedValue({ id: 'goal-new', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
});

const create = async (rawGoal: string, clarifiedOutcome: string) => {
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({ rawGoal, clarifiedOutcome, answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
  });
  return res.status;
};

const safetyLines = () =>
  vi.mocked(console.warn).mock.calls.filter((call) => call[0] === '[Safety]').map((call) => JSON.parse(call[1] as string));

const storedTargets = () => (db.weeksCreateMany.mock.calls[0][0].data as Array<{ target: { value: number } }>).map((row) => row.target.value);

describe('goal create stores safe targets and logs each lowered one (AC-2, AC-10)', () => {
  it('run10k: safe targets stored, the model values in loweredTargets, one line each after the save, none from the retried attempt', async () => {
    // The first answer misses the stated "under 50 minutes" in its own week 12 (52): refused, and nothing is logged.
    vi.mocked(generateStructuredContent)
      .mockResolvedValueOnce({
        success: true,
        data: modelAnswer(run10kPreset, '10K time', 'minutes', 'lower_is_better', 70, [...STEEP_10K.slice(0, 10), 52.5, 52], 'Run a 10K in 52 minutes'),
      } as never)
      .mockResolvedValueOnce({
        success: true,
        data: modelAnswer(run10kPreset, '10K time', 'minutes', 'lower_is_better', 70, STEEP_10K, 'Run a 10K in 50 minutes or less'),
      } as never);

    expect(await create('Run a 10K under 50 minutes', 'Run a 10K in under 50 minutes')).toBe(201);

    expect(generateStructuredContent).toHaveBeenCalledTimes(2);
    // Light weeks hold the next big week's lowered value (weeks 4, 8, 12).
    expect(storedTargets()).toEqual([64.7, 64.7, 64.7, 64.7, 59.9, 59.9, 59.9, 59.9, 55.5, 55.5, 55.5, 55.5]);
    const roadmap = db.goalCreate.mock.calls[0][0].data.roadmap;
    expect(roadmap.loweredTargets).toEqual(STEEP_10K.map((model, index) => ({ week: index + 1, model, safe: SAFE_10K[index] })));
    expect(roadmap.weeks).toBeUndefined();
    // M1.2 review: the check's decision is carried to the log, never stored.
    expect(roadmap.targetCheck).toBeUndefined();

    const lines = safetyLines();
    expect(lines).toHaveLength(12);
    for (const line of lines) expect(line).toMatchObject({ goalId: 'goal-new', rule: 'target_step', outcome: 'lowered' });
    expect(lines[0]).toMatchObject({ week: 1, model: 68, safe: 68.6 });
    // Logged after the goal was saved.
    const createdAt = db.goalCreate.mock.invocationCallOrder[0];
    const firstLine = vi.mocked(console.warn).mock.invocationCallOrder[vi.mocked(console.warn).mock.calls.findIndex((call) => call[0] === '[Safety]')];
    expect(firstLine).toBeGreaterThan(createdAt);
  });

  it('recomp: body fat stored at 0.5 points a week, one line per lowered week', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValueOnce({
      success: true,
      data: modelAnswer(recompPreset, 'Body fat', 'percent', 'lower_is_better', 28, STEEP_FAT, 'Reach 19.6 percent body fat'),
    } as never);

    expect(await create('Drop 5% Body Fat & Build Lean Muscle', 'Drop 5% body fat and build lean muscle')).toBe(201);

    expect(storedTargets()).toEqual([26, 26, 26, 26, 24, 24, 24, 24, 22, 22, 22, 22]);
    expect(db.goalCreate.mock.calls[0][0].data.roadmap.loweredTargets).toEqual(
      STEEP_FAT.map((model, index) => ({ week: index + 1, model, safe: SAFE_FAT[index] }))
    );
    const lines = safetyLines();
    expect(lines).toHaveLength(12);
    expect(lines.every((line) => line.goalId === 'goal-new' && line.rule === 'target_step')).toBe(true);
  });

  it('a climb within the limits stores no loweredTargets and logs nothing', async () => {
    vi.mocked(generateStructuredContent).mockResolvedValueOnce({
      success: true,
      data: modelAnswer(run10kPreset, '10K time', 'minutes', 'lower_is_better', 60, [59, 58, 57, 56.5, 56, 55.5, 55.2, 55, 55, 55, 55, 55], 'Run a 10K in 55 minutes'),
    } as never);

    expect(await create('Run a 10K', 'Run a 10K in 55 minutes')).toBe(201);

    expect(db.goalCreate.mock.calls[0][0].data.roadmap.loweredTargets).toBeUndefined();
    expect(safetyLines()).toEqual([]);
  });

  it("logs week 1's held [Safety] lines with the new goal id, after the save (B-91)", async () => {
    vi.mocked(generateStructuredContent).mockResolvedValueOnce({
      success: true,
      data: modelAnswer(run10kPreset, '10K time', 'minutes', 'lower_is_better', 60, [59, 58, 57, 56.5, 56, 55.5, 55.2, 55, 55, 55, 55, 55], 'Run a 10K in 55 minutes'),
    } as never);
    vi.mocked(generateWeekPlan).mockImplementationOnce(async (input) => {
      input.heldSafetyLines?.push({ goalId: null, week: 1, rule: 'load_missing', step: 'Day 1 step "Run"', matched: 'hardRun', outcome: 'kept' } as never);
      return [DAY] as never;
    });

    expect(await create('Run a 10K', 'Run a 10K in 55 minutes')).toBe(201);

    expect(safetyLines()).toEqual([expect.objectContaining({ goalId: 'goal-new', week: 1, rule: 'load_missing' })]);
  });

  it('the log and the check agree for a goal that matches run10k only by its working title (M1.2 review)', async () => {
    // "Time" in minutes is running only on run10k (PSL-10 (3)); the raw goal names no pathway, the clarified one does.
    vi.mocked(generateStructuredContent).mockResolvedValueOnce({
      success: true,
      data: modelAnswer(run10kPreset, 'Time', 'minutes', 'lower_is_better', 70, STEEP_10K, 'Run a 10K in 50 minutes or less'),
    } as never);

    expect(await create('Get quicker at my weekend runs', 'Run a 10K under 50 minutes')).toBe(201);

    expect(storedTargets()).toEqual([64.7, 64.7, 64.7, 64.7, 59.9, 59.9, 59.9, 59.9, 55.5, 55.5, 55.5, 55.5]);
    const lines = safetyLines();
    expect(lines).toHaveLength(12);
    expect(lines.every((line) => line.goalId === 'goal-new' && line.rule === 'target_step')).toBe(true);
    expect(lines.some((line) => line.rule === 'unknown_family')).toBe(false);
  });
});
