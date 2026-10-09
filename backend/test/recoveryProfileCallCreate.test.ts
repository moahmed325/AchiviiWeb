import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// Method-aware recovery M1.3b: goal create makes the profile after the roadmap and before week 1, on both paths.
// The profile call runs only for a custom goal with CUSTOM_RECOVERY_PROFILES_ENABLED exactly 'true' (O1); the switch
// is set here only inside this test process and restored after each test.

const db = vi.hoisted(() => ({
  goalCreate: vi.fn(),
  goalUpdateMany: vi.fn(),
  goalFindUniqueOrThrow: vi.fn(),
  weeksCreateMany: vi.fn(),
  tasksCreateMany: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { create: db.goalCreate, updateMany: db.goalUpdateMany, findUniqueOrThrow: db.goalFindUniqueOrThrow },
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

vi.mock('../src/lib/ai/roadmap.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/roadmap.js')>()),
  generateRoadmap: vi.fn(),
}));

vi.mock('../src/lib/ai/weekPlan.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/ai/weekPlan.js')>()),
  generateWeekPlan: vi.fn(),
}));

vi.mock('../src/lib/recovery/profileCall.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/recovery/profileCall.js')>()),
  generateRecoveryProfile: vi.fn(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { generateRoadmap } from '../src/lib/ai/roadmap.js';
import { generateWeekPlan } from '../src/lib/ai/weekPlan.js';
import { generateRecoveryProfile } from '../src/lib/recovery/profileCall.js';
import { PATHWAY_PROFILES, RECOVERY_TEMPLATES, templateProfile } from '../src/lib/recovery/index.js';
import { goalRouter } from '../src/routes/goal.js';

const SWITCH = 'CUSTOM_RECOVERY_PROFILES_ENABLED';
const number = { kind: 'number', metric: 'Loaves', value: 1, unit: 'loaves', direction: 'higher_is_better' };
const deliverable = { kind: 'deliverable', description: 'A finished talk' };
const weekTest = { type: 'checklist', instructions: 'Do the test', passIf: 'Done' };
const phases = [{ name: 'Base', purpose: 'Build.', startWeek: 1, endWeek: 12 }];

const roadmapResult = (week12Target: object = number) => ({
  ok: true,
  roadmap: {
    finalGoal: 'The goal',
    finalTest: 'The final test',
    startingPoint: { value: null, description: 'Now' },
    method: { name: 'Tartine method', creator: '', summary: 'Long fermentation.', whyChosen: 'Fits.', rules: ['Feed the starter'] },
    phases,
    weeks: Array.from({ length: 12 }, (_, index) => ({
      weekNumber: index + 1,
      phase: 'Base',
      focus: 'Focus',
      target: index === 11 ? week12Target : number,
      test: weekTest,
    })),
  },
});

const SOURDOUGH = { rawGoal: 'Bake sourdough bread at home', clarifiedOutcome: 'Bake sourdough bread at home', domain: 'Bread baking' };
const RUN_10K = { rawGoal: 'Run a 10K under 50 minutes', clarifiedOutcome: 'Finish a 10 km race in under 50:00' };
const modelProfile = { ...templateProfile('general'), template: 'creative' as const };

let server: Server;
let baseUrl: string;
let savedSwitch: string | undefined;

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
  savedSwitch = process.env[SWITCH];
  delete process.env[SWITCH];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(getAuthUser).mockResolvedValue({ id: 'u1', email: 'u@achivii.com', timezone: 'UTC' } as never);
  db.goalCreate.mockResolvedValue({ id: 'g1' });
  db.goalFindUniqueOrThrow.mockResolvedValue({ id: 'g1', roadmapWeeks: [], dailyTasks: [], weeklyReviews: [] });
  vi.mocked(generateWeekPlan).mockResolvedValue([] as never);
  vi.mocked(generateRecoveryProfile).mockResolvedValue({ profile: modelProfile, source: 'model', pickedTemplate: 'creative' });
});

afterEach(() => {
  if (savedSwitch === undefined) delete process.env[SWITCH];
  else process.env[SWITCH] = savedSwitch;
});

const savedRecovery = () => db.goalCreate.mock.calls[0][0].data.roadmap.recovery;

