import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// B-46 (2), Travelling Leo: the person can move their plan to the device's time zone.

const findUnique = vi.fn();
const updateMany = vi.fn();
const update = vi.fn();
const create = vi.fn();
const verifySupabaseToken = vi.fn();
vi.mock('../lib/prisma.js', () => ({ prisma: { user: { findUnique, updateMany, update, create } } }));
vi.mock('../lib/supabaseAuth.js', () => ({ verifySupabaseToken }));

const { authRouter } = await import('./auth.js');

const USER = { id: 'u1', email: 'leo@example.com', auth_user_id: 'auth-1', timezone: 'Europe/London', created_at: new Date('2026-09-01') };
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('Failed to bind');
      baseUrl = `http://localhost:${addr.port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  vi.clearAllMocks();
  verifySupabaseToken.mockResolvedValue({ authUserId: 'auth-1', email: USER.email });
  findUnique.mockResolvedValue(USER);
  update.mockImplementation(async ({ data }) => ({ ...USER, ...data }));
});

const put = (body: unknown, auth = true) =>
  fetch(`${baseUrl}/api/auth/timezone`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer t' } : {}) },
    body: JSON.stringify(body),
  });

describe('PUT /api/auth/timezone', () => {
  it('stores a valid zone and answers the user', async () => {
    const res = await put({ timezone: 'Asia/Tokyo' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { timezone: string } }).user.timezone).toBe('Asia/Tokyo');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' }, data: { timezone: 'Asia/Tokyo' } }));
  });

  it('refuses a zone that is not real, and writes nothing', async () => {
    expect((await put({ timezone: 'Mars/Olympus' })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('401 without a user', async () => {
    expect((await put({ timezone: 'Asia/Tokyo' }, false)).status).toBe(401);
  });
});

// ND-26: the missed-day reminder email on or off, from Account.
describe('PUT /api/auth/reminders', () => {
  const putReminders = (body: unknown, auth = true) =>
    fetch(`${baseUrl}/api/auth/reminders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer t' } : {}) },
      body: JSON.stringify(body),
    });

  it('turns reminders off and on, and answers the user', async () => {
    const res = await putReminders({ enabled: false });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { remindersEnabled: boolean } }).user.remindersEnabled).toBe(false);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' }, data: { remindersEnabled: false } }));
    expect((await putReminders({ enabled: true })).status).toBe(200);
  });

  it('refuses anything but a boolean, and writes nothing', async () => {
    expect((await putReminders({ enabled: 'false' })).status).toBe(400);
    expect((await putReminders({})).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('401 without a user', async () => {
    expect((await putReminders({ enabled: false }, false)).status).toBe(401);
  });
});
