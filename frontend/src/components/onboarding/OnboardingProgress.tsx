import React from 'react';
import { ProgressBar, StepMarker, cx, type StepState } from '../ui';
import { STEP_LABEL, type FlowStep } from './steps';

interface ProgressProps {
  order: readonly FlowStep[];
  step: FlowStep;
  canJumpToStep: (step: FlowStep) => boolean;
  isStepComplete: (step: FlowStep) => boolean;
  onSelectStep: (step: FlowStep) => void;
}

const markerState = (s: FlowStep, props: ProgressProps): StepState => {
  if (s === props.step) return 'active';
  if (props.isStepComplete(s) && props.canJumpToStep(s)) return 'completed';
  return 'upcoming';
};

const STATE_TEXT: Record<StepState, string> = {
  active: 'current step',
  completed: 'done',
  upcoming: 'not started',
  milestone: '',
  destination: '',
};

/* Each step sits one tread higher and further right than the last: the ascent, drawn with hairlines. */
const INDENT = ['pl-0', 'pl-6', 'pl-12', 'pl-18', 'pl-24'] as const;

/** Desktop: the flow as an ascending staircase, Direction at the bottom and the 90-day path at the top. */
export const JourneyRail: React.FC<ProgressProps> = (props) => {
  const { order, step, canJumpToStep, onSelectStep } = props;
  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex flex-col-reverse">
        {order.map((s, i) => {
          const state = markerState(s, props);
          const isCurrent = s === step;
          const canSelect = !isCurrent && canJumpToStep(s);
          const content = (
            <>
              <StepMarker state={state} size="sm" />
              <span className={cx('text-small', isCurrent ? 'font-medium text-text' : 'text-text-secondary group-hover:text-text')}>
                {STEP_LABEL[s]}
              </span>
              <span className="sr-only">, {STATE_TEXT[state]}</span>
            </>
          );
          return (
            <li key={s} className={INDENT[i]}>
              <div className="border-b border-border-strong">
                {canSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelectStep(s)}
                    className="focus-ring group -mx-2 flex min-h-11 w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-control px-2 text-left transition-colors duration-(--duration-quick) hover:bg-text/[0.04]"
                  >
                    {content}
                  </button>
                ) : (
                  <div aria-current={isCurrent ? 'step' : undefined} className="flex min-h-11 items-center gap-3">
                    {content}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        <li className="pb-2 pl-30" aria-hidden="true">
          <div className="flex min-h-11 items-center gap-3">
            <StepMarker state="destination" size="sm" />
            <span className="text-small text-achievement">Your 90-day path</span>
          </div>
        </li>
      </ol>
    </nav>
  );
};

/** Small screens: where you are, in one line, with a thin bar. */
export const MobileProgress: React.FC<Pick<ProgressProps, 'order' | 'step'>> = ({ order, step }) => {
  const index = order.indexOf(step);
  const valueText = `Step ${index + 1} of ${order.length}: ${STEP_LABEL[step]}`;
  return (
    <div className="flex flex-col gap-2 lg:hidden">
      <div aria-hidden="true" className="flex items-baseline justify-between gap-4">
        <span className="tabular font-ui-mono text-micro uppercase text-text-secondary">
          Step {index + 1} of {order.length}
        </span>
        <span className="text-small text-text">{STEP_LABEL[step]}</span>
      </div>
      <ProgressBar value={index + 1} max={order.length} label="Onboarding progress" hideLabel valueText={valueText} />
    </div>
  );
};
