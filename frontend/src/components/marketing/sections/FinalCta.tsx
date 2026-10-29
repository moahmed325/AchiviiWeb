import React from 'react';
import { Button } from '../Button';
import { Section, HEADING } from '../Section';
import { usePathwayLaunch } from '../../pathways/launch';
import { GoalStartForm } from '../../onboarding/GoalStartForm';

/** ND-28: the page ends where it starts, with the goal in the visitor's own words. */
export const FinalCta: React.FC = () => {
  const { startTypedGoal } = usePathwayLaunch();
  return (
    <Section id="start" labelledBy="final-cta-title" className="isolate" innerClassName="text-center">
      <div aria-hidden="true" className="landing-botanical landing-botanical-left" />
      <div aria-hidden="true" className="landing-botanical landing-botanical-right" />
      <h2 id="final-cta-title" className={`mx-auto max-w-[20ch] ${HEADING}`}>
        What will your next 90 days be for?
      </h2>
      <p className="mx-auto mt-4 max-w-[30rem] text-body-lg text-text-secondary">Type it in. Your first step can be today.</p>
      <GoalStartForm className="mx-auto mt-9 w-full max-w-[36rem] text-left" onStart={startTypedGoal} showExamples={false} label="Your goal for the next 90 days" />
      <div className="mt-4 flex justify-center">
        <Button size="lg" variant="quiet" to="/login">
          I already have an account
        </Button>
      </div>
    </Section>
  );
};
