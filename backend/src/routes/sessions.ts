import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { generateThreeMonthSchedule } from '../lib/scheduler.js';
import { detectAndRescheduleMissed } from '../lib/rescheduler.js';

export const sessionsRouter = Router();

// GET /api/sessions/week
sessionsRouter.get('/week', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    let activeGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
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

    if (!activeGoal || !activeGoal.goal_catalog) {
      res.status(404).json({ error: 'No active goal found. Please complete onboarding first.' });
      return;
    }

    // Run auto-reschedule check to detect any missed sessions and reallocate within-week or shift plan
    try {
      const rescheduleResult = await detectAndRescheduleMissed(activeGoal.id);
      if (rescheduleResult.rescheduledCount > 0) {
        // Refresh active goal data if slippage occurred
        const refreshed = await prisma.userGoal.findUnique({
          where: { id: activeGoal.id },
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
        if (refreshed) activeGoal = refreshed;
      }
    } catch (autoErr) {
      console.error('Auto-reschedule check failed:', autoErr);
    }

    // Determine week offset (0 = Week 1, 1 = Week 2, etc.)
    const goalStart = new Date(activeGoal.start_date);
    let weekOffset = parseInt(req.query.weekOffset as string, 10);

    if (isNaN(weekOffset)) {
      // Calculate current week offset based on today's date vs start date
      const now = new Date();
      const diffMs = now.getTime() - goalStart.getTime();
      const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      weekOffset = Math.max(0, Math.min(11, diffWeeks));
    } else {
      weekOffset = Math.max(0, Math.min(11, weekOffset));
    }

    const startOfGoal = new Date(goalStart.getFullYear(), goalStart.getMonth(), goalStart.getDate(), 0, 0, 0, 0);
    const weekStart = new Date(startOfGoal.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch sessions for this week
    const sessions = await prisma.session.findMany({
      where: {
        user_goal_id: activeGoal.id,
        scheduled_date: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      include: {
        task_template: {
          include: {
            phase: true,
          },
        },
      },
      orderBy: [
        { scheduled_date: 'asc' },
        { start_time: 'asc' },
      ],
    });

    // Determine current phase
    const phases = activeGoal.goal_catalog.phases;
    let currentPhase = phases[0];
    if (weekOffset >= 4 && weekOffset < 8 && phases.length > 1) {
      currentPhase = phases[1];
    } else if (weekOffset >= 8 && phases.length > 2) {
      currentPhase = phases[2];
    }

    // Fetch user availability slots for overlay
    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    res.status(200).json({
      weekOffset,
      weekNumber: weekOffset + 1,
      totalWeeks: 12,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      phase: currentPhase,
      goal: {
        id: activeGoal.id,
        title: activeGoal.goal_catalog.title,
        slippage_days: activeGoal.slippage_days,
        start_date: activeGoal.start_date,
        target_end_date: activeGoal.target_end_date,
      },
      sessions,
      availabilitySlots,
    });
  } catch (error: any) {
    console.error('Fetch week sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve weekly sessions.' });
  }
});

// GET /api/sessions/all
sessionsRouter.get('/all', async (req: Request, res: Response): Promise<void> => {
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

    const sessions = await prisma.session.findMany({
      where: { user_goal_id: activeGoal.id },
      include: {
        task_template: {
          include: { phase: true },
        },
      },
      orderBy: [
        { scheduled_date: 'asc' },
        { start_time: 'asc' },
      ],
    });

    res.status(200).json({
      totalSessions: sessions.length,
      sessions,
    });
  } catch (error: any) {
    console.error('Fetch all sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve all sessions.' });
  }
});

// POST /api/sessions/generate
sessionsRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
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
      res.status(404).json({ error: 'No active goal to generate schedule for.' });
      return;
    }

    const sessionCount = await generateThreeMonthSchedule(activeGoal.id);

    res.status(200).json({
      message: 'Schedule generated successfully.',
      sessionCount,
    });
  } catch (error: any) {
    console.error('Schedule generation error:', error);
    res.status(500).json({ error: 'Failed to generate schedule.' });
  }
});

// GET /api/sessions/day - Get sessions and routine for a specific day
sessionsRouter.get('/day', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD).' });
      return;
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format.' });
      return;
    }

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const activeGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
    });

    if (!activeGoal) {
      res.status(404).json({ error: 'No active goal found.' });
      return;
    }

    const sessions = await prisma.session.findMany({
      where: {
        user_goal_id: activeGoal.id,
        scheduled_date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        task_template: {
          include: { phase: true },
        },
      },
      orderBy: { start_time: 'asc' },
    });

    // Map day of week
    const jsDay = targetDate.getDay();
    const dayMap: Record<number, string> = {
      0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT'
    };
    const dayKey = dayMap[jsDay];

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id, day_of_week: dayKey },
      orderBy: { start_time: 'asc' },
    });

    res.status(200).json({
      date: date,
      dayKey,
      sessions,
      availabilitySlots,
    });
  } catch (error: any) {
    console.error('Fetch day sessions error:', error);
    res.status(500).json({ error: 'Failed to retrieve day sessions.' });
  }
});

// PATCH /api/sessions/:id - Update session status or scheduled time
sessionsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const { id } = req.params;
    const { status, scheduled_date, start_time, end_time } = req.body;

    // Verify session belongs to user
    const existingSession = await prisma.session.findUnique({
      where: { id },
      include: {
        user_goal: true,
      },
    });

    if (!existingSession) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }

    if (existingSession.user_goal.user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden: You do not own this session.' });
      return;
    }

    const updateData: any = {};

    if (status) {
      const validStatuses = ['UPCOMING', 'DONE', 'MISSED', 'RESCHEDULED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          error: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
        });
        return;
      }
      updateData.status = status;
    }

    let timeChanged = false;
    if (scheduled_date) {
      const parsedDate = new Date(scheduled_date);
      if (isNaN(parsedDate.getTime())) {
        res.status(400).json({ error: 'Invalid scheduled_date.' });
        return;
      }
      updateData.scheduled_date = parsedDate;
      timeChanged = true;
    }

    if (start_time) {
      updateData.start_time = start_time;
      timeChanged = true;
    }

    if (end_time) {
      updateData.end_time = end_time;
      timeChanged = true;
    }

    // Auto-mark status as RESCHEDULED if time/date shifted and user didn't explicitly mark DONE or MISSED
    if (timeChanged && (!status || status === 'UPCOMING')) {
      updateData.status = 'RESCHEDULED';
    }

    const updatedSession = await prisma.session.update({
      where: { id },
      data: updateData,
      include: {
        task_template: {
          include: { phase: true },
        },
      },
    });

    res.status(200).json({
      message: 'Session updated successfully.',
      session: updatedSession,
    });
  } catch (error: any) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session.' });
  }
});

// POST /api/sessions/reschedule - Manually or proactively run adaptive rescheduling
sessionsRouter.post('/reschedule', async (req: Request, res: Response): Promise<void> => {
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

    const { sessionId } = req.body || {};
    const result = await detectAndRescheduleMissed(activeGoal.id, sessionId);

    res.status(200).json({
      message: 'Adaptive rescheduling evaluated successfully.',
      result,
    });
  } catch (error: any) {
    console.error('Adaptive reschedule trigger error:', error);
    res.status(500).json({ error: 'Failed to run adaptive rescheduling.' });
  }
});

