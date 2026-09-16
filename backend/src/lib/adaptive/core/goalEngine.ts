import {
  GoalDomain,
  DeadlineType,
  GoalFormalizationResult,
  FeasibilityAssessment,
  FeasibilityZone,
  GoalIntegrityStatus,
  CustomBaselineQuestion,
  CustomCapabilityBlueprint,
} from './types.js';
import { generateStructuredContent } from '../../ai/gemini.js';

export interface FormalizeGoalInput {
  rawGoal: string;
  domain?: string;
  targetDeadline?: Date;
  deadlineType?: DeadlineType;
  weeklyAvailableHours?: number;
}

export interface EvaluateFeasibilityInput {
  startingBaselineScore: number;
  targetDifficultyScore: number;
  weeklyAvailableHours: number;
  domain: string;
  deadlineDays?: number;
  requiredMedHours?: number;
}

/**
 * Infers domain from raw goal text heuristics if not explicitly specified.
 */
export function inferDomain(rawGoal: string): GoalDomain {
  const lower = rawGoal.toLowerCase();
  const physicalKeywords = [
    'run', 'marathon', '5k', '10k', 'half', 'swim', 'bike', 'cycle', 'triathlon',
    'lift', 'squat', 'bench', 'deadlift', 'workout', 'fitness', 'weight', 'muscle',
    'endurance', 'cardio', 'pace',
  ];
  const cognitiveKeywords = [
    'spanish', 'french', 'german', 'italian', 'japanese', 'chinese', 'russian', 'portuguese', 'arabic', 'korean',
    'language', 'speak', 'conversation', 'conversational', 'study', 'exam', 'read', 'book', 'certification', 'cert',
    'course', 'math', 'retrieval', 'fluent', 'fluency', 'vocabulary',
  ];

  if (physicalKeywords.some((kw) => lower.includes(kw))) {
    return 'PHYSICAL';
  }
  if (cognitiveKeywords.some((kw) => lower.includes(kw))) {
    return 'COGNITIVE';
  }
  return 'PROJECT';
}

/**
 * Infers a clean human-facing category from raw goal text.
 */
export function inferCategory(rawGoal: string, domain: GoalDomain): string {
  const lower = rawGoal.toLowerCase();
  if (
    lower.includes('code') ||
    lower.includes('web') ||
    lower.includes('app') ||
    lower.includes('software') ||
    lower.includes('python') ||
    lower.includes('program') ||
    lower.includes('build') ||
    lower.includes('saas')
  ) {
    return 'Software & Technology';
  }
  if (
    lower.includes('run') ||
    lower.includes('marathon') ||
    lower.includes('5k') ||
    lower.includes('10k') ||
    lower.includes('cardio') ||
    lower.includes('swim') ||
    lower.includes('bike')
  ) {
    return 'Athletics & Endurance';
  }
  if (
    lower.includes('lift') ||
    lower.includes('strength') ||
    lower.includes('gym') ||
    lower.includes('workout') ||
    lower.includes('muscle') ||
    lower.includes('hypertrophy')
  ) {
    return 'Strength & Fitness';
  }
  if (
    lower.includes('spanish') ||
    lower.includes('french') ||
    lower.includes('german') ||
    lower.includes('language') ||
    lower.includes('speak') ||
    lower.includes('japanese') ||
    lower.includes('chinese') ||
    lower.includes('arabic')
  ) {
    return 'Language & Fluency';
  }
  if (
    lower.includes('guitar') ||
    lower.includes('piano') ||
    lower.includes('music') ||
    lower.includes('song') ||
    lower.includes('instrument') ||
    lower.includes('sing') ||
    lower.includes('draw') ||
    lower.includes('art')
  ) {
    return 'Music & Creative Arts';
  }
  if (
    lower.includes('write') ||
    lower.includes('book') ||
    lower.includes('essay') ||
    lower.includes('publish') ||
    lower.includes('newsletter') ||
    lower.includes('video') ||
    lower.includes('youtube')
  ) {
    return 'Writing & Publishing';
  }
  if (
    lower.includes('meditat') ||
    lower.includes('read') ||
    lower.includes('habit') ||
    lower.includes('sleep') ||
    lower.includes('focus') ||
    lower.includes('routine')
  ) {
    return 'Mind & Habits';
  }
  return domain === 'PHYSICAL'
    ? 'Health & Athletics'
    : domain === 'COGNITIVE'
    ? 'Learning & Skill'
    : 'Personal Project';
}

/**
 * Clean stub for goal formalization (ready for fresh first-principles redesign).
 */
export async function formalizeGoal(input: FormalizeGoalInput): Promise<GoalFormalizationResult> {
  const finalDomain: GoalDomain = (input.domain as GoalDomain) || inferDomain(input.rawGoal);
  const finalCategory = inferCategory(input.rawGoal, finalDomain);
  const targetDeadline = input.targetDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const deadlineType = input.deadlineType || 'SOFT';
  const userHours = input.weeklyAvailableHours || 6.0;

  return {
    concreteOutcomeStatement: input.rawGoal,
    verificationCriteria: 'Demonstrate real-world outcome',
    baselineQuestions: [],
    deadlineType,
    domain: finalDomain,
    targetDeadline,
    category: finalCategory,
    recommendedWeeklyHours: userHours,
    feasibilityScore: 0.85,
    feasibilityNote: 'Ready for new goal architecture.',
    isFallback: true,
  };
}

