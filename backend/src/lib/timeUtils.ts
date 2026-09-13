/**
 * Time Utilities
 * Canonical time conversion and interval subtraction logic for scheduling engines.
 */

export interface TimeInterval {
  start: number; // minutes from midnight
  end: number;   // minutes from midnight
}

export const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type DayKey = typeof DAY_KEYS[number];

/**
 * Converts "HH:MM" 24h string to minutes from midnight (0 - 1439).
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Converts minutes from midnight to "HH:MM" 24h string.
 */
export function minutesToTime(minutes: number): string {
  const bounded = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Subtracts busy intervals from open available windows.
 * Discards slivers under 15 minutes.
 */
export function subtractIntervals(openings: TimeInterval[], busy: TimeInterval): TimeInterval[] {
  const result: TimeInterval[] = [];

  for (const op of openings) {
    // Case 1: No overlap
    if (busy.end <= op.start || busy.start >= op.end) {
      result.push(op);
      continue;
    }

    // Case 2: Busy overlaps left side
    if (busy.start <= op.start && busy.end < op.end) {
      result.push({ start: busy.end, end: op.end });
      continue;
    }

    // Case 3: Busy overlaps right side
    if (busy.start > op.start && busy.end >= op.end) {
      result.push({ start: op.start, end: busy.start });
      continue;
    }

    // Case 4: Busy splits opening in middle
    if (busy.start > op.start && busy.end < op.end) {
      result.push({ start: op.start, end: busy.start });
      result.push({ start: busy.end, end: op.end });
      continue;
    }
  }

  return result.filter((i) => i.end - i.start >= 15);
}

import { SessionTier } from '@prisma/client';

/**
 * Returns preferred hour window bounds based on preference.
 */
export function getPreferredWindow(pref?: string | null): TimeInterval {
  switch (pref?.toLowerCase()) {
    case 'morning':
      return { start: 7 * 60, end: 12 * 60 };
    case 'afternoon':
      return { start: 12 * 60, end: 17 * 60 };
    case 'evening':
      return { start: 17 * 60, end: 22 * 60 };
    default:
      return { start: 8 * 60, end: 20 * 60 };
  }
}

/**
 * Determine session tier based on standard distribution:
 * Target split: ~40-50% core / ~30% buffer / ~20% reflect.
 */
export function determineSessionTier(
  sessionIndex: number,
  totalSessions: number
): SessionTier {
  if (totalSessions <= 1) {
    return SessionTier.core;
  }
  if (totalSessions === 2) {
    return sessionIndex === 0 ? SessionTier.core : SessionTier.buffer;
  }
  if (totalSessions === 3) {
    if (sessionIndex === 0) return SessionTier.core;
    if (sessionIndex === 1) return SessionTier.buffer;
    return SessionTier.reflect;
  }
  if (totalSessions === 4) {
    if (sessionIndex < 2) return SessionTier.core;
    if (sessionIndex === 2) return SessionTier.buffer;
    return SessionTier.reflect;
  }
  const coreCount = Math.max(1, Math.round(totalSessions * 0.45));
  const reflectCount = Math.max(1, Math.round(totalSessions * 0.20));
  if (sessionIndex < coreCount) {
    return SessionTier.core;
  }
  if (sessionIndex >= totalSessions - reflectCount) {
    return SessionTier.reflect;
  }
  return SessionTier.buffer;
}

