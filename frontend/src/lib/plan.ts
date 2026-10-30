import type { Goal } from '../types';
import type { JourneyData } from '../types/journey';
import { dateOfDay } from './dashboard';
import { planDays } from './planLength';
import { isRestLike } from './today';

/**
 * ND-31: the Roadmap page (Roadmap and Progress in one): every week of the plan with its dates and focus, and for the
 * weeks gone by what was done. No weekly tests (ND-33): no target, check or result. Read only from stored state.
 */

const TIME_UNITS = new Set(['min', 'mins', 'minute', 'minutes']);

/** A measured value as a person reads it: a time in minutes as "54:40", anything else rounded with its unit. */
export function formatMetric(value: number, unit: string): string {
  if (TIME_UNITS.has(unit.trim().toLowerCase())) {
    const totalSeconds = Math.round(value * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }
  const rounded = Math.round(value * 100) / 100;
  return unit ? `${rounded} ${unit}` : String(rounded);
}

export type WeekState = 'done' | 'current' | 'ahead' | 'paused';

export interface WeekRow {
  weekNumber: number;
  phaseId: string;
  state: WeekState;
  /** "Oct 20 – Oct 26". */
  dates: string | null;
  title: string;
  /** Practice days done and planned, for a week whose days are written. */
  sessions: { done: number; planned: number } | null;
  /** What the weekly review changed for the next week, in the review's own words. */
  insight: string | null;
}

const shortDate = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function weekDates(goal: Pick<Goal, 'targetDate'> & Partial<Pick<Goal, 'startDate' | 'totalWeeks'>>, weekNumber: number): string | null {
  const first = (weekNumber - 1) * 7 + 1;
  const start = dateOfDay(goal, first);
  const end = dateOfDay(goal, Math.min(first + 6, planDays(goal)));
  return start && end ? `${shortDate(start)} – ${shortDate(end)}` : null;
}

/** Every week of the plan, in order, as the Roadmap shows it. */
export function weekRows(goal: Goal, journey: JourneyData): WeekRow[] {
  const reviews = new Map((goal.weeklyReviews ?? []).map((review) => [review.weekNumber, review]));
  const tasks = goal.dailyTasks ?? [];
  return journey.phases.flatMap((phase) =>
    phase.weeks.map((week) => {
      const days = tasks.filter((task) => task.weekNumber === week.weekNumber && !isRestLike(task));
      const state: WeekState = week.jumped ? 'paused' : week.isCurrentWeek ? 'current' : week.status === 'completed' ? 'done' : 'ahead';
      return {
        weekNumber: week.weekNumber,
        phaseId: phase.id,
        state,
        dates: weekDates(goal, week.weekNumber),
        title: week.focus || week.theme || week.title,
        sessions: days.length > 0 ? { done: days.filter((task) => task.status === 'completed').length, planned: days.length } : null,
        insight: reviews.get(week.weekNumber)?.aiAdaptationInsight?.trim() || null,
      };
    }),
  );
}

/** The plan's last day as a date ("Sat, Jan 17"), or null. */
export function finishDate(goal: Pick<Goal, 'targetDate'> & Partial<Pick<Goal, 'startDate' | 'totalWeeks'>>): string | null {
  const key = dateOfDay(goal, planDays(goal));
  return key ? new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
}
