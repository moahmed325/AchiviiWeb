import { getZonedTimeParts, normalizeTimezone } from '../timezone.js';
import { addDays } from '../missedSessions.js';

/**
 * ND-28: who gets the missed-day reminder email, decided in code from stored data only. One gentle email the morning
 * after a missed practice day, pointing back to today's step. Never nagging:
 * - only when yesterday was a practice day with nothing done and today has an open practice day;
 * - only in the person's morning (`SEND_FROM_HOUR` to `SEND_UNTIL_HOUR`, their time zone);
 * - one per gap: no new reminder until a practice day is completed after the last one, and never two within
 *   `MIN_DAYS_BETWEEN` days;
 * - never when they turned reminders off.
 * The email does not name today's step: opening the app can still move it (carry, ND-25's swap).
 */

export const SEND_FROM_HOUR = 8;
export const SEND_UNTIL_HOUR = 12;
export const MIN_DAYS_BETWEEN = 3;

export interface ReminderTask {
  date: string;
  status: string;
  isRestDay: boolean;
  notOffered: boolean;
  minimumVersion: unknown;
}

export interface ReminderCandidate {
  userId: string;
  email: string;
  timezone: string;
  remindersEnabled: boolean;
  lastReminderAt: Date | null;
  /** When a practice day was last completed; needed only when `lastReminderAt` is set. */
  lastCompletedAt: Date | null;
  /** The active goal's days around today (at least yesterday and today in the person's zone). */
  tasks: ReminderTask[];
}

export interface Reminder {
  userId: string;
  email: string;
  /** The person's local date the reminder is for, so a resend the same day is recognised (idempotency). */
  today: string;
  /** Whether today's step has a 10-minute version to point at. */
  hasMinimum: boolean;
}

const DAY_MS = 86_400_000;

const isPractice = (task: ReminderTask) => !task.isRestDay && !task.notOffered;

/** The person's local date and hour at `now`. */
export function localNow(timezone: string, now: Date): { today: string; hour: number } {
  const { dateStr, hours } = getZonedTimeParts(now, normalizeTimezone(timezone));
  return { today: dateStr, hour: hours };
}

/**
 * The reminder due for this person at `now`, or null. With `ignoreGap`, the one-per-gap rule is skipped: the run asks
 * that first and loads `lastCompletedAt` only for the few people it would matter for.
 */
export function reminderFor(candidate: ReminderCandidate, now: Date, ignoreGap = false): Reminder | null {
  if (!candidate.remindersEnabled) return null;

  const { today, hour } = localNow(candidate.timezone, now);
  if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) return null;

  // A date can hold more than one row (a week boundary); yesterday counts as missed only if nothing on it was done.
  const yesterday = candidate.tasks.filter((task) => task.date === addDays(today, -1));
  const missed = yesterday.some(isPractice) && !yesterday.some((task) => task.status === 'completed');
  const todayOpen = candidate.tasks.filter((task) => task.date === today && isPractice(task) && task.status !== 'completed');
  if (!missed || todayOpen.length === 0) return null;

  const last = candidate.lastReminderAt;
  if (last && !ignoreGap) {
    if (now.getTime() - last.getTime() < MIN_DAYS_BETWEEN * DAY_MS) return null;
    // One per gap: a reminder already went out and no practice day was completed since.
    if (!candidate.lastCompletedAt || candidate.lastCompletedAt.getTime() <= last.getTime()) return null;
  }

  return {
    userId: candidate.userId,
    email: candidate.email,
    today,
    hasMinimum: todayOpen.some((task) => task.minimumVersion != null),
  };
}
