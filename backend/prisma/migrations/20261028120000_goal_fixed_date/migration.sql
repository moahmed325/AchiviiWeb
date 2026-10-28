-- B-106 (2026-10-28): an optional outside date (an exam, a race, a talk) the goal must be ready by.
-- Additive and nullable: every existing goal keeps null and behaves as before.
ALTER TABLE "goals" ADD COLUMN "fixedDate" TIMESTAMP(3);
