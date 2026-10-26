import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { CERTIFIED_PATHWAYS, type CertifiedPathway } from '../../../lib/certifiedPresets';
import { Section, Eyebrow, HEADING } from '../Section';

const MINUTES = CERTIFIED_PATHWAYS.map((p) => p.dailyMinutes);

const PathwayCard: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link to={`/signup?pathway=${encodeURIComponent(pathway.id)}`} className="focus-ring group block rounded-card">
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

export const Pathways: React.FC = () => (
  <Section id="goals" labelledBy="goals-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>Goals</Eyebrow>
        <h2 id="goals-title" className={`mt-4 ${HEADING}`}>
          What do you want to get good at?
        </h2>
      </div>
      <p className="tabular text-small text-text-secondary">
        All free · {Math.min(...MINUTES)}–{Math.max(...MINUTES)} min a day
      </p>
    </div>
    <p className="mt-4 max-w-[36rem] text-body-lg text-text-secondary">
      Not sure yet? Look through these. Each one is a complete 90-day plan. Pick one to create your account and start.
    </p>

    <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-5">
      {CERTIFIED_PATHWAYS.map((pathway) => (
        <PathwayCard key={pathway.id} pathway={pathway} />
      ))}
    </ul>

    <p className="mt-14 text-body text-text-secondary">
      Have a different goal in mind?{' '}
      <Link
        to="/signup?premium=1"
        className="focus-ring inline-flex items-center gap-1.5 text-text underline decoration-border-strong underline-offset-4 transition-colors hover:decoration-text"
      >
        Pro builds a plan around your own
        <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </Link>
    </p>
  </Section>
);
