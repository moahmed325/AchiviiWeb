import { describe, expect, it, vi, beforeEach } from "vitest";
const { findFirst, getBillingConfig } = vi.hoisted(() => ({ findFirst: vi.fn(), getBillingConfig: vi.fn() }));
vi.mock("../prisma.js", () => ({ prisma: { subscription: { findFirst } } }));
vi.mock("../../config/billing.js", () => ({ getBillingConfig }));
import { getBillingAccountState } from "./accountState.js";

describe("getBillingAccountState", () => {
  beforeEach(() => { vi.restoreAllMocks(); getBillingConfig.mockReturnValue({ apiKey: "secret" }); });
  it("returns a minimal free state when no subscription exists", async () => {
    findFirst.mockResolvedValue(null);
    await expect(getBillingAccountState("u1")).resolves.toEqual({ plan:"free", status:"none", billingInterval:null, currentPeriodEnd:null, cancelAtPeriodEnd:false, manageUrl:null });
  });
  it("returns verified local state and a fresh provider portal URL", async () => {
    findFirst.mockResolvedValue({ providerSubscriptionId:"sub-1", status:"ACTIVE", billingInterval:"yearly", currentPeriodEnd:new Date("2027-01-01T00:00:00Z"), cancelAtPeriodEnd:false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data:{ attributes:{ urls:{ customer_portal:"https://store.test/billing?signature=fresh" } } } }), { status:200 })));
    await expect(getBillingAccountState("u1")).resolves.toEqual({ plan:"pro", status:"ACTIVE", billingInterval:"yearly", currentPeriodEnd:"2027-01-01T00:00:00.000Z", cancelAtPeriodEnd:false, manageUrl:"https://store.test/billing?signature=fresh" });
  });
  it("does not fail the account page when the provider URL cannot be refreshed", async () => {
    findFirst.mockResolvedValue({ providerSubscriptionId:"sub-1", status:"CANCELLED_ENDING", billingInterval:"monthly", currentPeriodEnd:new Date("2027-01-01T00:00:00Z"), cancelAtPeriodEnd:true });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("provider unavailable")));
    await expect(getBillingAccountState("u1")).resolves.toMatchObject({ plan:"pro", manageUrl:null, cancelAtPeriodEnd:true });
  });
});
