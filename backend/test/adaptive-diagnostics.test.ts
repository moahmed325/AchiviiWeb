import { describe, it, expect, afterAll } from 'vitest';
import {
  evaluateDeviation,
  generateDiagnosticPrompt,
  submitDiagnosis,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Strategic Deviation Detector & Diagnostic Engine', () => {
  const testGoalId = `test-diag-goal-${Date.now()}`;
  const testUserId = `test-diag-user-${Date.now()}`;
  const testCatalogId = `test-diag-catalog-${Date.now()}`;
  let templateId: string;

  afterAll(async () => {
    try {
      await prisma.diagnosticEvent.deleteMany({
        where: { user_goal_id: testGoalId },
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
      console.warn('Cleanup warning in diagnostics test:', e);
    }
  });

  it('silently absorbs 1 supportive session miss with no diagnostic alert', async () => {
    // 1. Setup DB user & goal
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
        title: 'Diagnostic Test Blueprint',
        description: 'Test catalog',
        category: 'FITNESS',
        icon: 'heart',
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
    templateId = template.id;

    await prisma.userGoal.create({
      data: {
        id: testGoalId,
        user_id: testUserId,
        goal_catalog_id: testCatalogId,
        start_date: new Date(),
        target_end_date: new Date(Date.now() + 84 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
        current_reliability_margin_hours: 1.5,
      },
    });

    // Create 1 completed core session and 1 missed supportive session
    await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'DONE',
        tier: 'core',
        execution_state: 'COMPLETED',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'MISSED',
        tier: 'reflect', // Tier 3 Supportive
        execution_state: 'MISSED',
      },
    });

    const report = await evaluateDeviation(testGoalId);

    expect(report.severity).toBe('SILENT_ABSORPTION');
    expect(report.requiresDiagnostic).toBe(false);
    expect(report.isBottleneckThreatened).toBe(false);
    expect(report.explanation).toContain('Silently absorbed by reliability margin');
  });

  it('triggers MATERIAL_DISRUPTION and generates tailored questions when 2 critical sessions are missed', async () => {
    // Add 2 consecutive missed core sessions
    await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 12 * 60 * 60 * 1000),
        status: 'MISSED',
        tier: 'core',
        execution_state: 'MISSED',
      },
    });

    await prisma.session.create({
      data: {
        user_goal_id: testGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'MISSED',
        tier: 'core',
        execution_state: 'MISSED',
      },
    });

    const report = await evaluateDeviation(testGoalId);

    expect(report.severity).toBe('MATERIAL_DISRUPTION');
    expect(report.requiresDiagnostic).toBe(true);
    expect(report.isBottleneckThreatened).toBe(true);
    expect(report.consecutiveCriticalMisses).toBe(2);

    // Generate tailored diagnostic prompt
    const diagnosticPrompt = generateDiagnosticPrompt(testGoalId, report);

    expect(diagnosticPrompt.userGoalId).toBe(testGoalId);
    expect(diagnosticPrompt.questions).toHaveLength(6);
    const categories = diagnosticPrompt.questions.map((q) => q.category);
    expect(categories).toContain('CAPACITY');
    expect(categories).toContain('CAPABILITY');
    expect(categories).toContain('RECOVERY');
    expect(categories).toContain('FRICTION');
    expect(categories).toContain('MOTIVATION');
    expect(categories).toContain('EXTERNAL');
  });

  it('submits diagnosis, distinguishes persistent capacity drop vs temporary illness, and proposes action', async () => {
    // 1. Temporary Illness -> proposed action COMPRESS
    const tempDiagnosis = await submitDiagnosis(testGoalId, {
      primaryCategory: 'RECOVERY',
      details: 'Had a 3-day fever and muscle aches, fully afebrile now',
      isPersistent: false,
    });

    expect(tempDiagnosis.category).toBe('RECOVERY');
    expect(tempDiagnosis.isPersistent).toBe(false);
    expect(tempDiagnosis.proposedAction).toBe('COMPRESS');

    // 2. Persistent Capacity Reduction -> updates UserGoal capacity and proposes REMOVE
    const persistentDiagnosis = await submitDiagnosis(testGoalId, {
      primaryCategory: 'CAPACITY',
      details: 'Started new job role, permanent 2h weekly time reduction',
      isPersistent: true,
      updatedAvailableHours: 4.5,
    });

    expect(persistentDiagnosis.category).toBe('CAPACITY');
    expect(persistentDiagnosis.isPersistent).toBe(true);
    expect(persistentDiagnosis.proposedAction).toBe('REMOVE');

    // Verify DB updated with new capacity
    const updatedGoal = await prisma.userGoal.findUnique({
      where: { id: testGoalId },
    });
    expect(updatedGoal?.sustainable_weekly_capacity_hours).toBe(4.5);

    // Verify diagnostic event stored in DB
    const events = await prisma.diagnosticEvent.findMany({
      where: { user_goal_id: testGoalId },
    });
    expect(events.length).toBe(2);
  });
});
