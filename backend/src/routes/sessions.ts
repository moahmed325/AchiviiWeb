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
  recordSessionTelemetry,
} from '../lib/adaptive/index.js';
import {
  materializeDays,
  findOptimalAmbitionWindow,
  cleanDoseTitle,
} from '../lib/life/dailyScheduler.js';
import { generateTaskExecutionGuide } from '../lib/life/taskGuideGenerator.js';
import {
  calculateAvailableWindows,
  getOrCreateLifeStructure,
  minutesToTime,
  timeToMinutes,
  normalizeDaysOfWeek,
} from '../lib/life/lifeStructureEngine.js';

export const sessionsRouter = Router();

function decorateSessionWithGuide(session: any, category?: string, outcome?: string) {
  if (!session) return session;
  if (session.task_template) {
    session.task_template.title = cleanDoseTitle(session.task_template.title);
    const duration = session.task_template.session_duration_minutes || 45;
    const cat = category || (session.user_goal as any)?.category || (session as any).category;
    const out = outcome || session.user_goal?.outcome_statement;
    const guide = generateTaskExecutionGuide(session.task_template.title, cat, duration, out);
    if (
      !session.task_template.description ||
      session.task_template.description === 'null' ||
      session.task_template.description.includes('Consolidates neural and physical retention') ||
      session.task_template.description.includes('Maintains continuity and momentum') ||
      session.task_template.description.includes('Develops the foundational stimulus')
    ) {
      session.task_template.description = guide.summary;
    }
    session.guide = guide;
  }
  return session;
}

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

    // Fetch user life structure (source of truth for routines and waking hours)
    const lifeStructure = await getOrCreateLifeStructure(user.id);

    // Fetch legacy availability slots or map routine blocks into availability slots
    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id },
      orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
    });

    const dayKeyMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const routineSlots: any[] = [];
    for (const block of lifeStructure.routine_blocks || []) {
      try {
        const days = normalizeDaysOfWeek(block.days_of_week);
        for (const d of days) {
          routineSlots.push({
            id: `routine-${block.id}-${d}`,
            day_of_week: dayKeyMap[d],
            start_time: block.start_time,
            end_time: block.end_time,
            label: block.title,
            category: block.category,
          });
        }
      } catch {
        // ignore
      }
    }
    const effectiveAvailabilitySlots = routineSlots.length > 0 ? routineSlots : availabilitySlots;

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

    // Determine user preferred window from blueprint metadata or user memory
    let prefWindow: 'MORNING' | 'AFTERNOON' | 'EVENING' | undefined;
    if (activeGoal.goal_catalog?.blueprint_metadata) {
      try {
        const meta = typeof activeGoal.goal_catalog.blueprint_metadata === 'string'
          ? JSON.parse(activeGoal.goal_catalog.blueprint_metadata)
          : activeGoal.goal_catalog.blueprint_metadata;
        prefWindow = meta.preferred_window;
      } catch {}
    }

    for (let i = 0; i < plannedItemsForWeek.length; i++) {
      const item = plannedItemsForWeek[i];
      const existingSession = await prisma.session.findFirst({
        where: { trajectory_item_id: item.id },
      });

      if (!existingSession && defaultTemplate) {
        // Space sessions through week e.g. Mon, Wed, Fri
        const dayOffset = Math.min(6, i * 2);
        const sessionDate = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const dateStr = sessionDate.toISOString().split('T')[0];

        // Calculate true open windows avoiding all routine blocks and sleep boundaries
        const availableWindows = await calculateAvailableWindows(user.id, dateStr);

        const optimal = findOptimalAmbitionWindow(availableWindows, {
          nominalMinutes: item.standard_duration_minutes,
          mvdMinutes: item.mvs_duration_minutes,
          preferredWindow: prefWindow || (item as any).preferred_window,
          userMemory: user.user_memory || undefined,
          energyRequirement: item.priority_tier === 1 ? 'HIGH' : 'MEDIUM',
        });

        const jsDay = sessionDate.getDay();
        let startTime = jsDay === 0 || jsDay === 6 ? '10:00' : '17:15';
        let endTime = jsDay === 0 || jsDay === 6 ? '10:45' : '18:00';

        if (optimal) {
          startTime = minutesToTime(optimal.startMins);
          endTime = minutesToTime(optimal.endMins);
        } else {
          // Fallback if no window found: place outside standard work hours (e.g. evening or weekend morning)
          startTime = prefWindow === 'EVENING' ? '18:30' : (jsDay === 0 || jsDay === 6 ? '10:00' : '17:15');
          const [sh, sm] = startTime.split(':').map(Number);
          const totalMinutes = (sh || 17) * 60 + (sm || 15) + item.standard_duration_minutes;
          const eh = Math.floor(totalMinutes / 60);
          const em = totalMinutes % 60;
          endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }

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

    // Decorate sessions with trajectory item intervention details (clean, simple title)
    const itemMap = new Map(activeTrajectory?.items?.map((i) => [i.id, i]) || []);
    for (const s of sessions) {
      if (s.trajectory_item_id && itemMap.has(s.trajectory_item_id)) {
        const item = itemMap.get(s.trajectory_item_id)!;
        if (s.task_template) {
          s.task_template.title = cleanDoseTitle(item.intervention_name);
          s.task_template.session_duration_minutes = item.standard_duration_minutes;
          let detailDesc = (item as any).description || '';
          if (!detailDesc && Array.isArray(item.fallback_options)) {
            const whyEntry = item.fallback_options.find((f: any) => typeof f === 'string' && f.startsWith('WHY_THIS_MATTERS: '));
            if (typeof whyEntry === 'string') {
              detailDesc = whyEntry.replace('WHY_THIS_MATTERS: ', '');
            }
          }
          (s.task_template as any).description = detailDesc;
        }
      }
      decorateSessionWithGuide(s, (activeGoal as any).category, activeGoal.outcome_statement || undefined);
    }

    // Auto-heal existing upcoming sessions that conflict with user's routine blocks (e.g. Work 09:00-17:00)
    for (const s of sessions) {
      if (s.status !== 'DONE' && s.scheduled_date && s.start_time && s.end_time) {
        const sDate = new Date(s.scheduled_date);
        const sDay = sDate.getDay();
        const sStart = timeToMinutes(s.start_time);
        const sEnd = timeToMinutes(s.end_time);

        const hasRoutineConflict = (lifeStructure.routine_blocks || []).some((b: any) => {
          const days = normalizeDaysOfWeek(b.days_of_week);
          if (!days.includes(sDay)) return false;
          const bStart = timeToMinutes(b.start_time) - (b.buffer_before_minutes || 0);
          const bEnd = timeToMinutes(b.end_time) + (b.buffer_after_minutes || 0);
          return sStart < bEnd && sEnd > bStart;
        });

        if (hasRoutineConflict) {
          const dateStr = sDate.toISOString().split('T')[0];
          const availableWindows = await calculateAvailableWindows(user.id, dateStr);
          const duration = s.task_template?.session_duration_minutes || 45;
          const optimal = findOptimalAmbitionWindow(availableWindows, {
            nominalMinutes: duration,
            mvdMinutes: Math.min(20, duration),
            preferredWindow: prefWindow,
            userMemory: user.user_memory || undefined,
            energyRequirement: s.tier === 'core' ? 'HIGH' : 'MEDIUM',
          });

          if (optimal) {
            s.start_time = minutesToTime(optimal.startMins);
            s.end_time = minutesToTime(optimal.endMins);
          } else {
            s.start_time = sDay === 0 || sDay === 6 ? '10:00' : '17:15';
            const [sh, sm] = s.start_time.split(':').map(Number);
            const totalMinutes = sh * 60 + sm + duration;
            const eh = Math.floor(totalMinutes / 60);
            const em = totalMinutes % 60;
            s.end_time = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          }

          await prisma.session.update({
            where: { id: s.id },
            data: {
              start_time: s.start_time,
              end_time: s.end_time,
            },
          });
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
      availabilitySlots: effectiveAvailabilitySlots,
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

    for (const s of sessions) {
      decorateSessionWithGuide(s, (activeGoal as any).category, activeGoal.outcome_statement || undefined);
    }

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

    const todayStr = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    await materializeDays(user.id, todayStr, nextWeek);
    const sessionCount = await prisma.dailyScheduleItem.count({ where: { user_id: user.id } });

    res.status(200).json({
      message: 'Schedule materialized successfully.',
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

    for (const s of sessions) {
      decorateSessionWithGuide(s, (activeGoal as any).category, activeGoal.outcome_statement || undefined);
    }

    // Map day of week in user timezone
    const dayKey = getZonedTimeParts(startOfDay, userTimezone).dayKey;

    const lifeStructure = await getOrCreateLifeStructure(user.id);
    const dayIdx = new Date(startOfDay).getDay();
    const dayKeyMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const routineSlots: any[] = [];
    for (const block of lifeStructure.routine_blocks || []) {
      try {
        const days = normalizeDaysOfWeek(block.days_of_week);
        if (days.includes(dayIdx)) {
          routineSlots.push({
            id: `routine-${block.id}-${dayIdx}`,
            day_of_week: dayKeyMap[dayIdx],
            start_time: block.start_time,
            end_time: block.end_time,
            label: block.title,
            category: block.category,
          });
        }
      } catch {}
    }

    const availabilitySlots = await prisma.availabilitySlot.findMany({
      where: { user_id: user.id, day_of_week: dayKey },
      orderBy: { start_time: 'asc' },
    });

    const effectiveAvailabilitySlots = routineSlots.length > 0 ? routineSlots : availabilitySlots;

    res.status(200).json({
      date: date,
      dayKey,
      sessions,
      availabilitySlots: effectiveAvailabilitySlots,
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

    if (status === 'DONE') {
      if (existingSession.trajectory_item_id) {
        await prisma.dailyScheduleItem.updateMany({
          where: { trajectory_item_id: existingSession.trajectory_item_id },
          data: { status: 'COMPLETED', completed_at: new Date() },
        });
      }

      try {
        await recordSessionTelemetry(existingSession.trajectory_item_id || existingSession.id, {
          executionState: 'COMPLETED',
          proofOfWorkText: req.body.notes || 'Completed via Session Schedule',
          durationMinutes: existingSession.task_template?.session_duration_minutes || 60,
        });
      } catch (tErr) {
        console.warn('Session completion telemetry notice:', tErr);
      }
    }

    decorateSessionWithGuide(updatedSession, (existingSession.user_goal as any)?.category, existingSession.user_goal?.outcome_statement || undefined);

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

