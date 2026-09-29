import { prisma } from "../prisma.js";

export const PRO_ENTITLED = "PRO_ENTITLED" as const;
export const PRO_NOT_ENTITLED = "PRO_NOT_ENTITLED" as const;

export type Entitlement = typeof PRO_ENTITLED | typeof PRO_NOT_ENTITLED;

export type SubscriptionForEntitlement = Readonly<{
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}>;

const ENTITLED_STATUSES = new Set([
  "ACTIVE",
  "CANCELLED_ENDING",
  "PAST_DUE_RECOVERY",
  "UNPAID",
  "PAUSED",
]);

/**
 * Evaluates one verified persisted subscription without exposing provider
 * terminology to callers. Raw Lemon Squeezy statuses must be translated
 * before reaching this boundary.
 */
export const evaluateProEntitlement = (
  subscription: SubscriptionForEntitlement | null | undefined,
  now = new Date(),
): Entitlement => {
  if (!subscription || subscription.plan.toLowerCase() !== "pro") {
    return PRO_NOT_ENTITLED;
  }

  if (!ENTITLED_STATUSES.has(subscription.status)) {
    return PRO_NOT_ENTITLED;
  }

  // Once a provider-backed period has an end, entitlement ends at that exact
  // boundary. A cancellation flag alone does not revoke access early.
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) {
    return PRO_NOT_ENTITLED;
  }

  return PRO_ENTITLED;
};

/**
 * Product-level authorization entry point. Product code should call this
 * service rather than inspect subscription/provider state directly.
 */
export const hasProEntitlement = async (
  userId: string,
  now = new Date(),
): Promise<boolean> => {
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId,
      plan: "pro",
    },
    orderBy: { updated_at: "desc" },
    select: {
      plan: true,
      status: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  return subscriptions.some((subscription) =>
    evaluateProEntitlement(subscription, now) === PRO_ENTITLED,
  );
};
