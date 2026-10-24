-- B-8, B-14, B-16 (2026-10-24): drop storage no code reads or writes.
-- The vector extension stays: the earlier migrations create it, and every database must still allow it.

-- B-8: the removed live research pipeline's cache (its indexes go with it).
DROP TABLE IF EXISTS "research_cache";

-- B-14: Goal columns of plan v1 and the research pipeline.
ALTER TABLE "goals"
  DROP COLUMN IF EXISTS "teachings",
  DROP COLUMN IF EXISTS "workBlocks",
  DROP COLUMN IF EXISTS "allowedUrls",
  DROP COLUMN IF EXISTS "canonicalKey";

-- B-16 (ND-20): Stripe-era billing columns on users; billing reads "subscriptions".
ALTER TABLE "users"
  DROP COLUMN IF EXISTS "plan",
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripeSubscriptionId",
  DROP COLUMN IF EXISTS "subscriptionStatus",
  DROP COLUMN IF EXISTS "currentPeriodEnd",
  DROP COLUMN IF EXISTS "cancelAtPeriodEnd";
