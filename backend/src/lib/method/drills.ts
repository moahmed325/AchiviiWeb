import type { DailyTaskPlan, DetailedStep } from '../ai/goalDecomposer.js';

export const DRILL_STAGES = ['foundation', 'build', 'peak'] as const;
export type DrillStage = (typeof DRILL_STAGES)[number];

/** One exercise from the chosen method, ranked by how fast it moves this person toward the goal. */
export interface Drill {
  name: string;
  /** Which part of the goal it moves. */
  moves: string;
  /** 1-5: progress toward the week-12 target per minute spent. */
  impact: number;
  stage: DrillStage;
  /** Starting dose for the first week of its stage. */
  dose: string;
  passMark: string;
  cue: string;
  pitfall: string;
}

export const MIN_DRILLS = 6;
const MAX_DRILLS = 12;
const MIN_FOUNDATION = 3;

export const DRILL_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    moves: { type: 'string' },
    impact: { type: 'integer' },
    stage: { type: 'string', enum: [...DRILL_STAGES] },
    dose: { type: 'string' },
    passMark: { type: 'string' },
    cue: { type: 'string' },
    pitfall: { type: 'string' },
  },
  required: ['name', 'moves', 'impact', 'stage', 'dose', 'passMark', 'cue', 'pitfall'],
};

/** Not drills: they move nothing toward the goal on their own. */
const NOT_A_DRILL = /\b(warm[- ]?up|cool[- ]?down|journal\w*|reflect\w*|read about|watch a video|install|set ?up|sign up)\b/i;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function stageForWeek(week: number): DrillStage {
  return week <= 4 ? 'foundation' : week <= 8 ? 'build' : 'peak';
}

/** Valid, de-duplicated drills, highest impact first. */
export function cleanDrills(value: unknown): Drill[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const drills: Drill[] = [];
  for (const raw of value) {
    const name = text(raw?.name);
    const key = name.toLowerCase();
    if (!name || seen.has(key) || NOT_A_DRILL.test(name)) continue;
    const dose = text(raw?.dose);
    const passMark = text(raw?.passMark);
    if (!/\d/.test(dose) || passMark.length < 8) continue;
    seen.add(key);
    const impact = Math.round(Number(raw?.impact));
    drills.push({
      name,
      moves: text(raw?.moves),
      impact: Number.isFinite(impact) ? Math.min(5, Math.max(1, impact)) : 3,
      stage: DRILL_STAGES.includes(raw?.stage) ? raw.stage : 'build',
      dose,
      passMark,
      cue: text(raw?.cue) || 'Slow and correct beats fast.',
      pitfall: text(raw?.pitfall) || 'Rushing reps with poor form.',
    });
  }
  return drills.sort((a, b) => b.impact - a.impact).slice(0, MAX_DRILLS);
}

export function drillLibraryFailures(drills: Drill[]): string[] {
  const failures: string[] = [];
  if (drills.length < MIN_DRILLS) {
    failures.push(`Give at least ${MIN_DRILLS} drills, each with a numeric dose and a measurable passMark.`);
  }
  if (drills.filter((drill) => drill.stage === 'foundation').length < MIN_FOUNDATION) {
    failures.push(`At least ${MIN_FOUNDATION} drills must be "foundation" so week 1 has real work.`);
  }
  return failures;
}

/** Best drills for a week: its own stage first, then earlier stages, highest impact first. */
export function drillsForWeek(drills: Drill[], week: number): Drill[] {
  const order = DRILL_STAGES.indexOf(stageForWeek(week));
  const rank = (drill: Drill) => {
    const stage = DRILL_STAGES.indexOf(drill.stage);
    return stage === order ? 0 : stage < order ? 1 : 2;
  };
  return [...drills].sort((a, b) => rank(a) - rank(b) || b.impact - a.impact);
}

function words(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .map((word) => word.replace(/s$/, ''));
}

const TEST_PREFIX = /^(baseline test|retest|light practice|easy)\s*:?\s*/i;

