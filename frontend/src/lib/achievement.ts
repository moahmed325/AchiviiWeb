import type { Goal, DailyTask, RoadmapWeek, AchievementSummary, FinalTestEvaluation } from '../types';

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
  const activeTasks = tasks.filter((t) => !t.isRestDay);
  const completedSessions = activeTasks.filter((t) => t.status === 'completed').length;
  const totalPlannedSessions = activeTasks.length;

  // Adherence percentage bounded between 0% and 100%
  const adherenceRate =
    totalPlannedSessions > 0
      ? Math.min(100, Math.max(0, Math.round((completedSessions / totalPlannedSessions) * 100)))
      : 0;

  // Completed weeks count
  const completedWeeks = weeks.filter((w) => w.status === 'completed').length;
  const totalWeeks = Math.max(12, weeks.length);

  // Benchmarks from roadmapWeeks
  const weeksWithTests = weeks.filter((w) => w.test != null || w.testResult != null);
  const benchmarksAchieved = weeks.filter((w) => w.testResult?.passed === true).length;
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
  const targetDeliverable = week12?.target
    ? week12.target.kind === 'number'
      ? `${week12.target.metric}: ${week12.target.value} ${week12.target.unit}`
      : week12.target.description
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
        ? `Target: ≥ ${week12.target.value} ${week12.target.unit}`
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
