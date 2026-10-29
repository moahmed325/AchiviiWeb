import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { Navigate } from 'react-router-dom';
import { usePathwayLaunch } from '../components/pathways';
import { GoalStartForm } from '../components/onboarding/GoalStartForm';
import { readSnapshot } from '../components/onboarding/snapshot';
import { Button, Surface } from '../components/ui';
import { LandingPage } from '../components/marketing/LandingPage';
import { Today, TodaySkeleton } from '../components/today/Today';
import { BreakChoice, GettingReady, WeekTestFirst } from '../components/today/WeekClose';

const AchievementPage = React.lazy(() => import('./AchievementPage'));


export const Home: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal, apiStatus, closingWeek, heldClose, pendingChoice } = useGoal();
  const { startTypedGoal } = usePathwayLaunch();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshGoal();
    } finally {
      setRetrying(false);
    }
  };

  // Weekly update M1.2b (RULE-8): the close call is writing the next week.
  if (token && closingWeek) {
    return <GettingReady />;
  }

  if (token && (authLoading || loadingGoal)) {
    return <TodaySkeleton />;
  }

  if (user && token) {
    // Goal fetch failed: render dedicated error state rather than pathway library (OD-9, ND-12)
    if (goalLoadFailed && !activeGoal) {
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

    // No goal yet (ND-28): one question, the goal in their own words. Answers kept from before a sign-up resume.
    if (!activeGoal) {
      if (readSnapshot()) return <Navigate to="/onboarding" replace />;
      return (
        <main id="main" className="ui-root mx-auto w-full max-w-2xl flex-1 px-gutter py-16 text-left sm:py-24">
          <p className="font-ui-mono text-micro uppercase text-accent-hover">Your next 90 days</p>
          <h1 className="mt-4 max-w-[20ch] text-display text-text">What do you want to achieve?</h1>
          <p className="mt-4 max-w-xl text-body-lg text-text-secondary">
            Say it however it comes to mind. We'll shape it into a plan you can follow, one step a day.
          </p>
          <GoalStartForm className="mt-10" onStart={startTypedGoal} autoFocus />
        </main>
      );
    }

    if (activeGoal.status === 'completed') {
      return (
        <React.Suspense fallback={<TodaySkeleton />}>
          <AchievementPage goal={activeGoal} />
        </React.Suspense>
      );
    }

    // M1.5b (WU-38): a break past the limit waits for the person's choice; Today shows only the card.
    if (pendingChoice && pendingChoice.goalId === activeGoal.id) {
      return <BreakChoice goal={activeGoal} choice={pendingChoice.choice} />;
    }

    // WU-14: a close waits for last week's test; Today shows only the card until it is answered.
    if (heldClose) {
      return <WeekTestFirst goal={activeGoal} weekNumber={heldClose.weekNumber} />;
    }

    return <Today goal={activeGoal} />;
  }

  return <LandingPage apiOffline={apiStatus === 'offline'} />;
};

export default Home;
