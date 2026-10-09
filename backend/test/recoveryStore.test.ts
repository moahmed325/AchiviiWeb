import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Method-aware recovery M1.3a: every new plan v2 goal is saved with a checked profile (RULE-2 to RULE-4), and an
// older goal gets one at its next weekly review without ever changing that review's result (RULE-1, MR-14).

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFindUniqueOrThrow: vi.fn(),
  goalFindFirst: vi.fn(),
  goalUpdate: vi.fn(),
  weeksCreateMany: vi.fn(),
  weekUpdate: vi.fn(),
  tasksCreateMany: vi.fn(),
  reviewUpsert: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: {
      create: db.goalCreate,
      updateMany: db.goalUpdateMany,
      findUniqueOrThrow: db.goalFindUniqueOrThrow,
      findFirst: db.goalFindFirst,
      update: db.goalUpdate,
    },
    roadmapWeek: { createMany: db.weeksCreateMany, update: db.weekUpdate },
    dailyTask: { createMany: db.tasksCreateMany },
    weeklyReview: { upsert: db.reviewUpsert },
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

vi.mock('../src/lib/planV2.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/planV2.js')>()),
  writeNextWeek: vi.fn(),
  saveWeekTasks: vi.fn(),
}));

vi.mock('../src/lib/recovery/forGoal.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/recovery/forGoal.js')>();
  return { ...actual, makeGoalProfile: vi.fn(actual.makeGoalProfile) };
});

import { getAuthUser } from '../src/routes/auth.js';
import { generateRoadmap } from '../src/lib/ai/roadmap.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { saveWeekTasks, writeNextWeek } from '../src/lib/planV2.js';
import { makeGoalProfile } from '../src/lib/recovery/forGoal.js';
import { PATHWAY_PROFILES, RECOVERY_TEMPLATES } from '../src/lib/recovery/index.js';
import { goalRouter } from '../src/routes/goal.js';

const number = { kind: 'number', metric: 'Pace', value: 5, unit: 'min/km', direction: 'lower_is_better' };
const deliverable = { kind: 'deliverable', description: 'A finished piece' };
const weekTest = { type: 'time_trial', instructions: 'Do the test', passIf: 'It is done' };

const roadmapResult = (week12Target: object) => ({
  ok: true,
  roadmap: {
    finalGoal: 'The goal',
    finalTest: 'The final test',
    startingPoint: { value: null, description: 'Now' },
    method: { name: 'Plain method', creator: '', summary: '', rules: ['Practise'] },
    phases: [{ name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 12 }],
    weeks: Array.from({ length: 12 }, (_, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: 'Focus',
      target: index === 11 ? week12Target : number,
      test: weekTest,
    })),
  },
});

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
  db.goalCreate.mockResolvedValue({ id: 'g1' });
  db.goalFindUniqueOrThrow.mockResolvedValue({ id: 'g1', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
  vi.mocked(generateWeekPlan).mockResolvedValue([] as never);
});

const savedRecovery = () => db.goalCreate.mock.calls[0][0].data.roadmap.recovery;

async function create(body: { rawGoal: string; clarifiedOutcome: string; domain?: string }, week12Target: object = number) {
  vi.mocked(generateRoadmap).mockResolvedValue(roadmapResult(week12Target) as never);
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({ ...body, answers: {}, routine: { dailyMinutes: 30, planVariant: 'steady' } }),
  });
  return { status: res.status, body: await res.json() };
}

