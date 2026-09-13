import { describe, it, expect, afterAll } from 'vitest';
import {
  createDecisionTrace,
  formatUserFacingExplanation,
  recordReplanAudit,
  generateWeeklyReview,
  generateMinimumViableDay,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Behavioral Layer: Decision Trace, Weekly Strategic Review & Minimum Viable Day', () => {
  const testUserId = `test-beh-user-${Date.now()}`;
  const testCatalogId = `test-beh-catalog-${Date.now()}`;
  const testGoalId1 = `test-beh-goal1-${Date.now()}`;
  const testGoalId2 = `test-beh-goal2-${Date.now()}`;
  let templateId: string;

  afterAll(async () => {
    try {
      const goalIds = [testGoalId1, testGoalId2];
      await prisma.weeklyStrategicReview.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.replanAudit.deleteMany({
        where: { user_goal_id: { in: goalIds } },
      }).catch(() => {});
      await prisma.capabilityEvidence.deleteMany({
        where: { capability: { user_goal_id: { in: goalIds } } },
      }).catch(() => {});
      await prisma.goalCapability.deleteMany({
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
      console.warn('Cleanup warning in adaptive-behavioral test:', e);
    }
  });

  it('creates decision trace and formats a humane, supportive explanation without debt scolding', async () => {
    // 1. Create DecisionTrace
    const trace = createDecisionTrace({
      trigger: 'Material disruption detected along critical path (2 sessions missed)',
      observation: 'Active bottleneck is Lactate Threshold (State: EMERGING). Sustainable capacity is 6h/wk.',
      diagnosis: 'User missed two sessions due to illness.',
      assumptions: [
        'User can resume 5h/wk sustainably starting next week',
        'Lactate Threshold receives prioritized adaptation stimulus',
        'No-debt rule applied: missed volume absorbed rather than compounded into debt',
      ],
      optionsConsidered: [
        'RESUME: Absorbs deviation without workload changes',
        'COMPRESS: Compress essential work into higher-density sessions',
        'REMOVE: Prune supportive volume',
      ],
      decision: 'COMPRESS: Compress essential work into higher-density sessions preserving core stimulus',
      tradeOff: 'Your key endurance capability is still progressing normally',
      forecastEffect: 'Projected completion remains Day 88 with 86% success probability',
      nextAction: 'Execute next session: 40m threshold intervals. No catch-up required',
    });

    expect(trace.trigger).toContain('Material disruption');
    expect(trace.diagnosis).toContain('illness');
    expect(trace.assumptions.length).toBe(3);

    // 2. Format user-facing explanation
    const explanation = formatUserFacingExplanation(trace);

    // Must be supportive, concise (3-4 sentences), and enforce the no-debt principle
    expect(explanation).toContain('illness');
    expect(explanation.toLowerCase()).toContain('without');
    expect(explanation.toLowerCase()).toContain('debt');
    expect(explanation).toContain('endurance capability');
    expect(explanation).toContain('Day 88');
    expect(explanation).toContain('Next step');

    // 3. Test persistence to ReplanAudit
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'pwd',
        timezone: 'UTC',
      },
    });

    await prisma.goalCatalog.create({
      data: {
        id: testCatalogId,
        title: 'Behavioral Blueprint',
        description: 'Test catalog',
        category: 'FITNESS',
        icon: 'user-check',
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
        title: 'Primary Workout',
        sessions_per_week: 3,
        session_duration_minutes: 60,
      },
    });
    templateId = template.id;

    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId1,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'Run 10km in 45 minutes',
        verification_criteria: 'Chip timed race result',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 6.0,
        current_med_hours: 4.5,
      },
    });

    const audit = await recordReplanAudit({
      userGoalId: testGoalId1,
      primaryAction: 'COMPRESS',
      decisionTrace: trace,
    });

    expect(audit).toBeDefined();
    expect(audit.primary_action).toBe('COMPRESS');
    expect((audit.decision_trace as any).diagnosis).toContain('illness');
  });

  it('generates Weekly Strategic Review answering all 7 strategic questions from telemetry', async () => {
    // 1. Setup capabilities for testGoal1
    const cap1 = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Aerobic Base Foundation',
        description: '60m zone 2 aerobic base',
        tier: 'TIER_1_CRITICAL',
        state: 'ESTABLISHED',
      },
    });

    const cap2 = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId1,
        name: 'Lactate Threshold Speed',
        description: 'Threshold intervals',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Add evidence for cap1
    await prisma.capabilityEvidence.create({
      data: {
        capability_id: cap1.id,
        proof_type: 'OBJECTIVE_METRIC',
        confidence_weight: 0.9,
        payload: { avg_pace: '5:30/km' },
        recorded_at: new Date(),
      },
    });

    // Create Trajectory v1
    const v1 = await prisma.trajectoryVersion.create({
      data: {
        user_goal_id: testGoalId1,
        version_number: 1,
        trigger_type: 'INITIAL',
        projected_completion: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000),
        confidence_score: 0.88,
        is_active: true,
      },
    });

    await prisma.trajectoryItem.create({
      data: {
        trajectory_version_id: v1.id,
        target_capability_id: cap1.id,
        intervention_name: 'Aerobic Long Run',
        planned_week: 1,
        priority_tier: 1,
        standard_duration_minutes: 60,
        reduced_duration_minutes: 40,
        mvs_duration_minutes: 25,
      },
    });

    // Create sessions for Week 1: 1 COMPLETED, 1 REDUCED, 1 MISSED
    await prisma.session.create({
      data: {
        user_goal_id: testGoalId1,
        task_template_id: templateId,
        day_number: 2,
        status: 'DONE',
        execution_state: 'COMPLETED',
        tier: 'core',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId1,
        task_template_id: templateId,
        day_number: 4,
        status: 'DONE',
        execution_state: 'REDUCED',
        tier: 'buffer',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId1,
        task_template_id: templateId,
        day_number: 6,
        status: 'MISSED',
        execution_state: 'MISSED',
        tier: 'reflect',
      },
    });

    // 2. Generate Weekly Review
    const review = await generateWeeklyReview(testGoalId1, 1);

    expect(review).toBeDefined();
    expect(review.weekNumber).toBe(1);
    expect(review.answers).toBeDefined();

    // Verify all 7 questions
    const { answers } = review;
    expect(answers.whatWasSupposedToHappen).toBeTruthy();
    expect(answers.whatWasSupposedToHappen).toContain('Planned');

    expect(answers.whatActuallyHappened).toBeTruthy();
    expect(answers.whatActuallyHappened).toContain('completed');
    expect(answers.whatActuallyHappened).toContain('reduced');
    expect(answers.whatActuallyHappened).toContain('missed');

    expect(answers.whatChangedInCapabilityState).toBeTruthy();
    expect(answers.whatChangedInCapabilityState).toContain('Aerobic Base Foundation');

    expect(answers.whatCausedMeaningfulDeviations).toBeTruthy();
    expect(answers.whatCausedMeaningfulDeviations.toLowerCase()).toContain('missed');

    expect(answers.isTheBottleneckStillTheBottleneck).toBeTruthy();
    expect(answers.isTheBottleneckStillTheBottleneck).toContain('Lactate Threshold Speed');

    expect(answers.isTheTrajectoryStillValid).toBeTruthy();
    expect(answers.isTheTrajectoryStillValid).toContain('Trajectory');

    expect(answers.whatShouldHappenNext).toBeTruthy();
    expect(answers.whatShouldHappenNext).toContain('Focus next week');
    expect(answers.whatShouldHappenNext.toLowerCase()).toContain('catch-up');

    // Verify record in Prisma DB
    const saved = await prisma.weeklyStrategicReview.findUnique({
      where: { id: review.id },
    });
    expect(saved).toBeDefined();
    expect((saved?.answers as any).whatActuallyHappened).toBe(answers.whatActuallyHappened);
  });

  it('Minimum Viable Day filters out non-critical work and scales sessions to MVS doses', async () => {
    const today = new Date();
    const startDate = new Date();
    const targetEndDate = new Date(startDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    await prisma.userGoal.create({
      data: {
        id: testGoalId2,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        outcome_statement: 'High Performance Coding System',
        deadline_type: 'SOFT',
        target_end_date: targetEndDate,
        start_date: startDate,
        sustainable_weekly_capacity_hours: 8.0,
        current_med_hours: 5.0,
      },
    });

    const capDev = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId2,
        name: 'System Architecture & Concurrency',
        description: 'Deep distributed systems design',
        tier: 'TIER_1_CRITICAL',
        state: 'EMERGING',
      },
    });

    // Create 3 sessions on the SAME day:
    // Session 1: Critical Core (60m)
    // Session 2: Supportive Buffer (30m)
    // Session 3: Reflection (15m)
    await prisma.session.create({
      data: {
        user_goal_id: testGoalId2,
        task_template_id: templateId,
        scheduled_date: today,
        status: 'UPCOMING',
        execution_state: 'PLANNED',
        tier: 'core',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId2,
        task_template_id: templateId,
        scheduled_date: today,
        status: 'UPCOMING',
        execution_state: 'PLANNED',
        tier: 'buffer',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId2,
        task_template_id: templateId,
        scheduled_date: today,
        status: 'UPCOMING',
        execution_state: 'PLANNED',
        tier: 'reflect',
      },
    });

    // Invoke generateMinimumViableDay
    const mvdSessions = await generateMinimumViableDay(testGoalId2, today);

    // Invariant 1: Exactly 1 single critical session returned (supportive and reflection sessions pruned)
    expect(mvdSessions.length).toBe(1);

    const mvsSession = mvdSessions[0];

    // Invariant 2: Priority tier is 1 (core critical work)
    expect(mvsSession.priorityTier).toBe(1);

    // Invariant 3: Scaled to MVS dose (~40% of standard 60m = 24m)
    expect(mvsSession.standardDoseMinutes).toBe(60);
    expect(mvsSession.mvsDoseMinutes).toBe(24);
    expect(mvsSession.executionState).toBe('MINIMUM_VIABLE');

    // Invariant 4: Fallback options populated
    expect(mvsSession.fallbackOptions.length).toBeGreaterThan(0);
  });
});
