import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui';
import { GoalContext, StepFooter, StepHeader } from './StepLayout';

interface PageFrameProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** The goal, shown on every page after the first so the person never loses the thread. */
  goal?: string;
  onChangeGoal?: () => void;
  onBack?: () => void;
  onContinue: () => void;
  canContinue: boolean;
  continueLabel?: string;
  /** Why Continue is waiting, or what it is doing. Announced politely. */
  status?: React.ReactNode;
  loading?: boolean;
  /** Clarify's questions can run long, so they are set a size down. */
  titleSize?: 'h1' | 'h2';
  children?: React.ReactNode;
}

/** One onboarding page (ND-28): one question, its answer, and Continue. */
export const PageFrame: React.FC<PageFrameProps> = ({
  eyebrow,
  title,
  description,
  goal,
  onChangeGoal,
  onBack,
  onContinue,
  canContinue,
  continueLabel = 'Continue',
  status,
  loading,
  titleSize = 'h1',
  children,
}) => (
  <div className="flex flex-col">
    <StepHeader eyebrowFromSm eyebrow={eyebrow} title={title} description={description} size={titleSize}>
      {/* Desktop shows the goal in the column beside the page. */}
      {goal && onChangeGoal && (
        <div className="lg:hidden">
          <GoalContext goal={goal} onChange={onChangeGoal} />
        </div>
      )}
    </StepHeader>
    {children && <div className="mt-8 sm:mt-10">{children}</div>}
    <StepFooter onBack={onBack} status={status}>
      <Button
        size="lg"
        disabled={!canContinue}
        loading={loading}
        onClick={onContinue}
        trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
      >
        {continueLabel}
      </Button>
    </StepFooter>
  </div>
);
