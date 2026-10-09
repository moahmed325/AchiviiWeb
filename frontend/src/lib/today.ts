import type { DailyTask, DetailedStep, Goal, Reconciliation, RoadmapWeek } from '../types';
import { addDaysToDateKey, daysBetweenDateKeys, getLocalDateString } from './dateUtils';

/**
 * Today's date key ('YYYY-MM-DD') in the user's timezone (ND-1, missed-sessions M1.1b).
 * `DailyTask.date` is the user's local calendar date, so "today" is the local date too.
 * Timezone order: the one passed in (the signed-in user's), then the browser's, then UTC.
 */
export function todayKey(now: Date, timezone?: string): string {
  return getLocalDateString(now, timezone) || now.toISOString().split('T')[0];
}

export function isToday(task: Pick<DailyTask, 'date'>, now: Date, timezone?: string): boolean {
  return task.date === todayKey(now, timezone);
}

/** The current week's tasks, in day order. */
export function currentWeekTasks(goal: Pick<Goal, 'currentWeek' | 'dailyTasks'>): DailyTask[] {
  const week = goal.currentWeek || 1;
  return [...(goal.dailyTasks || [])].filter((t) => t.weekNumber === week).sort((a, b) => a.dayNumber - b.dayNumber);
}

/** The chosen task if it is in this week, else today's, else the first pending, else the first. */
export function selectTodayTask(tasks: DailyTask[], now: Date, selectedId?: string, timezone?: string): DailyTask | null {
  if (tasks.length === 0) return null;
  if (selectedId) {
    const selected = tasks.find((t) => t.id === selectedId);
    if (selected) return selected;
  }
  return tasks.find((t) => isToday(t, now, timezone)) ?? tasks.find((t) => t.status === 'pending') ?? tasks[0];
}

/** Calendar days until `targetDate`, counted down from 90, clamped to 1–90. */
export function dayNumber(goal: Pick<Goal, 'targetDate'>, now: Date, timezone?: string): number {
  // Whole calendar days, counted on date keys, so the day number turns over at the user's local midnight
  // together with the task dates. `targetDate` is a UTC instant whose UTC date is the target day.
  const target = new Date(goal.targetDate);
  if (Number.isNaN(target.getTime())) return 1;
  const daysRemaining = Math.max(0, daysBetweenDateKeys(todayKey(now, timezone), target.toISOString().slice(0, 10)));
  return Math.min(90, Math.max(1, 91 - daysRemaining));
}

/** The stored steps. Bad or missing JSON gives no steps rather than an error. */
export function parseSteps(detailedSteps?: string | null): DetailedStep[] {
  if (!detailedSteps) return [];
  try {
    const parsed: unknown = JSON.parse(detailedSteps);
    return Array.isArray(parsed) ? (parsed as DetailedStep[]) : [];
  } catch {
    return [];
  }
}

export type ParsedIntention = { raw: string } | { when: string; where: string; action: string };

/** "When: … | Where: … | Action: …", or the raw text when it has none of those parts. */
export function parseIntention(intention?: string | null): ParsedIntention | null {
  if (!intention) return null;
  let when = '';
  let where = '';
  let action = '';
  for (const part of intention.split('|').map((p) => p.trim())) {
    const lower = part.toLowerCase();
    if (lower.startsWith('when:')) when = part.replace(/^when:\s*/i, '');
    else if (lower.startsWith('where:')) where = part.replace(/^where:\s*/i, '');
    else if (lower.startsWith('action:')) action = part.replace(/^action:\s*/i, '');
  }
  if (!when && !where && !action) return { raw: intention };
  return { when, where, action };
}

/** The roadmap week for `currentWeek`, else the first week. */
export function currentRoadmapWeek(goal: Pick<Goal, 'currentWeek' | 'roadmapWeeks'>): RoadmapWeek | undefined {
  const weeks = goal.roadmapWeeks || [];
  return weeks.find((w) => w.weekNumber === (goal.currentWeek || 1)) ?? weeks[0];
}

/** Practice days only: rest days are part of the plan, not something to complete. */
export function weekProgress(tasks: DailyTask[]): { practiceDays: number; practiceDone: number } {
  const practice = tasks.filter((t) => !t.isRestDay);
  return { practiceDays: practice.length, practiceDone: practice.filter((t) => t.status === 'completed').length };
}

