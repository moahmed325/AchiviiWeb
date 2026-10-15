/**
 * Missed sessions: the reconcile core shared by `POST /api/goal/reconcile` and the M2.4 actions
 * (mark missed, swap, carry now). Load the active goal, classify, plan the carries, write them behind the ND-15
 * switch, build the signals. The overrides let an action plan one open task as missed (mark today missed) or a
 * held key session as an ordinary day (carry now) without storing anything about it (ND-2, ND-14).
 */
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { getZonedDateString } from './timezone.js';
import { buildReconcileResult, findOpenGap, type DayClassification, type ReconcileResult } from './missedSessions.js';
import { handledTaskIds, markerOf, parseStoredSteps, type CarriedStep, type CarryTask, type HeldCarry, type PlannedCarry } from './carryForward.js';
import { buildSignals, type MissedSignals } from './missedSignals.js';
import { readRoutine } from './planV2.js';
import { planRecovery, type PlannedContinue, type PlannedEasyStart, type PlannedReorder, type RecoveryPlan } from './recovery/carry.js';
import { describeDay, type DayText } from './recovery/dayText.js';
import { followsMethod, originOf } from './recovery/inOrder.js';
import { readRecoveryProfile, type RecoveryProfile } from './recovery/profile.js';
import { markerRefusal, methodSwapRefusal, type SwapRefusal } from './recovery/swap.js';
import { methodRecoveryEnabled } from './recovery/switch.js';

/**
 * The fields reconcile reads (as in M2.2). With METHOD_RECOVERY_ENABLED on, `loadReconcileGoal` also reads
 * `roadmap` for the recovery profile (M3.1a); with it off the query is exactly this.
 */
export const RECONCILE_GOAL_SELECT = {
  id: true,
  planVersion: true,
  routine: true,
  rawGoal: true,
  clarifiedOutcome: true,
  dailyTasks: {
    select: {
      id: true,
      date: true,
      weekNumber: true,
      dayNumber: true,
      status: true,
      isRestDay: true,
      isKeySession: true,
      isTestDay: true,
      detailedSteps: true,
      durationMinutes: true,
    },
    orderBy: { dayNumber: 'asc' },
  },
} satisfies Prisma.GoalSelect;

/**
 * With METHOD_RECOVERY_ENABLED on, each day's text is loaded too, so a reordered day's title and 10-minute version can
 * follow its new priority-1 step (M3.1d review).
 */
const METHOD_DAY_TEXT = { title: true, minimumVersion: true, implementationIntention: true, whyToday: true } as const;

/** `roadmap` and the days' text are present only when they were loaded (the method switch was on). */
export type ReconcileGoal = Omit<Prisma.GoalGetPayload<{ select: typeof RECONCILE_GOAL_SELECT }>, 'dailyTasks'> & {
  dailyTasks: Array<Prisma.GoalGetPayload<{ select: typeof RECONCILE_GOAL_SELECT }>['dailyTasks'][number] & DayText>;
  roadmap?: Prisma.JsonValue;
};

export interface ReconcileUser {
  id: string;
  timezone?: string | null;
}

/** ND-15: carry writes, and every M2.4 action, only when this is exactly 'true'. Read per request. */
export function carryEnabled(): boolean {
  return process.env.MISSED_SESSIONS_CARRY_ENABLED === 'true';
}

/** Method-aware recovery's switch (M3.1a); its own module since M3.1d, re-exported here for its callers. */
export { methodRecoveryEnabled };

export function loadReconcileGoal(userId: string): Promise<ReconcileGoal | null> {
  const where = { userId, status: 'active' };
  if (methodRecoveryEnabled()) {
    const dailyTasks = { ...RECONCILE_GOAL_SELECT.dailyTasks, select: { ...RECONCILE_GOAL_SELECT.dailyTasks.select, ...METHOD_DAY_TEXT } };
    return prisma.goal.findFirst({ where, select: { ...RECONCILE_GOAL_SELECT, dailyTasks, roadmap: true } });
  }
  return prisma.goal.findFirst({ where, select: RECONCILE_GOAL_SELECT });
}

