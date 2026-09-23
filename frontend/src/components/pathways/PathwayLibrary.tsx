import React, { useRef } from 'react';
import { Activity, ArrowRight, BookOpen, Briefcase, Compass, Palette, TrendingUp } from 'lucide-react';
import { Badge, Button, ChoiceCard, ChoiceGroup, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui';
import { PATHWAY_GROUPS, pathwaysInDirection, type CertifiedPathway, type PathwayDirection } from '../../lib/certifiedPresets';
import { usePathwaySelection, type PathwaySelection } from './usePathwaySelection';

const iconProps = { 'aria-hidden': true, strokeWidth: 1.5, className: 'size-5' } as const;

const DIRECTION_ICON: Record<PathwayDirection, React.ReactNode> = {
  Career: <Briefcase {...iconProps} />,
  Fitness: <Activity {...iconProps} />,
  Learning: <BookOpen {...iconProps} />,
  Creative: <Palette {...iconProps} />,
  Business: <TrendingUp {...iconProps} />,
  Personal: <Compass {...iconProps} />,
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const countLabel = (count: number) => `${count} ${count === 1 ? 'pathway' : 'pathways'}`;

interface PathwayChoicesProps {
  direction: PathwayDirection;
  selection: PathwaySelection;
  currentId?: string;
  hideLegend?: boolean;
}

/** One direction's pathways as a radio group: the selected card carries the outline, the filled marker and `checked`. */
const PathwayChoices: React.FC<PathwayChoicesProps> = ({ direction, selection, currentId, hideLegend }) => {
  const pathways = pathwaysInDirection(direction);
  const name = direction.toLowerCase();
  return (
    <ChoiceGroup
      legend={pathways.length === 1 ? `The ${name} pathway` : `Choose a ${name} pathway`}
      hideLegend={hideLegend}
      value={selection.selectedId}
      onChange={selection.select}
    >
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
          meta={`${p.dailyMinutes} min a day · 90 days`}
        />
      ))}
    </ChoiceGroup>
  );
};

export interface PathwayLibraryAction {
  label: string;
  onChoose: (pathway: CertifiedPathway) => void;
}

export interface PathwayLibraryProps {
  /**
   * `cards`: choose a direction, then its pathways appear beneath it (the "direction first" moment, BP §28).
   * `tabs`: a compact direction bar with one panel each, for dialogs.
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
          <TabsList aria-label="Directions">
            {PATHWAY_GROUPS.map((group) => (
              <TabsTrigger key={group.direction} value={group.direction}>
                {group.direction}
              </TabsTrigger>
            ))}
          </TabsList>
          {PATHWAY_GROUPS.map((group) => (
            <TabsContent key={group.direction} value={group.direction}>
              <PathwayChoices direction={group.direction} selection={selection} currentId={currentId} hideLegend />
            </TabsContent>
          ))}
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
              icon={DIRECTION_ICON[group.direction]}
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
