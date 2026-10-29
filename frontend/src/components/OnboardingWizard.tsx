import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CommitmentItem, Goal } from '../types';
import type { NextPlanLaunch } from '../lib/nextPlan';
import { findPathwayByTitle } from '../lib/certifiedPresets';
import { suggestedMinutes } from '../lib/planPreview';
import { weeksBefore } from '../lib/planLength';
import { useOnboardingState } from './onboarding/useOnboardingState';
import { isEssentialPage, isQuestionPage } from './onboarding/pages';
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
import { EssentialStep } from './onboarding/EssentialPages';
import { StepFocus } from './onboarding/StepFocus';
import { StepQuestion, StepQuestionsWaiting } from './onboarding/StepQuestion';
import { StepSummary } from './onboarding/StepSummary';
import { CommitmentsPanel } from './onboarding/CommitmentsPanel';
import { StepGeneration } from './onboarding/StepGeneration';
import { CommitmentEditor } from './onboarding/CommitmentEditor';

interface OnboardingWizardProps {
  /** Null for a visitor, who signs up from the summary (ND-28). */
  token: string | null;
  onGoalCreated: (goal: Goal) => void;
  onSignUp?: () => void;
  initialGoal?: string;
  currentGoalId?: string | null;
  /** Next plan (NP-3): set when this plan continues an earlier one. */
  nextPlan?: NextPlanLaunch | null;
  /** B-106: the fixed date to fill in, from the plan a fresh or next plan follows. */
  initialFixedDate?: string;
  /** The app's health check couldn't reach Achivii when it loaded. */
  apiOffline?: boolean;
}

/**
 * Coordinates the onboarding pages (ND-28). Flow state, history and API calls live in `useOnboardingState`, and the
 * create body in `payload.ts`; the page components only render and report what the person did.
 */
