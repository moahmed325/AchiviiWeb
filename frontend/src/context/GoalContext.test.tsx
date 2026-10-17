import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { GoalProvider, useGoal } from './GoalContext';
import * as api from '../lib/api';
import type { Goal, ReconcileResult } from '../types';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    // Weekly update M1.2b: the load asks to close a week first; the switch-off answer, so no test reaches the network.
    closeWeek: vi.fn(async () => ({ due: false as const })),
    fetchHealthCheck: vi.fn(), fetchCurrentUser: vi.fn(), fetchActiveGoal: vi.fn(), reconcileGoal: vi.fn(),
  };
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

const BODY = {
  applies: true,
  goalId: 'g1',
  asOf: '2026-09-23T12:00:00.000Z',
  timezone: 'UTC',
  days: [],
  gap: null,
  carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
  signals: {
    carried: [{ fromDate: '2026-09-22', fromTaskId: 'tue', toDate: '2026-09-23', toTaskId: 'wed', stepTitle: 'Lead' }],
    dropped: [],
    swapOffer: null,
    shortOnTime: false,
    gentleReturn: null,
    notice: 'carried',
  },
} satisfies ReconcileResult;

describe('GoalProvider keeps the reconcile body (missed sessions M3.1 R2)', () => {
  it('stores a plan v2 body', async () => {
    mocked.reconcileGoal.mockResolvedValue(BODY);
    const { result } = await loaded();
    expect(result.current.reconciliation).toEqual(BODY);
  });

  it('is null for applies: false', async () => {
    const { result } = await loaded();
    expect(result.current.reconciliation).toBeNull();
  });

  it('is null after a failure, and the goal still loads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.reconcileGoal.mockRejectedValue(new Error('Failed to reconcile goal'));
    const { result } = await loaded();
    expect(result.current.reconciliation).toBeNull();
    expect(result.current.activeGoal).toBe(GOAL);
    warn.mockRestore();
  });

  it('is null when signed out', async () => {
    localStorage.clear();
    mocked.reconcileGoal.mockResolvedValue(BODY);
    const { result } = renderHook(() => useGoal(), { wrapper });
    await waitFor(() => expect(result.current.loadingGoal).toBe(false));
    expect(result.current.reconciliation).toBeNull();
  });
});

describe('GoalProvider catches up on a new day (missed sessions M3.1 R3)', () => {
  const show = (event: 'visibilitychange' | 'focus') =>
    act(() => {
      if (event === 'visibilitychange') document.dispatchEvent(new Event('visibilitychange'));
      else window.dispatchEvent(new Event('focus'));
    });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as { visibilityState?: unknown }).visibilityState;
  });

  it('on a new date, a visibility event runs reconcile, then the goal, once', async () => {
    await loaded();
    const order: string[] = [];
    mocked.reconcileGoal.mockImplementation(async () => {
      order.push('reconcile');
      return BODY;
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      order.push('fetch');
      return GOAL;
    });

    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    await show('visibilitychange');
    await waitFor(() => expect(order).toEqual(['reconcile', 'fetch']));
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
  });

  it('a window focus on a new date does the same', async () => {
    const { result } = await loaded();
    mocked.reconcileGoal.mockResolvedValue(BODY);
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    await show('focus');
    await waitFor(() => expect(result.current.reconciliation).toEqual(BODY));
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
  });

  it('on the same date, nothing runs', async () => {
    await loaded();
    vi.setSystemTime(new Date('2026-09-23T12:30:00Z'));
    await show('visibilitychange');
    await show('focus');
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(1);
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(1);
  });

  it('two quick events run once, and the next event on the same new date does nothing', async () => {
    const { result } = await loaded();
    let answer: (body: ReconcileResult) => void = () => {};
    mocked.reconcileGoal.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    await show('visibilitychange');
    await show('focus');
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
    await act(async () => answer(BODY));
    await waitFor(() => expect(result.current.loadingGoal).toBe(false));
    await show('visibilitychange');
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
  });

  it('does nothing while the page is hidden', async () => {
    await loaded();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    await show('visibilitychange');
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(1);
  });

  it('does nothing when signed out', async () => {
    localStorage.clear();
    const { result } = renderHook(() => useGoal(), { wrapper });
    await waitFor(() => expect(result.current.loadingGoal).toBe(false));
    vi.setSystemTime(new Date('2026-09-24T12:00:00Z'));
    await show('visibilitychange');
    expect(mocked.reconcileGoal).not.toHaveBeenCalled();
    expect(mocked.fetchActiveGoal).not.toHaveBeenCalled();
  });
});

