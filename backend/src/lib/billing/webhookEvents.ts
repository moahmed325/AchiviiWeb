import { prisma } from "../prisma.js";
import { getWebhookDeliveryKey } from "./webhookIdentity.js";

export type LemonSqueezyWebhookIdentity = Readonly<{
  eventName: string;
  resourceType: string;
  resourceId: string;
}>;

export type WebhookDeliveryResult = Readonly<{
  created: boolean;
  eventId: string;
  retry: boolean;
}>;

export { getWebhookDeliveryKey } from "./webhookIdentity.js";

/**
 * Creates the durable delivery record before applying provider state.
 * A processed delivery is terminal; RECEIVED/FAILED deliveries remain
 * retryable so a transient database/provider failure does not permanently
 * suppress a later provider retry.
 */
export const recordWebhookDelivery = async (
  rawBody: string,
  identity: LemonSqueezyWebhookIdentity,
): Promise<WebhookDeliveryResult> => {
  const deliveryKey = getWebhookDeliveryKey(rawBody);

  try {
    const event = await prisma.webhookEvent.create({
      data: {
        deliveryKey,
        eventName: identity.eventName,
        resourceType: identity.resourceType,
        resourceId: identity.resourceId,
      },
      select: { id: true },
    });

    return { created: true, eventId: event.id, retry: false };
  } catch (error: unknown) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await prisma.webhookEvent.findUnique({
      where: { deliveryKey },
      select: { id: true, status: true },
    });

    if (!existing) throw error;

    const retryable = existing.status === "RECEIVED" || existing.status === "FAILED";
    return { created: false, eventId: existing.id, retry: retryable };
  }
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "P2002";
