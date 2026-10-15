/**
 * Missed sessions, P2 / M2.3: week counts and the signals reconcile returns.
 * Pure: no database, no clock, no environment, no copy. Everything is derived from the classification, the open
 * gap, the carry plan and the stored `carriedFrom` markers; nothing new is stored (ND-2, ND-16).
 * See docs/archive/missed-sessions/03-feature.md (OD-2, RULE-4, RULE-8, RULE-9, AC-5, AC-10) and 04-phases.md.
 */
import { markerOf, type CarriedStep, type CarryPlan, type CarriedEarlier, type PlannedCarry } from './carryForward.js';
import type { DayOutcome, PlannedReorder } from './recovery/carry.js';
import { originOf } from './recovery/inOrder.js';
import { continueMarkerOf, shiftMarkerOf } from './recovery/rules.js';
import { dayCloseInstant, type DayClassification, type Gap } from './missedSessions.js';

// ---------------------------------------------------------------------------------------------------------------
// Week counts (for M4.2)

/** The task fields the week counts read. A Prisma `DailyTask` satisfies this shape. */
export interface CountableTask {
  id: string;
  weekNumber: number;
  isRestDay: boolean;
  isKeySession: boolean;
  /** M2.0 (ND-3): the day was completed only through the 10-minute version. */
  usedMinimumVersion?: boolean | null;
}

export interface WeekCounts {
  practicePlanned: number;
  practiceDone: number;
  doneByMinimum: number;
  keySessions: number;
  keyDone: number;
  keySkipped: number;
  missed: number;
  carried: number;
  dropped: number;
  /**
   * Method-aware recovery (RULE-17, MR-19, MR-26), present only when the plan carries method outcomes (the method
   * switch is on). One per missed day that followed the new rules, by its highest-priority step's outcome; the steps
   * MR-26 leaves behind add nothing, and days of the open gap (`in_gap`) are in none of them. Counted from the
   * planned outcome, so a continued day counts whether or not its marker was written. Counted only: no screen shows them.
   */
  letGo?: number;
  continued?: number;
  noRoom?: number;
  /**
   * RULE-17, RULE-20 (M3.1c, MR-30 (6)), present with the other three: the steps of in-order move kinds this week
   * that no session of the week holds, so next week starts with them (M3.1d). Counted from the plan's reorders, which
   * are worked out from the stored week every time, so the count is the same before and after the write.
   */
  toNextWeek?: number;
}

/**
 * Counts for one week of a plan v2 goal. Rest days never count (RULE-5).
 * - practiceDone counts a 10-minute completion as done (RULE-4, AC-7); doneByMinimum is how many of those.
 * - keyDone excludes 10-minute completions (OD-2). keySkipped is a key session that is missed, or done only
 *   through the 10-minute version; a key session still open is neither.
 * - carried counts stored carries (markers) out of this week; dropped counts this week's drops.
 */
