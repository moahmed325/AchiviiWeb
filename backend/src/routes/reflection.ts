import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { getPendingWeeklyReflection, submitWeeklyReflection } from '../lib/reflection.js';

export const reflectionRouter = Router();

// GET /api/reflection/pending
reflectionRouter.get('/pending', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
    });

    if (!activeGoal) {
      res.status(404).json({ error: 'No active goal found.' });
      return;
    }

    const thresholdParam = req.query.threshold ? parseFloat(req.query.threshold as string) : undefined;
    const pendingReflection = await getPendingWeeklyReflection(activeGoal.id, thresholdParam);

    res.status(200).json(pendingReflection);
  } catch (error: any) {
    console.error('Failed to get pending weekly reflection:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve reflection state.' });
  }
});

// POST /api/reflection/response
reflectionRouter.post('/response', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { user_goal_id, week_number, reflection_type, responses } = req.body;

    if (!user_goal_id || !week_number || !reflection_type) {
      res.status(400).json({ error: 'Missing required fields: user_goal_id, week_number, reflection_type.' });
      return;
    }

    if (!['single_tap', 'full'].includes(reflection_type)) {
      res.status(400).json({ error: 'Invalid reflection_type. Must be single_tap or full.' });
      return;
    }

    // Verify ownership
    const goal = await prisma.userGoal.findFirst({
      where: { id: user_goal_id, user_id: user.id },
    });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found or does not belong to the current user.' });
      return;
    }

    const result = await submitWeeklyReflection(
      user_goal_id,
      parseInt(week_number, 10),
      reflection_type,
      responses
    );

    res.status(200).json({
      message: 'Weekly reflection submitted successfully.',
      ...result,
    });
  } catch (error: any) {
    console.error('Failed to submit weekly reflection:', error);
    res.status(500).json({ error: error.message || 'Failed to submit reflection.' });
  }
});
