import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { generateRoadmapVariants } from '../lib/planner.js';
import { generateThreeMonthSchedule } from '../lib/scheduler.js';

export const roadmapsRouter = Router();

// GET /api/roadmaps
roadmapsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
      include: { roadmaps: true },
    });

    if (!activeGoal) {
      res.status(404).json({ error: 'No active goal found.' });
      return;
    }

    res.status(200).json({
      roadmaps: activeGoal.roadmaps,
      selected_roadmap_id: activeGoal.selected_roadmap_id,
    });
  } catch (error: any) {
    console.error('Failed to get roadmaps:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve roadmaps.' });
  }
});

// POST /api/roadmaps/generate
roadmapsRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { user_goal_id } = req.body;
    if (!user_goal_id) {
      res.status(400).json({ error: 'Missing required field: user_goal_id' });
      return;
    }

    const goal = await prisma.userGoal.findFirst({
      where: { id: user_goal_id, user_id: user.id },
    });

    if (!goal) {
      res.status(404).json({ error: 'Goal not found or does not belong to user.' });
      return;
    }

    // Generate variants via Planner AI role (with constraint validation & deterministic fallback)
    const variants = await generateRoadmapVariants(user_goal_id);

    // Clean up any previously unselected roadmaps for this goal
    await prisma.roadmap.deleteMany({
      where: {
        user_goal_id,
        id: { not: goal.selected_roadmap_id || '' },
      },
    });

    const savedRoadmaps = [];
    for (const v of variants) {
      const created = await prisma.roadmap.create({
        data: {
          user_goal_id,
          name: v.name,
          description: v.description,
          trade_offs: v.trade_offs,
          days_per_week: v.days_per_week,
          daily_minutes_variance: v.daily_minutes_variance,
          phase_emphasis: v.phase_emphasis,
        },
      });
      savedRoadmaps.push(created);
    }

    res.status(201).json({
      message: 'Roadmap variants generated successfully.',
      roadmaps: savedRoadmaps,
    });
  } catch (error: any) {
    console.error('Failed to generate roadmaps:', error);
    res.status(500).json({ error: error.message || 'Failed to generate roadmaps.' });
  }
});

// POST /api/roadmaps/:id/select
roadmapsRouter.post('/:id/select', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: { user_goal: true },
    });

    if (!roadmap || roadmap.user_goal.user_id !== user.id) {
      res.status(404).json({ error: 'Roadmap not found or does not belong to user.' });
      return;
    }

    // Set selected roadmap
    const updatedGoal = await prisma.userGoal.update({
      where: { id: roadmap.user_goal_id },
      data: { selected_roadmap_id: roadmap.id },
    });

    // Modulate schedule with the chosen roadmap's parameters
    let sessionCount = 0;
    try {
      sessionCount = await generateThreeMonthSchedule(roadmap.user_goal_id, {
        preserveCompleted: true,
      });
    } catch (schedErr) {
      console.warn('[Roadmap Selection] Re-scheduling notice:', schedErr);
    }

    res.status(200).json({
      message: 'Roadmap selected and schedule customized successfully.',
      selected_roadmap: roadmap,
      user_goal: updatedGoal,
      session_count: sessionCount,
    });
  } catch (error: any) {
    console.error('Failed to select roadmap:', error);
    res.status(500).json({ error: error.message || 'Failed to select roadmap.' });
  }
});