describe('GoalProvider plan actions (missed sessions M3.3)', () => {
  const BODY = {
    applies: true,
    goalId: 'g1',
    asOf: '',
    timezone: 'UTC',
    days: [],
    gap: null,
    carry: { enabled: true, carries: [], drops: [], held: [], alreadyCarried: [], written: [] },
    signals: { carried: [], dropped: [], swapOffer: null, shortOnTime: false, gentleReturn: null, notice: null },
  } as const;

  it('applyReconciliation stores the body, then reloads the goal without reconciling again', async () => {
    const { result } = await loaded();
    const after = { ...GOAL, rawGoal: 'Run a 10K, swapped' } as Goal;
    mocked.fetchActiveGoal.mockResolvedValueOnce(after);
    await act(() => result.current.applyReconciliation(structuredClone(BODY) as never));
    expect(result.current.reconciliation).toEqual(BODY);
    expect(result.current.activeGoal).toEqual(after);
    expect(mocked.fetchActiveGoal).toHaveBeenCalledTimes(2);
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(1);
    expect(result.current.loadingGoal).toBe(false);
  });

  it('reloadPlan reconciles, then reloads the goal, without the loading state', async () => {
    const { result } = await loaded();
    const order: string[] = [];
    const loading: boolean[] = [];
    mocked.reconcileGoal.mockImplementation(async () => {
      order.push('reconcile');
      loading.push(result.current.loadingGoal);
      return structuredClone(BODY) as never;
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      order.push('fetch');
      return GOAL;
    });
    await act(() => result.current.reloadPlan());
    expect(order).toEqual(['reconcile', 'fetch']);
    expect(loading).toEqual([false]);
    expect(result.current.reconciliation).toEqual(BODY);
  });
});

