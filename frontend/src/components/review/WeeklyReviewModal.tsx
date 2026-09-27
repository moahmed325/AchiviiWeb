import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Goal, WeeklyReviewResponse, WeeklyTestResult } from '../../types';
import { submitWeeklyReview } from '../../lib/api';
import {
  clearReviewDraft,
  loadReviewDraft,
  loadTestResultDraft,
  saveReviewDraft,
  saveTestResultDraft,
} from '../../lib/reviewDraft';
import { Dialog, DialogContent } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { ReviewSummaryCard } from './ReviewSummaryCard';
import { ReviewTestResultStep } from './ReviewTestResultStep';
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
  apiStatus?: 'online' | 'offline' | 'checking';
}

export type ReviewModalStep = 'review' | 'adaptation';

/**
 * Weekly Review Modal (Phase 7 — BP §17–19, §33, VDS §26, OD-1a).
 * Guides user through "How did this week go?", captures weekly reflection and
 * optional benchmark test result with target comparison, persists drafts across
 * reloads/dismissals, handles 503/offline retry recovery, presents the post-submission
 * Adaptation Moment showing that next week was rebuilt from actual execution,
 * and handles encouraging phase-gate milestones.
 */
export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({
  isOpen,
  onClose,
  goal,
  token,
  onGoalUpdated,
  onMilestoneGate,
  apiStatus,
}) => {
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

  const [step, setStep] = useState<ReviewModalStep>('review');
  const [reflection, setReflection] = useState(() =>
    goal?.id ? loadReviewDraft(goal.id, currentWeekNum) : ''
  );
  const [testResult, setTestResult] = useState<WeeklyTestResult | null>(() =>
    goal?.id ? loadTestResultDraft(goal.id, currentWeekNum) : null
  );
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [adaptationData, setAdaptationData] = useState<WeeklyReviewResponse | null>(null);
  const [updatedGoal, setUpdatedGoal] = useState<Goal | null>(null);

  // Sync draft reflection and test result when modal opens
  if (isOpen !== prevOpen) {
    setPrevOpen(isOpen);
    if (isOpen && goal?.id) {
      if (!reflection) {
        const saved = loadReviewDraft(goal.id, currentWeekNum);
        if (saved) {
          setReflection(saved);
        }
      }
      if (!testResult) {
        const savedTest = loadTestResultDraft(goal.id, currentWeekNum);
        if (savedTest) {
          setTestResult(savedTest);
        }
      }
    }
  }

  const handleReflectionChange = (val: string) => {
    setReflection(val);
    if (goal?.id) {
      saveReviewDraft(goal.id, currentWeekNum, val);
    }
  };

  const handleTestResultChange = (val: WeeklyTestResult | null) => {
    setTestResult(val);
    if (goal?.id) {
      saveTestResultDraft(goal.id, currentWeekNum, val);
    }
  };

  const handleFinish = () => {
    if (updatedGoal) {
      onGoalUpdated(updatedGoal);
    }
    onClose();
    // Reset modal state
    setStep('review');
    setReflection('');
    setTestResult(null);
    setReviewError(null);
    setAdaptationData(null);
    setUpdatedGoal(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting || !token) return;

    const isOffline =
      apiStatus === 'offline' ||
      (typeof navigator !== 'undefined' && !navigator.onLine);

    if (isOffline) {
      setReviewError("You're offline. Reconnect to submit your weekly review.");
      return;
    }

    setIsSubmitting(true);
    setReviewError(null);

    try {
      const response = testResult
        ? await submitWeeklyReview(currentWeekNum, reflection, token, testResult)
        : await submitWeeklyReview(currentWeekNum, reflection, token);

      const updatedRoadmap = roadmapWeeks.map((w) => {
        if (w.weekNumber === currentWeekNum) {
          return {
            ...w,
            status: 'completed' as const,
            executionScore: response.scorePercentage,
            testResult: response.testResult ?? testResult ?? w.testResult,
          };
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

      // Clear draft reflection and testResult upon successful submission and transition to adaptation
      if (goal?.id) {
        clearReviewDraft(goal.id, currentWeekNum);
      }

      if (response.isMilestoneCheckpoint && response.milestoneGateTransition) {
        onMilestoneGate?.(response.milestoneGateTransition);
      }

      // Transition to Step 2: Adaptation Moment (M7.3)
      setStep('adaptation');
    } catch (err: unknown) {
      console.error('Review failed:', err);
      const isNetworkError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) ||
        (err instanceof Error && /network|offline|failed to fetch/i.test(err.message));

      if (isNetworkError) {
        setReviewError("You're offline. Reconnect to submit your weekly review.");
      } else {
        const message = err instanceof Error ? err.message : '';
        if (
          message.includes('503') ||
          message.includes("Couldn't write next week") ||
          message.includes('adaptation') ||
          !message
        ) {
          setReviewError("Couldn't write next week right now. This week is unchanged; please try again.");
        } else {
          setReviewError(message);
        }
      }
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
  const isClosingStretch =
    (adaptationData ? adaptationData.nextWeekNumber === null : false) || currentWeekNum >= 12;
  const nextRoadmapWeek = nextWeekNum ? roadmapWeeks.find((w) => w.weekNumber === nextWeekNum) : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        title={
          step === 'review'
            ? `Week ${currentWeekNum} Review`
            : isClosingStretch
            ? 'Closing Stretch Ready'
            : `Week ${nextWeekNum ?? currentWeekNum} Adapted`
        }
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
                {reviewError
                  ? 'Try again'
                  : currentWeekNum >= 12
                  ? 'Enter Closing Stretch'
                  : `Start Week ${currentWeekNum + 1}`}
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

            <ReviewTestResultStep
              target={activeWeek?.target}
              test={activeWeek?.test}
              testResult={testResult}
              onChange={handleTestResultChange}
              disabled={isSubmitting}
            />

            <ReviewReflectionStep
              value={reflection}
              onChange={handleReflectionChange}
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
            currentWeekTarget={activeWeek?.target}
            testResult={adaptationData?.testResult ?? testResult}
            milestoneGateTransition={adaptationData?.milestoneGateTransition}
            onContinue={handleFinish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyReviewModal;
