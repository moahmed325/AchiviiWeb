import React, { useId } from 'react';
import { Sparkles } from 'lucide-react';
import { cx } from '../ui';

interface PathwayCustomGoalProps {
  /** The way in: a form in onboarding, a button elsewhere. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Premium Custom Journeys container (ND-6, ND-10, VDS §12).
 * Free, available and crafted — never locked, never an afterthought.
 */
export const PathwayCustomGoal: React.FC<PathwayCustomGoalProps> = ({ children, className }) => {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        'rounded-card border border-border/70 bg-surface/40 p-6 sm:p-8',
        'transition-colors duration-(--duration-normal) hover:border-accent/30',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 font-ui-mono text-micro uppercase tracking-[0.16em] text-accent-hover"
      >
        <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-3" />
        Custom Journey
      </span>
      <h2 id={headingId} className="mt-4 text-h3 text-text">
        Have something unique in mind?
      </h2>
      <p className="mt-2 max-w-xl text-body text-text-secondary">
        Build a guided 90-day journey around your own ambition. Describe what you want to achieve, and Achivii structures
        the milestones, deliberate daily practice, and weekly benchmarks.
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
};
