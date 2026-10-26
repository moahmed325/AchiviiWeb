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
 * - `GET /api/reminders/unsubscribe?u=<user id>&t=<signature>`: a page asking to confirm (a GET changes nothing);
 *   `POST` to the same URL turns reminders off without signing in (that page's button, and one-click unsubscribe).
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

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Achivii</title></head>` +
  `<body style="font-family:system-ui,sans-serif;background:#0b0b0c;color:#f2f2f2;padding:48px 16px;text-align:center">${body}</body></html>`;

const INVALID = "<p>That link isn't valid. You can turn reminders off in your account.</p>";

/** The signed user id from the link, or null. */
const linkUser = (req: Request): string | null => {
  const userId = typeof req.query.u === 'string' ? req.query.u : '';
  return userId && validUnsubscribeToken(userId, req.query.t) ? userId : null;
};

// Opening the link only asks: mail scanners and link previews follow every URL in a message, so a GET never changes
// anything. The button posts back to the same URL.
remindersRouter.get('/unsubscribe', (req: Request, res: Response) => {
  if (!linkUser(req)) {
    res.status(400).type('html').send(page(INVALID));
    return;
  }
  res
    .status(200)
    .type('html')
    .send(
      page(
        '<p>Stop the missed-day emails?</p>' +
          '<form method="post"><button type="submit" style="font:inherit;padding:10px 18px;border-radius:8px;cursor:pointer">Turn them off</button></form>',
      ),
    );
});

// The button above, and the mail app's one-click unsubscribe (RFC 8058), which posts to the List-Unsubscribe URL.
remindersRouter.post('/unsubscribe', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = linkUser(req);
    if (!userId) {
      res.status(400).type('html').send(page(INVALID));
      return;
    }
    await prisma.user.updateMany({ where: { id: userId }, data: { remindersEnabled: false } });
    res.status(200).type('html').send(page("<p>Done. You won't get missed-day emails any more. You can turn them back on in your account.</p>"));
  } catch (err) {
    next(err);
  }
});
