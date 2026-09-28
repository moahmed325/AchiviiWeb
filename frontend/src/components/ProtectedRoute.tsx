import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireGoal?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireGoal = true,
}) => {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, goalLoadFailed } = useGoal();
  const location = useLocation();

  // While either auth or goal is resolving, show a calm minimal loading state
  if (authLoading || (token && loadingGoal)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-4 animate-fadeIn">
        <div className="size-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        <p className="text-xs text-text-muted font-ui-mono">Loading your space...</p>
      </div>
    );
  }

  // Not logged in -> sign in, then come back here
  if (!user || !token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Route requires an active goal, but user has none -> redirect to onboarding unless goal load failed (OD-9, ND-12)
  if (requireGoal && !activeGoal) {
    if (goalLoadFailed) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  // Route is onboarding, but user already has an active in-progress goal -> redirect to dashboard only if NOT explicitly starting/switching to a goal.
  // When activeGoal has status === 'completed', the user is allowed into onboarding unconditionally to begin their next journey (BP §34, R-15).
  const isGoalCompleted = activeGoal?.status === 'completed';

  const navState = location.state as {
    presetGoal?: string;
    draftGoal?: string;
    isPreset?: boolean;
    switchGoal?: boolean;
    customGoal?: boolean;
    fromCompletedGoal?: boolean;
  } | null;

  const isExplicitGoalSelection = Boolean(
    navState?.presetGoal ||
    navState?.draftGoal ||
    navState?.switchGoal ||
    navState?.customGoal ||
    navState?.fromCompletedGoal ||
    navState?.isPreset !== undefined
  );

  if (location.pathname === '/onboarding' && activeGoal && !isGoalCompleted && !isExplicitGoalSelection) {
    return <Navigate to="/" replace />;
  }

  // Render protected content with a smooth fade-in
  return <div className="animate-fadeIn w-full flex-1 flex flex-col">{children}</div>;
};
