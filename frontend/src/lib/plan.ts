import type { Goal, RoadmapWeek, WeekTarget } from '../types';
import type { JourneyData } from '../types/journey';
import { dateOfDay } from './dashboard';
import { isLightTest, weekTargetText, weekTestText } from './lightTest';
import { planDays } from './planLength';
import { isRestLike } from './today';

/**
 * ND-31: the Roadmap page (Roadmap and Progress in one): every week of the plan with its dates, target and test, and
 * for the weeks gone by what was done. Read only from stored state.
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

const numberTarget = (target: WeekTarget | null | undefined) =>
  target?.kind === 'number' && Number.isFinite(target.value) ? target : null;

export type WeekState = 'done' | 'current' | 'ahead' | 'paused';

export interface WeekResult {
  /** The stored value as recorded ("Done" on a light week). */
  text: string;
  /** Against the week's own number target; null when there is no number to compare. */
  met: boolean | null;
  /** How far from the target, as a person reads it ("0:26"); null without a number. */
  margin: string | null;
}

export interface WeekRow {
  weekNumber: number;
  phaseId: string;
  state: WeekState;
  /** "Oct 20 – Oct 26". */
  dates: string | null;
  title: string;
  target: string | null;
  test: string | null;
  /** Practice days done and planned, for a week whose days are written. */
  sessions: { done: number; planned: number } | null;
  result: WeekResult | null;
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

function resultOf(week: RoadmapWeek): WeekResult | null {
  const result = week.testResult;
  if (!result) return null;
  const target = numberTarget(week.target);
  const value = Number(result.value);
  if (isLightTest(week.test) || !target || !Number.isFinite(value)) {
    return { text: String(result.value) + (result.unit && Number.isFinite(value) ? ` ${result.unit}` : ''), met: result.passed ?? null, margin: null };
  }
  const better = target.direction === 'lower_is_better' ? value <= target.value : value >= target.value;
  return { text: formatMetric(value, target.unit), met: better, margin: formatMetric(Math.abs(value - target.value), target.unit) };
}

/** A week's target in a few words: "54:40 or less", "40 reps or more", or the deliverable as stored. */
export function shortTarget(target: WeekTarget): string {
  if (target.kind === 'deliverable') return target.description;
  return `${formatMetric(target.value, target.unit)} ${target.direction === 'lower_is_better' ? 'or less' : 'or more'}`;
}

/** Every week of the plan, in order, as the Roadmap shows it. */
export function weekRows(goal: Goal, journey: JourneyData): WeekRow[] {
  const stored = new Map((goal.roadmapWeeks ?? []).map((week) => [week.weekNumber, week]));
  const reviews = new Map((goal.weeklyReviews ?? []).map((review) => [review.weekNumber, review]));
  const tasks = goal.dailyTasks ?? [];
  return journey.phases.flatMap((phase) =>
    phase.weeks.map((week) => {
      const row = stored.get(week.weekNumber);
      const days = tasks.filter((task) => task.weekNumber === week.weekNumber && !isRestLike(task));
      const state: WeekState = week.jumped ? 'paused' : week.isCurrentWeek ? 'current' : week.status === 'completed' ? 'done' : 'ahead';
      const target = week.target ? weekTargetText(week.weekNumber, week.target, week.test, shortTarget, goal) : null;
      return {
        weekNumber: week.weekNumber,
        phaseId: phase.id,
        state,
        dates: weekDates(goal, week.weekNumber),
        title: week.focus || week.theme || week.title,
        target,
        test: week.test ? weekTestText(week.test) : week.keyMilestone || null,
        sessions: days.length > 0 ? { done: days.filter((task) => task.status === 'completed').length, planned: days.length } : null,
        result: row ? resultOf(row) : null,
        insight: reviews.get(week.weekNumber)?.aiAdaptationInsight?.trim() || null,
      };
    }),
  );
}

export interface StairStep {
  weekNumber: number;
  target: number;
}

/** The weekly number targets the staircase draws, in week order; empty for a goal measured by deliverables. */
export function stairSteps(goal: Pick<Goal, 'roadmapWeeks'>): StairStep[] {
  return [...(goal.roadmapWeeks ?? [])]
    .sort((a, b) => a.weekNumber - b.weekNumber)
    .flatMap((week) => {
      const target = numberTarget(week.target);
      return target ? [{ weekNumber: week.weekNumber, target: target.value }] : [];
    });
}

/** The plan's last day as a date ("Sat, Jan 17"), or null. */
export function finishDate(goal: Pick<Goal, 'targetDate'> & Partial<Pick<Goal, 'startDate' | 'totalWeeks'>>): string | null {
  const key = dateOfDay(goal, planDays(goal));
  return key ? new Date(`${key}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
}
