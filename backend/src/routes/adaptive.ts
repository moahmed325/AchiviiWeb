import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  generateInitialTrajectory,
  createExecutionObject,
  recordExecutionTelemetry,
  ingestEvidenceFromTelemetry,
  evaluateDeviation,
  generateDiagnosticPrompt,
  submitDiagnosis,
  replanFromCurrentState,
  computeForecast,
  computeEvidenceConfidence,
  auditGoalIntegrity,
  verifyOutcomeGate,
  formatUserFacingExplanation,
  generateWeeklyReview,
  generateMinimumViableDay,
  ExecutionState,
  DiagnosticCategory,
  RescheduleActionType,
  ProofType,
} from '../lib/adaptive/index.js';
import { getOrCreateLifeStructure } from '../lib/life/lifeStructureEngine.js';
import { materializeDays, cleanDoseTitle } from '../lib/life/dailyScheduler.js';
import { generateFieldManual } from '../lib/life/fieldManualEngine.js';

export const adaptiveRouter = Router();

/**
 * Helper to resolve the target goal ID from query params or active user goal
 */
async function resolveGoalId(req: Request, userId: string): Promise<string | null> {
  const queryGoalId = req.query.goalId as string | undefined;
  if (queryGoalId) return queryGoalId;

  const bodyGoalId = req.body?.userGoalId as string | undefined;
  if (bodyGoalId) return bodyGoalId;

  const activeGoal = await prisma.userGoal.findFirst({
    where: { user_id: userId, status: 'ACTIVE' },
    orderBy: { start_date: 'desc' },
  });

  return activeGoal ? activeGoal.id : null;
}

// 3. GET /api/adaptive/dashboard
adaptiveRouter.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const goalId = await resolveGoalId(req, user.id);
    if (!goalId) {
      res.status(404).json({ error: 'No active adaptive goal found. Please commit a goal first.' });
      return;
    }

    const userGoal = await prisma.userGoal.findUnique({
      where: { id: goalId },
      include: {
        capabilities: true,
        trajectory_versions: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!userGoal) {
      res.status(404).json({ error: `UserGoal with id "${goalId}" not found.` });
      return;
    }

    // Run dynamic evaluations
    const forecast = await computeForecast(goalId);
    const confidence = await computeEvidenceConfidence(goalId);
    const integrity = await auditGoalIntegrity(goalId);
    const mvdActions = await generateMinimumViableDay(goalId, new Date());

    // Latest plan update message
    const latestAudit = await prisma.replanAudit.findFirst({
      where: { user_goal_id: goalId },
      orderBy: { created_at: 'desc' },
    });

    const latestPlanUpdate = latestAudit
      ? formatUserFacingExplanation(latestAudit.decision_trace as any)
      : 'Your trajectory is active and progressing normally according to plan.';

    // Active bottleneck capability
    const activeBottleneck = userGoal.active_bottleneck_capability_id
      ? await prisma.goalCapability.findUnique({
          where: { id: userGoal.active_bottleneck_capability_id },
        })
      : userGoal.capabilities[0] || null;

    const marginHours =
      (userGoal.sustainable_weekly_capacity_hours ?? 6) - (userGoal.current_med_hours ?? 4.5);

    // Calculate current week from start_date
    const now = new Date();
    const startDate = userGoal.start_date ? new Date(userGoal.start_date) : now;
    const diffDays = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const currentWeek = Math.min(12, Math.floor(diffDays / 7) + 1);

    // Get active trajectory version items for current week
    const activeVersion = userGoal.trajectory_versions[0];
    let weekExecutionObjects: any[] = [];
    if (activeVersion) {
      const weekItems = await prisma.trajectoryItem.findMany({
        where: {
          trajectory_version_id: activeVersion.id,
          planned_week: currentWeek,
        },
        orderBy: { priority_tier: 'asc' },
      });

      // Also get any materialized sessions for this goal
      const sessions = await prisma.session.findMany({
        where: {
          user_goal_id: goalId,
        },
        include: {
          task_template: true,
        },
      });

      const sessionByTrajectoryItemId = new Map<string, any>();
      for (const s of sessions) {
        if (s.trajectory_item_id) {
          sessionByTrajectoryItemId.set(s.trajectory_item_id, s);
        }
      }

      weekExecutionObjects = weekItems.map((item, index) => {
        const linkedSession = sessionByTrajectoryItemId.get(item.id);
        return {
          id: item.id,
          sessionId: linkedSession?.id || null,
          targetCapabilityId: item.target_capability_id,
          plannedWeek: item.planned_week,
          priorityTier: item.priority_tier,
          standardDoseMinutes: item.standard_duration_minutes,
          reducedDoseMinutes: item.reduced_duration_minutes,
          mvsDoseMinutes: item.mvs_duration_minutes,
          scheduledDate: linkedSession?.scheduled_date ? linkedSession.scheduled_date.toISOString() : null,
          startTime: linkedSession?.start_time || null,
          endTime: linkedSession?.end_time || null,
          status: linkedSession?.status || 'UPCOMING',
          executionState: linkedSession?.execution_state || 'PLANNED',
          title: linkedSession?.task_template?.title || item.intervention_name || `Session ${index + 1}`,
          fallbackOptions: item.fallback_options ? (item.fallback_options as string[]) : [],
        };
      });
    }

    // Map capabilities
    const capabilities = userGoal.capabilities.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      tier: c.tier,
      state: c.state,
    }));

    res.status(200).json({
      userGoalId: userGoal.id,
      outcomeStatement: userGoal.outcome_statement,
      goalIntegrityStatus: integrity.status,
      feasibilityZone: userGoal.feasibility_zone,
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
      todayAction: mvdActions[0] || null,
      latestPlanUpdate,
      reliabilityMarginHours: Math.round(marginHours * 10) / 10,
      capabilities,
      currentWeekExecutionObjects: weekExecutionObjects,
      currentWeek,
      totalWeeks: 12,
    });
  } catch (error: any) {
    console.error('Error in /api/adaptive/dashboard:', error);
    res.status(500).json({ error: error.message || 'Internal server error fetching dashboard.' });
  }
});

