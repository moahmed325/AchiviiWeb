import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { PathwayCustomGoal, PathwayLibrary, usePathwayLaunch } from '../components/pathways';
import { Button } from '../components/ui';
import { LandingPage } from '../components/marketing/LandingPage';
import { Today, TodaySkeleton } from '../components/today/Today';

export const Home: React.FC = () => {
  const { user, token, loading: authLoading } = useAuth();
  const { activeGoal, loadingGoal, apiStatus } = useGoal();
  const { startPathway, startCustomGoal } = usePathwayLaunch();

  if (token && (authLoading || loadingGoal)) {
    return <TodaySkeleton />;
  }

  if (user && token) {
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
