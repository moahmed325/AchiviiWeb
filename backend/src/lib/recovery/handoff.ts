/**
 * Method-aware recovery, M3.1d (RULE-20, MR-32): next week continues from where the person is. Pure: no database, no
 * clock, no environment, no model call. `writeNextWeek` (`planV2.ts`) uses it only when `METHOD_RECOVERY_ENABLED` is
 * exactly `true`; with it off nothing here runs and the week is written exactly as before.
 *
 * Two steps around the week call:
 * 1. `weekHandoff` reads the finished week as stored: for each in-order move kind, the steps not done yet, in order
 *    (`inOrderQueue`, records included); the continue work not finished; and the moved steps of other kinds that found
 *    no room. `handoffBrief` turns that into what the week writer is told.
 * 2. `placeHandoff` runs on the week the call returned. Code places the carried steps itself, in order, into the new
 *    week's first sessions of their kind, each in place of the model's step of that kind (`takePlace`'s fit, the rest
 *    gap against last week's days, MR-29 (5)). What does not fit, or has no session, waits as a `toNextWeek` record
 *    inside the new week, so the next handoff carries it again. A non-hard no-room step of another kind takes the
 *    first free session of its kind when it fits; a hard one is only told. Nothing here can fail the week call.
 */
import type { DetailedStep } from '../ai/goalDecomposer.js';
import { hasPriority, markerOf, type CarriedStep, type NextWeekRecord } from '../carryForward.js';
import { GAP_MIN_DAYS, type DayClassification } from '../missedSessions.js';
import { asWritten, keepRecords, PHYSICAL_TEMPLATES, renumber, shiftMarkerOf, takePlace, withoutEasyLine, withWarmUpLine } from './carry.js';
import { describeDay } from './dayText.js';
import { byWritten, followsMethod, inOrderMoveKinds, inOrderQueue, writtenNumber } from './inOrder.js';
import { actionOf, type RecoveryProfile } from './profile.js';

/** A day of the finished week, as stored. A Prisma `DailyTask` with its parsed steps satisfies it. */
export interface HandoffTask {
  id: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  dayOfWeek?: string;
  status: string;
  isRestDay: boolean;
  isKeySession: boolean;
  isTestDay: boolean;
  steps: CarriedStep[];
}

/** A step by its identity (the day it was written on, and its title) and its content as written. */
export interface HandoffStep {
  taskId: string;
  date: string;
  title: string;
  step: DetailedStep;
}

export interface CarriedKind {
  kind: string;
  name: string;
  /** The steps of the kind not done yet, in order. The first is where the person is; their number is how far behind. */
  steps: HandoffStep[];
}

/** A moved step of a kind that is not in order and found no room last week (RULE-17, MR-32 (3)). */
export interface NoRoomMove extends HandoffStep {
  kind: string;
  dayOfWeek: string;
  /** Hard (RULE-14): told to the writer only, never placed. */
  hard: boolean;
}

/** Continue work (RULE-10) not finished by the week's end: told, not placed or checked (RULE-20). */
export interface UnfinishedWork extends HandoffStep {
  kind: string;
  name: string;
  dayOfWeek: string;
}

export interface WeekHandoff {
  carried: CarriedKind[];
  /** MR-32 (4): steps whose kind is no longer an in-order move kind of the goal's profile: let go, counted here. */
  letGo: Array<HandoffStep & { kind: string }>;
  unfinished: UnfinishedWork[];
  noRoom: NoRoomMove[];
}

/** After every date: every day of the finished week counts as closed. */
const WEEK_ENDED = '9999-12-31';

const isDone = (task: HandoffTask) => task.status === 'completed';
const byDay = (a: HandoffTask, b: HandoffTask) => (a.date === b.date ? a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1);
const kindName = (profile: RecoveryProfile, id: string) => profile.kinds.find((kind) => kind.id === id)?.name ?? id;

/**
 * The days of every run of `GAP_MIN_DAYS` or more practice days in a row not done (ND-11, RULE-8): nothing was carried
 * out of them. As `findOpenGap`: rest days neither count nor break a run, the test day counts, and a run can start in
 * the week before (M3.1d review). `days` are in date order, rest days already left out.
 */
function gapDays(practice: readonly HandoffTask[]): Set<string> {
  const out = new Set<string>();
  let run: string[] = [];
  const close = () => {
    if (run.length >= GAP_MIN_DAYS) for (const id of run) out.add(id);
    run = [];
  };
  for (const task of practice) {
    if (isDone(task)) close();
    else run.push(task.id);
  }
  close();
  return out;
}

