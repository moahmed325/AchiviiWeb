import { useCallback, useLayoutEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { updateDailyTask } from '../../lib/api';
import type { DailyTask, Goal } from '../../types';

export type TaskWriteResult = { ok: true; task: DailyTask } | { ok: false; error: Error };

/**
 * Today's only way to write a task (R-9, R-10). Every write sends the same fields the legacy Today sent, and on
 * success puts the server's task back into GoalContext, so no later write can start from a stale copy. A failure
 * changes nothing and is returned to the caller to show.
 */
export function useTaskActions() {
  const { token } = useAuth();
  const { activeGoal, updateActiveGoal } = useGoal();
  // Writes resolve after later renders; they must merge into the goal as it is then, not as it was when they started.
  const goalRef = useRef<Goal | null>(activeGoal);
  useLayoutEffect(() => {
    goalRef.current = activeGoal;
  }, [activeGoal]);

  const latest = useCallback((task: DailyTask) => goalRef.current?.dailyTasks?.find((t) => t.id === task.id) ?? task, []);

  const write = useCallback(
    async (taskId: string, updates: Parameters<typeof updateDailyTask>[1]): Promise<TaskWriteResult> => {
      if (!token) return { ok: false, error: new Error('Not signed in') };
      try {
        const updated = await updateDailyTask(taskId, updates, token);
        const goal = goalRef.current;
        if (goal) {
          const next = { ...goal, dailyTasks: (goal.dailyTasks || []).map((t) => (t.id === updated.id ? updated : t)) };
          goalRef.current = next;
          updateActiveGoal(next);
        }
        return { ok: true, task: updated };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
      }
    },
    [token, updateActiveGoal],
  );

  /** Done ↔ not done. Sends the note the user is looking at: the unsaved draft if there is one, else the saved note. */
  const toggleComplete = useCallback(
    (task: DailyTask, draftNote?: string) => {
      const current = latest(task);
      const status = current.status === 'completed' ? 'pending' : 'completed';
      return write(current.id, { status, notes: draftNote !== undefined ? draftNote : current.notes });
    },
    [latest, write],
  );

  /** Saves the note only when it differs from the saved one. `null` means there was nothing to save. */
  const saveNote = useCallback(
    async (task: DailyTask, note: string): Promise<TaskWriteResult | null> => {
      const current = latest(task);
      if (note === (current.notes ?? '')) return null;
      return write(current.id, { notes: note });
    },
    [latest, write],
  );

  /** Focus mode's "Save & Return": completes the step and adds the reflection as a "Focus win" line. */
  const finishFocus = useCallback(
    (task: DailyTask, reflection?: string) => {
      const current = latest(task);
      const win = reflection?.trim();
      const notes = win ? (current.notes ? `${current.notes}\n• Focus win: ${win}` : win) : current.notes;
      return write(current.id, { status: 'completed', notes });
    },
    [latest, write],
  );

  return { toggleComplete, saveNote, finishFocus };
}
