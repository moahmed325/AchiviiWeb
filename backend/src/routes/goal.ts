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
import { isLocked } from '../lib/billing/accessGuard.js';
import { ALONGSIDE_STATUS, planOf, statusOf } from '../lib/plans.js';

/** ND-41: with no main plan left (finished, reset or replaced), the skill running alongside takes its place. */
async function promoteAlongsideIfAlone(userId: string): Promise<void> {
  const main = await prisma.goal.findFirst({ where: { userId, status: 'active' }, select: { id: true } });
  if (main) return;
  await prisma.goal.updateMany({ where: { userId, status: ALONGSIDE_STATUS }, data: { status: 'active' } });
}

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

    // ND-41: the skill running alongside, if any, comes with whichever plan is shown (read after it).
    const loadAlongside = () =>
      prisma.goal.findFirst({
        where: { userId: user.id, status: ALONGSIDE_STATUS },
        include: {
          roadmapWeeks: { orderBy: { weekNumber: 'asc' } },
          dailyTasks: { orderBy: { dayNumber: 'asc' } },
          weeklyReviews: { orderBy: { weekNumber: 'asc' } },
        },
      });
    const present = (goal: unknown) => (goal ? presentGoal(goal as Record<string, unknown>) : null);

    if (activeGoal) {
      res.json({ activeGoal: presentGoal(activeGoal as unknown as Record<string, unknown>), alongsideGoal: present(await loadAlongside()) });
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

    const alongside = await loadAlongside();
    if (completedGoal) {
      res.json({ activeGoal: presentGoal(completedGoal as unknown as Record<string, unknown>), alongsideGoal: present(alongside) });
      return;
    }

    // ND-41: no plan ever finished and none running as main: the skill alongside takes the main place.
    if (alongside) {
      await promoteAlongsideIfAlone(user.id);
      res.json({ activeGoal: presentGoal({ ...alongside, status: 'active' } as unknown as Record<string, unknown>), alongsideGoal: null });
      return;
    }

    res.json({ activeGoal: null, alongsideGoal: null });
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
    // ND-37: a plan paused after the trial is never moved on, so nothing is marked missed or carried.
    if (await isLocked(user)) {
      res.json({ applies: false, reason: 'trial_ended' });
      return;
    }
    // M2.2 carry-forward and M2.3 signals, shared with the M2.4 actions (lib/reconcileCore.ts). Idempotent
    // (04-phases.md 3.4): a handled day is never planned again, and each write is a compare-and-set (ND-13).
    // ND-41: the main plan, or the skill alongside it when the request says so.
    const goal = await loadReconcileGoal(user.id, planOf(req));
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
    // ND-41: resets the main plan, or the skill alongside it when the request says so. A reset main plan leaves the
    // skill alongside as the main plan.
    const role = planOf(req);
    await prisma.goal.deleteMany({
      where: { userId: user.id, status: statusOf(role) }
    });
    if (role === 'main') await promoteAlongsideIfAlone(user.id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('[GoalRouter] Delete active goal error:', err);
    res.status(500).json({ error: 'Failed to reset goal.' });
  }
});

/**
 * POST /api/goal/alongside/promote (ND-41)
 * Once the main plan has finished, the skill running alongside becomes the main plan. 409 while a main plan runs.
 */
goalRouter.post('/alongside/promote', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    const main = await prisma.goal.findFirst({ where: { userId: user.id, status: 'active' }, select: { id: true } });
    if (main) {
      res.status(409).json({ error: 'Your main plan is still running.', reason: 'main_running' });
      return;
    }
    const { count } = await prisma.goal.updateMany({ where: { userId: user.id, status: ALONGSIDE_STATUS }, data: { status: 'active' } });
    if (count === 0) {
      res.status(404).json({ error: 'No skill is running alongside.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[GoalRouter] Promote alongside error:', err);
    res.status(500).json({ error: 'Failed to make the skill your main plan.' });
  }
});

goalRouter.use(actionRoutes, taskRoutes, weekRoutes, scheduleRoutes);
