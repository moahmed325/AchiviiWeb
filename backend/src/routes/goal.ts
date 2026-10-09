import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { normalizeTimezone, resolveGoalStart } from '../lib/timezone.js';
import { handledTaskIds, parseStoredSteps, type CarriedStep } from '../lib/carryForward.js';
import { carryEnabled, evaluate, loadReconcileGoal, runReconcile, type ReconcileGoal } from '../lib/reconcileCore.js';
import { authorizeNewCustomGoal } from '../lib/billing/goalAuthorization.js';
import { clarifyGoalWithAI, UserRoutineInput } from '../lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../lib/ai/presets/index.js';
import { isHighLoadGoal } from '../lib/highLoad.js';
import { formatBasisBadge } from '../lib/research/planGrounding.js';
import { applySafetyClamps } from '../lib/research/safetyClamps.js';
import type { VelocityTable } from '../lib/research/types.js';
import { generateRoadmap, TOTAL_WEEKS, type PlanAnswer, type Roadmap } from '../lib/ai/roadmap.js';
import { activeDaysFor, generateWeekPlan, slotTimeFor, type PlanVariant, type WeekDayPlan } from '../lib/ai/weekPlan.js';
import {
  dailyTaskRows,
  phaseGate,
  readRoutine,
  readStoredRoadmap,
  roadmapWeekRows,
  saveWeekTasks,
  storedRoadmap,
  writeNextWeek,
} from '../lib/planV2.js';
import { makeGoalProfile } from '../lib/recovery/forGoal.js';
import { customProfilesEnabled, generateRecoveryProfile } from '../lib/recovery/profileCall.js';
import type { RecoveryProfile } from '../lib/recovery/profile.js';
import { ensureRecoveryProfile } from '../lib/recovery/store.js';

function wantsPlanStream(req: Request): boolean {
  return (req.headers.accept || '').includes('text/event-stream');
}

function openPlanStream(res: Response, startedAt: number) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  return (payload: Record<string, unknown>) => {
    const elapsedMs = Date.now() - startedAt;
    res.write(`data: ${JSON.stringify({ ...payload, elapsedMs, slow: elapsedMs > 20_000 })}\n\n`);
  };
}

function clampedTable(value: unknown, goalId?: string): VelocityTable | null {
  if (!value || typeof value !== 'object') return null;
  return applySafetyClamps(value as VelocityTable, { source: 'goal', goalId }).table;
}

function presentGoal<T extends Record<string, unknown>>(goal: T): T & { basis: ReturnType<typeof formatBasisBadge> } {
  const velocityTable = goal.velocityTable
    ? clampedTable(goal.velocityTable, typeof goal.id === 'string' ? goal.id : undefined)
    : goal.velocityTable;
  return {
    ...goal,
    velocityTable,
    basis: formatBasisBadge({
      methodKind: goal.methodKind as string | null | undefined,
      methodConfidence: goal.methodConfidence as string | null | undefined,
      methodName: (goal.canonicalMethodName as string | null | undefined) ?? null,
      authority: (goal.canonicalAuthority as string | null | undefined) ?? null,
    }),
  };
}

/** Answers by question id from the wizard; older clients send only `{ question: answer }`. */
function planAnswerList(list: unknown, byQuestion: unknown): PlanAnswer[] {
  if (Array.isArray(list)) {
    const cleaned = list
      .map((item) => ({
        id: typeof item?.id === 'string' ? item.id : '',
        question: typeof item?.question === 'string' ? item.question : '',
        answer: typeof item?.answer === 'string' ? item.answer : '',
      }))
      .filter((item) => item.question || item.id);
    if (cleaned.length > 0) return cleaned;
  }
  if (byQuestion && typeof byQuestion === 'object') {
    return Object.entries(byQuestion as Record<string, unknown>).map(([question, answer]) => ({
      id: '',
      question,
      answer: typeof answer === 'string' ? answer : '',
    }));
  }
  return [];
}

async function archiveActiveGoals(userId: string) {
  await prisma.goal.updateMany({ where: { userId, status: 'active' }, data: { status: 'archived' } });
}

