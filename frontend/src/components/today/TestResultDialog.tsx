import React, { useState } from 'react';
import type { RoadmapWeek, WeeklyTestResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { logWeeklyTestResult } from '../../lib/api';
import { ReviewTestResultStep } from '../review/ReviewTestResultStep';
import { LightTestEntry } from '../review/LightTestEntry';
import { isLightTest, lightTestResult } from '../../lib/lightTest';
import { Button, Dialog, DialogClose, DialogContent } from '../ui';

const NOT_SAVED = "That didn't save. Please try again.";

/**
 * The dialog that logs a week's test result without closing any week (`PUT .../test-result`), then refreshes the goal.
 * Shared by the late-test card (missed sessions M4.1) and the re-test entry (weekly update M3.3b, WU-17), which logs
 * the re-test as the re-tested week's result. A light week's test is logged as done plus a note (M2.1).
 */
export const TestResultDialog: React.FC<{
  week: RoadmapWeek;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}> = ({ week, open, onOpenChange, title }) => {
  const { token } = useAuth();
  const { refreshGoal } = useGoal();
  const [result, setResult] = useState<WeeklyTestResult | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const test = week.test;
  const light = isLightTest(test);

  const changeOpen = (next: boolean) => {
    if (saving) return;
    onOpenChange(next);
    if (!next) {
      // M2.1 review: a closed entry keeps nothing; a cancelled note or result is never saved later.
      setError(null);
      setResult(null);
      setNote('');
    }
  };

  const onSave = async () => {
    const toSave = light ? lightTestResult(note) : result;
    if (!toSave || !token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await logWeeklyTestResult(week.weekNumber, toSave, token);
      onOpenChange(false);
      setResult(null);
      setNote('');
      await refreshGoal();
    } catch (err) {
      console.warn('Failed to log the test result:', err);
      setError(NOT_SAVED);
    } finally {
      setSaving(false);
    }
  };

  if (!test) return null;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        title={title}
        size="md"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="quiet" disabled={saving}>
                Cancel
              </Button>
            </DialogClose>
            <Button variant="primary" onClick={onSave} disabled={(!light && !result) || !token} loading={saving}>
              {light ? 'I did it' : 'Save result'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {light ? (
            <LightTestEntry weekNumber={week.weekNumber} target={week.target} test={test} note={note} onNoteChange={setNote} disabled={saving} />
          ) : (
            <ReviewTestResultStep target={week.target} test={test} testResult={result} onChange={setResult} disabled={saving} />
          )}
          {error && (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
