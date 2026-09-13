import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';

describe('Adaptive Data Model Prisma Integration', () => {
  const testUserId = `test-user-${Date.now()}`;
  const testGoalCatalogId = `test-catalog-${Date.now()}`;
  let createdUserGoalId: string;

  afterAll(async () => {
    // Clean up test data
    try {
      if (createdUserGoalId) {
        await prisma.userGoal.delete({
          where: { id: createdUserGoalId },
        }).catch(() => {});
      }
      await prisma.goalCatalog.delete({
        where: { id: testGoalCatalogId },
      }).catch(() => {});
      await prisma.user.delete({
        where: { id: testUserId },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning:', e);
    }
  });

  it('creates UserGoal with adaptive fields and related entities, queries them, and asserts integrity', async () => {
    // 1. Create prerequisite User & GoalCatalog
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'hash123',
        timezone: 'UTC',
      },
    });

    await prisma.goalCatalog.create({
      data: {
        id: testGoalCatalogId,
        title: 'Adaptive Marathon Protocol',
        description: '90-Day Adaptive Plan',
        category: 'FITNESS',
        icon: 'trophy',
        est_weekly_hours: 6,
      },
    });

    // 2. Create UserGoal with extended adaptive properties
    const userGoal = await prisma.userGoal.create({
      data: {
        user_id: testUserId,
        goal_catalog_id: testGoalCatalogId,
        start_date: new Date('2026-09-15T00:00:00Z'),
        target_end_date: new Date('2026-12-15T00:00:00Z'),
        status: 'ACTIVE',
        outcome_statement: 'Complete sub-2h half marathon with verified negative split',
        verification_criteria: 'Official chip time under 2:00:00 at sanctioned race',
        deadline_type: 'HARD',
        goal_integrity_status: 'INTACT',
        feasibility_zone: 'GREEN',
        confidence_level: 'HIGH',
        projected_completion_date: new Date('2026-12-10T00:00:00Z'),
        sustainable_weekly_capacity_hours: 7.0,
        current_med_hours: 5.0,
        current_reliability_margin_hours: 2.0,
        active_bottleneck_capability_id: null,
      },
    });

    createdUserGoalId = userGoal.id;
    expect(userGoal.outcome_statement).toBe('Complete sub-2h half marathon with verified negative split');
    expect(userGoal.deadline_type).toBe('HARD');
    expect(userGoal.goal_integrity_status).toBe('INTACT');
    expect(userGoal.sustainable_weekly_capacity_hours).toBe(7.0);

    // 3. Create GoalCapability and CapabilityEvidence
    const capability = await prisma.goalCapability.create({
      data: {
        user_goal_id: userGoal.id,
        name: 'Aerobic Threshold Base',
        description: 'Sustain 60m Zone 2 pace at conversational effort',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
        prerequisites_ids: [],
        target_metric: 60,
        current_metric: 45,
      },
    });

    expect(capability.id).toBeDefined();
    expect(capability.tier).toBe('TIER_1_CRITICAL');

    const evidence = await prisma.capabilityEvidence.create({
      data: {
        capability_id: capability.id,
        proof_type: 'PERFORMANCE_TEST',
        payload: { testRunKm: 8.5, durationMinutes: 52, avgHr: 141 },
        confidence_weight: 0.9,
      },
    });

    expect(evidence.capability_id).toBe(capability.id);
    expect(evidence.proof_type).toBe('PERFORMANCE_TEST');

    // 4. Create TrajectoryVersion and TrajectoryItem
    const trajectoryV1 = await prisma.trajectoryVersion.create({
      data: {
        user_goal_id: userGoal.id,
        version_number: 1,
        trigger_type: 'INITIAL_ENROLLMENT',
        projected_completion: new Date('2026-12-10T00:00:00Z'),
        confidence_score: 0.85,
        is_active: true,
      },
    });

    const trajectoryItem = await prisma.trajectoryItem.create({
      data: {
        trajectory_version_id: trajectoryV1.id,
        target_capability_id: capability.id,
        intervention_name: 'Zone 2 Foundation Long Run',
        planned_week: 1,
        priority_tier: 1,
        standard_duration_minutes: 50,
        reduced_duration_minutes: 35,
        mvs_duration_minutes: 20,
        fallback_options: ['35m cycling', '30m brisk incline walk'],
      },
    });

    expect(trajectoryItem.trajectory_version_id).toBe(trajectoryV1.id);
    expect(trajectoryItem.mvs_duration_minutes).toBe(20);

    // 5. Create ReplanAudit linking trajectories
    const trajectoryV2 = await prisma.trajectoryVersion.create({
      data: {
        user_goal_id: userGoal.id,
        version_number: 2,
        trigger_type: 'CAPACITY_ADAPTATION',
        projected_completion: new Date('2026-12-12T00:00:00Z'),
        confidence_score: 0.88,
        is_active: true,
      },
    });

    const replanAudit = await prisma.replanAudit.create({
      data: {
        user_goal_id: userGoal.id,
        from_trajectory_id: trajectoryV1.id,
        to_trajectory_id: trajectoryV2.id,
        primary_action: 'COMPRESS',
        decision_trace: {
          trigger: 'User missed midweek session due to work travel',
          observation: '1 supportive session omitted, key base run intact',
          diagnosis: 'Temporary friction; no capability regression',
          assumptions: ['Normal capacity resumes following week'],
          optionsConsidered: ['Stack missed volume (Rejected)', 'Absorb without debt (Selected)'],
          decision: 'Absorbed without debt; compressed secondary run',
          tradeOff: 'Preserved recovery, minor supportive volume traded off',
          forecastEffect: 'Projected completion remains Day 86',
          nextAction: 'Execute weekend long run as scheduled',
        },
      },
    });

    expect(replanAudit.primary_action).toBe('COMPRESS');
    expect(replanAudit.from_trajectory_id).toBe(trajectoryV1.id);
    expect(replanAudit.to_trajectory_id).toBe(trajectoryV2.id);

    // 6. Query UserGoal with full graph include to verify relational mapping
    const fullGoal = await prisma.userGoal.findUnique({
      where: { id: userGoal.id },
      include: {
        capabilities: {
          include: { evidences: true },
        },
        trajectory_versions: {
          include: { items: true },
        },
        replan_audits: true,
      },
    });

    expect(fullGoal).not.toBeNull();
    expect(fullGoal?.capabilities).toHaveLength(1);
    expect(fullGoal?.capabilities[0].evidences).toHaveLength(1);
    expect(fullGoal?.trajectory_versions).toHaveLength(2);
    expect(fullGoal?.replan_audits).toHaveLength(1);
  });
});
