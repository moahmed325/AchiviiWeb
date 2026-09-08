import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { getPendingRecoveryState, executeRecoveryAction } from '../lib/recovery.js';

export const recoveryRouter = Router();

// GET /api/recovery/pending
recoveryRouter.get('/pending', async (req: Request, res: Response): Promise<void> => {
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

    const state = await getPendingRecoveryState(activeGoal.id);
    res.status(200).json(state);
  } catch (error: any) {
    console.error('Failed to get pending recovery state:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve recovery state.' });
  }
});

// POST /api/recovery/action
recoveryRouter.post('/action', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { user_goal_id, choice, details } = req.body;

    if (!user_goal_id || !choice) {
      res.status(400).json({ error: 'Missing required fields: user_goal_id and choice.' });
      return;
    }

    const validChoices = ['shrink_week', 'shift_timeline', 'scope_reduction', 'pause_goal'];
    if (!validChoices.includes(choice)) {
      res.status(400).json({ error: `Invalid choice. Must be one of: ${validChoices.join(', ')}` });
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

    const result = await executeRecoveryAction(user_goal_id, choice, details);
    res.status(200).json({
      message: 'Recovery action executed successfully.',
      ...result,
    });
  } catch (error: any) {
    console.error('Failed to execute recovery action:', error);
    res.status(500).json({ error: error.message || 'Failed to execute recovery action.' });
  }
});
