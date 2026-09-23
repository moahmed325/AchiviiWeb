import React from 'react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';

const FEATURES = [
  {
    mark: '✦',
    name: 'Achivii Coach',
    status: 'In development',
    headline: 'Talk to your coach.',
    body: 'Talk through a hard week, ask why a step matters, and adjust your plan in conversation. It is being designed now and isn’t available yet.',
  },
  {
    mark: '◇',
    name: 'Custom Journeys',
    status: 'Planned for Premium',
    headline: 'Have something unique in mind?',
    body: 'Build a journey around your own goal, beyond the guided pathways, with the same phases, milestones and daily steps.',
  },
];

export const Premium: React.FC = () => (
  <Section id="premium" labelledBy="premium-title" className="py-28 sm:py-40">
    <div className="max-w-[46rem]">
      <Reveal>
        <Eyebrow tone="achievement">Coming to Achivii</Eyebrow>
      </Reveal>
      <Reveal as="h2" id="premium-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
        More ways to climb, on the way.
      </Reveal>
    </div>

    <div className="mt-20 grid gap-4 md:grid-cols-2">
      {FEATURES.map((feature, index) => (
        <Reveal
          as="figure"
          key={feature.name}
          delayMs={index * 120}
          className="relative flex min-h-[340px] flex-col justify-between overflow-hidden rounded-panel border border-border bg-surface p-8 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(200,169,107,0.12),transparent_65%)]"
          />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 text-[15px] font-medium text-text">
              <span aria-hidden="true" className="text-achievement">
                {feature.mark}
              </span>
              {feature.name}
            </p>
            <span className="rounded-full border border-achievement/40 px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-achievement">
              {feature.status}
            </span>
          </div>
          <div className="relative mt-16">
            <h3 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-medium leading-tight tracking-[-0.03em] text-text">{feature.headline}</h3>
            <p className="mt-4 max-w-[30rem] text-[16px] leading-relaxed text-text-secondary">{feature.body}</p>
          </div>
        </Reveal>
      ))}
    </div>

    <Reveal as="p" delayMs={200} className="mt-8 text-[15px] text-text-secondary">
      There is no paid plan yet. Everything you can use in Achivii today is free.
    </Reveal>
  </Section>
);
