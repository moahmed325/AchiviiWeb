import React, { useMemo } from 'react';
import type { Goal, AchievementSummary } from '../../types';
import { computeTotalPracticeMinutes, formatPracticeDuration } from '../../lib/achievement';
import { cx } from '../ui';
import { planLengthLabel } from '../../lib/planLength';

interface AchievementResultsProps {
  goal: Goal;
  summary: AchievementSummary;
  className?: string;
}

/**
 * Real Results Breakdown Engine & View (M9.3-R4).
 * Displays un-faked practice completion numbers, execution adherence and the weeks finished. No weekly tests
 * (2026-10-30): no benchmarks and no final test.
 */
export const AchievementResults: React.FC<AchievementResultsProps> = ({
  goal,
  summary,
  className,
}) => {
  const totalPracticeMinutes = useMemo(() => computeTotalPracticeMinutes(goal), [goal]);
  const formattedPracticeTime = useMemo(
    () => formatPracticeDuration(totalPracticeMinutes),
    [totalPracticeMinutes]
  );

  return (
    <div className={cx('flex flex-col gap-8 text-left', className)}>
      {/* 1. Large Typographic Metrics Grid */}
      <section aria-labelledby="metrics-summary-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="metrics-summary-heading" className="text-h2 font-semibold text-text">
            Verified Execution Metrics
          </h2>
          <p className="mt-1 text-body text-text-secondary">
            Every session counted from your practice.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Adherence Card */}
          <div className="rounded-card border border-border-strong bg-surface/90 p-5 shadow-sm">
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              Execution Adherence
            </span>
            <p className="mt-2 font-ui-mono text-numeral font-bold tabular-nums text-achievement">
              {summary.adherenceRate}%
            </p>
            <p className="mt-1 text-small text-text-secondary">
              {summary.adherenceRate >= 80
                ? `Strong consistency honoring the ${planLengthLabel(goal)} protocol.`
                : 'Steady progress honoring deliberate practice.'}
            </p>
          </div>

          {/* Sessions Card */}
          <div className="rounded-card border border-border-strong bg-surface/90 p-5 shadow-sm">
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              Practice Sessions
            </span>
            <p className="mt-2 font-ui-mono text-numeral font-bold tabular-nums text-text">
              {summary.completedSessions}
            </p>
            <p className="mt-1 text-small text-text-secondary">
              {summary.totalPlannedSessions > 0
                ? `Completed out of ${summary.totalPlannedSessions} planned sessions.`
                : 'Completed practice sessions.'}
            </p>
          </div>

          {/* Practice Time Card */}
          <div className="rounded-card border border-border-strong bg-surface/90 p-5 shadow-sm">
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              Total Practice Time
            </span>
            <p className="mt-2 font-ui-mono text-h1 font-bold tabular-nums text-text">
              {formattedPracticeTime}
            </p>
            <p className="mt-1 text-small text-text-secondary">
              Invested in deep focused practice sessions.
            </p>
          </div>

          {/* Weeks Card */}
          <div className="rounded-card border border-border-strong bg-surface/90 p-5 shadow-sm">
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              Weeks Finished
            </span>
            <p className="mt-2 font-ui-mono text-numeral font-bold tabular-nums text-accent-hover">
              {summary.completedWeeks}
              <span className="text-h2 font-normal text-text-muted">/{summary.totalWeeks}</span>
            </p>
            <p className="mt-1 text-small text-text-secondary">
              Each one planned from what you did the week before.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
};
