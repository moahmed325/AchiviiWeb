import { hasProEntitlement } from "../billing/entitlement.js";

export const CUSTOM_GOAL_REQUIRES_PRO = "CUSTOM_GOAL_REQUIRES_PRO" as const;

export type CustomGoalAuthorization =
  | { allowed: true }
  | { allowed: false; code: typeof CUSTOM_GOAL_REQUIRES_PRO; message: string };

export const authorizeNewCustomGoal = async (userId: string): Promise<CustomGoalAuthorization> => {
  const entitled = await hasProEntitlement(userId);
  if (entitled) return { allowed: true };

  return {
    allowed: false,
    code: CUSTOM_GOAL_REQUIRES_PRO,
    message: "Custom Goals require Achivii Pro.",
  };
};