export function weekCounts(
  weekNumber: number,
  input: {
    tasks: readonly CountableTask[];
    days: readonly DayClassification[];
    carry: Pick<CarryPlan, 'drops' | 'alreadyCarried'> & {
      written?: readonly PlannedCarry[];
      outcomes?: readonly DayOutcome[];
      reorders?: readonly Pick<PlannedReorder, 'weekNumber' | 'toNextWeek'>[];
    };
  }
): WeekCounts {
  const kindOf = new Map(input.days.map((day) => [day.taskId, day.kind]));
  const practice = input.tasks.filter((task) => task.weekNumber === weekNumber && !task.isRestDay);
  const ids = new Set(practice.map((task) => task.id));
  const done = practice.filter((task) => kindOf.get(task.id) === 'done');
  const byMinimum = (task: CountableTask) => task.usedMinimumVersion === true;
  const keys = practice.filter((task) => task.isKeySession);
  const sources = new Set([...input.carry.alreadyCarried, ...(input.carry.written ?? [])].map((carry) => carry.fromTaskId));
  const outcomes = input.carry.outcomes;
  let method: Pick<WeekCounts, 'letGo' | 'continued' | 'noRoom' | 'toNextWeek'> = {};
  if (outcomes) {
    // Gap days have their own outcome (`in_gap`), so they are in none of these.
    const counted = outcomes.filter((day) => day.rules === 'method' && ids.has(day.taskId));
    method = {
      letGo: counted.filter((day) => day.topStep === 'let_go').length,
      continued: counted.filter((day) => day.topStep === 'continued').length,
      noRoom: counted.filter((day) => day.topStep === 'no_room').length,
      toNextWeek: (input.carry.reorders ?? []).filter((reorder) => reorder.weekNumber === weekNumber).reduce((sum, reorder) => sum + reorder.toNextWeek.length, 0),
    };
  }

  return {
    ...method,
    practicePlanned: practice.length,
    practiceDone: done.length,
    doneByMinimum: done.filter(byMinimum).length,
    keySessions: keys.length,
    keyDone: keys.filter((task) => kindOf.get(task.id) === 'done' && !byMinimum(task)).length,
    keySkipped: keys.filter((task) => kindOf.get(task.id) === 'missed' || (kindOf.get(task.id) === 'done' && byMinimum(task))).length,
    missed: practice.filter((task) => kindOf.get(task.id) === 'missed').length,
    carried: [...sources].filter((id) => ids.has(id)).length,
    dropped: input.carry.drops.filter((drop) => ids.has(drop.taskId)).length,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Signals (ND-16). Data only: P3 writes the words.

export interface CarriedSignal {
  fromDate: string;
  fromTaskId: string;
  toDate: string;
  toTaskId: string;
  stepTitle: string;
}

export interface DroppedSignal {
  date: string;
  taskId: string;
  reason: CarryPlan['drops'][number]['reason'];
}

export interface SwapOfferSignal {
  missedTaskId: string;
  missedDate: string;
  receivingTaskId: string;
  receivingDate: string;
  offerUntil: string;
}

export interface GentleReturnSignal {
  gapLength: number;
  firstDate: string;
  lastDate: string;
}

/** `method` (M3.3) only when the plan carries method outcomes: the line is a day that followed the new rules. */
export type NoticeKind = 'gentle_return' | 'swap_offer' | 'carried' | 'dropped' | 'method';

/**
 * Method-aware recovery (M3.3, RULE-15, MR-35): which line a missed day gets. `carried` and `dropped` are a day under
 * missed sessions' rules (RULE-18), whose lines stay as they are; the others are a day that followed the new rules, by
 * its outcome. `moved` is a carry (`carriedFrom`), `moved_in_order` a step a reorder placed on a later session
 * (`shiftedFrom`), `continued` a continue marker (`continueFrom`).
 */
export type LineKind = 'carried' | 'dropped' | 'moved' | 'moved_in_order' | 'continued' | 'let_go' | 'fixed' | 'no_room' | 'next_week' | 'left_out';

export interface LineSignal {
  kind: LineKind;
  /** The day that didn't happen (today when it was set aside). */
  taskId: string;
  date: string;
  /** The receiving day, for `carried`, `moved`, `moved_in_order` and `continued`; otherwise null. */
  toTaskId: string | null;
  toDate: string | null;
}

export interface MissedSignals {
  carried: CarriedSignal[];
  dropped: DroppedSignal[];
  swapOffer: SwapOfferSignal | null;
  shortOnTime: boolean;
  gentleReturn: GentleReturnSignal | null;
  /** The one line P3 shows (notice fatigue, 04-phases.md 8.10), or null. */
  notice: NoticeKind | null;
  /**
   * M3.3: present only when the plan carries method outcomes (the method switch is on). The missed day the line is
   * about and what happened to it, when `notice` is `carried`, `dropped` or `method`; otherwise null.
   */
  line?: LineSignal | null;
}

export interface SignalInput {
  days: readonly DayClassification[];
  gap: Gap | null;
  plan: CarryPlan & { outcomes?: readonly DayOutcome[] };
  /**
   * M3.3: every day's steps as stored after this run's writes. The method lines that name a receiving day are read
   * from their stored markers, so they last until that day closes. Read only when `plan.outcomes` is present.
   */
  stored?: ReadonlyArray<{ id: string; steps: readonly CarriedStep[] }>;
  /** Carries this request actually wrote (M2.2 `carry.written`). */
  written: readonly PlannedCarry[];
  now: Date;
  /** The user's local calendar date, 'YYYY-MM-DD'. */
  today: string;
  timezone: string;
  sleepTime?: unknown;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(`${value}T00:00:00Z`));
}

function byDate(a: DayClassification, b: DayClassification): number {
  return a.date === b.date ? a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1;
}

/**
 * The signals for `now`. Only stored carries are ever reported as moved (`carry.written` or markers found in
 * stored steps), so with the ND-15 switch off `carried` is always empty. On a rest day no miss line is chosen
 * (AC-5); the fields still carry their data.
 */
export function buildSignals(input: SignalInput): MissedSignals {
  const nowMs = input.now.getTime();
  const closes = new Map<string, number>();
  const closeOf = (date: string) => {
    let close = closes.get(date);
    if (close === undefined) {
      // A date that cannot be read never closes, as in classifyDays.
      close = isDateKey(date) ? dayCloseInstant(date, input.sleepTime, input.timezone).getTime() : Infinity;
      closes.set(date, close);
    }
    return close;
  };
  const ordered = [...input.days].sort(byDate);
  const dayById = new Map(ordered.map((day) => [day.taskId, day]));
  const practice = ordered.filter((day) => day.kind !== 'rest');
  const today = ordered.find((day) => day.date === input.today) ?? null;
  const todayOpenPractice = today !== null && today.kind === 'planned';

  // Carried: stored carries, from the moment they are stored until the receiving day closes (ND-18).
  const stored: Array<CarriedEarlier | PlannedCarry> = [...input.written, ...input.plan.alreadyCarried];
  const seen = new Set<string>();
  const carried: CarriedSignal[] = [];
  for (const move of stored) {
    if (seen.has(move.fromTaskId)) continue;
    seen.add(move.fromTaskId);
    if (nowMs >= closeOf(move.toDate)) continue;
    carried.push({ fromDate: move.fromDate, fromTaskId: move.fromTaskId, toDate: move.toDate, toTaskId: move.toTaskId, stepTitle: move.step.title });
  }

  // Dropped: only while the dropped day is the most recent closed practice day.
  const closed = practice.filter((day) => closeOf(day.date) <= nowMs);
  const latestClosed = closed[closed.length - 1];
  const dropped: DroppedSignal[] =
    latestClosed && latestClosed.kind === 'missed'
      ? input.plan.drops
          .filter((drop) => drop.taskId === latestClosed.taskId)
          .map((drop) => ({ date: drop.date, taskId: drop.taskId, reason: drop.reason }))
      : [];

  // Swap offer: the held key session whose receiving day is still open (ND-9, ND-17).
  const offers = input.plan.held
    .map((held) => ({ held, receiving: dayById.get(held.receivingTaskId) }))
    .filter(({ receiving }) => receiving?.kind === 'planned')
    .sort((a, b) => (a.held.date < b.held.date ? 1 : a.held.date > b.held.date ? -1 : 0));
  const offer = offers[0];
  const swapOffer: SwapOfferSignal | null = offer
    ? {
        missedTaskId: offer.held.taskId,
        missedDate: offer.held.date,
        receivingTaskId: offer.held.receivingTaskId,
        receivingDate: offer.receiving!.date,
        offerUntil: offer.held.offerUntil,
      }
    : null;

  // Short on time: 2+ missed practice days in today's week, and today is still open practice (RULE-9, UX-2).
  const shortOnTime =
    todayOpenPractice &&
    practice.filter((day) => day.weekNumber === today!.weekNumber && day.kind === 'missed').length >= 2;

  // Gentle return: today is the first open practice day after the open gap (RULE-8, UX-4, AC-10).
  const gap = input.gap;
  const firstOpenAfterGap = gap ? practice.find((day) => day.date > gap.lastDate && day.kind === 'planned') : undefined;
  const gentleReturn: GentleReturnSignal | null =
    gap && todayOpenPractice && firstOpenAfterGap?.taskId === today!.taskId
      ? { gapLength: gap.length, firstDate: gap.firstDate, lastDate: gap.lastDate }
      : null;

  const restDay = today?.kind === 'rest';
  if (input.plan.outcomes) {
    const line = methodLine(input, input.plan.outcomes, { stored, practice, latestClosed, isOpen: (date) => nowMs < closeOf(date) });
    const lineNotice: NoticeKind | null = line ? (line.kind === 'carried' || line.kind === 'dropped' ? line.kind : 'method') : null;
    const notice: NoticeKind | null = gentleReturn ? 'gentle_return' : restDay ? null : swapOffer ? 'swap_offer' : lineNotice;
    return { carried, dropped, swapOffer, shortOnTime, gentleReturn, notice, line: notice === lineNotice ? line : null };
  }
  const notice: NoticeKind | null = gentleReturn
    ? 'gentle_return'
    : restDay
      ? null
      : swapOffer
        ? 'swap_offer'
        : carried.length > 0
          ? 'carried'
          : dropped.length > 0
            ? 'dropped'
            : null;

  return { carried, dropped, swapOffer, shortOnTime, gentleReturn, notice };
}

const NOT_MOVED: ReadonlySet<string> = new Set(['let_go', 'fixed', 'no_room', 'next_week', 'left_out']);

const byPriority = (a: CarriedStep, b: CarriedStep) =>
  (typeof a.priority === 'number' ? a.priority : Infinity) - (typeof b.priority === 'number' ? b.priority : Infinity);

/**
 * M3.3 (RULE-15, MR-12, MR-35 (1), (2)): the one method line, or null. A line naming a receiving day (a carry, a
 * reorder's session, a continue marker) is read from the stored markers and lasts until that day closes; among them
 * the most recent missed day wins. Every other line shows only while its day is the most recent closed practice day.
 * A day set aside today comes first, as missed sessions' set-aside line does. A day under missed sessions' rules keeps
 * its carried or dropped line.
 */
function methodLine(
  input: SignalInput,
  outcomes: readonly DayOutcome[],
  ctx: {
    stored: ReadonlyArray<CarriedEarlier | PlannedCarry>;
    practice: readonly DayClassification[];
    latestClosed: DayClassification | undefined;
    isOpen: (date: string) => boolean;
  }
): LineSignal | null {
  const outcomeOf = new Map(outcomes.map((item) => [item.taskId, item]));
  const dateOf = new Map(input.days.map((day) => [day.taskId, day.date]));
  const rows = [...(input.stored ?? [])]
    .filter((row) => dateOf.has(row.id))
    .sort((a, b) => (dateOf.get(a.id)! < dateOf.get(b.id)! ? -1 : dateOf.get(a.id)! > dateOf.get(b.id)! ? 1 : 0));
  const towards = (from: { taskId: string; date: string }, kind: LineKind, toTaskId: string | undefined): LineSignal | null => {
    const toDate = toTaskId === undefined ? undefined : dateOf.get(toTaskId);
    return toTaskId !== undefined && toDate !== undefined && ctx.isOpen(toDate) ? { kind, taskId: from.taskId, date: from.date, toTaskId, toDate } : null;
  };

  const receiving: LineSignal[] = [];
  const carryOf = new Map<string, CarriedEarlier | PlannedCarry>();
  for (const move of ctx.stored) if (!carryOf.has(move.fromTaskId)) carryOf.set(move.fromTaskId, move);
  for (const [fromTaskId, move] of carryOf) {
    if (outcomeOf.get(fromTaskId)?.rules === 'method') continue;
    const line = towards({ taskId: fromTaskId, date: move.fromDate }, 'carried', move.toTaskId);
    if (line) receiving.push(line);
  }
  for (const day of outcomes) {
    if (day.rules !== 'method') continue;
    if (day.outcome === 'moved') {
      // MR-12: the day's highest-priority step that moved names the day: a carry (`carriedFrom`), or a step a reorder
      // placed on a later session (RULE-20), whose `shiftedFrom` names the day the step was written on.
      const carry = carryOf.get(day.taskId);
      const own = [...(rows.find((row) => row.id === day.taskId)?.steps ?? [])].filter((step) => markerOf(step) === null).sort(byPriority);
      let line: LineSignal | null = null;
      for (const step of own) {
        if (carry && carry.step.title === step.title) {
          line = towards(day, 'moved', carry.toTaskId);
          break;
        }
        const origin = originOf(step, day);
        const holding = rows.filter(
          (row) =>
            row.id !== day.taskId &&
            dateOf.get(row.id)! > day.date &&
            row.steps.some((held) => shiftMarkerOf(held)?.taskId === origin.taskId && held.title === step.title)
        );
        // A session that closed may still hold a copy (it was missed too and the step moved on): the open one names the day.
        const session = holding.find((row) => ctx.isOpen(dateOf.get(row.id)!)) ?? holding[0];
        if (session) {
          line = towards(day, 'moved_in_order', session.id);
          break;
        }
      }
      // A stored carry whose step cannot be found on its day still names its day.
      if (!line && carry) line = towards(day, 'moved', carry.toTaskId);
      if (line) receiving.push(line);
    } else if (day.outcome === 'continued') {
      const session = rows.find((row) => row.steps.some((held) => continueMarkerOf(held)?.taskId === day.taskId));
      const line = session ? towards(day, 'continued', session.id) : null;
      if (line) receiving.push(line);
    }
  }
  receiving.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  /** The line of a day that names no receiving day: its method outcome, or missed sessions' drop. */
  const notMoved = (day: DayClassification): LineSignal | null => {
    const outcome = outcomeOf.get(day.taskId);
    if (outcome?.rules === 'method' && NOT_MOVED.has(outcome.outcome)) {
      return { kind: outcome.outcome as LineKind, taskId: day.taskId, date: day.date, toTaskId: null, toDate: null };
    }
    const drop = input.plan.drops.some((item) => item.taskId === day.taskId);
    return drop ? { kind: 'dropped', taskId: day.taskId, date: day.date, toTaskId: null, toDate: null } : null;
  };

  // Set aside today (ND-14): nothing about it is stored when nothing moves, so only the action's answer has it. A day
  // set aside today never answers with another day's line: without a line of its own, there is none.
  const setAside = ctx.practice.find((day) => day.date === input.today && day.kind === 'missed');
  const todayLine = receiving.find((line) => line.date === input.today) ?? (setAside ? notMoved(setAside) : null);
  if (todayLine || setAside) return todayLine;
  if (receiving.length > 0) return receiving[0];
  return ctx.latestClosed?.kind === 'missed' ? notMoved(ctx.latestClosed) : null;
}
