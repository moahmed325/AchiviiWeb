/**
 * Method-aware recovery, M3.1a and M3.1b: the carry planner when a missed day's steps follow their kinds' actions
 * (RULE-9 move, RULE-10 continue, RULE-11 let go, RULE-12 fixed), plus what each missed day followed (RULE-15).
 * Pure: no database, no clock, no environment. `reconcileCore.ts` passes `method` only when
 * `METHOD_RECOVERY_ENABLED` is exactly `true`; without it this returns missed sessions' plan untouched.
 *
 * A missed day follows the new rules only when the goal has a valid profile and every step of the day has a known
 * kind and a priority (RULE-18, MR-6). Every other day keeps exactly what missed sessions' planner (`planCarries`)
 * decides for it, run on the same input. What stays as today for every day: the open gap (ND-11), handled days
 * (ND-13, ND-18), and receiving days before today counted as closed. The key-session hold (ND-9) stays as today only
 * for days under missed sessions' rules; a day that follows the new rules is held only when its priority-1 step moves
 * and its swap with the receiving day passes RULE-12 to RULE-14 (RULE-16, M3.2, `swap.ts`).
 *
 * M3.1b: a moved hard step keeps the rest gap (RULE-14). M3.1c: a step of an in-order move kind is never lost
 * (RULE-20): the week's remaining sessions of its kind hold, in order, the steps not done yet, and the rest go to next
 * week; after an open gap the first hard step back gets the easy line (RULE-21); the warm-up line goes only on
 * physical steps (MR-31). Rules: docs/archive/method-aware-recovery/02-feature.md section 4; decisions MR-10, MR-12,
 * MR-17, MR-18, MR-26, MR-28 to MR-31.
 */
import {
  byDate,
  fitCarriedStep,
  handledTaskIds,
  hasPriority,
  markerOf,
  planCarries,
  swapMarkerOf,
  swappedTaskIds,
  type CarriedStep,
  type CarryMarker,
  type CarryDrop,
  type CarryInput,
  type CarryPlan,
  type CarryTask,
  type DropReason,
  type PlannedCarry,
} from '../carryForward.js';
import type { DetailedStep } from '../ai/goalDecomposer.js';
import { shapeOf } from '../planLength.js';
import { isRestLike, type DayClassification } from '../missedSessions.js';
import { byWritten, doneStepsOf, followsMethod, inOrderMoveKinds, inOrderQueue, isDoneCopy, originOf, stepKey, type QueueItem } from './inOrder.js';
import { actionOf, MARKS_NEXT_SESSION, type RecoveryProfile, type StepRecovery } from './profile.js';
import { continueMarkerOf, countsForRest, dayNumberOf, isFixedStep, isHardStep, shiftMarkerOf } from './rules.js';
import { EASY_START_LINE, FIRST_WEEK_BACK_LINE, easyLineTarget, hasEasyLine, hasFirstWeekBackLine, withEasyLine, withoutEasyLine } from './easyStart.js';
import { holdRefusal } from './swap.js';

/** MR-26, MR-31: put first in a moved step's instructions, once, when the step is physical. */
export const MOVED_WARM_UP_LINE = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

/** MR-31 (2): a goal whose profile is one of these templates moves physical steps whatever their kind. */
export const PHYSICAL_TEMPLATES: ReadonlySet<string> = new Set(['endurance', 'strength']);

/** Which rules a missed day followed (RULE-18). */
export type RecoveryRules = 'method' | 'missed_sessions';

/**
 * What happened to a missed day. `held` is a key session waiting for its swap answer (ND-9, RULE-16).
 * `in_gap` is a day of the open gap (ND-11): nothing is carried or marked, the gentle return speaks for it, and it
 * is in none of the RULE-17 counts (its in-order steps still join the queue, RULE-20). `next_week` is a day whose
 * in-order step got no session this week: next week starts with it (MR-30). `left_out` is the same in the plan's final
 * week, which has no next week (MR-32 (6)). For a day under missed sessions' rules, `moved` is a carry and `no_room`
 * any other drop; P3's lines for those stay as today.
 */
/** `due_passed` (B-39): a step with an outside deadline found no day on or before it, and the date has passed. */
export type RecoveryOutcome = 'moved' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'held' | 'in_gap' | 'next_week' | 'left_out' | 'due_passed';

export interface DayOutcome {
  taskId: string;
  date: string;
  rules: RecoveryRules;
  /** The day's line (RULE-15, MR-12): `moved` if anything moved, otherwise its highest-priority step's outcome. */
  outcome: RecoveryOutcome;
  /** The outcome of the day's highest-priority step alone, which the week counts read (RULE-17). */
  topStep: RecoveryOutcome;
  /** B-38 logic check: the continued top step was a restart kind's (the process starts again), counted apart. */
  restart?: true;
}

/** A continue marker to write (RULE-10). `steps` and `durationMinutes` are the receiving day's full new row. */
export interface PlannedContinue {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
  /** The continue kind's id. */
  kind: string;
  stepTitle: string;
  steps: CarriedStep[];
  durationMinutes: number;
}

/** A continue marker already stored on a step. */
export interface ContinuedEarlier {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
  kind: string | null;
  stepTitle: string;
}

/** A step of an in-order move kind by its identity: the day it was written on and its title (RULE-20). */
export interface ReorderStep {
  taskId: string;
  date: string;
  title: string;
}

/** One remaining session of an in-order move kind this week, and the step it holds after this run. */
export interface ReorderSession {
  taskId: string;
  date: string;
  /** null when it gave its own step up because it could not take the next one safely (MR-30 (5)). */
  holds: ReorderStep | null;
  /** Its step changed in this run. */
  changed: boolean;
}

