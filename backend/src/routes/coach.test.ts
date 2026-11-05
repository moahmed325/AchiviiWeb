import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

// ND-40: Achivii Coach's routes. The model is never called here: askCoach is mocked.

const goalFindFirst = vi.fn();
const count = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const transaction = vi.fn();
const getAuthUser = vi.fn();
const accessFor = vi.fn();
const askCoach = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: { goal: { findFirst: goalFindFirst }, coachMessage: { count, findMany, create }, $transaction: transaction },
}));
vi.mock('./auth.js', () => ({ getAuthUser }));
vi.mock('../lib/billing/access.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/billing/access.js')>()), accessFor }));
vi.mock('../lib/coach/reply.js', () => ({ askCoach }));

const { coachRouter } = await import('./coach.js');

const USER = { id: 'u1', email: 'mo@example.com', timezone: 'UTC', trialStartedAt: new Date() };
const GOAL = {
  id: 'g1',
  userId: 'u1',
  rawGoal: 'Run a 10K',
  status: 'active',
  startDate: new Date('2026-11-02T00:00:00Z'),
  targetDate: new Date('2027-01-31T00:00:00Z'),
  currentWeek: 1,
  totalWeeks: 12,
  routine: '{}',
  roadmap: null,
  roadmapWeeks: [],
  dailyTasks: [],
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/coach', coachRouter);
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
  vi.stubEnv('COACH_ENABLED', 'true');
  getAuthUser.mockResolvedValue(USER);
  accessFor.mockResolvedValue({ state: 'trial' });
  goalFindFirst.mockResolvedValue(GOAL);
  count.mockResolvedValue(0);
  findMany.mockResolvedValue([]);
  askCoach.mockResolvedValue('Start with today’s easy run.');
  create.mockImplementation(async ({ data }) => ({ id: data.role + '-1', ...data }));
  transaction.mockImplementation(async (calls: Promise<unknown>[]) => Promise.all(calls));
});

afterEach(() => vi.unstubAllEnvs());

const send = (body: unknown) =>
  fetch(`${baseUrl}/api/coach/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer t' }, body: JSON.stringify(body) });

describe('GET /api/coach', () => {
  it('off unless COACH_ENABLED is exactly "true": nothing is read', async () => {
    vi.stubEnv('COACH_ENABLED', 'yes');
    const body = await (await fetch(`${baseUrl}/api/coach`)).json();
    expect(body).toMatchObject({ enabled: false, messages: [] });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('the active plan’s conversation, oldest first, and the messages left today', async () => {
    count.mockResolvedValue(4);
    findMany.mockResolvedValue([
      { id: 'b', role: 'coach', content: 'Hi', created_at: new Date('2026-11-05T10:00:01Z') },
      { id: 'a', role: 'user', content: 'Hello', created_at: new Date('2026-11-05T10:00:00Z') },
    ]);
    const body = await (await fetch(`${baseUrl}/api/coach`, { headers: { Authorization: 'Bearer t' } })).json();
    expect(body).toMatchObject({ enabled: true, hasGoal: true, access: 'ok', remainingToday: 26, dailyLimit: 30 });
    expect(body.messages.map((m: { id: string }) => m.id)).toEqual(['a', 'b']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { goalId: 'g1', userId: 'u1' } }));
  });

  it('a trial that ended reads as locked; 401 without a user', async () => {
    accessFor.mockResolvedValue({ state: 'locked' });
    expect((await (await fetch(`${baseUrl}/api/coach`)).json()).access).toBe('locked');
    getAuthUser.mockResolvedValue(null);
    expect((await fetch(`${baseUrl}/api/coach`)).status).toBe(401);
  });
});

describe('POST /api/coach/messages', () => {
  it('saves the message and the reply together, with the plan as context', async () => {
    const res = await send({ text: '  What should I focus on?  ', firstName: 'Mo' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages.map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'What should I focus on?'],
      ['coach', 'Start with today’s easy run.'],
    ]);
    expect(body.remainingToday).toBe(29);
    const [context, history, text] = askCoach.mock.calls[0];
    expect(context).toContain('Their goal, in their words: "Run a 10K"');
    expect(context).toContain('Their first name: Mo.');
    expect(history).toEqual([]);
    expect(text).toBe('What should I focus on?');
  });

  it('a failed reply saves nothing and says to try again', async () => {
    askCoach.mockResolvedValue(null);
    const res = await send({ text: 'Hi' });
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toBe('coach_unavailable');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('a message about self-harm gets the fixed caring reply and never reaches the model', async () => {
    const res = await send({ text: 'honestly I want to kill myself' });
    expect(res.status).toBe(200);
    expect((await res.json()).messages[1].content).toMatch(/988/);
    expect(askCoach).not.toHaveBeenCalled();
  });

  it('refuses: switch off, empty, too long, no plan, trial over, daily limit', async () => {
    vi.stubEnv('COACH_ENABLED', '');
    expect((await (await send({ text: 'Hi' })).json()).reason).toBe('coach_disabled');
    vi.stubEnv('COACH_ENABLED', 'true');
    expect((await send({ text: '   ' })).status).toBe(400);
    expect((await (await send({ text: 'x'.repeat(1001) })).json()).reason).toBe('too_long');
    goalFindFirst.mockResolvedValueOnce(null);
    expect((await (await send({ text: 'Hi' })).json()).reason).toBe('no_active_goal');
    accessFor.mockResolvedValueOnce({ state: 'locked' });
    const locked = await send({ text: 'Hi' });
    expect(locked.status).toBe(402);
    expect((await locked.json()).code).toBe('TRIAL_ENDED');
    count.mockResolvedValueOnce(30);
    const limited = await send({ text: 'Hi' });
    expect(limited.status).toBe(429);
    expect((await limited.json()).reason).toBe('coach_daily_limit');
    expect(askCoach).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('a billing read that fails never locks anyone out', async () => {
    accessFor.mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await send({ text: 'Hi' })).status).toBe(200);
  });
});
