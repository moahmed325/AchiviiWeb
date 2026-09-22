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
import { researchGoal } from '../lib/research/index.js';
import {
  formatMethodologyNotes,
  hasUsableSpine,
  researchToGrounding,
  type PlanGrounding,
} from '../lib/research/planGrounding.js';

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

    // Certified presets are already grounded. Custom goals research a spine first.
    let grounding: PlanGrounding | undefined;
    const preset = findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome);
    if (!preset) {
      const research = await researchGoal(clarifiedOutcome);
      grounding = researchToGrounding(research);
      if (!hasUsableSpine(grounding)) {
        res.status(503).json({
          error:
            'Could not find enough real sources to build this plan. Please retry in a moment.',
        });
        return;
      }
    }

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

    res.status(201).json({
      goal: fullGoal || createdGoal,
      roadmapWeeks: roadmapRecords,
      dailyTasks: taskRecords
    });
  } catch (err: any) {
    console.error('[GoalRouter] Create goal error:', err);
    res.status(503).json({ error: err.message || "Couldn't generate your plan right now. Please try again." });
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

    res.json({ activeGoal });
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
        previousTasksAudit
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
