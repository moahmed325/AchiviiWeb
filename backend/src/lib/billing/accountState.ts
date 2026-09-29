import { getBillingConfig } from "../../config/billing.js";
import { prisma } from "../prisma.js";

export type BillingAccountState = Readonly<{
  plan: "free" | "pro";
  status: string;
  billingInterval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  manageUrl: string | null;
}>;

const API_URL = "https://api.lemonsqueezy.com/v1/subscriptions";

export const getBillingAccountState = async (userId: string): Promise<BillingAccountState> => {
  const subscription = await prisma.subscription.findFirst({
    where: { userId, plan: "pro" },
    orderBy: { updated_at: "desc" },
    select: {
      providerSubscriptionId: true,
      status: true,
      billingInterval: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!subscription) return {
    plan: "free", status: "none", billingInterval: null,
    currentPeriodEnd: null, cancelAtPeriodEnd: false, manageUrl: null,
  };

  let manageUrl: string | null = null;
  try {
    const config = getBillingConfig();
    const response = await fetch(`${API_URL}/${encodeURIComponent(subscription.providerSubscriptionId)}`, {
      headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${config.apiKey}` },
    });
    const payload: unknown = await response.json().catch(() => null);
    const url = extractCustomerPortalUrl(payload);
    if (response.ok && url) manageUrl = url;
  } catch (error) {
    console.error("Billing management URL error:", error);
  }

  return {
    plan: "pro",
    status: subscription.status,
    billingInterval: subscription.billingInterval,
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    manageUrl,
  };
};

const extractCustomerPortalUrl = (payload: unknown): string | null => {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.attributes)) return null;
  const urls = payload.data.attributes.urls;
  if (!isRecord(urls) || typeof urls.customer_portal !== "string") return null;
  return urls.customer_portal;
};

const isRecord = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null;
