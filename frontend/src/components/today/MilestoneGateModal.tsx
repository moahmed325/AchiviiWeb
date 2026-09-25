import React from 'react';
import { Award } from 'lucide-react';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cx } from '../ui/cx';

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

export const MilestoneGateModal: React.FC<MilestoneGateModalProps> = ({ gate, onClose }) => {
  if (!gate) return null;

  return (
    <Dialog open={Boolean(gate)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={gate.title}
        size="sm"
        footer={
          <Button variant="primary" onClick={onClose} className="w-full sm:w-auto">
            Continue to {gate.nextPhase}
          </Button>
        }
      >
        <div className="space-y-4">
          <Badge tone="caution" icon={<Award aria-hidden="true" strokeWidth={1.5} className="size-3.5" />}>
            Milestone Reached
          </Badge>

          <p className="text-small text-text-secondary">
            You've completed the {gate.completedPhase} phase and unlocked {gate.nextPhase}!
          </p>

          <div className="rounded-card border border-border bg-surface p-4 text-small space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Transition</span>
              <span className="font-semibold text-text">
                {gate.completedPhase} → {gate.nextPhase}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Benchmark</span>
              <span className={cx('font-semibold', gate.benchmarkMet ? 'text-accent' : 'text-caution')}>
                {gate.benchmarkMet ? 'Passed ✓' : 'Adapted'}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MilestoneGateModal;
