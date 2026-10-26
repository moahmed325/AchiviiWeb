// B-102: the missed-session plan actions (mark missed, carry now, swap) and their refusals, moved out of routes/goal.ts unchanged (a pure move).
import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getAuthUser } from '../auth.js';
import { handledTaskIds, parseStoredSteps, type CarriedStep } from '../../lib/carryForward.js';
import { carryEnabled, evaluate, loadReconcileGoal, followsNewRules, methodRefusal, moveNowTarget, openSwapRefusal, runReconcile, type ReconcileGoal } from '../../lib/reconcileCore.js';
import { doneDayIds, markerRefusal } from '../../lib/recovery/swap.js';
import { easyLineAfterSwap } from '../../lib/recovery/easyStart.js';
import type { PastLimitChoice } from '../../lib/weekClose/breaks.js';


export const actionRoutes = Router();


// ---------------------------------------------------------------------------------------------------------------
// Missed sessions M2.4: mark today missed, swap two days, carry now (ND-9, ND-14, ND-17, ND-18).
// Every action writes only when MISSED_SESSIONS_CARRY_ENABLED is 'true' (ND-15); otherwise 409 carry_disabled.
// Each answers with the reconcile body, so the client refreshes in one round trip.

export type ActionReason =
  | 'not_today'
  | 'not_yet'
  | 'week_not_over'
  | 'rest_day'
  | 'completed'
  | 'already_handled'
  | 'not_held'
  | 'not_same_week'
  | 'not_open'
  | 'test_day'
  | 'holds_carry'
  | 'past_due'
  | 'changed'
  | 'not_plan_v2'
  | 'carry_disabled'
  | 'week_closed'
  | 'goal_not_active'
  | 'holds_continue'
  | 'fixed_step'
  | 'out_of_order'
  | 'rest_gap'
  | 'would_not_move'
  | 'week_not_open'
  | 'week_close_disabled'
  | 'not_auto_closed'
  | 'reflection_saved'
  | 'choice_needed'
  | 'weekly_update_disabled'
  | 'no_daily_time_check'
  | 'no_checkpoint';

export const ACTION_ERRORS: Record<ActionReason, string> = {
  not_today: 'This can only be done for today.',
  // Ahead days: a day can be completed from its own date on, and a week reviewed from its last day on.
  not_yet: "This day hasn't started yet.",
  week_not_over: 'This week can be reviewed from its last day.',
  rest_day: 'Rest days cannot be changed this way.',
  completed: 'This day is already done.',
  already_handled: 'This day has already been changed.',
  not_held: 'There is no open swap offer for this day.',
  not_same_week: 'Both days must be in the same week.',
  not_open: 'Both days must still be open.',
  test_day: 'The test day cannot be swapped.',
  holds_carry: 'A day that already received a moved step cannot be swapped.',
  past_due: 'That step is due before then, so it cannot move there.',
  changed: 'The plan changed. Reload and try again.',
  not_plan_v2: 'This plan does not support this action.',
  carry_disabled: 'This action is not available yet.',
  week_closed: 'This week has already been reviewed.',
  goal_not_active: 'This goal is no longer active.',
  // M3.2 (RULE-10, RULE-12 to RULE-14, RULE-16). No screen shows these yet.
  holds_continue: 'A day that picks up where another day stopped cannot be swapped.',
  fixed_step: 'A day with a fixed step cannot be swapped.',
  out_of_order: 'This swap would put steps out of order.',
  rest_gap: 'This swap would put two hard sessions too close together.',
  would_not_move: 'This step cannot be moved this week.',
  // B-68: a test result for a week that is still pending.
  week_not_open: "That week hasn't started yet.",
  // Weekly update M1.2b (WU-28, WU-31): the close's line and a late reflection.
  week_close_disabled: 'This action is not available yet.',
  not_auto_closed: 'This week did not close on its own.',
  reflection_saved: 'This week already has a reflection.',
  // Weekly update M1.5b (WU-38 (1)): a break past the limit waits for the person's choice on Today.
  choice_needed: 'Choose how to continue on Today first.',
  // Weekly update M3.3b (WU-58 (4)): the daily-time answer.
  weekly_update_disabled: 'This action is not available yet.',
  no_daily_time_check: 'There is no daily-time question to answer.',
  // Checkpoints (section 7): no open offer for that week, or "accept" on a line-only one.
  no_checkpoint: 'There is no checkpoint to answer.',
};

