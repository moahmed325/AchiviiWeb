// B-102: task completion and task updates, moved out of routes/goal.ts.
import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { getAuthUser } from '../auth.js';
import { getUserTodayDateString, normalizeTimezone } from '../../lib/timezone.js';
import { presentGoal } from './present.js';
import { refuse } from './actions.js';
import { shapeOf } from '../../lib/planLength.js';
import { readFeel } from '../../lib/planV2.js';

export const taskRoutes = Router();

taskRoutes.post('/complete', async (req: Request, res: Response): Promise<void> => {
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
      res.status(404).json({ error: 'No active goal found to complete.' });
      return;
    }

    // No weekly tests (2026-10-30): no final test; the closing reflection is all /complete saves.
    const { finalReflection } = req.body || {};

    if (typeof finalReflection === 'string' && finalReflection.trim()) {
      const targetReview =
        activeGoal.weeklyReviews?.find((r) => r.weekNumber === shapeOf(activeGoal).weeks) ||
        activeGoal.weeklyReviews?.[activeGoal.weeklyReviews.length - 1];
      if (targetReview) {
        await prisma.weeklyReview.update({
          where: { id: targetReview.id },
          data: { reflection: finalReflection.trim() }
        });
      }
    }

    const completedGoal = await prisma.goal.update({
      where: { id: activeGoal.id },
      data: {
        status: 'completed',
        completedAt: new Date()
      },
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

    const presented = presentGoal(completedGoal as unknown as Record<string, unknown>);
    res.json({ goal: presented, activeGoal: presented });
  } catch (err: any) {
    console.error('[GoalRouter] Complete goal error:', err);
    res.status(500).json({ error: 'Failed to complete goal.' });
  }
});

/** The only task statuses a client may set through PATCH /api/goal/tasks/:taskId (B-11). */
export const TASK_STATUSES = ['pending', 'completed'] as const;

export function isTaskStatus(value: unknown): value is (typeof TASK_STATUSES)[number] {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Longest new note PATCH /api/goal/tasks/:taskId stores (B-29); the frontend's note boxes use the same limit. */
export const TASK_NOTES_MAX_LENGTH = 2000;

/** How much one update may add to a note already near or over the limit: one Focus win line (B-29 follow-up). */
export const TASK_NOTES_MAX_GROWTH = TASK_NOTES_MAX_LENGTH + 100;

/** No update may grow a note past this, so repeated additions cannot grow a row without end. */
export const TASK_NOTES_HARD_MAX = 50_000;

/**
 * Whether `notes` may replace `stored` (B-29). Notes sent back unchanged always pass, so an old long note never stops
 * a step being marked done. A changed note passes when it is within the limit, or, when a note is already saved, when
 * it is at most one Focus win longer than that note (so an edit that shortens an old long note passes too) and under
 * the hard maximum. Today saves the free text and the Focus wins as one string, so an edit is not always an append.
 */
export function notesWithinLimit(notes: string, stored: string | null): boolean {
  if (notes === stored) return true;
  if (notes.length <= TASK_NOTES_MAX_LENGTH) return true;
  if (!stored) return false;
  return notes.length <= stored.length + TASK_NOTES_MAX_GROWTH && notes.length <= TASK_NOTES_HARD_MAX;
}

export const NOTES_ERROR = `notes must be text of at most ${TASK_NOTES_MAX_LENGTH} characters, or null.`;

/** A 24-hour "HH:MM" time, 00:00 to 23:59 (B-29). */
export const SLOT_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const FEEL_ERROR = 'feel must be "too_easy", "just_right" or "too_hard", or null, and only on a done task.';

/**
 * PATCH /api/goal/tasks/:taskId
 * Updates task completion status, notes, slot time or feel. `notes`, `slotTime` and `feel` accept null to clear them
 * (B-29). `feel` (no weekly tests, section 7) is how a done session felt, read when next week is written; it is only
 * for a done task, and marking a task not done clears it.
 */
taskRoutes.patch('/tasks/:taskId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { taskId } = req.params;
    const { status, notes, slotTime, usedMinimumVersion, feel } = req.body;

    if (status !== undefined && !isTaskStatus(status)) {
      res.status(400).json({ error: 'status must be "pending" or "completed".' });
      return;
    }

    if (usedMinimumVersion !== undefined && typeof usedMinimumVersion !== 'boolean') {
      res.status(400).json({ error: 'usedMinimumVersion must be a boolean.' });
      return;
    }

    if (notes !== undefined && notes !== null && typeof notes !== 'string') {
      res.status(400).json({ error: NOTES_ERROR });
      return;
    }

    if (slotTime !== undefined && slotTime !== null && (typeof slotTime !== 'string' || !SLOT_TIME.test(slotTime))) {
      res.status(400).json({ error: 'slotTime must be a time as "HH:MM" (00:00 to 23:59), or null.' });
      return;
    }

    if (feel !== undefined && feel !== null && readFeel(feel) === null) {
      res.status(400).json({ error: FEEL_ERROR });
      return;
    }

    const task = await prisma.dailyTask.findUnique({
      where: { id: taskId },
      include: { goal: true }
    });

    if (!task || task.goal.userId !== user.id) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (task.goal.status !== 'active') return refuse(res, 'goal_not_active');

    if (typeof notes === 'string' && !notesWithinLimit(notes, task.notes)) {
      res.status(400).json({ error: NOTES_ERROR });
      return;
    }

    // Sending `completed` again for a task already done keeps the first completion as it was (B-29).
    const statusChanges = status !== undefined && status !== task.status;

    if (feel != null && (status ?? task.status) !== 'completed') {
      res.status(400).json({ error: FEEL_ERROR });
      return;
    }

    // A day still ahead in the person's time zone cannot be completed; marking a day not done is always allowed.
    if (statusChanges && status === 'completed' && task.date > getUserTodayDateString(normalizeTimezone(user.timezone))) {
      return refuse(res, 'not_yet');
    }

    const updated = await prisma.dailyTask.update({
      where: { id: taskId },
      data: {
        ...(status ? { status } : {}),
        completedAt: !statusChanges ? task.completedAt : status === 'completed' ? new Date() : null,
        // ND-3: the flag describes the current completion, so it is rewritten only when
        // status changes, and is true only for a minimum completion of a task that has one.
        ...(statusChanges
          ? { usedMinimumVersion: status === 'completed' && usedMinimumVersion === true && task.minimumVersion != null }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(slotTime !== undefined ? { slotTime } : {}),
        // Marking a task not done clears how it felt; otherwise a sent feel (or null) replaces it.
        ...(statusChanges && status === 'pending' ? { feel: null } : feel !== undefined ? { feel } : {})
      }
    });

    res.json({ task: updated });
  } catch (err: any) {
    console.error('[GoalRouter] Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});
