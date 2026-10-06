import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Goal, GoalCompletionPayload } from '../types';
import { fetchActiveGoal, resetActiveGoal as apiResetGoal, completeGoal as apiCompleteGoal, fetchHealthCheck } from '../lib/api';
import { useAuth } from './AuthContext';

interface GoalContextType {
  activeGoal: Goal | null;
  loadingGoal: boolean;
  /** The last goal fetch failed, so a null `activeGoal` does not mean the user has no goal. */
  goalLoadFailed: boolean;
  /** The token whose goal fetch last settled, so a consumer can tell the goal state is current for its token. */
  goalLoadedFor: string | null;
  apiStatus: 'online' | 'offline' | 'checking';
  refreshGoal: () => Promise<void>;
  setActiveGoal: (goal: Goal | null) => void;
  updateActiveGoal: (goal: Goal) => void;
  resetGoal: () => Promise<boolean>;
  completeGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
  completeActiveGoal: (payload?: GoalCompletionPayload) => Promise<Goal>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuth();
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [loadingGoal, setLoadingGoal] = useState<boolean>(true);
  const [goalLoadFailed, setGoalLoadFailed] = useState(false);
  const [goalLoadedFor, setGoalLoadedFor] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');

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
      setGoalLoadFailed(false);
      setGoalLoadedFor(null);
      setLoadingGoal(false);
      return;
    }

    setLoadingGoal(true);
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
    }
  }, [token]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

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
        refreshGoal,
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