describe('GoalProvider closes a finished week first (weekly update M1.2b, RULE-17)', () => {
  const V2 = { ...GOAL, roadmapWeeks: [{ weekNumber: 1, status: 'active', test: { type: 'timer', instructions: 'Run', passIf: '' } }] } as unknown as Goal;
  let order: string[];
  const answer = (check: Awaited<ReturnType<typeof api.closeWeek>>, close?: () => Promise<Awaited<ReturnType<typeof api.closeWeek>>>) =>
    mocked.closeWeek.mockImplementation(async (_t, mode) => {
      order.push(mode === 'check' ? 'close:check' : 'close');
      if (mode === 'check') return check;
      return close ? close() : ({ due: true, closedBy: 'auto' } as never);
    });

  beforeEach(() => {
    order = [];
    mocked.reconcileGoal.mockImplementation(async () => {
      order.push('reconcile');
      return { applies: false, reason: 'no_active_goal' };
    });
    mocked.fetchActiveGoal.mockImplementation(async () => {
      order.push('fetch');
      return V2;
    });
  });
  afterEach(() => window.history.pushState({}, '', '/'));

  it('switch off ({ due: false }): the check, then reconcile, then the fetch; nothing held, nothing shown', async () => {
    answer({ due: false });
    const { result } = await loaded();
    expect(order).toEqual(['close:check', 'reconcile', 'fetch']);
    expect(mocked.closeWeek).toHaveBeenCalledWith('t', 'check');
    expect(result.current).toMatchObject({ closingWeek: false, heldClose: null, closeFailed: false });
  });

  it('due with the test logged: close, then reconcile, then the fetch; "getting ready" while the close runs', async () => {
    let release!: () => void;
    const closing = new Promise<void>((resolve) => (release = resolve));
    answer({ due: true, weekNumber: 1, testLogged: true }, async () => {
      await closing;
      return { due: true, closedBy: 'auto' } as never;
    });
    const hook = renderHook(() => useGoal(), { wrapper });
    await waitFor(() => expect(hook.result.current.closingWeek).toBe(true));
    expect(order).toEqual(['close:check', 'close']);
    await act(async () => release());
    await waitFor(() => expect(hook.result.current.activeGoal).not.toBeNull());
    expect(order).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    expect(hook.result.current.closingWeek).toBe(false);
  });

  it('due, test not logged, on Today: held; the goal is fetched without reconcile; one answer runs the close', async () => {
    answer({ due: true, weekNumber: 1, testLogged: false });
    const { result } = await loaded();
    expect(result.current.heldClose).toEqual({ weekNumber: 1 });
    expect(order).toEqual(['close:check', 'fetch']);
    expect(result.current.reconciliation).toBeNull();

    // A plan reload waits for the card (reconcile waits, RULE-17).
    await act(() => result.current.reloadPlan());
    expect(order).toEqual(['close:check', 'fetch']);

    let answers: boolean[] = [];
    await act(async () => {
      answers = await Promise.all([result.current.answerHeldClose(), result.current.answerHeldClose()]);
    });
    expect(answers.sort()).toEqual([false, true]);
    expect(order).toEqual(['close:check', 'fetch', 'close', 'reconcile', 'fetch']);
    expect(result.current.heldClose).toBeNull();
  });

  it('a failing log keeps the card and sends no close', async () => {
    answer({ due: true, weekNumber: 1, testLogged: false });
    const { result } = await loaded();
    await act(async () => {
      await expect(result.current.answerHeldClose(async () => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    });
    expect(result.current.heldClose).toEqual({ weekNumber: 1 });
    expect(order).toEqual(['close:check', 'fetch']);
  });

  it('on any other screen the week closes at once, with no card', async () => {
    window.history.pushState({}, '', '/dashboard');
    answer({ due: true, weekNumber: 1, testLogged: false });
    const { result } = await loaded();
    expect(order).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    expect(result.current.heldClose).toBeNull();
  });

  it('a 503 never stops the load: reconcile and the fetch run, and closeFailed is set until a retry works', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail = true;
    answer({ due: true, weekNumber: 1, testLogged: true }, async () => {
      if (fail) throw new api.ApiError("Couldn't get your next week ready. Please try again.", 503);
      return { due: true, closedBy: 'auto' } as never;
    });
    const { result } = await loaded();
    expect(order).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    expect(result.current.closeFailed).toBe(true);
    expect(result.current.goalLoadFailed).toBe(false);

    fail = false;
    order = [];
    await act(() => result.current.retryClose());
    expect(order).toEqual(['close:check', 'close', 'reconcile', 'fetch']);
    expect(result.current.closeFailed).toBe(false);
    warn.mockRestore();
  });

  it('a 4xx or an unreachable server is not a failed close: the load goes on and nothing is shown', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocked.closeWeek.mockRejectedValueOnce(new api.ApiError('Active goal not found.', 404));
    const first = await loaded();
    expect(first.result.current.closeFailed).toBe(false);
    first.unmount();
    mocked.closeWeek.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const second = await loaded();
    expect(second.result.current.closeFailed).toBe(false);
    expect(mocked.reconcileGoal).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('a plan reload (M3.3) also closes first, then reconciles and fetches', async () => {
    answer({ due: false });
    const { result } = await loaded();
    order = [];
    await act(() => result.current.reloadPlan());
    expect(order).toEqual(['close:check', 'reconcile', 'fetch']);
  });

  it('refreshGoal stays fetch-only', async () => {
    answer({ due: false });
    const { result } = await loaded();
    order = [];
    await act(() => result.current.refreshGoal());
    expect(order).toEqual(['fetch']);
  });
});
