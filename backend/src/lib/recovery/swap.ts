/**
 * Method-aware recovery M3.2 (RULE-12 to RULE-14, RULE-16): may two days of the same week swap? One pure check, used
 * for the hold of a key session (`carry.ts`), the choices the reconcile body sends and the swap route, so they never
 * disagree. Pure: no database, no clock, no environment.
 *
 * A swap trades the two days' whole content (dates stay), so it trades their lengths too: that is the person's
 * choice, and there is no "no day longer" check. It is refused only for what it would break:
 * - a day holding a step placed by a reorder (`shiftedFrom`) or a continue marker (RULE-10): any switch state;
 * - with a valid profile, a fixed step on either day (RULE-12, MR-17), a step of an in-order kind coming after a later
 *   one of its kind (RULE-13, RULE-20), or two hard steps closer than the rest gap (RULE-14, MR-29). Order and rest gap
 *   are refused only for a breach the swap creates or makes worse: what the week already holds does not block a swap
 *   that keeps it, and a rest-gap closeness may stay or widen but never narrow.
 * Steps without a kind (RULE-18) are never fixed or in order; they are hard as the carry planner reads them.
 */
import type { CarriedStep, CarryTask } from '../carryForward.js';
import type { DayClassification } from '../missedSessions.js';
import { byWritten, originOf, stepKey } from './inOrder.js';
import type { RecoveryProfile } from './profile.js';
import { continueMarkerOf, countsForRest, dayNumberOf, isFixedStep, isHardStep, shiftMarkerOf, type GoalText } from './rules.js';

/** Why two days may not swap. `holds_carry` here is a `shiftedFrom` step; the route adds `carriedFrom`. */
export type SwapRefusal = 'holds_carry' | 'holds_continue' | 'fixed_step' | 'out_of_order' | 'rest_gap';

export interface SwapWeek {
  /** Every classified day of the goal (last week included, for the rest gap). */
  days: readonly DayClassification[];
  tasks: readonly Pick<CarryTask, 'id' | 'steps'>[];
  profile: RecoveryProfile | null | undefined;
  goal: GoalText;
}

/**
 * Any switch state: a day holding a reorder's step or a continue marker is never swapped (RULE-10, RULE-20). B-50
 * (Mo): a continue marker whose day is in `done` is ignored, so it does not hold the day.
 */
export function markerRefusal(rows: ReadonlyArray<readonly CarriedStep[]>, done: ReadonlySet<string> = new Set()): SwapRefusal | null {
  if (rows.some((steps) => steps.some((step) => shiftMarkerOf(step) !== null))) return 'holds_carry';
  if (rows.some((steps) => steps.some((step) => { const marker = continueMarkerOf(step); return marker !== null && !done.has(marker.taskId); }))) return 'holds_continue';
  return null;
}

/** The ids of the days classified done, for `markerRefusal`. */
export const doneDayIds = (days: readonly DayClassification[]): ReadonlySet<string> =>
  new Set(days.filter((day) => day.kind === 'done').map((day) => day.taskId));

interface Placed {
  step: CarriedStep;
  /** The day that holds it now. */
  from: DayClassification;
  index: number;
}

/**
 * With a valid profile: the first of RULE-12, RULE-13 and RULE-14 that a swap of `aId` and `bId` breaks, or null.
 * Without a profile, null: only missed sessions' checks apply.
 */
