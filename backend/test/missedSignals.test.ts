import { describe, it, expect } from 'vitest';
import { buildReconcileResult } from '../src/lib/missedSessions.js';
import { parseStoredSteps, planCarries, type CarryPlan } from '../src/lib/carryForward.js';
import { buildSignals, weekCounts, type SignalInput } from '../src/lib/missedSignals.js';

// Missed sessions M2.3: week counts (OD-2) and the reconcile signals (ND-16). User timezone UTC, bedtime 23:00,
// so the day dated D closes at 01:00 UTC on D+1.

const CUSTOM = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };

const step = (title: string, priority: number, minutes: number, extra: Record<string, unknown> = {}) => ({
  stepNumber: priority,
  title,
  durationMinutes: minutes,
  instructions: '',
  focusCue: '',
  pitfallToAvoid: '',
  priority,
  ...extra,
});
const steps = (tag: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify([step(`${tag} lead`, 1, 15, extra), step(`${tag} second`, 2, 10), step(`${tag} third`, 3, 5)]);

/** Week 1 from Mon 2026-09-21: Mon-Wed practice, Thu rest, Fri practice, Sat test, Sun rest. */
const DATES = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
const NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Name = (typeof NAMES)[number];

interface Row {
  id: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  isRestDay: boolean;
  isKeySession: boolean;
  isTestDay: boolean;
  usedMinimumVersion: boolean;
  durationMinutes: number;
  detailedSteps: string;
}

function rows(over: Partial<Record<Name, Partial<Row>>> = {}, weekNumber = 1, dates = DATES): Row[] {
  return NAMES.map((name, index) => {
    const isRestDay = name === 'thu' || name === 'sun';
    return {
      id: weekNumber === 1 ? name : `${name}${weekNumber}`,
      date: dates[index],
      weekNumber,
      dayNumber: (weekNumber - 1) * 7 + index + 1,
      status: 'pending',
      isRestDay,
      isKeySession: false,
      isTestDay: name === 'sat',
      usedMinimumVersion: false,
      durationMinutes: isRestDay ? 0 : 30,
      detailedSteps: isRestDay ? '[]' : steps(name),
      ...over[name],
    };
  });
}

/** Mirrors POST /reconcile: classification, the carry plan and the signals at `now`. */
function reconcileAt(tasks: Row[], now: string, written: 'none' | 'all' = 'none') {
  const at = new Date(now);
  const result = buildReconcileResult({ id: 'g', planVersion: 2, dailyTasks: tasks }, { now: at, timezone: 'UTC', sleepTime: '23:00' });
  if (!result.applies) throw new Error('expected a plan v2 result');
  const today = now.slice(0, 10);
  const plan = planCarries({
    days: result.days,
    gap: result.gap,
    tasks: tasks.map((t) => ({ ...t, steps: parseStoredSteps(t.detailedSteps) })),
    goal: CUSTOM,
    today,
    timezone: 'UTC',
    sleepTime: '23:00',
  });
  const signalInput: SignalInput = {
    days: result.days,
    gap: result.gap,
    plan,
    written: written === 'all' ? plan.carries : [],
    now: at,
    today,
    timezone: 'UTC',
    sleepTime: '23:00',
  };
  return { result, plan, signals: buildSignals(signalInput), signalInput };
}

/** The stored rows after a carry was written (what the next reconcile reads). */
function afterWriting(tasks: Row[], plan: CarryPlan): Row[] {
  return tasks.map((t) => {
    const carry = plan.carries.find((c) => c.toTaskId === t.id);
    return carry ? { ...t, detailedSteps: JSON.stringify(carry.steps), durationMinutes: carry.durationMinutes } : t;
  });
}

describe('weekCounts (R2, for M4.2)', () => {
  it('counts full, 10-minute, missed, carried and dropped days; rest days never count', () => {
    // Wed was carried onto Fri while Fri was open (marker stored); Fri was then missed and, as the day before the
    // test, dropped. Tue (key) was done only through the 10-minute version. A rest day is marked completed.
    const base = rows({
      mon: { status: 'completed', isKeySession: true },
      tue: { status: 'completed', isKeySession: true, usedMinimumVersion: true },
      sat: { status: 'completed' },
      sun: { status: 'completed' },
    });
    const carriedOnto = reconcileAt(base, '2026-09-24T10:00:00Z');
    expect(carriedOnto.plan.carries.map((c) => [c.fromTaskId, c.toTaskId])).toEqual([['wed', 'fri']]);
    const stored = afterWriting(base, carriedOnto.plan);
    const nextWeek = rows({}, 2, ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);

    const { result, plan } = reconcileAt([...stored, ...nextWeek], '2026-09-27T10:00:00Z');
    if (!result.applies) throw new Error();
    const counts = weekCounts(1, { tasks: [...stored, ...nextWeek], days: result.days, carry: plan });
    expect(counts).toEqual({
      practicePlanned: 5,
      practiceDone: 3,
      doneByMinimum: 1,
      keySessions: 2,
      keyDone: 1,
      keySkipped: 1,
      missed: 2,
      carried: 1,
      dropped: 1,
    });
    expect(plan.drops).toEqual([{ taskId: 'fri', date: '2026-09-25', reason: 'no_receiving_day' }]);
  });

  it('a key session still open is neither done nor skipped; carries written this request count', () => {
    const base = rows({ mon: { isKeySession: true } });
    const { result, plan } = reconcileAt(base, '2026-09-21T10:00:00Z');
    if (!result.applies) throw new Error();
    expect(weekCounts(1, { tasks: base, days: result.days, carry: plan })).toMatchObject({ keySessions: 1, keyDone: 0, keySkipped: 0 });

    const missedMon = reconcileAt(rows(), '2026-09-22T10:00:00Z');
    if (!missedMon.result.applies) throw new Error();
    const withWrite = { ...missedMon.plan, written: missedMon.plan.carries };
    expect(weekCounts(1, { tasks: rows(), days: missedMon.result.days, carry: withWrite }).carried).toBe(1);
    expect(weekCounts(1, { tasks: rows(), days: missedMon.result.days, carry: missedMon.plan }).carried).toBe(0);
  });
});

describe('signals: carried (only moves that were stored)', () => {
  it('a carry written by this request concerns today until its receiving day closes', () => {
    const { signals } = reconcileAt(rows(), '2026-09-22T10:00:00Z', 'all');
    expect(signals.carried).toEqual([
      { fromDate: '2026-09-21', fromTaskId: 'mon', toDate: '2026-09-22', toTaskId: 'tue', stepTitle: 'mon lead' },
    ]);
    expect(signals.notice).toBe('carried');
  });

  it('a carry stored by an earlier reconcile is reported from its marker, until the receiving day closes', () => {
    const first = reconcileAt(rows(), '2026-09-22T02:00:00Z');
    const stored = afterWriting(rows(), first.plan);
    const later = reconcileAt(stored, '2026-09-22T20:00:00Z');
    expect(later.signals.carried.map((c) => [c.fromTaskId, c.toTaskId, c.stepTitle])).toEqual([['mon', 'tue', 'mon lead']]);
    // Tue closes at 01:00 on Wed: the carry no longer concerns today.
    const done = stored.map((t) => (t.id === 'tue' ? { ...t, status: 'completed' } : t));
    expect(reconcileAt(done, '2026-09-23T00:59:00Z').signals.carried).toHaveLength(1);
    expect(reconcileAt(done, '2026-09-23T01:00:00Z').signals.carried).toEqual([]);
  });

  it('a carry that was only planned (switch off) is never reported as moved', () => {
    const { plan, signals } = reconcileAt(rows(), '2026-09-22T10:00:00Z', 'none');
    expect(plan.carries).toHaveLength(1);
    expect(signals.carried).toEqual([]);
    expect(signals.dropped).toEqual([]);
    expect(signals.notice).toBeNull();
  });
});

describe('signals: dropped', () => {
  it('is shown while the dropped day is the most recent closed practice day, then not', () => {
    const highLoadMon = rows({ mon: { detailedSteps: steps('mon', { highLoad: true }) } });
    const tue = reconcileAt(highLoadMon, '2026-09-22T10:00:00Z');
    expect(tue.signals.dropped).toEqual([{ date: '2026-09-21', taskId: 'mon', reason: 'high_load' }]);
    expect(tue.signals.notice).toBe('dropped');

    // Tue done and closed: Mon is no longer the most recent closed practice day.
    const doneTue = highLoadMon.map((t) => (t.id === 'tue' ? { ...t, status: 'completed' } : t));
    const wed = reconcileAt(doneTue, '2026-09-23T10:00:00Z');
    expect(wed.signals.dropped).toEqual([]);
    expect(wed.signals.notice).toBeNull();
  });

  it('is not shown before the day after closes: yesterday still open means the older day is not reported', () => {
    // At 00:30 on Wed, Tue has not closed yet; the most recent closed practice day is Mon (done).
    const tasks = rows({ mon: { status: 'completed' }, tue: { detailedSteps: steps('tue', { highLoad: true }) } });
    expect(reconcileAt(tasks, '2026-09-23T00:30:00Z').signals.dropped).toEqual([]);
    expect(reconcileAt(tasks, '2026-09-23T01:00:00Z').signals.dropped).toEqual([{ date: '2026-09-22', taskId: 'tue', reason: 'high_load' }]);
  });
});

describe('signals: swap offer (ND-9)', () => {
  it('offers a swap while the key session is held, and drops the offer once the receiving day closes', () => {
    const tasks = rows({ mon: { status: 'completed' }, tue: { isKeySession: true } });
    const wed = reconcileAt(tasks, '2026-09-23T10:00:00Z');
    expect(wed.signals.swapOffer).toEqual({
      missedTaskId: 'tue',
      missedDate: '2026-09-22',
      receivingTaskId: 'wed',
      receivingDate: '2026-09-23',
      offerUntil: '2026-09-24T01:00:00.000Z',
    });
    expect(wed.signals.notice).toBe('swap_offer');

    const fri = reconcileAt(tasks, '2026-09-25T10:00:00Z');
    expect(fri.plan.drops.find((d) => d.taskId === 'tue')?.reason).toBe('swap_unanswered');
    expect(fri.signals.swapOffer).toBeNull();
  });
});

describe('signals: shortOnTime (RULE-9, UX-2)', () => {
  it('is false at 1 miss in the week and true at 2, on an open practice day', () => {
    expect(reconcileAt(rows(), '2026-09-22T10:00:00Z').signals.shortOnTime).toBe(false);
    expect(reconcileAt(rows(), '2026-09-23T10:00:00Z').signals.shortOnTime).toBe(true);
  });

  it('is false on a rest day, and false once today is done', () => {
    expect(reconcileAt(rows(), '2026-09-24T10:00:00Z').signals.shortOnTime).toBe(false);
    const doneWed = rows({ wed: { status: 'completed' } });
    expect(reconcileAt(doneWed, '2026-09-23T10:00:00Z').signals.shortOnTime).toBe(false);
  });
});

describe('signals: gentleReturn (RULE-8, UX-4, AC-10)', () => {
  it('is set on the first open practice day after a gap, and not the day after once that day is done', () => {
    // Mon, Tue, Wed missed (a gap of 3); Thu is rest; Fri is the first open practice day after the gap.
    const fri = reconcileAt(rows(), '2026-09-25T10:00:00Z');
    expect(fri.signals.gentleReturn).toEqual({ gapLength: 3, firstDate: '2026-09-21', lastDate: '2026-09-23' });
    expect(fri.signals.notice).toBe('gentle_return');

    const doneFri = rows({ fri: { status: 'completed' } });
    const sat = reconcileAt(doneFri, '2026-09-26T10:00:00Z');
    expect(sat.signals.gentleReturn).toBeNull();
  });

  it('is not set on the rest day between the gap and the return day', () => {
    const thu = reconcileAt(rows(), '2026-09-24T10:00:00Z');
    expect(thu.result.applies && thu.result.gap?.length).toBe(3);
    expect(thu.signals.gentleReturn).toBeNull();
  });
});

describe('signals: notice', () => {
  it('picks gentle_return over a drop from the gap', () => {
    const fri = reconcileAt(rows(), '2026-09-25T10:00:00Z');
    expect(fri.signals.dropped).toEqual([{ date: '2026-09-23', taskId: 'wed', reason: 'in_gap' }]);
    expect(fri.signals.notice).toBe('gentle_return');
  });

  it('follows gentle_return, swap_offer, carried, dropped when several apply', () => {
    const { signalInput } = reconcileAt(rows(), '2026-09-23T10:00:00Z');
    const days = signalInput.days.map((d) => (d.taskId === 'tue' ? { ...d, kind: 'missed' as const } : d));
    const carried = { fromTaskId: 'mon', fromDate: '2026-09-21', toTaskId: 'wed', toDate: '2026-09-23', step: { ...step('mon lead', 2, 15) } };
    const drop = { taskId: 'tue', date: '2026-09-22', reason: 'high_load' as const };
    const held = { taskId: 'tue', date: '2026-09-22', receivingTaskId: 'wed', offerUntil: '2026-09-24T01:00:00.000Z' };
    const input = (plan: Partial<CarryPlan>, gap: SignalInput['gap'] = null): SignalInput => ({
      ...signalInput,
      days,
      gap,
      plan: { carries: [], drops: [], held: [], alreadyCarried: [], ...plan },
    });
    const gap = { firstDate: '2026-09-20', lastDate: '2026-09-22', length: 3, taskIds: [] };

    expect(buildSignals(input({ alreadyCarried: [carried], drops: [drop], held: [held] }, gap)).notice).toBe('gentle_return');
    expect(buildSignals(input({ alreadyCarried: [carried], drops: [drop], held: [held] })).notice).toBe('swap_offer');
    expect(buildSignals(input({ alreadyCarried: [carried], drops: [drop] })).notice).toBe('carried');
    expect(buildSignals(input({ drops: [drop] })).notice).toBe('dropped');
    expect(buildSignals(input({})).notice).toBeNull();
  });
});

describe('signals: rest days (AC-5)', () => {
  it('never pick a carried or dropped line on a rest day, and never describe a rest day', () => {
    // Wed carried onto Fri; today is Thu (rest), while the carry still concerns today.
    const first = reconcileAt(rows({ mon: { status: 'completed' }, tue: { status: 'completed' } }), '2026-09-24T02:00:00Z');
    const stored = afterWriting(rows({ mon: { status: 'completed' }, tue: { status: 'completed' } }), first.plan);
    const thu = reconcileAt(stored, '2026-09-24T10:00:00Z');
    expect(thu.signals.carried.map((c) => c.toTaskId)).toEqual(['fri']);
    expect(thu.signals.notice).toBeNull();

    const highLoadWed = rows({ mon: { status: 'completed' }, tue: { status: 'completed' }, wed: { detailedSteps: steps('wed', { highLoad: true }) } });
    const restDrop = reconcileAt(highLoadWed, '2026-09-24T10:00:00Z');
    expect(restDrop.signals.dropped.map((d) => d.taskId)).toEqual(['wed']);
    expect(restDrop.signals.notice).toBeNull();

    for (const s of [thu.signals, restDrop.signals]) {
      for (const id of [...s.carried.flatMap((c) => [c.fromTaskId, c.toTaskId]), ...s.dropped.map((d) => d.taskId)]) {
        expect(['thu', 'sun']).not.toContain(id);
      }
    }
  });
});
