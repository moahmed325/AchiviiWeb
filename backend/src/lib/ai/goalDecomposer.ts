import {
  findPresetForGoal,
  CertifiedPresetBlueprint
} from './presets/index.js';
import {
  formatSpineBlock,
  hasUsableSpine,
  stripUnallowedUrls,
  type PlanGrounding,
} from '../research/planGrounding.js';
import { WEEK_TASKS_RESPONSE_SCHEMA } from './planSchema.js';
import { buildSpineWeekTasks } from './spineFallbackPlan.js';
import { repairWeekSchedule } from './scheduleRepair.js';
import { polishWeekTasks, taskQualityFailures, taskRulesBlock } from './taskRules.js';
import { generateWithOneRetry } from './retry.js';
import { clarifyGoalWithAI, type GoalClarification } from './clarify.js';

export { clarifyGoalWithAI, type GoalClarification };

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
  /** The measurable standard that counts the step as done. */
  passMark?: string;
  /** What the user ends up with: a count, a recording, a finished piece. */
  output?: string;
  /** Only when the step can't follow the previous one straight away, e.g. "4 hours after mixing". */
  timing?: string;
  /** v2: 1 = most important step that day, unique within the day. */
  priority?: number;
  /** ND-5: physical strain (running, lifting); such a step is dropped, never carried. */
  highLoad?: boolean;
  layer?: TaskLayerType;
  layerReasoning?: string;
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
  /** Set when the plan did not come from a model answer. */
  planSource?: 'ai' | 'spine_fallback' | 'preset_fallback';
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
  previousWeekTasks: PreviousWeekTaskSummary[] = [],
  grounding?: PlanGrounding
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
   ${
     grounding
       ? '- resourceUrl may be copied only from the allowed URL list in the researched spine. If none fits, omit resourceUrl. Do not invent a link or a YouTube search URL.'
       : `- For "youtube_video", use high-precision search query URL format (e.g. https://www.youtube.com/results?search_query=[topic+drill+tutorial]) to guarantee 100% working links without broken video IDs.
   - For documentation or scientific studies, use canonical verified base domains (e.g., wikipedia.org, pubmed.ncbi.nlm.nih.gov, developer.mozilla.org, etc.).`
   }
6. STAY ON THE METHOD: if a plan spine is provided, de-load or advance inside that method and its numbers. Do not switch to a different program or generic advice.
7. Every step is real work that moves the user toward the goal: a clear action, what they end up with, and the proof it is good enough. No filler.

When the most effective version of a drill and the version people stick with differ, use the one people stick with in Weeks 1-8 and the more demanding one from Week 9. Safety always wins: never write a step a coach in this domain would call unsafe or badly sequenced.`;

  const previousTasksFormatted = previousWeekTasks.length > 0
    ? previousWeekTasks.map(t => {
        const statusBadge = t.status === 'completed' ? '[COMPLETED]' : t.isRestDay ? '[REST DAY]' : '[SKIPPED / INCOMPLETE]';
        const stepsStr = t.stepTitles && t.stepTitles.length > 0 ? ` (Sub-drills: ${t.stepTitles.join(' -> ')})` : '';
        const notesStr = t.notes ? ` | User Practice Notes: "${t.notes}"` : '';
        return `  - Day ${t.dayNumber} (${t.dayOfWeek}): ${statusBadge} "${t.title}"${stepsStr}${notesStr}`;
      }).join('\n')
    : 'No granular task logs found for previous week.';

  const spineBlock = grounding ? formatSpineBlock(grounding) : '';

  const prompt = `${spineBlock}Goal: "${goalTitle}"
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
Generate exactly 7 daily tasks for Week ${targetWeekNumber} (Days ${(targetWeekNumber - 1) * 7 + 1} to ${targetWeekNumber * 7}) starting on ${weekStartDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })}.
Ensure exactly ${activeDaysTarget} active deliberate practice days and ${restDaysTarget} rest days conforming to "${planVariant}" and the 2-Day Rule.
Ensure seamless continuity from the execution audit above. Explicitly bridge any unmastered skills or user notes into the first 2 active days before escalating difficulty.