// 4. POST /api/adaptive/telemetry/session
adaptiveRouter.post('/telemetry/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const { sessionId, executionState, proofOfWorkText, rpeRating, durationMinutes, notes } =
      req.body;

    if (!sessionId || !executionState) {
      res.status(400).json({ error: 'sessionId and executionState are required.' });
      return;
    }

    const telemetryResult = await recordExecutionTelemetry(sessionId, {
      executionState: executionState as ExecutionState,
      proofOfWorkText,
      rpeRating,
      durationMinutes,
      notes,
    });

    const evidenceResult = await ingestEvidenceFromTelemetry(
      telemetryResult.userGoalId,
      telemetryResult
    );

    const deviationReport = await evaluateDeviation(telemetryResult.userGoalId);

    res.status(200).json({ telemetryResult, evidenceResult, deviationReport });
  } catch (error: any) {
    console.error('Error in /api/adaptive/telemetry/session:', error);
    res.status(500).json({ error: error.message || 'Internal server error logging telemetry.' });
  }
});

// 5. GET /api/adaptive/diagnosis/pending
adaptiveRouter.get('/diagnosis/pending', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const goalId = await resolveGoalId(req, user.id);
    if (!goalId) {
      res.status(404).json({ error: 'No active goal found.' });
      return;
    }

    const deviationReport = await evaluateDeviation(goalId);

    if (deviationReport.severity === 'MATERIAL_DISRUPTION' || deviationReport.requiresDiagnostic) {
      const prompt = generateDiagnosticPrompt(goalId, deviationReport);
      res.status(200).json({ pending: true, prompt, deviationReport });
      return;
    }

    res.status(200).json({
      pending: false,
      deviationReport,
      message: 'No active diagnostic required. Trajectory execution is within normal variance.',
    });
  } catch (error: any) {
    console.error('Error in /api/adaptive/diagnosis/pending:', error);
    res.status(500).json({ error: error.message || 'Internal server error fetching pending diagnosis.' });
  }
});

// 6. POST /api/adaptive/diagnosis/submit
adaptiveRouter.post('/diagnosis/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const {
      userGoalId,
      category,
      triggerReason,
      details,
      isPersistent,
      newCapacityHours,
      suggestedAction,
    } = req.body;

    if (!userGoalId || !category || !details) {
      res.status(400).json({ error: 'userGoalId, category, and details are required.' });
      return;
    }

    const diagnosticRecord = await submitDiagnosis(userGoalId, {
      primaryCategory: category as DiagnosticCategory,
      details,
      isPersistent: isPersistent ?? false,
      updatedAvailableHours: newCapacityHours,
    });

    const replanResult = await replanFromCurrentState(userGoalId, diagnosticRecord);
    const userFacingExplanation = formatUserFacingExplanation(replanResult.decisionTrace);

    res.status(200).json({ diagnosticRecord, replanResult, userFacingExplanation });
  } catch (error: any) {
    console.error('Error in /api/adaptive/diagnosis/submit:', error);
    res.status(500).json({ error: error.message || 'Internal server error submitting diagnosis.' });
  }
});

