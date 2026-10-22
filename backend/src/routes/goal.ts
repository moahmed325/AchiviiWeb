import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { normalizeTimezone, resolveGoalStart } from '../lib/timezone.js';
import { handledTaskIds, parseStoredSteps, type CarriedStep } from '../lib/carryForward.js';
import {
  carryEnabled,
  evaluate,
  loadReconcileGoal,
  followsNewRules,
  methodRefusal,
  moveNowTarget,
  openSwapRefusal,
  runReconcile,
  type ReconcileGoal,
} from '../lib/reconcileCore.js';
import { doneDayIds, markerRefusal } from '../lib/recovery/swap.js';
import { easyLineAfterSwap } from '../lib/recovery/easyStart.js';
import { authorizeNewCustomGoal } from '../lib/billing/goalAuthorization.js';
import { clarifyGoalWithAI, UserRoutineInput } from '../lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../lib/ai/presets/index.js';
import { isHighLoadGoal } from '../lib/highLoad.js';
import { loadGoalInput } from '../lib/safety/stepLoad.js';
import { logRoadmapTargets } from '../lib/safety/targetSteps.js';
import { safeGoalTargets, type StoredWeek, type Week12Line } from '../lib/safety/storedTargets.js';
import { formatBasisBadge } from '../lib/research/planGrounding.js';
import { applySafetyClamps } from '../lib/research/safetyClamps.js';
import type { VelocityTable } from '../lib/research/types.js';
import { generateRoadmap, lightTestSession, TOTAL_WEEKS, type PlanAnswer, type Roadmap } from '../lib/ai/roadmap.js';
import { activeDaysFor, generateWeekPlan, slotTimeFor, type PlanVariant, type WeekDayPlan } from '../lib/ai/weekPlan.js';
import {
  dailyTaskRows,
  roadmapWeekRows,
  storedRoadmap,
} from '../lib/planV2.js';
import { makeGoalProfile } from '../lib/recovery/forGoal.js';
import { customProfilesEnabled, generateRecoveryProfile } from '../lib/recovery/profileCall.js';
import type { RecoveryProfile } from '../lib/recovery/profile.js';
import {
  closeAnswer,
  logJump,
  logWeekClose,
  planWeekMove,
  reviewInsight,
  saveWeekClose,
  weekCloseDue,
} from '../lib/weekClose/close.js';
import { autoCloseUpdateInsight, logUpdateLowered, retestOfWeekFor, updateThenWrite } from '../lib/weekClose/update.js';
import type { PastLimitChoice } from '../lib/weekClose/breaks.js';
import { weekCloseEnabled } from '../lib/weekClose/switch.js';

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

/**
 * Plan safety limits M1.3 (RULE-9, PSL-12): an older goal's targets lowered on read, and the honest week 12 line. Writes
 * nothing and logs nothing (`/active` runs on every app load). A goal without a v2 roadmap or weeks is left as it is.
 */
function safeTargetsOf(goal: Record<string, unknown>): { roadmapWeeks: unknown; roadmap: unknown; week12Line: Week12Line | null } | null {
  const safe = safeGoalTargets({
    rawGoal: typeof goal.rawGoal === 'string' ? goal.rawGoal : '',
    clarifiedOutcome: typeof goal.clarifiedOutcome === 'string' ? goal.clarifiedOutcome : null,
    roadmap: goal.roadmap,
    roadmapWeeks: goal.roadmapWeeks as StoredWeek[] | undefined,
  });
  if (!safe) return null;
  const roadmap = goal.roadmap as Record<string, unknown>;
  return {
    roadmapWeeks: safe.weeks,
    roadmap: safe.finalTest === roadmap.finalTest ? roadmap : { ...roadmap, finalTest: safe.finalTest },
    week12Line: safe.week12Line,
  };
}

