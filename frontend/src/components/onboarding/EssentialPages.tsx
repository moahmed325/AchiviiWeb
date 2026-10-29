import React, { useState } from 'react';
import type { RoutineSettings } from '../../types';
import { FIXED_DATE_HINT, fixedDateBlocks, fixedDateError, fixedDateHint, type FixedDateCheck } from '../../lib/fixedDate';
import { addDaysToDateKey } from '../../lib/dateUtils';
import { DAILY_MINUTE_OPTIONS, PLAN_VARIANT_OPTIONS, type PlanVariant } from '../../lib/schedule';
import { ChoiceCard, ChoiceGroup, Field, Input } from '../ui';
import { TrainingDays } from './TrainingDays';
import { PageFrame } from './PageFrame';
import type { EssentialPage } from './pages';

const MINUTES_HINT: Record<number, string> = {
  30: 'A light, steady habit. Easy to keep on busy days.',
  45: 'Room for a proper session without taking over your day.',
  60: 'A full session, even on a workday.',
  90: 'Deep practice, for faster progress.',
};

const SLOTS: Array<{ value: RoutineSettings['preferredSlot']; label: string; desc: string }> = [
  { value: 'morning', label: 'Morning', desc: 'Before the day gets busy.' },
  { value: 'afternoon', label: 'Afternoon', desc: 'A break in the middle of the day.' },
  { value: 'evening', label: 'Evening', desc: 'Once work or classes are done.' },
];

interface EssentialStepProps {
  page: EssentialPage;
  goal: string;
  routine: RoutineSettings;
  onRoutineChange: React.Dispatch<React.SetStateAction<RoutineSettings>>;
  /** The training days in force: the person's own, or the spread picked for them. */
  restWeekdays: number[];
  /** The daily time a chosen pathway suggests, marked on its option. */
  suggestedMinutes?: number;
  /** The commitments list and its add buttons, rendered by the wizard, which owns their editor. */
  commitments: React.ReactNode;
  fixedDate: string;
  fixedDateCheck: FixedDateCheck;
  today: string;
  onFixedDateChange: (value: string) => void;
  canContinue: boolean;
  onChangeGoal: () => void;
  onBack: () => void;
  onContinue: () => void;
}

/** The fixed date: none for most goals, so the date field only opens once they say there is one. */
const DatePage: React.FC<EssentialStepProps & { frame: React.ComponentProps<typeof PageFrame> }> = ({
  fixedDate,
  fixedDateCheck,
  today,
  onFixedDateChange,
  frame,
}) => {
  const [hasDate, setHasDate] = useState(Boolean(fixedDate));
  const ready = !hasDate || (Boolean(fixedDate) && !fixedDateBlocks(fixedDateCheck));
  return (
    <PageFrame {...frame} canContinue={ready} status={hasDate && !fixedDate ? 'Choose your date, or pick “No fixed date”.' : undefined}>
      <ChoiceGroup
        legend={frame.title}
        hideLegend
        value={hasDate ? 'yes' : 'no'}
        onChange={(value) => {
          setHasDate(value === 'yes');
          if (value === 'no') onFixedDateChange('');
        }}
      >
        <ChoiceCard value="no" title="No fixed date" description="Your plan runs for 12 weeks from today." />
        <ChoiceCard value="yes" title="Yes, there's a date" description="Your plan fits the weeks before it." />
      </ChoiceGroup>
      {hasDate && (
        <Field
          label="The date"
          hint={fixedDateBlocks(fixedDateCheck) ? undefined : fixedDate ? fixedDateHint(fixedDateCheck, fixedDate, today) : FIXED_DATE_HINT}
          error={fixedDateError(fixedDateCheck)}
          className="mt-6 max-w-sm animate-rise-in motion-reduce:animate-none"
        >
          <Input type="date" min={addDaysToDateKey(today, 1)} value={fixedDate} onChange={(e) => onFixedDateChange(e.target.value)} />
        </Field>
      )}
    </PageFrame>
  );
};

/**
 * ND-28: the questions everyone is asked about their routine, one per page. None needs the AI, so they are answered
 * while clarify reads the goal.
 */
