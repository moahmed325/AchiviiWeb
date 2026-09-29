export type BillingEnvironment = "test" | "production";

export type BillingConfig = Readonly<{
  environment: BillingEnvironment;
  storeId: string;
  apiKey: string;
  webhookSigningSecret: string;
  proMonthlyVariantId: string;
  proYearlyVariantId: string;
}>;

const optionalEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const requiredBillingEnv = (name: string): string => {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required billing environment variable: ${name}`);
  }
  return value;
};

const getEnvironment = (): BillingEnvironment => {
  const value = optionalEnv("LEMON_SQUEEZY_ENVIRONMENT") ?? "test";
  if (value !== "test" && value !== "production") {
    throw new Error('LEMON_SQUEEZY_ENVIRONMENT must be either "test" or "production"');
  }
  return value;
};

export const getBillingConfig = (): BillingConfig => {
  const environment = getEnvironment();
  const prefix = environment === "production" ? "LEMON_SQUEEZY_LIVE" : "LEMON_SQUEEZY_TEST";

  return Object.freeze({
    environment,
    storeId: requiredBillingEnv(`${prefix}_STORE_ID`),
    apiKey: requiredBillingEnv(`${prefix}_API_KEY`),
    webhookSigningSecret: requiredBillingEnv(`${prefix}_WEBHOOK_SIGNING_SECRET`),
    proMonthlyVariantId: requiredBillingEnv(`${prefix}_PRO_MONTHLY_VARIANT_ID`),
    proYearlyVariantId: requiredBillingEnv(`${prefix}_PRO_YEARLY_VARIANT_ID`),
  });
};

export const billingConfigIsConfigured = (): boolean => {
  const environment = getEnvironment();
  const prefix = environment === "production" ? "LEMON_SQUEEZY_LIVE" : "LEMON_SQUEEZY_TEST";
  return [
    `${prefix}_STORE_ID`,
    `${prefix}_API_KEY`,
    `${prefix}_WEBHOOK_SIGNING_SECRET`,
    `${prefix}_PRO_MONTHLY_VARIANT_ID`,
    `${prefix}_PRO_YEARLY_VARIANT_ID`,
  ].every((name) => Boolean(optionalEnv(name)));
};