// 7. GET /api/adaptive/weekly-review/:weekNumber
adaptiveRouter.get('/weekly-review/:weekNumber', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const goalId = await resolveGoalId(req, user.id);
    if (!goalId) {
      res.status(404).json({ error: 'No active goal found.' });
      return;
    }

    const weekNum = parseInt(req.params.weekNumber, 10);
    if (isNaN(weekNum) || weekNum < 1) {
      res.status(400).json({ error: 'Valid weekNumber is required (integer >= 1).' });
      return;
    }

    const review = await generateWeeklyReview(goalId, weekNum);
    res.status(200).json(review);
  } catch (error: any) {
    console.error('Error in /api/adaptive/weekly-review:', error);
    res.status(500).json({ error: error.message || 'Internal server error generating weekly review.' });
  }
});

// 8. POST /api/adaptive/outcome-gate/verify
adaptiveRouter.post('/outcome-gate/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const { userGoalId, capabilityId, proofType, confidenceWeight, payload } = req.body;

    if (!userGoalId) {
      res.status(400).json({ error: 'userGoalId is required.' });
      return;
    }

    if (capabilityId && proofType) {
      await prisma.capabilityEvidence.create({
        data: {
          capability_id: capabilityId,
          proof_type: proofType as ProofType,
          confidence_weight: confidenceWeight ?? 0.9,
          payload: payload || {},
          recorded_at: new Date(),
        },
      });
    }

    const gateStatus = await verifyOutcomeGate(userGoalId);
    res.status(200).json(gateStatus);
  } catch (error: any) {
    console.error('Error in /api/adaptive/outcome-gate/verify:', error);
    res.status(500).json({ error: error.message || 'Internal server error verifying outcome gate.' });
  }
});

// 9. GET /api/adaptive/session-field-manual/:itemId
adaptiveRouter.get('/session-field-manual/:itemId', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const { itemId } = req.params;
    if (!itemId) {
      res.status(400).json({ error: 'itemId is required.' });
      return;
    }

    // 1. Check if itemId is a DailyScheduleItem
    let dailyItem = await prisma.dailyScheduleItem.findUnique({
      where: { id: itemId },
      include: {
        trajectory_item: true,
        user_goal: {
          include: {
            goal_catalog: true,
          },
        },
      },
    });

    let trajectoryItem = dailyItem?.trajectory_item || null;
    let taskTitle = dailyItem?.title || '';
    let category = dailyItem?.category || dailyItem?.user_goal?.goal_catalog?.category || 'General';
    let durationMins = dailyItem?.allocated_minutes || dailyItem?.duration_minutes || 45;
    let goalContext = dailyItem?.user_goal?.outcome_statement || '';

    // 2. If not a daily item, check if it's a TrajectoryItem
    if (!dailyItem) {
      const traj = await prisma.trajectoryItem.findUnique({
        where: { id: itemId },
        include: {
          trajectory_version: {
            include: {
              user_goal: {
                include: {
                  goal_catalog: true,
                },
              },
            },
          },
        },
      });

      if (traj) {
        trajectoryItem = traj;
        taskTitle = traj.intervention_name;
        category = traj.trajectory_version.user_goal?.goal_catalog?.category || 'General';
        durationMins = traj.standard_duration_minutes || 45;
        goalContext = traj.trajectory_version.user_goal?.outcome_statement || '';
      }
    }

    if (!taskTitle) {
      taskTitle = 'Focused Execution Session';
    }

    // 3. Check if cached in fallback_options
    if (trajectoryItem?.fallback_options && Array.isArray(trajectoryItem.fallback_options)) {
      const manualEntry = (trajectoryItem.fallback_options as string[]).find(
        (f) => typeof f === 'string' && f.startsWith('FIELD_MANUAL: ')
      );
      if (manualEntry) {
        try {
          const parsed = JSON.parse(manualEntry.replace('FIELD_MANUAL: ', ''));
          res.status(200).json({ fieldManual: parsed });
          return;
        } catch {
          // parse failed, continue
        }
      }
    }

    // 4. Generate field manual via Gemini (or deterministic fallback)
    const fieldManual = await generateFieldManual(
      taskTitle,
      category,
      durationMins,
      goalContext,
      user.user_memory || undefined
    );

    // 5. Cache on trajectory item if present
    if (trajectoryItem) {
      try {
        const existingOptions = Array.isArray(trajectoryItem.fallback_options)
          ? (trajectoryItem.fallback_options as string[]).filter(
              (f) => typeof f === 'string' && !f.startsWith('FIELD_MANUAL: ')
            )
          : [];
        existingOptions.push(`FIELD_MANUAL: ${JSON.stringify(fieldManual)}`);

        await prisma.trajectoryItem.update({
          where: { id: trajectoryItem.id },
          data: { fallback_options: existingOptions },
        });
      } catch (cacheErr) {
        console.warn('Could not cache field manual on trajectoryItem:', cacheErr);
      }
    }

    res.status(200).json({ fieldManual });
  } catch (error: any) {
    console.error('Error in /api/adaptive/session-field-manual/:itemId:', error);
    res.status(500).json({ error: error.message || 'Internal server error generating session field manual.' });
  }
});

