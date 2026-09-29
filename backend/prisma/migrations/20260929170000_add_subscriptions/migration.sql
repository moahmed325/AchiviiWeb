CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'lemon_squeezy',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT NOT NULL,
    "providerProductId" TEXT,
    "providerVariantId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");
CREATE INDEX "subscriptions_providerCustomerId_idx" ON "subscriptions"("providerCustomerId");
CREATE INDEX "subscriptions_providerVariantId_idx" ON "subscriptions"("providerVariantId");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
