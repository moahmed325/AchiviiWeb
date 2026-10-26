import React from 'react';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';
import { Button } from '../Button';
import { Eyebrow } from '../Section';
import { TodayPreview } from '../TodayPreview';

const MINUTES = CERTIFIED_PATHWAYS.map((p) => p.dailyMinutes);

export const Hero: React.FC = () => (
  <section id="top" aria-labelledby="hero-title" className="px-gutter pb-16 pt-28 sm:pb-24 sm:pt-36">
    <div className="mx-auto grid w-full max-w-[1120px] items-center gap-14 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-6">
        <Eyebrow>Free 90-day plans</Eyebrow>
        <h1 id="hero-title" className="mt-5 max-w-[16ch] text-balance text-h1 text-text">
          Pick a goal. Get a plan for the next 90 days.
        </h1>
        <p className="mt-6 max-w-[34rem] text-body-lg text-text-secondary">
          Choose from {CERTIFIED_PATHWAYS.length} guided goals, from running a 10K to writing a book. Every day you get
          one step, sized to the time you have. Miss a day and the plan adjusts.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" variant="gold" withArrow href="#goals">
            Choose your goal
          </Button>
          <Button size="lg" variant="secondary" href="#how">
            How it works
          </Button>
        </div>
        <p className="tabular mt-6 text-small text-text-secondary">
          Free · No card needed · {Math.min(...MINUTES)}–{Math.max(...MINUTES)} min a day
        </p>
      </div>

      <TodayPreview className="mx-auto w-full max-w-[460px] lg:col-span-5 lg:col-start-8" />
    </div>
  </section>
);
