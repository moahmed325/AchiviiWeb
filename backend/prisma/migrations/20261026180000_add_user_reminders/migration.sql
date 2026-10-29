-- ND-28: the missed-day reminder email (on by default) and when the last one was sent.
ALTER TABLE "users" ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
