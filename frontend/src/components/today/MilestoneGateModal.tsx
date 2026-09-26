import React from 'react';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { PhaseGateOutcomeCard } from '../review/PhaseGateOutcomeCard';

export interface MilestoneGateTransition {
  title: string;
  completedPhase: string;
  nextPhase: string;
  benchmarkMet: boolean;
}

export interface MilestoneGateModalProps {
  gate: MilestoneGateTransition | null;
  onClose: () => void;
}

/**
 * Milestone Gate Modal (Phase 7 — BP §18).
 * Upgraded with non-punitive PhaseGateOutcomeCard.
 */
export const MilestoneGateModal: React.FC<MilestoneGateModalProps> = ({ gate, onClose }) => {
  if (!gate) return null;

  return (
    <Dialog open={Boolean(gate)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={gate.title}
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose} className="min-h-[44px] w-full sm:w-auto">
            Continue to {gate.nextPhase}
          </Button>
        }
      >
        <PhaseGateOutcomeCard gate={gate} />
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneGateModal;
