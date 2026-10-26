import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS, PATHWAY_GROUPS, type CertifiedPathway } from '../../../lib/certifiedPresets';
import { Section, Eyebrow, HEADING } from '../Section';

const signupLink = (pathway: CertifiedPathway) => `/signup?pathway=${encodeURIComponent(pathway.id)}`;

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

const PathwayRow: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link
      to={signupLink(pathway)}
      className="focus-ring group flex min-h-11 items-baseline justify-between gap-4 border-t border-border py-3 transition-colors hover:border-border-strong"
    >
      <span className="text-body text-text transition-colors group-hover:text-achievement-hover">{pathway.title}</span>
      <span className="tabular shrink-0 text-small text-text-secondary">{pathway.dailyMinutes} min</span>
    </Link>
  </li>
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

    <details className="group/all mt-12">
      <summary className="focus-ring inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border-strong px-5 text-body text-text transition-colors hover:bg-text/[0.04] [&::-webkit-details-marker]:hidden">
        <span className="group-open/all:hidden">See all {CERTIFIED_PATHWAYS.length} goals</span>
        <span className="hidden group-open/all:inline">Show fewer</span>
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1.5}
          className="size-4 text-text-secondary transition-transform duration-300 group-open/all:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="mt-8 grid gap-x-12 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
        {PATHWAY_GROUPS.map((group) => (
          <div key={group.direction}>
            <h3 className="mb-2 text-small text-text-secondary">{group.direction}</h3>
            <ul>
              {group.pathways.map((pathway) => (
                <PathwayRow key={pathway.id} pathway={pathway} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>

    <p className="mt-12 text-body text-text-secondary">
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
