import React from 'react';
import { Flame } from 'lucide-react';
import { cx } from '../ui/cx';
import type { WeekTarget, WeekTest } from '../../types';
import { formatTarget, formatPassIf } from '../../lib/formatters';

export interface ReviewSummaryCardProps {
  scorePercentage: number;
  completedSessions: number;
  totalActiveSessions: number;
  theme?: string;
  target?: WeekTarget | null;
  test?: WeekTest | null;
}

/**
 * Analytical yet warm visual card for "How did this week go?" (BP §17–18, §33, VDS §26).
 * Displays honest practice metrics with tabular numerals, non-punitive guidance,
 * and a glance of the week's target deliverable and benchmark test.
 */
export const ReviewSummaryCard: React.FC<ReviewSummaryCardProps> = ({
  scorePercentage,
  completedSessions,
  totalActiveSessions,
  theme,
  target,
  test,
}) => {
  const isHighCompletion = scorePercentage >= 80;

  return (
    <div className="rounded-card border border-border bg-surface p-5 text-center sm:p-6">
      <div className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
        This week
      </div>

      <div
        className={cx(
          'mt-1 font-mono text-numeral tabular-nums',
          isHighCompletion ? 'text-accent' : 'text-caution'
        )}
      >
        {scorePercentage}%
      </div>

      <div className="mt-1 text-small text-text-secondary">
        {completedSessions} of {totalActiveSessions} practice session{totalActiveSessions === 1 ? '' : 's'} completed
      </div>

      <div className="mt-3 text-small">
        {isHighCompletion ? (
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

      {(Boolean(theme) || Boolean(target) || Boolean(test)) && (
        <div className="mt-5 border-t border-border pt-4 text-left space-y-2.5">
          {theme && (
            <div className="flex items-start justify-between gap-3 text-small">
              <span className="text-text-secondary shrink-0">Focus</span>
              <span className="font-medium text-text text-right">{theme}</span>
            </div>
          )}
          {target && (
            <div className="flex items-start justify-between gap-3 text-small">
              <span className="text-text-secondary shrink-0">Target</span>
              <span className="font-medium text-text text-right">{formatTarget(target)}</span>
            </div>
          )}
          {test && (
            <div className="flex items-start justify-between gap-3 text-small">
              <span className="text-text-secondary shrink-0">Weekly test</span>
              <span className="font-medium text-text text-right">
                {test.instructions || formatPassIf(test.passIf) || test.type}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewSummaryCard;
