import { describe, expect, it } from "vitest";
import { getWebhookDeliveryKey } from "./webhookIdentity.js";

describe("webhook delivery idempotency", () => {
  it("produces the same key for the same raw signed body", () => {
    const body = '{"meta":{"event_name":"subscription_updated"},"data":{"id":"42"}}';
    expect(getWebhookDeliveryKey(body)).toBe(getWebhookDeliveryKey(body));
  });

  it("produces different keys when the signed body changes", () => {
    expect(getWebhookDeliveryKey("event-a")).not.toBe(getWebhookDeliveryKey("event-b"));
  });

  it("treats different raw bodies as different deliveries", () => {
    expect(getWebhookDeliveryKey('{"a":1,"b":2}')).not.toBe(
      getWebhookDeliveryKey('{"b":2,"a":1}'),
    );
  });
});
