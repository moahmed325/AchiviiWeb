import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { Button, Surface } from '../components/ui';
import { Goal } from '../types';

export const OnboardingPage: React.FC = () => {
  const { token } = useAuth();
  const { activeGoal, goalLoadFailed, refreshGoal, apiStatus, setActiveGoal } = useGoal();
  const navigate = useNavigate();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  if (!token) {
    return null;
  }

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshGoal();
    } finally {
      setRetrying(false);
    }
  };

  // If goal load failed, do not allow creating a goal or guessing activeGoal (OD-9, ND-12)
  if (goalLoadFailed) {
    return (
      <main id="main" className="ui-root mx-auto w-full max-w-xl flex-1 px-gutter py-16 text-center">
        <Surface role="alert" tone="base" padding="lg" radius="card" className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-h2 text-text">
            We couldn't load your goal
          </h1>
          <p className="max-w-md text-body text-text-secondary">
            Your plan is safe, but we had trouble reaching Achivii. Check your connection or try again.
          </p>
          <Button variant="primary" loading={retrying} onClick={handleRetry} className="mt-2">
            Try again
          </Button>
        </Surface>
      </main>
    );
  }

  const handleGoalCreated = (goal: Goal) => {
    setActiveGoal(goal);
    navigate('/');
  };

  const navState = location.state as { presetGoal?: string; draftGoal?: string; isPreset?: boolean } | null;
  const initialGoal = navState?.presetGoal || navState?.draftGoal;
  const isPreset = Boolean(navState?.isPreset || navState?.presetGoal);

  return (
    <div className="flex w-full flex-1 flex-col">
      <OnboardingWizard
        token={token}
        onGoalCreated={handleGoalCreated}
        initialGoal={initialGoal}
        isPreset={isPreset}
        currentGoalId={goalLoadFailed ? null : activeGoal?.id}
        apiOffline={apiStatus === 'offline'}
      />
    </div>
  );
};

export default OnboardingPage;
