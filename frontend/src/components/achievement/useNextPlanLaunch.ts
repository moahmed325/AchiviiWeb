import { useNavigate } from 'react-router-dom';
import type { Goal, NextPlanMode } from '../../types';
import { nextPlanLaunch } from '../../lib/nextPlan';
import { DRAFT_GOAL_KEY } from '../onboarding/payload';

/**
 * Next plan (NP-3, NP-4, NP-9): opens goal creation for a plan that continues `goal`. Keep going and a fresh plan fill
 * in the goal's text, as a pathway launch does; go further opens the goal step empty. `switchGoal` lets onboarding
 * admit someone who already has a goal; nothing changes until the new plan is created.
 */
export function useNextPlanLaunch() {
  const navigate = useNavigate();
  return (goal: Goal, mode: NextPlanMode, level?: number) => {
    const launch = nextPlanLaunch(goal, mode, level);
    try {
      if (launch.goalText) localStorage.setItem(DRAFT_GOAL_KEY, launch.goalText);
      else localStorage.removeItem(DRAFT_GOAL_KEY);
    } catch {
      // Without storage the navigation state still carries the text.
    }
    navigate('/onboarding', {
      state: { nextPlan: launch, switchGoal: true, isPreset: launch.isPreset, ...(launch.goalText ? { draftGoal: launch.goalText } : {}) },
    });
  };
}
