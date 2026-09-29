import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Badge, Button, cx } from '../ui';
export type ProInterval = 'monthly' | 'yearly';
export interface ProPresentationProps { selectedInterval?: ProInterval; onIntervalChange?: (interval: ProInterval) => void; onContinue?: () => void; className?: string; }
export const ProPresentation: React.FC<ProPresentationProps> = ({ selectedInterval='monthly', onIntervalChange, onContinue, className }) => (
  <section aria-labelledby="achivii-pro-title" className={cx('rounded-card border border-achievement/30 bg-surface p-6 shadow-subtle sm:p-8', className)}>
    <Badge tone="achievement"><Sparkles aria-hidden="true" className="mr-1.5 inline size-3.5" strokeWidth={1.5} />Achivii Pro</Badge>
    <h2 id="achivii-pro-title" className="mt-4 text-h2 text-text">Make the journey yours.</h2>
    <p className="mt-2 max-w-2xl text-body text-text-secondary">Pro unlocks Custom Goals, so Achivii can structure a 90-day journey around an ambition that is not already in the certified pathway library.</p>
    <ul className="mt-6 grid gap-3 text-small text-text sm:grid-cols-2" aria-label="Pro benefits">
      {['Create Custom Goals','Get an adaptive 90-day journey','Keep your existing journeys','Use the same daily planning system'].map((benefit) => <li key={benefit} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-achievement" strokeWidth={1.75}/><span>{benefit}</span></li>)}
    </ul>
    <div className="mt-7" aria-label="Billing interval">
      <p className="font-ui-mono text-micro uppercase tracking-[0.14em] text-text-secondary">Choose billing</p>
      <div className="mt-2 grid max-w-md grid-cols-2 gap-2" role="group">
        {(['monthly','yearly'] as const).map((interval) => <Button key={interval} type="button" size="sm" variant={selectedInterval===interval?'premium':'secondary'} aria-pressed={selectedInterval===interval} onClick={()=>onIntervalChange?.(interval)}>{interval==='monthly'?'Monthly':'Yearly'}</Button>)}
      </div>
      <p className="mt-2 text-small text-text-secondary">Pricing is shown by the configured checkout. No price is displayed here unless the billing configuration supplies it.</p>
    </div>
    <Button className="mt-6 w-full sm:w-auto" size="lg" variant="primary" onClick={onContinue} disabled={!onContinue}>Continue to Pro</Button>
  </section>
);
