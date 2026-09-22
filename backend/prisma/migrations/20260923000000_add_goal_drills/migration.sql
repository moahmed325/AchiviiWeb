-- The ranked drill library chosen with the method, so later weeks keep building from the same best drills.
ALTER TABLE "goals" ADD COLUMN "drills" JSONB;
