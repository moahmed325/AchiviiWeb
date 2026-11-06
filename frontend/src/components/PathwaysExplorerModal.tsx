import React, { useState } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Button, Dialog, DialogClose, DialogContent } from './ui';
import { ProCheckout } from './billing';
import { findPathwayByTitle } from '../lib/certifiedPresets';
import type { RoutineSettings } from '../types';
import { useAuthUser, useSetUpNextSkill } from '../context/AuthContext';
import { useAccess } from '../hooks/useAccess';
import { PathwayLibrary, usePathwayLaunch, usePathwaySelection } from './pathways';

interface PathwaysExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The active goal's text; a pathway goal is marked as current. */
  activeGoalTitle?: string;
  /** Selected, with its direction shown, when the explorer opens. */
  initialPathwayId?: string;
  /** ND-41: the skill already running alongside the main plan, if any. */
  alongsideTitle?: string;
  /** ND-41: the main plan's routine, the starting point for a skill run alongside it. */
  mainRoutine?: RoutineSettings | null;
}

interface ExplorerContentProps {
  alongsideTitle?: string;
  mainRoutine?: RoutineSettings | null;
  hasGoal: boolean;
  currentId?: string;
  initialPathwayId?: string;
  onClose: () => void;
}

const ExplorerContent: React.FC<ExplorerContentProps> = ({ hasGoal, currentId, initialPathwayId, onClose, alongsideTitle, mainRoutine }) => {
  const selection = usePathwaySelection({ initialId: initialPathwayId, currentId, startOnFirstDirection: true });
  const { startPathway, startAlongside } = usePathwayLaunch();
  const user = useAuthUser();
  const setUpNextSkill = useSetUpNextSkill();
  const access = useAccess();
  const [showPro, setShowPro] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selected } = selection;
  const isPro = access.state === 'pro';
  const upNext = user?.upNextSkill ?? null;

  // ND-40: with a plan running, a skill is added to the timeline (Pro) and offered when the plan ends.
  const addToTimeline = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await setUpNextSkill(selected.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it. Please try again.');
      setSaving(false);
    }
  };

  const action = !hasGoal ? (
    <Button
      variant="gold"
      disabled={!selected}
      onClick={() => {
        if (!selected) return;
        onClose();
        startPathway(selected);
      }}
      trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
    >
      Start this skill
    </Button>
  ) : !isPro ? (
    <Button variant="gold" onClick={() => setShowPro(true)}>
      See Pro
    </Button>
  ) : (
    <>
      {/* ND-41: or start it now, with its own time, beside the main plan (one skill at a time). */}
      <Button
        variant="secondary"
        disabled={!selected || selected.id === currentId || Boolean(alongsideTitle)}
        onClick={() => {
          if (!selected) return;
          onClose();
          startAlongside(selected, mainRoutine);
        }}
      >
        Run it alongside
      </Button>
      <Button
        variant="gold"
        loading={saving}
        disabled={!selected || selected.id === currentId || selected.id === upNext}
        onClick={() => void addToTimeline()}
        leadingIcon={<Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />}
      >
        {selected && selected.id === currentId ? 'Your current plan' : selected && selected.id === upNext ? 'Up next already' : 'Add to my timeline'}
      </Button>
    </>
  );

  return (
    <DialogContent
      size="lg"
      className="pathways-dialog"
      title="Skills"
      description={
        !hasGoal
          ? 'Pick one to start your plan.'
          : isPro
            ? 'Add one to your timeline. When your current plan ends, it’s ready to start.'
            : 'With Achivii Pro, add a skill to your timeline. When your current plan ends, it’s ready to start.'
      }
      footer={
        showPro ? (
          <Button variant="quiet" onClick={() => setShowPro(false)}>
            Back to skills
          </Button>
        ) : (
          <>
            <DialogClose asChild>
              <Button variant="quiet">Cancel</Button>
            </DialogClose>
            {action}
          </>
        )
      }
    >
      {showPro ? (
        <ProCheckout />
      ) : (
        <>
          <PathwayLibrary navigation="tabs" selection={selection} currentId={currentId} />
          {isPro && hasGoal && alongsideTitle && (
            <p className="mt-4 text-small text-text-secondary">Running alongside your plan: {alongsideTitle}. One skill at a time.</p>
          )}
          {error && (
            <p role="alert" className="mt-4 text-small text-danger">
              {error}
            </p>
          )}
        </>
      )}
    </DialogContent>
  );
};

/** ND-40: the guided skills in a Dialog (a bottom sheet on mobile), opened from the navbar and the Roadmap. */
export const PathwaysExplorerModal: React.FC<PathwaysExplorerModalProps> = ({ isOpen, onClose, activeGoalTitle, initialPathwayId, alongsideTitle, mainRoutine }) => {
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
        alongsideTitle={alongsideTitle}
        mainRoutine={mainRoutine}
      />
    </Dialog>
  );
};
