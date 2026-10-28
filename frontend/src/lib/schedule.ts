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

export interface GoalSchedule {
  planVariant: PlanVariant;
  dailyMinutes: number;
  preferredSlot: RoutineSettings['preferredSlot'];
  /** The rest days in force: the chosen ones, or the variant's own from the plan's start weekday. */
  restWeekdays: number[];
}

/** The active goal's schedule from its stored routine, read the way the server reads it (`readRoutine`). */
export function goalSchedule(goal: Pick<Goal, 'routine' | 'startDate'>): GoalSchedule {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(goal.routine || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const planVariant = (['steady', 'accelerated', 'minimal'] as const).find((item) => item === raw.planVariant) ?? 'steady';
  const slot = (['morning', 'afternoon', 'evening'] as const).find((item) => item === raw.preferredSlot) ?? 'evening';
  const chosen = validRestWeekdays(planVariant, Array.isArray(raw.restWeekdays) ? (raw.restWeekdays as number[]) : null);
  return {
    planVariant,
    dailyMinutes: Number(raw.dailyMinutes) || 30,
    preferredSlot: slot,
    restWeekdays: chosen ?? defaultRestWeekdays(planVariant, weekdayOf(goal.startDate)),
  };
}
