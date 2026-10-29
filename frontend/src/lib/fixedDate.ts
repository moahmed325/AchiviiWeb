import type { Goal } from '../types';
import { addDaysToDateKey, daysBetweenDateKeys } from './dateUtils';
import { todayKey } from './today';
import { planEndLabel, utcDateLabel } from './weekClose';
import { MIN_WEEKS, planWeeks, weeksBefore } from './planLength';

/**
 * B-106: an optional fixed date (an exam, a race, a talk) the goal must be ready by; the server never moves the plan's
 * end past it after a gap or a break. B-109: a date under 12 weeks away gives a shorter plan (the whole weeks before it,
 * 4 to 11), with the final test the week before the date; under 4 weeks away there is no plan for it.
 */

export const FIXED_DATE_LABEL = 'Is there a fixed date this has to be ready by?';
export const FIXED_DATE_HINT = 'An exam, a race, a talk. Leave it empty if not.';
export const FIXED_DATE_FITS = "Your plan ends by this date and won't move past it.";
export const FIXED_DATE_INVALID = 'Choose a date after today, or leave it empty.';
export const FIXED_DATE_TOO_CLOSE = `Your date is too close for a full plan. Choose a date at least ${MIN_WEEKS} weeks away, or leave it empty.`;

/** B-109: the line under a date under 12 weeks away, for a plan of `weeks` weeks. */
export function fixedDateShortText(weeks: number): string {
  return `Your plan will be ${weeks} weeks, with the final test in week ${weeks - 1}, the week before your date.`;
}

export type FixedDateCheck = 'empty' | 'invalid' | 'too_close' | 'short' | 'fits';

/**
 * The typed date against the plan starting `today` (local `YYYY-MM-DD`), as the server counts it (`planLengthFor`):
 * empty; not a real date or not after today (`invalid`); fewer than 4 whole weeks before it (`too_close`); fewer than
 * 12 (`short`: a shorter plan); or 12 or more (`fits`).
 */
export function checkFixedDate(value: string, today: string): FixedDateCheck {
  if (!value) return 'empty';
  if (!isRealDate(value) || value <= today) return 'invalid';
  const weeks = weeksBefore(today, value);
  if (weeks < MIN_WEEKS) return 'too_close';
  return weeks < 12 ? 'short' : 'fits';
}

/** A check that stops the plan being made. */
export function fixedDateBlocks(check: FixedDateCheck): boolean {
  return check === 'invalid' || check === 'too_close';
}

/** `YYYY-MM-DD` naming a real day: Date.parse rolls '2026-02-30' over to March 2, so it must read back the same. */
function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/** The goal's stored fixed date as `YYYY-MM-DD` (the field's value), or '' for none. */
export function fixedDateKey(goal: Pick<Goal, 'fixedDate'>): string {
  return typeof goal.fixedDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(goal.fixedDate) ? goal.fixedDate.slice(0, 10) : '';
}

/** The line under the field: the hint, or what the date means for the plan (a short plan's weeks from `value` and `today`). */
export function fixedDateHint(check: FixedDateCheck, value = '', today = ''): string {
  if (check === 'fits') return FIXED_DATE_FITS;
  if (check === 'short') return fixedDateShortText(weeksBefore(today, value));
  return FIXED_DATE_HINT;
}

/** The error under the field, or undefined. */
export function fixedDateError(check: FixedDateCheck): string | undefined {
  if (check === 'invalid') return FIXED_DATE_INVALID;
  if (check === 'too_close') return FIXED_DATE_TOO_CLOSE;
  return undefined;
}

/**
 * B-109: a shorter plan's last days, after its last week and before the date (Mo, choice d): "Your date is in 3 days.
 * Rest, and trust the work." Null on a 12-week plan, with no date, before the last week ends or once the date is here.
 */
export function lastDaysLine(goal: Pick<Goal, 'fixedDate' | 'startDate'> & Partial<Pick<Goal, 'totalWeeks'>>, now: Date = new Date(), timezone?: string): string | null {
  const key = fixedDateKey(goal);
  const weeks = planWeeks(goal);
  if (!key || weeks === 12 || !goal.startDate) return null;
  const today = todayKey(now, timezone);
  const lastDay = addDaysToDateKey(goal.startDate.slice(0, 10), weeks * 7 - 1);
  const daysLeft = daysBetweenDateKeys(today, key);
  if (today <= lastDay || daysLeft <= 0) return null;
  return daysLeft === 1 ? 'Your date is tomorrow. Rest, and trust the work.' : `Your date is in ${daysLeft} days. Rest, and trust the work.`;
}

/**
 * Today's line for a goal with a fixed date: the date and the plan's end (`utcDateLabel`). Null with no date, an
 * unreadable one, or once the date has passed in the person's time zone: the server no longer holds the plan to it.
 */
export function fixedDateLine(
  goal: Pick<Goal, 'targetDate' | 'fixedDate'>,
  now: Date = new Date(),
  timezone?: string,
  locale?: string
): string | null {
  const key = fixedDateKey(goal);
  const end = planEndLabel(goal, now, locale);
  if (!key || !end || key < todayKey(now, timezone)) return null;
  const fixed = new Date(`${key}T00:00:00Z`);
  const date = utcDateLabel(fixed, now, locale);
  const after = new Date(goal.targetDate).getTime() - 86_400_000 > fixed.getTime();
  return after ? `Your date: ${date}. Your plan ends on ${end}, after it, and won't move any later.` : `Your date: ${date}. Your plan ends on ${end}.`;
}
