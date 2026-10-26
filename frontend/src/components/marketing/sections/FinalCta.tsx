import React from 'react';
import { Button } from '../Button';
import { Section, HEADING } from '../Section';

export const FinalCta: React.FC = () => (
  <Section id="start" labelledBy="final-cta-title" className="landing-light-close isolate" innerClassName="text-center">
    <div aria-hidden="true" className="landing-botanical landing-botanical-left" />
    <div aria-hidden="true" className="landing-botanical landing-botanical-right" />
    <h2 id="final-cta-title" className={`mx-auto max-w-[20ch] ${HEADING}`}>
      Pick a goal and get your first step today.
    </h2>
    <p className="mx-auto mt-4 max-w-[30rem] text-body-lg text-text-secondary">Free, and it takes a few minutes to set up.</p>
    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Button size="lg" variant="gold" withArrow to="/signup">
        Start free
      </Button>
      <Button size="lg" variant="quiet" to="/login">
        I already have an account
      </Button>
    </div>
  </Section>
);
