import React, { useState } from 'react';
import { useAuthToken } from '../../context/AuthContext';
import { useGoal } from '../../context/GoalContext';
import { updateSchedule } from '../../lib/api';
import { DAYS_A_WEEK, goalSchedule, validRestWeekdays, weekdayOf, defaultRestWeekdays, type GoalSchedule, type PlanVariant } from '../../lib/schedule';
import { utcDateLabel } from '../../lib/weekClose';
import { TrainingDays } from '../onboarding/TrainingDays';
import { Button, Dialog, DialogClose, DialogContent, SegmentedControl } from '../ui';

interface EditScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VARIANTS: PlanVariant[] = ['minimal', 'steady', 'accelerated'];
const MINUTES = [30, 45, 60, 90];
const SLOTS: Array<{ value: GoalSchedule['preferredSlot']; label: string }> = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

/** The final week has no next week to change (the server answers 409 `last_week`). */
const LAST_WEEK = 12;

/**
 * Edit my schedule (B-108): the active goal's days, minutes and time of day, saved from next week (`PATCH
 * /api/goal/schedule`). The open week stays as written; the targets don't change.
 */
export const EditScheduleDialog: React.FC<EditScheduleDialogProps> = ({ open, onOpenChange }) => {
  const { activeGoal, refreshGoal } = useGoal();
  const token = useAuthToken();
  const [draft, setDraft] = useState<GoalSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeOpen = (next: boolean) => {
    // Each opening starts from the goal as stored.
    setDraft(next && activeGoal ? goalSchedule(activeGoal) : null);
    setSaved(null);
    setError(null);
    onOpenChange(next);
  };

  // Nothing is read until it opens (the menu mounts it closed).
  if (!activeGoal || !open) return null;
  const current = draft ?? goalSchedule(activeGoal);
  const lastWeek = (activeGoal.currentWeek || 1) >= LAST_WEEK;
  const daysFit = validRestWeekdays(current.planVariant, current.restWeekdays) !== null;
  // A shortened daily time (the weekly update's card) is kept as an option.
  const minutes = MINUTES.includes(current.dailyMinutes) ? MINUTES : [...MINUTES, current.dailyMinutes].sort((a, b) => a - b);
  const set = (change: Partial<GoalSchedule>) => {
    setSaved(null);
    setDraft({ ...current, ...change });
  };

  const save = async () => {
    if (!token || !daysFit) return;
    setSaving(true);
    setError(null);
    try {
      const answer = await updateSchedule(
        { planVariant: current.planVariant, restWeekdays: current.restWeekdays, dailyMinutes: current.dailyMinutes, preferredSlot: current.preferredSlot },
        token
      );
      await refreshGoal();
      const date = utcDateLabel(new Date(`${answer.startsOn}T00:00:00Z`), new Date());
      setSaved(`Saved. Your new schedule starts next week, on ${date}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        size="md"
        title="Edit my schedule"
        description="Changes start next week. This week stays as it is, and your targets don't change."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="quiet">{saved ? 'Done' : 'Cancel'}</Button>
            </DialogClose>
            <Button variant="primary" loading={saving} disabled={lastWeek || !daysFit} onClick={save}>
              Save schedule
            </Button>
          </>
        }
      >
        {lastWeek ? (
          <p className="text-small text-text-secondary">This is your plan's final week, so there is no next week to change.</p>
        ) : (
          <div className="flex flex-col gap-6">
            <SegmentedControl
              legend="Days a week"
              options={VARIANTS.map((variant) => ({ value: variant, label: `${DAYS_A_WEEK[variant]} days` }))}
              value={current.planVariant}
              // A new number of days starts from its own rest days, counted from the plan's week start.
              onChange={(value) =>
                set({ planVariant: value as PlanVariant, restWeekdays: defaultRestWeekdays(value as PlanVariant, weekdayOf(activeGoal.startDate)) })
              }
            />
            <TrainingDays variant={current.planVariant} restWeekdays={current.restWeekdays} onChange={(restWeekdays) => set({ restWeekdays })} />
            <SegmentedControl
              legend="Minutes a day"
              options={minutes.map((value) => ({ value: String(value), label: `${value} min` }))}
              value={String(current.dailyMinutes)}
              onChange={(value) => set({ dailyMinutes: Number(value) })}
            />
            <SegmentedControl
              legend="Time of day"
              options={SLOTS.map((slot) => ({ value: slot.value, label: slot.label }))}
              value={current.preferredSlot}
              onChange={(value) => set({ preferredSlot: value as GoalSchedule['preferredSlot'] })}
            />
          </div>
        )}
        <p role="status" className="mt-4 text-small text-text empty:hidden">{saved ?? ''}</p>
        <p role="alert" className="mt-4 text-small text-danger empty:hidden">{error ?? ''}</p>
      </DialogContent>
    </Dialog>
  );
};
