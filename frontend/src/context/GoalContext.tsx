import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Goal, GoalCompletionPayload, PastLimitChoice, Reconciliation } from '../types';
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
import { openWeekEnded } from '../lib/weekClose';

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
   * Weekly update M1.5b (WU-38): a break past the limit waits for the person's choice. Nothing closes and reconcile
   * waits; a goal screen sends them to Today (AppShell), which shows only the choice card. Going to goal creation for a
   * fresh plan answers nothing: the card shows again on Today. Null otherwise, and once another goal is active.
   */
  pendingChoice: { weekNumber: number; choice: PastLimitChoice; goalId: string } | null;
  /** Answers the card with "Keep going" or "Do my final week": the close, reconcile and the fetch. Only the first runs. */
  answerChoice: (choice: PastLimitChoice) => Promise<boolean>;
  /** The last close answered with a server failure (503): Today offers to try again. */
  closeFailed: boolean;
  /** Runs the close again (with the choice, when the failed close followed one), then reconcile and the fetch. */
  retryClose: () => Promise<void>;
  setActiveGoal: (goal: Goal | null) => void;
  updateActiveGoal: (goal: Goal) => void;
  resetGoal: () => Promise<boolean>;
  completeGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
  completeActiveGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

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
  const [pendingChoice, setPendingChoice] = useState<GoalContextType['pendingChoice']>(null);
  const [closeFailed, setCloseFailed] = useState(false);
  // M1.5b: the choice whose close failed on the server, so "Try again" sends it again instead of asking again.
  const failedChoice = useRef<GoalContextType['pendingChoice']>(null);
  // When the last load started, and whether one is running, for the new-day catch-up (M3.1 R3).
  const lastLoadAt = useRef<Date | null>(null);
  const loading = useRef(false);
  // The held week (WU-14) and whether an answer to it is running, so Skip and Log never both send a close.
  const held = useRef<number | null>(null);
  const answering = useRef(false);
  // How many close calls are running, so "getting ready" stays up until the last ends (review fix 3).
  const closesRunning = useRef(0);
  // The goal as last set, for `reloadPlan`'s "has the open week ended" read (review fix 4).
  const goalRef = useRef<Goal | null>(null);
  useEffect(() => {
    goalRef.current = activeGoal;
  }, [activeGoal]);

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

  /**
   * The close call itself, shown as "getting ready" until the load after it ends: the caller calls `endClose` then.
   * Closes are counted, so one that ends first never hides another still running (review fix 3). A failure never
   * stops the load.
   */
  const runClose = useCallback(async (t: string, choice?: PastLimitChoice): Promise<'ok' | 'server' | 'other'> => {
    closesRunning.current += 1;
    setClosingWeek(true);
    try {
      await (choice ? closeWeek(t, undefined, choice) : closeWeek(t));
      return 'ok';
    } catch (err) {
      console.warn('Failed to close the week:', err);
      if (!closeFailedOnServer(err)) return 'other';
      setCloseFailed(true);
      return 'server';
    }
  }, []);
  const endClose = useCallback(() => {
    closesRunning.current = Math.max(0, closesRunning.current - 1);
    if (closesRunning.current === 0) setClosingWeek(false);
  }, []);

  /**
   * Weekly update M1.2b (RULE-8, RULE-17, WU-14): every load closes a finished week first, then reconciles, then
   * fetches. A quick check says whether a close is due, so "getting ready" shows only while a week is written. M1.5b: a
   * break past the limit is held on any screen for the choice card (WU-38), and nothing closes until the person chooses.
   * No weekly tests (2026-10-30): no close waits for a test result any more.
   */
  const closeThenLoad = useCallback(
    async (t: string, clearOnFailure: boolean, check = true) => {
      let due: { weekNumber: number; choice: PastLimitChoice | null } | null = null;
      if (check) {
        setCloseFailed(false);
        failedChoice.current = null;
        try {
          const answer = await closeWeek(t, 'check');
          if (answer.due && answer.closedBy === undefined) due = { weekNumber: answer.weekNumber, choice: answer.choice ?? null };
        } catch (err) {
          console.warn('Failed to check the week close:', err);
          if (closeFailedOnServer(err)) setCloseFailed(true);
        }
      }

      // WU-38: the choice waits on every screen; a goal that didn't load has nothing to show and closes nothing.
      if (due?.choice) {
        const { weekNumber, choice } = due;
        held.current = weekNumber;
        const goal = await reconcileAndFetch(t, false, clearOnFailure);
        if (goal && held.current === weekNumber) {
          setPendingChoice({ weekNumber, choice, goalId: goal.id });
          return;
        }
        held.current = null;
        return;
      }

      let closing = false;
      try {
        if (due) {
          closing = true;
          await runClose(t);
        }
        await reconcileAndFetch(t, true, clearOnFailure);
      } finally {
        if (closing) endClose();
      }
    },
    [reconcileAndFetch, runClose, endClose]
  );

  // Fetch active goal when token changes
  const loadGoal = useCallback(async () => {
    // Review fix 2: while the choice card waits or its answer runs, a new token or a new date reloads nothing; the
    // card's answer reloads the plan. Signing out still clears everything.
    if (token && (held.current !== null || answering.current)) {
      setGoalLoadedFor(token);
      return;
    }
    held.current = null;
    setPendingChoice(null);
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
    // While the choice card waits, reconcile waits too (RULE-17); the card's answer reloads the plan.
    if (!token || held.current !== null) return;
    // Review fix 4: a plan action's reload asks the server only once the open week's last day has passed.
    await closeThenLoad(token, false, openWeekEnded(goalRef.current, new Date(), timezone));
  }, [token, timezone, closeThenLoad]);

  /**
   * M1.5b (WU-38): the close with the person's choice, then reconcile and the fetch. A server failure keeps the plan as
   * stored (no reconcile, as while the choice waited) and "Try again" sends the same choice. Any other failure (no
   * network, a 409) puts the card back exactly as before the tap (review fix 4).
   */
  const closeWithChoice = useCallback(
    async (t: string, waiting: NonNullable<GoalContextType['pendingChoice']>, choice: PastLimitChoice) => {
      answering.current = true;
      let closing = false;
      try {
        held.current = null;
        setPendingChoice(null);
        setCloseFailed(false);
        failedChoice.current = null;
        closing = true;
        const result = await runClose(t, choice);
        if (result === 'other') {
          held.current = waiting.weekNumber;
          setPendingChoice(waiting);
          return false;
        }
        if (result === 'server') failedChoice.current = { ...waiting, choice };
        await reconcileAndFetch(t, result === 'ok', false);
        return true;
      } finally {
        if (closing) endClose();
        answering.current = false;
      }
    },
    [runClose, endClose, reconcileAndFetch]
  );

  const answerChoice = useCallback(
    async (choice: PastLimitChoice) => {
      if (!token || held.current === null || answering.current || !pendingChoice) return false;
      return closeWithChoice(token, pendingChoice, choice);
    },
    [token, pendingChoice, closeWithChoice]
  );

  // WU-40 (4): a fresh plan made another goal active (goal creation sets it); the old goal's choice no longer waits.
  useEffect(() => {
    if (pendingChoice && activeGoal && activeGoal.id !== pendingChoice.goalId) {
      held.current = null;
      setPendingChoice(null);
    }
  }, [activeGoal, pendingChoice]);

  const retryClose = useCallback(async () => {
    if (!token || held.current !== null || answering.current) return;
    if (failedChoice.current) {
      await closeWithChoice(token, failedChoice.current, failedChoice.current.choice);
      return;
    }
    await closeThenLoad(token, false);
  }, [token, closeThenLoad, closeWithChoice]);

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
        pendingChoice,
        answerChoice,
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
