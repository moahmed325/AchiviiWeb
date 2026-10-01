import React from 'react';
import { Button } from '../Button';
import { Eyebrow } from '../Section';
import { StaircaseScene } from '../StaircaseScene';

export const Hero: React.FC = () => (
  <section
    id="top"
    aria-labelledby="hero-title"
    className="relative isolate overflow-hidden px-5 pb-16 pt-28 sm:px-10 sm:pb-24 sm:pt-32 lg:px-16 lg:pt-0 lg:min-h-[100svh]"
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="gold-breathe absolute -right-[10%] top-[8%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle,rgba(200,169,107,0.22),rgba(200,169,107,0.06)_45%,transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-px gold-hairline" />
    </div>

    <div className="mx-auto grid w-full max-w-[1280px] items-center gap-4 lg:min-h-[100svh] lg:grid-cols-12 lg:gap-8">
      <div className="relative z-10 lg:col-span-6 lg:py-32">
        <div className="mb-8 flex items-center gap-3 font-ui-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary sm:mb-10">
          <span className="h-px w-8 bg-achievement" />
          <span>Make room for the work that matters</span>
        </div>
        <h1
          id="hero-title"
          className="max-w-[9ch] text-[clamp(3.5rem,13vw,7.8rem)] font-semibold leading-[0.87] tracking-[-0.07em] text-text sm:mt-7"
        >
          Your ambition deserves <span className="gold-text whitespace-nowrap">a path.</span>
        </h1>
        <p className="mt-6 max-w-[34rem] text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.65] text-text-secondary sm:mt-7">
          Achivii turns what you want into a 90-day journey with phases, milestones and one focused step every day,
          fitted around the hours you actually have.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" variant="gold" withArrow to="/signup">
            Start your journey
          </Button>
          <Button size="lg" variant="secondary" href="#method">
            See how it works
          </Button>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary/80">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-achievement shadow-[0_0_10px_2px_rgba(200,169,107,0.6)]" />
            Free to start
          </span>
          <span aria-hidden="true" className="hidden text-text-muted sm:inline">/</span>
          <span>Built around your schedule</span>
          <span aria-hidden="true" className="hidden text-text-muted sm:inline">/</span>
          <span>No streaks to break</span>
        </div>
      </div>

      <div className="relative -mx-6 sm:-mx-10 lg:mx-0 lg:col-span-6 lg:h-[100svh]">
        <StaircaseScene className="mx-auto h-[62svh] max-h-[640px] w-full sm:h-[70svh] lg:h-full lg:max-h-none" />

        <div
          aria-hidden="true"
          className="stair-piece absolute bottom-[14%] left-6 hidden w-[260px] rounded-panel border border-achievement/30 bg-background/70 p-4 shadow-[0_24px_60px_-30px_rgba(200,169,107,0.5)] backdrop-blur-md sm:block lg:bottom-[22%] lg:left-0"
          style={{ '--stair-delay': '2300ms' } as React.CSSProperties}
        >
          <p className="font-ui-mono text-[11px] uppercase tracking-[0.18em] text-achievement-hover">Today · Day 01</p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-text">Write the one-sentence version of your goal.</p>
          <p className="mt-3 flex items-center gap-2 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-achievement" />
            15 min · then you're done
          </p>
        </div>
      </div>
    </div>
  </section>
);
