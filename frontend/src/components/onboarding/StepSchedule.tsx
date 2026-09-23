import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { RoutineSettings } from '../../types';
import { Button, ChoiceCard, ChoiceGroup, ErrorState, Field, Input, SegmentedControl } from '../ui';
import type { OnboardingError } from './requestErrors';
import { GoalContext, StepFooter, StepHeader } from './StepLayout';

type PlanVariant = NonNullable<RoutineSettings['planVariant']>;
type PreferredSlot = RoutineSettings['preferredSlot'];

const PLAN_VARIANTS: Array<{ id: PlanVariant; title: string; meta: string; desc: string }> = [
  { id: 'minimal', title: 'Light', meta: '4 days a week', desc: '4 sessions and 3 rest days. For a busy season.' },
  { id: 'steady', title: 'Steady', meta: '5 days a week · Recommended', desc: '5 sessions and 2 rest days. Consistent progress most weeks can hold.' },
  { id: 'accelerated', title: 'Intensive', meta: '6 days a week', desc: '6 sessions and 1 rest day. For when you want to move fast.' },
];

const DAILY_MINUTES = [30, 45, 60, 90];

const MINUTES_HINT: Record<number, string> = {
  30: 'Good for building a light, steady habit.',
  45: 'A balanced amount for steady progress.',
  60: 'Enough for a full session, even on a busy workday.',
  90: 'Deep immersion, for faster progress.',
};

const SLOTS: Array<{ value: PreferredSlot; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

interface StepScheduleProps {
  rawGoal: string;
  routine: RoutineSettings;
  onRoutineChange: React.Dispatch<React.SetStateAction<RoutineSettings>>;
  /** Picking a time of day also drops any practice time placed on the timeline. */
  onChooseSlot: (slot: PreferredSlot) => void;
  timeline: React.ReactNode;
  commitments: React.ReactNode;
  scheduleChosen: boolean;
  /** A custom goal leaves the schedule for its questions, which may still be on their way. */
  isWaitingForClarification: boolean;
  clarificationError: OnboardingError | null;
  isClarifying: boolean;
  onRetryClarification: () => void;
  onChangeGoal: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/** "When can you make time for this?": find where the goal can realistically live in the user's week. */
export const StepSchedule: React.FC<StepScheduleProps> = ({
  rawGoal,
  routine,
  onRoutineChange,
  onChooseSlot,
  timeline,
  commitments,
  scheduleChosen,
  isWaitingForClarification,
  clarificationError,
  isClarifying,
  onRetryClarification,
  onChangeGoal,
  onBack,
  onContinue,
}) => {
  const waiting = isWaitingForClarification && isClarifying;
  const setField = (field: 'wakeTime' | 'sleepTime' | 'busyHours') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onRoutineChange((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="flex flex-col">
      <StepHeader
        eyebrow="Schedule"
        title="When can you make time for this?"
        description="Find the place this goal can realistically live in your week. Every session is planned around the rest of your day."
      >
        <GoalContext goal={rawGoal} onChange={onChangeGoal} />
      </StepHeader>

      <div className="mt-12 flex flex-col gap-10">
        <ChoiceGroup
          legend="How many days a week?"
          description="Rest days are part of the plan, not a break from it."
          value={routine.planVariant}
          onChange={(value) => onRoutineChange((prev) => ({ ...prev, planVariant: value as PlanVariant }))}
          columns={3}
        >
          {PLAN_VARIANTS.map((variant) => (
            <ChoiceCard key={variant.id} value={variant.id} title={variant.title} description={variant.desc} meta={variant.meta} />
          ))}
        </ChoiceGroup>

        <div>
          <SegmentedControl
            legend="How long each day?"
            options={DAILY_MINUTES.map((mins) => ({ value: String(mins), label: `${mins} min` }))}
            value={routine.dailyMinutes > 0 ? String(routine.dailyMinutes) : undefined}
            onChange={(value) => onRoutineChange((prev) => ({ ...prev, dailyMinutes: Number(value) }))}
          />
          <p className="mt-3 text-small text-text-secondary">
            {MINUTES_HINT[routine.dailyMinutes] ?? '60 minutes is recommended for most goals.'}
          </p>
        </div>
      </div>

      <section aria-labelledby="day-heading" className="mt-14 border-t border-border pt-10">
        <h2 id="day-heading" className="text-h3 text-text">
          Where it fits in your day
        </h2>
        <p className="mt-2 max-w-xl text-body text-text-secondary">
          Tell us the shape of your day. Your practice goes where you actually have room.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <Field label="You wake up">
            <Input type="time" value={routine.wakeTime} onChange={setField('wakeTime')} />
          </Field>
          <Field label="You go to sleep">
            <Input type="time" value={routine.sleepTime} onChange={setField('sleepTime')} />
          </Field>
          <Field label="Busy hours" hint="Work or classes">
            <Input value={routine.busyHours} onChange={setField('busyHours')} placeholder="09:00 - 17:00" />
          </Field>
        </div>

        <div className="mt-8">
          <SegmentedControl legend="Best time to practise" options={SLOTS} value={routine.preferredSlot} onChange={(v) => onChooseSlot(v as PreferredSlot)} />
          <p className="mt-3 text-small text-text-secondary">Evening suits most people. You can also drag the session on the timeline.</p>
        </div>

        <div className="mt-8">{timeline}</div>
        <div className="mt-12">{commitments}</div>
      </section>

      {clarificationError && !isClarifying && (
        <ErrorState
          className="mt-10"
          title={clarificationError.title}
          description={`${clarificationError.message} Your schedule is kept.`}
          onRetry={onRetryClarification}
        />
      )}

      <StepFooter
        onBack={onBack}
        status={
          !scheduleChosen
            ? 'Choose how many days a week and how long each day.'
            : waiting
              ? 'Preparing your questions. Your schedule is kept while you wait.'
              : undefined
        }
      >
        <Button
          size="lg"
          disabled={!scheduleChosen}
          loading={waiting}
          onClick={onContinue}
          trailingIcon={<ArrowRight aria-hidden="true" strokeWidth={1.5} className="size-5" />}
        >
          Continue
        </Button>
      </StepFooter>
    </div>
  );
};