/**
 * Evaluates 90-Day Feasibility (Feasibility Gate).
 * Calculates Gap, Minimum Effective Dose (MED), Sustainable Capacity, and Reliability Margin.
 * Classifies into GREEN, YELLOW, or RED zone.
 */
export function evaluateFeasibility(input: EvaluateFeasibilityInput): FeasibilityAssessment {
  const {
    startingBaselineScore,
    targetDifficultyScore,
    weeklyAvailableHours,
    domain,
    deadlineDays = 90,
  } = input;

  // Normalize scores: if both scores are <= 10, scale to 0-100; otherwise treat as 0-100
  const isTenScale = startingBaselineScore <= 10 && targetDifficultyScore <= 10;
  const normBaseline = isTenScale ? startingBaselineScore * 10 : startingBaselineScore;
  const normTarget = isTenScale ? targetDifficultyScore * 10 : targetDifficultyScore;
  const gap = Math.max(0, normTarget - normBaseline);

  // Compute Minimum Effective Dose (MED)
  let medHours = input.requiredMedHours;
  if (typeof medHours !== 'number') {
    // Base minimum hours needed per week
    const baseHours = domain === 'PHYSICAL' ? 3.0 : domain === 'COGNITIVE' ? 2.5 : 3.5;
    // Additional hours per 10 points of capability gap
    const slope = domain === 'PHYSICAL' ? 0.6 : domain === 'COGNITIVE' ? 0.5 : 0.7;
    medHours = baseHours + (gap / 10) * slope;

    // Time compression factor if deadline is shorter than 90 days
    if (deadlineDays < 84) {
      const compressionRatio = Math.max(1.0, 90 / Math.max(30, deadlineDays));
      medHours *= Math.min(1.5, compressionRatio);
    }
  }

  // Round MED for clean human arithmetic
  medHours = Math.round(medHours * 10) / 10;

  // Margin math: Capacity - MED = Reliability Margin
  const marginHours = weeklyAvailableHours - medHours;
  const marginRatio = weeklyAvailableHours > 0 ? marginHours / weeklyAvailableHours : -1;

  const bottleneckRisks: string[] = [];
  const recommendations: string[] = [];

  let zone: FeasibilityZone;
  let score: number;

  // Feasibility Thresholds:
  // RED: Available hours < MED, or margin < 5%, or gap impossible for 90 days (> 80 on 100-pt scale)
  if (marginHours < 0 || marginRatio < 0.05 || (gap > 80 && deadlineDays <= 90)) {
    zone = 'RED';
    score = Math.max(0.05, Math.min(0.45, 0.40 + marginRatio * 0.5));

    if (marginHours < 0) {
      bottleneckRisks.push(
        `Required Minimum Effective Dose (${medHours.toFixed(1)}h/wk) exceeds sustainable available capacity (${weeklyAvailableHours.toFixed(1)}h/wk).`
      );
    }
    if (gap > 80) {
      bottleneckRisks.push(
        `Starting capability gap (${gap} pts) is physiologically or technically unrealistic to bridge within ${deadlineDays} days.`
      );
    }
    if (marginRatio >= 0 && marginRatio < 0.05) {
      bottleneckRisks.push(
        `Reliability margin (${(marginRatio * 100).toFixed(1)}%) is virtually zero. Unplanned disruptions will cause plan collapse.`
      );
    }

    recommendations.push(
      'Adjust goal destination: calibrate to a high-probability intermediate milestone that fits your current capacity.'
    );
    recommendations.push(
      'If the deadline is soft, extend the target horizon beyond 90 days to maintain destination integrity.'
    );
  } else if (marginRatio < 0.20) {
    // YELLOW: Feasible but fragile (Margin between 5% and 20%)
    zone = 'YELLOW';
    score = Math.round((0.55 + marginRatio * 1.25) * 100) / 100;

    bottleneckRisks.push(
      `Tight reliability margin (${(marginRatio * 100).toFixed(0)}% spare capacity / ${marginHours.toFixed(1)}h). Fragile to work overtime or minor illness.`
    );
    recommendations.push(
      'Protect critical-path sessions strictly and actively prune lower-tier supportive activities.'
    );
    recommendations.push(
      'Use pre-defined Minimum Viable Sessions (MVS) immediately on constrained days to avoid missed days.'
    );
  } else {
    // GREEN: Comfortably feasible (Margin >= 20%)
    zone = 'GREEN';
    score = Math.min(0.95, Math.round((0.75 + marginRatio * 0.3) * 100) / 100);

    recommendations.push(
      `Sustainable capacity (${weeklyAvailableHours}h/wk) leaves a healthy reliability margin of ${marginHours.toFixed(1)}h/wk to absorb real life.`
    );
    recommendations.push(
      'Do not convert spare reliability buffer into extra homework; protect it to guarantee high consistency.'
    );
  }

  return {
    zone,
    score,
    bottleneckRisks,
    recommendations,
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

  // 3. Known Downgrade Signatures (Half marathon -> 10km, 10 users -> 1 user, etc.)
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
