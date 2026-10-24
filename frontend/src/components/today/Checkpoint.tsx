import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Checkpoint } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { ApiError, answerCheckpoint } from '../../lib/api';
import { CHECKPOINT_NOT_SAVED, acceptedLine, checkpointCopy } from '../../lib/checkpoint';
import { Button, IconButton, Surface } from '../ui';

/**
 * Checkpoints (RULE-7, RULE-8, section 6, AC-5): after the week 4 or 8 close, one card with the honest line and the
 * choice. It never blocks anything: Today renders it only when no close is held, no break choice waits and the close
 * didn't fail (Home shows those instead of Today). Keep, "Got it" and Dismiss all answer keep; accepting says so for
 * the rest of the visit. Every answer refreshes the goal, and a 409 (answered elsewhere, expired, a switch off) too.
 */
export const CheckpointCard: React.FC<{ checkpoint: Checkpoint | null | undefined }> = ({ checkpoint }) => {
  const { token } = useAuth();
  const { refreshGoal } = useGoal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);

  if (accepted) {
    return (
      <div className="mt-6 border-l-2 border-achievement/50 py-0.5 pl-4">
        <p role="status" className="text-small text-text-secondary">
          {accepted}
        </p>
      </div>
    );
  }
  if (!checkpoint) return null;
  const copy = checkpointCopy(checkpoint);

  const answer = async (value: 'keep' | 'accept') => {
    if (!token || saving) return;
    setSaving(true);
    setError(null);
    try {
      await answerCheckpoint(checkpoint.week, value, token);
      if (value === 'accept') setAccepted(acceptedLine(checkpoint));
      await refreshGoal();
    } catch (err) {
      console.warn('Failed to save the checkpoint answer:', err);
      if (err instanceof ApiError && err.status === 409 && (err.code === 'no_checkpoint' || err.code === 'weekly_update_disabled')) {
        await refreshGoal();
      } else {
        setError(CHECKPOINT_NOT_SAVED);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Surface as="section" tone="elevated" padding="lg" aria-labelledby="checkpoint-heading" className="animate-rise-in relative mt-10">
      <div className="flex items-start justify-between gap-3">
        <h2 id="checkpoint-heading" className="text-h3 text-text">
          {copy.title}
        </h2>
        <IconButton label="Dismiss" icon={<X aria-hidden="true" strokeWidth={1.5} className="size-4" />} disabled={saving} onClick={() => answer('keep')} />
      </div>
      <p className="mt-3 max-w-xl text-body text-text-secondary">{copy.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {copy.accept && (
          <Button type="button" variant="primary" disabled={saving} onClick={() => answer('accept')}>
            {copy.accept}
          </Button>
        )}
        <Button type="button" variant={copy.accept ? 'secondary' : 'primary'} disabled={saving} onClick={() => answer('keep')}>
          {copy.keep}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </Surface>
  );
};
