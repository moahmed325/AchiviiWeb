import { getBillingConfig } from "../../config/billing.js";

const LEMON_SQUEEZY_API_URL = "https://api.lemonsqueezy.com/v1/checkouts";

export type CheckoutInterval = "monthly" | "yearly";

export type CheckoutResult = Readonly<{
  checkoutId: string;
  checkoutUrl: string;
}>;

const variantForInterval = (interval: CheckoutInterval, config: ReturnType<typeof getBillingConfig>): string =>
  interval === "yearly" ? config.proYearlyVariantId : config.proMonthlyVariantId;

export const createLemonSqueezyCheckout = async (
  input: Readonly<{ userId: string; email: string; interval: CheckoutInterval }>,
): Promise<CheckoutResult> => {
  const config = getBillingConfig();
  const variantId = variantForInterval(input.interval, config);

  const response = await fetch(LEMON_SQUEEZY_API_URL, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: input.email,
            custom: {
              user_id: input.userId,
            },
          },
          product_options: {
            enabled_variants: [Number(variantId)],
          },
          test_mode: config.environment === "test",
        },
        relationships: {
          store: {
            data: { type: "stores", id: config.storeId },
          },
          variant: {
            data: { type: "variants", id: variantId },
          },
        },
      },
    }),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = extractProviderError(payload);
    throw new Error(`Lemon Squeezy checkout creation failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  const checkout = extractCheckout(payload);
  if (!checkout) {
    throw new Error("Lemon Squeezy returned an invalid checkout response.");
  }

  return checkout;
};

const extractCheckout = (payload: unknown): CheckoutResult | null => {
  if (!isRecord(payload) || !isRecord(payload.data) || typeof payload.data.id !== "string") return null;
  const attributes = payload.data.attributes;
  if (!isRecord(attributes) || typeof attributes.url !== "string") return null;
  return { checkoutId: payload.data.id, checkoutUrl: attributes.url };
};

const extractProviderError = (payload: unknown): string | null => {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) return null;
  const messages = payload.errors
    .filter(isRecord)
    .map((error) => (typeof error.detail === "string" ? error.detail : null))
    .filter((message): message is string => Boolean(message));
  return messages.join("; ") || null;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;
