import React from 'react';
import { Button, Dialog, DialogContent } from '../ui';

interface CoachModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * An honest informational modal for Achivii Coach (ND-11, ND-7).
 * No fake chat UI, no mock messages, no checkout buttons — only a clear explanation
 * of the coaching vision and its current "In development" status.
 */
export const CoachModal: React.FC<CoachModalProps> = ({ isOpen, onClose }) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent
      title="Achivii Coach"
      description="Your companion for the journey ahead."
      closeLabel="Close Coach details"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Back to Practice
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Premium eyebrow */}
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-achievement/25 bg-achievement/[0.06] px-3 py-1 font-ui-mono text-micro uppercase tracking-[0.16em] text-achievement">
          ✦ Coming Soon
        </span>

        {/* Status pill */}
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-achievement/60" aria-hidden="true" />
          <span className="text-small text-text-secondary">In development</span>
        </div>

        {/* Value proposition */}
        <div className="flex flex-col gap-4 text-body text-text-secondary">
          <p>
            Achivii Coach is being designed as your 1-on-1 companion — adaptive practice accountability and milestone
            guidance, deeply aligned with your specific 90-day pathway and weekly benchmarks.
          </p>
          <p>
            Guidance rooted in proven mastery methods, not algorithmic distraction. A coaching presence that knows your
            plan, understands your progress, and meets you where you are each week.
          </p>
        </div>

        {/* Availability note */}
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-small text-text-secondary">
            Coach is actively being designed and refined for a future release. As a current Achivii member, you will be
            among the first to access companion coaching when it launches.
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
