import { hasProEntitlement } from "../billing/entitlement.js";
import { prisma } from "../prisma.js";

export const CUSTOM_GOAL_REQUIRES_PRO = "CUSTOM_GOAL_REQUIRES_PRO" as const;

export type CustomGoalAuthorization =
  | { allowed: true }
  | { allowed: false; code: typeof CUSTOM_GOAL_REQUIRES_PRO; message: string };

/**
 * ND-28: everyone starts by typing their own goal, so a person's first plan is allowed whatever it is. After that,
 * a new custom goal needs Pro. (Stage 2 replaces this with the 30-day trial.)
 */
export const authorizeNewCustomGoal = async (userId: string): Promise<CustomGoalAuthorization> => {
  const entitled = await hasProEntitlement(userId);
  if (entitled) return { allowed: true };
  if ((await prisma.goal.count({ where: { userId } })) === 0) return { allowed: true };

  return {
    allowed: false,
    code: CUSTOM_GOAL_REQUIRES_PRO,
    message: "Custom Goals require Achivii Pro.",
  };
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
