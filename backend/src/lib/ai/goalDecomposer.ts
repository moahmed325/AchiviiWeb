import { generateStructuredContent } from './gemini.js';
import {
  findPresetForGoal,
  getVDOTPacingEntry,
  getBPMPacingEntry,
  getSaaSVelocityEntry,
  getLanguageVelocityEntry,
  getRecompPacingEntry,
  getYouTubeVelocityEntry,
  getWritingVelocityEntry,
  getDeepWorkVelocityEntry,
  getChessVelocityEntry,
  getSpeechVelocityEntry,
  CertifiedPresetBlueprint,
  EvidenceTriad
} from './presets/index.js';
import {
  resolveResearchCache,
  saveResearchCacheEntry,
  CacheResolutionResult
} from '../cache/researchCache.js';

export interface GoalClarification {
  canonicalKey: string;
  clarifiedOutcome: string;
  primaryDomain: string;
  capabilities: string[];
  scientificFrameworks: Array<{
    name: string;
    description: string;
    application: string;
  }>;
  verificationCriteria: string;
  followUpQuestions: Array<{
    id: string;
    question: string;
    subtitle: string;
    options: string[];
    allowCustom: boolean;
  }>;
  evidenceTriad?: EvidenceTriad;
}

export interface RoadmapWeekPlan {
  weekNumber: number;
  phase: 'Foundation' | 'Acceleration' | 'Mastery';
  theme: string;
  objective: string;
  keyMilestone: string;
  targetIntensity: number; // 60 - 100
  plannedMinutes: number;
}

export type ChallengeType = 'repetitions' | 'active_recall' | 'checklist' | 'exercise';

export interface RepetitionsChallenge {
  type: 'repetitions';
  drillName: string;
  targetCount: number;
  totalSets: number;
  unit: string; // e.g. "reps", "seconds", "measures", "rounds"
}

export interface ActiveRecallChallenge {
  type: 'active_recall';
  question: string;
  hint?: string;
  keyTakeaway: string;
}

export interface ChecklistChallenge {
  type: 'checklist';
  items: Array<{ id: string; label: string }>;
}

export interface ExerciseChallenge {
  type: 'exercise';
  prompt: string;
  targetDeliverable: string;
  evaluationCriteria: string;
}

export type StepChallenge =
  | RepetitionsChallenge
  | ActiveRecallChallenge
  | ChecklistChallenge
  | ExerciseChallenge;

export type TaskLayerType = 'mechanism' | 'adherence' | 'safety';

export const VALID_TASK_LAYERS: readonly TaskLayerType[] = ['mechanism', 'adherence', 'safety'] as const;

export interface DetailedStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  instructions: string;
  focusCue: string;
  pitfallToAvoid: string;
  layer: TaskLayerType;
  layerReasoning: string;
  challenge?: StepChallenge;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: 'youtube_video' | 'documentation' | 'scientific_study' | 'interactive_tool' | 'guide';
  resourceWhy?: string;
}

export function validateStepLayers(tasks: DailyTaskPlan[]): boolean {
  for (const task of tasks) {
    if (!task.detailedSteps || !Array.isArray(task.detailedSteps)) continue;
    for (const step of task.detailedSteps) {
      if (!step.layer || !VALID_TASK_LAYERS.includes(step.layer)) {
        console.error(
          `[GoalDecomposer] Validation Error: Missing or invalid layer '${(step as any).layer}' on Day ${task.dayNumber} step ${step.stepNumber} ("${step.title}")`
        );
        return false;
      }
      if (!step.layerReasoning || typeof step.layerReasoning !== 'string' || !step.layerReasoning.trim()) {
        console.error(
          `[GoalDecomposer] Validation Error: Missing or empty layerReasoning on Day ${task.dayNumber} step ${step.stepNumber} ("${step.title}")`
        );
        return false;
      }
    }
  }
  return true;
}

export interface DailyTaskPlan {
  dayNumber: number;
  dayOfWeek: string;
  title: string;
  isRestDay: boolean;
  durationMinutes: number;
  slotTime: string;
  implementationIntention: string;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: 'documentation' | 'video' | 'interactive_tool' | 'guide';
  resourceWhy?: string;
  detailedSteps: DetailedStep[];
}

export interface PlanGenerationResult {
  clarifiedOutcome: string;
  methodologyNotes: string;
  weeks: RoadmapWeekPlan[];
  initialTasks: DailyTaskPlan[];
}

export interface CommitmentItem {
  id?: string;
  title: string;
  time?: string;
  category?: string;
  days?: string[];
}

export interface UserRoutineInput {
  wakeTime?: string; // e.g. "07:00"
  sleepTime?: string; // e.g. "23:00"
  busyHours?: string; // e.g. "09:00 - 17:00"
  preferredSlot?: 'morning' | 'afternoon' | 'evening';
  dailyMinutes?: number; // e.g. 30, 45, 60, 90
  planVariant?: 'steady' | 'accelerated' | 'minimal';
  commitments?: Array<CommitmentItem | string>;
}

/**
 * Step 1: Clarify a raw user goal using Gemini.
 * Identifies domain, 5-8 sub-skills/capabilities, clarifies the 90-day outcome,
 * applies scientific frameworks, and generates 3-4 domain-specific clarifying questions.
 */
export async function clarifyGoalWithAI(rawGoal: string): Promise<GoalClarification> {
  const preset = findPresetForGoal(rawGoal);
  if (preset) {
    return {
      canonicalKey: getPresetCanonicalKey(preset.id),
      clarifiedOutcome: preset.clarifiedOutcome,
      primaryDomain: preset.primaryDomain,
      capabilities: preset.capabilities && preset.capabilities.length > 0
        ? preset.capabilities
        : [
            'Foundational Mechanics & Posture',
            'Deliberate Practice Micro-Drills',
            'Tempo & Rhythm Automation',
            'Error Auditing & Friction Recovery',
            'Capstone Repertoire Integration'
          ],
      scientificFrameworks: preset.scientificFrameworks,
      verificationCriteria: preset.verificationCriteria,
      followUpQuestions: preset.diagnosticQuestions,
      evidenceTriad: preset.evidenceTriad
    };
  }

  const systemInstruction = `You are the Master Goal Architect and Cognitive Performance Scientist at Achivii.
Your mission is to take any raw goal provided by a user and transform it into a scientifically and socially proven 90-day execution blueprint.
You apply:
1. The 12 Week Year (12 weeks = 1 full year, outcome clarity, high urgency)
2. Deliberate Practice & Spaced Repetition (Anders Ericsson)
3. Implementation Intentions (Peter Gollwitzer)
4. Progressive Overload & Ultradian Rhythms

Always respond with clean, valid JSON matching the requested schema.`;

  const prompt = `Analyze this user's custom goal:
"${rawGoal}"

1. Refine the user's goal into a clean, simple, action-oriented 90-day outcome title (maximum 6-12 words).
   - Keep it inspiring, clear, and punchy.
   - Use active voice (e.g. "Build and deploy a full-stack Django web application" or "Run a 10K under 50 minutes without stopping").
   - NEVER use formulaic prefixes like "By Day 90, I will have successfully..." or "By Day 90, achieve full mastery of...".
   - DO NOT include run-on specification clauses like ", complete with user authentication...".
2. Identify the primary domain (e.g. "Acoustic Guitar", "Full-Stack Web Development", "Endurance Running", "Conversational Spanish", "Product Management").
3. Identify exactly 5 to 8 specific capabilities / sub-skills required to master this goal by Day 90.
4. Cite 2-3 proven scientific or professional methodologies relevant to this domain and explain how they will be applied.
5. State the single capstone verification test that proves the goal was achieved by Day 90.
6. Create exactly 3-4 domain-specific follow-up questions to diagnose:
   - Current baseline / prior experience
   - Specific equipment / environment available
   - Primary style, sub-focus, or target aspiration
   - Biggest historical obstacle or friction point
7. Additionally, output a \`canonicalKey\`: a lowercase, dot-separated hierarchical
domain key that uniquely identifies this goal's category, general enough that
close variants of the same goal (different phrasing, same underlying ambition)
would map to the SAME key. Format: <broad_domain>.<sub_domain>.<specific_goal>.
Examples: "fitness.running.10k", "culinary.baking.sourdough", "music.guitar.acoustic_songs", "tech.cloud.aws_architect", "lang.spanish.conversational".
CRITICAL DOMAIN ROUTING RULE: <broad_domain> MUST categorize the primary action/skill being practiced, NOT adjectives or national origins mentioned in the title.
- Culinary/cooking/baking goals (even with nationalities like "French sourdough" or "Italian pasta") MUST belong to "culinary", NEVER "lang".
- Language learning goals ("learn French", "speak conversational Spanish") MUST belong to "lang".
- Physical training/athletics belong to "fitness".
- Software/IT/engineering belong to "tech" or "engineering".
- Visual/fine arts belong to "art".
- Music/audio belong to "music".

JSON schema:
{
  "canonicalKey": string,
  "clarifiedOutcome": string,
  "primaryDomain": string,
  "capabilities": string[],
  "scientificFrameworks": [
    { "name": string, "description": string, "application": string }
  ],
  "verificationCriteria": string,
  "followUpQuestions": [
    {
      "id": string,
      "question": string,
      "subtitle": string,
      "options": string[],
      "allowCustom": boolean
    }
  ]
}
`;

  const result = await generateStructuredContent<GoalClarification>(prompt, systemInstruction);

  if (result.success && result.data && result.data.clarifiedOutcome && result.data.followUpQuestions?.length) {
    if (!result.data.capabilities || !result.data.capabilities.length) {
      result.data.capabilities = [
        'Foundational Mechanics',
        'Deliberate Practice Reps',
        'Tempo & Speed Fluency',
        'Error Diagnostic Auditing',
        'Capstone Fluency Integration'
      ];
    }
    result.data.canonicalKey = sanitizeCanonicalKey(
      result.data.canonicalKey,
      rawGoal,
      result.data.primaryDomain,
      result.data.clarifiedOutcome
    );
    return result.data;
  }

  // Fallback: If both AI providers fail for a custom goal, do NOT fabricate a degraded plan.
  throw new Error('Unable to analyze your goal right now. AI services are temporarily unavailable. Please retry.');
}

