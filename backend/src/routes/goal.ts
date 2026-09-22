import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  clarifyGoalWithAI,
  generate12WeekPlanWithAI,
  adaptUpcomingWeekTasksWithAI,
  UserRoutineInput,
  PreviousWeekTaskSummary
} from '../lib/ai/goalDecomposer.js';
import { findPresetForGoal } from '../lib/ai/presets/index.js';
import { pickMethod } from '../lib/method/pickMethod.js';
import { cleanDrills } from '../lib/method/drills.js';
import {
  formatBasisBadge,
  formatMethodologyNotes,
  hasUsableSpine,
  type PlanGrounding,
} from '../lib/research/planGrounding.js';
import { applySafetyClamps } from '../lib/research/safetyClamps.js';
import type { VelocityTable } from '../lib/research/types.js';

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
  drills?: unknown;
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
    drills: cleanDrills(goal.drills),
    assumptions: undefined,
    allowedUrls: asStringList(goal.allowedUrls),
    velocityTable: clampedTable(goal.velocityTable, goal.id),
  };
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

    const { rawGoal, clarifiedOutcome, answers, routine, startDate } = req.body;

    if (!rawGoal || !clarifiedOutcome) {
      res.status(400).json({ error: 'Goal and clarified outcome are required.' });
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
      dailyMinutes: routine?.dailyMinutes || 60,
      planVariant: routine?.planVariant || 'steady',
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

    // Certified presets are already grounded. Custom goals get a method chosen for this person.
    let grounding: PlanGrounding | undefined;
    const preset = findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome);
    send?.({
      type: 'step',
      id: 'search',
      label: preset ? 'Using a certified plan' : 'Comparing methods for your answers',
    });
    if (!preset) {
      const planVariant = routineInput.planVariant;
      const picked = await pickMethod({
        rawGoal,
        clarifiedOutcome,
        answers: answers || {},
        dailyMinutes: routineInput.dailyMinutes || 60,
        activeDaysPerWeek: planVariant === 'minimal' ? 4 : planVariant === 'accelerated' ? 6 : 5,
      });
      if (!picked.ok) {
        fail(503, picked.reason);
        return;
      }
      grounding = picked.grounding;
      if (grounding.velocityTable) {
        grounding = {
          ...grounding,
          velocityTable: applySafetyClamps(grounding.velocityTable, { source: 'fresh' }).table,
        };
      }
    }

    const basis = grounding ? formatBasisBadge(grounding) : null;
    send?.({
      type: 'step',
      id: 'method',
      label: preset ? preset.badge : basis?.label || 'Method chosen',
      detail: preset ? 'Certified plan' : grounding?.whyChosen,
    });
    send?.({ type: 'step', id: 'plan', label: 'Writing your first week' });

    const planResult = await generate12WeekPlanWithAI(
      rawGoal,
      clarifiedOutcome,
      answers || {},
      routineInput,
      start,
      { grounding }
    );

    // Archive any currently active goals for this user
    await prisma.goal.updateMany({
      where: { userId: user.id, status: 'active' },
      data: { status: 'archived' }
    });

    // Create the new Goal record
    const createdGoal = await prisma.goal.create({
      data: {
        userId: user.id,
        rawGoal,
        clarifiedOutcome: planResult.clarifiedOutcome || clarifiedOutcome,
        methodologyNotes: hasUsableSpine(grounding)
          ? formatMethodologyNotes(grounding!)
          : planResult.methodologyNotes || '',
        status: 'active',
        startDate: start,
        targetDate,
        currentWeek: 1,
        answers: JSON.stringify(answers || {}),
        routine: JSON.stringify(routineInput),
        isGoldenRail: hasUsableSpine(grounding),
        canonicalMethodName: grounding?.methodName ?? null,
        canonicalAuthority: grounding?.authority ?? null,
        canonicalSourceUrl: grounding?.sourceUrl ?? null,
        methodConfidence: grounding?.methodConfidence ?? null,
        methodKind: grounding?.methodKind ?? null,
        teachings: grounding?.teachings?.length ? JSON.parse(JSON.stringify(grounding.teachings)) : undefined,
        drills: grounding?.drills?.length ? JSON.parse(JSON.stringify(grounding.drills)) : undefined,
        allowedUrls: grounding?.allowedUrls?.length ? JSON.parse(JSON.stringify(grounding.allowedUrls)) : undefined,
        velocityTable: grounding?.velocityTable
          ? JSON.parse(JSON.stringify(grounding.velocityTable))
          : undefined,
      }
    });

    // Create the 12 Roadmap Weeks
    const roadmapRecords = await Promise.all(
      planResult.weeks.map(w =>
        prisma.roadmapWeek.create({
          data: {
            goalId: createdGoal.id,
            weekNumber: w.weekNumber,
            phase: w.phase,
            theme: w.theme,
            objective: w.objective,
            keyMilestone: w.keyMilestone,
            targetIntensity: w.targetIntensity,
            plannedMinutes: w.plannedMinutes,
            status: w.weekNumber === 1 ? 'active' : 'pending'
          }
        })
      )
    );

    // Create Week 1 Daily Tasks
    const taskRecords = await Promise.all(
      planResult.initialTasks.map((t, idx) => {
        const taskDate = new Date(start);
        taskDate.setDate(taskDate.getDate() + idx);
        const dateStr = taskDate.toISOString().split('T')[0];

        return prisma.dailyTask.create({
          data: {
            goalId: createdGoal.id,
            weekNumber: 1,
            dayNumber: idx + 1,
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

    const fullGoal = await prisma.goal.findUnique({
      where: { id: createdGoal.id },
      include: {
        roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
        dailyTasks: { orderBy: { dayNumber: 'asc' } },
        weeklyReviews: { orderBy: { weekNumber: 'asc' } }
      }
    });

    const saved = fullGoal || createdGoal;
    const body = {
      goal: presentGoal(saved as unknown as Record<string, unknown>),
      roadmapWeeks: roadmapRecords,
      dailyTasks: taskRecords,
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