/**
 * Why a kind's sessions stay exactly as stored this run (nothing is lost: the steps not done stay in the queue).
 * `held`: a key session waits for its swap answer (ND-9) on a day of the kind, or on one of its sessions. `still_open`:
 * a day before today with a step of the kind has not closed yet. `swapped`: a session holds a step that landed by a
 * swap (ND-18, never replaced). `not_tagged`: a day of the queue has a step without a kind (RULE-18). `two_in_a_day`:
 * a day the reorder uses holds two steps of the kind. `carried_by_missed_sessions`: a session receives a
 * missed-sessions carry this run. `only_step`: a session that cannot take the next step safely would have to give up
 * its own step, and that step is its day's only one; a reorder never leaves a day empty. `handed_on`: next week has
 * been written and holds some of the week's steps of the kind (M3.1d), so this week no longer reorders them.
 */
export type ReorderWait = 'held' | 'still_open' | 'swapped' | 'not_tagged' | 'two_in_a_day' | 'carried_by_missed_sessions' | 'only_step' | 'handed_on';

/**
 * RULE-20 for one in-order move kind in one week: its remaining sessions hold, in order, the steps not done yet;
 * the ones left over go to next week. Every changed day of all of this run's reorders is written in one transaction.
 */
export interface PlannedReorder {
  weekNumber: number;
  /** The in-order move kind's id. */
  kind: string;
  waits: ReorderWait | null;
  /** The week's remaining sessions of the kind (today or later, open, not the test day), in date order. */
  sessions: ReorderSession[];
  /** The steps of the kind not done this week and held by no session, in order: next week starts with them. */
  toNextWeek: Array<ReorderStep & { step: DetailedStep }>;
  /** MR-32 (6): in the plan's final week the same steps are left out instead (`toNextWeek` is empty). Only in that week. */
  leftOut?: Array<ReorderStep & { step: DetailedStep }>;
  /** Every changed day's full new row: sessions that changed, and the missed day that stores new next-week records. */
  rows: Array<{ taskId: string; steps: CarriedStep[]; durationMinutes: number }>;
}

/** RULE-21: the easy line put on the first hard step back after an open gap. `steps` is the day's full new row. */
export interface PlannedEasyStart {
  taskId: string;
  date: string;
  stepTitle: string;
  steps: CarriedStep[];
  durationMinutes: number;
}

/** Missed sessions' plan; the method fields are present only when the method switch is on. */
export interface RecoveryPlan extends CarryPlan {
  continues?: PlannedContinue[];
  alreadyContinued?: ContinuedEarlier[];
  outcomes?: DayOutcome[];
  /** RULE-20: every in-order move kind and week that changes or has steps for next week. */
  reorders?: PlannedReorder[];
  /** RULE-21: the easy line to write, or null. */
  easyStart?: PlannedEasyStart | null;
}

export interface RecoveryInput extends CarryInput {
  /** Present only when `METHOD_RECOVERY_ENABLED` is on. A null profile means RULE-18 for every day. */
  method?: { profile: RecoveryProfile | null };
}

const byPriority = (a: CarriedStep, b: CarriedStep) => (a.priority as number) - (b.priority as number);

export { shiftMarkerOf };

/** A step that came from another day by a carry or a reorder: never carried by an ordinary carry (ND-13). */
const isMarkedMove = (step: CarriedStep) => markerOf(step) !== null || shiftMarkerOf(step) !== null;

const minutesOf = (steps: readonly CarriedStep[]) => steps.reduce((sum, step) => sum + Math.max(0, step.durationMinutes || 0), 0);

/** The step as written: without any marker or next-week record. */
export function asWritten(step: CarriedStep): DetailedStep {
  const { carriedFrom: _c, shiftedFrom: _s, continueFrom: _n, swappedFrom: _w, toNextWeek: _t, ...content } = step;
  return content;
}

/** Step numbers in row order and priorities renumbered in order; a priority-0 (test) step keeps 0. */
export function renumber(steps: readonly CarriedStep[]): CarriedStep[] {
  const ranked = steps.filter((step) => step.priority !== 0).sort(byPriority);
  const priorityOf = new Map(ranked.map((step, index) => [step, index + 1]));
  return steps.map((step, index) => ({ ...step, stepNumber: index + 1, priority: priorityOf.get(step) ?? 0 }));
}

/**
 * `incoming` takes `displaced`'s place (position and priority) on the receiving day. When it is longer, the day's
 * lowest-priority steps that `canTrim` allows are removed, lowest first, so the day never gets longer (as
 * `fitCarriedStep`; its priority-1 step is never removed). Null when it cannot fit. Priorities are renumbered in
 * order; a priority-0 (test) step keeps 0. `replaced` is the displaced step and every removed one, as written.
 */
export function takePlace(
  receiving: { steps: readonly CarriedStep[]; durationMinutes: number },
  displaced: CarriedStep,
  incoming: CarriedStep,
  canTrim: (step: CarriedStep) => boolean
): { steps: CarriedStep[]; replaced: DetailedStep[]; durationMinutes: number } | null {
  const steps = receiving.steps;
  if (!steps.includes(displaced) || !steps.every(hasPriority)) return null;
  const before = minutesOf(steps);
  const limit = receiving.durationMinutes > 0 ? Math.min(before, receiving.durationMinutes) : before;
  const placed: CarriedStep = { ...incoming, stepNumber: displaced.stepNumber, priority: displaced.priority };
  const row = steps.map((step) => (step === displaced ? placed : step));
  const removable = row
    .filter((step) => step !== placed && (step.priority as number) > 1 && canTrim(step))
    .sort((a, b) => (b.priority as number) - (a.priority as number));
  const removed = new Set<CarriedStep>();
  let total = minutesOf(row);
  for (const step of removable) {
    if (total <= limit) break;
    removed.add(step);
    total -= Math.max(0, step.durationMinutes || 0);
  }
  if (total > limit) return null;

  return {
    steps: renumber(row.filter((step) => !removed.has(step))),
    replaced: [displaced, ...steps.filter((step) => removed.has(step))].map(asWritten),
    durationMinutes: total,
  };
}

/**
 * M3.1d: the `toNextWeek` records held by steps of `before` that `after` no longer holds (a step replaced, trimmed or
 * given up) go onto `after[onto]`, so a step waiting inside a week is never lost when its record's step leaves the day.
 * Unchanged when nothing was lost; records are compared by reference, as every change here copies them along.
 */
