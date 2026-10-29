import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, IconButton } from '../ui';
import { PlanPreviewDialog } from './PlanPreviewDialog';
import { CERTIFIED_PATHWAYS, FEATURED_PATHWAYS, PATHWAY_ARCS, type CertifiedPathway } from '../../lib/certifiedPresets';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Featured first, so the first cards a visitor sees span four directions; then the rest in catalogue order. */
const ORDERED = [...FEATURED_PATHWAYS, ...CERTIFIED_PATHWAYS.filter((p) => !FEATURED_PATHWAYS.includes(p))];

const TIME_FILTERS = [
  { label: 'Any time', max: Infinity },
  { label: '30 min or less', max: 30 },
  { label: '45 min or less', max: 45 },
];

/** Opens the plan preview for its goal. */
const GoalCard: React.FC<{ pathway: CertifiedPathway; onOpen: (pathway: CertifiedPathway) => void }> = ({ pathway, onOpen }) => {
  const arc = PATHWAY_ARCS[pathway.id];
  return (
    <button
      type="button"
      onClick={() => onOpen(pathway)}
      aria-haspopup="dialog"
      className="focus-ring group block w-full cursor-pointer rounded-card text-left"
    >
      <span className="relative block overflow-hidden rounded-card bg-surface">
        <img
          src={pathway.image}
          alt=""
          width={400}
          height={500}
          loading="lazy"
          decoding="async"
          className="aspect-[4/5] w-full object-cover saturate-[.85] transition-[filter,transform] duration-500 ease-ascend group-hover:scale-[1.02] group-hover:saturate-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span className="tabular absolute left-3 top-3 rounded-full bg-background/75 px-2.5 py-1 text-small text-text backdrop-blur-sm">
          {pathway.dailyMinutes} min a day
        </span>
        {arc && (
          <span className="absolute inset-x-2.5 bottom-2.5 rounded-card border border-border-strong bg-background/90 p-3.5 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
            <span className="block text-small text-text-secondary">A session in week 1</span>
            <span className="mt-1 block text-body font-medium text-text">{arc.weekOneSession}</span>
          </span>
        )}
      </span>
      <span className="mt-3.5 block text-body font-medium text-text transition-colors group-hover:text-achievement-hover">
        {pathway.title}
      </span>
      {arc && (
        <span className="mt-3 grid gap-2 border-l border-border-strong pl-3.5 text-small">
          <span className="block text-text-secondary">
            <span className="block">Day 1</span>
            {arc.dayOne}
          </span>
          <span className="block text-text">
            <span className="block text-achievement-hover">Day 90 goal</span>
            {arc.dayNinety}
          </span>
        </span>
      )}
    </button>
  );
};

/**
 * Every free pathway as one swipeable row of photo cards, each showing where the plan starts and what it aims for,
 * with a daily-time filter for the visitor who thinks they are too busy. Arrows scroll the row on wider screens.
 * A card opens the plan preview: two questions, then the shape of that visitor's 90 days, then sign-up.
 */
export const GoalRail: React.FC = () => {
  const railId = useId();
  const scroller = useRef<HTMLUListElement>(null);
  const [maxMinutes, setMaxMinutes] = useState(Infinity);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  // The opened goal stays set while the dialog closes, so its closing animation has content; `opens` remounts the
  // preview for each opening, so it always starts at the first question.
  const [preview, setPreview] = useState<{ pathway: CertifiedPathway; open: boolean; opens: number } | null>(null);
  const openPreview = (pathway: CertifiedPathway) => setPreview((prev) => ({ pathway, open: true, opens: (prev?.opens ?? 0) + 1 }));
  const shown = ORDERED.filter((p) => p.dailyMinutes <= maxMinutes);

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

  // A new filter starts the row from its first card.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = 0;
    readEdges();
  }, [maxMinutes]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scroller.current;
    el?.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <div role="group" aria-label="Daily time" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TIME_FILTERS.map((filter) => {
            const active = filter.max === maxMinutes;
            return (
              <button
                key={filter.label}
                type="button"
                aria-pressed={active}
                onClick={() => setMaxMinutes(filter.max)}
                className={`focus-ring inline-flex min-h-11 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full border px-4 text-small transition-colors ${
                  active ? 'border-text bg-text text-background' : 'border-border-strong text-text-secondary hover:text-text'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="hidden shrink-0 items-center gap-1 md:flex">
          <IconButton
            variant="secondary"
            label="Scroll goals back"
            aria-controls={railId}
            icon={<ChevronLeft aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            disabled={edges.atStart}
            onClick={() => scrollBy(-1)}
          />
          <IconButton
            variant="secondary"
            label="Scroll goals forward"
            aria-controls={railId}
            icon={<ChevronRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
            disabled={edges.atEnd}
            onClick={() => scrollBy(1)}
          />
        </div>
      </div>

      <p role="status" className="sr-only">
        {shown.length} goals shown
      </p>

      {/* The padding keeps each card's focus ring inside the scroll area, which would otherwise clip it. */}
      <ul
        id={railId}
        ref={scroller}
        onScroll={readEdges}
        aria-label="Free goals"
        className={`-mx-1 mt-6 flex snap-x snap-mandatory scroll-px-1 gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          edges.atEnd ? '' : '[mask-image:linear-gradient(to_right,black_88%,transparent)]'
        }`}
      >
        {shown.map((pathway) => (
          <li key={pathway.id} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-[calc((100%-3rem)/3.6)]">
            <GoalCard pathway={pathway} onOpen={openPreview} />
          </li>
        ))}
      </ul>

      <Dialog open={preview?.open ?? false} onOpenChange={(open) => setPreview((prev) => (prev ? { ...prev, open } : prev))}>
        {preview && <PlanPreviewDialog key={preview.opens} pathway={preview.pathway} />}
      </Dialog>
    </div>
  );
};
