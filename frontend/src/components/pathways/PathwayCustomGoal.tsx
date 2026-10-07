import React, { useId } from 'react';
import { Sparkles } from 'lucide-react';
import { cx } from '../ui';

interface PathwayCustomGoalProps {
  /** The way in: a form in onboarding, a button elsewhere. */
  children: React.ReactNode;
  className?: string;
  /** `luminous`: the gold treatment used beside the certified pathways in the explorer dialog. */
  variant?: 'default' | 'luminous';
}

/** A four-point star, large and faint, behind the card's corner: the unmapped sky beyond the certified pathways. */
const Constellation: React.FC = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 160 120"
    className="pointer-events-none absolute -right-3 -top-3 h-32 w-44 text-achievement"
  >
    <path
      d="M112 6C115 40 132 56 156 60C132 64 115 80 112 114C109 80 92 64 68 60C92 56 109 40 112 6Z"
      fill="currentColor"
      opacity="0.13"
    />
    <path d="M40 22C41 33 47 39 56 40C47 41 41 47 40 58C39 47 33 41 24 40C33 39 39 33 40 22Z" fill="currentColor" opacity="0.2" />
    <circle cx="74" cy="96" r="1.6" fill="currentColor" opacity="0.35" />
    <circle cx="20" cy="84" r="1.2" fill="currentColor" opacity="0.25" />
  </svg>
);

/**
 * Premium Custom Journeys container (ND-6, ND-10, VDS §12). Never an afterthought; a new custom goal is Pro, so each
 * screen puts `CustomGoalGate` around its way in.
 */
export const PathwayCustomGoal: React.FC<PathwayCustomGoalProps> = ({ children, className, variant = 'default' }) => {
  const headingId = useId();
  const luminous = variant === 'luminous';
  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        luminous
          ? 'pathway-custom p-6 sm:p-8'
          : 'rounded-card border border-border/70 bg-surface/40 p-6 sm:p-8 transition-colors duration-(--duration-normal) hover:border-accent/30',
        className,
      )}
    >
      {luminous && <Constellation />}
      <div className="relative">
        <span
          aria-hidden="true"
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-ui-mono text-micro uppercase tracking-[0.16em]',
            luminous ? 'border-achievement/30 bg-achievement/10 text-achievement' : 'border-accent/20 bg-accent/10 text-accent-hover',
          )}
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
      </div>
    </section>
  );
};
