import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { PathwayCustomGoal, PathwayLibrary, usePathwayLaunch } from '../components/pathways';
import { Button, Surface } from '../components/ui';
import { LandingPage } from '../components/marketing/LandingPage';
import { Today, TodaySkeleton } from '../components/today/Today';

export const Home: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, goalLoadFailed, refreshGoal, apiStatus } = useGoal();
  const { startPathway, startCustomGoal } = usePathwayLaunch();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshGoal();
    } finally {
      setRetrying(false);
    }
  };

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

    // No goal yet: the pathway library, with a goal of the user's own as the quieter route (ND-6).
    if (!activeGoal) {
      return (
        <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-12 text-left sm:py-16">
          <header className="flex flex-col gap-4">
            <p className="font-ui-mono text-micro uppercase text-accent-hover">Start your journey</p>
            <h1 className="max-w-[20ch] text-h1 text-text">Choose a pathway</h1>
            <p className="max-w-xl text-body-lg text-text-secondary">
              Pick a direction, then a pathway. Each one is a guided 90-day journey, planned around your life.
            </p>
          </header>

          <PathwayLibrary
            className="mt-12"
            action={{ label: 'Start this pathway', onChoose: startPathway }}
            customGoal={
              <PathwayCustomGoal className="mt-16">
                <Button
                  variant="secondary"
                  onClick={startCustomGoal}
                  className="w-full sm:w-auto"
                  trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
                >
                  Describe my own goal
                </Button>
              </PathwayCustomGoal>
            }
          />
        </main>
      );
    }

    return <Today goal={activeGoal} />;
  }

  return <LandingPage apiOffline={apiStatus === 'offline'} />;
};

export default Home;
