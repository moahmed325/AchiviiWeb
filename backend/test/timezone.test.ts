import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { prisma } from '../src/lib/prisma.js';
import { isValidTimezone, normalizeTimezone, getZonedDateString, getUserTodayDateString } from '../src/lib/timezone.js';
import { authRouter } from '../src/routes/auth.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('Timezone Utility (Phase 1 Task 6 & 7)', () => {
  it('validates IANA timezones accurately', () => {
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    expect(isValidTimezone('Europe/London')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);

    expect(isValidTimezone('Invalid/Zone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone(null)).toBe(false);
    expect(isValidTimezone(undefined)).toBe(false);
    expect(isValidTimezone(12345)).toBe(false);
  });

  it('normalizes invalid or missing timezones to UTC', () => {
    expect(normalizeTimezone('America/New_York')).toBe('America/New_York');
    expect(normalizeTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(normalizeTimezone('Invalid/Zone')).toBe('UTC');
    expect(normalizeTimezone(null)).toBe('UTC');
    expect(normalizeTimezone(undefined)).toBe('UTC');
  });

  it('computes zoned date strings across international date boundaries', () => {
    // 2026-09-08 23:30 UTC:
    // In Tokyo (UTC+9), it is already 2026-09-09 (08:30 AM)
    // In New York (EDT, UTC-4), it is still 2026-09-08 (19:30 PM)
    const testDate = new Date('2026-09-08T23:30:00.000Z');

    const tokyoDateStr = getZonedDateString(testDate, 'Asia/Tokyo');
    const nyDateStr = getZonedDateString(testDate, 'America/New_York');
    const utcDateStr = getZonedDateString(testDate, 'UTC');

    expect(tokyoDateStr).toBe('2026-09-09');
    expect(nyDateStr).toBe('2026-09-08');
    expect(utcDateStr).toBe('2026-09-08');
  });

  it('computes today string in user timezone', () => {
    const todayStr = getUserTodayDateString('UTC');
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('User Timezone Persistence in Auth API', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures client timezone on signup and persists it', async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'securepassword123';
    const timezone = 'America/Los_Angeles';

    (prisma.user.findUnique as any).mockResolvedValueOnce(null);
    (prisma.user.create as any).mockImplementationOnce(async ({ data }: any) => {
      return {
        id: 'user-123',
        email: data.email,
        timezone: data.timezone,
        created_at: new Date(),
      };
    });

    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, timezone }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.timezone).toBe('America/Los_Angeles');
  });

  it('falls back to UTC when client passes invalid or missing timezone', async () => {
    const email = `test-${Date.now()}@example.com`;
    const password = 'securepassword123';

    (prisma.user.findUnique as any).mockResolvedValueOnce(null);
    (prisma.user.create as any).mockImplementationOnce(async ({ data }: any) => {
      return {
        id: 'user-456',
        email: data.email,
        timezone: data.timezone,
        created_at: new Date(),
      };
    });

    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, timezone: 'invalid/nonexistent' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.timezone).toBe('UTC');
  });
});
