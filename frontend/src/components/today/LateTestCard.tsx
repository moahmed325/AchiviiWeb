import React, { useState } from 'react';
import type { Goal } from '../../types';
import { useGoal } from '../../context/GoalContext';
import { formatPassIf } from '../../lib/formatters';
import { lateTestWeek } from '../../lib/lateTest';
import { isLightTest } from '../../lib/lightTest';
import { Button } from '../ui';
import { TestResultDialog } from './TestResultDialog';

/**
 * Missed sessions M4.1 (RULE-7, UX-3, AC-8): after test day, while the week's test has no result and the week is not
 * reviewed, one calm card offers to log it. Logging stores the result without closing the week (ND-4); the goal is
 * then refreshed, so the card goes. Self-contained: it reads the goal context and renders nothing outside its window.
 */
export const LateTestCard: React.FC<{ goal: Goal; now: Date; timezone?: string }> = ({ goal, now, timezone }) => {
  const { reconciliation } = useGoal();
  const [open, setOpen] = useState(false);

  const week = lateTestWeek(goal, reconciliation, now, timezone);
  if (!week?.test) return null;
  const test = week.test;
  const light = isLightTest(test);

  return (
    <section aria-labelledby="late-test-heading" className="dash-panel animate-rise-in relative mt-10 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="late-test-heading" className="text-h3 text-text">
            This week's test is still open
          </h2>
          <p className="mt-2 max-w-md text-small text-text-secondary">Take it when you can. Your result goes into this week's review.</p>
          {test.instructions && <p className="mt-3 max-w-md text-small text-text-secondary">{test.instructions}</p>}
          {test.passIf && !light && (
            <p className="mt-3 max-w-md text-small text-text">
              <span className="font-medium">Pass mark: </span>
              <span className="text-text-secondary">{formatPassIf(test.passIf)}</span>
            </p>
          )}
        </div>
        <Button type="button" variant="primary" className="shrink-0 sm:min-w-44" onClick={() => setOpen(true)}>
          Log my result
        </Button>
      </div>

      <TestResultDialog week={week} open={open} onOpenChange={setOpen} title="Log my result" />
    </section>
  );
};
