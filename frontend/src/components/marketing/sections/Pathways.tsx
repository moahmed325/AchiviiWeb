import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { PATHWAY_GROUPS, type CertifiedPathway } from '../../../lib/certifiedPresets';
import { Section, Eyebrow } from '../Section';
import { Reveal } from '../Reveal';

/** The shared groups (OD-11), largest first so the three-column grid stays balanced. */
const GROUPS = [...PATHWAY_GROUPS].sort((a, b) => b.pathways.length - a.pathways.length);

const PathwayRow: React.FC<{ pathway: CertifiedPathway }> = ({ pathway }) => (
  <li>
    <Link
      to={`/signup?pathway=${encodeURIComponent(pathway.id)}`}
      className="group flex min-h-11 w-full items-start justify-between gap-4 border-t border-border py-5 text-left transition-colors hover:border-border-strong"
    >
      <span>
        <span className="block text-[17px] font-medium leading-snug tracking-[-0.015em] text-text transition-colors group-hover:text-accent-hover">
          {pathway.title}
        </span>
        <span className="mt-1.5 block text-sm leading-relaxed text-text-secondary">{pathway.summary}</span>
        <span className="tabular mt-3 block font-ui-mono text-[11px] uppercase tracking-[0.16em] text-text-secondary/80">
          {pathway.dailyMinutes} min a day
        </span>
      </span>
      <ArrowUpRight
        aria-hidden="true"
        strokeWidth={1.5}
        className="mt-0.5 h-5 w-5 shrink-0 text-text-muted transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text"
      />
    </Link>
  </li>
);

export const Pathways: React.FC = () => (
  <Section id="pathways" labelledBy="pathways-title" className="py-28 sm:py-40">
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Reveal>
          <Eyebrow tone="accent">Guided pathways</Eyebrow>
        </Reveal>
        <Reveal as="h2" id="pathways-title" delayMs={80} className="mt-8 text-[clamp(2.25rem,4.6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-text">
          Ten journeys, ready to begin.
        </Reveal>
      </div>
      <Reveal as="p" delayMs={160} className="text-lg leading-relaxed text-text-secondary lg:col-span-5 lg:pt-20">
        Each pathway is built on a proven method for its field and shaped around your schedule when you start. Pick
        one to create your account and begin.
      </Reveal>
    </div>

    <div className="mt-20 grid gap-x-10 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
      {GROUPS.map((group, groupIndex) => (
        <Reveal key={group.direction} delayMs={(groupIndex % 3) * 100}>
          <h3 className="mb-2 font-ui-mono text-xs uppercase tracking-[0.2em] text-text-secondary">{group.direction}</h3>
          <ul>
            {group.pathways.map((pathway) => (
              <PathwayRow key={pathway.id} pathway={pathway} />
            ))}
          </ul>
        </Reveal>
      ))}
    </div>
  </Section>
);