/**
 * What the finished week hands on (requirement 2 to 4). Every practice day that is not done counts as not done: next
 * week is being written, so the week has ended. `previous` is the profile the finished week was written with (by
 * default the goal's profile now); a step whose kind is no longer an in-order move kind of `profile` is let go.
 */
export function weekHandoff(input: {
  tasks: readonly HandoffTask[];
  profile: RecoveryProfile;
  previous?: RecoveryProfile | null;
  /** The week before the finished one (or its last days), only to find a break that started there. */
  weekBefore?: readonly HandoffTask[];
}): WeekHandoff {
  const profile = input.profile;
  const previous = input.previous ?? profile;
  const tasks = [...input.tasks].sort(byDay);
  const days: DayClassification[] = tasks.map((task) => ({
    taskId: task.id,
    date: task.date,
    weekNumber: task.weekNumber,
    dayNumber: task.dayNumber,
    isKeySession: task.isKeySession,
    isTestDay: task.isTestDay,
    kind: task.isRestDay ? 'rest' : isDone(task) ? 'done' : 'missed',
  }));

  // In-order move kinds (requirement 2).
  const keep = inOrderMoveKinds(profile);
  const carried: CarriedKind[] = [];
  const letGo: WeekHandoff['letGo'] = [];
  for (const queue of inOrderQueue({ days, tasks, profile: previous, today: WEEK_ENDED })) {
    // The step as written, with its number on the day it was written (its written order).
    const steps = queue.steps.map((item) => ({ taskId: item.origin.taskId, date: item.origin.date, title: item.title, step: { ...asWritten(item.step), stepNumber: writtenNumber(item.step) } }));
    if (keep.has(queue.kind)) carried.push({ kind: queue.kind, name: kindName(profile, queue.kind), steps });
    else letGo.push(...steps.map((step) => ({ ...step, kind: queue.kind })));
  }
  carried.sort((a, b) => profile.kinds.findIndex((k) => k.id === a.kind) - profile.kinds.findIndex((k) => k.id === b.kind));

  const practice = tasks.filter((task) => !task.isRestDay && !task.isTestDay);
  const dayName = (task: HandoffTask) => task.dayOfWeek ?? task.date;

  // Continue work not finished: a missed day's step of a continue kind after the kind's last done day (RULE-10).
  const unfinished: UnfinishedWork[] = [];
  for (const kind of profile.kinds.filter((item) => item.action === 'continue')) {
    const holds = (task: HandoffTask) => task.steps.some((step) => step.kind === kind.id && actionOf(step, profile)?.action === 'continue');
    const ofKind = practice.filter(holds);
    const lastDone = ofKind.reduce((at, task, index) => (isDone(task) ? index : at), -1);
    for (const task of ofKind.slice(lastDone + 1)) {
      const step = task.steps.find((s) => s.kind === kind.id && actionOf(s, profile)?.action === 'continue')!;
      unfinished.push({ taskId: task.id, date: task.date, title: step.title, step: asWritten(step), kind: kind.id, name: kind.name, dayOfWeek: dayName(task) });
    }
  }

  // Moved steps of other kinds that found no room (MR-32 (3)): a missed day outside a gap, under the new rules, whose
  // highest-priority move step (not in order, not already moved, MR-28 (2)) has no carry from it.
  const gap = gapDays([...(input.weekBefore ?? []), ...tasks].filter((task) => !task.isRestDay).sort(byDay));
  const carrySources = new Set(tasks.flatMap((task) => task.steps.flatMap((step) => (markerOf(step) ? [markerOf(step)!.taskId] : []))));
  const queued = inOrderMoveKinds(previous);
  const noRoom: NoRoomMove[] = [];
  for (const task of practice) {
    if (isDone(task) || gap.has(task.id) || carrySources.has(task.id) || !followsMethod(task.steps, previous)) continue;
    const mover = [...task.steps]
      .filter(hasPriority)
      .sort((a, b) => a.priority - b.priority)
      .find((step) => actionOf(step, previous)?.action === 'move' && !queued.has(step.kind as string) && !markerOf(step) && !shiftMarkerOf(step));
    if (!mover) continue;
    const recovery = actionOf(mover, profile) ?? actionOf(mover, previous)!;
    noRoom.push({ taskId: task.id, date: task.date, title: mover.title, step: asWritten(mover), kind: mover.kind as string, dayOfWeek: dayName(task), hard: recovery.hard });
  }

  return { carried, letGo, unfinished, noRoom };
}