export function keepRecords(before: readonly CarriedStep[], after: CarriedStep[], onto: number): CarriedStep[] {
  const kept = new Set(after.flatMap((step) => (Array.isArray(step.toNextWeek) ? step.toNextWeek : [])));
  const lost = before.flatMap((step) => (Array.isArray(step.toNextWeek) ? step.toNextWeek : [])).filter((record) => !kept.has(record));
  if (lost.length === 0 || !after[onto]) return after;
  return after.map((step, index) => (index === onto ? { ...step, toNextWeek: [...(Array.isArray(step.toNextWeek) ? step.toNextWeek : []), ...lost] } : step));
}

const textOf = (instructions: unknown) => (typeof instructions === 'string' ? instructions : '');
const withFirstLine = (line: string, text: string) => (text.trim() ? `${line}\n${text}` : line);

/**
 * MR-26: the warm-up line goes first (after RULE-21's easy line or M1.5a's first-week-back line, when present), once;
 * the minutes do not change.
 */
export function withWarmUpLine(instructions: unknown): string {
  const text = textOf(instructions);
  const lead = [EASY_START_LINE, FIRST_WEEK_BACK_LINE].find((line) => text.startsWith(line));
  if (text.startsWith(MOVED_WARM_UP_LINE) || (lead && text.startsWith(`${lead}\n${MOVED_WARM_UP_LINE}`))) return text;
  if (lead) return `${lead}\n${withFirstLine(MOVED_WARM_UP_LINE, text.slice(lead.length).replace(/^\n/, ''))}`;
  return withFirstLine(MOVED_WARM_UP_LINE, text);
}

interface DayStep {
  step: CarriedStep;
  recovery: StepRecovery;
  /** A step of an in-order move kind: it follows the reorder (RULE-20), never an ordinary carry. */
  queued: boolean;
}

/**
 * The day's steps with their recovery, highest priority first, or null when the day does not follow the new rules
 * (RULE-18): a step without a priority or a known kind, or no step left. A step that a carry or a reorder put on the
 * day (`carriedFrom`, `shiftedFrom`) is never carried again (ND-13, as `planCarries`), so it is left behind: it is not
 * the day's move or top step or a continue source, and it counts for nothing (MR-28 (2)). That holds only for steps
 * that are not of an in-order move kind: those are never left behind (RULE-20, MR-30).
 */
function methodSteps(task: CarryTask | undefined, profile: RecoveryProfile | null, queuedKinds: ReadonlySet<string>): DayStep[] | null {
  if (!profile || !task || !followsMethod(task.steps, profile)) return null;
  const out: DayStep[] = [];
  for (const step of task.steps) {
    const queued = typeof step.kind === 'string' && queuedKinds.has(step.kind);
    if (queued || !isMarkedMove(step)) out.push({ step, recovery: actionOf(step, profile)!, queued });
  }
  return out.length > 0 ? out.sort((a, b) => byPriority(a.step, b.step)) : null;
}

/**
 * Missed sessions' plan, with every day that follows the new rules re-planned by its steps' actions.
 * Without `input.method` this is exactly `planCarries(input)`.
 */
