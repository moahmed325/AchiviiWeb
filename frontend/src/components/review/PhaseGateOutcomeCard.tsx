import React from 'react';
import { CheckCircle2, Compass } from 'lucide-react';
import { cx } from '../ui/cx';
import type { MilestoneGateTransition } from '../today/MilestoneGateModal';

export interface PhaseGateOutcomeCardProps {
  gate: MilestoneGateTransition;
  className?: string;
}

/**
 * Phase-Gate Outcome Card (Phase 7 — BP §18).
 * Enforces the non-punitive philosophy: "Adapt the journey, don't punish the person".
 * Replaces clinical benchmark pass/fail framing with encouraging phase consolidation guidance.
 */
export const PhaseGateOutcomeCard: React.FC<PhaseGateOutcomeCardProps> = ({
  gate,
  className,
}) => {
  const { benchmarkMet, completedPhase, nextPhase } = gate;

  return (
    <div
      className={cx(
        'rounded-card border p-4 sm:p-5 text-left transition-colors',
        benchmarkMet
          ? 'border-accent/40 bg-accent/[0.04]'
          : 'border-border bg-surface',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {benchmarkMet ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-micro font-medium text-accent">
            <CheckCircle2 aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
            <span>Milestone Achieved</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-elevated px-2.5 py-0.5 text-micro font-medium text-text-secondary">
            <Compass aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
            <span>Phase Consolidation</span>
          </div>
        )}
      </div>

      <h3 className="text-body font-semibold text-text">
        {benchmarkMet ? `${completedPhase} Complete` : `${completedPhase} Review`}
      </h3>

      <div className="mt-2 space-y-1.5 text-small">
        {benchmarkMet ? (
          <p className="text-text-secondary">
            You've built strong consistency across this phase and unlocked{' '}
            <span className="font-medium text-text">{nextPhase}</span>. Next week begins the next stage of your journey.
          </p>
        ) : (
          <>
            <p className="font-medium text-text">
              Your current results suggest we should reinforce this phase.
            </p>
            <p className="text-text-secondary">
              The path has adapted to give you space to consolidate your fundamentals before advancing.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PhaseGateOutcomeCard;
