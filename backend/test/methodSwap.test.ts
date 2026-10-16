import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { evaluate, planChoices, type ReconcileGoal } from '../src/lib/reconcileCore.js';
import type { RecoveryPlan } from '../src/lib/recovery/carry.js';
import { holdRefusal, markerRefusal, methodSwapRefusal } from '../src/lib/recovery/swap.js';
import { closeDays, narrowedSteps, noFixed, orderBreaks, randomWeek, stepsIn, subset, swapped, type Row } from './methodWeeks.js';

// Method-aware recovery M3.2: the swap check (RULE-12 to RULE-14), the hold and move now (RULE-16), and generated
// weeks (AC-6, AC-8): every swap the choices offer keeps fixed steps, order and the rest gap, and every move-now keeps
// order and the rest gap and makes no day longer. Pure: the routes are in methodActions.test.ts.

const METHOD = 'METHOD_RECOVERY_ENABLED';
const user = { id: 'u1', timezone: 'UTC' };
const GOAL = { rawGoal: 'Type 40 words per minute', clarifiedOutcome: 'Type 40 wpm at 95% accuracy' };

function goalOf(week: ReturnType<typeof randomWeek>, rows: Row[] = week.rows): ReconcileGoal {
  return {
    id: 'g1',
    planVersion: 2,
    routine: JSON.stringify({ sleepTime: '23:00' }),
    ...GOAL,
    roadmap: { recovery: week.profile },
    dailyTasks: rows.map((row) => ({ ...row, title: row.id, minimumVersion: null, implementationIntention: null, whyToday: null })),
  } as unknown as ReconcileGoal;
}

/** The rows a plan stores (every entry for a day carries its final row). */
function stored(rows: readonly Row[], plan: RecoveryPlan): Row[] {
  const next = new Map<string, { steps: unknown[]; durationMinutes: number }>();
  for (const carry of plan.carries) next.set(carry.toTaskId, carry);
  for (const reorder of plan.reorders ?? []) for (const row of reorder.rows) next.set(row.taskId, row);
  for (const item of plan.continues ?? []) next.set(item.toTaskId, item);
  if (plan.easyStart) next.set(plan.easyStart.taskId, plan.easyStart);
  return rows.map((row) => (next.has(row.id) ? { ...row, detailedSteps: JSON.stringify(next.get(row.id)!.steps), durationMinutes: next.get(row.id)!.durationMinutes } : row));
}

