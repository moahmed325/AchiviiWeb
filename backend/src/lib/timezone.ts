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

/**
 * The date a goal starts, as a Date at 00:00 UTC on the user's local calendar day (ND-1).
 * Stored this way, every later step of date arithmetic can use UTC methods and never depend on the server's timezone.
 * - No `startDate`: today, in the user's timezone.
 * - A plain 'YYYY-MM-DD': that calendar day, as given.
 * - Any other value (an instant): the user's local calendar day for that instant.
 * - Unparseable: today, in the user's timezone.
 */
export function resolveGoalStart(timezone: string, startDate?: unknown, now: Date = new Date()): Date {
  if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    const day = new Date(`${startDate}T00:00:00.000Z`);
    if (!isNaN(day.getTime())) return day;
  }
  let instant = now;
  if (typeof startDate === 'string' || typeof startDate === 'number' || startDate instanceof Date) {
    const parsed = startDate instanceof Date ? startDate : new Date(startDate);
    if (!isNaN(parsed.getTime())) instant = parsed;
  }
  return new Date(`${getZonedDateString(instant, timezone)}T00:00:00.000Z`);
}

const zonedPartsFormatters = new Map<string, Intl.DateTimeFormat>();

/** The wall-clock reading of an instant in a timezone, written as if it were UTC (ms). */
function zonedWallAsUtcMs(instantMs: number, timezone: string): number {
  let formatter = zonedPartsFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    zonedPartsFormatters.set(timezone, formatter);
  }
  const v: Record<string, number> = {};
  for (const p of formatter.formatToParts(new Date(instantMs))) {
    if (p.type !== 'literal') v[p.type] = parseInt(p.value, 10);
  }
  return Date.UTC(v.year, v.month - 1, v.day, v.hour === 24 ? 0 : v.hour, v.minute, v.second);
}

/** UTC offset (ms, positive east of UTC) in force at an instant. */
function zonedOffsetMs(instantMs: number, timezone: string): number {
  return zonedWallAsUtcMs(instantMs, timezone) - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The exact instant at which the local clock in `timezone` reads `time` ('HH:MM') on `dateStr` ('YYYY-MM-DD').
 * Correct on DST-change days, unlike `getZonedDayBounds`, which takes the offset at local noon.
 * - A wall time skipped by a spring-forward change resolves to the first valid instant after it (the change itself).
 * - A wall time that happens twice in a fall-back change resolves to the later of the two.
 * Throws on a malformed date or time.
 */
export function zonedWallTimeToInstant(dateStr: string, time: string, timezone: string = 'UTC'): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid wall time passed to zonedWallTimeToInstant: ${dateStr} ${time}`);
  }
  const tz = normalizeTimezone(timezone);
  const wallMs = Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3], +timeMatch[1], +timeMatch[2]);
  if (isNaN(wallMs)) throw new Error(`Invalid wall time passed to zonedWallTimeToInstant: ${dateStr} ${time}`);

  // Offsets a day either side cover any single DST change near this wall time.
  const DAY = 86_400_000;
  const offsetBefore = zonedOffsetMs(wallMs - DAY, tz);
  const offsetAfter = zonedOffsetMs(wallMs + DAY, tz);
  const matches = [wallMs - offsetBefore, wallMs - offsetAfter].filter((t) => zonedWallAsUtcMs(t, tz) === wallMs);
  if (matches.length > 0) return new Date(Math.max(...matches));

  // Spring-forward gap: find the change, the first instant on the new offset, to the minute.
  let lo = Math.min(wallMs - offsetBefore, wallMs - offsetAfter);
  let hi = Math.max(wallMs - offsetBefore, wallMs - offsetAfter);
  while (hi - lo > 60_000) {
    const mid = lo + Math.floor((hi - lo) / 120_000) * 60_000;
    if (zonedOffsetMs(mid, tz) === offsetAfter) hi = mid;
    else lo = mid;
  }
  return new Date(hi);
}
