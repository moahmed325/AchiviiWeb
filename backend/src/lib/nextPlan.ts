/**
 * Next plan (docs/features/next-plan): what a plan reached, read from its stored rows. Pure. The goal response sends it
 * as `journeyResult` (the day-90 screen's "You went from 3 km to 8 km", NP-1), and goal create reads it again from the
 * old goal when a next plan starts from it (NP-8), so the starting point never comes from the browser.
 */
import { formatAmount, pathwayFor, shownAmount, TOTAL_WEEKS, type PlanAnswer, type WeekTarget } from './ai/roadmap.js';
import { readCheckpoints, unitStep, type NumberTarget } from './weekClose/checkpoint.js';
import { isWeekTarget, safeGoalTargets, testOf, type StoredWeek } from './safety/storedTargets.js';
import { harder, nextSafeStep } from './safety/targetSteps.js';
import { resultNumber } from './weekClose/update.js';
import { startingPointValue } from './planV2.js';

export type NextPlanMode = 'keep_going' | 'go_further' | 'fresh';
export const NEXT_PLAN_MODES: readonly NextPlanMode[] = ['keep_going', 'go_further', 'fresh'];

/** The id of the answer goal create adds for a next plan; the roadmap prompt labels it (NP-3). */
export const MEASURED_LEVEL_ID = 'measured_level';

export interface JourneyResult {
  kind: 'number' | 'deliverable';
  /** Number goals: the plan's starting point, as shown ("3 km"); null with no starting point. */
  start: string | null;
  startValue: number | null;
  /** The last measured result (week 12's test, else the latest measured week), as shown; null when none was logged. */
  reached: string | null;
  reachedValue: number | null;
  /** The week that result was logged in. */
  reachedWeek: number | null;
  /** The person's full goal, as shown (never a target a checkpoint or the safe climb lowered, NP-2). */
  goal: string | null;
  goalValue: number | null;
  unit: string | null;
  direction: NumberTarget['direction'] | null;
  /** Set when a checkpoint lowered week 12: the day-90 target, as shown, and whether the result reached it. */
  dayNinetyTarget: string | null;
  reachedDayNinety: boolean;
  /** The result reached the full goal. Deliverable goals: week 12's test passed. */
  madeIt: boolean;
  /** Fell short by at most one safe step (NP-5): "Go further" leads. */
  nearGoal: boolean;
  /** Weeks closed and not jumped. */
  weeksFinished: number;
  /** Deliverable goals: the last week's target whose test passed. */
  lastDone: string | null;
}

/** NP-8: what a next plan stores in `Goal.roadmap.previousPlan` (no migration), and the goal response sends back. */
export interface PreviousPlan {
  goalId: string;
  /** This plan's number in the chain: the old plan's number plus one (a plan with no link is plan 1). */
  number: number;
  mode: NextPlanMode;
  /** "3 km → 8 km", or "11 of 12 weeks" for a deliverable goal. */
  summary: string;
}

type JourneyWeek = StoredWeek & { testResult?: unknown };

export interface JourneyGoal {
  rawGoal: string;
  clarifiedOutcome: string | null;
  roadmap: unknown;
  roadmapWeeks: JourneyWeek[] | undefined;
}

const passed = (testResult: unknown) =>
  Boolean(testResult) && typeof testResult === 'object' && (testResult as Record<string, unknown>).passed === true;

/** A week whose test measured the goal's number: not jumped, not a light week (M2.1), with a result in the unit. */
function measured(week: JourneyWeek, target: NumberTarget): number | null {
  if (week.jumped === true || testOf(week)?.light === true) return null;
  return resultNumber(week.testResult, target);
}

/** The first number in a shown amount ("10 km" → 10); `week12Line.goal` is stored only as text. */
function leadingNumber(text: string): number | null {
  const match = /-?\d+(?:\.\d+)?/.exec(text);
  return match ? Number(match[0]) : null;
}

