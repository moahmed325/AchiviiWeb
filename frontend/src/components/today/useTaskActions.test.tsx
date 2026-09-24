import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from '../../context/AuthContext';
import { GoalProvider, useGoal } from '../../context/GoalContext';
import * as api from '../../lib/api';
import type { DailyTask, Goal } from '../../types';
import { useTaskActions } from './useTaskActions';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, fetchHealthCheck: vi.fn(), fetchCurrentUser: vi.fn(), fetchActiveGoal: vi.fn(), updateDailyTask: vi.fn() };
});

const mocked = vi.mocked(api);

const TASK = {
  id: 't1',
  goalId: 'g1',
  weekNumber: 1,
  dayNumber: 3,
  date: '2026-09-23',
  title: 'Easy run',
  status: 'pending',
  notes: undefined,
} as unknown as DailyTask;
const OTHER = { ...TASK, id: 't2', dayNumber: 4, title: 'Intervals' } as DailyTask;
const GOAL = { id: 'g1', rawGoal: 'Run a 10K', currentWeek: 1, dailyTasks: [TASK, OTHER] } as Goal;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <GoalProvider>{children}</GoalProvider>
  </AuthProvider>
);

/** The server's answer: the task as sent, with what the server sets. */
const echo = () =>
  mocked.updateDailyTask.mockImplementation(async (id, updates) => {
    const base = [TASK, OTHER].find((t) => t.id === id)!;
    return { ...base, ...updates, completedAt: updates.status === 'completed' ? '2026-09-23T10:00:00Z' : undefined } as DailyTask;
  });

const setup = async () => {
  const hook = renderHook(() => ({ actions: useTaskActions(), goal: useGoal().activeGoal }), { wrapper });
  await waitFor(() => expect(hook.result.current.goal).not.toBeNull());
  return hook;
};

const taskIn = (goal: Goal | null, id: string) => goal?.dailyTasks?.find((t) => t.id === id);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(GOAL);
  echo();
});

describe('useTaskActions', () => {
  it('complete and un-complete put the server task into GoalContext', async () => {
    const { result } = await setup();
    await act(() => result.current.actions.toggleComplete(TASK));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t1', { status: 'completed', notes: undefined }, 't');
    expect(taskIn(result.current.goal, 't1')).toMatchObject({ status: 'completed', completedAt: '2026-09-23T10:00:00Z' });
    expect(taskIn(result.current.goal, 't2')).toBe(OTHER);

    // The caller still holds the old, pending copy; the write starts from the one in context.
    await act(() => result.current.actions.toggleComplete(TASK));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t1', { status: 'pending', notes: undefined }, 't');
    expect(taskIn(result.current.goal, 't1')?.status).toBe('pending');
  });

  it('a completion after a saved note sends that note, even from a stale task', async () => {
    const { result } = await setup();
    await act(async () => {
      expect(await result.current.actions.saveNote(TASK, 'Felt easy at 6:10/km')).toMatchObject({ ok: true });
    });
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t1', { notes: 'Felt easy at 6:10/km' }, 't');
    expect(taskIn(result.current.goal, 't1')?.notes).toBe('Felt easy at 6:10/km');

    await act(() => result.current.actions.toggleComplete(TASK));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t1', { status: 'completed', notes: 'Felt easy at 6:10/km' }, 't');
  });

  it('an unsaved draft the user is looking at goes with the completion, as before', async () => {
    const { result } = await setup();
    await act(() => result.current.actions.toggleComplete(TASK, 'Draft line'));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith('t1', { status: 'completed', notes: 'Draft line' }, 't');
  });

  it('an unchanged note is not sent', async () => {
    const { result } = await setup();
    await act(async () => {
      expect(await result.current.actions.saveNote(TASK, '')).toBeNull();
    });
    expect(mocked.updateDailyTask).not.toHaveBeenCalled();
  });

  it('finishing focus completes the step and adds the reflection to the note', async () => {
    const { result } = await setup();
    await act(async () => {
      await result.current.actions.saveNote(TASK, 'Warm-up done');
    });
    await act(() => result.current.actions.finishFocus(TASK, '  Held the pace  '));
    expect(mocked.updateDailyTask).toHaveBeenLastCalledWith(
      't1',
      { status: 'completed', notes: 'Warm-up done\n• Focus win: Held the pace' },
      't',
    );
    expect(taskIn(result.current.goal, 't1')?.status).toBe('completed');
  });

  it('a failed write changes nothing and returns the error', async () => {
    const { result } = await setup();
    mocked.updateDailyTask.mockRejectedValueOnce(new Error('Failed to fetch'));
    let outcome: Awaited<ReturnType<typeof result.current.actions.toggleComplete>> | undefined;
    await act(async () => {
      outcome = await result.current.actions.toggleComplete(TASK);
    });
    expect(outcome).toMatchObject({ ok: false, error: new Error('Failed to fetch') });
    expect(taskIn(result.current.goal, 't1')).toBe(TASK);
  });
});
