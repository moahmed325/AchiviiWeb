-- No weekly tests (2026-10-30, docs/features/no-weekly-tests/plan.md): how a done session felt, tapped by the person
-- (too_easy, just_right, too_hard). Additive and nullable: every existing row keeps null.
ALTER TABLE "daily_tasks" ADD COLUMN "feel" TEXT;
