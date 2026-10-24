import type { Goal, DailyTask, RoadmapWeek, AchievementSummary, FinalTestEvaluation } from '../types';
import { isRestLike } from './today';
import { isLightTest } from './lightTest';
import { formatTarget } from './formatters';

/**
 * Derives verified, real achievement summary metrics from stored goal records.
 * Follows strict future honesty (BP §43) and OD-2 90-day architecture.
 */
export function computeAchievementSummary(goal: Goal): AchievementSummary {
  const tasks: DailyTask[] = goal.dailyTasks || [];
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];

  // OD-2: Total days clamped to 90
  const totalDays = 90;

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
  const totalWeeks = Math.max(12, weeks.length);

  // Benchmarks from roadmapWeeks. M1.5b: a jumped week had no test to run, so it is no benchmark.
  // M2.1 (WU-43 (2)): a light week's test is done plus a note, not a benchmark against the target.
  const weeksWithTests = weeks.filter((w) => !w.jumped && !isLightTest(w.test) && (w.test != null || w.testResult != null));
  const benchmarksAchieved = weeks.filter((w) => !isLightTest(w.test) && w.testResult?.passed === true).length;
  const totalBenchmarks = weeksWithTests.length;

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
    benchmarksAchieved,
    totalBenchmarks,
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

/**
 * Extracts final capstone test evaluation from Week 12 or stored roadmap.
 */
export function extractFinalTestEvaluation(goal: Goal): FinalTestEvaluation | null {
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const week12 = weeks.find((w) => w.weekNumber === 12) || weeks[weeks.length - 1];

  const roadmapFinalTest = goal.roadmap?.finalTest;

  if (!week12?.test && !roadmapFinalTest && !week12?.testResult) {
    return null;
  }

  const testType = week12?.test?.type || 'Capstone Benchmark Verification';
  // B-84: formatTarget names the direction ("52 minutes or less" for a time).
  const targetDeliverable = week12?.target
    ? formatTarget(week12.target)
    : typeof roadmapFinalTest === 'string'
      ? roadmapFinalTest
      : undefined;

  const instructions =
    week12?.test?.instructions ||
    (typeof roadmapFinalTest === 'string'
      ? roadmapFinalTest
      : 'Complete your final capstone verification test under standard conditions.');

  const passCriteria =
    week12?.test?.passIf ||
    (week12?.target
      ? week12.target.kind === 'number'
        ? `Target: ${week12.target.direction === 'lower_is_better' ? '≤' : '≥'} ${week12.target.value} ${week12.target.unit}`
        : week12.target.description
      : undefined);

  return {
    testType,
    targetDeliverable,
    instructions,
    passCriteria,
    result: week12?.testResult || null,
  };
}
