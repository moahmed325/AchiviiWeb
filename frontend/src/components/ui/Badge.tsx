import React from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'accent' | 'achievement' | 'caution' | 'danger';

const tones: Record<BadgeTone, string> = {
  neutral: 'border-border-strong text-text-secondary',
  accent: 'border-accent/30 bg-accent/[0.06] text-accent-hover',
  achievement: 'border-achievement/35 bg-achievement/[0.06] text-achievement',
  caution: 'border-caution/35 bg-caution/[0.06] text-caution',
  danger: 'border-danger/35 bg-danger/[0.06] text-danger',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: React.ReactNode;
}

/** A short status label. Colour is never the only signal: the text says what the state is. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', icon, className, children, ...rest }) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-ui-mono text-micro uppercase',
      tones[tone],
      className,
    )}
    {...rest}
  >
    {icon}
    {children}
  </span>
);
