/**
 * Method-aware recovery, M3.1a and M3.1b: the carry planner when a missed day's steps follow their kinds' actions
 * (RULE-9 move, RULE-10 continue, RULE-11 let go, RULE-12 fixed), plus what each missed day followed (RULE-15).
 * Pure: no database, no clock, no environment. `reconcileCore.ts` passes `method` only when
 * `METHOD_RECOVERY_ENABLED` is exactly `true`; without it this returns missed sessions' plan untouched.
 *
 * A missed day follows the new rules only when the goal has a valid profile and every step of the day has a known
 * kind and a priority (RULE-18, MR-6). Every other day keeps exactly what missed sessions' planner (`planCarries`)
 * decides for it, run on the same input. What stays as today for every day: the open gap (ND-11), handled days
 * (ND-13, ND-18), receiving days before today counted as closed, and the key-session hold (ND-9).
 *
 * M3.1b: a moved hard step keeps the rest gap (RULE-14), and an in-order step keeps its kind's order (RULE-13): it
 * lands before the next step of its kind, or takes that step's place and shifts the later ones one session on.
 * Rules: docs/features/method-aware-recovery/02-feature.md section 4; decisions MR-10, MR-12, MR-17, MR-18, MR-26,
 * MR-27, MR-28.
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
  type ShiftMarker,
} from '../carryForward.js';
import type { DetailedStep } from '../ai/goalDecomposer.js';
import { isHighLoadStep } from '../highLoad.js';
import type { DayClassification } from '../missedSessions.js';
import { actionOf, type RecoveryProfile, type StepRecovery } from './profile.js';

/** MR-26: put first in every moved step's instructions, once. */
export const MOVED_WARM_UP_LINE = 'Start with an easy 5-minute warm-up and end with 5 easy minutes.';

/** Which rules a missed day followed (RULE-18). */
export type RecoveryRules = 'method' | 'missed_sessions';

/**
 * What happened to a missed day. `held` is the key-session swap offer that stays as today (ND-9; M3.2 owns swaps).
 * `in_gap` is a day of the open gap (ND-11): nothing is carried or marked, the gentle return speaks for it, and it
 * is in none of the RULE-17 counts. For a day under missed sessions' rules, `moved` is a carry and `no_room` any
 * other drop; P3's lines for those stay as today.
 */
export type RecoveryOutcome = 'moved' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'held' | 'in_gap';

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

/** One step moved by an order shift (RULE-13). `toTaskId` and `toDate` are null for the step pushed past the week. */
export interface ShiftedStep {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string | null;
  toDate: string | null;
  kind: string;
  stepTitle: string;
}

/**
 * An order shift (RULE-13): the missed day's in-order step took the place of the next step of its kind (that carry
 * is in `carries`), and every later step of the kind this week moved one session on. Saved together or not at all.
 */
export interface PlannedShift {
  missedTaskId: string;
  missedDate: string;
  /** The in-order kind's id. */
  kind: string;
  /** The day whose step the missed step took over: the carry's receiving day. */
  receivingTaskId: string;
  /** Each step that moved one session on, in order; the last is the one pushed past the week. */
  steps: ShiftedStep[];
  /** Every other changed day's full new row (the receiving day's row is the carry's). */
  rows: Array<{ taskId: string; steps: CarriedStep[]; durationMinutes: number }>;
}

/** Missed sessions' plan; the method fields are present only when the method switch is on. */
export interface RecoveryPlan extends CarryPlan {
  continues?: PlannedContinue[];
  alreadyContinued?: ContinuedEarlier[];
  outcomes?: DayOutcome[];
  shifts?: PlannedShift[];
}

export interface RecoveryInput extends CarryInput {
  /** Present only when `METHOD_RECOVERY_ENABLED` is on. A null profile means RULE-18 for every day. */
  method?: { profile: RecoveryProfile | null };
}

const byPriority = (a: CarriedStep, b: CarriedStep) => (a.priority as number) - (b.priority as number);

function continueMarkerOf(step: CarriedStep) {
  const marker = step.continueFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}

/** The step's `shiftedFrom` marker (RULE-13), or null. */
export function shiftMarkerOf(step: CarriedStep): ShiftMarker | null {
  const marker = step.shiftedFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}

