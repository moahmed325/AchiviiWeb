import { getZonedTimeParts, normalizeTimezone } from '../timezone.js';

/**
 * ND-26: who gets the missed-day reminder email, decided in code from stored data only. One gentle email the morning
 * after a missed practice day, pointing at today's step and its 10-minute version. Never nagging:
 * - only when yesterday was an open practice day left undone and today is an open practice day;
 * - only in the person's morning (`SEND_FROM_HOUR` to `SEND_UNTIL_HOUR`, their time zone);
 * - one per gap: no new reminder until a practice day is completed after the last one, and never two within
 *   `MIN_DAYS_BETWEEN` days;
 * - never when they turned reminders off.
 */

export const SEND_FROM_HOUR = 8;
export const SEND_UNTIL_HOUR = 12;
export const MIN_DAYS_BETWEEN = 3;

export interface ReminderTask {
  date: string;
  status: string;
  isRestDay: boolean;
  notOffered: boolean;
  title: string;
  durationMinutes: number;
  completedAt: Date | null;
  minimumVersion: unknown;
}

export interface ReminderCandidate {
  userId: string;
  email: string;
  timezone: string;
  remindersEnabled: boolean;
  lastReminderAt: Date | null;
  /** The active goal's days. */
  tasks: ReminderTask[];
}

export interface Reminder {
  userId: string;
  email: string;
  /** Today's step, as the email names it. */
  todayTitle: string;
  todayMinutes: number;
  /** Whether today's step has a 10-minute version to point at. */
  hasMinimum: boolean;
}

const DAY_MS = 86_400_000;

/** The 'YYYY-MM-DD' key one day before `dateKey` (calendar arithmetic on the key, not on an instant). */
export function dayBefore(dateKey: string): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
}

const isOpenPractice = (task: ReminderTask | undefined): task is ReminderTask =>
  Boolean(task && !task.isRestDay && !task.notOffered && task.status !== 'completed');

export function reminderFor(candidate: ReminderCandidate, now: Date): Reminder | null {
  if (!candidate.remindersEnabled) return null;

  const { dateStr: today, hours } = getZonedTimeParts(now, normalizeTimezone(candidate.timezone));
  if (hours < SEND_FROM_HOUR || hours >= SEND_UNTIL_HOUR) return null;

  const yesterday = dayBefore(today);
  const missed = candidate.tasks.find((task) => task.date === yesterday);
  const todayTask = candidate.tasks.find((task) => task.date === today);
  if (!isOpenPractice(missed) || !isOpenPractice(todayTask)) return null;

  const last = candidate.lastReminderAt;
  if (last) {
    if (now.getTime() - last.getTime() < MIN_DAYS_BETWEEN * DAY_MS) return null;
    // One per gap: a reminder already went out and no practice day was completed since.
    const lastDone = candidate.tasks.reduce<number>(
      (latest, task) => (task.status === 'completed' && task.completedAt ? Math.max(latest, task.completedAt.getTime()) : latest),
      0,
    );
    if (lastDone <= last.getTime()) return null;
  }

  return {
    userId: candidate.userId,
    email: candidate.email,
    todayTitle: todayTask.title,
    todayMinutes: todayTask.durationMinutes,
    hasMinimum: todayTask.minimumVersion != null,
  };
}
