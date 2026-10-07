import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Section, Eyebrow, HEADING } from '../Section';
import { Reveal } from '../Reveal';

type Billing = 'monthly' | 'yearly';

const FREE_INCLUDES = [
  'All ten certified pathways',
  'A daily step sized to your schedule',
  'Phases, milestones and a weekly review',
];

const PRO_INCLUDES = [
  'Everything in Free',
  'Your own goal, built into a 90-day journey',
  'The same practice, milestones and weekly benchmarks',
];

const Includes: React.FC<{ items: string[]; gold?: boolean }> = ({ items, gold = false }) => (
  <ul className="mt-8 space-y-3.5 border-t border-border pt-8">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3 text-[15px] leading-snug text-text">
        <Check
          aria-hidden="true"
          strokeWidth={2}
          className={`mt-0.5 h-4 w-4 shrink-0 ${gold ? 'text-achievement' : 'text-text-secondary'}`}
        />
        {item}
      </li>
    ))}
  </ul>
);

/** Monthly / yearly switch. Radio inputs, so it reads as a form control rather than a checkout button. */
const BillingSwitch: React.FC<{ value: Billing; onChange: (next: Billing) => void }> = ({ value, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Billing period"
    className="inline-flex items-center rounded-full border border-border-strong bg-background/60 p-1"
  >
    {(['monthly', 'yearly'] as const).map((option) => (
      <label key={option} className="group relative cursor-pointer">
        <input
          type="radio"
          name="billing-period"
          value={option}
          checked={value === option}
          onChange={() => onChange(option)}
          className="peer sr-only"
        />
        <span className="flex min-h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium capitalize text-text-secondary transition-colors peer-checked:bg-achievement peer-checked:text-background peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-achievement">
          {option}
          {option === 'yearly' && (
            <span className="rounded-full bg-achievement/15 px-2 py-0.5 font-ui-mono text-[10px] uppercase tracking-[0.1em] text-achievement-hover group-has-[:checked]:bg-background/20 group-has-[:checked]:text-background">
              Save 33%
            </span>
          )}
        </span>
      </label>
    ))}
  </div>
);

export const Premium: React.FC = () => {
  const [billing, setBilling] = useState<Billing>('yearly');
  const yearly = billing === 'yearly';

  return (
    <Section id="premium" labelledBy="premium-title" className="py-16 sm:py-36">
      <Reveal>
        <Eyebrow>Pricing</Eyebrow>
      </Reveal>
      <Reveal as="h2" id="premium-title" delayMs={80} className={`mt-8 ${HEADING}`}>
        More ways to climb, on the way.
      </Reveal>

      <div className="mt-16 grid gap-4 md:grid-cols-2">
        {/* Free */}
        <Reveal
          as="div"
          className="spotlight order-1 flex flex-col justify-between rounded-panel border border-border bg-surface p-8 sm:p-10"
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] font-medium text-text">Achivii Free</p>
              <span className="rounded-full border border-border-strong px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary">
                Free to start
              </span>
            </div>
            <p className="mt-10 flex items-baseline gap-2">
              <span className="tabular text-[clamp(3rem,5vw,4.25rem)] font-semibold leading-none tracking-[-0.05em] text-text">$0</span>
              <span className="text-[15px] text-text-secondary">to begin</span>
            </p>
            <p className="mt-4 max-w-[26rem] text-[15px] leading-relaxed text-text-secondary">
              Pick a guided pathway and start climbing today.
            </p>
            <Includes items={FREE_INCLUDES} />
          </div>
          <Link
            to="/signup"
            className="focus-ring relative z-10 mt-10 inline-flex min-h-11 items-center justify-center rounded-full border border-border-strong px-6 text-[15px] font-medium text-text transition-colors hover:border-achievement/60 hover:text-achievement-hover"
          >
            Start free
          </Link>
        </Reveal>

        {/* Coach: in DOM before Pro to keep the document order stable; shown last on screen */}
        <Reveal
          as="div"
          delayMs={240}
          className="spotlight order-3 flex flex-col gap-6 rounded-panel border border-dashed border-border-strong bg-transparent p-8 md:col-span-2 md:flex-row md:items-center md:justify-between md:gap-10 sm:p-10"
        >
          <div className="relative z-10 max-w-[34rem]">
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-2.5 text-[15px] font-medium text-text">
                <span aria-hidden="true" className="text-achievement">
                  ✦
                </span>
                Achivii Coach
              </p>
              <span className="rounded-full border border-border-strong px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary">
                In development
              </span>
            </div>
            <h3 className="mt-5 text-[clamp(1.35rem,2.2vw,1.75rem)] font-medium leading-tight tracking-[-0.03em] text-text">
              Talk to your coach.
            </h3>
          </div>
          <p className="relative z-10 max-w-[28rem] text-[15px] leading-relaxed text-text-secondary">
            Talk through a hard week, ask why a step matters, and adjust your plan in conversation. It is being designed now and isn’t available yet.
          </p>
        </Reveal>

        {/* Pro */}
        <Reveal
          as="div"
          delayMs={120}
          className="gold-panel spotlight relative order-2 flex flex-col justify-between overflow-hidden rounded-panel p-8 sm:p-10"
        >
          <div
            aria-hidden="true"
            className="gold-breathe pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-achievement)_28%,transparent),transparent_65%)]"
          />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2.5 text-[15px] font-medium text-text">
                <span aria-hidden="true" className="text-achievement">
                  ✦
                </span>
                Achivii Pro
              </p>
              <span className="rounded-full border border-achievement/60 bg-achievement/10 px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-achievement-hover">
                Available now
              </span>
            </div>

            <div className="mt-8">
              <BillingSwitch value={billing} onChange={setBilling} />
            </div>

            <p className="mt-6 flex items-baseline gap-2" aria-live="polite">
              <span className="tabular gold-text text-[clamp(3rem,5vw,4.25rem)] font-semibold leading-none tracking-[-0.05em]">
                {yearly ? '$72' : '$9'}
              </span>
              <span className="text-[15px] text-text-secondary">{yearly ? 'per year' : 'per month'}</span>
              {yearly && <span className="ml-1 text-[13px] text-achievement-hover">that’s $6 a month</span>}
            </p>

            <h3 className="mt-8 text-[clamp(1.5rem,2.4vw,1.9rem)] font-medium leading-tight tracking-[-0.03em] text-text">
              Have something unique in mind?
            </h3>
            <p className="mt-3 max-w-[32rem] text-[15px] leading-relaxed text-text-secondary">
              Build a guided 90-day journey around your own ambition, beyond the certified pathways, with the same deliberate practice, milestones, and weekly benchmarks. Pro is $9/month or $72/year, and every existing journey stays available for as long as you have it.
            </p>
            <Includes items={PRO_INCLUDES} gold />
          </div>
          <Link
            to="/signup?premium=1"
            className="btn-gold focus-ring group relative z-10 mt-10 inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full px-6 text-[15px] font-medium"
          >
            <span className="relative z-10">Start with Pro</span>
            <ArrowRight aria-hidden="true" strokeWidth={1.75} className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>

      <Reveal as="p" delayMs={200} className="mt-8 text-[15px] text-text-secondary">
        Achivii Pro is $9/month or $72/year. Certified pathways stay free — Pro unlocks creating your own custom 90-day journeys.
      </Reveal>
    </Section>
  );
};