export function refuse(res: Response, reason: ActionReason): void {
  res.status(409).json({ error: ACTION_ERRORS[reason], reason });
}

/** M1.5b (WU-38 (1)): 409 `choice_needed`, naming the choice the card offers. */
export function refuseChoice(res: Response, choice: PastLimitChoice): void {
  res.status(409).json({ error: ACTION_ERRORS.choice_needed, reason: 'choice_needed', choice });
}

export const isChoice = (value: unknown): value is PastLimitChoice => value === 'keep_going' || value === 'final_week';

export async function actionUser(req: Request, res: Response) {
  const user = await getAuthUser(req);
  if (!user) res.status(401).json({ error: 'Unauthorized.' });
  return user;
}

/** 404 (not a task of the user's active goal), then not_plan_v2 and carry_disabled. Null when answered. */
export async function actionGoal(res: Response, user: { id: string }, taskIds: string[]) {
  const goal = await loadReconcileGoal(user.id);
  const tasks = taskIds.map((id) => goal?.dailyTasks.find((task) => task.id === id));
  if (!goal || tasks.some((task) => !task)) {
    res.status(404).json({ error: 'Task not found.' });
    return null;
  }
  if (goal.planVersion !== 2) {
    refuse(res, 'not_plan_v2');
    return null;
  }
  if (!carryEnabled()) {
    refuse(res, 'carry_disabled');
    return null;
  }
  return { goal, tasks: tasks as ReconcileGoal['dailyTasks'] };
}


/**
 * POST /api/goal/tasks/:taskId/mark-missed
 * Plans today's open practice day as missed, so the M2.2 rules apply unchanged: carried (one guarded write),
 * held for a swap offer (key session), or dropped. A hold or a drop stores nothing (ND-14); never a status.
 */
actionRoutes.post('/tasks/:taskId/mark-missed', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    const loaded = await actionGoal(res, user, [req.params.taskId]);
    if (!loaded) return;
    const { goal, tasks: [task] } = loaded;

    const now = new Date();
    const evaluation = evaluate(goal, user, now);
    if (!evaluation.applies) return refuse(res, 'not_plan_v2');
    if (task.date !== evaluation.today) return refuse(res, 'not_today');
    if (task.isRestDay) return refuse(res, 'rest_day');
    if (task.status === 'completed') return refuse(res, 'completed');
    if (handledTaskIds(evaluation.tasks).has(task.id)) return refuse(res, 'already_handled');

    res.json(await runReconcile(goal, user, now, { asMissed: task.id }));
  } catch (err: any) {
    console.error('[GoalRouter] Mark missed error:', err);
    res.status(500).json({ error: 'Failed to update the plan.' });
  }
});

/**
 * POST /api/goal/tasks/:taskId/carry-now
 * The "no swap, just move the main step" answer to a held key session: carried exactly as M2.2 carries an
 * ordinary day (fit rule, high-load, guarded write). Today's own open key session counts as held once marked,
 * so it is planned as missed here too (nothing about the mark is stored).
 */
actionRoutes.post('/tasks/:taskId/carry-now', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    const loaded = await actionGoal(res, user, [req.params.taskId]);
    if (!loaded) return;
    const { goal, tasks: [task] } = loaded;

    const now = new Date();
    const plain = evaluate(goal, user, now);
    if (!plain.applies) return refuse(res, 'not_plan_v2');
    if (handledTaskIds(plain.tasks).has(task.id)) return refuse(res, 'already_handled');
    const isOpenToday = task.date === plain.today && plain.result.days.some((day) => day.taskId === task.id && day.kind === 'planned');
    const overrides = isOpenToday ? { asMissed: task.id } : {};
    const held = evaluate(goal, user, now, overrides);
    if (!held.applies || !held.plan.held.some((item) => item.taskId === task.id)) return refuse(res, 'not_held');
    // M3.2 (RULE-16, MR-21 (2)): with the method switch on, "move now" on a day that follows the new rules is done
    // only when it really moves the step. A day under missed sessions' rules (RULE-18) keeps today's carry-now.
    const moving = evaluate(goal, user, now, { ...overrides, asNotKey: task.id });
    if (!moving.applies) return refuse(res, 'not_plan_v2');
    if (followsNewRules(held, task.id) && moveNowTarget(moving, task.id) === null) return refuse(res, 'would_not_move');

    res.json(await runReconcile(goal, user, now, moving.overrides, moving));
  } catch (err: any) {
    console.error('[GoalRouter] Carry now error:', err);
    res.status(500).json({ error: 'Failed to update the plan.' });
  }
});