export interface ReconcileOverrides {
  /** Plan this task as missed if it is still open (mark today missed). */
  asMissed?: string;
  /** Plan this task as an ordinary day, not a key session (carry now: no swap). */
  asNotKey?: string;
}

export interface Evaluation {
  goal: ReconcileGoal;
  /** The result as reported: classification (with `asMissed` applied) and gap. */
  result: Extract<ReconcileResult, { applies: true }>;
  tasks: CarryTask[];
  plan: RecoveryPlan;
  now: Date;
  today: string;
  sleepTime: unknown;
  /** The overrides this evaluation was made with. */
  overrides: ReconcileOverrides;
  /** Present only when METHOD_RECOVERY_ENABLED was on: the goal's profile, null when missing or invalid (RULE-18). */
  method?: { profile: RecoveryProfile | null };
}

/**
 * Pure given the loaded goal, `now` and the method switch: classification, overrides, gap and the carry plan.
 * With METHOD_RECOVERY_ENABLED off the plan is exactly missed sessions' (`planCarries`).
 */
export function evaluate(
  goal: ReconcileGoal | null,
  user: ReconcileUser,
  now: Date,
  overrides: ReconcileOverrides = {}
): { applies: false; result: ReconcileResult } | ({ applies: true } & Evaluation) {
  const sleepTime = goal ? readRoutine(goal).sleepTime : undefined;
  const base = buildReconcileResult(goal, { now, timezone: user.timezone, sleepTime });
  if (!base.applies || !goal) return { applies: false, result: base };

  const today = getZonedDateString(now, base.timezone);
  let days: DayClassification[] = base.days;
  let gap = base.gap;
  if (overrides.asMissed) {
    days = days.map((day) => (day.taskId === overrides.asMissed && day.kind === 'planned' ? { ...day, kind: 'missed' } : day));
    gap = findOpenGap(days);
  }
  const planDays = overrides.asNotKey
    ? days.map((day) => (day.taskId === overrides.asNotKey ? { ...day, isKeySession: false } : day))
    : days;
  const tasks: CarryTask[] = goal.dailyTasks.map((task) => ({ ...task, steps: parseStoredSteps(task.detailedSteps) }));
  const method = methodRecoveryEnabled() ? { profile: readRecoveryProfile(goal.roadmap) } : undefined;
  const plan = planRecovery({ days: planDays, gap, tasks, goal, today, timezone: base.timezone, sleepTime, ...(method ? { method } : {}) });
  return { applies: true, goal, result: { ...base, days, gap }, tasks, plan, now, today, sleepTime, overrides, ...(method ? { method } : {}) };
}

/**
 * Why two days may not be swapped as an open swap (not an offer answer). Missed sessions' checks first, in the swap
 * route's order (ND-18); then, in any switch state, a day holding a reorder's step or a continue marker (M3.2); then,
 * with METHOD_RECOVERY_ENABLED on, RULE-12 to RULE-14 (`methodSwapRefusal`).
 */
export type OpenSwapRefusal = 'rest_day' | 'test_day' | 'completed' | 'not_open' | 'holds_carry' | 'already_handled' | SwapRefusal;

/** M3.2: the one check behind the swap route's open swap and `carry.choices.today.swapWith`. */
export function openSwapRefusal(evaluation: Evaluation, aId: string, bId: string): OpenSwapRefusal | null {
  const handled = handledTaskIds(evaluation.tasks);
  const kindOf = new Map(evaluation.result.days.map((day) => [day.taskId, day.kind]));
  const taskOf = new Map(evaluation.goal.dailyTasks.map((task) => [task.id, task]));
  const stepsOf = new Map(evaluation.tasks.map((task) => [task.id, task.steps]));
  for (const id of [aId, bId]) {
    const day = taskOf.get(id);
    if (!day) return 'not_open';
    if (day.isRestDay) return 'rest_day';
    if (day.isTestDay) return 'test_day';
    if (day.status === 'completed') return 'completed';
    if (kindOf.get(id) !== 'planned' || day.date < evaluation.today) return 'not_open';
    const steps = stepsOf.get(id) ?? [];
    if (steps.some((step) => markerOf(step) !== null)) return 'holds_carry';
    const marker = markerRefusal(steps);
    if (marker) return marker;
    if (handled.has(id)) return 'already_handled';
  }
  return methodRefusal(evaluation, aId, bId);
}