export interface ParsedTaskNotes {
  freeformNotes: string;
  focusWins: string[];
}

/** Longest note a user can type, matching the backend's TASK_NOTES_MAX_LENGTH (B-29). */
export const TASK_NOTES_MAX_LENGTH = 2000;

/** Parses stored task notes, separating structured focus wins ("• Focus win: ...") from free-form practice notes. */
export function parseTaskNotes(notes?: string | null): ParsedTaskNotes {
  if (!notes || !notes.trim()) {
    return { freeformNotes: '', focusWins: [] };
  }
  const lines = notes.split('\n');
  const focusWins: string[] = [];
  const freeformLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*•\s*Focus win:\s*(.*)$/i);
    if (match) {
      const win = match[1].trim();
      if (win) {
        focusWins.push(win);
      }
    } else {
      freeformLines.push(line);
    }
  }

  return {
    freeformNotes: freeformLines.join('\n').trim(),
    focusWins,
  };
}

/** Recombines free-form notes and focus wins into a canonical stored notes string. */
export function serializeTaskNotes(freeformNotes: string, focusWins: string[]): string {
  const parts: string[] = [];
  const trimmedFreeform = freeformNotes.trim();
  if (trimmedFreeform) {
    parts.push(trimmedFreeform);
  }
  for (const win of focusWins) {
    const trimmedWin = win.trim();
    if (trimmedWin) {
      parts.push(`• Focus win: ${trimmedWin}`);
    }
  }
  return parts.join('\n');
}

/** Finds the next chronological practice task in the week after currentTaskId, or null if this is the last practice task. */
export function findNextTask(tasks: DailyTask[], currentTaskId: string): DailyTask | null {
  const currentIndex = tasks.findIndex((t) => t.id === currentTaskId);
  if (currentIndex === -1) return null;
  const subsequent = tasks.slice(currentIndex + 1);
  return subsequent.find((t) => !t.isRestDay) ?? null;
}

