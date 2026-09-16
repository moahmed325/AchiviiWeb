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

/**
 * Formats task and session titles to be concise, punchy, and to the point (2 to 4 words max).
 * Strips robotic prefixes like "Core Adaptation Session:", "Consolidation Practice:",
 * "Supportive Continuity:", "Targeted Focus Scaffolding:", etc.
 */
export function formatTaskTitle(rawTitle: string | null | undefined): string {
  if (!rawTitle) return 'Ambition Focus Dose';
  let cleaned = rawTitle
    .replace(/^(Core Adaptation Session|Consolidation Practice|Supportive Continuity|Targeted Focus Scaffolding|Preparation Session|Intervention Session|Core Focus|Daily Focus|Session \d+|Week \d+ Dose \d+|Milestone \d+):\s*/i, '')
    .replace(/^Core Adaptation Baseline$/i, 'Core Skills Baseline')
    .replace(/^(Core|Consolidation|Supportive|Dose \d+):\s*/i, '')
    .trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= 5) return cleaned;
  return words.slice(0, 4).join(' ');
}

/**
 * Derives or parses a structured, actionable task execution guide for any task.
 */
export function getTaskExecutionGuide(task: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
  allocated_minutes?: number | null;
  guide?: any;
}): TaskExecutionGuide {
  // If task already has structured guide attached from backend
  if (task.guide && Array.isArray(task.guide.steps) && task.guide.steps.length > 0) {
    return task.guide;
  }

  const rawTitle = task.title || '';
  const combined = `${rawTitle} ${task.category || ''} ${task.description || ''}`.toLowerCase();
  const totalMins = Math.max(15, task.allocated_minutes || 45);
  const setupMins = totalMins <= 20 ? 3 : 5;
  const wrapMins = totalMins <= 20 ? 3 : 5;
  const coreMins = Math.max(10, totalMins - setupMins - wrapMins);

  const existingDesc = task.description?.trim();
  const hasGenericDesc =
    !existingDesc ||
    existingDesc === 'null' ||
    existingDesc.includes('Consolidates neural and physical retention') ||
    existingDesc.includes('Maintains continuity and momentum') ||
    existingDesc.includes('Develops the foundational stimulus') ||
    existingDesc.includes('Core adaptation session focused on this milestone phase.');

  // Language
  if (
    /arabic|amharic|spanish|french|german|japanese|chinese|italian|russian|portuguese|korean|language|pronunciation|vocabulary|grammar|dialogue|vocab|speaking|accent|linguistic|listening|verbs|alphabets/i.test(
      combined
    )
  ) {
    return {
      summary: !hasGenericDesc
        ? existingDesc!
        : 'Master core phonetics, high-frequency phrasing, and verbal recall so words flow naturally without hesitating.',
      steps: [
        {
          step: 1,
          title: 'Environment & Vocal Warmup',
          duration: `${setupMins}m`,
          instruction: 'Put on headphones, clear your desk, hydrate, and practice articulating vowel shapes and difficult consonants out loud to prime your speech muscles.',
        },
        {
          step: 2,
          title: 'Active Recall & Shadowing Drill',
          duration: `${coreMins}m`,
          instruction: 'Speak out loud at natural conversational speed. Test 10–15 target phrases without looking at translations, and shadow audio clips sentence-by-sentence.',
        },
        {
          step: 3,
          title: 'Voice Note & Retention Log',
          duration: `${wrapMins}m`,
          instruction: 'Record a 60-second voice note speaking freely in the target language. Note any stumbled phrases to review first thing tomorrow.',
        },
      ],
      proTip: 'Speak out loud from minute one. Tongue muscle memory and ear feedback account for 80% of spoken fluency.',
      mvsFallback: 'Review 10 flashcard phrases aloud + read 1 dialogue aloud (15m).',
    };
  }

  // Software & Coding
  if (
    /api|architecture|schema|database|backend|frontend|auth|security|prd|spec|docker|deploy|react|typescript|javascript|python|node|code|coding|software|saas|mvp|test|endpoint|service|bug|pr|git|component|pipeline/i.test(
      combined
    )
  ) {
    return {
      summary: !hasGenericDesc
        ? existingDesc!
        : 'Ship verified, clean functionality with clear types, isolated business logic, and automated tests.',
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
  }

  // Fitness & Endurance
  if (
    /marathon|half marathon|5k|10k|run|running|aerobic|zone 2|intervals|tempo|cadence|strength|lift|lifting|mobility|endurance|stride|pace|cardio|recovery run|long run|hiit/i.test(
      combined
    )
  ) {
    return {
      summary: !hasGenericDesc
        ? existingDesc!
        : 'Develop aerobic capacity, biomechanical efficiency, and muscular resilience through controlled effort pacing.',
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
  }

  // Writing & Creative
  if (
    /write|writing|chapter|draft|article|essay|manuscript|book|outline|newsletter|post|creative|editing|prose|copywriting/i.test(
      combined
    )
  ) {
    return {
      summary: !hasGenericDesc
        ? existingDesc!
        : 'Translate thoughts into engaging, forward-moving prose without second-guessing or premature editing.',
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
  }

  // General Ambition / Habit
  return {
    summary: !hasGenericDesc
      ? existingDesc!
      : 'Make tangible daily progress toward your ambition through focused single-task execution.',
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

/**
 * Formats a goal or outcome statement into a concise, punchy headline (2 to 4 words).
 * E.g., "By Day 90, you will confidently hold basic conversations in Amharic..." -> "Conversational Amharic"
 */
export function formatGoalTitle(
  goal: {
    outcome_statement?: string | null;
    goal_catalog?: { title?: string | null } | null;
    title?: string | null;
  } | null | undefined
): string {
  if (!goal) return 'Daily Execution';

  const catTitle = goal.goal_catalog?.title || goal.title;
  const outcome = goal.outcome_statement || '';

  // Detect mismatched fallback catalogs (e.g. SaaS MVP catalog on an Amharic language goal)
  const isMismatchedCatalog = Boolean(
    catTitle && (
      (/saas|software|mvp/i.test(catTitle) && /amharic|language|spanish|french|german/i.test(outcome)) ||
      (/marathon|running|fitness/i.test(catTitle) && /code|saas|software/i.test(outcome))
    )
  );

  if (catTitle && !isMismatchedCatalog && !catTitle.toLowerCase().includes('custom goal')) {
    return catTitle;
  }

  // Derive punchy title from outcome statement
  if (outcome) {
    if (/amharic/i.test(outcome)) return 'Conversational Amharic';
    if (/spanish/i.test(outcome)) return 'Conversational Spanish';
    if (/french/i.test(outcome)) return 'Conversational French';
    if (/german/i.test(outcome)) return 'Conversational German';
    if (/saas|software|mvp|app/i.test(outcome)) return 'Build & Launch SaaS';
    if (/marathon|half marathon/i.test(outcome)) return 'Marathon Finish';
    if (/10k|5k/i.test(outcome)) return 'Endurance Running';

    // Strip "By Day X, you will..."
    const stripped = outcome
      .replace(/^By Day \d+,\s*(you will\s*(confidently\s*)?)?/i, '')
      .replace(/^You will\s*(confidently\s*)?/i, '')
      .replace(/^[a-z]/, (c) => c.toUpperCase())
      .trim();

    const firstClause = stripped.split(/,|\.|;/)[0].trim();
    const words = firstClause.split(/\s+/).slice(0, 4).join(' ');
    if (words) return words;
  }

  return catTitle || 'Daily Execution';
}

/**
 * Converts "HH:mm" time string into minutes from midnight (0 - 1439).
 */
export function timeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Converts minutes from midnight into "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
