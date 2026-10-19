import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Goal, WeeklyReviewResponse, WeeklyTestResult } from '../../types';
import { saveClosedWeekReflection, submitWeeklyReview } from '../../lib/api';
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
import { isRestLike } from '../../lib/today';

export interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: Goal;
  token: string;
  onGoalUpdated: (goal: Goal) => void;
  onMilestoneGate?: (gate: MilestoneGateTransition) => void;
  /** B-59: the week was already closed (another tab, or the automatic close); called when the modal closes. */
  onWeekClosed?: () => void;
  /** Weekly update M1.5b (WU-38 (1)): a break past the limit waits for the choice card; the modal closes at once. */
  onChoiceNeeded?: () => void;
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
  onWeekClosed,
  onChoiceNeeded,
  apiStatus,
}) => {
  const currentWeekNum = goal.currentWeek || 1;
  const roadmapWeeks = goal.roadmapWeeks || [];
  const activeWeek = roadmapWeeks.find((w) => w.weekNumber === currentWeekNum);
  const tasks = goal.dailyTasks || [];
  const currentWeekTasks = tasks.filter((t) => t.weekNumber === currentWeekNum);
  const activeDaysThisWeek = currentWeekTasks.filter((t) => !isRestLike(t));
  const completedDaysThisWeek = activeDaysThisWeek.filter((t) => t.status === 'completed');
  // WU-33 (3): a week whose every practice day was not offered has no score (shown as not counted, never 0%).
  const notCounted = activeDaysThisWeek.length === 0 && currentWeekTasks.some((t) => t.notOffered);
  const weekScorePercent = notCounted
    ? null
    : activeDaysThisWeek.length > 0
      ? Math.round((completedDaysThisWeek.length / activeDaysThisWeek.length) * 100)
      : 0;

  const [step, setStep] = useState<ReviewModalStep>('review');
  const [reflection, setReflection] = useState(() =>
    goal?.id ? loadReviewDraft(goal.id, currentWeekNum) : ''
  );
  // M4.1: a result logged earlier (stored on the week) comes first, then the local draft.
  const storedTestResult = activeWeek?.testResult ?? null;
  const [testResult, setTestResult] = useState<WeeklyTestResult | null>(() =>
    storedTestResult ?? (goal?.id ? loadTestResultDraft(goal.id, currentWeekNum) : null)
  );
  const [prevStored, setPrevStored] = useState(storedTestResult);
  const [prevOpen, setPrevOpen] = useState(isOpen);

  // A result logged after this modal mounted (the late-test card) replaces what the step holds.
  if (storedTestResult !== prevStored) {
    setPrevStored(storedTestResult);
    if (storedTestResult) setTestResult(storedTestResult);
  }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  // B-59: the server answered 409 `week_closed`; nothing is left to submit, and the goal is reloaded on close.
  const [weekClosed, setWeekClosed] = useState(false);
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
        const savedTest = storedTestResult ?? loadTestResultDraft(goal.id, currentWeekNum);
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
            // WU-33 (3): a review row of 0 planned has no score; the week keeps none.
            executionScore: response.review?.tasksPlanned === 0 ? undefined : response.scorePercentage,
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

      if ((err as { code?: unknown } | null)?.code === 'choice_needed') {
        // M1.5b (WU-38 (1)): nothing was saved; the draft stays, and the goal is reloaded so Today shows the card.
        onClose();
        onChoiceNeeded?.();
      } else if ((err as { code?: unknown } | null)?.code === 'week_closed') {
        // WU-31: when the week closed on its own (another tab's load), the typed reflection is saved onto it. The
        // server saves it only for a week closed automatically with no reflection yet; anything else is M1.2a's case.
        let reflectionSaved = false;
        // The draft goes once the reflection is saved, refused for good, or empty; a network error or a 5xx keeps it.
        let draftDone = !reflection.trim();
        if (reflection.trim()) {
          try {
            await saveClosedWeekReflection(currentWeekNum, reflection, token);
            reflectionSaved = true;
            draftDone = true;
          } catch (saveErr) {
            console.warn('The reflection was not saved onto the closed week:', saveErr);
            const code = (saveErr as { code?: unknown } | null)?.code;
            draftDone = code === 'not_auto_closed' || code === 'reflection_saved';
          }
        }
        setWeekClosed(true);
        setReviewError(reflectionSaved ? 'This week had already closed. Your reflection is saved.' : "This week's review is already saved.");
        if (draftDone && goal?.id) clearReviewDraft(goal.id, currentWeekNum);
      } else if (isNetworkError) {
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

  const handleClose = () => {
    onClose();
    if (weekClosed) {
      setWeekClosed(false);
      setReviewError(null);
      onWeekClosed?.();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) return;
    if (isSubmitting) return;

    if (step === 'adaptation') {
      handleFinish();
    } else {
      handleClose();
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
                onClick={handleClose}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={weekClosed ? handleClose : handleSubmit}
                disabled={isSubmitting || !token}
                loading={isSubmitting}
                className="min-h-[44px]"
                trailingIcon={!isSubmitting && !weekClosed && <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              >
                {weekClosed
                  ? 'Done'
                  : reviewError
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
