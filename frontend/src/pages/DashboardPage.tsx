import React from 'react';
import { useGoal } from '../context/GoalContext';
import { useAuth } from '../context/AuthContext';
import { ExecutionDashboard } from '../components/ExecutionDashboard';

export const DashboardPage: React.FC = () => {
  const { activeGoal, updateActiveGoal, resetGoal } = useGoal();
  const { token } = useAuth();

  if (!activeGoal || !token) {
    return null;
  }

  return (
    <main id="main" className="w-full animate-fadeIn">
      <ExecutionDashboard
        goal={activeGoal}
        token={token}
        onGoalUpdated={updateActiveGoal}
        onResetGoal={resetGoal}
      />
    </main>
  );
};

export default DashboardPage;
