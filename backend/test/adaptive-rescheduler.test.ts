import { describe, it, expect, afterAll } from 'vitest';
import {
  replanFromCurrentState,
  DiagnosticRecord,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Adaptive Rescheduler & No-Debt Replan Engine', () => {
  const testUserId = `test-resched-user-${Date.now()}`;
  const testCatalogId = `test-resched-catalog-${Date.now()}`;
  const testGoalId1 = `test-resched-goal1-${Date.now()}`;
  const testGoalId2 = `test-resched-goal2-${Date.now()}`;
  const testGoalId3 = `test-resched-goal3-${Date.now()}`;
  const testGoalId4 = `test-resched-goal4-${Date.now()}`;

  afterAll(async () => {
    try {
      const goalIds = [testGoalId1, testGoalId2, testGoalId3, testGoalId4];
      await prisma.replanAudit.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.trajectoryItem.deleteMany({
        where: { trajectory_version: { user_goal_id: { in: goalIds } } },
      }).catch(() => {});
      await prisma.trajectoryVersion.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.session.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.goalCapability.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.userGoal.deleteMany({
        where: { id: { in: goalIds } },
      }).catch(() => {});
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
      console.warn('Cleanup warning in adaptive-rescheduler test:', e);
    }
  });

  it('No-Debt Guarantee: missing 3 sessions does NOT pile 3 + N sessions onto the upcoming week', async () => {
    // 1. Setup user & catalog
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
        title: 'Marathon 90-Day Blueprint',
        description: 'Test marathon catalog',
        category: 'FITNESS',
        icon: 'activity',
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
        title: 'Session Template',
        sessions_per_week: 3,
        session_duration_minutes: 45,
      },
    });

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId1,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run sub-4 marathon safely',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6,
        current_med_hours: 4.5,
      },
    });

    // Create capability nodes
    const cap1 = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Aerobic Base Building',
        description: 'Run 60m easy zone 2',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Trajectory v1
    const v1 = await prisma.trajectoryVersion.create({
      data: {
        user_goal_id: testGoalId1,
        version_number: 1,
        trigger_type: 'INITIAL_GENERATION',
        projected_completion: targetEndDate,
        confidence_score: 0.85,
        is_active: true,
      },
    });

    // Create 3 sessions in Week 1, all marked MISSED
    for (let i = 1; i <= 3; i++) {
      await prisma.session.create({
        data: {
          user_goal_id: testGoalId1,
          task_template_id: template.id,
          scheduled_date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
          status: 'MISSED',
          execution_state: 'MISSED',
          tier: 'core',
        },
      });
    }

    // Now execute replan from current state
    const result = await replanFromCurrentState(testGoalId1);

    expect(result).toBeDefined();
    expect(result.previousTrajectoryVersionId).toBe(v1.id);
    expect(result.newVersionNumber).toBe(2);

    // Verify v1 was deactivated and v2 is active
    const oldV1 = await prisma.trajectoryVersion.findUnique({ where: { id: v1.id } });
    const newV2 = await prisma.trajectoryVersion.findUnique({ where: { id: result.newTrajectoryVersionId } });
    expect(oldV1?.is_active).toBe(false);
    expect(newV2?.is_active).toBe(true);

    // NO-DEBT INVARIANT:
    // Count upcoming week (planned_week = 1 in new trajectory) sessions.
    // Must NOT be 3 (missed) + 3/4 = 6/7 sessions! Must be standard 3 or 4 sessions.
    const week1Items = await prisma.trajectoryItem.findMany({
      where: {
        trajectory_version_id: result.newTrajectoryVersionId,
        planned_week: 1,
      },
    });

    expect(week1Items.length).toBeLessThanOrEqual(4);
    expect(week1Items.length).toBeGreaterThanOrEqual(3);
    // Specifically ensure backlog was NOT appended
    expect(week1Items.length).not.toBe(6);
    expect(week1Items.length).not.toBe(7);

    // Verify DecisionTrace notes the no-debt rule
    expect(result.decisionTrace.assumptions.some(a => a.toLowerCase().includes('no-debt'))).toBe(true);
  });

  it('Capacity Reduction: drops from 7h to 4h; system REMOVES supportive sessions and protects critical path', async () => {
    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId2,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Deadlift 2x bodyweight',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 4, // dropped from 7h to 4h
        current_med_hours: 4.5,
      },
    });

    const capCritical = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId2,
        name: 'Posterior Chain Deadlift Technique',
        description: 'Heavy compound hinge with neutral spine',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const diagnostic: DiagnosticRecord = {
      userGoalId: testGoalId2,
      category: 'CAPACITY',
      triggerReason: 'Persistent work hours increase',
      details: 'Overtime demanded at job permanently cuts available capacity to 4h/wk',
      isPersistent: true,
      suggestedAction: 'REMOVE',
    };

    const result = await replanFromCurrentState(testGoalId2, diagnostic);

    expect(result.primaryAction).toBe('REMOVE');
    expect(result.selectedRoute.action).toBe('REMOVE');

    // Verify weekly workload fits within reduced capacity (4h = 240m)
    expect(result.selectedRoute.weeklyWorkloadMinutes).toBeLessThanOrEqual(240);

    // Verify critical path is protected in the new trajectory
    const newItems = await prisma.trajectoryItem.findMany({
      where: {
        trajectory_version_id: result.newTrajectoryVersionId,
        planned_week: 1,
      },
    });

    const tier1Items = newItems.filter((i) => i.priority_tier === 1);
    expect(tier1Items.length).toBeGreaterThan(0);
    expect(tier1Items[0].target_capability_id).toBe(capCritical.id);
  });

  it('Soft Deadline Extension: feasible path requires 102 days; system EXTENDS forecast to Day 102', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId3,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Ship multi-tenant SaaS architecture',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 5,
        current_med_hours: 6.0, // Capacity deficit relative to MED
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId3,
        name: 'Distributed Systems & Queues',
        description: 'Implement RabbitMQ and fault-tolerant jobs',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const recoveryDiagnostic: DiagnosticRecord = {
      userGoalId: testGoalId3,
      category: 'RECOVERY',
      triggerReason: 'High cognitive fatigue requiring extended pacing',
      details: 'Needs sustainable runway rather than high-density cramming',
      isPersistent: false,
      suggestedAction: 'EXTEND',
    };

    const result = await replanFromCurrentState(testGoalId3, recoveryDiagnostic);

    expect(result.primaryAction).toBe('EXTEND');
    expect(result.selectedRoute.action).toBe('EXTEND');
    expect(result.goalPreserved).toBe(true);

    // Verify completion date was moved to Day 102 from start date
    const expectedDay102 = new Date(startDate.getTime() + 102 * 24 * 60 * 60 * 1000);
    const actualDays = Math.round(
      (result.newProjectedCompletion.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(actualDays).toBe(102);
    expect(result.newProjectedCompletion.toISOString().split('T')[0]).toBe(
      expectedDay102.toISOString().split('T')[0]
    );

    // High confidence score because destination is preserved and runway is relaxed
    expect(result.selectedRoute.successProbability).toBeGreaterThanOrEqual(0.85);
  });

  it('Hard Deadline: deadline cannot move; system refuses EXTEND and COMPRESSES essential work', async () => {
    const startDate = new Date();
    const fixedTargetDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId4,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Finish registered Ironman event',
        deadline_type: 'HARD', // Hard race date
        target_end_date: fixedTargetDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 8,
        current_med_hours: 6,
      },
    });

    await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId4,
        name: 'Open Water 3.8km Swim Endurance',
        description: 'Complete continuous open water swim',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    const result = await replanFromCurrentState(testGoalId4);

    // EXTEND route must be marked infeasible because deadline is HARD
    const extendRoute = result.candidateRoutes.find((r) => r.action === 'EXTEND');
    expect(extendRoute).toBeDefined();
    expect(extendRoute?.isFeasible).toBe(false);
    expect(extendRoute?.tradeOffs).toContain('Rejected');

    // Winning action should COMPRESS essential work without moving the date
    expect(result.primaryAction).toBe('COMPRESS');
    expect(result.selectedRoute.action).toBe('COMPRESS');

    // Completion date must NOT have moved
    expect(result.newProjectedCompletion.getTime()).toBe(fixedTargetDate.getTime());
  });

  it('Evaluates all 6 candidate actions and writes audit trace', async () => {
    const result = await replanFromCurrentState(testGoalId1);

    // All 6 actions must be evaluated
    const actionTypes = result.candidateRoutes.map((r) => r.action);
    expect(actionTypes).toContain('RESUME');
    expect(actionTypes).toContain('COMPRESS');
    expect(actionTypes).toContain('REORDER');
    expect(actionTypes).toContain('REPLACE');
    expect(actionTypes).toContain('REMOVE');
    expect(actionTypes).toContain('EXTEND');

    // Check ReplanAudit record exists in DB
    const auditRecord = await prisma.replanAudit.findFirst({
      where: { user_goal_id: testGoalId1, to_trajectory_id: result.newTrajectoryVersionId },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.primary_action).toBe(result.primaryAction);
    expect(auditRecord?.decision_trace).toBeDefined();
  });
});
