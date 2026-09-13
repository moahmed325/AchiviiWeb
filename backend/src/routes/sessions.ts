import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import { getZonedDateString, getZonedDayBounds, getZonedTimeParts } from '../lib/timezone.js';
import {
  evaluateDeviation,
  generateDiagnosticPrompt,
  replanFromCurrentState,
  formatUserFacingExplanation,
  generateInitialTrajectory,
  CapabilityStateGraph,
  persistStateGraph,
} from '../lib/adaptive/index.js';

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
        capabilities: true,
        trajectory_versions: {
          where: { is_active: true },
          include: { items: true },
          take: 1,
        },
      },
    });

    if (!activeGoal || !activeGoal.goal_catalog) {
      res.status(404).json({ error: 'No active goal found. Please complete onboarding first.' });
      return;
    }

    // Ensure active TrajectoryVersion exists
    let activeTrajectory = activeGoal.trajectory_versions[0];
    if (!activeTrajectory) {
      const graph = new CapabilityStateGraph();
      if (activeGoal.capabilities && activeGoal.capabilities.length > 0) {
        for (const c of activeGoal.capabilities) {
          graph.addCapability({
            id: c.id,
            userGoalId: activeGoal.id,
            name: c.name,
            description: c.description,
            tier: c.tier as any,
            state: c.state as any,
            prerequisites: (c.prerequisites_ids as string[]) || [],
          });
        }
      } else {
        const defaultCapId = `cap-${Date.now()}`;
        graph.addCapability({
          id: defaultCapId,
          userGoalId: activeGoal.id,
          name: activeGoal.outcome_statement || 'Foundational Capability',
          description: 'Core milestone execution',
          tier: 'TIER_1_CRITICAL',
          state: 'EMERGING',
          prerequisites: [],
        });
        await persistStateGraph(activeGoal.id, graph);
      }

      const traj = await generateInitialTrajectory(
        activeGoal.id,
        graph,
        {
          sustainableWeeklyHours: activeGoal.sustainable_weekly_capacity_hours || 6.0,
          medHours: 4.5,
          reliabilityMarginHours: Math.max(0, (activeGoal.sustainable_weekly_capacity_hours || 6.0) - 4.5),
          maxSessionDurationMinutes: 60,
        }
      );

      const reloaded = await prisma.trajectoryVersion.findUnique({
        where: { id: traj.id },
        include: { items: true },
      });
      if (reloaded) activeTrajectory = reloaded;
    }

    // Determine week offset (0 = Week 1, 1 = Week 2, etc.)
    const userTimezone = (user as any).timezone || 'UTC';
    const goalStart = new Date(activeGoal.start_date);
    let weekOffset = parseInt(req.query.weekOffset as string, 10);

    if (isNaN(weekOffset)) {
      const now = new Date();
      const diffMs = now.getTime() - goalStart.getTime();
      const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      weekOffset = Math.max(0, Math.min(11, diffWeeks));
    } else {
      weekOffset = Math.max(0, Math.min(11, weekOffset));
    }

    const weekNumber = weekOffset + 1;
    const goalStartDateStr = getZonedDateString(goalStart, userTimezone);
    const { startOfDay: startOfGoal } = getZonedDayBounds(goalStartDateStr, userTimezone);
    const weekStart = new Date(startOfGoal.getTime() + weekOffset * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch user availability slots
    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    // CANONICAL SCHEDULE PROJECTION:
    // Project week sessions from active TrajectoryVersion items for this planned week
    const plannedItemsForWeek = activeTrajectory?.items?.filter(
      (item) => item.planned_week === weekNumber
    ) || [];

    // Ensure sessions exist for each trajectory item of this week
    let defaultTemplate = await prisma.taskTemplate.findFirst();
    if (!defaultTemplate) {
      const defaultCatalog = await prisma.goalCatalog.findFirst();
      if (defaultCatalog) {
        const defaultPhase = await prisma.phase.findFirst({ where: { goal_catalog_id: defaultCatalog.id } });
        if (defaultPhase) {
          defaultTemplate = await prisma.taskTemplate.create({
            data: {
              phase_id: defaultPhase.id,
              title: 'Adaptive Session',
              sessions_per_week: 3,
              session_duration_minutes: 45,
            },
          });
        }
      }
    }

    const dayKeyMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < plannedItemsForWeek.length; i++) {
      const item = plannedItemsForWeek[i];
      const existingSession = await prisma.session.findFirst({
        where: { trajectory_item_id: item.id },
      });

      if (!existingSession && defaultTemplate) {
        // Space sessions through week e.g. Mon, Wed, Fri
        const dayOffset = Math.min(6, i * 2);
        const sessionDate = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dayName = dayKeyMap[sessionDate.getDay()];
        const matchingSlot = availabilitySlots.find((s) => s.day_of_week === dayName);

        const startTime = matchingSlot ? matchingSlot.start_time : '09:00';
        const [sh, sm] = startTime.split(':').map(Number);
        const totalMinutes = (sh || 9) * 60 + (sm || 0) + item.standard_duration_minutes;
        const eh = Math.floor(totalMinutes / 60);
        const em = totalMinutes % 60;
        const endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

        await prisma.session.create({
          data: {
            user_goal_id: activeGoal.id,
            task_template_id: defaultTemplate.id,
            trajectory_item_id: item.id,
            day_number: weekOffset * 7 + dayOffset + 1,
            sequence_order: i + 1,
            scheduled_date: sessionDate,
            start_time: startTime,
            end_time: endTime,
            status: 'UPCOMING',
            execution_state: 'PLANNED',
            tier: item.priority_tier === 1 ? 'core' : item.priority_tier === 2 ? 'buffer' : 'reflect',
          },
        });
      }
    }

    // Fetch projected sessions for this week
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

    // Decorate sessions with trajectory item intervention details
    const itemMap = new Map(activeTrajectory?.items?.map((i) => [i.id, i]) || []);
    for (const s of sessions) {
      if (s.trajectory_item_id && itemMap.has(s.trajectory_item_id)) {
        const item = itemMap.get(s.trajectory_item_id)!;
        if (s.task_template) {
          s.task_template.title = item.intervention_name;
          s.task_template.session_duration_minutes = item.standard_duration_minutes;
        }
      }
    }

    // Evaluate deviation canonically via Adaptive Deviation Detector
    let pendingDiagnosis = null;
    try {
      const deviationReport = await evaluateDeviation(activeGoal.id);
      if (deviationReport.severity === 'MATERIAL_DISRUPTION' || deviationReport.requiresDiagnostic) {
        const prompt = generateDiagnosticPrompt(activeGoal.id, deviationReport);
        pendingDiagnosis = { pending: true, prompt, deviationReport };
      }
    } catch (devErr) {
      console.error('Deviation evaluation error in /api/sessions/week:', devErr);
    }

    // Phase breakdown for navigation display
    const phases = activeGoal.goal_catalog.phases;
    let currentPhase = phases[0];
    if (weekOffset >= 4 && weekOffset < 8 && phases.length > 1) {
      currentPhase = phases[1];
    } else if (weekOffset >= 8 && phases.length > 2) {
      currentPhase = phases[2];
    }

    res.status(200).json({
      weekOffset,
      weekNumber,
      totalWeeks: 12,
      startDate: weekStart.toISOString(),
      endDate: weekEnd.toISOString(),
      phase: currentPhase,
      trajectoryVersion: {
        id: activeTrajectory?.id || 'v1',
        versionNumber: activeTrajectory?.version_number || 1,
        projectedCompletion: activeTrajectory?.projected_completion || activeGoal.target_end_date,
        confidenceScore: activeTrajectory?.confidence_score || 0.85,
      },
      goal: {
        id: activeGoal.id,
        title: activeGoal.outcome_statement || activeGoal.goal_catalog.title,
        slippage_days: 0,
        start_date: activeGoal.start_date,
        target_end_date: activeGoal.target_end_date,
        goal_integrity_status: activeGoal.goal_integrity_status,
      },
      sessions,
      availabilitySlots,
      pendingDiagnosis,
      pendingRecovery: pendingDiagnosis ? { pending: true, user_goal_id: activeGoal.id } : null,
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

    const userTimezone = (user as any).timezone || 'UTC';
    let startOfDay: Date;
    let endOfDay: Date;
    try {
      const bounds = getZonedDayBounds(date, userTimezone);
      startOfDay = bounds.startOfDay;
      endOfDay = bounds.endOfDay;
    } catch {
      res.status(400).json({ error: 'Invalid date format.' });
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

    // Map day of week in user timezone
    const dayKey = getZonedTimeParts(startOfDay, userTimezone).dayKey;

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
    const { status, scheduled_date, start_time, end_time, completed_at_utc, idempotency_token } = req.body;
    const idempotencyKey = (idempotency_token || req.headers['idempotency-key']) as string | undefined;

    // Verify session belongs to user
    const existingSession = await prisma.session.findUnique({
      where: { id },
      include: {
        user_goal: true,
        task_template: {
          include: { phase: true },
        },
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

    // Return cached response if idempotency token matches an already processed request
    if (idempotencyKey && existingSession.idempotency_token === idempotencyKey) {
      res.status(200).json({
        message: 'Session already updated with this idempotency token.',
        session: existingSession,
      });
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

      if (status === 'DONE') {
        // If client sends timestamp (e.g. offline sync), use it; otherwise use server now
        updateData.completed_at_utc = completed_at_utc ? new Date(completed_at_utc) : new Date();
        if (idempotencyKey) {
          updateData.idempotency_token = idempotencyKey;
        }
      } else {
        updateData.completed_at_utc = null;
        updateData.idempotency_token = null;
      }
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

    const replanResult = await replanFromCurrentState(activeGoal.id);
    const userFacingExplanation = formatUserFacingExplanation(replanResult.decisionTrace);

    res.status(200).json({
      message: 'Adaptive replan from current state executed successfully.',
      replanResult,
      userFacingExplanation,
      trajectoryVersionId: replanResult.newTrajectoryVersionId,
      newVersionNumber: replanResult.newVersionNumber,
    });
  } catch (error: any) {
    console.error('Adaptive reschedule trigger error:', error);
    res.status(500).json({ error: error.message || 'Failed to run adaptive rescheduling.' });
  }
});

