import type { Goal } from '../types';

/**
 * Plans that fit a fixed date (B-109, docs/features/fixed-date-plans/plan.md), as the server's `lib/planLength.ts`
 * works them out. Every plan was 12 weeks (90 days); a goal whose fixed date is under 12 weeks away has the whole weeks
 * that fit before it (4 to 11), the last an easier "ready" week before the date. A goal without `totalWeeks` (every goal
 * made before it) is a 12-week plan, exactly as before.
 */

export const DEFAULT_WEEKS = 12;
export const MIN_WEEKS = 4;
/** A 12-week plan's days: day 90 is the day before `targetDate`; days 85 to 90 are the closing stretch. */
export const DEFAULT_PLAN_DAYS = 90;
const DAY_MS = 86_400_000;

type LengthGoal = Partial<Pick<Goal, 'totalWeeks'>> | null | undefined;
type DaysGoal = Partial<Pick<Goal, 'totalWeeks' | 'startDate' | 'targetDate'>> | null | undefined;

/** The plan's weeks: the goal's `totalWeeks` when it is a whole number from 4 to 12, else 12. */
export function planWeeks(goal: LengthGoal): number {
  const weeks = goal?.totalWeeks;
  return typeof weeks === 'number' && Number.isInteger(weeks) && weeks >= MIN_WEEKS && weeks <= DEFAULT_WEEKS ? weeks : DEFAULT_WEEKS;
}

/**
 * The plan's days, start to end (`targetDate` minus the start): its weeks' days and the closing stretch after them, at
 * most 6 days (90 on a 12-week plan; fewer when a fixed date ends it sooner). A span that doesn't fit the weeks reads as
 * the usual length: 90, or a shorter plan's weeks.
 */
export function planDays(goal: DaysGoal): number {
  const weeks = planWeeks(goal);
  const practice = weeks * 7;
  const usual = weeks === DEFAULT_WEEKS ? DEFAULT_PLAN_DAYS : practice;
  if (!goal?.startDate || !goal?.targetDate) return usual;
  const days = Math.round((new Date(goal.targetDate).getTime() - new Date(goal.startDate).getTime()) / DAY_MS);
  return Number.isFinite(days) && days >= practice && days <= practice + 6 ? days : usual;
}

/** The first day after the last week (85 on a 12-week plan): the closing stretch, up to the plan's last day. */
export function closingStartDay(goal: LengthGoal): number {
  return planWeeks(goal) * 7 + 1;
}

/** "90-day" on a 12-week plan, "7-week" on a shorter one: how the app names the plan. */
export function planLengthLabel(goal: LengthGoal): string {
  const weeks = planWeeks(goal);
  return weeks === DEFAULT_WEEKS ? '90-day' : `${weeks}-week`;
}

/** The whole weeks that fit from `start` to the day before `date` (both `YYYY-MM-DD`); 12 at most, as the server counts. */
export function weeksBefore(start: string, date: string): number {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
  return Number.isFinite(days) ? Math.min(DEFAULT_WEEKS, Math.floor(days / 7)) : DEFAULT_WEEKS;
}
