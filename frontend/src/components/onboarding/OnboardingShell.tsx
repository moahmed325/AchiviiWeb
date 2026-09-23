import React from 'react';
import { cx } from '../ui';
import type { FlowStep } from './steps';

const IMAGE = '/images/brand/staircase.jpg';

/* Cinematic at the start, then quieter as the steps ask for focus (BP §47). */
const IMAGE_OPACITY: Record<FlowStep, string> = {
  goal: 'opacity-60',
  starting: 'opacity-40',
  success: 'opacity-40',
  schedule: 'opacity-25',
  review: 'opacity-35',
};

interface OnboardingShellProps {
  step: FlowStep;
  /** Shown in the atmosphere column once a goal is chosen. */
  goal: string;
  rail: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Desktop: an atmosphere column (the staircase and the ascending step rail) beside one focused column.
 * Mobile: one column; the staircase is only a faint band behind the first step's heading, and never moves.
 */
export const OnboardingShell: React.FC<OnboardingShellProps> = ({ step, goal, rail, children }) => (
  <div className="ui-root flex flex-1 flex-col bg-background text-text lg:flex-row">
    <aside aria-label="Your progress" className="hidden shrink-0 border-r border-border lg:block lg:w-1/3 xl:w-[30%]">
      <div className="sticky top-14 isolate flex h-[calc(100dvh-3.5rem)] flex-col justify-between overflow-hidden p-10 xl:p-12">
        <img
          src={IMAGE}
          alt=""
          className={cx('absolute inset-0 -z-10 size-full object-cover transition-opacity duration-(--duration-slow) ease-settle', IMAGE_OPACITY[step])}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="max-w-xs">
          {step === 'goal' || !goal ? (
            <p className="text-h3 text-text">Ninety days. One focused step at a time.</p>
          ) : (
            <>
              <p className="font-ui-mono text-micro uppercase text-text-secondary">Your goal</p>
              <p className="mt-3 break-words text-h3 text-text">{goal}</p>
            </>
          )}
        </div>
        {rail}
      </div>
    </aside>

    <main id="main" className="relative isolate min-w-0 flex-1 px-gutter pb-10 pt-6 lg:px-16 lg:pb-16 lg:pt-14 xl:px-20">
      {step === 'goal' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden lg:hidden">
          <img src={IMAGE} alt="" className="size-full object-cover object-[center_35%] opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />
        </div>
      )}
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  </div>
);