export function methodSwapRefusal(week: SwapWeek, aId: string, bId: string): SwapRefusal | null {
  const { profile } = week;
  if (!profile) return null;
  const dayOf = new Map(week.days.map((day) => [day.taskId, day]));
  const stepsOf = new Map(week.tasks.map((task) => [task.id, task.steps]));
  const a = dayOf.get(aId);
  const b = dayOf.get(bId);
  if (!a || !b) return null;
  const rowA = stepsOf.get(aId) ?? [];
  const rowB = stepsOf.get(bId) ?? [];

  // RULE-12: a fixed step never moves, so neither day may hold one.
  if ([...rowA, ...rowB].some((step) => isFixedStep(step, profile))) return 'fixed_step';

  /** The day a step stands on after the swap. */
  const after = (from: DayClassification) => (from === a ? b : from === b ? a : from);
  const steps: Placed[] = week.days.flatMap((from) => (stepsOf.get(from.taskId) ?? []).map((step, index) => ({ step, from, index })));

  // RULE-13: each in-order kind's steps not done yet keep their written order by date. The live copy of a step is the
  // one on its latest day (a missed day keeps an old copy after a reorder); a step done anywhere is done.
  const inOrderKinds = new Set(profile.kinds.filter((kind) => kind.inOrder).map((kind) => kind.id));
  for (const kind of inOrderKinds) {
    const ofKind = steps
      .filter((placed) => placed.from.weekNumber === a.weekNumber && placed.from.kind !== 'rest' && placed.step.kind === kind)
      .sort((x, y) => (x.from.date === y.from.date ? x.index - y.index : x.from.date < y.from.date ? -1 : 1));
    const done = new Set(
      steps.filter((placed) => placed.from.kind === 'done' && placed.step.kind === kind).map((placed) => stepKey(originOf(placed.step, placed.from), placed.step.title))
    );
    const live = new Map<string, Placed & { origin: { taskId: string; date: string } }>();
    for (const placed of ofKind) {
      const origin = originOf(placed.step, placed.from);
      live.set(stepKey(origin, placed.step.title), { ...placed, origin });
    }
    const open = [...live].filter(([key]) => !done.has(key)).map(([, item]) => item);
    const position = (item: Placed, swapped: boolean) => {
      const day = swapped ? after(item.from) : item.from;
      return { date: day.date, index: item.index };
    };
    const later = (p: { date: string; index: number }, q: { date: string; index: number }) => (p.date === q.date ? p.index > q.index : p.date > q.date);
    for (const x of open) {
      for (const y of open) {
        if (x === y || byWritten({ origin: x.origin, step: x.step, title: x.step.title }, { origin: y.origin, step: y.step, title: y.step.title }) >= 0) continue;
        // x is written before y: refused when the swap puts x after y and it was not after y already.
        if (later(position(x, true), position(y, true)) && !later(position(x, false), position(y, false))) return 'out_of_order';
      }
    }
  }

  // RULE-14: a hard step that changes day never ends within the rest gap of another hard step on a done or open day
  // unless it was at least that close already (M3.2 review: a swap may keep or widen the writer's closeness, never
  // narrow it). Steps of one day move together, so their closeness stays as written.
  const gap = profile.restGapDays ?? 0;
  const hard = steps.filter((placed) => isHardStep(placed.step, profile, week.goal));
  /** The calendar days between two hard steps when both days count for rest, or null. */
  const distance = (x: Placed, y: Placed, swapped: boolean) => {
    const dx = swapped ? after(x.from) : x.from;
    const dy = swapped ? after(y.from) : y.from;
    return countsForRest(dx) && countsForRest(dy) ? Math.abs(dayNumberOf(dx.date) - dayNumberOf(dy.date)) : null;
  };
  for (const x of hard) {
    if (x.from !== a && x.from !== b) continue;
    for (const y of hard) {
      if (y === x || y.from === x.from) continue;
      const swappedDistance = distance(x, y, true);
      const before = distance(x, y, false);
      if (swappedDistance !== null && swappedDistance <= gap && (before === null || swappedDistance < before)) return 'rest_gap';
    }
  }
  return null;
}

/**
 * RULE-16 (MR-28 (3)): a key session is held for its swap offer only when its swap with its receiving day passes
 * every check (`markerRefusal`, then `methodSwapRefusal`). The reason, or null when it may be held.
 */
export function holdRefusal(week: SwapWeek, taskId: string, receivingTaskId: string): SwapRefusal | null {
  const stepsOf = new Map(week.tasks.map((task) => [task.id, task.steps]));
  return markerRefusal([stepsOf.get(taskId) ?? [], stepsOf.get(receivingTaskId) ?? []], doneDayIds(week.days)) ?? methodSwapRefusal(week, taskId, receivingTaskId);
}
