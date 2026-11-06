/** ND-41: Achivii Coach's limits, in one place. */

/** Messages a person can send the coach in one of their days. */
export const COACH_DAILY_MESSAGES = 30;

/** The longest message the coach takes, in characters. */
export const COACH_MESSAGE_MAX = 1000;

/** Earlier messages sent with each new one, so the coach follows the conversation. */
export const COACH_HISTORY_MESSAGES = 12;

/** Messages the page loads (the most recent). */
export const COACH_PAGE_MESSAGES = 100;

/** The model call's time limit; past it the person is told to try again and nothing is saved. */
export const COACH_TIME_LIMIT_MS = 20_000;
