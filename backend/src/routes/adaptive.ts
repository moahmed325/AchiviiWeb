import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getAuthUser } from './auth.js';
import {
  formalizeGoal,
  evaluateFeasibility,
  CapabilityStateGraph,
  persistStateGraph,
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
import { generateMasterPlan } from '../lib/ai/masterPlanningPrompt.js';
import { getOrCreateLifeStructure } from '../lib/life/lifeStructureEngine.js';
import { materializeDays } from '../lib/life/dailyScheduler.js';

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

// 1. POST /api/adaptive/goal/formalize
adaptiveRouter.post('/goal/formalize', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const {
      rawGoal,
      domain,
      targetDeadline,
      deadlineType,
      startingBaselineScore,
      targetDifficultyScore,
      weeklyAvailableHours,
    } = req.body;

    if (!rawGoal || typeof rawGoal !== 'string' || !rawGoal.trim()) {
      res.status(400).json({ error: 'rawGoal is required and cannot be empty.' });
      return;
    }

    const formalization = await formalizeGoal({
      rawGoal: rawGoal.trim(),
      domain,
      targetDeadline: targetDeadline ? new Date(targetDeadline) : undefined,
      deadlineType: deadlineType || 'SOFT',
      weeklyAvailableHours: weeklyAvailableHours ? Number(weeklyAvailableHours) : undefined,
    });

    const feasibility = evaluateFeasibility({
      startingBaselineScore: startingBaselineScore ?? 20,
      targetDifficultyScore: targetDifficultyScore ?? 80,
      weeklyAvailableHours: weeklyAvailableHours ?? 6.0,
      domain: formalization.domain,
      deadlineDays: 90,
    });

    res.status(200).json({ formalization, feasibility });
  } catch (error: any) {
    console.error('Error in /api/adaptive/goal/formalize:', error);
    res.status(500).json({ error: error.message || 'Internal server error formalizing goal.' });
  }
});

// 1.5 POST /api/adaptive/master-plan/preview
adaptiveRouter.post('/master-plan/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const { blueprintId, questionnaireAnswers, startDate } = req.body;
    const blueprint = await prisma.goalCatalog.findUnique({
      where: { id: blueprintId },
      include: { phases: true },
    });

    if (!blueprint) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }

    const lifeStructure = await getOrCreateLifeStructure(user.id);
    const parsedStartDate = startDate ? new Date(startDate) : new Date();

    const result = await generateMasterPlan({
      blueprint,
      answers: questionnaireAnswers || {},
      lifeStructure,
      startDate: parsedStartDate,
    });

    res.status(200).json({ masterPlan: result.plan, rawPrompt: result.rawPrompt });
  } catch (error: any) {
    console.error('Error generating master plan preview:', error);
    res.status(500).json({ error: error.message || 'Failed to preview master plan' });
  }
});

