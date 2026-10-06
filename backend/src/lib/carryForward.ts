/**
 * Missed sessions, P2 / M2.2: the carry-forward planner.
 * Pure: no database, no clock, no environment. Given how every day is classified, the open gap, the tasks with
 * their stored steps, the goal and the user's local today, it decides which missed priority-1 steps move, where,
 * and which are dropped. `POST /reconcile` writes the result behind the ND-15 switch.
 * Rules: docs/features/missed-sessions/03-feature.md section 11 and 04-phases.md ND-9 to ND-17.
 */
import type { DetailedStep } from './ai/goalDecomposer.js';
import { isHighLoadStep } from './highLoad.js';
import { dayCloseInstant, type ClassifiableTask, type DayClassification, type Gap } from './missedSessions.js';

/** ND-13: stored on a carried step, so the move is auditable, reversible and never made twice. */
export interface CarryMarker {
  taskId: string;
  date: string;
  /** The receiving day's steps this carry replaced (ND-10). */
  replaced: DetailedStep[];
}

export type CarriedStep = DetailedStep & { carriedFrom?: CarryMarker };

/** A task as the planner sees it: classification fields plus its parsed steps and planned minutes. */
export interface CarryTask extends ClassifiableTask {
  durationMinutes: number;
  steps: CarriedStep[];
}

export type DropReason =
  | 'no_receiving_day'
  | 'receiving_day_closed'
  | 'receiving_day_done'
  | 'receiving_day_taken'
  | 'lost_to_later_miss'
  | 'in_gap'
  | 'high_load'
  | 'does_not_fit'
  | 'swap_unanswered'
  | 'no_priority_step';

export interface PlannedCarry {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
  /** The carried step as it will be stored on the receiving day, with its `carriedFrom` marker. */
  step: CarriedStep;
  /** The receiving day's steps it replaces. */
  replaced: DetailedStep[];
  /** The receiving day's full new step list, and its new total minutes (never more than before). */
  steps: CarriedStep[];
  durationMinutes: number;
}

export interface CarryDrop {
  taskId: string;
  date: string;
  reason: DropReason;
}

/** ND-9: a missed key session waits for a swap answer while its receiving day is open. */
export interface HeldCarry {
  taskId: string;
  date: string;
  receivingTaskId: string;
  /** The instant the receiving day closes; an unanswered offer is then dropped (ND-17). */
  offerUntil: string;
}

export interface CarriedEarlier {
  fromTaskId: string;
  fromDate: string;
  toTaskId: string;
  toDate: string;
  step: CarriedStep;
}

export interface CarryPlan {
  carries: PlannedCarry[];
  drops: CarryDrop[];
  held: HeldCarry[];
  alreadyCarried: CarriedEarlier[];
}

export interface CarryInput {
  days: readonly DayClassification[];
  gap: Gap | null;
  tasks: readonly CarryTask[];
  goal: { rawGoal: string; clarifiedOutcome: string };
  /** The user's local calendar date, 'YYYY-MM-DD'. */
  today: string;
  timezone: string;
  sleepTime?: unknown;
}

/** `DailyTask.detailedSteps` is a JSON string; anything unreadable is no steps. */
export function parseStoredSteps(detailedSteps: unknown): CarriedStep[] {
  if (typeof detailedSteps !== 'string' || !detailedSteps) return [];
  try {
    const parsed: unknown = JSON.parse(detailedSteps);
    return Array.isArray(parsed) ? parsed.filter((step): step is CarriedStep => !!step && typeof step === 'object') : [];
  } catch {
    return [];
  }
}

function markerOf(step: CarriedStep): CarryMarker | null {
  const marker = step.carriedFrom;
  return marker && typeof marker === 'object' && typeof marker.taskId === 'string' ? marker : null;
}

/** Stored test steps are ranked like any step (weekPlan `rankSteps`), so they are also recognized by title. */
const TEST_STEP = /^weekly test\b/i;

const minutesOf = (steps: readonly DetailedStep[]) => steps.reduce((sum, step) => sum + Math.max(0, step.durationMinutes || 0), 0);
const hasPriority = (step: DetailedStep): step is DetailedStep & { priority: number } =>
  typeof step.priority === 'number' && Number.isFinite(step.priority);

function byDate(a: DayClassification, b: DayClassification): number {
  return a.date === b.date ? a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1;
}

/**
 * ND-10: the receiving day's new steps, or null when the carried step cannot fit.
 * Removes the lowest-priority steps, lowest first, until the day is no longer than before. Its own priority-1
 * step and test step (priority 0) are never removed. The carried step comes directly after the day's own
 * priority-1 step, in both order and priority; everything else keeps its relative order and is renumbered.
 */
export function fitCarriedStep(
  receiving: { steps: readonly CarriedStep[]; durationMinutes: number },
  carried: CarriedStep
): { steps: CarriedStep[]; replaced: DetailedStep[]; durationMinutes: number } | null {
  const steps = receiving.steps;
  if (steps.length === 0 || !steps.every(hasPriority)) return null;
  const ownLead = steps.find((step) => step.priority === 1);
  if (!ownLead) return null;

  const before = minutesOf(steps);
  // Never longer than the steps were, nor than the day's planned minutes.
  const limit = receiving.durationMinutes > 0 ? Math.min(before, receiving.durationMinutes) : before;
  const removable = steps
    .filter((step) => (step.priority as number) > 1 && !TEST_STEP.test(step.title ?? ''))
    .sort((a, b) => (b.priority as number) - (a.priority as number));
  const carriedMinutes = Math.max(0, carried.durationMinutes || 0);

  const removed = new Set<CarriedStep>();
  let total = before + carriedMinutes;
  for (const step of removable) {
    if (total <= limit) break;
    removed.add(step);
    total -= Math.max(0, step.durationMinutes || 0);
  }
  if (total > limit) return null;

  const kept = steps.filter((step) => !removed.has(step));
  const ordered: CarriedStep[] = [];
  for (const step of kept) {
    ordered.push(step);
    if (step === ownLead) ordered.push(carried);
  }
  const ranked = [ownLead, carried, ...kept.filter((step) => step !== ownLead && step.priority !== 0).sort((a, b) => (a.priority as number) - (b.priority as number))];
  const priorityOf = new Map(ranked.map((step, index) => [step, index + 1]));

  const next = ordered.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
    priority: priorityOf.get(step) ?? 0,
  }));
  return { steps: next, replaced: steps.filter((step) => removed.has(step)), durationMinutes: total };
}

