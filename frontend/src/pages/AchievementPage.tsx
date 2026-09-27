import React from 'react';
import { Navigate } from 'react-router-dom';
import { useGoal } from '../context/GoalContext';
import { AchievementScreen } from '../components/achievement';
import type { Goal } from '../types';

interface AchievementPageProps {
  goal?: Goal | null;
  onBeginAnotherJourney?: () => void;
}

/**
 * Dedicated Achievement Destination Page (M9.3-R1).
 * Rendered at `/achievement` or directly in `Home.tsx` when a goal is completed.
 */
export const AchievementPage: React.FC<AchievementPageProps> = ({
  goal: propGoal,
  onBeginAnotherJourney,
}) => {
  const { activeGoal, loadingGoal } = useGoal();
  const goal = propGoal ?? activeGoal;

  if (loadingGoal && !goal) {
    return (
      <main id="main" className="ui-root mx-auto w-full max-w-5xl flex-1 px-gutter py-16 text-center">
        <div className="flex flex-col items-center justify-center space-y-4 py-24">
          <div className="size-8 animate-spin rounded-full border-2 border-achievement/30 border-t-achievement" />
          <p className="text-small text-text-secondary">Loading achievement destination...</p>
        </div>
      </main>
    );
  }

  if (!goal) {
    return <Navigate to="/" replace />;
  }

  return (
    <AchievementScreen
      goal={goal}
      onBeginAnotherJourney={onBeginAnotherJourney}
    />
  );
};

export default AchievementPage;