export const EssentialStep: React.FC<EssentialStepProps> = (props) => {
  const { page, goal, routine, onRoutineChange, restWeekdays, suggestedMinutes, commitments, canContinue, onChangeGoal, onBack, onContinue } = props;
  const frame = { eyebrow: 'Your week', goal, onChangeGoal, onBack, onContinue, canContinue };
  const setField = (field: 'wakeTime' | 'sleepTime' | 'busyHours') => (e: React.ChangeEvent<HTMLInputElement>) =>
    onRoutineChange((prev) => ({ ...prev, [field]: e.target.value }));

  switch (page) {
    case 'days': {
      const title = 'How many days a week can you give it?';
      return (
        <PageFrame {...frame} title={title} description="Rest days are part of the plan, not a break from it.">
          <ChoiceGroup
            legend={title}
            hideLegend
            value={routine.planVariant}
            // B-108: a new number of days starts again from its own rest days.
            onChange={(value) => onRoutineChange((prev) => ({ ...prev, planVariant: value as PlanVariant, restWeekdays: undefined }))}
          >
            {PLAN_VARIANT_OPTIONS.map((variant) => (
              <ChoiceCard key={variant.id} value={variant.id} title={variant.title} description={variant.desc} meta={variant.meta} />
            ))}
          </ChoiceGroup>
        </PageFrame>
      );
    }
    case 'weekdays':
      return (
        <PageFrame
          {...frame}
          title="Which days work best?"
          description="We've spread them out for you. Change any day you like."
        >
          {routine.planVariant && (
            <TrainingDays
              variant={routine.planVariant}
              restWeekdays={restWeekdays}
              onChange={(next) => onRoutineChange((prev) => ({ ...prev, restWeekdays: next }))}
            />
          )}
        </PageFrame>
      );
    case 'minutes': {
      const title = 'How long can each session be?';
      return (
        <PageFrame {...frame} title={title} description="Honest beats ambitious. A plan you keep does more than a bigger one you don't.">
          <ChoiceGroup
            legend={title}
            hideLegend
            value={routine.dailyMinutes > 0 ? String(routine.dailyMinutes) : undefined}
            onChange={(value) => onRoutineChange((prev) => ({ ...prev, dailyMinutes: Number(value) }))}
            columns={2}
          >
            {DAILY_MINUTE_OPTIONS.map((mins) => (
              <ChoiceCard
                key={mins}
                value={String(mins)}
                title={`${mins} min`}
                description={MINUTES_HINT[mins]}
                meta={mins === suggestedMinutes ? 'Suggested for this goal' : undefined}
              />
            ))}
          </ChoiceGroup>
        </PageFrame>
      );
    }
    case 'slot': {
      const title = 'When do you have the most energy for it?';
      return (
        <PageFrame {...frame} title={title} description="Your sessions are planned for this part of the day.">
          <ChoiceGroup
            legend={title}
            hideLegend
            value={routine.preferredSlot}
            onChange={(value) => onRoutineChange((prev) => ({ ...prev, preferredSlot: value as RoutineSettings['preferredSlot'] }))}
            columns={3}
          >
            {SLOTS.map((slot) => (
              <ChoiceCard key={slot.value} value={slot.value} title={slot.label} description={slot.desc} />
            ))}
          </ChoiceGroup>
        </PageFrame>
      );
    }
    case 'day':
      return (
        <PageFrame {...frame} title="What does a normal day look like?" description="So a session never lands on top of work, classes or sleep.">
          <div className="grid gap-5 sm:grid-cols-3">
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
        </PageFrame>
      );
    case 'commitments':
      return (
        <PageFrame
          {...frame}
          title="Anything else fixed in your week?"
          description="A commute, the gym, the school run. Add what repeats and your sessions go around it. Nothing to add? Just continue."
        >
          {commitments}
        </PageFrame>
      );
    case 'date':
      return <DatePage {...props} frame={{ ...frame, title: 'Is there a date this has to be ready by?', description: 'An exam, a race, a talk. Most goals don’t have one.' }} />;
  }
};
