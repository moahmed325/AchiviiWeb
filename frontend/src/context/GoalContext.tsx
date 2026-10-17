import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Goal, GoalCompletionPayload, Reconciliation } from '../types';
import {
  ApiError,
  closeWeek,
  fetchActiveGoal,
  reconcileGoal,
  resetActiveGoal as apiResetGoal,
  completeGoal as apiCompleteGoal,
  fetchHealthCheck,
} from '../lib/api';
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
  /** Close a finished week, reconcile, then reload the goal, without the loading state (M3.3 R7, RULE-17). */
  reloadPlan: () => Promise<void>;
  /**
   * Weekly update M1.2b (RULE-8, RULE-17): the automatic close's call is running and the next week is being written.
   * The loading views show "Getting your next week ready…" instead of their usual state.
   */
  closingWeek: boolean;
  /**
   * WU-14, WU-28: a close is due on Today but the week's test is not logged, so the close waits for the test card.
   * Reconcile waits too; the goal was fetched as stored. Null otherwise.
   */
  heldClose: { weekNumber: number } | null;
  /**
   * Answers the test card: runs `before` (logging the result), then the close, reconcile and the fetch. With no
   * `before` it is Skip. Only the first answer runs; false when nothing is held or an answer is already running.
   * A failing `before` keeps the card and throws.
   */
  answerHeldClose: (before?: () => Promise<void>) => Promise<boolean>;
  /** The last close answered with a server failure (503): Today offers to try again. */
  closeFailed: boolean;
  /** Runs the close again, then reconcile and the fetch. */
  retryClose: () => Promise<void>;
  setActiveGoal: (goal: Goal | null) => void;
  updateActiveGoal: (goal: Goal) => void;
  resetGoal: () => Promise<boolean>;
  completeGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
  completeActiveGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

/** Today is `/` (pages/Home.tsx). The provider sits above the router, so it reads the path itself (M1.1 section 2). */
const onToday = () => window.location.pathname === '/';

/**
 * Only a server failure (a 503 when the next week couldn't be written, or a 500) is shown. A 4xx (no goal, not plan
 * v2) or an unreachable server means nothing to close: reconcile and the goal fetch report those as they always have.
 */
