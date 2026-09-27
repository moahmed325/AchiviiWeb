import React, { useMemo } from 'react';
import { Check, Circle, Minus } from 'lucide-react';
import type { Goal, RoadmapWeek, RoadmapPhase, DailyTask } from '../../types';
import { V1_DEFAULT_PHASES } from '../../lib/journeyAdapter';
import { cx } from '../ui';

interface PhaseMilestonesCardProps {
  goal: Goal;
  className?: string;
}

type PhaseStatus = 'completed' | 'active' | 'upcoming';

interface PhaseEntry {
  name: string;
  weekRange: string;
  status: PhaseStatus;
  keyMilestones: string[];
  executionScore: number | null;
}

function derivePhases(goal: Goal): PhaseEntry[] {
  const currentWeek = Math.min(12, Math.max(1, goal.currentWeek || 1));
  const weeks: RoadmapWeek[] = goal.roadmapWeeks || [];
  const tasks: DailyTask[] = goal.dailyTasks || [];

  const isV2 = goal.planVersion === 2 && goal.roadmap;
  const rawPhases: RoadmapPhase[] =
    isV2 && goal.roadmap?.phases && goal.roadmap.phases.length >= 2
      ? goal.roadmap.phases
      : V1_DEFAULT_PHASES;

  return rawPhases.map((phase) => {
    // Phase status
    let status: PhaseStatus;
    if (currentWeek > phase.endWeek) {
      status = 'completed';
    } else if (currentWeek >= phase.startWeek && currentWeek <= phase.endWeek) {
      status = 'active';
    } else {
      status = 'upcoming';
    }

    // Collect key milestones from roadmap weeks in this phase
    const phaseWeeks = weeks.filter(
      (w) => w.weekNumber >= phase.startWeek && w.weekNumber <= phase.endWeek,
    );
    const keyMilestones = phaseWeeks
      .map((w) => w.keyMilestone)
      .filter((m): m is string => Boolean(m));

    // Calculate execution score for completed phases
    let executionScore: number | null = null;
    if (status === 'completed') {
      const phaseTasks = tasks.filter(
        (t) => t.weekNumber >= phase.startWeek && t.weekNumber <= phase.endWeek && !t.isRestDay,
      );
      const completedCount = phaseTasks.filter((t) => t.status === 'completed').length;
      if (phaseTasks.length > 0) {
        executionScore = Math.round((completedCount / phaseTasks.length) * 100);
      }
    }

    const weekRange =
      phase.startWeek === phase.endWeek
        ? `Week ${phase.startWeek}`
        : `Weeks ${phase.startWeek}–${phase.endWeek}`;

    return {
      name: phase.name,
      weekRange,
      status,
      keyMilestones,
      executionScore,
    };
  });
}

const StatusIndicator: React.FC<{ status: PhaseStatus }> = ({ status }) => {
  if (status === 'completed') {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-accent/15 text-accent-hover">
        <Check aria-hidden="true" strokeWidth={2} className="size-3.5" />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="relative flex size-6 items-center justify-center">
        <span className="absolute inset-0 animate-pulse rounded-full border-2 border-accent/40" />
        <span className="size-2.5 rounded-full bg-accent" />
      </span>
    );
  }
  return (
    <span className="flex size-6 items-center justify-center">
      <Circle aria-hidden="true" strokeWidth={1.5} className="size-4 text-text-muted" />
    </span>
  );
};

/**
 * M8.2-R4: Phase & Milestone Progression.
 *
 * Groups roadmap weeks into phases and shows progression with
 * non-punitive reinforcement language (BP §18). Milestones celebrate
 * consistency and focus without shame framing for lower scores.
 */
export const PhaseMilestonesCard: React.FC<PhaseMilestonesCardProps> = ({ goal, className }) => {
  const phases = useMemo(() => derivePhases(goal), [goal]);

  return (
    <section aria-labelledby="phase-milestones-heading" className={cx('space-y-3', className)}>
      <h2 id="phase-milestones-heading" className="text-h3 text-text">
        Phase milestones
      </h2>
      <div className="space-y-2">
        {phases.map((phase, index) => (
          <div
            key={phase.name}
            className={cx(
              'rounded-card border bg-surface px-5 py-4 sm:px-6 sm:py-5 transition-colors duration-(--duration-quick)',
              phase.status === 'active'
                ? 'border-accent/25'
                : 'border-border',
            )}
          >
            <div className="flex items-start gap-3">
              <StatusIndicator status={phase.status} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-body font-medium text-text">{phase.name}</h3>
                  <span className="font-ui-mono text-micro uppercase text-text-muted">
                    {phase.weekRange}
                  </span>
                </div>

                {/* Status label */}
                <div className="flex flex-wrap items-center gap-2">
                  {phase.status === 'completed' && (
                    <span className="inline-flex items-center gap-1 font-ui-mono text-micro uppercase text-accent-hover">
                      Completed
                    </span>
                  )}
                  {phase.status === 'active' && (
                    <span className="inline-flex items-center gap-1 font-ui-mono text-micro uppercase text-accent-hover">
                      In progress
                    </span>
                  )}
                  {phase.status === 'upcoming' && (
                    <span className="inline-flex items-center gap-1 font-ui-mono text-micro uppercase text-text-muted">
                      Upcoming
                    </span>
                  )}
                  {phase.executionScore !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 font-ui-mono text-micro tabular-nums text-text-secondary">
                      {phase.executionScore}% execution
                    </span>
                  )}
                </div>

                {/* Key milestones */}
                {phase.keyMilestones.length > 0 && (
                  <ul className="space-y-0.5 pt-1">
                    {phase.keyMilestones.map((milestone, mIdx) => (
                      <li key={mIdx} className="flex items-start gap-2 text-small text-text-secondary">
                        <Minus
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className="mt-1 size-3 shrink-0 text-text-muted"
                        />
                        <span>{milestone}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Connector line between phases */}
            {index < phases.length - 1 && (
              <div className="ml-3 mt-2 h-3 w-px bg-border" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