${taskRulesBlock(dailyMins)}
The baseline test on the first practice day re-measures where last week ended; set this week's targets from it.

RESOURCES: add resourceTitle, resourceType, resourceWhy only when one specific, well-known video, book, or tool genuinely helps that step.
${
  grounding
    ? 'Set resourceUrl only when it is copied from the allowed URL list. Otherwise omit resourceUrl.'
    : 'For YouTube videos, use high-precision search URLs (https://www.youtube.com/results?search_query=...).'
}

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
          "passMark": string,
          "output": string,
          "timing"?: string,
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
          "resourceTitle"?: string,
          "resourceUrl"?: string,
          "resourceType"?: "youtube_video" | "documentation" | "scientific_study" | "interactive_tool" | "guide",
          "resourceWhy"?: string
        }
      ]
    }
  ]
}
`;

  const aiTasks = await generateWithOneRetry<{ tasks: DailyTaskPlan[] }, DailyTaskPlan[]>(
    prompt,
    systemInstruction,
    WEEK_TASKS_RESPONSE_SCHEMA,
    (data, lastAttempt) => {
      if (data.tasks?.length !== 7) return { reason: `"tasks" must have exactly 7 entries, got ${data.tasks?.length ?? 0}.` };
      let tasks = data.tasks;
      if (grounding) {
        tasks = stripUnallowedUrls({ initialTasks: tasks }, grounding.allowedUrls).initialTasks ?? tasks;
      }
      const schedule = repairWeekSchedule(tasks, dailyMins, activeDaysTarget);
      if (schedule.failures.length > 0) return { reason: schedule.failures.join(' ') };
      const polished = polishWeekTasks(schedule.tasks, { blocks: grounding?.blocks, week: targetWeekNumber });
      const dull = taskQualityFailures(polished);
      if (dull.length > 0) {
        if (!lastAttempt) return { reason: dull.join(' ') };
        console.warn(`[GoalDecomposer] Week ${targetWeekNumber} kept with weak tasks: ${dull.join(' | ')}`);
      }
      return { value: polished };
    },
    `Week ${targetWeekNumber}`
  );
  if (aiTasks) return aiTasks;

  const preset = findPresetForGoal(goalTitle);
  if (preset) {
    return getDeterministicPresetTasks(preset, dailyMins, defaultSlotTime, weekStartDate, planVariant);
  }

  if (hasUsableSpine(grounding)) {
    console.warn(`[GoalDecomposer] Week ${targetWeekNumber} writer failed twice; building it from the researched spine.`);
    return buildSpineWeekTasks({
      grounding: grounding!,
      dailyMins,
      slotTime: defaultSlotTime,
      weekStartDate,
      planVariant,
      weekNumber: targetWeekNumber,
    });
  }

  throw new Error('Unable to adapt upcoming week tasks right now. AI services are temporarily unavailable. Please retry.');
}

// ---------------------------------------------------------------------------
// Resilient Deterministic Fallbacks
// ---------------------------------------------------------------------------

/** The preset's own fixed plan, with no model call. Used when the v2 roadmap can't be written. */
export function presetFixedPlan(
  preset: CertifiedPresetBlueprint,
  routine: UserRoutineInput,
  startDate: Date
): PlanGenerationResult {
  const slot = routine.preferredSlot === 'morning' ? '07:30' : routine.preferredSlot === 'afternoon' ? '14:00' : '19:30';
  return {
    ...getDeterministicPresetPlan(preset, routine.dailyMinutes || 60, slot, startDate, routine.planVariant || 'steady'),
    planSource: 'preset_fallback',
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
    currentDate.setUTCDate(currentDate.getUTCDate() + d);
    const dayOfWeek = dayNames[currentDate.getUTCDay()];
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

