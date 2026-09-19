import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGoal } from '../context/GoalContext';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { Goal } from '../types';

export const OnboardingPage: React.FC = () => {
  const { token } = useAuth();
  const { setActiveGoal } = useGoal();
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) {
    return null;
  }

  const handleGoalCreated = (goal: Goal) => {
    setActiveGoal(goal);
    navigate('/dashboard');
  };

  const navState = location.state as { presetGoal?: string; draftGoal?: string; isPreset?: boolean } | null;
  const initialGoal = navState?.presetGoal || navState?.draftGoal;
  const isPreset = Boolean(navState?.isPreset || navState?.presetGoal);

  return (
    <div className="w-full flex-1 flex flex-col justify-start py-4 sm:py-6 animate-fadeIn">
      <OnboardingWizard
        token={token}
        onGoalCreated={handleGoalCreated}
        initialGoal={initialGoal}
        isPreset={isPreset}
      />
    </div>
  );
};

export default OnboardingPage;
