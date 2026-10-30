/**
 * Next plan (docs/features/next-plan): what a plan did, read from its stored rows. Pure. The goal response sends it as
 * `journeyResult` (the end screen's "You finished 11 of 12 weeks: 52 of 60 sessions", NP-1), and goal create reads it
 * again from the old goal when a next plan starts from it (NP-8). No weekly tests (2026-10-30,
 * docs/features/no-weekly-tests/plan.md): there is no measured result, so a goal measured in a number always asks
 * where the person is now, and the summary is weeks and sessions done.
 */
import { formatAmount, TOTAL_WEEKS, type Measure, type PlanAnswer, type TargetDirection } from './ai/roadmap.js';
import { shapeOf } from './planLength.js';
import { startingPointValue } from './planV2.js';

export type NextPlanMode = 'keep_going' | 'go_further' | 'fresh';
export const NEXT_PLAN_MODES: readonly NextPlanMode[] = ['keep_going', 'go_further', 'fresh'];

/** The id of the answer goal create adds for a next plan; the roadmap prompt labels it (NP-3). */
export const MEASURED_LEVEL_ID = 'measured_level';

export interface JourneyResult {
  /** `number` when the goal is measured in a number (its `measure`), so a next plan asks the level now. */
  kind: 'number' | 'other';
  /** Number goals: the plan's starting point, as shown ("3 km"); null with no starting point. */
  start: string | null;
  startValue: number | null;
  /** The plan's final goal, as written. */
  goal: string | null;
  unit: string | null;
  direction: TargetDirection | null;
  /** Weeks closed and not jumped. */
  weeksFinished: number;
  /** Practice sessions done and planned over the whole plan (rest days and days not offered left out). */
  sessionsDone: number;
  sessionsPlanned: number;
  /** B-109: the plan's weeks, only when not 12. */
  totalWeeks?: number;
}

/** NP-8: what a next plan stores in `Goal.roadmap.previousPlan` (no migration), and the goal response sends back. */
export interface PreviousPlan {
  goalId: string;
  /** This plan's number in the chain: the old plan's number plus one (a plan with no link is plan 1). */
  number: number;
  mode: NextPlanMode;
  /** "11 of 12 weeks, 52 of 60 sessions". */
  summary: string;
}

interface JourneyWeek {
  weekNumber: number;
  status?: string | null;
  jumped?: boolean | null;
  target?: unknown;
}

interface JourneyTask {
  status?: string | null;
  isRestDay?: boolean | null;
  notOffered?: boolean | null;
}

export interface JourneyGoal {
  rawGoal: string;
  clarifiedOutcome: string | null;
  roadmap: unknown;
  roadmapWeeks: JourneyWeek[] | undefined;
  /** The plan's sessions; missing counts none. */
  dailyTasks?: JourneyTask[] | undefined;
  /** B-109: the plan's weeks; missing is 12. */
  totalWeeks?: number | null;
}

const DIRECTIONS: readonly TargetDirection[] = ['higher_is_better', 'lower_is_better'];

/**
 * What the goal is measured in: the stored `measure`, else (a goal made before the weekly tests went) its last week's
 * stored number target. Null for a skill, habit or thing made.
 */
export function measureOf(roadmap: unknown, weeks: readonly JourneyWeek[]): Measure | null {
  const hasMeasure = Boolean(roadmap) && typeof roadmap === 'object' && 'measure' in (roadmap as object);
  const read = (value: unknown): Measure | null => {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, unknown>;
    if (typeof item.metric !== 'string' || typeof item.unit !== 'string' || !item.unit) return null;
    if (!DIRECTIONS.includes(item.direction as TargetDirection)) return null;
    return { metric: item.metric, unit: item.unit, direction: item.direction as TargetDirection };
  };
  if (hasMeasure) return read((roadmap as { measure?: unknown }).measure);
  const last = [...weeks].sort((a, b) => b.weekNumber - a.weekNumber).find((week) => week.target && typeof week.target === 'object');
  const target = last?.target as Record<string, unknown> | undefined;
  return target?.kind === 'number' ? read(target) : null;
}

