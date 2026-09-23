import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  clarifyGoalWithAI,
  adaptUpcomingWeekTasksWithAI,
  presetFixedPlan,
  UserRoutineInput,
  PreviousWeekTaskSummary,
  type PlanGenerationResult,
} from '../lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../lib/ai/presets/index.js';
import { cleanBlocks, cleanWorkKinds } from '../lib/method/blocks.js';
import { formatBasisBadge, type PlanGrounding } from '../lib/research/planGrounding.js';
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

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
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

function groundingFromGoal(goal: {
  id: string;
  methodKind?: string | null;
  methodConfidence?: string | null;
  canonicalMethodName?: string | null;
  canonicalAuthority?: string | null;
  canonicalSourceUrl?: string | null;
  teachings?: unknown;
  workBlocks?: unknown;
  allowedUrls?: unknown;
  velocityTable?: unknown;
}): PlanGrounding | undefined {
  if (!goal.methodKind && !goal.methodConfidence) return undefined;
  return {
    methodKind: goal.methodKind ?? undefined,
    methodConfidence: goal.methodConfidence ?? 'first_principles',
    methodName: goal.canonicalMethodName ?? undefined,
    authority: goal.canonicalAuthority ?? undefined,
    sourceUrl: goal.canonicalSourceUrl ?? undefined,
    teachings: asStringList(goal.teachings),
    workKinds: cleanWorkKinds((goal.workBlocks as { kinds?: unknown } | null)?.kinds),
    blocks: cleanBlocks((goal.workBlocks as { blocks?: unknown } | null)?.blocks),
    assumptions: undefined,
    allowedUrls: asStringList(goal.allowedUrls),
    velocityTable: clampedTable(goal.velocityTable, goal.id),
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
      roadmap: JSON.parse(JSON.stringify(storedRoadmap(roadmap, input.answerList))),
    },
  });
  await prisma.roadmapWeek.createMany({
    data: roadmapWeekRows(goal.id, roadmap, input.routine.dailyMinutes!, input.routine.planVariant as PlanVariant),
  });
  await prisma.dailyTask.createMany({ data: dailyTaskRows(goal.id, 1, input.week1) });
  return goal.id;
}

async function saveV1PresetGoal(input: {
  userId: string;
  rawGoal: string;
  clarifiedOutcome: string;
  plan: PlanGenerationResult;
  answers: Record<string, string>;
  routine: UserRoutineInput;
  start: Date;
  targetDate: Date;
}): Promise<string> {
  const { plan } = input;
  await archiveActiveGoals(input.userId);
  const goal = await prisma.goal.create({
    data: {
      userId: input.userId,
      rawGoal: input.rawGoal,
      clarifiedOutcome: plan.clarifiedOutcome || input.clarifiedOutcome,
      methodologyNotes: plan.methodologyNotes || '',
      status: 'active',
      startDate: input.start,
      targetDate: input.targetDate,
      currentWeek: 1,
      answers: JSON.stringify(input.answers),
      routine: JSON.stringify(input.routine),
      isGoldenRail: true,
    },
  });
  await prisma.roadmapWeek.createMany({
    data: plan.weeks.map((w) => ({
      goalId: goal.id,
      weekNumber: w.weekNumber,
      phase: w.phase,
      theme: w.theme,
      objective: w.objective,
      keyMilestone: w.keyMilestone,
      targetIntensity: w.targetIntensity,
      plannedMinutes: w.plannedMinutes,
      status: w.weekNumber === 1 ? 'active' : 'pending',
    })),
  });
  await prisma.dailyTask.createMany({
    data: plan.initialTasks.map((t, idx) => {
      const taskDate = new Date(input.start);
      taskDate.setDate(taskDate.getDate() + idx);
      return {
        goalId: goal.id,
        weekNumber: 1,
        dayNumber: idx + 1,
        date: taskDate.toISOString().split('T')[0],
        dayOfWeek: t.dayOfWeek,
        title: t.title,
        isRestDay: t.isRestDay,
        durationMinutes: t.durationMinutes,
        slotTime: t.slotTime,
        implementationIntention: t.implementationIntention,
        detailedSteps: JSON.stringify(t.detailedSteps),
        resourceTitle: t.resourceTitle || null,
        resourceUrl: t.resourceUrl || null,
        resourceType: t.resourceType || 'guide',
        resourceWhy: t.resourceWhy || null,
        status: 'pending',
      };
    }),
  });
  return goal.id;
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

    const start = startDate ? new Date(startDate) : new Date();
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + 90);

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
    if (roadmapResult.ok) {
      const { roadmap } = roadmapResult;
      send?.({ type: 'step', id: 'method', label: roadmap.method.name, detail: roadmap.method.whyChosen });
      send?.({ type: 'step', id: 'plan', label: 'Writing your first week' });
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
      });
    } else if (preset && (roadmapResult.ok || !roadmapResult.unsafe)) {
      console.warn('[GoalRouter] v2 plan failed for a preset; using its fixed plan.');
      send?.({ type: 'step', id: 'plan', label: 'Writing your first week' });
      createdGoalId = await saveV1PresetGoal({
        userId: user.id,
        rawGoal,
        clarifiedOutcome,
        plan: presetFixedPlan(preset, routineInput, start),
        answers: answers || {},
        routine: routineInput,
        start,
        targetDate,
      });
    } else {
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

    if (!activeGoal) {
      res.json({ activeGoal: null });
      return;
    }

    res.json({ activeGoal: presentGoal(activeGoal as unknown as Record<string, unknown>) });
  } catch (err: any) {
    console.error('[GoalRouter] Fetch active goal error:', err);
    res.status(500).json({ error: 'Failed to fetch active goal.' });
  }
});

