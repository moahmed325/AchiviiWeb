import type { DailyTask, Goal } from '../types';
import { addDaysToDateKey } from './dateUtils';
import { isRestLike, todayKey } from './today';
import { planDays } from './planLength';

/**
 * The Dashboard's numbers (ND-29): how the person is doing, read only from stored state. Nothing here writes or
 * decides anything (ND-19); Today stays the place where a step is done.
 */

/** Set on the Dashboard's Start link: Today opens the session at once when today's step can be started. */
export const START_SESSION_STATE = { startSession: true } as const;

/**
 * One cell of the 90-day map. `missed` is a past practice day with nothing done: shown as an empty cell, never as a
 * warning. `quiet` is a past day with no row (before its week was written).
 */
export type MapDayState = 'done' | 'today' | 'missed' | 'rest' | 'ahead' | 'quiet';

export interface MapDay {
  day: number;
  date: string;
  state: MapDayState;
  isToday: boolean;
}

/** The goal fields a plan's length is read from (B-109: a fixed date can make it shorter than 90 days). */
type PlanSpan = Pick<Goal, 'targetDate'> & Partial<Pick<Goal, 'startDate' | 'totalWeeks'>>;

/**
 * The date key of plan day `day` (1 to `planDays`): the same count as `dayNumber` in `lib/today.ts` (the last day is the
 * day before `targetDate`).
 */
export function dateOfDay(goal: PlanSpan, day: number): string | null {
  const target = new Date(goal.targetDate);
  if (Number.isNaN(target.getTime())) return null;
  return addDaysToDateKey(target.toISOString().slice(0, 10), day - (planDays(goal) + 1));
}

const rowsByDate = (tasks: readonly DailyTask[]) => {
  const map = new Map<string, DailyTask[]>();
  for (const task of tasks) map.set(task.date, [...(map.get(task.date) ?? []), task]);
  return map;
};

/** Every day of the plan, in order, with its state. A date can hold two rows (a week boundary): any done row makes it done. */
export function journeyDays(goal: PlanSpan & Pick<Goal, 'dailyTasks'>, now: Date, timezone?: string): MapDay[] {
  const today = todayKey(now, timezone);
  const byDate = rowsByDate(goal.dailyTasks ?? []);
  const days: MapDay[] = [];
  const total = planDays(goal);
  for (let day = 1; day <= total; day += 1) {
    const date = dateOfDay(goal, day);
    if (!date) return [];
    const rows = byDate.get(date) ?? [];
    const restOnly = rows.length > 0 && rows.every(isRestLike);
    const isToday = date === today;
    let state: MapDayState;
    if (rows.some((row) => row.status === 'completed' && !isRestLike(row))) state = 'done';
    else if (restOnly) state = 'rest';
    else if (isToday) state = 'today';
    else if (date > today) state = 'ahead';
    else state = rows.length === 0 ? 'quiet' : 'missed';
    days.push({ day, date, state, isToday });
  }
  return days;
}

/** Minutes a completed day counts for: the 10-minute version's when only that was done (ND-3). */
const minutesOf = (task: DailyTask) =>
  task.usedMinimumVersion ? (task.minimumVersion?.durationMinutes ?? 10) : Math.max(0, task.durationMinutes || 0);

export interface PracticeTotals {
  /** Practice sessions completed over the whole plan. */
  sessionsDone: number;
  minutesPractised: number;
  /** Days with practice done, on the map. */
  daysDone: number;
  /** Practice days that have come round so far: every past one, and today once it is done. */
  daysSoFar: number;
}

export function practiceTotals(goal: PlanSpan & Pick<Goal, 'dailyTasks'>, now: Date, timezone?: string): PracticeTotals {
  const done = (goal.dailyTasks ?? []).filter((task) => task.status === 'completed' && !isRestLike(task));
  const days = journeyDays(goal, now, timezone);
  return {
    sessionsDone: done.length,
    minutesPractised: done.reduce((sum, task) => sum + minutesOf(task), 0),
    daysDone: days.filter((day) => day.state === 'done').length,
    daysSoFar: days.filter((day) => day.state === 'done' || day.state === 'missed').length,
  };
}

/** "45 min", "1.5 hours", "12 hours". */
export function practiceTimeLabel(minutes: number): string {
  if (minutes < 60) return minutes + ' min';
  const hours = Math.round((minutes / 60) * 10) / 10;
  return (Number.isInteger(hours) ? String(hours) : hours.toFixed(1)) + (hours === 1 ? ' hour' : ' hours');
}

/** "Good morning" by the hour where the person is, not where the browser is. */
export function greetingFor(now: Date, timezone?: string): string {
  let hour = now.getHours();
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(now));
  } catch {
    // An unknown zone keeps the browser's hour.
  }
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export interface Streak {
  /** Practice days done in a row up to today; rest days and days with no practice planned don't break it. */
  current: number;
  /** The longest such run in the plan so far. */
  best: number;
}

/**
 * ND-33: the run of practice days done, read from the map's days. A missed practice day ends a run; today, still to
 * do, doesn't end it yet.
 */
export function practiceStreak(days: readonly MapDay[]): Streak {
  let run = 0;
  let best = 0;
  for (const day of days) {
    if (day.state === 'ahead') break;
    if (day.state === 'done') {
      run += 1;
      best = Math.max(best, run);
    } else if (day.state === 'missed') {
      run = 0;
    }
  }
  return { current: run, best };
}
