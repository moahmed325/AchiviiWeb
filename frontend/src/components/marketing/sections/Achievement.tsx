import React from 'react';
import { Eyebrow } from '../Section';
import { Reveal } from '../Reveal';
import { useInView } from '../hooks';

export const Achievement: React.FC = () => {
  const { ref, inView } = useInView<HTMLElement>({ threshold: 0.3 });

  return (
    <section
      ref={ref}
      id="achievement"
      aria-labelledby="achievement-title"
      className="relative isolate overflow-hidden px-6 py-32 sm:px-10 sm:py-44 lg:px-16"
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 transition-opacity duration-[2400ms] ease-out motion-reduce:transition-none ${
          inView ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(70% 55% at 50% 45%, rgba(200,169,107,0.16), rgba(127,165,139,0.06) 45%, transparent 75%)',
        }}
      />

      <div className="mx-auto grid w-full max-w-[1280px] items-center gap-16 lg:grid-cols-12 lg:gap-10">
        <div className="order-2 lg:order-1 lg:col-span-6">
          <Reveal>
            <Eyebrow tone="achievement">Day 90</Eyebrow>
          </Reveal>
          <Reveal
            as="h2"
            id="achievement-title"
            delayMs={100}
            className="mt-8 text-[clamp(2.5rem,5.4vw,4.75rem)] font-semibold leading-[1] tracking-[-0.045em] text-text"
          >
            90 days. One goal.
            <br />
            <span className="text-achievement">A different version of you.</span>
          </Reveal>
          <Reveal as="p" delayMs={200} className="mt-8 max-w-[30rem] text-lg leading-relaxed text-text-secondary">
            The staircase was never the point. It is how you get somewhere worth standing: a skill you can use, a thing you
            built, a body or a habit you earned one ordinary day at a time.
          </Reveal>
        </div>

        <Reveal as="figure" delayMs={150} className="order-1 mx-auto w-full max-w-[420px] lg:order-2 lg:col-span-5 lg:col-start-8">
          <div
            className={`relative aspect-[682/1024] overflow-hidden rounded-t-full border border-achievement/25 transition-[filter] duration-[2400ms] ease-out motion-reduce:transition-none ${
              inView ? 'brightness-100 saturate-100' : 'brightness-[0.35] saturate-[0.4]'
            }`}
          >
            <img
              src="/images/brand/garden.jpg"
              alt="A sunlit classical garden terrace with vine-covered columns, flowers and a green pool, overlooking clouds and a distant city at dusk."
              width={682}
              height={1024}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background/70 to-transparent" />
          </div>
        </Reveal>
      </div>
    </section>
  );
};
