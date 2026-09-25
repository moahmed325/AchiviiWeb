import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Check,
  Sparkles,
  Target,
  Award,
  Clock,
  Coffee,
  Lock,
  Flag,
  Zap,
} from 'lucide-react';
import type { JourneyData, JourneyPhase, JourneyStep, JourneyWeek } from '../../types/journey';
import { formatTarget, formatPassIf } from '../../lib/formatters';

export interface MobileVerticalJourneyProps {
  journey: JourneyData;
}

export const MobileVerticalJourney: React.FC<MobileVerticalJourneyProps> = ({ journey }) => {
  const { phases, closingStretch, metrics } = journey;

  // Active phase is expanded by default, other phases collapsed to reduce visual noise (VDS §28)
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach((p) => {
      initial[p.id] = p.status === 'active';
    });
    return initial;
  });

  const activeStepRef = useRef<HTMLDivElement | null>(null);

  // R2: "You Are Here" Auto-Positioning on initial mobile load with reduced-motion respect
  useEffect(() => {
    // Only auto-scroll if user did not arrive via a direct hash deep link (e.g. #main)
    if (!window.location.hash && activeStepRef.current) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior = prefersReduced ? 'instant' : 'smooth';
      const timer = setTimeout(() => {
        activeStepRef.current?.scrollIntoView({ behavior, block: 'center' });
      }, prefersReduced ? 0 : 150);
      return () => clearTimeout(timer);
    }
  }, []);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  const activePhase = phases.find((p) => p.status === 'active') || phases[phases.length - 1];

  return (
    <section
      aria-labelledby="mobile-journey-heading"
      data-testid="mobile-vertical-journey"
      className="w-full min-w-0 space-y-6"
    >
      {/* Accessible Screen Reader Summary (VDS §29) */}
      <div className="sr-only">
        <h2 id="mobile-journey-heading">Mobile Vertical Journey</h2>
        <p>
          You are currently at Day {metrics.currentDay} of 90, in Week {metrics.currentWeek} of 12, Phase{' '}
          {metrics.currentPhaseIndex} of {metrics.totalPhases} ({activePhase?.name}).{' '}
          {metrics.completedTasksCount} daily tasks completed.
        </p>
      </div>

      {/* Visual Header & Active Position Indicator */}
      <div className="rounded-card border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span>Vertical Progression</span>
          </div>

          {/* Current Position Pill with serene beacon */}
          <div
            data-testid="you-are-here-badge"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent font-ui-mono text-micro font-bold shadow-sm journey-beacon"
          >
            <span className="size-1.5 rounded-full bg-accent animate-ping" aria-hidden="true" />
            <span>You are here · Day {metrics.currentDay}</span>
          </div>
        </div>

        <p className="text-xs text-text-secondary leading-relaxed">
          Ascend your 90-day trajectory step by step. Tap any phase landing to view or collapse milestones.
        </p>
      </div>

      {/* Vertical Spine / Stepper Track (VDS §28) */}
      <div className="relative border-l-2 border-border ml-3.5 pl-4 sm:pl-6 space-y-7 pt-1">
        {phases.map((phase: JourneyPhase, index: number) => {
          const isPhaseActive = phase.status === 'active';
          const isPhaseCompleted = phase.status === 'completed';
          const isExpanded = Boolean(expandedPhases[phase.id]);

          return (
            <div
              key={phase.id}
              style={{ '--ascent-delay': `${index * 80}ms` } as React.CSSProperties}
              className="relative space-y-3 journey-ascent"
            >
              {/* Spine Node Marker on Left Hairline */}
              <div
                className={`absolute -left-[23px] sm:-left-[31px] top-3.5 size-5 sm:size-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
                  isPhaseActive
                    ? 'border-accent bg-accent text-background shadow-sm ring-4 ring-accent/20'
                    : isPhaseCompleted
                    ? 'border-accent/60 bg-accent/20 text-accent'
                    : 'border-border bg-surface text-text-secondary'
                }`}
                aria-hidden="true"
              >
                {isPhaseCompleted ? '✓' : isPhaseActive ? '●' : '○'}
              </div>

              {/* Phase Card Accordion (R3: min-h-[44px] tap target, large clear text) */}
              <div
                className={`rounded-card border transition-all duration-200 overflow-hidden ${
                  isPhaseActive
                    ? 'bg-surface border-accent/40 shadow-raised ring-1 ring-accent/20'
                    : isPhaseCompleted
                    ? 'bg-surface border-border shadow-sm'
                    : 'bg-surface/80 border-border/70 shadow-sm'
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`mobile-phase-${phase.id}`}
                  className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-surface-elevated/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent min-h-[44px]"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary">
                        Landing {phase.index} · {phase.weeksLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-ui-mono font-medium ${
                          isPhaseCompleted
                            ? 'text-accent bg-accent/10 border border-accent/20'
                            : isPhaseActive
                            ? 'text-background bg-accent font-semibold'
                            : 'text-text-secondary bg-surface-elevated border border-border'
                        }`}
                      >
                        {isPhaseCompleted ? '✓ Done' : isPhaseActive ? '● Active' : '○ Ahead'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-text tracking-tight">
                      {phase.name}
                    </h3>

                    {phase.purpose && (
                      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
                        {phase.purpose}
                      </p>
                    )}
                  </div>

                  <span className="p-2 rounded text-text-secondary shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <ChevronDown
                      className={`size-5 text-text transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {/* Collapsible Phase Weeks Content (R2: Fluid unfolding) */}
                <div
                  id={`mobile-phase-${phase.id}`}
                  className={`journey-accordion-content ${isExpanded ? 'is-open' : 'is-closed'}`}
                  data-state={isExpanded ? 'open' : 'closed'}
                  aria-hidden={!isExpanded}
                >
                  <div className="px-3.5 pb-4 pt-1 space-y-3 border-t border-border/60">
                    {phase.weeks.map((week: JourneyWeek) => {
                      const isWeekActive = week.isCurrentWeek;
                      const isWeekCompleted = week.status === 'completed';

                      return (
                        <div
                          key={week.weekNumber}
                          className={`rounded-control border p-3.5 transition-all space-y-3 ${
                            isWeekActive
                              ? 'bg-surface-elevated border-accent shadow-raised ring-1 ring-accent/30'
                              : isWeekCompleted
                              ? 'bg-surface border-border'
                              : 'bg-surface/50 border-border/60'
                          }`}
                        >
                          {/* Week Title & Milestones */}
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-xs font-ui-mono font-bold ${
                                  isWeekActive ? 'text-accent' : 'text-text'
                                }`}
                              >
                                Week {week.weekNumber}
                              </span>

                              {isWeekActive && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-ui-mono font-bold bg-accent text-background">
                                  ACTIVE WEEK
                                </span>
                              )}

                              {isWeekCompleted && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-ui-mono text-accent">
                                  <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
                                  <span>Done</span>
                                </span>
                              )}

                              {week.weekNumber === 12 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-ui-mono font-semibold uppercase tracking-wider bg-achievement/10 text-achievement border border-achievement/30">
                                  Final Test
                                </span>
                              )}
                            </div>

                            <h4 className="text-small font-semibold text-text">
                              {week.focus || week.theme || week.title}
                            </h4>

                            {/* Target Metric */}
                            {week.target && (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                <Target className="size-3.5 text-accent shrink-0" aria-hidden="true" />
                                <span>
                                  <strong className="text-text font-medium">Target:</strong>{' '}
                                  {formatTarget(week.target)}
                                </span>
                              </div>
                            )}

                            {/* Weekly Test or Key Milestone */}
                            {(week.test || week.keyMilestone) && (
                              <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                                <Award className="size-3.5 text-achievement shrink-0" aria-hidden="true" />
                                <span className="line-clamp-2">
                                  <strong className="text-text font-medium">
                                    {week.test ? 'Test:' : 'Milestone:'}
                                  </strong>{' '}
                                  {week.test
                                    ? formatPassIf(week.test.passIf) || week.test.instructions
                                    : week.keyMilestone}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Active Week Daily Step Flight Along Vertical Spine */}
                          {isWeekActive && week.days.length > 0 ? (
                            <div className="pt-2 border-t border-border/70 space-y-2.5">
                              <div className="flex items-center gap-1.5 text-micro font-ui-mono uppercase tracking-wider text-accent">
                                <Zap className="size-3" aria-hidden="true" />
                                <span>Daily Practice Flight</span>
                              </div>

                              <div className="space-y-2">
                                {week.days.map((step: JourneyStep, idx: number) => {
                                  const isStepCompleted = step.status === 'completed';
                                  const isStepActive = step.status === 'active';
                                  const isToday = step.dayNumber === metrics.currentDay;

                                  return (
                                    <div
                                      key={step.dayNumber}
                                      ref={isToday ? activeStepRef : undefined}
                                      data-testid={isToday ? 'active-step-node' : undefined}
                                      style={{ '--ascent-delay': `${120 + idx * 40}ms` } as React.CSSProperties}
                                      className={`p-3 rounded-control border text-xs flex flex-col gap-1.5 transition-all journey-ascent ${
                                        isStepActive
                                          ? 'bg-surface border-accent shadow-md ring-1 ring-accent/30 journey-beacon'
                                          : isStepCompleted
                                          ? 'bg-surface-elevated/70 border-accent/20 text-accent/90'
                                          : 'bg-surface/60 border-border/50 text-text-muted'
                                      }`}
                                    >
                                      {/* Top Row: Day & Status */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 font-ui-mono text-micro">
                                          <span
                                            className={`size-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                              isStepCompleted
                                                ? 'bg-accent/20 text-accent border border-accent/50'
                                                : isStepActive
                                                ? 'bg-accent text-background shadow-sm'
                                                : 'border border-border text-text-muted'
                                            }`}
                                          >
                                            {isStepCompleted ? '✓' : isStepActive ? '●' : '○'}
                                          </span>
                                          <span className="font-semibold text-text">
                                            Day {step.dayNumber}
                                          </span>
                                        </div>

                                        {isToday && (
                                          <span className="px-2 py-0.5 rounded bg-accent text-background text-[10px] font-ui-mono font-bold tracking-tight shadow-sm">
                                            You are here
                                          </span>
                                        )}
                                      </div>

                                      {/* Step Title */}
                                      <p className="font-medium text-text text-small leading-snug">
                                        {step.title}
                                      </p>

                                      {/* Step Badges */}
                                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/40 text-micro font-ui-mono text-text-secondary">
                                        {step.isRestDay ? (
                                          <span className="inline-flex items-center gap-1 text-text-secondary">
                                            <Coffee className="size-3" aria-hidden="true" />
                                            <span>Rest</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1">
                                            <Clock className="size-3 text-text-secondary" aria-hidden="true" />
                                            <span>{step.durationMinutes}m</span>
                                          </span>
                                        )}

                                        {step.isKeySession && (
                                          <span className="text-accent font-semibold">★ Key</span>
                                        )}

                                        {step.isTestDay && (
                                          <span className="text-achievement font-semibold">Test</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : week.status === 'upcoming' || week.status === 'locked' ? (
                            /* BP §43 Future Honesty: Zero Fabricated Daily Tasks */
                            <div className="rounded border border-border/60 bg-surface/30 p-3 flex items-start gap-2.5 text-xs text-text-secondary">
                              <Lock className="size-3.5 text-text-secondary shrink-0 mt-0.5" aria-hidden="true" />
                              <div className="space-y-0.5">
                                <p className="font-medium text-text text-micro">
                                  Future Honesty · Daily sessions designed after Week {week.weekNumber - 1} review
                                </p>
                                <p className="text-[11px] text-text-secondary leading-relaxed">
                                  Daily tasks adapt to your performance after completing the preceding week.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-micro font-ui-mono text-text-secondary flex items-center gap-1.5">
                              <Check className="size-3 text-accent" aria-hidden="true" />
                              <span>Week {week.weekNumber} completed.</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Closing Stretch (Days 85–90) Node */}
        <div
          style={{ '--ascent-delay': '320ms' } as React.CSSProperties}
          className="relative space-y-2 journey-ascent"
        >
          {/* Spine Node Marker */}
          <div
            className={`absolute -left-[23px] sm:-left-[31px] top-3.5 size-5 sm:size-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all ${
              closingStretch.status === 'active'
                ? 'border-accent bg-accent text-background shadow-sm ring-4 ring-accent/20'
                : closingStretch.status === 'completed'
                ? 'border-accent/60 bg-accent/20 text-accent'
                : 'border-border bg-surface text-text-secondary'
            }`}
            aria-hidden="true"
          >
            <Flag className="size-3 text-current" />
          </div>

          <div
            className={`p-4 rounded-card border transition-all ${
              closingStretch.status === 'active'
                ? 'bg-surface border-accent shadow-raised ring-1 ring-accent/30'
                : closingStretch.status === 'completed'
                ? 'bg-surface border-border'
                : 'bg-surface/80 border-border/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary">
                Days 85–90 · The Closing Stretch
              </span>
              <span className="text-micro font-ui-mono text-text-secondary">
                {closingStretch.status === 'completed'
                  ? '✓ Done'
                  : closingStretch.status === 'active'
                  ? '● In Progress'
                  : '○ Approach'}
              </span>
            </div>

            <h4 className="text-small font-semibold text-text">
              Final Evaluation & Horizon Review
            </h4>

            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              <strong className="text-text font-medium">Benchmark:</strong> {closingStretch.finalTest}
            </p>
          </div>
        </div>

        {/* Summit Destination Node (✦ Day 90) */}
        <div
          style={{ '--ascent-delay': '380ms' } as React.CSSProperties}
          className="relative space-y-2 journey-ascent"
        >
          {/* Spine Node Marker */}
          <div
            className="absolute -left-[25px] sm:-left-[33px] top-3.5 size-6 sm:size-7 rounded-full border border-achievement/50 bg-surface flex items-center justify-center text-achievement text-xs font-bold shadow-md ring-2 ring-achievement/20"
            aria-hidden="true"
          >
            ✦
          </div>

          <div className="p-4 rounded-card border border-achievement/40 bg-surface shadow-raised relative overflow-hidden space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-micro font-ui-mono uppercase tracking-wider text-achievement font-medium flex items-center gap-1.5">
                <Sparkles className="size-3 text-achievement" aria-hidden="true" />
                <span>Destination Summit · Day 90</span>
              </span>
              <span className="text-achievement text-sm" aria-hidden="true">
                ✦
              </span>
            </div>

            <h4 className="text-base font-bold text-text leading-snug">
              {closingStretch.finalGoal}
            </h4>

            <p className="text-xs text-text-secondary leading-relaxed pt-1 border-t border-border">
              Arrive at your destination with verifiable proof.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
