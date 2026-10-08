import type { Goal, Reconciliation, RoadmapWeek } from '../types';
import { currentWeekTasks, todayKey } from './today';

/**
 * Missed sessions M4.1 (RULE-7, UX-3, AC-8): the current week when its test is still open after test day, else null.
 * Shown from the test day's close until the week is completed by its review:
 * - plan v2 only: any other goal gets null (ND-21);
 * - the week has a test, no stored `testResult`, and is not completed;
 * - the test day has closed: reconcile classifies it `missed` or `done`, or, when reconcile has nothing for this
 *   goal, its date is before today in the user's timezone.
 */
export function lateTestWeek(
  goal: Pick<Goal, 'id' | 'planVersion' | 'currentWeek' | 'roadmapWeeks' | 'dailyTasks'>,
  reconciliation: Reconciliation | null,
  now: Date,
  timezone?: string
): RoadmapWeek | null {
  if (goal.planVersion !== 2) return null;
  const week = (goal.roadmapWeeks || []).find((w) => w.weekNumber === (goal.currentWeek || 1));
  if (!week?.test || week.testResult || week.status === 'completed') return null;
  const testDay = currentWeekTasks(goal).find((task) => task.isTestDay);
  if (!testDay) return null;

  const day = reconciliation?.goalId === goal.id ? reconciliation.days.find((d) => d.taskId === testDay.id) : undefined;
  const closed = day ? day.kind === 'missed' || day.kind === 'done' : testDay.date < todayKey(now, timezone);
  return closed ? week : null;
}
