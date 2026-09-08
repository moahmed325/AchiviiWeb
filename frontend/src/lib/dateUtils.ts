/**
 * Client-side date and timezone utility functions.
 * Avoids naive .toISOString().split('T')[0] patterns that cause UTC date shifts.
 */

/**
 * Formats a Date, string, or timestamp into 'YYYY-MM-DD' representing the local calendar day
 * in the user's timezone.
 */
export function getLocalDateString(
  date: Date | string | number = new Date(),
  timezone?: string
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const tz =
    timezone ||
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC') ||
    'UTC';

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    // Fallback: local calendar date
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

/**
 * Returns today's 'YYYY-MM-DD' formatted date string in the given or browser timezone.
 */
export function getTodayDateString(timezone?: string): string {
  return getLocalDateString(new Date(), timezone);
}
