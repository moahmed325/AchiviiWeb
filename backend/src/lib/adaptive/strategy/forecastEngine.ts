import {
  ConfidenceLevel,
  GoalIntegrityStatus,
  CapabilityState,
} from '../core/types.js';
import { prisma } from '../../prisma.js';

export interface ForecastResult {
  userGoalId: string;
  projectedCompletionDate: Date;
  projectedWindowStart: Date;
  projectedWindowEnd: Date;
  projectedDayOffset: number; // e.g. Day 89
  projectedWindowDays: [number, number]; // e.g. [87, 91]
  confidenceLevel: ConfidenceLevel;
  adaptationRate: number; // e.g. capabilities established per week
  remainingCapabilitiesCount: number;
  establishedCapabilitiesCount: number;
  totalCapabilitiesCount: number;
  isWithinPlannedRunway: boolean;
}

export interface GoalIntegrityAuditResult {
  userGoalId: string;
  status: GoalIntegrityStatus;
  reason: string;
  originalOutcomeStatement: string;
  currentOutcomeStatement: string;
  originalVerificationCriteria: string;
  currentVerificationCriteria: string;
  requiresUserEscalation: boolean;
}

export interface OutcomeGateStatus {
  userGoalId: string;
  isAchieved: boolean;
  status: 'ACHIEVED' | 'NOT_MET' | 'IN_PROGRESS';
  verificationCriteria: string;
  evidenceCount: number;
  validatingEvidence: any[];
  unmetCriteria: string[];
  reason: string;
}

/**
 * Computes evidence-backed confidence level for a goal.
 * Confidence is earned through evidence, not wishful thinking.
 *
 * High: Baseline verified, critical path progressing, high reliability margin, fresh evidence (<14 days).
 * Moderate: Plausible trajectory, but unverified prerequisites or recent disruption (or evidence 14-28 days).
 * Low: Stalled progress, capacity deficit, or outdated evidence (>28 days or absent).
 */
export async function computeEvidenceConfidence(userGoalId: string): Promise<ConfidenceLevel> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: {
        include: {
          evidences: {
            orderBy: { recorded_at: 'desc' },
            take: 5,
          },
        },
      },
      trajectory_versions: {
        where: { is_active: true },
        take: 1,
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  // 1. Evidence Freshness (Max 35 points)
  let freshnessScore = 0;
  let allEvidences: any[] = [];
  for (const cap of userGoal.capabilities) {
    if (cap.evidences && cap.evidences.length > 0) {
      allEvidences.push(...cap.evidences);
    }
  }

  allEvidences.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
  const mostRecentEvidence = allEvidences[0];

  if (mostRecentEvidence) {
    const now = new Date().getTime();
    const recordedAt = new Date(mostRecentEvidence.recorded_at).getTime();
    const daysSinceEvidence = Math.max(0, Math.floor((now - recordedAt) / (1000 * 60 * 60 * 24)));

    if (daysSinceEvidence <= 7) {
      freshnessScore = 35;
    } else if (daysSinceEvidence <= 14) {
      freshnessScore = 25;
    } else if (daysSinceEvidence <= 28) {
      freshnessScore = 12;
    } else {
      freshnessScore = 0; // Stale evidence > 28 days
    }
  } else {
    freshnessScore = 0; // No evidence recorded
  }

  // 2. Reliability Margin (Max 25 points)
  let marginScore = 0;
  const capacity = userGoal.sustainable_weekly_capacity_hours ?? 6.0;
  const med = userGoal.current_med_hours ?? 4.5;
  const reliabilityMargin = capacity - med;

  if (reliabilityMargin >= 1.5) {
    marginScore = 25;
  } else if (reliabilityMargin >= 0.5) {
    marginScore = 18;
  } else if (reliabilityMargin >= 0) {
    marginScore = 10;
  } else {
    marginScore = 0; // Capacity deficit
  }

  // 3. Critical Path Progression & Prerequisites (Max 25 points)
  let criticalPathScore = 15; // default moderate
  const tier1Caps = userGoal.capabilities.filter(
    (c) => c.tier === 'TIER_1_CRITICAL' || c.tier === '1'
  );

  if (tier1Caps.length > 0) {
    const hasRegressed = tier1Caps.some((c) => c.state === 'REGRESSED');
    const hasEstablished = tier1Caps.some(
      (c) => c.state === 'ESTABLISHED' || c.state === 'ROBUST'
    );
    const allUntested = tier1Caps.every((c) => c.state === 'UNTESTED');

    if (hasRegressed) {
      criticalPathScore = 0;
    } else if (hasEstablished) {
      criticalPathScore = 25;
    } else if (allUntested) {
      criticalPathScore = 5;
    } else {
      criticalPathScore = 18;
    }
  }

  // 4. Trajectory Continuity & Confidence (Max 15 points)
  let trajectoryScore = 10;
  const activeTrajectory = userGoal.trajectory_versions[0];
  if (activeTrajectory) {
    const conf = activeTrajectory.confidence_score ?? 0.75;
    if (conf >= 0.85) {
      trajectoryScore = 15;
    } else if (conf >= 0.70) {
      trajectoryScore = 10;
    } else {
      trajectoryScore = 5;
    }
  }

  const totalScore = freshnessScore + marginScore + criticalPathScore + trajectoryScore;

  // Strict Rule: If evidence is absent or stale (> 28 days), confidence cannot be HIGH.
  // If margin is in deficit (< 0), confidence is LOW.
  if (reliabilityMargin < 0 || freshnessScore === 0 && userGoal.capabilities.length > 0) {
    if (totalScore < 45 || reliabilityMargin < -0.5 || freshnessScore === 0) {
      return 'LOW';
    }
    return 'MODERATE';
  }

  if (totalScore >= 75 && freshnessScore >= 25 && reliabilityMargin >= 0.5) {
    return 'HIGH';
  }

  if (totalScore >= 45) {
    return 'MODERATE';
  }

  return 'LOW';
}

