import React from 'react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';

const SYMPTOMS = [
  { title: 'Too many tabs', body: 'Twenty tutorials saved, none of them finished, no idea which one comes first.' },
  { title: 'Plans that ignore your life', body: 'A schedule written for someone with no job, no family and unlimited energy.' },
  { title: 'Motivation that fades by week two', body: 'The start feels great. Then a busy week breaks the streak, and the goal quietly disappears.' },
];

export const Problem: React.FC = () => (
  <Section id="problem" labelledBy="problem-title" className="py-28 sm:py-40">
    <div className="grid gap-16 lg:grid-cols-12 lg:gap-8">
      <div className="lg:col-span-7">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
        </Reveal>
        <Reveal
          as="h2"
          id="problem-title"
          delayMs={80}
          className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
        >
          <span className="text-text">You know what you want.</span>
          <br />
          <span className="text-text-secondary">You just don't know what to do next.</span>
        </Reveal>
        <Reveal as="p" delayMs={160} className="mt-8 max-w-[36rem] text-lg leading-relaxed text-text-secondary">
          Big goals fail in the gap between the dream and today. Achivii is for people with a real goal and a busy
          life: learning a skill, building something, getting fit, making a change.
        </Reveal>
      </div>

      <ul className="flex flex-col lg:col-span-5 lg:pt-28">
        {SYMPTOMS.map((item, index) => (
          <Reveal as="li" key={item.title} delayMs={120 + index * 90} className="border-t border-border py-7 last:border-b">
            <p className="flex items-baseline gap-4">
              <span className="tabular font-ui-mono text-xs text-text-muted">{`0${index + 1}`}</span>
              <span className="text-lg font-medium tracking-[-0.01em] text-text">{item.title}</span>
            </p>
            <p className="mt-2 pl-9 text-[15px] leading-relaxed text-text-secondary">{item.body}</p>
          </Reveal>
        ))}
      </ul>
    </div>
  </Section>
);
