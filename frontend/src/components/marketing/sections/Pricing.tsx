import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '../Button';
import { Section, Eyebrow, HEADING } from '../Section';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    note: 'for as long as you like',
    includes: ['Every guided goal', 'A daily step sized to your schedule', 'A weekly review and a plan that adjusts'],
    cta: { label: 'Start free', to: '/signup' },
    featured: false,
  },
  {
    name: 'Pro',
    price: '$9',
    note: 'a month, or $72 a year',
    includes: ['Everything in Free', 'A 90-day plan built around your own goal'],
    cta: { label: 'Get Pro', to: '/signup?premium=1' },
    featured: true,
  },
];

export const Pricing: React.FC = () => (
  <Section id="pricing" labelledBy="pricing-title">
    <Eyebrow>Pricing</Eyebrow>
    <h2 id="pricing-title" className={`mt-4 ${HEADING}`}>
      Free to start. Pro if you want your own goal.
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
            <h3 className="text-body font-medium text-text">Achivii {plan.name}</h3>
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
          <Button variant={plan.featured ? 'gold' : 'secondary'} to={plan.cta.to} className="mt-8 self-start">
            {plan.cta.label}
          </Button>
        </li>
      ))}
    </ul>
  </Section>
);