/** B-109: a shorter plan's week count, for the summary and the next plan's answer; nothing on a 12-week plan. */
const lengthOf = (goal: JourneyGoal): { totalWeeks?: number } => (shapeOf(goal).weeks === TOTAL_WEEKS ? {} : { totalWeeks: shapeOf(goal).weeks });

/** NP-1: null for a goal with no v2 roadmap or no weeks. */
export function journeyResultOf(goal: JourneyGoal): JourneyResult | null {
  const roadmap = goal.roadmap as { method?: unknown; finalGoal?: unknown } | null;
  if (!roadmap || typeof roadmap !== 'object' || !roadmap.method) return null;
  const weeks = Array.isArray(goal.roadmapWeeks) ? goal.roadmapWeeks : [];
  if (weeks.length === 0) return null;
  const measure = measureOf(goal.roadmap, weeks);
  const startValue = measure ? startingPointValue(goal) : null;
  const practice = (goal.dailyTasks ?? []).filter((task) => task.isRestDay !== true && task.notOffered !== true);
  return {
    kind: measure ? 'number' : 'other',
    start: measure && startValue !== null ? formatAmount(startValue, measure.unit) : null,
    startValue,
    goal: typeof roadmap.finalGoal === 'string' && roadmap.finalGoal.trim() ? roadmap.finalGoal.trim() : null,
    unit: measure?.unit ?? null,
    direction: measure?.direction ?? null,
    weeksFinished: weeks.filter((week) => week.status === 'completed' && week.jumped !== true).length,
    sessionsDone: practice.filter((task) => task.status === 'completed').length,
    sessionsPlanned: practice.length,
    ...lengthOf(goal),
  };
}

/** NP-8: the Progress line's summary of a plan. */
export function journeySummary(result: JourneyResult): string {
  const weeks = `${result.weeksFinished} of ${result.totalWeeks ?? TOTAL_WEEKS} weeks`;
  return result.sessionsPlanned > 0 ? `${weeks}, ${result.sessionsDone} of ${result.sessionsPlanned} sessions` : weeks;
}

/** `Goal.roadmap.previousPlan`; missing or unreadable means none. */
export function readPreviousPlan(roadmap: unknown): PreviousPlan | null {
  const value = roadmap && typeof roadmap === 'object' ? (roadmap as Record<string, unknown>).previousPlan : null;
  if (!value || typeof value !== 'object') return null;
  const plan = value as Record<string, unknown>;
  if (typeof plan.goalId !== 'string' || typeof plan.number !== 'number' || typeof plan.summary !== 'string') return null;
  return plan as unknown as PreviousPlan;
}

/** The level a next plan starts from (NP-3, NP-9, NP-10): the one the person gave. */
export interface NextPlanStart {
  value: number | null;
  unit: string | null;
  answer: PlanAnswer;
}

/**
 * NP-3: the answer goal create adds, worded for the roadmap prompt. A goal measured in a number needs `given`, the
 * level the person typed (there is no measured result any more): null without it. Any other goal says how much of the
 * last plan they did, and starts from there.
 */
export function nextPlanStart(result: JourneyResult, mode: NextPlanMode, given: number | null): NextPlanStart | null {
  const question = 'Their level now, at the end of their last plan';
  const did = `They finished ${journeySummary(result)} of a plan for "${result.goal ?? 'this goal'}".`;
  if (result.kind !== 'number' || !result.unit) {
    return {
      value: null,
      unit: null,
      answer: { id: MEASURED_LEVEL_ID, question, answer: `${did} ${mode === 'fresh' ? 'Start again at a level they can keep up.' : 'Start from there, not from the beginning.'}` },
    };
  }
  if (given === null) return null;
  const from = result.start ? ` (that plan started at ${result.start})` : '';
  return {
    value: given,
    unit: result.unit,
    answer: {
      id: MEASURED_LEVEL_ID,
      question,
      answer: `${formatAmount(given, result.unit)}${from}. ${did} This is where they are now; it replaces any earlier level in these answers.`,
    },
  };
}
