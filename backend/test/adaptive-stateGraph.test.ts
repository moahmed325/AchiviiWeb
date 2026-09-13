import { describe, it, expect, afterAll } from 'vitest';
import {
  CapabilityStateGraph,
  CapabilityEvidence,
  persistStateGraph,
  loadStateGraph,
} from '../src/lib/adaptive/index.js';
import { prisma } from '../src/lib/prisma.js';

describe('Capability State Graph & Prerequisite DAG Engine', () => {
  const testGoalId = `test-dag-goal-${Date.now()}`;
  const testUserId = `test-dag-user-${Date.now()}`;
  const testCatalogId = `test-dag-catalog-${Date.now()}`;

  afterAll(async () => {
    try {
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
      console.warn('Cleanup error in DAG tests:', e);
    }
  });

  it('constructs a 4-node capability DAG and validates topological structure', () => {
    const graph = new CapabilityStateGraph();

    // 1. Aerobic Base
    graph.addCapability({
      id: 'cap-1-aerobic-base',
      userGoalId: testGoalId,
      name: 'Aerobic Base Durability',
      description: 'Ability to run 60 mins comfortably in Zone 2',
      tier: 'TIER_1_CRITICAL',
    });

    // 2. Running Musculoskeletal Durability (requires Aerobic Base)
    graph.addCapability({
      id: 'cap-2-durability',
      userGoalId: testGoalId,
      name: 'Musculoskeletal Durability',
      description: 'Tolerance to impact volume over consecutive weeks',
      tier: 'TIER_1_CRITICAL',
      prerequisites: ['cap-1-aerobic-base'],
    });

    // 3. Race Pace Specificity (requires Durability)
    graph.addCapability({
      id: 'cap-3-race-pace',
      userGoalId: testGoalId,
      name: 'Half Marathon Race Pace Specificity',
      description: 'Sustain target 5:30/km pace for 10km intervals',
      tier: 'TIER_2_HIGH_LEVERAGE',
      prerequisites: ['cap-2-durability'],
    });

    // 4. Half Marathon Completion (requires Race Pace & Durability)
    graph.addCapability({
      id: 'cap-4-completion',
      userGoalId: testGoalId,
      name: 'Half Marathon Performance Test',
      description: 'Sub-2h 21.1km completion',
      tier: 'TIER_1_CRITICAL',
      prerequisites: ['cap-3-race-pace', 'cap-2-durability'],
    });

    expect(graph.getAllCapabilities()).toHaveLength(4);
    expect(graph.getPrerequisites('cap-2-durability')).toEqual(['cap-1-aerobic-base']);
    expect(graph.getPrerequisites('cap-4-completion')).toContain('cap-3-race-pace');
    expect(graph.getDependents('cap-1-aerobic-base')).toContain('cap-2-durability');

    const topoOrder = graph.getTopologicalOrder();
    expect(topoOrder).toHaveLength(4);
    const orderIds = topoOrder.map((c) => c.id);
    expect(orderIds.indexOf('cap-1-aerobic-base')).toBeLessThan(orderIds.indexOf('cap-2-durability'));
    expect(orderIds.indexOf('cap-2-durability')).toBeLessThan(orderIds.indexOf('cap-3-race-pace'));
    expect(orderIds.indexOf('cap-3-race-pace')).toBeLessThan(orderIds.indexOf('cap-4-completion'));
  });

  it('detects and rejects cyclic dependencies with explicit errors', () => {
    const graph = new CapabilityStateGraph();

    graph.addCapability({
      id: 'node-A',
      userGoalId: testGoalId,
      name: 'Capability A',
      description: 'A',
      tier: 'TIER_1_CRITICAL',
    });
    graph.addCapability({
      id: 'node-B',
      userGoalId: testGoalId,
      name: 'Capability B',
      description: 'B',
      tier: 'TIER_1_CRITICAL',
      prerequisites: ['node-A'],
    });
    graph.addCapability({
      id: 'node-C',
      userGoalId: testGoalId,
      name: 'Capability C',
      description: 'C',
      tier: 'TIER_1_CRITICAL',
      prerequisites: ['node-B'],
    });

    // Attempting to make A depend on C (creating A -> B -> C -> A) must throw
    expect(() => {
      graph.addPrerequisite('node-A', 'node-C');
    }).toThrowError(/Cycle detected/);

    // Self-dependency must also throw
    expect(() => {
      graph.addPrerequisite('node-A', 'node-A');
    }).toThrowError(/Cycle detected/);
  });

  it('evaluates capability state transitions based on cumulative weighted evidence', () => {
    const graph = new CapabilityStateGraph();

    const node = graph.addCapability({
      id: 'cap-eval-1',
      userGoalId: testGoalId,
      name: 'Listening Retrieval',
      description: 'Understanding native speaker dialogue at normal pace',
      tier: 'TIER_1_CRITICAL',
    });

    // Initially UNTESTED
    expect(node.state).toBe('UNTESTED');
    expect(graph.evaluateCapabilityState('cap-eval-1')).toBe('UNTESTED');

    // 1. Add low-weight self-report -> state transitions to EMERGING (score ~0.8 * 0.8 = 0.64)
    const ev1: CapabilityEvidence = {
      id: 'ev-1',
      capabilityId: 'cap-eval-1',
      proofType: 'SELF_REPORT',
      payload: { notes: 'Completed 15m podcast comprehension' },
      confidenceWeight: 0.8,
      recordedAt: new Date(),
    };

    const state1 = graph.evaluateCapabilityState('cap-eval-1', [ev1]);
    expect(state1).toBe('EMERGING');

    // 2. Add objective performance test -> state transitions to ESTABLISHED (score increases by 1.8 * 0.9 = 1.62; total > 1.2)
    const ev2: CapabilityEvidence = {
      id: 'ev-2',
      capabilityId: 'cap-eval-1',
      proofType: 'PERFORMANCE_TEST',
      payload: { comprehensionScore: 88, audioDurationMin: 15 },
      confidenceWeight: 0.9,
      recordedAt: new Date(),
    };

    const state2 = graph.evaluateCapabilityState('cap-eval-1', [ev1, ev2]);
    expect(state2).toBe('ESTABLISHED');

    // 3. Add outcome verification proof -> transitions to ROBUST (cumulative score > 3.0 with >= 2 proofs)
    const ev3: CapabilityEvidence = {
      id: 'ev-3',
      capabilityId: 'cap-eval-1',
      proofType: 'OUTCOME_VERIFICATION',
      payload: { liveConversationMin: 25, nativeSpeakerConfirmed: true },
      confidenceWeight: 1.0,
      recordedAt: new Date(),
    };

    const state3 = graph.evaluateCapabilityState('cap-eval-1', [ev1, ev2, ev3]);
    expect(state3).toBe('ROBUST');

    // 4. Regression detection: if an evidence flags severe regression, mark REGRESSED
    const regressedEv: CapabilityEvidence = {
      id: 'ev-4',
      capabilityId: 'cap-eval-1',
      proofType: 'PERFORMANCE_TEST',
      payload: { isRegressed: true, reason: 'Failed basic recall after 3 weeks off' },
      confidenceWeight: 1.0,
      recordedAt: new Date(),
    };

    const regressedState = graph.evaluateCapabilityState('cap-eval-1', [ev1, ev2, ev3, regressedEv]);
    expect(regressedState).toBe('REGRESSED');
  });

  it('enforces that downstream capabilities are blocked until all prerequisites are ESTABLISHED or ROBUST', () => {
    const graph = new CapabilityStateGraph();

    graph.addCapability({
      id: 'step-1',
      userGoalId: testGoalId,
      name: 'Step 1: Prototype Foundation',
      description: 'Functional wireframe and DB schema',
      tier: 'TIER_1_CRITICAL',
    });

    graph.addCapability({
      id: 'step-2',
      userGoalId: testGoalId,
      name: 'Step 2: External User Beta',
      description: 'Onboard first 5 real users',
      tier: 'TIER_1_CRITICAL',
      prerequisites: ['step-1'],
    });

    // Step 1 is UNTESTED -> Step 2 prerequisites are NOT satisfied
    expect(graph.arePrerequisitesSatisfied('step-2')).toBe(false);

    // Step 1 is EMERGING -> Step 2 prerequisites are STILL NOT satisfied
    graph.evaluateCapabilityState('step-1', [
      {
        id: 'ev-p1',
        capabilityId: 'step-1',
        proofType: 'SELF_REPORT',
        payload: { partial: true },
        confidenceWeight: 0.7,
        recordedAt: new Date(),
      },
    ]);
    expect(graph.getCapability('step-1')?.state).toBe('EMERGING');
    expect(graph.arePrerequisitesSatisfied('step-2')).toBe(false);

    // Step 1 receives deliverable proof -> ESTABLISHED -> Step 2 prerequisites are now SATISFIED
    graph.evaluateCapabilityState('step-1', [
      {
        id: 'ev-p2',
        capabilityId: 'step-1',
        proofType: 'DELIVERABLE',
        payload: { prMerged: true, deployedUrl: 'https://staging.achivii.app' },
        confidenceWeight: 1.0,
        recordedAt: new Date(),
      },
    ]);
    expect(graph.getCapability('step-1')?.state).toBe('ESTABLISHED');
    expect(graph.arePrerequisitesSatisfied('step-2')).toBe(true);
  });

  it('persists and loads CapabilityStateGraph to/from Prisma database with full fidelity', async () => {
    // 1. Create DB prerequisites
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        password_hash: 'testpwd',
        timezone: 'UTC',
      },
    });

    await prisma.goalCatalog.create({
      data: {
        id: testCatalogId,
        title: 'Fullstack SaaS Launch Blueprint',
        description: '90-Day MVP Launch',
        category: 'BUSINESS',
        icon: 'rocket',
        est_weekly_hours: 8,
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

    // 2. Build in-memory graph
    const graph = new CapabilityStateGraph();
    graph.addCapability({
      id: `${testGoalId}-cap-1`,
      userGoalId: testGoalId,
      name: 'Landing Page & Value Proposition Validation',
      description: 'Collect 50 waitlist signups with > 5% conversion',
      tier: 'TIER_1_CRITICAL',
    });

    graph.addCapability({
      id: `${testGoalId}-cap-2`,
      userGoalId: testGoalId,
      name: 'Core Payment Flow',
      description: 'Stripe webhook and active checkout',
      tier: 'TIER_1_CRITICAL',
      prerequisites: [`${testGoalId}-cap-1`],
    });

    // 3. Persist to DB
    await persistStateGraph(testGoalId, graph);

    // 4. Load from DB into a fresh graph
    const loadedGraph = await loadStateGraph(testGoalId);

    expect(loadedGraph.getAllCapabilities()).toHaveLength(2);
    expect(loadedGraph.getPrerequisites(`${testGoalId}-cap-2`)).toEqual([`${testGoalId}-cap-1`]);
    expect(loadedGraph.arePrerequisitesSatisfied(`${testGoalId}-cap-2`)).toBe(false);

    // 5. Generate verification questions
    const questions = loadedGraph.generateVerificationQuestions();
    expect(questions.length).toBeGreaterThan(0);
    expect(questions[0].capabilityId).toBe(`${testGoalId}-cap-1`);
  });
});
