import React, { useMemo } from 'react';
import { Check, Clock, Award, Minus } from 'lucide-react';
import type { Goal, RoadmapWeek, WeekTarget, WeekTest, AchievementSummary } from '../../types';
import type { WeeklyTestResult } from '../../types/review';
import {
  computeTotalPracticeMinutes,
  formatPracticeDuration,
  extractFinalTestEvaluation,
} from '../../lib/achievement';
import { cx } from '../ui';

interface AchievementResultsProps {
  goal: Goal;
  summary: AchievementSummary;
  className?: string;
}

interface BenchmarkItem {
  weekNumber: number;
  phase: string;
  theme: string;
  test: WeekTest | null;
  target: WeekTarget | null;
  testResult: WeeklyTestResult | null;
}

function formatTarget(target: WeekTarget | null | undefined): string | null {
  if (!target) return null;
  if (target.kind === 'number') {
    return `${target.metric}: ${target.value} ${target.unit}`;
  }
  return target.description;
}

function formatResultValue(result: WeeklyTestResult): string {
  const val = String(result.value);
  return result.unit ? `${val} ${result.unit}` : val;
}

/**
 * Real Results Breakdown Engine & View (M9.3-R4).
 * Displays un-faked practice completion numbers, execution adherence,
 * stored benchmark test results, and final capstone verification.
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
  const finalTestEval = useMemo(() => extractFinalTestEvaluation(goal), [goal]);

  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const benchmarkItems: BenchmarkItem[] = useMemo(() => {
    return weeks
      .filter((w) => w.test != null || w.testResult != null)
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .map((w) => ({
        weekNumber: w.weekNumber,
        phase: w.phase || `Week ${w.weekNumber}`,
        theme: w.theme || 'Milestone Verification',
        test: w.test || null,
        target: w.target || null,
        testResult: w.testResult || null,
      }));
  }, [weeks]);

  return (
    <div className={cx('flex flex-col gap-8 text-left', className)}>
      {/* 1. Large Typographic Metrics Grid */}
      <section aria-labelledby="metrics-summary-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="metrics-summary-heading" className="text-h2 font-semibold text-text">
            Verified Execution Metrics
          </h2>
          <p className="mt-1 text-body text-text-secondary">
            Every session and benchmark verified from your ninety days of deliberate practice.
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
                ? 'Strong consistency honoring the 90-day protocol.'
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

          {/* Benchmarks Card */}
          <div className="rounded-card border border-border-strong bg-surface/90 p-5 shadow-sm">
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-secondary">
              Milestone Gates
            </span>
            <p className="mt-2 font-ui-mono text-numeral font-bold tabular-nums text-accent-hover">
              {summary.benchmarksAchieved}
              <span className="text-h2 font-normal text-text-muted">/{summary.totalBenchmarks}</span>
            </p>
            <p className="mt-1 text-small text-text-secondary">
              Official weekly test benchmarks achieved.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Final Capstone Benchmark Evaluation */}
      {finalTestEval && (
        <section
          aria-labelledby="capstone-evaluation-heading"
          className="rounded-card border border-achievement/40 bg-surface/90 p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Award className="size-5 text-achievement" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-widest text-achievement">
              Phase 3 Capstone Verification
            </span>
          </div>

          <h3 id="capstone-evaluation-heading" className="mt-2 text-h3 font-medium text-text">
            {finalTestEval.testType}
          </h3>

          <p className="mt-2 text-body text-text-secondary">
            {finalTestEval.instructions}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {finalTestEval.targetDeliverable && (
              <div className="rounded-control border border-border bg-surface-elevated/70 p-3">
                <span className="font-ui-mono text-micro text-text-secondary">Target Deliverable</span>
                <p className="mt-0.5 text-small font-medium text-text">
                  {finalTestEval.targetDeliverable}
                </p>
              </div>
            )}
            {finalTestEval.passCriteria && (
              <div className="rounded-control border border-border bg-surface-elevated/70 p-3">
                <span className="font-ui-mono text-micro text-text-secondary">Pass Criteria</span>
                <p className="mt-0.5 text-small font-medium text-text">
                  {finalTestEval.passCriteria}
                </p>
              </div>
            )}
          </div>

          {/* Final Test Result Badge */}
          {finalTestEval.result && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <span className="text-small font-medium text-text">Outcome:</span>
              <span
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-ui-mono text-micro font-medium',
                  finalTestEval.result.passed
                    ? 'bg-accent/15 text-accent-hover ring-1 ring-accent/30'
                    : 'bg-caution/15 text-caution ring-1 ring-caution/30'
                )}
              >
                {finalTestEval.result.passed ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Clock className="size-3.5" aria-hidden="true" />
                )}
                {finalTestEval.result.passed ? 'Benchmark Achieved' : 'In Progress'} —{' '}
                {formatResultValue(finalTestEval.result)}
              </span>
              {finalTestEval.result.note && (
                <span className="text-small text-text-secondary italic">
                  "{finalTestEval.result.note}"
                </span>
              )}
            </div>
          )}
        </section>
      )}

      {/* 3. Stored Benchmark Tests Progression List */}
      <section aria-labelledby="benchmarks-list-heading" className="flex flex-col gap-4">
        <div>
          <h3 id="benchmarks-list-heading" className="text-h3 font-semibold text-text">
            Milestone Benchmark Log
          </h3>
          <p className="mt-1 text-body text-text-secondary">
            Results stored during your weekly reviews across the 12 planned weeks.
          </p>
        </div>

        {benchmarkItems.length === 0 ? (
          <div className="rounded-card border border-border bg-surface/50 p-6 text-center text-text-secondary">
            No milestone benchmark tests were scheduled for this goal.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {benchmarkItems.map((item) => {
              const targetStr = formatTarget(item.target);
              const hasResult = item.testResult != null;
              const isPassed = item.testResult?.passed === true;

              return (
                <article
                  key={item.weekNumber}
                  className="rounded-card border border-border bg-surface/80 p-4 transition-colors hover:border-border-strong sm:p-5"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-ui-mono text-micro uppercase text-text-secondary">
                          Week {item.weekNumber}
                        </span>
                        <span className="text-text-muted">·</span>
                        <span className="text-micro font-medium text-text-secondary">
                          {item.phase}
                        </span>
                      </div>
                      <h4 className="mt-1 text-body font-medium text-text">
                        {item.test?.type || item.theme}
                      </h4>
                      {item.test?.instructions && (
                        <p className="mt-1 max-w-xl text-small text-text-secondary">
                          {item.test.instructions}
                        </p>
                      )}
                    </div>

                    {/* Result pill */}
                    <div className="mt-2 shrink-0 sm:mt-0">
                      {hasResult ? (
                        <span
                          className={cx(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-ui-mono text-micro font-medium',
                            isPassed
                              ? 'bg-accent/15 text-accent-hover ring-1 ring-accent/30'
                              : 'bg-caution/15 text-caution ring-1 ring-caution/30'
                          )}
                        >
                          {isPassed ? (
                            <Check className="size-3" aria-hidden="true" />
                          ) : (
                            <Minus className="size-3" aria-hidden="true" />
                          )}
                          {isPassed ? 'Benchmark achieved' : 'In progress · Reinforcing'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 font-ui-mono text-micro text-text-secondary">
                          No test recorded
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Benchmark target and recorded value */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-small">
                    {targetStr && (
                      <div>
                        <span className="text-text-secondary">Target: </span>
                        <span className="font-medium text-text">{targetStr}</span>
                      </div>
                    )}
                    {item.testResult && (
                      <div>
                        <span className="text-text-secondary">Recorded: </span>
                        <span className="font-ui-mono font-medium text-text">
                          {formatResultValue(item.testResult)}
                        </span>
                      </div>
                    )}
                    {item.testResult?.note && (
                      <div className="text-text-secondary italic">
                        "{item.testResult.note}"
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
