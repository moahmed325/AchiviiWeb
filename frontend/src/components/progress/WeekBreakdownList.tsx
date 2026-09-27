import React, { useMemo } from 'react';
import type { Goal, RoadmapWeek, DailyTask } from '../../types';
import { cx } from '../ui';

interface WeekBreakdownListProps {
  goal: Goal;
  className?: string;
}

interface WeekEntry {
  weekNumber: number;
  theme: string;
  practiceCompleted: number;
  practiceTotal: number;
  executionScore: number | null;
  status: 'completed' | 'active' | 'upcoming';
}

function deriveWeeks(goal: Goal): WeekEntry[] {
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const tasks: DailyTask[] = goal.dailyTasks || [];

  // Build entries for all roadmap weeks (typically 12)
  const totalWeeks = Math.max(12, weeks.length);
  const entries: WeekEntry[] = [];

  for (let wNum = 1; wNum <= totalWeeks; wNum++) {
    const roadmapWeek = weeks.find((w) => w.weekNumber === wNum);
    const weekTasks = tasks.filter((t) => t.weekNumber === wNum);
    const activeTasks = weekTasks.filter((t) => !t.isRestDay);
    const completedCount = activeTasks.filter((t) => t.status === 'completed').length;

    let status: 'completed' | 'active' | 'upcoming';
    if (wNum < currentWeek) {
      status = 'completed';
    } else if (wNum === currentWeek) {
      status = 'active';
    } else {
      status = 'upcoming';
    }

    // Execution score from roadmapWeek if available, else calculate from tasks
    let executionScore: number | null = null;
    if (roadmapWeek?.executionScore != null) {
      executionScore = roadmapWeek.executionScore;
    } else if (status === 'completed' && activeTasks.length > 0) {
      executionScore = Math.round((completedCount / activeTasks.length) * 100);
    } else if (status === 'active' && activeTasks.length > 0) {
      executionScore = Math.round((completedCount / activeTasks.length) * 100);
    }

    entries.push({
      weekNumber: wNum,
      theme: roadmapWeek?.theme || roadmapWeek?.objective || `Week ${wNum}`,
      practiceCompleted: completedCount,
      practiceTotal: activeTasks.length,
      executionScore,
      status,
    });
  }

  return entries;
}

const statusStyles: Record<WeekEntry['status'], string> = {
  completed: 'border-border bg-surface',
  active: 'border-accent/25 bg-surface',
  upcoming: 'border-border/60 bg-surface/60',
};

const statusLabel: Record<WeekEntry['status'], { text: string; className: string }> = {
  completed: { text: 'Done', className: 'text-accent-hover' },
  active: { text: 'Now', className: 'text-accent-hover' },
  upcoming: { text: 'Ahead', className: 'text-text-muted' },
};

/**
 * M8.2-R5: Week-by-Week Completion Breakdown.
 *
 * Chronological list of weeks showing focus theme, active practice completion,
 * and execution score. Clean responsive styling for 1440px, 390px, 360px.
 */
export const WeekBreakdownList: React.FC<WeekBreakdownListProps> = ({ goal, className }) => {
  const weeks = useMemo(() => deriveWeeks(goal), [goal]);

  return (
    <section aria-labelledby="week-breakdown-heading" className={cx('space-y-3', className)}>
      <h2 id="week-breakdown-heading" className="text-h3 text-text">
        Week by week
      </h2>
      <div className="space-y-1.5">
        {weeks.map((week) => (
          <div
            key={week.weekNumber}
            className={cx(
              'flex items-center gap-3 rounded-card border px-4 py-3 sm:px-5 sm:py-3.5 transition-colors duration-(--duration-quick)',
              statusStyles[week.status],
              week.status === 'upcoming' && 'opacity-60',
            )}
          >
            {/* Week number */}
            <span
              className={cx(
                'flex size-8 shrink-0 items-center justify-center rounded-full font-ui-mono text-micro tabular-nums',
                week.status === 'active'
                  ? 'bg-accent/15 text-accent-hover'
                  : week.status === 'completed'
                    ? 'bg-text/[0.06] text-text-secondary'
                    : 'bg-text/[0.04] text-text-muted',
              )}
            >
              {week.weekNumber}
            </span>

            {/* Theme and practice count */}
            <div className="min-w-0 flex-1">
              <p
                className={cx(
                  'truncate text-small font-medium',
                  week.status === 'upcoming' ? 'text-text-muted' : 'text-text',
                )}
              >
                {week.theme}
              </p>
              {week.practiceTotal > 0 && (
                <p className="text-micro text-text-muted">
                  {week.practiceCompleted} of {week.practiceTotal} practice days
                </p>
              )}
            </div>

            {/* Status + execution score */}
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span
                className={cx(
                  'font-ui-mono text-micro uppercase',
                  statusLabel[week.status].className,
                )}
              >
                {statusLabel[week.status].text}
              </span>
              {week.executionScore !== null && week.status !== 'upcoming' && (
                <span className="font-ui-mono text-micro tabular-nums text-text-secondary">
                  {week.executionScore}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