/** True when the writer has something to be told (requirement 4). */
export const hasHandoff = (handoff: WeekHandoff) => handoff.carried.length > 0 || handoff.unfinished.length > 0 || handoff.noRoom.length > 0;

/** The days of the week just written, as `generateWeekPlan` returns them. */
export interface PlacedDay {
  date: string;
  isRestDay: boolean;
  isTestDay: boolean;
  durationMinutes: number;
  detailedSteps: DetailedStep[];
  /** The day's text, rebuilt when code changes its priority-1 step (`describeDay`). */
  title?: string;
  minimumVersion?: DetailedStep | null;
  implementationIntention?: string;
  whyToday?: string;
}

export interface HandoffPlacement<T extends PlacedDay> {
  days: T[];
  /** Carried steps placed, by kind, in order: the date of the session each took. */
  placed: Array<{ kind: string; title: string; date: string }>;
  /**
   * Carried steps that wait inside the new week, stored as records, by kind, in order. `no_session`: the writer wrote no
   * step of the kind; `only_step`: at least one session could not take the next step and kept its step because it was
   * its day's only one; `sessions_full`: every other case (every session was used, or gave its step up).
   */
  waiting: Array<{ kind: string; title: string; why: 'no_session' | 'sessions_full' | 'only_step' }>;
  /** Sessions that gave their own step up so the order holds (MR-30 (5)). */
  gaveUp: Array<{ kind: string; date: string; title: string }>;
  /** No-room steps of other kinds placed by code (MR-32 (3)). */
  noRoomPlaced: Array<{ kind: string; title: string; date: string }>;
}

/**
 * Places the handoff in the week the call returned (requirements 3 and 5). For each in-order kind with carried steps,
 * the new week's steps of that kind on practice days (not the test day, not rest), in date then row order, take the
 * carried steps in order, each in the step's place. A session that cannot take the next step (no fit, or the rest gap)
 * gives its own step up so nothing comes before the step not done (MR-30 (5)), unless that step is its day's only one:
 * then that session keeps its step and the next session is tried (M3.1d review). The steps left wait, stored in order
 * as `toNextWeek` records on the new week's first step of the kind (its first practice step when it has none). A day
 * whose priority-1 step changed gets a title, 10-minute version and intention that describe its new step.
 * `lastWeek` is the finished week, for the rest gap (MR-29 (2): only days that were done count).
 */