/** M3.2: RULE-12 to RULE-14 for any pair, only when the method switch was on for this evaluation. */
export function methodRefusal(evaluation: Evaluation, aId: string, bId: string): SwapRefusal | null {
  if (!evaluation.method) return null;
  const week = { days: evaluation.result.days, tasks: evaluation.tasks, profile: evaluation.method.profile, goal: evaluation.goal };
  return methodSwapRefusal(week, aId, bId);
}

/**
 * RULE-16 (M3.2): where "move now" puts a held key session's step, from an evaluation made with `asNotKey` for it: the
 * day its carry lands on, or, for a step of an in-order move kind, the session a reorder gives it. Null when its
 * priority-1 step does not move.
 */
export function moveNowTarget(evaluation: Evaluation, taskId: string): string | null {
  const carry = evaluation.plan.carries.find((item) => item.fromTaskId === taskId);
  if (carry) return carry.toTaskId;
  const task = evaluation.tasks.find((item) => item.id === taskId);
  const top = [...(task?.steps ?? [])]
    .filter((step) => typeof step.priority === 'number' && markerOf(step) === null)
    .sort((a, b) => (a.priority as number) - (b.priority as number))[0];
  if (!task || !top) return null;
  const origin = originOf(top, { taskId: task.id, date: task.date });
  for (const reorder of evaluation.plan.reorders ?? []) {
    if (reorder.kind !== top.kind) continue;
    const session = reorder.sessions.find(
      (item) => item.changed && item.taskId !== taskId && item.holds?.taskId === origin.taskId && item.holds.title === top.title
    );
    if (session) return session.taskId;
  }
  return null;
}

/**
 * RULE-16 (M3.2): what the person may do, sent in the reconcile body with METHOD_RECOVERY_ENABLED on. M3.3 reads it
 * instead of working the choices out on screen. Every entry is checked by the same functions the routes use.
 */
export interface PlanChoices {
  /** Today's open practice day, or null (no day today, a rest day, or done). */
  today: {
    taskId: string;
    /** "Set today aside": not when today is already handled or set aside. */
    setAside: boolean;
    /** The open practice days later this week that today may swap with (`openSwapRefusal`); none once set aside. */
    swapWith: string[];
  } | null;
  /** Each key session held for its swap offer (ND-9, RULE-16). */
  held: Array<{
    taskId: string;
    receivingTaskId: string;
    /** Where "move now" (carry-now) puts its step, or null when it would not move: carry-now then refuses for a day
     * that follows the new rules (`followsNewRules`); a day under RULE-18 keeps today's carry-now. */
    moveNowTaskId: string | null;
  }>;
}

/**
 * M3.2 review: the day follows the new rules (a valid profile, every step with a priority and a known kind; RULE-18).
 * Only such a held day can be refused `would_not_move`; a day under missed sessions' rules keeps today's carry-now.
 */
export function followsNewRules(evaluation: Evaluation, taskId: string): boolean {
  const profile = evaluation.method?.profile;
  const task = evaluation.tasks.find((item) => item.id === taskId);
  return !!profile && !!task && followsMethod(task.steps, profile);
}

/**
 * `evaluation` is the plan as stored after this run's writes; `heldOffers` is the hold of the body's own plan, so the choices
 * list exactly the body's `carry.held` (and its swap offer) even when a write would change the hold for the next
 * request. Each offer's move-now day and today's swap days are read from `evaluation`, as the routes will read them.
 */
export function planChoices(evaluation: Evaluation, user: ReconcileUser, heldOffers: readonly HeldCarry[] = evaluation.plan.held): PlanChoices {
  const { goal, today, now, overrides } = evaluation;
  const handled = handledTaskIds(evaluation.tasks);
  const kindOf = new Map(evaluation.result.days.map((day) => [day.taskId, day.kind]));
  const task = goal.dailyTasks.find((item) => item.date === today);
  let todayChoices: PlanChoices['today'] = null;
  if (task && !task.isRestDay && task.status !== 'completed') {
    const setAside = kindOf.get(task.id) === 'planned' && !handled.has(task.id);
    const swapWith = setAside
      ? goal.dailyTasks
          .filter((day) => day.weekNumber === task.weekNumber && day.date > today)
          .filter((day) => openSwapRefusal(evaluation, task.id, day.id) === null)
          .map((day) => day.id)
      : [];
    todayChoices = { taskId: task.id, setAside, swapWith };
  }
  const held = heldOffers.map((item) => {
    const moving = evaluate(goal, user, now, { ...overrides, asNotKey: item.taskId });
    return { taskId: item.taskId, receivingTaskId: item.receivingTaskId, moveNowTaskId: moving.applies ? moveNowTarget(moving, item.taskId) : null };
  });
  return { today: todayChoices, held };
}

