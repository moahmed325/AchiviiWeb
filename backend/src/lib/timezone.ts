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

export type DayOfWeekKey = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/**
 * Breaks down a given date or the current moment into timezone-aware parts:
 * - dateStr: 'YYYY-MM-DD'
 * - hours: 0-23
 * - minutes: 0-59
 * - minutesFromMidnight: hours * 60 + minutes
 * - dayKey: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
 */
export function getZonedTimeParts(date: Date = new Date(), timezone: string = 'UTC'): {
  dateStr: string;
  hours: number;
  minutes: number;
  minutesFromMidnight: number;
  dayKey: DayOfWeekKey;
} {
  const tz = normalizeTimezone(timezone);
  const dateStr = getZonedDateString(date, tz);

  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts = timeFormatter.formatToParts(date);
  let hours = 0;
  let minutes = 0;
  for (const p of parts) {
    if (p.type === 'hour') hours = parseInt(p.value, 10);
    if (p.type === 'minute') minutes = parseInt(p.value, 10);
  }
  if (hours === 24) hours = 0;

  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  });
  const rawDay = dayFormatter.format(date).toUpperCase();
  const validDays: DayOfWeekKey[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const dayKey = validDays.includes(rawDay as DayOfWeekKey) ? (rawDay as DayOfWeekKey) : 'MON';

  return {
    dateStr,
    hours,
    minutes,
    minutesFromMidnight: hours * 60 + minutes,
    dayKey,
  };
}

/**
 * Returns UTC Date objects for the start (00:00:00.000) and end (23:59:59.999)
 * of a given calendar day ('YYYY-MM-DD' or Date) in the specified timezone.
 */
export function getZonedDayBounds(
  dateOrString: Date | string,
  timezone: string = 'UTC'
): { startOfDay: Date; endOfDay: Date } {
  const tz = normalizeTimezone(timezone);
  const dateStr =
    typeof dateOrString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOrString)
      ? dateOrString
      : getZonedDateString(dateOrString, tz);

  const [y, m, d] = dateStr.split('-').map(Number);
  const approxUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(approxUtc);

  const localValues: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      localValues[p.type] = parseInt(p.value, 10);
    }
  }
  const localAsUtc = Date.UTC(
    localValues.year,
    localValues.month - 1,
    localValues.day,
    localValues.hour === 24 ? 0 : localValues.hour,
    localValues.minute,
    localValues.second
  );
  const offsetMs = approxUtc.getTime() - localAsUtc;

  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) + offsetMs;
  const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) + offsetMs;

  return {
    startOfDay: new Date(startUtcMs),
    endOfDay: new Date(endUtcMs),
  };
}
