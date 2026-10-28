import type { Goal } from '../types';
import { addDaysToDateKey } from './dateUtils';
import { planEndLabel } from './weekClose';

/**
 * B-106: an optional fixed date (an exam, a race, a talk) the goal must be ready by. The plan stays 90 days; the server
 * never moves its end (day 90) past the date after a gap or a break.
 */

export const FIXED_DATE_LABEL = 'Is there a fixed date this has to be ready by?';
export const FIXED_DATE_HINT = 'An exam, a race, a talk. Leave it empty if not.';
export const FIXED_DATE_FITS = "Your plan ends by this date and won't move past it.";
export const FIXED_DATE_SHORT = "Your plan is 90 days, so it ends after your date. It won't move any later.";
export const FIXED_DATE_INVALID = 'Choose a date after today, or leave it empty.';

export type FixedDateCheck = 'empty' | 'invalid' | 'short' | 'fits';

/**
 * The typed date against the plan starting `today` (local `YYYY-MM-DD`): empty, not a real date or not after today
 * (`invalid`), before day 90 (`short`), or on or after it (`fits`).
 */
export function checkFixedDate(value: string, today: string): FixedDateCheck {
  if (!value) return 'empty';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || value <= today) return 'invalid';
  return value < addDaysToDateKey(today, 89) ? 'short' : 'fits';
}

/** The line under the field: the hint, what the date means for the plan, or the error. */
export function fixedDateHint(check: FixedDateCheck): string {
  if (check === 'fits') return FIXED_DATE_FITS;
  if (check === 'short') return FIXED_DATE_SHORT;
  return FIXED_DATE_HINT;
}

/**
 * Today's line for a goal with a fixed date: the date and the plan's end, read like `planEndLabel` (UTC dates, the
 * year only when it isn't this year). Null with no date or an unreadable one.
 */
export function fixedDateLine(goal: Pick<Goal, 'targetDate' | 'fixedDate'>, now: Date = new Date(), locale?: string): string | null {
  if (!goal.fixedDate) return null;
  const fixed = new Date(goal.fixedDate);
  const end = planEndLabel(goal, now, locale);
  if (Number.isNaN(fixed.getTime()) || !end) return null;
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'UTC' };
  if (fixed.getUTCFullYear() !== now.getUTCFullYear()) options.year = 'numeric';
  const date = fixed.toLocaleDateString(locale, options);
  const after = new Date(goal.targetDate).getTime() - 86_400_000 > fixed.getTime();
  return after ? `Your date: ${date}. Your plan ends on ${end}, after it, and won't move any later.` : `Your date: ${date}. Your plan ends on ${end}.`;
}
