import { flagOn } from '../flags.js';

/**
 * Weekly update (docs/features/weekly-update, RULE-18, WU-25): the two switches. Each is on only when exactly 'true',
 * read per call, and never turned on or off from code or tests.
 * - `WEEK_CLOSE_ENABLED`: the server closes a week whose last day has closed (RULE-8, RULE-9).
 * - `WEEKLY_UPDATE_ENABLED`: everything that changes targets; it acts only with the week close on, decided here.
 */
export function weekCloseEnabled(): boolean {
  return flagOn('WEEK_CLOSE_ENABLED');
}

export function weeklyUpdateEnabled(): boolean {
  return weekCloseEnabled() && flagOn('WEEKLY_UPDATE_ENABLED');
}