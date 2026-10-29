import React from 'react';
import type { FollowUpQuestion } from '../../types';
import { Button, ChoiceCard, ChoiceGroup, ErrorState, Field, Input, LoadingState, Skeleton } from '../ui';
import type { OnboardingError } from './requestErrors';
import { PageFrame } from './PageFrame';

interface StepQuestionProps {
  question: FollowUpQuestion;
  /** The wording shown: the question, or its easier retry after one skip. */
  shown: { question: string; subtitle: string };
  index: number;
  total: number;
  selected?: string;
  typed: string;
  skips: number;
  isSkipped: boolean;
  isResolved: boolean;
  goal: string;
  onChoose: (option: string) => void;
  onType: (text: string) => void;
  onSkip: () => void;
  onChangeGoal: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/** One of clarify's questions on its own page (ND-28): options, an answer in the person's own words, and skip. */
export const StepQuestion: React.FC<StepQuestionProps> = ({
  question,
  shown,
  index,
  total,
  selected,
  typed,
  skips,
  isSkipped,
  isResolved,
  goal,
  onChoose,
  onType,
  onSkip,
  onChangeGoal,
  onBack,
  onContinue,
}) => (
  <PageFrame
    eyebrow={`About you · ${index + 1} of ${total}`}
    title={shown.question}
    titleSize="h2"
    description={shown.subtitle || undefined}
    goal={goal}
    onChangeGoal={onChangeGoal}
    onBack={onBack}
    onContinue={onContinue}
    canContinue={isResolved}
    status={isResolved ? undefined : 'Choose an answer, write your own, or skip.'}
  >
    {isSkipped && <p className="mb-6 text-small text-text-secondary">You skipped this one. Choose an answer if you like, or carry on.</p>}
    <ChoiceGroup legend={shown.question} hideLegend value={typed ? undefined : selected} onChange={onChoose}>
      {question.options.map((option) => (
        <ChoiceCard key={option} value={option} title={option} />
      ))}
    </ChoiceGroup>
    {question.allowCustom && (
      <Field label="Or put it in your own words" className="mt-6">
        <Input value={typed} onChange={(e) => onType(e.target.value)} autoComplete="off" />
      </Field>
    )}
    <div className="mt-4 flex flex-wrap items-center gap-x-3">
      <Button variant="quiet" size="sm" onClick={onSkip} className="-ml-4">
        {skips === 0 ? 'Skip this' : 'Skip anyway'}
      </Button>
      <p aria-live="polite" className="text-small text-text-secondary">
        {skips === 1 && !isSkipped ? "Asked another way. Skip again if it still doesn't fit." : ''}
      </p>
    </div>
  </PageFrame>
);

/** Held in place of the questions while clarify reads the goal; usually it is back long before this page. */
export const StepQuestionsWaiting: React.FC<{
  goal: string;
  error: OnboardingError | null;
  onRetry: () => void;
  onChangeGoal: () => void;
  onBack: () => void;
}> = ({ goal, error, onRetry, onChangeGoal, onBack }) => (
  <PageFrame
    eyebrow="About you"
    title="A few questions about where you're starting"
    description="So your first week meets you where you are."
    goal={goal}
    onChangeGoal={onChangeGoal}
    onBack={onBack}
    onContinue={() => undefined}
    canContinue={false}
    loading={!error}
    status={error ? undefined : 'Preparing your questions. Your answers so far are kept.'}
  >
    {error ? (
      <ErrorState title={error.title} description={error.message} onRetry={onRetry} />
    ) : (
      <LoadingState showLabel label="Preparing your questions">
        <Skeleton className="mt-2 h-9 w-4/5" />
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-card" />
          ))}
        </div>
      </LoadingState>
    )}
  </PageFrame>
);
