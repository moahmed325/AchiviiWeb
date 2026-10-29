import React from 'react';
import { Plus } from 'lucide-react';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';
import { Section, Eyebrow, HEADING } from '../Section';

const MINUTES = CERTIFIED_PATHWAYS.map((p) => p.dailyMinutes);
const SHORTEST = Math.min(...MINUTES);
const LONGEST = Math.max(...MINUTES);

const QUESTIONS = [
  {
    q: 'Do I need to know what I want first?',
    a: `No. Look through the ${CERTIFIED_PATHWAYS.length} guided goals and pick the one you keep putting off. If it turns out not to be right, you can start a different one later.`,
  },
  {
    q: 'Is Achivii free?',
    a: 'Yes. Every guided goal is free. Achivii Pro is $9 a month or $72 a year and builds a plan around a goal of your own.',
  },
  {
    q: 'How much time does it take each day?',
    a: `Each goal lists its daily time, from ${SHORTEST} to ${LONGEST} minutes. You tell us the time you can give, and each step is sized to fit. On a busy day there is a ten-minute version.`,
  },
  {
    q: 'What happens if I miss a day?',
    a: 'Nothing breaks. Every week ends with a short review, and the next week is planned from what you actually did.',
  },
  {
    q: 'Is the plan written by AI?',
    a: 'Partly. AI writes your plan within the method of the goal you pick. How fast targets rise and how much you do each week are set by fixed rules in the app, not by the AI.',
  },
];

export const Faq: React.FC = () => (
  <Section id="faq" labelledBy="faq-title" className="isolate overflow-hidden">
    <div aria-hidden="true" className="landing-art landing-art-palm-night" />
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Eyebrow>Questions</Eyebrow>
        <h2 id="faq-title" className={`mt-4 ${HEADING}`}>
          Straight answers.
        </h2>
      </div>

      <div className="border-b border-border lg:col-span-6 lg:col-start-7">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group border-t border-border">
            <summary className="focus-ring flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-body font-medium text-text transition-colors hover:text-text-secondary [&::-webkit-details-marker]:hidden">
              {item.q}
              <Plus
                aria-hidden="true"
                strokeWidth={1.5}
                className="size-5 shrink-0 text-text-secondary transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
              />
            </summary>
            <p className="max-w-[34rem] pb-5 pr-10 text-body text-text-secondary">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  </Section>
);
