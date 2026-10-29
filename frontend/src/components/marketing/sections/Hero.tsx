import React from 'react';
import { usePathwayLaunch } from '../../pathways/launch';
import { GoalStartForm } from '../../onboarding/GoalStartForm';
import { Eyebrow } from '../Section';
import { GoalPreview } from '../GoalPreview';

/** ND-28: the landing page asks one question first. Enter opens onboarding on its first page, no account needed. */
export const Hero: React.FC = () => {
  const { startTypedGoal } = usePathwayLaunch();
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-background px-gutter pb-20 pt-28 sm:pb-28 sm:pt-40"
    >
      <div aria-hidden="true" className="landing-art landing-art-stairs" />
      <div className="mx-auto w-full max-w-[1120px]">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Eyebrow>Your next 90 days</Eyebrow>
            <h1 id="hero-title" className="mt-5 max-w-[14ch] text-balance text-h1 text-text">
              What do you want to achieve?
            </h1>
            <p className="mt-6 max-w-[32rem] text-body-lg text-text-secondary">
              Say it in your own words. Answer a few quick questions and get a 90-day plan built around your week: one
              step a day, sized to the time you have.
            </p>
            <GoalStartForm className="mt-10 max-w-[36rem]" onStart={startTypedGoal} />
            <p className="mt-6 text-small text-text-secondary">No account needed to start · About two minutes</p>
          </div>

          <GoalPreview className="mx-auto w-full max-w-[440px] lg:col-span-5" />
        </div>
      </div>
    </section>
  );
};
