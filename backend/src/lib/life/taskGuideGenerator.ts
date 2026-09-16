/**
 * Task Execution Guide Generator
 * Generates structured, practical, step-by-step guides for any task/session
 * across Language, Coding, Fitness, Writing, and Habit domains.
 */

export interface ExecutionStep {
  step: number;
  title: string;
  duration: string;
  instruction: string;
}

export interface TaskExecutionGuide {
  summary: string;
  steps: ExecutionStep[];
  proTip: string;
  mvsFallback: string;
}

export type TaskDomain = 'LANGUAGE' | 'SOFTWARE' | 'FITNESS' | 'WRITING' | 'GENERAL';

export function detectTaskDomain(title: string, category?: string, context?: string): TaskDomain {
  const combined = `${title || ''} ${category || ''} ${context || ''}`.toLowerCase();

  // Language keywords
  if (
    /arabic|amharic|spanish|french|german|japanese|chinese|italian|russian|portuguese|korean|language|pronunciation|vocabulary|grammar|dialogue|vocab|speaking|accent|linguistic|listening|verbs|alphabets/i.test(
      combined
    )
  ) {
    return 'LANGUAGE';
  }

  // Software & Coding keywords
  if (
    /api|architecture|schema|database|backend|frontend|auth|security|prd|spec|docker|deploy|react|typescript|javascript|python|node|code|coding|software|saas|mvp|test|endpoint|service|bug|pr|git|component|pipeline/i.test(
      combined
    )
  ) {
    return 'SOFTWARE';
  }

  // Fitness & Endurance keywords
  if (
    /marathon|half marathon|5k|10k|run|running|aerobic|zone 2|intervals|tempo|cadence|strength|lift|lifting|mobility|endurance|stride|pace|cardio|recovery run|long run|hiit/i.test(
      combined
    )
  ) {
    return 'FITNESS';
  }

  // Writing & Creative keywords
  if (
    /write|writing|chapter|draft|article|essay|manuscript|book|outline|newsletter|post|creative|editing|prose|copywriting/i.test(
      combined
    )
  ) {
    return 'WRITING';
  }

  return 'GENERAL';
}

/**
 * Generates a structured step-by-step execution guide for a task.
 */
