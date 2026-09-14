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

function generateDeterministicCapabilities(rawGoal: string, domain: GoalDomain): CustomCapabilityBlueprint[] {
  if (domain === 'PHYSICAL') {
    return [
      {
        id: 'cap_base',
        name: 'Aerobic Base & Movement Economy',
        description: 'Establish consistent foundational stimulus and movement efficiency',
        tier: 'TIER_1_CRITICAL',
        prerequisites: [],
      },
      {
        id: 'cap_stimulus',
        name: 'Aerobic Threshold & Work Capacity',
        description: 'Expand continuous output duration without excessive fatigue',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_base'],
      },
      {
        id: 'cap_resistance',
        name: 'Pace Resistance & Sustained Volume',
        description: 'Maintain target tempo under fatigue near milestone distance',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_stimulus'],
      },
      {
        id: 'cap_capstone',
        name: 'Destination Benchmark Trial',
        description: `Execute full unassisted benchmark: ${rawGoal}`,
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_resistance'],
      },
    ];
  } else if (domain === 'COGNITIVE') {
    return [
      {
        id: 'cap_vocab',
        name: 'Core Grammar & Retrieval Foundation',
        description: 'Master high-frequency syntax and immediate retrieval drills',
        tier: 'TIER_1_CRITICAL',
        prerequisites: [],
      },
      {
        id: 'cap_comprehension',
        name: 'Comprehension & Interactive Dialogue',
        description: 'Sustain active listening and unassisted real-time exchanges',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_vocab'],
      },
      {
        id: 'cap_fluency',
        name: 'Spontaneous Expression & Nuance',
        description: 'Communicate smoothly without reliance on vocabulary aids',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_comprehension'],
      },
      {
        id: 'cap_capstone',
        name: 'Unassisted Real-World Demonstration',
        description: `Deliver capstone trial: ${rawGoal}`,
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_fluency'],
      },
    ];
  } else {
    return [
      {
        id: 'cap_architecture',
        name: 'Core Architecture & Prototype Foundation',
        description: 'Validate requirements, establish skeleton structure, and setup workflow',
        tier: 'TIER_1_CRITICAL',
        prerequisites: [],
      },
      {
        id: 'cap_features',
        name: 'Essential Feature Implementation',
        description: 'Build primary value loop and user-facing capabilities',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_architecture'],
      },
      {
        id: 'cap_polish',
        name: 'Hardening, Refinement & User Feedback',
        description: 'Eliminate friction points, polish interactions, and test with real users',
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_features'],
      },
      {
        id: 'cap_capstone',
        name: 'Production Delivery & Launch',
        description: `Deliver completed output: ${rawGoal}`,
        tier: 'TIER_1_CRITICAL',
        prerequisites: ['cap_polish'],
      },
    ];
  }
}