function presentGoal<T extends Record<string, unknown>>(goal: T): T & { basis: ReturnType<typeof formatBasisBadge> } {
  const velocityTable = goal.velocityTable
    ? clampedTable(goal.velocityTable, typeof goal.id === 'string' ? goal.id : undefined)
    : goal.velocityTable;
  return {
    ...goal,
    ...safeTargetsOf(goal),
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
      const firstSession = lightTestSession(first.test, rawGoal, clarifiedOutcome);
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
        // M2.1 (WU-43 (5)): only a light first week names the session its test belongs to.
        ...(firstSession ? { testSession: firstSession } : {}),
        highLoadGoal: isHighLoadGoal({ rawGoal, clarifiedOutcome }),
        // Plan safety limits M2.1 (RULE-4): only a load goal adds the key.
        ...loadGoalInput({ rawGoal, clarifiedOutcome }, first.target),
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
      // Plan safety limits M1.2 (RULE-10, AC-10): the accepted roadmap's lowered targets, logged once with the goal id.
      // The check's own decision (family, no start, pathway), so the log and the check can never disagree.
      logRoadmapTargets(createdGoalId, roadmapResult.roadmap, roadmapResult.targetCheck);
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
    const presented = presentGoal(saved as unknown as Record<string, unknown>);
    const body = {
      goal: presented,
      // M1.3 review: the same weeks the goal carries, never a second, unlowered copy.
      roadmapWeeks: presented.roadmapWeeks,
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
  | 'choice_needed';

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
};

function refuse(res: Response, reason: ActionReason): void {
  res.status(409).json({ error: ACTION_ERRORS[reason], reason });
}

/** M1.5b (WU-38 (1)): 409 `choice_needed`, naming the choice the card offers. */
function refuseChoice(res: Response, choice: PastLimitChoice): void {
  res.status(409).json({ error: ACTION_ERRORS.choice_needed, reason: 'choice_needed', choice });
}

const isChoice = (value: unknown): value is PastLimitChoice => value === 'keep_going' || value === 'final_week';

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

/** Longest new note PATCH /api/goal/tasks/:taskId stores (B-29); the frontend's note boxes use the same limit. */
export const TASK_NOTES_MAX_LENGTH = 2000;

/** How much one update may add to a note already near or over the limit: one Focus win line (B-29 follow-up). */
const TASK_NOTES_MAX_GROWTH = TASK_NOTES_MAX_LENGTH + 100;

/** No update may grow a note past this, so repeated additions cannot grow a row without end. */
export const TASK_NOTES_HARD_MAX = 50_000;

/**
 * Whether `notes` may replace `stored` (B-29). Notes sent back unchanged always pass, so an old long note never stops
 * a step being marked done. A changed note passes when it is within the limit, or, when a note is already saved, when
 * it is at most one Focus win longer than that note (so an edit that shortens an old long note passes too) and under
 * the hard maximum. Today saves the free text and the Focus wins as one string, so an edit is not always an append.
 */
export function notesWithinLimit(notes: string, stored: string | null): boolean {
  if (notes === stored) return true;
  if (notes.length <= TASK_NOTES_MAX_LENGTH) return true;
  if (!stored) return false;
  return notes.length <= stored.length + TASK_NOTES_MAX_GROWTH && notes.length <= TASK_NOTES_HARD_MAX;
}

const NOTES_ERROR = `notes must be text of at most ${TASK_NOTES_MAX_LENGTH} characters, or null.`;

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

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      res.status(400).json({ error: NOTES_ERROR });
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

    if (typeof notes === 'string' && !notesWithinLimit(notes, task.notes)) {
      res.status(400).json({ error: NOTES_ERROR });
      return;
    }

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

/** B-67: a week number from the path, a whole number from 1 to 12 written as digits; null for anything else. */
function parseWeekNumber(raw: string | undefined): number | null {
  if (typeof raw !== 'string' || !/^\d{1,2}$/.test(raw)) return null;
  const week = Number(raw);
  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

/** B-67: answers 400 and returns null for a bad week number, before any goal is read. */
function weekNumberOr400(req: Request, res: Response): number | null {
  const week = parseWeekNumber(req.params.weekNumber);
  if (week === null) res.status(400).json({ error: `Week number must be 1 to ${TOTAL_WEEKS}.` });
  return week;
}

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
 * Weekly update M3.3a (RULE-5, WU-17, WU-56 (2)): a closed week the open week re-tests (`retestOfWeek`) takes the
 * re-test's result as its late result; every other closed week is refused as before.
 */
goalRouter.put('/weeks/:weekNumber/test-result', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await actionUser(req, res);
    if (!user) return;

    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;

    const validation = validateWeeklyTestResult(req.body);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const goal = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      select: {
        planVersion: true,
        roadmapWeeks: { where: { OR: [{ weekNumber }, { status: 'active' }] }, select: { id: true, weekNumber: true, status: true, retestOfWeek: true } },
      },
    });
    const week = goal?.roadmapWeeks.find((w) => w.weekNumber === weekNumber);
    const retested = goal?.roadmapWeeks.some((w) => w.status === 'active' && w.retestOfWeek === weekNumber) === true;
    if (!goal || !week) {
      res.status(404).json({ error: 'Week not found.' });
      return;
    }
    if (goal.planVersion !== 2) return refuse(res, 'not_plan_v2');
    if (week.status === 'completed' && !retested) return refuse(res, 'week_closed');
    // B-68: only the open week takes a result (a late test is logged while its week is still active).
    if (week.status !== 'active' && !retested) return refuse(res, 'week_not_open');

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

    const weekNum = weekNumberOr400(req, res);
    if (weekNum === null) return;
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

    // B-59, WU-27 (every switch state): only the open week can be reviewed, and before any model call.
    const week = goal.roadmapWeeks.find((w) => w.weekNumber === weekNum);
    if (weekNum !== goal.currentWeek || week?.status !== 'active') return refuse(res, 'week_closed');

    const startedAt = Date.now();

    // B-61: the week writer is told the result sent with this review, which is saved only after the call.
    const writerGoal = sanitizedTestResult
      ? { ...goal, roadmapWeeks: goal.roadmapWeeks.map((w) => (w.weekNumber === weekNum ? { ...w, testResult: sanitizedTestResult as unknown as Prisma.JsonValue } : w)) }
      : goal;
    const now = new Date();
    // Weekly update M3.1 (RULE-1, WU-45 (1)): with both switches on, weeks 1 to 11 and not a break, the update runs
    // first and the week after is written from its targets; otherwise null and the review is exactly as before.
    const { update, next } = await updateThenWrite(writerGoal, weekNum, {
      userId: user.id,
      reflection: typeof reflection === 'string' ? reflection : '',
      now,
      timezone: user.timezone,
    });
    // M1.5b (WU-38 (1)): a break past the limit is answered on Today's card, never by the review; nothing was called.
    if (next?.choiceNeeded) return refuseChoice(res, next.choiceNeeded);
    if (!next) {
      res.status(503).json({ error: "Couldn't write next week right now. This week is unchanged; please try again." });
      return;
    }

    const saved = await saveWeekClose({
      goal,
      weekNumber: weekNum,
      by: 'review',
      written: next.written,
      reflection,
      testResult: sanitizedTestResult as unknown as Prisma.InputJsonObject | null,
      // M1.4 (section 6): a late review that moves the plan keeps its own insight and answer. M3.1 (RULE-7): after an
      // update, its sentence (or the neutral line on the fallback).
      insight: update ? update.insight : reviewInsight(goal.dailyTasks),
      move: next.move,
      now,
      update,
      retestOfWeek: retestOfWeekFor(update, next.written),
    });
    // Another close won inside the save (WU-27): nothing of this request was saved.
    if (!saved) return refuse(res, 'week_closed');
    logWeekClose(goal, weekNum, 'review', now, user.timezone, startedAt);
    logUpdateLowered(goal.id, update);
    // B-61: the answer shows the result the week writer was told: the one sent, else the stored (late) one, which the save keeps.
    res.json(closeAnswer(goal, weekNum, saved, sanitizedTestResult ?? week.testResult ?? null));
  } catch (err: any) {
    console.error('[GoalRouter] Weekly review error:', err);
    res.status(500).json({ error: 'Failed to process weekly review.' });
  }
});

