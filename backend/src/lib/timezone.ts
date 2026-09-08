/**
 * Timezone utilities for Achivii.
 * Handles IANA timezone validation and timezone-aware date/day-boundary calculations
 * avoiding naive UTC string splitting (e.g. toISOString().split('T')[0]).
 */

/**
 * Validates whether a given string is a valid IANA timezone name.
 */
export function isValidTimezone(tz: unknown): tz is string {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalizes an unknown timezone input, falling back to 'UTC' if invalid or missing.
 */
export function normalizeTimezone(tz?: unknown): string {
  if (typeof tz === 'string' && isValidTimezone(tz)) {
    return tz;
  }
  return 'UTC';
}

/**
 * Formats a Date or timestamp into 'YYYY-MM-DD' representing the local calendar day
 * in the specified IANA timezone.
 */
export function getZonedDateString(date: Date | string | number = new Date(), timezone: string = 'UTC'): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date passed to getZonedDateString: ${date}`);
  }
  const tz = normalizeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

/**
 * Returns today's 'YYYY-MM-DD' string in the user's timezone.
 */
export function getUserTodayDateString(timezone: string = 'UTC'): string {
  return getZonedDateString(new Date(), timezone);
}
