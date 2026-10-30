import React, { useState } from 'react';
import type { DailyTimeCheck } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { ApiError, answerDailyTime } from '../../lib/api';
import { Button } from '../ui';
import { NOT_SAVED } from '../../lib/weekClose';

/**
 * Weekly update M3.3b (RULE-6, WU-7, AC-5): after two hard weeks (each under half done), one card asks once whether
 * the daily time still works. Keep saves the current time and closes the card; a shorter choice is saved for the next
 * written week and the card says so for the rest of the visit. Both refresh the goal.
 */
export const DailyTimeCard: React.FC<{ check: DailyTimeCheck | null | undefined }> = ({ check }) => {
  const { token } = useAuth();
  const { refreshGoal } = useGoal();
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changedTo, setChangedTo] = useState<number | null>(null);

  if (changedTo !== null) {
    return (
      <div className="mt-6 border-l-2 border-achievement/50 py-0.5 pl-4">
        <p role="status" className="text-small text-text-secondary">
          From next week, your sessions are {changedTo} minutes.
        </p>
      </div>
    );
  }
  if (!check) return null;

  const save = async (minutes: number) => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await answerDailyTime(minutes, token);
      if (minutes !== check.minutes) setChangedTo(minutes);
      await refreshGoal();
    } catch (err) {
      console.warn('Failed to save the daily time:', err);
      // The question is gone on the server (answered elsewhere, or a switch turned off): refresh so the card goes.
      if (err instanceof ApiError && err.status === 409 && (err.code === 'no_daily_time_check' || err.code === 'week_close_disabled')) {
        await refreshGoal();
      } else {
        setError(NOT_SAVED);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="daily-time-heading" className="dash-panel animate-rise-in relative mt-10 p-6 sm:p-8">
      <h2 id="daily-time-heading" className="text-h3 text-text">
        Does {check.minutes} minutes a day still work?
      </h2>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="button" variant={choosing ? 'quiet' : 'primary'} disabled={saving} onClick={() => save(check.minutes)}>
          Keep {check.minutes} minutes
        </Button>
        {choosing ? (
          check.shorter.map((minutes) => (
            <Button key={minutes} type="button" variant="secondary" disabled={saving} onClick={() => save(minutes)}>
              {minutes} min
            </Button>
          ))
        ) : (
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setChoosing(true)}>
            Make it shorter
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </section>
  );
};