/** The `DailyTask` fields that belong to the plan and move in a swap. Date and user fields stay with the day. */
export const SWAP_CONTENT_SELECT = {
  id: true,
  date: true,
  status: true,
  title: true,
  detailedSteps: true,
  implementationIntention: true,
  durationMinutes: true,
  resourceTitle: true,
  resourceUrl: true,
  resourceType: true,
  resourceWhy: true,
  isKeySession: true,
  whyToday: true,
  minimumVersion: true,
} satisfies Prisma.DailyTaskSelect;

export type SwapRow = Prisma.DailyTaskGetPayload<{ select: typeof SWAP_CONTENT_SELECT }>;

export class SwapConflict extends Error {}

/** The content of `from`, as written onto the other day. With a marker, every step that lands gets `swappedFrom`. */
export function swapContent(from: SwapRow, marker: boolean): Prisma.DailyTaskUpdateManyMutationInput {
  let detailedSteps = from.detailedSteps;
  const steps = parseStoredSteps(from.detailedSteps);
  if (marker && steps.length > 0) {
    detailedSteps = JSON.stringify(steps.map((step) => ({ ...step, swappedFrom: { taskId: from.id, date: from.date } })));
  }
  return {
    title: from.title,
    detailedSteps,
    implementationIntention: from.implementationIntention,
    durationMinutes: from.durationMinutes,
    resourceTitle: from.resourceTitle,
    resourceUrl: from.resourceUrl,
    resourceType: from.resourceType,
    resourceWhy: from.resourceWhy,
    isKeySession: from.isKeySession,
    whyToday: from.whyToday,
    minimumVersion: from.minimumVersion === null ? Prisma.DbNull : (from.minimumVersion as Prisma.InputJsonValue),
  };
}

/**
 * POST /api/goal/tasks/:taskId/swap  { withTaskId, expected: { [taskId]: detailedSteps, [withTaskId]: detailedSteps } }
 * Exchanges the plan content of two days of the same week; dates, status and the user's own fields stay.
 * Open swap: two open practice days dated today or later, not the test day, neither holding a moved step.
 * Answering a swap offer (ND-9): `taskId` is a held key session and `withTaskId` its receiving day; the steps that
 * land on both days get `swappedFrom` (ND-18), so nothing is carried back. Both writes are one transaction, each a
 * compare-and-set on `expected` and on status; if either matches no row, nothing is written (409 changed).
 */
