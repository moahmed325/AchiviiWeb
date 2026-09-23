import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CommitmentItem, Goal, RoutineSettings } from '../types';
import { useOnboardingState } from './onboarding/useOnboardingState';
import { questionFlow } from './onboarding/questionFlow';
import { nextStep, previousStep, type FlowStep } from './onboarding/steps';
import {
  EMPTY_COMMITMENT_DRAFT,
  computeDaySchedule,
  type CustomCommitmentDraft,
  type EditingCommitmentSession
} from './onboarding/schedule';
import { OnboardingShell } from './onboarding/OnboardingShell';
import { JourneyRail, MobileProgress } from './onboarding/OnboardingProgress';
import { ConnectionNotice, STEP_HEADING_ID } from './onboarding/StepLayout';
import { StepGoal } from './onboarding/StepGoal';
import { StepQuestions } from './onboarding/StepQuestions';
import { StepSuccess } from './onboarding/StepSuccess';
import { StepSchedule } from './onboarding/StepSchedule';
import { RoutineTimeline } from './onboarding/RoutineTimeline';
import { CommitmentsPanel } from './onboarding/CommitmentsPanel';
import { StepReview } from './onboarding/StepReview';
import { StepGeneration } from './onboarding/StepGeneration';
import { CommitmentEditor } from './onboarding/CommitmentEditor';

interface OnboardingWizardProps {
  token: string;
  onGoalCreated: (goal: Goal) => void;
  initialGoal?: string;
  isPreset?: boolean;
  currentGoalId?: string | null;
  /** The app's health check couldn't reach Achivii when it loaded. */
  apiOffline?: boolean;
}

