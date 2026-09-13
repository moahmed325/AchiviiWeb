import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  computeForecast,
  computeEvidenceConfidence,
  auditGoalIntegrity,
} from '../lib/adaptive/index.js';

export const progressRouter = Router();

// GET /api/progress - Compute canonical adaptive progress, capability mastery, and telemetry
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
        capabilities: {
          include: {
            evidences: true,
          },
        },
        trajectory_versions: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!activeGoal || !activeGoal.goal_catalog) {
      res.status(404).json({ error: 'No active goal found. Complete onboarding first.' });
      return;
    }

    // Run dynamic evaluations
    const forecast = await computeForecast(activeGoal.id);
    const confidence = await computeEvidenceConfidence(activeGoal.id);
    const integrity = await auditGoalIntegrity(activeGoal.id);

    // Active bottleneck capability
    const activeBottleneck = activeGoal.active_bottleneck_capability_id
      ? activeGoal.capabilities.find((c) => c.id === activeGoal.active_bottleneck_capability_id)
      : activeGoal.capabilities[0] || null;

    // Capability state counts
    const caps = activeGoal.capabilities || [];
    const verifiedCount = caps.filter((c) => c.state === 'ROBUST' || c.state === 'ESTABLISHED').length;
    const emergingCount = caps.filter((c) => c.state === 'EMERGING').length;
    const untestedCount = caps.filter((c) => c.state === 'UNTESTED').length;
    const regressedCount = caps.filter((c) => c.state === 'REGRESSED').length;
    const totalCaps = caps.length || 1;
    const capabilityMasteryPercentage = Math.round((verifiedCount / totalCaps) * 100);

    // Fetch execution sessions for telemetry inspection
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

    let completedMinutes = 0;
    let totalMinutes = 0;
    for (const s of sessions) {
      const dur = s.task_template?.session_duration_minutes || 45;
      totalMinutes += dur;
      if (s.status === 'DONE') {
        completedMinutes += dur;
      }
    }

    const now = new Date();
    const startDate = new Date(activeGoal.start_date);
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));

    const activeTrajectory = activeGoal.trajectory_versions[0];
    const targetDate = activeTrajectory?.projected_completion || activeGoal.target_end_date;
    const daysRemaining = Math.max(0, Math.ceil((new Date(targetDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

    const currentWeekOffset = Math.max(0, Math.min(11, Math.floor((now.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))));

    res.status(200).json({
      // Canonical Adaptive Model
      outcomeStatement: activeGoal.outcome_statement || activeGoal.goal_catalog.title,
      goalIntegrityStatus: integrity.status,
      feasibilityZone: activeGoal.feasibility_zone,
      confidenceLevel: confidence,
      projectedCompletionWindow: `Day ${forecast.projectedWindowDays[0]}–${forecast.projectedWindowDays[1]}`,
      projectedCompletionDate: forecast.projectedCompletionDate,
      activeBottleneck: activeBottleneck
        ? {
            id: activeBottleneck.id,
            name: activeBottleneck.name,
            state: activeBottleneck.state,
            description: activeBottleneck.description,
          }
        : null,
      sustainableCapacityHours: activeGoal.sustainable_weekly_capacity_hours,
      medHours: activeGoal.current_med_hours,
      reliabilityMarginHours: activeGoal.current_reliability_margin_hours,
      capabilityMasteryPercentage,
      capabilities: caps.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        tier: c.tier,
        state: c.state,
        evidenceCount: c.evidences?.length || 0,
      })),
      // Execution Telemetry (telemetry only, does not determine destination success)
      executionTelemetry: {
        totalSessions,
        completedSessions,
        upcomingSessions,
        rescheduledSessions,
        missedSessions,
        taskCompletionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
        completedHours: parseFloat((completedMinutes / 60).toFixed(1)),
        totalHours: parseFloat((totalMinutes / 60).toFixed(1)),
        currentWeek: currentWeekOffset + 1,
        totalWeeks: 12,
        daysElapsed,
        daysRemaining,
      },
      goal: {
        id: activeGoal.id,
        title: activeGoal.outcome_statement || activeGoal.goal_catalog.title,
        startDate: startDate.toISOString(),
        projectedTargetDate: new Date(targetDate).toISOString(),
        slippageDays: 0,
      },
    });
  } catch (error: any) {
    console.error('Fetch goal progress error:', error);
    res.status(500).json({ error: 'Failed to retrieve goal progress.' });
  }
});
