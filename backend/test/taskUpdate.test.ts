import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/lib/prisma.js';
import { getAuthUser } from '../src/routes/auth.js';
import { goalRouter, TASK_NOTES_HARD_MAX, TASK_NOTES_MAX_LENGTH, TASK_STATUSES } from '../src/routes/goal.js';

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
    isRestDay: false,
    goal: { id: 'goal-1', userId: mockUser.id, status: 'active' },
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
    (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ goal: { id: 'goal-2', userId: 'someone-else', status: 'active' } }));

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

  // B-11: only the known statuses are stored.
  describe('status validation (B-11)', () => {
    const statusError = { error: 'status must be "pending" or "completed".' };

    it.each([['skipped'], ['done'], ['COMPLETED'], ['']])('rejects the status %j with 400 and writes nothing', async (value) => {
      const res = await patch({ status: value });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(statusError);
      expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
      expect(prisma.dailyTask.update).not.toHaveBeenCalled();
    });

    it.each([[1], [true], [null], [{}], [['completed']]])('rejects a non-string status (%j) with 400 and writes nothing', async (value) => {
      const res = await patch({ status: value, notes: 'should not be saved' });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(statusError);
      expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
      expect(prisma.dailyTask.update).not.toHaveBeenCalled();
    });

    it('accepts pending', async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: 'completed', completedAt: earlier }));

      const res = await patch({ status: 'pending' });

      expect(res.status).toBe(200);
      expect(updateData()).toEqual(expect.objectContaining({ status: 'pending', completedAt: null }));
    });

    it('accepts completed', async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

      const res = await patch({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(updateData()).toEqual(expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }));
    });

    it('still accepts a request without status', async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: 'completed', completedAt: earlier }));

      const res = await patch({ notes: 'Short on time.', slotTime: '18:00' });

      expect(res.status).toBe(200);
      const data = updateData();
      expect(data).not.toHaveProperty('status');
      expect(data).toEqual(expect.objectContaining({ notes: 'Short on time.', slotTime: '18:00', completedAt: earlier }));
    });
  });

  // B-29: notes and slotTime are checked, a repeated completion keeps the first one, and only an active goal changes.
  describe('field checks and guards (B-29)', () => {
    it('allows exactly the two statuses in TASK_STATUSES', async () => {
      expect(TASK_STATUSES).toEqual(['pending', 'completed']);
      for (const status of TASK_STATUSES) {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ status: status === 'pending' ? 'completed' : 'pending' }));
        const res = await patch({ status });
        expect(res.status).toBe(200);
      }
    });

    describe('notes', () => {
      it.each([[''], ['Felt good.'], ['x'.repeat(TASK_NOTES_MAX_LENGTH)]])('stores a string note (%#)', async (value) => {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

        const res = await patch({ notes: value });

        expect(res.status).toBe(200);
        expect(updateData().notes).toBe(value);
      });

      it('clears the note with null', async () => {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: 'Old note.' }));

        const res = await patch({ notes: null });

        expect(res.status).toBe(200);
        expect(updateData()).toHaveProperty('notes', null);
      });

      it(`rejects a new note longer than ${TASK_NOTES_MAX_LENGTH} characters with 400 and writes nothing`, async () => {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

        const res = await patch({ notes: 'x'.repeat(TASK_NOTES_MAX_LENGTH + 1) });

        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatch(/notes/);
        expect(prisma.dailyTask.update).not.toHaveBeenCalled();
      });

      // Follow-up: a note saved before the limit existed must never stop a step being marked done.
      describe('old long notes', () => {
        const oldNote = 'o'.repeat(3000);
        const focusWin = (text: string) => `
• Focus win: ${text}`;

        it('marks done a task whose old note is over the limit when the same note is sent back', async () => {
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: oldNote }));

          const res = await patch({ status: 'completed', notes: oldNote });

          expect(res.status).toBe(200);
          expect(updateData()).toEqual(expect.objectContaining({ status: 'completed', notes: oldNote }));
        });

        it('marks done with a Focus win added to an old note over the limit', async () => {
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: oldNote }));
          const notes = oldNote + focusWin('w'.repeat(TASK_NOTES_MAX_LENGTH));

          const res = await patch({ status: 'completed', notes });

          expect(res.status).toBe(200);
          expect(updateData().notes).toBe(notes);
        });

        it('marks done with a Focus win that takes a note under the limit over it', async () => {
          const stored = 'n'.repeat(1990);
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: stored }));
          const notes = stored + focusWin('w'.repeat(TASK_NOTES_MAX_LENGTH));

          const res = await patch({ status: 'completed', notes });

          expect(res.status).toBe(200);
          expect(updateData().notes).toBe(notes);
        });

        it('saves an edit that shortens an old long note but leaves it over the limit', async () => {
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: oldNote }));

          const res = await patch({ notes: 'e'.repeat(2500) });

          expect(res.status).toBe(200);
        });

        it('rejects adding more than one Focus win of text at once with 400', async () => {
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: oldNote }));

          const res = await patch({ status: 'completed', notes: oldNote + 'x'.repeat(TASK_NOTES_MAX_LENGTH + 101) });

          expect(res.status).toBe(400);
          expect(prisma.dailyTask.update).not.toHaveBeenCalled();
        });

        it(`never grows a note past ${TASK_NOTES_HARD_MAX} characters, but still accepts it sent back unchanged`, async () => {
          const huge = 'h'.repeat(TASK_NOTES_HARD_MAX - 100);
          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: huge }));
          const grown = await patch({ status: 'completed', notes: huge + focusWin('w'.repeat(500)) });
          expect(grown.status).toBe(400);

          (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ notes: huge }));
          const unchanged = await patch({ status: 'completed', notes: huge });
          expect(unchanged.status).toBe(200);
        });
      });

      it.each([[1], [true], [{}], [['a note']]])('rejects a non-string note (%j) with 400 and writes nothing', async (value) => {
        const res = await patch({ notes: value });

        expect(res.status).toBe(400);
        expect(prisma.dailyTask.update).not.toHaveBeenCalled();
      });
    });

    describe('slotTime', () => {
      it.each([['00:00'], ['07:30'], ['23:59']])('stores the time %s', async (value) => {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task());

        const res = await patch({ slotTime: value });

        expect(res.status).toBe(200);
        expect(updateData().slotTime).toBe(value);
      });

      it('clears the time with null', async () => {
        (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ slotTime: '07:30' }));

        const res = await patch({ slotTime: null });

        expect(res.status).toBe(200);
        expect(updateData()).toHaveProperty('slotTime', null);
      });

      it.each([['24:00'], ['7:30'], ['07:60'], ['07:30:00'], ['0730'], [' 07:30'], ['morning'], ['']])(
        'rejects the time %j with 400 and writes nothing',
        async (value) => {
          const res = await patch({ slotTime: value });

          expect(res.status).toBe(400);
          expect((await res.json()).error).toMatch(/slotTime/);
          expect(prisma.dailyTask.findUnique).not.toHaveBeenCalled();
          expect(prisma.dailyTask.update).not.toHaveBeenCalled();
        }
      );

      it.each([[730], [true], [{}], [['07:30']]])('rejects a non-string time (%j) with 400 and writes nothing', async (value) => {
        const res = await patch({ slotTime: value });

        expect(res.status).toBe(400);
        expect(prisma.dailyTask.update).not.toHaveBeenCalled();
      });
    });

    it('keeps the first completedAt and the flag when completed is sent for a task already completed', async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(
        task({ status: 'completed', completedAt: earlier, usedMinimumVersion: true })
      );

      const res = await patch({ status: 'completed', notes: 'Added later.' });

      expect(res.status).toBe(200);
      const data = updateData();
      expect(data.completedAt).toEqual(earlier);
      expect(data).not.toHaveProperty('usedMinimumVersion');
      expect(data.notes).toBe('Added later.');
    });

    it.each([['archived'], ['completed']])('refuses any change to a task of a goal that is %s with 409 goal_not_active', async (goalStatus) => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(
        task({ goal: { id: 'goal-1', userId: mockUser.id, status: goalStatus } })
      );

      const res = await patch({ notes: 'Too late.' });

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'This goal is no longer active.', reason: 'goal_not_active' });
      expect(prisma.dailyTask.update).not.toHaveBeenCalled();
    });

    it("still answers 404, not 409, for another user's archived goal", async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(
        task({ goal: { id: 'goal-2', userId: 'someone-else', status: 'archived' } })
      );

      const res = await patch({ status: 'completed' });

      expect(res.status).toBe(404);
      expect(prisma.dailyTask.update).not.toHaveBeenCalled();
    });

    it('allows a note on a rest day', async () => {
      (prisma.dailyTask.findUnique as any).mockResolvedValueOnce(task({ isRestDay: true }));

      const res = await patch({ notes: 'Walked instead.' });

      expect(res.status).toBe(200);
      expect(updateData().notes).toBe('Walked instead.');
    });
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