/**
 * POST /api/goal/close-week (weekly update M1.2a, RULE-8, RULE-9, behind WEEK_CLOSE_ENABLED)
 * Closes the open week once its last day has closed, exactly as the review would but with no reflection. Safe to
 * repeat: who closes the week is decided inside the save (WU-27). `{ mode: 'check' }` only says whether a close is due.
 */
goalRouter.post('/close-week', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    // RULE-18: off means nothing closes a week automatically; nothing is read or written.
    if (!weekCloseEnabled()) {
      res.json({ due: false });
      return;
    }

    const found = await prisma.goal.findFirst({
      where: { userId: user.id, status: 'active' },
      include: { roadmapWeeks: { orderBy: { weekNumber: 'asc' } } },
    });
    if (!found) {
      res.status(404).json({ error: 'Active goal not found.' });
      return;
    }
    if (found.planVersion !== 2) return refuse(res, 'not_plan_v2');

    const weekNum = found.currentWeek;
    const week = found.roadmapWeeks.find((w) => w.weekNumber === weekNum);
    if (week?.status !== 'active') {
      res.json({ due: false });
      return;
    }
    const weekTasks = await prisma.dailyTask.findMany({ where: { goalId: found.id, weekNumber: weekNum }, orderBy: { dayNumber: 'asc' } });
    const now = new Date();
    if (!weekCloseDue(found, weekTasks, now, user.timezone)) {
      res.json({ due: false });
      return;
    }
    const goal = { ...found, dailyTasks: weekTasks };

    // RULE-9: the first open that tried to close this week, kept across failed tries and racing requests.
    if (found.closeTriedWeek !== weekNum || !found.closeTriedAt) {
      await prisma.goal.updateMany({
        where: { id: goal.id, OR: [{ closeTriedWeek: null }, { closeTriedWeek: { not: weekNum } }, { closeTriedAt: null }] },
        data: { closeTriedAt: now, closeTriedWeek: weekNum },
      });
    }

    if (req.body?.mode === 'check') {
      // M1.5b: `break` (WU-39: no test card after a break) and `choice` (WU-38: the card past the limit, else null).
      const move = planWeekMove(found, weekNum, now, user.timezone, weekTasks);
      res.json({
        due: true,
        weekNumber: weekNum,
        testLogged: week.testResult !== null && week.testResult !== undefined,
        break: move !== null && move.breakDays !== null,
        choice: move?.choiceNeeded ?? null,
      });
      return;
    }

    const startedAt = Date.now();
    const lastWeek = weekNum >= TOTAL_WEEKS;
    const choice = isChoice(req.body?.choice) ? req.body.choice : null;
    // M3.3a (RULE-1, RULE-18, WU-52): the same update as the review, with no reflection; none for week 12, on a break
    // (so never before a choice past the limit) or with either switch off, and then the close is exactly as before.
    const { update, next } = await updateThenWrite(goal, weekNum, { userId: user.id, reflection: '', now, timezone: user.timezone, choice });
    // M1.5b (WU-38): past the limit, a close without the person's choice saves nothing and calls no model.
    if (next?.choiceNeeded) return refuseChoice(res, next.choiceNeeded);
    if (!next) {
      res.status(503).json({ error: "Couldn't get your next week ready. Please try again." });
      return;
    }
    const saved = await saveWeekClose({
      goal,
      weekNumber: weekNum,
      by: 'auto',
      written: next.written,
      // RULE-11: week 12 closes with no review row. M1.4 (section 6): a close that moved the plan says so. M3.3a
      // (WU-56 (4)): with an update, its sentence, after the move line when the plan moved.
      ...(lastWeek ? {} : { insight: autoCloseUpdateInsight(next.move, update) }),
      move: next.move,
      now,
      update,
      retestOfWeek: retestOfWeekFor(update, next.written),
    });
    // Lost the race (WU-27): another close saved this week; nothing of this request was saved.
    if (!saved) {
      res.json({ due: false, alreadyClosed: true, weekNumber: weekNum });
      return;
    }
    logWeekClose(goal, weekNum, 'auto', now, user.timezone, startedAt);
    logJump(goal, weekNum, next.move);
    logUpdateLowered(goal.id, update);
    res.json({ due: true, closedBy: 'auto', ...closeAnswer(goal, weekNum, saved, week.testResult ?? null, next.move) });
  } catch (err: any) {
    console.error('[GoalRouter] Week close error:', err);
    res.status(500).json({ error: 'Failed to close the week.' });
  }
});