/** Finds the task scheduled for yesterday (the calendar day before today in the user's timezone). */
export function findYesterdayTask(tasks: DailyTask[], now: Date, timezone?: string): DailyTask | null {
  const yesterdayKey = addDaysToDateKey(todayKey(now, timezone), -1);
  return tasks.find((t) => t.date === yesterdayKey) ?? null;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The weekday of a 'YYYY-MM-DD' date key ("Monday"), or null when the key cannot be read. */
export function weekdayOf(dateKey: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : WEEKDAYS[date.getUTCDay()];
}

/**
 * What the miss notice says (missed sessions M3.1, ND-16), read from the reconcile signals so Today and the
 * Dashboard never disagree (ND-19). Data only: each screen writes its own words.
 * - `day`: "Yesterday" when the day concerned is yesterday in the user's timezone, otherwise its weekday.
 * - `carried`: `intoToday` when the step landed on today, otherwise `toWeekday` names the receiving day.
 * - `gentle_return` (M3.2): only when today is an open practice day with a 10-minute version, because its line
 *   ("Today's a short one") is true only where that version is the default.
 * With the switch on (`carry.enabled`, ND-15), M3.3 adds two kinds; with it off they never appear:
 * - `swap_offer`: a held key session can be done on its receiving day instead. `day` is null when the held day is
 *   today (set aside); `when` is "today" or the receiving day's weekday.
 * - `set_aside`: the day concerned is today (04-phases.md M3.3). `movedTo` names the day that got its main step,
 *   or is null when nothing moved (a drop, known from `carry.drops` before tonight's close).
 * A rest day today, a body for another goal, or a date that cannot be read give null.
 */
export type MissNotice =
  | { kind: 'carried'; day: string; intoToday: boolean; toWeekday: string }
  | { kind: 'dropped'; day: string }
  | { kind: 'gentle_return' }
  | { kind: 'swap_offer'; day: string | null; when: string; missedTaskId: string; receivingTaskId: string }
  | { kind: 'set_aside'; movedTo: string | null };

/** Today's task when it is an open practice day (not rest, not completed) with a 10-minute version. */
function openTodayWithMinimum(goal: Pick<Goal, 'dailyTasks'>, today: string): DailyTask | null {
  return (
    (goal.dailyTasks || []).find(
      (task) => task.date === today && !task.isRestDay && task.status !== 'completed' && Boolean(task.minimumVersion),
    ) ?? null
  );
}

export function missNotice(
  reconciliation: Reconciliation | null,
  goal: Pick<Goal, 'id' | 'dailyTasks'>,
  now: Date,
  timezone?: string
): MissNotice | null {
  // A body for another goal (an earlier one, before a reset) says nothing about this one.
  if (!reconciliation || reconciliation.goalId !== goal.id) return null;
  const signals = reconciliation.signals;
  if (!signals) return null;
  const today = todayKey(now, timezone);
  // AC-5: a rest day never shows a miss line. The backend already returns none; the UI keeps that true.
  if ((goal.dailyTasks || []).some((task) => task.date === today && task.isRestDay)) return null;
  const dayLabel = (date: string) => (date === addDaysToDateKey(today, -1) ? 'Yesterday' : weekdayOf(date));

  if (signals.notice === 'gentle_return') {
    return openTodayWithMinimum(goal, today) ? { kind: 'gentle_return' } : null;
  }
  if (reconciliation.carry?.enabled) {
    const offer = signals.swapOffer;
    if (signals.notice === 'swap_offer' && offer && offer.receivingDate >= today) {
      const setAside = offer.missedDate === today;
      const day = setAside ? null : dayLabel(offer.missedDate);
      const when = offer.receivingDate === today ? 'today' : weekdayOf(offer.receivingDate);
      // Both days must be in the loaded goal: answering sends their steps as loaded.
      const tasks = goal.dailyTasks || [];
      const known = tasks.some((t) => t.id === offer.missedTaskId) && tasks.some((t) => t.id === offer.receivingTaskId);
      if ((setAside || day) && when && known) {
        return { kind: 'swap_offer', day, when, missedTaskId: offer.missedTaskId, receivingTaskId: offer.receivingTaskId };
      }
      return null;
    }
    const fromToday = signals.carried.find((carried) => carried.fromDate === today);
    if (fromToday) {
      const movedTo = weekdayOf(fromToday.toDate);
      return movedTo ? { kind: 'set_aside', movedTo } : null;
    }
    if (todayDropped(reconciliation, today)) return { kind: 'set_aside', movedTo: null };
  }

  if (signals.notice === 'carried') {
    const carried = signals.carried[0];
    if (!carried) return null;
    const day = dayLabel(carried.fromDate);
    const toWeekday = weekdayOf(carried.toDate);
    if (!day || !toWeekday) return null;
    return { kind: 'carried', day, intoToday: carried.toDate === today, toWeekday };
  }
  if (signals.notice === 'dropped') {
    const dropped = signals.dropped[0];
    const day = dropped ? dayLabel(dropped.date) : null;
    return day ? { kind: 'dropped', day } : null;
  }
  return null;
}

/** Today was planned as missed and dropped: by "Set today aside" (only that response knows, M2.4) or at its close. */
function todayDropped(reconciliation: Reconciliation, today: string): boolean {
  const day = (reconciliation.days || []).find((d) => d.date === today && d.kind === 'missed');
  return Boolean(day && (reconciliation.carry?.drops || []).some((drop) => drop.taskId === day.taskId));
}

type MarkedStep = { carriedFrom?: { taskId?: unknown }; swappedFrom?: { taskId?: unknown } };

/**
 * The days a move already touched, read from the stored steps' markers (M2.2 `carriedFrom`, ND-18 `swappedFrom`):
 * - `handled`: the source of a carry or a swap, or a day holding a swapped step (the backend's `handledTaskIds`).
 * - `holding`: a day holding any moved step.
 */
export function movedDays(tasks: ReadonlyArray<Pick<DailyTask, 'id' | 'detailedSteps'>>): { handled: Set<string>; holding: Set<string> } {
  const handled = new Set<string>();
  const holding = new Set<string>();
  for (const task of tasks) {
    for (const step of parseSteps(task.detailedSteps) as MarkedStep[]) {
      const carried = step?.carriedFrom && typeof step.carriedFrom.taskId === 'string' ? step.carriedFrom.taskId : null;
      const swapped = step?.swappedFrom && typeof step.swappedFrom.taskId === 'string' ? step.swappedFrom.taskId : null;
      if (carried) {
        handled.add(carried);
        holding.add(task.id);
      }
      if (swapped) {
        handled.add(swapped);
        handled.add(task.id);
        holding.add(task.id);
      }
    }
  }
  return { handled, holding };
}

/**
 * What a user may do to today's plan by hand (missed sessions M3.3, AC-2, ND-14), or null when nothing: the switch
 * is off (ND-15), the body is for another goal, or today is not an open practice day.
 * - `canSetAside`: today is not already the source of a move, and not already set aside (held or dropped).
 * - `canSwap`: as above, and today is not the test day and holds no moved step.
 * - `swapWith`: the open practice days later this week that are not the test day and no move has touched.
 */
export interface TodayActions {
  today: DailyTask;
  canSetAside: boolean;
  canSwap: boolean;
  swapWith: DailyTask[];
}

export function todayActions(
  reconciliation: Reconciliation | null,
  goal: Pick<Goal, 'id' | 'currentWeek' | 'dailyTasks'>,
  now: Date,
  timezone?: string
): TodayActions | null {
  if (!reconciliation || reconciliation.goalId !== goal.id || !reconciliation.carry?.enabled) return null;
  const date = todayKey(now, timezone);
  const week = currentWeekTasks(goal);
  const today = week.find((task) => task.date === date);
  if (!today || today.isRestDay || today.status === 'completed') return null;
  const { handled, holding } = movedDays(week);
  const setAside =
    (reconciliation.days || []).some((d) => d.taskId === today.id && d.kind === 'missed') ||
    reconciliation.signals?.swapOffer?.missedTaskId === today.id;
  const canSetAside = !handled.has(today.id) && !setAside;
  const canSwap = canSetAside && !today.isTestDay && !holding.has(today.id);
  const swapWith = week.filter(
    (task) =>
      task.date > date &&
      !task.isRestDay &&
      !task.isTestDay &&
      task.status !== 'completed' &&
      !handled.has(task.id) &&
      !holding.has(task.id),
  );
  return { today, canSetAside, canSwap, swapWith };
}

/**
 * Short on time (missed sessions M3.2, UX-2, RULE-9): offer the 10-minute version beside Start. True when the signal
 * is set, today is an open practice day with a 10-minute version, and today is not a gentle-return day (there the
 * 10-minute version is already the default).
 */
export function shortOnTimeOffer(
  reconciliation: Reconciliation | null,
  goal: Pick<Goal, 'id' | 'dailyTasks'>,
  now: Date,
  timezone?: string
): boolean {
  if (!reconciliation || reconciliation.goalId !== goal.id) return false;
  const signals = reconciliation.signals;
  if (!signals?.shortOnTime || signals.notice === 'gentle_return') return false;
  return openTodayWithMinimum(goal, todayKey(now, timezone)) !== null;
}

/**
 * Checks whether the weekly review is due.
 * Returns true if all tasks in the current week have dates strictly before today's date in the user's timezone
 * OR if all scheduled active practice tasks for the week are completed.
 */
export function isWeekReviewDue(tasks: DailyTask[], now: Date, timezone?: string): boolean {
  if (tasks.length === 0) return false;
  const today = todayKey(now, timezone);
  if (tasks.every((t) => t.date < today)) return true;

  const activePracticeTasks = tasks.filter((t) => !t.isRestDay);
  if (activePracticeTasks.length > 0 && activePracticeTasks.every((t) => t.status === 'completed')) {
    return true;
  }

  return false;
}

/**
 * Checks whether the closing stretch (Days 85–90, OD-2 Option A, BP §34) is active for an active goal.
 * Triggered when:
 * 1. goal.status === 'active' AND
 * 2. Either:
 *    - dayNumber(goal, now) >= 85, OR
 *    - goal.currentWeek >= 12 AND all scheduled active practice tasks for week 12 are completed or reviewed.
 */
export function isClosingStretchActive(goal: Goal, now: Date, timezone?: string): boolean {
  if (goal.status === 'completed' || goal.status === 'archived') return false;

  const day = dayNumber(goal, now, timezone);
  if (day >= 85) return true;

  const currentWeek = goal.currentWeek ?? 1;
  if (currentWeek >= 12) {
    const week12Tasks = (goal.dailyTasks || []).filter((t) => t.weekNumber === 12);
    const activeTasks = week12Tasks.filter((t) => !t.isRestDay);
    const allDone = activeTasks.length > 0 && activeTasks.every((t) => t.status === 'completed');
    const reviewed = Boolean(goal.weeklyReviews?.some((r) => r.weekNumber === 12));
    if (allDone || reviewed) {
      return true;
    }
  }

  return false;
}