/**
 * Step 2: Generate the 12-week strategic roadmap and Week 1 daily tasks.
 * Scheduled around the user's routine with "Wonderwall-level" precision.
 */
export async function generate12WeekPlanWithAI(
  rawGoal: string,
  clarifiedOutcome: string,
  answers: Record<string, string>,
  routine: UserRoutineInput,
  startDate: Date = new Date()
): Promise<PlanGenerationResult> {
  const dailyMins = routine.dailyMinutes || 60;
  const preferredSlot = routine.preferredSlot || 'evening';
  const defaultSlotTime = preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
  const planVariant = routine.planVariant || 'steady';
  const activeDaysTarget = planVariant === 'minimal' ? 4 : planVariant === 'accelerated' ? 6 : 5;
  const restDaysTarget = 7 - activeDaysTarget;

  const commitmentsFormatted = routine.commitments && routine.commitments.length > 0
    ? routine.commitments
        .map(c => typeof c === 'string' ? `- ${c}` : `- ${c.title}${c.time ? ` (${c.time})` : ''}`)
        .join('\n')
    : 'None';

  const systemInstruction = `You are Achivii's Principal Curriculum Engineer and Execution Coach.
You create world-class 90-day goal blueprints.
You follow:
- 12 Week Year: Weeks 1-4 Foundation (mechanics, ~60% load), Weeks 5-8 Acceleration (~80% load), Weeks 9-12 Mastery (100% load & Capstone).
- Milestone Gates: Week 4, Week 8, and Week 12 are hard-gate milestone checkpoints.
- Plan Variant Pacing: Obey the selected track (${planVariant}: ${activeDaysTarget} active days, ${restDaysTarget} rest days).
- The 2-Day Rule: User MUST NEVER have 2 consecutive rest days.
- Wonderwall-level Task Precision: Every single day's task must have an implementation intention, explicit micro-drills with timing, focus cues, failure pitfalls, and curated learning resources.

THREE EVIDENCE LAYERS & CONFLICT RULE:
For every single step you generate, you must classify it under exactly one evidence layer:
- 'mechanism': grounded in established science/research for this domain
- 'adherence': grounded in what real people who succeeded at similar goals actually did in practice, even if it's not the theoretically optimal approach
- 'safety': grounded in how professionals/practitioners in this domain sequence things to prevent injury, burnout, or wasted effort

CONFLICT RULE: When the scientifically optimal approach and the most commonly-succeeded-with real-world approach differ for a given step, default to the adherence-favoring version during Weeks 1-8 (Foundation and Acceleration phases). Introduce the more optimal/science-favoring version starting Week 9 (Mastery phase), once the habit is established. Safety/professional guidance always overrides both other layers with no exceptions — never generate a step a professional in this domain would consider unsafe or poorly sequenced, even if it's scientifically optimal or socially popular.`;

  const answersFormatted = Object.entries(answers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n');

  const preset = findPresetForGoal(rawGoal) || findPresetForGoal(clarifiedOutcome);
  let presetEnforcementPrompt = '';
  if (preset) {
    let pacingSection = '';
    if (preset.vdotPacingTable) {
      const baselineVal = answers['baseline5k'] || answers['What is your current comfortable 5K running baseline?'] || Object.values(answers)[0];
      const vdot = getVDOTPacingEntry(baselineVal, preset);
      if (vdot) {
        pacingSection = `
CERTIFIED VDOT PACING MATRIX (Calculated for user's baseline: "${vdot.label}"):
- Easy (Zone 2) Pace: ${vdot.easyPace}
- Marathon Pace: ${vdot.marathonPace}
- Lactate Threshold Pace: ${vdot.thresholdPace}
- Interval (VO2 Max) Pace: ${vdot.intervalPace}
- Repetition Pace: ${vdot.repetitionPace}
- Target Heart Rate: ${vdot.targetHeartRateRange}
MANDATORY: You MUST integrate these exact calculated pace splits and heart rate targets into the task instructions, focus cues, and challenge drill targets!`;
      }
    } else if (preset.bpmPacingTable) {
      const baselineVal = answers['baseline'] || answers['What is your current comfortable acoustic guitar playing baseline?'] || Object.values(answers)[0];
      const bpmEntry = getBPMPacingEntry(baselineVal, preset);
      if (bpmEntry) {
        pacingSection = `
CERTIFIED METRONOME & TRANSITION PACING MATRIX (Calculated for user's baseline: "${bpmEntry.label}"):
- Starting Practice Tempo: ${bpmEntry.startingPracticeBPM} BPM (steady 4/4 downbeats)
- 1-Minute Chord Change Target: ${bpmEntry.switchesTargetPerMin} clean switches per minute
- Song Performance Target Tempo: ${bpmEntry.songTargetBPM} BPM
- Calibrated Metronome Target: ${bpmEntry.targetMetronomeRange}
MANDATORY: You MUST integrate these exact BPM tempos, transition switches/min, and metronome targets into the daily instructions, focus cues, and repetition challenges!`;
      }
    } else if (preset.saasVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current technical engineering baseline?'] || Object.values(answers)[0];
      const saasEntry = getSaaSVelocityEntry(baselineVal, preset);
      if (saasEntry) {
        pacingSection = `
CERTIFIED SAAS VELOCITY & ARCHITECTURE MATRIX (Calculated for user's baseline: "${saasEntry.label}"):
- Recommended Tech Stack: ${saasEntry.recommendedStack}
- Core Loop Scope: ${saasEntry.coreLoopScope}
- Target Launch Milestone: Week ${saasEntry.targetLaunchWeek}
- Founder Guidance: ${saasEntry.guidance}
MANDATORY: You MUST integrate this recommended stack, core-loop scoping, and rapid deployment guidance into the daily task instructions, focus cues, and deliverable checklists!`;
      }
    } else if (preset.languageVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current spoken Spanish baseline?'] || Object.values(answers)[0];
      const langEntry = getLanguageVelocityEntry(baselineVal, preset);
      if (langEntry) {
        pacingSection = `
CERTIFIED LANGUAGE VELOCITY & CEFR PACING MATRIX (Calculated for user's baseline: "${langEntry.label}"):
- Active Functional Vocabulary Target: ${langEntry.activeVocabTarget} words
- Spoken Output Rate: ${langEntry.speechRateWPM} words per minute
- Curricular Focus: ${langEntry.coreFocus}
- Daily Recommended Immersion: ${langEntry.targetDailyMinutes} minutes
MANDATORY: Every daily task MUST mandate verbal spoken vocalization (speaking aloud, shadowing, or voice note recording). Banish silent reading drills. Embed active vocabulary targets and speech rate targets directly into daily instructions!`;
      }
    } else if (preset.recompPacingTable) {
      const baselineVal = answers['baseline'] || answers['What is your current training experience and body composition baseline?'] || Object.values(answers)[0];
      const recompEntry = getRecompPacingEntry(baselineVal, preset);
      if (recompEntry) {
        pacingSection = `
CERTIFIED PHYSIQUE RECOMPOSITION & NUTRITION MATRIX (Calculated for user's baseline: "${recompEntry.label}"):
- Daily Calorie Deficit: ${recompEntry.dailyCalorieDeficit} kcal (maintain consistent energy balance)
- Daily Protein Target: ${recompEntry.proteinTargetGPerKg} g/kg of bodyweight (distributed across 3–4 meals with ≥3g leucine each)
- Weekly Hypertrophy Volume: ${recompEntry.weeklySetsPerMuscle} (1–3 RIR with strict 3-second eccentric control)
- Daily NEAT Target: ${recompEntry.neatStepTarget.toLocaleString()} steps per day (Zone 1/2 expenditure, no hard cardio burnout)
- Refeed Protocol: ${recompEntry.refeedFrequency}
- Coach Strategy: ${recompEntry.guidance}
MANDATORY: You MUST integrate these exact caloric deficit targets, protein targets (g/kg), 3-second eccentric tempos, RIR guidance, and 8,000–10,000 NEAT step targets into the daily workout instructions, focus cues, and repetition challenges!`;
      }
    } else if (preset.youtubeVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current YouTube production and on-camera experience?'] || Object.values(answers)[0];
      const ytEntry = getYouTubeVelocityEntry(baselineVal, preset);
      if (ytEntry) {
        pacingSection = `
CERTIFIED CREATOR VELOCITY & PACKAGING MATRIX (Calculated for user's baseline: "${ytEntry.label}"):
- Target Video Runtime: ${ytEntry.targetRuntimeMins}
- First-30-Second Retention Benchmark: ≥${ytEntry.first30sRetentionTarget}%
- Minimum CTR Benchmark: ≥${ytEntry.ctrTarget}%
- Weekly Production Hours Budget: ${ytEntry.weeklyProductionHours} hours (4-hour maximum lean edit constraint)
- Creator Guidance: ${ytEntry.guidance}
MANDATORY: You MUST integrate these exact runtime targets, 30-second hook principles, 4-hour editing limits, and Title/Thumbnail packaging standards into the daily task instructions, focus cues, and deliverable checklists!`;
      }
    } else if (preset.writingVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current writing experience and daily habit baseline?'] || Object.values(answers)[0];
      const bookEntry = getWritingVelocityEntry(baselineVal, preset);
      if (bookEntry) {
        pacingSection = `
CERTIFIED AUTHOR VELOCITY & DRAFTING MATRIX (Calculated for user's baseline: "${bookEntry.label}"):
- Daily Word Quota: ${bookEntry.dailyTargetWords} words per drafting session
- Weekly Target Volume: ${bookEntry.weeklyWordQuota} words per week
- Target Chapter Count: ${bookEntry.targetChapterCount} chapters (~3,000 words each)
- Recommended Drafting Block: ${bookEntry.recommendedSessionWindow} (Enforce Closed-Door Drafting, zero editing)
- Author Guidance: ${bookEntry.guidance}
MANDATORY: You MUST integrate these exact daily word quotas (350–750 words), 3-beat chapter structures, [TK] placeholder conventions, and closed-door drafting rules into the daily task instructions, focus cues, and repetition challenges!`;
      }
    } else if (preset.deepWorkVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current daily unbroken focus baseline?'] || Object.values(answers)[0];
      const dwEntry = getDeepWorkVelocityEntry(baselineVal, preset);
      if (dwEntry) {
        pacingSection = `
CERTIFIED DEEP WORK & COGNITIVE VELOCITY MATRIX (Calculated for user's baseline: "${dwEntry.label}"):
- Daily Deep Work Target: ${dwEntry.dailyDeepWorkHours} hours per day (biologically capped at 4.0h ceiling)
- Recommended Focus Block Duration: ${dwEntry.blockLengthMins} minutes (unbroken airplane mode)
- Target Screen Time Reduction: -${dwEntry.screenTimeReductionTarget}% from baseline
- Weekly Output Target Multiplier: ${dwEntry.weeklyOutputMultiplier}
- Deep Work Guidance: ${dwEntry.guidance}
MANDATORY: You MUST integrate these exact focus block lengths (${dwEntry.blockLengthMins}m), zero-interruption airplane mode rules, the physical distraction notepad, and the vocalized daily shutdown ritual into the daily task instructions, focus cues, and deliverable checklists!`;
      }
    } else if (preset.chessVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current chess rating or playing experience?'] || Object.values(answers)[0];
      const chessEntry = getChessVelocityEntry(baselineVal, preset);
      if (chessEntry) {
        pacingSection = `
CERTIFIED CHESS VELOCITY & RATING PROGRESSION MATRIX (Calculated for user's baseline: "${chessEntry.label}"):
- Daily Tactical Puzzles Target: ${chessEntry.dailyTacticsCount} puzzles/day (Woodpecker spaced repetition loops)
- Target Puzzle Accuracy: ${chessEntry.puzzleAccuracyTarget} (enforce deep calculation, zero guessing)
- Weekly Rated Rapid Matches: ${chessEntry.weeklyRapidGames} games (strictly 15+10 time control)
- Recommended Repertoire: ${chessEntry.openingSystem}
- Coach Strategy: ${chessEntry.guidance}
MANDATORY: You MUST integrate these exact daily puzzle counts (${chessEntry.dailyTacticsCount}), 15+10 time controls, mandatory 3-second CCT pauses, and Silman LPDO scans into the daily task instructions, focus cues, and deliverable checklists!`;
      }
    } else if (preset.speechVelocityTable) {
      const baselineVal = answers['baseline'] || answers['What is your current public speaking and presentation experience?'] || Object.values(answers)[0];
      const speechEntry = getSpeechVelocityEntry(baselineVal, preset);
      if (speechEntry) {
        pacingSection = `
CERTIFIED RHETORICAL & PUBLIC SPEAKING MATRIX (Calculated for user's baseline: "${speechEntry.label}"):
- Speech Length Target: ${speechEntry.speechLengthMins} minutes (unbroken from memory)
- Audible Filler Word Target: ${speechEntry.fillerWordsPerMinTarget} (mandatory 2-second silent breath substitution)
- Weekly Vocal Dynamics Drills: ${speechEntry.weeklyVocalDrillsMinutes} minutes (belly breathing & pitch/tempo variation)
- Target Delivery Pace: ${speechEntry.targetWPM}
- Coach Strategy: ${speechEntry.guidance}
MANDATORY: You MUST integrate the 15-word throughline constraint, 130–150 WPM pacing, Duarte sparkline contrast ("What Is" vs "What Could Be"), and silent pause technique into the daily task instructions, focus cues, and deliverable checklists!`;
      }
    }

    presetEnforcementPrompt = `
================================================================================
CERTIFIED MASTER BLUEPRINT ENFORCEMENT: ${preset.badge}
================================================================================
${preset.expertPromptContext}
${pacingSection}

INVARIANT 12-WEEK PERIODIZATION SKELETON:
${preset.weeks.map(w => `- Week ${w.weekNumber} [${w.phase}] (Intensity ${w.targetIntensity}%): "${w.theme}" | Objective: "${w.objective}" | Milestone: "${w.keyMilestone}"`).join('\n')}

For the "weeks" array in your JSON output, you MUST follow the 12 invariant themes, objectives, and milestones above!
For "initialTasks" (Week 1), generate 7 daily tasks based on the verified workout progression from the blueprint's Week 1 schedule.
================================================================================
`;
  }

  const prompt = `${presetEnforcementPrompt}Goal: "${rawGoal}"
Refined Outcome: "${clarifiedOutcome}"
User Diagnostic Answers:
${answersFormatted || 'None provided'}

User Routine & Commitments:
- Plan Variant Track: "${planVariant.toUpperCase()}" (${activeDaysTarget} active practice days, ${restDaysTarget} rest/recovery days per week).
- Wake: ${routine.wakeTime || '07:00'} | Sleep: ${routine.sleepTime || '23:00'}
- Work/Busy block: ${routine.busyHours || '09:00 - 17:00'}
- Other Daily Commitments (Gym, Classes, Commute, etc.):
${commitmentsFormatted}
- Preferred Focus Window: ${preferredSlot} (Target Slot: ${defaultSlotTime})
- Daily Session Duration: ${dailyMins} minutes

CRITICAL SCHEDULING CONSTRAINT:
Deliberate practice sessions must NEVER overlap with the user's work/busy hours (${routine.busyHours || '09:00 - 17:00'}) or other recurring commitments (e.g. gym, classes, commute). Respect the target focus slot ${defaultSlotTime}.

Required Output:
1. "methodologyNotes": Concise 2-sentence summary of the scientific curriculum strategy.
2. "weeks": Exactly 12 weeks:
   - Weeks 1 to 4: phase = "Foundation" (targetIntensity: 60-70)
     * Week 4 keyMilestone MUST be: "Phase 1 Foundation Milestone Gate: Mechanics & Posture Diagnostic"
   - Weeks 5 to 8: phase = "Acceleration" (targetIntensity: 75-85)
     * Week 8 keyMilestone MUST be: "Phase 2 Acceleration Milestone Gate: Tempo & Fluency Benchmark"
   - Weeks 9 to 12: phase = "Mastery" (targetIntensity: 90-100)
     * Week 12 keyMilestone MUST be: "Phase 3 Mastery Capstone Verification & Final Proof of Achievement"
   Each week must have: weekNumber (1-12), phase, theme, objective, keyMilestone, targetIntensity, plannedMinutes (${dailyMins}).
3. "initialTasks": Exactly 7 daily tasks for Week 1 (Days 1 to 7).
   - Day 1 is ${startDate.toLocaleDateString('en-US', { weekday: 'long' })}.
   - Design exactly ${activeDaysTarget} active deliberate practice days, and ${restDaysTarget} rest days (conforming to the ${planVariant} track).
   - STRICT CONSTRAINT: Never schedule 2 rest days consecutively (The 2-Day Rule).
    - If isRestDay is true, title should be "Active Recovery & Reflection", durationMinutes should be 10 or 15, and detailedSteps should guide low-friction mental review.
    - Active days must have 3-4 detailedSteps with exact stepNumber, title, durationMinutes (summing to ${dailyMins}), instructions, focusCue, pitfallToAvoid, layer, layerReasoning, and challenge.
    - For 'layerReasoning', be specific — name the actual research finding, real-world pattern, or professional practice (e.g. 'Based on spaced retrieval research for motor memory consolidation' or 'Mirrors how most self-taught players stay motivated by playing a recognizable riff early' or 'Trainers front-load this to prevent wrist strain before increasing tempo'). Never write a generic filler reasoning like 'this is proven to help.'
    - "implementationIntention": formatted as "When: [TIME] | Where: [ENVIRONMENT] | Action: [EXACT ACTION]"
    - MANDATORY REQUIREMENT — DYNAMIC INTERACTIVE CHALLENGE SPECIFIC TO THE ACTIVITY DOMAIN:
      For EVERY step, generate an appropriate "challenge" object based on the domain nature of the task:
      * For physical, motor, instrument, or endurance drills (gym, calisthenics, guitar, tempo):
        "challenge": { "type": "repetitions", "drillName": "...", "targetCount": 10, "totalSets": 3, "unit": "reps" | "seconds" | "clean bars" }
      * For cognitive, memory, languages, or conceptual learning:
        "challenge": { "type": "active_recall", "question": "...", "hint": "...", "keyTakeaway": "..." }
      * For engineering, coding, writing, or practical building:
        "challenge": { "type": "checklist", "items": [{ "id": "c1", "label": "..." }, { "id": "c2", "label": "..." }] }
      * For creative or problem-solving exercises:
        "challenge": { "type": "exercise", "prompt": "...", "targetDeliverable": "...", "evaluationCriteria": "..." }
    - MANDATORY REQUIREMENT — BEST RESOURCE SPECIFIC TO EVERY INDIVIDUAL SUB-TASK / STEP:
      For EVERY single step in detailedSteps, you MUST provide the single best, most effective resource format:
      * "youtube_video" for visual/motor/audio demonstrations
      * "documentation" for official technical documentation or installation guides
      * "scientific_study" for deliberate practice research or physiology studies
      * "interactive_tool" for online sandboxes, metronomes, or simulators
      * "guide" for comprehensive step-by-step guides
      Each step must include: resourceTitle, resourceUrl, resourceType, resourceWhy.

Respond with JSON matching schema:
{
  "clarifiedOutcome": "${clarifiedOutcome}",
  "methodologyNotes": string,
  "weeks": [
    {
      "weekNumber": number,
      "phase": "Foundation" | "Acceleration" | "Mastery",
      "theme": string,
      "objective": string,
      "keyMilestone": string,
      "targetIntensity": number,
      "plannedMinutes": number
    }
  ],
  "initialTasks": [
    {
      "dayNumber": number,
      "dayOfWeek": string,
      "title": string,
      "isRestDay": boolean,
      "durationMinutes": number,
      "slotTime": string,
      "implementationIntention": string,
      "detailedSteps": [
        {
          "stepNumber": number,
          "title": string,
          "durationMinutes": number,
          "instructions": string,
          "focusCue": string,
          "pitfallToAvoid": string,
          "layer": "mechanism" | "adherence" | "safety",
          "layerReasoning": string,
          "challenge": {
            "type": "repetitions" | "active_recall" | "checklist" | "exercise",
            "drillName"?: string,
            "targetCount"?: number,
            "totalSets"?: number,
            "unit"?: string,
            "question"?: string,
            "hint"?: string,
            "keyTakeaway"?: string,
            "items"?: [{ "id": string, "label": string }],
            "prompt"?: string,
            "targetDeliverable"?: string,
            "evaluationCriteria"?: string
          },
          "resourceTitle": string,
          "resourceUrl": string,
          "resourceType": "youtube_video" | "documentation" | "scientific_study" | "interactive_tool" | "guide",
          "resourceWhy": string
        }
      ]
    }
  ]
}
`;

  const result = await generateStructuredContent<PlanGenerationResult>(prompt, systemInstruction);

  if (
    result.success &&
    result.data &&
    result.data.weeks?.length === 12 &&
    result.data.initialTasks?.length === 7 &&
    validateStepLayers(result.data.initialTasks)
  ) {
    return result.data;
  }

  // Fallback: If it's a certified preset, return the pre-validated deterministic blueprint.
  // For custom goals, do NOT fabricate a degraded plan — fail honestly and prompt user to retry.
  if (preset) {
    return getDeterministicPresetPlan(preset, dailyMins, defaultSlotTime, startDate, planVariant);
  }

  throw new Error('Unable to generate your 12-week plan right now. AI services are temporarily unavailable. Please retry.');
}

export interface PreviousWeekTaskSummary {
  dayNumber: number;
  dayOfWeek: string;
  title: string;
  isRestDay: boolean;
  status: string; // 'completed' | 'pending' | 'skipped'
  notes?: string | null;
  stepTitles?: string[];
}

/**
 * Step 3: Dynamic Weekly Adaptation with Zero-Hallucination Historical Grounding.
 * Generates tasks for upcoming week N based on user's actual granular execution in week N-1.
 */
export async function adaptUpcomingWeekTasksWithAI(
  goalTitle: string,
  targetWeekNumber: number,
  targetWeekTheme: string,
  targetWeekObjective: string,
  previousWeekScore: number,
  reflection: string,
  routine: UserRoutineInput,
  weekStartDate: Date,
  previousWeekTasks: PreviousWeekTaskSummary[] = []
): Promise<DailyTaskPlan[]> {
  const dailyMins = routine.dailyMinutes || 60;
  const preferredSlot = routine.preferredSlot || 'evening';
  const defaultSlotTime = preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
  const planVariant = routine.planVariant || 'steady';
  const activeDaysTarget = planVariant === 'minimal' ? 4 : planVariant === 'accelerated' ? 6 : 5;
  const restDaysTarget = 7 - activeDaysTarget;

  const commitmentsFormatted = routine.commitments && routine.commitments.length > 0
    ? routine.commitments
        .map(c => typeof c === 'string' ? `- ${c}` : `- ${c.title}${c.time ? ` (${c.time})` : ''}`)
        .join('\n')
    : 'None';

  const systemInstruction = `You are Achivii's Adaptive Goal Coach and Curriculum Sequencer.
You generate Week ${targetWeekNumber}'s daily practice protocol based on the user's Week ${targetWeekNumber - 1} actual execution history.

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. CONTINUITY: Day ${(targetWeekNumber - 1) * 7 + 1} MUST directly pick up where Week ${targetWeekNumber - 1} left off. Do not arbitrarily reset or repeat completed drills.
2. ADHERENCE TO EXECUTION AUDIT:
   - User execution score was ${Math.round(previousWeekScore)}% (target benchmark is >=85%).
   - Review the user's completed drills, skipped drills, and their specific drill notes.
   - If the user skipped drills or recorded points of struggle in their notes, carry forward the unmastered sub-skills into targeted consolidation drills in early Week ${targetWeekNumber}.
   - If score >= 85% and past drills were mastered, advance tempo, complexity, and progressive overload according to Week ${targetWeekNumber}'s theme.
3. OBEY THE ROADMAP BACKBONE:
   - All tasks must strictly advance Target Theme: "${targetWeekTheme}" and Target Objective: "${targetWeekObjective}".
4. PLAN VARIANT PACING & THE 2-DAY RULE:
   - Schedule exactly ${activeDaysTarget} active deliberate practice days and ${restDaysTarget} rest/recovery days for the "${planVariant}" track.
   - User MUST NEVER have 2 consecutive rest days.
5. RESOURCE GROUNDING (ZERO DEAD LINKS):
   - For "youtube_video", use high-precision search query URL format (e.g. https://www.youtube.com/results?search_query=[topic+drill+tutorial]) to guarantee 100% working links without broken video IDs.
   - For documentation or scientific studies, use canonical verified base domains (e.g., wikipedia.org, pubmed.ncbi.nlm.nih.gov, developer.mozilla.org, etc.).

THREE EVIDENCE LAYERS & CONFLICT RULE:
For every single step you generate, you must classify it under exactly one evidence layer:
- 'mechanism': grounded in established science/research for this domain
- 'adherence': grounded in what real people who succeeded at similar goals actually did in practice, even if it's not the theoretically optimal approach
- 'safety': grounded in how professionals/practitioners in this domain sequence things to prevent injury, burnout, or wasted effort

CONFLICT RULE: When the scientifically optimal approach and the most commonly-succeeded-with real-world approach differ for a given step, default to the adherence-favoring version during Weeks 1-8 (Foundation and Acceleration phases). Introduce the more optimal/science-favoring version starting Week 9 (Mastery phase), once the habit is established. Safety/professional guidance always overrides both other layers with no exceptions — never generate a step a professional in this domain would consider unsafe or poorly sequenced, even if it's scientifically optimal or socially popular.`;

  const previousTasksFormatted = previousWeekTasks.length > 0
    ? previousWeekTasks.map(t => {
        const statusBadge = t.status === 'completed' ? '[COMPLETED]' : t.isRestDay ? '[REST DAY]' : '[SKIPPED / INCOMPLETE]';
        const stepsStr = t.stepTitles && t.stepTitles.length > 0 ? ` (Sub-drills: ${t.stepTitles.join(' -> ')})` : '';
        const notesStr = t.notes ? ` | User Practice Notes: "${t.notes}"` : '';
        return `  - Day ${t.dayNumber} (${t.dayOfWeek}): ${statusBadge} "${t.title}"${stepsStr}${notesStr}`;
      }).join('\n')
    : 'No granular task logs found for previous week.';

  const prompt = `Goal: "${goalTitle}"
Milestone Transition: Week ${targetWeekNumber - 1} -> Week ${targetWeekNumber}
Target Theme: "${targetWeekTheme}"
Target Objective: "${targetWeekObjective}"
Plan Track: "${planVariant}" (${activeDaysTarget} active days, ${restDaysTarget} rest days)
Daily Target Time: ${dailyMins} minutes. Preferred Slot: ${defaultSlotTime}
Work/Busy Hours: ${routine.busyHours || '09:00 - 17:00'}
Other Recurring Commitments (Gym, Classes, Commute, etc.):
${commitmentsFormatted}
STRICT CONSTRAINT: Do not schedule sessions during work/busy hours or recurring commitments. Target focus slot: ${defaultSlotTime}.

PREVIOUS WEEK (WEEK ${targetWeekNumber - 1}) ACTUAL EXECUTION AUDIT:
Execution Adherence Score: ${Math.round(previousWeekScore)}% (${previousWeekScore >= 85 ? 'Benchmark Met (>=85%) - Ready for Accelerated Progression' : 'Below Benchmark (<85%) - Needs Consolidation & Error-Proofing'})
User Weekly Reflection: "${reflection || 'None provided'}"
Granular Task Log:
${previousTasksFormatted}

TASK:
Generate exactly 7 daily tasks for Week ${targetWeekNumber} (Days ${(targetWeekNumber - 1) * 7 + 1} to ${targetWeekNumber * 7}) starting on ${weekStartDate.toLocaleDateString('en-US', { weekday: 'long' })}.
Ensure exactly ${activeDaysTarget} active deliberate practice days and ${restDaysTarget} rest days conforming to "${planVariant}" and the 2-Day Rule.
Ensure seamless continuity from the execution audit above. Explicitly bridge any unmastered skills or user notes into the first 2 active days before escalating difficulty.

Active days must have 3-4 detailedSteps with exact stepNumber, title, durationMinutes (summing to ${dailyMins}), instructions, focusCue, pitfallToAvoid, layer, layerReasoning, challenge, and curated resources.
For 'layerReasoning', be specific — name the actual research finding, real-world pattern, or professional practice. Never write a generic filler reasoning like 'this is proven to help.'

MANDATORY: For EVERY single step in detailedSteps, provide the single BEST resource in the ideal format: "youtube_video", "documentation", "scientific_study", "interactive_tool", or "guide". For YouTube videos, use high-precision search URLs (https://www.youtube.com/results?search_query=...).

JSON Schema:
{
  "tasks": [
    {
      "dayNumber": number,
      "dayOfWeek": string,
      "title": string,
      "isRestDay": boolean,
      "durationMinutes": number,
      "slotTime": string,
      "implementationIntention": string,
      "detailedSteps": [
        {
          "stepNumber": number,
          "title": string,
          "durationMinutes": number,
          "instructions": string,
          "focusCue": string,
          "pitfallToAvoid": string,
          "layer": "mechanism" | "adherence" | "safety",
          "layerReasoning": string,
          "challenge": {
            "type": "repetitions" | "active_recall" | "checklist" | "exercise",
            "drillName"?: string,
            "targetCount"?: number,
            "totalSets"?: number,
            "unit"?: string,
            "question"?: string,
            "hint"?: string,
            "keyTakeaway"?: string,
            "items"?: [{ "id": string, "label": string }],
            "prompt"?: string,
            "targetDeliverable"?: string,
            "evaluationCriteria"?: string
          },
          "resourceTitle": string,
          "resourceUrl": string,
          "resourceType": "youtube_video" | "documentation" | "scientific_study" | "interactive_tool" | "guide",
          "resourceWhy": string
        }
      ]
    }
  ]
}
`;

  const result = await generateStructuredContent<{ tasks: DailyTaskPlan[] }>(prompt, systemInstruction);

  if (
    result.success &&
    result.data &&
    result.data.tasks?.length === 7 &&
    validateStepLayers(result.data.tasks)
  ) {
    return result.data.tasks;
  }

  const preset = findPresetForGoal(goalTitle);
  if (preset) {
    return getDeterministicPresetTasks(preset, dailyMins, defaultSlotTime, weekStartDate, planVariant);
  }

  throw new Error('Unable to adapt upcoming week tasks right now. AI services are temporarily unavailable. Please retry.');
}

// ---------------------------------------------------------------------------
// Resilient Deterministic Fallbacks
// ---------------------------------------------------------------------------

export function getPresetCanonicalKey(presetId: string): string {
  const map: Record<string, string> = {
    run10k: 'fitness.running.10k',
    run10k_sub50: 'fitness.running.10k',
    guitar: 'music.guitar.acoustic_songs',
    guitar5songs: 'music.guitar.acoustic_songs',
    guitar_wonderwall_mastery: 'music.guitar.acoustic_songs',
    saas: 'tech.software.saas',
    saas_first_customer: 'tech.software.saas',
    saas_mvp_launch: 'tech.software.saas',
    spanish: 'lang.spanish.conversational',
    spanish_conversation: 'lang.spanish.conversational',
    recomp: 'fitness.bodybuilding.recomposition',
    body_recomposition_90day: 'fitness.bodybuilding.recomposition',
    youtube: 'media.youtube.channel_launch',
    youtube_12_videos: 'media.youtube.channel_launch',
    book: 'writing.publishing.nonfiction_book',
    book_30k_words: 'writing.publishing.nonfiction_book',
    book_first_draft: 'writing.publishing.nonfiction_book',
    deepwork: 'productivity.focus.deep_work',
    deep_work_focus: 'productivity.focus.deep_work',
    chess: 'gaming.chess.rating_1200',
    chess_1200_rating: 'gaming.chess.rating_1200',
    speech: 'communication.speaking.ted_talk',
    ted_speech_15min: 'communication.speaking.ted_talk',
  };
  return map[presetId] || `general.${presetId.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

export function deriveDeterministicCanonicalKey(rawGoal: string): string {
  const clean = (rawGoal || '').trim().toLowerCase();
  const slug = clean.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'goal';
  return `custom.goal.${slug}`;
}

export function sanitizeCanonicalKey(
  key?: string,
  fallbackGoal: string = '',
  fallbackDomain?: string,
  fallbackOutcome?: string
): string {
  if (key && typeof key === 'string') {
    const cleaned = key.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/_+/g, '_');
    if (cleaned.includes('.') && cleaned.split('.').length >= 2) {
      return cleaned;
    }
  }
  if (fallbackDomain && fallbackOutcome) {
    const domainPart = fallbackDomain.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const outcomePart = fallbackOutcome.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
    if (domainPart && outcomePart) {
      return `${domainPart}.${outcomePart}`;
    }
  }
  return deriveDeterministicCanonicalKey(fallbackGoal);
}

export interface Stage1PipelineResult {
  clarification: GoalClarification;
  cacheHit: boolean;
  cacheTier?: 'tier0_raw_exact' | 'tier1_exact' | 'tier2_vector';
  similarity?: number;
  canonicalMethod?: any;
  cacheEntry?: any;
}

export interface ResolveStage1Options {
  autoPopulateStubOnMiss?: boolean;
  skipPartB?: boolean;
}

/**
 * Executes Stage 1 (Clarification) and Stage 1.5 (Cache Resolution).
 * Checks if the goal has been researched before:
 * - Part B (Tier 0): If skipPartB is not set, checks raw input match first. On hit, bypasses LLM & embeddings entirely.
 * - Stage 1 LLM: If raw check misses, runs clarifyGoalWithAI.
 * - Part A (Tier 1): Checks exact normalized canonicalKey match (with alias expansion & leaf token sorting).
 * - Tier 2: In-memory cosine similarity fallback (threshold 0.88) on outcomeEmbedding.
 * For Phase 2, if autoPopulateStubOnMiss is true, a stub cache entry is stored on miss.
 */
export async function resolveStage1WithCache(
  rawGoal: string,
  options?: ResolveStage1Options
): Promise<Stage1PipelineResult> {
  // --------------------------------------------------------------------------
  // Part B: Pre-LLM Raw Input Match (Tier 0 Fast Path)
  // --------------------------------------------------------------------------
  if (!options?.skipPartB && rawGoal && rawGoal.trim()) {
    const preCheck = await resolveResearchCache('', '', { rawGoal });
    if (preCheck.hit && preCheck.entry) {
      const canonicalMethod = typeof preCheck.entry.canonicalMethod === 'string'
        ? JSON.parse(preCheck.entry.canonicalMethod)
        : preCheck.entry.canonicalMethod;

      if (canonicalMethod?.cachedClarification) {
        return {
          clarification: canonicalMethod.cachedClarification,
          cacheHit: true,
          cacheTier: 'tier0_raw_exact',
          similarity: 1.0,
          canonicalMethod,
          cacheEntry: preCheck.entry,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // Stage 1 AI Clarification
  // --------------------------------------------------------------------------
  const clarification = await clarifyGoalWithAI(rawGoal);
  const cacheResult = await resolveResearchCache(
    clarification.canonicalKey,
    clarification.clarifiedOutcome,
    { rawGoal, skipTier0: options?.skipPartB }
  );

  if (cacheResult.hit) {
    return {
      clarification,
      cacheHit: true,
      cacheTier: cacheResult.tier,
      similarity: cacheResult.similarity,
      canonicalMethod: cacheResult.entry?.canonicalMethod,
      cacheEntry: cacheResult.entry,
    };
  }

  if (options?.autoPopulateStubOnMiss) {
    const stubMethod = {
      methodName: `Canonical Method for ${clarification.primaryDomain}`,
      authority: 'Grounded Practitioner Consensus',
      sourceUrl: 'https://example.com/canonical-method',
      confidence: 'medium_consensus',
      velocityTable: null,
      rawFindings: { note: 'Stub cache entry for Phase 2 testing' },
      cachedClarification: clarification,
    };
    await saveResearchCacheEntry({
      canonicalKey: clarification.canonicalKey,
      clarifiedOutcome: clarification.clarifiedOutcome,
      canonicalMethod: stubMethod,
      rawGoal,
      cachedClarification: clarification,
    });
  }

  return {
    clarification,
    cacheHit: false,
    canonicalMethod: null,
  };
}

function getDeterministicPresetPlan(
  preset: CertifiedPresetBlueprint,
  dailyMins: number,
  defaultSlotTime: string,
  startDate: Date,
  planVariant: 'minimal' | 'steady' | 'accelerated' = 'steady'
): PlanGenerationResult {
  const weeks: RoadmapWeekPlan[] = preset.weeks.map(w => ({
    weekNumber: w.weekNumber,
    phase: w.phase,
    theme: w.theme,
    objective: w.objective,
    keyMilestone: w.keyMilestone,
    targetIntensity: w.targetIntensity,
    plannedMinutes: dailyMins
  }));

  const initialTasks = getDeterministicPresetTasks(preset, dailyMins, defaultSlotTime, startDate, planVariant);

  return {
    clarifiedOutcome: preset.clarifiedOutcome,
    methodologyNotes: `Certified Master Curriculum: ${preset.badge}. Grounded in ${preset.scientificFrameworks.map(f => f.name).join(', ')}.`,
    weeks,
    initialTasks
  };
}

function getDeterministicPresetTasks(
  preset: CertifiedPresetBlueprint,
  dailyMins: number,
  slotTime: string,
  startDate: Date,
  planVariant: 'minimal' | 'steady' | 'accelerated' = 'steady'
): DailyTaskPlan[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const tasks: DailyTaskPlan[] = [];
  const archetypes = preset.weeks[0]?.workoutArchetypes || [];

  const restDayIndices = planVariant === 'minimal' ? [2, 4, 6] : planVariant === 'accelerated' ? [6] : [3, 6];

  const isGuitar = preset.id === 'guitar5songs' || preset.primaryDomain.toLowerCase().includes('guitar');
  const isSaaS = preset.id === 'saas_first_customer' || preset.primaryDomain.toLowerCase().includes('software') || preset.primaryDomain.toLowerCase().includes('saas');
  const isSpanish = preset.id === 'spanish_conversation' || preset.primaryDomain.toLowerCase().includes('spanish') || preset.primaryDomain.toLowerCase().includes('language');
  const isRecomp = preset.id === 'body_recomposition_90day' || preset.primaryDomain.toLowerCase().includes('physique') || preset.primaryDomain.toLowerCase().includes('recomp');
  const isYouTube = preset.id === 'youtube_12_videos' || preset.primaryDomain.toLowerCase().includes('video') || preset.primaryDomain.toLowerCase().includes('youtube');
  const isBook = preset.id === 'book_30k_words' || preset.primaryDomain.toLowerCase().includes('writing') || preset.primaryDomain.toLowerCase().includes('author') || preset.primaryDomain.toLowerCase().includes('book');
  const isDeepWork = preset.id === 'deep_work_focus' || preset.primaryDomain.toLowerCase().includes('deep work') || preset.primaryDomain.toLowerCase().includes('cognitive') || preset.primaryDomain.toLowerCase().includes('focus');
  const isChess = preset.id === 'chess_1200_rating' || preset.primaryDomain.toLowerCase().includes('chess');
  const isSpeech = preset.id === 'ted_speech_15min' || preset.primaryDomain.toLowerCase().includes('speaking') || preset.primaryDomain.toLowerCase().includes('speech') || preset.primaryDomain.toLowerCase().includes('ted');

  const activeArchetypes = archetypes.filter(a => !a.isRestDay);
  const restArchetypes = archetypes.filter(a => a.isRestDay);
  let activeIdx = 0;
  let restIdx = 0;

  for (let d = 0; d < 7; d++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + d);
    const dayOfWeek = dayNames[currentDate.getDay()];
    const isRestDay = restDayIndices.includes(d);

    const arch = isRestDay
      ? (restArchetypes[restIdx++ % Math.max(1, restArchetypes.length)] || archetypes[0])
      : (activeArchetypes[activeIdx++ % Math.max(1, activeArchetypes.length)] || archetypes[0]);
    const durMins = isRestDay ? 15 : dailyMins;

    const detailedSteps = arch.drillStepsTemplate.map((step) => {
      const stepMins = Math.max(3, Math.round(durMins * step.durationRatio));
      const challenge: StepChallenge = isRestDay
        ? isSpeech
          ? {
              type: 'active_recall',
              question: 'What core lesson in vocal pacing, dramatic pauses, or emotional vulnerability did you observe in today\'s master talk?',
              keyTakeaway: 'Master orators command rooms through intentional silence and authenticity; complete vocal rest preserves diaphragmatic stamina.'
            }
          : isChess
          ? {
              type: 'checklist',
              items: [
                { id: 'c1', label: 'Walk through 1 classical Paul Morphy / Capablanca master game' },
                { id: 'c2', label: 'Verify zero blitz/bullet games played during active recovery' },
                { id: 'c3', label: 'Write 1 key strategic takeaway in your chess journal' }
              ]
            }
          : isDeepWork
          ? {
              type: 'checklist',
              items: [
                { id: 'c1', label: 'Verify zero work screen usage and full digital sabbath rest' },
                { id: 'c2', label: 'Engage in 45m physical movement or nature walk' },
                { id: 'c3', label: 'Confirm phone screen time remained under 90 minutes' }
              ]
            }
          : isBook
          ? {
              type: 'active_recall',
              question: 'What core lesson in narrative pacing, sentence rhythm, or authorial voice did you take from today\'s reading?',
              keyTakeaway: 'Reading masterworks internalizes the music and rhythm of great prose, refilling the creative well for tomorrow\'s draft.'
            }
          : isYouTube
          ? {
              type: 'checklist',
              items: [
                { id: 'c1', label: 'Verify video is public and tags/description are complete' },
                { id: 'c2', label: 'Verify custom thumbnail renders clearly on mobile screen' },
                { id: 'c3', label: 'Lock in next week topic on 10-idea spreadsheet' }
              ]
            }
          : isRecomp
          ? {
              type: 'checklist',
              items: [
                { id: 'c1', label: 'Hit 8,000–10,000 NEAT steps before evening' },
                { id: 'c2', label: 'Hit 2.0g/kg protein target across 3–4 meals' },
                { id: 'c3', label: 'Log morning weigh-in and update 7-day rolling average' }
              ]
            }
          : {
              type: 'active_recall',
              question: isSpanish
                ? 'What were the 3 most useful Spanish sentence frames or anchor verbs you vocalized this week?'
                : isSaaS
                ? 'What was your primary technical breakthrough or user friction point this week?'
                : 'What was your primary technical breakthrough or friction point this week?',
              keyTakeaway: isSpanish
                ? 'High-frequency verb anchors (quiero, puedo, tengo que, voy a) connect 70% of spoken thoughts without translation lag.'
                : isSaaS
                ? 'Shipping early to production and gathering feedback beats premature optimization.'
                : 'Consistency and callus formation compound with deliberate daily practice.'
            }
        : isSpeech
        ? {
            type: 'repetitions',
            drillName: step.title,
            targetCount: 3,
            totalSets: 1,
            unit: 'unbroken delivery runs (recorded on video)'
          }
        : isChess
        ? {
            type: 'repetitions',
            drillName: step.title,
            targetCount: 15,
            totalSets: 1,
            unit: 'tactical puzzles solved (≥80% accuracy)'
          }
        : isDeepWork
        ? {
            type: 'repetitions',
            drillName: step.title,
            targetCount: 60,
            totalSets: 1,
            unit: 'minutes uninterrupted focus (0 tab switches)'
          }
        : isBook
        ? {
            type: 'repetitions',
            drillName: step.title,
            targetCount: 500,
            totalSets: 1,
            unit: 'net drafted words (no editing)'
          }
        : isYouTube
        ? {
            type: 'checklist',
            items: [
              { id: 'c1', label: `Execute ${step.title}` },
              { id: 'c2', label: 'Enforce pattern interrupt or visual B-roll cue' },
              { id: 'c3', label: 'Export / save work with clean file naming' }
            ]
          }
        : isSpanish
        ? {
            type: 'active_recall',
            question: 'Vocalize the target sentence or anchor frame aloud within 3 seconds of hearing the prompt. Did you speak without pausing in English?',
            keyTakeaway: 'Speech fluency is motor reflex; producing syllables aloud creates direct neural pathways that silent study cannot build.'
          }
        : isSaaS
        ? {
            type: 'checklist',
            items: [
              { id: 'c1', label: `Execute ${step.title}` },
              { id: 'c2', label: 'Verify clean TypeScript compilation & zero console errors' },
              { id: 'c3', label: 'Commit working changes to git' }
            ]
          }
        : {
            type: 'repetitions',
            drillName: step.title,
            targetCount: isRecomp ? 10 : isGuitar ? 30 : isChess ? 15 : isSpeech ? 3 : 3,
            totalSets: 3,
            unit: isRecomp ? 'controlled reps (3s eccentric)' : isGuitar ? 'clean switches' : isChess ? 'puzzles/drills' : isSpeech ? 'rehearsal runs' : 'reps'
          };

      return {
        stepNumber: step.stepNumber,
        title: step.title,
        durationMinutes: stepMins,
        instructions: step.instructions,
        focusCue: step.focusCue,
        pitfallToAvoid: step.pitfallToAvoid,
        layer: step.layer,
        layerReasoning: step.layerReasoning,
        challenge,
        resourceTitle: isSpeech
          ? 'Carmine Gallo Talk Like TED & Toastmasters Public Speaking Guide'
          : isChess
          ? 'Axel Smith Woodpecker Method & Jeremy Silman Imbalance Guide'
          : isDeepWork
          ? 'Cal Newport Deep Work & Andrew Huberman Focus Guide'
          : isBook
          ? 'Steven Pressfield War of Art & William Zinsser Writing Guide'
          : isYouTube
          ? 'Paddy Galloway & MrBeast Retention Formula Guide'
          : isRecomp
          ? 'Mechanisms of Hypertrophy & Eric Helms Nutrition Pyramid'
          : isSpanish
          ? 'Notes in Spanish / Coffee Break Spanish Audio Practice'
          : isSaaS
          ? 'Vertical Slice Architecture & Lean SaaS Delivery Guide'
          : isGuitar
          ? 'JustinGuitar Beginner Grade 1 Course & Practice Routine'
          : 'Jack Daniels Running Formula — Cadence & VDOT Principles',
        resourceUrl: isSpeech
          ? 'https://www.toastmasters.org/resources/public-speaking-tips'
          : isChess
          ? 'https://www.chess.com/article/view/the-woodpecker-method'
          : isDeepWork
          ? 'https://calnewport.com/books/deep-work/'
          : isBook
          ? 'https://stevenpressfield.com/books/the-war-of-art/'
          : isYouTube
          ? 'https://www.creatorhooks.com/'
          : isRecomp
          ? 'https://www.strongerbyscience.com/hypertrophy-handbook-review/'
          : isSpanish
          ? 'https://www.notesinspanish.com/'
          : isSaaS
          ? 'https://www.jimmybogard.com/vertical-slice-architecture/'
          : isGuitar
          ? 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-1'
          : 'https://runnersworld.com/training/a20801358/jack-daniels-running-formula-vdot/',
        resourceType: 'guide' as const,
        resourceWhy: isSpeech
          ? 'Follow proven throughline framing, diaphragmatic breathing, and filler word elimination.'
          : isChess
          ? 'Follow proven spaced repetition tactics, blunder check protocols, and LPDO piece safety.'
          : isDeepWork
          ? 'Follow foundational attention residue reduction, ultradian rhythms, and dopamine protocols.'
          : isBook
          ? 'Follow professional mindset principles to defeat resistance and maintain uninterrupted daily output.'
          : isYouTube
          ? 'Follow proven thumbnail curiosity frameworks, retention pacing, and visual storytelling.'
          : isRecomp
          ? 'Follow research-proven mechanical tension, RIR boundaries, and protein distribution guidelines.'
          : isSpanish
          ? 'Listen to natural, authentic native dialogues and vocalize responses aloud in real-time.'
          : isSaaS
          ? 'Follow vertical slice principles to deliver complete end-to-end user features rather than isolated tiers.'
          : isGuitar
          ? 'Follow this structured curriculum for correct finger placement and time-boxed transition drills.'
          : 'Follow this proven framework to calibrate heart rate zones and avoid overreaching.'
      };
    });

    const whereLocation = isRestDay
      ? 'Quiet space / chair'
      : isSpeech
      ? 'Open room / standing stage space with camera tripod & speech notes'
      : isChess
      ? 'Chessboard desk / quiet study station with digital clock & lichess/chess.com'
      : isDeepWork
      ? 'Ergonomic focus desk in airplane mode with physical distraction notepad'
      : isBook
      ? 'Distraction-free writing desk / offline laptop in fullscreen mode'
      : isYouTube
      ? 'Dedicated recording desk / studio corner with camera, key light & lapel mic'
      : isRecomp
      ? 'Weight training gym / home rack with dumbbells & barbells'
      : isSpanish
      ? 'Quiet room / commute with voice recorder & headphones'
      : isGuitar
      ? 'Dedicated practice chair with guitar stand & metronome'
      : isSaaS
      ? 'Development workstation with IDE, terminal & browser'
      : 'Running route / treadmill';

    tasks.push({
      dayNumber: d + 1,
      dayOfWeek,
      title: arch.title,
      isRestDay,
      durationMinutes: durMins,
      slotTime,
      implementationIntention: `When: ${slotTime} | Where: ${whereLocation} | Action: ${arch.title} (${durMins}m)`,
      resourceTitle: isSpeech
        ? 'Nancy Duarte Resonate & TED Official Guide to Public Speaking'
        : isChess
        ? 'Dan Heisman Real Chess & John Nunn Endgame Principles'
        : isDeepWork
        ? 'Mihaly Csikszentmihalyi Flow & Cal Newport Time-Blocking Masterclass'
        : isBook
        ? 'Stephen King On Writing & Donald Miller StoryBrand Blueprint'
        : isYouTube
        ? 'Ali Abdaal Creator Engine & Colin and Samir Storytelling Guide'
        : isRecomp
        ? 'Renaissance Periodization & Dr. Brad Schoenfeld Hypertrophy Guide'
        : isSaaS
        ? 'The Lean Startup & Y Combinator MVP Guide'
        : isGuitar
        ? 'JustinGuitar Grade 1 Core Curriculum & Song Repertoire'
        : 'Jack Daniels Running Formula & 80/20 Pacing Guide',
      resourceUrl: isSpeech
        ? 'https://www.duarte.com/resonate/'
        : isChess
        ? 'https://www.chess.com/article/view/essential-chess-endgames'
        : isDeepWork
        ? 'https://www.calnewport.com/blog/category/time-management/'
        : isBook
        ? 'https://storybrand.com/'
        : isYouTube
        ? 'https://aliabdaal.com/newsletter/how-to-start-a-youtube-channel/'
        : isRecomp
        ? 'https://renaissanceperiodization.com/expert-advice/hypertrophy-training-guide'
        : isSaaS
        ? 'https://www.ycombinator.com/library/4D-how-to-build-an-mvp'
        : isGuitar
        ? 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-1'
        : 'https://runnersworld.com/training/a20801358/jack-daniels-running-formula-vdot/',
      resourceType: 'guide',
      resourceWhy: isSpeech
        ? 'Master dramatic sparkline contrast, stage choreography, and audience transformation arcs.'
        : isChess
        ? 'Master CCT blunder checks, candidate move calculation, and opposition endgame mechanics.'
        : isDeepWork
        ? 'Gold-standard cognitive performance systems for high-leverage knowledge work.'
        : isBook
        ? 'Premier methodology for reader transformation arcs, chapter beat outlines, and concise prose.'
        : isYouTube
        ? 'Authoritative framework for weekly batch production, title packaging, and YouTube retention dynamics.'
        : isRecomp
        ? 'Authoritative biomechanical and nutritional framework for fat loss with muscle retention.'
        : isSaaS
        ? 'Gold standard methodology for launching fast and acquiring your first paying customers.'
        : isGuitar
        ? 'Premier structured reference for acoustic guitar mechanics and chord fluency.'
        : 'Authoritative endurance reference for pacing and biomechanics.',
      detailedSteps
    });
  }

  return tasks;
}