export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  token,
  onGoalCreated,
  onSignUp,
  initialGoal,
  currentGoalId,
  nextPlan = null,
  initialFixedDate,
  apiOffline = false
}) => {
  const onboarding = useOnboardingState({ token, onGoalCreated, onSignUp, initialGoal, currentGoalId, nextPlan, initialFixedDate });
  const {
    pages,
    screen,
    page,
    setScreen,
    goToPage,
    continueFrom,
    goBack,
    isPageComplete,
    typedGoal,
    rawGoal,
    submitGoal,
    clarificationError,
    connection,
    clarification,
    focusChosen,
    focusOptions,
    chooseFocus,
    editedOutcome,
    setEditedOutcome,
    answers,
    customAnswers,
    skipCounts,
    questionList,
    questionFor,
    isSkipped,
    isResolved,
    shownQuestion,
    chooseAnswer,
    typeAnswer,
    skipQuestion,
    routine,
    setRoutine,
    shownRestWeekdays,
    fixedDate,
    setFixedDate,
    fixedDateCheck,
    today,
    planSteps,
    generationError,
    startClarification,
    handleGeneratePlan,
  } = onboarding;

  // Held here rather than in the page, so it survives leaving and returning to the page.
  const [editingCommitment, setEditingCommitment] = useState<EditingCommitmentSession | null>(null);
  const [commitmentDraft, setCommitmentDraft] = useState<CustomCommitmentDraft>(EMPTY_COMMITMENT_DRAFT);
  const daySchedule = useMemo(() => computeDaySchedule(routine, null), [routine]);

  // The connection notice covers every page but the one already showing clarify's own error.
  const offline = connection === 'offline' || (apiOffline && connection !== 'online');
  const errorOnPage = Boolean(clarificationError) && page === 'questions';

  // A new page starts at its heading, at the top of the page. The first render keeps the browser's focus.
  const shownScreen = useRef(screen);
  useEffect(() => {
    if (shownScreen.current === screen) return;
    shownScreen.current = screen;
    window.scrollTo(0, 0);
    document.getElementById(STEP_HEADING_ID)?.focus({ preventScroll: true });
  }, [screen]);

  const editCommitment = (item: CommitmentItem) => setEditingCommitment({ item: { ...item }, isNew: false });
  // A new commitment is only added to the routine once the person clicks Done in the editor.
  const addCommitment = (item: CommitmentItem) => setEditingCommitment({ item, isNew: true });
  const removeCommitment = (id: string) =>
    setRoutine((prev) => ({ ...prev, commitments: (prev.commitments || []).filter((c) => c.id !== id) }));
  const saveCommitment = (finalItem: CommitmentItem) => {
    setRoutine((prev) => ({
      ...prev,
      commitments: editingCommitment?.isNew
        ? [...(prev.commitments || []), finalItem]
        : (prev.commitments || []).map((c) => (c.id === finalItem.id ? finalItem : c)),
    }));
    setEditingCommitment(null);
  };
  const deleteCommitment = () => {
    if (editingCommitment && !editingCommitment.isNew) removeCommitment(editingCommitment.item.id);
    setEditingCommitment(null);
  };

  // Generation is not a page: no progress rail, and history stays locked (R-18).
  if (screen === 'generation' || !page) {
    return (
      <div className="ui-root flex w-full flex-1 flex-col bg-background text-text">
        <main id="main" className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-gutter py-10 sm:py-16">
          <StepGeneration
            planSteps={planSteps}
            generationError={generationError}
            onReviewInputs={() => setScreen('summary')}
            onRetry={handleGeneratePlan}
            onChooseGoal={() => setScreen('goal')}
          />
        </main>
      </div>
    );
  }

  const changeGoal = () => goToPage('goal');
  const pathway = findPathwayByTitle(rawGoal);
  const question = questionFor(page);
  const questionIndex = question && questionList ? questionList.indexOf(question) : -1;

  return (
    <OnboardingShell page={page} goal={rawGoal} onChangeGoal={changeGoal} rail={<JourneyRail pages={pages} page={page} />}>
      <MobileProgress pages={pages} page={page} />

      {offline && !errorOnPage && <ConnectionNotice className="mt-6 lg:mt-0 lg:mb-10" />}

      <div key={page} className="mt-8 animate-rise-in motion-reduce:animate-none lg:mt-0">
        {page === 'goal' && <StepGoal rawGoal={typedGoal} onStartGoal={submitGoal} />}

        {isEssentialPage(page) && (
          <EssentialStep
            page={page}
            goal={rawGoal}
            routine={routine}
            onRoutineChange={setRoutine}
            restWeekdays={shownRestWeekdays}
            suggestedMinutes={pathway ? suggestedMinutes(pathway) : undefined}
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
            fixedDate={fixedDate}
            fixedDateCheck={fixedDateCheck}
            today={today}
            onFixedDateChange={setFixedDate}
            canContinue={isPageComplete(page)}
            onChangeGoal={changeGoal}
            onBack={() => goBack(page)}
            onContinue={() => continueFrom(page)}
          />
        )}

        {page === 'focus' && focusOptions && (
          <StepFocus
            goal={typedGoal}
            options={focusOptions}
            chosen={focusChosen ? rawGoal : undefined}
            onChoose={(goal) => {
              chooseFocus(goal);
              continueFrom('focus');
            }}
            onChangeGoal={changeGoal}
            onBack={() => goBack('focus')}
          />
        )}

        {page === 'questions' && (
          <StepQuestionsWaiting
            goal={rawGoal}
            error={clarificationError}
            onRetry={() => startClarification(rawGoal)}
            onChangeGoal={changeGoal}
            onBack={() => goBack('questions')}
          />
        )}

        {isQuestionPage(page) && question && questionList && (
          <StepQuestion
            question={question}
            shown={shownQuestion(question)}
            index={questionIndex}
            total={questionList.length}
            selected={answers[question.id]}
            typed={customAnswers[question.id] || ''}
            skips={skipCounts[question.id] || 0}
            isSkipped={isSkipped(question)}
            isResolved={isResolved(question)}
            goal={rawGoal}
            onChoose={(option) => chooseAnswer(question, option)}
            onType={(text) => typeAnswer(question, text)}
            onSkip={() => skipQuestion(question)}
            onChangeGoal={changeGoal}
            onBack={() => goBack(page)}
            onContinue={() => continueFrom(page)}
          />
        )}

        {page === 'summary' && (
          <StepSummary
            outcome={editedOutcome}
            defaultOutcome={clarification?.clarifiedOutcome || rawGoal}
            onOutcomeChange={setEditedOutcome}
            routine={routine}
            weeks={fixedDateCheck === 'short' ? weeksBefore(today, fixedDate) : 12}
            fixedDate={fixedDate}
            signedIn={Boolean(token)}
            onBack={() => goBack('summary')}
            onStart={handleGeneratePlan}
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
