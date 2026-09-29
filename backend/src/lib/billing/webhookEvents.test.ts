import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
const findUnique = vi.fn();
vi.mock("../prisma.js", () => ({ prisma: { webhookEvent: { create, findUnique } } }));

describe("webhook delivery idempotency", () => {
  it("treats processed deliveries as terminal duplicates", async () => {
    create.mockRejectedValue({ code: "P2002" });
    findUnique.mockResolvedValue({ id: "event-1", status: "PROCESSED" });
    const { recordWebhookDelivery } = await import("./webhookEvents.js");
    await expect(recordWebhookDelivery("body", { eventName: "subscription_updated", resourceType: "subscriptions", resourceId: "sub-1" }))
      .resolves.toEqual({ created: false, eventId: "event-1", retry: false });
  });

  it.each(["RECEIVED", "FAILED"])('allows %s deliveries to be retried', async (status) => {
    create.mockRejectedValue({ code: "P2002" });
    findUnique.mockResolvedValue({ id: "event-1", status });
    const { recordWebhookDelivery } = await import("./webhookEvents.js");
    await expect(recordWebhookDelivery("body", { eventName: "subscription_updated", resourceType: "subscriptions", resourceId: "sub-1" }))
      .resolves.toEqual({ created: false, eventId: "event-1", retry: true });
  });
});
