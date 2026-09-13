import { CapabilityTier } from '../core/types.js';
import { prisma } from '../../prisma.js';

export type DeviationSeverity =
  | 'NONE'
  | 'SILENT_ABSORPTION'
  | 'MINOR_ABSORB'
  | 'MATERIAL_DISRUPTION';

export interface DeviationReport {
  userGoalId: string;
  severity: DeviationSeverity;
  consecutiveCriticalMisses: number;
  totalRecentMisses: number;
  affectedTiers: CapabilityTier[];
  isBottleneckThreatened: boolean;
  requiresDiagnostic: boolean;
  explanation: string;
}

/**
 * Evaluates execution deviation using Strategic Filtering and Hysteresis.
 * Low-impact misses (Tier 3/4 supportive) are silently absorbed by reliability margin.
 * Single critical misses with sufficient margin are absorbed as MINOR_ABSORB.
 * Only persistent critical-path misses (2+ consecutive) or capability regressions
 * trigger MATERIAL_DISRUPTION and activate the Diagnostic Engine.
 */
export async function evaluateDeviation(userGoalId: string): Promise<DeviationReport> {
  const userGoal = await prisma.userGoal.findUnique({
    where: { id: userGoalId },
    include: {
      capabilities: true,
      sessions: {
        orderBy: { scheduled_date: 'desc' },
        take: 14, // Inspect recent execution window
      },
    },
  });

  if (!userGoal) {
    throw new Error(`UserGoal with id "${userGoalId}" not found.`);
  }

  // Check if any capability has regressed
  const hasRegressedCapability = userGoal.capabilities.some(
    (cap) => cap.state === 'REGRESSED'
  );

  const recentSessions = userGoal.sessions;
  const missedSessions = recentSessions.filter(
    (s) => s.execution_state === 'MISSED' || s.status === 'MISSED'
  );

  if (missedSessions.length === 0 && !hasRegressedCapability) {
    return {
      userGoalId,
      severity: 'NONE',
      consecutiveCriticalMisses: 0,
      totalRecentMisses: 0,
      affectedTiers: [],
      isBottleneckThreatened: false,
      requiresDiagnostic: false,
      explanation: 'Execution on track. No deviations detected.',
    };
  }

  // Identify affected tiers of missed sessions
  const affectedTiersSet = new Set<CapabilityTier>();
  let consecutiveCriticalMisses = 0;
  let countingConsecutive = true;

  // Recent sessions are ordered desc (most recent first)
  for (const session of recentSessions) {
    const isMissed = session.execution_state === 'MISSED' || session.status === 'MISSED';
    const isCritical = session.tier === 'core';

    if (isMissed) {
      if (isCritical) {
        affectedTiersSet.add('TIER_1_CRITICAL');
        if (countingConsecutive) {
          consecutiveCriticalMisses++;
        }
      } else if (session.tier === 'buffer') {
        affectedTiersSet.add('TIER_2_HIGH_LEVERAGE');
      } else {
        affectedTiersSet.add('TIER_3_SUPPORTIVE');
      }
    } else if (isCritical && (session.execution_state === 'COMPLETED' || session.status === 'DONE')) {
      // Encountered completed critical session -> broke consecutive critical miss streak
      countingConsecutive = false;
    }
  }

  const affectedTiers = Array.from(affectedTiersSet);
  const totalRecentMisses = missedSessions.length;

  // Case 1: Capability Regression or Persistent Critical Misses (2+ consecutive)
  if (hasRegressedCapability || consecutiveCriticalMisses >= 2) {
    return {
      userGoalId,
      severity: 'MATERIAL_DISRUPTION',
      consecutiveCriticalMisses,
      totalRecentMisses,
      affectedTiers,
      isBottleneckThreatened: true,
      requiresDiagnostic: true,
      explanation: hasRegressedCapability
        ? 'Material disruption: Capability regression detected. Diagnostic required to investigate systemic cause.'
        : `Material disruption: ${consecutiveCriticalMisses} consecutive critical-path sessions missed. Trajectory threatened.`,
    };
  }

  // Case 2: Single Isolated Critical Miss with Reliability Margin
  if (consecutiveCriticalMisses === 1) {
    const hasMargin = userGoal.current_reliability_margin_hours >= 1.0;
    if (hasMargin) {
      return {
        userGoalId,
        severity: 'MINOR_ABSORB',
        consecutiveCriticalMisses: 1,
        totalRecentMisses,
        affectedTiers,
        isBottleneckThreatened: false,
        requiresDiagnostic: false,
        explanation:
          'Isolated critical session missed. Preserved by reliability margin without requiring catch-up debt or replanning.',
      };
    } else {
      // Very tight margin with critical miss -> material disruption
      return {
        userGoalId,
        severity: 'MATERIAL_DISRUPTION',
        consecutiveCriticalMisses: 1,
        totalRecentMisses,
        affectedTiers,
        isBottleneckThreatened: true,
        requiresDiagnostic: true,
        explanation:
          'Critical session missed on a fragile trajectory with zero reliability margin. Diagnostic required.',
      };
    }
  }

  // Case 3: Only Supportive (Tier 3) or High-Leverage (Tier 2) Misses
  return {
    userGoalId,
    severity: 'SILENT_ABSORPTION',
    consecutiveCriticalMisses: 0,
    totalRecentMisses,
    affectedTiers,
    isBottleneckThreatened: false,
    requiresDiagnostic: false,
    explanation:
      'Supportive sessions missed. Silently absorbed by reliability margin. No catch-up debt or schedule restructuring needed.',
  };
}
