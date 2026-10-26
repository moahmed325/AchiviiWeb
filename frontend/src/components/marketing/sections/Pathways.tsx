import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PATHWAY_GROUPS, type CertifiedPathway } from '../../../lib/certifiedPresets';
import { Section, Eyebrow, HEADING } from '../Section';

/** The shared groups (OD-11), largest first so the three-column grid stays balanced. */
const GROUPS = [...PATHWAY_GROUPS].sort((a, b) => b.pathways.length - a.pathways.length);

const PathwayRow: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link
      to={`/signup?pathway=${encodeURIComponent(pathway.id)}`}
      className="focus-ring group flex min-h-11 w-full items-start justify-between gap-4 border-t border-border py-4 text-left transition-colors hover:border-achievement/50"
    >
      <span>
        <span className="block text-body font-medium text-text transition-colors group-hover:text-achievement-hover">
          {pathway.title}
        </span>
        <span className="mt-1 block text-small text-text-secondary">{pathway.summary}</span>
        <span className="mt-2 block text-small text-text-muted">
          <span className="tabular">{pathway.dailyMinutes} min a day</span> · Built on {pathway.badge}
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={1.5}
        className="mt-0.5 size-5 shrink-0 text-text-muted transition-colors group-hover:text-achievement"
      />
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
      Not sure yet? Look through these. Each one is a complete 90-day plan, and all of them are free. Pick one to create
      your account and start.
    </p>

    <div className="mt-12 grid gap-x-12 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
      {GROUPS.map((group) => (
        <div key={group.direction}>
          <h3 className="mb-2 font-ui-mono text-micro uppercase text-achievement">{group.direction}</h3>
          <ul>
            {group.pathways.map((pathway) => (
              <PathwayRow key={pathway.id} pathway={pathway} />
            ))}
          </ul>
        </div>
      ))}
    </div>

    <p className="mt-12 text-body text-text-secondary">
      Have a different goal in mind?{' '}
      <Link
        to="/signup?premium=1"
        className="focus-ring inline-flex items-center gap-1.5 text-achievement-hover underline decoration-achievement/40 underline-offset-4 hover:decoration-achievement"
      >
        Pro builds a plan around your own
        <ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />
      </Link>
    </p>
  </Section>
);
