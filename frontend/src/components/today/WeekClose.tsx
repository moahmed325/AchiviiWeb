import React, { useState } from 'react';
import type { Goal, WeeklyTestResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { ApiError, logWeeklyTestResult } from '../../lib/api';
import { ReviewTestResultStep } from '../review/ReviewTestResultStep';
import { Button, Dialog, DialogContent, LoadingState } from '../ui';

// Weekly update M1.2b (RULE-8, WU-14, WU-28): what the app shows around an automatic week close.

export const GETTING_READY = 'Getting your next week ready…';
export const CLOSE_FAILED = "Couldn't get your next week ready. Please try again.";
const NOT_SAVED = "That didn't save. Please try again.";

/**
 * "Getting ready" (section 6): shown by every loading view while the close call writes the next week, in place of its
 * usual loading state. The skeleton's pulse stops under reduced motion (index.css).
 */
export const GettingReady: React.FC = () => (
  <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
    <LoadingState label={GETTING_READY} showLabel />
  </main>
);

/**
 * The test first (WU-14): a close is due and the week's test isn't logged, so Today shows only this card. "Log result"
 * opens the test entry, and saving the result closes the week with it. Anything else is Skip and closes the week at
 * once as unlogged: "Skip", dismissing the card or the entry, or going to another screen (AppShell). Only the first
 * answer sends a close (`answerHeldClose`). Closing the tab answers nothing, so the card shows again on the next open.
 */
export const WeekTestFirst: React.FC<{ goal: Goal; weekNumber: number }> = ({ goal, weekNumber }) => {
  const { token } = useAuth();
  const { answerHeldClose } = useGoal();
  const week = goal.roadmapWeeks?.find((w) => w.weekNumber === weekNumber);
  const [entry, setEntry] = useState(false);
  const [result, setResult] = useState<WeeklyTestResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = () => {
    if (!saving) void answerHeldClose();
  };
  const onOpenChange = (open: boolean) => {
    if (!open) skip();
  };

  const onSave = async () => {
    if (!result || !token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await answerHeldClose(async () => {
        try {
          await logWeeklyTestResult(weekNumber, result, token);
        } catch (err) {
          // Another tab closed the week meanwhile: nothing left to log, the close below finds nothing due.
          if (err instanceof ApiError && err.code === 'week_closed') return;
          throw err;
        }
      });
    } catch (err) {
      console.warn('Failed to log the test result:', err);
      setError(NOT_SAVED);
      setSaving(false);
    }
  };

  return (
    <main id="main" className="ui-root mx-auto w-full max-w-3xl flex-1 px-gutter py-10 sm:py-14">
      <Dialog open onOpenChange={onOpenChange}>
        {entry ? (
          <DialogContent
            title="Log last week's test"
            size="md"
            footer={
              <>
                <Button variant="quiet" onClick={skip} disabled={saving}>
                  Skip
                </Button>
                <Button variant="primary" onClick={onSave} disabled={!result || !token} loading={saving}>
                  Save result
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <ReviewTestResultStep target={week?.target} test={week?.test} testResult={result} onChange={setResult} disabled={saving} />
              {error && (
                <p role="alert" className="text-small text-danger">
                  {error}
                </p>
              )}
            </div>
          </DialogContent>
        ) : (
          <DialogContent
            title="Did you do last week's test?"
            description="Log your result to shape next week."
            size="sm"
            footer={
              <>
                <Button variant="quiet" onClick={skip}>
                  Skip
                </Button>
                <Button variant="primary" onClick={() => setEntry(true)}>
                  Log result
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </main>
  );
};
