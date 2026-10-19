import type { Goal } from '../types';
import { currentWeekTasks, todayKey } from './today';

// Weekly update M1.2b: helpers for what the app shows around an automatic week close.

/** M1.4 (WU-33 (4)): the stored line "Your plan now ends on {date}." keeps this as written; the app fills it in. */
export const PLAN_END_TOKEN = '{date}';

/**
 * The plan's end as it is now: day 90, `targetDate` minus one day, read as a UTC date (it is stored at UTC midnight).
 * In the viewer's locale like the app's other dates, with the year only when it isn't this year (both years read in
 * UTC). Null when unreadable.
 * `locale` is for tests; the app passes none (the viewer's own).
 */
export function planEndLabel(goal: Pick<Goal, 'targetDate'>, now: Date, locale?: string): string | null {
  const target = new Date(goal.targetDate);
  if (Number.isNaN(target.getTime())) return null;
  const end = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate() - 1));
  const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'UTC' };
  // Review fix 5: both years on one clock (UTC), as the end date is read.
  if (end.getUTCFullYear() !== now.getUTCFullYear()) options.year = 'numeric';
  return end.toLocaleDateString(locale, options);
}

/** A stored insight with `{date}` filled in (`planEndLabel`); unchanged when it has none. */
export function fillPlanEnd(line: string, goal: Pick<Goal, 'targetDate'>, now: Date = new Date(), locale?: string): string {
  if (!line.includes(PLAN_END_TOKEN)) return line;
  const label = planEndLabel(goal, now, locale);
  // An unreadable end date never shows the placeholder: the sentence that holds it is left out.
  return label ? line.split(PLAN_END_TOKEN).join(label) : line.replace(/\s*[^.]*\{date\}[^.]*\./, '').trim();
}

/**
 * The line once (WU-28): the most recently closed week, when it closed automatically and its line wasn't dismissed,
 * with that week's review insight ("Next week is ready. Your targets stay as planned." until P3, M1.4's moved-plan
 * line, M1.5a's welcome-back line after a break, or M1.5b's line after a choice past the limit, with its `{date}`
 * filled in). Jumped weeks are passed over. Null otherwise.
 */
export function closeLineWeek(goal: Goal, now: Date = new Date()): { weekNumber: number; line: string } | null {
  // M1.5b (WU-40): a jumped week has no line; the line after a jump is on the week that closed before it.
  const closed = (goal.roadmapWeeks ?? []).filter((w) => w.status === 'completed' && !w.jumped);
  const last = closed.reduce<(typeof closed)[number] | null>((a, b) => (!a || b.weekNumber > a.weekNumber ? b : a), null);
  if (!last || last.closedBy !== 'auto' || last.closeLineSeenAt) return null;
  const line = goal.weeklyReviews?.find((r) => r.weekNumber === last.weekNumber)?.aiAdaptationInsight?.trim();
  return line ? { weekNumber: last.weekNumber, line: fillPlanEnd(line, goal, now) } : null;
}

/**
 * Review fix 4: whether the open week's last stored day is before today in the person's time zone, as
 * `isWeekReviewDue` reads it. Only then can a close be due, so a plan reload asks the server only then.
 */
export function openWeekEnded(goal: Pick<Goal, 'currentWeek' | 'dailyTasks'> | null, now: Date, timezone?: string): boolean {
  const tasks = goal ? currentWeekTasks(goal) : [];
  if (tasks.length === 0) return false;
  const today = todayKey(now, timezone);
  return tasks.every((t) => t.date < today);
}