/** A step that came from another day by a carry or a shift: never carried or shifted again (ND-13). */
const isMarkedMove = (step: CarriedStep) => markerOf(step) !== null || shiftMarkerOf(step) !== null;

/** A 'YYYY-MM-DD' date as a whole day count, for calendar-day distances. */
const dayNumberOf = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

const minutesOf = (steps: readonly CarriedStep[]) => steps.reduce((sum, step) => sum + Math.max(0, step.durationMinutes || 0), 0);

/** The step as written: without any marker. */
function asWritten(step: CarriedStep): DetailedStep {
  const { carriedFrom: _c, shiftedFrom: _s, continueFrom: _n, swappedFrom: _w, ...content } = step;
  return content;
}

/**
 * RULE-13: `incoming` takes `displaced`'s place (position and priority) on the receiving day. When it is longer,
 * the day's lowest-priority steps that `canTrim` allows are removed, lowest first, so the day never gets longer
 * (as `fitCarriedStep`; its priority-1 step is never removed). Null when it cannot fit. Priorities are renumbered in
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

  const kept = row.filter((step) => !removed.has(step));
  const ranked = kept.filter((step) => step.priority !== 0).sort((a, b) => (a.priority as number) - (b.priority as number));
  const priorityOf = new Map(ranked.map((step, index) => [step, index + 1]));
  return {
    steps: kept.map((step, index) => ({ ...step, stepNumber: index + 1, priority: priorityOf.get(step) ?? 0 })),
    replaced: [displaced, ...steps.filter((step) => removed.has(step))].map(asWritten),
    durationMinutes: total,
  };
}

/** MR-26: the line goes first, once; the minutes do not change. */
export function withWarmUpLine(instructions: unknown): string {
  const text = typeof instructions === 'string' ? instructions : '';
  if (text.startsWith(MOVED_WARM_UP_LINE)) return text;
  return text.trim() ? `${MOVED_WARM_UP_LINE}\n${text}` : MOVED_WARM_UP_LINE;
}

/**
 * The day's own steps with their recovery, highest priority first, or null when the day does not follow the new
 * rules (RULE-18): a step without a priority or a known kind, or no own step at all. A step carried onto the day
 * (`carriedFrom`) or shifted onto it (`shiftedFrom`) is never carried again (ND-13, as `planCarries`), so it is left
 * behind: it is not the day's move step, its top step or a continue source, and it counts for nothing.
 */
