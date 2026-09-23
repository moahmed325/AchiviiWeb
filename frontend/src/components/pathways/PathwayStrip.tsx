import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, IconButton, Surface, cx } from '../ui';
import { PATHWAY_GROUPS, type CertifiedPathway } from '../../lib/certifiedPresets';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ORDERED_PATHWAYS = PATHWAY_GROUPS.flatMap((group) => group.pathways);

interface PathwayTileProps {
  pathway: CertifiedPathway;
  isCurrent: boolean;
  onOpen: (pathway: CertifiedPathway) => void;
}

/** One pathway as a single button (nothing interactive inside it). It opens the library with the pathway selected. */
const PathwayTile: React.FC<PathwayTileProps> = ({ pathway, isCurrent, onOpen }) => {
  const id = useId();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={[isCurrent && `${id}-current`, `${id}-summary`, `${id}-meta`].filter(Boolean).join(' ')}
      onClick={() => onOpen(pathway)}
      className={cx(
        'focus-ring flex w-full cursor-pointer flex-col items-start gap-2 rounded-card border bg-background p-4 text-left',
        'transition-colors duration-(--duration-quick)',
        isCurrent ? 'border-accent' : 'border-border hover:border-border-strong',
      )}
    >
      <span className="flex min-h-7 w-full items-center justify-between gap-2">
        <span className="font-ui-mono text-micro uppercase text-text-secondary">{pathway.direction}</span>
        {isCurrent && (
          <Badge id={`${id}-current`} tone="accent">
            Current
          </Badge>
        )}
      </span>
      <span id={`${id}-title`} className="text-body font-medium leading-snug text-text">
        {pathway.title}
      </span>
      <span id={`${id}-summary`} className="text-small text-text-secondary">
        {pathway.summary}
      </span>
      <span id={`${id}-meta`} className="tabular mt-auto pt-1 font-ui-mono text-micro uppercase text-text-secondary">
        {pathway.dailyMinutes} min a day
      </span>
    </button>
  );
};

export interface PathwayStripProps {
  /** The active goal's pathway, marked "Current". */
  currentId?: string;
  /** A tile was chosen; the screen opens the library with it selected. */
  onOpen: (pathway: CertifiedPathway) => void;
  onExploreAll: () => void;
  className?: string;
}

/**
 * The compact form of the pathway library, for screens that already have a goal: every pathway in a swipeable row,
 * with buttons to scroll it. Choosing still happens in the library, so switching always ends at the same action.
 */
export const PathwayStrip: React.FC<PathwayStripProps> = ({ currentId, onOpen, onExploreAll, className }) => {
  const headingId = useId();
  const scroller = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const readEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ atStart: el.scrollLeft <= 1, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => readEdges());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <Surface as="section" aria-labelledby={headingId} className={cx('ui-root min-w-0', className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-xl">
          <h2 id={headingId} className="text-h3 text-text">
            Pathways
          </h2>
          <p className="mt-1 text-small text-text-secondary">Explore the other guided 90-day journeys, or switch when you're ready.</p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            label="Scroll pathways back"
            icon={<ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            disabled={edges.atStart}
            onClick={() => scrollBy(-1)}
          />
          <IconButton
            label="Scroll pathways forward"
            icon={<ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            disabled={edges.atEnd}
            onClick={() => scrollBy(1)}
          />
          <Button variant="secondary" size="sm" onClick={onExploreAll} aria-haspopup="dialog" className="ml-2">
            Explore all
          </Button>
        </div>
      </div>

      {/* The padding keeps each tile's focus ring inside the scroll area, which would otherwise clip it. */}
      <ul
        ref={scroller}
        onScroll={readEdges}
        className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto overscroll-x-contain px-5 py-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {ORDERED_PATHWAYS.map((pathway) => (
          <li key={pathway.id} className="flex w-64 shrink-0 snap-start">
            <PathwayTile pathway={pathway} isCurrent={pathway.id === currentId} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </Surface>
  );
};
