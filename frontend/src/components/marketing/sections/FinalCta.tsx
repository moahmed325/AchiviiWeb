import React from 'react';
import { Button } from '../Button';
import { Reveal } from '../Reveal';

const FIRST_STEPS = [
  { title: 'Choose a pathway', body: 'Pick one of the ten guided journeys.' },
  { title: 'Tell us your week', body: 'Your schedule, your starting point, the time you have.' },
  { title: 'Get your first week', body: 'Your journey, its phases, and tomorrow’s first step.' },
];

interface FinalCtaProps {
  onStartJourney: () => void;
  onSignIn: () => void;
}

export const FinalCta: React.FC<FinalCtaProps> = ({ onStartJourney, onSignIn }) => (
  <section aria-labelledby="final-cta-title" className="relative px-6 pb-28 pt-12 sm:px-10 sm:pb-40 lg:px-16">
    <div className="relative mx-auto w-full max-w-[1280px] overflow-hidden rounded-[20px] border border-border bg-surface px-6 py-20 sm:px-14 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 hidden h-full w-[46%] md:block">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="absolute bottom-0 border-l border-t border-border-strong bg-surface-elevated/60"
            style={{ right: `${(4 - i) * 20}%`, width: '20%', height: `${18 + i * 16}%` }}
          />
        ))}
        <span className="absolute bottom-[82%] right-[8%] h-2 w-2 rounded-full bg-achievement shadow-[0_0_24px_6px_rgba(200,169,107,0.35)]" />
      </div>

      <div className="relative max-w-[40rem]">
        <Reveal
          as="h2"
          id="final-cta-title"
          className="text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-text"
        >
          Every achievement starts with a first step.
        </Reveal>

        <ol className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-5">
          {FIRST_STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delayMs={100 + index * 90}>
              <p className="tabular font-ui-mono text-xs tracking-[0.18em] text-accent-hover">{`0${index + 1}`}</p>
              <p className="mt-3 text-base font-medium text-text">{step.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{step.body}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal delayMs={300} className="mt-14 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" withArrow onClick={onStartJourney}>
            Start your journey
          </Button>
          <Button size="lg" variant="quiet" onClick={onSignIn}>
            I already have an account
          </Button>
        </Reveal>
      </div>
    </div>
  </section>
);
