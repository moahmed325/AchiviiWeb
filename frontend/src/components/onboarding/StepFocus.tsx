import React, { useState } from 'react';
import { ChoiceCard, ChoiceGroup, Field, Input } from '../ui';
import { findPathwayByTitle } from '../../lib/certifiedPresets';
import { GOAL_MAX_LENGTH } from './pages';
import { PageFrame } from './PageFrame';

const OWN = '__own__';

interface StepFocusProps {
  /** The goal as typed, too vague to measure in 90 days. */
  goal: string;
  options: string[];
  /** The goal already chosen here, when the person comes back to this page. */
  chosen?: string;
  onChoose: (goal: string) => void;
  onChangeGoal: () => void;
  onBack: () => void;
}

/**
 * ND-28: a goal with no clear finish line ("get fit") becomes one the person can reach or measure by day 90. They pick
 * one of clarify's suggestions or write their own; the plan is then built for that goal.
 */
export const StepFocus: React.FC<StepFocusProps> = ({ goal, options, chosen, onChoose, onChangeGoal, onBack }) => {
  const [choice, setChoice] = useState(() => (chosen ? (options.includes(chosen) ? chosen : OWN) : undefined));
  const [own, setOwn] = useState(chosen && !options.includes(chosen) ? chosen : '');
  const picked = choice === OWN ? own.trim() : choice;
  const title = "Let's give it a finish line";

  return (
    <PageFrame
      eyebrow="Your goal"
      title={title}
      description={`“${goal}” is a great direction. Pick something you could reach, or clearly measure, by day 90.`}
      onBack={onBack}
      onChangeGoal={onChangeGoal}
      onContinue={() => picked && onChoose(picked)}
      canContinue={Boolean(picked)}
      status={picked ? undefined : 'Choose one, or write your own.'}
    >
      <ChoiceGroup legend={title} hideLegend value={choice} onChange={setChoice}>
        {options.map((option) => (
          <ChoiceCard key={option} value={option} title={option} meta={findPathwayByTitle(option) ? 'Guided plan' : undefined} />
        ))}
        <ChoiceCard value={OWN} title="Something else" description="Write a finish line of your own." />
      </ChoiceGroup>
      {choice === OWN && (
        <Field label="Your 90-day goal" hint="For example: run 5K without stopping." className="mt-6 animate-rise-in motion-reduce:animate-none">
          <Input value={own} onChange={(e) => setOwn(e.target.value)} maxLength={GOAL_MAX_LENGTH} autoComplete="off" autoFocus />
        </Field>
      )}
    </PageFrame>
  );
};
