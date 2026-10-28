import type { Goal, RoutineSettings } from '../types';

/**
 * Edit my schedule (B-108): the plan's days, mirrored from the server (`activeDaysFor`, `restDayIndices` and
 * `validRestWeekdays` in `backend/src/lib/ai/weekPlan.ts`; keep them in step). Weekdays are 0 Sunday to 6 Saturday.
 */
export type PlanVariant = NonNullable<RoutineSettings['planVariant']>;

export const DAYS_A_WEEK: Record<PlanVariant, number> = { minimal: 4, steady: 5, accelerated: 6 };

/** The variants' own rest days, as positions from the plan week's first day (the server's `restDayIndices`). */
const REST_POSITIONS: Record<PlanVariant, number[]> = { minimal: [2, 4, 6], steady: [3, 6], accelerated: [6] };

/** Monday first, as the picker shows them. */
export const WEEKDAYS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

/** The weekday of a `YYYY-MM-DD` date (or a stored UTC-midnight date); Monday when it can't be read. */
export function weekdayOf(date: string | null | undefined): number {
  const day = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay() : NaN;
  return Number.isNaN(day) ? 1 : day;
}

/** The variant's own rest days as weekdays, for a plan whose weeks start on `startWeekday`. */
export function defaultRestWeekdays(variant: PlanVariant, startWeekday: number): number[] {
  return REST_POSITIONS[variant].map((position) => (startWeekday + position) % 7).sort((a, b) => a - b);
}

/** Rest days that fit the variant (whole weekdays, no repeats, as many as it leaves free), sorted; null otherwise. */
export function validRestWeekdays(variant: PlanVariant, value: readonly number[] | undefined | null): number[] | null {
  if (!value) return null;
  const days = [...new Set(value)].sort((a, b) => a - b);
  const fits = days.length === value.length && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  return fits && days.length === 7 - DAYS_A_WEEK[variant] ? days : null;
}

export type GoalSchedule = NonNullable<Goal['schedule']>;

/**
 * The active goal's schedule in force, as the server sends it (`schedule`, B-108). A goal answer without it (an older
 * cached one) shows the defaults the server would use: steady, 30 minutes, evening, the variant's own rest days.
 */
export function goalSchedule(goal: Pick<Goal, 'schedule' | 'startDate'>): GoalSchedule {
  if (goal.schedule) return goal.schedule;
  return { planVariant: 'steady', dailyMinutes: 30, preferredSlot: 'evening', restWeekdays: defaultRestWeekdays('steady', weekdayOf(goal.startDate)), restWeekdaysChosen: false };
}
