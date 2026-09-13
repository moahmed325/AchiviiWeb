import { describe, it, expect, afterAll } from 'vitest';
import {
  computeForecast,
  computeEvidenceConfidence,
  auditGoalIntegrity,
  verifyOutcomeGate,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Forecast, Confidence & Goal Integrity Engine', () => {
  const testUserId = `test-fc-user-${Date.now()}`;
  const testCatalogId = `test-fc-catalog-${Date.now()}`;
  const testGoalId1 = `test-fc-goal1-${Date.now()}`;
  const testGoalId2 = `test-fc-goal2-${Date.now()}`;
  const testGoalId3 = `test-fc-goal3-${Date.now()}`;
  const testGoalId4 = `test-fc-goal4-${Date.now()}`;

  afterAll(async () => {
    try {
      const goalIds = [testGoalId1, testGoalId2, testGoalId3, testGoalId4];
      await prisma.capabilityEvidence.deleteMany({
        where: { capability: { user_goal_id: { in: goalIds } } },
      }).catch(() => {});
      await prisma.goalCapability.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.trajectoryVersion.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.session.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.userGoal.deleteMany({
        where: { id: { in: goalIds } },
      }).catch(() => {});
      await prisma.goalCatalog.deleteMany({
        where: { id: testCatalogId },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: testUserId },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in adaptive-forecast test:', e);
    }
  });

  it('computes projected completion window and adaptation rate', async () => {
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'hash',
        timezone: 'UTC',
      },
    });

    await prisma.goalCatalog.create({
      data: {
        id: testCatalogId,
        title: 'Endurance Mastery',
        description: 'Test catalog for forecasting',
        category: 'FITNESS',
        icon: 'trending-up',
        est_weekly_hours: 6,
      },
    });

    const now = Date.now();
    const startDate = new Date(now - 42 * 24 * 60 * 60 * 1000); // 6 weeks elapsed
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId1,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run half marathon under 2 hours',
        verification_criteria: 'Official chip-timed race result under 2h',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.5,
        current_med_hours: 4.5,
      },
    });

    // 3 capabilities: 2 ESTABLISHED, 1 EMERGING
    const cap1 = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Aerobic Base',
        description: 'Zone 2 running',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    const cap2 = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Lactate Threshold',
        description: 'Tempo running at threshold',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Race Pace Economy',
        description: 'Sustain 5:40/km for 21.1km',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Add fresh evidence for cap1 and cap2
    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap1.id,
        proof_type: 'OBJECTIVE_METRIC',
        confidence_weight: 0.9,
        payload: { pace: '5:50/km', hr: 142 },
        recorded_at: new Date(now - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap2.id,
        proof_type: 'PERFORMANCE_TEST',
        confidence_weight: 0.85,
        payload: { threshold_speed: '5:15/km' },
        recorded_at: new Date(now - 3 * 24 * 60 * 60 * 1000),
      },
    });

    const forecast = await computeForecast(testGoalId1);

    expect(forecast).toBeDefined();
    expect(forecast.userGoalId).toBe(testGoalId1);
    expect(forecast.totalCapabilitiesCount).toBe(3);
    expect(forecast.establishedCapabilitiesCount).toBe(2);
    expect(forecast.remainingCapabilitiesCount).toBe(1);
    expect(forecast.adaptationRate).toBeGreaterThan(0);
    expect(forecast.confidenceLevel).toBe('HIGH');

    // Forecast window is bounded
    expect(forecast.projectedWindowDays[0]).toBeLessThanOrEqual(forecast.projectedDayOffset);
    expect(forecast.projectedDayOffset).toBeLessThanOrEqual(forecast.projectedWindowDays[1]);
    expect(forecast.projectedWindowStart.getTime()).toBeLessThanOrEqual(
      forecast.projectedCompletionDate.getTime()
    );
    expect(forecast.projectedCompletionDate.getTime()).toBeLessThanOrEqual(
      forecast.projectedWindowEnd.getTime()
    );
  });

  it('confidence rating degrades when evidence is stale or absent', async () => {
    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Goal with NO evidence
    await prisma.userGoal.create({
      data: {
        id: testGoalId2,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Speak Spanish fluently in conversation',
        verification_criteria: '15-min dialogue with native speaker',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 5.0,
        current_med_hours: 4.5,
      },
    });

    const capSpanish = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId2,
        name: 'Past Tense Conjugations',
        description: 'Imperfect vs Preterite',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // 1. Without any evidence, confidence MUST be LOW
    const confNoEvidence = await computeEvidenceConfidence(testGoalId2);
    expect(confNoEvidence).toBe('LOW');

    // 2. Add stale evidence from 45 days ago
    const staleEvidence = await prisma.capabilityEvidence.create({
      data: {
        capability_id: capSpanish.id,
        proof_type: 'SELF_REPORT',
        confidence_weight: 0.5,
        payload: { completed_deck: true },
        recorded_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days old
      },
    });

    const confStale = await computeEvidenceConfidence(testGoalId2);
    expect(confStale).toBe('LOW');

    // 3. Add fresh high-confidence evidence from 1 day ago and establish capability
    await prisma.goalCapability.update({
      where: { id: capSpanish.id },
      data: { state: 'ESTABLISHED' },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: capSpanish.id,
        proof_type: 'PERFORMANCE_TEST',
        confidence_weight: 0.95,
        payload: { oral_exam_score: 94 },
        recorded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });

    // Update margin to healthy
    await prisma.userGoal.update({
      where: { id: testGoalId2 },
      data: {
        sustainable_weekly_capacity_hours: 6.5,
        current_med_hours: 4.0,
      },
    });

    const confFresh = await computeEvidenceConfidence(testGoalId2);
    expect(confFresh).toBe('HIGH');
  });

  it('goal integrity audit detects attempted downgrade of success criteria and hard deadline risk', async () => {
    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId3,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run half marathon under 2 hours',
        verification_criteria: 'Official chip-timed race result',
        deadline_type: 'HARD',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    // 1. Audit intact goal
    const auditIntact = await auditGoalIntegrity(testGoalId3);
    expect(auditIntact.status).toBe('INTACT');
    expect(auditIntact.requiresUserEscalation).toBe(false);

    // 2. Detect attempted downgrade: "half marathon" -> "10k"
    const auditDowngrade = await auditGoalIntegrity(testGoalId3, {
      outcomeStatement: 'Run 10k in local park',
    });
    expect(auditDowngrade.status).toBe('COMPROMISED');
    expect(auditDowngrade.requiresUserEscalation).toBe(true);
    expect(auditDowngrade.reason).toContain('Attempted silent downgrade');

    // 3. Detect HARD deadline violation when projected completion slips past deadline
    await prisma.userGoal.update({
      where: { id: testGoalId3 },
      data: {
        projected_completion_date: new Date(targetEndDate.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days late
      },
    });

    const auditHardDeadline = await auditGoalIntegrity(testGoalId3);
    expect(auditHardDeadline.status).toBe('COMPROMISED');
    expect(auditHardDeadline.requiresUserEscalation).toBe(true);
    expect(auditHardDeadline.reason).toContain('Immovable HARD deadline');
  });

  it('Outcome Gate refuses achievement declaration when verification evidence is missing', async () => {
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const targetEndDate = new Date();

    await prisma.userGoal.create({
      data: {
        id: testGoalId4,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Launch SaaS with 10 paying customers',
        verification_criteria: 'Stripe telemetry showing 10 active subscriptions',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 10,
        current_med_hours: 6,
      },
    });

    const capSaaS = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId4,
        name: 'Stripe Billing & Subscriptions',
        description: 'Customer onboarding flow',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // 1. Even though 90 days have elapsed, the gate MUST refuse achievement without evidence
    const gateRefused = await verifyOutcomeGate(testGoalId4);
    expect(gateRefused.isAchieved).toBe(false);
    expect(gateRefused.status).toBe('NOT_MET');
    expect(gateRefused.unmetCriteria.length).toBeGreaterThan(0);
    expect(gateRefused.reason).toContain('Outcome Gate refused');

    // 2. Satisfy the gate with high-confidence OUTCOME_VERIFICATION evidence and ESTABLISHED state
    await prisma.goalCapability.update({
      where: { id: capSaaS.id },
      data: { state: 'ESTABLISHED' },
    });

    await prisma.capabilityEvidence.create({
      data: {
        capability_id: capSaaS.id,
        proof_type: 'OUTCOME_VERIFICATION',
        confidence_weight: 0.95,
        payload: { paying_customers: 12, mrr: 1200 },
        recorded_at: new Date(),
      },
    });

    const gateAchieved = await verifyOutcomeGate(testGoalId4);
    expect(gateAchieved.isAchieved).toBe(true);
    expect(gateAchieved.status).toBe('ACHIEVED');
    expect(gateAchieved.validatingEvidence.length).toBeGreaterThan(0);
    expect(gateAchieved.reason).toContain('successfully satisfied');
  });
});
