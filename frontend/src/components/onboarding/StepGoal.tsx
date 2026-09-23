import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Field, Textarea } from '../ui';
import { findPathwayByTitle } from '../../lib/certifiedPresets';
import { PathwayCustomGoal, PathwayLibrary } from '../pathways';
import type { GoalKind } from './steps';
import { StepHeader } from './StepLayout';

interface StepGoalProps {
  rawGoal: string;
  onStartGoal: (goal: string, kind: GoalKind) => void;
}

/** Direction, then pathway (OD-11), with a goal of the user's own as a first-class alternative (ND-6). */
export const StepGoal: React.FC<StepGoalProps> = ({ rawGoal, onStartGoal }) => {
  const current = findPathwayByTitle(rawGoal);
  const [customGoal, setCustomGoal] = useState(current ? '' : rawGoal);

  const startCustom = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (customGoal.trim()) onStartGoal(customGoal, 'custom');
  };

  return (
    <div className="flex flex-col">
      <StepHeader
        size="display"
        eyebrow="Every achievement begins with a direction"
        title="Where are you going?"
        description="Pick a direction, then a pathway. Each one is a guided 90-day journey, planned around your life."
      />

      <PathwayLibrary
        className="mt-12"
        defaultSelectedId={current?.id}
        action={{ label: 'Start this pathway', onChoose: (pathway) => onStartGoal(pathway.title, 'pathway') }}
        customGoal={
          <PathwayCustomGoal className="mt-16">
            <form onSubmit={startCustom} className="flex max-w-xl flex-col gap-4">
              <Field label="Your goal" hint="For example: bake sourdough bread at home.">
                <Textarea
                  rows={3}
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) startCustom(e);
                  }}
                />
              </Field>
              <Button
                type="submit"
                variant="secondary"
                className="w-full sm:w-auto sm:self-start"
                disabled={!customGoal.trim()}
                trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-4" />}
              >
                Continue with my goal
              </Button>
            </form>
          </PathwayCustomGoal>
        }
      />
    </div>
  );
};
