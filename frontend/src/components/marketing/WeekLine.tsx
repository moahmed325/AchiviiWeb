import React from 'react';

const WEEKS = 12;
const CURRENT_WEEK = 4;

const PHASES = [
  { weeks: 'Weeks 1–4', name: 'Foundation', here: true },
  { weeks: 'Weeks 5–8', name: 'Acceleration', here: false },
  { weeks: 'Weeks 9–12', name: 'Mastery', here: false },
];

/** The 90 days as twelve weeks, lit up to the example day. The landing page's one recurring mark. */
export const WeekLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <figure className={className}>
    <div aria-hidden="true" className="grid grid-cols-12 gap-1.5">
      {Array.from({ length: WEEKS }, (_, index) => (
        <span key={index} className={`h-1 rounded-full ${index < CURRENT_WEEK ? 'bg-achievement' : 'bg-border-strong'}`} />
      ))}
    </div>
    <figcaption className="mt-3 grid gap-1 text-small text-text-secondary sm:grid-cols-3 sm:gap-4">
      {PHASES.map((phase, index) => (
        <span key={phase.name} className={index === PHASES.length - 1 ? 'sm:text-right' : ''}>
          <span className={phase.here ? 'text-text' : ''}>
            {phase.weeks} · {phase.name}
          </span>
          {phase.here && ' · day 27'}
          {index === PHASES.length - 1 && ' → Day 90'}
        </span>
      ))}
    </figcaption>
  </figure>
);
