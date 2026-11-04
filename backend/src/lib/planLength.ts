/**
 * Plans that fit a fixed date (B-109, docs/features/fixed-date-plans/plan.md): how many weeks a plan has. Every plan
 * was 12 weeks; a goal whose fixed date is under 12 weeks away now gets the whole weeks that fit before it (4 to 11),
 * the last of them an easier "ready" week before the date. No weekly tests (2026-10-30): no week is a test week. Pure.
 */

/** The normal plan: 12 weeks (`Goal.totalWeeks`' default). */
export const DEFAULT_WEEKS = 12;
/** Mo's choice (a): a date closer than this many weeks gets no plan of its own; the person picks a later date or none. */
export const MIN_WEEKS = 4;
/** The plan's days as before: start + 90 is `targetDate` (day 90 is its last day; 85 to 90 the closing stretch). */
export const DEFAULT_PLAN_DAYS = 90;
/** One plan's length. */
export interface PlanShape {
  /** How many weeks the plan has (`Goal.totalWeeks`): 4 to 12. */
  weeks: number;
  /** The last full week, where "Do my final week" goes: `weeks` on a 12-week plan, else the week before the ready week. */
  finalWeek: number;
  /** The easier week before the date, after the final week; null on a 12-week plan. */
  readyWeek: number | null;
}

function shapeFor(weeks: number): PlanShape {
  const finalWeek = weeks === DEFAULT_WEEKS ? weeks : weeks - 1;
  return { weeks, finalWeek, readyWeek: finalWeek < weeks ? weeks : null };
}

const SHAPES = new Map<number, PlanShape>(Array.from({ length: DEFAULT_WEEKS - MIN_WEEKS + 1 }, (_, i) => [MIN_WEEKS + i, shapeFor(MIN_WEEKS + i)]));

/** The shape of a 12-week plan, which every goal made before B-109 has. */
export const DEFAULT_SHAPE: PlanShape = SHAPES.get(DEFAULT_WEEKS)!;

/** The shape for a stored week count; anything but a whole number from 4 to 12 reads as 12. */
export function planShape(totalWeeks: unknown): PlanShape {
  return (typeof totalWeeks === 'number' && SHAPES.get(totalWeeks)) || DEFAULT_SHAPE;
}

/** A goal's shape, from its `totalWeeks` (missing on an old row or a test double: 12). */
export function shapeOf(goal: { totalWeeks?: number | null } | null | undefined): PlanShape {
  return planShape(goal?.totalWeeks);
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