/** Thrown inside the reorder transaction when one day's guard fails, so every reordered day rolls back. */
class ReorderGuardLost extends Error {}

export interface WrittenRecovery {
  written: PlannedCarry[];
  writtenContinues: PlannedContinue[];
  /** RULE-20: the reorders whose days were stored (all of this run's, or none). */
  writtenReorders: PlannedReorder[];
  /** RULE-21: the easy line, when it was stored. */
  writtenEasyStart: PlannedEasyStart | null;
}

/**
 * ND-13: one compare-and-set per changed day; only `count === 1` is written. A lost race is skipped, not retried.
 * Every entry of the plan for one day carries that day's whole new row, so a carry, a continue marker (RULE-10), a
 * reorder (RULE-20) and the easy line (RULE-21) on the same day share its one write. Every day of this run's
 * reorders (and anything else landing on those days) is written in one transaction, each day guarded the same way;
 * if any guard fails, none of them is written.
 */
export async function writeRecovery(goal: ReconcileGoal, plan: RecoveryPlan): Promise<WrittenRecovery> {
  const stored = new Map(goal.dailyTasks.map((task) => [task.id, task]));
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of plan.carries) rows.set(carry.toTaskId, { steps: carry.steps, durationMinutes: carry.durationMinutes });
  for (const reorder of plan.reorders ?? []) for (const row of reorder.rows) rows.set(row.taskId, row);
  for (const item of plan.continues ?? []) rows.set(item.toTaskId, { steps: item.steps, durationMinutes: item.durationMinutes });
  if (plan.easyStart) rows.set(plan.easyStart.taskId, { steps: plan.easyStart.steps, durationMinutes: plan.easyStart.durationMinutes });
  const reorderDays = new Set((plan.reorders ?? []).flatMap((reorder) => reorder.rows.map((row) => row.taskId)));
  const guarded = (taskId: string) => {
    const receiving = stored.get(taskId)!;
    const row = rows.get(taskId)!;
    // A reordered day whose priority-1 step changed describes its new step (M3.1d review).
    const text = reorderDays.has(taskId) ? describeDay(receiving, parseStoredSteps(receiving.detailedSteps), row.steps) : null;
    return {
      where: { id: receiving.id, goalId: goal.id, status: receiving.status, detailedSteps: receiving.detailedSteps },
      data: {
        detailedSteps: JSON.stringify(row.steps),
        durationMinutes: row.durationMinutes,
        ...(text
          ? {
              title: text.title,
              minimumVersion: text.minimumVersion as unknown as Prisma.InputJsonValue,
              ...(text.implementationIntention !== undefined ? { implementationIntention: text.implementationIntention } : {}),
              ...(text.whyToday !== undefined ? { whyToday: text.whyToday || null } : {}),
            }
          : {}),
      },
    };
  };

  const done = new Set<string>();
  if (reorderDays.size > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const taskId of reorderDays) {
          const { count } = await tx.dailyTask.updateMany(guarded(taskId));
          if (count !== 1) throw new ReorderGuardLost();
        }
      });
      for (const taskId of reorderDays) done.add(taskId);
    } catch (error) {
      if (!(error instanceof ReorderGuardLost)) throw error;
    }
  }
  for (const taskId of rows.keys()) {
    if (reorderDays.has(taskId)) continue;
    const { count } = await prisma.dailyTask.updateMany(guarded(taskId));
    if (count === 1) done.add(taskId);
  }
  const reordersStored = reorderDays.size > 0 && [...reorderDays].every((taskId) => done.has(taskId));
  return {
    written: plan.carries.filter((carry) => done.has(carry.toTaskId)),
    writtenContinues: (plan.continues ?? []).filter((item) => done.has(item.toTaskId)),
    writtenReorders: reordersStored ? (plan.reorders ?? []).filter((reorder) => reorder.rows.length > 0) : [],
    writtenEasyStart: plan.easyStart && done.has(plan.easyStart.taskId) ? plan.easyStart : null,
  };
}

