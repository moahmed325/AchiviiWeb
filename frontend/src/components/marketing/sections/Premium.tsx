import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Section, Eyebrow, HEADING } from '../Section';
import { Reveal } from '../Reveal';

const FEATURES = [
  {
    mark: '✦',
    name: 'Achivii Coach',
    status: 'In development',
    headline: 'Talk to your coach.',
    body: 'Talk through a hard week, ask why a step matters, and adjust your plan in conversation. It is being designed now and isn’t available yet.',
    pro: false,
  },
  {
    mark: '✦',
    name: 'Achivii Pro',
    status: 'Available now',
    headline: 'Have something unique in mind?',
    body: 'Build a guided 90-day journey around your own ambition, beyond the certified pathways, with the same deliberate practice, milestones, and weekly benchmarks. Pro is $9/month or $72/year, and every existing journey stays available for as long as you have it.',
    pro: true,
  },
];

export const Premium: React.FC = () => (
  <Section id="premium" labelledBy="premium-title" className="py-24 sm:py-36">
    <div className="max-w-[46rem]">
      <Reveal>
        <Eyebrow>Pricing</Eyebrow>
      </Reveal>
      <Reveal as="h2" id="premium-title" delayMs={80} className={`mt-8 ${HEADING}`}>
        More ways to climb, on the way.
      </Reveal>
    </div>

    <div className="mt-16 grid gap-4 md:grid-cols-5">
      {FEATURES.map((feature, index) => (
        <Reveal
          as="figure"
          key={feature.name}
          delayMs={index * 120}
          className={`relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-panel p-8 sm:p-10 ${
            feature.pro ? 'gold-panel order-1 md:col-span-3' : 'order-2 border border-border bg-surface md:col-span-2'
          }`}
        >
          {feature.pro && (
            <div
              aria-hidden="true"
              className="gold-breathe pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(200,169,107,0.28),transparent_65%)]"
            />
          )}
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 text-[15px] font-medium text-text">
              <span aria-hidden="true" className="text-achievement">
                {feature.mark}
              </span>
              {feature.name}
            </p>
            <span
              className={`rounded-full border px-3 py-1 font-ui-mono text-[11px] uppercase tracking-[0.16em] ${
                feature.pro ? 'border-achievement/60 bg-achievement/10 text-achievement-hover' : 'border-border-strong text-text-secondary'
              }`}
            >
              {feature.status}
            </span>
          </div>
          <div className="relative mt-16">
            <h3 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-medium leading-tight tracking-[-0.03em] text-text">{feature.headline}</h3>
            <p className="mt-4 max-w-[32rem] text-[16px] leading-relaxed text-text-secondary">{feature.body}</p>
            {feature.pro && (
              <Link
                to="/signup?premium=1"
                className="btn-gold focus-ring group mt-8 inline-flex min-h-11 items-center gap-2.5 rounded-full px-6 text-[15px] font-medium"
              >
                <span className="relative z-10">Start with Pro</span>
                <ArrowRight aria-hidden="true" strokeWidth={1.75} className="relative z-10 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </Reveal>
      ))}
    </div>

    <Reveal as="p" delayMs={200} className="mt-8 text-[15px] text-text-secondary">
      Achivii Pro is $9/month or $72/year. Certified pathways stay free — Pro unlocks creating your own custom 90-day journeys.
    </Reveal>
  </Section>
);
