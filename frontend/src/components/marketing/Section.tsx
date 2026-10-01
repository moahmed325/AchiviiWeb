import React from 'react';

interface SectionProps {
  id?: string;
  labelledBy?: string;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

/** One heading scale for every landing section, so the page reads as a single calm rhythm. */
export const HEADING = 'text-[clamp(2.25rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-text';

export const Section: React.FC<SectionProps> = ({ id, labelledBy, className = '', innerClassName = '', children }) => (
  <section id={id} aria-labelledby={labelledBy} className={`relative scroll-mt-24 px-6 sm:px-10 lg:px-16 ${className}`}>
    <div className={`mx-auto w-full max-w-[1280px] ${innerClassName}`}>{children}</div>
  </section>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string; tone?: 'default' | 'accent' | 'achievement' }> = ({
  children,
  className = '',
  tone = 'achievement',
}) => {
  const color = tone === 'accent' ? 'text-accent' : tone === 'achievement' ? 'text-achievement' : 'text-text-secondary';
  return (
    <p className={`flex items-center gap-3 font-ui-mono text-xs uppercase tracking-[0.22em] ${color} ${className}`}>
      <span
        aria-hidden="true"
        className={`h-px w-8 ${tone === 'achievement' ? 'bg-gradient-to-r from-transparent to-achievement' : 'bg-current opacity-60'}`}
      />
      {children}
    </p>
  );
};
