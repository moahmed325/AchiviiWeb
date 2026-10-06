import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

// Missed sessions M2.2: the carry writer in POST /api/goal/reconcile, behind MISSED_SESSIONS_CARRY_ENABLED (ND-15).

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    weeklyReview: { upsert: vi.fn(), update: vi.fn() },
    roadmapWeek: { update: vi.fn(), createMany: vi.fn() },
    dailyTask: { create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

const SWITCH = 'MISSED_SESSIONS_CARRY_ENABLED';
const user = { id: 'usr-carry', email: 'carry@achivii.com', timezone: 'UTC' };
const updateMany = prisma.dailyTask.updateMany as unknown as ReturnType<typeof vi.fn>;

const otherWrites = () => [
  prisma.goal.update,
  prisma.goal.updateMany,
  prisma.goal.deleteMany,
  prisma.goal.create,
  prisma.weeklyReview.upsert,
  prisma.weeklyReview.update,
  prisma.roadmapWeek.update,
  prisma.roadmapWeek.createMany,
  prisma.dailyTask.create,
  prisma.dailyTask.createMany,
  (prisma.dailyTask as any).update,
  prisma.dailyTask.deleteMany,
];

const step = (title: string, priority: number, minutes: number) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
});

/** Mon 2026-09-21 practice (missed at the test clock), Tue practice (today), Wed practice. */
function tasks() {
  const day = (id: string, date: string, dayNumber: number) => ({
    id,
    date,
    weekNumber: 1,
    dayNumber,
    status: 'pending',
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    durationMinutes: 30,
    detailedSteps: JSON.stringify([step(`${id} lead`, 1, 15), step(`${id} second`, 2, 10), step(`${id} third`, 3, 5)]),
  });
  return [day('mon', '2026-09-21', 1), day('tue', '2026-09-22', 2), day('wed', '2026-09-23', 3)];
}

const goal = (dailyTasks: unknown[], over: Record<string, unknown> = {}) => ({
  id: 'goal-v2',
  planVersion: 2,
  routine: JSON.stringify({ sleepTime: '23:00' }),
  rawGoal: 'Type 40 words per minute',
  clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
  dailyTasks,
  ...over,
});

/** Tuesday 10:00 UTC: Monday closed at 01:00 and is missed. */
const NOW = new Date('2026-09-22T10:00:00Z');

