# Missed-day reminder email (ND-26)

One gentle email the morning after a missed practice day: "No catch-up needed", today's step, and the 10-minute
version when it has one. It exists so the missed-sessions work (carry, gentle return, auto-swap) reaches people who
would otherwise not come back.

## Who gets one (`backend/src/lib/reminders/plan.ts`, `reminderFor`)

All of these, in the person's own time zone:

- reminders are on (`User.remindersEnabled`, default `true`);
- it is their morning: from 08:00 to before 12:00 (`SEND_FROM_HOUR`, `SEND_UNTIL_HOUR`);
- yesterday was an open practice day left undone (not a rest day, not a day not offered, not completed);
- today is an open practice day;
- one per gap: if a reminder was sent before (`User.lastReminderAt`), a practice day must have been completed after
  it, and it must be at least `MIN_DAYS_BETWEEN` (3) days ago.

## How it runs

- `.github/workflows/reminders.yml` runs every hour (minute 17) and calls `POST /api/reminders/run` with
  `Authorization: Bearer <REMINDERS_CRON_SECRET>`. A GitHub schedule, because the Render service is on the free plan
  and sleeps; the call also wakes it. Without the repository secret the workflow does nothing.
- The route sends nothing unless `MISSED_DAY_REMINDERS_ENABLED` is `true` (`lib/flags.ts`) and the email settings are
  all set (`emailConfigured`); it answers `{ skipped: 'off' | 'not_configured' }` then.
- `runReminders` (`lib/reminders/run.ts`) loads everyone with reminders on and an active goal, claims each reminder
  with a conditional write of `lastReminderAt` (so overlapping runs never send twice), sends through Resend's HTTP API
  (`lib/reminders/email.ts`), and puts the old value back if the send fails. Log: `[Reminders] checked … sent … failed …`.

## Turning it off

- In the app: Account menu, "Email me after a missed day" (`PUT /api/auth/reminders { enabled }`).
- From the email: the unsubscribe link and the mail app's one-click unsubscribe (`List-Unsubscribe`,
  `List-Unsubscribe-Post`) hit `GET`/`POST /api/reminders/unsubscribe?u=<user id>&t=<signature>`. The signature is an
  HMAC of the user id with `REMINDERS_SIGNING_SECRET`; no sign-in needed.
- For everyone: set `MISSED_DAY_REMINDERS_ENABLED` to anything but `true` in Render (the kill switch).

## Setup (once)

1. Resend: create an account, add a sending domain (e.g. `mail.<your domain>`), add the DNS records it shows, wait
   for "Verified", then create an API key with sending access.
2. Render, service `achivii-api`, Environment:
   - `RESEND_API_KEY`: the key from step 1;
   - `REMINDER_FROM`: e.g. `Achivii <reminders@mail.<your domain>>`;
   - `REMINDERS_SIGNING_SECRET`: a long random string (`openssl rand -hex 32`); changing it breaks old unsubscribe links;
   - `REMINDERS_CRON_SECRET`: another long random string;
   - `API_PUBLIC_URL` is optional: Render's own `RENDER_EXTERNAL_URL` is used for the unsubscribe link.
3. GitHub, repository Settings > Secrets and variables > Actions: add `REMINDERS_CRON_SECRET` with the same value.
4. Test: Actions > "Missed-day reminders" > Run workflow. With the switch still off it prints `{"skipped":"off"}`.
5. Set `MISSED_DAY_REMINDERS_ENABLED=true` in Render. The next hourly run prints `{"checked":…,"sent":…,"failed":…}`.
