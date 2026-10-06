import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter } from '../src/routes/goal.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    dailyTask: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../src/routes/auth.js', () => ({
  getAuthUser: vi.fn(),
  authRouter: (_req: any, _res: any, next: any) => next(),
}));

// Missed sessions M2.0 (ND-3): PATCH /api/goal/tasks/:taskId records whether a
// completion went through the 10-minute version.
describe('PATCH /api/goal/tasks/:taskId — usedMinimumVersion (M2.0, ND-3)', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;

  const mockUser = { id: 'usr-task-1', email: 'doer@achivii.com' };
  const minimumStep = { stepNumber: 1, title: 'Ten easy minutes', durationMinutes: 10, instructions: 'Just start.' };
  const earlier = new Date('2026-10-05T08:00:00Z');

  const task = (overrides: Record<string, unknown> = {}) => ({
    id: 'task-1',
    goalId: 'goal-1',
    status: 'pending',
    completedAt: null,
    notes: null,
    slotTime: null,
    minimumVersion: minimumStep,
    usedMinimumVersion: false,
    goal: { id: 'goal-1', userId: mockUser.id },
    ...overrides,
  });

  const patch = (body: unknown, taskId = 'task-1') =>
    fetch(`${baseUrl}/api/goal/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-jwt-token' },
      body: JSON.stringify(body),
    });

  const updateData = () => (prisma.dailyTask.update as any).mock.calls[0][0].data;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/goal', goalRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') throw new Error('Failed to bind ephemeral test server');
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
    (getAuthUser as any).mockResolvedValue(mockUser);
    // Echo the write back the way Prisma would return the updated row.
    (prisma.dailyTask.update as any).mockImplementation(async ({ data }: any) => {
      const { goal: _goal, ...row } = task();
      return { ...row, ...data };
    });
  });

  it('stores true for a minimum completion of a task that has a minimum version', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

    const res = await patch({ status: 'completed', usedMinimumVersion: true });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.task.usedMinimumVersion).toBe(true);
    expect(json.task.status).toBe('completed');
    expect(updateData()).toEqual(
      expect.objectContaining({ status: 'completed', usedMinimumVersion: true, completedAt: expect.any(Date) })
    );
  });

  it('stores false for a completion without the flag (a full session)', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ usedMinimumVersion: true }));

    const res = await patch({ status: 'completed' });

    expect(res.status).toBe(200);
    expect((await res.json()).task.usedMinimumVersion).toBe(false);
    expect(updateData().usedMinimumVersion).toBe(false);
  });

  it('stores false when the flag is sent as false', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

    const res = await patch({ status: 'completed', usedMinimumVersion: false });

    expect(res.status).toBe(200);
    expect(updateData().usedMinimumVersion).toBe(false);
  });

  it('stores false for a task without a minimum version (old goals, AC-14)', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ minimumVersion: null }));

    const res = await patch({ status: 'completed', usedMinimumVersion: true });

    expect(res.status).toBe(200);
    expect((await res.json()).task.usedMinimumVersion).toBe(false);
    expect(updateData()).toEqual(expect.objectContaining({ status: 'completed', usedMinimumVersion: false }));
  });

  it('clears the flag and completedAt when the task goes back to pending', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(
      task({ status: 'completed', completedAt: earlier, usedMinimumVersion: true })
    );

    const res = await patch({ status: 'pending' });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.task.usedMinimumVersion).toBe(false);
    expect(json.task.completedAt).toBeNull();
    expect(updateData()).toEqual(expect.objectContaining({ status: 'pending', completedAt: null, usedMinimumVersion: false }));
  });

  it('ignores the flag when sent with pending', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: 'completed', completedAt: earlier }));

    const res = await patch({ status: 'pending', usedMinimumVersion: true });

    expect(res.status).toBe(200);
    expect(updateData().usedMinimumVersion).toBe(false);
  });

  it('leaves the flag and completedAt unchanged on a notes-only update', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(
      task({ status: 'completed', completedAt: earlier, usedMinimumVersion: true })
    );

    const res = await patch({ notes: 'Felt good.' });

    expect(res.status).toBe(200);
    const data = updateData();
    expect(data).not.toHaveProperty('usedMinimumVersion');
    expect(data).not.toHaveProperty('status');
    expect(data.notes).toBe('Felt good.');
    expect(data.completedAt).toEqual(earlier);
  });

  it('ignores the flag when sent without status (slot change)', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

    const res = await patch({ slotTime: '07:30', usedMinimumVersion: true });

    expect(res.status).toBe(200);
    const data = updateData();
    expect(data).not.toHaveProperty('usedMinimumVersion');
    expect(data.slotTime).toBe('07:30');
  });

  it.each([['yes'], [1], [null], [{}]])('rejects a non-boolean flag (%j) with 400 and writes nothing', async (value) => {
    const res = await patch({ status: 'completed', usedMinimumVersion: value });

    expect(res.status).toBe(400);
    expect(prisma.dailyTask.update).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's task and writes nothing", async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ goal: { id: 'goal-2', userId: 'someone-else' } }));

    const res = await patch({ status: 'completed', usedMinimumVersion: true });

    expect(res.status).toBe(404);
    expect(prisma.dailyTask.update).not.toHaveBeenCalled();
  });

  it('returns 401 without a signed-in user', async () => {
    (getAuthUser as any).mockResolvedValueOnce(null);

    const res = await patch({ status: 'completed' });

    expect(res.status).toBe(401);
    expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
  });

  it('sets completedAt to now on completion, as before', async () => {
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());
    const before = Date.now();

    await patch({ status: 'completed', usedMinimumVersion: true });

    const at = updateData().completedAt as Date;
    expect(at).toBeInstanceOf(Date);
    expect(at.getTime()).toBeGreaterThanOrEqual(before);
  });
});

const migrationsDir = fileURLToPath(new URL('../prisma/migrations', import.meta.url));

describe('M2.0 migration (ND-3)', () => {
  it('adds exactly the one usedMinimumVersion column', () => {
    const matches = readdirSync(migrationsDir).filter((name) => name.endsWith('_add_daily_task_used_minimum_version'));
    expect(matches).toHaveLength(1);

    const sql = readFileSync(join(migrationsDir, matches[0], 'migration.sql'), 'utf8');
    const statements = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join(' ')
      .split(';')
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    expect(statements).toEqual(['ALTER TABLE "daily_tasks" ADD COLUMN "usedMinimumVersion" BOOLEAN NOT NULL DEFAULT false']);
  });
});
