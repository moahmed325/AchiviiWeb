import React from 'react';
import { StepMarker } from '../ui';

/**
 * This week toward the goal. No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): there is no measured
 * result or target to chart; the goal, this week's focus and the sessions done are what next week is planned from.
 */
export const GoalProgress: React.FC<{ goal?: string | null; focus?: string | null; done: number; planned: number }> = ({ goal, focus, done, planned }) => {
  if (!focus && planned === 0) return null;
  return (
    <section aria-labelledby="goal-progress-heading" className="dash-panel flex w-full min-w-0 flex-col p-7 sm:p-8">
      <h2 id="goal-progress-heading" className="font-ui-mono text-micro uppercase text-text-secondary">
        This week
      </h2>
      {planned > 0 && (
        <>
          <p className="mt-5 tabular text-5xl font-semibold tracking-[-0.04em] text-text">
            {done} of {planned}
          </p>
          <p className="mt-2 text-small text-text-secondary">{planned === 1 ? 'session done' : 'sessions done'}</p>
        </>
      )}
      {focus && (
        <p className="mt-6 flex items-start gap-3 text-body text-text">
          <StepMarker state="milestone" size="sm" className="mt-1" />
          <span>
            <span className="block text-small text-text-secondary">Focus</span>
            {focus}
          </span>
        </p>
      )}
      {goal && <p className="mt-auto pt-6 text-small text-text-secondary">Your goal: {goal}</p>}
    </section>
  );
};
