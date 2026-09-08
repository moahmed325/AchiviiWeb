import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';

export const progressRouter = Router();

// GET /api/progress - Compute overall progress, milestones, and timeline pacing
progressRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }

    const activeGoal = await prisma.userGoal.findFirst({
      where: { user_id: user.id, status: 'ACTIVE' },
      include: {
        goal_catalog: {
          include: {
            phases: {
              orderBy: { phase_order: 'asc' },
              include: {
                task_templates: true,
              },
            },
          },
        },
      },
    });

    if (!activeGoal || !activeGoal.goal_catalog) {
      res.status(404).json({ error: 'No active goal found. Complete onboarding first.' });
      return;
    }

    // Fetch all sessions for this goal
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

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === 'DONE').length;
    const upcomingSessions = sessions.filter((s) => s.status === 'UPCOMING').length;
    const rescheduledSessions = sessions.filter((s) => s.status === 'RESCHEDULED').length;
    const missedSessions = sessions.filter((s) => s.status === 'MISSED').length;

    const completionPercentage = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    // Hours calculation
    let completedMinutes = 0;
    let totalMinutes = 0;
    for (const s of sessions) {
      const dur = s.task_template?.session_duration_minutes || 60;
      totalMinutes += dur;
      if (s.status === 'DONE') {
        completedMinutes += dur;
      }
    }

    const completedHours = parseFloat((completedMinutes / 60).toFixed(1));
    const totalHours = parseFloat((totalMinutes / 60).toFixed(1));

    // Timeline calculation
    const now = new Date();
    const startDate = new Date(activeGoal.start_date);
    const projectedTargetDate = new Date(activeGoal.target_end_date);
    const originalTargetDate = new Date(startDate.getTime() + 84 * 24 * 60 * 60 * 1000);

    const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const daysRemaining = Math.max(0, Math.ceil((projectedTargetDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    let paceStatus: 'ON_TRACK' | 'BEHIND_PACE' | 'GUARDRAIL_ALERT' = 'ON_TRACK';
    if (activeGoal.slippage_days >= 14) {
      paceStatus = 'GUARDRAIL_ALERT';
    } else if (activeGoal.slippage_days > 0) {
      paceStatus = 'BEHIND_PACE';
    }

    // Phase breakdown
    const phaseBreakdown = activeGoal.goal_catalog.phases.map((phase) => {
      const templateIds = new Set(phase.task_templates.map((t) => t.id));
      const phaseSessions = sessions.filter((s) => templateIds.has(s.task_template_id));
      const phaseTotal = phaseSessions.length;
      const phaseCompleted = phaseSessions.filter((s) => s.status === 'DONE').length;
      const phasePercentage = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

      let status: 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING' = 'UPCOMING';
      if (phaseCompleted === phaseTotal && phaseTotal > 0) {
        status = 'COMPLETED';
      } else if (phaseCompleted > 0) {
        status = 'IN_PROGRESS';
      }

      return {
        id: phase.id,
        phase_order: phase.phase_order,
        title: phase.title,
        duration_weeks: phase.duration_weeks,
        totalSessions: phaseTotal,
        completedSessions: phaseCompleted,
        completionPercentage: phasePercentage,
        status,
        taskTemplates: phase.task_templates.map((t) => ({
          id: t.id,
          title: t.title,
          sessions_per_week: t.sessions_per_week,
          session_duration_minutes: t.session_duration_minutes,
        })),
      };
    });

    // Determine current active phase index
    const currentWeekOffset = Math.max(0, Math.min(11, Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))));
    let currentPhaseIndex = 0;
    if (currentWeekOffset >= 4 && currentWeekOffset < 8 && phaseBreakdown.length > 1) {
      currentPhaseIndex = 1;
    } else if (currentWeekOffset >= 8 && phaseBreakdown.length > 2) {
      currentPhaseIndex = 2;
    }

    // Simple velocity / recent activity
    const nonUpcomingSessions = sessions
      .filter((s) => s.status !== 'UPCOMING' && s.scheduled_date)
      .sort((a, b) => new Date(b.scheduled_date!).getTime() - new Date(a.scheduled_date!).getTime())
      .slice(0, 5);

    res.status(200).json({
      goal: {
        id: activeGoal.id,
        title: activeGoal.goal_catalog.title,
        description: activeGoal.goal_catalog.description,
        category: activeGoal.goal_catalog.category,
        icon: activeGoal.goal_catalog.icon,
        startDate: startDate.toISOString(),
        originalTargetDate: originalTargetDate.toISOString(),
        projectedTargetDate: projectedTargetDate.toISOString(),
        slippageDays: activeGoal.slippage_days,
        daysElapsed,
        daysRemaining,
        paceStatus,
      },
      metrics: {
        totalSessions,
        completedSessions,
        upcomingSessions,
        rescheduledSessions,
        missedSessions,
        completionPercentage,
        completedHours,
        totalHours,
        currentWeek: currentWeekOffset + 1,
        totalWeeks: 12,
        currentPhase: phaseBreakdown[currentPhaseIndex] || null,
      },
      phaseBreakdown,
      recentActivity: nonUpcomingSessions.map((s) => ({
        id: s.id,
        taskTitle: s.task_template?.title,
        scheduledDate: s.scheduled_date,
        startTime: s.start_time,
        endTime: s.end_time,
        status: s.status,
      })),
    });
  } catch (error: any) {
    console.error('Fetch goal progress error:', error);
    res.status(500).json({ error: 'Failed to retrieve goal progress.' });
  }
});
