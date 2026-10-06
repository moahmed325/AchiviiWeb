/**
 * Missed sessions, P1 / M1.2: day-close, classification and gap detection.
 * Pure functions: no database, no network, no clock. `now` is always passed in, and nothing here
 * depends on the server's timezone. "Missed" is derived each time and never stored (ND-2).
 * See docs/features/missed-sessions/03-feature.md (OD-1, RULE-5, RULE-8) and milestones/m1.2-day-close-classification.md.
 */
import { normalizeTimezone, zonedWallTimeToInstant } from './timezone.js';

/** The fields classification reads. A Prisma `DailyTask` satisfies this shape. */
export interface ClassifiableTask {
  id: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  status: string;
  isRestDay: boolean;
  isKeySession: boolean;
  isTestDay: boolean;
}

export type DayKind = 'done' | 'missed' | 'rest' | 'planned';

export interface DayClassification {
  taskId: string;
  date: string;
  weekNumber: number;
  dayNumber: number;
  isKeySession: boolean;
  isTestDay: boolean;
  kind: DayKind;
}

export interface Gap {
  firstDate: string;
  lastDate: string;
  length: number;
  taskIds: string[];
}

/** RULE-8: this many missed practice days in a row is a gap. */
export const GAP_MIN_DAYS = 3;

const MINUTES_PER_DAY = 24 * 60;
/** OD-1: the day closes this long after bedtime... */
const CLOSE_BUFFER_MINUTES = 2 * 60;
/** ...but never later than 04:00 the next morning, local time. */
const LATEST_CLOSE_MINUTES = MINUTES_PER_DAY + 4 * 60;
/** Bedtimes from 18:00 are that evening; earlier ones (01:00, a night-shift 09:00) are after midnight. */
const EVENING_FROM_MINUTES = 18 * 60;

/** Minutes past midnight for a valid 'HH:MM', otherwise null. */
function parseClockTime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function addDays(dateStr: string, days: number): string {
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * OD-1: the instant the day dated `date` closes, in the user's timezone.
 * Bedtime + 2 hours on the local clock, capped at 04:00 the next morning. A missing or malformed
 * `sleepTime` closes the day at that 04:00, the latest possible close, so it can never cause a false miss.
 * A missing or invalid timezone is read as UTC.
 */
export function dayCloseInstant(date: string, sleepTime: unknown, timezone?: unknown): Date {
  const tz = normalizeTimezone(timezone);
  const bedtime = parseClockTime(sleepTime);
  const closeMinutes =
    bedtime === null
      ? LATEST_CLOSE_MINUTES
      : Math.min(bedtime + (bedtime >= EVENING_FROM_MINUTES ? 0 : MINUTES_PER_DAY) + CLOSE_BUFFER_MINUTES, LATEST_CLOSE_MINUTES);
  const dayOffset = Math.floor(closeMinutes / MINUTES_PER_DAY);
  const minuteOfDay = closeMinutes % MINUTES_PER_DAY;
  const time = `${String(Math.floor(minuteOfDay / 60)).padStart(2, '0')}:${String(minuteOfDay % 60).padStart(2, '0')}`;
  return zonedWallTimeToInstant(addDays(date, dayOffset), time, tz);
}

/**
 * Classifies every task at `now` (ND-2: derived, never stored).
 * - rest: a rest day, whatever its status or time (RULE-5).
 * - done: a practice day marked completed, closed or not. Completion is stored per day, so this is the only
 *   signal; the 10-minute version is stored the same way and counts (RULE-4).
 * - missed: a practice day whose day has closed and that is not completed.
 * - planned: a practice day still open (today, yesterday before its close, future days), or one whose date
 *   cannot be read, which is never called missed.
 * Test days and key sessions classify like any practice day; their flags are carried for later phases.
 */
export function classifyDays(
  tasks: readonly ClassifiableTask[],
  context: { now: Date; timezone?: unknown; sleepTime?: unknown }
): DayClassification[] {
  const nowMs = context.now.getTime();
  const closes = new Map<string, number>();
  const closeOf = (date: string) => {
    let close = closes.get(date);
    if (close === undefined) {
      close = dayCloseInstant(date, context.sleepTime, context.timezone).getTime();
      closes.set(date, close);
    }
    return close;
  };

  return tasks.map((task) => {
    let kind: DayKind;
    if (task.isRestDay) kind = 'rest';
    else if (task.status === 'completed') kind = 'done';
    else if (isDateKey(task.date) && closeOf(task.date) <= nowMs) kind = 'missed';
    else kind = 'planned';
    return {
      taskId: task.id,
      date: task.date,
      weekNumber: task.weekNumber,
      dayNumber: task.dayNumber,
      isKeySession: task.isKeySession,
      isTestDay: task.isTestDay,
      kind,
    };
  });
}

/**
 * RULE-8: the open gap, if any. Walks the days in date order; rest days neither count nor break a run,
 * and runs continue across week boundaries. A done day breaks the run; open (planned) days are after every
 * closed day, so the run that remains is the one ending at the most recent closed practice day.
 * Returns it when it is at least GAP_MIN_DAYS long, otherwise null.
 */
export function findOpenGap(days: readonly DayClassification[]): Gap | null {
  const ordered = [...days].sort((a, b) =>
    a.date === b.date ? a.weekNumber - b.weekNumber || a.dayNumber - b.dayNumber : a.date < b.date ? -1 : 1
  );
  let run: DayClassification[] = [];
  for (const day of ordered) {
    if (day.kind === 'missed') run.push(day);
    else if (day.kind === 'done') run = [];
  }
  if (run.length < GAP_MIN_DAYS) return null;
  return {
    firstDate: run[0].date,
    lastDate: run[run.length - 1].date,
    length: run.length,
    taskIds: run.map((d) => d.taskId),
  };
}