async function saveV2Goal(input: {
  userId: string;
  rawGoal: string;
  roadmap: Roadmap;
  week1: WeekDayPlan[];
  answers: Record<string, string>;
  answerList: PlanAnswer[];
  routine: UserRoutineInput;
  start: Date;
  targetDate: Date;
  isPreset: boolean;
  /** Method-aware recovery (M1.3a): saved under `recovery` when it passed the checks. */
  recovery?: RecoveryProfile | null;
}): Promise<string> {
  const { roadmap } = input;
  await archiveActiveGoals(input.userId);
  const goal = await prisma.goal.create({
    data: {
      userId: input.userId,
      rawGoal: input.rawGoal,
      clarifiedOutcome: roadmap.finalGoal,
      methodologyNotes: `${roadmap.method.name}: ${roadmap.method.summary}`,
      status: 'active',
      startDate: input.start,
      targetDate: input.targetDate,
      currentWeek: 1,
      answers: JSON.stringify(input.answers),
      routine: JSON.stringify(input.routine),
      isGoldenRail: input.isPreset,
      canonicalMethodName: roadmap.method.name,
      canonicalAuthority: roadmap.method.creator || null,
      planVersion: 2,
      roadmap: JSON.parse(JSON.stringify(storedRoadmap(roadmap, input.answerList, input.recovery))),
    },
  });
  await prisma.roadmapWeek.createMany({
    data: roadmapWeekRows(goal.id, roadmap, input.routine.dailyMinutes!, input.routine.planVariant as PlanVariant),
  });
  await prisma.dailyTask.createMany({ data: dailyTaskRows(goal.id, 1, input.week1) });
  return goal.id;
}

/**
 * Method-aware recovery (RULE-2 to RULE-4): the profile a new goal is saved with, made after the roadmap and before
 * week 1. A pathway gets its own profile. A custom goal gets the profile call when `CUSTOM_RECOVERY_PROFILES_ENABLED`
 * is on (M1.3b), otherwise its keyword template unchanged (MR-14). Pathway and template profiles are checked without
 * the deliverable fact (MR-22). Null when it fails (logged; the goal is then saved without one, RULE-18). Never throws.
 */
async function recoveryProfileAtCreate(input: {
  presetId?: string;
  domain: string | null;
  goalText: string;
  answers: PlanAnswer[];
  roadmap: Roadmap;
}): Promise<RecoveryProfile | null> {
  const keywordProfile = () => {
    const result = makeGoalProfile({ presetId: input.presetId, domain: input.domain, goalText: input.goalText, methodName: input.roadmap.method?.name });
    if ('profile' in result) return result.profile;
    console.warn('[Recovery] No profile saved at goal create:', result.reasons);
    return null;
  };
  try {
    if (input.presetId || !customProfilesEnabled()) return keywordProfile();
    try {
      const { method, phases, weeks } = input.roadmap;
      const result = await generateRecoveryProfile({
        goalText: input.goalText,
        domain: input.domain,
        answers: input.answers,
        method: { name: method.name, summary: method.summary, rules: method.rules },
        phases,
        weeklyTargets: [...weeks].sort((a, b) => a.weekNumber - b.weekNumber).map((week) => week.target),
      });
      if (result.source !== 'model') console.warn('[Recovery] Profile call fell back to a template:', result.source);
      return result.profile;
    } catch (err) {
      console.warn('[Recovery] Profile call failed at goal create:', err);
      return keywordProfile();
    }
  } catch (err) {
    console.warn('[Recovery] Could not make a profile at goal create:', err);
  }
  return null;
}

export const goalRouter = Router();

/**
 * POST /api/goal/clarify
 * Analyzes raw goal, formulates clarified outcome, domain frameworks, and tailored questions.
 */
goalRouter.post('/clarify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawGoal } = req.body;
    if (!rawGoal || typeof rawGoal !== 'string' || !rawGoal.trim()) {
      res.status(400).json({ error: 'Please provide a valid goal description.' });
      return;
    }

    const clarification = await clarifyGoalWithAI(rawGoal.trim());
    res.json(clarification);
  } catch (err: any) {
    console.error('[GoalRouter] Clarification error:', err);
    res.status(503).json({ error: err.message || "Couldn't generate your plan right now. AI services are temporarily unavailable. Please retry." });
  }
});

/**
 * POST /api/goal/create
 * Creates the goal, 12-week roadmap, and Week 1 daily tasks.
 */
