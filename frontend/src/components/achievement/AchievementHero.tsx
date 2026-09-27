import React from 'react';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import type { Goal, AchievementSummary } from '../../types';
import { Button, cx } from '../ui';

interface AchievementHeroProps {
  goal: Goal;
  summary: AchievementSummary;
  onViewResults: () => void;
  onBeginAnotherJourney: () => void;
  className?: string;
}

/**
 * Visual Level 4 Cinematic Arrival Hero (BP §07, §11, §34; VDS §17–18, §26–27).
 * Presents the Roman garden destination, monumental "90 DAYS COMPLETE" headline,
 * verified goal outcome, and core arrival action buttons.
 */
export const AchievementHero: React.FC<AchievementHeroProps> = ({
  goal,
  summary,
  onViewResults,
  onBeginAnotherJourney,
  className,
}) => {
  return (
    <section
      aria-labelledby="achievement-heading"
      className={cx(
        'relative overflow-hidden rounded-panel border border-achievement/25 bg-surface/90 p-6 shadow-overlay sm:p-10 lg:p-12',
        className
      )}
    >
      {/* Warm ambient garden background glow (subtle, non-distracting) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-achievement/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 size-96 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
        {/* Left Column: Monumental Arrival Typography */}
        <div className="flex flex-col text-left lg:col-span-7">
          <div className="flex items-center gap-2">
            <span className="font-ui-mono text-micro uppercase tracking-widest text-achievement">
              ✦ 90 DAYS
            </span>
            <span className="h-1 w-1 rounded-full bg-achievement/60" aria-hidden="true" />
            <span className="font-ui-mono text-micro uppercase tracking-widest text-text-secondary">
              DESTINATION REACHED
            </span>
          </div>

          <h1
            id="achievement-heading"
            className="mt-3 text-display font-semibold tracking-tight text-text"
          >
            COMPLETE
          </h1>

          <p className="mt-2 text-h2 font-medium text-text">
            You made it.
          </p>

          <p className="mt-2 max-w-xl text-body-lg text-text-secondary">
            You walked the ninety days one clear action at a time. The staircase was the
            journey; this quiet garden is your arrival.
          </p>

          {/* Stored Goal & Clarified Outcome Display */}
          <div className="mt-6 rounded-control border border-border-strong bg-background/80 p-5">
            <p className="font-ui-mono text-micro uppercase tracking-wider text-achievement">
              The Ambition Honored
            </p>
            <h2 className="mt-1 text-h3 font-medium text-text">
              {goal.rawGoal}
            </h2>
            {goal.clarifiedOutcome && goal.clarifiedOutcome !== goal.rawGoal && (
              <p className="mt-2 text-small text-text-secondary">
                {goal.clarifiedOutcome}
              </p>
            )}
            {goal.canonicalMethodName && (
              <p className="mt-3 inline-flex items-center gap-1.5 font-ui-mono text-micro text-accent-hover">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                Grounded in {goal.canonicalMethodName}
                {goal.canonicalAuthority ? ` by ${goal.canonicalAuthority}` : ''}
              </p>
            )}
          </div>

          {/* Quick Highlight Stats Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-control border border-border bg-surface-elevated/70 p-3 text-left">
              <span className="font-ui-mono text-micro text-text-muted">Total Path</span>
              <p className="font-ui-mono text-h3 font-semibold tabular-nums text-text">90 Days</p>
            </div>
            <div className="rounded-control border border-border bg-surface-elevated/70 p-3 text-left">
              <span className="font-ui-mono text-micro text-text-muted">Practice Sessions</span>
              <p className="font-ui-mono text-h3 font-semibold tabular-nums text-text">
                {summary.completedSessions}
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-elevated/70 p-3 text-left">
              <span className="font-ui-mono text-micro text-text-muted">Execution Rate</span>
              <p className="font-ui-mono text-h3 font-semibold tabular-nums text-achievement">
                {summary.adherenceRate}%
              </p>
            </div>
            <div className="rounded-control border border-border bg-surface-elevated/70 p-3 text-left">
              <span className="font-ui-mono text-micro text-text-muted">Benchmarks</span>
              <p className="font-ui-mono text-h3 font-semibold tabular-nums text-accent-hover">
                {summary.benchmarksAchieved}/{summary.totalBenchmarks}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              variant="primary"
              size="lg"
              onClick={onViewResults}
              trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              className="w-full sm:w-auto"
            >
              Your results
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={onBeginAnotherJourney}
              leadingIcon={<Compass aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              className="w-full sm:w-auto"
            >
              Begin another journey
            </Button>
          </div>
        </div>

        {/* Right Column: Architectural Framed Roman Garden Asset (VDS §17–18, note 8) */}
        <div className="flex justify-center lg:col-span-5">
          <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-panel border border-achievement/30 bg-background shadow-raised">
            {/* The Garden Image (682x1024 portrait) */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-background">
              <img
                src="/images/brand/garden.jpg"
                alt="The serene Roman garden, bathed in warm Mediterranean light, symbolizing achievement and arrival"
                width={682}
                height={1024}
                loading="eager"
                className="h-full w-full object-cover object-center"
              />
              {/* Darkened bottom gradient ensuring high contrast and atmosphere */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10"
              />
            </div>

            {/* Bottom Inscription */}
            <div className="border-t border-border bg-surface-elevated/95 p-4 text-center">
              <p className="flex items-center justify-center gap-1.5 font-ui-mono text-micro uppercase tracking-widest text-achievement">
                <Sparkles className="size-3 text-achievement" aria-hidden="true" />
                The Roman Garden Destination
              </p>
              <p className="mt-1 text-micro text-text-secondary">
                Where deliberate practice bears its fruit.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
