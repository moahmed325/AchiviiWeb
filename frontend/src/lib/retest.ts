import type { DailyTask, Goal, RoadmapWeek } from '../types';
import { currentWeekTasks, parseSteps, todayKey } from './today';

/**
 * Weekly update M3.3b (RULE-5, RULE-6, AC-4, WU-58): the open week's re-test on Today. The server works out the re-test
 * (`goal.retest`); this only finds its day and decides what Today shows.
 */

/** The copy table's lines (02-feature section 6, "Test not logged" and "Two hard weeks"). */
export const RETEST_LINES = {
  not_logged: "Last week's test wasn't logged, so we're holding your target. This week starts with a quick re-test so we can adjust.",
  two_hard_weeks: 'The last two weeks were hard to fit in. This week starts with a re-test to find your real level.',
} as const;

/** The easy re-test (WU-55) stores nothing on the earlier week, so it never counts as the re-test day. */
const EASY_RETEST_TITLE = 'Re-test: an easy version';

const isMeasuredRetest = (title: unknown) => typeof title === 'string' && title.startsWith('Re-test: ') && title !== EASY_RETEST_TITLE;

/** The open week's first day whose steps include the measured re-test, or null. */
export function retestDay(goal: Pick<Goal, 'currentWeek' | 'dailyTasks'>): DailyTask | null {
  return currentWeekTasks(goal).find((task) => parseSteps(task.detailedSteps).some((step) => isMeasuredRetest(step.title))) ?? null;
}

type RetestGoal = Pick<Goal, 'retest' | 'currentWeek' | 'dailyTasks' | 'roadmapWeeks'>;

/** AC-4: the line, only on the re-test day and only while the re-test is not logged. */
export function retestLine(goal: RetestGoal, now: Date, timezone?: string): string | null {
  const retest = goal.retest;
  if (!retest || retest.logged) return null;
  const day = retestDay(goal);
  return day && day.date === todayKey(now, timezone) ? RETEST_LINES[retest.reason] : null;
}

/**
 * WU-17: the re-tested week, from the re-test day to the end of the open week while the re-test is not logged; null
 * otherwise. A light week can't be re-tested (WU-56 (3)); if one is named anyway, nothing is offered.
 */
export function retestEntryWeek(goal: RetestGoal, now: Date, timezone?: string): RoadmapWeek | null {
  const retest = goal.retest;
  if (!retest || retest.logged) return null;
  const day = retestDay(goal);
  const today = todayKey(now, timezone);
  const tasks = currentWeekTasks(goal);
  const last = tasks[tasks.length - 1];
  if (!day || today < day.date || !last || today > last.date) return null;
  const week = goal.roadmapWeeks?.find((w) => w.weekNumber === retest.ofWeek);
  return week?.test && week.test.light !== true ? week : null;
}