goalRouter.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Please sign in.' });
      return;
    }

    const { rawGoal, clarifiedOutcome, answers, routine, startDate, domain } = req.body;

    // A preset/certified pathway is determined by the same server-side preset resolver used below.
    // New non-preset goals require a verified Pro entitlement before any plan generation or mutation.
    const requestedPreset = typeof rawGoal === 'string' ? findPresetForGoal(rawGoal) : null;
    const requestedClarifiedPreset = typeof clarifiedOutcome === 'string' ? findPresetForGoal(clarifiedOutcome) : null;
    if (!requestedPreset && !requestedClarifiedPreset) {
      const authorization = await authorizeNewCustomGoal(user.id);
      if (!authorization.allowed) {
        res.status(403).json({ error: authorization.message, code: authorization.code });
        return;
      }
    }

    if (!rawGoal || !clarifiedOutcome) {
      res.status(400).json({ error: 'Goal and clarified outcome are required.' });
      return;
    }
    const dailyMinutes = Number(routine?.dailyMinutes);
    if (!Number.isFinite(dailyMinutes) || dailyMinutes < 10 || dailyMinutes > 480) {
      res.status(400).json({ error: 'Choose how many minutes a day you can practise.' });
      return;
    }
    if (!['steady', 'accelerated', 'minimal'].includes(routine?.planVariant)) {
      res.status(400).json({ error: 'Choose how many days a week you can practise.' });
      return;
    }

    // ND-1: the goal starts on the user's local calendar day, stored as that date at 00:00 UTC.
    const start = resolveGoalStart(normalizeTimezone(user.timezone), startDate);
    const targetDate = new Date(start);
    targetDate.setUTCDate(targetDate.getUTCDate() + 90);

    const routineInput: UserRoutineInput = {
      wakeTime: routine?.wakeTime || '07:00',
      sleepTime: routine?.sleepTime || '23:00',
      busyHours: routine?.busyHours || '09:00 - 17:00',
      preferredSlot: routine?.preferredSlot || 'evening',
      dailyMinutes,
      planVariant: routine.planVariant,
      commitments: routine?.commitments || []
    };

    const startedAt = Date.now();
    const stream = wantsPlanStream(req);
    const send = stream ? openPlanStream(res, startedAt) : null;
    const fail = (status: number, error: string) => {
      if (send) {
        send({ type: 'error', error });
        res.end();
        return;
      }
      res.status(status).json({ error });
    };

    const planVariant = routineInput.planVariant as PlanVariant;
    const answerList = planAnswerList(req.body.answerList, answers);
    const preset = findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome);
    send?.({
      type: 'step',
      id: 'search',
      label: preset ? 'Using a proven method for this goal' : 'Comparing methods for your answers',
    });

    const roadmapResult = await generateRoadmap({
      workingTitle: clarifiedOutcome,
      domain: typeof domain === 'string' && domain.trim() ? domain.trim() : preset?.primaryDomain || clarifiedOutcome,
      rawGoal,
      dailyMinutes,
      activeDays: activeDaysFor(planVariant),
      answers: answerList,
    });

    let week1: WeekDayPlan[] | null = null;
    let recovery: RecoveryProfile | null = null;
    if (roadmapResult.ok) {
      const { roadmap } = roadmapResult;
      send?.({ type: 'step', id: 'method', label: roadmap.method.name, detail: roadmap.method.whyChosen });
      send?.({ type: 'step', id: 'plan', label: 'Writing your first week' });
      // Before week 1, so the week call can use the kinds (M2.1). No stream event of its own.
      recovery = await recoveryProfileAtCreate({
        presetId: preset?.id,
        domain: typeof domain === 'string' ? domain : null,
        goalText: `${rawGoal} ${clarifiedOutcome}`,
        answers: answerList,
        roadmap,
      });
      const first = roadmap.weeks[0];
      week1 = await generateWeekPlan({
        finalGoal: roadmap.finalGoal,
        answers: answerList,
        dailyMinutes,
        planVariant,
        slotTime: slotTimeFor(routineInput.preferredSlot),
        method: roadmap.method,
        weekNumber: 1,
        totalWeeks: TOTAL_WEEKS,
        phase: roadmap.phases[0],
        focus: first.focus,
        target: first.target,
        test: first.test,
        weekStart: start,
        highLoadGoal: isHighLoadGoal({ rawGoal, clarifiedOutcome }),
        recovery,
      });
    }

    let createdGoalId: string;
    if (roadmapResult.ok && week1) {
      createdGoalId = await saveV2Goal({
        userId: user.id,
        rawGoal,
        roadmap: roadmapResult.roadmap,
        week1,
        answers: answers || {},
        answerList,
        routine: routineInput,
        start,
        targetDate,
        isPreset: Boolean(preset),
        recovery,
      });
    } else {
      // No silent v1 fallback, for presets either: a plan the AI could not write is an honest "try again", never an
      // old-style plan without the plan v2 features (missed sessions, weekly targets). Logged so a missing or broken
      // AI key shows up in the logs.
      console.warn('[GoalRouter] Plan v2 could not be written:', roadmapResult.ok ? 'week 1 failed' : roadmapResult.reason);
      if (!roadmapResult.ok) fail(roadmapResult.unsafe || roadmapResult.lowSafety ? 422 : 503, roadmapResult.reason);
      else fail(503, "Couldn't write your first week right now. Please try again.");
      return;
    }

    const saved = await prisma.goal.findUniqueOrThrow({
      where: { id: createdGoalId },
      include: {
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        dailyTasks: { orderBy: { dayNumber: 'asc' } },
        weeklyReviews: { orderBy: { weekNumber: 'asc' } }
      }
    });
    const body = {
      goal: presentGoal(saved as unknown as Record<string, unknown>),
      roadmapWeeks: saved.roadmapWeeks,
      dailyTasks: saved.dailyTasks,
    };
    if (send) {
      send({ type: 'done', ...body });
      res.end();
      return;
    }
    res.status(201).json(body);
  } catch (err: any) {
    console.error('[GoalRouter] Create goal error:', err);
    const error = err.message || "Couldn't generate your plan right now. Please try again.";
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error })}\n\n`);
      res.end();
      return;
    }
    res.status(503).json({ error });
  }
});

/**
 * GET /api/goal/active
 * Returns the user's currently active goal, roadmap weeks, and current week's daily tasks.
 * If no active goal exists, returns the most recently updated completed goal (OD-1b Option B).
 */
goalRouter.get('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' }
        },
        dailyTasks: {
          orderBy: { dayNumber: 'asc' }
        },
        weeklyReviews: {
          orderBy: { weekNumber: 'asc' }
        }
      }
    });

    if (activeGoal) {
      res.json({ activeGoal: presentGoal(activeGoal as unknown as Record<string, unknown>) });
      return;
    }

    // If no active goal exists, query for the most recently updated completed goal (OD-1b)
    const completedGoal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'completed' },
      orderBy: { updated_at: 'desc' },
      include: {
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' }
        },
        dailyTasks: {
          orderBy: { dayNumber: 'asc' }
        },
        weeklyReviews: {
          orderBy: { weekNumber: 'asc' }
        }
      }
    });

    if (completedGoal) {
      res.json({ activeGoal: presentGoal(completedGoal as unknown as Record<string, unknown>) });
      return;
    }

    res.json({ activeGoal: null });
  } catch (err: any) {
    console.error('[GoalRouter] Fetch active goal error:', err);
    res.status(500).json({ error: 'Failed to fetch active goal.' });
  }
});

/**
 * POST /api/goal/complete
 * Transitions the user's active goal to 'completed' status, records completedAt timestamp,
 * and preserves the completed journey (OD-1b Option B).
 */
// POST /api/goal/reconcile
// Missed sessions (ND-6): called once when the app loads, before the goal is fetched. Reports the derived
// classification (ND-2) and the open gap for the active plan v2 goal, plus the carry-forward plan (M2.2).
// Carries are written only when MISSED_SESSIONS_CARRY_ENABLED is 'true' (ND-15); otherwise nothing is written.
goalRouter.post('/reconcile', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    // M2.2 carry-forward and M2.3 signals, shared with the M2.4 actions (lib/reconcileCore.ts). Idempotent
    // (04-phases.md 3.4): a handled day is never planned again, and each write is a compare-and-set (ND-13).
    const goal = await loadReconcileGoal(user.id);
    res.json(await runReconcile(goal, user, new Date()));
  } catch (err: any) {
    console.error('[GoalRouter] Reconcile error:', err);
    res.status(500).json({ error: 'Failed to reconcile goal.' });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Missed sessions M2.4: mark today missed, swap two days, carry now (ND-9, ND-14, ND-17, ND-18).
// Every action writes only when MISSED_SESSIONS_CARRY_ENABLED is 'true' (ND-15); otherwise 409 carry_disabled.
// Each answers with the reconcile body, so the client refreshes in one round trip.

type ActionReason =
  | 'not_today'
  | 'rest_day'
  | 'completed'
  | 'already_handled'
  | 'not_held'
  | 'not_same_week'
  | 'not_open'
  | 'test_day'
  | 'holds_carry'
  | 'changed'
  | 'not_plan_v2'
  | 'carry_disabled'
  | 'week_closed'
  | 'goal_not_active';

const ACTION_ERRORS: Record<ActionReason, string> = {
  not_today: 'This can only be done for today.',
  rest_day: 'Rest days cannot be changed this way.',
  completed: 'This day is already done.',
  already_handled: 'This day has already been changed.',
  not_held: 'There is no open swap offer for this day.',
  not_same_week: 'Both days must be in the same week.',
  not_open: 'Both days must still be open.',
  test_day: 'The test day cannot be swapped.',
  holds_carry: 'A day that already received a moved step cannot be swapped.',
  changed: 'The plan changed. Reload and try again.',
  not_plan_v2: 'This plan does not support this action.',
  carry_disabled: 'This action is not available yet.',
  week_closed: 'This week has already been reviewed.',
  goal_not_active: 'This goal is no longer active.',
};

function refuse(res: Response, reason: ActionReason): void {
  res.status(409).json({ error: ACTION_ERRORS[reason], reason });
}

async function actionUser(req: Request, res: Response) {
  const user = await getAuthUser(req);
  if (!user) res.status(401).json({ error: 'Unauthorized.' });
  return user;
}

/** 404 (not a task of the user's active goal), then not_plan_v2 and carry_disabled. Null when answered. */
async function actionGoal(res: Response, user: { id: string }, taskIds: string[]) {
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

const hasCarriedStep = (steps: CarriedStep[]) => steps.some((step) => step.carriedFrom && typeof step.carriedFrom === 'object');

/**
 * POST /api/goal/tasks/:taskId/mark-missed
 * Plans today's open practice day as missed, so the M2.2 rules apply unchanged: carried (one guarded write),
 * held for a swap offer (key session), or dropped. A hold or a drop stores nothing (ND-14); never a status.
 */
goalRouter.post('/tasks/:taskId/mark-missed', async (req: Request, res: Response): Promise<void> => {
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
goalRouter.post('/tasks/:taskId/carry-now', async (req: Request, res: Response): Promise<void> => {
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

    res.json(await runReconcile(goal, user, now, { ...overrides, asNotKey: task.id }));
  } catch (err: any) {
    console.error('[GoalRouter] Carry now error:', err);
    res.status(500).json({ error: 'Failed to update the plan.' });
  }
});

/** The `DailyTask` fields that belong to the plan and move in a swap. Date and user fields stay with the day. */
const SWAP_CONTENT_SELECT = {
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

type SwapRow = Prisma.DailyTaskGetPayload<{ select: typeof SWAP_CONTENT_SELECT }>;

class SwapConflict extends Error {}

/** The content of `from`, as written onto the other day. With a marker, every step that lands gets `swappedFrom`. */
function swapContent(from: SwapRow, marker: boolean): Prisma.DailyTaskUpdateManyMutationInput {
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
goalRouter.post('/tasks/:taskId/swap', async (req: Request, res: Response): Promise<void> => {
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

    if (!offer) {
      const handled = handledTaskIds(evaluation.tasks);
      const kindOf = new Map(evaluation.result.days.map((day) => [day.taskId, day.kind]));
      const stepsOf = new Map(evaluation.tasks.map((task) => [task.id, task.steps]));
      for (const day of [a, b]) {
        if (day.isRestDay) return refuse(res, 'rest_day');
        if (day.isTestDay) return refuse(res, 'test_day');
        if (day.status === 'completed') return refuse(res, 'completed');
        if (kindOf.get(day.id) !== 'planned' || day.date < evaluation.today) return refuse(res, 'not_open');
        if (hasCarriedStep(stepsOf.get(day.id) ?? [])) return refuse(res, 'holds_carry');
        if (handled.has(day.id)) return refuse(res, 'already_handled');
      }
    }
    if (expectedMap[a.id] !== a.detailedSteps || expectedMap[b.id] !== b.detailedSteps) return refuse(res, 'changed');

    const rows = await prisma.dailyTask.findMany({ where: { id: { in: [a.id, b.id] }, goalId: goal.id }, select: SWAP_CONTENT_SELECT });
    const rowA = rows.find((row) => row.id === a.id);
    const rowB = rows.find((row) => row.id === b.id);
    if (!rowA || !rowB) return refuse(res, 'changed');

    try {
      await prisma.$transaction(async (tx) => {
        const writes: Array<[SwapRow, SwapRow]> = [
          [rowA, rowB],
          [rowB, rowA],
        ];
        for (const [target, source] of writes) {
          const { count } = await tx.dailyTask.updateMany({
            where: { id: target.id, goalId: goal.id, status: target.status, detailedSteps: expectedMap[target.id] as string },
            data: swapContent(source, offer),
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

goalRouter.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' }
        },
        dailyTasks: {
          orderBy: { dayNumber: 'asc' }
        },
        weeklyReviews: {
          orderBy: { weekNumber: 'asc' }
        }
      }
    });

    if (!activeGoal) {
      res.status(404).json({ error: 'No active goal found to complete.' });
      return;
    }

    const { finalReflection, finalTestResult } = req.body || {};

    if (finalTestResult !== undefined && finalTestResult !== null && typeof finalTestResult === 'object') {
      const validTest = validateWeeklyTestResult(finalTestResult);
      if (validTest.valid && validTest.result) {
        const targetWeek =
          activeGoal.roadmapWeeks?.find((w) => w.weekNumber === 12) ||
          activeGoal.roadmapWeeks?.[activeGoal.roadmapWeeks.length - 1];
        if (targetWeek) {
          await prisma.roadmapWeek.update({
            where: { id: targetWeek.id },
            data: { testResult: validTest.result as unknown as Prisma.InputJsonValue }
          });
        }
      }
    }

    if (typeof finalReflection === 'string' && finalReflection.trim()) {
      const targetReview =
        activeGoal.weeklyReviews?.find((r) => r.weekNumber === 12) ||
        activeGoal.weeklyReviews?.[activeGoal.weeklyReviews.length - 1];
      if (targetReview) {
        await prisma.weeklyReview.update({
          where: { id: targetReview.id },
          data: { reflection: finalReflection.trim() }
        });
      }
    }

    const completedGoal = await prisma.goal.update({
      where: { id: activeGoal.id },
      data: {
        status: 'completed',
        completedAt: new Date()
      },
      include: {
        roadmapWeeks: {
          orderBy: { weekNumber: 'asc' }
        },
        dailyTasks: {
          orderBy: { dayNumber: 'asc' }
        },
        weeklyReviews: {
          orderBy: { weekNumber: 'asc' }
        }
      }
    });

    const presented = presentGoal(completedGoal as unknown as Record<string, unknown>);
    res.json({ goal: presented, activeGoal: presented });
  } catch (err: any) {
    console.error('[GoalRouter] Complete goal error:', err);
    res.status(500).json({ error: 'Failed to complete goal.' });
  }
});

/** The only task statuses a client may set through PATCH /api/goal/tasks/:taskId (B-11). */
export const TASK_STATUSES = ['pending', 'completed'] as const;

function isTaskStatus(value: unknown): value is (typeof TASK_STATUSES)[number] {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Longest note PATCH /api/goal/tasks/:taskId stores (B-29). */
export const TASK_NOTES_MAX_LENGTH = 2000;

/** A 24-hour "HH:MM" time, 00:00 to 23:59 (B-29). */
const SLOT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * PATCH /api/goal/tasks/:taskId
 * Updates task completion status, notes or slot time. `notes` and `slotTime` accept null to clear them (B-29).
 */
goalRouter.patch('/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { taskId } = req.params;
    const { status, notes, slotTime, usedMinimumVersion } = req.body;

    if (status !== undefined && !isTaskStatus(status)) {
      res.status(400).json({ error: 'status must be "pending" or "completed".' });
      return;
    }

    if (usedMinimumVersion !== undefined && typeof usedMinimumVersion !== 'boolean') {
      res.status(400).json({ error: 'usedMinimumVersion must be a boolean.' });
      return;
    }

    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > TASK_NOTES_MAX_LENGTH)) {
      res.status(400).json({ error: `notes must be text of at most ${TASK_NOTES_MAX_LENGTH} characters, or null.` });
      return;
    }

    if (slotTime !== undefined && slotTime !== null && (typeof slotTime !== 'string' || !SLOT_TIME.test(slotTime))) {
      res.status(400).json({ error: 'slotTime must be a time as "HH:MM" (00:00 to 23:59), or null.' });
      return;
    }

    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: { goal: true }
    });

    if (!task || task.goal.userId !== user.id) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (task.goal.status !== 'active') return refuse(res, 'goal_not_active');

    // Sending `completed` again for a task already done keeps the first completion as it was (B-29).
    const statusChanges = status !== undefined && status !== task.status;

    const updated = await prisma.dailyTask.update({
      where: { id: taskId },
      data: {
        ...(status ? { status } : {}),
        completedAt: !statusChanges ? task.completedAt : status === 'completed' ? new Date() : null,
        // ND-3: the flag describes the current completion, so it is rewritten only when
        // status changes, and is true only for a minimum completion of a task that has one.
        ...(statusChanges
          ? { usedMinimumVersion: status === 'completed' && usedMinimumVersion === true && task.minimumVersion != null }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(slotTime !== undefined ? { slotTime } : {})
      }
    });

    res.json({ task: updated });
  } catch (err: any) {
    console.error('[GoalRouter] Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

export interface WeeklyTestResultInput {
  value: string | number;
  passed: boolean;
  unit?: string;
  note?: string;
}

export function validateWeeklyTestResult(
  input: unknown
): { valid: true; result: WeeklyTestResultInput } | { valid: false; error: string } {
  if (input === null || input === undefined) {
    return { valid: false, error: 'testResult cannot be null or undefined when provided.' };
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'testResult must be an object.' };
  }

  const record = input as Record<string, unknown>;

  // value: required, non-empty string | number
  if (record.value === undefined || record.value === null) {
    return { valid: false, error: 'testResult.value is required.' };
  }
  if (typeof record.value === 'string') {
    if (record.value.trim() === '') {
      return { valid: false, error: 'testResult.value must not be empty.' };
    }
  } else if (typeof record.value === 'number') {
    if (Number.isNaN(record.value)) {
      return { valid: false, error: 'testResult.value must be a valid number.' };
    }
  } else {
    return { valid: false, error: 'testResult.value must be a string or number.' };
  }

  // passed: required boolean
  if (typeof record.passed !== 'boolean') {
    return { valid: false, error: 'testResult.passed is required and must be a boolean.' };
  }

  // unit: optional string
  if (record.unit !== undefined && record.unit !== null && typeof record.unit !== 'string') {
    return { valid: false, error: 'testResult.unit must be a string when provided.' };
  }

  // note: optional string
  if (record.note !== undefined && record.note !== null && typeof record.note !== 'string') {
    return { valid: false, error: 'testResult.note must be a string when provided.' };
  }

  return {
    valid: true,
    result: {
      value: typeof record.value === 'string' ? record.value.trim() : record.value,
      passed: record.passed,
      ...(typeof record.unit === 'string' && record.unit.trim() !== '' ? { unit: record.unit.trim() } : {}),
      ...(typeof record.note === 'string' && record.note.trim() !== '' ? { note: record.note.trim() } : {}),
    },
  };
}

/**
 * PUT /api/goal/weeks/:weekNumber/test-result
 * Missed sessions M4.1 (ND-4, RULE-7): logs the week's test result without closing the week. Stores
 * `RoadmapWeek.testResult` and nothing else: no status change, no next week, no model call. The latest call wins.
 * The weekly review keeps this result when it is submitted without one.
 */
goalRouter.put('/weeks/:weekNumber/test-result', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;

    const validation = validateWeeklyTestResult(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const weekNumber = Number(req.params.weekNumber);
    const goal = Number.isInteger(weekNumber)
      ? await prisma.goal.findFirst({
          where: { userId: user.id, status: 'active' },
          select: { planVersion: true, roadmapWeeks: { where: { weekNumber }, select: { id: true, status: true } } },
        })
      : null;
    const week = goal?.roadmapWeeks[0];
    if (!goal || !week) {
      res.status(404).json({ error: 'Week not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');
    if (week.status === 'completed') return refuse(res, 'week_closed');

    await prisma.roadmapWeek.update({
      where: { id: week.id },
      data: { testResult: validation.result as unknown as Prisma.InputJsonObject },
    });
    res.json({ testResult: validation.result });
  } catch (err: any) {
    console.error('[GoalRouter] Log test result error:', err);
    res.status(500).json({ error: 'Failed to save the test result.' });
  }
});

/**
 * POST /api/goal/weeks/:weekNumber/review
 * Submits weekly review, computes adherence score against 85% target,
 * persists optional benchmark test results (OD-1a Option A),
 * and writes the next week's tasks. A goal that is not plan v2 is refused (ND-21).
 */
goalRouter.post('/weeks/:weekNumber/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const weekNum = parseInt(req.params.weekNumber, 10);
    const { reflection, testResult } = req.body;

    let sanitizedTestResult: WeeklyTestResultInput | null = null;
    if (testResult !== undefined && testResult !== null) {
      const validation = validateWeeklyTestResult(testResult);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      sanitizedTestResult = validation.result;
    }

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: {
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        dailyTasks: { where: { weekNumber: weekNum } }
      }
    });

    if (!goal) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }

    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');

    const stored = readStoredRoadmap(goal);
    const practice = goal.dailyTasks.filter((t) => !t.isRestDay);
    const planned = practice.length || 1;
    const completed = practice.filter((t) => t.status === 'completed').length;
    const score = Math.round((completed / planned) * 100);
    const nextWeek = weekNum + 1;

    let nextTasks: Awaited<ReturnType<typeof saveWeekTasks>> = [];
    let written: WeekDayPlan[] | null = null;
    if (nextWeek <= TOTAL_WEEKS) {
      // M1.3a (RULE-1, MR-14): an older goal gets its recovery profile here; never blocks the review.
      const recovery = await ensureRecoveryProfile(goal);
      written = await writeNextWeek(goal, weekNum, goal.dailyTasks, slotTimeFor(readRoutine(goal).preferredSlot), recovery);
      if (!written) {
        res.status(503).json({ error: "Couldn't write next week right now. This week is unchanged; please try again." });
        return;
      }
    }

    const insight = `${completed} of ${practice.length} sessions done.`;
    const review = await prisma.weeklyReview.upsert({
      where: { goalId_weekNumber: { goalId: goal.id, weekNumber: weekNum } },
      update: { tasksPlanned: planned, tasksCompleted: completed, scorePercentage: score, reflection: reflection || '', aiAdaptationInsight: insight },
      create: {
        goalId: goal.id,
        weekNumber: weekNum,
        tasksPlanned: planned,
        tasksCompleted: completed,
        scorePercentage: score,
        reflection: reflection || '',
        aiAdaptationInsight: insight,
      },
    });
    await prisma.roadmapWeek.update({
      where: { goalId_weekNumber: { goalId: goal.id, weekNumber: weekNum } },
      data: {
        status: 'completed',
        executionScore: score,
        reviewNotes: reflection || '',
        // M4.1: a review sent without a result keeps the one logged earlier (PUT .../test-result).
        ...(sanitizedTestResult ? { testResult: sanitizedTestResult as unknown as Prisma.InputJsonObject } : {}),
      },
    });
    if (written) {
      nextTasks = await saveWeekTasks(goal.id, nextWeek, written);
      await prisma.roadmapWeek.update({
        where: { goalId_weekNumber: { goalId: goal.id, weekNumber: nextWeek } },
        data: { status: 'active' },
      });
      await prisma.goal.update({ where: { id: goal.id }, data: { currentWeek: nextWeek } });
    }

    const gate = stored ? phaseGate(stored, weekNum, score) : null;
    res.json({
      review,
      scorePercentage: score,
      nextWeekNumber: nextWeek <= TOTAL_WEEKS ? nextWeek : null,
      nextWeekTasks: nextTasks,
      isMilestoneCheckpoint: Boolean(gate),
      milestoneGateTransition: gate,
      testResult: sanitizedTestResult,
    });
  } catch (err: any) {
    console.error('[GoalRouter] Weekly review error:', err);
    res.status(500).json({ error: 'Failed to process weekly review.' });
  }
});

/**
 * DELETE /api/goal/active
 * Archives or removes the active goal to let user start fresh.
 */
goalRouter.delete('/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    await prisma.goal.deleteMany({
      where: { userId: user.id, status: 'active' }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('[GoalRouter] Delete active goal error:', err);
    res.status(500).json({ error: 'Failed to reset goal.' });
  }
});
