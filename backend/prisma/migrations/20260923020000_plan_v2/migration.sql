-- Plan v2: one roadmap (goal, method, phases, 12 weekly targets) and weeks written one at a time.
ALTER TABLE "goals" ADD COLUMN "planVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "goals" ADD COLUMN "roadmap" JSONB;

ALTER TABLE "roadmap_weeks" ADD COLUMN "target" JSONB;
ALTER TABLE "roadmap_weeks" ADD COLUMN "test" JSONB;

ALTER TABLE "daily_tasks" ADD COLUMN "isKeySession" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_tasks" ADD COLUMN "isTestDay" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_tasks" ADD COLUMN "whyToday" TEXT;
ALTER TABLE "daily_tasks" ADD COLUMN "minimumVersion" JSONB;
