import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { FollowUpQuestion } from '../../types';
import { Button, Field, StepMarker, Surface, Textarea } from '../ui';
import type { QuestionFlow } from './questionFlow';
import { QuestionCard } from './QuestionCard';
import { GoalContext, StepFooter, StepHeader } from './StepLayout';

interface StepSuccessProps {
  flow: QuestionFlow;
  rawGoal: string;
  outcome: string;
  /** What the create request will send when the field is empty: clarify's outcome, then the goal. */
  displayOutcome: string;
  onOutcomeChange: (outcome: string) => void;
  isEditingOutcome: boolean;
  onToggleEditingOutcome: () => void;
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
  isSkipped: (q: FollowUpQuestion) => boolean;
  isResolved: (q: FollowUpQuestion) => boolean;
  onChangeGoal: () => void;
  onBack: () => void;
}

/** Success (ND-14): the clarified outcome as the destination, editable, plus the success question when clarify asks one. */
export const StepSuccess: React.FC<StepSuccessProps> = ({
  flow,
  rawGoal,
  outcome,
  displayOutcome,
  onOutcomeChange,
  isEditingOutcome,
  onToggleEditingOutcome,
  answers,
  customAnswers,
  isSkipped,
  isResolved,
  onChangeGoal,
  onBack,
}) => {
  const q = flow.currentQ;
  const canContinue = !q || isResolved(q);

  return (
    <div className="flex flex-col">
      <StepHeader
        compact
        eyebrow="Success"
        title="What does success look like?"
        description="This is where the next 90 days lead. Every week of your path is planned toward it, so make it sound like yours."
      >
        <GoalContext goal={rawGoal} onChange={onChangeGoal} />
      </StepHeader>

      <Surface as="section" aria-labelledby="destination-label" tone="elevated" radius="panel" padding="lg" className="mt-8 sm:mt-12">
        <div className="flex items-center gap-2.5">
          <StepMarker state="destination" size="sm" />
          <p id="destination-label" className="font-ui-mono text-micro uppercase text-achievement">
            Your destination in 90 days
          </p>
        </div>
        {isEditingOutcome ? (
          <Field label="Your 90-day outcome" className="mt-5">
            <Textarea rows={3} value={outcome} onChange={(e) => onOutcomeChange(e.target.value)} autoFocus />
          </Field>
        ) : (
          <p className="mt-5 break-words text-h2 text-text">{displayOutcome}</p>
        )}
        <Button variant="secondary" size="sm" className="mt-6" onClick={onToggleEditingOutcome}>
          {isEditingOutcome ? 'Done' : 'Edit outcome'}
        </Button>
      </Surface>

      {q && (
        <div className="mt-14">
          <QuestionCard flow={flow} answers={answers} customAnswers={customAnswers} isSkipped={isSkipped(q)} />
        </div>
      )}

      <StepFooter
        onBack={flow.safeIdx > 0 ? flow.previousQuestion : onBack}
        status={q && !isResolved(q) ? 'Choose an answer, write your own, or skip.' : undefined}
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
