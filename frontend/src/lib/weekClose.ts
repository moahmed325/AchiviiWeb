import type { Goal } from '../types';
import { currentWeekTasks, todayKey } from './today';

// Weekly update M1.2b: helpers for what the app shows around an automatic week close.

/**
 * The line once (WU-28): the most recently closed week, when it closed automatically and its line wasn't dismissed,
 * with that week's review insight ("Next week is ready. Your targets stay as planned." until P3). Null otherwise.
 */
export function closeLineWeek(goal: Goal): { weekNumber: number; line: string } | null {
  const closed = (goal.roadmapWeeks ?? []).filter((w) => w.status === 'completed');
  const last = closed.reduce<(typeof closed)[number] | null>((a, b) => (!a || b.weekNumber > a.weekNumber ? b : a), null);
  if (!last || last.closedBy !== 'auto' || last.closeLineSeenAt) return null;
  const line = goal.weeklyReviews?.find((r) => r.weekNumber === last.weekNumber)?.aiAdaptationInsight?.trim();
  return line ? { weekNumber: last.weekNumber, line } : null;
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
