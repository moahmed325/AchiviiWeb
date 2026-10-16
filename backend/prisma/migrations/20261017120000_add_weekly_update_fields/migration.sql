-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "closeTriedAt" TIMESTAMP(3),
ADD COLUMN     "closeTriedWeek" INTEGER,
ADD COLUMN     "movedDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "roadmap_weeks" ADD COLUMN     "breakDays" INTEGER,
ADD COLUMN     "closeLineSeenAt" TIMESTAMP(3),
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "dailyTimeAskedAt" TIMESTAMP(3),
ADD COLUMN     "jumped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retestOfWeek" INTEGER,
ADD COLUMN     "updateStatus" TEXT;

-- AlterTable
ALTER TABLE "daily_tasks" ADD COLUMN     "notOffered" BOOLEAN NOT NULL DEFAULT false;

