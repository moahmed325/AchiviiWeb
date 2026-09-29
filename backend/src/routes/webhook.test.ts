import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recordWebhookDelivery = vi.fn();
const userFindUnique = vi.fn();
const subscriptionUpsert = vi.fn();
const webhookEventUpdate = vi.fn();
const transaction = vi.fn(async (callback: (tx: any) => Promise<void>) => callback({
  subscription: { upsert: subscriptionUpsert },
  webhookEvent: { update: webhookEventUpdate },
}));

vi.mock("../lib/billing/webhookEvents.js", () => ({ recordWebhookDelivery }));
vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    $transaction: transaction,
    webhookEvent: { update: webhookEventUpdate },
  },
}));

const secret = "webhook-secret";
process.env.LEMON_SQUEEZY_ENVIRONMENT = "test";
process.env.LEMON_SQUEEZY_TEST_STORE_ID = "123";
process.env.LEMON_SQUEEZY_TEST_API_KEY = "api-key";
process.env.LEMON_SQUEEZY_TEST_WEBHOOK_SIGNING_SECRET = secret;
process.env.LEMON_SQUEEZY_TEST_PRO_MONTHLY_VARIANT_ID = "456";
process.env.LEMON_SQUEEZY_TEST_PRO_YEARLY_VARIANT_ID = "789";

const sign = (body: string) => crypto.createHmac("sha256", secret).update(body).digest("hex");
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

const subscriptionPayload = () => ({
  meta: { event_name: "subscription_created", custom_data: { user_id: "user-123" } },
  data: {
    type: "subscriptions",
    id: "sub-123",
    attributes: {
      customer_id: 22,
      product_id: 33,
      variant_id: 44,
      variant_name: "Pro Monthly",
      status: "active",
      cancelled: false,
      renews_at: "2099-10-01T00:00:00Z",
      ends_at: null,
      created_at: "2026-09-29T00:00:00Z",
      updated_at: "2026-09-29T00:00:00Z",
    },
  },
});

describe("Lemon Squeezy webhook handler", () => {
  beforeEach(() => {
    recordWebhookDelivery.mockReset();
    userFindUnique.mockReset();
    subscriptionUpsert.mockReset();
    webhookEventUpdate.mockReset();
    transaction.mockClear();
  });

  it("rejects an invalid signature before persistence", async () => {
    const { lemonSqueezyWebhookHandler } = await import("./webhook.js");
    const body = JSON.stringify(subscriptionPayload());
    const res = response();

    await lemonSqueezyWebhookHandler({ body: Buffer.from(body), headers: { "x-signature": "bad" }, header: () => "bad" } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(recordWebhookDelivery).not.toHaveBeenCalled();
  });

  it("ignores unsupported event types after signature verification", async () => {
    const { lemonSqueezyWebhookHandler } = await import("./webhook.js");
    const payload = { ...subscriptionPayload(), meta: { event_name: "order_created" } };
    const body = JSON.stringify(payload);
    const res = response();

    await lemonSqueezyWebhookHandler({ body: Buffer.from(body), headers: {}, header: () => sign(body) } as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true, ignored: true });
    expect(recordWebhookDelivery).not.toHaveBeenCalled();
  });

  it("persists a verified subscription state using the checkout user association", async () => {
    recordWebhookDelivery.mockResolvedValue({ created: true, eventId: "event-123" });
    userFindUnique.mockResolvedValue({ id: "user-123" });
    subscriptionUpsert.mockResolvedValue({});
    webhookEventUpdate.mockResolvedValue({});
    const { lemonSqueezyWebhookHandler } = await import("./webhook.js");
    const body = JSON.stringify(subscriptionPayload());
    const res = response();

    await lemonSqueezyWebhookHandler({ body: Buffer.from(body), headers: {}, header: () => sign(body) } as any, res as any);

    expect(recordWebhookDelivery).toHaveBeenCalledWith(body, {
      eventName: "subscription_created",
      resourceType: "subscriptions",
      resourceId: "sub-123",
    });
    expect(subscriptionUpsert).toHaveBeenCalled();
    expect(subscriptionUpsert.mock.calls[0][0].create).toMatchObject({
      userId: "user-123",
      providerSubscriptionId: "sub-123",
      providerVariantId: "44",
      plan: "pro",
      status: "ACTIVE",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
