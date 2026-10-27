import React from 'react';
import { Link } from 'react-router-dom';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS, type CertifiedPathway } from '../../../lib/certifiedPresets';
import { Button } from '../Button';
import { Section, Eyebrow, HEADING } from '../Section';

const signupLink = (pathway: CertifiedPathway) => `/signup?pathway=${encodeURIComponent(pathway.id)}`;

const MORE_PATHWAYS = CERTIFIED_PATHWAYS.filter((p) => !FEATURED_PATHWAYS.includes(p));

/** Goals people could bring to Pro. Illustrations only, never presented as other people's plans. */
const OWN_GOAL_EXAMPLES = [
  'Swim 1 km without stopping',
  'Pass my driving theory test',
  'Learn the basics of Python',
  'Sketch a portrait from life',
];

const PathwayCard: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link to={signupLink(pathway)} className="focus-ring group block rounded-card">
      <span className="block overflow-hidden rounded-card bg-surface">
        <img
          src={pathway.image}
          alt=""
          width={400}
          height={500}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full object-cover saturate-[.85] transition-[filter,transform] duration-500 ease-ascend group-hover:scale-[1.02] group-hover:saturate-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </span>
      <span className="mt-3 block text-body font-medium text-text transition-colors group-hover:text-achievement-hover">
        {pathway.title}
      </span>
      <span className="tabular mt-1 block text-small text-text-secondary">{pathway.dailyMinutes} min a day</span>
    </Link>
  </li>
);

const PathwayChip: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link
      to={signupLink(pathway)}
      className="focus-ring inline-flex min-h-11 items-center gap-x-2 rounded-panel border border-border-strong px-4 py-2 sm:rounded-full text-left text-small text-text transition-colors hover:border-text/40 hover:bg-text/[0.04]"
    >
      {pathway.title}
      <span className="tabular whitespace-nowrap text-text-secondary">· {pathway.dailyMinutes} min</span>
    </Link>
  </li>
);

/** The case for a goal of your own (Pro): a still picture of the goal box with examples, so a visitor imagines theirs. */
const OwnGoal: React.FC = () => (
  <div className="mt-16 grid items-center gap-10 rounded-panel border border-border-strong bg-surface p-7 sm:p-10 lg:grid-cols-12 lg:gap-12">
    <div className="lg:col-span-6">
      <p className="text-small text-achievement-hover">Achivii Pro</p>
      <h3 className="mt-3 text-balance text-h2 text-text">Or bring your own goal.</h3>
      <p className="mt-4 max-w-[30rem] text-body-lg text-text-secondary">
        Describe anything you want to get good at. Achivii asks a few questions, then builds a 90-day plan around it,
        with one step a day sized to your time and a weekly review that keeps it on track.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Button size="lg" variant="gold" withArrow to="/signup?premium=1" className="self-start">
          Build my own plan
        </Button>
        <p className="text-small text-text-secondary">$9 a month or $72 a year</p>
      </div>
    </div>

    <figure className="lg:col-span-6">
      <div aria-hidden="true" className="rounded-card border border-border-strong bg-background p-5 sm:p-6">
        <p className="text-small text-text-secondary">What do you want to get good at?</p>
        <p className="mt-3 border-b border-border-control pb-3 text-h3 text-text">
          {OWN_GOAL_EXAMPLES[0]}
          <span className="ml-1 inline-block h-[1.1em] w-px translate-y-[0.15em] bg-achievement" />
        </p>
      </div>
      <figcaption className="mt-5">
        <p className="text-small text-text-secondary">For example</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {OWN_GOAL_EXAMPLES.slice(1).map((example) => (
            <li key={example} className="rounded-full border border-border px-3 py-1.5 text-small text-text-secondary">
              {example}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  </div>
);

export const Pathways: React.FC = () => (
  <Section id="goals" labelledBy="goals-title">
    <Eyebrow>Goals</Eyebrow>
    <h2 id="goals-title" className={`mt-4 ${HEADING}`}>
      What do you want to get good at?
    </h2>
    <p className="mt-4 max-w-[36rem] text-body-lg text-text-secondary">
      Not sure yet? Start with one of these. Each is a complete 90-day plan, and all of them are free.
    </p>

    <ul aria-label="Popular goals" className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
      {FEATURED_PATHWAYS.map((pathway) => (
        <PathwayCard key={pathway.id} pathway={pathway} />
      ))}
    </ul>

    <p className="mt-12 text-small text-text-secondary">More free goals</p>
    <ul aria-label="More free goals" className="mt-3 flex flex-wrap gap-2">
      {MORE_PATHWAYS.map((pathway) => (
        <PathwayChip key={pathway.id} pathway={pathway} />
      ))}
    </ul>

    <OwnGoal />
  </Section>
);
