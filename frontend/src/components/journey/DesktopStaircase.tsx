import React from 'react';
import {
  Check,
  Circle,
  Sparkles,
  ChevronRight,
  Zap,
  Coffee,
  Flag,
} from 'lucide-react';
import type { JourneyData, JourneyPhase, JourneyStep, JourneyWeek } from '../../types/journey';
import { formatTarget } from '../../lib/formatters';

export interface DesktopStaircaseProps {
  journey: JourneyData;
}

export const DesktopStaircase: React.FC<DesktopStaircaseProps> = ({ journey }) => {
  const { phases, closingStretch, metrics } = journey;
  const activePhase = phases.find((p) => p.status === 'active') || phases[phases.length - 1];
  const activeWeek = activePhase?.weeks.find((w) => w.isCurrentWeek) || activePhase?.weeks[0];

  return (
    <section
      aria-labelledby="staircase-heading"
      className="relative rounded-card border border-border bg-surface shadow-raised p-5 sm:p-7 space-y-7 overflow-hidden"
    >
      {/* Accessible Screen Reader Summary (VDS §29) */}
      <div className="sr-only">
        <h2 id="staircase-heading">90-Day Journey Staircase</h2>
        <p>
          You are currently at Day {metrics.currentDay} of 90, in Week {metrics.currentWeek} of 12, Phase{' '}
          {metrics.currentPhaseIndex} of {metrics.totalPhases} ({activePhase?.name}).{' '}
          {metrics.completedTasksCount} daily tasks completed.
        </p>
      </div>

      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            <span>Layer 2 · The Emotional Staircase</span>
          </div>
          <h2 className="text-lg font-semibold text-text mt-0.5 tracking-tight">
            The 90-Day Ascent
          </h2>
        </div>

        {/* Legend (VDS §25) */}
        <div className="flex flex-wrap items-center gap-3 text-micro font-ui-mono text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="size-3.5 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center text-accent text-[9px]">
              ✓
            </span>
            <span>Done</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3.5 rounded-full bg-accent flex items-center justify-center text-background text-[9px] font-bold">
              ●
            </span>
            <span className="text-text font-medium">You are here</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3.5 rounded-full border border-border-control flex items-center justify-center text-text-secondary text-[9px]">
              ○
            </span>
            <span>Ahead</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-achievement text-xs">✦</span>
            <span>Summit</span>
          </span>
        </div>
      </div>

      {/* Architectural Staircase Track */}
      <div className="space-y-6">
        {/* Tiered Phase Landings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
          {phases.map((phase: JourneyPhase) => {
            const isPhaseCompleted = phase.status === 'completed';
            const isPhaseActive = phase.status === 'active';

            return (
              <div
                key={phase.id}
                className={`relative flex flex-col justify-between rounded-control border transition-all duration-200 p-4 ${
                  isPhaseActive
                    ? 'bg-surface-elevated border-accent/40 shadow-md ring-1 ring-accent/20'
                    : isPhaseCompleted
                    ? 'bg-surface border-border'
                    : 'bg-surface/60 border-border/70'
                }`}
              >
                {/* Landing Header */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary">
                      Landing {phase.index} · {phase.weeksLabel}
                    </span>
                    {isPhaseCompleted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-ui-mono text-accent">
                        <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
                        <span>Completed</span>
                      </span>
                    ) : isPhaseActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-ui-mono text-accent font-medium">
                        <span className="size-1.5 rounded-full bg-accent animate-ping" aria-hidden="true" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-ui-mono text-text-secondary">
                        <Circle className="size-2.5" aria-hidden="true" />
                        <span>Upcoming</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-small font-semibold text-text leading-snug">
                    {phase.name}
                  </h3>

                  {phase.purpose && (
                    <p className="text-micro text-text-secondary line-clamp-2 leading-relaxed">
                      {phase.purpose}
                    </p>
                  )}
                </div>

                {/* Milestone Nodes in Phase */}
                <div className="mt-4 pt-3 border-t border-border/80 space-y-2">
                  <div className="text-[10px] font-ui-mono uppercase tracking-wider text-text-secondary">
                    Weekly Milestones (◆)
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 min-w-0">
                    {phase.weeks.map((week: JourneyWeek) => {
                      const isWeekCompleted = week.status === 'completed';
                      const isWeekActive = week.isCurrentWeek;

                      return (
                        <div
                          key={week.weekNumber}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-micro font-ui-mono border min-w-0 ${
                            isWeekActive
                              ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                              : isWeekCompleted
                              ? 'bg-surface-elevated border-border text-text'
                              : 'bg-surface-elevated/40 border-border/60 text-text-secondary'
                          }`}
                          title={week.focus || week.title}
                        >
                          <span className="text-[10px] shrink-0">
                            {isWeekCompleted ? '✓' : isWeekActive ? '●' : '◆'}
                          </span>
                          <span className="truncate">W{week.weekNumber}</span>
                          {week.target && (
                            <span className="text-[9px] opacity-75 truncate hidden sm:inline">
                              · {formatTarget(week.target)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Elevated Active Week Daily Step Runner (VDS §7–8, §20) */}
        {activeWeek && activeWeek.days.length > 0 && (
          <div className="rounded-control border border-accent/30 bg-surface-elevated p-4 sm:p-5 shadow-raised space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <div className="text-micro font-ui-mono uppercase tracking-wider text-accent flex items-center gap-1.5">
                  <Zap className="size-3 text-accent" aria-hidden="true" />
                  <span>Current Step Flight · Week {activeWeek.weekNumber} Daily Action</span>
                </div>
                <h3 className="text-base font-semibold text-text mt-0.5">
                  {activeWeek.focus || activeWeek.title}
                </h3>
              </div>

              {activeWeek.target && (
                <div className="text-xs font-ui-mono text-text-secondary bg-surface px-2.5 py-1 rounded border border-border">
                  <span className="text-text font-medium">Target:</span> {formatTarget(activeWeek.target)}
                </div>
              )}
            </div>

            {/* 7 Daily Steps Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5 min-w-0">
              {activeWeek.days.map((step: JourneyStep) => {
                const isStepCompleted = step.status === 'completed';
                const isStepActive = step.status === 'active';
                const isToday = step.dayNumber === metrics.currentDay;

                return (
                  <div
                    key={step.dayNumber}
                    className={`relative flex flex-col justify-between p-3 rounded-control border transition-all ${
                      isStepActive
                        ? 'bg-surface border-accent shadow-md ring-1 ring-accent/30'
                        : isStepCompleted
                        ? 'bg-surface-elevated/80 border-border'
                        : 'bg-surface/50 border-border/60'
                    }`}
                  >
                    {/* Step Top Bar */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-micro font-ui-mono font-medium text-text-secondary">
                        Day {step.dayNumber}
                      </span>

                      {/* Status Glyphs (VDS §25) */}
                      {isStepCompleted ? (
                        <span
                          className="size-4 rounded-full bg-accent/20 border border-accent/60 flex items-center justify-center text-accent text-[10px] font-bold"
                          title="Completed"
                        >
                          ✓
                        </span>
                      ) : isStepActive ? (
                        <span
                          className="size-4 rounded-full bg-accent flex items-center justify-center text-background text-[10px] font-bold shadow-sm"
                          title="You are here"
                        >
                          ●
                        </span>
                      ) : (
                        <span
                          className="size-4 rounded-full border border-border flex items-center justify-center text-text-secondary text-[10px]"
                          title="Upcoming"
                        >
                          ○
                        </span>
                      )}
                    </div>

                    {/* Step Title */}
                    <p className="text-xs font-medium text-text line-clamp-2 leading-snug my-1">
                      {step.title}
                    </p>

                    {/* Step Badges / Meta */}
                    <div className="mt-2 pt-1 border-t border-border/50 flex flex-wrap items-center gap-1 text-[10px] font-ui-mono text-text-secondary">
                      {step.isRestDay ? (
                        <span className="inline-flex items-center gap-0.5 text-text-secondary">
                          <Coffee className="size-2.5" aria-hidden="true" />
                          <span>Rest</span>
                        </span>
                      ) : (
                        <span>{step.durationMinutes}m</span>
                      )}

                      {step.isKeySession && (
                        <span className="text-accent font-semibold" title="Key Session">
                          ★ Key
                        </span>
                      )}

                      {step.isTestDay && (
                        <span className="text-achievement font-semibold" title="Weekly Test">
                          Test
                        </span>
                      )}
                    </div>

                    {/* "You Are Here" Marker (VDS §7–8, §25) */}
                    {isToday && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-accent text-background text-[9px] font-ui-mono font-bold tracking-tight shadow-sm whitespace-nowrap">
                        You are here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Closing Stretch & Destination Summit (OD-2 Option A & VDS §25) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Days 85–90 Approach Node */}
          <div
            className={`p-4 rounded-control border transition-all ${
              closingStretch.status === 'active'
                ? 'bg-surface-elevated border-accent shadow-md ring-1 ring-accent/20'
                : closingStretch.status === 'completed'
                ? 'bg-surface border-border'
                : 'bg-surface/50 border-border/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-micro font-ui-mono uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Flag className="size-3 text-accent" aria-hidden="true" />
                <span>Days 85–90 · The Closing Stretch</span>
              </span>
              <span className="text-micro font-ui-mono text-text-secondary">
                {closingStretch.status === 'completed'
                  ? '✓ Finished'
                  : closingStretch.status === 'active'
                  ? '● In Progress'
                  : '○ Approach'}
              </span>
            </div>

            <h4 className="text-small font-semibold text-text leading-snug">
              Final Evaluation & Horizon Review
            </h4>

            <p className="text-micro text-text-secondary mt-1 leading-relaxed">
              <span className="font-medium text-text">Benchmark:</span> {closingStretch.finalTest}
            </p>
          </div>

          {/* Destination Summit (✦ VDS §25) */}
          <div className="p-4 rounded-control border border-achievement/40 bg-surface shadow-raised relative overflow-hidden">
            <div className="absolute right-0 bottom-0 size-24 rounded-full bg-achievement/10 blur-xl pointer-events-none" />

            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-micro font-ui-mono uppercase tracking-wider text-achievement flex items-center gap-1.5 font-medium">
                <Sparkles className="size-3 text-achievement" aria-hidden="true" />
                <span>Destination Summit · Day 90</span>
              </span>
              <span className="text-achievement text-sm" aria-hidden="true">
                ✦
              </span>
            </div>

            <h4 className="text-small font-semibold text-text leading-snug">
              {closingStretch.finalGoal}
            </h4>

            <div className="mt-2 pt-2 border-t border-border flex items-center gap-1.5 text-micro text-text-secondary">
              <span>Arrive at your destination with verifiable proof.</span>
              <ChevronRight className="size-3 text-achievement" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
