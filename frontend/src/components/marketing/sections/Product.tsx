import React from 'react';
import { Check, Clock } from 'lucide-react';
import { Section, Eyebrow, HEADING } from '../Section';
import { Reveal } from '../Reveal';
import { useCountUp, useInView } from '../hooks';

const POINTS = [
  { title: 'Sized to your day', body: 'The session fits the time and slot you chose, with a ten-minute version for the days life takes over.' },
  { title: 'The reason, not just the task', body: 'Every step says why it matters today, so it never feels like busywork.' },
  { title: 'A plan that keeps up', body: "A day that doesn't happen is information, not a verdict. Each week is rewritten from what actually happened." },
];

const STEPS = [
  'Draft three title and thumbnail pairs for your next video.',
  'Write a 30-second opening hook for the strongest one.',
  'Read it aloud once and cut every line that isn’t needed.',
];

const RAIL = [
  { label: 'Day 1', title: 'First step', current: false },
  { label: 'Weeks 1–4', title: 'Foundation', current: true },
  { label: 'Weeks 5–8', title: 'Acceleration', current: false },
  { label: 'Weeks 9–12', title: 'Mastery', current: false },
  { label: 'Day 90', title: '12 videos published', current: false, summit: true },
];

const TodayMockup: React.FC = () => {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 });
  const day = useCountUp(27, inView, 1400);

  return (
    <div
      ref={ref}
      role="img"
      aria-label="Example of a daily step in Achivii: day 27 of 90, a 60-minute session on thumbnail framing and a 30-second hook, with three written steps and a ten-minute fallback."
      className="gold-panel relative rounded-[18px] p-2"
    >
      <div aria-hidden="true" className="rounded-panel border border-border bg-background p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className="font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Week 4 · Foundation</p>
          <p className="tabular font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">
            Day <span className="text-achievement-hover">{String(day).padStart(2, '0')}</span> / 90
          </p>
        </div>

        <div className="mt-5 h-[3px] w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-deep via-achievement to-gold-bright shadow-[0_0_12px_rgba(200,169,107,0.7)] transition-[width] duration-[1400ms] ease-ascend motion-reduce:transition-none"
            style={{ width: inView ? '30%' : '0%' }}
          />
        </div>

        <p className="mt-8 font-ui-mono text-[11px] uppercase tracking-[0.18em] text-achievement">Today’s step</p>
        <p className="mt-3 text-[clamp(1.35rem,2.4vw,1.75rem)] font-medium leading-tight tracking-[-0.025em] text-text">
          Thumbnail framing and a 30-second hook
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
          <Clock className="h-4 w-4" strokeWidth={1.75} />
          60 min · 18:00 – 19:00
        </p>

        <div className="mt-7 rounded-block border-l-2 border-achievement bg-surface px-4 py-3">
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
                  index === 0 ? 'border-achievement bg-achievement text-background' : 'border-border-strong text-transparent'
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
          <span className="btn-gold inline-flex min-h-10 items-center justify-center rounded-full px-5 text-sm font-medium">Mark as done</span>
        </div>
      </div>
    </div>
  );
};

/** The 90 days as one rail. The gold line rises to where you are; the summit glows beyond it. */
const JourneyRail: React.FC = () => {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.4 });
  const currentIndex = RAIL.findIndex((stop) => stop.current);
  const fill = (currentIndex / (RAIL.length - 1)) * 100;

  return (
    <div className="mt-20 sm:mt-28">
      <p className="font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary">Example · Launch a YouTube channel</p>
      <ol ref={ref} aria-label="Journey stages, from the first step to day 90" className="relative mt-8 grid gap-8 sm:grid-cols-5 sm:gap-4">
        <span aria-hidden="true" className="absolute left-[7px] top-2 hidden h-px w-[calc(100%-14px)] bg-border-strong sm:block" />
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-2 hidden h-px origin-left bg-gradient-to-r from-gold-deep to-achievement shadow-[0_0_10px_rgba(200,169,107,0.8)] transition-transform duration-[1600ms] ease-ascend motion-reduce:transition-none sm:block"
          style={{ width: 'calc(100% - 14px)', transform: `scaleX(${inView ? fill / 100 : 0})` }}
        />
        {RAIL.map((stop, index) => {
          const reached = index <= currentIndex;
          return (
            <li key={stop.label} className="relative flex gap-4 sm:block">
              <span
                aria-hidden="true"
                className={`relative z-10 mt-1 block h-[15px] w-[15px] shrink-0 rounded-full border sm:mt-0 ${
                  stop.summit
                    ? 'gold-breathe border-achievement bg-achievement shadow-[0_0_22px_6px_rgba(200,169,107,0.55)]'
                    : reached
                      ? 'border-achievement bg-achievement'
                      : 'border-border-strong bg-background'
                }`}
              />
              <div className="sm:mt-5">
                <p className={`font-ui-mono text-[11px] uppercase tracking-[0.18em] ${stop.summit || reached ? 'text-achievement' : 'text-text-secondary'}`}>
                  {stop.label}
                </p>
                <p className="mt-1.5 text-base font-medium tracking-[-0.015em] text-text">{stop.title}</p>
                {stop.current && (
                  <span className="mt-2 inline-block rounded-full border border-achievement/40 px-2.5 py-0.5 font-ui-mono text-[10px] uppercase tracking-[0.16em] text-achievement">
                    You are here
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export const Product: React.FC = () => (
  <Section id="product" labelledBy="product-title" className="py-16 sm:py-36">
    <div className="grid items-center gap-16 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-5">
        <Reveal>
          <Eyebrow>Inside Achivii</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="product-title" delayMs={80} className={`mt-8 ${HEADING}`}>
          Open it. Know exactly what to do.
        </Reveal>
        <Reveal as="p" delayMs={160} className="mt-7 max-w-[30rem] text-lg leading-relaxed text-text-secondary">
          The whole 90 days collapses into one question each morning, already answered: what is the next step?
        </Reveal>
        <ul className="mt-10 space-y-7">
          {POINTS.map((point, index) => (
            <Reveal as="li" key={point.title} delayMs={200 + index * 90} className="flex gap-4">
              <span aria-hidden="true" className="mt-2.5 h-px w-5 shrink-0 bg-achievement" />
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
        <p className="mt-4 text-center font-ui-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary/80">
          Illustration · from the YouTube pathway
        </p>
      </Reveal>
    </div>

    <JourneyRail />
  </Section>
);
