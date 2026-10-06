import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { GoalProvider, useGoal } from './GoalContext';
import * as api from '../lib/api';
import type { Goal } from '../types';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, fetchHealthCheck: vi.fn(), fetchCurrentUser: vi.fn(), fetchActiveGoal: vi.fn(), reconcileGoal: vi.fn() };
});

const mocked = vi.mocked(api);
const GOAL = { id: 'g1', rawGoal: 'Run a 10K', currentWeek: 1, dailyTasks: [] } as unknown as Goal;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>
    <GoalProvider>{children}</GoalProvider>
  </AuthProvider>
);

const loaded = async () => {
  const hook = renderHook(() => useGoal(), { wrapper });
  await waitFor(() => expect(hook.result.current.activeGoal).not.toBeNull());
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('achivii_auth_token', 't');
  mocked.fetchHealthCheck.mockResolvedValue({ status: 'ok', timestamp: '', service: 'api' });
  mocked.fetchCurrentUser.mockResolvedValue({ id: 'u1', email: 'mo@example.com', created_at: '' });
  mocked.fetchActiveGoal.mockResolvedValue(GOAL);
  mocked.reconcileGoal.mockResolvedValue({ applies: false, reason: 'no_active_goal' });
});

describe('GoalProvider reconcile on load (missed sessions M1.3, ND-6)', () => {
  it('reconciles once per load, before the goal is fetched', async () => {
    const order: string[] = [];
    mocked.reconcileGoal.mockImplementation(async () => {
      order.push('reconcile');
      return { applies: false, reason: 'no_active_goal' };
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      order.push('fetch');
      return GOAL;
    });

    await loaded();
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(1);
    expect(mocked.reconcileGoal).toHaveBeenCalledWith('t');
    expect(order).toEqual(['reconcile', 'fetch']);
  });

  it('does not reconcile again on refresh', async () => {
    const { result } = await loaded();
    await act(() => result.current.refreshGoal());
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(1);
  });

  it('still loads the goal when reconcile fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.reconcileGoal.mockRejectedValue(new Error('Failed to reconcile goal'));
    const { result } = await loaded();
    expect(result.current.activeGoal).toBe(GOAL);
    expect(result.current.goalLoadFailed).toBe(false);
    expect(warn).toHaveBeenCalledWith('Failed to reconcile goal:', expect.any(Error));
    warn.mockRestore();
  });

  it('does not reconcile when signed out', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useGoal(), { wrapper });
    await waitFor(() => expect(result.current.loadingGoal).toBe(false));
    expect(mocked.reconcileGoal).not.toHaveBeenCalled();
    expect(mocked.fetchActiveGoal).not.toHaveBeenCalled();
  });
});
