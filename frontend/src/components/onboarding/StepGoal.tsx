import React from 'react';
import { GoalStartForm } from './GoalStartForm';
import { StepHeader } from './StepLayout';

interface StepGoalProps {
  rawGoal: string;
  onStartGoal: (goal: string) => void;
}

/** ND-28: one question to start, in the person's own words. A vague goal is turned into a measurable one later. */
export const StepGoal: React.FC<StepGoalProps> = ({ rawGoal, onStartGoal }) => (
  <div className="flex flex-col">
    <StepHeader
      size="display"
      eyebrow="Your next 90 days"
      title="What do you want to achieve?"
      description="Say it however it comes to mind. We'll shape it into a plan you can follow, one step a day."
    />
    <GoalStartForm className="mt-10" initialGoal={rawGoal} onStart={onStartGoal} submitLabel="Continue" autoFocus />
  </div>
);
