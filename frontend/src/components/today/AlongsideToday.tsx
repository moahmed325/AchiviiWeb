import React, { useState } from 'react';
import { Check, Clock, Sparkles } from 'lucide-react';
import type { Goal } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { updateDailyTask } from '../../lib/api';
import { isRestLike, isToday, parseSteps } from '../../lib/today';
import { Button } from '../ui';

/**
 * ND-41: the guided skill running alongside the main plan, under Today's own step. Its own time, its own step; done
 * here with one tap (no focus session), and the plan carries on from it as it does for the main plan.
 */
export const AlongsideToday: React.FC<{ goal: Goal }> = ({ goal }) => {
  const { token, user } = useAuth();
  const { activeGoal, updateActiveGoal } = useGoal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const task = (goal.dailyTasks ?? []).find((t) => isToday(t, new Date(), user?.timezone));
  const steps = task ? parseSteps(task.detailedSteps) : [];
  const done = task?.status === 'completed';

  const toggle = async () => {
    if (!task || !token) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDailyTask(task.id, { status: done ? 'pending' : 'completed' }, token);
      if (activeGoal?.alongsideGoal) {
        const alongsideGoal = {
          ...activeGoal.alongsideGoal,
          dailyTasks: (activeGoal.alongsideGoal.dailyTasks ?? []).map((t) => (t.id === updated.id ? updated : t)),
        };
        updateActiveGoal({ ...activeGoal, alongsideGoal });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="alongside-heading" className="relative mt-12 rounded-card border border-border bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-2 font-ui-mono text-micro uppercase text-achievement">
        <Sparkles aria-hidden="true" strokeWidth={1.5} className="size-4" />
        Also today · Week {goal.currentWeek || 1}
      </p>
      <h2 id="alongside-heading" className="mt-2 text-h3 text-text">
        {goal.rawGoal}
      </h2>

      {!task || isRestLike(task) ? (
        <p className="mt-3 text-body text-text-secondary">Nothing for this skill today. It picks up on its next training day.</p>
      ) : (
        <>
          <p className="mt-4 text-body-lg font-medium text-text">{task.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-small text-text-secondary">
            <Clock aria-hidden="true" strokeWidth={1.5} className="size-4" />
            <span className="tabular">{task.durationMinutes} min</span>
          </p>
          {steps.length > 0 && (
            <ol aria-label="Steps" className="mt-4 flex flex-col gap-2">
              {steps.map((step) => (
                <li key={step.stepNumber} className="text-small text-text-secondary">
                  <span className="text-text">{step.title}</span>
                  {step.durationMinutes ? <span className="tabular"> · {step.durationMinutes} min</span> : null}
                </li>
              ))}
            </ol>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {done ? (
              <>
                <p className="flex items-center gap-2 text-body text-text">
                  <Check aria-hidden="true" strokeWidth={1.5} className="size-5 text-achievement" />
                  Done for today
                </p>
                <Button variant="quiet" size="sm" loading={saving} onClick={() => void toggle()}>
                  Undo
                </Button>
              </>
            ) : (
              <Button variant="secondary" loading={saving} onClick={() => void toggle()}>
                Mark done
              </Button>
            )}
          </div>
          <p role="alert" className="mt-2 text-small text-danger empty:hidden">
            {error ?? ''}
          </p>
        </>
      )}
    </section>
  );
};
