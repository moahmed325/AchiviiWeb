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
  const { activeGoal, loadingGoal } = useGoal();
  const location = useLocation();

  // While either auth or goal is resolving, show a calm minimal loading state
  if (authLoading || (token && loadingGoal)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-4 animate-fadeIn">
        <div className="w-8 h-8 border-2 border-[#07CB6C]/30 border-t-[#07CB6C] rounded-full animate-spin" />
        <p className="text-xs text-neutral-400">Loading your space...</p>
      </div>
    );
  }

  // Not logged in -> sign in, then come back here
  if (!user || !token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Route requires an active goal, but user has none -> redirect to onboarding
  if (requireGoal && !activeGoal) {
    return <Navigate to="/onboarding" replace />;
  }

  // Route is onboarding, but user already has an active goal -> redirect to dashboard only if NOT explicitly starting/switching to a goal
  const navState = location.state as {
    presetGoal?: string;
    draftGoal?: string;
    isPreset?: boolean;
    switchGoal?: boolean;
    customGoal?: boolean;
  } | null;

  const isExplicitGoalSelection = Boolean(
    navState?.presetGoal ||
    navState?.draftGoal ||
    navState?.switchGoal ||
    navState?.customGoal ||
    navState?.isPreset !== undefined
  );

  if (!requireGoal && activeGoal && !isExplicitGoalSelection) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render protected content with a smooth fade-in
  return <div className="animate-fadeIn w-full flex-1 flex flex-col">{children}</div>;
};
