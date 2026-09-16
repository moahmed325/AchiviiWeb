import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';

export const userGoalRouter = Router();
export const goalsRouter = Router();

// Dedicated Goal Discard / Terminate Handler
export async function handleDiscardGoal(req: Request, res: Response): Promise<void> {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;
    const goalId = id || req.body?.user_goal_id || req.body?.goalId;

    let targetGoal = null;
    if (!goalId || goalId === 'current') {
      targetGoal = await prisma.userGoal.findFirst({
        where: {
          user_id: user.id,
          status: { in: ['ACTIVE', 'active', 'IN_PROGRESS', 'in_progress'] },
        },
      });
    } else {
      targetGoal = await prisma.userGoal.findFirst({
        where: { id: goalId, user_id: user.id },
      });
    }

    if (!targetGoal) {
      res.status(404).json({
        error: 'GOAL_NOT_FOUND',
        message: 'Active goal not found or does not belong to user.',
      });
      return;
    }

    // Cleanly purge all associated sessions, schedule blocks, recovery telemetry, and user goal
    await prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { user_goal_id: targetGoal.id } });
      await tx.recoveryEvent.deleteMany({ where: { user_goal_id: targetGoal.id } });
      await tx.weeklyReview.deleteMany({ where: { user_goal_id: targetGoal.id } });
      await tx.roadmap.deleteMany({ where: { user_goal_id: targetGoal.id } });
      await tx.dailyScheduleItem.deleteMany({ where: { user_goal_id: targetGoal.id } });
      await tx.userGoal.delete({ where: { id: targetGoal.id } });
    });

    res.status(200).json({
      success: true,
      message: 'Protocol safely terminated and associated telemetry purged.',
      discarded_goal_id: targetGoal.id,
    });
  } catch (error: any) {
    console.error('Goal discard error:', error);
    res.status(500).json({ error: 'Failed to discard goal.' });
  }
}

// GET /api/user-goal/current
userGoalRouter.get('/current', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.userGoal.findFirst({
      where: {
        user_id: user.id,
        status: 'ACTIVE',
      },
      orderBy: { start_date: 'desc' },
      include: {
        goal_catalog: {
          include: {
            phases: {
              orderBy: { phase_order: 'asc' },
              include: { task_templates: true },
            },
          },
        },
      },
    });

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    res.status(200).json({
      user_goal: activeGoal,
      availability_slots: availabilitySlots,
    });
  } catch (error: any) {
    console.error('Fetch current user goal error:', error);
    res.status(500).json({ error: 'Failed to retrieve active user goal.' });
  }
});

// Discard endpoint bindings for userGoalRouter
userGoalRouter.delete('/current', handleDiscardGoal);
userGoalRouter.delete('/:id', handleDiscardGoal);
userGoalRouter.post('/discard', handleDiscardGoal);
userGoalRouter.post('/:id/discard', handleDiscardGoal);

// Discard endpoint bindings for goalsRouter
goalsRouter.delete('/current', handleDiscardGoal);
goalsRouter.delete('/:id', handleDiscardGoal);
goalsRouter.post('/discard', handleDiscardGoal);
goalsRouter.post('/:id/discard', handleDiscardGoal);
