import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { useAuthUser, useSetUpNextSkill } from '../../context/AuthContext';
import { findPathwayBySlug } from '../../lib/certifiedPresets';
import { PathwaysExplorerModal } from '../PathwaysExplorerModal';
import { Button } from '../ui';

/**
 * ND-40: after the Roadmap's finish line, the one skill added to the timeline ("Up next", with Remove), or a quiet
 * way to add one. Adding needs Pro; the Skills dialog says so to anyone without it.
 */
export const UpNextSkill: React.FC<{ goalTitle: string }> = ({ goalTitle }) => {
  const user = useAuthUser();
  const setUpNextSkill = useSetUpNextSkill();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const skill = findPathwayBySlug(user?.upNextSkill);

  const remove = async () => {
    setRemoving(true);
    try {
      await setUpNextSkill(null);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <li className="road-phase road-phase--finish p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="road-phase__mark" aria-hidden="true">
            <Sparkles strokeWidth={1.5} className="size-4" />
          </span>
          <div className="min-w-0">
            {skill ? (
              <>
                <h3 className="text-body-lg font-medium text-text">Up next · {skill.title}</h3>
                <p className="mt-0.5 text-small text-text-secondary">Ready to start when you finish this plan.</p>
              </>
            ) : (
              <>
                <h3 className="text-body-lg font-medium text-text">Up next</h3>
                <p className="mt-0.5 text-small text-text-secondary">Add a skill to your timeline for when this plan ends.</p>
              </>
            )}
          </div>
        </div>
        {skill ? (
          <Button
            variant="quiet"
            size="sm"
            aria-label={`Remove ${skill.title}`}
            loading={removing}
            onClick={() => void remove()}
            className="self-start sm:self-auto"
          >
            Remove
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen(true)}
            leadingIcon={<Plus aria-hidden="true" strokeWidth={1.5} className="size-4" />}
            className="self-start sm:self-auto"
          >
            Add a skill
          </Button>
        )}
      </div>
      <PathwaysExplorerModal isOpen={open} onClose={() => setOpen(false)} activeGoalTitle={goalTitle} />
    </li>
  );
};
