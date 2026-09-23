import React from 'react';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';
import { useInView } from '../hooks';

type Stop = {
  label: string;
  title: string;
  detail: string;
  kind: 'destination' | 'phase' | 'start';
  current?: boolean;
};

/** Top to bottom, as it is read; the climb lights up from the bottom. Phases from the YouTube pathway. */
const STOPS: Stop[] = [
  { label: 'Destination · Day 90', title: '12 videos published', detail: 'The outcome you chose on day one, reached.', kind: 'destination' },
  { label: 'Phase 03 · Weeks 9–12', title: 'Mastery', detail: 'Use what the numbers say. Ship the final videos.', kind: 'phase' },
  { label: 'Phase 02 · Weeks 5–8', title: 'Acceleration', detail: 'Stronger openings, faster edits, a steady rhythm.', kind: 'phase' },
  { label: 'Phase 01 · Weeks 1–4', title: 'Foundation', detail: 'Ideas, packaging and a repeatable production loop.', kind: 'phase', current: true },
  { label: 'Start · Day 1', title: 'Your first step', detail: 'Fifteen minutes. A single sentence about what you want.', kind: 'start' },
];

const CURRENT_INDEX = STOPS.findIndex((stop) => stop.current);

export const Journey: React.FC = () => {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.35 });

  return (
    <Section id="journey" labelledBy="journey-title" className="py-28 sm:py-40">
      <div className="grid gap-20 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-5">
          <Reveal>
            <Eyebrow>The 90-day journey</Eyebrow>
          </Reveal>
          <Reveal as="h2" id="journey-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
            A path you can see from the first step.
          </Reveal>
          <Reveal as="p" delayMs={160} className="mt-8 max-w-[30rem] text-lg leading-relaxed text-text-secondary">
            Every journey is divided into two to four phases, depending on what your goal needs. Each phase ends with a
            milestone, so you always know where you are and what the next landing looks like.
          </Reveal>

          <Reveal as="figure" delayMs={200} className="mt-14 hidden lg:block">
            <div className="relative aspect-[735/985] w-full max-w-[340px] overflow-hidden rounded-panel border border-border">
              <img
                src="/images/brand/staircase.jpg"
                alt="A lone figure climbing a zig-zag of pale stone stairs through darkness toward a soft light above."
                width={735}
                height={985}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <div className="flex items-end gap-5">
            <span className="tabular text-[clamp(6rem,14vw,11rem)] font-semibold leading-[0.8] tracking-[-0.06em] text-text">90</span>
            <span className="pb-3 font-ui-mono text-xs uppercase leading-relaxed tracking-[0.2em] text-text-secondary">
              days
              <br />
              one goal
            </span>
          </div>
          <p className="mt-4 font-ui-mono text-xs uppercase tracking-[0.18em] text-text-muted">Example · Launch a YouTube channel</p>

          <ol ref={ref} className="relative mt-12" aria-label="Journey stages, from destination down to the start">
            {STOPS.map((stop, index) => {
              const litOrder = STOPS.length - 1 - index;
              const lit = inView && index >= CURRENT_INDEX;
              const segmentLit = inView && index >= CURRENT_INDEX && index < STOPS.length - 1;
              const isDestination = stop.kind === 'destination';
              return (
                <li key={stop.label} className="relative flex gap-7 pb-10 last:pb-0">
                  {index < STOPS.length - 1 && (
                    <>
                      <span aria-hidden="true" className="absolute -bottom-1 left-[11px] top-[24px] w-px bg-border-strong" />
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 left-[11px] top-[24px] w-px origin-bottom bg-accent-hover/80 transition-transform duration-700 ease-ascend motion-reduce:transition-none"
                        style={{ transform: `scaleY(${segmentLit ? 1 : 0})`, transitionDelay: `${(litOrder - 1) * 260 + 130}ms` }}
                      />
                    </>
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative z-10 mt-1 flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full border transition-colors duration-700 motion-reduce:transition-none ${
                      isDestination
                        ? 'border-achievement/60 bg-background'
                        : lit
                          ? 'border-accent-hover bg-background'
                          : 'border-border-strong bg-background'
                    }`}
                    style={{ transitionDelay: `${litOrder * 260}ms` }}
                  >
                    <span
                      className={`h-[7px] w-[7px] rounded-full transition-colors duration-700 motion-reduce:transition-none ${
                        isDestination ? 'bg-achievement' : lit ? 'bg-accent-hover' : 'bg-text-muted/50'
                      }`}
                      style={{ transitionDelay: `${litOrder * 260}ms` }}
                    />
                  </span>
                  <div className={`flex-1 border-b border-border pb-8 ${index === STOPS.length - 1 ? 'border-b-0 pb-0' : ''}`}>
                    <p
                      className={`flex flex-wrap items-center gap-3 font-ui-mono text-[11px] uppercase tracking-[0.18em] ${
                        isDestination ? 'text-achievement' : 'text-text-secondary'
                      }`}
                    >
                      {stop.label}
                      {stop.current && (
                        <span className="rounded-full border border-accent-hover/40 px-2.5 py-0.5 text-accent-hover">You are here</span>
                      )}
                    </p>
                    <h3 className="mt-2.5 text-xl font-medium tracking-[-0.02em] text-text">{stop.title}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-text-secondary">{stop.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
};