/**
 * Coordinates the onboarding steps. Flow state, history and API calls live in `useOnboardingState`, and the
 * create body in `payload.ts`; the step components only render and report what the user did.
 */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  token,
  onGoalCreated,
  initialGoal,
  isPreset,
  currentGoalId,
  apiOffline = false
}) => {
  const onboarding = useOnboardingState({ token, onGoalCreated, initialGoal, isPreset, currentGoalId });
  const {
    goalKind,
    order,
    step,
    setStep,
    goToStep,
    canJumpToStep,
    isStepComplete,
    rawGoal,
    isClarifying,
    clarificationError,
    isWaitingForClarification,
    connection,
    clarification,
    editedOutcome,
    setEditedOutcome,
    answers,
    customAnswers,
    questionGroups,
    answerFor,
    isSkipped,
    isResolved,
    routine,
    setRoutine,
    scheduleChosen,
    planSteps,
    generationError,
    startClarification,
    handleStartGoal,
    handleProceedFromSchedule,
    handleGeneratePlan,
  } = onboarding;

  // Held here rather than in the steps, so each survives leaving and returning to its step.
  const [isEditingOutcome, setIsEditingOutcome] = useState(false);
  const [customPracticeStartMins, setCustomPracticeStartMins] = useState<number | null>(null);
  const [editingCommitment, setEditingCommitment] = useState<EditingCommitmentSession | null>(null);
  const [commitmentDraft, setCommitmentDraft] = useState<CustomCommitmentDraft>(EMPTY_COMMITMENT_DRAFT);

  const daySchedule = useMemo(
    () => computeDaySchedule(routine, customPracticeStartMins),
    [routine, customPracticeStartMins]
  );

  const leave = (from: FlowStep, direction: 'next' | 'back') => {
    const target = direction === 'next' ? nextStep(goalKind, from) : previousStep(goalKind, from);
    if (target) goToStep(target);
  };
  const startingFlow = questionFlow(onboarding, questionGroups.starting, () => leave('starting', 'next'));
  const successFlow = questionFlow(onboarding, questionGroups.success, () => leave('success', 'next'));

  const displayOutcome = editedOutcome || clarification?.clarifiedOutcome || rawGoal;

  const toggleEditingOutcome = () => {
    if (isEditingOutcome && !editedOutcome.trim()) setEditedOutcome(clarification?.clarifiedOutcome || rawGoal);
    setIsEditingOutcome(!isEditingOutcome);
  };

  // The step's own error already says Achivii can't be reached; the notice covers every other step.
  const offline = connection === 'offline' || (apiOffline && connection !== 'online');
  const errorOnStep = Boolean(clarificationError) && (step === 'starting' || step === 'schedule');

  // A new step starts at its heading, at the top of the page. The first render keeps the browser's focus.
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo(0, 0);
    document.getElementById(STEP_HEADING_ID)?.focus({ preventScroll: true });
  }, [step]);

  const placePractice = (startMins: number) => {
    setCustomPracticeStartMins(startMins);
    const finalSlot = startMins < 720 ? 'morning' : startMins < 1020 ? 'afternoon' : 'evening';
    setRoutine((prev) => ({ ...prev, preferredSlot: finalSlot }));
  };

  const chooseSlot = (slot: RoutineSettings['preferredSlot']) => {
    setCustomPracticeStartMins(null);
    setRoutine((prev) => ({
      ...prev,
      preferredSlot: slot
    }));
  };

  const editCommitment = (item: CommitmentItem) => setEditingCommitment({ item: { ...item }, isNew: false });

  // A new commitment is only added to the routine once the user clicks Done in the editor.
  const addCommitment = (item: CommitmentItem) => setEditingCommitment({ item, isNew: true });

  const removeCommitment = (id: string) => {
    setRoutine((prev) => ({
      ...prev,
      commitments: (prev.commitments || []).filter((c) => c.id !== id)
    }));
  };

  const saveCommitment = (finalItem: CommitmentItem) => {
    if (editingCommitment?.isNew) {
      setRoutine((prev) => ({
        ...prev,
        commitments: [...(prev.commitments || []), finalItem]
      }));
    } else {
      setRoutine((prev) => ({
        ...prev,
        commitments: (prev.commitments || []).map((c) =>
          c.id === finalItem.id ? finalItem : c
        )
      }));
    }
    setEditingCommitment(null);
  };

  const deleteCommitment = () => {
    if (editingCommitment && !editingCommitment.isNew) {
      removeCommitment(editingCommitment.item.id);
    }
    setEditingCommitment(null);
  };

  // Generation is not a wizard step: no progress rail, and history stays locked (R-18).
  if (step === 'generation') {
    return (
      <div className="ui-root flex w-full flex-1 flex-col bg-background text-text">
        <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-gutter py-10 sm:py-16">
          <StepGeneration
            planSteps={planSteps}
            generationError={generationError}
            onReviewInputs={() => setStep('review')}
            onRetry={handleGeneratePlan}
          />
        </main>
      </div>
    );
  }

  const changeGoal = () => goToStep('goal');

  return (
    <OnboardingShell
      step={step}
      goal={rawGoal}
      rail={
        <JourneyRail
          order={order}
          step={step}
          canJumpToStep={canJumpToStep}
          isStepComplete={isStepComplete}
          onSelectStep={goToStep}
        />
      }
    >
      <MobileProgress order={order} step={step} />

      {offline && !errorOnStep && <ConnectionNotice className="mt-6 lg:mt-0 lg:mb-10" />}

      <div key={step} className="mt-8 animate-rise-in lg:mt-0">
        {step === 'goal' && <StepGoal rawGoal={rawGoal} onStartGoal={handleStartGoal} />}

        {step === 'starting' && (
          <StepQuestions
            flow={startingFlow}
            rawGoal={rawGoal}
            answers={answers}
            customAnswers={customAnswers}
            isSkipped={isSkipped}
            isResolved={isResolved}
            isLoading={isClarifying || !clarification}
            clarificationError={clarificationError}
            isRetrying={isClarifying}
            onRetry={() => startClarification(rawGoal, true)}
            onChangeGoal={changeGoal}
            onBack={() => leave('starting', 'back')}
          />
        )}

        {step === 'success' && (
          <StepSuccess
            flow={successFlow}
            rawGoal={rawGoal}
            outcome={editedOutcome}
            displayOutcome={displayOutcome}
            onOutcomeChange={setEditedOutcome}
            isEditingOutcome={isEditingOutcome}
            onToggleEditingOutcome={toggleEditingOutcome}
            answers={answers}
            customAnswers={customAnswers}
            isSkipped={isSkipped}
            isResolved={isResolved}
            onChangeGoal={changeGoal}
            onBack={() => leave('success', 'back')}
          />
        )}

        {step === 'schedule' && (
          <StepSchedule
            rawGoal={rawGoal}
            routine={routine}
            onRoutineChange={setRoutine}
            onChooseSlot={chooseSlot}
            timeline={
              <RoutineTimeline
                routine={routine}
                customPracticeStartMins={customPracticeStartMins}
                onPlacePractice={placePractice}
                onEditCommitment={editCommitment}
              />
            }
            commitments={
              <CommitmentsPanel
                routine={routine}
                placedCommitments={daySchedule.placedCommitmentsMap}
                draft={commitmentDraft}
                onDraftChange={setCommitmentDraft}
                onAddCommitment={addCommitment}
                onEditCommitment={editCommitment}
                onRemoveCommitment={removeCommitment}
              />
            }
            scheduleChosen={scheduleChosen}
            isWaitingForClarification={isWaitingForClarification}
            clarificationError={clarificationError}
            isClarifying={isClarifying}
            onRetryClarification={() => startClarification(rawGoal, true)}
            onChangeGoal={changeGoal}
            onBack={() => leave('schedule', 'back')}
            onContinue={handleProceedFromSchedule}
          />
        )}

        {step === 'review' && clarification && (
          <StepReview
            rawGoal={rawGoal}
            clarification={clarification}
            displayOutcome={displayOutcome}
            startingQuestions={questionGroups.starting}
            successQuestions={questionGroups.success}
            answerFor={answerFor}
            routine={routine}
            practiceTimeLabel={daySchedule.practiceTimeLabel}
            onEditOutcome={() => goToStep('success', true, 0)}
            onEditStartingPoint={() => goToStep('starting', true, 0)}
            onEditSchedule={() => goToStep('schedule')}
            onChangeGoal={changeGoal}
            onBack={() => leave('review', 'back')}
            onGenerate={handleGeneratePlan}
          />
        )}
      </div>

      <CommitmentEditor
        session={editingCommitment}
        placedCommitments={daySchedule.placedCommitmentsMap}
        onItemChange={(patch) =>
          setEditingCommitment((prev) => (prev ? { ...prev, item: { ...prev.item, ...patch } } : null))
        }
        onSave={saveCommitment}
        onDelete={deleteCommitment}
        onClose={() => setEditingCommitment(null)}
      />
    </OnboardingShell>
  );
};

export default OnboardingWizard;
