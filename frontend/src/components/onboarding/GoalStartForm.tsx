import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Input, cx } from '../ui';
import { GOAL_EXAMPLES, GOAL_MAX_LENGTH } from './pages';


interface GoalStartFormProps {
  onStart: (goal: string) => void;
  initialGoal?: string;
  /** The field's accessible name; the visible question is the page's heading. */
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  showExamples?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * ND-28: the one thing Achivii asks first, on the landing page, on Home before a first goal, and in onboarding.
 * Enter starts at once; an example fills the field and starts too.
 */
export const GoalStartForm: React.FC<GoalStartFormProps> = ({
  onStart,
  initialGoal = '',
  label = 'What do you want to achieve?',
  placeholder = 'For example: run my first 10K',
  submitLabel = 'Start',
  showExamples = true,
  autoFocus = false,
  className,
}) => {
  const [goal, setGoal] = useState(initialGoal);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) onStart(goal.trim());
  };

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          aria-label={label}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={placeholder}
          maxLength={GOAL_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="go"
          autoFocus={autoFocus}
          className="sm:flex-1"
        />
        <Button
          type="submit"
          variant="gold"
          size="lg"
          disabled={!goal.trim()}
          trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
        >
          {submitLabel}
        </Button>
      </form>
      {showExamples && (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <span className="mr-2 text-small text-text-secondary">Try</span>
          {GOAL_EXAMPLES.map((example) => (
            <Button key={example} variant="secondary" size="sm" onClick={() => onStart(example)}>
              {example}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
