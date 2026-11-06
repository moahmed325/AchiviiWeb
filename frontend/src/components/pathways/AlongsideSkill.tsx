import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { Goal } from '../../types';
import { useAuthToken } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { resetActiveGoal } from '../../lib/api';
import { planWeeks } from '../../lib/planLength';
import { Button, Dialog, DialogClose, DialogContent } from '../ui';

/**
 * ND-42: on the Roadmap, the skill running alongside the main plan: where it is, and a way to stop it (asked first;
 * the main plan is untouched).
 */
export const AlongsideSkill: React.FC<{ goal: Goal }> = ({ goal }) => {
  const token = useAuthToken();
  const { refreshGoal } = useGoal();
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = async () => {
    if (!token) return;
    setStopping(true);
    setError(null);
    try {
      await resetActiveGoal(token, 'alongside');
      setOpen(false);
      await refreshGoal();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not stop it. Please try again.');
    } finally {
      setStopping(false);
    }
  };

  return (
    <li className="road-phase p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="road-phase__mark" data-status="active" aria-hidden="true">
            <Sparkles strokeWidth={1.5} className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-body-lg font-medium text-text">Alongside · {goal.rawGoal}</h3>
            <p className="mt-0.5 text-small text-text-secondary">
              Week {goal.currentWeek || 1} of {planWeeks(goal)}. Its step shows on Today under yours.
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button variant="quiet" size="sm" onClick={() => setOpen(true)} className="self-start sm:self-auto">
            Stop this skill
          </Button>
          <DialogContent
            title={`Stop ${goal.rawGoal}?`}
            description="Its plan and what you’ve done in it are removed. Your main plan stays exactly as it is."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="quiet">Keep it</Button>
                </DialogClose>
                <Button variant="danger" loading={stopping} onClick={() => void stop()}>
                  Stop the skill
                </Button>
              </>
            }
          >
            {error && (
              <p role="alert" className="text-small text-danger">
                {error}
              </p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </li>
  );
};
