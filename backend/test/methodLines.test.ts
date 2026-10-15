import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { PROFILE } from './methodProfile.js';

// Method-aware recovery M3.3: the one line Today and the Dashboard show (`signals.line`, RULE-15, MR-35). The server
// chooses it; the screens only write the words. Prisma is the in-memory store of methodActions.test.ts: updateMany
// is a real compare-and-set, so a second reconcile reads what the first one stored.

const store = vi.hoisted(() => ({
  goal: null as any,
  rows: [] as any[],
  prisma: {
    goal: { findFirst: vi.fn() },
    dailyTask: { updateMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: store.prisma }));
vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

const CARRY = 'MISSED_SESSIONS_CARRY_ENABLED';
const METHOD = 'METHOD_RECOVERY_ENABLED';
const user = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };

function updateRows(where: Record<string, unknown>, data: Record<string, unknown>) {
  const matches = store.rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
  for (const row of matches) {
    for (const [key, value] of Object.entries(data)) row[key] = value === Prisma.DbNull ? null : value;
  }
  return { count: matches.length };
}

type Step = Record<string, unknown> & { title: string; priority: number; durationMinutes: number };
const step = (title: string, priority: number, minutes: number, kind?: string): Step => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...(kind ? { kind } : {}),
});
/** A day: its main step of `kind`, then a let-go review and a general extra (30 minutes). */
const day = (tag: string, kind: string): Step[] => [step(tag, 1, 15, kind), step(`${tag} review`, 2, 10, 'review'), step(`${tag} extra`, 3, 5, 'general')];
/** A lesson (in order, RULE-20) and a let-go review, so nothing else on the day moves. */
const lesson = (tag: string): Step[] => [step(tag, 1, 20, 'lesson'), step(`${tag} review`, 2, 10, 'review')];
/** A day whose steps all let go (RULE-11). */
const letGo = (tag: string, minutes = 20): Step[] => [step(tag, 1, minutes, 'review'), step(`${tag} notes`, 2, 10, 'review')];

/** Week 1 from Mon 2026-09-21: Thu and Sun rest, Sat the test day. Next week's Monday too. */
const DAYS = [
  ['mon', '2026-09-21'],
  ['tue', '2026-09-22'],
  ['wed', '2026-09-23'],
  ['thu', '2026-09-24'],
  ['fri', '2026-09-25'],
  ['sat', '2026-09-26'],
  ['sun', '2026-09-27'],
  ['mon2', '2026-09-28'],
] as const;
type Id = (typeof DAYS)[number][0];

interface DaySpec {
  steps?: Step[];
  status?: string;
  minutes?: number;
}

function seed(spec: Partial<Record<Id, DaySpec>> = {}, week = 1) {
  store.goal = {
    id: 'g1',
    userId: user.id,
    status: 'active',
    planVersion: 2,
    routine: JSON.stringify({ sleepTime: '23:00' }),
    rawGoal: 'Type 40 words per minute',
    clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
    roadmap: { method: { name: 'Practice' }, recovery: PROFILE },
  };
  store.rows = DAYS.map(([id, date], index) => {
    const s = spec[id] ?? {};
    const isRestDay = id === 'thu' || id === 'sun';
    const isTestDay = id === 'sat';
    const steps = s.steps ?? (isRestDay ? [] : isTestDay ? [step('Weekly test: 1-minute test', 1, 20, 'weekly_test')] : day(`${id} practice`, 'practice'));
    return {
      id,
      goalId: 'g1',
      weekNumber: id === 'mon2' ? week + 1 : week,
      dayNumber: (week - 1) * 7 + index + 1,
      date,
      dayOfWeek: id,
      title: `${id} title`,
      detailedSteps: JSON.stringify(steps),
      implementationIntention: `At 19:30: ${id} title.`,
      durationMinutes: s.minutes ?? steps.reduce((sum, x) => sum + x.durationMinutes, 0),
      slotTime: '19:30',
      isRestDay,
      status: s.status ?? 'pending',
      completedAt: null,
      notes: null,
      isKeySession: false,
      isTestDay,
      whyToday: null,
      minimumVersion: null,
      usedMinimumVersion: false,
    };
  });
}

const row = (id: string) => store.rows.find((r) => r.id === id);
const stepsOf = (id: string): Step[] => JSON.parse(row(id).detailedSteps);
const complete = (...ids: string[]) => ids.forEach((id) => (row(id).status = 'completed'));
const MON = '2026-09-21';
const TUE = '2026-09-22';
const WED = '2026-09-23';
const at = (date: string) => vi.setSystemTime(new Date(`${date}T10:00:00Z`));

/** The line `kind` for `from`, naming `to` (or no day). */
const line = (kind: string, from: [string, string], to: [string, string] | null = null) => ({
  kind,
  taskId: from[0],
  date: from[1],
  toTaskId: to ? to[0] : null,
  toDate: to ? to[1] : null,
});

