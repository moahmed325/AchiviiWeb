import { generateStructuredContent } from './gemini.js';

export interface GoalClarification {
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

export interface DetailedStep {
  stepNumber: number;
  title: string;
  durationMinutes: number;
  instructions: string;
  focusCue: string;
  pitfallToAvoid: string;
  challenge?: StepChallenge;
  resourceTitle?: string;
  resourceUrl?: string;
  resourceType?: 'youtube_video' | 'documentation' | 'scientific_study' | 'interactive_tool' | 'guide';
  resourceWhy?: string;
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

export interface UserRoutineInput {
  wakeTime?: string; // e.g. "07:00"
  sleepTime?: string; // e.g. "23:00"
  busyHours?: string; // e.g. "09:00 - 17:00"
  preferredSlot?: 'morning' | 'afternoon' | 'evening';
  dailyMinutes?: number; // e.g. 30, 45, 60, 90
  planVariant?: 'steady' | 'accelerated' | 'minimal';
}

/**
 * Step 1: Clarify a raw user goal using Gemini.
 * Identifies domain, 5-8 sub-skills/capabilities, clarifies the 90-day outcome,
 * applies scientific frameworks, and generates 3-4 domain-specific clarifying questions.
 */
export async function clarifyGoalWithAI(rawGoal: string): Promise<GoalClarification> {
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
For each question, provide 3-4 realistic multiple-choice options plus allowCustom: true.

JSON schema:
{
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
}`;

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
    return result.data;
  }

  // Fallback if AI is offline
  return getDeterministicClarification(rawGoal);
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
  const dailyMins = routine.dailyMinutes || 30;
  const preferredSlot = routine.preferredSlot || 'morning';
  const defaultSlotTime = preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
  const planVariant = routine.planVariant || 'steady';
  const activeDaysTarget = planVariant === 'minimal' ? 4 : planVariant === 'accelerated' ? 6 : 5;
  const restDaysTarget = 7 - activeDaysTarget;

  const systemInstruction = `You are Achivii's Principal Curriculum Engineer and Execution Coach.
You create world-class 90-day goal blueprints.
You follow:
- 12 Week Year: Weeks 1-4 Foundation (mechanics, ~60% load), Weeks 5-8 Acceleration (~80% load), Weeks 9-12 Mastery (100% load & Capstone).
- Milestone Gates: Week 4, Week 8, and Week 12 are hard-gate milestone checkpoints.
- Plan Variant Pacing: Obey the selected track (${planVariant}: ${activeDaysTarget} active days, ${restDaysTarget} rest days).
- The 2-Day Rule: User MUST NEVER have 2 consecutive rest days.
- Wonderwall-level Task Precision: Every single day's task must have an implementation intention, explicit micro-drills with timing, focus cues, failure pitfalls, and curated learning resources.`;

  const answersFormatted = Object.entries(answers)
    .map(([q, a]) => `- ${q}: ${a}`)
    .join('\n');

  const prompt = `Goal: "${rawGoal}"
Refined Outcome: "${clarifiedOutcome}"
User Diagnostic Answers:
${answersFormatted || 'None provided'}

User Routine & Plan Variant:
- Plan Variant Track: "${planVariant.toUpperCase()}" (${activeDaysTarget} active practice days, ${restDaysTarget} rest/recovery days per week).
- Wake: ${routine.wakeTime || '07:00'} | Sleep: ${routine.sleepTime || '23:00'}
- Work/Busy block: ${routine.busyHours || '09:00 - 17:00'}
- Preferred Focus Window: ${preferredSlot} (Target Slot: ${defaultSlotTime})
- Daily Session Duration: ${dailyMins} minutes

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
    - Active days must have 3-4 detailedSteps with exact stepNumber, title, durationMinutes (summing to ${dailyMins}), instructions, focusCue, pitfallToAvoid, and challenge.
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

  if (result.success && result.data && result.data.weeks?.length === 12 && result.data.initialTasks?.length === 7) {
    return result.data;
  }

  return getDeterministic12WeekPlan(rawGoal, clarifiedOutcome, routine, startDate);
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
  const dailyMins = routine.dailyMinutes || 30;
  const preferredSlot = routine.preferredSlot || 'morning';
  const defaultSlotTime = preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
  const planVariant = routine.planVariant || 'steady';
  const activeDaysTarget = planVariant === 'minimal' ? 4 : planVariant === 'accelerated' ? 6 : 5;
  const restDaysTarget = 7 - activeDaysTarget;

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
   - For documentation or scientific studies, use canonical verified base domains (e.g., wikipedia.org, pubmed.ncbi.nlm.nih.gov, developer.mozilla.org, etc.).`;

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

PREVIOUS WEEK (WEEK ${targetWeekNumber - 1}) ACTUAL EXECUTION AUDIT:
Execution Adherence Score: ${Math.round(previousWeekScore)}% (${previousWeekScore >= 85 ? 'Benchmark Met (>=85%) - Ready for Accelerated Progression' : 'Below Benchmark (<85%) - Needs Consolidation & Error-Proofing'})
User Weekly Reflection: "${reflection || 'None provided'}"
Granular Task Log:
${previousTasksFormatted}

TASK:
Generate exactly 7 daily tasks for Week ${targetWeekNumber} (Days ${(targetWeekNumber - 1) * 7 + 1} to ${targetWeekNumber * 7}) starting on ${weekStartDate.toLocaleDateString('en-US', { weekday: 'long' })}.
Ensure exactly ${activeDaysTarget} active deliberate practice days and ${restDaysTarget} rest days conforming to "${planVariant}" and the 2-Day Rule.
Ensure seamless continuity from the execution audit above. Explicitly bridge any unmastered skills or user notes into the first 2 active days before escalating difficulty.

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
          "resourceTitle": string,
          "resourceUrl": string,
          "resourceType": "youtube_video" | "documentation" | "scientific_study" | "interactive_tool" | "guide",
          "resourceWhy": string
        }
      ]
    }
  ]
}`;

  const result = await generateStructuredContent<{ tasks: DailyTaskPlan[] }>(prompt, systemInstruction);

  if (result.success && result.data && result.data.tasks?.length === 7) {
    return result.data.tasks;
  }

  return getDeterministicWeeklyTasks(targetWeekNumber, targetWeekTheme, targetWeekObjective, dailyMins, defaultSlotTime, weekStartDate, planVariant);
}

// ---------------------------------------------------------------------------
// Resilient Deterministic Fallbacks
// ---------------------------------------------------------------------------

function getDeterministicClarification(rawGoal: string): GoalClarification {
  const cleanGoal = rawGoal.trim();
  return {
    clarifiedOutcome: cleanGoal.length > 0
      ? cleanGoal.charAt(0).toUpperCase() + cleanGoal.slice(1)
      : 'Master Your 90-Day Goal',
    primaryDomain: 'High Performance Skill Acquisition',
    capabilities: [
      'Foundational Mechanics & Technique Precision',
      'Deliberate Practice Micro-Drills with Focus Cues',
      'Progressive Overload Tempo & Endurance',
      'Error Auditing & Friction Recovery Protocols',
      'Capstone Benchmark Execution & Fluency'
    ],
    scientificFrameworks: [
      {
        name: 'The 12 Week Year (Moran)',
        description: 'Compresses a full year cycle into 12 weeks to maintain maximum urgency and focus.',
        application: 'Structured into 3 progressive 4-week phases with weekly execution scoring target ≥85%.'
      },
      {
        name: 'Deliberate Practice (Ericsson)',
        description: 'Targeted drills beyond comfort zone with immediate corrective feedback.',
        application: 'Daily sessions target specific sub-skills with clear focus cues rather than mindless repetition.'
      },
      {
        name: 'Implementation Intentions (Gollwitzer)',
        description: 'Pre-committing to exact time, place, and protocol increases follow-through by 2-3x.',
        application: 'Every daily task is explicitly scheduled into your daily routine.'
      }
    ],
    verificationCriteria: `Complete a verifiable benchmark performance or capstone presentation demonstrating full fluency.`,
    followUpQuestions: [
      {
        id: 'baseline',
        question: 'What is your current starting point or experience level with this goal?',
        subtitle: 'Helps us calibrate Week 1 starting intensity and mechanical difficulty.',
        options: [
          'Complete beginner (starting from zero)',
          'Novice with scattered past attempts',
          'Intermediate looking to break through a plateau',
          'Experienced practitioner restarting after a hiatus'
        ],
        allowCustom: true
      },
      {
        id: 'resources',
        question: 'What tools, gear, or environment do you have access to right now?',
        subtitle: 'Ensures all daily tasks are 100% executable with your current setup.',
        options: [
          'All necessary equipment ready at home',
          'Basic tools available, may need occasional digital resources',
          'Need to acquire equipment during Week 1',
          'Shared or gym/studio workspace'
        ],
        allowCustom: true
      },
      {
        id: 'friction',
        question: 'What has been your biggest obstacle when trying to stick to similar goals?',
        subtitle: 'We will design recovery guardrails to protect your streak against this.',
        options: [
          'Loss of consistency after week 2 or 3',
          'Unclear daily practice plan / decision fatigue',
          'Time crunch with unexpected work demands',
          'Perfectionism and discouragement after missing a day'
        ],
        allowCustom: true
      }
    ]
  };
}

function getDeterministic12WeekPlan(
  rawGoal: string,
  clarifiedOutcome: string,
  routine: UserRoutineInput,
  startDate: Date
): PlanGenerationResult {
  const dailyMins = routine.dailyMinutes || 30;
  const preferredSlot = routine.preferredSlot || 'morning';
  const defaultSlotTime = preferredSlot === 'morning' ? '07:30' : preferredSlot === 'afternoon' ? '14:00' : '19:30';
  const planVariant = routine.planVariant || 'steady';

  const phases: Array<{ name: 'Foundation' | 'Acceleration' | 'Mastery'; weeks: number[]; intensity: number }> = [
    { name: 'Foundation', weeks: [1, 2, 3, 4], intensity: 60 },
    { name: 'Acceleration', weeks: [5, 6, 7, 8], intensity: 80 },
    { name: 'Mastery', weeks: [9, 10, 11, 12], intensity: 95 }
  ];

  const weeks: RoadmapWeekPlan[] = [];
  for (let w = 1; w <= 12; w++) {
    const currentPhase = phases.find(p => p.weeks.includes(w)) || phases[0];
    const keyMilestone = w === 12
      ? 'Phase 3 Mastery Capstone Verification & Final Proof of Achievement'
      : w === 8
      ? 'Phase 2 Acceleration Milestone Gate: Tempo & Fluency Benchmark'
      : w === 4
      ? 'Phase 1 Foundation Milestone Gate: Mechanics & Posture Diagnostic'
      : `Week ${w} diagnostic test completed with ≥85% score.`;

    weeks.push({
      weekNumber: w,
      phase: currentPhase.name,
      theme: `Week ${w}: ${w <= 4 ? 'Mechanics & Foundation Setup' : w <= 8 ? 'Deliberate Skill Expansion' : w === 12 ? 'Capstone Benchmark Execution' : 'Fluent Integration & Pressure Testing'}`,
      objective: `Master the key sub-components of ${rawGoal.slice(0, 30)} with consistent daily execution.`,
      keyMilestone,
      targetIntensity: Math.min(100, currentPhase.intensity + (w % 4) * 5),
      plannedMinutes: dailyMins
    });
  }

  const initialTasks = getDeterministicWeeklyTasks(1, weeks[0].theme, weeks[0].objective, dailyMins, defaultSlotTime, startDate, planVariant);

  return {
    clarifiedOutcome,
    methodologyNotes: 'Built upon The 12 Week Year, Ericsson Deliberate Practice, and Progressive Overload.',
    weeks,
    initialTasks
  };
}

function getDeterministicWeeklyTasks(
  weekNum: number,
  theme: string,
  objective: string,
  dailyMins: number,
  slotTime: string,
  startDate: Date,
  planVariant: 'minimal' | 'steady' | 'accelerated' = 'steady'
): DailyTaskPlan[] {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const tasks: DailyTaskPlan[] = [];

  // Rest day indices (0..6) respecting the 2-day rule:
  // 'minimal' (4 active, 3 rest): days 2, 4, 6 (Day 3, 5, 7) -> no consecutive rest days
  // 'steady' (5 active, 2 rest): days 3, 6 (Day 4, 7) -> no consecutive rest days
  // 'accelerated' (6 active, 1 rest): day 6 (Day 7)
  const restDayIndices = planVariant === 'minimal' ? [2, 4, 6] : planVariant === 'accelerated' ? [6] : [3, 6];

  for (let d = 0; d < 7; d++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + d);
    const dayOfWeek = dayNames[currentDate.getDay()];
    const isRestDay = restDayIndices.includes(d);

    if (isRestDay) {
      tasks.push({
        dayNumber: d + 1,
        dayOfWeek,
        title: 'Active Recovery & Weekly Reflection',
        isRestDay: true,
        durationMinutes: 15,
        slotTime,
        implementationIntention: `When: ${slotTime} | Where: Quiet workspace | Action: 15-min weekly review and mental rehearsal`,
        resourceTitle: 'Mindset & Weekly Review Protocol (Farnam Street)',
        resourceUrl: 'https://fs.blog/weekly-review/',
        resourceType: 'guide',
        resourceWhy: 'Follow this reflective checklist to review progress without self-judgment and calibrate next week.',
        detailedSteps: [
          {
            stepNumber: 1,
            title: 'Audit Weekly Wins & Friction',
            durationMinutes: 5,
            instructions: 'Review completed sessions from this week. Identify which drills felt easiest and which had friction.',
            focusCue: 'Be honest and objective; friction reveals where skill is growing.',
            pitfallToAvoid: 'Skipping the reflection or feeling guilty about imperfect execution.',
            resourceTitle: 'Harvard Business Review: The Power of Meaningful Reflection',
            resourceUrl: 'https://hbr.org/2014/03/why-you-should-make-time-for-self-reflection-even-if-youre-too-busy',
            resourceType: 'guide',
            resourceWhy: 'Follow this 3-question audit format to distill weekly learning into actionable tweaks.'
          },
          {
            stepNumber: 2,
            title: 'Pre-flight Upcoming Week & Habit Environment',
            durationMinutes: 10,
            instructions: 'Confirm your practice space and calendar blocks for the upcoming 6 practice days.',
            focusCue: 'Clear physical environment beforehand so friction to start is near zero.',
            pitfallToAvoid: 'Leaving scheduling to chance on busy mornings.',
            resourceTitle: 'James Clear: Habit Triggers and Environment Architecture',
            resourceUrl: 'https://jamesclear.com/environment-design-habits',
            resourceType: 'scientific_study',
            resourceWhy: 'Understand how visual environment cues govern automatic behavior execution.'
          }
        ]
      });
    } else {
      const step1Min = Math.round(dailyMins * 0.2);
      const step2Min = Math.round(dailyMins * 0.5);
      const step3Min = dailyMins - step1Min - step2Min;

      tasks.push({
        dayNumber: d + 1,
        dayOfWeek,
        title: `Day ${d + 1}: ${d === 0 ? 'Diagnostic & Setup Drill' : d === 4 ? 'Paced Speed Drill' : 'Deliberate Sub-skill Practice'}`,
        isRestDay: false,
        durationMinutes: dailyMins,
        slotTime,
        implementationIntention: `When: ${slotTime} | Where: Dedicated practice area | Action: ${dailyMins}-min structured deliberate practice`,
        resourceTitle: `Curated Domain Master Guide (${theme})`,
        resourceUrl: 'https://en.wikipedia.org/wiki/Deliberate_practice',
        resourceType: 'guide',
        resourceWhy: 'Ground yourself in the foundational mechanics and principles for this sub-skill before beginning reps.',
        detailedSteps: [
          {
            stepNumber: 1,
            title: 'Mechanical Warm-up & Calibration',
            durationMinutes: step1Min,
            instructions: 'Begin at 60% speed. Focus on flawless form, posture, and zero unnecessary physical tension.',
            focusCue: 'Smooth and slow is faster than rushed and sloppy.',
            pitfallToAvoid: 'Speeding up before the motion is clean.',
            challenge: {
              type: 'repetitions',
              drillName: 'Clean Form Calibration',
              targetCount: 10,
              totalSets: 3,
              unit: 'slow reps'
            },
            resourceTitle: 'Biomechanics & Kinetic Alignment Walkthrough',
            resourceUrl: 'https://www.youtube.com/results?search_query=biomechanics+proper+posture+and+ergonomics+tutorial',
            resourceType: 'youtube_video',
            resourceWhy: 'Watch the kinetic breakdown from 01:00 to 03:30 to eliminate wrist strain and posture slump.'
          },
          {
            stepNumber: 2,
            title: 'Core Deliberate Practice Drill',
            durationMinutes: step2Min,
            instructions: `Execute targeted repetitions of the central technique for ${theme}. Take 10-second pauses between micro-sets.`,
            focusCue: 'Pay intense attention to the precise contact point and timing.',
            pitfallToAvoid: 'Allowing your mind to wander; treat this as an active mental workout.',
            challenge: {
              type: 'repetitions',
              drillName: 'Paced Execution Drill',
              targetCount: 8,
              totalSets: 4,
              unit: 'focused sets'
            },
            resourceTitle: 'Interactive Practice Engine & Paced Rep Metronome',
            resourceUrl: 'https://www.flutetunes.com/metronome/',
            resourceType: 'interactive_tool',
            resourceWhy: 'Dial this interactive metronome to 60 BPM and increase by 2 BPM only after 5 flawless consecutive sets.'
          },
          {
            stepNumber: 3,
            title: 'Fluency Integration & Mental Blueprint',
            durationMinutes: step3Min,
            instructions: 'Integrate the technique into a continuous sequence or musical phrase. Log any points of resistance.',
            focusCue: 'Focus on rhythm and seamless flow across transitions.',
            pitfallToAvoid: 'Ending abruptly without reviewing what went well.',
            challenge: {
              type: 'checklist',
              items: [
                { id: 'c1', label: 'Perform 1 unbroken fluency sequence' },
                { id: 'c2', label: 'Self-diagnose any friction points' },
                { id: 'c3', label: 'Complete 60-second mental replay' }
              ]
            },
            resourceTitle: 'Dr. Pascual-Leone: Mental Practice & Motor Cortex Reorganization Study',
            resourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/7500130/',
            resourceType: 'scientific_study',
            resourceWhy: 'Review findings showing mental rehearsal activates the exact same neural pathways as physical execution.'
          }
        ]
      });
    }
  }

  return tasks;
}
