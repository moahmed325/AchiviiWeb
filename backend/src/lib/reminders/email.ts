import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Reminder } from './plan.js';

/**
 * ND-26: the reminder email, its unsubscribe link and the send (Resend's HTTP API, no SDK). Settings, all in the
 * Render dashboard: `RESEND_API_KEY`, `REMINDER_FROM` (e.g. `Achivii <reminders@mail.example.com>`, a domain verified
 * in Resend), `REMINDERS_SIGNING_SECRET` (signs unsubscribe links). The app link uses `CLIENT_ORIGIN`; the unsubscribe
 * link uses the API's public URL (`API_PUBLIC_URL`, else Render's `RENDER_EXTERNAL_URL`).
 */

export interface ReminderEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribeUrl: string;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM && process.env.REMINDERS_SIGNING_SECRET && apiPublicUrl());
}

const apiPublicUrl = () => (process.env.API_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');
const appUrl = () => (process.env.CLIENT_ORIGIN || 'https://achiviiweb.vercel.app').replace(/\/+$/, '');

function signature(userId: string): string {
  return createHmac('sha256', process.env.REMINDERS_SIGNING_SECRET ?? '').update(`unsubscribe:${userId}`).digest('base64url');
}

/** Whether `token` is this user's unsubscribe signature. False when no signing secret is set. */
export function validUnsubscribeToken(userId: string, token: unknown): boolean {
  if (!process.env.REMINDERS_SIGNING_SECRET || typeof token !== 'string') return false;
  const expected = Buffer.from(signature(userId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function unsubscribeUrl(userId: string): string {
  return `${apiPublicUrl()}/api/reminders/unsubscribe?u=${encodeURIComponent(userId)}&t=${signature(userId)}`;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function buildReminderEmail(reminder: Reminder): ReminderEmail {
  const link = appUrl();
  const unsubscribe = unsubscribeUrl(reminder.userId);
  const minutes = reminder.todayMinutes > 0 ? ` (${reminder.todayMinutes} min)` : '';
  const short = reminder.hasMinimum ? 'Short on time? The 10-minute version counts.' : 'Even a few minutes counts.';
  const lines = [
    "Yesterday's session didn't happen. That's fine: nothing needs making up, and the plan carries on.",
    `Today's step: ${reminder.todayTitle}${minutes}.`,
    short,
  ];
  const text = `${lines.join('\n\n')}\n\nOpen today's step: ${link}\n\n—\nYou get one email like this after a missed day. Turn these off: ${unsubscribe}`;
  const html = [
    ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
    `<p><a href="${escapeHtml(link)}">Open today's step</a></p>`,
    `<p style="color:#888;font-size:12px">You get one email like this after a missed day. <a href="${escapeHtml(unsubscribe)}">Turn these off</a>.</p>`,
  ].join('\n');
  return { to: reminder.email, subject: 'No catch-up needed', text, html, unsubscribeUrl: unsubscribe };
}

/** Sends one email through Resend. Throws on a failed send, so the caller does not record it as sent. */
export async function sendEmail(email: ReminderEmail): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      html: email.html,
      // One-click unsubscribe (RFC 8058), which Gmail and Yahoo ask of senders.
      headers: { 'List-Unsubscribe': `<${email.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
}
