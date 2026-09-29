import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

import { recordWebhookDelivery } from "../lib/billing/webhookEvents.js";
import { verifyLemonSqueezySignature } from "../lib/billing/webhookSignature.js";
import { mapLemonSqueezyStatus, periodEndForState } from "../lib/billing/lemonSqueezyState.js";

const SUPPORTED_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_failed",
  "subscription_payment_success",
  "subscription_payment_recovered",
]);

export const lemonSqueezyWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  const signature = req.header("X-Signature");

  if (!rawBody || !verifyLemonSqueezySignature(rawBody, signature)) {
    res.status(400).json({ error: "Invalid webhook signature." });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: "Invalid webhook payload." });
    return;
  }

  const eventName = payload?.meta?.event_name;
  const data = payload?.data;
  const attributes = data?.attributes;
  const resourceType = data?.type;
  const resourceId = data?.id;

  if (typeof eventName !== "string" || typeof resourceType !== "string" || typeof resourceId !== "string") {
    res.status(400).json({ error: "Invalid webhook payload." });
    return;
  }

  if (!SUPPORTED_EVENTS.has(eventName)) {
    res.status(200).json({ received: true, ignored: true });
    return;
  }

  if (resourceType !== "subscriptions" || !attributes || typeof attributes !== "object") {
    res.status(400).json({ error: "Unsupported webhook resource." });
    return;
  }

  const identity = { eventName, resourceType, resourceId };
  const delivery = await recordWebhookDelivery(rawBody, identity);
  if (!delivery.created && !delivery.retry) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }

  const customUserId = payload?.meta?.custom_data?.user_id;
  if (typeof customUserId !== "string" || !customUserId) {
    await markWebhookFailed(delivery.eventId, "Missing custom_data.user_id");
    res.status(200).json({ received: true });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: customUserId }, select: { id: true } });
  if (!user) {
    await markWebhookFailed(delivery.eventId, "Referenced Achivii user does not exist");
    res.status(200).json({ received: true });
    return;
  }

  const providerStatus = typeof attributes.status === "string" ? attributes.status : "";
  const endsAt = typeof attributes.ends_at === "string" ? attributes.ends_at : null;
  const renewsAt = typeof attributes.renews_at === "string" ? attributes.renews_at : null;
  const state = attributes.cancelled
    ? (endsAt && new Date(endsAt) > new Date() ? "CANCELLED_ENDING" : "EXPIRED")
    : mapLemonSqueezyStatus(providerStatus, endsAt, renewsAt);
  const periodEnd = periodEndForState(state, renewsAt, endsAt);
  const periodStart = parseDate(attributes.created_at);
  const variantId = String(attributes.variant_id ?? "");
  const productId = attributes.product_id == null ? null : String(attributes.product_id);
  const customerId = attributes.customer_id == null ? null : String(attributes.customer_id);

  if (!variantId) {
    await markWebhookFailed(delivery.eventId, "Missing provider variant_id");
    res.status(200).json({ received: true });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.subscription.upsert({
        where: { providerSubscriptionId: resourceId },
        create: {
          userId: user.id,
          provider: "lemon_squeezy",
          providerCustomerId: customerId,
          providerSubscriptionId: resourceId,
          providerProductId: productId,
          providerVariantId: variantId,
          plan: "pro",
          billingInterval: inferInterval(attributes),
          status: state,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: state === "CANCELLED_ENDING" || Boolean(attributes.cancelled),
          cancelledAt: attributes.cancelled ? parseDate(attributes.updated_at) : null,
          pausedAt: state === "PAUSED" ? parseDate(attributes.updated_at) : null,
        },
        update: {
          userId: user.id,
          providerCustomerId: customerId,
          providerProductId: productId,
          providerVariantId: variantId,
          status: state,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: state === "CANCELLED_ENDING" || Boolean(attributes.cancelled),
          cancelledAt: attributes.cancelled ? parseDate(attributes.updated_at) : null,
          pausedAt: state === "PAUSED" ? parseDate(attributes.updated_at) : null,
          billingInterval: inferInterval(attributes),
        },
      });

      await tx.webhookEvent.update({
        where: { id: delivery.eventId },
        data: { status: "PROCESSED", processedAt: new Date(), processingError: null },
      });
    });
  } catch (error) {
    await markWebhookFailed(delivery.eventId, error instanceof Error ? error.message : "Webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed." });
    return;
  }

  res.status(200).json({ received: true });
};

const inferInterval = (attributes: any): string => {
  const name = String(attributes.variant_name ?? attributes.product_name ?? "").toLowerCase();
  return name.includes("year") || name.includes("annual") ? "yearly" : "monthly";
};

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const markWebhookFailed = async (eventId: string, message: string): Promise<void> => {
  await prisma.webhookEvent.update({
    where: { id: eventId },
    data: { status: "FAILED", processedAt: new Date(), processingError: message.slice(0, 1000) },
  });
};

export const webhookRouter = Router();
webhookRouter.post("/", lemonSqueezyWebhookHandler);




