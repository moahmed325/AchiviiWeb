import React from 'react';
import { Button } from '../Button';
import { Eyebrow } from '../Section';
import { StaircaseScene } from '../StaircaseScene';

export const Hero: React.FC = () => (
  <section
    id="top"
    aria-labelledby="hero-title"
    className="relative isolate overflow-hidden px-6 sm:px-10 lg:px-16 pt-28 sm:pt-32 lg:pt-0 lg:min-h-[100svh]"
  >
    <div className="mx-auto grid w-full max-w-[1280px] items-center gap-4 lg:min-h-[100svh] lg:grid-cols-12 lg:gap-8">
      <div className="relative z-10 lg:col-span-6 lg:py-32">
        <Eyebrow tone="accent" className="reveal is-visible">
          A 90-day system for one meaningful goal
        </Eyebrow>
        <h1
          id="hero-title"
          className="mt-7 max-w-[11ch] text-[clamp(3rem,7.4vw,6.25rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-text"
        >
          Your ambition deserves a path.
        </h1>
        <p className="mt-7 max-w-[34rem] text-[clamp(1.05rem,1.4vw,1.2rem)] leading-relaxed text-text-secondary">
          Achivii turns what you want into a 90-day journey with phases, milestones and one focused step every day,
          fitted around the hours you actually have.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" withArrow to="/signup">
            Start your journey
          </Button>
          <Button size="lg" variant="secondary" href="#method">
            See how it works
          </Button>
        </div>
        <p className="mt-8 font-ui-mono text-[12px] uppercase tracking-[0.18em] text-text-secondary/80">
          Free to start <span aria-hidden="true" className="mx-2 text-text-muted">/</span> 10 guided pathways
        </p>
      </div>

      <div className="relative -mx-6 sm:-mx-10 lg:mx-0 lg:col-span-6 lg:h-[100svh]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_60%_20%,rgba(245,235,214,0.07),transparent_70%)]" />
        <StaircaseScene className="mx-auto h-[62svh] max-h-[640px] w-full sm:h-[70svh] lg:h-full lg:max-h-none" />

        <div
          aria-hidden="true"
          className="stair-piece absolute bottom-[14%] left-6 hidden w-[250px] rounded-panel border border-border-strong bg-background/70 p-4 backdrop-blur-md sm:block lg:bottom-[22%] lg:left-0"
          style={{ '--stair-delay': '2300ms' } as React.CSSProperties}
        >
          <p className="font-ui-mono text-[11px] uppercase tracking-[0.18em] text-accent-hover">Today · Day 01</p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-text">Write the one-sentence version of your goal.</p>
          <p className="mt-3 flex items-center gap-2 font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-hover" />
            15 min · then you're done
          </p>
        </div>
      </div>
    </div>
  </section>
);
