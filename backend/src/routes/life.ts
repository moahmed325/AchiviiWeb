import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  getOrCreateLifeStructure,
  updateLifeStructure,
  createRoutineBlock,
  updateRoutineBlock,
  deleteRoutineBlock,
  calculateAvailableWindows,
} from '../lib/life/lifeStructureEngine.js';
import {
  materializeDays,
  adaptTodaySchedule,
} from '../lib/life/dailyScheduler.js';
import {
  auditUserCapacity,
  updateAmbitionPriorities,
} from '../lib/life/multiAmbitionCoordinator.js';
import { recordSessionTelemetry, ingestEvidenceFromTelemetry } from '../lib/adaptive/execution/telemetryEngine.js';

export const lifeRouter = Router();

/**
 * GET /api/life/structure
 * Returns the user's LifeStructure and routine blocks.
 */
lifeRouter.get('/structure', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const structure = await getOrCreateLifeStructure(user.id);
    res.status(200).json(structure);
  } catch (err: any) {
    console.error('Error fetching life structure:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * PUT /api/life/structure
 * Updates wake_time, sleep_time, buffer_minutes, etc.
 */
lifeRouter.put('/structure', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const updated = await updateLifeStructure(user.id, req.body);
    res.status(200).json(updated);
  } catch (err: any) {
    console.error('Error updating life structure:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/life/routine
 * Adds a new routine block (e.g. Work, Commute, Family).
 */
lifeRouter.post('/routine', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const block = await createRoutineBlock(user.id, req.body);
    res.status(201).json(block);
  } catch (err: any) {
    console.error('Error creating routine block:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * PUT /api/life/routine/:id
 * Updates an existing routine block.
 */
lifeRouter.put('/routine/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const block = await updateRoutineBlock(req.params.id, req.body);
    res.status(200).json(block);
  } catch (err: any) {
    console.error('Error updating routine block:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /api/life/routine/:id
 * Removes a routine block.
 */
lifeRouter.delete('/routine/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    await deleteRoutineBlock(req.params.id);
    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Error deleting routine block:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/life/schedule/today
 * Returns today's integrated daily schedule (routines + ambition doses).
 */
lifeRouter.get('/schedule/today', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const todayStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const dayStart = new Date(todayStr + 'T00:00:00.000Z');
    const dayEnd = new Date(todayStr + 'T23:59:59.999Z');

    // Ensure today's schedule is materialized
    const forceRegenerate = req.query.forceRegenerate === 'true';
    await materializeDays(user.id, todayStr, todayStr, { forceRegenerate });

    const items = await prisma.dailyScheduleItem.findMany({
      where: {
        user_id: user.id,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      include: {
        user_goal: {
          select: {
            id: true,
            outcome_statement: true,
          },
        },
      },
      orderBy: { start_time: 'asc' },
    });

    const openWindows = await calculateAvailableWindows(user.id, todayStr);

    res.status(200).json({
      date: todayStr,
      items,
      open_windows: openWindows,
    });
  } catch (err: any) {
    console.error('Error fetching today schedule:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/life/schedule/week
 * Returns next 7 days of integrated schedule items.
 */
lifeRouter.get('/schedule/week', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const start = req.query.startDate
      ? new Date(req.query.startDate as string)
      : new Date();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const rangeStart = new Date(startStr + 'T00:00:00.000Z');
    const rangeEnd = new Date(endStr + 'T23:59:59.999Z');

    const forceRegenerate = req.query.forceRegenerate === 'true';
    await materializeDays(user.id, startStr, endStr, { forceRegenerate });

    const items = await prisma.dailyScheduleItem.findMany({
      where: {
        user_id: user.id,
        date: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      include: {
        user_goal: {
          select: {
            id: true,
            outcome_statement: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });

    res.status(200).json({
      startDate: startStr,
      endDate: endStr,
      items,
    });
  } catch (err: any) {
    console.error('Error fetching week schedule:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/life/schedule/adapt
 * Intraday delay handler: adapts uncompleted doses today with zero backlog debt.
 */
lifeRouter.post('/schedule/adapt', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { shiftMinutes = 30, reason, date } = req.body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const result = await adaptTodaySchedule(user.id, targetDate, shiftMinutes, reason);
    res.status(200).json(result);
  } catch (err: any) {
    console.error('Error adapting schedule:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/life/schedule/item/:id/status
 * Marks a schedule item as COMPLETED, IN_PROGRESS, or SKIPPED_INTENTIONAL.
 */
lifeRouter.post('/schedule/item/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { status, notes } = req.body;
    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED_INTENTIONAL'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const item = await prisma.dailyScheduleItem.findFirst({
      where: { id: req.params.id, user_id: user.id },
    });

    if (!item) {
      res.status(404).json({ error: 'Schedule item not found.' });
      return;
    }

    const updated = await prisma.dailyScheduleItem.update({
      where: { id: item.id },
      data: {
        status,
        completed_at: status === 'COMPLETED' ? new Date() : null,
      },
    });

    // If item was an ambition dose linked to a trajectory item, record closed-loop telemetry
    if (item.trajectory_item_id && status === 'COMPLETED') {
      try {
        let session = await prisma.session.findFirst({
          where: {
            OR: [
              { trajectory_item_id: item.trajectory_item_id },
              { user_goal_id: item.user_goal_id || undefined },
            ],
          },
        });
        if (!session && item.user_goal_id) {
          const firstTemplate = await prisma.taskTemplate.findFirst();
          if (firstTemplate) {
            session = await prisma.session.create({
              data: {
                user_goal_id: item.user_goal_id,
                task_template_id: firstTemplate.id,
                trajectory_item_id: item.trajectory_item_id,
                scheduled_date: item.date,
                start_time: item.start_time,
                end_time: item.end_time,
                status: 'DONE',
              },
            });
          }
        }
        if (session) {
          const telemetryResult = await recordSessionTelemetry(session.id, {
            executionState: 'COMPLETED',
            proofOfWorkText: notes || 'Completed via Daily Life Operating Workbench',
            durationMinutes: item.allocated_minutes || 60,
          });
          await ingestEvidenceFromTelemetry(session.user_goal_id, telemetryResult);
        }
      } catch (tErr) {
        console.warn('Telemetry recording notification:', tErr);
      }
    }

    res.status(200).json(updated);
  } catch (err: any) {
    console.error('Error updating item status:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * GET /api/life/capacity
 * Audits total weekly available hours vs committed ambitions.
 */
lifeRouter.get('/capacity', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const audit = await auditUserCapacity(user.id);
    res.status(200).json(audit);
  } catch (err: any) {
    console.error('Error auditing capacity:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/life/ambitions/prioritize
 * Re-ranks active ambitions.
 */
lifeRouter.post('/ambitions/prioritize', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { goalIds } = req.body;
    if (!Array.isArray(goalIds)) {
      res.status(400).json({ error: 'goalIds must be an array of goal ID strings.' });
      return;
    }

    const updated = await updateAmbitionPriorities(user.id, goalIds);
    res.status(200).json({ success: true, goals: updated });
  } catch (err: any) {
    console.error('Error prioritizing ambitions:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
