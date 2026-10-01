import React, { useId } from 'react';
import { cx } from '../ui';
import type { CertifiedPathway } from '../../lib/certifiedPresets';
import { ascentOf } from './ascent';

/** An abstract staircase, drawn once when a pathway is chosen. It climbs to the same point the rail does. */
const Stairs: React.FC = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 120 72" className="pathway-ascent__stairs">
    <path pathLength={1} d="M2 70H32V48H62V26H92V4H116" />
    <circle cx="116" cy="4" r="2.5" />
  </svg>
);

const EYEBROW = 'font-ui-mono text-micro uppercase tracking-[0.16em]';

/** Rises into place from the foundation up: each row waits a little longer than the one beneath it. */
const rise = (step: number) => ({ '--ascent-delay': `${80 + step * 120}ms` }) as React.CSSProperties;

export interface PathwayAscentProps {
  /** The chosen pathway. Without one, a quiet placeholder keeps the layout from jumping. */
  pathway?: CertifiedPathway;
  className?: string;
}

/**
 * What the chosen pathway leads to (progressive disclosure, "simple by default, deep when explored"): its
 * destination, the three flights that climb there, and one ordinary day. Everything here already lives in the
 * catalogue; it was only never shown. The flights are an ordered list in chronological order, drawn bottom-up.
 */
export const PathwayAscent: React.FC<PathwayAscentProps> = ({ pathway, className }) => {
  const labelId = useId();

  if (!pathway) {
    return (
      <section
        aria-labelledby={labelId}
        className={cx('pathway-ascent pathway-ascent--empty flex min-h-56 flex-col justify-end p-5 sm:p-6', className)}
      >
        <Stairs />
        <p id={labelId} className={cx(EYEBROW, 'text-text-secondary')}>
          Choose a pathway
        </p>
        <p className="mt-2 max-w-[28ch] text-small text-text-secondary">See where it ends, and how twelve weeks climb there.</p>
      </section>
    );
  }

  const { destination, phases, day } = ascentOf(pathway);
  const last = phases.length - 1;
  const rungOf = (index: number) => (index === 0 ? 'base' : index === last ? 'peak' : 'rise');

  return (
    <section aria-labelledby={labelId} className={cx('pathway-ascent animate-rise-in p-5 sm:p-6', className)}>
      <Stairs />
      <div className="relative">
        <div className="pathway-ascent__row journey-ascent pb-6" data-rung="destination" style={rise(phases.length)}>
          <span className="pathway-ascent__marker">
            <span aria-hidden="true" className="pathway-ascent__dest text-lg leading-none text-achievement">
              &#10022;
            </span>
          </span>
          <div className="min-w-0 pl-9 pr-20 sm:pr-24">
            <p id={labelId} className={cx(EYEBROW, 'text-achievement')}>
              The destination
            </p>
            <p className="mt-2 text-body-lg font-medium leading-snug text-text">{destination}</p>
          </div>
        </div>

        <ol aria-label="The climb, flight by flight" className="flex flex-col-reverse">
          {phases.map((phase, index) => (
            <li
              key={phase.name}
              className="pathway-ascent__row journey-ascent pb-6 first:pb-0"
              data-rung={rungOf(index)}
              style={rise(index)}
            >
              <span className="pathway-ascent__marker">
                <span aria-hidden="true" className={cx('pathway-ascent__diamond', index === last && 'is-final')} />
              </span>
              <div className="pl-9">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-body font-medium text-text">{phase.name}</p>
                  {phase.weeks && (
                    <p className="tabular shrink-0 font-ui-mono text-micro uppercase text-text-secondary">Weeks {phase.weeks}</p>
                  )}
                </div>
                <p className="mt-1 text-small text-text-secondary">{phase.focus}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative mt-6 border-t border-border pt-4">
        <p className={cx(EYEBROW, 'text-text-secondary')}>A typical day</p>
        <p className="tabular mt-2 font-ui-mono text-small text-text">{day.slot}</p>
        <p className="mt-1 text-small text-text-secondary">{day.title}</p>
      </div>
    </section>
  );
};