/**
 * Plans every carry and drop for the classified days. Deterministic for the same input.
 *
 * For each missed practice day that is not already the source of a stored `carriedFrom` marker, in this order:
 * 1. in the open gap → `in_gap` (ND-11);
 * 2. its receiving day (ND-17: the first later day of the same week that is a practice day, not rest and not
 *    the test day; next week's rows are never used) does not exist → `no_receiving_day`;
 * 3. a later missed day has the same receiving day → `lost_to_later_miss` (ND-12);
 * 4. no priority-1 step → `no_priority_step`;
 * 5. `isHighLoadStep` → `high_load` (RULE-10);
 * 6. receiving day done → `receiving_day_done`; closed (missed) → `swap_unanswered` for a key session,
 *    otherwise `receiving_day_closed`; already holds a carry → `receiving_day_taken`;
 * 7. a key session whose receiving day is still open → held for the swap answer (ND-9);
 * 8. receiving day dated before today (open only until its close) → `receiving_day_closed`;
 * 9. the fit rule (ND-10) fails → `does_not_fit`; otherwise it is carried.
 */
export function planCarries(input: CarryInput): CarryPlan {
  const plan: CarryPlan = { carries: [], drops: [], held: [], alreadyCarried: [] };
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const ordered = [...input.days].sort(byDate);

  const handled = new Set<string>();
  const taken = new Set<string>();
  for (const day of ordered) {
    const task = taskById.get(day.taskId);
    for (const step of task?.steps ?? []) {
      const marker = markerOf(step);
      if (!marker) continue;
      handled.add(marker.taskId);
      taken.add(day.taskId);
      plan.alreadyCarried.push({ fromTaskId: marker.taskId, fromDate: marker.date, toTaskId: day.taskId, toDate: day.date, step });
    }
  }

  const inGap = new Set(input.gap?.taskIds ?? []);
  const receivingOf = (index: number): DayClassification | null => {
    const from = ordered[index];
    for (const day of ordered.slice(index + 1)) {
      if (day.weekNumber !== from.weekNumber) continue;
      if (day.kind !== 'rest' && !day.isTestDay) return day;
    }
    return null;
  };

  const contenders: Array<{ missed: DayClassification; receiving: DayClassification }> = [];
  ordered.forEach((day, index) => {
    if (day.kind !== 'missed' || handled.has(day.taskId)) return;
    const drop = (reason: DropReason) => plan.drops.push({ taskId: day.taskId, date: day.date, reason });
    if (inGap.has(day.taskId)) return drop('in_gap');
    const receiving = receivingOf(index);
    if (!receiving) return drop('no_receiving_day');
    contenders.push({ missed: day, receiving });
  });

  // ND-12: per receiving day, only the most recent missed day competes.
  const latest = new Map<string, DayClassification>();
  for (const { missed, receiving } of contenders) latest.set(receiving.taskId, missed);

  for (const { missed, receiving } of contenders) {
    const drop = (reason: DropReason) => plan.drops.push({ taskId: missed.taskId, date: missed.date, reason });
    if (latest.get(receiving.taskId) !== missed) {
      drop('lost_to_later_miss');
      continue;
    }
    const source = taskById.get(missed.taskId);
    const lead = source?.steps.find((step) => step.priority === 1 && !markerOf(step));
    if (!source || !lead) {
      drop('no_priority_step');
      continue;
    }
    if (isHighLoadStep(lead, input.goal)) {
      drop('high_load');
      continue;
    }
    if (receiving.kind === 'done') {
      drop('receiving_day_done');
      continue;
    }
    if (receiving.kind === 'missed') {
      drop(missed.isKeySession ? 'swap_unanswered' : 'receiving_day_closed');
      continue;
    }
    if (taken.has(receiving.taskId)) {
      drop('receiving_day_taken');
      continue;
    }
    if (missed.isKeySession) {
      plan.held.push({
        taskId: missed.taskId,
        date: missed.date,
        receivingTaskId: receiving.taskId,
        offerUntil: dayCloseInstant(receiving.date, input.sleepTime, input.timezone).toISOString(),
      });
      continue;
    }
    if (receiving.date < input.today) {
      drop('receiving_day_closed');
      continue;
    }

    const target = taskById.get(receiving.taskId);
    const { carriedFrom: _ignored, ...content } = lead;
    const carried: CarriedStep = { ...content, carriedFrom: { taskId: missed.taskId, date: missed.date, replaced: [] } };
    const fit = target ? fitCarriedStep(target, carried) : null;
    if (!fit) {
      drop('does_not_fit');
      continue;
    }
    const steps = fit.steps.map((step) =>
      step.carriedFrom === carried.carriedFrom ? { ...step, carriedFrom: { ...carried.carriedFrom!, replaced: fit.replaced } } : step
    );
    taken.add(receiving.taskId);
    plan.carries.push({
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

  plan.drops.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  return plan;
}
