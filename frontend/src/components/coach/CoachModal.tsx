import React from 'react';
import { Sparkles } from 'lucide-react';
import { Badge, Dialog, DialogContent } from '../ui';

interface CoachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CoachModal: React.FC<CoachModalProps> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-flex size-8 items-center justify-center rounded-full border border-achievement/40 bg-achievement/10 text-achievement">
            <Sparkles data-icon="inline-start" aria-hidden="true" />
          </span>
          Achivii Coach
        </span>
      }
      description="A thoughtful guide for the moments when you need another perspective."
      size="sm"
    >
      <div className="flex flex-col gap-5 text-small text-text-secondary">
        <Badge variant="outline" className="w-fit border-achievement/40 text-achievement">
          In Development
        </Badge>
        <p className="text-base leading-relaxed text-text">
          1-on-1 adaptive practice coaching, method-aware feedback, and guidance without algorithmic noise.
        </p>
        <p>Planned for a future release. Current members will receive early access.</p>
      </div>
    </DialogContent>
  </Dialog>
);

export type { CoachModalProps };

export default CoachModal;
