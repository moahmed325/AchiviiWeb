CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_deliveryKey_key" ON "webhook_events"("deliveryKey");
CREATE INDEX "webhook_events_resourceType_resourceId_idx" ON "webhook_events"("resourceType", "resourceId");
CREATE INDEX "webhook_events_status_receivedAt_idx" ON "webhook_events"("status", "receivedAt");
