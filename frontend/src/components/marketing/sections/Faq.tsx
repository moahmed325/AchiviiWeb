import React from 'react';
import { Plus } from 'lucide-react';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';
import { Section, Eyebrow, HEADING } from '../Section';
import { Reveal } from '../Reveal';

const MINUTES = CERTIFIED_PATHWAYS.map((p) => p.dailyMinutes);
const SHORTEST = Math.min(...MINUTES);
const LONGEST = Math.max(...MINUTES);

const QUESTIONS = [
  {
    q: 'Is Achivii free?',
    a: 'Starting is free, and the certified pathways stay free. Achivii Pro is $9/month or $72/year and unlocks building your own custom 90-day journey.',
  },
  {
    q: 'How much time does it take each day?',
    a: `Each pathway lists its daily time, from ${SHORTEST} to ${LONGEST} minutes. You also tell us the slot you can honestly give, and the session is sized to fit. On a tight day there is a ten-minute version.`,
  },
  {
    q: 'What happens if I miss a day?',
    a: 'A missed day is information, not failure. Every week closes with a short review, and the next week is written from what you actually did.',
  },
  {
    q: 'What if my goal isn’t one of the pathways?',
    a: 'Pro lets you describe your own ambition and builds a guided 90-day journey around it, with the same practice, milestones and weekly benchmarks.',
  },
  {
    q: 'Is the AI coach available?',
    a: 'Not yet. Achivii Coach is being designed now. Everything else on this page works today.',
  },
];

export const Faq: React.FC = () => (
  <Section id="faq" labelledBy="faq-title" className="py-24 sm:py-36">
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <Reveal>
          <Eyebrow>Questions</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="faq-title" delayMs={80} className={`mt-8 ${HEADING}`}>
          Straight answers.
        </Reveal>
      </div>

      <Reveal delayMs={120} className="lg:col-span-6 lg:col-start-7">
        <div className="border-b border-border">
          {QUESTIONS.map((item) => (
            <details key={item.q} className="group border-t border-border open:border-achievement/40">
              <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[17px] font-medium tracking-[-0.015em] text-text transition-colors hover:text-achievement-hover [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className="h-5 w-5 shrink-0 text-achievement transition-transform duration-300 ease-ascend group-open:rotate-45"
                />
              </summary>
              <p className="max-w-[34rem] pb-6 pr-10 text-[15px] leading-relaxed text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </div>
  </Section>
);
