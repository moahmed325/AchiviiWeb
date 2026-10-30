/**
 * B-99 (4): the feature switches in one place. Each is on only when its variable is exactly 'true' (unset means off),
 * read per call so a kill switch takes effect without a restart. They are managed in the Render dashboard only and
 * never turned on or off from code or tests. The modules that own a switch keep their named reader and call `flagOn`.
 */
export const FEATURE_FLAGS = [
  'MISSED_SESSIONS_CARRY_ENABLED',
  'METHOD_RECOVERY_ENABLED',
  'WEEK_CLOSE_ENABLED',
  'CUSTOM_RECOVERY_PROFILES_ENABLED',
  // ND-28: the missed-day reminder email. Off until Resend is set up; turning it off is the kill switch.
  'MISSED_DAY_REMINDERS_ENABLED',
] as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export function flagOn(flag: FeatureFlag): boolean {
  return process.env[flag] === 'true';
}

/** One line for the startup log: each switch and whether it is on, e.g. `WEEK_CLOSE_ENABLED=on`. */
export function flagSummary(): string {
  return FEATURE_FLAGS.map((flag) => `${flag}=${flagOn(flag) ? 'on' : 'off'}`).join(' ');
}
