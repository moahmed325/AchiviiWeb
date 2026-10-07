import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Goal, GoalCompletionPayload, Reconciliation } from '../types';
import { fetchActiveGoal, reconcileGoal, resetActiveGoal as apiResetGoal, completeGoal as apiCompleteGoal, fetchHealthCheck } from '../lib/api';
import { useAuth } from './AuthContext';
import { todayKey } from '../lib/today';

interface GoalContextType {
  activeGoal: Goal | null;
  loadingGoal: boolean;
  /** The last goal fetch failed, so a null `activeGoal` does not mean the user has no goal. */
  goalLoadFailed: boolean;
  /** The token whose goal fetch last settled, so a consumer can tell the goal state is current for its token. */
  goalLoadedFor: string | null;
  apiStatus: 'online' | 'offline' | 'checking';
  /**
   * The latest plan v2 reconcile body (missed sessions M3.1, ND-16): the source of the miss notice on Today and
   * the Dashboard. Null before the first answer, after a failure, when signed out, and for `applies: false`.
   */
  reconciliation: Reconciliation | null;
  refreshGoal: () => Promise<void>;
  /**
   * Keeps a plan action's response (missed sessions M3.3) as `reconciliation`, then reloads the goal, whose steps
   * changed on the server. A later automatic reconcile replaces it as usual.
   */
  applyReconciliation: (body: Reconciliation) => Promise<void>;
  /** Reconcile, then reload the goal, without the loading state, so the open screen stays as it is (M3.3 R7). */
  reloadPlan: () => Promise<void>;
  setActiveGoal: (goal: Goal | null) => void;
  updateActiveGoal: (goal: Goal) => void;
  resetGoal: () => Promise<boolean>;
  completeGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
  completeActiveGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const timezone = user?.timezone;
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [loadingGoal, setLoadingGoal] = useState<boolean>(true);
  const [goalLoadFailed, setGoalLoadFailed] = useState(false);
  const [goalLoadedFor, setGoalLoadedFor] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  // When the last load started, and whether one is running, for the new-day catch-up (M3.1 R3).
  const lastLoadAt = useRef<Date | null>(null);
  const loading = useRef(false);

  // Health check on initial mount
  useEffect(() => {
    let cancelled = false;
    fetchHealthCheck()
      .then(() => {
        if (!cancelled) setApiStatus('online');
      })
      .catch(() => {
        if (!cancelled) setApiStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch active goal when token changes
  const loadGoal = useCallback(async () => {
    if (!token) {
      setActiveGoal(null);
      setReconciliation(null);
      lastLoadAt.current = null;
      setGoalLoadFailed(false);
      setGoalLoadedFor(null);
      setLoadingGoal(false);
      return;
    }

    loading.current = true;
    lastLoadAt.current = new Date();
    setLoadingGoal(true);
    // Missed sessions (ND-6): reconcile once per load, before the goal is fetched, so the goal reflects it.
    // A failure here never stops the goal from loading. The body is kept for the miss notice (M3.1).
    try {
      const result = await reconcileGoal(token);
      setReconciliation(result.applies ? result : null);
    } catch (err) {
      console.warn('Failed to reconcile goal:', err);
      setReconciliation(null);
    }
    try {
      const goal = await fetchActiveGoal(token);
      setActiveGoal(goal);
      setGoalLoadFailed(false);
    } catch (err) {
      console.warn('Failed to load active goal:', err);
      setActiveGoal(null);
      setGoalLoadFailed(true);
    } finally {
      setGoalLoadedFor(token);
      setLoadingGoal(false);
      loading.current = false;
    }
  }, [token]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  // A tab left open overnight catches up (M3.1 R3): when the page is seen again on a new local date, run the
  // same load (reconcile, then the goal). Never on the same date, never twice at once, never when signed out.
  useEffect(() => {
    if (!token) return;
    const catchUp = () => {
      if (document.visibilityState !== 'visible' || loading.current || !lastLoadAt.current) return;
      if (todayKey(new Date(), timezone) === todayKey(lastLoadAt.current, timezone)) return;
      loadGoal();
    };
    document.addEventListener('visibilitychange', catchUp);
    window.addEventListener('focus', catchUp);
    return () => {
      document.removeEventListener('visibilitychange', catchUp);
      window.removeEventListener('focus', catchUp);
    };
  }, [token, timezone, loadGoal]);

  // Update active goal in memory (e.g. after task completion)
  const updateActiveGoal = useCallback((updated: Goal) => {
    setActiveGoal(updated);
  }, []);

  // Refresh from API
  const refreshGoal = useCallback(async () => {
    if (!token) return;
    try {
      const goal = await fetchActiveGoal(token);
      setActiveGoal(goal);
      setGoalLoadFailed(false);
    } catch (err) {
      console.warn('Failed to refresh active goal:', err);
      setGoalLoadFailed(true);
    }
  }, [token]);

  const applyReconciliation = useCallback(
    async (body: Reconciliation) => {
      setReconciliation(body.applies ? body : null);
      await refreshGoal();
    },
    [refreshGoal]
  );

  const reloadPlan = useCallback(async () => {
    if (!token) return;
    try {
      const result = await reconcileGoal(token);
      setReconciliation(result.applies ? result : null);
    } catch (err) {
      console.warn('Failed to reconcile goal:', err);
    }
    await refreshGoal();
  }, [token, refreshGoal]);

  // Reset active goal
  const resetGoal = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    try {
      await apiResetGoal(token);
      setActiveGoal(null);
      return true;
    } catch (err) {
      console.error('Failed to reset goal:', err);
      return false;
    }
  }, [token]);

  // Complete active goal
  const completeGoal = useCallback(
    async (payload?: GoalCompletionPayload): Promise<Goal> => {
      if (!token) throw new Error('Not authenticated');
      const goal = await apiCompleteGoal(token, payload);
      setActiveGoal(goal);
      return goal;
    },
    [token]
  );

  return (
    <GoalContext.Provider
      value={{
        activeGoal,
        loadingGoal,
        goalLoadFailed,
        goalLoadedFor,
        apiStatus,
        reconciliation,
        refreshGoal,
        applyReconciliation,
        reloadPlan,
        setActiveGoal,
        updateActiveGoal,
        resetGoal,
        completeGoal,
        completeActiveGoal: completeGoal,
      }}
    >
      {children}
    </GoalContext.Provider>
  );
};

export const useGoal = (): GoalContextType => {
  const context = useContext(GoalContext);
  if (!context) {
    throw new Error('useGoal must be used within a GoalProvider');
  }
  return context;
};
