import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';
import { MOVED_WARM_UP_LINE } from '../src/lib/recovery/carry.js';
import { RECONCILE_GOAL_SELECT } from '../src/lib/reconcileCore.js';
import { PROFILE } from './methodProfile.js';

// Method-aware recovery M3.1a: POST /api/goal/reconcile behind METHOD_RECOVERY_ENABLED, with carry writes still
// behind MISSED_SESSIONS_CARRY_ENABLED (ND-15). Each test sets the switches it needs and restores them after.

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    goal: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
    dailyTask: { create: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

const CARRY = 'MISSED_SESSIONS_CARRY_ENABLED';
const METHOD = 'METHOD_RECOVERY_ENABLED';
const user = { id: 'usr-method', email: 'method@achivii.com', timezone: 'UTC' };
const updateMany = prisma.dailyTask.updateMany as unknown as ReturnType<typeof vi.fn>;

const step = (title: string, priority: number, minutes: number, kind?: string) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...(kind ? { kind } : {}),
});

/** Mon 2026-09-21 missed at the test clock, Tue (today) and Wed open. Mon has a move step and a continue step. */
function tasks(kinds = true) {
  const k = (kind: string) => (kinds ? kind : undefined);
  const day = (id: string, date: string, dayNumber: number, steps: unknown[]) => ({
    id,
    date,
    weekNumber: 1,
    dayNumber,
    status: 'pending',
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    durationMinutes: 30,
    detailedSteps: JSON.stringify(steps),
  });
  return [
    day('mon', '2026-09-21', 1, [step('mon practice', 1, 15, k('practice')), step('mon drafting', 2, 10, k('drafting')), step('mon review', 3, 5, k('review'))]),
    day('tue', '2026-09-22', 2, [step('tue practice', 1, 15, k('practice')), step('tue review', 2, 10, k('review')), step('tue extra', 3, 5, k('general'))]),
    day('wed', '2026-09-23', 3, [step('wed practice', 1, 15, k('practice')), step('wed drafting', 2, 10, k('drafting')), step('wed extra', 3, 5, k('general'))]),
  ];
}

const goal = (dailyTasks: unknown[], over: Record<string, unknown> = {}) => ({
  id: 'goal-v2',
  planVersion: 2,
  routine: JSON.stringify({ sleepTime: '23:00' }),
  rawGoal: 'Type 40 words per minute',
  clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
  roadmap: { method: { name: 'Practice' }, recovery: PROFILE },
  dailyTasks,
  ...over,
});

const NOW = new Date('2026-09-22T10:00:00Z');

/** M3.1b: lessons on Mon (3, missed), Tue (4, today), Wed (5) and Fri (6). */
function lessonTasks() {
  const day = (id: string, date: string, dayNumber: number, lesson: string) => ({
    id,
    date,
    weekNumber: 1,
    dayNumber,
    status: 'pending',
    isRestDay: false,
    isKeySession: false,
    isTestDay: false,
    durationMinutes: 30,
    detailedSteps: JSON.stringify([step(lesson, 1, 15, 'lesson'), step(`${lesson} review`, 2, 10, 'review'), step(`${lesson} extra`, 3, 5, 'general')]),
  });
  return [
    day('mon', '2026-09-21', 1, 'Lesson 3'),
    day('tue', '2026-09-22', 2, 'Lesson 4'),
    day('wed', '2026-09-23', 3, 'Lesson 5'),
    day('fri', '2026-09-25', 5, 'Lesson 6'),
  ];
}

/**
 * A `$transaction` that behaves like the database's: the writes made through `tx` are kept only when the callback
 * resolves; when it throws, they are rolled back (never added to `committed`) and the error is passed on.
 */
function fakeTransaction(guards: number[]) {
  const committed: any[] = [];
  const attempted: any[] = [];
  (prisma.$transaction as any).mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const pending: any[] = [];
    const tx = {
      dailyTask: {
        updateMany: async (args: any) => {
          attempted.push(args);
          pending.push(args);
          return { count: guards[attempted.length - 1] ?? 1 };
        },
      },
    };
    const result = await fn(tx);
    committed.push(...pending);
    return result;
  });
  return { committed, attempted };
}

