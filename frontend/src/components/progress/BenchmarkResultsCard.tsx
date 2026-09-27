import React, { useMemo } from 'react';
import { Check, Clock, Minus } from 'lucide-react';
import type { Goal, RoadmapWeek, WeekTarget, WeekTest } from '../../types';
import type { WeeklyTestResult } from '../../types/review';
import { cx } from '../ui';

interface BenchmarkResultsCardProps {
  goal: Goal;
  className?: string;
}

type BenchmarkStatus = 'passed' | 'not_passed' | 'no_result' | 'upcoming';

interface BenchmarkEntry {
  weekNumber: number;
  phase: string;
  theme: string;
  test: WeekTest;
  target: WeekTarget | null;
  testResult: WeeklyTestResult | null;
  status: BenchmarkStatus;
  weekStatus: RoadmapWeek['status'];
}

/** Formats a WeekTarget into a human-readable string. */
function formatTarget(target: WeekTarget | null | undefined): string | null {
  if (!target) return null;
  if (target.kind === 'number') {
    return `${target.metric}: ${target.value} ${target.unit}`;
  }
  return target.description;
}

/** Formats a test result value with its unit. */
function formatResultValue(result: WeeklyTestResult): string {
  const val = String(result.value);
  return result.unit ? `${val} ${result.unit}` : val;
}

function deriveBenchmarks(goal: Goal): BenchmarkEntry[] {
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];

  return weeks
    .filter((w) => w.test != null)
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .map((w) => {
      let status: BenchmarkStatus;
      if (w.testResult) {
        status = w.testResult.passed ? 'passed' : 'not_passed';
      } else if (w.weekNumber < currentWeek || w.status === 'completed' || w.status === 'adapted') {
        status = 'no_result';
      } else {
        status = 'upcoming';
      }

      return {
        weekNumber: w.weekNumber,
        phase: w.phase,
        theme: w.theme,
        test: w.test!,
        target: w.target || null,
        testResult: w.testResult || null,
        status,
        weekStatus: w.status,
      };
    });
}

const StatusBadge: React.FC<{ status: BenchmarkStatus }> = ({ status }) => {
  if (status === 'passed') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.06] px-2.5 py-1 font-ui-mono text-micro uppercase text-accent-hover">
        <Check aria-hidden="true" strokeWidth={2} className="size-3" />
        Benchmark achieved
      </span>
    );
  }
  if (status === 'not_passed') {
    // Non-punitive: calm secondary styling, no red/danger (BP §18)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 font-ui-mono text-micro uppercase text-text-secondary">
        In progress · Reinforcing
      </span>
    );
  }
  if (status === 'no_result') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-ui-mono text-micro uppercase text-text-secondary">
        No result recorded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-ui-mono text-micro uppercase text-text-secondary">
      <Clock aria-hidden="true" strokeWidth={1.5} className="size-3" />
      Upcoming
    </span>
  );
};

/**
 * M8.3-R1: Benchmark Results.
 *
 * Displays honest comparison of stored user test outcomes against weekly
 * benchmark targets. Non-punitive framing for unmet benchmarks (BP §18).
 * Zero fake AI grading or proof judging (BP §43).
 */
export const BenchmarkResultsCard: React.FC<BenchmarkResultsCardProps> = ({ goal, className }) => {
  const benchmarks = useMemo(() => deriveBenchmarks(goal), [goal]);

  // Don't render the section at all if no weeks have benchmark tests
  if (benchmarks.length === 0) return null;

  return (
    <section aria-labelledby="benchmark-results-heading" className={cx('space-y-3', className)}>
      <h2 id="benchmark-results-heading" className="text-h3 text-text">
        Benchmark results
      </h2>
      <div className="space-y-2">
        {benchmarks.map((entry) => {
          const targetStr = formatTarget(entry.target);

          return (
            <div
              key={entry.weekNumber}
              className={cx(
                'rounded-card border bg-surface px-5 py-4 sm:px-6 sm:py-5',
                entry.status === 'passed' ? 'border-accent/20' : 'border-border',
              )}
            >
              {/* Header */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-ui-mono text-micro uppercase text-text-secondary">
                  Week {entry.weekNumber}
                </span>
                <span className="text-small text-text-secondary">
                  {entry.theme}
                </span>
              </div>

              {/* Target criteria */}
              <div className="mt-2 space-y-1">
                {targetStr && (
                  <p className="flex items-start gap-2 text-small text-text-secondary">
                    <Minus aria-hidden="true" strokeWidth={1.5} className="mt-1 size-3 shrink-0 text-text-secondary" />
                    <span>Target: {targetStr}</span>
                  </p>
                )}
                <p className="flex items-start gap-2 text-small text-text-secondary">
                  <Minus aria-hidden="true" strokeWidth={1.5} className="mt-1 size-3 shrink-0 text-text-secondary" />
                  <span>Pass criteria: {entry.test.passIf}</span>
                </p>
              </div>

              {/* Result */}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <StatusBadge status={entry.status} />
                {entry.testResult && (
                  <span className="font-ui-mono text-small tabular-nums text-text">
                    {formatResultValue(entry.testResult)}
                  </span>
                )}
              </div>

              {/* User's benchmark note */}
              {entry.testResult?.note && (
                <p className="mt-2 text-small italic text-text-secondary">
                  "{entry.testResult.note}"
                </p>
              )}

              {/* Upcoming: show instructions preview */}
              {entry.status === 'upcoming' && entry.test.instructions && (
                <p className="mt-2 text-small text-text-secondary">
                  {entry.test.instructions}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
