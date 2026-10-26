import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import { dayBefore, reminderFor, type ReminderCandidate, type ReminderTask } from '../src/lib/reminders/plan.js';
import { buildReminderEmail, unsubscribeUrl, validUnsubscribeToken } from '../src/lib/reminders/email.js';
import { runReminders } from '../src/lib/reminders/run.js';
import { remindersRouter } from '../src/routes/reminders.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { user: { findMany: vi.fn(), updateMany: vi.fn() } },
}));

// 09:30 on Monday 26 October in Tokyo (00:30 UTC).
const NOW = new Date('2026-10-26T00:30:00Z');
const TZ = 'Asia/Tokyo';

const day = (date: string, over: Partial<ReminderTask> = {}): ReminderTask => ({
  date,
  status: 'pending',
  isRestDay: false,
  notOffered: false,
  title: `Session ${date}`,
  durationMinutes: 30,
  completedAt: null,
  minimumVersion: { title: 'Short version' },
  ...over,
});

const candidate = (over: Partial<ReminderCandidate> = {}): ReminderCandidate => ({
  userId: 'u1',
  email: 'leo@example.com',
  timezone: TZ,
  remindersEnabled: true,
  lastReminderAt: null,
  tasks: [day('2026-10-24', { status: 'completed', completedAt: new Date('2026-10-24T10:00:00Z') }), day('2026-10-25'), day('2026-10-26', { title: 'Tempo run' })],
  ...over,
});

describe('reminderFor (ND-26)', () => {
  it('reminds the morning after a missed practice day, naming today\'s step', () => {
    expect(reminderFor(candidate(), NOW)).toEqual({ userId: 'u1', email: 'leo@example.com', todayTitle: 'Tempo run', todayMinutes: 30, hasMinimum: true });
  });

  it('only in the person\'s morning, by their time zone', () => {
    expect(reminderFor(candidate(), new Date('2026-10-25T22:30:00Z'))).toBeNull(); // 07:30 Tokyo
    expect(reminderFor(candidate(), new Date('2026-10-26T03:30:00Z'))).toBeNull(); // 12:30 Tokyo
    expect(reminderFor(candidate(), new Date('2026-10-25T23:00:00Z'))).not.toBeNull(); // 08:00 Tokyo
  });

  it('never when reminders are off', () => {
    expect(reminderFor(candidate({ remindersEnabled: false }), NOW)).toBeNull();
  });

  it('not when yesterday was done, a rest day, or not offered', () => {
    for (const over of [{ status: 'completed' }, { isRestDay: true }, { notOffered: true }]) {
      const tasks = candidate().tasks.map((t) => (t.date === '2026-10-25' ? { ...t, ...over } : t));
      expect(reminderFor(candidate({ tasks }), NOW)).toBeNull();
    }
  });

  it('not when today is a rest day, already done, or has no day', () => {
    for (const over of [{ isRestDay: true }, { status: 'completed' }]) {
      const tasks = candidate().tasks.map((t) => (t.date === '2026-10-26' ? { ...t, ...over } : t));
      expect(reminderFor(candidate({ tasks }), NOW)).toBeNull();
    }
    expect(reminderFor(candidate({ tasks: candidate().tasks.filter((t) => t.date !== '2026-10-26') }), NOW)).toBeNull();
  });

  it('one per gap: none until a practice day is completed after the last reminder', () => {
    // A reminder 4 days ago and nothing completed since: still in the same gap.
    expect(reminderFor(candidate({ lastReminderAt: new Date('2026-10-22T00:00:00Z'), tasks: candidate().tasks.map((t) => ({ ...t, completedAt: t.completedAt && new Date('2026-10-20T00:00:00Z') })) }), NOW)).toBeNull();
    // Completed something after it: a new gap, so a new reminder.
    expect(reminderFor(candidate({ lastReminderAt: new Date('2026-10-22T00:00:00Z') }), NOW)).not.toBeNull();
  });

  it('never two within three days', () => {
    expect(reminderFor(candidate({ lastReminderAt: new Date('2026-10-24T00:00:00Z') }), NOW)).toBeNull();
  });

  it('says when today has no 10-minute version', () => {
    const tasks = candidate().tasks.map((t) => (t.date === '2026-10-26' ? { ...t, minimumVersion: null } : t));
    expect(reminderFor(candidate({ tasks }), NOW)?.hasMinimum).toBe(false);
  });

  it('dayBefore works on calendar keys across months', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });
});

