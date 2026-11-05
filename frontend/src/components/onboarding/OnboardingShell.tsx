import React from 'react';
import { Button, cx } from '../ui';
import { sectionOf, type PageId, type Section } from './pages';

const IMAGE = '/images/brand/staircase.jpg';

/* Cinematic at the start, then quieter as the steps ask for focus (BP §47). */
const IMAGE_OPACITY: Record<Section, string> = {
  goal: 'opacity-60',
  week: 'opacity-25',
  you: 'opacity-40',
  ready: 'opacity-35',
};

interface OnboardingShellProps {
  page: PageId;
  /** Shown in the atmosphere column once a goal is chosen. */
  goal: string;
  rail: React.ReactNode;
  /** Desktop: the goal in the column can be changed from here; phones get the same button on each page. */
  onChangeGoal?: () => void;
  children: React.ReactNode;
}

/**
 * Desktop: an atmosphere column (the staircase and the ascending step rail) beside one focused column.
 * Mobile: one column; the staircase is only a faint band behind the first step's heading, and never moves.
 */
export const OnboardingShell: React.FC<OnboardingShellProps> = ({ page, goal, rail, onChangeGoal, children }) => (
  <div className="ui-root flex flex-1 flex-col bg-background text-text lg:flex-row">
    <aside aria-label="Your progress" className="hidden shrink-0 border-r border-border lg:block lg:w-1/3 xl:w-[30%]">
      <div className="sticky top-14 isolate flex h-[calc(100dvh-3.5rem)] flex-col justify-between overflow-hidden p-10 xl:p-12">
        <img
          src={IMAGE}
          alt=""
          width={735}
          height={985}
          decoding="async"
          className={cx('absolute inset-0 -z-10 size-full object-cover transition-opacity duration-(--duration-slow) ease-settle', IMAGE_OPACITY[sectionOf(page)])}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/30" />
        <div className="max-w-xs">
          {page === 'goal' || !goal ? (
            <p className="text-h3 text-text">Ninety days. One focused step at a time.</p>
          ) : (
            <>
              <p className="font-ui-mono text-micro uppercase text-text-secondary">Your goal</p>
              <p className="mt-3 break-words text-h3 text-text">{goal}</p>
              {onChangeGoal && (
                <Button variant="quiet" size="sm" aria-label="Change your goal" onClick={onChangeGoal} className="-ml-3 mt-2">
                  Change
                </Button>
              )}
            </>
          )}
        </div>
        {rail}
      </div>
    </aside>

    <main id="main" className="relative isolate min-w-0 flex-1 px-gutter pb-10 pt-6 lg:px-16 lg:pb-16 lg:pt-14 xl:px-20">
      {page === 'goal' && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden lg:hidden">
          <img
            src={IMAGE}
            alt=""
            width={735}
            height={985}
            decoding="async"
            className="size-full object-cover object-[center_35%] opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background" />
        </div>
      )}
      <div className="mx-auto w-full max-w-2xl">{children}</div>
    </main>
  </div>
);
