import { useState } from 'react';
import {
  PATHWAY_GROUPS,
  findPathwayBySlug,
  pathwaysInDirection,
  type CertifiedPathway,
  type PathwayDirection,
} from '../../lib/certifiedPresets';

/**
 * The pathway selected once `direction` is shown: its only pathway when it has one (OD-11), otherwise the current
 * selection if it belongs there, otherwise none.
 */
export function selectionForDirection(direction: PathwayDirection | undefined, selectedId: string | undefined): string | undefined {
  const pathways = pathwaysInDirection(direction);
  if (pathways.length === 1) return pathways[0].id;
  return pathways.find((p) => p.id === selectedId)?.id;
}

export interface PathwaySelectionOptions {
  /** Selected at first, and its direction shown. */
  initialId?: string;
  /** The active goal's pathway; its direction is shown first when nothing is selected. */
  currentId?: string;
  /** Show the first direction when neither pathway gives one, so a tabbed library never opens empty. */
  startOnFirstDirection?: boolean;
}

export interface PathwaySelection {
  direction: PathwayDirection | undefined;
  selectedId: string | undefined;
  selected: CertifiedPathway | undefined;
  chooseDirection: (direction: PathwayDirection) => void;
  select: (id: string) => void;
}

export function usePathwaySelection({ initialId, currentId, startOnFirstDirection = false }: PathwaySelectionOptions = {}): PathwaySelection {
  const [state, setState] = useState(() => {
    const initial = findPathwayBySlug(initialId);
    const direction =
      initial?.direction ?? findPathwayBySlug(currentId)?.direction ?? (startOnFirstDirection ? PATHWAY_GROUPS[0]?.direction : undefined);
    return { direction, selectedId: initial?.id ?? selectionForDirection(direction, undefined) };
  });

  return {
    ...state,
    selected: findPathwayBySlug(state.selectedId),
    chooseDirection: (direction) => setState((prev) => ({ direction, selectedId: selectionForDirection(direction, prev.selectedId) })),
    select: (id) => setState((prev) => ({ ...prev, selectedId: id })),
  };
}
