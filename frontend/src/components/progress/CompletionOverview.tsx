import React, { useMemo } from 'react';
import type { Goal, DailyTask, RoadmapWeek } from '../../types';
import { cx } from '../ui';

interface CompletionOverviewProps {
  goal: Goal;
  currentDay: number;
  className?: string;
}

interface CompletionMetrics {
  /** Practice sessions completed (non-rest, completed). */
  completedActive: number;
  /** Total non-rest sessions planned across all weeks that have daily tasks. */
  totalPlannedActive: number;
  /** Non-rest sessions planned up to and including the current week. */
  plannedActiveToDate: number;
  /** Execution adherence percentage. */
  adherencePercent: number;
  /** Total practice time in minutes (sum of completed non-rest task durations). */
  totalPracticeMinutes: number;
  /** Current week number. */
  currentWeek: number;
  /** Active phase name. */
  activePhase: string;
}

function deriveMetrics(goal: Goal): CompletionMetrics {
  const tasks: DailyTask[] = goal.dailyTasks || [];
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));

  // Active practice = non-rest days
  const activeTasks = tasks.filter((t) => !t.isRestDay);
  const completedActive = activeTasks.filter((t) => t.status === 'completed').length;
  const totalPlannedActive = activeTasks.length;

  // Planned to date: active tasks for weeks <= currentWeek
  const plannedActiveToDate = activeTasks.filter((t) => t.weekNumber <= currentWeek).length;

  // Adherence: percentage of scheduled practice completed to date
  const adherencePercent =
    plannedActiveToDate > 0 ? Math.round((completedActive / plannedActiveToDate) * 100) : 0;

  // Total practice time from completed non-rest tasks
  const totalPracticeMinutes = activeTasks
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (t.durationMinutes || 0), 0);

  // Find active phase from roadmap weeks
  const currentRoadmapWeek = weeks.find((w) => w.weekNumber === currentWeek);
  const activePhase = currentRoadmapWeek?.phase || 'Foundation';

  return {
    completedActive,
    totalPlannedActive,
    plannedActiveToDate,
    adherencePercent,
    totalPracticeMinutes,
    currentWeek,
    activePhase,
  };
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return '0 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr${hours !== 1 ? 's' : ''}`;
  return `${hours} hr${hours !== 1 ? 's' : ''} ${remaining} min`;
}

/** Metric card: large numeral + label. Visual Level 3 — restrained, typographic. */
const MetricCard: React.FC<{
  value: string;
  label: string;
  sublabel?: string;
  className?: string;
}> = ({ value, label, sublabel, className }) => (
  <div
    className={cx(
      'flex flex-col gap-1.5 rounded-card border border-border bg-surface px-5 py-5 sm:px-6 sm:py-6',
      className,
    )}
  >
    <span className="font-ui-mono text-[clamp(2rem,1rem+4vw,3.5rem)] leading-[0.9] tracking-tight text-text tabular-nums">
      {value}
    </span>
    <span className="text-small text-text-secondary">{label}</span>
    {sublabel && <span className="text-micro text-text-muted">{sublabel}</span>}
  </div>
);

/**
 * M8.2-R3 + M8.4: Core Completion Metrics.
 *
 * Renders high-level completion statistics derived from DailyTask records.
 * Visual Level 3: clean borders, subtle surfaces, large numbers as visual objects,
 * no animated rings or gamified counters (BP §43, VDS §31).
 * Early-state safe: calm orientation when 0 practice sessions are completed.
 */
export const CompletionOverview: React.FC<CompletionOverviewProps> = ({ goal, currentDay, className }) => {
  const metrics = useMemo(() => deriveMetrics(goal), [goal]);

  return (
    <section aria-labelledby="completion-overview-heading" className={cx('space-y-4', className)}>
      <h2 id="completion-overview-heading" className="sr-only">
        Completion overview
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <MetricCard
          value={`${currentDay}`}
          label={`Day ${currentDay} of 90`}
          sublabel={`Week ${metrics.currentWeek} · ${metrics.activePhase}`}
        />
        <MetricCard
          value={`${metrics.completedActive}`}
          label="Practice sessions"
          sublabel={
            metrics.completedActive === 0
              ? `First session awaits · of ${metrics.totalPlannedActive} planned`
              : `of ${metrics.totalPlannedActive} planned`
          }
        />
        <MetricCard
          value={`${metrics.adherencePercent}%`}
          label="Execution adherence"
          sublabel={
            metrics.completedActive === 0
              ? `Starting your journey · 0 of ${metrics.plannedActiveToDate} to date`
              : `${metrics.completedActive} of ${metrics.plannedActiveToDate} to date`
          }
        />
        <MetricCard
          value={formatDuration(metrics.totalPracticeMinutes)}
          label="Total practice time"
        />
      </div>
    </section>
  );
};