/** The active goal's week `weekNumber`, for the two endpoints below. Null when answered (401, 409, 404). */
async function closedWeekOf(req: Request, res: Response, weekNumber: number) {
  const user = await actionUser(req, res);
  if (!user) return null;
  // RULE-18: off means nothing is read or written.
  if (!weekCloseEnabled()) {
    refuse(res, 'week_close_disabled');
    return null;
  }
  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, status: 'active' },
    select: { id: true, planVersion: true, roadmapWeeks: { where: { weekNumber } } },
  });
  const week = goal?.roadmapWeeks[0];
  if (!goal || !week) {
    res.status(404).json({ error: 'Week not found.' });
    return null;
  }
  if (goal.planVersion !== 2) {
    refuse(res, 'not_plan_v2');
    return null;
  }
  return { goal, week };
}

/**
 * POST /api/goal/weeks/:weekNumber/close-line-seen (weekly update M1.2b, WU-28, behind WEEK_CLOSE_ENABLED)
 * Records that the automatic close's line was shown, so no device shows it again. Only a week closed automatically;
 * safe to repeat (the first time is kept).
 */
goalRouter.post('/weeks/:weekNumber/close-line-seen', async (req: Request, res: Response): Promise<void> => {
  try {
    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;
    const found = await closedWeekOf(req, res, weekNumber);
    if (!found) return;
    const { week } = found;
    if (week.closedBy !== 'auto') return refuse(res, 'not_auto_closed');

    const seenAt = new Date();
    await prisma.roadmapWeek.updateMany({ where: { id: week.id, closedBy: 'auto', closeLineSeenAt: null }, data: { closeLineSeenAt: seenAt } });
    res.json({ closeLineSeenAt: week.closeLineSeenAt ?? seenAt });
  } catch (err: any) {
    console.error('[GoalRouter] Close line seen error:', err);
    res.status(500).json({ error: 'Failed to save.' });
  }
});

