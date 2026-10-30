import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { loadReconcileGoal, runReconcile } from '../lib/reconcileCore.js';
import { presentGoal } from './goal/present.js';
import { createRoutes } from './goal/create.js';
import { actionRoutes } from './goal/actions.js';
import { taskRoutes } from './goal/tasks.js';
import { weekRoutes } from './goal/weeks.js';
import { scheduleRoutes } from './goal/schedule.js';

// Kept for the importers of routes/goal.js (tests, other modules).
export { TASK_STATUSES, TASK_NOTES_MAX_LENGTH, TASK_NOTES_HARD_MAX, notesWithinLimit } from './goal/tasks.js';

export const goalRouter = Router();
// B-102: each area's routes live in routes/goal/; the order they were declared in is kept.
goalRouter.use(createRoutes);

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

goalRouter.use(actionRoutes, taskRoutes, weekRoutes, scheduleRoutes);
