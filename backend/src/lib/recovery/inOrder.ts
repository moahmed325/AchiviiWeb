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
 *
 * M3.1d (MR-32): next week continues from the steps not done. A step handed on (placed in a later week, or stored there
 * as a `toNextWeek` record) keeps its identity, so a week ignores any step whose identity also appears in a later week:
 * it is counted once, in the latest week that holds it (logic check finding 9). A step done anywhere is done: when any
 * copy of it is on a done day, in any week (its original included), no week lists it (M3.1d review).
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

/** B-55: the identities (`stepKey`) of the steps each done day holds, by day id. */
export type DoneSteps = ReadonlyMap<string, ReadonlySet<string>>;

/** The `DoneSteps` of the days classified done, with their steps as stored. */
export function doneStepsOf(
  days: readonly Pick<DayClassification, 'taskId' | 'date' | 'kind'>[],
  tasks: ReadonlyArray<{ id: string; steps: readonly CarriedStep[] }>
): DoneSteps {
  const stepsOf = new Map(tasks.map((task) => [task.id, task.steps]));
  const done = new Map<string, Set<string>>();
  for (const day of days) {
    if (day.kind !== 'done') continue;
    const origin = { taskId: day.taskId, date: day.date };
    done.set(day.taskId, new Set((stepsOf.get(day.taskId) ?? []).map((step) => stepKey(originOf(step, origin), step.title))));
  }
  return done;
}

/**
 * MR-36, MR-37 as changed by B-55: a moved step (`carriedFrom`) or a reorder's copy (`shiftedFrom`) on `day` is ignored
 * only when a day its markers name is done and still holds that same step (same `stepKey`). A session that gave its
 * step up and was then done with its other steps does not make the given-up step done. Per step: only the screen keeps
 * a day's only steps (MR-33). Mirrored on screen by `fromDoneDay` in frontend `lib/stepLines.ts`; keep the two the same.
 */
export function isDoneCopy(step: CarriedStep, day: StepOrigin, done: DoneSteps): boolean {
  const key = stepKey(originOf(step, day), step.title);
  return [step.shiftedFrom?.taskId, markerOf(step)?.taskId].some((from) => typeof from === 'string' && done.get(from)?.has(key) === true);
}

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
   * The steps of the kind not done yet, in the order they were written: those still on a day of the week (missed
   * days, remaining sessions) and those already listed for next week. Steps handed on from an earlier week were
   * written earlier, so they come first (M3.1d).
   */
  steps: QueueItem[];
  /** M3.1d: the identities (`stepKey`) of this week's steps of the kind that a later week holds. Present only when any. */
  handedOn?: string[];
  /**
   * M3.1d review: identities of copies on open days whose step is already done elsewhere (a review handed the day on,
   * then the person did it). Present only when any; the reorder fills or empties those sessions.
   */
  doneElsewhere?: string[];
}

/** The step's number on the day it was written: kept in its `shiftedFrom` marker when M3.1d moved it (else its own). */
export const writtenNumber = (step: CarriedStep) =>
  (step.shiftedFrom && typeof step.shiftedFrom.stepNumber === 'number' ? step.shiftedFrom.stepNumber : step.stepNumber) ?? 0;

/** Written order: the day a step was written on, then its step number there, then its title. */
export const byWritten = (a: Pick<QueueItem, 'origin' | 'step' | 'title'>, b: Pick<QueueItem, 'origin' | 'step' | 'title'>) =>
  a.origin.date === b.origin.date
    ? writtenNumber(a.step) - writtenNumber(b.step) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0)
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

  // M3.1d: the latest week holding each identity of each kind, as a live copy or a record; and every identity with a
  // copy on a done day.
  const latestWeek = new Map<string, number>();
  const doneAnywhere = new Set<string>();
  const seen = (kind: string, key: string, weekNumber: number) => {
    const at = `${kind}\u0000${key}`;
    latestWeek.set(at, Math.max(latestWeek.get(at) ?? weekNumber, weekNumber));
  };
  for (const day of days) {
    for (const step of stepsOf.get(day.taskId) ?? []) {
      for (const record of Array.isArray(step.toNextWeek) ? step.toNextWeek : []) {
        const origin = markerDay(record);
        if (origin && record.step && typeof record.step.kind === 'string' && kinds.has(record.step.kind)) seen(record.step.kind, stepKey(origin, record.step.title), day.weekNumber);
      }
      if (typeof step.kind === 'string' && kinds.has(step.kind)) {
        const key = stepKey(originOf(step, day), step.title);
        seen(step.kind, key, day.weekNumber);
        if (day.kind === 'done') doneAnywhere.add(`${step.kind}\u0000${key}`);
      }
    }
  }
  const laterWeekHolds = (kind: string, key: string, weekNumber: number) => (latestWeek.get(`${kind}\u0000${key}`) ?? weekNumber) > weekNumber;

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

      const doneElsewhere = new Set<string>();
      for (const key of [...live.keys(), ...listed.keys()]) {
        if (!doneAnywhere.has(`${kind}\u0000${key}`)) continue;
        if (live.get(key)?.at.kind === 'planned') doneElsewhere.add(key);
        live.delete(key);
        listed.delete(key);
      }
      const handedOn = new Set<string>();
      for (const key of [...live.keys(), ...listed.keys()]) {
        if (!laterWeekHolds(kind, key, weekNumber)) continue;
        handedOn.add(key);
        live.delete(key);
        listed.delete(key);
      }

      const onDays: QueueItem[] = [];
      for (const [key, copy] of live) {
        if (copy.at.kind === 'done') {
          listed.delete(key);
          continue;
        }
        if (listed.has(key)) continue;
        // WU-33 (1): the one exception to "like rest": a day not offered holds its steps as not done, so they queue like a
        // missed day's into the days left (and the queue's records may sit on them, as on a missed day's).
        const status: QueueStatus =
          copy.at.kind === 'missed' || copy.at.kind === 'not_offered' ? 'missed' : copy.at.date >= input.today ? 'session' : 'still_open';
        onDays.push({ key, origin: copy.origin, title: copy.step.title, step: copy.step, status, at: copy.at });
      }
      const steps = [...onDays, ...listed.values()].sort(byWritten);
      if (steps.length > 0 || handedOn.size > 0 || doneElsewhere.size > 0) {
        queues.push({
          weekNumber,
          kind,
          steps,
          ...(handedOn.size > 0 ? { handedOn: [...handedOn] } : {}),
          ...(doneElsewhere.size > 0 ? { doneElsewhere: [...doneElsewhere] } : {}),
        });
      }
    }
  }
  return queues;
}
