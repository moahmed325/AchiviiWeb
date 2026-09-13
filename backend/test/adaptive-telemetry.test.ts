import { describe, it, expect, afterAll } from 'vitest';
import {
  recordExecutionTelemetry,
  ingestEvidenceFromTelemetry,
  getAdherenceProfile,
  computeDoseAdequacy,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Telemetry Engine, Proof-of-Work & Adherence Profiler', () => {
  const testGoalId = `test-telemetry-goal-${Date.now()}`;
  const testUserId = `test-telemetry-user-${Date.now()}`;
  const testCatalogId = `test-telemetry-catalog-${Date.now()}`;
  let testSessionId1: string;
  let testSessionId2: string;
  let testCapabilityId: string;

  afterAll(async () => {
    try {
      await prisma.capabilityEvidence.deleteMany({
        where: { capability: { user_goal_id: testGoalId } },
      }).catch(() => {});
      await prisma.session.deleteMany({
        where: { user_goal_id: testGoalId },
      }).catch(() => {});
      await prisma.goalCapability.deleteMany({
        where: { user_goal_id: testGoalId },
      }).catch(() => {});
      await prisma.userGoal.deleteMany({
        where: { id: testGoalId },
      }).catch(() => {});
      await prisma.goalCatalog.deleteMany({
        where: { id: testCatalogId },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: testUserId },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in telemetry test:', e);
    }
  });

  it('computes dose adequacy factors accurately for all action states', () => {
    expect(computeDoseAdequacy('COMPLETED')).toBe(1.0);
    expect(computeDoseAdequacy('REDUCED')).toBe(0.65);
    expect(computeDoseAdequacy('MINIMUM_VIABLE')).toBe(0.35); // Habit continuity preserved; partial adaptation
    expect(computeDoseAdequacy('REPLACED')).toBe(0.85);
    expect(computeDoseAdequacy('MISSED')).toBe(0.0);
    expect(computeDoseAdequacy('BLOCKED')).toBe(0.0);
    expect(computeDoseAdequacy('DEFERRED')).toBe(0.0);
  });

  it('records COMPLETED session with proof-of-work, ingests evidence, and triggers capability state transition', async () => {
    // 1. Setup DB prerequisites
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
        title: 'Cognitive Learning Blueprint',
        description: 'Language Mastery',
        category: 'COGNITIVE',
        icon: 'book',
        est_weekly_hours: 5,
      },
    });

    const phase = await prisma.phase.create({
      data: {
        goal_catalog_id: testCatalogId,
        phase_order: 1,
        title: 'Foundation Phase',
        duration_weeks: 4,
      },
    });

    const taskTemplate = await prisma.taskTemplate.create({
      data: {
        phase_id: phase.id,
        title: 'Dialogue Practice',
        sessions_per_week: 3,
        session_duration_minutes: 45,
      },
    });

    await prisma.userGoal.create({
      data: {
        id: testGoalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        start_date: new Date(),
        target_end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
      },
    });

    // 2. Create Target Capability initially UNTESTED
    const capability = await prisma.goalCapability.create({
      data: {
        user_goal_id: testGoalId,
        name: 'Conversational Retrieval Speed',
        description: 'Respond to native speaker prompts within 2 seconds',
        tier: 'TIER_1_CRITICAL',
        state: 'UNTESTED',
      },
    });
    testCapabilityId = capability.id;

    // Link capability as bottleneck on UserGoal
    await prisma.userGoal.update({
      where: { id: testGoalId },
      data: { active_bottleneck_capability_id: capability.id },
    });

    // 3. Create Session
    const session = await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: taskTemplate.id,
        status: 'UPCOMING',
        tier: 'core',
        execution_state: 'PLANNED',
      },
    });
    testSessionId1 = session.id;

    // 4. Record execution telemetry: COMPLETED with performance proof
    const telemetry = await recordExecutionTelemetry(session.id, {
      executionState: 'COMPLETED',
      proofOfWorkText: 'Completed 20-minute benchmark conversation test with 92% comprehension score',
      durationMinutes: 45,
      rpeRating: 7,
      notes: 'Fluent retrieval with zero English translation pauses',
    });

    expect(telemetry.doseAdequacy).toBe(1.0);
    expect(telemetry.executionState).toBe('COMPLETED');

    // 5. Ingest evidence from telemetry
    const ingestion = await ingestEvidenceFromTelemetry(testGoalId, telemetry);

    expect(ingestion.evidenceCreated).toBe(true);
    expect(ingestion.stateTransitioned).toBe(true);
    expect(ingestion.previousState).toBe('UNTESTED');
    expect(ingestion.newState).toBe('ESTABLISHED'); // Transitioned to ESTABLISHED!

    // Verify DB updated
    const updatedCap = await prisma.goalCapability.findUnique({
      where: { id: testCapabilityId },
    });
    expect(updatedCap?.state).toBe('ESTABLISHED');
  });

  it('records MINIMUM_VIABLE session with discounted weight without falsely inflating capability', async () => {
    const taskTemplate = await prisma.taskTemplate.findFirst();

    const session2 = await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: taskTemplate!.id,
        status: 'UPCOMING',
        tier: 'core',
        execution_state: 'PLANNED',
      },
    });
    testSessionId2 = session2.id;

    // Record as MINIMUM_VIABLE (e.g. only 15 mins due to busy day)
    const telemetry = await recordExecutionTelemetry(session2.id, {
      executionState: 'MINIMUM_VIABLE',
      proofOfWorkText: '15m quick retrieval flashcard review',
      durationMinutes: 15,
      notes: 'High fatigue, preserved continuity with MVS fallback',
    });

    expect(telemetry.doseAdequacy).toBe(0.35); // Heavily discounted

    const ingestion = await ingestEvidenceFromTelemetry(testGoalId, telemetry);
    expect(ingestion.evidenceCreated).toBe(true);

    // Verify that single MVS evidence does not push ESTABLISHED into ROBUST
    const cap = await prisma.goalCapability.findUnique({
      where: { id: testCapabilityId },
    });
    expect(cap?.state).toBe('ESTABLISHED'); // Stays ESTABLISHED, does not falsely jump to ROBUST
  });

  it('calculates adherence profile and accurately flags critical-path disparity', async () => {
    const taskTemplate = await prisma.taskTemplate.findFirst();

    // Create 4 supportive sessions marked COMPLETED
    for (let i = 0; i < 4; i++) {
      await prisma.session.create({
        data: {
          user_goal_id: testGoalId,
          task_template_id: taskTemplate!.id,
          status: 'DONE',
          tier: 'reflect', // Supportive
          execution_state: 'COMPLETED',
        },
      });
    }

    // Create 3 critical sessions marked MISSED
    for (let i = 0; i < 3; i++) {
      await prisma.session.create({
        data: {
          user_goal_id: testGoalId,
          task_template_id: taskTemplate!.id,
          status: 'MISSED',
          tier: 'core', // Critical
          execution_state: 'MISSED',
        },
      });
    }

    const profile = await getAdherenceProfile(testGoalId);

    expect(profile.totalSessions).toBeGreaterThanOrEqual(9);
    expect(profile.criticalPath.total).toBeGreaterThanOrEqual(5);

    // Critical adherence is poor while supportive adherence is high
    expect(profile.supportive.adherenceRate).toBe(1.0);
    expect(profile.hasCriticalDisparity).toBe(true);
    expect(profile.disparityAnalysis).toContain('masks critical-path failure');
  });
});