describe('POST /api/goal/reconcile carry-forward (M2.2)', () => {
  let server: Server;
  let baseUrl: string;
  const saved = process.env[SWITCH];

  const reconcile = async () => {
    const res = await fetch(`${baseUrl}/api/goal/reconcile`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    return { status: res.status, body: await res.json() };
  };

  const given = (activeGoal: unknown) => {
    (getAuthUser as any).mockResolvedValue(user);
    (prisma.goal.findFirst as any).mockResolvedValue(activeGoal);
  };

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
    if (saved === undefined) delete process.env[SWITCH];
    else process.env[SWITCH] = saved;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[SWITCH];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    for (const write of otherWrites()) expect(write).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('switch off: the same fields as before plus `carry`, the plan reported, nothing written', async () => {
    given(goal(tasks()));
    const { status, body } = await reconcile();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['applies', 'asOf', 'carry', 'days', 'gap', 'goalId', 'timezone']);
    expect(body.days.map((d: any) => d.kind)).toEqual(['missed', 'planned', 'planned']);
    expect(body.carry.enabled).toBe(false);
    expect(body.carry.carries).toHaveLength(1);
    expect(body.carry.carries[0]).toMatchObject({ fromTaskId: 'mon', toTaskId: 'tue', durationMinutes: 30 });
    expect(body.carry.written).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each(['false', 'TRUE', '1', 'yes', ' true', ''])('only the exact string "true" turns writes on (%j writes nothing)', async (value) => {
    process.env[SWITCH] = value;
    given(goal(tasks()));
    const { body } = await reconcile();
    expect(body.carry.enabled).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('switch on: one compare-and-set write per carry, with the steps read as the guard', async () => {
    process.env[SWITCH] = 'true';
    const rows = tasks();
    given(goal(rows));
    updateMany.mockResolvedValue({ count: 1 });

    const { body } = await reconcile();

    expect(body.carry.enabled).toBe(true);
    expect(updateMany).toHaveBeenCalledTimes(1);
    const call = updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'tue', goalId: 'goal-v2', status: 'pending', detailedSteps: rows[1].detailedSteps });
    const written = JSON.parse(call.data.detailedSteps);
    expect(written.map((s: any) => [s.title, s.stepNumber, s.priority])).toEqual([
      ['tue lead', 1, 1],
      ['mon lead', 2, 2],
    ]);
    expect(written[1].carriedFrom).toEqual({
      taskId: 'mon',
      date: '2026-09-21',
      replaced: [step('tue second', 2, 10), step('tue third', 3, 5)],
    });
    expect(call.data.durationMinutes).toBe(30);
    expect(Object.keys(call.data).sort()).toEqual(['detailedSteps', 'durationMinutes']);
    expect(body.carry.written).toEqual(body.carry.carries);
  });

  it('a second call after the write plans nothing new and writes nothing', async () => {
    process.env[SWITCH] = 'true';
    const rows = tasks();
    given(goal(rows));
    updateMany.mockResolvedValue({ count: 1 });
    await reconcile();
    const data = updateMany.mock.calls[0][0].data;

    updateMany.mockClear();
    const after = tasks();
    after[1] = { ...after[1], detailedSteps: data.detailedSteps, durationMinutes: data.durationMinutes };
    given(goal(after));
    const { body } = await reconcile();
    expect(body.carry.carries).toEqual([]);
    expect(body.carry.drops).toEqual([]);
    expect(body.carry.alreadyCarried).toHaveLength(1);
    expect(body.carry.alreadyCarried[0]).toMatchObject({ fromTaskId: 'mon', toTaskId: 'tue' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('two concurrent calls: the second finds the steps changed and writes nothing', async () => {
    process.env[SWITCH] = 'true';
    given(goal(tasks()));
    // Both requests read the same rows; the first write wins, so the database matches nothing for the second.
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const [first, second] = await Promise.all([reconcile(), reconcile()]);
    expect(updateMany).toHaveBeenCalledTimes(2);
    const writtenCounts = [first.body.carry.written.length, second.body.carry.written.length].sort();
    expect(writtenCounts).toEqual([0, 1]);
    // The loser is not retried.
    expect(updateMany.mock.calls[0][0].where).toEqual(updateMany.mock.calls[1][0].where);
  });

  it('old (plan v1) goals stay untouched, even with the switch on (AC-14)', async () => {
    process.env[SWITCH] = 'true';
    given(goal(tasks(), { planVersion: 1 }));
    const { body } = await reconcile();
    expect(body).toEqual({ applies: false, reason: 'not_plan_v2' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('no active goal: unchanged, with the switch on', async () => {
    process.env[SWITCH] = 'true';
    given(null);
    expect((await reconcile()).body).toEqual({ applies: false, reason: 'no_active_goal' });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('reads the switch on every request', async () => {
    given(goal(tasks()));
    updateMany.mockResolvedValue({ count: 1 });
    process.env[SWITCH] = 'true';
    await reconcile();
    process.env[SWITCH] = 'false';
    await reconcile();
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('loads the fields the planner needs', async () => {
    given(goal(tasks()));
    await reconcile();
    const select = (prisma.goal.findFirst as any).mock.calls[0][0].select;
    expect(select).toMatchObject({ rawGoal: true, clarifiedOutcome: true });
    expect(select.dailyTasks.select).toMatchObject({ detailedSteps: true, durationMinutes: true });
  });
});

describe('render.yaml (ND-15)', () => {
  it('ships the carry switch off and leaves it to the dashboard', () => {
    const yaml = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
    // sync: false sets no value from the Blueprint (unset is off), and a Blueprint sync never overwrites the dashboard.
    expect(yaml).toMatch(/- key: MISSED_SESSIONS_CARRY_ENABLED\r?\n\s+sync: false/);
    expect(yaml).not.toMatch(/MISSED_SESSIONS_CARRY_ENABLED\r?\n\s+value:/);
  });
});
