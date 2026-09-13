import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  CapabilityStateGraph,
  persistStateGraph,
  identifyCriticalPath,
  identifyCurrentBottleneck,
  recordExecutionTelemetry,
  evaluateDeviation,
  generateDiagnosticPrompt,
  submitDiagnosis,
  replanFromCurrentState,
  computeForecast,
  computeEvidenceConfidence,
  auditGoalIntegrity,
  verifyOutcomeGate,
  generateInitialTrajectory,
  ingestEvidenceFromTelemetry,
} from '../src/lib/adaptive/index.js';

describe('Adaptive 90-Day Execution System: End-to-End Acceptance Test', () => {
  const testUserId = `acceptance-user-${Date.now()}`;
  const testCatalogId = `acceptance-catalog-${Date.now()}`;
  let userGoalId: string;

  beforeAll(async () => {
    // 1. Create User
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'acceptance_hash',
        timezone: 'UTC',
      },
    });

    // 2. Create Blueprint Catalog & Phase
    await prisma.goalCatalog.create({
      data: {
        id: testCatalogId,
        title: '90-Day Full Acceptance Blueprint',
        description: 'End-to-end test blueprint',
        category: 'CODING',
        icon: 'terminal',
        est_weekly_hours: 10,
      },
    });

    const phase = await prisma.phase.create({
      data: {
        id: `phase-${testCatalogId}`,
        goal_catalog_id: testCatalogId,
        phase_order: 1,
        title: 'Phase 1: Foundation',
        duration_weeks: 12,
      },
    });

    await prisma.taskTemplate.create({
      data: {
        phase_id: phase.id,
        title: 'Deep Architecture Session',
        sessions_per_week: 4,
        session_duration_minutes: 60,
      },
    });
  });

  afterAll(async () => {
    try {
      if (userGoalId) {
        await prisma.weeklyStrategicReview.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.replanAudit.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.diagnosticEvent.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.capabilityEvidence.deleteMany({
          where: { capability: { user_goal_id: userGoalId } },
        }).catch(() => {});
        await prisma.goalCapability.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.trajectoryItem.deleteMany({
          where: { trajectory_version: { user_goal_id: userGoalId } },
        }).catch(() => {});
        await prisma.trajectoryVersion.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.session.deleteMany({ where: { user_goal_id: userGoalId } }).catch(() => {});
        await prisma.userGoal.deleteMany({ where: { id: userGoalId } }).catch(() => {});
      }
      await prisma.taskTemplate.deleteMany({ where: { phase: { goal_catalog_id: testCatalogId } } }).catch(() => {});
      await prisma.phase.deleteMany({ where: { goal_catalog_id: testCatalogId } }).catch(() => {});
      await prisma.goalCatalog.deleteMany({ where: { id: testCatalogId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    } catch (e) {
      console.warn('Teardown warning:', e);
    }
  });

  it('executes the full 16-step closed loop from formalization to outcome gate', async () => {
    // Step 1: Formalized UserGoal with 90-Day Target and Integrity
    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    const goal = await prisma.userGoal.create({
      data: {
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Ship Production Distributed System in 90 Days',
        verification_criteria: 'Live production URL passing load tests at 10k RPS',
        deadline_type: 'HARD',
        status: 'ACTIVE',
        start_date: startDate,
        target_end_date: targetEndDate,
        sustainable_weekly_capacity_hours: 8.0,
        current_med_hours: 5.0,
        current_reliability_margin_hours: 2.0,
        goal_integrity_status: 'INTACT',
      },
    });
    userGoalId = goal.id;
    expect(goal.id).toBeDefined();

    // Step 2: Capability Graph Initialization
    const cap1 = await prisma.goalCapability.create({
      data: {
        user_goal_id: userGoalId,
        name: 'Distributed Consensus Engine',
        description: 'Raft algorithm implementation in TypeScript',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
      },
    });

    const cap2 = await prisma.goalCapability.create({
      data: {
        user_goal_id: userGoalId,
        name: 'High-Throughput Storage Engine',
        description: 'Log-structured merge tree',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
      },
    });

    const graph = new CapabilityStateGraph();
    graph.addCapability({
      id: cap1.id,
      userGoalId,
      name: cap1.name,
      description: cap1.description,
      tier: 'TIER_1_CRITICAL',
      state: 'UNTESTED',
      prerequisites: [],
    });
    graph.addCapability({
      id: cap2.id,
      userGoalId,
      name: cap2.name,
      description: cap2.description,
      tier: 'TIER_1_CRITICAL',
      state: 'UNTESTED',
      prerequisites: [cap1.id],
    });

    await persistStateGraph(userGoalId, graph);

    // Step 3: Critical Path & Bottleneck Identification
    const criticalPath = identifyCriticalPath(graph, cap2.id);
    expect(criticalPath.length).toBe(2);
    expect(criticalPath[0].id).toBe(cap1.id);

    const bottleneck = identifyCurrentBottleneck(criticalPath);
    expect(bottleneck?.id).toBe(cap1.id);

    // Step 4: Feasibility & Capacity Audit (Reliability Margin)
    const integrity = await auditGoalIntegrity(userGoalId);
    expect(integrity.status).toBe('INTACT');
    expect(integrity.requiresUserEscalation).toBe(false);

    // Step 5: Trajectory v1 Generation with Zero Backlog Debt
    const capacityModel = {
      sustainableWeeklyHours: 8.0,
      medHours: 5.0,
      reliabilityMarginHours: 2.0,
      maxSessionDurationMinutes: 90,
    };
    const trajectoryV1 = await generateInitialTrajectory(userGoalId, graph, capacityModel);
    expect(trajectoryV1.versionNumber).toBe(1);

    const v1VersionDb = await prisma.trajectoryVersion.findFirst({
      where: { user_goal_id: userGoalId, is_active: true },
      include: { items: true },
    });
    expect(v1VersionDb).not.toBeNull();
    expect(v1VersionDb!.items.length).toBeGreaterThanOrEqual(12);

    // Step 6: Active Trajectory Retrieval & Calendar Projection
    const activeTrajectory = await prisma.trajectoryVersion.findFirst({
      where: { user_goal_id: userGoalId, is_active: true },
      include: { items: true },
    });
    expect(activeTrajectory?.id).toBe(v1VersionDb!.id);

    // Step 7: Execution on First Planned Session
    const sessions = await prisma.session.findMany({
      where: { user_goal_id: userGoalId },
      orderBy: { scheduled_date: 'asc' },
    });
    expect(sessions.length).toBeGreaterThanOrEqual(3);
    const session = sessions[0];
    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: 'DONE',
        execution_state: 'COMPLETED',
      },
    });

    // Step 8: Telemetry Recording & Evidence Ingestion
    const telemetryResult = await recordExecutionTelemetry(session.id, {
      executionState: 'COMPLETED',
      notes: 'Completed Raft election loop with passing unit tests',
      durationMinutes: 60,
    });
    expect(telemetryResult.sessionId).toBe(session.id);

    const evidenceIngested = await ingestEvidenceFromTelemetry(userGoalId, telemetryResult);
    expect(evidenceIngested.evidenceCreated).toBe(true);
    expect(evidenceIngested.stateTransitioned).toBe(true);
    expect(evidenceIngested.newState).toBe('EMERGING');

    // Step 9: Dynamic Forecast & Confidence
    const confidence = await computeEvidenceConfidence(userGoalId);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(confidence);

    const forecast = await computeForecast(userGoalId);
    expect(forecast.isWithinPlannedRunway).toBe(true);

    // Step 10: Critical Miss Deviation Detection
    // Mark next two critical sessions as consecutive misses (most recent in desc order)
    await prisma.session.update({
      where: { id: sessions[1].id },
      data: {
        status: 'MISSED',
        execution_state: 'MISSED',
        scheduled_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        tier: 'core',
      },
    });
    await prisma.session.update({
      where: { id: sessions[2].id },
      data: {
        status: 'MISSED',
        execution_state: 'MISSED',
        scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        tier: 'core',
      },
    });

    const deviation = await evaluateDeviation(userGoalId);
    expect(deviation.severity).toBe('MATERIAL_DISRUPTION');
    expect(deviation.requiresDiagnostic).toBe(true);

    // Step 11: Strategic Diagnostic Prompt Generation
    const diagPrompt = await generateDiagnosticPrompt(userGoalId, deviation);
    expect(diagPrompt.triggerReason).toContain('disruption');
    expect(diagPrompt.questions.length).toBeGreaterThan(0);

    // Step 12: Submit Diagnosis & Zero-Debt Replan
    const diagnosisRecord = await submitDiagnosis(userGoalId, {
      primaryCategory: 'CAPACITY',
      details: 'Reduced weekly available hours permanently to 4.5',
      isPersistent: true,
      updatedAvailableHours: 4.5,
    });
    expect(diagnosisRecord.proposedAction).toBe('REMOVE');

    // Step 13: Replan From Current State -> Trajectory v2
    const replan = await replanFromCurrentState(userGoalId, diagnosisRecord);
    expect(replan.newVersionNumber).toBe(2);
    expect(replan.goalPreserved).toBe(true);

    // Verify v1 is deactivated and v2 is active
    const v2Active = await prisma.trajectoryVersion.findFirst({
      where: { user_goal_id: userGoalId, is_active: true },
    });
    expect(v2Active?.version_number).toBe(2);

    // Step 14: Evidence Mastery & Shift Bottleneck
    await prisma.goalCapability.update({
      where: { id: cap1.id },
      data: { state: 'ROBUST' },
    });
    const updatedGraph = new CapabilityStateGraph();
    updatedGraph.addCapability({
      id: cap1.id,
      userGoalId,
      name: cap1.name,
      description: cap1.description,
      tier: 'TIER_1_CRITICAL',
      state: 'ROBUST',
      prerequisites: [],
    });
    updatedGraph.addCapability({
      id: cap2.id,
      userGoalId,
      name: cap2.name,
      description: cap2.description,
      tier: 'TIER_1_CRITICAL',
      state: 'UNTESTED',
      prerequisites: [cap1.id],
    });

    const updatedCriticalPath = identifyCriticalPath(updatedGraph, cap2.id);
    const newBottleneck = identifyCurrentBottleneck(updatedCriticalPath);
    expect(newBottleneck?.id).toBe(cap2.id); // Bottleneck moved forward!

    // Step 15: Outcome Gate Verification
    const gateCheck = await verifyOutcomeGate(userGoalId);
    expect(gateCheck).toHaveProperty('isAchieved');
    expect(gateCheck).toHaveProperty('reason');
    expect(gateCheck).toHaveProperty('unmetCriteria');

    // Step 16: Guarantee No-Debt Invariant
    const allUserSessions = await prisma.session.findMany({
      where: { user_goal_id: userGoalId, status: 'UPCOMING' },
    });
    // Rescheduling must not have piled 10+ sessions onto one day
    const dateCounts: Record<string, number> = {};
    for (const s of allUserSessions) {
      const key = new Date(s.scheduled_date).toISOString().slice(0, 10);
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    }
    for (const date in dateCounts) {
      expect(dateCounts[date]).toBeLessThanOrEqual(2);
    }
  });
});
