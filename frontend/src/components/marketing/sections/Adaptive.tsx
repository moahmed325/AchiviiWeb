import React from 'react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';

const LOOP = [
  { label: 'Execute', body: 'Do the week’s sessions, one day at a time.' },
  { label: 'Reflect', body: 'At the end of the week, note what worked and what didn’t.' },
  { label: 'Understand', body: 'See how much of the plan actually happened.' },
  { label: 'Adapt', body: 'Next week is written from that, not from the original guess.' },
  { label: 'Next step', body: 'Tomorrow’s step is ready. The climb continues.' },
];

const PRINCIPLES = [
  'A missed day is information, not failure.',
  'Milestones check that a phase really landed before you move on.',
  'The plan bends to your week. Your goal stays the same.',
];

export const Adaptive: React.FC = () => (
  <Section id="adaptive" labelledBy="adaptive-title" className="py-28 sm:py-40">
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Reveal>
          <Eyebrow>An adaptive system</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="adaptive-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
          Real life happens. The plan keeps up.
        </Reveal>
      </div>
      <Reveal as="p" delayMs={160} className="text-lg leading-relaxed text-text-secondary lg:col-span-5 lg:pt-20">
        Plans usually break the first time a week goes wrong. In Achivii, every week closes with a short review, and the
        next week is built from what you actually did.
      </Reveal>
    </div>

    <ol className="mt-20 grid gap-px overflow-hidden rounded-panel border border-border bg-border md:grid-cols-5">
      {LOOP.map((stage, index) => (
        <Reveal as="li" key={stage.label} delayMs={index * 100} className="relative bg-background p-6 sm:p-7">
          <div className="flex items-center justify-between">
            <span className="tabular font-ui-mono text-xs tracking-[0.18em] text-text-muted">{`0${index + 1}`}</span>
            <span aria-hidden="true" className="font-ui-mono text-xs text-text-muted">
              {index === LOOP.length - 1 ? '↺' : '→'}
            </span>
          </div>
          <h3
            className={`mt-12 font-ui-mono text-sm uppercase tracking-[0.18em] ${
              index === LOOP.length - 1 ? 'text-accent-hover' : 'text-text'
            }`}
          >
            {stage.label}
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{stage.body}</p>
        </Reveal>
      ))}
    </ol>

    <ul className="mt-14 grid gap-6 md:grid-cols-3">
      {PRINCIPLES.map((principle, index) => (
        <Reveal as="li" key={principle} delayMs={index * 90} className="border-t border-border-strong pt-5 text-[17px] leading-snug tracking-[-0.01em] text-text">
          {principle}
        </Reveal>
      ))}
    </ul>
  </Section>
);
