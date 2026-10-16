import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { PROFILE } from './methodProfile.js';
import { EASY_START_LINE } from '../src/lib/recovery/easyStart.js';
import { randomWeek } from './methodWeeks.js';

// Method-aware recovery M3.2: swap, set today aside and move now follow RULE-16 on the server, and the reconcile body
// sends the allowed choices (`carry.choices`). Prisma is replaced by the in-memory store of missedActions.test.ts:
// updateMany is a real compare-and-set, and $transaction rolls back.

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
const step = (title: string, priority: number, minutes: number, kind: string, extra: Record<string, unknown> = {}): Step => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  kind,
  ...extra,
});
/** A day: its main step of `kind`, then a let-go review and a general extra (30 minutes). */
const day = (tag: string, kind: string, extra: Record<string, unknown> = {}): Step[] => [
  step(tag, 1, 15, kind, extra),
  step(`${tag} review`, 2, 10, 'review'),
  step(`${tag} extra`, 3, 5, 'general'),
];

/** A day whose steps all let go (RULE-11). */
const letGo = (tag: string): Step[] => [step(tag, 1, 20, 'review'), step(`${tag} notes`, 2, 10, 'review')];

/** Week 1 from Mon 2026-09-21: Thu and Sun rest, Sat the test day. Week 2's Monday too. */
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
  key?: boolean;
  minutes?: number;
  /** Overrides the week's rest days (Thu and Sun). */
  rest?: boolean;
}

function seed(spec: Partial<Record<Id, DaySpec>> = {}, profile: unknown = PROFILE) {
  store.goal = {
    id: 'g1',
    userId: user.id,
    status: 'active',
    planVersion: 2,
    routine: JSON.stringify({ sleepTime: '23:00' }),
    rawGoal: 'Type 40 words per minute',
    clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
    roadmap: { method: { name: 'Practice' }, recovery: profile },
  };
  store.rows = DAYS.map(([id, date], index) => {
    const s = spec[id] ?? {};
    const isRestDay = s.rest ?? (id === 'thu' || id === 'sun');
    const isTestDay = id === 'sat';
    const steps = s.steps ?? (isRestDay ? [] : isTestDay ? [step('Weekly test: 1-minute test', 1, 20, 'weekly_test')] : day(`${id} practice`, 'practice'));
    return {
      id,
      goalId: 'g1',
      weekNumber: id === 'mon2' ? 2 : 1,
      dayNumber: index + 1,
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
      resourceTitle: null,
      resourceUrl: null,
      resourceType: null,
      resourceWhy: null,
      isKeySession: !!s.key,
      isTestDay,
      whyToday: null,
      minimumVersion: null,
      usedMinimumVersion: false,
      created_at: new Date('2026-09-20T00:00:00Z'),
    };
  });
}

const row = (id: string) => store.rows.find((r) => r.id === id);
const stepsOf = (id: string): Step[] => JSON.parse(row(id).detailedSteps);
const TUE = '2026-09-22T10:00:00Z';
const MON = '2026-09-21T10:00:00Z';

