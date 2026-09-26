import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Goal, WeeklyReviewResponse } from '../../types';
import { submitWeeklyReview } from '../../lib/api';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ReviewSummaryCard } from './ReviewSummaryCard';
import { ReviewReflectionStep } from './ReviewReflectionStep';
import { AdaptationMomentStep } from './AdaptationMomentStep';
import type { MilestoneGateTransition } from '../today/MilestoneGateModal';

export interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  token: string;
  onGoalUpdated: (goal: Goal) => void;
  onMilestoneGate?: (gate: MilestoneGateTransition) => void;
}

export type ReviewModalStep = 'review' | 'adaptation';

/**
 * Weekly Review Modal (Phase 7 — BP §17–19, §33, VDS §26).
 * Guides user through "How did this week go?", captures weekly reflection,
 * presents the post-submission Adaptation Moment showing that next week was
 * rebuilt from actual execution, and handles encouraging phase-gate milestones.
 */
export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  goal,
  token,
  onGoalUpdated,
  onMilestoneGate,
}) => {
  const [step, setStep] = useState<ReviewModalStep>('review');
  const [reflection, setReflection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [adaptationData, setAdaptationData] = useState<WeeklyReviewResponse | null>(null);
  const [updatedGoal, setUpdatedGoal] = useState<Goal | null>(null);

  const currentWeekNum = goal.currentWeek || 1;
  const roadmapWeeks = goal.roadmapWeeks || [];
  const activeWeek = roadmapWeeks.find((w) => w.weekNumber === currentWeekNum);
  const tasks = goal.dailyTasks || [];
  const currentWeekTasks = tasks.filter((t) => t.weekNumber === currentWeekNum);
  const activeDaysThisWeek = currentWeekTasks.filter((t) => !t.isRestDay);
  const completedDaysThisWeek = activeDaysThisWeek.filter((t) => t.status === 'completed');
  const weekScorePercent =
    activeDaysThisWeek.length > 0
      ? Math.round((completedDaysThisWeek.length / activeDaysThisWeek.length) * 100)
      : 0;

  const handleFinish = () => {
    if (updatedGoal) {
      onGoalUpdated(updatedGoal);
    }
    onClose();
    // Reset modal state
    setStep('review');
    setReflection('');
    setReviewError(null);
    setAdaptationData(null);
    setUpdatedGoal(null);
  };

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

      const nextGoal: Goal = {
        ...goal,
        currentWeek: response.nextWeekNumber || currentWeekNum,
        roadmapWeeks: updatedRoadmap,
        dailyTasks: updatedTasks,
      };

      setUpdatedGoal(nextGoal);
      setAdaptationData(response);

      if (response.isMilestoneCheckpoint && response.milestoneGateTransition) {
        onMilestoneGate?.(response.milestoneGateTransition);
      }

      // Transition to Step 2: Adaptation Moment (M7.3)
      setStep('adaptation');
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

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    if (isSubmitting) return;

    if (step === 'adaptation') {
      handleFinish();
    } else {
      onClose();
    }
  };

  const nextWeekNum = adaptationData?.nextWeekNumber;
  const nextRoadmapWeek = nextWeekNum ? roadmapWeeks.find((w) => w.weekNumber === nextWeekNum) : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        title={step === 'review' ? `Week ${currentWeekNum} Review` : `Week ${nextWeekNum ?? currentWeekNum} Adapted`}
        hideTitle={step === 'adaptation'}
        size="md"
        footer={
          step === 'review' ? (
            <>
              <Button
                variant="quiet"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !token}
                loading={isSubmitting}
                className="min-h-[44px]"
                trailingIcon={!isSubmitting && <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              >
                {reviewError ? 'Try again' : `Start Week ${currentWeekNum + 1}`}
              </Button>
            </>
          ) : null
        }
      >
        {step === 'review' ? (
          <div className="space-y-6">
            <ReviewSummaryCard
              scorePercentage={weekScorePercent}
              completedSessions={completedDaysThisWeek.length}
              totalActiveSessions={activeDaysThisWeek.length}
              theme={activeWeek?.theme}
              target={activeWeek?.target}
              test={activeWeek?.test}
            />

            <ReviewReflectionStep
              value={reflection}
              onChange={setReflection}
              error={reviewError}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <AdaptationMomentStep
            currentWeekNumber={currentWeekNum}
            nextWeekNumber={nextWeekNum ?? null}
            aiAdaptationInsight={adaptationData?.review.aiAdaptationInsight}
            nextWeekTasks={adaptationData?.nextWeekTasks}
            nextWeekTheme={nextRoadmapWeek?.theme}
            nextWeekTarget={nextRoadmapWeek?.target}
            milestoneGateTransition={adaptationData?.milestoneGateTransition}
            onContinue={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyReviewModal;
