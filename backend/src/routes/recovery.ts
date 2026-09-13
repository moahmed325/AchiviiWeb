import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  evaluateDeviation,
  replanFromCurrentState,
  formatUserFacingExplanation,
} from '../lib/adaptive/index.js';

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

    const deviationReport = await evaluateDeviation(activeGoal.id);
    const isPending = deviationReport.severity === 'MATERIAL_DISRUPTION' || deviationReport.requiresDiagnostic;

    res.status(200).json({
      pending: isPending,
      user_goal_id: activeGoal.id,
      trigger_reason: deviationReport.explanation,
      severity: deviationReport.severity,
      requiresDiagnostic: deviationReport.requiresDiagnostic,
    });
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

    const category = choice === 'shrink_week' ? 'CAPACITY' : choice === 'shift_timeline' ? 'EXTERNAL' : 'CAPACITY';
    const isPersistent = choice === 'scope_reduction';

    const replanResult = await replanFromCurrentState(user_goal_id, {
      primaryCategory: category,
      details: typeof details === 'string' ? details : `Recovery action requested: ${choice}`,
      isPersistent,
    });

    const userFacingExplanation = formatUserFacingExplanation(replanResult.decisionTrace);

    res.status(200).json({
      message: 'Adaptive recovery action executed with zero backlog debt.',
      success: true,
      choice,
      replanResult,
      userFacingExplanation,
    });
  } catch (error: any) {
    console.error('Failed to execute recovery action:', error);
    res.status(500).json({ error: error.message || 'Failed to execute recovery action.' });
  }
});
