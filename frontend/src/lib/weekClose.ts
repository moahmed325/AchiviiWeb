import type { Goal } from '../types';

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
