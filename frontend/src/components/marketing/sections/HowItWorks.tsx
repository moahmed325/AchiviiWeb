import React from 'react';
import { Section, Eyebrow, HEADING } from '../Section';

const STEPS = [
  {
    title: 'Pick one goal',
    body: 'One at a time, so it gets your full attention.',
  },
  {
    title: 'Tell us about your week',
    body: 'How much time you have, which days work, and where you are starting from.',
  },
  {
    title: 'Do today’s step',
    body: 'One step a day, with the reason it matters. Each week ends with a short review, and the next week is written from what you actually did.',
  },
];

export const HowItWorks: React.FC = () => (
  <Section id="how" labelledBy="how-title">
    <Eyebrow>How it works</Eyebrow>
    <h2 id="how-title" className={`mt-4 ${HEADING}`}>
      Open it and know what to do today.
    </h2>

    <ol className="mt-12 grid gap-4 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step.title} className="rounded-panel border border-border bg-surface p-6 sm:p-7">
          <span className="tabular font-ui-mono text-small text-achievement">{`0${index + 1}`}</span>
          <h3 className="mt-6 text-h3 text-text">{step.title}</h3>
          <p className="mt-2 text-body text-text-secondary">{step.body}</p>
        </li>
      ))}
    </ol>
  </Section>
);
