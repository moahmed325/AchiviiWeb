/**
 * Method-aware recovery, M3.1a: the carry planner when a missed day's steps follow their kinds' actions
 * (RULE-9 move, RULE-10 continue, RULE-11 let go, RULE-12 fixed), plus what each missed day followed (RULE-15).
 * Pure: no database, no clock, no environment. `reconcileCore.ts` passes `method` only when
 * `METHOD_RECOVERY_ENABLED` is exactly `true`; without it this returns missed sessions' plan untouched.
 *
 * A missed day follows the new rules only when the goal has a valid profile and every step of the day has a known
 * kind and a priority (RULE-18, MR-6). Every other day keeps exactly what missed sessions' planner (`planCarries`)
 * decides for it, run on the same input. What stays as today for every day: the open gap (ND-11), handled days
 * (ND-13, ND-18), receiving days before today counted as closed, and the key-session hold (ND-9).
 *
 * Until M3.1b (MR-27): a hard step that would move goes to no room, and an in-order step moves only to a day
 * before the next step of its kind.
 * Rules: docs/features/method-aware-recovery/02-feature.md section 4; decisions MR-10, MR-12, MR-17, MR-26, MR-27.
 */
import {
  fitCarriedStep,
  handledTaskIds,
  planCarries,
  type CarriedStep,
  type CarryDrop,
  type CarryInput,
  type CarryPlan,
  type CarryTask,
  type DropReason,
  type PlannedCarry,
} from '../carryForward.js';
import type { DayClassification } from '../missedSessions.js';
import { actionOf, type RecoveryProfile, type StepRecovery } from './profile.js';

/** MR-26: put first in every moved step's instructions, once. */
export const MOVED_WARM_UP_LINE = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

/** Which rules a missed day followed (RULE-18). */
export type RecoveryRules = 'method' | 'missed_sessions';

/**
 * What happened to a missed day. `held` is the key-session swap offer that stays as today (ND-9; M3.2 owns swaps).
 * For a day under missed sessions' rules, `moved` is a carry and `no_room` any drop; P3's lines for those stay as
 * today.
 */
export type RecoveryOutcome = 'moved' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'held';

