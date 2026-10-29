import React from 'react';
import { Clock } from 'lucide-react';
import { CERTIFIED_PATHWAYS, PATHWAY_ARCS } from '../../lib/certifiedPresets';

const PATHWAY = CERTIFIED_PATHWAYS.find((p) => p.id === 'run10k')!;
const ARC = PATHWAY_ARCS[PATHWAY.id];

/**
 * The hero's picture of the product in three parts: a goal, where its 90 days start and end, and the one step for
 * today. It reads as "goal, then plan, then today" for a visitor who has never seen Achivii.
 */
export const GoalPreview: React.FC<{ className?: string }> = ({ className = '' }) => (
  <figure className={className}>
    <div
      role="img"
      aria-label={`Example plan. Goal: ${PATHWAY.label}. Day 1: ${ARC.dayOne}. Day 90: ${ARC.dayNinety}. Today, ${PATHWAY.dailyMinutes} minutes: ${ARC.weekOneSession}.`}
      className="rounded-panel border border-border-strong bg-surface p-6 shadow-raised sm:p-8"
    >
      <div aria-hidden="true">
        <p className="text-small text-text-secondary">Your goal</p>
        <p className="mt-2 text-h2 text-text">{PATHWAY.label}</p>

        <div className="mt-8">
          <div className="flex items-center">
            <span className="size-2.5 shrink-0 rounded-full bg-achievement" />
            <span className="h-px flex-1 bg-border-strong" />
            <span className="size-2.5 shrink-0 rounded-full border border-achievement" />
          </div>
          <div className="mt-3 flex justify-between gap-6 text-small">
            <p className="text-text-secondary">
              <span className="block text-text">Day 1</span>
              {ARC.dayOne}
            </p>
            <p className="text-right text-text-secondary">
              <span className="block text-achievement-hover">Day 90</span>
              {ARC.dayNinety}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-card border-l-2 border-achievement bg-background px-5 py-4">
          <p className="flex items-center gap-2 text-small text-text-secondary">
            Today
            <span aria-hidden="true">·</span>
            <Clock className="size-4" strokeWidth={1.5} />
            <span className="tabular">{PATHWAY.dailyMinutes} min</span>
          </p>
          <p className="mt-2 text-body-lg font-medium text-text">{ARC.weekOneSession}</p>
          <p className="mt-1 text-small text-text-secondary">An easy run, slow enough to talk the whole way.</p>
        </div>
      </div>
    </div>
    <figcaption className="mt-3 text-center text-small text-text-secondary">Example from the 10K plan</figcaption>
  </figure>
);