describe('M3.3 the miss line with method-aware recovery', () => {
  let server: Server;
  let baseUrl: string;
  const saved: Record<string, string | undefined> = { [CARRY]: process.env[CARRY], [METHOD]: process.env[METHOD] };

  const post = async (path: string) => {
    const res = await fetch(`${baseUrl}/api/goal${path}`, { method: 'POST', headers: { Authorization: 'Bearer t' } });
    return { status: res.status, body: (await res.json()) as any };
  };
  const reconcile = async () => (await post('/reconcile')).body;

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env[CARRY] = 'true';
    process.env[METHOD] = 'true';
    vi.useFakeTimers({ toFake: ['Date'] });
    (getAuthUser as any).mockResolvedValue(user);
    store.prisma.goal.findFirst.mockImplementation(async ({ where }: any) =>
      store.goal && store.goal.userId === where.userId && store.goal.status === where.status
        ? { ...store.goal, dailyTasks: store.rows.map((r) => ({ ...r })).sort((a, b) => a.dayNumber - b.dayNumber) }
        : null
    );
    store.prisma.dailyTask.updateMany.mockImplementation(async ({ where, data }: any) => updateRows(where, data));
    store.prisma.dailyTask.findMany.mockImplementation(async ({ where }: any) =>
      store.rows.filter((r) => where.id.in.includes(r.id) && r.goalId === where.goalId).map((r) => ({ ...r }))
    );
    store.prisma.$transaction.mockImplementation(async (fn: any) => {
      const snapshot = structuredClone(store.rows);
      try {
        return await fn({ dailyTask: { updateMany: async ({ where, data }: any) => updateRows(where, data) } });
      } catch (err) {
        store.rows = snapshot;
        throw err;
      }
    });
  });

  afterEach(() => vi.useRealTimers());

  it('method switch off: the signals are exactly as before, with no line', async () => {
    delete process.env[METHOD];
    seed({ mon: { steps: letGo('mon talk') } });
    at(TUE);
    const body = await reconcile();
    expect(Object.keys(body.signals).sort()).toEqual(['carried', 'dropped', 'gentleReturn', 'notice', 'shortOnTime', 'swapOffer']);
    expect(body.carry.outcomes).toBeUndefined();
  });

  describe('lines that name no receiving day show while their day is the most recent closed practice day', () => {
    it('let go', async () => {
      seed({ mon: { steps: letGo('mon talk') } });
      at(TUE);
      const body = await reconcile();
      expect(body.signals.notice).toBe('method');
      expect(body.signals.line).toEqual(line('let_go', ['mon', MON]));
      // Tuesday is done and has closed: Monday is no longer the most recent closed practice day.
      complete('tue');
      at(WED);
      const later = await reconcile();
      expect(later.signals.notice).toBeNull();
      expect(later.signals.line).toBeNull();
    });

    it('fixed', async () => {
      seed({ mon: { steps: [step('club run', 1, 20, 'fixed_time_session'), step('club notes', 2, 10, 'review')] } });
      at(TUE);
      expect((await reconcile()).signals.line).toEqual(line('fixed', ['mon', MON]));
    });

    it('no room this week, never the drop line (a method no-room day has a drop too)', async () => {
      seed({ tue: { status: 'completed' } });
      at(TUE);
      const body = await reconcile();
      expect(body.carry.drops.map((d: any) => d.taskId)).toEqual(['mon']);
      expect(body.carry.outcomes[0]).toMatchObject({ taskId: 'mon', outcome: 'no_room' });
      expect(body.signals.notice).toBe('method');
      expect(body.signals.line).toEqual(line('no_room', ['mon', MON]));
    });

    it('in order, to next week', async () => {
      seed({ mon: { steps: lesson('Lesson 3') } });
      at(TUE);
      const body = await reconcile();
      expect(body.carry.outcomes[0]).toMatchObject({ taskId: 'mon', outcome: 'next_week' });
      expect(body.signals.line).toEqual(line('next_week', ['mon', MON]));
    });

    it('final week, no room: left out', async () => {
      seed({ mon: { steps: lesson('Lesson 3') } }, 12);
      at(TUE);
      const body = await reconcile();
      expect(body.carry.outcomes[0]).toMatchObject({ taskId: 'mon', outcome: 'left_out' });
      expect(body.signals.line).toEqual(line('left_out', ['mon', MON]));
    });
  });

  describe('lines that name a receiving day last until it closes, read from the stored markers', () => {
    it('moved into today, still shown on the reconcile after the write, gone once today closes', async () => {
      seed();
      at(TUE);
      const first = await reconcile();
      expect(first.carry.written).toHaveLength(1);
      expect(first.signals.line).toEqual(line('moved', ['mon', MON], ['tue', TUE]));
      const second = await reconcile();
      expect(second.carry.written).toEqual([]);
      expect(second.signals.line).toEqual(line('moved', ['mon', MON], ['tue', TUE]));
      complete('tue');
      at(WED);
      expect((await reconcile()).signals.line).toBeNull();
    });

    it('moved to a later day', async () => {
      seed({ tue: { steps: [step('tue short', 1, 10, 'practice')] } });
      at(TUE);
      await reconcile();
      expect((await reconcile()).signals.line).toEqual(line('moved', ['mon', MON], ['wed', WED]));
    });

    it('moved, in order: the session now holding the step', async () => {
      seed({ mon: { steps: lesson('Lesson 3') }, tue: { steps: lesson('Lesson 4') }, wed: { steps: lesson('Lesson 5') }, fri: { steps: lesson('Lesson 6') } });
      at(TUE);
      const first = await reconcile();
      expect(first.signals.line).toEqual(line('moved_in_order', ['mon', MON], ['tue', TUE]));
      expect(stepsOf('tue')[0]).toMatchObject({ title: 'Lesson 3', shiftedFrom: { taskId: 'mon' } });
      const second = await reconcile();
      expect(second.signals.line).toEqual(line('moved_in_order', ['mon', MON], ['tue', TUE]));
    });

    it('the day\'s highest-priority step that moved decides: the lesson, not a lower step carried elsewhere', async () => {
      seed({ mon: { steps: day('Lesson 3', 'lesson') }, tue: { steps: lesson('Lesson 4') }, wed: { steps: day('wed practice', 'practice') } });
      at(TUE);
      const body = await reconcile();
      expect(body.carry.written.map((c: any) => [c.fromTaskId, c.step.title])).toEqual([['mon', 'Lesson 3 extra']]);
      expect(body.signals.line).toEqual(line('moved_in_order', ['mon', MON], ['tue', TUE]));
      expect((await reconcile()).signals.line).toEqual(line('moved_in_order', ['mon', MON], ['tue', TUE]));
    });

    it('continue: the marked session, until it closes', async () => {
      seed({ mon: { steps: [step('mon draft', 1, 20, 'drafting'), step('mon notes', 2, 10, 'review')] }, wed: { steps: day('wed draft', 'drafting') } });
      at(TUE);
      const first = await reconcile();
      expect(first.signals.line).toEqual(line('continued', ['mon', MON], ['wed', WED]));
      expect(stepsOf('wed')[0]).toMatchObject({ continueFrom: { taskId: 'mon', date: MON } });
      expect((await reconcile()).signals.line).toEqual(line('continued', ['mon', MON], ['wed', WED]));
      complete('tue', 'wed');
      at('2026-09-25');
      expect((await reconcile()).signals.line).toBeNull();
    });

    it('a day under missed sessions\' rules keeps its carried line', async () => {
      seed({ mon: { steps: [step('mon untagged', 1, 15), step('mon more', 2, 15)] } });
      at(TUE);
      await reconcile();
      const body = await reconcile();
      expect(body.carry.outcomes[0]).toMatchObject({ rules: 'missed_sessions', outcome: 'moved' });
      expect(body.signals.notice).toBe('carried');
      expect(body.signals.line).toEqual(line('carried', ['mon', MON], ['tue', TUE]));
    });
  });

  describe('order', () => {
    it('a line naming a receiving day comes before a more recent let-go day', async () => {
      // Monday's step does not fit Tuesday's 10 minutes, so it moves to Wednesday (today); Tuesday lets go.
      seed({ tue: { steps: letGo('tue talk', 5), minutes: 15 } });
      at(WED);
      const body = await reconcile();
      expect(body.carry.outcomes.map((o: any) => [o.taskId, o.outcome])).toEqual([
        ['mon', 'moved'],
        ['tue', 'let_go'],
      ]);
      expect(body.signals.line).toEqual(line('moved', ['mon', MON], ['wed', WED]));
    });

    it('a rest day still shows no line', async () => {
      seed({ mon: { steps: letGo('mon talk') } });
      at('2026-09-24');
      const rest = await reconcile();
      expect(rest.signals.notice).toBeNull();
      expect(rest.signals.line).toBeNull();
    });
  });

  describe('set today aside', () => {
    it('let go: the line names today, from the action\'s answer only; a reload has nothing stored', async () => {
      seed({ mon: { status: 'completed' }, tue: { steps: letGo('tue talk') } });
      at(TUE);
      const set = await post('/tasks/tue/mark-missed');
      expect(set.status).toBe(200);
      expect(set.body.signals.notice).toBe('method');
      expect(set.body.signals.line).toEqual(line('let_go', ['tue', TUE]));
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
      expect((await reconcile()).signals.line).toBeNull();
    });

    it('moved: the carry names its day, and a reload still has it', async () => {
      seed({ mon: { status: 'completed' } });
      at(TUE);
      const set = await post('/tasks/tue/mark-missed');
      expect(set.body.signals.line).toEqual(line('moved', ['tue', TUE], ['wed', WED]));
      expect((await reconcile()).signals.line).toEqual(line('moved', ['tue', TUE], ['wed', WED]));
    });

    it('comes before yesterday\'s line, even one naming a receiving day', async () => {
      seed({ mon: { steps: [step('mon draft', 1, 20, 'drafting'), step('mon notes', 2, 10, 'review')] }, tue: { steps: letGo('tue talk') }, wed: { steps: day('wed draft', 'drafting') } });
      at(TUE);
      expect((await reconcile()).signals.line).toEqual(line('continued', ['mon', MON], ['wed', WED]));
      const set = await post('/tasks/tue/mark-missed');
      expect(set.body.signals.line).toEqual(line('let_go', ['tue', TUE]));
    });
  });
});
