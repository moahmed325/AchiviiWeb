import type { Goal, DailyTask, RoadmapWeek, AchievementSummary } from '../types';
import { isRestLike } from './today';
import { planDays, planWeeks } from './planLength';

/**
 * Derives verified, real achievement summary metrics from stored goal records.
 * Follows strict future honesty (BP §43) and OD-2 90-day architecture.
 */
export function computeAchievementSummary(goal: Goal): AchievementSummary {
  const tasks: DailyTask[] = goal.dailyTasks || [];
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];

  // OD-2: Total days clamped to 90 (B-109: a shorter plan's own days).
  const totalDays = planDays(goal);

  // Active practice = non-rest days
  const activeTasks = tasks.filter((t) => !isRestLike(t));
  const completedSessions = activeTasks.filter((t) => t.status === 'completed').length;
  const totalPlannedSessions = activeTasks.length;

  // Adherence percentage bounded between 0% and 100%
  const adherenceRate =
    totalPlannedSessions > 0
      ? Math.min(100, Math.max(0, Math.round((completedSessions / totalPlannedSessions) * 100)))
      : 0;

  // Completed weeks count. Weekly update M1.5b (WU-40 (1)): a jumped week is never a week done.
  const completedWeeks = weeks.filter((w) => w.status === 'completed' && !w.jumped).length;
  const totalWeeks = Math.max(planWeeks(goal), weeks.length);

  const completedAt = goal.completedAt || goal.updated_at || new Date().toISOString();

  return {
    goalId: goal.id,
    rawGoal: goal.rawGoal,
    clarifiedOutcome: goal.clarifiedOutcome || null,
    totalDays,
    completedSessions,
    totalPlannedSessions,
    adherenceRate,
    completedWeeks,
    totalWeeks,
    completedAt,
  };
}

/**
 * Total practice time in minutes derived from completed non-rest tasks.
 */
export function computeTotalPracticeMinutes(goal: Goal): number {
  const tasks: DailyTask[] = goal.dailyTasks || [];
  return tasks
    .filter((t) => !t.isRestDay && t.status === 'completed')
    .reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
}

/**
 * Formats duration in minutes into clean, human-readable string.
 */
export function formatPracticeDuration(minutes: number): string {
  if (minutes === 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  return `${hours} hr${hours !== 1 ? 's' : ''} ${remaining} min`;
}

/**
 * Formats ISO date into human-readable completion date.
 */
export function formatAchievementDate(isoString?: string | null): string {
  if (!isoString) return 'Completed';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return 'Completed';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return 'Completed';
  }
}
