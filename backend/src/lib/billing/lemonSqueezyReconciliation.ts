import { getBillingConfig } from "../../config/billing.js";
import { prisma } from "../prisma.js";
import { mapLemonSqueezyStatus, periodEndForState } from "./lemonSqueezyState.js";

const API_URL = "https://api.lemonsqueezy.com/v1/subscriptions";

export type ReconciliationResult = Readonly<{ reconciled: boolean; status: string | null; reason?: string }>;

export const reconcileUserSubscription = async (userId: string): Promise<ReconciliationResult> => {
  const local = await prisma.subscription.findFirst({ where: { userId, plan: "pro" }, orderBy: { updated_at: "desc" } });
  if (!local) return { reconciled: false, status: null, reason: "no_subscription" };

  const config = getBillingConfig();
  const response = await fetch(`${API_URL}/${encodeURIComponent(local.providerSubscriptionId)}`, {
    headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${config.apiKey}` },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) return { reconciled: false, status: local.status, reason: "provider_unavailable" };

  const attributes = extractAttributes(payload);
  if (!attributes) return { reconciled: false, status: local.status, reason: "invalid_provider_state" };
  const status = mapLemonSqueezyStatus(attributes.status, attributes.ends_at, attributes.renews_at);
  const periodEnd = periodEndForState(status, attributes.renews_at, attributes.ends_at);
  if (periodEnd && Number.isNaN(periodEnd.getTime())) return { reconciled: false, status: local.status, reason: "invalid_period_end" };

  await prisma.subscription.update({
    where: { id: local.id },
    data: {
      providerCustomerId: String(attributes.customer_id), providerProductId: String(attributes.product_id), providerVariantId: String(attributes.variant_id),
      billingInterval: attributes.variant_name.toLowerCase().includes("year") ? "yearly" : "monthly",
      status, currentPeriodStart: local.currentPeriodStart, currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: Boolean(attributes.cancelled || attributes.ends_at), cancelledAt: attributes.cancelled ? new Date(attributes.updated_at) : null,
      pausedAt: status === "PAUSED" ? new Date(attributes.updated_at) : null,
    },
  });
  return { reconciled: true, status };
};

const extractAttributes = (payload: unknown): Record<string, any> | null => {
  if (!isRecord(payload) || !isRecord(payload.data) || !isRecord(payload.data.attributes)) return null;
  const a = payload.data.attributes;
  if (typeof a.status !== "string" || typeof a.variant_name !== "string" || typeof a.updated_at !== "string") return null;
  return a;
};
const isRecord = (value: unknown): value is Record<string, any> => typeof value === "object" && value !== null;
