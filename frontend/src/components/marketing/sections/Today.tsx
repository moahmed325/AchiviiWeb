import React from 'react';
import { Clock, Check } from 'lucide-react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';
import { useCountUp, useInView } from '../hooks';

const POINTS = [
  { title: 'Sized to your day', body: 'The session fits the time and slot you chose, not an ideal version of you.' },
  { title: 'The reason, not just the task', body: 'Every step says why it matters today, so it never feels like busywork.' },
  { title: 'A ten-minute version', body: 'For the days life takes over, a smaller step that still keeps you moving.' },
];

const STEPS = [
  'Draft three title and thumbnail pairs for your next video.',
  'Write a 30-second opening hook for the strongest one.',
  'Read it aloud once and cut every line that isn’t needed.',
];

const TodayMockup: React.FC = () => {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
  const day = useCountUp(27, inView, 1400);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Example of a daily step in Achivii: day 27 of 90, a 60-minute session on thumbnail framing and a 30-second hook, with three written steps and a ten-minute fallback."
      className="relative rounded-[18px] border border-border-strong bg-surface p-2 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
    >
      <div aria-hidden="true" className="rounded-panel border border-border bg-background p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
            Week 4 · Foundation
          </p>
          <p className="tabular font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
            Day <span className="text-text">{String(day).padStart(2, '0')}</span> / 90
          </p>
        </div>

        <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-accent-hover transition-[width] duration-[1400ms] ease-ascend motion-reduce:transition-none"
            style={{ width: inView ? '30%' : '0%' }}
          />
        </div>

        <p className="mt-8 font-ui-mono text-[11px] uppercase tracking-[0.18em] text-accent-hover">Today’s step</p>
        <p className="mt-3 text-[clamp(1.35rem,2.4vw,1.75rem)] font-medium leading-tight tracking-[-0.025em] text-text">
          Thumbnail framing and a 30-second hook
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
          <Clock className="h-4 w-4" strokeWidth={1.75} />
          60 min · 18:00 – 19:00
        </p>

        <div className="mt-7 rounded-block border-l-2 border-achievement/70 bg-surface px-4 py-3">
          <p className="font-ui-mono text-[10px] uppercase tracking-[0.18em] text-achievement">Why today</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">
            You film on Saturday. The first 30 seconds decide whether anyone stays.
          </p>
        </div>

        <ol className="mt-7 space-y-3.5">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3.5 text-[15px] leading-snug text-text">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  index === 0 ? 'border-accent-hover bg-accent-hover text-background' : 'border-border-strong text-transparent'
                }`}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className={index === 0 ? 'text-text-secondary line-through decoration-text-muted' : ''}>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-text-secondary">
            <span className="text-text">Short on time?</span> Write one hook and read it aloud. 10 min.
          </p>
          <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-text px-5 text-sm font-medium text-background">
            Mark as done
          </span>
        </div>
      </div>
    </div>
  );
};

export const Today: React.FC = () => (
  <Section id="today" labelledBy="today-title" className="py-28 sm:py-40">
    <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <Reveal>
          <Eyebrow tone="accent">Today’s step</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="today-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
          Open it. Know exactly what to do.
        </Reveal>
        <Reveal as="p" delayMs={160} className="mt-8 max-w-[30rem] text-lg leading-relaxed text-text-secondary">
          The whole 90 days collapses into one question each morning, already answered: what is the next step?
        </Reveal>
        <ul className="mt-12 space-y-7">
          {POINTS.map((point, index) => (
            <Reveal as="li" key={point.title} delayMs={200 + index * 90} className="flex gap-4">
              <span aria-hidden="true" className="mt-2.5 h-px w-5 shrink-0 bg-accent-hover" />
              <div>
                <h3 className="text-base font-medium text-text">{point.title}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-text-secondary">{point.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>

      <Reveal delayMs={120} className="lg:col-span-6 lg:col-start-7">
        <TodayMockup />
        <p className="mt-4 text-center font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
          Illustration · from the YouTube pathway
        </p>
      </Reveal>
    </div>
  </Section>
);