/** The carries `writeRecovery` stored. */
export async function writeCarries(goal: ReconcileGoal, plan: RecoveryPlan): Promise<PlannedCarry[]> {
  return (await writeRecovery(goal, plan)).written;
}

export type ReconcileBody =
  | Extract<ReconcileResult, { applies: false }>
  | (Extract<ReconcileResult, { applies: true }> & {
      /**
       * With METHOD_RECOVERY_ENABLED on, also `outcomes`, `continues`, `alreadyContinued`, `reorders`, `easyStart`
       * and what was stored of them: `writtenContinues`, `writtenReorders`, `writtenEasyStart`; and `choices` (M3.2),
       * worked out from the plan as stored after this run's writes.
       */
      carry: RecoveryPlan & { enabled: boolean; written: PlannedCarry[]; choices?: PlanChoices } & Partial<Omit<WrittenRecovery, 'written'>>;
      signals: MissedSignals;
    });

/**
 * M3.2: the evaluation as the next request will see it: this one when nothing was stored, otherwise the goal re-read
 * with the stored rows (same overrides), so `carry.choices` agree with what the routes will check.
 */
function afterWrites(evaluation: Evaluation, user: ReconcileUser, stored: WrittenRecovery): Evaluation {
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of stored.written) rows.set(carry.toTaskId, carry);
  for (const reorder of stored.writtenReorders) for (const row of reorder.rows) rows.set(row.taskId, row);
  for (const item of stored.writtenContinues) rows.set(item.toTaskId, item);
  if (stored.writtenEasyStart) rows.set(stored.writtenEasyStart.taskId, stored.writtenEasyStart);
  if (rows.size === 0) return evaluation;
  const goal: ReconcileGoal = {
    ...evaluation.goal,
    dailyTasks: evaluation.goal.dailyTasks.map((task) => {
      const row = rows.get(task.id);
      return row ? { ...task, detailedSteps: JSON.stringify(row.steps), durationMinutes: row.durationMinutes } : task;
    }),
  };
  const again = evaluate(goal, user, evaluation.now, evaluation.overrides);
  return again.applies ? again : evaluation;
}

/** M3.2 review: with the carry switch off every action answers `carry_disabled`, so nothing is offered. */
const NO_CHOICES: PlanChoices = { today: null, held: [] };

/** Classify, plan, write behind the switch, and build the reconcile body. */
export async function runReconcile(
  goal: ReconcileGoal | null,
  user: ReconcileUser,
  now: Date,
  overrides: ReconcileOverrides = {},
  /** An evaluation the caller already made with the same goal, `now` and overrides (carry-now). */
  evaluated?: ReturnType<typeof evaluate>
): Promise<ReconcileBody> {
  const evaluation = evaluated ?? evaluate(goal, user, now, overrides);
  if (!evaluation.applies) return evaluation.result as Extract<ReconcileResult, { applies: false }>;
  const { result, plan, today, sleepTime } = evaluation;

  const enabled = carryEnabled();
  const stored: WrittenRecovery = enabled
    ? await writeRecovery(evaluation.goal, plan)
    : { written: [], writtenContinues: [], writtenReorders: [], writtenEasyStart: null };
  const { written, ...writtenMethod } = stored;
  // M2.3: derived signals for P3 (ND-16); only stored carries count as moved.
  const signals = buildSignals({ days: result.days, gap: result.gap, plan, written, now, today, timezone: result.timezone, sleepTime });
  // The method fields appear only when the method switch is on, so with it off the body is exactly as before.
  const carry = plan.outcomes
    ? { enabled, ...plan, written, ...writtenMethod, choices: enabled ? planChoices(afterWrites(evaluation, user, stored), user, plan.held) : NO_CHOICES }
    : { enabled, ...plan, written };
  return { ...result, carry, signals };
}
