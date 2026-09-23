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

/** First focusable element on a page; appears on keyboard focus only. */
export const SkipLink: React.FC<SkipLinkProps> = ({ targetId = 'main', children = 'Skip to content' }) => (
  <a
    href={`#${targetId}`}
    className="focus-ring sr-only font-ui focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-text focus:px-5 focus:py-3 focus:text-small focus:font-medium focus:text-text-on-inverse"
  >
    {children}
  </a>
);
