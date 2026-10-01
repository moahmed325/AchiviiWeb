import React, { useId, useRef } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { Activity, ArrowRight, BookOpen, Briefcase, Compass, Palette, TrendingUp, type LucideIcon } from 'lucide-react';
import { Badge, Button, ChoiceCard, ChoiceGroup, Tabs, TabsContent } from '../ui';
import { PATHWAY_GROUPS, pathwaysInDirection, type CertifiedPathway, type PathwayDirection } from '../../lib/certifiedPresets';
import { PathwayAscent } from './PathwayAscent';
import { PathwayCard } from './PathwayCard';
import { usePathwaySelection, type PathwaySelection } from './usePathwaySelection';

const DIRECTION_ICONS: Record<PathwayDirection, LucideIcon> = {
  Career: Briefcase,
  Fitness: Activity,
  Learning: BookOpen,
  Creative: Palette,
  Business: TrendingUp,
  Personal: Compass,
};

const DirectionIcon: React.FC<{ direction: PathwayDirection; className?: string }> = ({ direction, className = 'size-5' }) => {
  const Icon = DIRECTION_ICONS[direction];
  return <Icon aria-hidden="true" strokeWidth={1.5} className={className} />;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const countLabel = (count: number) => `${count} ${count === 1 ? 'pathway' : 'pathways'}`;

interface PathwayChoicesProps {
  direction: PathwayDirection;
  selection: PathwaySelection;
  currentId?: string;
  hideLegend?: boolean;
  /** The gold pathway cards, for the dialog. Without it, the plain choice cards used on Home and in onboarding. */
  premium?: boolean;
}

/** One direction's pathways as a radio group: the selected card carries the outline, the filled marker and `checked`. */
const PathwayChoices: React.FC<PathwayChoicesProps> = ({ direction, selection, currentId, hideLegend, premium }) => {
  const groupName = useId();
  const pathways = pathwaysInDirection(direction);
  const name = direction.toLowerCase();
  const legend = pathways.length === 1 ? `The ${name} pathway` : `Choose a ${name} pathway`;

  if (premium) {
    return (
      <fieldset className="min-w-0">
        <legend className="sr-only">{legend}</legend>
        <div className="grid gap-3">
          {pathways.map((p) => (
            <PathwayCard
              key={p.id}
              pathway={p}
              name={groupName}
              checked={selection.selectedId === p.id}
              isCurrent={p.id === currentId}
              onSelect={selection.select}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <ChoiceGroup legend={legend} hideLegend={hideLegend} value={selection.selectedId} onChange={selection.select}>
      {pathways.map((p) => (
        <ChoiceCard
          key={p.id}
          value={p.id}
          title={p.title}
          description={
            <>
              {p.id === currentId && (
                <Badge tone="accent" className="mb-2">
                  Current pathway
                </Badge>
              )}
              <span className="block">{p.summary}</span>
              <span className="mt-1.5 block">Built on {p.badge}</span>
            </>
          }
          meta={`${p.dailyMinutes} min a day \u00b7 90 days`}
        />
      ))}
    </ChoiceGroup>
  );
};

/** Direction tabs: a hairline with the active direction lit from beneath by a gold line (see `.pathway-tab`). */
const directionTab =
  'pathway-tab focus-ring-inset -mb-px inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 px-3.5 text-small font-medium ' +
  'text-text-secondary transition-colors duration-(--duration-quick) hover:text-text data-[state=active]:text-text';

export interface PathwayLibraryAction {
  label: string;
  onChoose: (pathway: CertifiedPathway) => void;
}

export interface PathwayLibraryProps {
  /**
   * `cards`: choose a direction, then its pathways appear beneath it (the "direction first" moment, BP §28).
   * `tabs`: a compact direction bar with one panel each, for dialogs. Each panel pairs its pathways with the
   * chosen pathway's ascent: where it ends and how the twelve weeks climb there.
   */
  navigation?: 'cards' | 'tabs';
  /** Selected at first when the library owns its selection. */
  defaultSelectedId?: string;
  /** Pass a selection from `usePathwaySelection` when the parent renders the action itself (a dialog footer). */
  selection?: PathwaySelection;
  /** The active goal's pathway, marked "Current pathway". */
  currentId?: string;
  /** The primary action beneath the pathways. What it does is up to the screen. */
  action?: PathwayLibraryAction;
  /** A goal of the user's own (ND-6): shown after the pathways, never locked. */
  customGoal?: React.ReactNode;
  className?: string;
}

/**
 * The one pathway library (ND-15): directions from the shared catalogue, then their pathways, then a single action.
 * A direction with one pathway selects it straight away (OD-11), and an empty direction is never shown.
 */
export const PathwayLibrary: React.FC<PathwayLibraryProps> = ({
  navigation = 'cards',
  defaultSelectedId,
  selection: parentSelection,
  currentId,
  action,
  customGoal,
  className,
}) => {
  const ownSelection = usePathwaySelection({ initialId: defaultSelectedId, currentId, startOnFirstDirection: navigation === 'tabs' });
  const selection = parentSelection ?? ownSelection;
  const { direction, selected } = selection;
  const pathwaysRef = useRef<HTMLDivElement>(null);
  const choseByPointer = useRef(false);

  const actionButton = action && (
    <Button
      size="lg"
      className="mt-6 w-full sm:w-auto"
      disabled={!selected}
      onClick={() => selected && action.onChoose(selected)}
      trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
    >
      {action.label}
    </Button>
  );

  if (navigation === 'tabs') {
    return (
      <div className={className}>
        <Tabs value={direction} onValueChange={(value) => selection.chooseDirection(value as PathwayDirection)}>
          <TabsPrimitive.List aria-label="Directions" className="pathway-tabs flex gap-1 overflow-x-auto border-b border-border">
            {PATHWAY_GROUPS.map((group) => (
              <TabsPrimitive.Trigger key={group.direction} value={group.direction} className={directionTab}>
                <DirectionIcon direction={group.direction} className="size-4" />
                {group.direction}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          {PATHWAY_GROUPS.map((group) => {
            const previewed = selected && selected.direction === group.direction ? selected : undefined;
            return (
              <TabsContent key={group.direction} value={group.direction}>
                <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
                  <PathwayChoices direction={group.direction} selection={selection} currentId={currentId} hideLegend premium />
                  <PathwayAscent key={previewed?.id ?? 'none'} pathway={previewed} className="lg:sticky lg:top-1" />
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
        {actionButton}
        {customGoal}
      </div>
    );
  }

  const chooseDirection = (value: string) => {
    selection.chooseDirection(value as PathwayDirection);
    if (choseByPointer.current) {
      choseByPointer.current = false;
      requestAnimationFrame(() =>
        pathwaysRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      );
    }
  };

  return (
    <div className={className}>
      <div onPointerDown={() => (choseByPointer.current = true)} onKeyDown={() => (choseByPointer.current = false)}>
        <ChoiceGroup legend="Choose a direction" value={direction} onChange={chooseDirection} columns={3}>
          {PATHWAY_GROUPS.map((group) => (
            <ChoiceCard
              key={group.direction}
              value={group.direction}
              title={group.direction}
              icon={<DirectionIcon direction={group.direction} />}
              meta={countLabel(group.pathways.length)}
            />
          ))}
        </ChoiceGroup>
      </div>

      <div ref={pathwaysRef} className="scroll-mt-24">
        {direction && (
          <div key={direction} className="mt-10 animate-rise-in">
            <PathwayChoices direction={direction} selection={selection} currentId={currentId} />
            {actionButton}
          </div>
        )}
      </div>

      {customGoal}
    </div>
  );
};
