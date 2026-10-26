import React from 'react';
import { Plus } from 'lucide-react';

interface SectionProps {
  id?: string;
  labelledBy?: string;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}

/** One heading scale for every landing section, so the page reads as a single calm rhythm. */
export const HEADING = 'text-balance text-h2 text-text';

/** The small gold marks where a section's top line crosses the page rails (`landing-rails`). */
export const SectionMarks: React.FC = () => (
  <span aria-hidden="true" className="landing-marks text-achievement">
    <Plus strokeWidth={1.5} className="size-3" />
    <Plus strokeWidth={1.5} className="size-3" />
  </span>
);

export const Section: React.FC<SectionProps> = ({ id, labelledBy, className = '', innerClassName = '', children }) => (
  <section
    id={id}
    aria-labelledby={labelledBy}
    className={`relative scroll-mt-24 border-t border-border px-gutter py-16 sm:py-24 ${className}`}
  >
    <SectionMarks />
    <div className={`mx-auto w-full max-w-[1120px] ${innerClassName}`}>{children}</div>
  </section>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-small text-text-secondary ${className}`}>{children}</p>
);
