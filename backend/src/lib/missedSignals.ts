/**
 * Missed sessions, P2 / M2.3: week counts and the signals reconcile returns.
 * Pure: no database, no clock, no environment, no copy. Everything is derived from the classification, the open
 * gap, the carry plan and the stored `carriedFrom` markers; nothing new is stored (ND-2, ND-16).
 * See docs/archive/missed-sessions/03-feature.md (OD-2, RULE-4, RULE-8, RULE-9, AC-5, AC-10) and 04-phases.md.
 */
import type { CarryPlan, CarriedEarlier, PlannedCarry } from './carryForward.js';
import type { DayOutcome } from './recovery/carry.js';
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
  let method: Pick<WeekCounts, 'letGo' | 'continued' | 'noRoom'> = {};
  if (outcomes) {
    // Gap days have their own outcome (`in_gap`), so they are in none of these.
    const counted = outcomes.filter((day) => day.rules === 'method' && ids.has(day.taskId));
    method = {
      letGo: counted.filter((day) => day.topStep === 'let_go').length,
      continued: counted.filter((day) => day.topStep === 'continued').length,
      noRoom: counted.filter((day) => day.topStep === 'no_room').length,
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

export type NoticeKind = 'gentle_return' | 'swap_offer' | 'carried' | 'dropped';

export interface MissedSignals {
  carried: CarriedSignal[];
  dropped: DroppedSignal[];
  swapOffer: SwapOfferSignal | null;
  shortOnTime: boolean;
  gentleReturn: GentleReturnSignal | null;
  /** The one line P3 shows (notice fatigue, 04-phases.md 8.10), or null. */
  notice: NoticeKind | null;
}

export interface SignalInput {
  days: readonly DayClassification[];
  gap: Gap | null;
  plan: CarryPlan;
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
