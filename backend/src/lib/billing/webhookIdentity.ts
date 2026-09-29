import { createHash } from "node:crypto";

/**
 * Lemon Squeezy does not expose a separate globally unique webhook delivery
 * id in its documented request shape. The raw signed body is therefore
 * fingerprinted so the same delivery can be claimed exactly once.
 */
export const getWebhookDeliveryKey = (rawBody: string): string =>
  createHash("sha256").update(rawBody, "utf8").digest("hex");
