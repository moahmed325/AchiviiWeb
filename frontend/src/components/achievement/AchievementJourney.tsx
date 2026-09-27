import React, { useMemo } from 'react';
import { CheckCircle2, Milestone, BookOpen, Quote, Calendar } from 'lucide-react';
import type { Goal, AchievementSummary, WeeklyReview } from '../../types';
import { formatAchievementDate } from '../../lib/achievement';
import { cx } from '../ui';

interface AchievementJourneyProps {
  goal: Goal;
  summary: AchievementSummary;
  className?: string;
}

/**
 * Accomplishments Reflection & Journey Summary (M9.3-R5).
 * Displays initial intent, canonical methodology notes, milestone gates cleared,
 * and the submitted final review reflection.
 */
export const AchievementJourney: React.FC<AchievementJourneyProps> = ({
  goal,
  summary,
  className,
}) => {
  const reviews: WeeklyReview[] = goal.weeklyReviews || [];
  // Find final reflection (Week 12 or the latest submitted reflection)
  const finalReview = useMemo(() => {
    const sorted = [...reviews].sort((a, b) => b.weekNumber - a.weekNumber);
    return sorted.find((r) => r.reflection && r.reflection.trim() !== '') || sorted[0];
  }, [reviews]);

  const phases = useMemo(() => {
    if (goal.roadmap?.phases && goal.roadmap.phases.length > 0) {
      return goal.roadmap.phases;
    }
    // Default 3 standard phases
    return [
      { name: 'Foundation', startWeek: 1, endWeek: 4, purpose: 'Build baseline discipline and foundational movement patterns.' },
      { name: 'Acceleration', startWeek: 5, endWeek: 8, purpose: 'Progressive overload, density building, and volume expansion.' },
      { name: 'Mastery', startWeek: 9, endWeek: 12, purpose: 'Peak intensity, capstone verification, and closing stretch arrival.' },
    ];
  }, [goal]);

  return (
    <div className={cx('flex flex-col gap-8 text-left', className)}>
      {/* 1. Header: The Path Traveled */}
      <section aria-labelledby="journey-reflection-heading">
        <h2 id="journey-reflection-heading" className="text-h2 font-semibold text-text">
          The Journey Honored
        </h2>
        <p className="mt-1 text-body text-text-secondary">
          How an ambitious vision was transformed into deliberate, daily practice.
        </p>
      </section>

      {/* 2. Initial Ambition vs Clarified Outcome */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border-strong bg-surface/90 p-5">
          <div className="flex items-center gap-2">
            <Milestone className="size-4 text-achievement" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-wider text-achievement">
              Initial Ambition
            </span>
          </div>
          <h3 className="mt-2 text-h3 font-medium text-text">
            {goal.rawGoal}
          </h3>
          {goal.roadmap?.startingPoint?.description && (
            <p className="mt-2 text-small text-text-secondary">
              Starting point: {goal.roadmap.startingPoint.description}
            </p>
          )}
        </div>

        <div className="rounded-card border border-border-strong bg-surface/90 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-accent-hover" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-wider text-accent-hover">
              Clarified Destination
            </span>
          </div>
          <h3 className="mt-2 text-h3 font-medium text-text">
            {goal.clarifiedOutcome || goal.rawGoal}
          </h3>
          <p className="mt-2 text-small text-text-secondary">
            Verified across 90 deliberate days and 12 structured weeks.
          </p>
        </div>
      </div>

      {/* 3. Proven Methodology & Grounding */}
      {(goal.canonicalMethodName || goal.methodologyNotes) && (
        <section
          aria-labelledby="methodology-heading"
          className="rounded-card border border-border bg-surface/80 p-5"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-text-secondary" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-wider text-text-muted">
              Proven Methodology
            </span>
          </div>
          <h3 id="methodology-heading" className="mt-2 text-body font-medium text-text">
            {goal.canonicalMethodName || 'Deliberate Practice Architecture'}
            {goal.canonicalAuthority ? ` · ${goal.canonicalAuthority}` : ''}
          </h3>
          {goal.methodologyNotes && (
            <p className="mt-1 text-small text-text-secondary">
              {goal.methodologyNotes}
            </p>
          )}
        </section>
      )}

      {/* 4. Milestone Phases Cleared */}
      <section aria-labelledby="phases-cleared-heading" className="flex flex-col gap-4">
        <div>
          <h3 id="phases-cleared-heading" className="text-h3 font-semibold text-text">
            Architectural Phases Completed
          </h3>
          <p className="mt-1 text-body text-text-secondary">
            Every phase gate cleared on the path to the summit.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {phases.map((phase, idx) => (
            <div
              key={phase.name}
              className="flex flex-col justify-between rounded-card border border-border bg-surface/70 p-5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-ui-mono text-micro text-achievement">
                    Phase {idx + 1}
                  </span>
                  <span className="inline-flex items-center gap-1 font-ui-mono text-micro text-accent-hover">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Cleared
                  </span>
                </div>
                <h4 className="mt-2 text-h3 font-medium text-text">
                  {phase.name}
                </h4>
                <p className="mt-1 font-ui-mono text-micro text-text-muted">
                  Weeks {phase.startWeek}–{phase.endWeek}
                </p>
                <p className="mt-3 text-small text-text-secondary">
                  {phase.purpose}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Final Reflection */}
      {finalReview?.reflection && (
        <section
          aria-labelledby="final-reflection-heading"
          className="rounded-card border border-achievement/30 bg-surface/90 p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Quote className="size-4 text-achievement" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-widest text-achievement">
              Closing Reflection
            </span>
          </div>
          <p id="final-reflection-heading" className="mt-3 text-body-lg italic text-text">
            "{finalReview.reflection}"
          </p>
          <p className="mt-3 font-ui-mono text-micro text-text-muted">
            Submitted during Week {finalReview.weekNumber} Review
          </p>
        </section>
      )}

      {/* 6. Formal Completion Timestamp */}
      <div className="flex items-center justify-between rounded-control border border-border bg-surface-elevated/40 p-4">
        <div className="flex items-center gap-2 text-small text-text-secondary">
          <Calendar className="size-4 text-text-muted" aria-hidden="true" />
          <span>Arrival completed on:</span>
        </div>
        <span className="font-ui-mono text-small font-semibold text-text">
          {formatAchievementDate(summary.completedAt)}
        </span>
      </div>
    </div>
  );
};
