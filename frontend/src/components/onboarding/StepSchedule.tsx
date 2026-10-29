import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { RoutineSettings } from '../../types';
import { FIXED_DATE_LABEL, fixedDateBlocks, fixedDateError, fixedDateHint, type FixedDateCheck } from '../../lib/fixedDate';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { DAILY_MINUTE_OPTIONS, PLAN_VARIANT_OPTIONS, defaultRestWeekdays, weekdayOf, type PlanVariant } from '../../lib/schedule';
import { TrainingDays } from './TrainingDays';
import { Button, ChoiceCard, ChoiceGroup, ErrorState, Field, Input, SegmentedControl } from '../ui';
import type { OnboardingError } from './requestErrors';
import { GoalContext, StepFooter, StepHeader } from './StepLayout';

type PreferredSlot = RoutineSettings['preferredSlot'];

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
  /** B-106: the optional fixed date (`YYYY-MM-DD`, '' for none), its check and the plan's start day (`YYYY-MM-DD`). */
  fixedDate: string;
  fixedDateCheck: FixedDateCheck;
  today: string;
  onFixedDateChange: (value: string) => void;
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
  fixedDate,
  fixedDateCheck,
  today,
  onFixedDateChange,
  isWaitingForClarification,
  clarificationError,
  isClarifying,
  onRetryClarification,
  onChangeGoal,
  onBack,
  onContinue,
}) => {
  const waiting = isWaitingForClarification && isClarifying;
  const dateInvalid = fixedDateBlocks(fixedDateCheck);
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
          // B-108: a new number of days starts again from its own rest days.
          onChange={(value) => onRoutineChange((prev) => ({ ...prev, planVariant: value as PlanVariant, restWeekdays: undefined }))}
          columns={3}
        >
          {PLAN_VARIANT_OPTIONS.map((variant) => (
            <ChoiceCard key={variant.id} value={variant.id} title={variant.title} description={variant.desc} meta={variant.meta} />
          ))}
        </ChoiceGroup>

        {routine.planVariant && (
          <TrainingDays
            variant={routine.planVariant}
            // The plan starts today, so its weeks start on today's weekday.
            restWeekdays={routine.restWeekdays ?? defaultRestWeekdays(routine.planVariant, weekdayOf(today))}
            onChange={(restWeekdays) => onRoutineChange((prev) => ({ ...prev, restWeekdays }))}
          />
        )}

        <div>
          <SegmentedControl
            legend="How long each day?"
            options={DAILY_MINUTE_OPTIONS.map((mins) => ({ value: String(mins), label: `${mins} min` }))}
            value={routine.dailyMinutes > 0 ? String(routine.dailyMinutes) : undefined}
            onChange={(value) => onRoutineChange((prev) => ({ ...prev, dailyMinutes: Number(value) }))}
          />
          <p className="mt-3 text-small text-text-secondary">
            {MINUTES_HINT[routine.dailyMinutes] ?? '60 minutes is recommended for most goals.'}
          </p>
        </div>

        <Field label={FIXED_DATE_LABEL} showOptional hint={dateInvalid ? undefined : fixedDateHint(fixedDateCheck, fixedDate, today)} error={fixedDateError(fixedDateCheck)} className="max-w-sm">
          <Input type="date" min={addDaysToDateKey(today, 1)} value={fixedDate} onChange={(e) => onFixedDateChange(e.target.value)} />
        </Field>
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
            ? routine.planVariant && routine.dailyMinutes > 0
              ? 'Pick your training days.'
              : 'Choose how many days a week and how long each day.'
            : waiting
              ? 'Preparing your questions. Your schedule is kept while you wait.'
              : undefined
        }
      >
        <Button
          size="lg"
          disabled={!scheduleChosen || dateInvalid}
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
