import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button, cx } from '../ui';

/** The wizard moves focus here on every step change, so keyboard and screen reader users start at the new step. */
export const STEP_HEADING_ID = 'onboarding-step-heading';

interface StepHeaderProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** The goal step opens the flow at display size; later steps are calmer. */
  size?: 'display' | 'h1';
  /**
   * Question steps on phones: the progress bar already names the step, so the eyebrow is dropped and the description
   * is left to screen readers, bringing the first answer above the sticky footer.
   */
  compact?: boolean;
  children?: React.ReactNode;
}

export const StepHeader: React.FC<StepHeaderProps> = ({ eyebrow, title, description, size = 'h1', compact = false, children }) => (
  <header className="flex flex-col gap-4">
    <p className={cx('font-ui-mono text-micro uppercase text-accent-hover', compact && 'max-sm:hidden')}>{eyebrow}</p>
    <h1
      id={STEP_HEADING_ID}
      tabIndex={-1}
      className={cx('max-w-[20ch] text-text outline-none', size === 'display' ? 'mb-2 text-display' : 'text-h1')}
    >
      {title}
    </h1>
    {description && <p className={cx('max-w-xl text-body-lg text-text-secondary', compact && 'max-sm:sr-only')}>{description}</p>}
    {children}
  </header>
);

/** Achivii can't be reached. Honest about what still works: nothing here is saved until the plan is created. */
export const ConnectionNotice: React.FC<{ className?: string }> = ({ className }) => (
  <div
    role="status"
    className={cx('flex items-start gap-2.5 rounded-control border border-border-strong bg-surface p-4 text-small text-text-secondary', className)}
  >
    <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-caution" />
    <p>
      We can't reach Achivii right now. You can keep going, and your answers stay on this page, but your questions and your
      plan need a connection.
    </p>
  </div>
);

/** The chosen goal, shown on every step after the first so the user never loses the thread. */
export const GoalContext: React.FC<{ goal: string; onChange: () => void }> = ({ goal, onChange }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-accent/60 pl-4">
    <span className="font-ui-mono text-micro uppercase text-text-secondary">Your goal</span>
    <span className="min-w-0 break-words text-body font-medium text-text">{goal}</span>
    <Button variant="quiet" size="sm" onClick={onChange} className="-ml-2">
      Change
    </Button>
  </div>
);

interface StepFooterProps {
  onBack?: () => void;
  backLabel?: string;
  /** Why the primary action is waiting, or what it is doing. Announced politely. */
  status?: React.ReactNode;
  children: React.ReactNode;
}

/** Back and the step's one primary action. Sticks to the bottom on small screens, where the thumb is. */
export const StepFooter: React.FC<StepFooterProps> = ({ onBack, backLabel = 'Back', status, children }) => (
  <div className="sticky bottom-0 z-20 -mx-gutter mt-12 border-t border-border bg-background px-gutter pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:mx-0 lg:border-t lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-6">
    <p aria-live="polite" className="text-small text-text-secondary [&:not(:empty)]:mb-3">
      {status}
    </p>
    <div className="flex items-center gap-3">
      {onBack && (
        <Button variant="quiet" onClick={onBack} leadingIcon={<ArrowLeft aria-hidden="true" strokeWidth={1.5} className="size-4" />} className="-ml-3 px-3 sm:px-4">
          {backLabel}
        </Button>
      )}
      <div className="ml-auto flex min-w-0 flex-1 justify-end [&>*]:flex-1 sm:[&>*]:flex-none">{children}</div>
    </div>
  </div>
);