describe('POST /api/goal/reconcile with method-aware recovery (M3.1a)', () => {
  let server: Server;
  let baseUrl: string;
  const saved: Record<string, string | undefined> = { [CARRY]: process.env[CARRY], [METHOD]: process.env[METHOD] };

  const reconcile = async () => {
    const res = await fetch(`${baseUrl}/api/goal/reconcile`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    return { status: res.status, body: await res.json() };
  };
  const given = (activeGoal: unknown) => {
    (getAuthUser as any).mockResolvedValue(user);
    (prisma.goal.findFirst as any).mockResolvedValue(activeGoal);
  };
  const withSwitches = async (method: string | undefined, carry: string | undefined) => {
    for (const [key, value] of [[METHOD, method], [CARRY, carry]] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return reconcile();
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
    for (const key of [CARRY, METHOD]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[CARRY];
    delete process.env[METHOD];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    for (const write of [prisma.goal.update, prisma.goal.updateMany, prisma.goal.deleteMany, prisma.goal.create, prisma.dailyTask.create, prisma.dailyTask.createMany, (prisma.dailyTask as any).update, prisma.dailyTask.deleteMany]) {
      expect(write).not.toHaveBeenCalled();
    }
    vi.useRealTimers();
  });

  it('switch off: the body is exactly as before, with no method fields, even for a tagged goal with a profile', async () => {
    given(goal(tasks()));
    const { body } = await withSwitches(undefined, undefined);
    expect(Object.keys(body.carry).sort()).toEqual(['alreadyCarried', 'carries', 'drops', 'enabled', 'held', 'written']);
    expect(body.carry.carries[0].step.instructions).toBe('Do mon practice.');

    given(goal(tasks(false), { roadmap: null }));
    const untagged = await withSwitches(undefined, undefined);
    expect(untagged.body.carry).toEqual({ ...body.carry, carries: untagged.body.carry.carries });
    expect(untagged.body.carry.carries[0].step).toMatchObject({ title: 'mon practice', instructions: 'Do mon practice.' });
  });

  it.each(['false', 'TRUE', '1', 'yes', ' true', ''])('only the exact string "true" turns it on (%j keeps today\'s body)', async (value) => {
    given(goal(tasks()));
    const off = await withSwitches(undefined, undefined);
    const other = await withSwitches(value, undefined);
    expect(other.body).toEqual(off.body);
  });

  it.each([
    ['no profile', () => goal(tasks(), { roadmap: null })],
    ['an invalid profile', () => goal(tasks(), { roadmap: { recovery: { ...PROFILE, restGapDays: 5 } } })],
    ['steps without kinds', () => goal(tasks(false))],
  ])('switch on with %s: every existing field is exactly today\'s, and every day says missed_sessions', async (_name, make) => {
    given(make());
    const off = await withSwitches(undefined, undefined);
    given(make());
    const on = await withSwitches('true', undefined);
    const { outcomes, continues, alreadyContinued, writtenContinues, shifts, ...carry } = on.body.carry;
    expect({ ...on.body, carry }).toEqual(off.body);
    expect(shifts).toEqual([]);
    expect(outcomes).toEqual([{ taskId: 'mon', date: '2026-09-21', rules: 'missed_sessions', outcome: 'moved', topStep: 'moved' }]);
    expect(continues).toEqual([]);
    expect(alreadyContinued).toEqual([]);
    expect(writtenContinues).toEqual([]);
  });

  it('switch on, carry switch off: the actions are reported and nothing is written', async () => {
    given(goal(tasks()));
    const { body } = await withSwitches('true', undefined);
    expect(body.carry.enabled).toBe(false);
    expect(body.carry.carries).toHaveLength(1);
    expect(body.carry.carries[0].step.instructions).toBe(`${MOVED_WARM_UP_LINE}\nDo mon practice.`);
    expect(body.carry.continues).toHaveLength(1);
    expect(body.carry.outcomes).toEqual([{ taskId: 'mon', date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' }]);
    expect(body.carry.written).toEqual([]);
    expect(body.carry.writtenContinues).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('both on: one guarded write per receiving day, the carry and the continue marker each once', async () => {
    const rows = tasks();
    given(goal(rows));
    updateMany.mockResolvedValue({ count: 1 });
    const { body } = await withSwitches('true', 'true');

    expect(updateMany).toHaveBeenCalledTimes(2);
    const [toTue, toWed] = updateMany.mock.calls.map((call) => call[0]);
    expect(toTue.where).toEqual({ id: 'tue', goalId: 'goal-v2', status: 'pending', detailedSteps: rows[1].detailedSteps });
    const tue = JSON.parse(toTue.data.detailedSteps);
    expect(tue.find((s: any) => s.carriedFrom)).toMatchObject({ title: 'mon practice', durationMinutes: 15, instructions: `${MOVED_WARM_UP_LINE}\nDo mon practice.` });
    expect(toTue.data.durationMinutes).toBeLessThanOrEqual(30);

    expect(toWed.where).toEqual({ id: 'wed', goalId: 'goal-v2', status: 'pending', detailedSteps: rows[2].detailedSteps });
    const wed = JSON.parse(toWed.data.detailedSteps);
    expect(wed).toEqual(JSON.parse(rows[2].detailedSteps).map((s: any) => (s.title === 'wed drafting' ? { ...s, continueFrom: { taskId: 'mon', date: '2026-09-21' } } : s)));
    expect(toWed.data.durationMinutes).toBe(30);

    expect(body.carry.written).toEqual(body.carry.carries);
    expect(body.carry.writtenContinues).toEqual(body.carry.continues);

    // Replanning after the writes adds nothing.
    updateMany.mockClear();
    const after = tasks();
    after[1] = { ...after[1], detailedSteps: toTue.data.detailedSteps, durationMinutes: toTue.data.durationMinutes };
    after[2] = { ...after[2], detailedSteps: toWed.data.detailedSteps };
    given(goal(after));
    const again = await reconcile();
    expect(again.body.carry.carries).toEqual([]);
    expect(again.body.carry.continues).toEqual([]);
    expect(again.body.carry.alreadyContinued).toHaveLength(1);
    expect(again.body.carry.outcomes).toEqual([{ taskId: 'mon', date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' }]);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('a lost race writes nothing for that day and is not retried', async () => {
    given(goal(tasks()));
    updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const { body } = await withSwitches('true', 'true');
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(body.carry.written).toEqual([]);
    expect(body.carry.writtenContinues).toHaveLength(1);
  });

  it('reads the method switch on every request', async () => {
    given(goal(tasks()));
    expect((await withSwitches('true', undefined)).body.carry.outcomes).toBeDefined();
    expect((await withSwitches(undefined, undefined)).body.carry.outcomes).toBeUndefined();
  });

  it('loads the roadmap only when the switch is on; off, the query is exactly as before', async () => {
    given(goal(tasks()));
    await withSwitches(undefined, undefined);
    const off = (prisma.goal.findFirst as any).mock.calls[0][0];
    expect(off).toEqual({ where: { userId: user.id, status: 'active' }, select: RECONCILE_GOAL_SELECT });
    expect(off.select).not.toHaveProperty('roadmap');
    expect(Object.keys(RECONCILE_GOAL_SELECT).sort()).toEqual(['clarifiedOutcome', 'dailyTasks', 'id', 'planVersion', 'rawGoal', 'routine']);

    await withSwitches('true', undefined);
    const on = (prisma.goal.findFirst as any).mock.calls[1][0];
    expect(on).toEqual({ where: { userId: user.id, status: 'active' }, select: { ...RECONCILE_GOAL_SELECT, roadmap: true } });
  });

  it('M3.1b: an order shift writes every changed day in one transaction, each guarded', async () => {
    const rows = lessonTasks();
    given(goal(rows));
    const { committed } = fakeTransaction([1, 1, 1]);
    const { body } = await withSwitches('true', 'true');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).not.toHaveBeenCalled();
    expect(committed.map((args) => args.where)).toEqual(
      ['tue', 'wed', 'fri'].map((id) => ({ id, goalId: 'goal-v2', status: 'pending', detailedSteps: rows.find((r) => r.id === id)!.detailedSteps }))
    );
    const [tue, wed, fri] = committed.map((args) => JSON.parse(args.data.detailedSteps));
    expect(tue[0]).toMatchObject({ title: 'Lesson 3', instructions: `${MOVED_WARM_UP_LINE}\nDo Lesson 3.`, carriedFrom: { taskId: 'mon', pushedOut: { title: 'Lesson 6' } } });
    expect(wed[0]).toMatchObject({ title: 'Lesson 4', instructions: 'Do Lesson 4.', shiftedFrom: { taskId: 'tue', date: '2026-09-22' } });
    expect(fri[0]).toMatchObject({ title: 'Lesson 5', instructions: 'Do Lesson 5.', shiftedFrom: { taskId: 'wed', date: '2026-09-23' } });
    expect(committed.every((args) => args.data.durationMinutes <= 30)).toBe(true);

    expect(body.carry.written).toEqual(body.carry.carries);
    expect(body.carry.shifts).toHaveLength(1);
    expect(body.carry.shifts[0].steps.map((s: any) => [s.stepTitle, s.toTaskId])).toEqual([
      ['Lesson 4', 'wed'],
      ['Lesson 5', 'fri'],
      ['Lesson 6', null],
    ]);
    expect(body.carry.outcomes).toEqual([{ taskId: 'mon', date: '2026-09-21', rules: 'method', outcome: 'moved', topStep: 'moved' }]);
  });

  it('M3.1b: when one guard of a shift fails, the whole shift rolls back and nothing of it is written', async () => {
    given(goal(lessonTasks()));
    const { committed, attempted } = fakeTransaction([1, 0, 1]);
    const { status, body } = await withSwitches('true', 'true');

    expect(status).toBe(200);
    expect(attempted).toHaveLength(2); // stops at the failed guard
    expect(committed).toEqual([]);
    expect(updateMany).not.toHaveBeenCalled();
    expect(body.carry.written).toEqual([]);
    // The plan is still reported, and the missed day is still its planned outcome.
    expect(body.carry.shifts).toHaveLength(1);
    expect(body.carry.carries).toHaveLength(1);
  });

  it('M3.1b: carry switch off: the shift is reported and nothing is written', async () => {
    given(goal(lessonTasks()));
    fakeTransaction([1, 1, 1]);
    const { body } = await withSwitches('true', undefined);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(body.carry.shifts).toHaveLength(1);
    expect(body.carry.written).toEqual([]);
  });

  it('M3.1b: method switch off: a lesson week is exactly today\'s plan, with no shift', async () => {
    given(goal(lessonTasks()));
    updateMany.mockResolvedValue({ count: 1 });
    const { body } = await withSwitches(undefined, 'true');
    expect(body.carry).not.toHaveProperty('shifts');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(body.carry.carries.map((c: any) => [c.step.title, c.toTaskId])).toEqual([['Lesson 3', 'tue']]);
  });
});

describe('render.yaml (method switch)', () => {
  it('ships METHOD_RECOVERY_ENABLED off and leaves it to the dashboard', () => {
    const yaml = readFileSync(new URL('../../render.yaml', import.meta.url), 'utf8');
    expect(yaml).toMatch(/- key: METHOD_RECOVERY_ENABLED\r?\n\s+sync: false/);
    expect(yaml).not.toMatch(/METHOD_RECOVERY_ENABLED\r?\n\s+value:/);
  });

  it('is listed, empty, in backend/.env.example', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    expect(example).toMatch(/^METHOD_RECOVERY_ENABLED=""\r?$/m);
  });
});
