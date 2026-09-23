import React from 'react';
import { cx } from './cx';

export const VisuallyHidden: React.FC<React.HTMLAttributes<HTMLSpanElement>> = ({ className, ...rest }) => (
  <span className={cx('sr-only', className)} {...rest} />
);

export interface SkipLinkProps {
  /** id of the main landmark, without "#". */
  targetId?: string;
  children?: React.ReactNode;
}

/**
 * First focusable element on a page; appears on keyboard focus only. It moves focus to the target itself: a `main`
 * is not focusable, so following the fragment alone would leave focus behind, and it would add a history entry that
 * onboarding's history lock (R-18) would treat as a step change.
 */
export const SkipLink: React.FC<SkipLinkProps> = ({ targetId = 'main', children = 'Skip to content' }) => (
  <a
    href={`#${targetId}`}
    onClick={(event) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      event.preventDefault();
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
    }}
    className="focus-ring sr-only font-ui focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-text focus:px-5 focus:py-3 focus:text-small focus:font-medium focus:text-text-on-inverse"
  >
    {children}
  </a>
);