function methodSteps(task: CarryTask | undefined, profile: RecoveryProfile | null): Array<{ step: CarriedStep; recovery: StepRecovery }> | null {
  if (!profile || !task || task.steps.length === 0) return null;
  const out: Array<{ step: CarriedStep; recovery: StepRecovery }> = [];
  for (const step of task.steps) {
    if (!hasPriority(step)) return null;
    const recovery = actionOf(step, profile);
    if (!recovery) return null;
    if (!isMarkedMove(step)) out.push({ step, recovery });
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

  const ordered = [...input.days].sort(byDate);
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const handled = handledTaskIds(input.tasks);
  const swapHandled = swappedTaskIds(input.tasks);
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

  // Missed sessions' decisions, kept for every other day (and the gap drops and holds of method days). A step that
  // was shifted onto a day is never carried again: missed sessions knows no shift marker, so its carry is dropped
  // here the way it drops a carried lead (`no_priority_step`).
  const drops: CarryDrop[] = legacy.drops.filter((drop) => !methodDays.has(drop.taskId) || drop.reason === 'in_gap');
  const carries: PlannedCarry[] = [];
  for (const carry of legacy.carries) {
    if (methodDays.has(carry.fromTaskId)) continue;
    if (shiftMarkerOf(carry.step)) drops.push({ taskId: carry.fromTaskId, date: carry.fromDate, reason: 'no_priority_step' });
    else carries.push(carry);
  }
  const claimed = new Set<string>([...carries.map((carry) => carry.toTaskId), ...legacy.held.map((held) => held.receivingTaskId)]);
  // A day holding a carried or shifted step receives nothing more (ND-13).
  const storedTaken = new Set(input.tasks.filter((task) => task.steps.some(isMarkedMove)).map((task) => task.id));

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

  // ---- Move (RULE-9, RULE-13, RULE-14, MR-10, MR-17, MR-18, MR-26): the day's highest-priority move step.
  // A search reads the week as written plus its stored markers and this run's continue markers (MR-10), never another
  // day's carry, so it ends the same way every time. The rest gap also sees every carry and shift this run has
  // already accepted. Missed days are planned most recent first, so ND-12 (most recent wins) is decided when an
  // older day reaches a receiving day that a later one already reached.
  const searchRows = new Map(staged);
  const rowOf = (taskId: string) => searchRows.get(taskId) ?? taskById.get(taskId)?.steps ?? [];
  const storedMinutes = (taskId: string) => taskById.get(taskId)?.durationMinutes ?? 0;
  const accepted = new Map<string, { steps: CarriedStep[]; durationMinutes: number }>();
  const legacyRows = new Map(carries.map((carry) => [carry.toTaskId, carry.steps]));
  const dateOf = new Map(ordered.map((day) => [day.taskId, day.date]));

  // Never replaced: a fixed step (MR-17), a continue-marked step (RULE-10) or a step that landed by a swap (ND-18).
  const isKept = (step: CarriedStep) => !!continueMarkerOf(step) || actionOf(step, profile)?.action === 'fixed' || swapMarkerOf(step) !== null;
  const inOrderKinds = new Set((profile?.kinds ?? []).filter((item) => item.inOrder).map((item) => item.id));
  // Never trimmed to make room: those, and any step of an in-order kind (RULE-13: a carry never removes a lesson).
  const isProtected = (step: CarriedStep) => isKept(step) || (typeof step.kind === 'string' && inOrderKinds.has(step.kind));
  // RULE-14: hard by the step's kind (high-load included), or for a step without a known kind by today's test.
  const isHard = (step: CarriedStep) => {
    const recovery = actionOf(step, profile);
    return recovery ? recovery.hard : isHighLoadStep(step, input.goal);
  };
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
    // A day being tried is also checked against any carry planned onto it this run and any carried or shifted step
    // stored on it (a fit may trim those, but such a day takes nothing), so one run decides as a replan would.
    const view = (taskId: string) => {
      const rows = [proposed.get(taskId), accepted.get(taskId)?.steps, legacyRows.get(taskId)].filter((row): row is CarriedStep[] => !!row);
      return rows.length > 0 ? [...rows.flat(), ...rowOf(taskId).filter(isMarkedMove)] : rowOf(taskId);
    };
    for (const { taskId, step, sameDayOnly } of moved) {
      if (!isHard(step)) continue;
      const at = dayNumberOf(dateOf.get(taskId)!);
      for (const day of ordered) {
        if (day.kind !== 'done' && day.kind !== 'planned') continue;
        if (Math.abs(dayNumberOf(day.date) - at) > (sameDayOnly ? 0 : restGap)) continue;
        if (view(day.taskId).some((other) => other !== step && isHard(other))) return false;
      }
    }
    return true;
  };

  const drop = (day: DayClassification, reason: DropReason) => drops.push({ taskId: day.taskId, date: day.date, reason });
  /** Why a receiving day can take nothing (MR-10: closed, done or taken), or null when it is open. */
  const closedReason = (day: DayClassification): DropReason | null => {
    if (day.kind === 'done') return 'receiving_day_done';
    if (day.kind === 'missed') return 'receiving_day_closed';
    if (storedTaken.has(day.taskId) || claimed.has(day.taskId)) return 'receiving_day_taken';
    if (day.date < input.today) return 'receiving_day_closed';
    return null;
  };
  /** The step of `kind` on a day that an earlier step of the kind would take the place of: its highest-priority one. */
  const nextOfKind = (taskId: string, kind: string) =>
    rowOf(taskId)
      .filter((step) => step.kind === kind)
      .sort((a, b) => (hasPriority(a) && hasPriority(b) ? byPriority(a, b) : 0))[0];

  const reachedBy = new Map<string, DayClassification>();
  const methodCarries: PlannedCarry[] = [];
  const shifts: PlannedShift[] = [];
  const accept = (missed: DayClassification, receiving: DayClassification, steps: CarriedStep[], replaced: DetailedStep[], durationMinutes: number) => {
    accepted.set(receiving.taskId, { steps, durationMinutes });
    claimed.add(receiving.taskId);
    methodCarries.push({
      fromTaskId: missed.taskId,
      fromDate: missed.date,
      toTaskId: receiving.taskId,
      toDate: receiving.date,
      step: steps.find((step) => markerOf(step)?.taskId === missed.taskId)!,
      replaced,
      steps,
      durationMinutes,
    });
  };

  for (const missed of [...active].reverse()) {
    const mover = stepsOf.get(missed.taskId)!.find((s) => s.recovery.action === 'move');
    if (!mover) continue;
    const { carriedFrom: _ignored, ...content } = mover.step;
    const marker: CarryMarker = { taskId: missed.taskId, date: missed.date, replaced: [] };
    const carried: CarriedStep = { ...content, instructions: withWarmUpLine(content.instructions), carriedFrom: marker };
    const kind = profile!.kinds.find((item) => item.id === mover.step.kind);
    const practiceLater = laterInWeek(missed).filter((day) => day.kind !== 'rest' && !day.isTestDay);
    // RULE-13: the sessions this week with a step of the in-order kind; the first holds the next step of the kind.
    const kindDays = kind?.inOrder ? practiceLater.filter((day) => rowOf(day.taskId).some((step) => step.kind === kind.id)) : [];

    // RULE-9: the first later practice day that passes. A day before the next step of the kind takes an ordinary fit;
    // the day of that next step is where the step takes its place, and nothing after it is ever used.
    let found: { receiving: DayClassification; fit: NonNullable<ReturnType<typeof fitCarriedStep>> | null } | null = null;
    for (const day of practiceLater) {
      if (day === kindDays[0]) {
        found = { receiving: day, fit: null };
        break;
      }
      const fit = fitCarriedStep({ steps: rowOf(day.taskId), durationMinutes: storedMinutes(day.taskId) }, carried, isProtected);
      if (!fit) continue;
      const placed = fit.steps.find((step) => step.carriedFrom === marker)!;
      if (!restGapHolds(new Map([[day.taskId, fit.steps]]), [{ taskId: day.taskId, step: placed }])) continue;
      found = { receiving: day, fit };
      break;
    }
    if (!found) {
      drop(missed, 'no_receiving_day');
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
      drop(missed, closed);
      continue;
    }
    if (fit) {
      const steps = fit.steps.map((step) => (step.carriedFrom === marker ? { ...step, carriedFrom: { ...marker, replaced: fit.replaced } } : step));
      accept(missed, receiving, steps, fit.replaced, fit.durationMinutes);
      continue;
    }

    const shift = planShift(missed, kind!.id, kindDays, carried);
    if (!shift) {
      drop(missed, 'shift_blocked');
      continue;
    }
    accept(missed, receiving, shift.receiving.steps, shift.receiving.replaced, shift.receiving.durationMinutes);
    for (const row of shift.plan.rows) {
      accepted.set(row.taskId, { steps: row.steps, durationMinutes: row.durationMinutes });
      claimed.add(row.taskId);
    }
    shifts.push(shift.plan);
  }

  /**
   * RULE-13: `carried` takes the place of the next step of its kind on `kindDays[0]`, that step takes the place of the
   * next one on `kindDays[1]`, and so on; the last one is pushed past the week. Every link must fit its day (never
   * longer, nothing fixed, continue-marked, swapped or in-order trimmed, MR-17), every day after the first must be open and not taken,
   * and the rest gap must hold for every step that lands on a day with no hard step before (MR-29; on a day that had one,
   * only "never share the day" is checked); otherwise null and nothing of the shift happens (MR-18).
   */
  function planShift(missed: DayClassification, kind: string, kindDays: DayClassification[], carried: CarriedStep) {
    const canTrim = (step: CarriedStep) => !isProtected(step) && !isMarkedMove(step) && actionOf(step, profile) !== null;
    const proposed = new Map<string, CarriedStep[]>();
    const moved: Array<{ taskId: string; step: CarriedStep; sameDayOnly: boolean }> = [];
    const rows: PlannedShift['rows'] = [];
    const steps: ShiftedStep[] = [];
    let receiving: { steps: CarriedStep[]; replaced: DetailedStep[]; durationMinutes: number } | null = null;
    let incoming = carried;
    let from = missed;
    let pushedOut: CarriedStep | null = null;

    for (const [index, day] of kindDays.entries()) {
      if (index > 0 && closedReason(day)) return null;
      const displaced = nextOfKind(day.taskId, kind);
      if (!displaced || isKept(displaced) || isMarkedMove(displaced)) return null;
      const fit = takePlace({ steps: rowOf(day.taskId), durationMinutes: storedMinutes(day.taskId) }, displaced, incoming, canTrim);
      if (!fit) return null;
      const arriving = incoming;
      let placed: CarriedStep | undefined;
      const row = fit.steps.map((step) => {
        if (index === 0 && step.carriedFrom === arriving.carriedFrom) placed = { ...step, carriedFrom: { ...step.carriedFrom!, replaced: fit.replaced } };
        else if (index > 0 && step.shiftedFrom === arriving.shiftedFrom) placed = { ...step, shiftedFrom: { ...step.shiftedFrom!, replaced: fit.replaced } };
        else return step;
        return placed;
      });
      proposed.set(day.taskId, row);
      // MR-29: a step landing on a day that already had a hard step (in the rows the search reads) makes nothing
      // closer than the week already was, so only a day that had none is checked against the rest gap.
      moved.push({ taskId: day.taskId, step: placed!, sameDayOnly: rowOf(day.taskId).some(isHard) });
      if (index === 0) receiving = { steps: row, replaced: fit.replaced, durationMinutes: fit.durationMinutes };
      else {
        rows.push({ taskId: day.taskId, steps: row, durationMinutes: fit.durationMinutes });
        steps.push({ fromTaskId: from.taskId, fromDate: from.date, toTaskId: day.taskId, toDate: day.date, kind, stepTitle: arriving.title });
      }
      from = day;
      incoming = { ...asWritten(displaced), shiftedFrom: { taskId: day.taskId, date: day.date, replaced: [] } };
      pushedOut = displaced;
    }
    if (!receiving || !pushedOut) return null;
    if (!restGapHolds(proposed, moved)) return null;

    // The carry's marker names the step pushed past the week, so the count survives the write (RULE-17).
    const lead = receiving.steps.find((step) => markerOf(step)?.taskId === missed.taskId)!;
    const withPushed: CarriedStep = { ...lead, carriedFrom: { ...lead.carriedFrom!, pushedOut: asWritten(pushedOut) } };
    receiving.steps = receiving.steps.map((step) => (step === lead ? withPushed : step));
    steps.push({ fromTaskId: from.taskId, fromDate: from.date, toTaskId: null, toDate: null, kind, stepTitle: pushedOut.title });
    const plan: PlannedShift = { missedTaskId: missed.taskId, missedDate: missed.date, kind, receivingTaskId: kindDays[0].taskId, steps, rows };
    return { receiving, plan };
  }

  const byFromDate = (a: string, b: string) => (a === b ? 0 : a < b ? -1 : 1);
  methodCarries.sort((a, b) => byFromDate(a.fromDate, b.fromDate));
  shifts.sort((a, b) => byFromDate(a.missedDate, b.missedDate));
  carries.push(...methodCarries);
  for (const [taskId, row] of accepted) staged.set(taskId, row.steps);

  // Each changed row is written whole, so a continue shares the carry's (or the shift's) row when both land on one day.
  const durationOf = (taskId: string) =>
    accepted.get(taskId)?.durationMinutes ?? carries.find((carry) => carry.toTaskId === taskId)?.durationMinutes ?? storedMinutes(taskId);
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
    const rules: RecoveryRules = steps && (methodDays.has(day.taskId) || carrySources.has(day.taskId)) ? 'method' : 'missed_sessions';
    if (!moved && inGap.has(day.taskId)) {
      outcomes.push({ taskId: day.taskId, date: day.date, rules, outcome: 'in_gap', topStep: 'in_gap' });
      continue;
    }
    if (!steps || rules === 'missed_sessions') {
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
  return { carries, drops, held: legacy.held, alreadyCarried: legacy.alreadyCarried, continues, alreadyContinued, outcomes, shifts };
}
