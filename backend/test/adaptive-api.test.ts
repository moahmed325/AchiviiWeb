import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';
import { adaptiveRouter } from '../src/routes/adaptive.js';
import { prisma } from '../src/lib/prisma.js';

describe('Unified Adaptive REST API Endpoints (/api/adaptive)', () => {
  let server: Server;
  let baseUrl: string;

  const testUserId = `test-api-user-${Date.now()}`;
  const testUserEmail = `${testUserId}@example.com`;
  const JWT_SECRET = process.env.JWT_SECRET || 'achivii-secret-key-development-2026';

  function generateAuthToken(userId: string, email: string): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) + 14 * 86400;
    const body = Buffer.from(JSON.stringify({ userId, email, exp })).toString('base64url');
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  let authToken: string;
  let createdGoalId: string;
  let templateId: string;
  let catalogId: string;

  beforeAll(async () => {
    // 1. Setup Express server on ephemeral port
    const app = express();
    app.use(express.json());
    app.use('/api/adaptive', adaptiveRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}/api/adaptive`;
        resolve();
      });
    });

    // 2. Setup user and catalog in DB
    await prisma.user.create({
      data: {
        id: testUserId,
        email: testUserEmail,
        password_hash: 'hash',
        timezone: 'UTC',
      },
    });

    const catalog = await prisma.goalCatalog.create({
      data: {
        title: 'Marathon API Blueprint',
        description: 'Integration test blueprint',
        category: 'FITNESS',
        icon: 'activity',
        est_weekly_hours: 6,
      },
    });
    catalogId = catalog.id;

    const phase = await prisma.phase.create({
      data: {
        goal_catalog_id: catalogId,
        phase_order: 1,
        title: 'Phase 1',
        duration_weeks: 4,
      },
    });

    const template = await prisma.taskTemplate.create({
      data: {
        phase_id: phase.id,
        title: 'Long Aerobic Run',
        sessions_per_week: 3,
        session_duration_minutes: 60,
      },
    });
    templateId = template.id;

    authToken = generateAuthToken(testUserId, testUserEmail);
  });

  afterAll(async () => {
    try {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }

      if (createdGoalId) {
        await prisma.weeklyStrategicReview.deleteMany({ where: { user_goal_id: createdGoalId } }).catch(() => {});
        await prisma.replanAudit.deleteMany({ where: { user_goal_id: createdGoalId } }).catch(() => {});
        await prisma.capabilityEvidence.deleteMany({
          where: { capability: { user_goal_id: createdGoalId } },
        }).catch(() => {});
        await prisma.goalCapability.deleteMany({ where: { user_goal_id: createdGoalId } }).catch(() => {});
        await prisma.trajectoryItem.deleteMany({
          where: { trajectory_version: { user_goal_id: createdGoalId } },
        }).catch(() => {});
        await prisma.trajectoryVersion.deleteMany({ where: { user_goal_id: createdGoalId } }).catch(() => {});
        await prisma.session.deleteMany({ where: { user_goal_id: createdGoalId } }).catch(() => {});
        await prisma.userGoal.deleteMany({ where: { id: createdGoalId } }).catch(() => {});
      }

      await prisma.taskTemplate.deleteMany({ where: { phase: { goal_catalog_id: catalogId } } }).catch(() => {});
      await prisma.phase.deleteMany({ where: { goal_catalog_id: catalogId } }).catch(() => {});
      await prisma.goalCatalog.deleteMany({ where: { id: catalogId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: testUserId } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup warning in adaptive-api test:', e);
    }
  });

  it('rejects unauthenticated and malformed requests with standard HTTP error codes', async () => {
    // 1. Unauthenticated request -> 401
    const resNoAuth = await fetch(`${baseUrl}/goal/formalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawGoal: 'Run marathon' }),
    });
    expect(resNoAuth.status).toBe(401);
    const jsonNoAuth = await resNoAuth.json();
    expect(jsonNoAuth.error).toContain('Unauthorized');

    // 2. Malformed request (missing rawGoal) -> 400
    const resBadReq = await fetch(`${baseUrl}/goal/formalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(resBadReq.status).toBe(400);
    const jsonBadReq = await resBadReq.json();
    expect(jsonBadReq.error).toContain('rawGoal is required');
  });

  it('executes full adaptive lifecycle API flow', async () => {
    // -------------------------------------------------------------
    // STEP 1: Formalize Goal & Check 90-Day Feasibility Gate
    // -------------------------------------------------------------
    const formalizeRes = await fetch(`${baseUrl}/goal/formalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        rawGoal: 'Run a marathon under 4 hours',
        domain: 'PHYSICAL',
        deadlineType: 'SOFT',
        weeklyAvailableHours: 7,
      }),
    });

    expect(formalizeRes.status).toBe(200);
    const formalizeData = await formalizeRes.json();
    expect(formalizeData.formalization).toBeDefined();
    expect(formalizeData.formalization.concreteOutcomeStatement).toContain('marathon');
    expect(formalizeData.feasibility).toBeDefined();
    expect(['GREEN', 'YELLOW']).toContain(formalizeData.feasibility.zone);

    // -------------------------------------------------------------
    // STEP 2: Commit Formalized Goal & Generate Initial Trajectory v1
    // -------------------------------------------------------------
    const commitRes = await fetch(`${baseUrl}/goal/commit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        goalCatalogId: catalogId,
        outcomeStatement: formalizeData.formalization.concreteOutcomeStatement,
        verificationCriteria: formalizeData.formalization.verificationCriteria,
        deadlineType: 'SOFT',
        domain: 'PHYSICAL',
        sustainableWeeklyHours: 7,
        capabilities: [
          {
            name: 'Aerobic Base Foundation',
            description: 'Zone 2 running capacity',
            tier: 'TIER_1_CRITICAL',
          },
          {
            name: 'Lactate Threshold Durability',
            description: 'Tempo intervals sustained',
            tier: 'TIER_1_CRITICAL',
          },
          {
            name: 'Sub-4 Marathon Endurance',
            description: '42.2km continuous race pace',
            tier: 'TIER_1_CRITICAL',
          },
        ],
      }),
    });

    expect(commitRes.status).toBe(201);
    const commitData = await commitRes.json();
    expect(commitData.userGoalId).toBeDefined();
    expect(commitData.trajectoryVersionId).toBeDefined();
    expect(commitData.week1ExecutionObjects.length).toBeGreaterThanOrEqual(3);
    createdGoalId = commitData.userGoalId;

    // -------------------------------------------------------------
    // STEP 3: Fetch Unified Strategic Dashboard
    // -------------------------------------------------------------
    const dashRes = await fetch(`${baseUrl}/dashboard?goalId=${createdGoalId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(dashRes.status).toBe(200);
    const dashData = await dashRes.json();
    expect(dashData.userGoalId).toBe(createdGoalId);
    expect(dashData.goalIntegrityStatus).toBe('INTACT');
    expect(dashData.projectedCompletionWindow).toBeTruthy();
    expect(dashData.activeBottleneck).toBeDefined();
    expect(dashData.todayAction).toBeDefined();
    expect(dashData.latestPlanUpdate).toContain('progressing normally');

    // -------------------------------------------------------------
    // STEP 4: Log Telemetry & Trigger Strategic Deviation
    // -------------------------------------------------------------
    // Create two Tier 1 sessions and mark both as MISSED to trigger MATERIAL_DISRUPTION
    const sess1 = await prisma.session.create({
      data: {
        user_goal_id: createdGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        status: 'MISSED',
        execution_state: 'MISSED',
        tier: 'core',
      },
    });

    const sess2 = await prisma.session.create({
      data: {
        user_goal_id: createdGoalId,
        task_template_id: templateId,
        scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        status: 'UPCOMING',
        execution_state: 'PLANNED',
        tier: 'core',
      },
    });

    const telemetryRes = await fetch(`${baseUrl}/telemetry/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        sessionId: sess2.id,
        executionState: 'MISSED',
        notes: 'Missed due to overtime at work',
      }),
    });

    expect(telemetryRes.status).toBe(200);
    const telemetryData = await telemetryRes.json();
    expect(telemetryData.telemetryResult).toBeDefined();
    expect(telemetryData.deviationReport.severity).toBe('MATERIAL_DISRUPTION');

    // -------------------------------------------------------------
    // STEP 5: Check Pending Diagnostic Questions
    // -------------------------------------------------------------
    const pendingDiagRes = await fetch(`${baseUrl}/diagnosis/pending?goalId=${createdGoalId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(pendingDiagRes.status).toBe(200);
    const pendingDiagData = await pendingDiagRes.json();
    expect(pendingDiagData.pending).toBe(true);
    expect(pendingDiagData.prompt).toBeDefined();
    expect(pendingDiagData.prompt.triggerReason).toContain('disruption');
    expect(pendingDiagData.prompt.questions.length).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // STEP 6: Submit Diagnostic Answer & Trigger Adaptive Replan
    // -------------------------------------------------------------
    const diagSubmitRes = await fetch(`${baseUrl}/diagnosis/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        userGoalId: createdGoalId,
        category: 'CAPACITY',
        triggerReason: 'Job promotion demands extra hours',
        details: 'Available weekly capacity permanently dropped from 7h to 4h',
        isPersistent: true,
        newCapacityHours: 4,
        suggestedAction: 'REMOVE',
      }),
    });

    expect(diagSubmitRes.status).toBe(200);
    const diagSubmitData = await diagSubmitRes.json();
    expect(diagSubmitData.diagnosticRecord).toBeDefined();
    expect(diagSubmitData.replanResult).toBeDefined();
    expect(diagSubmitData.replanResult.primaryAction).toBe('REMOVE');
    expect(diagSubmitData.userFacingExplanation).toContain('debt');

    // -------------------------------------------------------------
    // STEP 7: View Replanned Dashboard with Updated Forecast
    // -------------------------------------------------------------
    const replannedDashRes = await fetch(`${baseUrl}/dashboard?goalId=${createdGoalId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(replannedDashRes.status).toBe(200);
    const replannedDashData = await replannedDashRes.json();
    expect(replannedDashData.latestPlanUpdate).toContain('pruned');
    expect(replannedDashData.latestPlanUpdate).toContain('debt');

    // -------------------------------------------------------------
    // STEP 8: Generate 7-Question Weekly Strategic Review
    // -------------------------------------------------------------
    const reviewRes = await fetch(`${baseUrl}/weekly-review/1?goalId=${createdGoalId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(reviewRes.status).toBe(200);
    const reviewData = await reviewRes.json();
    expect(reviewData.answers).toBeDefined();
    expect(reviewData.answers.whatWasSupposedToHappen).toBeTruthy();
    expect(reviewData.answers.whatActuallyHappened).toBeTruthy();
    expect(reviewData.answers.whatChangedInCapabilityState).toBeTruthy();
    expect(reviewData.answers.whatCausedMeaningfulDeviations).toBeTruthy();
    expect(reviewData.answers.isTheBottleneckStillTheBottleneck).toBeTruthy();
    expect(reviewData.answers.isTheTrajectoryStillValid).toBeTruthy();
    expect(reviewData.answers.whatShouldHappenNext).toBeTruthy();

    // -------------------------------------------------------------
    // STEP 9: Outcome Gate Verification
    // -------------------------------------------------------------
    const gateRes = await fetch(`${baseUrl}/outcome-gate/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        userGoalId: createdGoalId,
      }),
    });

    expect(gateRes.status).toBe(200);
    const gateData = await gateRes.json();
    // No outcome verification evidence yet submitted -> should be NOT_MET
    expect(gateData.isAchieved).toBe(false);
    expect(gateData.status).toBe('NOT_MET');
  });
});
