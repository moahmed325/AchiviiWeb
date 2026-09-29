import crypto from "node:crypto";
import { getBillingConfig } from "../../config/billing.js";

export const verifyLemonSqueezySignature = (rawBody: string, signature: string | undefined, secret = getBillingConfig().webhookSigningSecret): boolean => {
  if (!rawBody || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
};