export interface DayOutcome {
  taskId: string;
  date: string;
  rules: RecoveryRules;
  /** The day's line (RULE-15, MR-12): `moved` if anything moved, otherwise its highest-priority step's outcome. */
  outcome: RecoveryOutcome;
  /** The outcome of the day's highest-priority step alone, which the week counts read (RULE-17). */
  topStep: RecoveryOutcome;
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

/** Missed sessions' plan; the three method fields are present only when the method switch is on. */
export interface RecoveryPlan extends CarryPlan {
  continues?: PlannedContinue[];
  alreadyContinued?: ContinuedEarlier[];
  outcomes?: DayOutcome[];
}

export interface RecoveryInput extends CarryInput {
  /** Present only when `METHOD_RECOVERY_ENABLED` is on. A null profile means RULE-18 for every day. */
  method?: { profile: RecoveryProfile | null };
}

const hasPriority = (step: CarriedStep): boolean => typeof step.priority === 'number' && Number.isFinite(step.priority);
const byPriority = (a: CarriedStep, b: CarriedStep) => (a.priority as number) - (b.priority as number);

function byDate(a: DayClassification, b: DayClassification): number {
  return a.date === b.date ? a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1;
}

function continueMarkerOf(step: CarriedStep) {
  const marker = step.continueFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}

const hasCarryMarker = (step: CarriedStep) =>
  !!step.carriedFrom && typeof step.carriedFrom === 'object' && typeof step.carriedFrom.taskId === 'string';

/** MR-26: the line goes first, once; the minutes do not change. */
export function withWarmUpLine(instructions: unknown): string {
  const text = typeof instructions === 'string' ? instructions : '';
  if (text.startsWith(MOVED_WARM_UP_LINE)) return text;
  return text.trim() ? `${MOVED_WARM_UP_LINE}\n${text}` : MOVED_WARM_UP_LINE;
}

/** Each step's recovery, or null when the day does not follow the new rules (RULE-18). */
function methodSteps(task: CarryTask | undefined, profile: RecoveryProfile | null): Array<{ step: CarriedStep; recovery: StepRecovery }> | null {
  if (!profile || !task || task.steps.length === 0) return null;
  const out: Array<{ step: CarriedStep; recovery: StepRecovery }> = [];
  for (const step of task.steps) {
    if (!hasPriority(step)) return null;
    const recovery = actionOf(step, profile);
    if (!recovery) return null;
    out.push({ step, recovery });
  }
  return out.sort((a, b) => byPriority(a.step, b.step));
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

  const ordered = [...input.days].sort(byDate);
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const handled = handledTaskIds(input.tasks);
  const swapHandled = new Set<string>();
  for (const task of input.tasks) {
    for (const step of task.steps) {
      const swapped = step.swappedFrom;
      if (swapped && typeof swapped === 'object' && typeof swapped.taskId === 'string') {
        swapHandled.add(swapped.taskId);
        swapHandled.add(task.id);
      }
    }
  }
  const carrySources = new Set(legacy.alreadyCarried.map((carry) => carry.fromTaskId));
  const inGap = new Set(input.gap?.taskIds ?? []);
  const heldIds = new Set(legacy.held.map((held) => held.taskId));

  // Which days follow the new rules (requirement 2): every step known, priorities present.
  const stepsOf = new Map<string, Array<{ step: CarriedStep; recovery: StepRecovery }>>();
  for (const day of ordered) {
    const steps = methodSteps(taskById.get(day.taskId), profile);
    if (steps) stepsOf.set(day.taskId, steps);
  }
  const methodDays = new Set(ordered.filter((day) => day.kind === 'missed' && !handled.has(day.taskId) && stepsOf.has(day.taskId)).map((day) => day.taskId));
  // The open gap and the key-session hold stay exactly as missed sessions decides them.
  const active = ordered.filter((day) => methodDays.has(day.taskId) && !inGap.has(day.taskId) && !heldIds.has(day.taskId));

  // Missed sessions' decisions, kept for every other day (and the gap drops and holds of method days).
  const carries: PlannedCarry[] = legacy.carries.filter((carry) => !methodDays.has(carry.fromTaskId));
  const drops: CarryDrop[] = legacy.drops.filter((drop) => !methodDays.has(drop.taskId) || drop.reason === 'in_gap');
  const claimed = new Set<string>([...carries.map((carry) => carry.toTaskId), ...legacy.held.map((held) => held.receivingTaskId)]);
  const storedTaken = new Set(input.tasks.filter((task) => task.steps.some(hasCarryMarker)).map((task) => task.id));

  // The receiving rows as they will be written: stored steps plus this run's markers.
  const staged = new Map<string, CarriedStep[]>();
  const stepsNow = (taskId: string) => staged.get(taskId) ?? taskById.get(taskId)?.steps ?? [];
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
    const kinds = [...new Set(stepsOf.get(missed.taskId)!.filter((s) => s.recovery.action === 'continue').map((s) => s.step.kind as string))];
    for (const kind of kinds) {
      for (const day of laterInWeek(missed)) {
        if (day.kind === 'rest' || day.isTestDay) continue;
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
    // A day that receives a missed-sessions carry in this run is written by that carry alone.
    if (carries.some((carry) => carry.toTaskId === target.taskId)) continue;
    const next = [...stepsNow(target.taskId)];
    next[stepIndex] = { ...next[stepIndex], continueFrom: { taskId: missed.taskId, date: missed.date } };
    staged.set(target.taskId, next);
    continuedKinds.add(`${missed.taskId}#${kind}`);
    plannedContinues.push({ fromTaskId: missed.taskId, fromDate: missed.date, toTaskId: target.taskId, toDate: target.date, kind, stepTitle: stored.title });
  }

  // ---- Move (RULE-9, MR-10, MR-17, MR-26, MR-27): the day's highest-priority move step.
  const isProtected = (step: CarriedStep) => !!continueMarkerOf(step) || actionOf(step, profile)?.action === 'fixed';
  const drop = (day: DayClassification, reason: DropReason) => drops.push({ taskId: day.taskId, date: day.date, reason });

  interface MoveContender {
    missed: DayClassification;
    receiving: DayClassification;
    fit: NonNullable<ReturnType<typeof fitCarriedStep>>;
    carried: CarriedStep;
  }
  const contenders: MoveContender[] = [];
  for (const missed of active) {
    const mover = stepsOf.get(missed.taskId)!.find((s) => s.recovery.action === 'move');
    if (!mover) continue;
    if (mover.recovery.hard) {
      drop(missed, 'hard_waits');
      continue;
    }
    const { carriedFrom: _ignored, ...content } = mover.step;
    const carried: CarriedStep = {
      ...content,
      instructions: withWarmUpLine(content.instructions),
      carriedFrom: { taskId: missed.taskId, date: missed.date, replaced: [] },
    };
    const later = laterInWeek(missed);
    let found: { receiving: DayClassification; fit: MoveContender['fit'] } | null = null;
    for (const day of later) {
      if (day.kind === 'rest' || day.isTestDay) continue;
      const fit = fitCarriedStep({ steps: stepsNow(day.taskId), durationMinutes: taskById.get(day.taskId)?.durationMinutes ?? 0 }, carried, isProtected);
      if (fit) {
        found = { receiving: day, fit };
        break;
      }
    }
    if (!found) {
      drop(missed, 'no_receiving_day');
      continue;
    }
    const kind = profile!.kinds.find((item) => item.id === mover.step.kind);
    if (kind?.inOrder) {
      const upTo = later.filter((day) => byDate(day, found!.receiving) <= 0);
      if (upTo.some((day) => (taskById.get(day.taskId)?.steps ?? []).some((step) => step.kind === kind.id))) {
        drop(missed, 'out_of_order');
        continue;
      }
    }
    contenders.push({ missed, receiving: found.receiving, fit: found.fit, carried });
  }

  // ND-12: per receiving day, only the most recent missed day competes.
  const latest = new Map<string, DayClassification>();
  for (const { missed, receiving } of contenders) latest.set(receiving.taskId, missed);

  const methodCarries: PlannedCarry[] = [];
  for (const { missed, receiving, fit, carried } of contenders) {
    if (latest.get(receiving.taskId) !== missed) drop(missed, 'lost_to_later_miss');
    else if (receiving.kind === 'done') drop(missed, 'receiving_day_done');
    else if (receiving.kind === 'missed') drop(missed, 'receiving_day_closed');
    else if (storedTaken.has(receiving.taskId) || claimed.has(receiving.taskId)) drop(missed, 'receiving_day_taken');
    else if (receiving.date < input.today) drop(missed, 'receiving_day_closed');
    else {
      const steps = fit.steps.map((step) =>
        step.carriedFrom === carried.carriedFrom ? { ...step, carriedFrom: { ...carried.carriedFrom!, replaced: fit.replaced } } : step
      );
      staged.set(receiving.taskId, steps);
      claimed.add(receiving.taskId);
      methodCarries.push({
        fromTaskId: missed.taskId,
        fromDate: missed.date,
        toTaskId: receiving.taskId,
        toDate: receiving.date,
        step: steps.find((step) => step.carriedFrom?.taskId === missed.taskId)!,
        replaced: fit.replaced,
        steps,
        durationMinutes: fit.durationMinutes,
      });
    }
  }
  carries.push(...methodCarries);

  // Each receiving row is written whole, so a continue shares the carry's row when both land on one day.
  const durationOf = (taskId: string) =>
    carries.find((carry) => carry.toTaskId === taskId)?.durationMinutes ?? taskById.get(taskId)?.durationMinutes ?? 0;
  const continues: PlannedContinue[] = plannedContinues.map((item) => ({
    ...item,
    steps: stepsNow(item.toTaskId),
    durationMinutes: durationOf(item.toTaskId),
  }));

  // ---- What each missed day followed (RULE-15, RULE-17). Carried days stay listed while their marker is stored.
  const movedNow = new Set(carries.map((carry) => carry.fromTaskId));
  const outcomes: DayOutcome[] = [];
  for (const day of ordered) {
    if (swapHandled.has(day.taskId)) continue;
    if (day.kind !== 'missed' && !carrySources.has(day.taskId)) continue;
    const moved = carrySources.has(day.taskId) || movedNow.has(day.taskId);
    const steps = stepsOf.get(day.taskId);
    if (!steps || !(methodDays.has(day.taskId) || carrySources.has(day.taskId))) {
      const outcome: RecoveryOutcome = moved ? 'moved' : heldIds.has(day.taskId) ? 'held' : 'no_room';
      outcomes.push({ taskId: day.taskId, date: day.date, rules: 'missed_sessions', outcome, topStep: outcome });
      continue;
    }
    if (heldIds.has(day.taskId)) {
      outcomes.push({ taskId: day.taskId, date: day.date, rules: 'method', outcome: 'held', topStep: 'held' });
      continue;
    }
    const top = steps[0];
    let topStep: RecoveryOutcome;
    switch (top.recovery.action) {
      case 'move':
        // The top step is the day's highest-priority move step, so it is the one that moved, if any did.
        topStep = moved ? 'moved' : 'no_room';
        break;
      case 'continue':
        topStep = continuedKinds.has(`${day.taskId}#${top.step.kind}`) ? 'continued' : 'no_room';
        break;
      case 'let_go':
        topStep = 'let_go';
        break;
      default:
        topStep = 'fixed';
    }
    outcomes.push({ taskId: day.taskId, date: day.date, rules: 'method', outcome: moved ? 'moved' : topStep, topStep });
  }

  drops.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  return { carries, drops, held: legacy.held, alreadyCarried: legacy.alreadyCarried, continues, alreadyContinued, outcomes };
}