/** The library drill a step practises, or null when the step is something else. */
export function matchDrill(stepTitle: string, drills: Drill[]): Drill | null {
  const title = stepTitle.replace(TEST_PREFIX, '');
  const titleWords = new Set(words(title));
  let best: { drill: Drill; overlap: number } | null = null;
  for (const drill of drills) {
    if (title.toLowerCase().includes(drill.name.toLowerCase())) return drill;
    const nameWords = words(drill.name);
    if (nameWords.length === 0) continue;
    const overlap = nameWords.filter((word) => titleWords.has(word)).length / nameWords.length;
    if (overlap >= 0.6 && (!best || overlap > best.overlap)) best = { drill, overlap };
  }
  return best?.drill ?? null;
}

function isWarmUp(step: DetailedStep): boolean {
  return /warm[- ]?up/i.test(step.title) && step.durationMinutes <= 5;
}

function asDrillStep(step: DetailedStep, drill: Drill): DetailedStep {
  return {
    ...step,
    title: drill.name,
    instructions: `${step.durationMinutes} minutes: ${drill.dose}`,
    passMark: drill.passMark,
    focusCue: drill.cue,
    pitfallToAvoid: drill.pitfall,
  };
}

/**
 * Every practice step must be a library drill (a short warm-up and the baseline test / retest excepted).
 * A step that isn't gets replaced by the highest-impact drill for this week not already used that day.
 */
export function enforceDrills(tasks: DailyTaskPlan[], drills: Drill[], week: number): DailyTaskPlan[] {
  if (drills.length === 0) return tasks;
  const ranked = drillsForWeek(drills, week);
  return tasks.map((task) => {
    if (task.isRestDay) return task;
    const steps = task.detailedSteps ?? [];
    const used = new Set(steps.map((step) => matchDrill(step.title, ranked)?.name).filter(Boolean));
    return {
      ...task,
      detailedSteps: steps.map((step) => {
        if (isWarmUp(step) || /^(baseline test|retest):/i.test(step.title) || matchDrill(step.title, ranked)) return step;
        const pick = ranked.find((drill) => !used.has(drill.name)) ?? ranked[0];
        used.add(pick.name);
        return asDrillStep(step, pick);
      }),
    };
  });
}

/** Practice steps that are not library drills. Empty when the week sticks to the drills. */
export function offLibrarySteps(tasks: DailyTaskPlan[], drills: Drill[]): string[] {
  if (drills.length === 0) return [];
  const failures: string[] = [];
  for (const task of tasks) {
    if (task.isRestDay) continue;
    for (const step of task.detailedSteps ?? []) {
      if (isWarmUp(step) || /^(baseline test|retest):/i.test(step.title) || matchDrill(step.title, drills)) continue;
      failures.push(`Day ${task.dayNumber} step "${step.title}" is not a drill from the library.`);
    }
  }
  return failures;
}

export function formatDrillLibrary(drills: Drill[]): string {
  if (drills.length === 0) return '';
  const lines = drills.map(
    (drill, index) =>
      `  ${index + 1}. [${drill.stage}, impact ${drill.impact}/5] ${drill.name}: ${drill.dose}. Done when: ${drill.passMark}. Cue: ${drill.cue}. Avoid: ${drill.pitfall}.`
  );
  return `
DRILL LIBRARY — the best drills for this person, highest impact first:
${lines.join('\n')}
DRILL RULES:
- Every practice step is one of these drills. Start the step "title" with the drill name exactly as written.
  The only exceptions: one warm-up of at most 5 minutes, and the "Baseline test:" / "Retest:" steps, which
  test the top drill of the stage.
- Weeks 1-4 use foundation drills, weeks 5-8 build, weeks 9-12 peak. A drill from an earlier stage may stay as
  a second step.
- The highest-impact drills of the stage get the most minutes and appear on most practice days.
- The listed dose is the stage's first week. Raise it each practice day toward this week's numbers.
`;
}
