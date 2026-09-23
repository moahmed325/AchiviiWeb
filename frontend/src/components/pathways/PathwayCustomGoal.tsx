import React, { useId } from 'react';
import { cx } from '../ui';

interface PathwayCustomGoalProps {
  /** The way in: a form in onboarding, a button elsewhere. */
  children: React.ReactNode;
  className?: string;
}

/** The quieter route for a goal of the user's own (ND-6): free, available and secondary to the pathways. */
export const PathwayCustomGoal: React.FC<PathwayCustomGoalProps> = ({ children, className }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cx('border-t border-border pt-10', className)}>
      <h2 id={headingId} className="text-h3 text-text">
        Something else in mind?
      </h2>
      <p className="mt-2 max-w-xl text-body text-text-secondary">
        For something uniquely yours. Describe it in a sentence and Achivii shapes a 90-day journey around it.
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
};
