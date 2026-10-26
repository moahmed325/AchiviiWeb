import React from 'react';
import { Section, Eyebrow, HEADING } from '../Section';

/**
 * Achivii has no track record yet, so instead of testimonials or invented numbers this section shows how the
 * plans are made. Every claim here must stay true of the product.
 */
const POINTS = [
  {
    title: 'Each goal follows a known method',
    body: 'The running plan uses Jack Daniels’ training formula, the chess plan uses the Woodpecker Method, and so on. You see the method before you start.',
  },
  {
    title: 'Progress at a safe pace',
    body: 'Targets rise a little at a time. Fixed limits, written into the app rather than left to the AI, keep each week’s load in check.',
  },
  {
    title: 'Missed days are expected',
    body: 'A day that doesn’t happen is information, not failure. Your next week is planned from what you really did.',
  },
];

export const WhyItWorks: React.FC = () => (
  <Section id="why" labelledBy="why-title">
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Eyebrow>Why it works</Eyebrow>
        <h2 id="why-title" className={`mt-4 ${HEADING}`}>
          No hype. Here’s how every plan is made.
        </h2>
        <p className="mt-4 text-body-lg text-text-secondary">
          Achivii is new, so we don’t have years of success stories yet. What we can show you is what goes into each
          plan.
        </p>
      </div>

      <ul className="space-y-8 lg:col-span-6 lg:col-start-7">
        {POINTS.map((point) => (
          <li key={point.title} className="border-t border-border pt-6">
            <h3 className="text-h3 text-text">{point.title}</h3>
            <p className="mt-2 text-body text-text-secondary">{point.body}</p>
          </li>
        ))}
        <li className="text-small text-text-muted">
          Methods are named after the published books and coaching approaches they come from. Achivii isn’t affiliated
          with or endorsed by their authors.
        </li>
      </ul>
    </div>
  </Section>
);