/**
 * POST /api/goal/weeks/:weekNumber/reflection (weekly update M1.2b, WU-31, behind WEEK_CLOSE_ENABLED)
 * A review that lost to an automatic close keeps its typed reflection: saved onto the week (and its review row) only
 * when the week closed automatically with no reflection yet. Safe to repeat with the same text.
 */
goalRouter.post('/weeks/:weekNumber/reflection', async (req: Request, res: Response): Promise<void> => {
  try {
    const weekNumber = weekNumberOr400(req, res);
    if (weekNumber === null) return;
    const reflection = typeof req.body?.reflection === 'string' ? req.body.reflection : '';
    if (!reflection.trim()) {
      res.status(400).json({ error: 'A reflection is required.' });
      return;
    }
    const found = await closedWeekOf(req, res, weekNumber);
    if (!found) return;
    const { goal, week } = found;
    if (week.closedBy !== 'auto') return refuse(res, 'not_auto_closed');
    if (week.reviewNotes === reflection) {
      res.json({ reflection });
      return;
    }

    const empty = [{ reviewNotes: null }, { reviewNotes: '' }];
    const saved = await prisma.$transaction(async (tx) => {
      const won = await tx.roadmapWeek.updateMany({ where: { id: week.id, closedBy: 'auto', OR: empty }, data: { reviewNotes: reflection } });
      if (won.count === 0) return false;
      await tx.weeklyReview.updateMany({
        where: { goalId: goal.id, weekNumber, OR: [{ reflection: null }, { reflection: '' }] },
        data: { reflection },
      });
      return true;
    });
    if (!saved) return refuse(res, 'reflection_saved');
    res.json({ reflection });
  } catch (err: any) {
    console.error('[GoalRouter] Late reflection error:', err);
    res.status(500).json({ error: 'Failed to save the reflection.' });
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
