import { Router, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { flagOn } from '../lib/flags.js';
import { emailConfigured, validUnsubscribeToken } from '../lib/reminders/email.js';
import { runReminders } from '../lib/reminders/run.js';

/**
 * ND-26: the missed-day reminder email.
 * - `POST /api/reminders/run`: one pass, called hourly by `.github/workflows/reminders.yml` with
 *   `Authorization: Bearer <REMINDERS_CRON_SECRET>`. Sends nothing unless `MISSED_DAY_REMINDERS_ENABLED` is on and
 *   the email settings are all present.
 * - `GET` and `POST /api/reminders/unsubscribe?u=<user id>&t=<signature>`: turns reminders off without signing in
 *   (the email's link, and one-click unsubscribe from the mail app).
 */
export const remindersRouter = Router();

function cronAuthorized(req: Request): boolean {
  const secret = process.env.REMINDERS_CRON_SECRET;
  const header = req.headers.authorization;
  if (!secret || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

remindersRouter.post('/run', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!cronAuthorized(req)) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (!flagOn('MISSED_DAY_REMINDERS_ENABLED')) {
      res.status(200).json({ skipped: 'off' });
      return;
    }
    if (!emailConfigured()) {
      console.warn('[Reminders] on, but RESEND_API_KEY, REMINDER_FROM, REMINDERS_SIGNING_SECRET or the API URL is missing');
      res.status(200).json({ skipped: 'not_configured' });
      return;
    }
    res.status(200).json(await runReminders());
  } catch (err) {
    next(err);
  }
});

const page = (message: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Achivii</title></head>` +
  `<body style="font-family:system-ui,sans-serif;background:#0b0b0c;color:#f2f2f2;padding:48px 16px;text-align:center"><p>${message}</p></body></html>`;

async function unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = typeof req.query.u === 'string' ? req.query.u : '';
    if (!userId || !validUnsubscribeToken(userId, req.query.t)) {
      res.status(400).type('html').send(page("That link isn't valid. You can turn reminders off in your account."));
      return;
    }
    await prisma.user.updateMany({ where: { id: userId }, data: { remindersEnabled: false } });
    res.status(200).type('html').send(page("Done. You won't get missed-day emails any more. You can turn them back on in your account."));
  } catch (err) {
    next(err);
  }
}

remindersRouter.get('/unsubscribe', unsubscribe);
remindersRouter.post('/unsubscribe', unsubscribe);
