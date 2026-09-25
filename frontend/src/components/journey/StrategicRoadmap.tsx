import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Target,
  Award,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  Coffee,
  Check,
} from 'lucide-react';
import type { JourneyData, JourneyPhase, JourneyWeek, JourneyStep } from '../../types/journey';
import { formatTarget, formatPassIf } from '../../lib/formatters';

export interface StrategicRoadmapProps {
  journey: JourneyData;
}

export const StrategicRoadmap: React.FC<StrategicRoadmapProps> = ({ journey }) => {
  const { phases, closingStretch, metrics } = journey;

  // Active phase defaults to open, others closed unless explicitly toggled
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    phases.forEach((p) => {
      initial[p.id] = p.status === 'active';
    });
    return initial;
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }));
  };

  return (
    <section
      aria-labelledby="strategic-roadmap-heading"
      className="space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <div className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span>Layer 3 · The Strategic Roadmap</span>
          </div>
          <h2 id="strategic-roadmap-heading" className="text-lg font-semibold text-text mt-0.5 tracking-tight">
            Method Phases & Weekly Targets
          </h2>
        </div>
        <p className="text-xs text-text-secondary max-w-md">
          Architectural breakdown of all 12 weeks. Future weeks display strategic milestones without fabricated daily tasks (BP §43).
        </p>
      </div>

      {/* Phase Cards Stack */}
      <div className="space-y-4">
        {phases.map((phase: JourneyPhase) => {
          const isExpanded = Boolean(expandedPhases[phase.id]);
          const isPhaseActive = phase.status === 'active';
          const isPhaseCompleted = phase.status === 'completed';

          return (
            <div
              key={phase.id}
              className={`rounded-card border transition-all duration-200 overflow-hidden ${
                isPhaseActive
                  ? 'bg-surface border-accent/40 shadow-raised ring-1 ring-accent/20'
                  : isPhaseCompleted
                  ? 'bg-surface border-border shadow-sm'
                  : 'bg-surface/60 border-border/60 shadow-sm'
              }`}
            >
              {/* Phase Header Bar / Accordion Toggle */}
              <button
                type="button"
                onClick={() => togglePhase(phase.id)}
                aria-expanded={isExpanded}
                aria-controls={`phase-panel-${phase.id}`}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left hover:bg-surface-elevated/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary">
                      Phase {phase.index} of {metrics.totalPhases} · {phase.weeksLabel}
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
                      {isPhaseCompleted ? '✓ Completed' : isPhaseActive ? '● In Progress' : '○ Upcoming'}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-text tracking-tight flex items-center gap-2">
                    <span>{phase.name}</span>
                  </h3>

                  {phase.purpose && (
                    <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                      {phase.purpose}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-text-secondary shrink-0">
                  <span className="text-xs font-ui-mono hidden sm:inline">
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </span>
                  <span className="p-1 rounded hover:bg-surface-elevated text-text">
                    {isExpanded ? (
                      <ChevronUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    )}
                  </span>
                </div>
              </button>

              {/* Collapsible Weeks Container */}
              {isExpanded && (
                <div
                  id={`phase-panel-${phase.id}`}
                  className="px-4 sm:px-5 pb-5 pt-1 space-y-3 border-t border-border/60 animate-fadeIn"
                >
                  {phase.weeks.map((week: JourneyWeek) => {
                    const isWeekActive = week.isCurrentWeek;
                    const isWeekCompleted = week.status === 'completed';
                    const isWeekUpcoming = week.status === 'upcoming' || week.status === 'locked';

                    return (
                      <div
                        key={week.weekNumber}
                        className={`rounded-control border p-4 transition-all ${
                          isWeekActive
                            ? 'bg-surface-elevated border-accent shadow-raised ring-1 ring-accent/30'
                            : isWeekCompleted
                            ? 'bg-surface border-border'
                            : 'bg-surface/40 border-border/50'
                        }`}
                      >
                        {/* Week Title & Metadata */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1.5 min-w-0 flex-1">
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
                                  <CheckCircle2 className="size-3" aria-hidden="true" />
                                  <span>Completed</span>
                                </span>
                              )}

                              {week.executionScore !== undefined && (
                                <span className="text-[11px] font-ui-mono text-text-secondary bg-surface px-1.5 py-0.5 rounded border border-border">
                                  Score: {week.executionScore}%
                                </span>
                              )}

                              {week.weekNumber === 12 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-ui-mono font-semibold uppercase tracking-wider bg-achievement/10 text-achievement border border-achievement/30">
                                  Final Test Week
                                </span>
                              )}
                            </div>

                            <h4 className="text-small sm:text-base font-semibold text-text">
                              {week.focus || week.theme || week.title}
                            </h4>

                            {/* Strategic Target Metric */}
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
                                <span>
                                  <strong className="text-text font-medium">
                                    {week.test ? 'Weekly Test:' : 'Milestone:'}
                                  </strong>{' '}
                                  {week.test
                                    ? formatPassIf(week.test.passIf) || week.test.instructions
                                    : week.keyMilestone}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Week Content: Active Practice Sessions VS Future Honesty Notice */}
                        <div className="mt-4 pt-3 border-t border-border/60">
                          {isWeekActive ? (
                            /* Active Week: Shows Real Daily Practice Sessions */
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-micro font-ui-mono uppercase tracking-wider text-text-secondary">
                                <span className="flex items-center gap-1.5">
                                  <Clock className="size-3 text-accent" aria-hidden="true" />
                                  <span>Daily Practice Sessions</span>
                                </span>
                                <span>{week.days.length} Sessions</span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                {week.days.map((step: JourneyStep) => {
                                  const isStepDone = step.status === 'completed';
                                  const isStepActive = step.status === 'active';

                                  return (
                                    <div
                                      key={step.dayNumber}
                                      className={`p-2.5 rounded border text-xs flex flex-col justify-between gap-1.5 ${
                                        isStepActive
                                          ? 'bg-surface border-accent ring-1 ring-accent/30'
                                          : isStepDone
                                          ? 'bg-surface-elevated/80 border-border text-text-secondary'
                                          : 'bg-surface/50 border-border/40 text-text'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1 font-ui-mono text-[10px]">
                                        <span className="font-semibold text-text">Day {step.dayNumber}</span>
                                        <span>
                                          {isStepDone ? (
                                            <span className="text-accent font-bold">✓</span>
                                          ) : isStepActive ? (
                                            <span className="text-accent font-bold">●</span>
                                          ) : (
                                            <span className="text-text-secondary">○</span>
                                          )}
                                        </span>
                                      </div>

                                      <p className="font-medium text-text text-xs line-clamp-2 leading-snug">
                                        {step.title}
                                      </p>

                                      <div className="flex items-center gap-1.5 text-[10px] font-ui-mono text-text-secondary pt-1 border-t border-border/40">
                                        {step.isRestDay ? (
                                          <span className="inline-flex items-center gap-1 text-text-secondary">
                                            <Coffee className="size-2.5" aria-hidden="true" />
                                            <span>Rest</span>
                                          </span>
                                        ) : (
                                          <span>{step.durationMinutes}m</span>
                                        )}
                                        {step.isKeySession && <span className="text-accent">★ Key</span>}
                                        {step.isTestDay && <span className="text-achievement">Test</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : isWeekUpcoming ? (
                            /* Future Week: Future Honesty (BP §43) - Zero Fabricated Daily Tasks */
                            <div className="rounded border border-border/60 bg-surface/30 p-3 sm:p-3.5 flex items-start gap-3 text-xs text-text-secondary">
                              <Lock className="size-4 text-text-secondary shrink-0 mt-0.5" aria-hidden="true" />
                              <div className="space-y-0.5">
                                <p className="font-medium text-text">
                                  Future Honesty · Daily sessions designed after Week {week.weekNumber - 1} review
                                </p>
                                <p className="text-micro text-text-secondary leading-relaxed">
                                  Achivii adapts each week’s daily practice to your actual performance. Specific daily actions are unlocked once you complete the preceding weekly review.
                                </p>
                              </div>
                            </div>
                          ) : (
                            /* Completed Week */
                            <div className="text-xs font-ui-mono text-text-secondary flex items-center gap-1.5">
                              <Check className="size-3.5 text-accent" aria-hidden="true" />
                              <span>Week {week.weekNumber} completed. Verified progress recorded in timeline.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Closing Stretch Final Card (OD-2 Option A) */}
      <div className="rounded-card border border-achievement/40 bg-surface p-5 sm:p-6 shadow-raised relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-achievement" aria-hidden="true" />
            <span className="text-micro font-ui-mono uppercase tracking-wider text-achievement font-semibold">
              Days 85–90 · The Closing Stretch
            </span>
          </div>
          <span className="text-micro font-ui-mono text-text-secondary">
            {closingStretch.status === 'completed'
              ? '✓ Completed'
              : closingStretch.status === 'active'
              ? '● In Progress'
              : '○ Approach'}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-bold text-text">
            Final Benchmark: {closingStretch.finalTest}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Following the Week 12 review, the final six days are dedicated to taking your final test, certifying your outcome, and stepping onto the summit.
          </p>
        </div>

        <div className="pt-3 border-t border-border flex items-center gap-2 text-xs font-medium text-achievement">
          <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Destination Summit: {closingStretch.finalGoal}</span>
        </div>
      </div>
    </section>
  );
};