async function create(body: object, week12Target: object = number, stream = false) {
  vi.mocked(generateRoadmap).mockResolvedValue(roadmapResult(week12Target) as never);
  const res = await fetch(`${baseUrl}/api/goal/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t', ...(stream ? { Accept: 'text/event-stream' } : {}) },
    body: JSON.stringify({ ...body, answers: {}, answerList: [{ id: 'current_level', question: 'Level?', answer: 'New' }], routine: { dailyMinutes: 30, planVariant: 'steady' } }),
  });
  if (stream) {
    const events = (await res.text())
      .split('\n\n')
      .filter((chunk) => chunk.startsWith('data: '))
      .map((chunk) => JSON.parse(chunk.slice(6)));
    return { status: res.status, events };
  }
  return { status: res.status, body: await res.json() };
}

describe('goal create and the profile call', () => {
  it('switch off (the default): no profile call; the custom goal keeps its keyword template', async () => {
    const { status } = await create(SOURDOUGH);
    expect(status).toBe(201);
    expect(generateRecoveryProfile).not.toHaveBeenCalled();
    expect(savedRecovery()).toEqual(RECOVERY_TEMPLATES.general);
  });

  it('switch on: a custom goal gets the profile call, before week 1, and is saved with its profile', async () => {
    process.env[SWITCH] = 'true';
    const { status } = await create(SOURDOUGH);
    expect(status).toBe(201);
    expect(generateRecoveryProfile).toHaveBeenCalledTimes(1);
    expect(generateRecoveryProfile).toHaveBeenCalledWith({
      goalText: 'Bake sourdough bread at home Bake sourdough bread at home',
      domain: 'Bread baking',
      answers: [{ id: 'current_level', question: 'Level?', answer: 'New' }],
      method: { name: 'Tartine method', summary: 'Long fermentation.', rules: ['Feed the starter'] },
      phases,
      weeklyTargets: Array.from({ length: 12 }, () => number),
    });
    expect(vi.mocked(generateRecoveryProfile).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(generateWeekPlan).mock.invocationCallOrder[0]);
    expect(savedRecovery()).toEqual(modelProfile);
  });

  it('switch on: a pathway goal never calls it', async () => {
    process.env[SWITCH] = 'true';
    await create(RUN_10K);
    expect(generateRecoveryProfile).not.toHaveBeenCalled();
    expect(savedRecovery()).toEqual(PATHWAY_PROFILES.run10k);
  });

  it('switch on with any other value than "true" makes no call', async () => {
    process.env[SWITCH] = 'TRUE';
    await create(SOURDOUGH);
    expect(generateRecoveryProfile).not.toHaveBeenCalled();
  });

  it('a failed call still creates the goal, with the keyword template', async () => {
    process.env[SWITCH] = 'true';
    vi.mocked(generateRecoveryProfile).mockRejectedValueOnce(new Error('boom'));
    const { status, body } = await create(SOURDOUGH);
    expect(status).toBe(201);
    expect(body.goal.id).toBe('g1');
    expect(savedRecovery()).toEqual(RECOVERY_TEMPLATES.general);
    expect(console.warn).toHaveBeenCalledWith('[Recovery] Profile call failed at goal create:', expect.any(Error));
  });

  it('the keyword profile is also made before week 1', async () => {
    await create(SOURDOUGH);
    expect(db.goalCreate).toHaveBeenCalledTimes(1);
    vi.mocked(generateWeekPlan).mockResolvedValueOnce(null);
    db.goalCreate.mockClear();
    const { status } = await create(SOURDOUGH);
    // Week 1 failed: nothing saved, whatever the profile.
    expect(status).toBe(503);
    expect(db.goalCreate).not.toHaveBeenCalled();
  });

  it('MR-22: a pathway goal with a deliverable week 12 is saved with its profile', async () => {
    const speech = { rawGoal: 'Give a TED talk', clarifiedOutcome: 'Deliver a 15-minute TED-style keynote' };
    const { status } = await create(speech, deliverable);
    expect(status).toBe(201);
    expect(savedRecovery()).toEqual(PATHWAY_PROFILES.ted_speech_15min);
  });

  it('M2.1: the week call gets the profile the goal is saved with, on every path', async () => {
    const weekInput = () => vi.mocked(generateWeekPlan).mock.calls.at(-1)![0];
    await create(SOURDOUGH);
    expect(weekInput().recovery).toEqual(RECOVERY_TEMPLATES.general);
    await create(RUN_10K);
    expect(weekInput().recovery).toEqual(PATHWAY_PROFILES.run10k);
    process.env[SWITCH] = 'true';
    await create(SOURDOUGH);
    expect(weekInput().recovery).toEqual(modelProfile);
    expect(weekInput().recovery).toEqual(db.goalCreate.mock.calls.at(-1)[0].data.roadmap.recovery);
  });

  it('the stream sends the same events with the switch on: no new step', async () => {
    const { events: off } = await create(SOURDOUGH, number, true);
    process.env[SWITCH] = 'true';
    const { events: on } = await create(SOURDOUGH, number, true);
    const shape = (events: Array<{ type: string; id?: string }>) => events.map((event) => `${event.type}:${event.id ?? ''}`);
    expect(shape(on)).toEqual(shape(off));
    expect(shape(on)).toEqual(['step:search', 'step:method', 'step:plan', 'done:']);
  });
});