describe('the reminder email (ND-26)', () => {
  beforeEach(() => {
    vi.stubEnv('REMINDERS_SIGNING_SECRET', 'test-signing-secret');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com/');
    vi.stubEnv('CLIENT_ORIGIN', 'https://app.example.com');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is calm, names today\'s step, links to the app and to unsubscribe', () => {
    const email = buildReminderEmail({ userId: 'u1', email: 'leo@example.com', todayTitle: 'Tempo run', todayMinutes: 30, hasMinimum: true });
    expect(email.subject).toBe('No catch-up needed');
    expect(email.text).toContain("Yesterday's session didn't happen. That's fine: nothing needs making up, and the plan carries on.");
    expect(email.text).toContain("Today's step: Tempo run (30 min).");
    expect(email.text).toContain('Short on time? The 10-minute version counts.');
    expect(email.text).toContain('https://app.example.com');
    expect(email.unsubscribeUrl).toMatch(/^https:\/\/api\.example\.com\/api\/reminders\/unsubscribe\?u=u1&t=/);
    for (const word of [/failed/i, /behind/i, /streak/i]) expect(email.text).not.toMatch(word);
  });

  it('escapes the step title in the HTML', () => {
    const email = buildReminderEmail({ userId: 'u1', email: 'x@example.com', todayTitle: '<b>Run</b> & "go"', todayMinutes: 0, hasMinimum: false });
    expect(email.html).toContain('&lt;b&gt;Run&lt;/b&gt; &amp; &quot;go&quot;');
    expect(email.html).not.toContain('<b>Run</b>');
  });

  it('the unsubscribe signature is per user and checked exactly', () => {
    const token = new URL(unsubscribeUrl('u1')).searchParams.get('t');
    expect(validUnsubscribeToken('u1', token)).toBe(true);
    expect(validUnsubscribeToken('u2', token)).toBe(false);
    expect(validUnsubscribeToken('u1', `${token}x`)).toBe(false);
    expect(validUnsubscribeToken('u1', undefined)).toBe(false);
    vi.stubEnv('REMINDERS_SIGNING_SECRET', '');
    expect(validUnsubscribeToken('u1', token)).toBe(false);
  });
});

describe('runReminders (ND-26)', () => {
  const fetchMock = vi.fn();
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'leo@example.com',
    timezone: TZ,
    remindersEnabled: true,
    lastReminderAt: null,
    goals: [{ dailyTasks: candidate().tasks }],
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('RESEND_API_KEY', 'key');
    vi.stubEnv('REMINDER_FROM', 'Achivii <r@example.com>');
    vi.stubEnv('REMINDERS_SIGNING_SECRET', 'secret');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com');
    (prisma.user.updateMany as any).mockResolvedValue({ count: 1 });
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('claims, then sends one email through Resend with one-click unsubscribe headers', async () => {
    (prisma.user.findMany as any).mockResolvedValue([row(), row({ id: 'u2', goals: [{ dailyTasks: [] }] })]);

    expect(await runReminders(NOW)).toEqual({ checked: 2, sent: 1, failed: 0 });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', remindersEnabled: true, lastReminderAt: null },
      data: { lastReminderAt: NOW },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ from: 'Achivii <r@example.com>', to: ['leo@example.com'], subject: 'No catch-up needed' });
    expect(body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(init.headers.Authorization).toBe('Bearer key');
  });

  it('sends nothing when another run already claimed the person', async () => {
    (prisma.user.findMany as any).mockResolvedValue([row()]);
    (prisma.user.updateMany as any).mockResolvedValueOnce({ count: 0 });
    expect(await runReminders(NOW)).toEqual({ checked: 1, sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a failed send puts the old time back, so the next run tries again', async () => {
    (prisma.user.findMany as any).mockResolvedValue([row()]);
    fetchMock.mockResolvedValueOnce(new Response('bad', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runReminders(NOW)).toEqual({ checked: 1, sent: 0, failed: 1 });
    expect(prisma.user.updateMany).toHaveBeenLastCalledWith({ where: { id: 'u1', lastReminderAt: NOW }, data: { lastReminderAt: null } });
  });
});

describe('/api/reminders routes (ND-26)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/reminders', remindersRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });
  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('REMINDERS_CRON_SECRET', 'cron-secret');
    vi.stubEnv('REMINDERS_SIGNING_SECRET', 'secret');
    vi.stubEnv('API_PUBLIC_URL', 'https://api.example.com');
  });
  afterEach(() => vi.unstubAllEnvs());

  const run = (auth?: string) => fetch(`${baseUrl}/api/reminders/run`, { method: 'POST', headers: auth ? { Authorization: auth } : {} });

  it('run refuses without the cron secret', async () => {
    expect((await run()).status).toBe(401);
    expect((await run('Bearer wrong')).status).toBe(401);
    vi.stubEnv('REMINDERS_CRON_SECRET', '');
    expect((await run('Bearer ')).status).toBe(401);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('run sends nothing while the switch is off, or the email settings are missing', async () => {
    vi.stubEnv('MISSED_DAY_REMINDERS_ENABLED', '');
    expect(await (await run('Bearer cron-secret')).json()).toEqual({ skipped: 'off' });
    vi.stubEnv('MISSED_DAY_REMINDERS_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await (await run('Bearer cron-secret')).json()).toEqual({ skipped: 'not_configured' });
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('run goes through when on and configured', async () => {
    vi.stubEnv('MISSED_DAY_REMINDERS_ENABLED', 'true');
    vi.stubEnv('RESEND_API_KEY', 'key');
    vi.stubEnv('REMINDER_FROM', 'Achivii <r@example.com>');
    (prisma.user.findMany as any).mockResolvedValue([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await (await run('Bearer cron-secret')).json()).toEqual({ checked: 0, sent: 0, failed: 0 });
  });

  it('unsubscribe turns reminders off with a valid link, by GET or one-click POST', async () => {
    (prisma.user.updateMany as any).mockResolvedValue({ count: 1 });
    const link = unsubscribeUrl('u1').replace('https://api.example.com', baseUrl);
    const res = await fetch(link);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("You won't get missed-day emails any more");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { remindersEnabled: false } });
    expect((await fetch(link, { method: 'POST', body: 'List-Unsubscribe=One-Click' })).status).toBe(200);
  });

  it('unsubscribe refuses a bad link and changes nothing', async () => {
    const res = await fetch(`${baseUrl}/api/reminders/unsubscribe?u=u1&t=forged`);
    expect(res.status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
