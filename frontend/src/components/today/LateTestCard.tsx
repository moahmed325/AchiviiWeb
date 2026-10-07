import React, { useState } from 'react';
import type { Goal, WeeklyTestResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { logWeeklyTestResult } from '../../lib/api';
import { formatPassIf } from '../../lib/formatters';
import { lateTestWeek } from '../../lib/lateTest';
import { ReviewTestResultStep } from '../review/ReviewTestResultStep';
import { Button, Dialog, DialogClose, DialogContent } from '../ui';

const NOT_SAVED = "That didn't save. Please try again.";

/**
 * Missed sessions M4.1 (RULE-7, UX-3, AC-8): after test day, while the week's test has no result and the week is not
 * reviewed, one calm card offers to log it. Logging stores the result without closing the week (ND-4); the goal is
 * then refreshed, so the card goes. Self-contained: it reads the goal context and renders nothing outside its window.
 */
export const LateTestCard: React.FC<{ goal: Goal; now: Date; timezone?: string }> = ({ goal, now, timezone }) => {
  const { token } = useAuth();
  const { reconciliation, refreshGoal } = useGoal();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<WeeklyTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = lateTestWeek(goal, reconciliation, now, timezone);
  if (!week?.test) return null;
  const test = week.test;

  const onOpenChange = (next: boolean) => {
    if (saving) return;
    setOpen(next);
    if (!next) setError(null);
  };

  const onSave = async () => {
    if (!result || !token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await logWeeklyTestResult(week.weekNumber, result, token);
      setOpen(false);
      setResult(null);
      await refreshGoal();
    } catch (err) {
      console.warn('Failed to log the test result:', err);
      setError(NOT_SAVED);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="late-test-heading" className="dash-panel animate-rise-in relative mt-10 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 id="late-test-heading" className="text-h3 text-text">
            This week's test is still open
          </h2>
          <p className="mt-2 max-w-md text-small text-text-secondary">Take it when you can. Your result goes into this week's review.</p>
          {test.instructions && <p className="mt-3 max-w-md text-small text-text-secondary">{test.instructions}</p>}
          {test.passIf && (
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

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          title="Log my result"
          size="md"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="quiet" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="primary" onClick={onSave} disabled={!result || !token} loading={saving}>
                Save result
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <ReviewTestResultStep target={week.target} test={test} testResult={result} onChange={setResult} disabled={saving} />
            {error && (
              <p role="alert" className="text-small text-danger">
                {error}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
