import React, { useState } from 'react';
import { Flame, ArrowRight } from 'lucide-react';
import { Goal } from '../../types';
import { submitWeeklyReview } from '../../lib/api';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Field, Textarea } from '../ui/Field';
import { cx } from '../ui/cx';
import { MilestoneGateTransition } from './MilestoneGateModal';

export interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  token: string;
  onGoalUpdated: (goal: Goal) => void;
  onMilestoneGate?: (gate: MilestoneGateTransition) => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  goal,
  token,
  onGoalUpdated,
  onMilestoneGate,
}) => {
  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const currentWeekNum = goal.currentWeek || 1;
  const roadmapWeeks = goal.roadmapWeeks || [];
  const tasks = goal.dailyTasks || [];
  const currentWeekTasks = tasks.filter((t) => t.weekNumber === currentWeekNum);
  const activeDaysThisWeek = currentWeekTasks.filter((t) => !t.isRestDay);
  const completedDaysThisWeek = activeDaysThisWeek.filter((t) => t.status === 'completed');
  const weekScorePercent =
    activeDaysThisWeek.length > 0
      ? Math.round((completedDaysThisWeek.length / activeDaysThisWeek.length) * 100)
      : 0;

  const handleSubmit = async () => {
    if (isSubmitting || !token) return;
    setIsSubmitting(true);
    setReviewError(null);

    try {
      const response = await submitWeeklyReview(currentWeekNum, reflection, token);

      const updatedRoadmap = roadmapWeeks.map((w) => {
        if (w.weekNumber === currentWeekNum) {
          return { ...w, status: 'completed' as const, executionScore: response.scorePercentage };
        }
        if (response.nextWeekNumber && w.weekNumber === response.nextWeekNumber) {
          return { ...w, status: 'active' as const };
        }
        return w;
      });

      const updatedTasks = [
        ...tasks.filter((t) => t.weekNumber !== response.nextWeekNumber),
        ...(response.nextWeekTasks || []),
      ];

      onGoalUpdated({
        ...goal,
        currentWeek: response.nextWeekNumber || currentWeekNum,
        roadmapWeeks: updatedRoadmap,
        dailyTasks: updatedTasks,
      });

      if (response.isMilestoneCheckpoint && response.milestoneGateTransition) {
        onMilestoneGate?.(response.milestoneGateTransition);
      }

      onClose();
      setReflection('');
    } catch (err) {
      console.error('Review failed:', err);
      setReviewError(
        err instanceof Error
          ? err.message
          : "Couldn't write next week right now. This week is unchanged; please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        title={`Week ${currentWeekNum} Review`}
        size="md"
        footer={
          <>
            <Button variant="quiet" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting || !token}
              loading={isSubmitting}
              trailingIcon={!isSubmitting && <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            >
              {reviewError ? 'Try again' : `Start Week ${currentWeekNum + 1}`}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Score Card */}
          <div className="rounded-card border border-border bg-surface p-5 text-center">
            <div className="font-ui-mono text-micro uppercase text-text-secondary">This week</div>
            <div
              className={cx(
                'mt-1 font-mono text-numeral',
                weekScorePercent >= 85 ? 'text-accent' : 'text-caution'
              )}
            >
              {weekScorePercent}%
            </div>
            <div className="mt-1 text-small text-text-secondary">
              {completedDaysThisWeek.length} of {activeDaysThisWeek.length} sessions completed
            </div>

            <div className="mt-3 text-small">
              {weekScorePercent >= 85 ? (
                <p className="flex items-center justify-center gap-1.5 font-medium text-accent">
                  <Flame aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  <span>Great week! Next week will build on this momentum.</span>
                </p>
              ) : (
                <p className="font-medium text-caution">
                  Next week will adapt to help you build consistency.
                </p>
              )}
            </div>
          </div>

          {/* Reflection Input */}
          <div>
            <Field
              label="What worked? What could be better?"
              hint="Take a quiet moment to reflect on your practice."
            >
              <Textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="e.g. Morning sessions went well. Got distracted Thursday..."
                rows={3}
              />
            </Field>
            {reviewError && (
              <p role="alert" className="mt-3 text-small text-danger">
                {reviewError}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyReviewModal;
