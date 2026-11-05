import type { AccessState } from './api';

/** ND-37: the free trial's length; the server counts it (`backend/src/lib/billing/access.ts`). */
export const TRIAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left in the trial, counting today: 1 on its last day, 0 once it is over. */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: Date = new Date()): number {
  if (!trialEndsAt) return TRIAL_DAYS;
  const ms = Date.parse(trialEndsAt) - now.getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / DAY_MS) : 0;
}

/** The trial notice shows in its last week only; before that the trial stays out of the way. */
export const TRIAL_NOTICE_DAYS = 7;

export const isLocked = (state: AccessState | undefined) => state === 'locked';