describe('goal create saves a checked profile (RULE-2, RULE-3, RULE-4)', () => {
  it('a pathway goal gets its hand-written profile', async () => {
    const { status } = await create({ rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' });
    expect(status).toBe(201);
    expect(savedRecovery()).toEqual(PATHWAY_PROFILES.run10k);
    // The rest of the stored roadmap is unchanged.
    expect(db.goalCreate.mock.calls[0][0].data.roadmap).toMatchObject({ finalGoal: 'The goal', method: { name: 'Plain method' }, answers: [] });
  });

  it('a custom goal with no keyword match gets General practice', async () => {
    const { status } = await create({ rawGoal: 'Bake sourdough bread at home', clarifiedOutcome: 'Bake sourdough bread at home', domain: 'Bread baking' });
    expect(status).toBe(201);
    expect(savedRecovery()).toEqual(RECOVERY_TEMPLATES.general);
  });

  it('a custom goal can match on the clarify domain alone', async () => {
    await create({ rawGoal: 'Get much better this year', clarifiedOutcome: 'Get much better this year', domain: 'Drawing' });
    expect(savedRecovery()).toEqual(RECOVERY_TEMPLATES.creative);
  });

  it('MR-22: a deliverable week 12 does not stop a pathway or template profile (no deliverable check)', async () => {
    await create({ rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' }, deliverable);
    expect(savedRecovery()).toEqual(PATHWAY_PROFILES.run10k);

    db.goalCreate.mockClear();
    const { status } = await create({ rawGoal: 'Bake sourdough bread at home', clarifiedOutcome: 'Bake sourdough bread at home' }, deliverable);
    expect(status).toBe(201);
    expect(savedRecovery()).toEqual(RECOVERY_TEMPLATES.general);
    expect(makeGoalProfile).not.toHaveBeenCalledWith(expect.objectContaining({ deliverableGoal: expect.anything() }));
  });

  it('a failing profile is not saved, is logged, and creation still succeeds', async () => {
    vi.mocked(makeGoalProfile).mockReturnValueOnce({ reasons: ['the rest gap must be 0, 1 or 2 days.'] });
    const { status, body } = await create({ rawGoal: 'Bake sourdough bread at home', clarifiedOutcome: 'Bake sourdough bread at home' });
    expect(status).toBe(201);
    expect(body.goal.id).toBe('g1');
    expect(db.goalCreate).toHaveBeenCalledTimes(1);
    expect(savedRecovery()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[Recovery] No profile saved at goal create:', ['the rest gap must be 0, 1 or 2 days.']);
  });

  it('an error while making the profile never fails creation', async () => {
    vi.mocked(makeGoalProfile).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const { status } = await create({ rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' });
    expect(status).toBe(201);
    expect(savedRecovery()).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[Recovery] Could not make a profile at goal create:', expect.any(Error));
  });
});

// ---------------------------------------------------------------------------------------------------------------

const storedRoadmap = { finalGoal: 'The goal', finalTest: 'The final test', method: { name: 'Plain method', rules: [] }, phases: [], answers: [{ id: 'success', question: 'Q', answer: 'A' }] };

const olderGoal = (overrides: Record<string, unknown> = {}, week12Target: object = number) => ({
  id: 'g-old',
  userId: 'u1',
  planVersion: 2,
  status: 'active',
  rawGoal: 'Run a 10K under 50 minutes',
  clarifiedOutcome: 'Finish a 10 km race in under 50:00',
  routine: '{}',
  startDate: new Date('2026-09-01T00:00:00Z'),
  currentWeek: 1,
  roadmap: storedRoadmap,
  roadmapWeeks: [1, 2, 12].map((weekNumber) => ({ id: `rw-${weekNumber}`, weekNumber, status: weekNumber === 1 ? 'active' : 'pending', target: weekNumber === 12 ? week12Target : number })),
  dailyTasks: [{ id: 't1', weekNumber: 1, dayNumber: 1, isRestDay: false, status: 'completed' }],
  ...overrides,
});

async function review(goal: object) {
  db.goalFindFirst.mockResolvedValue(goal);
  db.reviewUpsert.mockResolvedValue({ id: 'rev-1', scorePercentage: 100 });
  db.weekUpdate.mockResolvedValue({});
  vi.mocked(writeNextWeek).mockResolvedValue([{ dayNumber: 1, title: 'Day', isRestDay: false }] as never);
  vi.mocked(saveWeekTasks).mockResolvedValue([] as never);
  const res = await fetch(`${baseUrl}/api/goal/weeks/1/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify({ reflection: 'Fine' }),
  });
  return { status: res.status, body: await res.json() };
}

const roadmapWrites = () => db.goalUpdate.mock.calls.filter(([args]) => 'roadmap' in args.data);

describe('the weekly review gives an older goal its profile (RULE-1, MR-14)', () => {
  it('saves the pathway profile before the week call and keeps the rest of the roadmap', async () => {
    db.goalUpdate.mockResolvedValue({});
    const { status } = await review(olderGoal());
    expect(status).toBe(200);
    expect(roadmapWrites()).toHaveLength(1);
    const [{ where, data }] = roadmapWrites()[0];
    expect(where).toEqual({ id: 'g-old' });
    expect(data.roadmap).toEqual({ ...storedRoadmap, recovery: PATHWAY_PROFILES.run10k });
    // Before the week call; the week call gets the goal as loaded, unchanged (M2.1 passes the profile).
    expect(db.goalUpdate.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(writeNextWeek).mock.invocationCallOrder[0]);
    expect(vi.mocked(writeNextWeek).mock.calls[0][0]).toMatchObject({ roadmap: storedRoadmap });
  });

  it('gives a custom older goal the keyword template, with no deliverable check (MR-22) and no profile call (MR-14)', async () => {
    db.goalUpdate.mockResolvedValue({});
    await review(olderGoal({ rawGoal: 'Draw a portrait', clarifiedOutcome: 'Draw a realistic portrait' }, deliverable));
    expect(roadmapWrites()[0][0].data.roadmap.recovery).toEqual(RECOVERY_TEMPLATES.creative);

    db.goalUpdate.mockClear();
    await review(olderGoal({ rawGoal: 'Bake sourdough bread', clarifiedOutcome: 'Bake sourdough bread at home' }, deliverable));
    expect(roadmapWrites()[0][0].data.roadmap.recovery).toEqual(RECOVERY_TEMPLATES.general);
  });

  it('a profile that fails its checks at the review is not saved and is logged', async () => {
    db.goalUpdate.mockResolvedValue({});
    vi.mocked(makeGoalProfile).mockReturnValueOnce({ reasons: ['the catch-all kind is missing.'] });
    const { status } = await review(olderGoal());
    expect(status).toBe(200);
    expect(roadmapWrites()).toHaveLength(0);
    expect(console.warn).toHaveBeenCalledWith('[Recovery] No profile saved for goal', 'g-old', ['the catch-all kind is missing.']);
  });

  it('does not rewrite a profile the goal already has', async () => {
    db.goalUpdate.mockResolvedValue({});
    const { status } = await review(olderGoal({ roadmap: { ...storedRoadmap, recovery: RECOVERY_TEMPLATES.general } }));
    expect(status).toBe(200);
    expect(roadmapWrites()).toHaveLength(0);
    expect(makeGoalProfile).not.toHaveBeenCalled();
  });

  it('a failure while making or saving the profile leaves the review result unchanged', async () => {
    db.goalUpdate.mockResolvedValue({});
    const baseline = await review(olderGoal({ roadmap: { ...storedRoadmap, recovery: PATHWAY_PROFILES.run10k } }));

    db.goalUpdate.mockImplementation(async (args: { data: Record<string, unknown> }) => {
      if ('roadmap' in args.data) throw new Error('write failed');
      return {};
    });
    const failedSave = await review(olderGoal());
    expect(failedSave).toEqual(baseline);

    db.goalUpdate.mockResolvedValue({});
    vi.mocked(makeGoalProfile).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const failedMake = await review(olderGoal());
    expect(failedMake).toEqual(baseline);
    expect(writeNextWeek).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith('[Recovery] Could not save a profile for goal', 'g-old', expect.any(Error));
  });
});
