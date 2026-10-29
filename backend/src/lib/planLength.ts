/**
 * Plans that fit a fixed date (B-109, docs/features/fixed-date-plans/plan.md): how many weeks a plan has and which of
 * them test. Every plan was 12 weeks; a goal whose fixed date is under 12 weeks away now gets the whole weeks that fit
 * before it (4 to 11), with the final test in the second-to-last week and an easier "ready" week after it. A 12-week
 * plan is exactly as before: big tests in weeks 4, 8 and 12, checkpoints after 4 and 8, no ready week. Pure.
 */

/** The normal plan: 12 weeks (`Goal.totalWeeks`' default). */
export const DEFAULT_WEEKS = 12;
/** Mo's choice (a): a date closer than this many weeks gets no plan of its own; the person picks a later date or none. */
export const MIN_WEEKS = 4;
/** The plan's days as before: start + 90 is `targetDate` (day 90 is its last day; 85 to 90 the closing stretch). */
export const DEFAULT_PLAN_DAYS = 90;
/** Big tests sit this many weeks apart, counted back from the final test (12: weeks 4, 8 and 12). */
const BIG_TEST_GAP = 4;
/** No big test before this week: too early to measure anything new. */
const FIRST_BIG_TEST = 3;

/** One plan's length and its test weeks. */
export interface PlanShape {
  /** How many weeks the plan has (`Goal.totalWeeks`): 4 to 12. */
  weeks: number;
  /** The week of the final test, with the full target: `weeks` on a 12-week plan, else the week before the last. */
  finalWeek: number;
  /** The weeks whose test measures the target (RULE-19), the final week last. */
  bigWeeks: readonly number[];
  /** The weeks whose close runs a checkpoint: every big week but the final one. */
  checkpointWeeks: readonly number[];
  /** The easier week before the date, after the final test; null on a 12-week plan. */
  readyWeek: number | null;
}

function shapeFor(weeks: number): PlanShape {
  const finalWeek = weeks === DEFAULT_WEEKS ? weeks : weeks - 1;
  const bigWeeks: number[] = [];
  for (let week = finalWeek; week >= FIRST_BIG_TEST; week -= BIG_TEST_GAP) bigWeeks.unshift(week);
  return {
    weeks,
    finalWeek,
    bigWeeks,
    checkpointWeeks: bigWeeks.filter((week) => week !== finalWeek),
    readyWeek: finalWeek < weeks ? weeks : null,
  };
}

const SHAPES = new Map<number, PlanShape>(Array.from({ length: DEFAULT_WEEKS - MIN_WEEKS + 1 }, (_, i) => [MIN_WEEKS + i, shapeFor(MIN_WEEKS + i)]));

/** The shape of a 12-week plan, which every goal made before B-109 has. */
export const DEFAULT_SHAPE: PlanShape = SHAPES.get(DEFAULT_WEEKS)!;

/** Every week that is a checkpoint on some plan length (3, 4, 5, 6 and 8): any other week never is. */
export const ANY_CHECKPOINT_WEEKS: readonly number[] = [...new Set([...SHAPES.values()].flatMap((shape) => shape.checkpointWeeks))].sort((a, b) => a - b);

/** The shape for a stored week count; anything but a whole number from 4 to 12 reads as 12. */
export function planShape(totalWeeks: unknown): PlanShape {
  return (typeof totalWeeks === 'number' && SHAPES.get(totalWeeks)) || DEFAULT_SHAPE;
}

/** A goal's shape, from its `totalWeeks` (missing on an old row or a test double: 12). */
export function shapeOf(goal: { totalWeeks?: number | null } | null | undefined): PlanShape {
  return planShape(goal?.totalWeeks);
}

/** The big-test week a week builds toward (WU-43 (1)); the ready week, and anything past the last big week, the final week. */
export function checkWeekFor(weekNumber: number, shape: PlanShape = DEFAULT_SHAPE): number {
  return shape.bigWeeks.find((week) => week >= weekNumber) ?? shape.finalWeek;
}

const DAY_MS = 86_400_000;

/**
 * The plan for a goal starting on `start` (00:00 UTC, ND-1) with an optional fixed date (the same, B-106): its number of
 * weeks and its `targetDate` (the day after its last day). With no date, or one 12 weeks away or more, 12 weeks and
 * start + 90, except that the end never falls after the date (a date 84 to 89 days away shortens the closing stretch).
 * Closer: the whole weeks that fit before the date, and `targetDate` the date itself, so the plan ends the day before it
 * at the latest. `too_close` when fewer than 4 weeks fit.
 */
export function planLengthFor(start: Date, fixedDate: Date | null | undefined): { weeks: number; targetDate: Date } | { tooClose: true } {
  const normalEnd = new Date(start.getTime() + DEFAULT_PLAN_DAYS * DAY_MS);
  if (!fixedDate || !Number.isFinite(fixedDate.getTime())) return { weeks: DEFAULT_WEEKS, targetDate: normalEnd };
  const days = Math.round((fixedDate.getTime() - start.getTime()) / DAY_MS);
  const weeks = Math.floor(days / 7);
  if (weeks >= DEFAULT_WEEKS) return { weeks: DEFAULT_WEEKS, targetDate: fixedDate.getTime() < normalEnd.getTime() ? new Date(fixedDate) : normalEnd };
  if (weeks < MIN_WEEKS) return { tooClose: true };
  return { weeks, targetDate: new Date(fixedDate) };
}
