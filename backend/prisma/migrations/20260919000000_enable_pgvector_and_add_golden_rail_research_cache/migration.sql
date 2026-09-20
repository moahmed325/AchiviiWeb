-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "canonicalAuthority" TEXT,
ADD COLUMN     "canonicalKey" TEXT,
ADD COLUMN     "canonicalMethodName" TEXT,
ADD COLUMN     "canonicalSourceUrl" TEXT,
ADD COLUMN     "isGoldenRail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "methodConfidence" TEXT,
ADD COLUMN     "velocityTable" JSONB;

-- CreateTable
CREATE TABLE "research_cache" (
    "id" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "outcomeEmbedding" TEXT NOT NULL,
    "canonicalMethod" JSONB NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "userFeedbackScore" DOUBLE PRECISION,
    "readyForPromotion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "research_cache_canonicalKey_key" ON "research_cache"("canonicalKey");
