-- Phase 4: remember what the plan is based on so the badge and later weeks stay honest.
ALTER TABLE "goals" ADD COLUMN "methodKind" TEXT;
ALTER TABLE "goals" ADD COLUMN "teachings" JSONB;
ALTER TABLE "goals" ADD COLUMN "allowedUrls" JSONB;
