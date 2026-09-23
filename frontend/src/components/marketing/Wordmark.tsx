import React from 'react';

/** Three ascending blocks: the step motif used as the brand mark. */
export const StepMark: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden="true" fill="currentColor">
    <rect x="1" y="13" width="6" height="6" rx="0.6" opacity="0.45" />
    <rect x="7" y="8" width="6" height="11" rx="0.6" opacity="0.7" />
    <rect x="13" y="2" width="6" height="17" rx="0.6" />
  </svg>
);

export const Wordmark: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 font-ui text-[17px] font-semibold tracking-[-0.03em] text-text ${className}`}>
    <StepMark className="w-[18px] h-[18px] text-accent-hover" />
    Achivii
  </span>
);
