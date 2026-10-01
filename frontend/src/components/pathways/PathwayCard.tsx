import React, { useId } from 'react';
import { Check, Clock } from 'lucide-react';
import { Badge } from '../ui';
import type { CertifiedPathway } from '../../lib/certifiedPresets';

export interface PathwayCardProps {
  pathway: CertifiedPathway;
  /** The radio group's name, shared by every card of a direction. */
  name: string;
  checked: boolean;
  /** The active goal's pathway: marked "Current pathway" in words, not colour alone. */
  isCurrent: boolean;
  onSelect: (id: string) => void;
}

/**
 * One pathway as a radio card. It is a native radio inside a label, so keyboard, forms and screen readers behave
 * natively: the title is the name, and the description reads "Current pathway" first (when it is), then the summary,
 * the methods it is built on and the daily time. Choosing it raises a gold rail up the card (see `.pathway-card`).
 */
export const PathwayCard: React.FC<PathwayCardProps> = ({ pathway, name, checked, isCurrent, onSelect }) => {
  const id = useId();
  const describedBy = [isCurrent && `${id}-current`, `${id}-summary`, `${id}-meta`].filter(Boolean).join(' ');

  return (
    <label className="pathway-card flex items-start gap-4">
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={pathway.id}
        checked={checked}
        onChange={() => onSelect(pathway.id)}
        aria-labelledby={`${id}-title`}
        aria-describedby={describedBy}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        {isCurrent && (
          <Badge id={`${id}-current`} tone="achievement" className="self-start" icon={<span aria-hidden="true">&#10022;</span>}>
            Current pathway
          </Badge>
        )}
        <span className="flex flex-col gap-1.5">
          <span id={`${id}-title`} className="text-body-lg font-medium leading-snug text-text">
            {pathway.title}
          </span>
          <span id={`${id}-summary`} className="text-small text-text-secondary">
            <span className="block">{pathway.summary}</span>
            <span className="mt-2 block text-micro">Built on {pathway.badge}</span>
          </span>
        </span>
        <span
          id={`${id}-meta`}
          className="tabular mt-1 flex items-center gap-2 border-t border-border pt-3 font-ui-mono text-micro uppercase text-text-secondary"
        >
          <Clock aria-hidden="true" strokeWidth={1.5} className="size-3.5 shrink-0" />
          <span>
            <span className="text-achievement">{pathway.dailyMinutes}</span> min a day &middot; 90 days
          </span>
        </span>
      </span>
      <span aria-hidden="true" className="pathway-card__mark">
        <Check strokeWidth={2.5} className="size-3.5" />
      </span>
    </label>
  );
};
