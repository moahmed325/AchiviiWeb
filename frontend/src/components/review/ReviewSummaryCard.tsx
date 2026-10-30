import React from 'react';
import { Flame } from 'lucide-react';
import { cx } from '../ui/cx';

export interface ReviewSummaryCardProps {
  /** WU-33 (3): null when the week has no practice day left to count (every day not offered): shown as not counted. */
  scorePercentage: number | null;
  completedSessions: number;
  totalActiveSessions: number;
  theme?: string;
}

/**
 * Analytical yet warm visual card for "How did this week go?" (BP §17–18, §33, VDS §26).
 * Displays honest practice metrics with tabular numerals, non-punitive guidance and the week's focus. No weekly tests
 * (2026-10-30): no target or test.
 */
export const ReviewSummaryCard: React.FC<ReviewSummaryCardProps> = ({
  scorePercentage,
  completedSessions,
  totalActiveSessions,
  theme,
}) => {
  const notCounted = scorePercentage === null;
  const isEmptyWeek = completedSessions === 0;
  const isHighCompletion = scorePercentage !== null && scorePercentage >= 80;

  return (
    <div className="rounded-card border border-border bg-surface p-5 text-center sm:p-6">
      <div className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
        This week
      </div>

      <div
        className={cx(
          'mt-1 font-ui-mono text-numeral tabular-nums',
          notCounted || isEmptyWeek
            ? 'text-text-secondary'
            : isHighCompletion
            ? 'text-accent'
            : 'text-caution'
        )}
      >
        {notCounted ? 'Not counted' : `${scorePercentage}%`}
      </div>

      <div className="mt-1 text-small text-text-secondary">
        {notCounted
          ? 'No practice days were offered this week.'
          : `${completedSessions} of ${totalActiveSessions} practice session${totalActiveSessions === 1 ? '' : 's'} completed`}
      </div>

      <div className="mt-3 text-small">
        {notCounted ? null : isEmptyWeek ? (
          <p className="font-medium text-text-secondary">
            This week had no logged practice. Every week is a chance to reset your pace and adapt.
          </p>
        ) : isHighCompletion ? (
          <p className="flex items-center justify-center gap-1.5 font-medium text-accent">
            <Flame aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            <span>Great week! Next week will build on this momentum.</span>
          </p>
        ) : (
          <p className="font-medium text-caution">
            Next week will adapt to help you find your rhythm.
          </p>
        )}
      </div>

      {theme && (
        <div className="mt-5 border-t border-border pt-4 text-left">
          <div className="flex items-start justify-between gap-3 text-small">
            <span className="text-text-secondary shrink-0">Focus</span>
            <span className="font-medium text-text text-right">{theme}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewSummaryCard;