export function planRecovery(input: RecoveryInput): RecoveryPlan {
  const { method, ...carryInput } = input;
  const legacy = planCarries(carryInput);
  if (!method) return legacy;
  const profile = method.profile;
  const queuedKinds = inOrderMoveKinds(profile);

  const ordered = [...input.days].sort(byDate);
  // RULE-20 acts on the week holding today and the week before it (whose list M3.1d hands to next week). Older weeks
  // keep what they had before M3.1c: their in-order steps follow the ordinary move rules.
  const todayWeek =
    ordered.find((day) => day.date === input.today)?.weekNumber ??
    [...ordered].reverse().find((day) => day.date < input.today)?.weekNumber ??
    ordered[0]?.weekNumber;
  const queuedWeeks = new Set(todayWeek === undefined ? [] : [todayWeek, todayWeek - 1]);
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const handled = handledTaskIds(input.tasks);
  const swapHandled = swappedTaskIds(input.tasks);
  const carrySources = new Set(legacy.alreadyCarried.map((carry) => carry.fromTaskId));
  const inGap = new Set(input.gap?.taskIds ?? []);

  // Which days follow the new rules: every step known, priorities present.
  const stepsOf = new Map<string, DayStep[]>();
  for (const day of ordered) {
    const steps = methodSteps(taskById.get(day.taskId), profile, queuedWeeks.has(day.weekNumber) ? queuedKinds : new Set());
    if (steps) stepsOf.set(day.taskId, steps);
  }
  const methodDays = new Set(ordered.filter((day) => day.kind === 'missed' && !handled.has(day.taskId) && stepsOf.has(day.taskId)).map((day) => day.taskId));
  // RULE-16 (M3.2, MR-28 (3)): a key session following the new rules is held for its swap offer only when its
  // priority-1 step moves and its swap with the receiving day passes RULE-12 to RULE-14; otherwise it is an ordinary
  // missed day. Days under missed sessions' rules (RULE-18) keep today's hold.
  const swapWeek = { days: input.days, tasks: input.tasks, profile, goal: input.goal };
  const held = legacy.held.filter(
    (item) => !methodDays.has(item.taskId) || (stepsOf.get(item.taskId)![0].recovery.action === 'move' && holdRefusal(swapWeek, item.taskId, item.receivingTaskId) === null)
  );
  const heldIds = new Set(held.map((item) => item.taskId));
  const heldReceiving = new Set(held.map((item) => item.receivingTaskId));
  // The open gap stays exactly as missed sessions decides it.
  const active = ordered.filter((day) => methodDays.has(day.taskId) && !inGap.has(day.taskId) && !heldIds.has(day.taskId));

  // Missed sessions' decisions, kept for every other day (and the gap drops and holds of method days). A step that
  // a reorder put on a day is never carried again: missed sessions knows no shift marker, so its carry is dropped
  // here the way it drops a carried lead (`no_priority_step`).
  const drops: CarryDrop[] = legacy.drops.filter((drop) => !methodDays.has(drop.taskId) || drop.reason === 'in_gap');
  const carries: PlannedCarry[] = [];
  for (const carry of legacy.carries) {
    if (methodDays.has(carry.fromTaskId)) continue;
    if (shiftMarkerOf(carry.step)) drops.push({ taskId: carry.fromTaskId, date: carry.fromDate, reason: 'no_priority_step' });
    else carries.push(carry);
  }
  const legacyCarries = [...carries];
  const claimed = new Set<string>([...carries.map((carry) => carry.toTaskId), ...held.map((item) => item.receivingTaskId)]);
  // A day holding a carried step receives no other carry (ND-13). A reorder's steps do not take a day: a reorder never
  // trims anything but its own kind's step, and an ordinary carry never trims an in-order step.
  // B-53: a moved step whose source day is done and still holds it is hidden (`isDoneCopy`, MR-37), so it takes no day.
  const doneSteps = doneStepsOf(input.days, input.tasks);
  const dayDate = new Map(input.days.map((day) => [day.taskId, day.date]));
  const hidden = (step: CarriedStep, taskId: string) => {
    const date = dayDate.get(taskId);
    return date !== undefined && isDoneCopy(step, { taskId, date }, doneSteps);
  };
  const storedTaken = new Set(
    input.tasks.filter((task) => task.steps.some((step) => markerOf(step) !== null && !hidden(step, task.id))).map((task) => task.id)
  );

  // The rows as they will be written: stored steps plus this run's continue markers and reorders. Ordinary carries
  // stay in `accepted` until the end, so a carry search never reads another day's carry (MR-10).
  const staged = new Map<string, CarriedStep[]>();
  const stagedMinutes = new Map<string, number>();
  const rowOf = (taskId: string) => staged.get(taskId) ?? taskById.get(taskId)?.steps ?? [];
  const minutesNow = (taskId: string) => stagedMinutes.get(taskId) ?? taskById.get(taskId)?.durationMinutes ?? 0;
  const stage = (taskId: string, steps: CarriedStep[], durationMinutes: number) => {
    staged.set(taskId, steps);
    stagedMinutes.set(taskId, durationMinutes);
  };
  const laterInWeek = (from: DayClassification) => ordered.filter((day) => day.weekNumber === from.weekNumber && byDate(day, from) > 0);
  const isClosed = (day: DayClassification) => day.kind === 'done' || day.kind === 'missed' || day.date < input.today;

  // ---- Continue (RULE-10): one marker per continue kind of the day, on the next session this week with that kind.
  const alreadyContinued: ContinuedEarlier[] = [];
  for (const day of ordered) {
    for (const step of taskById.get(day.taskId)?.steps ?? []) {
      const marker = continueMarkerOf(step);
      if (!marker) continue;
      alreadyContinued.push({
        fromTaskId: marker.taskId,
        fromDate: marker.date,
        toTaskId: day.taskId,
        toDate: day.date,
        kind: typeof step.kind === 'string' ? step.kind : null,
        stepTitle: step.title,
      });
    }
  }

  interface ContinueCandidate {
    missed: DayClassification;
    kind: string;
    target: DayClassification;
    stepIndex: number;
  }
  const continueCandidates: ContinueCandidate[] = [];
  for (const missed of active) {
    const kinds = [...new Set(stepsOf.get(missed.taskId)!.filter((s) => MARKS_NEXT_SESSION.has(s.recovery.action)).map((s) => s.step.kind as string))];
    for (const kind of kinds) {
      for (const day of laterInWeek(missed)) {
        if (isRestLike(day) || day.isTestDay) continue;
        const steps = taskById.get(day.taskId)?.steps ?? [];
        const ofKind = steps
          .map((step, index) => ({ step, index }))
          .filter(({ step }) => step.kind === kind)
          .sort((a, b) => (hasPriority(a.step) && hasPriority(b.step) ? byPriority(a.step, b.step) : 0));
        if (ofKind.length === 0) continue;
        continueCandidates.push({ missed, kind, target: day, stepIndex: ofKind[0].index });
        break;
      }
    }
  }
  // ND-12 for markers: when two missed days reach the same step, the most recent wins.
  const latestOnStep = new Map<string, DayClassification>();
  for (const candidate of continueCandidates) latestOnStep.set(`${candidate.target.taskId}#${candidate.stepIndex}`, candidate.missed);

  /** `${missedTaskId}#${kind}` for every continue kind that has (or now gets) its marker. */
  const continuedKinds = new Set<string>();
  for (const earlier of alreadyContinued) if (earlier.kind) continuedKinds.add(`${earlier.fromTaskId}#${earlier.kind}`);
  const plannedContinues: Array<Omit<PlannedContinue, 'steps' | 'durationMinutes'>> = [];
  for (const candidate of continueCandidates) {
    const { missed, kind, target, stepIndex } = candidate;
    const stored = taskById.get(target.taskId)!.steps[stepIndex];
    const marker = continueMarkerOf(stored);
    if (marker) continue; // Written once: its own marker is already counted; another day's means no room.
    if (latestOnStep.get(`${target.taskId}#${stepIndex}`) !== missed) continue;
    if (isClosed(target)) continue;
    // M3.2 review (Mo): a held offer's receiving day never takes a continue marker, so the offer stays open; the
    // continue is no room, as for a closed or already-marked session (RULE-10).
    if (heldReceiving.has(target.taskId)) continue;
    // A day that receives a missed-sessions carry in this run is written by that carry alone.
    if (carries.some((carry) => carry.toTaskId === target.taskId)) continue;
    const next = [...rowOf(target.taskId)];
    // B-38: a restart kind's marker says the session starts the process again.
    const restart = profile?.kinds.some((item) => item.id === kind && item.action === 'restart') === true;
    next[stepIndex] = { ...next[stepIndex], continueFrom: { taskId: missed.taskId, date: missed.date, ...(restart ? { restart: true as const } : {}) } };
    stage(target.taskId, next, minutesNow(target.taskId));
    continuedKinds.add(`${missed.taskId}#${kind}`);
    plannedContinues.push({ fromTaskId: missed.taskId, fromDate: missed.date, toTaskId: target.taskId, toDate: target.date, kind, stepTitle: stored.title });
  }

  // ---- What a move may do, for a reorder and for an ordinary carry alike.
  const accepted = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  const legacyRows = new Map(carries.map((carry) => [carry.toTaskId, carry.steps]));
  const dateOf = new Map(ordered.map((day) => [day.taskId, day.date]));

  // Never replaced: a fixed step (MR-17), a continue-marked step (RULE-10) or a step that landed by a swap (ND-18).
  const isKept = (step: CarriedStep) => !!continueMarkerOf(step) || isFixedStep(step, profile) || swapMarkerOf(step) !== null;
  const inOrderKinds = new Set((profile?.kinds ?? []).filter((item) => item.inOrder).map((item) => item.id));
  // Never trimmed to make room: those, and any step of an in-order kind (a carry or a reorder never removes a lesson).
  const isProtected = (step: CarriedStep) => isKept(step) || (typeof step.kind === 'string' && inOrderKinds.has(step.kind));
  // RULE-14: hard by the step's kind (high-load included), or for a step without a known kind by today's test.
  const isHard = (step: CarriedStep) => isHardStep(step, profile, input.goal);
  // MR-31 (2): the warm-up line only on a hard step, or on any step of an endurance or strength goal.
  const isPhysical = (step: CarriedStep) => isHard(step) || PHYSICAL_TEMPLATES.has(profile?.template ?? '');
  const restGap = profile?.restGapDays ?? 0;

  /**
   * RULE-14: no moved hard step has another hard step within the rest gap, in full calendar days, on its own day or
   * any other day of the goal (last week included). Only days that are done or still open count: a missed day's
   * steps did not happen, and that includes the moved step's own missed day. `proposed` holds the rows being tried.
   * A moved step marked `sameDayOnly` adds no new closeness (it took a hard step's place, MR-29), so only its own day
   * is checked: it still never shares that day with another hard step.
   */
  const restGapHolds = (
    proposed: ReadonlyMap<string, CarriedStep[]>,
    moved: ReadonlyArray<{ taskId: string; step: CarriedStep; sameDayOnly?: boolean }>
  ) => {
    // A day being tried is also checked against any carry planned onto it this run and any carried step stored on it
    // (a fit may trim those, but such a day takes nothing), so one run decides as a replan would.
    const view = (taskId: string) => {
      const rows = [proposed.get(taskId), accepted.get(taskId)?.steps, legacyRows.get(taskId)].filter((row): row is CarriedStep[] => !!row);
      return rows.length > 0 ? [...rows.flat(), ...rowOf(taskId).filter((step) => markerOf(step) !== null)] : rowOf(taskId);
    };
    for (const { taskId, step, sameDayOnly } of moved) {
      if (!isHard(step)) continue;
      const at = dayNumberOf(dateOf.get(taskId)!);
      for (const day of ordered) {
        if (!countsForRest(day)) continue;
        if (Math.abs(dayNumberOf(day.date) - at) > (sameDayOnly ? 0 : restGap)) continue;
        // B-53: a hidden step (done on its source day) did not happen here, so it holds no rest gap.
        if (view(day.taskId).some((other) => other !== step && isHard(other) && !hidden(other, day.taskId))) return false;
      }
    }
    return true;
  };

  // ---- In-order move kinds (RULE-20, MR-30): the week's remaining sessions of the kind keep their days and hold, in
  // order, the steps not done yet; the ones left over go to next week. Planned before ordinary carries, which then
  // read the reordered rows, so a replan after the writes reads what this run decided.
  const reorders: PlannedReorder[] = [];
  const reorderRowIds = new Map<PlannedReorder, string[]>();
  /** `${kind}\0${key}` → where a step of the queue ends after this run: on a session, or listed for next week. */
  const queueEnd = new Map<string, 'session' | 'next_week' | 'left_out'>();
  const legacyTargets = new Set(carries.map((carry) => carry.toTaskId));
  const canTrim = (step: CarriedStep) => !isProtected(step) && !isMarkedMove(step) && actionOf(step, profile) !== null;
  const refOf = (item: QueueItem): ReorderStep => ({ taskId: item.origin.taskId, date: item.origin.date, title: item.title });
  /** The step as a reorder places it: as written, without RULE-21's line, with the warm-up line when physical. */
  const placedContent = (item: QueueItem): CarriedStep => {
    const content = asWritten(item.step);
    const instructions = withoutEasyLine(content.instructions);
    return {
      ...content,
      instructions: isPhysical(content) ? withWarmUpLine(instructions) : (instructions as string),
      shiftedFrom: { taskId: item.origin.taskId, date: item.origin.date, replaced: [] },
    };
  };
  const keptSessions = (days: readonly DayClassification[], kind: string): ReorderSession[] =>
    days.map((day) => {
      const step = rowOf(day.taskId).find((s) => s.kind === kind)!;
      const origin = originOf(step, day);
      return { taskId: day.taskId, date: day.date, holds: { taskId: origin.taskId, date: origin.date, title: step.title }, changed: false };
    });

  for (const queue of inOrderQueue({ days: ordered, tasks: input.tasks, profile, today: input.today })) {
    const { kind, weekNumber } = queue;
    if (!queuedWeeks.has(weekNumber)) continue;
    const weekDays = ordered.filter((day) => day.weekNumber === weekNumber && !isRestLike(day) && !day.isTestDay);
    const ofKind = (taskId: string) => rowOf(taskId).filter((step) => step.kind === kind);
    const sessionDays = weekDays.filter((day) => day.kind === 'planned' && day.date >= input.today && ofKind(day.taskId).length > 0);
    const placeable = queue.steps.filter((item) => item.status === 'missed' || item.status === 'session');
    const listed = queue.steps.filter((item) => item.status === 'next_week');
    const queueDays = [...queue.steps.flatMap((item) => (item.at ? [item.at] : [])), ...sessionDays];

    let waits: ReorderWait | null = null;
    // M3.1d: once next week holds some of these steps, this week keeps its sessions as stored.
    const handedOn = queue.handedOn ?? [];
    const usedDays = [...queue.steps.flatMap((item) => (item.status === 'missed' && item.at ? [item.at] : [])), ...sessionDays];
    if (handedOn.length > 0) waits = 'handed_on';
    else if (usedDays.some((day) => ofKind(day.taskId).length > 1)) waits = 'two_in_a_day';
    else if (queue.steps.some((item) => item.status === 'still_open')) waits = 'still_open';
    else if (queueDays.some((day) => heldIds.has(day.taskId)) || sessionDays.some((day) => heldReceiving.has(day.taskId))) waits = 'held';
    else if (queueDays.some((day) => !followsMethod(rowOf(day.taskId), profile))) waits = 'not_tagged';
    else if (sessionDays.some((day) => swapMarkerOf(ofKind(day.taskId)[0]) !== null)) waits = 'swapped';
    else if (sessionDays.some((day) => legacyTargets.has(day.taskId))) waits = 'carried_by_missed_sessions';

    let sessions: ReorderSession[] = [];
    const rows = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
    const rowNow = (taskId: string) => rows.get(taskId)?.steps ?? rowOf(taskId);
    let left: QueueItem[];
    if (waits) {
      // Nothing changes: each session keeps its step, and the missed ones wait in the queue.
      sessions = keptSessions(sessionDays, kind);
      left = queue.steps.filter((item) => item.status === 'missed');
    } else {
      let next = 0;
      let onlyStep = false;
      const queuedKeys = new Set(queue.steps.map((item) => item.key));
      for (const day of sessionDays) {
        const row = rowNow(day.taskId);
        const current = row.find((step) => step.kind === kind)!;
        const item = placeable[next];
        // M3.1d review: a session holding a copy of a step already done elsewhere (a review handed its open day on, then
        // the person did that day) with nothing left to take keeps it when it is its day's only step.
        const currentKey = stepKey(originOf(current, day), current.title);
        if (!item && !queuedKeys.has(currentKey) && row.length === 1) {
          sessions.push({ taskId: day.taskId, date: day.date, holds: { taskId: originOf(current, day).taskId, date: originOf(current, day).date, title: current.title }, changed: false });
          continue;
        }
        if (item && item.key === stepKey(originOf(current, day), current.title)) {
          sessions.push({ taskId: day.taskId, date: day.date, holds: refOf(item), changed: false });
          next += 1;
          continue;
        }
        let placedRow: { steps: CarriedStep[]; durationMinutes: number } | null = null;
        if (item) {
          const incoming = placedContent(item);
          const fit = takePlace({ steps: row, durationMinutes: minutesNow(day.taskId) }, current, incoming, canTrim);
          if (fit) {
            const marker = { ...incoming.shiftedFrom!, replaced: fit.replaced };
            const marked = fit.steps.map((step) => (step.shiftedFrom === incoming.shiftedFrom ? { ...step, shiftedFrom: marker } : step));
            const steps = keepRecords(row, marked, marked.findIndex((step) => step.shiftedFrom === marker));
            const placed = steps.find((step) => step.shiftedFrom === marker)!;
            const proposed = new Map([...rows].map(([taskId, r]) => [taskId, r.steps]));
            proposed.set(day.taskId, steps);
            // MR-29 (5): a step taking the place of a hard step adds no closeness; only its own day is checked.
            if (restGapHolds(proposed, [{ taskId: day.taskId, step: placed, sameDayOnly: row.some(isHard) }])) {
              placedRow = { steps, durationMinutes: fit.durationMinutes };
            }
          }
        }
        if (placedRow) {
          rows.set(day.taskId, placedRow);
          sessions.push({ taskId: day.taskId, date: day.date, holds: refOf(item!), changed: true });
          next += 1;
        } else {
          // MR-30 (5): it cannot take the next step safely, so it gives its own step up (that step stays in the queue,
          // in its place) and the next session is tried. The day only gets shorter, but never empty: when that step is
          // the day's only one, the whole kind waits this run instead.
          const kept = row.filter((step) => step !== current);
          if (kept.length === 0) {
            onlyStep = true;
            break;
          }
          const limit = minutesNow(day.taskId);
          rows.set(day.taskId, { steps: keepRecords(row, renumber(kept), 0), durationMinutes: limit > 0 ? Math.min(limit, minutesOf(kept)) : minutesOf(kept) });
          sessions.push({ taskId: day.taskId, date: day.date, holds: null, changed: true });
        }
      }
      left = placeable.slice(next);
      if (onlyStep) {
        waits = 'only_step';
        rows.clear();
        sessions = keptSessions(sessionDays, kind);
        left = queue.steps.filter((item) => item.status === 'missed');
      }
      // A step taken off its session with no later session left is stored nowhere else, so its record goes on the
      // first missed step of the queue (a missed day exists whenever anything moved), next to any records there.
      const records = left.filter((item) => item.status === 'session').map((item) => ({ taskId: item.origin.taskId, date: item.origin.date, step: asWritten(item.step) }));
      const head = placeable[0];
      if (onlyStep) {
        // Nothing changes for the kind this run.
      } else if (records.length > 0 && (head?.status !== 'missed' || !head.at)) {
        // Cannot happen (a change needs a missed step); keep the stored rows rather than lose a step.
        rows.clear();
        sessions = keptSessions(sessionDays, kind);
        left = queue.steps.filter((item) => item.status === 'missed');
      } else if (records.length > 0) {
        const at = head.at!;
        const steps = rowNow(at.taskId).map((step) =>
          step.kind === kind && stepKey(originOf(step, at), step.title) === head.key
            ? { ...step, toNextWeek: [...(Array.isArray(step.toNextWeek) ? step.toNextWeek : []), ...records] }
            : step
        );
        rows.set(at.taskId, { steps, durationMinutes: minutesNow(at.taskId) });
      }
    }

    for (const [taskId, row] of rows) stage(taskId, row.steps, row.durationMinutes);
    for (const session of sessions) if (session.holds) queueEnd.set(`${kind}\u0000${stepKey(session.holds, session.holds.title)}`, 'session');
    for (const item of queue.steps) if (item.status === 'still_open') queueEnd.set(`${kind}\u0000${item.key}`, 'session');
    // MR-32 (6): the plan's final week has no next week, so its leftovers are left out.
    const finalWeek = weekNumber >= shapeOf(input.goal).weeks;
    for (const item of [...left, ...listed]) queueEnd.set(`${kind}\u0000${item.key}`, finalWeek ? 'left_out' : 'next_week');
    for (const key of handedOn) queueEnd.set(`${kind}\u0000${key}`, 'next_week');
    const leftover = [...left, ...listed].sort(byWritten).map((item) => ({ ...refOf(item), step: asWritten(item.step) }));
    if (rows.size === 0 && leftover.length === 0) continue;
    const reorder: PlannedReorder = finalWeek
      ? { weekNumber, kind, waits, sessions, toNextWeek: [], leftOut: leftover, rows: [] }
      : { weekNumber, kind, waits, sessions, toNextWeek: leftover, rows: [] };
    reorders.push(reorder);
    reorderRowIds.set(reorder, [...rows.keys()]);
  }

  // ---- Move (RULE-9, RULE-14, MR-10, MR-17, MR-18, MR-26, MR-31): the day's highest-priority move step that is not
  // of an in-order move kind. A search reads the week as written plus its stored markers, this run's continue markers
  // and reorders (MR-10), never another day's carry, so it ends the same way every time. The rest gap also sees every
  // carry this run has already accepted. Missed days are planned most recent first, so ND-12 (most recent wins) is
  // decided when an older day reaches a receiving day that a later one already reached.
  const drop = (day: DayClassification, reason: DropReason) => drops.push({ taskId: day.taskId, date: day.date, reason });
  /** Why a receiving day can take nothing (MR-10: closed, done or taken), or null when it is open. */
  const closedReason = (day: DayClassification): DropReason | null => {
    if (day.kind === 'done') return 'receiving_day_done';
    if (day.kind === 'missed') return 'receiving_day_closed';
    if (storedTaken.has(day.taskId) || claimed.has(day.taskId)) return 'receiving_day_taken';
    if (day.date < input.today) return 'receiving_day_closed';
    return null;
  };

  const reachedBy = new Map<string, DayClassification>();
  const methodCarries: PlannedCarry[] = [];
  for (const missed of [...active].reverse()) {
    const mover = stepsOf.get(missed.taskId)!.find((s) => s.recovery.action === 'move' && !s.queued);
    if (!mover) continue;
    const { carriedFrom: _ignored, ...content } = mover.step;
    const marker: CarryMarker = { taskId: missed.taskId, date: missed.date, replaced: [] };
    const carried: CarriedStep = { ...content, instructions: isPhysical(content) ? withWarmUpLine(content.instructions) : content.instructions, carriedFrom: marker };
    const kind = profile!.kinds.find((item) => item.id === mover.step.kind);
    // B-39: a step with an outside deadline moves only to a day on or before it, earliest first.
    const due = mover.step.dueDate;
    const practiceLater = laterInWeek(missed).filter((day) => !isRestLike(day) && !day.isTestDay && (!due || day.date <= due));
    // RULE-13 for an in-order kind that is not a move kind (a high-load continue step moves, MR-11): it lands only
    // before the next session of its kind, never on or after it.
    const nextOfKind = kind?.inOrder ? practiceLater.find((day) => rowOf(day.taskId).some((step) => step.kind === kind.id)) : undefined;

    // RULE-9: the first later practice day that passes. Reaching the next session of an in-order kind ends the search
    // on that day: closed, done or taken is that reason, open is no room (nothing is ever placed after it).
    let found: { receiving: DayClassification; fit: NonNullable<ReturnType<typeof fitCarriedStep>> | null } | null = null;
    for (const day of practiceLater) {
      if (day === nextOfKind) {
        found = { receiving: day, fit: null };
        break;
      }
      const fit = fitCarriedStep({ steps: rowOf(day.taskId), durationMinutes: minutesNow(day.taskId) }, carried, isProtected);
      if (!fit) continue;
      const placed = fit.steps.find((step) => step.carriedFrom === marker)!;
      if (!restGapHolds(new Map([[day.taskId, fit.steps]]), [{ taskId: day.taskId, step: placed }])) continue;
      found = { receiving: day, fit };
      break;
    }
    if (!found) {
      drop(missed, due && due < input.today ? 'due_date_passed' : 'no_receiving_day');
      continue;
    }
    const { receiving, fit } = found;
    if (reachedBy.has(receiving.taskId)) {
      drop(missed, 'lost_to_later_miss');
      continue;
    }
    reachedBy.set(receiving.taskId, missed);
    const closed = closedReason(receiving);
    if (closed) {
      // B-39 review: the last day before a deadline that has passed is closed: the date passed, not just no room.
      drop(missed, due && due < input.today ? 'due_date_passed' : closed);
      continue;
    }
    if (!fit) {
      drop(missed, 'no_receiving_day');
      continue;
    }
    const marked = fit.steps.map((step) => (step.carriedFrom === marker ? { ...step, carriedFrom: { ...marker, replaced: fit.replaced } } : step));
    const steps = keepRecords(rowOf(receiving.taskId), marked, marked.findIndex((step) => markerOf(step)?.taskId === missed.taskId));
    accepted.set(receiving.taskId, { steps, durationMinutes: fit.durationMinutes });
    claimed.add(receiving.taskId);
    methodCarries.push({
      fromTaskId: missed.taskId,
      fromDate: missed.date,
      toTaskId: receiving.taskId,
      toDate: receiving.date,
      step: steps.find((step) => markerOf(step)?.taskId === missed.taskId)!,
      replaced: fit.replaced,
      steps,
      durationMinutes: fit.durationMinutes,
    });
  }

  const byFromDate = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);
  methodCarries.sort((a, b) => byFromDate(a.fromDate, b.fromDate));
  carries.push(...methodCarries);
  for (const [taskId, row] of accepted) stage(taskId, row.steps, row.durationMinutes);
  for (const carry of legacyCarries) if (!staged.has(carry.toTaskId)) stage(carry.toTaskId, carry.steps, carry.durationMinutes);

  // ---- RULE-21 (MR-31 (1)): after an open gap, the first hard step on the first open practice day this week after
  // the gap that has a hard step starts with the easy line, once. Read from the rows as they will be written. MR-32 (5):
  // when the test day is the first open practice day back, its hard test step takes the line; otherwise the test day
  // is skipped as before.
  let easyStart: PlannedEasyStart | null = null;
  const easyTarget = easyLineTarget({ days: ordered, gap: input.gap, today: input.today, profile }, rowOf);
  // M1.5a (WU-35 (2)): a step holding the first-week-back line never also gets RULE-21's line.
  const targetStep = easyTarget ? rowOf(easyTarget.day.taskId)[easyTarget.index] : null;
  if (easyTarget && targetStep && !hasEasyLine(targetStep) && !hasFirstWeekBackLine(targetStep)) {
    const { day, index } = easyTarget;
    const row = rowOf(day.taskId);
    const steps = row.map((step, i) => (i === index ? { ...step, instructions: withEasyLine(step.instructions) } : step));
    stage(day.taskId, steps, minutesNow(day.taskId));
    easyStart = { taskId: day.taskId, date: day.date, stepTitle: row[index].title, steps, durationMinutes: minutesNow(day.taskId) };
  }

  // Each changed row is written whole, so every plan entry for a day carries that day's final row.
  const finalCarries = carries.map((carry) => {
    if (!staged.has(carry.toTaskId)) return carry;
    const steps = rowOf(carry.toTaskId);
    return { ...carry, steps, durationMinutes: minutesNow(carry.toTaskId), step: steps.find((step) => markerOf(step)?.taskId === carry.fromTaskId) ?? carry.step };
  });
  const continues: PlannedContinue[] = plannedContinues.map((item) => ({ ...item, steps: rowOf(item.toTaskId), durationMinutes: minutesNow(item.toTaskId) }));
  for (const reorder of reorders) {
    reorder.rows = reorderRowIds.get(reorder)!.map((taskId) => ({ taskId, steps: rowOf(taskId), durationMinutes: minutesNow(taskId) }));
  }

  // ---- What each missed day followed (RULE-15, RULE-17). Carried days stay listed while their marker is stored.
  const movedNow = new Set(carries.map((carry) => carry.fromTaskId));
  /**
   * Where a step of an in-order move kind on `day` ended: on a later session or done (moved), next week (handed on
   * included), or left out in the final week.
   */
  const queuedOutcome = (s: DayStep, day: DayClassification): RecoveryOutcome => {
    const end = queueEnd.get(`${s.step.kind}\u0000${stepKey(originOf(s.step, day), s.step.title)}`);
    return end === 'next_week' || end === 'left_out' ? end : 'moved';
  };
  const outcomes: DayOutcome[] = [];
  for (const day of ordered) {
    if (swapHandled.has(day.taskId)) continue;
    if (day.kind !== 'missed' && !carrySources.has(day.taskId)) continue;
    const carried = carrySources.has(day.taskId) || movedNow.has(day.taskId);
    const steps = stepsOf.get(day.taskId);
    const rules: RecoveryRules = steps && (methodDays.has(day.taskId) || carrySources.has(day.taskId)) ? 'method' : 'missed_sessions';
    // A gap day keeps `in_gap`, even when its in-order steps found a session (RULE-20, ND-11).
    if (!carried && inGap.has(day.taskId)) {
      outcomes.push({ taskId: day.taskId, date: day.date, rules, outcome: 'in_gap', topStep: 'in_gap' });
      continue;
    }
    if (!steps || rules === 'missed_sessions') {
      const outcome: RecoveryOutcome = carried ? 'moved' : heldIds.has(day.taskId) ? 'held' : 'no_room';
      outcomes.push({ taskId: day.taskId, date: day.date, rules: 'missed_sessions', outcome, topStep: outcome });
      continue;
    }
    if (heldIds.has(day.taskId)) {
      outcomes.push({ taskId: day.taskId, date: day.date, rules: 'method', outcome: 'held', topStep: 'held' });
      continue;
    }
    const moved = carried || steps.some((s) => s.queued && queuedOutcome(s, day) === 'moved');
    const top = steps[0];
    let topStep: RecoveryOutcome;
    if (top.queued) topStep = queuedOutcome(top, day);
    else {
      switch (top.recovery.action) {
        case 'move':
          // The top step is the day's highest-priority ordinary move step, so it is the one that moved, if any did.
          topStep = carried ? 'moved' : drops.some((item) => item.taskId === day.taskId && item.reason === 'due_date_passed') ? 'due_passed' : 'no_room';
          break;
        case 'continue':
        case 'restart':
          topStep = continuedKinds.has(`${day.taskId}#${top.step.kind}`) ? 'continued' : 'no_room';
          break;
        case 'let_go':
          topStep = 'let_go';
          break;
        default:
          topStep = 'fixed';
      }
    }
    const restart = !top.queued && top.recovery.action === 'restart' && topStep === 'continued';
    outcomes.push({ taskId: day.taskId, date: day.date, rules: 'method', outcome: moved ? 'moved' : topStep, topStep, ...(restart ? { restart: true as const } : {}) });
  }

  drops.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  return { carries: finalCarries, drops, held, alreadyCarried: legacy.alreadyCarried, continues, alreadyContinued, outcomes, reorders, easyStart };
}
