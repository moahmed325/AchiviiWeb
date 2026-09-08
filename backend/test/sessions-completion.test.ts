import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { sessionsRouter } from '../src/routes/sessions.js';
import { prisma } from '../src/lib/prisma.js';
import * as authModule from '../src/routes/auth.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    userGoal: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    availabilitySlot: {
      findMany: vi.fn(),
    },
  },
}));

describe('Session completion and idempotency endpoint (PATCH /api/sessions/:id)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authModule, 'getAuthUser').mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
    } as any);
  });

  it('marks session as DONE and records completed_at_utc and idempotency_token', async () => {
    const existingSession = {
      id: 'sess-1',
      user_goal_id: 'goal-1',
      status: 'UPCOMING',
      idempotency_token: null,
      user_goal: { user_id: 'user-123' },
      task_template: { phase: {} },
    };

    (prisma.session.findUnique as any).mockResolvedValue(existingSession);
    (prisma.session.update as any).mockImplementation(({ data }: any) => ({
      ...existingSession,
      ...data,
    }));

    const offlineTimestamp = '2026-09-14T10:30:00.000Z';
    const res = await fetch(`${baseUrl}/api/sessions/sess-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'DONE',
        completed_at_utc: offlineTimestamp,
        idempotency_token: 'token-abc-123',
      }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: expect.objectContaining({
        status: 'DONE',
        completed_at_utc: new Date(offlineTimestamp),
        idempotency_token: 'token-abc-123',
      }),
      include: expect.anything(),
    });
  });

  it('returns cached response idempotently when idempotency_token matches', async () => {
    const existingDoneSession = {
      id: 'sess-1',
      user_goal_id: 'goal-1',
      status: 'DONE',
      completed_at_utc: new Date('2026-09-14T10:30:00.000Z'),
      idempotency_token: 'token-abc-123',
      user_goal: { user_id: 'user-123' },
      task_template: { phase: {} },
    };

    (prisma.session.findUnique as any).mockResolvedValue(existingDoneSession);

    const res = await fetch(`${baseUrl}/api/sessions/sess-1`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'idempotency-key': 'token-abc-123',
      },
      body: JSON.stringify({ status: 'DONE' }),
    });

    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.message).toContain('already updated with this idempotency token');
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('clears completed_at_utc and idempotency_token if status reverted to UPCOMING', async () => {
    const existingDoneSession = {
      id: 'sess-1',
      user_goal_id: 'goal-1',
      status: 'DONE',
      completed_at_utc: new Date(),
      idempotency_token: 'token-old',
      user_goal: { user_id: 'user-123' },
      task_template: { phase: {} },
    };

    (prisma.session.findUnique as any).mockResolvedValue(existingDoneSession);
    (prisma.session.update as any).mockImplementation(({ data }: any) => ({
      ...existingDoneSession,
      ...data,
    }));

    const res = await fetch(`${baseUrl}/api/sessions/sess-1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'UPCOMING' }),
    });

    expect(res.status).toBe(200);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'sess-1' },
      data: expect.objectContaining({
        status: 'UPCOMING',
        completed_at_utc: null,
        idempotency_token: null,
      }),
      include: expect.anything(),
    });
  });
});
