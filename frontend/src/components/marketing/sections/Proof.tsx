import React from 'react';
import { CERTIFIED_PATHWAYS } from '../../../lib/certifiedPresets';
import { Reveal } from '../Reveal';
import { useCountUp, useInView } from '../hooks';

const FACTS = [
  { value: 90, label: 'days', body: 'One journey, in phases that each end in a milestone.' },
  { value: CERTIFIED_PATHWAYS.length, label: 'guided pathways', body: 'Built on proven methods, shaped around your schedule.' },
  { value: 1, label: 'step a day', body: 'Sized to the minutes you can honestly give.' },
];

const Fact: React.FC<{ value: number; label: string; body: string; active: boolean; index: number }> = ({ value, label, body, active, index }) => {
  const shown = useCountUp(value, active, 1500);
  return (
    <Reveal as="li" delayMs={index * 120} className="flex flex-col gap-3 px-2 py-8 sm:px-8 sm:py-10">
      <p className="flex items-baseline gap-3">
        <span className="tabular gold-text text-[clamp(3.5rem,6vw,5.5rem)] font-semibold leading-[0.85] tracking-[-0.05em]">{shown}</span>
        <span className="font-ui-mono text-xs uppercase tracking-[0.2em] text-text-secondary">{label}</span>
      </p>
      <p className="max-w-[18rem] text-[15px] leading-relaxed text-text-secondary">{body}</p>
    </Reveal>
  );
};

export const Proof: React.FC = () => {
  const { ref, inView } = useInView<HTMLUListElement>({ threshold: 0.4 });
  return (
    <section aria-label="Achivii at a glance" className="relative px-6 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-[1280px]">
        <div aria-hidden="true" className="gold-hairline" />
        <ul ref={ref} className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map((fact, index) => (
            <Fact key={fact.label} {...fact} active={inView} index={index} />
          ))}
        </ul>
        <div aria-hidden="true" className="gold-hairline" />
      </div>
    </section>
  );
};
