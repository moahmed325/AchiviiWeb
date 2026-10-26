-- B-104 (2026-10-26): legacy plan v1 storage. Check first that no goal has a velocity table:
--   SELECT count(*) FROM "goals" WHERE "velocityTable" IS NOT NULL;   -- must be 0
-- Every goal is plan v2 (ND-21); the column was read only by the retired clamps.
ALTER TABLE "goals" DROP COLUMN IF EXISTS "velocityTable";

-- Every goal is created with planVersion 2; the default now says so.
ALTER TABLE "goals" ALTER COLUMN "planVersion" SET DEFAULT 2;
