import { prisma } from "../prisma.js";
import { hasProEntitlement } from "./entitlement.js";

/** ND-37: every plan starts with 30 days free, no card; after that the plan needs Achivii Pro. */
export const TRIAL_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What a person can do right now:
 * - `pro`: an active Pro subscription.
 * - `new`: no plan yet, so no trial yet; their first plan starts it.
 * - `trial`: inside the 30 days.
 * - `locked`: the 30 days are over without Pro. The plan and its history stay readable; nothing moves it on.
 */
export type AccessState = "pro" | "new" | "trial" | "locked";

export interface Access {
  state: AccessState;
  /** When the trial started and ends; null before the first plan. Kept for a Pro person too. */
  trial: { startedAt: Date; endsAt: Date } | null;
}

export const trialEndsAt = (startedAt: Date) => new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS);

/** The state from what is stored, without reading the database (for tests and callers that already have both). */
export function accessFrom(pro: boolean, trialStartedAt: Date | null, now = new Date()): Access {
  const trial = trialStartedAt ? { startedAt: trialStartedAt, endsAt: trialEndsAt(trialStartedAt) } : null;
  if (pro) return { state: "pro", trial };
  if (!trial) return { state: "new", trial };
  return { state: now < trial.endsAt ? "trial" : "locked", trial };
}

export async function accessFor(user: { id: string; trialStartedAt?: Date | null }, now = new Date()): Promise<Access> {
  const pro = await hasProEntitlement(user.id, now);
  // The user row from sign-in may predate the column; read it when it isn't there.
  const trialStartedAt =
    user.trialStartedAt !== undefined
      ? user.trialStartedAt
      : ((await prisma.user.findUnique({ where: { id: user.id }, select: { trialStartedAt: true } }))?.trialStartedAt ?? null);
  return accessFrom(pro, trialStartedAt, now);
}

/** The refusal for anything that moves a plan on once the trial is over (402: payment is what unlocks it). */
export const TRIAL_ENDED = "TRIAL_ENDED" as const;
export const TRIAL_ENDED_MESSAGE = "Your 30 free days are over. Go Pro to keep going; your plan and progress are kept.";
