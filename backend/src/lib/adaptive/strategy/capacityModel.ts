export interface BottleneckContext {
  tier?: string;
  state?: string;
}

export interface MEDCalculationResult {
  medWeeklyMinutes: number;
  recommendedSessions: number;
  priorityDistribution: {
    tier1: number;
    tier2: number;
    tier3: number;
  };
}

export interface ReliabilityMarginResult {
  marginMinutes: number;
  marginRatio: number;
  health: 'ROBUST' | 'FRAGILE' | 'DEFICIT';
}

/**
 * Computes the Minimum Effective Dose (MED) required to advance the active goal.
 * MED represents the smallest practical weekly dosage that produces a high probability of adaptation.
 */
export function calculateMED(
  bottleneckOrContext: BottleneckContext | null | undefined,
  remainingRunwayDays: number,
  domain: string
): MEDCalculationResult {
  // Base minutes by domain for critical capabilities
  let baseMinutes = 240; // 4 hours baseline
  const normDomain = domain.toUpperCase();
  const tier = bottleneckOrContext?.tier || 'TIER_1_CRITICAL';
  const state = bottleneckOrContext?.state || 'UNTESTED';

  if (normDomain === 'PHYSICAL') {
    baseMinutes = tier === 'TIER_1_CRITICAL' ? 270 : 200;
  } else if (normDomain === 'COGNITIVE') {
    baseMinutes = tier === 'TIER_1_CRITICAL' ? 240 : 180;
  } else if (normDomain === 'PROJECT') {
    baseMinutes = tier === 'TIER_1_CRITICAL' ? 300 : 210;
  }

  // Adjust for state urgency
  if (state === 'REGRESSED') {
    // For regressed state, initial volume is throttled to establish safe adaptation without overload
    baseMinutes *= 0.85;
  } else if (state === 'EMERGING') {
    // Consolidation dose
    baseMinutes *= 1.0;
  }

  // Runway compression factor: when runway is compressed under 45 days
  if (remainingRunwayDays < 45 && remainingRunwayDays > 14) {
    const compressionFactor = Math.min(1.25, 45 / remainingRunwayDays);
    baseMinutes *= compressionFactor;
  }

  const medWeeklyMinutes = Math.round(baseMinutes);

  // Recommended sessions per week based on domain & fatigue constraints
  let recommendedSessions = 3;
  if (normDomain === 'PHYSICAL') {
    recommendedSessions = medWeeklyMinutes > 240 ? 4 : 3;
  } else if (normDomain === 'COGNITIVE') {
    // High frequency, smaller dose preferred for memory retrieval
    recommendedSessions = medWeeklyMinutes > 180 ? 4 : 3;
  } else {
    // Project deep work blocks
    recommendedSessions = medWeeklyMinutes > 240 ? 4 : 3;
  }

  return {
    medWeeklyMinutes,
    recommendedSessions,
    priorityDistribution: {
      tier1: 0.55, // 55% focused on critical path bottleneck
      tier2: 0.30, // 30% high leverage
      tier3: 0.15, // 15% supportive / maintenance
    },
  };
}

/**
 * Calculates Reliability Margin:
 * Sustainable Capacity - Minimum Effective Dose = Reliability Margin.
 *
 * Invariants:
 * - If Margin < 0, health is DEFICIT. The plan is mathematically unviable under current capacity.
 * - If MarginRatio < 5%, health is DEFICIT. Zero buffer against life disruptions.
 * - If 5% <= MarginRatio < 20%, health is FRAGILE.
 * - If MarginRatio >= 20%, health is ROBUST.
 */
export function calculateReliabilityMargin(
  sustainableCapacityMinutes: number,
  medMinutes: number
): ReliabilityMarginResult {
  const marginMinutes = sustainableCapacityMinutes - medMinutes;
  const marginRatio =
    sustainableCapacityMinutes > 0 ? marginMinutes / sustainableCapacityMinutes : -1;

  let health: 'ROBUST' | 'FRAGILE' | 'DEFICIT';

  if (marginMinutes < 0 || marginRatio < 0.05) {
    health = 'DEFICIT';
  } else if (marginRatio < 0.20) {
    health = 'FRAGILE';
  } else {
    health = 'ROBUST';
  }

  return {
    marginMinutes: Math.round(marginMinutes),
    marginRatio: Math.round(marginRatio * 100) / 100,
    health,
  };
}
