import React from 'react';
import { ProgressBar, StepMarker, cx, type StepState } from '../ui';
import { SECTIONS, SECTION_LABEL, sectionOf, type PageId } from './pages';

interface ProgressProps {
  pages: readonly PageId[];
  page: PageId;
}

const STATE_TEXT: Record<StepState, string> = {
  active: 'now',
  completed: 'done',
  upcoming: 'next',
  milestone: '',
  destination: '',
};

/* Each section sits one tread higher and further right than the last: the ascent, drawn with hairlines. */
const INDENT = ['pl-0', 'pl-6', 'pl-12', 'pl-18'] as const;

const stateOf = (index: number, current: number): StepState =>
  index === current ? 'active' : index < current ? 'completed' : 'upcoming';

/** Desktop: the four parts of onboarding as an ascending staircase, the 90-day path at the top. */
export const JourneyRail: React.FC<ProgressProps> = ({ page }) => {
  const current = SECTIONS.indexOf(sectionOf(page));
  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex flex-col-reverse">
        {SECTIONS.map((section, i) => {
          const state = stateOf(i, current);
          return (
            <li key={section} className={INDENT[i]}>
              <div aria-current={i === current ? 'step' : undefined} className="flex min-h-11 items-center gap-3 border-b border-border-strong">
                <StepMarker state={state} size="sm" />
                <span className={cx('text-small', i === current ? 'font-medium text-text' : 'text-text-secondary')}>{SECTION_LABEL[section]}</span>
                <span className="sr-only">, {STATE_TEXT[state]}</span>
              </div>
            </li>
          );
        })}
        <li className="pb-2 pl-24" aria-hidden="true">
          <div className="flex min-h-11 items-center gap-3">
            <StepMarker state="destination" size="sm" />
            <span className="text-small text-achievement">Your 90-day path</span>
          </div>
        </li>
      </ol>
    </nav>
  );
};

/** Small screens: the part they're in, with a thin bar for how far through they are. */
export const MobileProgress: React.FC<ProgressProps> = ({ pages, page }) => {
  const index = Math.max(0, pages.indexOf(page));
  const label = SECTION_LABEL[sectionOf(page)];
  return (
    <div className="flex flex-col gap-2 lg:hidden">
      <span aria-hidden="true" className="font-ui-mono text-micro uppercase text-text-secondary">
        {label}
      </span>
      <ProgressBar value={index + 1} max={pages.length} label="Onboarding progress" hideLabel valueText={`${label}, page ${index + 1} of ${pages.length}`} />
    </div>
  );
};
