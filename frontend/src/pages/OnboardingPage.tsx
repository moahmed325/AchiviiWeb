import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { Button, Surface } from '../components/ui';
import { Goal } from '../types';
import type { NextPlanLaunch } from '../lib/nextPlan';

export const OnboardingPage: React.FC = () => {
  const { token } = useAuth();
  const { activeGoal, goalLoadFailed, refreshGoal, apiStatus, setActiveGoal } = useGoal();
  const navigate = useNavigate();
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshGoal();
    } finally {
      setRetrying(false);
    }
  };

  // If goal load failed, do not allow creating a goal or guessing activeGoal (OD-9, ND-12)
  if (token && goalLoadFailed) {
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

  const navState = location.state as {
    presetGoal?: string;
    draftGoal?: string;
    isPreset?: boolean;
    switchGoal?: boolean;
    fromCompletedGoal?: boolean;
    nextPlan?: NextPlanLaunch;
    /** B-106: the old plan's fixed date, filled in for a fresh plan. */
    fixedDate?: string;
  } | null;
  const initialGoal = navState?.presetGoal || navState?.draftGoal;
  const nextPlan = navState?.nextPlan ?? null;
  const isFromCompleted = !nextPlan && Boolean(navState?.fromCompletedGoal || activeGoal?.status === 'completed');
  // NP-3, NP-4: where the next plan starts; the earlier plan stays as it is.
  const nextPlanNotice = !nextPlan
    ? null
    : nextPlan.request.mode === 'go_further'
      ? `Write your next goal.${nextPlan.startsFrom ? ` It starts from ${nextPlan.startsFrom}.` : ''}`
      : nextPlan.startsFrom
        ? `Your next plan starts from ${nextPlan.startsFrom}.`
        : 'Your next plan starts from where your last one ended.';

  return (
    <div className="flex w-full flex-1 flex-col">
      {isFromCompleted && (
        <div
          role="status"
          className="mx-auto w-full max-w-2xl px-gutter pt-6 text-left"
        >
          <div className="flex items-center gap-3 rounded-card border border-achievement/30 bg-surface p-4 text-small text-text-secondary">
            <span className="size-2 rounded-full bg-achievement shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-text font-medium">Starting a new journey: </strong>
              Your previous 90-day achievement is safely preserved in your personal history.
            </span>
          </div>
        </div>
      )}
      {nextPlanNotice && (
        <div role="status" className="mx-auto w-full max-w-2xl px-gutter pt-6 text-left">
          <div className="flex items-center gap-3 rounded-card border border-achievement/30 bg-surface p-4 text-small text-text-secondary">
            <span className="size-2 rounded-full bg-achievement shrink-0" aria-hidden="true" />
            <span>
              <strong className="text-text font-medium">{nextPlanNotice} </strong>
              Your last plan and its results stay in your history.
            </span>
          </div>
        </div>
      )}
      <OnboardingWizard
        token={token}
        onGoalCreated={handleGoalCreated}
        // ND-28: a visitor answers everything first; their answers wait in this browser while they sign up.
        onSignUp={() => navigate(`/signup?next=${encodeURIComponent('/onboarding')}`)}
        initialGoal={initialGoal}
        currentGoalId={!token ? undefined : goalLoadFailed ? null : activeGoal?.id}
        nextPlan={nextPlan}
        initialFixedDate={navState?.fixedDate ?? nextPlan?.fixedDate}
        apiOffline={apiStatus === 'offline'}
      />
    </div>
  );
};

export default OnboardingPage;
