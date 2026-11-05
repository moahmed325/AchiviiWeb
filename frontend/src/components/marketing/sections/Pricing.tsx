import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../Button';
import { Section, Eyebrow, HEADING } from '../Section';

/** ND-37: every plan starts with 30 days free, no card; then Pro keeps it going. */
const PLANS = [
  {
    name: 'Your first 30 days',
    price: '$0',
    note: 'no card needed',
    includes: ['Your full plan, built around your week', 'A step every day, sized to your time', 'Each week planned from the last'],
    cta: { label: 'Start my 30 days', href: '#top' },
    featured: false,
  },
  {
    name: 'Achivii Pro',
    price: '$9',
    note: 'a month, or $72 a year',
    includes: ['Keep your plan going after 30 days', 'A new plan whenever you finish one', 'Your plans and progress, kept'],
    cta: { label: 'Get Pro', to: '/signup?premium=1' },
    featured: true,
  },
] as const;

export const Pricing: React.FC = () => (
  <Section id="pricing" labelledBy="pricing-title">
    <Eyebrow>Pricing</Eyebrow>
    <h2 id="pricing-title" className={`mt-4 ${HEADING}`}>
      Thirty days free. Then Pro keeps it going.
    </h2>

    <ul className="mt-12 grid gap-4 md:grid-cols-2">
      {PLANS.map((plan) => (
        <li
          key={plan.name}
          className={`flex flex-col justify-between rounded-panel border bg-surface p-7 sm:p-8 ${
            plan.featured ? 'border-border-strong' : 'border-border'
          }`}
        >
          <div>
            <h3 className="text-body font-medium text-text">{plan.name}</h3>
            <p className="mt-6 flex items-baseline gap-2">
              <span className="tabular text-h1 text-text">{plan.price}</span>
              <span className="text-body text-text-secondary">{plan.note}</span>
            </p>
            <ul className="mt-6 space-y-3 border-t border-border pt-6">
              {plan.includes.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-text">
                  <Check
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={`mt-1 size-4 shrink-0 text-text-secondary`}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {'href' in plan.cta ? (
            <Button variant={plan.featured ? 'gold' : 'secondary'} href={plan.cta.href} className="mt-8 self-start">
              {plan.cta.label}
            </Button>
          ) : (
            <Button variant={plan.featured ? 'gold' : 'secondary'} to={plan.cta.to} className="mt-8 self-start">
              {plan.cta.label}
            </Button>
          )}
        </li>
      ))}
    </ul>
  </Section>
);
