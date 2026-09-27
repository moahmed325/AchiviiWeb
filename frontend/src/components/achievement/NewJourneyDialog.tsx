import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Compass, ShieldCheck } from 'lucide-react';
import type { Goal } from '../../types';
import { formatAchievementDate } from '../../lib/achievement';
import { Button } from '../ui/Button';
import { Dialog, DialogContent } from '../ui/Dialog';

export interface NewJourneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal;
  onConfirm?: () => void;
}

/**
 * NewJourneyDialog (BP §34, R-15).
 * Dignified confirmation modal triggered by "Begin another journey".
 * Reassures the user that their completed 90-day journey is safely preserved in history,
 * then guides them into onboarding to select their next pathway.
 */
export const NewJourneyDialog: React.FC<NewJourneyDialogProps> = ({
  open,
  onOpenChange,
  goal,
  onConfirm,
}) => {
  const navigate = useNavigate();

  const handleChooseNextPathway = () => {
    onOpenChange(false);
    if (onConfirm) {
      onConfirm();
    } else {
      navigate('/onboarding', {
        state: {
          switchGoal: true,
          fromCompletedGoal: true,
        },
      });
    }
  };

  const formattedCompletedAt = formatAchievementDate(goal.completedAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Begin Your Next Journey"
        description="Your completed 90-day journey is permanently preserved in your archives. Starting another journey will open pathway selection to plan your next ambition."
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Stay in the Garden
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleChooseNextPathway}
              trailingIcon={<Compass aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            >
              Choose Next Pathway
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-1 text-left">
          {/* Completed Goal Summary Card */}
          <div className="rounded-card border border-achievement/30 bg-surface p-4 sm:p-5 space-y-2">
            <div className="flex items-center gap-2 font-ui-mono text-micro uppercase tracking-wider text-achievement">
              <CheckCircle2 aria-hidden="true" strokeWidth={1.75} className="size-3.5 shrink-0" />
              <span>Completed 90-Day Journey</span>
            </div>
            <h3 className="text-body font-semibold text-text break-words">
              {goal.rawGoal}
            </h3>
            {goal.clarifiedOutcome && (
              <p className="text-small text-text-secondary line-clamp-2">
                {goal.clarifiedOutcome}
              </p>
            )}
            <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-micro font-ui-mono text-text-muted border-t border-border/60">
              <span>Path: 90 Days</span>
              {formattedCompletedAt && <span>Completed: {formattedCompletedAt}</span>}
            </div>
          </div>

          {/* Succession Safety Reassurance (R-15) */}
          <div className="flex items-start gap-3 rounded-card border border-border bg-surface-elevated/50 p-4 text-small text-text-secondary">
            <ShieldCheck aria-hidden="true" strokeWidth={1.5} className="size-5 shrink-0 text-accent mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-text font-medium">Permanently Preserved: </strong>
              Your practice history, reflections, and benchmark test results remain intact in your personal
              archive. Creating a new journey activates a fresh 90-day path without overwriting your past achievement.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
