import React from 'react';
import { Section, Eyebrow, HEADING } from '../Section';
import { Reveal } from '../Reveal';

const STEPS = [
  {
    title: 'Choose one goal',
    body: 'Pick a guided pathway. One goal at a time, so it gets your full attention.',
  },
  {
    title: 'Tell us your reality',
    body: 'Your schedule, your starting point, the time you can honestly give each day. Your journey is built around it.',
  },
  {
    title: 'Climb, one step a day',
    body: 'Ninety days in phases, each ending in a milestone. Every week closes with a review, and the next one is written from what really happened.',
  },
];

const SLAB_HEIGHTS = ['md:min-h-[270px]', 'md:min-h-[340px]', 'md:min-h-[410px]'];

export const Method: React.FC = () => (
  <Section id="method" labelledBy="method-title" className="py-16 sm:py-36">
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <Reveal>
          <Eyebrow>How it works</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="method-title" delayMs={80} className={`mt-8 ${HEADING}`}>
          You know what you want. <span className="text-text-secondary">Here is what to do next.</span>
        </Reveal>
      </div>
      <Reveal as="p" delayMs={160} className="text-lg leading-relaxed text-text-secondary lg:col-span-4 lg:col-start-9 lg:pt-20">
        Big goals fail in the gap between the dream and today. Achivii closes it in three moves.
      </Reveal>
    </div>

    <ol className="mt-16 grid gap-4 md:grid-cols-3 md:items-end">
      {STEPS.map((step, index) => {
        const summit = index === STEPS.length - 1;
        return (
          <Reveal
            as="li"
            key={step.title}
            delayMs={index * 130}
            className={`spotlight flex flex-col justify-between rounded-panel p-7 sm:p-8 ${SLAB_HEIGHTS[index]} ${
              summit ? 'gold-panel' : 'border border-border bg-surface'
            }`}
          >
            <span
              className={`tabular text-[clamp(2.5rem,4vw,3.25rem)] font-semibold leading-none tracking-[-0.05em] ${
                summit ? 'gold-text' : 'text-achievement/70'
              }`}
            >{`0${index + 1}`}</span>
            <div className="mt-10 md:mt-16">
              <h3 className="text-xl font-medium leading-snug tracking-[-0.02em] text-text">{step.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-text-secondary">{step.body}</p>
            </div>
          </Reveal>
        );
      })}
    </ol>
  </Section>
);
