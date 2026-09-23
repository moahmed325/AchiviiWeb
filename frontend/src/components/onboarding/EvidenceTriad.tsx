import React from 'react';
import type { EvidencePillar, EvidenceTriad as EvidenceTriadData } from '../../types';

const Pillar: React.FC<{ pillar: EvidencePillar; fallbackTag: string }> = ({ pillar, fallbackTag }) => (
  <li className="flex flex-col gap-2 rounded-card border border-border p-4">
    <p className="font-ui-mono text-micro uppercase text-text-secondary">{pillar.tag || fallbackTag}</p>
    <p className="text-body font-medium text-text">{pillar.title}</p>
    {pillar.subtitle && <p className="text-small text-text-secondary">{pillar.subtitle}</p>}
    <p className="text-small text-text">{pillar.coreRule}</p>
    <p className="mt-auto border-t border-border pt-3 text-small text-text-secondary">
      <span className="text-text">In your path: </span>
      {pillar.realWorldApplication}
    </p>
  </li>
);

/** Certified pathways only: the science, adherence and coaching behind the plan. */
export const EvidenceTriad: React.FC<{ triad: EvidenceTriadData }> = ({ triad }) => (
  <ul className="grid gap-3 md:grid-cols-3">
    <Pillar pillar={triad.science} fallbackTag="Science" />
    <Pillar pillar={triad.socialAdherence} fallbackTag="Real-life adherence" />
    <Pillar pillar={triad.proCoaching} fallbackTag="Coaching craft" />
  </ul>
);
