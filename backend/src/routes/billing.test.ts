import { describe, expect, it, vi, beforeEach } from "vitest";

const getAuthUser = vi.fn();
const createCheckout = vi.fn();

vi.mock("./auth.js", () => ({ getAuthUser }));
vi.mock("../lib/billing/lemonSqueezyCheckout.js", () => ({
  createLemonSqueezyCheckout: createCheckout,
}));

describe("billing checkout route", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    createCheckout.mockReset();
  });

  const response = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  });

  it("rejects unauthenticated requests", async () => {
    getAuthUser.mockResolvedValue(null);
    const { checkoutHandler } = await import("./billing.js");
    const res = response();

    await checkoutHandler({ body: {}, headers: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("uses the authenticated identity and selected interval", async () => {
    getAuthUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    createCheckout.mockResolvedValue({ checkoutId: "checkout-123", checkoutUrl: "https://checkout.example/123" });
    const { checkoutHandler } = await import("./billing.js");
    const res = response();

    await checkoutHandler({ body: { interval: "yearly" }, headers: {} } as any, res as any);

    expect(createCheckout).toHaveBeenCalledWith({
      userId: "user-123",
      email: "user@example.com",
      interval: "yearly",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ checkoutId: "checkout-123", checkoutUrl: "https://checkout.example/123" });
  });

  it("rejects an invalid interval before contacting the provider", async () => {
    getAuthUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    const { checkoutHandler } = await import("./billing.js");
    const res = response();

    await checkoutHandler({ body: { interval: "weekly" }, headers: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("does not expose provider errors or grant entitlement", async () => {
    getAuthUser.mockResolvedValue({ id: "user-123", email: "user@example.com" });
    createCheckout.mockRejectedValue(new Error("secret provider detail"));
    const { checkoutHandler } = await import("./billing.js");
    const res = response();

    await checkoutHandler({ body: { interval: "monthly" }, headers: {} } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to create checkout. Please try again." });
  });
});
