import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.LEMON_SQUEEZY_ENVIRONMENT = "test";
  process.env.LEMON_SQUEEZY_TEST_STORE_ID = "123";
  process.env.LEMON_SQUEEZY_TEST_API_KEY = "server-secret";
  process.env.LEMON_SQUEEZY_TEST_WEBHOOK_SIGNING_SECRET = "webhook-secret";
  process.env.LEMON_SQUEEZY_TEST_PRO_MONTHLY_VARIANT_ID = "456";
  process.env.LEMON_SQUEEZY_TEST_PRO_YEARLY_VARIANT_ID = "789";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Lemon Squeezy checkout client", () => {
  it("creates a yearly checkout using server-side configuration and local identity", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        type: "checkouts",
        id: "checkout-abc",
        attributes: { url: "https://store.lemonsqueezy.com/checkout/custom/checkout-abc" },
      },
    }), { status: 201, headers: { "content-type": "application/vnd.api+json" } }));

    const { createLemonSqueezyCheckout } = await import("./lemonSqueezyCheckout.js");
    const result = await createLemonSqueezyCheckout({
      userId: "user-123",
      email: "user@example.com",
      interval: "yearly",
    });

    expect(result).toEqual({
      checkoutId: "checkout-abc",
      checkoutUrl: "https://store.lemonsqueezy.com/checkout/custom/checkout-abc",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.lemonsqueezy.com/v1/checkouts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer server-secret" }),
      }),
    );

    const [, request] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.data.relationships.store.data.id).toBe("123");
    expect(body.data.relationships.variant.data.id).toBe("789");
    expect(body.data.attributes.checkout_data.custom).toEqual({ user_id: "user-123" });
    expect(body.data.attributes.checkout_data.email).toBe("user@example.com");
    expect(body.data.attributes.test_mode).toBe(true);
  });

  it("fails without exposing provider secrets when the provider rejects the request", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errors: [{ detail: "invalid api key" }],
    }), { status: 401 }));

    const { createLemonSqueezyCheckout } = await import("./lemonSqueezyCheckout.js");
    await expect(createLemonSqueezyCheckout({
      userId: "user-123",
      email: "user@example.com",
      interval: "monthly",
    })).rejects.toThrow("Lemon Squeezy checkout creation failed (401): invalid api key");
  });
});
