/**
 * Method-aware recovery, M3.1c (RULE-20, MR-30): the in-order queue. For each kind that is in order and moves, the
 * steps of that kind not done yet in a week, in the order they were written. Pure: no database, no clock, no
 * environment. It reads only the stored week (steps, their markers, day status), so a replan with nothing new gives
 * the same queue. The carry planner (`carry.ts`) reorders the week's remaining sessions from it, and M3.1d reads it at
 * the week's end to tell next week what it starts with.
 *
 * A step's identity is the day it was written on plus its title. A step still on that day has no marker; a step a
 * reorder placed elsewhere keeps the day in its `shiftedFrom` marker (a missed-sessions carry or a swap names it in
 * `carriedFrom` or `swappedFrom`). A missed day is never rewritten, so after a move it still holds an old copy: the
 * copy on the latest day is the live one. A step taken off its session with no later session left is listed in a
 * `toNextWeek` record and stays listed.
 */
import { hasPriority, markerOf, swapMarkerOf, type CarriedStep, type CarryTask } from '../carryForward.js';
import type { DayClassification } from '../missedSessions.js';
import { actionOf, type RecoveryProfile } from './profile.js';

/** The kinds whose steps are never lost (RULE-20): in order, and their action is move. */
export function inOrderMoveKinds(profile: RecoveryProfile | null | undefined): Set<string> {
  return new Set((profile?.kinds ?? []).filter((kind) => kind.inOrder && kind.action === 'move').map((kind) => kind.id));
}

/** A day follows the new rules only when every one of its steps has a priority and a known kind (RULE-18, MR-28). */
export function followsMethod(steps: readonly CarriedStep[], profile: RecoveryProfile | null | undefined): boolean {
  return steps.length > 0 && steps.every((step) => hasPriority(step) && actionOf(step, profile) !== null);
}

export interface StepOrigin {
  taskId: string;
  date: string;
}

function markerDay(marker: unknown): StepOrigin | null {
  if (!marker || typeof marker !== 'object') return null;
  const { taskId, date } = marker as { taskId?: unknown; date?: unknown };
  return typeof taskId === 'string' && typeof date === 'string' ? { taskId, date } : null;
}

/** The day a stored step was written on: its move marker's day, or the day that holds it. */
export function originOf(step: CarriedStep, day: StepOrigin): StepOrigin {
  return markerDay(step.shiftedFrom) ?? markerDay(markerOf(step)) ?? markerDay(swapMarkerOf(step)) ?? { taskId: day.taskId, date: day.date };
}

/** A step's identity: the day it was written on and its title. */
export const stepKey = (origin: StepOrigin, title: unknown) => `${origin.taskId}\u0000${typeof title === 'string' ? title : ''}`;

/**
 * Where a step not done yet is now. `missed`: on a day that closed undone. `session`: on an open day dated today or
 * later. `still_open`: on a day before today that has not closed yet. `next_week`: listed for next week.
 */
export type QueueStatus = 'missed' | 'session' | 'still_open' | 'next_week';

export interface QueueItem {
  key: string;
  origin: StepOrigin;
  title: string;
  /** The stored step: its live copy, or the step in its `toNextWeek` record. */
  step: CarriedStep;
  status: QueueStatus;
  /** The day holding the live copy; null for a step listed for next week. */
  at: DayClassification | null;
}

export interface KindQueue {
  weekNumber: number;
  /** The in-order move kind's id. */
  kind: string;
  /**
   * The steps of the kind not done yet, in order: those still on a day of the week (missed days, then the remaining
   * sessions, in the order they were written), then those already listed for next week.
   */
  steps: QueueItem[];
}

const byWritten = (a: QueueItem, b: QueueItem) =>
  a.origin.date === b.origin.date
    ? (a.step.stepNumber ?? 0) - (b.step.stepNumber ?? 0) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)
    : a.origin.date < b.origin.date
      ? -1
      : 1;

/**
 * The queue of every week and every in-order move kind that has a step not done yet. `today` is the user's local
 * date ('YYYY-MM-DD'). Rest days and the test day hold no such step (RULE-7) and are not read.
 */
export function inOrderQueue(input: {
  days: readonly DayClassification[];
  tasks: readonly Pick<CarryTask, 'id' | 'steps'>[];
  profile: RecoveryProfile | null | undefined;
  today: string;
}): KindQueue[] {
  const kinds = inOrderMoveKinds(input.profile);
  if (kinds.size === 0) return [];
  const stepsOf = new Map(input.tasks.map((task) => [task.id, task.steps]));
  const days = [...input.days]
    .filter((day) => day.kind !== 'rest' && !day.isTestDay)
    .sort((a, b) => (a.date === b.date ? a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1));
  const weeks = [...new Set(days.map((day) => day.weekNumber))].sort((a, b) => a - b);

  const queues: KindQueue[] = [];
  for (const weekNumber of weeks) {
    const week = days.filter((day) => day.weekNumber === weekNumber);
    for (const kind of kinds) {
      // Every stored copy, later days last, so the last copy of a step is its live one.
      const live = new Map<string, { origin: StepOrigin; step: CarriedStep; at: DayClassification }>();
      const listed = new Map<string, QueueItem>();
      for (const day of week) {
        for (const step of stepsOf.get(day.taskId) ?? []) {
          for (const record of Array.isArray(step.toNextWeek) ? step.toNextWeek : []) {
            const origin = markerDay(record);
            if (!origin || !record.step || record.step.kind !== kind) continue;
            const key = stepKey(origin, record.step.title);
            if (!listed.has(key)) listed.set(key, { key, origin, title: record.step.title, step: record.step, status: 'next_week', at: null });
          }
          if (step.kind !== kind) continue;
          const origin = originOf(step, day);
          live.set(stepKey(origin, step.title), { origin, step, at: day });
        }
      }

      const onDays: QueueItem[] = [];
      for (const [key, copy] of live) {
        if (copy.at.kind === 'done') {
          listed.delete(key);
          continue;
        }
        if (listed.has(key)) continue;
        const status: QueueStatus = copy.at.kind === 'missed' ? 'missed' : copy.at.date >= input.today ? 'session' : 'still_open';
        onDays.push({ key, origin: copy.origin, title: copy.step.title, step: copy.step, status, at: copy.at });
      }
      const steps = [...onDays.sort(byWritten), ...[...listed.values()].sort(byWritten)];
      if (steps.length > 0) queues.push({ weekNumber, kind, steps });
    }
  }
  return queues;
}