/** NP-1, NP-2: null for a goal with no v2 roadmap or no weeks. */
export function journeyResultOf(goal: JourneyGoal): JourneyResult | null {
  const safe = safeGoalTargets(goal);
  if (!safe) return null;
  const weeks = [...safe.weeks].sort((a, b) => a.weekNumber - b.weekNumber);
  const week12 = weeks.find((week) => week.weekNumber === TOTAL_WEEKS) ?? weeks[weeks.length - 1];
  const target = week12 && isWeekTarget(week12.target) ? (week12.target as WeekTarget) : null;
  if (!target) return null;
  const weeksFinished = weeks.filter((week) => week.status === 'completed' && week.jumped !== true).length;

  if (target.kind === 'deliverable') {
    const done = weeks.filter((week) => week.jumped !== true && passed(week.testResult) && isWeekTarget(week.target));
    const last = done[done.length - 1];
    return {
      kind: 'deliverable',
      start: null,
      startValue: null,
      reached: null,
      reachedValue: null,
      reachedWeek: last ? last.weekNumber : null,
      goal: target.description,
      goalValue: null,
      unit: null,
      direction: null,
      dayNinetyTarget: null,
      reachedDayNinety: false,
      madeIt: passed(week12.testResult),
      nearGoal: false,
      weeksFinished,
      lastDone: last ? (last.target as WeekTarget & { kind: 'deliverable' }).description || null : null,
    };
  }

  const startValue = startingPointValue(goal);
  // The latest measured result, week 12's first (its own target's unit decides whether it counts).
  let reachedValue: number | null = null;
  let reachedWeek: number | null = null;
  for (const week of [...weeks].reverse()) {
    const own = isWeekTarget(week.target) && (week.target as WeekTarget).kind === 'number' ? (week.target as NumberTarget) : target;
    const value = measured(week, own);
    if (value !== null) {
      reachedValue = value;
      reachedWeek = week.weekNumber;
      break;
    }
  }

  // The full goal: the safe climb's stated number (`week12Line.goal`), else week 12 before a checkpoint lowered it.
  const checkpoints = readCheckpoints(goal.roadmap);
  const lowered = checkpoints.some((item) => item.answer === 'accept') && harder(checkpoints[0].fullGoal, target.value, target.direction);
  const stated = safe.week12Line?.goal ? leadingNumber(safe.week12Line.goal) : null;
  const goalValue = stated ?? (lowered ? checkpoints[0].fullGoal : target.value);
  const shown = (value: number) => shownAmount({ ...target, value });
  const reaches = (value: number | null, limit: number) => value !== null && !harder(limit, value, target.direction);

  const madeIt = reaches(reachedValue, goalValue);
  const context = { run10k: pathwayFor(goal.rawGoal, goal.clarifiedOutcome)?.id === 'run10k' };
  const sign = target.direction === 'higher_is_better' ? 1 : -1;
  const oneStep =
    reachedValue === null ? null : (nextSafeStep(target, reachedValue, context) ?? reachedValue + sign * unitStep(target, reachedValue, context));
  const nearGoal = !madeIt && oneStep !== null && reaches(oneStep, goalValue);

  return {
    kind: 'number',
    start: startValue === null ? null : formatAmount(startValue, target.unit),
    startValue,
    reached: reachedValue === null ? null : formatAmount(reachedValue, target.unit),
    reachedValue,
    reachedWeek,
    goal: shown(goalValue),
    goalValue,
    unit: target.unit,
    direction: target.direction,
    dayNinetyTarget: lowered ? shown(target.value) : null,
    reachedDayNinety: lowered && reaches(reachedValue, target.value),
    madeIt,
    nearGoal,
    weeksFinished,
    lastDone: null,
  };
}

/** NP-8: the Progress line's summary of a plan. */
export function journeySummary(result: JourneyResult): string {
  if (result.kind === 'number' && result.reached) return result.start ? `${result.start} → ${result.reached}` : `reached ${result.reached}`;
  return `${result.weeksFinished} of ${TOTAL_WEEKS} weeks`;
}

/** `Goal.roadmap.previousPlan`; missing or unreadable means none. */
export function readPreviousPlan(roadmap: unknown): PreviousPlan | null {
  const value = roadmap && typeof roadmap === 'object' ? (roadmap as Record<string, unknown>).previousPlan : null;
  if (!value || typeof value !== 'object') return null;
  const plan = value as Record<string, unknown>;
  if (typeof plan.goalId !== 'string' || typeof plan.number !== 'number' || typeof plan.summary !== 'string') return null;
  return plan as unknown as PreviousPlan;
}

/** The level a next plan starts from (NP-3, NP-9, NP-10): the one the person gave, else the last measured result. */
export interface NextPlanStart {
  value: number | null;
  unit: string | null;
  answer: PlanAnswer;
}

/**
 * NP-3: the answer goal create adds, worded for the roadmap prompt. `given` is the level the person typed (after a
 * break, or with no result logged); it wins over the last measured result. Null when a number goal has neither.
 */
export function nextPlanStart(result: JourneyResult, mode: NextPlanMode, given: number | null): NextPlanStart | null {
  const question = 'Their level now, measured at the end of their last 90-day plan';
  if (result.kind === 'deliverable') {
    const done = result.lastDone ? `; the last piece of work they finished: ${result.lastDone}` : '';
    return {
      value: null,
      unit: null,
      answer: {
        id: MEASURED_LEVEL_ID,
        question,
        answer: `They finished ${result.weeksFinished} of ${TOTAL_WEEKS} weeks of a plan for "${result.goal}"${done}. Start from there, not from the beginning.`,
      },
    };
  }
  const value = given ?? (mode === 'fresh' ? null : result.reachedValue);
  if (value === null || !result.unit) return null;
  const from = result.start ? ` (that plan started at ${result.start})` : '';
  return {
    value,
    unit: result.unit,
    answer: {
      id: MEASURED_LEVEL_ID,
      question,
      answer: `${formatAmount(value, result.unit)}${from}. This is where they are now; it replaces any earlier level in these answers.`,
    },
  };
}
