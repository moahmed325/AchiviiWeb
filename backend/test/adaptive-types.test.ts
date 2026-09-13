import { describe, it, expect } from 'vitest';
import {
  GoalDefinition,
  FeasibilityAssessment,
  CapabilityNode,
  CapabilityEvidence,
  CapacityModel,
  ExecutionObject,
  TelemetrySignal,
  DiagnosticRecord,
  TrajectoryVersion,
  DecisionTrace,
  GoalIntegrityStatus,
} from '../src/lib/adaptive/index.js';

describe('Adaptive System Universal Domain Types', () => {
  it('instantiates GoalDefinition cleanly with required fields', () => {
    const goal: GoalDefinition = {
      outcomeStatement: 'Run a sub-2 hour half marathon',
      verificationCriteria: 'Official race chip time under 2:00:00',
      deadlineType: 'HARD',
      targetDate: new Date('2026-12-15T00:00:00.000Z'),
      domain: 'PHYSICAL',
    };

    expect(goal.outcomeStatement).toBe('Run a sub-2 hour half marathon');
    expect(goal.deadlineType).toBe('HARD');
    expect(goal.domain).toBe('PHYSICAL');
  });

  it('instantiates FeasibilityAssessment across all zone tiers', () => {
    const greenAssessment: FeasibilityAssessment = {
      zone: 'GREEN',
      score: 0.88,
      bottleneckRisks: ['Aerobic base durability'],
      recommendations: ['Maintain planned 6h weekly training block with 1.5h reliability margin'],
    };

    expect(greenAssessment.zone).toBe('GREEN');
    expect(greenAssessment.score).toBeGreaterThanOrEqual(0);
    expect(greenAssessment.score).toBeLessThanOrEqual(1);

    const zones: FeasibilityAssessment['zone'][] = ['GREEN', 'YELLOW', 'RED'];
    expect(zones).toContain(greenAssessment.zone);
  });

  it('instantiates CapabilityNode and validates states and tiers', () => {
    const node: CapabilityNode = {
      id: 'cap-aerobic-01',
      userGoalId: 'goal-123',
      name: 'Aerobic Threshold Durability',
      description: 'Ability to sustain 60 minutes of Zone 2 conversational running',
      tier: 'TIER_1_CRITICAL',
      state: 'ESTABLISHED',
      prerequisites: ['cap-musculoskeletal-adaptation-00'],
      metricValue: 60,
      targetMetric: 60,
    };

    expect(node.tier).toBe('TIER_1_CRITICAL');
    expect(node.state).toBe('ESTABLISHED');
    expect(node.prerequisites).toHaveLength(1);
  });

  it('instantiates CapabilityEvidence with various proof types', () => {
    const evidence: CapabilityEvidence = {
      id: 'ev-01',
      capabilityId: 'cap-aerobic-01',
      proofType: 'PERFORMANCE_TEST',
      payload: {
        distanceKm: 10.5,
        durationMinutes: 62,
        avgHeartRate: 142,
        rpeEffort: 6,
      },
      confidenceWeight: 0.95,
      recordedAt: new Date(),
    };

    expect(evidence.proofType).toBe('PERFORMANCE_TEST');
    expect(evidence.confidenceWeight).toBe(0.95);
  });

  it('instantiates CapacityModel and verifies margin math structure', () => {
    const capacity: CapacityModel = {
      sustainableWeeklyHours: 7.0,
      medHours: 5.2,
      reliabilityMarginHours: 1.8,
      maxSessionDurationMinutes: 90,
    };

    expect(capacity.sustainableWeeklyHours).toBeGreaterThan(capacity.medHours);
    expect(capacity.reliabilityMarginHours).toBeCloseTo(
      capacity.sustainableWeeklyHours - capacity.medHours,
      1
    );
  });

  it('instantiates ExecutionObject with dose gradients and fallback hierarchy', () => {
    const session: ExecutionObject = {
      id: 'exec-01',
      trajectoryItemId: 'traj-item-01',
      userGoalId: 'goal-123',
      targetCapabilityId: 'cap-aerobic-01',
      actionName: 'Zone 2 Aerobic Foundation Run',
      purpose: 'Develop mitochondrial density and fat oxidation capacity',
      priorityTier: 1,
      standardDoseMinutes: 45,
      reducedDoseMinutes: 30,
      mvsDoseMinutes: 20,
      fallbackOptions: ['30 min low-impact indoor cycle', '25 min brisk ruck'],
      executionState: 'PLANNED',
      scheduledDate: new Date('2026-09-15T06:30:00Z'),
      startTime: '06:30',
      endTime: '07:15',
    };

    expect(session.standardDoseMinutes).toBeGreaterThan(session.reducedDoseMinutes);
    expect(session.reducedDoseMinutes).toBeGreaterThan(session.mvsDoseMinutes);
    expect(session.executionState).toBe('PLANNED');
  });

  it('instantiates TelemetrySignal correctly', () => {
    const signal: TelemetrySignal = {
      type: 'PROOF_OF_WORK',
      value: { completedDoseMinutes: 45, heartRateZone: 2 },
      timestamp: new Date(),
    };

    expect(signal.type).toBe('PROOF_OF_WORK');
    expect(signal.timestamp).toBeInstanceOf(Date);
  });

  it('instantiates DiagnosticRecord across diagnostic categories', () => {
    const diagnostic: DiagnosticRecord = {
      triggerReason: 'Missed 2 consecutive Tier 1 sessions',
      category: 'CAPACITY',
      details: 'Work deadline reduced daily availability by 2 hours',
      isPersistent: true,
      proposedAction: 'COMPRESS',
    };

    expect(diagnostic.category).toBe('CAPACITY');
    expect(diagnostic.proposedAction).toBe('COMPRESS');
    expect(diagnostic.isPersistent).toBe(true);
  });

  it('instantiates TrajectoryVersion and DecisionTrace', () => {
    const trajectory: TrajectoryVersion = {
      id: 'traj-v2',
      userGoalId: 'goal-123',
      versionNumber: 2,
      trigger: 'MATERIAL_DISRUPTION_RECOVERY',
      items: [],
      projectedCompletionDate: new Date('2026-12-18'),
      confidence: 'HIGH',
    };

    const trace: DecisionTrace = {
      trigger: 'Two Tier 1 sessions missed due to fever',
      observation: 'Resting heart rate elevated, adherence stalled for 4 days',
      diagnosis: 'Temporary physiological recovery deficit',
      assumptions: ['User will resume baseline capacity once afebrile'],
      optionsConsidered: [
        'Push missed sessions to next week (Rejected: violates No-Debt)',
        'Compress critical work and absorb missed volume (Selected)',
      ],
      decision: 'Absorb missed sessions without debt; preserve next long run',
      tradeOff: 'Sacrificed 10% supportive volume to protect core adaptation safely',
      forecastEffect: 'Projected completion remains Day 88',
      nextAction: 'Execute 30-minute easy resumption session on Thursday',
    };

    expect(trajectory.versionNumber).toBe(2);
    expect(trace.decision).toContain('Absorb missed sessions');
  });

  it('validates GoalIntegrityStatus states', () => {
    const validStatuses: GoalIntegrityStatus[] = [
      'INTACT',
      'AT_RISK',
      'COMPROMISED',
      'REVISED',
    ];
    expect(validStatuses).toHaveLength(4);
  });
});
