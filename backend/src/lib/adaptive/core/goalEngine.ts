import {
  GoalDomain,
  DeadlineType,
  GoalFormalizationResult,
  FeasibilityAssessment,
  FeasibilityZone,
  GoalIntegrityStatus,
} from './types.js';
import { generateStructuredContent } from '../../ai/gemini.js';

export interface FormalizeGoalInput {
  rawGoal: string;
  domain?: string;
  targetDeadline?: Date;
  deadlineType?: DeadlineType;
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
    'spanish', 'french', 'german', 'japanese', 'chinese', 'language', 'speak',
    'study', 'exam', 'read', 'book', 'certification', 'cert', 'course', 'math',
    'retrieval', 'fluent', 'vocabulary',
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
 * Formalizes a user's raw goal into a concrete outcome, objective verification criteria,
 * and baseline assessment queries using Gemini (with deterministic heuristic fallback).
 */
export async function formalizeGoal(input: FormalizeGoalInput): Promise<GoalFormalizationResult> {
  const rawGoal = input.rawGoal.trim();
  const domain: GoalDomain = (input.domain as GoalDomain) || inferDomain(rawGoal);
  const deadlineType: DeadlineType = input.deadlineType || 'SOFT';
  const targetDeadline = input.targetDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const prompt = `
You are the Lead Architect of the Adaptive 90-Day Execution System.
A user wants to achieve this 90-day goal: "${rawGoal}".

Analyze this goal and return a JSON object with:
1. concreteOutcomeStatement: A concrete, unambiguous definition of the achieved finish line (not a vague task).
2. verificationCriteria: Specific, observable, and falsifiable real-world test to prove the goal is achieved.
3. baselineQuestions: Exactly 3 simple, non-intimidating observable questions to determine their current starting state.
`;

  const aiResult = await generateStructuredContent<{
    concreteOutcomeStatement: string;
    verificationCriteria: string;
    baselineQuestions: string[];
  }>(prompt, 'You format goals into concrete, verified outcome specifications.');

  if (aiResult.success && aiResult.data && !aiResult.isFallback) {
    return {
      concreteOutcomeStatement: aiResult.data.concreteOutcomeStatement || rawGoal,
      verificationCriteria: aiResult.data.verificationCriteria || 'Real-world demonstrable evidence',
      baselineQuestions: aiResult.data.baselineQuestions || getDefaultBaselineQuestions(domain),
      deadlineType,
      domain,
      targetDeadline,
      isFallback: false,
    };
  }

  // Deterministic Fallback
  return {
    ...generateDeterministicFormalization(rawGoal, domain),
    deadlineType,
    domain,
    targetDeadline,
    isFallback: true,
  };
}

function getDefaultBaselineQuestions(domain: GoalDomain): string[] {
  switch (domain) {
    case 'PHYSICAL':
      return [
        'What is the longest continuous session you have completed in the past month?',
        'How many days per week have you consistently trained recently?',
        'Are you currently managing any acute joint or muscle discomfort?',
      ];
    case 'COGNITIVE':
      return [
        'Can you currently hold a 5-minute unassisted dialogue or recall core concepts without notes?',
        'How many hours per week have you dedicated to this skill over the last 4 weeks?',
        'What is the most advanced material or lesson you have completed successfully?',
      ];
    case 'PROJECT':
      return [
        'Have you validated the problem or received direct interest from prospective users?',
        'Do you already have a functional prototype, wireframe, or initial repository?',
        'How many dedicated, uninterrupted hours can you guarantee each week?',
      ];
  }
}

function generateDeterministicFormalization(
  rawGoal: string,
  domain: GoalDomain
): { concreteOutcomeStatement: string; verificationCriteria: string; baselineQuestions: string[] } {
  let concreteOutcomeStatement = rawGoal;
  let verificationCriteria = 'Demonstrate capability in an unassisted real-world benchmark session.';

  if (domain === 'PHYSICAL') {
    concreteOutcomeStatement = rawGoal.includes('marathon')
      ? rawGoal
      : `Complete target physical benchmark: ${rawGoal}`;
    verificationCriteria = 'Complete designated distance or effort standard verified by timing or activity telemetry.';
  } else if (domain === 'COGNITIVE') {
    concreteOutcomeStatement = rawGoal.includes('conversation')
      ? rawGoal
      : `Demonstrate conversational or retrieval proficiency: ${rawGoal}`;
    verificationCriteria = 'Sustain a 15-minute unassisted dialogue or complete objective retrieval test without aids.';
  } else {
    concreteOutcomeStatement = rawGoal.includes('MVP') || rawGoal.includes('launch')
      ? rawGoal
      : `Launch functioning MVP and onboard initial users: ${rawGoal}`;
    verificationCriteria = 'Working software delivered and actively utilized by real external target audience.';
  }

  return {
    concreteOutcomeStatement,
    verificationCriteria,
    baselineQuestions: getDefaultBaselineQuestions(domain),
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
