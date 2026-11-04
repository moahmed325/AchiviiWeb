import { hasProEntitlement } from "../billing/entitlement.js";
import { accessFor, TRIAL_ENDED, TRIAL_ENDED_MESSAGE } from "./access.js";

export type NewPlanAuthorization =
  | { allowed: true }
  | { allowed: false; code: typeof TRIAL_ENDED; message: string };

/**
 * ND-37: a new plan, pathway or custom, is allowed with Pro, before the first plan (which starts the 30-day trial) and
 * during the trial. Once the trial is over it needs Pro.
 */
export const authorizeNewPlan = async (user: { id: string; trialStartedAt?: Date | null }): Promise<NewPlanAuthorization> => {
  const access = await accessFor(user);
  if (access.state !== "locked") return { allowed: true };
  return { allowed: false, code: TRIAL_ENDED, message: TRIAL_ENDED_MESSAGE };
};

export const NEXT_PLAN_REQUIRES_PRO = "NEXT_PLAN_REQUIRES_PRO" as const;

export type NextPlanAuthorization =
  | { allowed: true }
  | { allowed: false; code: typeof NEXT_PLAN_REQUIRES_PRO; message: string };

/**
 * Next plan (I-11, NP-7): a plan that starts from the person's real level is Pro, for pathway and custom goals alike,
 * whether they reached the goal or not.
 */
export const authorizeNextPlan = async (userId: string): Promise<NextPlanAuthorization> => {
  const entitled = await hasProEntitlement(userId);
  if (entitled) return { allowed: true };

  return {
    allowed: false,
    code: NEXT_PLAN_REQUIRES_PRO,
    message: "A plan that starts from your level now is part of Achivii Pro.",
  };
};
