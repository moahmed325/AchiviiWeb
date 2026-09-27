import React from 'react';
import { ArrowRight, Sparkles, Target } from 'lucide-react';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { PhaseGateOutcomeCard } from './PhaseGateOutcomeCard';
import type { DailyTask, WeekTarget, WeeklyTestResult } from '../../types';
import type { MilestoneGateTransition } from '../today/MilestoneGateModal';
import { formatTarget } from '../../lib/formatters';

export interface AdaptationMomentStepProps {
  currentWeekNumber: number;
  nextWeekNumber: number | null;
  aiAdaptationInsight?: string | null;
  nextWeekTasks?: DailyTask[];
  nextWeekTheme?: string | null;
  nextWeekTarget?: WeekTarget | null;
  currentWeekTarget?: WeekTarget | null;
  testResult?: WeeklyTestResult | null;
  milestoneGateTransition?: MilestoneGateTransition | null;
  onContinue: () => void;
}

/**
 * Adaptation Moment Step (Phase 7 — BP §17–19, §33, §43, VDS §19, §26).
 * Visibly demonstrates to the user that next week has been shaped from their actual execution.
 * Strictly adheres to Future Honesty: displays only genuine server insight, benchmark target
 * comparison, and upcoming focus.
 */
export const AdaptationMomentStep: React.FC<AdaptationMomentStepProps> = ({
  currentWeekNumber,
  nextWeekNumber,
  aiAdaptationInsight,
  nextWeekTasks,
  nextWeekTheme,
  nextWeekTarget,
  currentWeekTarget,
  testResult,
  milestoneGateTransition,
  onContinue,
}) => {
  const isClosingStretch = nextWeekNumber === null;
  const plannedSessions = nextWeekTasks ? nextWeekTasks.filter((t) => !t.isRestDay).length : 0;

  return (
    <div className="space-y-5 motion-safe:animate-rise-in text-left">
      {/* Path Rebuilt Indicator */}
      <div className="space-y-1 text-center">
        <div className="font-ui-mono text-micro uppercase tracking-wider text-accent">
          {isClosingStretch ? 'Journey Milestone' : `Week ${currentWeekNumber} Complete`}
        </div>
        <h2 className="text-h3 font-semibold text-text">
          {isClosingStretch ? 'Your closing stretch is ready' : `Week ${nextWeekNumber} has been adapted`}
        </h2>
        <p className="text-small text-text-secondary">
          {isClosingStretch
            ? 'You have completed the 12 planned weeks. Welcome to the Closing Stretch.'
            : "Next week's practice sessions have been generated from your actual pace and reflection."}
        </p>
      </div>

      {/* Phase-Gate Outcome Card (BP §18) */}
      {milestoneGateTransition && (
        <PhaseGateOutcomeCard gate={milestoneGateTransition} />
      )}

      {/* Benchmark Target Comparison (OD-1a, BP §17, §33) */}
      {testResult && (
        <div
          data-testid="adaptation-target-comparison"
          className="rounded-card border border-border bg-surface p-4 text-small space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              <Target aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-accent shrink-0" />
              <span>Benchmark Comparison</span>
            </div>
            <span
              className={cx(
                'text-micro font-semibold uppercase tracking-wider',
                testResult.passed ? 'text-accent' : 'text-caution'
              )}
            >
              {testResult.passed ? 'Target Met' : 'In Progress'}
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 pt-0.5">
            <span className="text-text-secondary shrink-0">Recorded Result</span>
            <span className="font-semibold text-text text-right tabular-nums">
              {testResult.value}
              {testResult.unit ? ` ${testResult.unit}` : ''}
            </span>
          </div>

          {currentWeekTarget && (
            <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-2">
              <span className="text-text-secondary shrink-0">Week Target</span>
              <span className="font-medium text-text text-right tabular-nums">
                {formatTarget(currentWeekTarget)}
              </span>
            </div>
          )}

          {testResult.note && (
            <div className="border-t border-border/50 pt-2 text-micro text-text-secondary italic">
              "{testResult.note}"
            </div>
          )}
        </div>
      )}

      {/* Server Adaptation Insight (BP §33, §43) */}
      {aiAdaptationInsight && (
        <div className="rounded-card border border-border bg-surface p-4 text-small">
          <div className="flex items-center gap-1.5 mb-1.5 font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
            <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3.5 text-accent shrink-0" />
            <span>Adaptation Insight</span>
          </div>
          <p className="text-text font-medium leading-relaxed">
            {aiAdaptationInsight}
          </p>
        </div>
      )}

      {/* Upcoming Week Focus Preview */}
      {!isClosingStretch && (
        <div className="rounded-card border border-border bg-surface p-4 text-small space-y-2.5">
          <div className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
            Upcoming Week
          </div>

          {nextWeekTheme && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-text-secondary shrink-0">Focus</span>
              <span className="font-medium text-text text-right">{nextWeekTheme}</span>
            </div>
          )}

          {nextWeekTarget && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-text-secondary shrink-0">Target</span>
              <span className="font-medium text-text text-right">{formatTarget(nextWeekTarget)}</span>
            </div>
          )}

          {plannedSessions > 0 && (
            <div className="flex items-start justify-between gap-3">
              <span className="text-text-secondary shrink-0">Schedule</span>
              <span className="font-medium text-text text-right">
                {plannedSessions} practice session{plannedSessions === 1 ? '' : 's'} planned
              </span>
            </div>
          )}
        </div>
      )}

      {/* Continue Action */}
      <div className="pt-2">
        <Button
          variant="primary"
          onClick={onContinue}
          className="min-h-[44px] w-full"
          trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
        >
          Continue to Today
        </Button>
      </div>
    </div>
  );
};

export default AdaptationMomentStep;