/**
 * Computes the Dynamic Forecast Result:
 * Calculates projected completion window (e.g. Day 87–91) based on:
 * - Current capability state transitions achieved vs remaining.
 * - Demonstrated rate of adaptation.
 * - Remaining runway and reliability margin.
 */
export async function computeForecast(userGoalId: string): Promise<ForecastResult> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: true,
      trajectory_versions: {
        where: { is_active: true },
        take: 1,
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  const confidenceLevel = await computeEvidenceConfidence(userGoalId);

  const startDate = new Date(userGoal.start_date);
  const targetEndDate = new Date(
    userGoal.target_end_date || startDate.getTime() + 90 * 24 * 60 * 60 * 1000
  );
  const now = new Date();
  const daysElapsed = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const totalPlannedDays = Math.max(
    30,
    Math.round((targetEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const capabilities = userGoal.capabilities;
  const totalCapabilitiesCount = capabilities.length;
  const establishedCount = capabilities.filter(
    (c) => c.state === 'ESTABLISHED' || c.state === 'ROBUST'
  ).length;
  const remainingCount = totalCapabilitiesCount - establishedCount;

  // Demonstrated rate of adaptation (capabilities established per week)
  const weeksElapsed = Math.max(1, daysElapsed / 7);
  const adaptationRate = Math.round((establishedCount / weeksElapsed) * 10) / 10;

  // Expected baseline rate
  const plannedWeeks = Math.max(4, Math.round(totalPlannedDays / 7));
  const baselineRate = totalCapabilitiesCount > 0 ? totalCapabilitiesCount / plannedWeeks : 0.5;

  // Velocity factor clamped
  let velocityMultiplier = 1.0;
  if (establishedCount > 0 && adaptationRate > 0) {
    velocityMultiplier = Math.min(1.8, Math.max(0.6, adaptationRate / baselineRate));
  }

  // Margin adjustment
  const margin = (userGoal.sustainable_weekly_capacity_hours ?? 6) - (userGoal.current_med_hours ?? 4.5);
  if (margin < 0) {
    velocityMultiplier *= 0.8;
  } else if (margin >= 1.5) {
    velocityMultiplier *= 1.1;
  }

  // Calculate projected completion day offset
  let projectedDayOffset: number;

  if (totalCapabilitiesCount === 0) {
    // If no capabilities, check active trajectory or use 90 days
    if (userGoal.projected_completion_date) {
      projectedDayOffset = Math.round(
        (new Date(userGoal.projected_completion_date).getTime() - startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
    } else {
      projectedDayOffset = totalPlannedDays;
    }
  } else if (remainingCount === 0) {
    // Goal capabilities all established!
    projectedDayOffset = daysElapsed;
  } else {
    const effectiveWeeklyRate = Math.max(0.2, baselineRate * velocityMultiplier);
    const remainingWeeks = remainingCount / effectiveWeeklyRate;
    const remainingDays = Math.round(remainingWeeks * 7);
    projectedDayOffset = daysElapsed + remainingDays;
  }

  // Bound projected day offset reasonably
  projectedDayOffset = Math.max(daysElapsed, Math.round(projectedDayOffset));

  // Projected completion window width based on confidence
  // High confidence: +/- 2 days (window of 4 days, e.g. Day 87-91)
  // Moderate confidence: +/- 4 days
  // Low confidence: +/- 7 days
  const windowHalfWidth =
    confidenceLevel === 'HIGH' ? 2 : confidenceLevel === 'MODERATE' ? 4 : 7;

  const windowStartDay = Math.max(1, projectedDayOffset - windowHalfWidth);
  const windowEndDay = projectedDayOffset + windowHalfWidth;

  const projectedCompletionDate = new Date(
    startDate.getTime() + projectedDayOffset * 24 * 60 * 60 * 1000
  );
  const projectedWindowStart = new Date(
    startDate.getTime() + windowStartDay * 24 * 60 * 60 * 1000
  );
  const projectedWindowEnd = new Date(
    startDate.getTime() + windowEndDay * 24 * 60 * 60 * 1000
  );

  const isWithinPlannedRunway = projectedDayOffset <= totalPlannedDays;

  // Persist updated projected date in UserGoal
  await prisma.userGoal.update({
    where: { id: userGoalId },
    data: {
      projected_completion_date: projectedCompletionDate,
      confidence_level: confidenceLevel,
    },
  });

  return {
    userGoalId,
    projectedCompletionDate,
    projectedWindowStart,
    projectedWindowEnd,
    projectedDayOffset,
    projectedWindowDays: [windowStartDay, windowEndDay],
    confidenceLevel,
    adaptationRate,
    remainingCapabilitiesCount: remainingCount,
    establishedCapabilitiesCount: establishedCount,
    totalCapabilitiesCount,
    isWithinPlannedRunway,
  };
}

/**
 * Audits Goal Integrity: ensures the destination is protected against silent degradation.
 * Compares original outcome and verification criteria against current parameters.
 */
export function checkGoalIntegrity(
  originalOutcome: string,
  currentOutcome: string,
  originalCriteria: string,
  currentCriteria: string
): GoalIntegrityStatus {
  const normOrigOut = originalOutcome.trim().toLowerCase();
  const normCurrOut = currentOutcome.trim().toLowerCase();
  const normOrigCrit = originalCriteria.trim().toLowerCase();
  const normCurrCrit = currentCriteria.trim().toLowerCase();

  // 1. Identical destination & criteria
  if (normOrigOut === normCurrOut && normOrigCrit === normCurrCrit) {
    return 'INTACT';
  }

  // 2. Explicit Revision Check
  if (
    normCurrOut.includes('[revised]') ||
    normCurrCrit.includes('[revised]') ||
    normCurrOut.includes('(revised)')
  ) {
    return 'REVISED';
  }

  // 3. Known Downgrade Signatures
  const downgradePairs = [
    { original: 'half marathon', degraded: '10k' },
    { original: 'half marathon', degraded: '10 km' },
    { original: 'half marathon', degraded: '5k' },
    { original: 'marathon', degraded: 'half marathon' },
    { original: '10 real users', degraded: 'finish prototype' },
    { original: '10 real users', degraded: 'prototype only' },
    { original: '30-minute conversation', degraded: '500 words' },
    { original: '30-minute conversation', degraded: '10-minute' },
    { original: 'conversational', degraded: 'learn vocabulary' },
  ];

  for (const pair of downgradePairs) {
    if (normOrigOut.includes(pair.original) && (normCurrOut.includes(pair.degraded) || normCurrCrit.includes(pair.degraded))) {
      return 'COMPROMISED';
    }
  }

  // 4. Token overlap comparison to detect material destination shifts
  const origWords = new Set(normOrigOut.split(/\s+/).filter((w) => w.length > 3));
  const currWords = new Set(normCurrOut.split(/\s+/).filter((w) => w.length > 3));

  let sharedCount = 0;
  for (const word of currWords) {
    if (origWords.has(word)) sharedCount++;
  }

  const similarity = origWords.size > 0 ? sharedCount / origWords.size : 1.0;

  if (similarity < 0.4) {
    return 'COMPROMISED';
  }

  if (similarity < 0.75 || normOrigCrit !== normCurrCrit) {
    return 'AT_RISK';
  }

  return 'INTACT';
}

/**
 * Audits Goal Integrity: ensures the destination is protected against silent degradation.
 * Verifies that the original outcome statement and verification criteria have not been quietly downgraded.
 * If destination is no longer attainable under hard deadline constraints, flags COMPROMISED
 * and demands transparent user escalation.
 */
export async function auditGoalIntegrity(
  userGoalId: string,
  proposedChanges?: { outcomeStatement?: string; verificationCriteria?: string }
): Promise<GoalIntegrityAuditResult> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  const originalOutcome = userGoal.outcome_statement || 'Goal Destination';
  const originalCriteria = userGoal.verification_criteria || 'Unassisted real-world benchmark verification.';

  const currentOutcome = proposedChanges?.outcomeStatement ?? originalOutcome;
  const currentCriteria = proposedChanges?.verificationCriteria ?? originalCriteria;

  // 1. Evaluate semantic integrity against downgrades
  let status = checkGoalIntegrity(
    originalOutcome,
    currentOutcome,
    originalCriteria,
    currentCriteria
  );

  let reason = 'Destination and objective verification criteria are intact.';
  let requiresUserEscalation = false;

  if (status === 'COMPROMISED') {
    reason = 'Attempted silent downgrade of destination outcome statement or verification criteria detected.';
    requiresUserEscalation = true;
  } else if (status === 'AT_RISK') {
    reason = 'Material deviation in outcome wording or verification criteria detected.';
  } else if (status === 'REVISED') {
    reason = 'Goal has been formally and transparently revised by the user.';
  }

  // 2. Hard Deadline Check:
  // If deadline is HARD and projected completion exceeds target deadline,
  // destination is compromised because it cannot be safely achieved by fixed date.
  if (userGoal.deadline_type === 'HARD') {
    const targetEnd = new Date(userGoal.target_end_date);
    const projectedEnd = userGoal.projected_completion_date
      ? new Date(userGoal.projected_completion_date)
      : null;

    if (projectedEnd && projectedEnd.getTime() > targetEnd.getTime()) {
      status = 'COMPROMISED';
      reason = `Immovable HARD deadline (${targetEnd.toISOString().split('T')[0]}) cannot be achieved based on current trajectory (projected ${projectedEnd.toISOString().split('T')[0]}). Transparent escalation required.`;
      requiresUserEscalation = true;
    }
  }

  // Persist integrity status in UserGoal
  await prisma.userGoal.update({
    where: { id: userGoalId },
    data: { goal_integrity_status: status },
  });

  return {
    userGoalId,
    status,
    reason,
    originalOutcomeStatement: originalOutcome,
    currentOutcomeStatement: currentOutcome,
    originalVerificationCriteria: originalCriteria,
    currentVerificationCriteria: currentCriteria,
    requiresUserEscalation,
  };
}

/**
 * Outcome Gate:
 * Only declares goal ACHIEVED when objective verification criteria from Goal Definition
 * are satisfied by recorded evidence—never solely because 90 days elapsed or checklist is 100%.
 */
export async function verifyOutcomeGate(userGoalId: string): Promise<OutcomeGateStatus> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: {
        include: {
          evidences: true,
        },
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  const verificationCriteria =
    userGoal.verification_criteria ||
    'Demonstrate capability in an unassisted real-world benchmark session.';

  const capabilities = userGoal.capabilities;
  let allEvidences: any[] = [];
  for (const cap of capabilities) {
    if (cap.evidences && cap.evidences.length > 0) {
      allEvidences.push(...cap.evidences);
    }
  }

  const unmetCriteria: string[] = [];

  // Gate Condition 1: Must have recorded evidence
  if (allEvidences.length === 0) {
    unmetCriteria.push('No objective evidence has been submitted or verified for this goal.');
    return {
      userGoalId,
      isAchieved: false,
      status: 'NOT_MET',
      verificationCriteria,
      evidenceCount: 0,
      validatingEvidence: [],
      unmetCriteria,
      reason: 'Outcome Gate refused achievement: Goal cannot be declared achieved without objective proof-of-work evidence.',
    };
  }

  // Gate Condition 2: Check for explicit high-confidence outcome verification evidence
  const qualifyingOutcomeEvidence = allEvidences.filter((e) => {
    const isQualifyingType =
      e.proof_type === 'OUTCOME_VERIFICATION' ||
      e.proof_type === 'PERFORMANCE_TEST' ||
      e.proof_type === 'OBJECTIVE_METRIC';
    const hasSufficientConfidence = (e.confidence_weight ?? 0) >= 0.75;
    return isQualifyingType && hasSufficientConfidence;
  });

  // Gate Condition 3: Tier 1 critical capabilities must not be UNTESTED or REGRESSED
  const tier1Caps = capabilities.filter(
    (c) => c.tier === 'TIER_1_CRITICAL' || c.tier === '1'
  );
  const unestablishedTier1 = tier1Caps.filter(
    (c) => c.state !== 'ESTABLISHED' && c.state !== 'ROBUST'
  );

  if (unestablishedTier1.length > 0) {
    unmetCriteria.push(
      `Critical capabilities remain unestablished: ${unestablishedTier1.map((c) => c.name).join(', ')}`
    );
  }

  if (qualifyingOutcomeEvidence.length === 0) {
    unmetCriteria.push(
      'No evidence meeting the objective outcome verification standard (confidence >= 0.75) was found.'
    );
  }

  const isAchieved = unmetCriteria.length === 0;

  return {
    userGoalId,
    isAchieved,
    status: isAchieved ? 'ACHIEVED' : 'NOT_MET',
    verificationCriteria,
    evidenceCount: allEvidences.length,
    validatingEvidence: qualifyingOutcomeEvidence,
    unmetCriteria,
    reason: isAchieved
      ? 'Objective verification criteria successfully satisfied by verified benchmark evidence.'
      : 'Outcome Gate refused achievement: Required verification criteria not satisfied by recorded evidence.',
  };
}
