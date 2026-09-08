import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  evaluateGraduationEligibility,
  handleGraduationChoice,
  resumePausedGoal,
  GraduationChoice,
} from '../lib/graduation.js';
import { getOnboardingLearnedDefaults, aggregateUserProfile } from '../lib/profile.js';

export const graduationRouter = Router();

// GET /api/graduation/status
graduationRouter.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const goalIdParam = req.query.user_goal_id as string | undefined;

    let targetGoalId = goalIdParam;
    if (!targetGoalId) {
      const activeGoal = await prisma.userGoal.findFirst({
        where: { user_id: user.id, status: { in: ['ACTIVE', 'PAUSED'] } },
        orderBy: { start_date: 'desc' },
      });
      targetGoalId = activeGoal?.id;
    }

    if (!targetGoalId) {
      res.status(200).json({
        eligible: false,
        message: 'No active or paused goal found for graduation evaluation.',
      });
      return;
    }

    const graduationState = await evaluateGraduationEligibility(targetGoalId);
    res.status(200).json(graduationState);
  } catch (error: any) {
    console.error('Graduation status check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check graduation status.' });
  }
});

// POST /api/graduation/choice
graduationRouter.post('/choice', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { user_goal_id, choice } = req.body;
    if (!user_goal_id || !choice) {
      res.status(400).json({ error: 'user_goal_id and choice are required.' });
      return;
    }

    const validChoices: GraduationChoice[] = ['start_new_goal', 'maintenance_mode', 'pause'];
    if (!validChoices.includes(choice)) {
      res.status(400).json({
        error: `Invalid choice. Allowed choices: ${validChoices.join(', ')}`,
      });
      return;
    }

    const result = await handleGraduationChoice({
      userId: user.id,
      userGoalId: user_goal_id,
      choice,
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Graduation choice error:', error);
    res.status(500).json({ error: error.message || 'Failed to process graduation choice.' });
  }
});

// POST /api/graduation/resume
graduationRouter.post('/resume', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { user_goal_id } = req.body;
    if (!user_goal_id) {
      res.status(400).json({ error: 'user_goal_id is required.' });
      return;
    }

    const result = await resumePausedGoal(user.id, user_goal_id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Resume goal error:', error);
    res.status(500).json({ error: error.message || 'Failed to resume goal.' });
  }
});

// GET /api/profile/learned-defaults
graduationRouter.get('/learned-defaults', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const defaults = await getOnboardingLearnedDefaults(user.id);
    res.status(200).json(defaults);
  } catch (error: any) {
    console.error('Learned defaults error:', error);
    res.status(500).json({ error: error.message || 'Failed to load learned defaults.' });
  }
});

// POST /api/profile/aggregate
graduationRouter.post('/aggregate', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const profile = await aggregateUserProfile(user.id);
    res.status(200).json(profile);
  } catch (error: any) {
    console.error('Profile aggregation error:', error);
    res.status(500).json({ error: error.message || 'Failed to aggregate profile.' });
  }
});