describe('the swap check', () => {
  const saved = process.env[METHOD];
  beforeAll(() => {
    process.env[METHOD] = 'true';
  });
  afterAll(() => {
    if (saved === undefined) delete process.env[METHOD];
    else process.env[METHOD] = saved;
  });

  it('markers: a reorder step is holds_carry, a continue marker holds_continue, a carried step is left to the route', () => {
    const at = { taskId: 'x', date: '2026-09-20' };
    expect(markerRefusal([[{ title: 'a', shiftedFrom: { ...at, replaced: [] } } as never]])).toBe('holds_carry');
    expect(markerRefusal([[], [{ title: 'a', continueFrom: at } as never]])).toBe('holds_continue');
    expect(markerRefusal([[{ title: 'a', carriedFrom: { ...at, replaced: [] } } as never]])).toBeNull();
  });

  it('B-50: a continue marker whose day is done does not hold the day; a reorder step still does', () => {
    const at = { taskId: 'x', date: '2026-09-20' };
    expect(markerRefusal([[{ title: 'a', continueFrom: at } as never]], new Set(['x']))).toBeNull();
    expect(markerRefusal([[{ title: 'a', continueFrom: at } as never]], new Set(['y']))).toBe('holds_continue');
    expect(markerRefusal([[{ title: 'a', shiftedFrom: { ...at, replaced: [] } } as never]], new Set(['x']))).toBe('holds_carry');
  });

  it('without a profile only missed sessions\' checks apply', () => {
    const week = randomWeek(1);
    const days = evaluate(goalOf(week), user, week.now);
    if (!days.applies) throw new Error('expected a plan v2 goal');
    expect(methodSwapRefusal({ days: days.result.days, tasks: days.tasks, profile: null, goal: GOAL }, '2-mon', '2-fri')).toBeNull();
    expect(holdRefusal({ days: days.result.days, tasks: days.tasks, profile: null, goal: GOAL }, '2-mon', '2-fri')).toBeNull();
  });

  describe('generated weeks (AC-6, AC-8)', () => {
    const SEEDS = Array.from({ length: 400 }, (_, i) => i + 1);
    let offered = 0;
    let moves = 0;
    let refusedMoves = 0;

    it('every swap the choices offer keeps fixed steps, order and the rest gap; every pair left out fails one of them or a route check', () => {
      for (const seed of SEEDS) {
        const week = randomWeek(seed);
        const evaluation = evaluate(goalOf(week), user, week.now);
        if (!evaluation.applies) throw new Error(`seed ${seed}: not plan v2`);
        const choices = planChoices(evaluation, user);
        const today = choices.today;
        if (!today) continue;
        const candidates = week.rows.filter((row) => row.weekNumber === 2 && row.date > week.today);
        for (const other of candidates) {
          const after = swapped(week.rows, today.taskId, other.id);
          const a = week.rows.find((row) => row.id === today.taskId)!;
          const keeps =
            noFixed(a, other) &&
            subset(orderBreaks(after), orderBreaks(week.rows)).length === 0 &&
            narrowedSteps(week.rows, after, week.profile, week.today).length === 0;
          const open = today.setAside && !other.isRestDay && !other.isTestDay && other.status !== 'completed' && !a.isTestDay;
          if (today.swapWith.includes(other.id)) {
            offered += 1;
            expect(keeps, `seed ${seed}: ${today.taskId} with ${other.id} was offered but breaks a rule`).toBe(true);
          } else if (open && keeps) {
            // Left out although it keeps every rule: only a stored marker may explain it.
            const markers = [...stepsIn(a), ...stepsIn(other)].some((s) => s.carriedFrom || s.shiftedFrom || s.continueFrom || s.swappedFrom);
            expect(markers, `seed ${seed}: ${today.taskId} with ${other.id} keeps every rule but was not offered`).toBe(true);
          }
        }
      }
      expect(offered).toBeGreaterThan(50);
    });

    it('every move-now keeps order and the rest gap and makes no day longer; a refused one moves nothing', () => {
      for (const seed of SEEDS) {
        const week = randomWeek(seed);
        const evaluation = evaluate(goalOf(week), user, week.now);
        if (!evaluation.applies) continue;
        for (const held of planChoices(evaluation, user).held) {
          const moving = evaluate(goalOf(week), user, week.now, { asNotKey: held.taskId });
          if (!moving.applies) throw new Error(`seed ${seed}: not plan v2`);
          // The held step is the day's main (priority-1) step; a lower step moving does not make it a move-now.
          const main = stepsIn(week.rows.find((row) => row.id === held.taskId)!).find((s) => s.priority === 1)!;
          const moved =
            moving.plan.carries.some((c) => c.fromTaskId === held.taskId && c.step.title === main.title) ||
            (moving.plan.reorders ?? []).some((r) => r.sessions.some((s) => s.changed && s.taskId !== held.taskId && s.holds?.taskId === held.taskId && s.holds.title === main.title));
          if (held.moveNowTaskId === null) {
            refusedMoves += 1;
            expect(moved, `seed ${seed}: ${held.taskId} moves but move now was not offered`).toBe(false);
            continue;
          }
          moves += 1;
          const after = stored(week.rows, moving.plan);
          expect(after.find((row) => row.id === held.moveNowTaskId)!.detailedSteps).not.toBe(week.rows.find((row) => row.id === held.moveNowTaskId)!.detailedSteps);
          for (const row of after) {
            const before = week.rows.find((x) => x.id === row.id)!;
            const minutes = (r: Row) => stepsIn(r).reduce((sum, s) => sum + s.durationMinutes, 0);
            expect(minutes(row), `seed ${seed}: ${row.id} got longer`).toBeLessThanOrEqual(minutes(before));
            expect(row.durationMinutes).toBeLessThanOrEqual(before.durationMinutes);
          }
          expect(subset(orderBreaks(after), orderBreaks(week.rows)), `seed ${seed}: order`).toEqual([]);
          expect(subset(closeDays(after, week.profile, week.today), closeDays(week.rows, week.profile, week.today)), `seed ${seed}: rest gap`).toEqual([]);
        }
      }
      expect(moves).toBeGreaterThan(10);
      expect(refusedMoves).toBeGreaterThan(0);
    });
  });
});
