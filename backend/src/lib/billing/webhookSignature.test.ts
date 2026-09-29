import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLemonSqueezySignature } from "./webhookSignature.js";

describe("Lemon Squeezy webhook signatures", () => {
  it("accepts the exact HMAC SHA-256 signature", () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "webhook-secret";
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyLemonSqueezySignature(body, signature, secret)).toBe(true);
  });

  it("rejects invalid, missing, and modified signatures", () => {
    const body = JSON.stringify({ hello: "world" });
    const secret = "webhook-secret";
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyLemonSqueezySignature(body + "x", signature, secret)).toBe(false);
    expect(verifyLemonSqueezySignature(body, "bad", secret)).toBe(false);
    expect(verifyLemonSqueezySignature(body, undefined, secret)).toBe(false);
  });
});