export function placeHandoff<T extends PlacedDay>(input: {
  days: readonly T[];
  handoff: WeekHandoff;
  profile: RecoveryProfile;
  lastWeek: readonly Pick<HandoffTask, 'date' | 'status' | 'isRestDay' | 'steps'>[];
}): HandoffPlacement<T> {
  const { profile, handoff } = input;
  const rows = input.days.map((day) => ({ steps: day.detailedSteps as CarriedStep[], durationMinutes: day.durationMinutes }));
  const placed: HandoffPlacement<T>['placed'] = [];
  const waiting: HandoffPlacement<T>['waiting'] = [];
  const gaveUp: HandoffPlacement<T>['gaveUp'] = [];
  const noRoomPlaced: HandoffPlacement<T>['noRoomPlaced'] = [];

  const recoveryOf = (step: CarriedStep) => actionOf(step, profile);
  const isHard = (step: CarriedStep) => recoveryOf(step)?.hard ?? step.highLoad === true;
  const isPhysical = (step: CarriedStep) => isHard(step) || PHYSICAL_TEMPLATES.has(profile.template);
  const inOrderKinds = new Set(profile.kinds.filter((kind) => kind.inOrder).map((kind) => kind.id));
  // Never trimmed to make room: fixed, continue-marked, of an in-order kind, already placed by code, or without a kind.
  const canTrim = (step: CarriedStep) =>
    recoveryOf(step) !== null &&
    recoveryOf(step)!.action !== 'fixed' &&
    !step.continueFrom &&
    !(typeof step.kind === 'string' && inOrderKinds.has(step.kind)) &&
    !shiftMarkerOf(step) &&
    !markerOf(step);
  const dayNumberOf = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  const restGap = profile.restGapDays;

  /**
   * RULE-14 against the new week as it stands and last week's done days. A step taking a hard step's place adds no
   * closeness (MR-29 (5)): only its own day is checked, and it never shares that day with another hard step.
   */
  const restGapHolds = (at: number, step: CarriedStep, steps: readonly CarriedStep[], sameDayOnly: boolean) => {
    if (!isHard(step)) return true;
    const reach = sameDayOnly ? 0 : restGap;
    const day = dayNumberOf(input.days[at].date);
    for (const [index, other] of input.days.entries()) {
      if (Math.abs(dayNumberOf(other.date) - day) > reach) continue;
      const row = index === at ? steps : rows[index].steps;
      if (row.some((s) => s !== step && isHard(s))) return false;
    }
    for (const done of input.lastWeek) {
      if (done.isRestDay || done.status !== 'completed' || Math.abs(dayNumberOf(done.date) - day) > reach) continue;
      if (done.steps.some(isHard)) return false;
    }
    return true;
  };

  /** The step as code places it: as written, without RULE-21's line, with the warm-up line when physical (MR-31). */
  const placedContent = (item: HandoffStep): CarriedStep => {
    const content = asWritten(item.step);
    const instructions = withoutEasyLine(content.instructions);
    return {
      ...content,
      instructions: isPhysical(content) ? withWarmUpLine(instructions) : (instructions as string),
      shiftedFrom: { taskId: item.taskId, date: item.date, replaced: [], stepNumber: item.step.stepNumber },
    };
  };

  /** Tries `item` in place of `current` on day `at`; the new row, or null when it does not fit or breaks the rest gap. */
  const tryPlace = (at: number, current: CarriedStep, item: HandoffStep) => {
    const row = rows[at];
    const incoming = placedContent(item);
    const fit = takePlace(row, current, incoming, canTrim);
    if (!fit) return null;
    const marker = { ...incoming.shiftedFrom!, replaced: fit.replaced };
    const marked = fit.steps.map((step) => (step.shiftedFrom === incoming.shiftedFrom ? { ...step, shiftedFrom: marker } : step));
    const index = marked.findIndex((step) => step.shiftedFrom === marker);
    const steps = keepRecords(row.steps, marked, index);
    if (!restGapHolds(at, steps[index], steps, row.steps.some(isHard))) return null;
    return { steps, durationMinutes: fit.durationMinutes };
  };

  const practiceIndexes = input.days.flatMap((day, index) => (!day.isRestDay && !day.isTestDay ? [index] : []));

  // ---- In-order kinds (requirement 3).
  const records: Array<{ kind: string; record: NextWeekRecord }> = [];
  for (const { kind, steps: carried } of handoff.carried) {
    // Every step of the kind on a practice day, in date then row order. Each is one session.
    const written = (step: CarriedStep) => step.kind === kind && !shiftMarkerOf(step);
    const slots = practiceIndexes.flatMap((at) => rows[at].steps.filter(written).map((step) => ({ at, title: step.title })));
    let next = 0;
    let keptOnly = false;
    for (const slot of slots) {
      const item = carried[next];
      if (!item) break;
      const current = rows[slot.at].steps.find((step) => written(step) && step.title === slot.title);
      if (!current) continue;
      const row = tryPlace(slot.at, current, item);
      if (row) {
        rows[slot.at] = row;
        placed.push({ kind, title: item.title, date: input.days[slot.at].date });
        next += 1;
        continue;
      }
      const kept = rows[slot.at].steps.filter((step) => step !== current);
      if (kept.length === 0) {
        // Never a day left empty: this session keeps its step, and the next one is tried.
        keptOnly = true;
        continue;
      }
      const limit = rows[slot.at].durationMinutes;
      const minutes = kept.reduce((sum, step) => sum + Math.max(0, step.durationMinutes || 0), 0);
      rows[slot.at] = { steps: keepRecords(rows[slot.at].steps, renumber(kept), 0), durationMinutes: limit > 0 ? Math.min(limit, minutes) : minutes };
      gaveUp.push({ kind, date: input.days[slot.at].date, title: current.title });
    }
    const why = slots.length === 0 ? 'no_session' : keptOnly ? 'only_step' : 'sessions_full';
    for (const item of carried.slice(next)) {
      waiting.push({ kind, title: item.title, why });
      records.push({ kind, record: { taskId: item.taskId, date: item.date, step: asWritten(item.step) } });
    }
  }

  // ---- No-room steps of other kinds (requirement 5): a non-hard one takes the first free session of its kind.
  // A session already holding a step placed by code is not free.
  for (const item of handoff.noRoom) {
    if (item.hard || isHard(item.step) || recoveryOf(item.step)?.action !== 'move' || inOrderMoveKinds(profile).has(item.kind)) continue;
    const slot = practiceIndexes.flatMap((at) => rows[at].steps.filter((step) => step.kind === item.kind && !shiftMarkerOf(step)).map((step) => ({ at, step }))).at(0);
    if (!slot) continue;
    const row = tryPlace(slot.at, slot.step, item);
    if (!row) continue;
    rows[slot.at] = row;
    noRoomPlaced.push({ kind: item.kind, title: item.title, date: input.days[slot.at].date });
  }

  // ---- The waiting steps, in order, on the new week's first step of their kind, or its first practice step.
  const byKind = new Map<string, NextWeekRecord[]>();
  for (const { kind, record } of records) byKind.set(kind, [...(byKind.get(kind) ?? []), record]);
  for (const [kind, list] of byKind) {
    const anchor =
      practiceIndexes.flatMap((at) => rows[at].steps.map((step, index) => ({ at, index, step }))).find(({ step }) => step.kind === kind) ??
      practiceIndexes.flatMap((at) => rows[at].steps.map((step, index) => ({ at, index, step }))).at(0);
    if (!anchor) continue;
    const step = anchor.step;
    const sorted = [...list].sort((a, b) => byWritten({ origin: a, step: a.step, title: a.step.title }, { origin: b, step: b.step, title: b.step.title }));
    rows[anchor.at] = {
      ...rows[anchor.at],
      steps: rows[anchor.at].steps.map((s, i) => (i === anchor.index ? { ...step, toNextWeek: [...(Array.isArray(step.toNextWeek) ? step.toNextWeek : []), ...sorted] } : s)),
    };
  }

  const days = input.days.map((day, index) => {
    if (rows[index].steps === day.detailedSteps && rows[index].durationMinutes === day.durationMinutes) return day;
    const changed = { ...day, detailedSteps: rows[index].steps, durationMinutes: rows[index].durationMinutes };
    const text = describeDay(day, day.detailedSteps as CarriedStep[], rows[index].steps);
    if (!text) return changed;
    return {
      ...changed,
      title: text.title,
      minimumVersion: text.minimumVersion,
      ...(text.implementationIntention !== undefined ? { implementationIntention: text.implementationIntention } : {}),
      ...(text.whyToday !== undefined ? { whyToday: text.whyToday } : {}),
    };
  });
  return { days, placed, waiting, gaveUp, noRoomPlaced };
}

