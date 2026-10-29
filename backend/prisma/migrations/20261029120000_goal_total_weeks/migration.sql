-- B-109 (2026-10-29): how many weeks a plan has. A fixed date under 12 weeks away gives a shorter plan (4 to 11 weeks).
-- Additive with a default: every existing goal gets 12 and behaves as before.
ALTER TABLE "goals" ADD COLUMN "totalWeeks" INTEGER NOT NULL DEFAULT 12;
