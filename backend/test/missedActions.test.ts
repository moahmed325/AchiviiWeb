import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';

// Missed sessions M2.4: mark missed, swap, carry now (ND-9, ND-14, ND-17, ND-18), behind the ND-15 switch.
// Prisma is replaced by a small in-memory store: updateMany is a real compare-and-set, and $transaction rolls back.

const store = vi.hoisted(() => ({
  goal: null as any,
  rows: [] as any[],
  failWriteNumber: 0,
  writes: 0,
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

const SWITCH = 'MISSED_SESSIONS_CARRY_ENABLED';
const user = { id: 'u1', email: 'u1@achivii.com', timezone: 'UTC' };

const CONTENT = ['title', 'detailedSteps', 'implementationIntention', 'durationMinutes', 'resourceTitle', 'resourceUrl', 'resourceType', 'resourceWhy', 'isKeySession', 'whyToday', 'minimumVersion'] as const;
const DATE_AND_USER = ['id', 'goalId', 'weekNumber', 'dayNumber', 'date', 'dayOfWeek', 'slotTime', 'isRestDay', 'isTestDay', 'status', 'completedAt', 'notes', 'usedMinimumVersion'] as const;

function updateRows(where: Record<string, unknown>, data: Record<string, unknown>) {
  store.writes++;
  if (store.failWriteNumber && store.writes === store.failWriteNumber) return { count: 0 };
  const matches = store.rows.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value));
  for (const row of matches) {
    for (const [key, value] of Object.entries(data)) row[key] = value === Prisma.DbNull ? null : value;
  }
  return { count: matches.length };
}

const step = (title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: `Do ${title}.`,
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...extra,
});
const stepsFor = (tag: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify([step(`${tag} lead`, 1, 15, extra), step(`${tag} second`, 2, 10), step(`${tag} third`, 3, 5)]);

/** Week 1 from Mon 2026-09-21: Mon-Wed practice, Thu rest, Fri practice, Sat test, Sun rest. Week 2 Mon too. */
const DAYS = [
  ['mon', '2026-09-21', 'Monday'],
  ['tue', '2026-09-22', 'Tuesday'],
  ['wed', '2026-09-23', 'Wednesday'],
  ['thu', '2026-09-24', 'Thursday'],
  ['fri', '2026-09-25', 'Friday'],
  ['sat', '2026-09-26', 'Saturday'],
  ['sun', '2026-09-27', 'Sunday'],
  ['mon2', '2026-09-28', 'Monday'],
] as const;

function seed(over: Record<string, Record<string, unknown>> = {}, goalOver: Record<string, unknown> = {}) {
  store.goal = {
    id: 'g1',
    userId: user.id,
    status: 'active',
    planVersion: 2,
    routine: JSON.stringify({ sleepTime: '23:00' }),
    rawGoal: 'Type 40 words per minute',
    clarifiedOutcome: 'Type 40 wpm at 95% accuracy',
    ...goalOver,
  };
  store.rows = DAYS.map(([id, date, dayOfWeek], index) => {
    const isRestDay = id === 'thu' || id === 'sun';
    return {
      id,
      goalId: 'g1',
      weekNumber: id === 'mon2' ? 2 : 1,
      dayNumber: index + 1,
      date,
      dayOfWeek,
      title: `${id} title`,
      detailedSteps: isRestDay ? '[]' : stepsFor(id),
      implementationIntention: `At 19:30: ${id} title.`,
      durationMinutes: isRestDay ? 0 : 30,
      slotTime: '19:30',
      isRestDay,
      status: 'pending',
      completedAt: null,
      notes: `${id} note`,
      resourceTitle: `${id} resource`,
      resourceUrl: `https://example.com/${id}`,
      resourceType: 'guide',
      resourceWhy: `${id} why`,
      isKeySession: false,
      isTestDay: id === 'sat',
      whyToday: `${id} because`,
      minimumVersion: isRestDay ? null : step(`${id} minimum`, 1, 10),
      usedMinimumVersion: false,
      created_at: new Date('2026-09-20T00:00:00Z'),
      ...over[id],
    };
  });
}

const row = (id: string) => store.rows.find((r) => r.id === id);
const steps = (id: string) => JSON.parse(row(id).detailedSteps);

describe('M2.4 actions', () => {
  let server: Server;
  let baseUrl: string;
  const saved = process.env[SWITCH];

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`${baseUrl}/api/goal${path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const at = (iso: string) => vi.setSystemTime(new Date(iso));
  const swap = (a: string, b: string, expected?: Record<string, string>) =>
    post(`/tasks/${a}/swap`, { withTaskId: b, expected: expected ?? { [a]: row(a).detailedSteps, [b]: row(b).detailedSteps } });

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env[SWITCH] = 'true';
    store.failWriteNumber = 0;
    store.writes = 0;
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

  describe('mark today missed', () => {
    it('carries today at once: one guarded write, and the move is in signals straight away (ND-18)', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-22T10:00:00Z');
      const { status, body } = await post('/tasks/tue/mark-missed');
      expect(status).toBe(200);
      expect(body.carry.written.map((c: any) => [c.fromTaskId, c.toTaskId])).toEqual([['tue', 'wed']]);
      expect(body.signals.carried).toEqual([
        { fromDate: '2026-09-22', fromTaskId: 'tue', toDate: '2026-09-23', toTaskId: 'wed', stepTitle: 'tue lead' },
      ]);
      expect(body.signals.notice).toBe('carried');
      expect(steps('wed')[1]).toMatchObject({ title: 'tue lead', carriedFrom: { taskId: 'tue', date: '2026-09-22' } });
      // Nothing about the mark is stored: today keeps its status and content.
      expect(row('tue')).toMatchObject({ status: 'pending', detailedSteps: stepsFor('tue') });
      expect(store.prisma.dailyTask.updateMany).toHaveBeenCalledTimes(1);
    });

    it('a repeat after the carry writes nothing (already handled)', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-22T10:00:00Z');
      await post('/tasks/tue/mark-missed');
      const wed = row('wed').detailedSteps;
      const again = await post('/tasks/tue/mark-missed');
      expect(again).toMatchObject({ status: 409, body: { reason: 'already_handled' } });
      expect(row('wed').detailedSteps).toBe(wed);
      expect(store.prisma.dailyTask.updateMany).toHaveBeenCalledTimes(1);
    });

    it('holds a key session for a swap offer and stores nothing (ND-9, ND-14)', async () => {
      seed({ mon: { status: 'completed' }, tue: { isKeySession: true } });
      at('2026-09-22T10:00:00Z');
      const { status, body } = await post('/tasks/tue/mark-missed');
      expect(status).toBe(200);
      expect(body.signals.swapOffer).toMatchObject({ missedTaskId: 'tue', receivingTaskId: 'wed', receivingDate: '2026-09-23' });
      expect(body.signals.notice).toBe('swap_offer');
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['no_receiving_day', { mon: { status: 'completed' }, tue: { status: 'completed' }, wed: { status: 'completed' } }, 'fri', '2026-09-25T10:00:00Z'],
      ['high_load', { mon: { status: 'completed' }, tue: { detailedSteps: stepsFor('tue', { highLoad: true }) } }, 'tue', '2026-09-22T10:00:00Z'],
      ['does_not_fit', { mon: { status: 'completed' }, wed: { detailedSteps: JSON.stringify([step('wed lead', 1, 25), step('wed short', 2, 5)]) } }, 'tue', '2026-09-22T10:00:00Z'],
      ['receiving_day_done', { mon: { status: 'completed' }, wed: { status: 'completed' } }, 'tue', '2026-09-22T10:00:00Z'],
      ['in_gap', {}, 'wed', '2026-09-23T10:00:00Z'],
    ])('drops today when the rules say so (%s), writing nothing', async (reason, over, id, now) => {
      seed(over as Record<string, Record<string, unknown>>);
      at(now);
      const { status, body } = await post(`/tasks/${id}/mark-missed`);
      expect(status).toBe(200);
      expect(body.carry.drops).toContainEqual({ taskId: id, date: row(id).date, reason });
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });

    it.each([
      ['not_today', 'wed', {}],
      ['rest_day', 'thu', {}],
      ['completed', 'tue', { tue: { status: 'completed' } }],
    ])('refuses %s', async (reason, id, over) => {
      seed({ mon: { status: 'completed' }, ...(over as Record<string, Record<string, unknown>>) });
      at(id === 'thu' ? '2026-09-24T10:00:00Z' : '2026-09-22T10:00:00Z');
      expect(await post(`/tasks/${id}/mark-missed`)).toMatchObject({ status: 409, body: { reason } });
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('swap', () => {
    it('open swap exchanges exactly the content fields; dates and the user’s fields stay', async () => {
      seed({ mon: { status: 'completed' }, fri: { isKeySession: true } });
      at('2026-09-22T10:00:00Z');
      const before = { wed: { ...row('wed') }, fri: { ...row('fri') } };
      const { status } = await swap('wed', 'fri');
      expect(status).toBe(200);
      for (const field of CONTENT) {
        expect(row('wed')[field]).toEqual(before.fri[field]);
        expect(row('fri')[field]).toEqual(before.wed[field]);
      }
      for (const field of DATE_AND_USER) {
        expect(row('wed')[field]).toEqual(before.wed[field]);
        expect(row('fri')[field]).toEqual(before.fri[field]);
      }
      expect(steps('wed').some((s: any) => s.swappedFrom)).toBe(false);
    });

    it('answering a swap offer marks both days, ends the offer, and nothing is carried back (ND-18)', async () => {
      seed({ mon: { status: 'completed' }, tue: { isKeySession: true } });
      at('2026-09-23T10:00:00Z');
      const offered = await post('/reconcile');
      expect(offered.body.signals.swapOffer).toMatchObject({ missedTaskId: 'tue', receivingTaskId: 'wed' });

      const { status, body } = await swap('tue', 'wed');
      expect(status).toBe(200);
      expect(row('wed')).toMatchObject({ title: 'tue title', isKeySession: true, date: '2026-09-23' });
      expect(steps('wed').every((s: any) => s.swappedFrom?.taskId === 'tue' && s.swappedFrom.date === '2026-09-22')).toBe(true);
      expect(steps('tue').every((s: any) => s.swappedFrom?.taskId === 'wed' && s.swappedFrom.date === '2026-09-23')).toBe(true);
      expect(body.signals.swapOffer).toBeNull();
      const mentions = (plan: any) =>
        [...plan.carries.map((c: any) => c.fromTaskId), ...plan.drops.map((d: any) => d.taskId), ...plan.held.map((h: any) => h.taskId)];
      expect(mentions(body.carry)).toEqual([]);

      // Even after Wed closes undone, neither swapped day is carried, held or dropped.
      at('2026-09-24T10:00:00Z');
      const later = await post('/reconcile');
      expect(mentions(later.body.carry).filter((id: string) => id === 'tue' || id === 'wed')).toEqual([]);
      expect(later.body.carry.carries).toEqual([]);
    });

    it('a stale `expected` changes nothing (409 changed)', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-22T10:00:00Z');
      const before = structuredClone(store.rows);
      const result = await swap('wed', 'fri', { wed: 'old', fri: row('fri').detailedSteps });
      expect(result).toMatchObject({ status: 409, body: { reason: 'changed' } });
      expect(store.rows).toEqual(before);
    });

    it('rolls back the first day when the second write matches nothing (409 changed)', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-22T10:00:00Z');
      const before = structuredClone(store.rows);
      store.failWriteNumber = 2;
      expect(await swap('wed', 'fri')).toMatchObject({ status: 409, body: { reason: 'changed' } });
      expect(store.rows).toEqual(before);
    });

    it('a double submit swaps once', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-22T10:00:00Z');
      const expected = { wed: row('wed').detailedSteps, fri: row('fri').detailedSteps };
      const results = await Promise.all([swap('wed', 'fri', expected), swap('wed', 'fri', expected)]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(row('wed').title).toBe('fri title');
      expect(row('fri').title).toBe('wed title');
    });

    it.each([
      ['not_same_week', 'fri', 'mon2', {}],
      ['test_day', 'wed', 'sat', {}],
      ['rest_day', 'wed', 'thu', {}],
      ['completed', 'wed', 'fri', { fri: { status: 'completed' } }],
      ['not_open', 'mon', 'wed', { mon: { status: 'pending' } }],
      ['holds_carry', 'wed', 'fri', { fri: { detailedSteps: JSON.stringify([step('fri lead', 1, 15), step('moved', 2, 15, { carriedFrom: { taskId: 'x', date: '2026-09-20', replaced: [] } })]) } }],
    ])('refuses %s and writes nothing', async (reason, a, b, over) => {
      seed({ mon: { status: 'completed' }, ...(over as Record<string, Record<string, unknown>>) });
      at('2026-09-22T10:00:00Z');
      const before = structuredClone(store.rows);
      expect(await swap(a, b)).toMatchObject({ status: 409, body: { reason } });
      expect(store.rows).toEqual(before);
    });

    it.each([
      [{}],
      [{ withTaskId: 'fri' }],
      [{ withTaskId: 'wed', expected: { wed: 'x' } }],
      [{ withTaskId: 'fri', expected: { wed: 1, fri: 'x' } }],
      [{ withTaskId: 'fri', expected: [] }],
    ])('rejects a malformed body with 400 (%j)', async (body) => {
      seed();
      at('2026-09-22T10:00:00Z');
      expect((await post('/tasks/wed/swap', body)).status).toBe(400);
    });
  });

  describe('carry now', () => {
    it('carries a held key session’s priority-1 step with the fit rule; a repeat writes nothing', async () => {
      seed({ mon: { status: 'completed' }, tue: { isKeySession: true } });
      at('2026-09-23T10:00:00Z');
      const { status, body } = await post('/tasks/tue/carry-now');
      expect(status).toBe(200);
      expect(body.carry.written.map((c: any) => [c.fromTaskId, c.toTaskId, c.replaced.map((s: any) => s.title)])).toEqual([
        ['tue', 'wed', ['wed second', 'wed third']],
      ]);
      expect(steps('wed').map((s: any) => [s.title, s.priority])).toEqual([['wed lead', 1], ['tue lead', 2]]);
      expect(row('wed').durationMinutes).toBe(30);
      expect(body.signals).toMatchObject({ swapOffer: null, notice: 'carried' });
      expect(body.days.find((d: any) => d.taskId === 'tue').isKeySession).toBe(true);

      expect(await post('/tasks/tue/carry-now')).toMatchObject({ status: 409, body: { reason: 'already_handled' } });
      expect(store.prisma.dailyTask.updateMany).toHaveBeenCalledTimes(1);
    });

    it("answers a marked key session today: mark missed holds it, carry now moves it", async () => {
      seed({ mon: { status: 'completed' }, tue: { isKeySession: true } });
      at('2026-09-22T10:00:00Z');
      expect((await post('/tasks/tue/mark-missed')).body.signals.swapOffer).not.toBeNull();
      const { body } = await post('/tasks/tue/carry-now');
      expect(body.carry.written.map((c: any) => c.toTaskId)).toEqual(['wed']);
    });

    it('refuses a day that is not held (not_held)', async () => {
      seed({ mon: { status: 'completed' } });
      at('2026-09-23T10:00:00Z');
      expect(await post('/tasks/tue/carry-now')).toMatchObject({ status: 409, body: { reason: 'not_held' } });
      expect(await post('/tasks/wed/carry-now')).toMatchObject({ status: 409, body: { reason: 'not_held' } });
    });
  });

  describe('switch, old goals and auth', () => {
    const calls = (): Array<[string, unknown]> => [
      ['/tasks/tue/mark-missed', undefined],
      ['/tasks/tue/carry-now', undefined],
      ['/tasks/wed/swap', { withTaskId: 'fri', expected: { wed: stepsFor('wed'), fri: stepsFor('fri') } }],
    ];

    it('every action answers 409 carry_disabled and writes nothing while the switch is off', async () => {
      for (const value of [undefined, 'false', 'TRUE']) {
        if (value === undefined) delete process.env[SWITCH];
        else process.env[SWITCH] = value;
        seed({ mon: { status: 'completed' }, tue: { isKeySession: true } });
        at('2026-09-22T10:00:00Z');
        const before = structuredClone(store.rows);
        for (const [path, body] of calls()) {
          expect(await post(path, body)).toMatchObject({ status: 409, body: { reason: 'carry_disabled' } });
        }
        expect(store.rows).toEqual(before);
      }
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
      expect(store.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('old (plan v1) goals answer not_plan_v2 to every action', async () => {
      seed({}, { planVersion: 1 });
      at('2026-09-22T10:00:00Z');
      for (const [path, body] of calls()) {
        expect(await post(path, body)).toMatchObject({ status: 409, body: { reason: 'not_plan_v2' } });
      }
      expect(store.prisma.dailyTask.updateMany).not.toHaveBeenCalled();
    });

    it('401 without a user; 404 for a task outside the user’s active goal', async () => {
      seed();
      at('2026-09-22T10:00:00Z');
      (getAuthUser as any).mockResolvedValueOnce(null);
      expect((await post('/tasks/tue/mark-missed')).status).toBe(401);
      expect((await post('/tasks/nope/mark-missed')).status).toBe(404);
      expect((await post('/tasks/nope/carry-now')).status).toBe(404);
      expect((await post('/tasks/wed/swap', { withTaskId: 'nope', expected: { wed: 'a', nope: 'b' } })).status).toBe(404);
      store.goal.userId = 'someone-else';
      expect((await post('/tasks/tue/mark-missed')).status).toBe(404);
    });
  });
});