export function generateTaskExecutionGuide(
  rawTitle: string,
  category?: string,
  allocatedMinutes: number = 45,
  context?: string
): TaskExecutionGuide {
  const domain = detectTaskDomain(rawTitle, category, context);
  const totalMins = Math.max(15, allocatedMinutes);
  
  const setupMins = totalMins <= 20 ? 3 : 5;
  const wrapMins = totalMins <= 20 ? 3 : 5;
  const coreMins = Math.max(10, totalMins - setupMins - wrapMins);

  switch (domain) {
    case 'LANGUAGE':
      return {
        summary: `Master core phonetics, high-frequency phrasing, and verbal recall so words flow naturally without hesitating.`,
        steps: [
          {
            step: 1,
            title: 'Environment & Vocal Warmup',
            duration: `${setupMins}m`,
            instruction: 'Put on headphones, clear your space, hydrate, and practice articulating vowels and challenging consonant sounds aloud to prime your speech muscles.',
          },
          {
            step: 2,
            title: 'Active Recall & Conversational Shadowing',
            duration: `${coreMins}m`,
            instruction: 'Speak sentences out loud at conversational speed. Test yourself on 10–15 target phrases without looking at translations, and shadow audio dialogues.',
          },
          {
            step: 3,
            title: 'Voice Note & Retention Log',
            duration: `${wrapMins}m`,
            instruction: 'Record a quick 60-second voice memo speaking about your day in the target language. Note 2 words that caused hesitation for tomorrow.',
          },
        ],
        proTip: 'Speak out loud from minute one. Tongue muscle memory and auditory feedback are 80% of fluency.',
        mvsFallback: 'Review 10 flashcards aloud and read 1 short dialogue (15m).',
      };

    case 'SOFTWARE':
      return {
        summary: `Ship verified, clean functionality with clear types, isolated business logic, and automated tests.`,
        steps: [
          {
            step: 1,
            title: 'Spec & Interface Contract',
            duration: `${setupMins}m`,
            instruction: 'Close distractions, define the exact input/output data shape or type signatures, and write 1 failing test or API request spec.',
          },
          {
            step: 2,
            title: 'Implementation Sprint',
            duration: `${coreMins}m`,
            instruction: 'Implement the core logic step-by-step. Keep functions small, run tests continuously, and resolve compiler or runtime errors immediately.',
          },
          {
            step: 3,
            title: 'Verification & Clean Git Commit',
            duration: `${wrapMins}m`,
            instruction: 'Verify happy and error paths in the browser or terminal. Clean up console logs, run the linter, and make an atomic git commit with a clear message.',
          },
        ],
        proTip: 'If stuck on an issue for more than 7 minutes, step away from code and sketch the data transformation on paper.',
        mvsFallback: 'Define type schemas and write a single test assertion (15m).',
      };

    case 'FITNESS':
      return {
        summary: `Develop aerobic capacity, biomechanical efficiency, and muscular resilience through controlled effort pacing.`,
        steps: [
          {
            step: 1,
            title: 'Dynamic Mobility & Gear Check',
            duration: `${setupMins}m`,
            instruction: 'Lace shoes comfortably, perform dynamic leg swings, ankle openers, and torso twists. Start your GPS or heart rate monitor.',
          },
          {
            step: 2,
            title: 'Target Effort Drill',
            duration: `${coreMins}m`,
            instruction: 'Lock into your planned zone or pace. Keep posture tall, shoulders dropped, and breathe rhythmically through your nose.',
          },
          {
            step: 3,
            title: 'Cool-down & Hydration',
            duration: `${wrapMins}m`,
            instruction: 'Perform 3 minutes of easy walking deceleration followed by light hamstring and quad stretches. Drink water with electrolytes.',
          },
        ],
        proTip: 'Aerobic base rule: You should be able to speak a full sentence out loud without gasping. Slow down to run further.',
        mvsFallback: '15-minute brisk walk or light dynamic mobility routine (15m).',
      };

    case 'WRITING':
      return {
        summary: `Translate thoughts into engaging, forward-moving prose without second-guessing or premature editing.`,
        steps: [
          {
            step: 1,
            title: 'Focus Ritual & Opening Hook',
            duration: `${setupMins}m`,
            instruction: 'Silence all notifications, open a full-screen editor, and re-read the last two sentences from your previous session to find your voice.',
          },
          {
            step: 2,
            title: 'Uninterrupted Flow Sprint',
            duration: `${coreMins}m`,
            instruction: 'Draft continuously without deleting or editing. If you need a specific fact or date, drop a [TODO] and keep the narrative moving.',
          },
          {
            step: 3,
            title: 'Word Count & Next Session Hook',
            duration: `${wrapMins}m`,
            instruction: 'Check your word count, highlight the strongest sentence you wrote, and jot down 2 bullet points for where to start next time.',
          },
        ],
        proTip: 'Draft with the door closed; edit with the door open. Never edit grammar while generating ideas.',
        mvsFallback: 'Write 150 words without stopping or outline the next scene (15m).',
      };

    case 'GENERAL':
    default:
      return {
        summary: `Make tangible daily progress toward your ambition through focused single-task execution.`,
        steps: [
          {
            step: 1,
            title: 'Environment & Intent Setup',
            duration: `${setupMins}m`,
            instruction: 'Clear your physical and digital desk. Write your single intended outcome for this block on a sticky note and take 3 deep breaths.',
          },
          {
            step: 2,
            title: 'Monotasking Deep Focus',
            duration: `${coreMins}m`,
            instruction: 'Work exclusively on your primary task. If a distracting thought arises, write it down on a scratchpad and immediately return to your objective.',
          },
          {
            step: 3,
            title: 'Wrap-up & Proof of Work',
            duration: `${wrapMins}m`,
            instruction: 'Save your work, log a quick note on what you completed, and acknowledge yourself for showing up and protecting your focus.',
          },
        ],
        proTip: 'Action creates motivation, not the other way around. Simply begin the first two minutes and the rest will follow.',
        mvsFallback: '15 minutes of low-friction review or organizing key materials (15m).',
      };
  }
}
