import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoal } from '../../context/GoalContext';
import { Button, Dialog, DialogClose, DialogContent } from '../ui';

interface ResetPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the server deleted the plan, before opening onboarding. */
  onReset?: () => void;
}

/** The server deletes the goal (`DELETE /api/goal/active`); it does not archive it. The copy says so. */
export const ResetPlanDialog: React.FC<ResetPlanDialogProps> = ({ open, onOpenChange, onReset }) => {
  const { resetGoal } = useGoal();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);

  const changeOpen = (next: boolean) => {
    if (!next) setFailed(false);
    onOpenChange(next);
  };

  const confirm = async () => {
    setFailed(false);
    setResetting(true);
    const ok = await resetGoal();
    setResetting(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    changeOpen(false);
    onReset?.();
    navigate('/onboarding');
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        size="sm"
        title="Reset your 90-day plan?"
        description="This deletes your current plan and all of its task progress. It can't be undone. You'll choose a new goal next."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="quiet">Keep my plan</Button>
            </DialogClose>
            <Button variant="danger" loading={resetting} onClick={confirm}>
              Reset plan
            </Button>
          </>
        }
      >
        <p role="alert" className="text-small text-danger empty:hidden">
          {failed ? "We couldn't reset your plan. Please try again." : ''}
        </p>
      </DialogContent>
    </Dialog>
  );
};
