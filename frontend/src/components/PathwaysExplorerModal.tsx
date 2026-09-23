import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent } from './ui';
import { findPathwayByTitle } from '../lib/certifiedPresets';
import { PathwayLibrary, usePathwayLaunch, usePathwaySelection } from './pathways';

interface PathwaysExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The active goal's text; a pathway goal is marked as current. */
  activeGoalTitle?: string;
  /** Selected, with its direction shown, when the explorer opens. */
  initialPathwayId?: string;
}

interface ExplorerContentProps {
  hasGoal: boolean;
  currentId?: string;
  initialPathwayId?: string;
  onClose: () => void;
}

const ExplorerContent: React.FC<ExplorerContentProps> = ({ hasGoal, currentId, initialPathwayId, onClose }) => {
  const selection = usePathwaySelection({ initialId: initialPathwayId, currentId, startOnFirstDirection: true });
  const { startPathway } = usePathwayLaunch();
  const { selected } = selection;

  const actionLabel = !hasGoal ? 'Start this pathway' : selected && selected.id === currentId ? 'Restart this pathway' : 'Switch to this pathway';

  return (
    <DialogContent
      size="lg"
      title="Explore pathways"
      description={
        hasGoal
          ? 'Each pathway is a guided 90-day journey. Your current journey stays as it is until you finish setting up a new one.'
          : 'Each pathway is a guided 90-day journey, planned around your life.'
      }
      footer={
        <>
          <DialogClose asChild>
            <Button variant="quiet">Cancel</Button>
          </DialogClose>
          <Button
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onClose();
              startPathway(selected);
            }}
            trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      <PathwayLibrary navigation="tabs" selection={selection} currentId={currentId} />
    </DialogContent>
  );
};

/** The pathway library in a Dialog (a bottom sheet on mobile), opened from the navbar, Today and the dashboard. */
export const PathwaysExplorerModal: React.FC<PathwaysExplorerModalProps> = ({ isOpen, onClose, activeGoalTitle, initialPathwayId }) => {
  // Each opening starts fresh from `initialPathwayId`; the content stays mounted while closing so it can animate out.
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setSession((s) => s + 1);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ExplorerContent
        key={session}
        hasGoal={Boolean(activeGoalTitle?.trim())}
        currentId={findPathwayByTitle(activeGoalTitle)?.id}
        initialPathwayId={initialPathwayId}
        onClose={onClose}
      />
    </Dialog>
  );
};