const closeFailedOnServer = (err: unknown) => err instanceof ApiError && err.status >= 500;

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const timezone = user?.timezone;
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [loadingGoal, setLoadingGoal] = useState<boolean>(true);
  const [goalLoadFailed, setGoalLoadFailed] = useState(false);
  const [goalLoadedFor, setGoalLoadedFor] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [closingWeek, setClosingWeek] = useState(false);
  const [heldClose, setHeldClose] = useState<{ weekNumber: number } | null>(null);
  const [closeFailed, setCloseFailed] = useState(false);
  // When the last load started, and whether one is running, for the new-day catch-up (M3.1 R3).
  const lastLoadAt = useRef<Date | null>(null);
  const loading = useRef(false);
  // The held week (WU-14) and whether an answer to it is running, so Skip and Log never both send a close.
  const held = useRef<number | null>(null);
  const answering = useRef(false);

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

  /** Reconcile (unless the close is held), then fetch the goal. A failed reconcile never stops the fetch. */
  const reconcileAndFetch = useCallback(async (t: string, reconcile: boolean, clearOnFailure: boolean) => {
    if (reconcile) {
      // Missed sessions (ND-6): reconcile once per load, before the goal is fetched, so the goal reflects it.
      // A failure here never stops the goal from loading. The body is kept for the miss notice (M3.1).
      try {
        const result = await reconcileGoal(t);
        setReconciliation(result.applies ? result : null);
      } catch (err) {
        console.warn('Failed to reconcile goal:', err);
        // A full load drops the old body; a plan reload keeps it, as before M1.2b.
        if (clearOnFailure) setReconciliation(null);
      }
    } else {
      setReconciliation(null);
    }
    try {
      const goal = await fetchActiveGoal(t);
      setActiveGoal(goal);
      setGoalLoadFailed(false);
      return goal;
    } catch (err) {
      console.warn(clearOnFailure ? 'Failed to load active goal:' : 'Failed to refresh active goal:', err);
      if (clearOnFailure) setActiveGoal(null);
      setGoalLoadFailed(true);
      return null;
    }
  }, []);

  /** The close call itself, shown as "getting ready" until the load after it ends. A failure never stops the load. */
  const runClose = useCallback(async (t: string) => {
    setClosingWeek(true);
    try {
      await closeWeek(t);
    } catch (err) {
      console.warn('Failed to close the week:', err);
      if (closeFailedOnServer(err)) setCloseFailed(true);
    }
  }, []);

  /**
   * Weekly update M1.2b (RULE-8, RULE-17, WU-14): every load closes a finished week first, then reconciles, then
   * fetches. A quick check says whether a close is due, so "getting ready" shows only while a week is written. On
   * Today with the test not logged, the close is held for the test card: the goal is fetched as stored, without
   * reconcile.
   */
  const closeThenLoad = useCallback(
    async (t: string, clearOnFailure: boolean) => {
      setCloseFailed(false);
      let due: { weekNumber: number; testLogged: boolean } | null = null;
      try {
        const check = await closeWeek(t, 'check');
        if (check.due && 'testLogged' in check) due = { weekNumber: check.weekNumber, testLogged: check.testLogged };
      } catch (err) {
        console.warn('Failed to check the week close:', err);
        if (closeFailedOnServer(err)) setCloseFailed(true);
      }

      try {
        // Read after the answer: someone who left Today meanwhile gets no card (any other screen counts as Skip).
        if (due && !due.testLogged && onToday()) {
          const weekNumber = due.weekNumber;
          held.current = weekNumber;
          const goal = await reconcileAndFetch(t, false, clearOnFailure);
          // A week with no test to log, or a goal that didn't load, has nothing to ask: it closes at once.
          if (goal?.roadmapWeeks?.find((w) => w.weekNumber === weekNumber)?.test && held.current === weekNumber) {
            setHeldClose({ weekNumber });
            return;
          }
          held.current = null;
        }
        if (due) await runClose(t);
        await reconcileAndFetch(t, true, clearOnFailure);
      } finally {
        setClosingWeek(false);
      }
    },
    [reconcileAndFetch, runClose]
  );

  // Fetch active goal when token changes
  const loadGoal = useCallback(async () => {
    held.current = null;
    setHeldClose(null);
    if (!token) {
      setActiveGoal(null);
      setReconciliation(null);
      lastLoadAt.current = null;
      setGoalLoadFailed(false);
      setGoalLoadedFor(null);
      setCloseFailed(false);
      setLoadingGoal(false);
      return;
    }

    loading.current = true;
    lastLoadAt.current = new Date();
    setLoadingGoal(true);
    try {
      await closeThenLoad(token, true);
    } finally {
      setGoalLoadedFor(token);
      setLoadingGoal(false);
      loading.current = false;
    }
  }, [token, closeThenLoad]);

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
    // While the test card waits, reconcile waits too (RULE-17); the card's answer reloads the plan.
    if (!token || held.current !== null) return;
    await closeThenLoad(token, false);
  }, [token, closeThenLoad]);

  const answerHeldClose = useCallback(
    async (before?: () => Promise<void>) => {
      if (!token || held.current === null || answering.current) return false;
      answering.current = true;
      try {
        if (before) await before();
        held.current = null;
        setHeldClose(null);
        setCloseFailed(false);
        await runClose(token);
        await reconcileAndFetch(token, true, false);
        return true;
      } finally {
        setClosingWeek(false);
        answering.current = false;
      }
    },
    [token, runClose, reconcileAndFetch]
  );

  const retryClose = useCallback(async () => {
    if (!token || held.current !== null) return;
    await closeThenLoad(token, false);
  }, [token, closeThenLoad]);

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
        closingWeek,
        heldClose,
        answerHeldClose,
        closeFailed,
        retryClose,
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
