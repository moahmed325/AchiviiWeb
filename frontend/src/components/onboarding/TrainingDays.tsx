import React from 'react';
import { Checkbox } from '../ui';
import { DAYS_A_WEEK, WEEKDAYS, type PlanVariant } from '../../lib/schedule';

interface TrainingDaysProps {
  variant: PlanVariant;
  /** The rest days in force (weekdays, 0 Sunday to 6 Saturday). */
  restWeekdays: readonly number[];
  onChange: (restWeekdays: number[]) => void;
}

/**
 * Edit my schedule (B-108): which weekdays they train. One checkbox per day, checked for a training day; the rest are
 * rest days. Says how many to pick, and that the count is off until it matches the days a week.
 */
export const TrainingDays: React.FC<TrainingDaysProps> = ({ variant, restWeekdays, onChange }) => {
  const want = DAYS_A_WEEK[variant];
  const training = WEEKDAYS.filter(({ day }) => !restWeekdays.includes(day));
  const toggle = (day: number, train: boolean) =>
    onChange(train ? restWeekdays.filter((item) => item !== day) : [...restWeekdays, day].sort((a, b) => a - b));
  const off = training.length !== want;
  return (
    <fieldset>
      <legend className="text-small font-medium text-text">Which days?</legend>
      <p className="mt-1 text-small text-text-secondary">Pick {want} days to train. The others are rest days.</p>
      <div className="mt-3 grid grid-cols-4 gap-x-4 sm:grid-cols-7">
        {WEEKDAYS.map(({ day, label }) => (
          <Checkbox key={day} label={label} checked={!restWeekdays.includes(day)} onChange={(event) => toggle(day, event.target.checked)} />
        ))}
      </div>
      {/* Code review: the live region stays mounted, so the count is announced when it changes. */}
      <p role="status" className="mt-2 text-small text-text-secondary empty:hidden">
        {off ? `${training.length} picked. Pick exactly ${want}.` : ''}
      </p>
    </fieldset>
  );
};
