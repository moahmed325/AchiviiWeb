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
import { parseStoredSteps, type CarriedStep, type CarryTask, type PlannedCarry } from './carryForward.js';
import { buildSignals, type MissedSignals } from './missedSignals.js';
import { readRoutine } from './planV2.js';
import { planRecovery, type PlannedContinue, type RecoveryPlan } from './recovery/carry.js';
import { readRecoveryProfile } from './recovery/profile.js';

/** The fields reconcile reads. Unchanged from M2.2. */
export const RECONCILE_GOAL_SELECT = {
  id: true,
  planVersion: true,
  routine: true,
  rawGoal: true,
  clarifiedOutcome: true,
  /** Method-aware recovery (M3.1a): the profile under `recovery`, read only when METHOD_RECOVERY_ENABLED is on. */
  roadmap: true,
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

export type ReconcileGoal = Prisma.GoalGetPayload<{ select: typeof RECONCILE_GOAL_SELECT }>;

export interface ReconcileUser {
  id: string;
  timezone?: string | null;
}

/** ND-15: carry writes, and every M2.4 action, only when this is exactly 'true'. Read per request. */
export function carryEnabled(): boolean {
  return process.env.MISSED_SESSIONS_CARRY_ENABLED === 'true';
}

/**
 * Method-aware recovery (M3.1a, 03-phases.md section 3): missed days follow their steps' kinds only when this is
 * exactly 'true'. Read per request. Off until M3.3 is live (O2); writes still need `carryEnabled()`.
 */
export function methodRecoveryEnabled(): boolean {
  return process.env.METHOD_RECOVERY_ENABLED === 'true';
}

export function loadReconcileGoal(userId: string): Promise<ReconcileGoal | null> {
  return prisma.goal.findFirst({ where: { userId, status: 'active' }, select: RECONCILE_GOAL_SELECT });
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
  return { applies: true, goal, result: { ...base, days, gap }, tasks, plan, now, today, sleepTime };
}

/**
 * ND-13: one compare-and-set per receiving day; only `count === 1` is written. A lost race is skipped, not retried.
 * A carry and a continue marker (RULE-10) that land on the same day share that day's one write.
 */
export async function writeRecovery(
  goal: ReconcileGoal,
  plan: RecoveryPlan
): Promise<{ written: PlannedCarry[]; writtenContinues: PlannedContinue[] }> {
  const stored = new Map(goal.dailyTasks.map((task) => [task.id, task]));
  const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  for (const carry of plan.carries) rows.set(carry.toTaskId, { steps: carry.steps, durationMinutes: carry.durationMinutes });
  for (const item of plan.continues ?? []) {
    if (!rows.has(item.toTaskId)) rows.set(item.toTaskId, { steps: item.steps, durationMinutes: item.durationMinutes });
  }

  const done = new Set<string>();
  for (const [taskId, row] of rows) {
    const receiving = stored.get(taskId)!;
    const { count } = await prisma.dailyTask.updateMany({
      where: { id: receiving.id, goalId: goal.id, status: receiving.status, detailedSteps: receiving.detailedSteps },
      data: { detailedSteps: JSON.stringify(row.steps), durationMinutes: row.durationMinutes },
    });
    if (count === 1) done.add(taskId);
  }
  return {
    written: plan.carries.filter((carry) => done.has(carry.toTaskId)),
    writtenContinues: (plan.continues ?? []).filter((item) => done.has(item.toTaskId)),
  };
}

/** The carries `writeRecovery` stored. */
export async function writeCarries(goal: ReconcileGoal, plan: RecoveryPlan): Promise<PlannedCarry[]> {
  return (await writeRecovery(goal, plan)).written;
}

export type ReconcileBody =
  | Extract<ReconcileResult, { applies: false }>
  | (Extract<ReconcileResult, { applies: true }> & {
      /** With METHOD_RECOVERY_ENABLED on, also `outcomes`, `continues`, `alreadyContinued` and `writtenContinues`. */
      carry: RecoveryPlan & { enabled: boolean; written: PlannedCarry[]; writtenContinues?: PlannedContinue[] };
      signals: MissedSignals;
    });

/** Classify, plan, write behind the switch, and build the reconcile body. */
export async function runReconcile(
  goal: ReconcileGoal | null,
  user: ReconcileUser,
  now: Date,
  overrides: ReconcileOverrides = {}
): Promise<ReconcileBody> {
  const evaluation = evaluate(goal, user, now, overrides);
  if (!evaluation.applies) return evaluation.result as Extract<ReconcileResult, { applies: false }>;
  const { result, plan, today, sleepTime } = evaluation;

  const enabled = carryEnabled();
  const { written, writtenContinues } = enabled
    ? await writeRecovery(evaluation.goal, plan)
    : { written: [] as PlannedCarry[], writtenContinues: [] as PlannedContinue[] };
  // M2.3: derived signals for P3 (ND-16); only stored carries count as moved.
  const signals = buildSignals({ days: result.days, gap: result.gap, plan, written, now, today, timezone: result.timezone, sleepTime });
  // The method fields appear only when the method switch is on, so with it off the body is exactly as before.
  const carry = plan.outcomes ? { enabled, ...plan, written, writtenContinues } : { enabled, ...plan, written };
  return { ...result, carry, signals };
}
