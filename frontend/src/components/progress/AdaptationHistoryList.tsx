import React, { useMemo } from 'react';
import { Sparkles, MessageSquareText, Award } from 'lucide-react';
import type { Goal, RoadmapWeek, WeeklyReview } from '../../types';
import { cx } from '../ui';

interface AdaptationHistoryListProps {
  goal: Goal;
  className?: string;
}

interface AdaptationEntry {
  weekNumber: number;
  phase: string;
  theme: string;
  executionScore: number | null;
  reflection: string | null;
  aiAdaptationInsight: string | null;
  isMilestoneGate: boolean;
  createdAt: string | null;
}

/**
 * Merge WeeklyReview records and RoadmapWeek data into a unified
 * chronological adaptation timeline.
 */
function deriveAdaptationHistory(goal: Goal): AdaptationEntry[] {
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const reviews: WeeklyReview[] = goal.weeklyReviews || [];

  // Build a map of reviews by week number for fast lookup
  const reviewByWeek = new Map<number, WeeklyReview>();
  for (const r of reviews) {
    reviewByWeek.set(r.weekNumber, r);
  }

  const entries: AdaptationEntry[] = [];

  for (const week of weeks) {
    // Only show completed or adapted weeks (past weeks that have been reviewed)
    if (week.weekNumber >= currentWeek && week.status !== 'completed' && week.status !== 'adapted') {
      continue;
    }

    const review = reviewByWeek.get(week.weekNumber);

    // Skip weeks with zero adaptation data to show
    const reflection = review?.reflection || week.reviewNotes || null;
    const aiInsight = review?.aiAdaptationInsight || null;
    const hasScore = week.executionScore != null || review?.scorePercentage != null;

    if (!reflection && !aiInsight && !hasScore) continue;

    // Determine if this week is a phase boundary (milestone gate)
    const isLastWeekOfPhase = weeks.some(
      (other) =>
        other.phase !== week.phase &&
        other.weekNumber === week.weekNumber + 1,
    );

    entries.push({
      weekNumber: week.weekNumber,
      phase: week.phase,
      theme: week.theme,
      executionScore: review?.scorePercentage ?? week.executionScore ?? null,
      reflection,
      aiAdaptationInsight: aiInsight,
      isMilestoneGate: isLastWeekOfPhase,
      createdAt: review?.created_at || null,
    });
  }

  return entries.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * M8.3-R2: Adaptation History.
 *
 * Chronological timeline of genuine weekly reflections and server adaptation
 * insights. Renders exact server strings — zero fabricated reasoning or
 * simulated AI hallucinations (BP §33, BP §43).
 */
export const AdaptationHistoryList: React.FC<AdaptationHistoryListProps> = ({ goal, className }) => {
  const entries = useMemo(() => deriveAdaptationHistory(goal), [goal]);

  // Early state: no weekly reviews submitted yet (M8.4)
  if (entries.length === 0) {
    return (
      <section aria-labelledby="adaptation-history-heading" className={cx('space-y-3', className)}>
        <h2 id="adaptation-history-heading" className="text-h3 text-text">
          Adaptation history
        </h2>
        <div className="flex items-start gap-3 rounded-card border border-border bg-surface px-5 py-6 sm:px-6">
          <Sparkles aria-hidden="true" strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="space-y-1">
            <p className="text-small font-medium text-text">
              Weekly reviews unlock adaptation insights
            </p>
            <p className="text-small text-text-secondary">
              At the end of each week, your review reflections and server path adaptations will appear here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="adaptation-history-heading" className={cx('space-y-3', className)}>
      <h2 id="adaptation-history-heading" className="text-h3 text-text">
        Adaptation history
      </h2>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.weekNumber}
            className="rounded-card border border-border bg-surface px-5 py-4 sm:px-6 sm:py-5"
          >
            {/* Header row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-ui-mono text-micro uppercase text-text-muted">
                Week {entry.weekNumber}
              </span>
              <span className="text-small text-text-secondary">{entry.theme}</span>
              {entry.executionScore !== null && (
                <span className="ml-auto font-ui-mono text-small tabular-nums text-text-secondary">
                  {entry.executionScore}%
                </span>
              )}
            </div>

            {/* Phase milestone gate badge */}
            {entry.isMilestoneGate && (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.06] px-2.5 py-1 font-ui-mono text-micro uppercase text-accent-hover">
                  <Award aria-hidden="true" strokeWidth={1.5} className="size-3" />
                  Phase milestone reached
                </span>
              </div>
            )}

            {/* User reflection */}
            {entry.reflection && (
              <div className="mt-3 flex items-start gap-2.5">
                <MessageSquareText
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="mt-0.5 size-4 shrink-0 text-text-muted"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-micro font-medium uppercase text-text-muted">Your reflection</p>
                  <p className="mt-0.5 text-small text-text-secondary">{entry.reflection}</p>
                </div>
              </div>
            )}

            {/* Server adaptation insight — exact string, zero fabrication (BP §33, §43) */}
            {entry.aiAdaptationInsight && (
              <div className="mt-3 flex items-start gap-2.5">
                <Sparkles
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="mt-0.5 size-4 shrink-0 text-accent"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-micro font-medium uppercase text-text-muted">Adaptation insight</p>
                  <p className="mt-0.5 text-small text-text-secondary">{entry.aiAdaptationInsight}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
