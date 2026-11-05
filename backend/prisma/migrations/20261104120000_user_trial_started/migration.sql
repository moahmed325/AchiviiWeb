-- ND-37: the 30-day trial starts with a person's first plan.
ALTER TABLE "users" ADD COLUMN "trialStartedAt" TIMESTAMP(3);

-- Accounts that already have a plan start their 30 days now, so nobody is paused the moment this ships.
UPDATE "users" SET "trialStartedAt" = CURRENT_TIMESTAMP WHERE "id" IN (SELECT DISTINCT "userId" FROM "goals");
