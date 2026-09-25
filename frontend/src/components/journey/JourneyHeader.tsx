import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Target, Award, Calendar } from 'lucide-react';
import type { JourneyData } from '../../types/journey';
import { formatGoalTitle } from '../../lib/formatters';
import { getGoalImage } from '../../lib/certifiedPresets';
import { Badge } from '../ui/Badge';

export interface JourneyHeaderProps {
  journey: JourneyData;
}

export const JourneyHeader: React.FC<JourneyHeaderProps> = ({ journey }) => {
  const displayGoalTitle = formatGoalTitle(journey.clarifiedOutcome, journey.rawGoal);
  const goalImage = getGoalImage(journey.clarifiedOutcome || journey.rawGoal);
  const { metrics } = journey;

  const activePhase =
    journey.phases.find((p) => p.status === 'active') || journey.phases[journey.phases.length - 1];

  // R3: Progress bar animated fill from 0 to target percentage on load using --ease-ascend over 600ms
  const [fillPercent, setFillPercent] = React.useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return metrics.percentComplete;
    }
    return 0;
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = setTimeout(() => {
      setFillPercent(metrics.percentComplete);
    }, 50);
    return () => clearTimeout(timer);
  }, [metrics.percentComplete]);

  return (
    <header className="space-y-4">
      {/* Top Navigation & Day Badge */}
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-text-secondary hover:text-text transition-colors py-2 px-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent group"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 text-text-secondary" />
          <span>Back to Today</span>
        </Link>

        {/* Quick Orientation Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-border text-xs font-ui-mono shadow-sm">
          <span className="size-2 rounded-full bg-accent animate-pulse" aria-hidden="true" />
          <span className="text-text font-medium tabular" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Day {metrics.currentDay}
          </span>
          <span className="text-text-secondary">/</span>
          <span className="text-text-secondary">90</span>
        </div>
      </div>

      {/* Architectural Goal Card (VDS §10) */}
      <div className="relative overflow-hidden rounded-card border border-border bg-surface shadow-raised p-5 sm:p-6 backdrop-blur-sm">
        {/* Atmospheric Ambient Glow */}
        {goalImage && (
          <div
            className="absolute -top-16 right-0 size-72 rounded-full overflow-hidden pointer-events-none opacity-15 blur-3xl"
            aria-hidden="true"
          >
            <img src={goalImage} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Goal & Method Identity */}
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            {goalImage && (
              <div className="size-16 sm:size-20 rounded-control overflow-hidden border border-border-strong shrink-0 relative shadow-md bg-surface-elevated">
                <img
                  src={goalImage}
                  alt={displayGoalTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
              </div>
            )}

            <div className="space-y-1.5 min-w-0 flex-1">
              {/* Method & Phase Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {journey.methodName && (
                  <Badge
                    tone="accent"
                    icon={<Award className="size-3 text-accent shrink-0" aria-hidden="true" />}
                    className="font-ui-mono text-micro normal-case border-border bg-surface-elevated text-accent"
                  >
                    Method: {journey.methodName}
                    {journey.methodAuthor ? ` (${journey.methodAuthor})` : ''}
                  </Badge>
                )}

                <Badge
                  tone="neutral"
                  className="font-ui-mono text-micro normal-case border-border bg-surface-elevated text-text-secondary"
                >
                  Phase {metrics.currentPhaseIndex} of {metrics.totalPhases}: {activePhase?.name}
                </Badge>
              </div>

              {/* Goal Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-text tracking-tight leading-snug">
                {displayGoalTitle}
              </h1>

              {/* Stored Clarified Outcome */}
              {journey.clarifiedOutcome && journey.clarifiedOutcome !== journey.rawGoal && (
                <p className="text-xs sm:text-small text-text-secondary leading-relaxed line-clamp-2">
                  <span className="text-text-secondary font-medium">90-day outcome:</span>{' '}
                  {journey.clarifiedOutcome}
                </p>
              )}
            </div>
          </div>

          {/* Layer 1 Numerical Summary (VDS §9) */}
          <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between sm:justify-start gap-3 sm:gap-6 md:gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-border shrink-0">
            <div className="text-left md:text-right space-y-0.5">
              <div className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary flex items-center md:justify-end gap-1.5">
                <Calendar className="size-3 text-accent" aria-hidden="true" />
                <span>Week {metrics.currentWeek} of 12</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-text font-ui-mono tabular" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span className="text-accent">{metrics.currentDay}</span>
                <span className="text-text-secondary text-lg sm:text-xl font-normal"> / 90 Days</span>
              </div>
            </div>

            {/* Layer 1 Animated Progress Bar (R3) */}
            <div className="w-full sm:w-36 md:w-44 space-y-1">
              <div className="h-1.5 rounded-full bg-surface-elevated border border-border overflow-hidden">
                <div
                  data-testid="journey-progress-bar"
                  className="h-full bg-accent journey-progress-bar"
                  style={{
                    width: `${fillPercent}%`,
                    transition: 'width 600ms var(--ease-ascend)',
                  }}
                  role="progressbar"
                  aria-valuenow={metrics.percentComplete}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="90-day journey progress"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-ui-mono text-text-secondary tabular" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <span>{metrics.percentComplete}% completed</span>
                <span>{90 - metrics.currentDay} days left</span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Quick Insight */}
        {journey.finalTest && (
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-text-secondary">
            <Target className="size-3.5 text-accent shrink-0" aria-hidden="true" />
            <span className="truncate">
              <span className="text-text font-medium">Final Test:</span> {journey.finalTest}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};
