import { describe, expect, it } from "vitest";
import {
  evaluateProEntitlement,
  PRO_ENTITLED,
  PRO_NOT_ENTITLED,
} from "./entitlement.js";

const NOW = new Date("2026-09-29T12:00:00.000Z");
const future = new Date("2026-10-29T12:00:00.000Z");
const past = new Date("2026-09-28T12:00:00.000Z");

const subscription = (overrides: Partial<Parameters<typeof evaluateProEntitlement>[0]> = {}) => ({
  plan: "pro",
  status: "ACTIVE",
  currentPeriodEnd: future,
  cancelAtPeriodEnd: false,
  ...overrides,
});

describe("evaluateProEntitlement", () => {
  it("entitles an active Pro subscription", () => {
    expect(evaluateProEntitlement(subscription(), NOW)).toBe(PRO_ENTITLED);
  });

  it("keeps a cancelled subscription entitled until its period ends", () => {
    expect(evaluateProEntitlement(subscription({
      status: "CANCELLED_ENDING",
      cancelAtPeriodEnd: true,
    }), NOW)).toBe(PRO_ENTITLED);
  });

  it("revokes entitlement at the provider period end", () => {
    expect(evaluateProEntitlement(subscription({ currentPeriodEnd: past }), NOW)).toBe(PRO_NOT_ENTITLED);
  });

  it("preserves entitlement during payment recovery", () => {
    expect(evaluateProEntitlement(subscription({ status: "PAST_DUE_RECOVERY" }), NOW)).toBe(PRO_ENTITLED);
  });

  it("does not immediately revoke an unpaid but still-valid subscription", () => {
    expect(evaluateProEntitlement(subscription({ status: "UNPAID" }), NOW)).toBe(PRO_ENTITLED);
  });

  it("preserves entitlement for a provider-valid paused subscription", () => {
    expect(evaluateProEntitlement(subscription({ status: "PAUSED" }), NOW)).toBe(PRO_ENTITLED);
  });

  it("fails closed for expired, unknown, and missing subscriptions", () => {
    expect(evaluateProEntitlement(subscription({ status: "EXPIRED" }), NOW)).toBe(PRO_NOT_ENTITLED);
    expect(evaluateProEntitlement(subscription({ status: "UNKNOWN" }), NOW)).toBe(PRO_NOT_ENTITLED);
    expect(evaluateProEntitlement(null, NOW)).toBe(PRO_NOT_ENTITLED);
  });

  it("does not grant Pro for another plan", () => {
    expect(evaluateProEntitlement(subscription({ plan: "free" }), NOW)).toBe(PRO_NOT_ENTITLED);
  });
});