// 2. POST /api/adaptive/goal/commit
adaptiveRouter.post('/goal/commit', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized. Authentication token required.' });
      return;
    }

    const {
      goalCatalogId,
      outcomeStatement,
      verificationCriteria,
      deadlineType = 'SOFT',
      domain = 'PHYSICAL',
      targetDeadline,
      startDate,
      sustainableWeeklyHours = 6.0,
      capabilities,
      availabilitySlots,
      questionnaireAnswers,
    } = req.body;

    if (!outcomeStatement || typeof outcomeStatement !== 'string' || !outcomeStatement.trim()) {
      res.status(400).json({ error: 'outcomeStatement is required.' });
      return;
    }

    // Resolve or find fallback goal catalog
    let catalogId = goalCatalogId;
    let catalogItem: any = null;
    if (catalogId) {
      catalogItem = await prisma.goalCatalog.findUnique({ where: { id: catalogId } });
    }
    if (!catalogItem) {
      catalogItem = await prisma.goalCatalog.findFirst();
      if (catalogItem) {
        catalogId = catalogItem.id;
      } else {
        const defaultCatalog = await prisma.goalCatalog.create({
          data: {
            title: '90-Day Adaptive Blueprint',
            description: 'Adaptive execution goal template',
            category: domain === 'PHYSICAL' ? 'FITNESS' : 'LEARNING',
            icon: 'target',
            est_weekly_hours: Number(sustainableWeeklyHours) || 6.0,
          },
        });
        catalogId = defaultCatalog.id;
        catalogItem = defaultCatalog;
      }
    }

    const parsedStartDate = startDate ? new Date(startDate) : new Date();
    const parsedTargetDate = targetDeadline
      ? new Date(targetDeadline)
      : new Date(parsedStartDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Fetch user's life structure
    const lifeStructure = await getOrCreateLifeStructure(user.id);

    // Build Capability State Graph & resolve capabilities
    const graph = new CapabilityStateGraph();
    let capsToCreate = capabilities && capabilities.length > 0 ? capabilities : null;

    if (!capsToCreate && catalogItem.blueprint_metadata) {
      try {
        const meta = typeof catalogItem.blueprint_metadata === 'string'
          ? JSON.parse(catalogItem.blueprint_metadata)
          : catalogItem.blueprint_metadata;
        if (Array.isArray(meta.capability_dag) && meta.capability_dag.length > 0) {
          capsToCreate = meta.capability_dag.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            tier: 'TIER_1_CRITICAL',
            prerequisites: d.prerequisites,
          }));
        }
      } catch {
        // ignore
      }
    }

    if (!capsToCreate) {
      capsToCreate = [
        {
          id: 'cap_baseline',
          name: 'Core Adaptation Baseline',
          description: 'Fundamental prerequisite capability',
          tier: 'TIER_1_CRITICAL',
        },
        {
          id: 'cap_stimulus',
          name: 'Progressive Stimulus Capacity',
          description: 'Target work capacity expansion',
          tier: 'TIER_1_CRITICAL',
        },
        {
          id: 'cap_mastery',
          name: 'Capstone Destination Mastery',
          description: outcomeStatement.trim(),
          tier: 'TIER_1_CRITICAL',
        },
      ];
    }

    // If questionnaireAnswers provided, run master planning engine with custom blueprint
    let masterPlan: any = null;
    if (questionnaireAnswers && Object.keys(questionnaireAnswers).length > 0) {
      try {
        const planningBlueprint = {
          id: catalogItem.id,
          title: outcomeStatement.trim() || catalogItem.title,
          category: catalogItem.category,
          est_weekly_hours: Number(sustainableWeeklyHours) || catalogItem.est_weekly_hours || 6.0,
          blueprint_metadata: {
            capability_dag: capsToCreate,
            nominal_session_duration_minutes: 45,
            minimum_viable_session_minutes: 20,
          },
        };
        const planResult = await generateMasterPlan({
          blueprint: planningBlueprint,
          answers: questionnaireAnswers,
          lifeStructure,
          startDate: parsedStartDate,
        });
        masterPlan = planResult.plan;
      } catch (err) {
        console.warn('Master planning prompt error, proceeding with baseline:', err);
      }
    }

    // Determine count of existing active goals to assign priority rank
    const existingActiveCount = await prisma.userGoal.count({
      where: { user_id: user.id, status: 'ACTIVE' },
    });

    const effectiveWeeklyHours = masterPlan?.weekly_target_hours || Number(sustainableWeeklyHours) || 6.0;

    // Create UserGoal record
    const userGoal = await prisma.userGoal.create({
      data: {
        user_id: user.id,
        goal_catalog_id: catalogId,
        outcome_statement: outcomeStatement.trim(),
        verification_criteria: verificationCriteria || 'Demonstrate unassisted real-world benchmark.',
        deadline_type: deadlineType,
        start_date: parsedStartDate,
        target_end_date: parsedTargetDate,
        sustainable_weekly_capacity_hours: effectiveWeeklyHours,
        current_med_hours: Math.round(effectiveWeeklyHours * 0.75 * 10) / 10,
        current_reliability_margin_hours: Math.max(0, Math.round(effectiveWeeklyHours * 0.25 * 10) / 10),
        priority_rank: existingActiveCount + 1,
        status: 'ACTIVE',
      },
    });

    let prevId: string | null = null;
    for (let i = 0; i < capsToCreate.length; i++) {
      const c = capsToCreate[i];
      const capId = c.id || `cap-${Date.now()}-${i}`;
      graph.addCapability({
        id: capId,
        userGoalId: userGoal.id,
        name: c.name,
        description: c.description || c.name,
        tier: (c.tier as any) || 'TIER_1_CRITICAL',
        state: i === 0 ? 'EMERGING' : 'UNTESTED',
        prerequisites: c.prerequisites || (prevId ? [prevId] : []),
      });
      prevId = capId;
    }

    await persistStateGraph(userGoal.id, graph);

    // Generate Initial Trajectory v1
    const trajectory = await generateInitialTrajectory(
      userGoal.id,
      graph,
      {
        sustainableWeeklyHours: effectiveWeeklyHours,
        medHours: Math.round(effectiveWeeklyHours * 0.75 * 10) / 10,
        reliabilityMarginHours: Math.max(0, Math.round(effectiveWeeklyHours * 0.25 * 10) / 10),
        maxSessionDurationMinutes: masterPlan?.recommended_dose_minutes || 60,
      },
      availabilitySlots || []
    );

    // Materialize next 14 days of Daily Schedule (Routines + Ambition Doses)
    const endDate14 = new Date(parsedStartDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    await materializeDays(user.id, parsedStartDate, endDate14, { forceRegenerate: true });

    // Materialize Week 1 execution objects
    const week1Items = await prisma.trajectoryItem.findMany({
      where: { trajectory_version_id: trajectory.id, planned_week: 1 },
    });

    const week1ExecutionObjects = week1Items.map((item) =>
      createExecutionObject({
        trajectoryItemId: item.id,
        userGoalId: userGoal.id,
        targetCapabilityId: item.target_capability_id || '',
        actionName: item.intervention_name,
        purpose: 'Week 1 adaptation stimulus',
        priorityTier: item.priority_tier,
        standardDoseMinutes: item.standard_duration_minutes,
        reducedDoseMinutes: item.reduced_duration_minutes,
        mvsDoseMinutes: item.mvs_duration_minutes,
        fallbackOptions: item.fallback_options ? (item.fallback_options as string[]) : [],
      })
    );

    res.status(201).json({
      userGoalId: userGoal.id,
      trajectoryVersionId: trajectory.id,
      capabilitiesCount: graph.getAllCapabilities().length,
      week1ExecutionObjects,
      dailyScheduleMaterialized: true,
      masterPlan: masterPlan ? { summary: masterPlan.summary, target_date: masterPlan.target_date } : null,
      message: 'Goal committed, Trajectory v1 generated, and Daily Life Schedule materialized successfully.',
    });
  } catch (error: any) {
    console.error('Error in /api/adaptive/goal/commit:', error);
    res.status(500).json({ error: error.message || 'Internal server error committing goal.' });
  }
});

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