/**
 * PATCH /api/goal/tasks/:taskId
 * Updates task completion status or notes.
 */
goalRouter.patch('/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { taskId } = req.params;
    const { status, notes, slotTime } = req.body;

    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: { goal: true }
    });

    if (!task || task.goal.userId !== user.id) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const updated = await prisma.dailyTask.update({
      where: { id: taskId },
      data: {
        ...(status ? { status } : {}),
        completedAt: status === 'completed' ? new Date() : status === 'pending' ? null : task.completedAt,
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

/**
 * POST /api/goal/weeks/:weekNumber/review
 * Submits weekly review, computes adherence score against 85% target,
 * and dynamically adapts/generates the next week's tasks.
 */
goalRouter.post('/weeks/:weekNumber/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const weekNum = parseInt(req.params.weekNumber, 10);
    const { reflection } = req.body;

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

    if (goal.planVersion === 2) {
      const stored = readStoredRoadmap(goal);
      const practice = goal.dailyTasks.filter((t) => !t.isRestDay);
      const planned = practice.length || 1;
      const completed = practice.filter((t) => t.status === 'completed').length;
      const score = Math.round((completed / planned) * 100);
      const nextWeek = weekNum + 1;

      let nextTasks: Awaited<ReturnType<typeof saveWeekTasks>> = [];
      let written: WeekDayPlan[] | null = null;
      if (nextWeek <= TOTAL_WEEKS) {
        written = await writeNextWeek(goal, weekNum, goal.dailyTasks, slotTimeFor(readRoutine(goal).preferredSlot));
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
        data: { status: 'completed', executionScore: score, reviewNotes: reflection || '' },
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
      });
      return;
    }

    const weekTasks = goal.dailyTasks;
    const activeTasks = weekTasks.filter(t => !t.isRestDay);
    const plannedCount = activeTasks.length || 1;
    const completedCount = activeTasks.filter(t => t.status === 'completed').length;
    const scorePercentage = Math.round((completedCount / plannedCount) * 100);

    // Record review
    const review = await prisma.weeklyReview.upsert({
      where: {
        goalId_weekNumber: {
          goalId: goal.id,
          weekNumber: weekNum
        }
      },
      update: {
        tasksPlanned: plannedCount,
        tasksCompleted: completedCount,
        scorePercentage,
        reflection: reflection || '',
        aiAdaptationInsight: scorePercentage >= 85
          ? 'Strong execution! Week paced for accelerated progression.'
          : 'Pacing adapted with consolidation drills to lock in fundamentals.'
      },
      create: {
        goalId: goal.id,
        weekNumber: weekNum,
        tasksPlanned: plannedCount,
        tasksCompleted: completedCount,
        scorePercentage,
        reflection: reflection || '',
        aiAdaptationInsight: scorePercentage >= 85
          ? 'Strong execution! Week paced for accelerated progression.'
          : 'Pacing adapted with consolidation drills to lock in fundamentals.'
      }
    });

    // Mark current week as completed in roadmap
    await prisma.roadmapWeek.update({
      where: {
        goalId_weekNumber: {
          goalId: goal.id,
          weekNumber: weekNum
        }
      },
      data: {
        status: 'completed',
        executionScore: scorePercentage,
        reviewNotes: reflection || ''
      }
    });

    // If next week exists (weekNum < 12), adapt & generate next week's daily tasks
    let nextWeekTasks: any[] = [];
    const nextWeekNum = weekNum + 1;

    if (nextWeekNum <= 12) {
      const nextWeekRoadmap = goal.roadmapWeeks.find(w => w.weekNumber === nextWeekNum);
      const parsedRoutine: UserRoutineInput = JSON.parse(goal.routine || '{}');

      // Calculate next week start date (7 days after weekNum start)
      const nextWeekStart = new Date(goal.startDate);
      nextWeekStart.setDate(nextWeekStart.getDate() + (nextWeekNum - 1) * 7);

      // Build granular audit of previous week's tasks to ground AI generation against actual execution
      const previousTasksAudit: PreviousWeekTaskSummary[] = weekTasks
        .sort((a, b) => a.dayNumber - b.dayNumber)
        .map(t => {
          let stepTitles: string[] = [];
          try {
            const parsed = JSON.parse(t.detailedSteps || '[]');
            if (Array.isArray(parsed)) {
              stepTitles = parsed.map((s: any) => s.title || '').filter(Boolean);
            }
          } catch {}

          return {
            dayNumber: t.dayNumber,
            dayOfWeek: t.dayOfWeek,
            title: t.title,
            isRestDay: t.isRestDay,
            status: t.status,
            notes: t.notes,
            stepTitles
          };
        });

      const adaptedTaskPlans = await adaptUpcomingWeekTasksWithAI(
        goal.rawGoal,
        nextWeekNum,
        nextWeekRoadmap?.theme || `Week ${nextWeekNum}`,
        nextWeekRoadmap?.objective || 'Accelerate mastery',
        scorePercentage,
        reflection || '',
        parsedRoutine,
        nextWeekStart,
        previousTasksAudit,
        groundingFromGoal(goal)
      );

      // Remove any existing placeholder tasks for next week
      await prisma.dailyTask.deleteMany({
        where: { goalId: goal.id, weekNumber: nextWeekNum }
      });

      // Insert adapted daily tasks
      nextWeekTasks = await Promise.all(
        adaptedTaskPlans.map((t, idx) => {
          const taskDate = new Date(nextWeekStart);
          taskDate.setDate(taskDate.getDate() + idx);
          const dateStr = taskDate.toISOString().split('T')[0];

          return prisma.dailyTask.create({
            data: {
              goalId: goal.id,
              weekNumber: nextWeekNum,
              dayNumber: (nextWeekNum - 1) * 7 + idx + 1,
              date: dateStr,
              dayOfWeek: t.dayOfWeek,
              title: t.title,
              isRestDay: t.isRestDay,
              durationMinutes: t.durationMinutes,
              slotTime: t.slotTime,
              implementationIntention: t.implementationIntention,
              detailedSteps: JSON.stringify(t.detailedSteps),
              resourceTitle: t.resourceTitle || null,
              resourceUrl: t.resourceUrl || null,
              resourceType: t.resourceType || 'guide',
              resourceWhy: t.resourceWhy || null,
              status: 'pending'
            }
          });
        })
      );

      // Advance active week
      await prisma.roadmapWeek.update({
        where: {
          goalId_weekNumber: {
            goalId: goal.id,
            weekNumber: nextWeekNum
          }
        },
        data: { status: 'active' }
      });

      await prisma.goal.update({
        where: { id: goal.id },
        data: { currentWeek: nextWeekNum }
      });
    }

    const isMilestoneCheckpoint = weekNum === 4 || weekNum === 8 || weekNum === 12;
    let milestoneGateTransition = null;
    if (weekNum === 4) {
      milestoneGateTransition = {
        completedPhase: 'Foundation',
        nextPhase: 'Acceleration',
        title: 'Phase 1 Foundation Milestone Gate Cleared!',
        benchmarkMet: scorePercentage >= 85
      };
    } else if (weekNum === 8) {
      milestoneGateTransition = {
        completedPhase: 'Acceleration',
        nextPhase: 'Mastery',
        title: 'Phase 2 Acceleration Milestone Gate Cleared!',
        benchmarkMet: scorePercentage >= 85
      };
    } else if (weekNum === 12) {
      milestoneGateTransition = {
        completedPhase: 'Mastery',
        nextPhase: 'Graduated',
        title: 'Phase 3 Mastery Capstone Verification Cleared!',
        benchmarkMet: scorePercentage >= 85
      };
    }

    res.json({
      review,
      scorePercentage,
      nextWeekNumber: nextWeekNum <= 12 ? nextWeekNum : null,
      nextWeekTasks,
      isMilestoneCheckpoint,
      milestoneGateTransition
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
