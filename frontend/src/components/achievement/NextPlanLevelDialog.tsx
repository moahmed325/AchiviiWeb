import React, { useState } from 'react';
import type { JourneyResult } from '../../types';
import { levelQuestion } from '../../lib/nextPlan';
import { Button, Dialog, DialogContent, Field, Input } from '../ui';

export interface NextPlanLevelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: JourneyResult;
  onContinue: (level: number) => void;
}

/**
 * Next plan (NP-9, NP-10): asks a goal measured in a number for the level now. No weekly tests (2026-10-30): nothing is
 * measured by the plan, so nothing is filled in.
 */
export const NextPlanLevelDialog: React.FC<NextPlanLevelDialogProps> = ({ open, onOpenChange, result, onContinue }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(text.trim());
    if (!text.trim() || !Number.isFinite(value) || value < 0) {
      setError('Enter a number.');
      return;
    }
    onContinue(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Where are you now?"
        description="Your next plan starts from here."
        size="sm"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="next-plan-level" variant="primary">
              Continue
            </Button>
          </>
        }
      >
        <form id="next-plan-level" onSubmit={submit} noValidate>
          <Field label={levelQuestion(result)} error={error ?? undefined}>
            <Input
              inputMode="decimal"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              trailing={result.unit ?? undefined}
            />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
};
