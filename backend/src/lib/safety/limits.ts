/**
 * Plan safety limits (docs/features/plan-safety-limits, RULE-1, PSL-4): every limit number in one place. The week call
 * and its checks read them from here; no other code holds a limit number. Units are in the names. No weekly tests
 * (2026-10-30): the weekly target steps and the checkpoint numbers went with the targets; these limits check sessions.
 */

/** Calorie deficit in a step: 250 to 600 kcal a day (PSL-1, PSL-6). */
export const CALORIE_DEFICIT_MIN = 250;
export const CALORIE_DEFICIT_MAX = 600;

/** Daily intake written in a step: never below 1,200 kcal. */
export const DAILY_INTAKE_MIN_KCAL = 1200;

/** Running total against the base week: +10%, or +10 minutes / +1 km when that is more. */
export const RUNNING_TOTAL_STEP_PERCENT = 10;
export const RUNNING_TOTAL_STEP_MIN_MINUTES = 10;
export const RUNNING_TOTAL_STEP_MIN_KM = 1;

/** Longest run: at most 50% of the week's running total. */
export const LONGEST_RUN_MAX_PERCENT = 50;
/**
 * PSL-15 (7): the 50% rule holds only in a week with at least 3 runs. A week with no base week (week 1, or a base that
 * isn't known) and fewer runs has no running-total check, so its longest run is held to a fixed cap: 30 minutes, or 5 km
 * when the week is counted in km (run10k's week 1 "first 30-minute continuous run" and its beginner level, 3 to 5 km).
 */
export const LONGEST_RUN_MIN_RUNS = 3;
export const LONGEST_RUN_NO_BASE_MAX_MINUTES = 30;
export const LONGEST_RUN_NO_BASE_MAX_KM = 5;

/** Hard runs (intervals, tempo, race pace): at most 2 a week. */
export const HARD_RUNS_MAX = 2;

/** Weeks 1 to 3 lifting (PSL-2): at most 80% of 1RM, at least 3 reps in reserve, nothing to failure, no max test. */
export const EARLY_WEEKS = 3;
export const EARLY_WEEK_MAX_1RM_PERCENT = 80;
export const EARLY_WEEK_MIN_RIR = 3;

/** Base week: last week's planned total, or what was done when under 70% of it was done. */
export const BASE_WEEK_DONE_PERCENT = 70;

/**
 * PSL-18 (RULE-7): the first week back after a break runs at most the last done week's running total, with no
 * allowance, and never less than 30 minutes, or 5 km when the week is compared in km (PSL-15 (7)'s numbers).
 */
export const FIRST_WEEK_BACK_MIN_MINUTES = 30;
export const FIRST_WEEK_BACK_MIN_KM = 5;
/**
 * PSL-18 (6): after a break of 21 days or more, at most this share of that total, never below the floor. A stopgap:
 * weekly-update M3.4's restart level replaces it.
 */
export const FIRST_WEEK_BACK_LONG_BREAK_PERCENT = 50;