describe('M3.2 person actions with method-aware recovery', () => {
  let server: Server;
  let baseUrl: string;
  const saved: Record<string, string | undefined> = { [CARRY]: process.env[CARRY], [METHOD]: process.env[METHOD] };

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`${baseUrl}/api/goal${path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const at = (iso: string) => vi.setSystemTime(new Date(iso));
  const swap = (a: string, b: string) => post(`/tasks/${a}/swap`, { withTaskId: b, expected: { [a]: row(a).detailedSteps, [b]: row(b).detailedSteps } });
  const reconcile = () => post('/reconcile');
  const method = (on: boolean) => {
    if (on) process.env[METHOD] = 'true';
    else delete process.env[METHOD];
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env[CARRY] = 'true';
    method(true);
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

  describe('switch off: exactly today', () => {
    it('the reconcile body has no choices, and the method checks do not apply to a swap', async () => {
      method(false);
      seed({ mon: { status: 'completed' }, wed: { steps: day('class', 'fixed_time_session') } });
      at(TUE);
      const { body } = await reconcile();
      expect(Object.keys(body.carry).sort()).toEqual(['alreadyCarried', 'carries', 'drops', 'enabled', 'held', 'written']);
      expect((await swap('tue', 'wed')).status).toBe(200);
    });

    it('a held key session whose step lets go is still held, and move now answers 200 as before', async () => {
      method(false);
      seed({ mon: { key: true, steps: letGo('mon talk') } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held.map((h: any) => h.taskId)).toEqual(['mon']);
      expect((await post('/tasks/mon/carry-now')).status).toBe(200);
    });
  });

  describe('swap (RULE-12 to RULE-14)', () => {
    it('refused onto and off a day with a fixed step (fixed_step)', async () => {
      seed({ mon: { status: 'completed' }, wed: { steps: day('class', 'fixed_time_session') } });
      at(TUE);
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'fixed_step' } });
      expect(await swap('wed', 'tue')).toMatchObject({ status: 409, body: { reason: 'fixed_step' } });
      expect(store.prisma.$transaction).not.toHaveBeenCalled();
      // A fixed step lower in the day blocks it too.
      seed({ mon: { status: 'completed' }, fri: { steps: [step('fri practice', 1, 15, 'practice'), step('group call', 2, 15, 'fixed_time_session')] } });
      expect(await swap('tue', 'fri')).toMatchObject({ status: 409, body: { reason: 'fixed_step' } });
    });

    it('refused when it puts a lesson after the next one, both ways (out_of_order)', async () => {
      // Lesson 3 today, Lesson 4 on Wed: no swap between them, and none that moves Lesson 3 past Lesson 4.
      seed({ mon: { status: 'completed' }, tue: { steps: day('Lesson 3', 'lesson') }, wed: { steps: day('Lesson 4', 'lesson') } });
      at(TUE);
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'out_of_order' } });
      expect(await swap('tue', 'fri')).toMatchObject({ status: 409, body: { reason: 'out_of_order' } });
      expect(await swap('fri', 'tue')).toMatchObject({ status: 409, body: { reason: 'out_of_order' } });
      // Lesson 4 brought before Lesson 3.
      seed({ mon: { status: 'completed' }, wed: { steps: day('Lesson 3', 'lesson') }, fri: { steps: day('Lesson 4', 'lesson') } });
      expect(await swap('tue', 'fri')).toMatchObject({ status: 409, body: { reason: 'out_of_order' } });
      // Moving Lesson 4 earlier but still after Lesson 3 is allowed.
      seed({ mon: { status: 'completed' }, tue: { steps: day('Lesson 3', 'lesson') }, fri: { steps: day('Lesson 4', 'lesson') } });
      expect((await swap('wed', 'fri')).status).toBe(200);
      expect(stepsOf('wed')[0]).toMatchObject({ title: 'Lesson 4' });
    });

    it('M3.2 review: refused when it narrows a closeness the writer left within the rest gap; allowed when it widens it', async () => {
      // Rest gap 2: hard Mon (done) and Wed are two days apart (the writer's own closeness). Wed's step onto Tue
      // narrows it to one.
      const gap2 = { ...PROFILE, restGapDays: 2 };
      seed({ mon: { status: 'completed', steps: day('intervals', 'heavy') }, wed: { steps: day('tempo', 'heavy') } }, gap2);
      at(TUE);
      expect(await swap('wed', 'tue')).toMatchObject({ status: 409, body: { reason: 'rest_gap' } });
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'rest_gap' } });
      expect((await reconcile()).body.carry.choices.today).toEqual({ taskId: 'tue', setAside: true, swapWith: ['fri'] });
      // Wed's step onto Fri widens it (four days from Mon).
      expect((await swap('wed', 'fri')).status).toBe(200);
    });

    it('refused when it creates a rest-gap breach (rest_gap), counting a done day', async () => {
      seed({ mon: { status: 'completed' }, tue: { steps: day('intervals', 'heavy') }, fri: { steps: day('long run', 'heavy') } });
      at(TUE);
      // The long run onto Wed: one day after the intervals (rest gap 1).
      expect(await swap('wed', 'fri')).toMatchObject({ status: 409, body: { reason: 'rest_gap' } });
      // A done day counts: Mon's hard step was done.
      seed({ mon: { status: 'completed', steps: day('mon heavy', 'heavy') }, wed: { steps: day('tempo', 'heavy') } });
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'rest_gap' } });
    });

    it("allowed when the writer's own closeness is untouched, or the swap removes it", async () => {
      // The writer put two hard steps on Mon and Tue (rest gap 1); a swap that does not touch them is allowed.
      seed({ mon: { steps: day('intervals', 'heavy') }, tue: { steps: day('long run', 'heavy') } });
      at(MON);
      expect((await swap('wed', 'fri')).status).toBe(200);
      seed({ mon: { steps: day('intervals', 'heavy') }, tue: { steps: day('long run', 'heavy') } });
      expect((await swap('tue', 'fri')).status).toBe(200);
      expect(stepsOf('fri')[0]).toMatchObject({ title: 'long run' });
    });

    it.each([true, false])('refused on a day holding a continueFrom or shiftedFrom step (switch on: %s)', async (on) => {
      method(on);
      const marker = { taskId: 'mon', date: '2026-09-21' };
      seed({ wed: { steps: day('draft', 'drafting', { continueFrom: marker }) } });
      at(TUE);
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'holds_continue' } });
      expect(await swap('wed', 'tue')).toMatchObject({ status: 409, body: { reason: 'holds_continue' } });
      seed({ mon: { status: 'completed' }, wed: { steps: day('Lesson 3', 'lesson', { shiftedFrom: { ...marker, replaced: [] } }) } });
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'holds_carry' } });
      expect(store.prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each([true, false])('B-50: a continue marker whose day is done does not hold the day (switch on: %s)', async (on) => {
      method(on);
      seed({ mon: { status: 'completed' }, wed: { steps: day('draft', 'drafting', { continueFrom: { taskId: 'mon', date: '2026-09-21' } }) } });
      at(TUE);
      const answer = await swap('tue', 'wed');
      expect(answer.status).toBe(200);
    });

    it.each([true, false])('B-52: a moved step whose source day is done does not hold the day (switch on: %s)', async (on) => {
      method(on);
      const moved = { carriedFrom: { taskId: 'mon', date: '2026-09-21', replaced: [] } };
      // B-55: the done source day still holds the step (set aside, then done anyway).
      seed({ mon: { status: 'completed', steps: day('draft', 'drafting') }, wed: { steps: day('draft', 'drafting', moved) } });
      at(TUE);
      if (on) expect((await reconcile()).body.carry.choices.today.swapWith).toContain('wed');
      expect((await swap('tue', 'wed')).status).toBe(200);

      // B-55: the source day is done but no longer holds the step (it gave it up): the step was never done, still refused.
      seed({ mon: { status: 'completed' }, wed: { steps: day('draft', 'drafting', moved) } });
      if (on) expect((await reconcile()).body.carry.choices.today.swapWith).not.toContain('wed');
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'holds_carry' } });

      // The source day not done: still refused.
      seed({ wed: { steps: day('draft', 'drafting', moved) } });
      if (on) expect((await reconcile()).body.carry.choices.today.swapWith).not.toContain('wed');
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'holds_carry' } });
      expect(await swap('wed', 'tue')).toMatchObject({ status: 409, body: { reason: 'holds_carry' } });
    });

    it('switch off: answering an offer onto a day holding a continue marker is refused (holds_continue)', async () => {
      method(false);
      seed({ mon: { key: true }, tue: { steps: day('draft', 'drafting', { continueFrom: { taskId: 'x', date: '2026-09-20' } }) } });
      at(TUE);
      expect((await reconcile()).body.carry.held.map((h: any) => h.taskId)).toEqual(['mon']);
      expect(await swap('mon', 'tue')).toMatchObject({ status: 409, body: { reason: 'holds_continue' } });
      expect(store.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a key session is not held when its receiving day holds a continue marker (its swap would be refused)', async () => {
      seed({ mon: { key: true }, tue: { steps: day('draft', 'drafting', { continueFrom: { taskId: 'x', date: '2026-09-20' } }) } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held).toEqual([]);
    });
  });

  describe('the hold (RULE-16)', () => {
    it('a key session whose main step lets go is not held: it lets go, and move now is refused (not_held)', async () => {
      seed({ mon: { key: true, steps: letGo('mon talk') } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held).toEqual([]);
      expect(body.carry.outcomes.find((o: any) => o.taskId === 'mon')).toMatchObject({ rules: 'method', outcome: 'let_go' });
      expect(body.carry.choices.held).toEqual([]);
      expect(await post('/tasks/mon/carry-now')).toMatchObject({ status: 409, body: { reason: 'not_held' } });
    });

    it('a key session whose main step continues is not held: the next session of its kind is marked', async () => {
      seed({ mon: { key: true, steps: day('mon draft', 'drafting') }, wed: { steps: day('wed draft', 'drafting') } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held).toEqual([]);
      expect(body.carry.writtenContinues.map((c: any) => [c.fromTaskId, c.toTaskId])).toEqual([['mon', 'wed']]);
      expect(stepsOf('wed')[0]).toMatchObject({ continueFrom: { taskId: 'mon', date: '2026-09-21' } });
    });

    it('a key session whose swap would break the rest gap is not held, and moves by RULE-9', async () => {
      // Mon (missed, key) intervals; its receiving day is Tue, next to Wed's tempo run. Tue and Wed fail, so Fri.
      seed({ mon: { key: true, steps: day('intervals', 'heavy') }, wed: { steps: day('tempo', 'heavy') } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held).toEqual([]);
      expect(body.carry.written.map((c: any) => [c.fromTaskId, c.toTaskId])).toEqual([['mon', 'fri']]);
    });

    it('a key session whose swap passes is held, with its move-now day', async () => {
      seed({ mon: { key: true } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.held.map((h: any) => [h.taskId, h.receivingTaskId])).toEqual([['mon', 'tue']]);
      expect(body.carry.choices.held).toEqual([{ taskId: 'mon', receivingTaskId: 'tue', moveNowTaskId: 'tue' }]);
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
      // Answering the offer is the same check, so it is allowed (ND-18 markers on both days).
      expect((await swap('mon', 'tue')).status).toBe(200);
      expect(stepsOf('tue')[0]).toMatchObject({ title: 'mon practice', swappedFrom: { taskId: 'mon' } });
    });
  });

  describe('move now (RULE-16, MR-21 (2))', () => {
    it('offered with its day when it moves, and done there', async () => {
      seed({ mon: { key: true } });
      at(TUE);
      const before = (await reconcile()).body.carry.choices.held[0];
      const { status, body } = await post('/tasks/mon/carry-now');
      expect(status).toBe(200);
      expect(body.carry.written.map((c: any) => c.toTaskId)).toEqual([before.moveNowTaskId]);
      expect(stepsOf('tue')[1]).toMatchObject({ title: 'mon practice', carriedFrom: { taskId: 'mon' } });
      // The answer carries the choices too: nothing is held any more.
      expect(body.carry.choices.held).toEqual([]);
    });

    it('refused with would_not_move, and nothing written, when it would not move', async () => {
      // Every later day is one 30-minute lesson: the practice step fits nowhere (no day gets longer).
      const lessonDay = (n: number) => ({ steps: [step(`Lesson ${n}`, 1, 30, 'lesson')] });
      seed({ mon: { key: true }, tue: lessonDay(4), wed: lessonDay(5), fri: lessonDay(6) });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.choices.held).toEqual([{ taskId: 'mon', receivingTaskId: 'tue', moveNowTaskId: null }]);
      const before = structuredClone(store.rows);
      expect(await post('/tasks/mon/carry-now')).toMatchObject({ status: 409, body: { reason: 'would_not_move' } });
      expect(store.rows).toEqual(before);
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['steps without kinds (RULE-18)', (s: Step[]) => s.map(({ kind: _k, ...rest }) => rest as Step), PROFILE],
      ['no valid profile', (s: Step[]) => s, null],
    ])('M3.2 review: a held day with %s keeps today\'s carry-now: 200 even when its step drops', async (_name, tag, profile) => {
      // Mon's lead is not high-load (so it is held, ND-9), a lower step is; Tue is one 30-minute step, so nothing fits.
      const mon = tag([step('mon lead', 1, 15, 'practice'), step('mon sprints', 2, 10, 'heavy', { highLoad: true }), step('mon extra', 3, 5, 'general')]);
      const tue = tag([step('tue block', 1, 30, 'practice')]);
      seed({ mon: { key: true, steps: mon }, tue: { steps: tue } }, profile);
      at(TUE);
      expect((await reconcile()).body.carry.held.map((h: any) => h.taskId)).toEqual(['mon']);
      const answer = await post('/tasks/mon/carry-now');
      expect(answer.status).toBe(200);
      expect(answer.body.carry.written).toEqual([]);
      expect(answer.body.carry.drops).toContainEqual({ taskId: 'mon', date: '2026-09-21', reason: 'does_not_fit' });
      // The same answer as with the method switch off.
      method(false);
      seed({ mon: { key: true, steps: mon }, tue: { steps: tue } }, profile);
      expect((await post('/tasks/mon/carry-now')).status).toBe(200);
    });
  });

  describe('carry.choices', () => {
    it('M3.2 review: with the carry switch off nothing is offered', async () => {
      delete process.env[CARRY];
      seed({ mon: { key: true } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.enabled).toBe(false);
      expect(body.carry.held.map((h: any) => h.taskId)).toEqual(['mon']);
      expect(body.carry.choices).toEqual({ today: null, held: [] });
    });

    it("M3.2 review (Mo): a held offer's receiving day never takes a continue marker; the continue is no room and the offer stays", async () => {
      // Thursday is a practice day here. Wed (missed, key) is held for Thu, its receiving day. Tue (missed) has a
      // continue step whose next session of the kind is Thu: no marker goes there, and Tue's continue is no room.
      seed({
        mon: { status: 'completed' },
        tue: { steps: [step('tue draft', 1, 15, 'drafting'), step('tue notes', 2, 10, 'review')] },
        wed: { key: true },
        thu: { rest: false, steps: day('thu draft', 'drafting') },
      });
      at('2026-09-24T10:00:00Z');
      const { body } = await reconcile();
      expect(body.carry.continues).toEqual([]);
      expect(body.carry.writtenContinues).toEqual([]);
      expect(stepsOf('thu').some((s) => s.continueFrom)).toBe(false);
      expect(body.carry.outcomes.find((o: any) => o.taskId === 'tue')).toMatchObject({ rules: 'method', outcome: 'no_room', topStep: 'no_room' });
      expect(body.carry.held.map((h: any) => [h.taskId, h.receivingTaskId])).toEqual([['wed', 'thu']]);
      expect(body.carry.choices.held.map((h: any) => h.taskId)).toEqual(['wed']);
      expect(body.signals.swapOffer).toMatchObject({ missedTaskId: 'wed', receivingTaskId: 'thu' });
      // The next request still holds Wed, and answering the offer swaps.
      const next = await reconcile();
      expect(next.body.carry.held.map((h: any) => h.taskId)).toEqual(['wed']);
      expect(next.body.carry.choices.held.map((h: any) => h.taskId)).toEqual(['wed']);
      expect((await swap('wed', 'thu')).status).toBe(200);
      expect(stepsOf('thu')[0]).toMatchObject({ title: 'wed practice', swappedFrom: { taskId: 'wed' } });
    });

    it('today: set aside, and only the days that pass; the route agrees', async () => {
      seed({ mon: { status: 'completed' }, wed: { steps: day('class', 'fixed_time_session') } });
      at(TUE);
      const { body } = await reconcile();
      expect(body.carry.choices.today).toEqual({ taskId: 'tue', setAside: true, swapWith: ['fri'] });
      expect(await swap('tue', 'wed')).toMatchObject({ status: 409, body: { reason: 'fixed_step' } });
      const swapped = await swap('tue', 'fri');
      expect(swapped.status).toBe(200);
      // A swap marks nothing, so both days can still be swapped back.
      expect(swapped.body.carry.choices.today).toEqual({ taskId: 'tue', setAside: true, swapWith: ['fri'] });
    });

    it('today: null on a rest day; no swap from the test day', async () => {
      seed();
      at('2026-09-24T10:00:00Z');
      expect((await reconcile()).body.carry.choices.today).toBeNull();
      seed();
      at('2026-09-26T10:00:00Z');
      expect((await reconcile()).body.carry.choices.today).toEqual({ taskId: 'sat', setAside: true, swapWith: [] });
    });

    it('today set aside as a key session: no longer offered, and listed as held with its move-now day', async () => {
      seed({ mon: { status: 'completed' }, tue: { key: true } });
      at(TUE);
      const { status, body } = await post('/tasks/tue/mark-missed');
      expect(status).toBe(200);
      expect(body.carry.choices).toEqual({ today: { taskId: 'tue', setAside: false, swapWith: [] }, held: [{ taskId: 'tue', receivingTaskId: 'wed', moveNowTaskId: 'wed' }] });
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
      const moved = await post('/tasks/tue/carry-now');
      expect(moved.status).toBe(200);
      expect(moved.body.carry.written.map((c: any) => [c.fromTaskId, c.toTaskId])).toEqual([['tue', 'wed']]);
    });
  });

  describe('set today aside (RULE-16: then RULES 9 to 14)', () => {
    it('a let-go day writes nothing', async () => {
      seed({ mon: { status: 'completed' }, tue: { steps: letGo('tue talk') } });
      at(TUE);
      const { status, body } = await post('/tasks/tue/mark-missed');
      expect(status).toBe(200);
      expect(body.carry.outcomes.find((o: any) => o.taskId === 'tue')).toMatchObject({ rules: 'method', outcome: 'let_go' });
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });

    it('a move day moves by RULE-9 (past a day that fails the rest gap)', async () => {
      seed({ mon: { status: 'completed' }, tue: { steps: day('intervals', 'heavy') }, fri: { steps: day('long run', 'heavy') } });
      at(TUE);
      const { body } = await post('/tasks/tue/mark-missed');
      // Wed is two calendar days from Fri's long run, so it passes the rest gap of 1.
      expect(body.carry.written.map((c: any) => [c.fromTaskId, c.toTaskId])).toEqual([['tue', 'wed']]);
      expect(stepsOf('wed')[1]).toMatchObject({ title: 'intervals', carriedFrom: { taskId: 'tue' } });
    });

    it('a key day whose main step lets go is not held', async () => {
      seed({ mon: { status: 'completed' }, tue: { key: true, steps: letGo('tue talk') } });
      at(TUE);
      const { body } = await post('/tasks/tue/mark-missed');
      expect(body.carry.held).toEqual([]);
      expect(body.carry.outcomes.find((o: any) => o.taskId === 'tue')).toMatchObject({ outcome: 'let_go' });
      expect(body.signals.swapOffer ?? null).toBeNull();
    });
  });

  describe('B-49: after a swap, the first hard step back after a gap carries the easy line, once (RULE-21, MR-35 (5))', () => {
    // Mon to Wed missed (an open gap of three), today Thu is an open practice day, Sat the test day, Sun a practice day.
    const THU = '2026-09-24T10:00:00Z';
    const OPEN = ['thu', 'fri', 'sat', 'sun'];
    const easy = (id: string) => stepsOf(id).filter((s) => String(s.instructions).startsWith(EASY_START_LINE)).map((s) => s.title);
    /** Every step in the week that carries the line, as [day, title]. */
    const lines = () => OPEN.flatMap((id) => easy(id).map((title) => [id, title]));
    const back = (spec: Partial<Record<Id, DaySpec>>, profile: unknown = { ...PROFILE, restGapDays: 0 }) =>
      seed({ thu: { rest: false, steps: day('thu practice', 'practice') }, sun: { rest: false, steps: day('sun practice', 'practice') }, ...spec }, profile);

    it("today without a hard step swapped with Friday's hard step: the hard step now on today has the line, Friday has none", async () => {
      back({ fri: { steps: day('fri intervals', 'heavy') } });
      at(THU);
      await reconcile();
      expect(lines()).toEqual([['fri', 'fri intervals']]);
      expect((await swap('thu', 'fri')).status).toBe(200);
      expect(lines()).toEqual([['thu', 'fri intervals']]);
      expect(stepsOf('thu')[0].instructions).toBe(`${EASY_START_LINE}\nDo fri intervals.`);
      // A later reconcile does not add it a second time.
      await reconcile();
      await reconcile();
      expect(lines()).toEqual([['thu', 'fri intervals']]);
      expect(stepsOf('thu')[0].instructions).toBe(`${EASY_START_LINE}\nDo fri intervals.`);
    });

    it('the same swap before any reconcile wrote the line: added once, on the step now on today', async () => {
      back({ fri: { steps: day('fri intervals', 'heavy') } });
      at(THU);
      expect((await swap('thu', 'fri')).status).toBe(200);
      expect(lines()).toEqual([['thu', 'fri intervals']]);
    });

    it('a hard step swapped onto today ahead of the line moves the line onto it; never on two steps', async () => {
      back({ fri: { steps: day('fri intervals', 'heavy') }, sun: { rest: false, steps: day('sun hills', 'heavy') } });
      at(THU);
      await reconcile();
      expect(lines()).toEqual([['fri', 'fri intervals']]);
      expect((await swap('thu', 'sun')).status).toBe(200);
      expect(lines()).toEqual([['thu', 'sun hills']]);
      expect(stepsOf('fri')[0].instructions).toBe('Do fri intervals.');
      await reconcile();
      expect(lines()).toEqual([['thu', 'sun hills']]);
    });

    it('the hard step holding the line swapped later: the line goes to the new first hard step back, not with it', async () => {
      back({ thu: { rest: false, steps: day('thu intervals', 'heavy') }, fri: { steps: day('fri hills', 'heavy') } });
      at(THU);
      await reconcile();
      expect(lines()).toEqual([['thu', 'thu intervals']]);
      expect((await swap('thu', 'sun')).status).toBe(200);
      expect(lines()).toEqual([['fri', 'fri hills']]);
      expect(stepsOf('sun')[0].instructions).toBe('Do thu intervals.');
    });

    it('a swap that touches neither the day holding the line nor the first hard day back leaves the line where it is', async () => {
      back({ fri: { steps: day('fri intervals', 'heavy') } });
      at(THU);
      await reconcile();
      const fri = row('fri').detailedSteps;
      vi.mocked(store.prisma.dailyTask.updateMany).mockClear();
      expect((await swap('thu', 'sun')).status).toBe(200);
      expect(row('fri').detailedSteps).toBe(fri);
      expect(lines()).toEqual([['fri', 'fri intervals']]);
      expect(stepsOf('thu')[0].title).toBe('sun practice');
    });

    it('no open gap: a swap never adds the line', async () => {
      back({ mon: { status: 'completed' }, tue: { status: 'completed' }, wed: { status: 'completed' }, fri: { steps: day('fri intervals', 'heavy') } });
      at(THU);
      await reconcile();
      expect((await swap('thu', 'fri')).status).toBe(200);
      expect(lines()).toEqual([]);
    });

    it('the line write is in the swap transaction: a day that changed meanwhile writes nothing (409 changed)', async () => {
      back({ fri: { steps: day('fri intervals', 'heavy') }, sun: { rest: false, steps: day('sun hills', 'heavy') } });
      at(THU);
      await reconcile();
      const before = structuredClone(store.rows);
      const findMany = store.prisma.dailyTask.findMany.getMockImplementation()!;
      // Friday changes after the route loaded it, before the swap writes.
      store.prisma.dailyTask.findMany.mockImplementationOnce(async (args: any) => {
        row('fri').detailedSteps = JSON.stringify(day('fri changed', 'heavy'));
        before.find((r: any) => r.id === 'fri').detailedSteps = row('fri').detailedSteps;
        return findMany(args);
      });
      expect(await swap('thu', 'sun')).toMatchObject({ status: 409, body: { reason: 'changed' } });
      expect(store.rows).toEqual(before);
    });

    it('switch off: the swap writes exactly the two days, the line where it was', async () => {
      method(false);
      back({ fri: { steps: day('fri intervals', 'heavy').map((s, i) => (i === 0 ? { ...s, instructions: `${EASY_START_LINE}\nDo fri intervals.` } : s)) }, sun: { rest: false, steps: day('sun hills', 'heavy') } });
      at(THU);
      const thu = row('thu').detailedSteps;
      const sun = row('sun').detailedSteps;
      const fri = row('fri').detailedSteps;
      expect((await swap('thu', 'sun')).status).toBe(200);
      expect([row('thu').detailedSteps, row('sun').detailedSteps, row('fri').detailedSteps]).toEqual([sun, thu, fri]);
      expect(lines()).toEqual([['fri', 'fri intervals']]);
    });
  });

  describe('generated weeks: the routes agree with carry.choices (AC-8)', () => {
    function seedWeek(n: number) {
      const week = randomWeek(n);
      seed({}, week.profile);
      store.rows = week.rows.map((r) => ({ ...r, goalId: 'g1', title: r.id, implementationIntention: null, resourceTitle: null, resourceUrl: null, resourceType: null, resourceWhy: null, whyToday: null, minimumVersion: null }));
      at(week.now.toISOString());
      return week;
    }

    it('every open swap with today is allowed exactly when the choices offer it; move now exactly when it names a day', async () => {
      let offered = 0;
      let refused = 0;
      for (let n = 1; n <= 40; n += 1) {
        const week = seedWeek(n);
        const { body } = await reconcile();
        const choices = body.carry.choices;
        const afterReconcile = structuredClone(store.rows);
        const today = choices.today;
        if (today?.setAside) {
          for (const other of week.rows.filter((r) => r.weekNumber === 2 && r.date > week.today)) {
            store.rows = structuredClone(afterReconcile);
            const answer = await swap(today.taskId, other.id);
            const allowed = today.swapWith.includes(other.id);
            if (allowed) offered += 1;
            else refused += 1;
            expect(answer.status, `seed ${n}: ${today.taskId} with ${other.id} (${answer.body.reason ?? 'ok'})`).toBe(allowed ? 200 : 409);
          }
        }
        for (const held of choices.held) {
          store.rows = structuredClone(afterReconcile);
          const answer = await post(`/tasks/${held.taskId}/carry-now`);
          if (held.moveNowTaskId === null) {
            expect(answer, `seed ${n}: ${held.taskId}`).toMatchObject({ status: 409, body: { reason: 'would_not_move' } });
            expect(store.rows).toEqual(afterReconcile);
          } else {
            expect(answer.status, `seed ${n}: ${held.taskId}`).toBe(200);
            expect(row(held.moveNowTaskId).detailedSteps).not.toBe(afterReconcile.find((r: any) => r.id === held.moveNowTaskId).detailedSteps);
          }
        }
      }
      expect(offered).toBeGreaterThan(5);
      expect(refused).toBeGreaterThan(5);
    });
  });
});
