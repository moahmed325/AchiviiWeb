import { flagOn } from '../flags.js';

/**
 * Weekly update (docs/features/weekly-update, RULE-18, WU-25): the week close switch. On only when exactly 'true', read
 * per call, and never turned on or off from code or tests. `WEEK_CLOSE_ENABLED`: the server closes a week whose last
 * day has closed (RULE-8, RULE-9). `WEEKLY_UPDATE_ENABLED` went with the weekly tests (2026-10-30): nothing reads it.
 */
export function weekCloseEnabled(): boolean {
  return flagOn('WEEK_CLOSE_ENABLED');
}
