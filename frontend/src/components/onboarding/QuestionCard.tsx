import React, { useEffect, useRef } from 'react';
import { Button, ChoiceCard, ChoiceGroup, Field, Input } from '../ui';
import type { QuestionFlow } from './questionFlow';

interface QuestionCardProps {
  flow: QuestionFlow;
  answers: Record<string, string>;
  customAnswers: Record<string, string>;
  isSkipped: boolean;
  /** Shown above the question when the step has more than one, for example "Question 2 of 3". */
  showCount?: boolean;
}

/** One question in place, never in a modal: options, an answer in the user's own words, and skip. */
export const QuestionCard: React.FC<QuestionCardProps> = ({ flow, answers, customAnswers, isSkipped, showCount = true }) => {
  const { currentQ: q, currentShown: shown, currentSkips, safeIdx, totalQuestions } = flow;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownId = useRef(q?.id);

  // Moving between questions keeps the step, so bring keyboard and screen reader users to the new question.
  useEffect(() => {
    if (!q || shownId.current === q.id) return;
    shownId.current = q.id;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'nearest' });
  }, [q]);

  if (!q || !shown) return null;

  const typed = customAnswers[q.id] || '';
  const selected = typed ? undefined : answers[q.id];

  return (
    <div key={q.id} className="animate-rise-in">
      {showCount && totalQuestions > 1 && (
        <p className="tabular mb-4 font-ui-mono text-micro uppercase text-text-secondary">
          Question {safeIdx + 1} of {totalQuestions}
        </p>
      )}
      <h2 ref={headingRef} tabIndex={-1} className="text-h2 text-text outline-none">
        {shown.question}
      </h2>
      {shown.subtitle && <p className="mt-3 max-w-xl text-body text-text-secondary">{shown.subtitle}</p>}
      {isSkipped && (
        <p className="mt-4 text-small text-text-secondary">You skipped this one. Choose an answer if you like, or carry on.</p>
      )}

      <ChoiceGroup legend={shown.question} hideLegend value={selected} onChange={flow.chooseOption} className="mt-8">
        {q.options.map((option) => (
          <ChoiceCard key={option} value={option} title={option} />
        ))}
      </ChoiceGroup>

      {q.allowCustom && (
        <Field label="Or put it in your own words" className="mt-6">
          <Input value={typed} onChange={(e) => flow.typeAnswer(e.target.value)} autoComplete="off" />
        </Field>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-3">
        <Button variant="quiet" size="sm" onClick={flow.skipCurrent} className="-ml-4">
          {currentSkips === 0 ? 'Skip this' : 'Skip anyway'}
        </Button>
        <p aria-live="polite" className="text-small text-text-secondary">
          {currentSkips === 1 && !isSkipped ? "Asked another way. Skip again if it still doesn't fit." : ''}
        </p>
      </div>
    </div>
  );
};