function cleanGoalSubject(rawGoal: string): string {
  const cleaned = rawGoal
    .replace(/^(i want to|i'd like to|i plan to|my goal is to|learn how to|learn to|learn|build an?|build|master|run an?|run|write an?|write|achieve|become an?|become)\s+/i, '')
    .trim();
  return cleaned.length > 0 ? cleaned : rawGoal;
}

function generateDeterministicBaselineQuestions(rawGoal: string, domain: GoalDomain): CustomBaselineQuestion[] {
  const subject = cleanGoalSubject(rawGoal);

  // Domain-specific option sets
  let baselineOptions = [
    { value: 'complete_beginner', label: 'Complete beginner (starting fresh)', score: 1, recommended_weekly_hours: 4 },
    { value: 'novice', label: 'Novice (some basic practice)', score: 2, recommended_weekly_hours: 5 },
    { value: 'intermediate', label: 'Intermediate (solid fundamentals)', score: 3, recommended_weekly_hours: 6 },
    { value: 'advanced', label: 'Experienced / Advanced practitioner', score: 4, recommended_weekly_hours: 8 },
  ];

  let comfortOptions = [
    { value: 'theory_first', label: 'Concepts & fundamental strategy', score: 1 },
    { value: 'action_first', label: 'Hands-on practice & execution', score: 2 },
    { value: 'foundation_needed', label: 'Starting fresh across both', score: 3 },
  ];

  if (domain === 'PHYSICAL') {
    baselineOptions = [
      { value: 'fitness_beginner', label: '0–2 weeks casual training', score: 1, recommended_weekly_hours: 4 },
      { value: 'fitness_intermediate', label: 'Consistent weekly workouts', score: 2, recommended_weekly_hours: 5.5 },
      { value: 'fitness_advanced', label: 'High volume regular athlete', score: 3, recommended_weekly_hours: 7 },
    ];
    comfortOptions = [
      { value: 'stamina_cardio', label: 'Aerobic stamina & lungs', score: 1 },
      { value: 'strength_joints', label: 'Muscular strength & power', score: 2 },
      { value: 'balanced_intervals', label: 'Balanced (ready for intervals)', score: 3 },
    ];
  } else if (domain === 'PROJECT') {
    baselineOptions = [
      { value: 'project_beginner', label: 'First-time builder (new to this)', score: 1, recommended_weekly_hours: 4 },
      { value: 'project_intermediate', label: 'Built before, never launched full product', score: 2, recommended_weekly_hours: 6 },
      { value: 'project_advanced', label: 'Experienced builder / professional', score: 3, recommended_weekly_hours: 8 },
    ];
    comfortOptions = [
      { value: 'frontend_design', label: 'User interface & presentation', score: 1 },
      { value: 'backend_logic', label: 'Core architecture & data logic', score: 2 },
      { value: 'balanced_fullstack', label: 'Balanced full-cycle delivery', score: 3 },
    ];
  } else if (domain === 'COGNITIVE') {
    baselineOptions = [
      { value: 'study_beginner', label: 'Starting completely fresh', score: 1, recommended_weekly_hours: 3.5 },
      { value: 'study_intermediate', label: 'Know basic concepts & terms', score: 2, recommended_weekly_hours: 5 },
      { value: 'study_advanced', label: 'Solid grasp, targeting mastery', score: 3, recommended_weekly_hours: 6.5 },
    ];
    comfortOptions = [
      { value: 'reading_comprehension', label: 'Reading & absorbing concepts', score: 1 },
      { value: 'active_production', label: 'Speaking, writing, or active recall', score: 2 },
      { value: 'structured_rules', label: 'Rules, syntax, and theory', score: 3 },
    ];
  }

  return [
    {
      id: 'baseline_gate',
      question: `What is your current experience level with "${subject}"?`,
      purpose: 'BASELINE_CALIBRATION',
      options: baselineOptions,
    },
    {
      id: 'skill_comfort_zone',
      question: `Which area of "${subject}" is your primary comfort zone?`,
      purpose: 'GUIDANCE_SCAFFOLDING',
      options: comfortOptions,
    },
    {
      id: 'weekly_target_cadence',
      question: `How much weekly time can you protect for "${subject}"?`,
      purpose: 'CAPACITY_BUDGET',
      options: [
        { value: 'light_pace', label: 'Light pace (~4 hrs / week)', score: 1, recommended_weekly_hours: 4 },
        { value: 'balanced_pace', label: 'Balanced pace (~6 hrs / week)', score: 2, recommended_weekly_hours: 6 },
        { value: 'accelerated_pace', label: 'Intensive sprint (~8+ hrs / week)', score: 3, recommended_weekly_hours: 8 },
      ],
    },
  ];
}

/**
 * Formalizes a user's raw goal into a concrete outcome, objective verification criteria,
 * 4-node capability DAG, and tailored baseline assessment queries using Gemini (with deterministic heuristic fallback).
 */
export async function formalizeGoal(input: FormalizeGoalInput): Promise<GoalFormalizationResult> {
  const rawGoal = input.rawGoal.trim();
  const domain: GoalDomain = (input.domain as GoalDomain) || inferDomain(rawGoal);
  const deadlineType: DeadlineType = input.deadlineType || 'SOFT';
  const targetDeadline = input.targetDeadline || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const userHours = input.weeklyAvailableHours || 6;

  const systemInstruction = `You are the Lead Ambition Architect for Achivii, an elite Life + Ambition Execution System.
Your job is to formalize a user's raw ambition into an inspiring, concrete 90-day execution contract.
Adhere strictly to plain, encouraging English. Never use robotic jargon or MBA terms.

STRICT GOAL-SPECIFIC QUESTION RULES:
1. THE 3 ONBOARDING QUESTIONS AND EVERY SINGLE ANSWER OPTION MUST BE 100% SPECIFIC TO THE USER'S GOAL: "${rawGoal}".
   - NEVER use generic placeholders like "this ambition", "this craft", "in the last 30 days", "Concepts & strategy", or "Complete beginner".
   - Explicitly name the specific skill, sport, technology, language, instrument, or craft in the question titles and in all option labels!
2. QUESTION BLUEPRINT:
   - Question 1 (id: "baseline_gate", purpose: "BASELINE_CALIBRATION"):
     Ask specifically what their current real-world experience or benchmark is with "${rawGoal}".
     The 3 options MUST be concrete progressive tiers specific to this craft (2 to 6 words each).
   - Question 2 (id: "skill_asymmetry", purpose: "GUIDANCE_SCAFFOLDING"):
     Ask which sub-skill, discipline, or area of "${rawGoal}" they feel most comfortable with vs need guidance.
     The 3 options MUST name concrete sub-disciplines or components of "${rawGoal}" (2 to 6 words each).
   - Question 3 (id: "weekly_cadence", purpose: "CAPACITY_BUDGET"):
     Ask how much weekly time or frequency they can protect specifically for practicing/building/training "${rawGoal}".
     The 3 options must specify hours/week with domain-appropriate pace labels (2 to 6 words each).
3. NEVER ask about sleep, wake times, work hours, or daily routine (Life Structure handles this separately).
4. NEVER ask "How will you fail?" or "Why did you fail before?". Bake failure prevention into the milestones directly.
5. Every question MUST have 3 to 4 options, each with a crisp, low-stress label (2 to 6 words max).
Return ONLY valid JSON matching the requested schema.`;

  const prompt = `
A user wants to achieve this custom 90-day goal: "${rawGoal}".
${input.weeklyAvailableHours ? `The user has chosen a target pace of ${input.weeklyAvailableHours} hours/week.` : ''}

Generate custom milestone architecture and 3 custom onboarding questions strictly tailored to "${rawGoal}".
CRITICAL: The questions and every answer choice must be written specifically about "${rawGoal}". Do not return generic options.

Return a JSON object strictly matching this schema:
{
  "category": "Auto-detected category string (e.g. 'Athletics & Endurance', 'Software & Technology', 'Language & Fluency', 'Strength & Fitness', 'Music & Creative Arts', 'Writing & Publishing', 'Mind & Habits')",
  "domain": "PHYSICAL" | "COGNITIVE" | "PROJECT",
  "concreteOutcomeStatement": "Concrete, inspiring, unambiguous definition of the achieved finish line on Day 90",
  "verificationCriteria": "Specific, observable, falsifiable real-world proof test to prove completion",
  "recommendedWeeklyHours": Number (recommended sustainable hours/week, e.g. 4, 5, 6, 8),
  "feasibilityScore": Number (between 0.75 and 0.95),
  "feasibilityNote": "Short encouraging 1-sentence note explaining why this pace is sustainable",
  "capabilityDag": [
    {
      "id": "cap_1",
      "name": "Phase 1 Foundation Milestone Name for ${rawGoal}",
      "description": "Clear plain English description of this prerequisite capability",
      "tier": "TIER_1_CRITICAL",
      "prerequisites": []
    },
    {
      "id": "cap_2",
      "name": "Phase 2 Stimulus Milestone Name for ${rawGoal}",
      "description": "Progressive overload milestone",
      "tier": "TIER_1_CRITICAL",
      "prerequisites": ["cap_1"]
    },
    {
      "id": "cap_3",
      "name": "Phase 3 Peak Milestone Name for ${rawGoal}",
      "description": "Advanced endurance, pacing, or depth milestone",
      "tier": "TIER_1_CRITICAL",
      "prerequisites": ["cap_2"]
    },
    {
      "id": "cap_4",
      "name": "Capstone Verification Milestone Name for ${rawGoal}",
      "description": "Final trial rehearsal and benchmark",
      "tier": "TIER_1_CRITICAL",
      "prerequisites": ["cap_3"]
    }
  ],
  "baselineQuestions": [
    {
      "id": "baseline_gate",
      "question": "Specific question testing real-world baseline in ${rawGoal}",
      "purpose": "BASELINE_CALIBRATION",
      "options": [
        { "value": "opt_1", "label": "Specific beginner level in this craft (2-6 words)", "score": 1, "recommended_weekly_hours": 4 },
        { "value": "opt_2", "label": "Specific intermediate level in this craft (2-6 words)", "score": 2, "recommended_weekly_hours": 6 },
        { "value": "opt_3", "label": "Specific advanced level in this craft (2-6 words)", "score": 3, "recommended_weekly_hours": 8 }
      ]
    },
    {
      "id": "skill_asymmetry",
      "question": "Specific question assessing comfort zone across sub-skills of ${rawGoal}",
      "purpose": "GUIDANCE_SCAFFOLDING",
      "options": [
        { "value": "opt_1", "label": "Specific sub-skill A of this craft (2-6 words)", "score": 1 },
        { "value": "opt_2", "label": "Specific sub-skill B of this craft (2-6 words)", "score": 2 },
        { "value": "opt_3", "label": "Specific sub-skill C of this craft (2-6 words)", "score": 3 }
      ]
    },
    {
      "id": "weekly_cadence",
      "question": "Specific question establishing weekly dedicated hours/cadence for ${rawGoal}",
      "purpose": "CAPACITY_BUDGET",
      "options": [
        { "value": "light", "label": "Light pace with hours (2-6 words)", "score": 1, "recommended_weekly_hours": 4 },
        { "value": "balanced", "label": "Recommended pace with hours (2-6 words)", "score": 2, "recommended_weekly_hours": 6 },
        { "value": "accelerated", "label": "Intensive pace with hours (2-6 words)", "score": 3, "recommended_weekly_hours": 8 }
      ]
    }
  ]
}
`;

  const aiResult = await generateStructuredContent<{
    category?: string;
    domain?: GoalDomain;
    concreteOutcomeStatement: string;
    verificationCriteria: string;
    recommendedWeeklyHours?: number;
    feasibilityScore?: number;
    feasibilityNote?: string;
    capabilityDag?: CustomCapabilityBlueprint[];
    baselineQuestions?: CustomBaselineQuestion[];
  }>(prompt, systemInstruction);

  if (aiResult.success && aiResult.data && !aiResult.isFallback) {
    const finalDomain: GoalDomain = aiResult.data.domain || domain;
    const finalCategory = aiResult.data.category || inferCategory(rawGoal, finalDomain);
    const finalDag = Array.isArray(aiResult.data.capabilityDag) && aiResult.data.capabilityDag.length > 0
      ? aiResult.data.capabilityDag
      : generateDeterministicCapabilities(rawGoal, finalDomain);

    const finalQuestions = Array.isArray(aiResult.data.baselineQuestions) && aiResult.data.baselineQuestions.length > 0
      ? aiResult.data.baselineQuestions
      : generateDeterministicBaselineQuestions(rawGoal, finalDomain);

    return {
      concreteOutcomeStatement: aiResult.data.concreteOutcomeStatement || rawGoal,
      verificationCriteria: aiResult.data.verificationCriteria || 'Real-world demonstrable evidence',
      baselineQuestions: finalQuestions,
      deadlineType,
      domain: finalDomain,
      targetDeadline,
      category: finalCategory,
      recommendedWeeklyHours: aiResult.data.recommendedWeeklyHours || userHours,
      feasibilityScore: aiResult.data.feasibilityScore || 0.88,
      feasibilityNote: aiResult.data.feasibilityNote || `At ${userHours}h/week, this goal maintains high sustainable execution buffer.`,
      capabilityDag: finalDag,
      isFallback: false,
    };
  }

  // Deterministic Fallback
  return {
    ...generateDeterministicFormalization(rawGoal, domain, userHours),
    deadlineType,
    domain,
    targetDeadline,
    isFallback: true,
  };
}

function generateDeterministicFormalization(
  rawGoal: string,
  domain: GoalDomain,
  userHours: number = 6
): {
  concreteOutcomeStatement: string;
  verificationCriteria: string;
  category: string;
  recommendedWeeklyHours: number;
  feasibilityScore: number;
  feasibilityNote: string;
  capabilityDag: CustomCapabilityBlueprint[];
  baselineQuestions: CustomBaselineQuestion[];
} {
  let concreteOutcomeStatement = rawGoal;
  let verificationCriteria = 'Demonstrate capability in an unassisted real-world benchmark session.';
  const category = inferCategory(rawGoal, domain);

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
    category,
    recommendedWeeklyHours: userHours,
    feasibilityScore: 0.85,
    feasibilityNote: `At ${userHours}h/week, pacing provides balanced progress with reliable rest buffers.`,
    capabilityDag: generateDeterministicCapabilities(rawGoal, domain),
    baselineQuestions: generateDeterministicBaselineQuestions(rawGoal, domain),
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
