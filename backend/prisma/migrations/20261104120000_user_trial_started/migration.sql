-- ND-37: the 30-day trial starts with a person's first plan.
ALTER TABLE "users" ADD COLUMN "trialStartedAt" TIMESTAMP(3);

-- Existing accounts: the trial counts from their first plan.
UPDATE "users" u
SET "trialStartedAt" = first_goal.created_at
FROM (SELECT "userId", MIN("created_at") AS created_at FROM "goals" GROUP BY "userId") first_goal
WHERE first_goal."userId" = u."id";
