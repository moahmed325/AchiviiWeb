import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { FollowUpQuestion } from '../../types';
import { Button, ErrorState, LoadingState, Skeleton } from '../ui';
import type { QuestionFlow } from './questionFlow';
import type { OnboardingError } from './requestErrors';
import { QuestionCard } from './QuestionCard';
import { GoalContext, StepFooter, StepHeader } from './StepLayout';

interface StepQuestionsProps {
  flow: QuestionFlow;
  rawGoal: string;
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
  isSkipped: (q: FollowUpQuestion) => boolean;
  isResolved: (q: FollowUpQuestion) => boolean;
  /** On a pathway this step can open before clarify has answered. */
  isLoading: boolean;
  clarificationError: OnboardingError | null;
  isRetrying: boolean;
  onRetry: () => void;
  onChangeGoal: () => void;
  /** Leaves the step backwards, from its first question. */
  onBack: () => void;
}

export const QuestionsLoading: React.FC = () => (
  <LoadingState showLabel label="Preparing your questions">
    <Skeleton className="mt-2 h-9 w-4/5" />
    <Skeleton className="h-5 w-3/5" />
    <div className="mt-6 flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-card" />
      ))}
    </div>
  </LoadingState>
);

/** Starting point (ND-14): every clarify question except the success one, one at a time. */
export const StepQuestions: React.FC<StepQuestionsProps> = ({
  flow,
  rawGoal,
  answers,
  customAnswers,
  isSkipped,
  isResolved,
  isLoading,
  clarificationError,
  isRetrying,
  onRetry,
  onChangeGoal,
  onBack,
}) => {
  const q = flow.currentQ;
  const ready = !isLoading && !clarificationError;
  const canContinue = ready && (!q || isResolved(q));

  return (
    <div className="flex flex-col">
      <StepHeader
        compact
        eyebrow="Starting point"
        title="Where are you starting?"
        description="A few questions about where you are today, so your first week meets you there."
      >
        <GoalContext goal={rawGoal} onChange={onChangeGoal} />
      </StepHeader>

      <div className="mt-8 sm:mt-12">
        {clarificationError && !isRetrying ? (
          <ErrorState title={clarificationError.title} description={clarificationError.message} onRetry={onRetry} />
        ) : isLoading || isRetrying ? (
          <QuestionsLoading />
        ) : q ? (
          <QuestionCard flow={flow} answers={answers} customAnswers={customAnswers} isSkipped={isSkipped(q)} />
        ) : (
          <p className="text-body text-text-secondary">Nothing to ask here. Carry on to the next step.</p>
        )}
      </div>

      <StepFooter
        onBack={flow.safeIdx > 0 && ready ? flow.previousQuestion : onBack}
        status={ready && q && !isResolved(q) ? 'Choose an answer, write your own, or skip.' : undefined}
      >
        <Button
          size="lg"
          disabled={!canContinue}
          onClick={() => flow.moveOn(flow.safeIdx, q?.id)}
          trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
        >
          {flow.isLastStop ? 'Continue' : 'Next question'}
        </Button>
      </StepFooter>
    </div>
  );
};
