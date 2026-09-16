import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  recordExecutionTelemetry,
  evaluateDeviation,
  generateDiagnosticPrompt,
  submitDiagnosis,
  replanFromCurrentState,
  computeForecast,
  computeEvidenceConfidence,
  auditGoalIntegrity,
  verifyOutcomeGate,
  formatUserFacingExplanation,
  createExecutionObject,
  generateInitialTrajectory,
} from '../src/lib/adaptive/index.js';

describe('Adaptive 90-Day Execution System: 10 Canonical Architectural Scenarios', () => {
  const testUserId = `test-scenarios-user-${Date.now()}`;
  const testCatalogId = `test-scenarios-catalog-${Date.now()}`;
  let templateId: string;

  // Track created goal IDs for clean database teardown
  const createdGoalIds: string[] = [];

  beforeAll(async () => {
    // Setup common user & catalog
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'hash',
        timezone: 'UTC',
      },
    });

    const catalog = await prisma.goalCatalog.create({
      data: {
        id: testCatalogId,
        title: 'Mastery Canonical Blueprint',
        description: 'Test catalog for canonical scenarios',
        category: 'FITNESS',
        icon: 'compass',
        est_weekly_hours: 6,
      },
    });

    const phase = await prisma.phase.create({
      data: {
        goal_catalog_id: testCatalogId,
        phase_order: 1,
        title: 'Phase 1',
        duration_weeks: 4,
      },
    });

    const template = await prisma.taskTemplate.create({
      data: {
        phase_id: phase.id,
        title: 'Core Adaptation Session',
        sessions_per_week: 3,
        session_duration_minutes: 45,
      },
    });
    templateId = template.id;
  });

  afterAll(async () => {
    try {
      if (createdGoalIds.length > 0) {
        await prisma.weeklyStrategicReview.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.replanAudit.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.diagnosticEvent.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.capabilityEvidence.deleteMany({
          where: { capability: { user_goal_id: { in: createdGoalIds } } },
        }).catch(() => {});
        await prisma.goalCapability.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.trajectoryItem.deleteMany({
          where: { trajectory_version: { user_goal_id: { in: createdGoalIds } } },
        }).catch(() => {});
        await prisma.trajectoryVersion.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.session.deleteMany({
          where: { user_goal_id: { in: createdGoalIds } },
        }).catch(() => {});
        await prisma.userGoal.deleteMany({
          where: { id: { in: createdGoalIds } },
        }).catch(() => {});
      }

      await prisma.taskTemplate.deleteMany({
        where: { phase: { goal_catalog_id: testCatalogId } },
      }).catch(() => {});
      await prisma.phase.deleteMany({
        where: { goal_catalog_id: testCatalogId },
      }).catch(() => {});
      await prisma.goalCatalog.deleteMany({
        where: { id: testCatalogId },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: testUserId },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in adaptive-scenarios test:', e);
    }
  });

  // ---------------------------------------------------------------------------
  // SCENARIO A: On Track (Standard Execution)
  // ---------------------------------------------------------------------------
  it('Scenario A (On Track): standard execution continues trajectory with High confidence', async () => {
    const goalId = `goal-scen-a-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const goal = await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run continuous 10km without stopping',
        verification_criteria: 'GPS log of 10km continuous run',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.5,
        current_med_hours: 4.5,
      },
    });

    const cap = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Aerobic Base Foundation',
        description: 'Zone 2 aerobic running',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap.id,
        proof_type: 'OBJECTIVE_METRIC',
        confidence_weight: 0.95,
        payload: { distance_km: 7.5, avg_hr: 138 },
        recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Fresh (1 day ago)
      },
    });

    const session = await prisma.session.create({
      data: {
        user_goal_id: goalId,
        task_template_id: templateId,
        scheduled_date: new Date(),
        status: 'DONE',
        execution_state: 'COMPLETED',
        tier: 'core',
      },
    });

    // 1. Evaluate deviation
    const deviation = await evaluateDeviation(goalId);
    expect(deviation.severity).toBe('NONE');
    expect(deviation.requiresDiagnostic).toBe(false);

    // 2. Evaluate confidence
    const confidence = await computeEvidenceConfidence(goalId);
    expect(confidence).toBe('HIGH');

    // 3. Evaluate forecast
    const forecast = await computeForecast(goalId);
    expect(forecast.isWithinPlannedRunway).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO B: Small Miss (Silent Absorption)
  // ---------------------------------------------------------------------------
  it('Scenario B (Small Miss): supportive session missed; silently absorbed with zero catch-up debt', async () => {
    const goalId = `goal-scen-b-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Improve functional mobility',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Thoracic Extension',
        description: 'Upper back mobility',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Completed 1 Core session, missed 1 Tier 3 Supportive session
    await prisma.session.create({
      data: {
        user_goal_id: goalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'DONE',
        execution_state: 'COMPLETED',
        tier: 'core',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: goalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'MISSED',
        execution_state: 'MISSED',
        tier: 'reflect', // Tier 3 Supportive
      },
    });

    const deviation = await evaluateDeviation(goalId);

    // Filtered as silent absorption: no disruption, no scolding, no diagnostic triggered
    expect(deviation.severity).toBe('SILENT_ABSORPTION');
    expect(deviation.requiresDiagnostic).toBe(false);
    expect(deviation.isBottleneckThreatened).toBe(false);
    expect(deviation.explanation).toContain('absorbed');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO C: Material Disruption (Critical Path Missed & Diagnosed)
  // ---------------------------------------------------------------------------
  it('Scenario C (Material Disruption): critical bottleneck missed; diagnoses cause and recalculates route', async () => {
    const goalId = `goal-scen-c-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: '5km under 22 minutes',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    const cap = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'V02 Max Pacing',
        description: 'Hard interval pacing',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const v1 = await prisma.trajectoryVersion.create({
      data: {
        user_goal_id: goalId,
        version_number: 1,
        trigger_type: 'INITIAL',
        projected_completion: targetEndDate,
        confidence_score: 0.85,
        is_active: true,
      },
    });

    // Two consecutive critical Tier 1 misses
    await prisma.session.create({
      data: {
        user_goal_id: goalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'MISSED',
        execution_state: 'MISSED',
        tier: 'core',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: goalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'MISSED',
        execution_state: 'MISSED',
        tier: 'core',
      },
    });

    // 1. Detect material disruption
    const deviation = await evaluateDeviation(goalId);
    expect(deviation.severity).toBe('MATERIAL_DISRUPTION');
    expect(deviation.requiresDiagnostic).toBe(true);

    // 2. Generate diagnostic prompt
    const prompt = generateDiagnosticPrompt(goalId, deviation);
    expect(prompt.questions.length).toBeGreaterThan(0);

    // 3. Submit diagnosis (temporary illness)
    const diagRecord = await submitDiagnosis(goalId, {
      primaryCategory: 'RECOVERY',
      details: 'Flu and fever prevented high-intensity intervals',
      isPersistent: false,
    });

    // 4. Replan from current state
    const replan = await replanFromCurrentState(goalId, diagRecord);
    expect(replan.newVersionNumber).toBe(2);
    expect(replan.previousTrajectoryVersionId).toBe(v1.id);
    expect(replan.goalPreserved).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO D: Capacity Reduction (Drop from 7h to 4h)
  // ---------------------------------------------------------------------------
  it('Scenario D (Capacity Reduction): user available time drops from 7h to 4h; system drops low-priority work and protects critical path', async () => {
    const goalId = `goal-scen-d-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Executive Strength',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 4.0, // permanently reduced
        current_med_hours: 4.5,
      },
    });

    const capCritical = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Deadlift Neuromuscular Pattern',
        description: 'Core posterior strength',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const diag = await submitDiagnosis(goalId, {
      primaryCategory: 'CAPACITY',
      details: 'Work promotion cuts available weekly time to 4h',
      isPersistent: true,
      updatedAvailableHours: 4.0,
    });

    const replan = await replanFromCurrentState(goalId, diag);

    // Prunes supportive sessions using REMOVE
    expect(replan.primaryAction).toBe('REMOVE');
    expect(replan.selectedRoute.weeklyWorkloadMinutes).toBeLessThanOrEqual(240); // 4 hours = 240 mins

    // Tier 1 critical session is preserved in trajectory items
    const items = await prisma.trajectoryItem.findMany({
      where: { trajectory_version_id: replan.newTrajectoryVersionId, planned_week: 1 },
    });
    const criticalItems = items.filter((i) => i.priority_tier === 1);
    expect(criticalItems.length).toBeGreaterThan(0);
    expect(criticalItems[0].target_capability_id).toBe(capCritical.id);
  });


  // ---------------------------------------------------------------------------
  // SCENARIO F: Intervention Failure (Format Replacement)
  // ---------------------------------------------------------------------------
  it('Scenario F (Intervention Failure): intervention fails to produce progress; replaces format for identical capability', async () => {
    const goalId = `goal-scen-f-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'High Pull Mastery',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    const cap = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Shoulder External Rotation',
        description: 'Rotator cuff stability',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Log diagnostic specifying logistical friction / intervention failure
    const diagRecord = {
      triggerReason: 'Heavy barbell rotation aggravated anterior shoulder friction',
      category: 'CAPABILITY' as const,
      details: 'Current exercise setup causing joint friction rather than muscle stimulus',
      isPersistent: false,
      proposedAction: 'REPLACE' as const,
    };

    const replan = await replanFromCurrentState(goalId, diagRecord);

    expect(replan.primaryAction).toBe('REPLACE');
    expect(replan.selectedRoute.action).toBe('REPLACE');
    expect(replan.selectedRoute.tradeOffs).toContain('Substitutes intervention format');

    const explanation = formatUserFacingExplanation(replan.decisionTrace);
    expect(explanation).toContain('substituted');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO G: Positive Acceleration (Finishing Early)
  // ---------------------------------------------------------------------------
  it('Scenario G (Positive Acceleration): user progresses faster; updates forecast to finish early without adding unnecessary work', async () => {
    const goalId = `goal-scen-g-${Date.now()}`;
    createdGoalIds.push(goalId);

    const now = Date.now();
    const startDate = new Date(now - 28 * 24 * 60 * 60 * 1000); // 4 weeks elapsed
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000); // Day 90

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Conversational French Proficiency',
        verification_criteria: '20-min unassisted conversation',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 7.0,
        current_med_hours: 4.0, // Robust reliability margin of 3.0h
      },
    });

    // 3 capabilities: 2 already ESTABLISHED within 4 weeks (accelerated pace)
    const cap1 = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Core Vocabulary (1000 words)',
        description: 'High frequency words',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    const cap2 = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Past & Future Tense Conjugation',
        description: 'Grammar mechanics',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Impromptu Dialogue Flow',
        description: 'Real-time conversational retrieval',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Fresh evidence
    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap1.id,
        proof_type: 'PERFORMANCE_TEST',
        confidence_weight: 0.95,
        payload: { vocabulary_retrieval_score: 98 },
        recorded_at: new Date(now - 1 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap2.id,
        proof_type: 'PERFORMANCE_TEST',
        confidence_weight: 0.92,
        payload: { dialogue_test: 'passed' },
        recorded_at: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
    });

    const forecast = await computeForecast(goalId);

    // Accelerated adaptation rate (> 0.4 caps/week)
    expect(forecast.adaptationRate).toBeGreaterThanOrEqual(0.5);

    // Projected completion is well ahead of Day 90
    expect(forecast.projectedDayOffset).toBeLessThan(90);
    expect(forecast.isWithinPlannedRunway).toBe(true);
    expect(forecast.confidenceLevel).toBe('HIGH');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO H: Soft Deadline Recalibration (Day 90 -> Day 102)
  // ---------------------------------------------------------------------------
  it('Scenario H (Soft Deadline Recalibration): disruption on soft deadline moves projected completion to Day 102 preserving destination', async () => {
    const goalId = `goal-scen-h-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Ship Production SaaS',
        verification_criteria: 'Live production URL with billing enabled',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 5.0,
        current_med_hours: 5.5, // Capacity deficit relative to standard MED
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Database Failover & High Availability',
        description: 'Multi-region replica failover',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const diag = {
      triggerReason: 'Cognitive fatigue requiring extended pacing',
      category: 'RECOVERY' as const,
      details: 'Needs sustainable runway without high-density cramming',
      isPersistent: false,
      proposedAction: 'EXTEND' as const,
    };

    const replan = await replanFromCurrentState(goalId, diag);

    expect(replan.primaryAction).toBe('EXTEND');
    expect(replan.goalPreserved).toBe(true);

    // Verify completion moved precisely to Day 102 from start date
    const expectedDay102 = new Date(startDate.getTime() + 102 * 24 * 60 * 60 * 1000);
    expect(replan.newProjectedCompletion.toISOString().split('T')[0]).toBe(
      expectedDay102.toISOString().split('T')[0]
    );

    // Confidence remains high because destination is protected and timeline is realistic
    expect(replan.selectedRoute.successProbability).toBeGreaterThanOrEqual(0.85);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO I: Hard Deadline Optimization (Refuse Extend & Compress)
  // ---------------------------------------------------------------------------
  it('Scenario I (Hard Deadline Optimization): disruption on hard deadline refuses EXTEND, compresses route, and alerts on breach', async () => {
    const goalId = `goal-scen-i-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date();
    const fixedRaceDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Ironman Triathlon Official Finish',
        deadline_type: 'HARD', // Immovable race date
        target_end_date: fixedRaceDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 8.0,
        current_med_hours: 6.0,
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: '180km Aero TT Bike Endurance',
        description: 'Aerodynamic zone 2 wattage pacing',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const replan = await replanFromCurrentState(goalId);

    // Hard deadline explicitly refuses EXTEND
    const extendRoute = replan.candidateRoutes.find((r) => r.action === 'EXTEND');
    expect(extendRoute?.isFeasible).toBe(false);
    expect(extendRoute?.tradeOffs).toContain('Rejected');

    // Winning action is COMPRESS
    expect(replan.primaryAction).toBe('COMPRESS');
    expect(replan.newProjectedCompletion.getTime()).toBe(fixedRaceDate.getTime());

    // Test breach escalation: If trajectory slips past hard deadline
    await prisma.userGoal.update({
      where: { id: goalId },
      data: {
        projected_completion_date: new Date(fixedRaceDate.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days late
      },
    });

    const integrityAudit = await auditGoalIntegrity(goalId);
    expect(integrityAudit.status).toBe('COMPROMISED');
    expect(integrityAudit.requiresUserEscalation).toBe(true);
    expect(integrityAudit.reason).toContain('Immovable HARD deadline');
  });

  // ---------------------------------------------------------------------------
  // SCENARIO J: Goal Integrity Protection (Prohibit Silent Downgrade)
  // ---------------------------------------------------------------------------
  it('Scenario J (Goal Integrity Protection): strictly prohibits silent goal degradation and refuses unverified completion', async () => {
    const goalId = `goal-scen-j-${Date.now()}`;
    createdGoalIds.push(goalId);

    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days elapsed
    const targetEndDate = new Date();

    await prisma.userGoal.create({
      data: {
        id: goalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run half marathon under 1h45m',
        verification_criteria: 'Official chip timed 21.1km result under 1:45:00',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    const cap = await prisma.goalCapability.create({
      data: {
        user_goal_id: goalId,
        name: 'Half Marathon Race Pacing',
        description: 'Sustain 4:58/km pace',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // 1. Attempted silent downgrade: "half marathon" -> "10km"
    const auditDowngrade = await auditGoalIntegrity(goalId, {
      outcomeStatement: 'Run 10km in local park',
      verificationCriteria: 'Run 10km casually',
    });

    expect(auditDowngrade.status).toBe('COMPROMISED');
    expect(auditDowngrade.requiresUserEscalation).toBe(true);
    expect(auditDowngrade.reason).toContain('Attempted silent downgrade');

    // 2. Outcome Gate: 90 days elapsed, but no verified proof exists
    const gateWithoutProof = await verifyOutcomeGate(goalId);
    expect(gateWithoutProof.isAchieved).toBe(false);
    expect(gateWithoutProof.status).toBe('NOT_MET');
    expect(gateWithoutProof.reason).toContain('Outcome Gate refused');

    // 3. Legitimate verification: User submits chip-timed proof meeting criteria
    await prisma.goalCapability.update({
      where: { id: cap.id },
      data: { state: 'ESTABLISHED' },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap.id,
        proof_type: 'OUTCOME_VERIFICATION',
        confidence_weight: 0.98,
        payload: { official_time: '1:44:12', event: 'Spring Half Marathon' },
        recorded_at: new Date(),
      },
    });

    const gateWithProof = await verifyOutcomeGate(goalId);
    expect(gateWithProof.isAchieved).toBe(true);
    expect(gateWithProof.status).toBe('ACHIEVED');
    expect(gateWithProof.validatingEvidence.length).toBeGreaterThan(0);
  });
});
