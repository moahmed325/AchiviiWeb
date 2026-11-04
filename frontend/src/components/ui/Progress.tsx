import React from 'react';
import { cx } from './cx';

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Accessible name, shown above the bar unless hideLabel is set. */
  label: string;
  hideLabel?: boolean;
  showValue?: boolean;
  /** Replaces the default percentage, for example "27 of 90 days". Also announced to screen readers. */
  valueText?: string;
  tone?: 'accent' | 'achievement';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  hideLabel = false,
  showValue = false,
  valueText,
  tone = 'accent',
  className,
}) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {(!hideLabel || showValue) && (
        <div className="flex items-baseline justify-between gap-4">
          {!hideLabel && <span className="text-small text-text-secondary">{label}</span>}
          {showValue && <span className="tabular ml-auto font-ui-mono text-micro text-text">{valueText ?? `${percent}%`}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText}
        className="h-1.5 w-full overflow-hidden rounded-full bg-text/[0.08]"
      >
        <div
          className={cx('h-full rounded-full transition-[width] duration-(--duration-slow) ease-ascend', tone === 'achievement' ? 'bg-achievement' : 'bg-accent')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export interface ProgressRingProps {
  value: number;
  max?: number;
  /** Accessible name of the progressbar. */
  label: string;
  /** Announced instead of the bare number, for example "38% of the way to 50:00". */
  valueText?: string;
  /** Diameter in rem. */
  size?: number;
  tone?: 'accent' | 'achievement';
  /** Shown in the middle of the ring (for example the percentage). Decorative; the ring carries the value. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The same progress as ProgressBar, drawn as a ring for a page's one headline measure. The arc fills once on arrival
 * (`progress-ring__arc`, near-instant under reduced motion). Flat colour, no glow.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({ value, max = 100, label, valueText, size = 9, tone = 'achievement', children, className }) => {
  const clamped = Math.min(Math.max(value, 0), max);
  const share = max > 0 ? clamped / max : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      className={cx('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size + 'rem', height: size + 'rem' }}
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
        <circle cx="50" cy="50" r="44" pathLength={100} className="progress-ring__track" />
        <circle
          cx="50"
          cy="50"
          r="44"
          pathLength={100}
          className={cx('progress-ring__arc', tone === 'achievement' ? 'stroke-achievement' : 'stroke-accent')}
          style={{ '--ring-offset': String(100 - share * 100) } as React.CSSProperties}
        />
      </svg>
      <div aria-hidden="true" className="relative text-center">{children}</div>
    </div>
  );
};

export type StepState = 'upcoming' | 'active' | 'completed' | 'milestone' | 'destination';

export interface StepMarkerProps {
  state: StepState;
  size?: 'sm' | 'md' | 'lg';
  /** When set, the marker is announced (for example "Day 12, completed"). Otherwise it is decorative. */
  label?: string;
  className?: string;
}

const markerSizes = { sm: 'size-4', md: 'size-5', lg: 'size-7' } as const;

const markerColors: Record<StepState, string> = {
  upcoming: 'text-text-muted',
  active: 'text-accent',
  completed: 'text-accent',
  milestone: 'text-text',
  destination: 'text-achievement',
};

/**
 * The Achivii progression grammar (VDS §25): step ○, active ●, completed ✓, milestone ◆, destination ✦.
 * Each state has its own shape, so colour is never the only difference.
 */
export const StepMarker: React.FC<StepMarkerProps> = ({ state, size = 'md', label, className }) => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    data-state={state}
    className={cx('shrink-0', markerSizes[size], markerColors[state], className)}
    {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
  >
    {state === 'upcoming' && <circle cx="10" cy="10" r="6.25" stroke="currentColor" strokeWidth="1.5" />}
    {state === 'active' && (
      <>
        <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.18" />
        <circle cx="10" cy="10" r="5" fill="currentColor" />
      </>
    )}
    {state === 'completed' && (
      <>
        <circle cx="10" cy="10" r="8" fill="currentColor" />
        <path d="M6.6 10.3l2.3 2.3 4.6-5" className="stroke-background" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </>
    )}
    {state === 'milestone' && <path d="M10 2.5 17.5 10 10 17.5 2.5 10Z" fill="currentColor" />}
    {state === 'destination' && (
      <path d="M10 1.5C10.6 7 13 9.4 18.5 10 13 10.6 10.6 13 10 18.5 9.4 13 7 10.6 1.5 10 7 9.4 9.4 7 10 1.5Z" fill="currentColor" />
    )}
  </svg>
);