/** Requirement 4: what the week writer is told, as plain lines; empty when there is nothing to say. */
export function handoffBrief(handoff: WeekHandoff): string[] {
  const quote = (title: string) => `"${title}"`;
  const lines: string[] = [];
  for (const { kind, name, steps } of handoff.carried) {
    if (steps.length === 0) continue;
    const behind = steps.length === 1 ? '1 step' : `${steps.length} steps`;
    lines.push(
      `- ${name} (kind ${kind}): they have not done these steps yet, in this order: ${steps.map((s) => quote(s.title)).join(', ')}. ` +
        `They are at ${quote(steps[0].title)}, ${behind} behind the plan. Code puts these steps, in this order, into this week's first steps of kind ${kind}, ` +
        `each in place of the step you write there, so give those sessions a step of this kind. Write any further step of this kind to continue after ${quote(steps[steps.length - 1].title)}.`
    );
  }
  for (const item of handoff.unfinished) {
    lines.push(`- ${item.name} (kind ${item.kind}): the work of ${quote(item.title)} (${item.dayOfWeek}) is not finished. Pick it up in this week's first step of this kind.`);
  }
  for (const item of handoff.noRoom) {
    lines.push(
      item.hard
        ? `- ${quote(item.title)} (kind ${item.kind}, ${item.dayOfWeek}) found no room last week. It is hard: do not add it on top of this week's hard sessions; take it into account when you set the week's load.`
        : `- ${quote(item.title)} (kind ${item.kind}, ${item.dayOfWeek}) found no room last week. Code puts it in place of this week's first step of kind ${item.kind} when it fits.`
    );
  }
  return lines;
}
