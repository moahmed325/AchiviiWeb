import React from 'react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';

const STEPS = [
  { title: 'Choose one goal', body: 'Pick a guided pathway. One goal at a time, so it gets your full attention.' },
  { title: 'Tell us your reality', body: 'Your schedule, your starting point, the time you can honestly give each day.' },
  { title: 'Get your journey', body: 'Ninety days split into phases, each ending in a clear milestone.' },
  { title: 'Take today’s step', body: 'One focused session with the steps written out. No guessing what comes next.' },
  { title: 'Review and adapt', body: 'Each week you look back, and next week is written from what really happened.' },
];

const SLAB_HEIGHTS = ['md:min-h-[250px]', 'md:min-h-[300px]', 'md:min-h-[350px]', 'md:min-h-[400px]', 'md:min-h-[450px]'];

export const Method: React.FC = () => (
  <Section id="method" labelledBy="method-title" className="py-28 sm:py-40">
    <div className="max-w-[46rem]">
      <Reveal>
        <Eyebrow tone="accent">The Achivii method</Eyebrow>
      </Reveal>
      <Reveal as="h2" id="method-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
        Five steps between wanting it and doing it.
      </Reveal>
    </div>

    <ol className="mt-20 grid gap-3 md:grid-cols-5 md:items-end">
      {STEPS.map((step, index) => (
        <Reveal
          as="li"
          key={step.title}
          delayMs={index * 110}
          className={`flex flex-col justify-between rounded-panel border border-border p-6 ${SLAB_HEIGHTS[index]} ${
            index === STEPS.length - 1 ? 'bg-surface-elevated border-border-strong' : 'bg-surface'
          }`}
        >
          <span className="tabular font-ui-mono text-xs tracking-[0.18em] text-accent-hover">{`0${index + 1}`}</span>
          <div className="mt-5 md:mt-16">
            <h3 className="text-lg font-medium leading-snug tracking-[-0.015em] text-text">{step.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{step.body}</p>
          </div>
        </Reveal>
      ))}
    </ol>
  </Section>
);
