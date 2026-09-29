import { prisma } from "../prisma.js";
import { getWebhookDeliveryKey } from "./webhookIdentity.js";

export type LemonSqueezyWebhookIdentity = Readonly<{
  eventName: string;
  resourceType: string;
  resourceId: string;
}>;

export { getWebhookDeliveryKey } from "./webhookIdentity.js";

export const recordWebhookDelivery = async (
  rawBody: string,
  identity: LemonSqueezyWebhookIdentity,
): Promise<{ created: boolean; eventId: string }> => {
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

    return { created: true, eventId: event.id };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.webhookEvent.findUnique({
        where: { deliveryKey },
        select: { id: true },
      });

      if (existing) return { created: false, eventId: existing.id };
    }

    throw error;
  }
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "P2002";
