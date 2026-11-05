import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// ND-39: one guided skill added to the timeline, Pro only to add.

const findUnique = vi.fn();
const update = vi.fn();
const verifySupabaseToken = vi.fn();
const hasProEntitlement = vi.fn();
vi.mock('../lib/prisma.js', () => ({ prisma: { user: { findUnique, update, updateMany: vi.fn(), create: vi.fn() } } }));
vi.mock('../lib/supabaseAuth.js', () => ({ verifySupabaseToken }));
vi.mock('../lib/billing/entitlement.js', () => ({ hasProEntitlement }));

const { authRouter } = await import('./auth.js');
const { errorHandler } = await import('../lib/httpErrors.js');

const USER = { id: 'u1', email: 'mo@example.com', auth_user_id: 'auth-1', timezone: 'Europe/London', created_at: new Date('2026-09-01'), trialStartedAt: null, upNextSkill: null };
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(errorHandler);
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
  hasProEntitlement.mockResolvedValue(true);
});

const put = (body: unknown) =>
  fetch(`${baseUrl}/api/auth/up-next`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' },
    body: JSON.stringify(body),
  });

describe('PUT /api/auth/up-next', () => {
  it('adds a guided skill for Pro and answers the user', async () => {
    const res = await put({ skill: 'run10k' });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { user: { upNextSkill: string } }).user.upNextSkill).toBe('run10k');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' }, data: { upNextSkill: 'run10k' } }));
  });

  it('refuses to add without Pro, but always lets the skill be removed', async () => {
    hasProEntitlement.mockResolvedValue(false);
    const refused = await put({ skill: 'run10k' });
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ reason: 'SKILLS_REQUIRE_PRO' });
    expect((await put({ skill: null })).status).toBe(200);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('refuses anything that is not a guided skill, and writes nothing', async () => {
    expect((await put({ skill: 'juggling' })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
