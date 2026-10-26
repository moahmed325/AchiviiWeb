import React from 'react';
import { SectionMarks } from '../Section';

/**
 * Achivii has no track record yet, so instead of testimonials or invented numbers this section shows how the
 * plans are made. Every claim here must stay true of the product. It is the page's one light section (D-3).
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
  <section
    id="why"
    aria-labelledby="why-title"
    className="on-inverse relative scroll-mt-24 bg-surface-inverse px-gutter py-20 text-text-on-inverse sm:py-32"
  >
    <SectionMarks />
    <div className="mx-auto grid w-full max-w-[1120px] gap-12 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="text-small text-text-secondary-on-inverse">Why it works</p>
        <h2 id="why-title" className="mt-4 text-balance text-h2">
          No hype. Here’s how every plan is made.
        </h2>
        <p className="mt-4 text-body-lg text-text-secondary-on-inverse">
          Achivii is new, so we don’t have years of success stories yet. What we can show you is what goes into each
          plan.
        </p>
        <span aria-hidden="true" className="mt-8 block h-0.5 w-12 bg-achievement" />
      </div>

      <ul className="lg:col-span-6 lg:col-start-7">
        {POINTS.map((point) => (
          <li key={point.title} className="border-t border-text-on-inverse/15 py-6">
            <h3 className="text-h3">{point.title}</h3>
            <p className="mt-2 text-body text-text-secondary-on-inverse">{point.body}</p>
          </li>
        ))}
        <li className="border-t border-text-on-inverse/15 pt-6 text-small text-text-secondary-on-inverse">
          Methods are named after the published books and coaching approaches they come from. Achivii isn’t affiliated
          with or endorsed by their authors.
        </li>
      </ul>
    </div>
  </section>
);