actionRoutes.post('/tasks/:taskId/swap', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;
    const taskId = req.params.taskId;
    const { withTaskId, expected } = (req.body ?? {}) as { withTaskId?: unknown; expected?: unknown };
    const expectedMap = expected && typeof expected === 'object' && !Array.isArray(expected) ? (expected as Record<string, unknown>) : null;
    if (
      typeof withTaskId !== 'string' ||
      !withTaskId ||
      withTaskId === taskId ||
      !expectedMap ||
      typeof expectedMap[taskId] !== 'string' ||
      typeof expectedMap[withTaskId] !== 'string'
    ) {
      res.status(400).json({ error: 'Send withTaskId and the expected steps of both days.' });
      return;
    }
    const loaded = await actionGoal(res, user, [taskId, withTaskId]);
    if (!loaded) return;
    const { goal, tasks: [a, b] } = loaded;
    if (a.weekNumber !== b.weekNumber) return refuse(res, 'not_same_week');

    const now = new Date();
    const evaluation = evaluate(goal, user, now);
    if (!evaluation.applies) return refuse(res, 'not_plan_v2');
    const offer = evaluation.plan.held.some((held) => held.taskId === a.id && held.receivingTaskId === b.id);

    // M3.2: one check for the route and `carry.choices`. A day holding a reorder's step or a continue marker is refused
    // in any switch state; with the method switch on, so is any pair that breaks RULE-12 to RULE-14.
    if (!offer) {
      const refusal = openSwapRefusal(evaluation, a.id, b.id);
      if (refusal) return refuse(res, refusal);
    } else {
      const stepsOf = new Map(evaluation.tasks.map((task) => [task.id, task.steps]));
      const refusal = markerRefusal([stepsOf.get(a.id) ?? [], stepsOf.get(b.id) ?? []], doneDayIds(evaluation.result.days)) ?? methodRefusal(evaluation, a.id, b.id);
      if (refusal) return refuse(res, refusal);
    }
    if (expectedMap[a.id] !== a.detailedSteps || expectedMap[b.id] !== b.detailedSteps) return refuse(res, 'changed');

    const rows = await prisma.dailyTask.findMany({ where: { id: { in: [a.id, b.id] }, goalId: goal.id }, select: SWAP_CONTENT_SELECT });
    const rowA = rows.find((row) => row.id === a.id);
    const rowB = rows.find((row) => row.id === b.id);
    if (!rowA || !rowB) return refuse(res, 'changed');

    const contentA = swapContent(rowB, offer);
    const contentB = swapContent(rowA, offer);
    // B-49 (MR-35 (5)): with the method switch on, RULE-21's easy line follows the swap onto the first hard step back,
    // once. Another open day that loses the line is written in the same transaction, guarded as it was loaded.
    const easyRows = new Map<string, CarriedStep[]>();
    if (evaluation.method) {
      const before = new Map(evaluation.tasks.map((task) => [task.id, task.steps]));
      const after = new Map(before);
      after.set(a.id, parseStoredSteps(contentA.detailedSteps as string | null));
      after.set(b.id, parseStoredSteps(contentB.detailedSteps as string | null));
      const changes = easyLineAfterSwap({
        days: evaluation.result.days,
        gap: evaluation.result.gap,
        today: evaluation.today,
        profile: evaluation.method.profile,
        swapped: [a.id, b.id],
        before,
        after,
      });
      for (const [taskId, steps] of changes) easyRows.set(taskId, steps);
    }
    if (easyRows.has(a.id)) contentA.detailedSteps = JSON.stringify(easyRows.get(a.id));
    if (easyRows.has(b.id)) contentB.detailedSteps = JSON.stringify(easyRows.get(b.id));
    const others = [...easyRows.keys()]
      .filter((taskId) => taskId !== a.id && taskId !== b.id)
      .map((taskId) => goal.dailyTasks.find((task) => task.id === taskId)!);

    try {
      await prisma.$transaction(async (tx) => {
        const writes: Array<[SwapRow, Prisma.DailyTaskUpdateManyMutationInput]> = [
          [rowA, contentA],
          [rowB, contentB],
        ];
        for (const [target, data] of writes) {
          const { count } = await tx.dailyTask.updateMany({
            where: { id: target.id, goalId: goal.id, status: target.status, detailedSteps: expectedMap[target.id] as string },
            data,
          });
          if (count !== 1) throw new SwapConflict();
        }
        for (const other of others) {
          const { count } = await tx.dailyTask.updateMany({
            where: { id: other.id, goalId: goal.id, status: other.status, detailedSteps: other.detailedSteps },
            data: { detailedSteps: JSON.stringify(easyRows.get(other.id)) },
          });
          if (count !== 1) throw new SwapConflict();
        }
      });
    } catch (err) {
      if (err instanceof SwapConflict) return refuse(res, 'changed');
      throw err;
    }

    res.json(await runReconcile(await loadReconcileGoal(user.id), user, new Date()));
  } catch (err: any) {
    console.error('[GoalRouter] Swap error:', err);
    res.status(500).json({ error: 'Failed to update the plan.' });
  }
});
